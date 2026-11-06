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

