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

