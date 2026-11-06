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

