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

export function parseRepoInput(raw: string): ParsedRepoInput | null {
  const input = raw.trim();
  if (!input) return null;

  // owner/repo shorthand
  const short = input.match(/^([\w.-]+)\/([\w.-]+)$/);
  if (short) {
    const repo = short[2].replace(/\.git$/, '');
    return { kind: 'github', owner: short[1], repo, cloneUrl: `https://github.com/${short[1]}/${repo}.git` };
  }

  // git@github.com:owner/repo.git
  const ssh = input.match(/^git@github\.com:([\w.-]+)\/([\w.-]+?)(?:\.git)?$/);
  if (ssh) {
    return { kind: 'github', owner: ssh[1], repo: ssh[2], cloneUrl: `https://github.com/${ssh[1]}/${ssh[2]}.git` };
  }

  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
  } catch {
    return null;
  }

  if (url.hostname === 'github.com' || url.hostname === 'www.github.com') {
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length < 2) return null;
    const owner = parts[0];
    const repo = parts[1].replace(/\.git$/, '');
    let branch: string | undefined;
    let subPath: string | undefined;
    if ((parts[2] === 'tree' || parts[2] === 'blob') && parts[3]) {
      branch = decodeURIComponent(parts[3]);
      subPath = parts.slice(4).map(decodeURIComponent).join('/') || undefined;
    }
    return { kind: 'github', owner, repo, branch, subPath, cloneUrl: `https://github.com/${owner}/${repo}.git` };
  }

  if (url.protocol === 'https:' || url.protocol === 'http:') {
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length < 2) return null;
    return { kind: 'git', cloneUrl: url.toString() };
  }
  return null;
}

