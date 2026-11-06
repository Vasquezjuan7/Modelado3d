// ========================================================
// Universal repository ingestion
//  - Desktop (Electron): native `git clone` or local folder via secure preload bridge
//  - Web: GitHub REST API (tree) + raw.githubusercontent.com (real file contents)
// ========================================================
import { analyzeSource, buildDependencyGraph, isRelevantFile } from './codeMetrics';
import type { DependencyEdge, RepoFile } from './codeMetrics';

export interface DesktopScanEntry {
  path: string;
  absPath: string;
  size: number;
  content?: string;
}

export interface DesktopBridge {
  isDesktop: true;
  platform: string;
  cloneRepo(url: string, branch?: string): Promise<{ dir: string; branch?: string; commit?: string }>;
  pickFolder(): Promise<string | null>;
  scanFolder(dir: string): Promise<{ entries: DesktopScanEntry[]; truncated: boolean }>;
  writeFile(absPath: string, content: string): Promise<void>;
  openPath(p: string): Promise<void>;
  onProgress(cb: (msg: string) => void): () => void;
}

declare global {
  interface Window {
    nexusDesktop?: DesktopBridge;
  }
}

export const desktop: DesktopBridge | undefined = typeof window !== 'undefined' ? window.nexusDesktop : undefined;
export const isDesktop = Boolean(desktop?.isDesktop);

export interface RepoInfo {
  source: 'github' | 'git' | 'local';
  /** owner/repo or folder name */
  slug: string;
  displayName: string;
  url?: string;
  branch: string;
  commit?: string;
  description?: string;
  stars?: number;
  defaultBranch?: string;
  localDir?: string;
  truncated: boolean;
  skippedFiles: number;
  loadedAt: number;
}

export interface LoadedRepo {
  info: RepoInfo;
  files: RepoFile[];
  edges: DependencyEdge[];
}

export interface LoadProgress {
  phase: 'resolve' | 'tree' | 'download' | 'clone' | 'scan' | 'analyze' | 'done';
  message: string;
  done?: number;
  total?: number;
}

export interface ParsedRepoInput {
  kind: 'github' | 'git';
  owner?: string;
  repo?: string;
  branch?: string;
  subPath?: string;
  cloneUrl: string;
}

/** Maximum buildings in the city (keeps the 3D scene fluid) */
export const MAX_FILES = 1500;
/** Maximum files whose content is downloaded in web mode */
const MAX_CONTENT_DOWNLOADS = 900;
const MAX_CONTENT_SIZE = 400_000;

