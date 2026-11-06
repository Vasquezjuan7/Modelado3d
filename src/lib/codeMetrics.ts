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

