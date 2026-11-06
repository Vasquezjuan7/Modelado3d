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

export function sevRank(s: Severity | 'CLEAN'): number {
  return s === 'CRITICAL' ? 4 : s === 'HIGH' ? 3 : s === 'MEDIUM' ? 2 : s === 'LOW' ? 1 : 0;
}

function computeScore(issues: DetectedIssue[]): number {
  // Diminishing returns per kind of issue: 20 identical warnings ≠ 20 different bugs
  const groups = new Map<string, { w: number; n: number }>();
  for (const i of issues) {
    const key = i.title.replace(/\s*\(×\d+\)$/, '');
    const w = i.severity === 'CRITICAL' ? 22 : i.severity === 'HIGH' ? 12 : i.severity === 'MEDIUM' ? 5 : 1.5;
    const n = Number(i.title.match(/\(×(\d+)\)$/)?.[1] || 1);
    const g = groups.get(key) || { w, n: 0 };
    g.w = Math.max(g.w, w);
    g.n += n;
    groups.set(key, g);
  }
  let penalty = 0;
  for (const g of groups.values()) penalty += Math.min(g.w * 3, g.w * (1 + Math.log2(g.n)));
  return Math.max(0, Math.round(100 - penalty));
}

/** Collapse repeated low-impact findings into a single entry */
function collapseRepeats(issues: DetectedIssue[]): DetectedIssue[] {
  const byTitle = new Map<string, DetectedIssue[]>();
  for (const i of issues) {
    if (!byTitle.has(i.title)) byTitle.set(i.title, []);
    byTitle.get(i.title)!.push(i);
  }
  const out: DetectedIssue[] = [];
  for (const [title, list] of byTitle) {
    if (list.length > 3 && (list[0].severity === 'LOW' || list[0].severity === 'MEDIUM')) {
      out.push({ ...list[0], title: `${title} (×${list.length})`, message: `${list[0].message} (${list.length} apariciones; primera en la línea ${list[0].line})` });
    } else out.push(...list);
  }
  return out;
}

// --------------------------------------------------------
// 2. Prompting
// --------------------------------------------------------
const MAX_CODE_CHARS = 60_000;

function numbered(code: string): string {
  const src = code.length > MAX_CODE_CHARS ? code.slice(0, MAX_CODE_CHARS) : code;
  return src.split(/\r?\n/).map((l, i) => `${String(i + 1).padStart(4, ' ')}| ${l}`).join('\n') +
    (code.length > MAX_CODE_CHARS ? '\n…[archivo truncado para el análisis]' : '');
}

function buildPrompt(code: string, fileName: string, filePath: string, lang: 'es' | 'en', context?: string): string {
  const language = lang === 'es' ? 'español' : 'English';
  return `Eres un auditor senior de seguridad, rendimiento y arquitectura de software.
Audita el archivo "${fileName}" (ruta: ${filePath}).${context ? `\nContexto del repositorio: ${context}` : ''}

Instrucciones:
- Reporta solo problemas REALES y verificables en el código mostrado (seguridad, rendimiento, bugs, arquitectura, mantenibilidad, tipado). No inventes problemas.
- "line" debe ser el número exacto de la línea (los números aparecen a la izquierda de "|").
- "snippet" es el fragmento literal de esa línea (sin el número).
- "score" es la calidad global del archivo de 0 (pésimo) a 100 (excelente).
- "refactoredCode" es el archivo COMPLETO corregido, listo para reemplazar el original, sin números de línea ni bloques markdown. Mantén el comportamiento y el estilo existentes; si el archivo ya está bien, devuélvelo sin cambios.
- Si no hay problemas, devuelve "issues": [] y "severity": "CLEAN".
- Escribe todos los textos en ${language}.

CÓDIGO:
${numbered(code)}`;
}

const GEMINI_SCHEMA = {
  type: 'OBJECT',
  properties: {
    title: { type: 'STRING' },
    severity: { type: 'STRING', enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'CLEAN'] },
    summary: { type: 'STRING' },
    score: { type: 'INTEGER' },
    issues: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          line: { type: 'INTEGER' },
          type: { type: 'STRING', enum: ['security', 'performance', 'bug', 'architecture', 'maintainability', 'type-safety'] },
          severity: { type: 'STRING', enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] },
          title: { type: 'STRING' },
          message: { type: 'STRING' },
          snippet: { type: 'STRING' },
          fix: { type: 'STRING' },
        },
        required: ['line', 'type', 'severity', 'title', 'message'],
      },
    },
    explanation: { type: 'STRING' },
    refactoredCode: { type: 'STRING' },
  },
  required: ['title', 'severity', 'summary', 'score', 'issues', 'explanation', 'refactoredCode'],
};

function stripFences(text: string): string {
  return text.trim().replace(/^```(?:json|[a-z]+)?\s*/i, '').replace(/```\s*$/, '').trim();
}

function parseJsonLoose(text: string): any {
  const clean = stripFences(text);
  try {
    return JSON.parse(clean);
  } catch {
    const start = clean.indexOf('{');
    const end = clean.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(clean.slice(start, end + 1));
    throw new Error('La IA devolvió una respuesta que no es JSON válido.');
  }
}

function normalizeResult(parsed: any, original: string, provider: 'gemini' | 'openai', model: string, durationMs: number, usage?: AuditResult['usage']): AuditResult {
  const validSev = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
  const issues: DetectedIssue[] = (Array.isArray(parsed.issues) ? parsed.issues : []).map((i: any) => ({
    line: Number.isFinite(+i.line) ? Math.max(1, Math.round(+i.line)) : 1,
    type: i.type || 'bug',
    severity: validSev.includes(i.severity) ? i.severity : 'MEDIUM',
    title: String(i.title || 'Hallazgo'),
    message: String(i.message || ''),
    snippet: String(i.snippet || '').trim(),
    fix: i.fix ? String(i.fix) : undefined,
  }));
  issues.sort((a, b) => sevRank(b.severity) - sevRank(a.severity) || a.line - b.line);
  let refactored: string | null = typeof parsed.refactoredCode === 'string' ? stripFences(parsed.refactoredCode) : null;
  if (refactored !== null && !refactored.trim()) refactored = null;
  // Keep original trailing newline convention
  if (refactored && original.endsWith('\n') && !refactored.endsWith('\n')) refactored += '\n';
  const sev = parsed.severity === 'CLEAN' || validSev.includes(parsed.severity) ? parsed.severity : issues[0]?.severity || 'CLEAN';
  return {
    title: String(parsed.title || (issues[0]?.title ?? 'Auditoría completada')),
    severity: issues.length === 0 ? 'CLEAN' : sev,
    summary: String(parsed.summary || ''),
    score: Number.isFinite(+parsed.score) ? Math.max(0, Math.min(100, Math.round(+parsed.score))) : computeScore(issues),
    issues,
    refactoredCode: refactored,
    explanation: String(parsed.explanation || ''),
    provider,
    modelName: model,
    durationMs,
    usage,
  };
}

// --------------------------------------------------------
// 3. Google Gemini
// --------------------------------------------------------
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';

export interface GeminiModelInfo {
  id: string;
  displayName: string;
  inputTokenLimit?: number;
  outputTokenLimit?: number;
}

class GeminiError extends Error {
  suggestedModel?: string;
  status?: number;
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const id = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(id);
      reject(new DOMException('Cancelado', 'AbortError'));
    });
  });

async function geminiError(res: Response): Promise<GeminiError> {
  let msg = `HTTP ${res.status}`;
  try {
    const body = await res.json();
    if (body?.error?.message) msg = body.error.message;
  } catch {
    /* ignore */
  }
  const suggested = msg.match(/use\s+models\/([\w.-]+)/i)?.[1];
  if (res.status === 400 && /API key not valid|API_KEY_INVALID/i.test(msg)) msg = 'La API key de Gemini no es válida.';
  else if (res.status === 403) msg = `Acceso denegado por Google: ${msg}`;
  else if (res.status === 429) msg = `Cuota de Gemini agotada o demasiadas peticiones: ${msg}`;
  else if (res.status === 404) msg = `Modelo no disponible para esta clave: ${msg}`;
  else if (res.status === 503 || res.status === 500) msg = `Gemini está saturado temporalmente (HTTP ${res.status}). Reintenta en unos segundos o elige otro modelo en Ajustes. Detalle: ${msg}`;
  const err = new GeminiError(msg);
  err.status = res.status;
  if (res.status === 404 && suggested) err.suggestedModel = suggested;
  return err;
}

const MODELS_CACHE_KEY = 'codecity_gemini_models';

function cachedModelIds(): string[] {
  try {
    return JSON.parse(localStorage.getItem(MODELS_CACHE_KEY) || '[]');
  } catch {
    return [];
  }
}

/** Stable, versioned Flash models from the key's own model list, newest first */
function fallbackModels(current: string): string[] {
  return cachedModelIds()
    .filter((id) => id !== current && (modelRank(id) === 1 || modelRank(id) === 3))
    .slice(0, 6);
}

/**
 * POST generateContent with resilience:
 *  - follows Google's "model retired, use models/X" hint
 *  - retries transient overloads (500/503) and timeouts
 *  - falls back to other stable Flash models available to the key
 */
async function geminiCall(apiKey: string, model: string, body: object, signal?: AbortSignal, timeoutMs = 90_000): Promise<{ data: any; model: string; note?: string }> {
  const call = async (m: string) => {
    const ctrl = new AbortController();
    const onAbort = () => ctrl.abort();
    signal?.addEventListener('abort', onAbort);
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      return await fetch(`${GEMINI_BASE}/models/${encodeURIComponent(m)}:generateContent`, {
        method: 'POST',
        signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey.trim() },
        body: JSON.stringify(body),
      });
    } catch (e) {
      if (signal?.aborted) throw e;
      const err = new GeminiError(`Gemini no respondió a tiempo con ${m} (${Math.round(timeoutMs / 1000)} s) o se cortó la conexión.`);
      err.status = 504;
      return err;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    }
  };

  const queue = [model, ...fallbackModels(model)];
  const tried: string[] = [];
  let lastErr: GeminiError | null = null;
  while (queue.length) {
    const m = queue.shift()!;
    if (tried.includes(m)) continue;
    tried.push(m);
    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await call(m);
      if (!(res instanceof GeminiError) && res.ok) {
        const note = m !== model ? `${model} no estaba disponible; respondió ${m}.` : undefined;
        return { data: await res.json(), model: m, note };
      }
      const err = res instanceof GeminiError ? res : await geminiError(res);
      lastErr = err;
      if (err.suggestedModel && !tried.includes(err.suggestedModel)) {
        queue.unshift(err.suggestedModel);
        break;
      }
      if (err.status === 429) break; // free-tier quotas are per model → try the next one
      const transient = err.status === 503 || err.status === 500 || err.status === 504;
      if (!transient) throw err; // bad key, bad request… → surface immediately
      if (err.status === 504) break; // timed out: go straight to the next model
      if (attempt === 0) await sleep(2000, signal);
    }
  }
  throw lastErr ?? new Error('Gemini no está disponible.');
}

