// ========================================================
// CodeCity Nexus 3D — AI audit engine
//  - Offline heuristic scanner (no key needed, runs over the whole repo)
//  - Google Gemini (REST v1beta, structured JSON output)
//  - OpenAI (Chat Completions, JSON mode)
// ========================================================

export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type IssueType = 'security' | 'performance' | 'bug' | 'architecture' | 'maintainability' | 'type-safety';

export interface DetectedIssue {
  line: number;
  type: IssueType;
  severity: Severity;
  title: string;
  message: string;
  snippet: string;
  fix?: string;
}

export interface AuditResult {
  title: string;
  severity: Severity | 'CLEAN';
  summary: string;
  score: number; // 0-100 quality score (100 = excellent)
  issues: DetectedIssue[];
  refactoredCode: string | null;
  explanation: string;
  provider: 'gemini' | 'openai' | 'local';
  modelName: string;
  durationMs: number;
  usage?: { inputTokens?: number; outputTokens?: number };
}

export type AIProvider = 'gemini' | 'openai' | 'local';

export interface AIConfig {
  provider: AIProvider;
  geminiKey: string;
  geminiModel: string;
  openaiKey: string;
  openaiModel: string;
}

export const DEFAULT_GEMINI_MODEL = 'gemini-flash-latest';
export const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini';

const DEFAULT_AI_CONFIG: AIConfig = {
  provider: 'local',
  geminiKey: '',
  geminiModel: DEFAULT_GEMINI_MODEL,
  openaiKey: '',
  openaiModel: DEFAULT_OPENAI_MODEL,
};

const STORAGE_KEY = 'codecity_ai_config_v2';

export function getStoredAIConfig(): AIConfig {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return { ...DEFAULT_AI_CONFIG, ...JSON.parse(saved) };
    // migrate v1
    const old = localStorage.getItem('codecity_ai_config');
    if (old) {
      const o = JSON.parse(old);
      const cfg = { ...DEFAULT_AI_CONFIG };
      if (o.provider === 'gemini' && o.apiKey) {
        cfg.provider = 'gemini';
        cfg.geminiKey = o.apiKey;
      } else if (o.provider === 'openai' && o.apiKey) {
        cfg.provider = 'openai';
        cfg.openaiKey = o.apiKey;
        cfg.openaiModel = o.model || DEFAULT_OPENAI_MODEL;
      }
      return cfg;
    }
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_AI_CONFIG };
}

export function saveStoredAIConfig(config: AIConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    /* ignore */
  }
}

export function isAIReady(cfg: AIConfig): boolean {
  if (cfg.provider === 'gemini') return cfg.geminiKey.trim().length > 10;
  if (cfg.provider === 'openai') return cfg.openaiKey.trim().length > 10;
  return false;
}

// --------------------------------------------------------
// 1. Offline heuristic scanner
// --------------------------------------------------------
interface Rule {
  re: RegExp;
  type: IssueType;
  severity: Severity;
  title: string;
  message: string;
  fix?: string;
  exts?: string[];
  skip?: RegExp;
}

const SCRIPT_EXTS = ['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'vue', 'svelte', 'py', 'rb', 'php', 'java', 'kt', 'go', 'cs', 'rs', 'html'];

const RULES: Rule[] = [
  {
    re: /\b(SELECT|INSERT\s+INTO|UPDATE|DELETE\s+FROM)\b[^;\n]*?(["'`]\s*\+\s*[\w.[\]]+|\$\{[^}]+\}|%s|\.format\(|f["'][^"']*\{)/i,
    type: 'security', severity: 'CRITICAL', title: 'Posible inyección SQL (CWE-89)',
    message: 'La consulta SQL se construye concatenando o interpolando valores. Un atacante podría alterar la consulta.',
    fix: 'Usa consultas parametrizadas / prepared statements ($1, ?, :param) o el query builder del ORM.',
    exts: SCRIPT_EXTS,
  },
  {
    re: /\beval\s*\(|new\s+Function\s*\(/,
    type: 'security', severity: 'CRITICAL', title: 'Ejecución dinámica de código (eval)',
    message: 'eval / new Function ejecutan texto arbitrario como código y abren la puerta a RCE/XSS.',
    fix: 'Sustitúyelo por un parser seguro (JSON.parse, json.loads, ast.literal_eval) o por un mapa de funciones permitidas.',
    exts: ['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'vue', 'svelte', 'py', 'php', 'html'],
  },
  {
    re: /dangerouslySetInnerHTML|\.innerHTML\s*=|\.outerHTML\s*=|document\.write\s*\(|v-html=/,
    type: 'security', severity: 'HIGH', title: 'Inserción de HTML sin sanear (XSS, CWE-79)',
    message: 'Se inyecta HTML en el DOM directamente. Si el contenido proviene del usuario puede ejecutar scripts.',
    fix: 'Renderiza texto (textContent) o sanea con DOMPurify antes de insertarlo.',
  },
  {
    re: /(api[_-]?key|secret|passw(or)?d|token|private[_-]?key|access[_-]?key)\s*[:=]\s*["'`][A-Za-z0-9_\-./+=]{12,}["'`]/i,
    type: 'security', severity: 'HIGH', title: 'Credencial escrita en el código (CWE-798)',
    message: 'Parece un secreto en texto plano. Cualquiera con acceso al repositorio puede usarlo.',
    fix: 'Muévelo a variables de entorno o a un gestor de secretos y rota la clave expuesta.',
    skip: /process\.env|import\.meta\.env|os\.environ|getenv|example|placeholder|your[_-]?|xxx|\*\*\*/i,
  },
  {
    re: /\b(AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{35}|sk-[A-Za-z0-9]{32,}|ghp_[A-Za-z0-9]{36}|xox[baprs]-[A-Za-z0-9-]{10,})\b/,
    type: 'security', severity: 'CRITICAL', title: 'Clave de servicio real expuesta',
    message: 'El patrón coincide con una clave de AWS/Google/OpenAI/GitHub/Slack.',
    fix: 'Revoca la clave inmediatamente y cárgala desde el entorno.',
  },
  {
    re: /\b(exec|execSync|spawn)\s*\(\s*[`'"][^`'"]*(\$\{|["']\s*\+)/,
    type: 'security', severity: 'CRITICAL', title: 'Inyección de comandos del sistema (CWE-78)',
    message: 'Se construye un comando de shell con datos dinámicos.',
    fix: 'Usa execFile/spawn con un array de argumentos y valida la entrada.',
    exts: ['ts', 'js', 'mjs', 'cjs', 'tsx', 'jsx'],
  },
  {
    re: /\b(os\.system|subprocess\.(call|run|Popen))\s*\([^)]*shell\s*=\s*True/,
    type: 'security', severity: 'HIGH', title: 'subprocess con shell=True',
    message: 'shell=True con datos externos permite inyección de comandos.',
    fix: 'Pasa una lista de argumentos y shell=False.',
    exts: ['py'],
  },
  {
    re: /\bpickle\.loads?\(|yaml\.load\((?![^)]*Loader)/,
    type: 'security', severity: 'HIGH', title: 'Deserialización insegura (CWE-502)',
    message: 'pickle / yaml.load pueden ejecutar código al deserializar datos no confiables.',
    fix: 'Usa json o yaml.safe_load.',
    exts: ['py'],
  },
  {
    re: /\bMath\.random\(\).*\b(token|password|secret|id|key)\b|\b(token|password|secret|key)\b.*Math\.random\(\)/i,
    type: 'security', severity: 'MEDIUM', title: 'Aleatoriedad no criptográfica para secretos',
    message: 'Math.random no es seguro para generar tokens o identificadores sensibles.',
    fix: 'Usa crypto.getRandomValues / crypto.randomUUID.',
  },
  {
    re: /verify\s*=\s*False|rejectUnauthorized\s*:\s*false|NODE_TLS_REJECT_UNAUTHORIZED/,
    type: 'security', severity: 'HIGH', title: 'Verificación TLS desactivada',
    message: 'Desactivar la verificación de certificados permite ataques man-in-the-middle.',
  },
  {
    re: /catch\s*\(\s*\w*\s*\)\s*\{\s*\}|except\s*:\s*pass|except\s+Exception\s*:\s*pass/,
    type: 'bug', severity: 'MEDIUM', title: 'Excepción silenciada',
    message: 'El error se captura y se descarta; los fallos pasan desapercibidos.',
    fix: 'Registra el error o propágalo con contexto.',
  },
  {
    re: /^\s*var\s+\w+\s*=/,
    type: 'maintainability', severity: 'LOW', title: 'Uso de var',
    message: 'var tiene ámbito de función y provoca errores sutiles de hoisting.',
    fix: 'Usa const o let.',
    exts: ['ts', 'tsx', 'js', 'jsx', 'mjs'],
    skip: /^\s*\/\//,
  },
  {
    re: /console\.(log|debug)\(/,
    type: 'maintainability', severity: 'LOW', title: 'console.log en código',
    message: 'Logs de depuración olvidados ensucian la consola y pueden filtrar datos.',
    exts: ['ts', 'tsx', 'jsx', 'vue', 'svelte'],
  },
];

const LOOP_RE = /\b(for\s*\(|for\s+\w+\s+(in|of)\b|for\s+\w+\s+in\s+|while\s*\(|\.forEach\s*\(|\.map\s*\(\s*async)/;
const IO_RE = /(\.query\(|\.find(One|Many|ById)?\(|\.execute\(|\.findUnique\(|\.get\(\s*['"`]\/|fetch\(|axios\.(get|post)|requests\.(get|post)|\.objects\.(get|filter)\(|cursor\.execute\()/;

export function analyzeCodeLocally(code: string, fileName: string): AuditResult {
  const started = performance.now();
  const lines = code.split(/\r?\n/);
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const issues: DetectedIssue[] = [];
  const seen = new Set<string>();
  const push = (i: DetectedIssue) => {
    const key = i.title + ':' + i.line;
    if (!seen.has(key)) {
      seen.add(key);
      issues.push(i);
    }
  };

  let loopDepthUntil = -1;
  let anyCount = 0;
  let inBlockComment = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (inBlockComment) {
      if (trimmed.includes('*/')) inBlockComment = false;
      continue;
    }
    if (trimmed.startsWith('/*') && !trimmed.includes('*/')) {
      inBlockComment = true;
      continue;
    }
    if (trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('*')) continue;

    for (const r of RULES) {
      if (r.exts && !r.exts.includes(ext)) continue;
      if (r.skip && r.skip.test(line)) continue;
      if (r.re.test(line)) {
        push({ line: i + 1, type: r.type, severity: r.severity, title: r.title, message: r.message, snippet: trimmed.slice(0, 200), fix: r.fix });
      }
    }

    if (LOOP_RE.test(line)) loopDepthUntil = i + 12;
    if (i <= loopDepthUntil && !LOOP_RE.test(line) && IO_RE.test(line) && /\bawait\b|\.then\(|\bfetch\(|cursor/.test(line)) {
      push({
        line: i + 1, type: 'performance', severity: 'HIGH', title: 'Consulta / petición dentro de un bucle (N+1)',
        message: 'Se realiza una operación de I/O por cada iteración. Con N elementos se generan N viajes a la base de datos o a la red.',
        snippet: trimmed.slice(0, 200), fix: 'Agrupa en una sola consulta (IN / JOIN / batch) o usa Promise.all con concurrencia limitada.',
      });
    }

    if ((ext === 'ts' || ext === 'tsx') && /:\s*any\b|as\s+any\b|<any>/.test(line)) anyCount++;
  }

  if (anyCount >= 5) {
    push({
      line: 1, type: 'type-safety', severity: 'MEDIUM', title: `Uso extendido de "any" (${anyCount}×)`,
      message: 'El tipo any desactiva la comprobación de TypeScript y oculta errores en tiempo de compilación.',
      snippet: `${anyCount} apariciones de any`, fix: 'Define interfaces o usa unknown con narrowing.',
    });
  }
  if (lines.length > 600) {
    push({
      line: 1, type: 'architecture', severity: lines.length > 1200 ? 'HIGH' : 'MEDIUM', title: 'Archivo monolítico (God Object)',
      message: `El archivo tiene ${lines.length} líneas. Es difícil de mantener y probablemente mezcla varias responsabilidades.`,
      snippet: `${lines.length} líneas`, fix: 'Divide el módulo por responsabilidades (componentes, servicios, utilidades).',
    });
  }
  const longLines = lines.filter((l) => l.length > 220).length;
  if (longLines > 10 && !/\.(json|md|lock|svg|html)$/.test(fileName)) {
    push({
      line: 1, type: 'maintainability', severity: 'LOW', title: 'Líneas excesivamente largas',
      message: `${longLines} líneas superan los 220 caracteres; dificulta la lectura y las revisiones.`, snippet: '', fix: 'Configura Prettier/formatter.',
    });
  }

  const finalIssues = collapseRepeats(issues).sort((a, b) => sevRank(b.severity) - sevRank(a.severity) || a.line - b.line);
  const severity = finalIssues.length ? finalIssues[0].severity : 'CLEAN';
  const score = computeScore(finalIssues);
  return {
    title: finalIssues.length ? finalIssues[0].title : 'Sin problemas detectados',
    severity,
    summary: finalIssues.length
      ? `El escáner offline encontró ${finalIssues.length} hallazgo(s) en ${fileName}. Para una revisión profunda y un refactor automático conecta Gemini u OpenAI.`
      : `No se detectaron patrones de riesgo conocidos en ${fileName}.`,
    score,
    issues: finalIssues,
    refactoredCode: null,
    explanation: 'Análisis heurístico local basado en reglas (inyección SQL, XSS, secretos, N+1, eval, deserialización, tamaño de módulo…).',
    provider: 'local',
    modelName: 'Escáner heurístico offline',
    durationMs: Math.round(performance.now() - started),
  };
}

