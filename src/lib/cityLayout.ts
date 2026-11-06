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

export function buildCity(files: RepoFile[]): CityModel {
  const groups = new Map<DistrictKey, RepoFile[]>();
  for (const f of files) {
    const k = classifyFile(f);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(f);
  }

  // District rectangles (in block units)
  type Rect = { key: DistrictKey; files: RepoFile[]; blocks: number; cols: number; rows: number; gx: number; gz: number };
  const rects: Rect[] = [];
  for (const key of DISTRICT_ORDER) {
    const list = groups.get(key);
    if (!list?.length) continue;
    list.sort((a, b) => b.lines - a.lines);
    const blocks = Math.ceil(list.length / LOTS_PER_BLOCK);
    const cols = Math.max(1, Math.ceil(Math.sqrt(blocks)));
    const rows = Math.ceil(blocks / cols);
    rects.push({ key, files: list, blocks, cols, rows, gx: 0, gz: 0 });
  }

  // Shelf packing: tallest rectangles first, row width ≈ sqrt(total area)
  const totalArea = rects.reduce((s, r) => s + r.cols * r.rows, 0);
  const targetW = Math.max(Math.ceil(Math.sqrt(totalArea * 1.25)), ...rects.map((r) => r.cols));
  const sorted = [...rects].sort((a, b) => b.rows - a.rows || b.cols - a.cols);
  let cx = 0;
  let cz = 0;
  let shelfH = 0;
  for (const r of sorted) {
    if (cx > 0 && cx + r.cols > targetW) {
      cx = 0;
      cz += shelfH;
      shelfH = 0;
    }
    r.gx = cx;
    r.gz = cz;
    cx += r.cols;
    shelfH = Math.max(shelfH, r.rows);
  }
  const gridW = Math.max(...sorted.map((r) => r.gx + r.cols));
  const gridH = Math.max(...sorted.map((r) => r.gz + r.rows));
  const offX = ((gridW - 1) * PITCH) / 2;
  const offZ = ((gridH - 1) * PITCH) / 2;

  const buildings: Building[] = [];
  const blocks: CityBlock[] = [];
  const districts: DistrictInfo[] = [];
  let maxHeight = 0;

  for (const r of rects) {
    const def = DISTRICTS[r.key];
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    let lines = 0;
    for (let b = 0; b < r.cols * r.rows; b++) {
      const bx = (r.gx + (b % r.cols)) * PITCH - offX;
      const bz = (r.gz + Math.floor(b / r.cols)) * PITCH - offZ;
      const chunk = r.files.slice(b * LOTS_PER_BLOCK, (b + 1) * LOTS_PER_BLOCK);
      blocks.push({ x: bx, z: bz, district: r.key, park: chunk.length === 0 });
      minX = Math.min(minX, bx - BLOCK / 2);
      maxX = Math.max(maxX, bx + BLOCK / 2);
      minZ = Math.min(minZ, bz - BLOCK / 2);
      maxZ = Math.max(maxZ, bz + BLOCK / 2);

      chunk.forEach((f, i) => {
        const lot = LOT_ORDER[i];
        const lx = (lot % LOTS_PER_SIDE) - 1;
        const lz = Math.floor(lot / LOTS_PER_SIDE) - 1;
        const h = buildingHeight(f.lines);
        const fp = buildingFootprint(f.functions, f.lines);
        const aspect = 0.85 + ((f.path.length * 7) % 30) / 100; // deterministic variety
        const w = fp;
        const d = Math.min(LOT - 1.2, fp * aspect);
        maxHeight = Math.max(maxHeight, h);
        lines += f.lines;
        buildings.push({
          index: buildings.length,
          path: f.path,
          name: f.name,
          district: r.key,
          color: def.color,
          x: bx + lx * LOT,
          z: bz + lz * LOT,
          w,
          d,
          h,
          tiers: makeTiers(w, d, h),
          lines: f.lines,
          functions: f.functions,
          landmark: false,
        });
      });
    }
    districts.push({ key: r.key, count: r.files.length, lines, center: [(minX + maxX) / 2, (minZ + maxZ) / 2], minX, maxX, minZ, maxZ });
  }

  // Landmarks: top 12 tallest buildings get rooftop detail
  [...buildings].sort((a, b) => b.h - a.h).slice(0, 12).forEach((b) => (b.landmark = true));

  const roadsX: number[] = [];
  const roadsZ: number[] = [];
  for (let i = 0; i <= gridW; i++) roadsX.push((i - 0.5) * PITCH - offX);
  for (let j = 0; j <= gridH; j++) roadsZ.push((j - 0.5) * PITCH - offZ);

  return {
    buildings,
    byPath: new Map(buildings.map((b) => [b.path, b])),
    blocks,
    districts,
    bounds: { minX: roadsX[0], maxX: roadsX[roadsX.length - 1], minZ: roadsZ[0], maxZ: roadsZ[roadsZ.length - 1] },
    roadsX,
    roadsZ,
    maxHeight,
  };
}

/** Risk colour ramp: green (healthy) → amber → red (critical) */
export function riskColor(score: number | undefined): string {
  if (score === undefined) return '#475569';
  if (score >= 90) return '#22c55e';
  if (score >= 75) return '#a3e635';
  if (score >= 55) return '#facc15';
  if (score >= 35) return '#fb923c';
  return '#ef4444';
}
