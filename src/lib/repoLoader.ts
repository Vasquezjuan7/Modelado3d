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

// --------------------------------------------------------
// GitHub REST
// --------------------------------------------------------
async function gh<T>(path: string, token?: string, signal?: AbortSignal): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/vnd.github+json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`https://api.github.com${path}`, { headers, signal });
  if (!res.ok) {
    let msg = `GitHub respondió ${res.status}`;
    try {
      const body = await res.json();
      if (body?.message) msg += `: ${body.message}`;
    } catch {
      /* ignore */
    }
    if (res.status === 404) msg = 'Repositorio no encontrado o privado (revisa la URL o añade un token de GitHub en Ajustes).';
    if (res.status === 403 && res.headers.get('x-ratelimit-remaining') === '0') {
      const reset = Number(res.headers.get('x-ratelimit-reset') || 0) * 1000;
      const mins = reset ? Math.max(1, Math.ceil((reset - Date.now()) / 60000)) : 60;
      msg = `Límite de la API de GitHub alcanzado (60 peticiones/hora sin token). Espera ~${mins} min o añade un token personal de GitHub en Ajustes.`;
    }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

async function runPool<T>(items: T[], concurrency: number, worker: (item: T, idx: number) => Promise<void>, signal?: AbortSignal) {
  let next = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) {
      if (signal?.aborted) throw new DOMException('Cancelado', 'AbortError');
      const idx = next++;
      await worker(items[idx], idx);
    }
  });
  await Promise.all(runners);
}

async function loadFromGitHub(
  parsed: ParsedRepoInput,
  opts: { token?: string; signal?: AbortSignal; onProgress: (p: LoadProgress) => void },
): Promise<LoadedRepo> {
  const { owner, repo } = parsed as { owner: string; repo: string };
  const { token, signal, onProgress } = opts;

  onProgress({ phase: 'resolve', message: `Resolviendo ${owner}/${repo} en GitHub…` });
  const meta = await gh<{ default_branch: string; description: string | null; stargazers_count: number; full_name: string; html_url: string }>(
    `/repos/${owner}/${repo}`, token, signal,
  );
  const branch = parsed.branch || meta.default_branch;

  onProgress({ phase: 'tree', message: `Leyendo árbol de archivos (${branch})…` });
  const tree = await gh<{ sha: string; truncated: boolean; tree: Array<{ path: string; type: string; size?: number }> }>(
    `/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`, token, signal,
  );

  let blobs = tree.tree.filter((t) => t.type === 'blob' && isRelevantFile(t.path, t.size || 0));
  if (parsed.subPath) {
    const prefix = parsed.subPath.replace(/\/$/, '') + '/';
    blobs = blobs.filter((b) => b.path.startsWith(prefix));
  }
  if (blobs.length === 0) throw new Error('El repositorio no contiene archivos de código reconocibles.');

  // Largest files first: they shape the skyline. Cap to keep the scene fluid.
  blobs.sort((a, b) => (b.size || 0) - (a.size || 0));
  const skipped = Math.max(0, blobs.length - MAX_FILES);
  blobs = blobs.slice(0, MAX_FILES);

  const downloadable = blobs.filter((b) => (b.size || 0) <= MAX_CONTENT_SIZE).slice(0, MAX_CONTENT_DOWNLOADS);
  const contents = new Map<string, string>();
  let done = 0;
  onProgress({ phase: 'download', message: 'Descargando código fuente real…', done: 0, total: downloadable.length });

  await runPool(downloadable, 16, async (b) => {
    const url = `https://raw.githubusercontent.com/${owner}/${repo}/${tree.sha}/${b.path.split('/').map(encodeURIComponent).join('/')}`;
    try {
      const res = await fetch(url, { signal });
      if (res.ok) {
        const text = await res.text();
        if (!text.includes('\u0000')) contents.set(b.path, text);
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') throw e;
    }
    done++;
    if (done % 8 === 0 || done === downloadable.length) {
      onProgress({ phase: 'download', message: 'Descargando código fuente real…', done, total: downloadable.length });
    }
  }, signal);

  onProgress({ phase: 'analyze', message: 'Calculando métricas y dependencias…' });
  const files = blobs.map((b) => analyzeSource(b.path, b.size || 0, contents.get(b.path)));
  const edges = buildDependencyGraph(files);

  return {
    info: {
      source: 'github',
      slug: `${owner}/${repo}`,
      displayName: meta.full_name || `${owner}/${repo}`,
      url: meta.html_url,
      branch,
      commit: tree.sha,
      description: meta.description || undefined,
      stars: meta.stargazers_count,
      defaultBranch: meta.default_branch,
      truncated: tree.truncated,
      skippedFiles: skipped,
      loadedAt: Date.now(),
    },
    files,
    edges,
  };
}

