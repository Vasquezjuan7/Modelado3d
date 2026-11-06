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

export const CODE_EXTENSIONS = new Set([
  'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'vue', 'svelte', 'astro',
  'py', 'rb', 'php', 'java', 'kt', 'kts', 'scala', 'go', 'rs', 'c', 'h', 'cc', 'cpp', 'hpp', 'cs', 'swift', 'm',
  'dart', 'lua', 'r', 'jl', 'ex', 'exs', 'erl', 'hs', 'clj', 'fs', 'zig', 'nim', 'sol',
  'html', 'htm', 'css', 'scss', 'sass', 'less',
  'sql', 'prisma', 'graphql', 'gql', 'proto',
  'sh', 'bash', 'zsh', 'ps1', 'bat', 'cmd',
  'json', 'yaml', 'yml', 'toml', 'xml', 'ini', 'env', 'md', 'mdx', 'txt', 'gradle', 'tf', 'dockerfile', 'mk',
]);

const LANGUAGE_BY_EXT: Record<string, string> = {
  ts: 'TypeScript', tsx: 'TypeScript', js: 'JavaScript', jsx: 'JavaScript', mjs: 'JavaScript', cjs: 'JavaScript',
  vue: 'Vue', svelte: 'Svelte', astro: 'Astro', py: 'Python', rb: 'Ruby', php: 'PHP', java: 'Java',
  kt: 'Kotlin', kts: 'Kotlin', scala: 'Scala', go: 'Go', rs: 'Rust', c: 'C', h: 'C', cc: 'C++', cpp: 'C++', hpp: 'C++',
  cs: 'C#', swift: 'Swift', m: 'Objective-C', dart: 'Dart', lua: 'Lua', r: 'R', jl: 'Julia', ex: 'Elixir', exs: 'Elixir',
  erl: 'Erlang', hs: 'Haskell', clj: 'Clojure', fs: 'F#', zig: 'Zig', nim: 'Nim', sol: 'Solidity',
  html: 'HTML', htm: 'HTML', css: 'CSS', scss: 'SCSS', sass: 'Sass', less: 'Less', sql: 'SQL', prisma: 'Prisma',
  graphql: 'GraphQL', gql: 'GraphQL', proto: 'Protobuf', sh: 'Shell', bash: 'Shell', zsh: 'Shell', ps1: 'PowerShell',
  bat: 'Batch', cmd: 'Batch', json: 'JSON', yaml: 'YAML', yml: 'YAML', toml: 'TOML', xml: 'XML', ini: 'INI',
  env: 'Env', md: 'Markdown', mdx: 'MDX', txt: 'Text', gradle: 'Gradle', tf: 'Terraform', dockerfile: 'Docker', mk: 'Make',
};

export const IGNORED_DIRS = new Set([
  '.git', 'node_modules', 'dist', 'build', 'out', '.next', '.nuxt', '.svelte-kit', 'coverage', '__pycache__',
  '.venv', 'venv', 'env', 'target', 'vendor', '.idea', '.vscode', '.gradle', 'bin', 'obj', '.turbo', '.cache',
  'release', 'Pods', '.dart_tool', '.expo',
]);

const IGNORED_FILES = /(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb|composer\.lock|Cargo\.lock|poetry\.lock|Gemfile\.lock|.*\.min\.(js|css)|.*\.map)$/i;

export function getExtension(name: string): string {
  const lower = name.toLowerCase();
  if (lower === 'dockerfile') return 'dockerfile';
  if (lower === 'makefile') return 'mk';
  const idx = lower.lastIndexOf('.');
  return idx > 0 ? lower.slice(idx + 1) : '';
}

export function languageOf(ext: string): string {
  return LANGUAGE_BY_EXT[ext] || (ext ? ext.toUpperCase() : 'Otro');
}

/** Decide whether a path is worth turning into a building */
export function isRelevantFile(path: string, size: number): boolean {
  const parts = path.split('/');
  if (parts.some((p) => IGNORED_DIRS.has(p))) return false;
  if (IGNORED_FILES.test(path)) return false;
  const ext = getExtension(parts[parts.length - 1]);
  if (!CODE_EXTENSIONS.has(ext)) return false;
  if (size > 1_500_000) return false; // generated / data blobs
  return true;
}

const C_LIKE = new Set(['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'vue', 'svelte', 'astro', 'java', 'kt', 'kts', 'scala', 'go', 'rs', 'c', 'h', 'cc', 'cpp', 'hpp', 'cs', 'swift', 'm', 'dart', 'php', 'css', 'scss', 'less', 'sol', 'zig', 'proto', 'graphql', 'gql', 'prisma']);
const HASH_COMMENT = new Set(['py', 'rb', 'sh', 'bash', 'zsh', 'ps1', 'yaml', 'yml', 'toml', 'r', 'jl', 'ex', 'exs', 'nim', 'tf', 'dockerfile', 'mk', 'env', 'ini']);

function countSloc(lines: string[], ext: string): number {
  let sloc = 0;
  let inBlock = false;
  for (const raw of lines) {
    const l = raw.trim();
    if (!l) continue;
    if (C_LIKE.has(ext)) {
      if (inBlock) {
        if (l.includes('*/')) inBlock = false;
        continue;
      }
      if (l.startsWith('//')) continue;
      if (l.startsWith('/*')) {
        if (!l.includes('*/')) inBlock = true;
        continue;
      }
    } else if (HASH_COMMENT.has(ext)) {
      if (l.startsWith('#')) continue;
    } else if (ext === 'sql' || ext === 'lua' || ext === 'hs') {
      if (l.startsWith('--')) continue;
    }
    sloc++;
  }
  return sloc;
}

const FUNCTION_PATTERNS: Array<{ exts: string[]; re: RegExp }> = [
  {
    exts: ['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'vue', 'svelte', 'astro'],
    re: /\bfunction\s*\*?\s*[\w$]*\s*\(|(?:const|let|var)\s+[\w$]+\s*=\s*(?:async\s*)?(?:\([^)]*\)|[\w$]+)\s*=>|^\s*(?:public|private|protected|static|async|get|set|\s)*[\w$]+\s*\([^)]*\)\s*(?::\s*[\w<>[\]|, .]+)?\s*\{/gm,
  },
  { exts: ['py'], re: /^\s*(?:async\s+)?def\s+\w+/gm },
  { exts: ['rb'], re: /^\s*def\s+[\w.?!]+/gm },
  { exts: ['go'], re: /^func\s+/gm },
  { exts: ['rs'], re: /\bfn\s+\w+/g },
  { exts: ['php'], re: /\bfunction\s+\w+/g },
  { exts: ['java', 'cs', 'kt', 'kts', 'scala', 'swift', 'dart', 'c', 'cc', 'cpp', 'h', 'hpp'], re: /^\s*(?:(?:public|private|protected|internal|static|final|override|virtual|async|suspend|open|fun|func|def|inline|const|extern)\s+)*[\w<>[\],.?*&]+\s+\*?\w+\s*\([^;{)]*\)?\s*(?:throws [\w, ]+)?\s*\{?\s*$/gm },
  { exts: ['kt', 'kts'], re: /\bfun\s+[\w.<>]+\s*\(/g },
  { exts: ['swift'], re: /\bfunc\s+\w+/g },
  { exts: ['lua'], re: /\bfunction\s+[\w.:]+/g },
  { exts: ['ex', 'exs'], re: /^\s*defp?\s+\w+/gm },
  { exts: ['sh', 'bash', 'zsh'], re: /^\s*(?:function\s+)?\w+\s*\(\)\s*\{/gm },
  { exts: ['ps1'], re: /^\s*function\s+[\w-]+/gim },
  { exts: ['sql'], re: /\bcreate\s+(?:or\s+replace\s+)?(?:function|procedure|trigger|view)\b/gi },
];

const CONTROL_KEYWORDS = /^\s*(if|for|while|switch|catch|return|else|do|try|new|throw|typeof|await)\b/;

function countFunctions(content: string, ext: string): number {
  let total = 0;
  for (const { exts, re } of FUNCTION_PATTERNS) {
    if (!exts.includes(ext)) continue;
    const matches = content.match(re);
    if (!matches) continue;
    total += matches.filter((m) => !CONTROL_KEYWORDS.test(m)).length;
    break; // first matching rule per extension
  }
  return total;
}

const IMPORT_PATTERNS: RegExp[] = [
  /\bimport\s+(?:[\w*{}\s,$]+\s+from\s+)?['"]([^'"]+)['"]/g,
  /\bexport\s+[\w*{}\s,$]+\s+from\s+['"]([^'"]+)['"]/g,
  /\brequire\(\s*['"]([^'"]+)['"]\s*\)/g,
  /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g,
  /^\s*from\s+(\.[\w.]*)\s+import\b/gm, // python relative
  /^\s*import\s+([\w.]+)\s*$/gm, // python absolute
  /<script[^>]+src=["']([^"']+)["']/g,
  /<link[^>]+href=["']([^"']+\.css)["']/g,
  /@import\s+['"]([^'"]+)['"]/g,
];

function extractImports(content: string): string[] {
  const out = new Set<string>();
  for (const re of IMPORT_PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(content))) out.add(m[1]);
  }
  return [...out];
}

export function analyzeSource(path: string, size: number, content?: string): RepoFile {
  const name = path.split('/').pop() || path;
  const ext = getExtension(name);
  if (content === undefined) {
    const est = Math.max(1, Math.round(size / 32));
    return {
      path, name, ext, size, lines: est, sloc: est, functions: Math.max(0, Math.round(est / 25)),
      imports: [], language: languageOf(ext), linesEstimated: true,
    };
  }
  const lines = content.split(/\r?\n/);
  return {
    path,
    name,
    ext,
    size,
    content,
    lines: lines.length,
    sloc: countSloc(lines, ext),
    functions: countFunctions(content, ext),
    imports: extractImports(content),
    language: languageOf(ext),
    linesEstimated: false,
  };
}

