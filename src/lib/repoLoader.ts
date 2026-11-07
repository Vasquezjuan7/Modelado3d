// ========================================================
// Universal repository ingestion
//  - Desktop (Electron): native `git clone` or local folder via secure preload bridge
//  - Web: GitHub REST API (tree) + raw.githubusercontent.com (real file contents)
// ========================================================
import { analyzeSource, buildDependencyGraph, isRelevantFile } from './codeMetrics';
import type { DependencyEdge, RepoFile } from './codeMetrics';
import { deleteCloudRecent, fetchCloudRecents, upsertCloudRecents } from '../supabaseClient';

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

// --------------------------------------------------------
// Desktop (Electron) — native clone & local folders
// --------------------------------------------------------
async function loadFromDisk(
  dir: string,
  meta: Omit<RepoInfo, 'truncated' | 'skippedFiles' | 'loadedAt' | 'localDir'>,
  onProgress: (p: LoadProgress) => void,
): Promise<LoadedRepo> {
  onProgress({ phase: 'scan', message: 'Escaneando archivos en disco…' });
  const { entries, truncated } = await desktop!.scanFolder(dir);
  const relevant = entries.filter((e) => isRelevantFile(e.path, e.size));
  if (relevant.length === 0) throw new Error('La carpeta no contiene archivos de código reconocibles.');
  relevant.sort((a, b) => b.size - a.size);
  const kept = relevant.slice(0, MAX_FILES);

  onProgress({ phase: 'analyze', message: 'Calculando métricas y dependencias…' });
  const files = kept.map((e) => ({ ...analyzeSource(e.path, e.size, e.content), absPath: e.absPath }));
  const edges = buildDependencyGraph(files);
  return {
    info: { ...meta, localDir: dir, truncated, skippedFiles: relevant.length - kept.length, loadedAt: Date.now() },
    files,
    edges,
  };
}

export async function loadRepository(
  input: string,
  opts: { githubToken?: string; signal?: AbortSignal; onProgress: (p: LoadProgress) => void; preferApi?: boolean },
): Promise<LoadedRepo> {
  const parsed = parseRepoInput(input);
  if (!parsed) throw new Error('URL no válida. Usa por ejemplo https://github.com/owner/repo o owner/repo.');

  // Desktop: prefer a real git clone (works for GitHub, GitLab, Bitbucket, self-hosted…)
  if (isDesktop && desktop && (!opts.preferApi || parsed.kind === 'git')) {
    try {
      opts.onProgress({ phase: 'clone', message: `Clonando ${parsed.cloneUrl}…` });
      const off = desktop.onProgress((m) => opts.onProgress({ phase: 'clone', message: m }));
      let cloned: { dir: string; branch?: string; commit?: string };
      try {
        cloned = await desktop.cloneRepo(parsed.cloneUrl, parsed.branch);
      } finally {
        off();
      }
      const scanDir = parsed.subPath ? `${cloned.dir}/${parsed.subPath}` : cloned.dir;
      const slug = parsed.owner ? `${parsed.owner}/${parsed.repo}` : parsed.cloneUrl.replace(/^https?:\/\//, '').replace(/\.git$/, '');
      return await loadFromDisk(scanDir, {
        source: parsed.kind === 'github' ? 'github' : 'git',
        slug,
        displayName: slug,
        url: parsed.cloneUrl.replace(/\.git$/, ''),
        branch: cloned.branch || parsed.branch || 'HEAD',
        commit: cloned.commit || undefined,
      }, opts.onProgress);
    } catch (err) {
      if (parsed.kind !== 'github') throw err;
      console.warn('git clone falló, usando la API de GitHub:', err);
    }
  }

  if (parsed.kind !== 'github') {
    throw new Error('En la versión web solo se admiten repositorios de GitHub. Usa la app de escritorio para GitLab/Bitbucket u otros servidores Git.');
  }
  return loadFromGitHub(parsed, { token: opts.githubToken, signal: opts.signal, onProgress: opts.onProgress });
}

export async function loadLocalFolder(onProgress: (p: LoadProgress) => void): Promise<LoadedRepo | null> {
  if (!desktop) return null;
  const dir = await desktop.pickFolder();
  if (!dir) return null;
  const name = dir.split(/[\\/]/).filter(Boolean).pop() || dir;
  return loadFromDisk(dir, { source: 'local', slug: name, displayName: name, branch: 'local' }, onProgress);
}

export function fileWebUrl(info: RepoInfo, path: string): string | undefined {
  if (info.source === 'github' && info.url) {
    const base = info.url.replace(/\.git$/, '');
    return `${base}/blob/${info.commit || info.branch}/${path}`;
  }
  return undefined;
}

// --------------------------------------------------------
// Recent repositories (localStorage)
// --------------------------------------------------------
const RECENTS_KEY = 'codecity_recent_repos';
export interface RecentRepo {
  input: string;
  name: string;
  files: number;
  at: number;
}

export function getRecentRepos(): RecentRepo[] {
  try {
    return JSON.parse(localStorage.getItem(RECENTS_KEY) || '[]');
  } catch {
    return [];
  }
}

export function pushRecentRepo(r: RecentRepo) {
  const list = getRecentRepos().filter((x) => x.name !== r.name);
  list.unshift(r);
  localStorage.setItem(RECENTS_KEY, JSON.stringify(list.slice(0, 6)));
  void upsertCloudRecents([r]);
}

export function removeRecentRepo(name: string) {
  localStorage.setItem(RECENTS_KEY, JSON.stringify(getRecentRepos().filter((x) => x.name !== name)));
  void deleteCloudRecent(name);
}

/** Une los recientes de la cuenta con los de este equipo y sube los que falten. */
export async function syncRecentRepos(): Promise<RecentRepo[] | null> {
  const remote = await fetchCloudRecents();
  if (!remote) return null;
  const local = getRecentRepos();
  const byName = new Map<string, RecentRepo>();
  [...remote, ...local].forEach((r) => {
    const prev = byName.get(r.name);
    if (!prev || r.at > prev.at) byName.set(r.name, r);
  });
  const merged = [...byName.values()].sort((a, b) => b.at - a.at).slice(0, 6);
  localStorage.setItem(RECENTS_KEY, JSON.stringify(merged));
  const remoteNames = new Map(remote.map((r) => [r.name, r.at]));
  const missing = merged.filter((r) => (remoteNames.get(r.name) ?? -1) < r.at);
  await upsertCloudRecents(missing);
  return merged;
}
