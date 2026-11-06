// ========================================================
// Real source metrics: LOC, functions, imports, language
// ========================================================

export interface RepoFile {
  /** Repo-relative path using forward slashes */
  path: string;
  name: string;
  ext: string;
  size: number;
  /** Real source text (may be absent for binaries / skipped files) */
  content?: string;
  /** Physical lines (real when content is known, estimated otherwise) */
  lines: number;
  /** Non-blank, non-comment lines */
  sloc: number;
  functions: number;
  imports: string[];
  language: string;
  linesEstimated: boolean;
  /** Absolute path on disk (desktop mode only) */
  absPath?: string;
}

