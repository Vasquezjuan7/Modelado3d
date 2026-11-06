// ========================================================
// Procedural city layout
//  height    → real lines of code
//  footprint → number of functions / methods
//  district  → technical role of the file
// ========================================================
import type { RepoFile } from './codeMetrics';

export type DistrictKey = 'frontend' | 'core' | 'data' | 'infra' | 'tests' | 'styles' | 'docs';

export interface DistrictDef {
  key: DistrictKey;
  name: { es: string; en: string };
  role: { es: string; en: string };
  color: string;
}

export const DISTRICTS: Record<DistrictKey, DistrictDef> = {
  frontend: { key: 'frontend', name: { es: 'Distrito Comercial', en: 'Commercial District' }, role: { es: 'Interfaz / Componentes', en: 'UI / Components' }, color: '#22d3ee' },
  core: { key: 'core', name: { es: 'Distrito Financiero', en: 'Financial District' }, role: { es: 'Lógica / API / Servicios', en: 'Logic / API / Services' }, color: '#818cf8' },
  data: { key: 'data', name: { es: 'Distrito Industrial', en: 'Industrial District' }, role: { es: 'Datos / Modelos / SQL', en: 'Data / Models / SQL' }, color: '#34d399' },
  infra: { key: 'infra', name: { es: 'Puerto de Infraestructura', en: 'Infrastructure Port' }, role: { es: 'Config / Build / DevOps', en: 'Config / Build / DevOps' }, color: '#fbbf24' },
  tests: { key: 'tests', name: { es: 'Distrito de Seguridad', en: 'Security District' }, role: { es: 'Tests / QA', en: 'Tests / QA' }, color: '#f472b6' },
  styles: { key: 'styles', name: { es: 'Barrio de las Artes', en: 'Arts Quarter' }, role: { es: 'Estilos / Assets', en: 'Styles / Assets' }, color: '#c084fc' },
  docs: { key: 'docs', name: { es: 'Biblioteca', en: 'Library' }, role: { es: 'Documentación', en: 'Documentation' }, color: '#94a3b8' },
};

export const DISTRICT_ORDER: DistrictKey[] = ['core', 'frontend', 'data', 'infra', 'tests', 'styles', 'docs'];

export function classifyFile(f: RepoFile): DistrictKey {
  const p = f.path.toLowerCase();
  const name = f.name.toLowerCase();
  const dirs = p.split('/').slice(0, -1);
  const ext = f.ext;

  if (/\.(test|spec|e2e)\.\w+$/.test(name) || /_test\.(py|go|rb)$/.test(name) || /^test_.*\.py$/.test(name) ||
    dirs.some((d) => ['test', 'tests', '__tests__', 'spec', 'specs', 'e2e', 'cypress', 'playwright', '__mocks__', 'fixtures'].includes(d))) {
    return 'tests';
  }
  if (['md', 'mdx', 'txt', 'rst'].includes(ext) || dirs.includes('docs')) return 'docs';
  if (['sql', 'prisma', 'graphql', 'gql', 'proto'].includes(ext) ||
    /\.(model|entity|schema|repository|repo|dao|migration)\.\w+$/.test(name) || /(_model|_models|_repository)\.py$/.test(name) ||
    dirs.some((d) => ['db', 'database', 'models', 'model', 'migrations', 'entities', 'schemas', 'repositories', 'prisma', 'supabase', 'sql', 'dao'].includes(d))) {
    return 'data';
  }
  if (['json', 'yaml', 'yml', 'toml', 'xml', 'ini', 'env', 'gradle', 'tf', 'dockerfile', 'mk', 'sh', 'bash', 'zsh', 'ps1', 'bat', 'cmd'].includes(ext) ||
    /^(vite|webpack|rollup|babel|jest|vitest|eslint|prettier|tailwind|postcss|next|nuxt|svelte|astro|tsconfig|metro|karma)[.\w-]*\.(c|m)?(js|ts|json)$/.test(name) ||
    dirs.some((d) => ['.github', 'scripts', 'config', 'configs', 'deploy', 'docker', 'ci', 'infra', 'electron', 'k8s', 'helm', 'terraform'].includes(d))) {
    return 'infra';
  }
  if (['css', 'scss', 'sass', 'less', 'svg'].includes(ext) || dirs.some((d) => ['styles', 'assets', 'static', 'public', 'fonts', 'images'].includes(d))) {
    return 'styles';
  }
  if (['tsx', 'jsx', 'vue', 'svelte', 'astro', 'html', 'htm', 'dart', 'swift'].includes(ext) ||
    dirs.some((d) => ['components', 'pages', 'views', 'screens', 'ui', 'layouts', 'widgets', 'app', 'frontend', 'client', 'templates'].includes(d) && !['py', 'go', 'java', 'rb'].includes(ext))) {
    return 'frontend';
  }
  return 'core';
}

export interface Tier {
  w: number;
  d: number;
  h: number;
  y: number; // center y
}

export interface Building {
  index: number;
  path: string;
  name: string;
  district: DistrictKey;
  color: string;
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  tiers: Tier[];
  lines: number;
  functions: number;
  landmark: boolean;
}

export interface CityBlock {
  x: number;
  z: number;
  district: DistrictKey;
  park: boolean;
}

export interface DistrictInfo {
  key: DistrictKey;
  count: number;
  lines: number;
  center: [number, number];
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface CityModel {
  buildings: Building[];
  byPath: Map<string, Building>;
  blocks: CityBlock[];
  districts: DistrictInfo[];
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  roadsX: number[]; // x coordinate of roads running along Z
  roadsZ: number[]; // z coordinate of roads running along X
  maxHeight: number;
}

export const LOT = 8;
export const LOTS_PER_SIDE = 3;
export const BLOCK = LOT * LOTS_PER_SIDE + 2; // 26
export const STREET = 7;
export const PITCH = BLOCK + STREET; // 33
const LOTS_PER_BLOCK = LOTS_PER_SIDE * LOTS_PER_SIDE;
// Center lot first, then edges, then corners — keeps tall towers at block centers
const LOT_ORDER = [4, 1, 3, 5, 7, 0, 2, 6, 8];

export function buildingHeight(lines: number): number {
  return Math.min(95, 1.6 + Math.pow(Math.max(1, lines), 0.62) * 0.55);
}

export function buildingFootprint(functions: number, lines: number): number {
  const f = functions > 0 ? functions : lines / 30;
  return Math.min(LOT - 1.2, 2.6 + Math.sqrt(f) * 0.85);
}

function makeTiers(w: number, d: number, h: number): Tier[] {
  if (h > 30) {
    const h1 = h * 0.45, h2 = h * 0.33, h3 = h * 0.22;
    return [
      { w, d, h: h1, y: h1 / 2 },
      { w: w * 0.78, d: d * 0.78, h: h2, y: h1 + h2 / 2 },
      { w: w * 0.55, d: d * 0.55, h: h3, y: h1 + h2 + h3 / 2 },
    ];
  }
  if (h > 13) {
    const h1 = h * 0.7, h2 = h * 0.3;
    return [
      { w, d, h: h1, y: h1 / 2 },
      { w: w * 0.7, d: d * 0.7, h: h2, y: h1 + h2 / 2 },
    ];
  }
  return [{ w, d, h, y: h / 2 }];
}

