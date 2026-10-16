import type { FileNode } from './githubApi';

export type DistrictCategory = 'frontend' | 'core-api' | 'database' | 'workers' | 'config' | 'tests';

export interface DistrictMeta {
  key: DistrictCategory;
  name: string;
  subname: string;
  color: string;
  icon: string;
  count: number;
  totalLoc: number;
  center: [number, number, number];
}

export interface BuildingTier {
  width: number;
  depth: number;
  height: number;
  y: number;
}

export interface BuildingData {
  id: string;
  name: string;
  path: string;
  size: number;
  lines: number;
  methods: number;
  extension: string;
  color: string;
  glowColor: string;
  badge: string;
  category: DistrictCategory;
  districtName: string;
  buildingType: 'godObject' | 'skyscraper' | 'tower' | 'block' | 'pavilion';
  isGodObject: boolean;
  position: [number, number, number];
  width: number;
  depth: number;
  height: number;
  tiers: BuildingTier[];
  hasSpire: boolean;
  spireHeight: number;
  hasHelipad: boolean;
  hasCoolingTowers: boolean;
  hasEntrancePodium: boolean;
  hasCommunicationsDish: boolean;
  hasSolarPanels: boolean;
  accentStripes: boolean;
  absolutePosition: [number, number, number];
}

export interface CityBlockData {
  id: string;
  gridX: number;
  gridZ: number;
  center: [number, number, number];
  width: number;
  depth: number;
  category: DistrictCategory;
  districtName: string;
  districtColor: string;
  buildings: BuildingData[];
}

export interface CompleteCityModel {
  blocks: CityBlockData[];
  allBuildings: BuildingData[];
  flatNodes: Map<string, BuildingData>;
  districts: DistrictMeta[];
  totalLines: number;
  totalClasses: number;
  avenueXList: number[];
  avenueZList: number[];
  cityWidth: number;
  cityDepth: number;
}

export const BLOCK_SIZE = 26;
export const STREET_WIDTH = 5;
export const BLOCK_PITCH = BLOCK_SIZE + STREET_WIDTH; // 31
export const SIDEWALK_HEIGHT = 0.3;
export const GRID_RADIUS = 3;

// Diverse, high-contrast color palette based on language, role & complexity
export function getBuildingColor(filePath: string, fileName: string): {
  color: string;
  glowColor: string;
  badge: string;
  category: DistrictCategory;
  districtName: string;
} {
  const cleanPath = filePath.replace(/\\/g, '/');
  const name = fileName.toLowerCase();
  const ext = name.includes('.') ? name.split('.').pop() || '' : '';

  // Extract relative directory segments (ignore parent folders like OneDrive, Documentos, Modelaje3dciudad, Modelado3d)
  const allSegments = cleanPath.toLowerCase().split('/').filter(Boolean);
  const actualFileName = allSegments[allSegments.length - 1] || name;
  const dirSegments = allSegments.slice(Math.max(0, allSegments.length - 4), allSegments.length - 1);

  // 1. God Object / High Complexity Monolith -> Vivid Crimson Red
  if (name.includes('god object') || name.includes('godobject') || name.includes('monolith')) {
    return {
      color: '#ef4444',
      glowColor: '#ff0055',
      badge: 'GOD OBJECT',
      category: 'core-api',
      districtName: 'Distrito Financiero (Core API)'
    };
  }

  // 2. Tests & QA (Strict check on filename or test directories)
  if (
    actualFileName.includes('.test.') ||
    actualFileName.includes('.spec.') ||
    actualFileName.endsWith('_test.py') ||
    actualFileName.endsWith('_test.go') ||
    dirSegments.some(s => s === 'test' || s === 'tests' || s === '__tests__' || s === 'spec' || s === 'specs' || s === 'cypress')
  ) {
    return {
      color: '#ec4899',
      glowColor: '#f472b6',
      badge: 'TEST / QA',
      category: 'tests',
      districtName: 'Distrito Seguridad & Tests'
    };
  }

  // 3. Configuration, DevOps, Environment & Build Manifests -> Crisp Ice White / Slate
  if (
    ['json', 'yaml', 'yml', 'toml', 'env', 'md', 'lock', 'xml'].includes(ext) ||
    actualFileName.startsWith('vite.config') ||
    actualFileName.startsWith('package') ||
    actualFileName.startsWith('tsconfig') ||
    actualFileName.startsWith('tailwind.config') ||
    actualFileName.startsWith('postcss.config') ||
    actualFileName.startsWith('docker') ||
    actualFileName.startsWith('.env')
  ) {
    return {
      color: '#e2e8f0',
      glowColor: '#94a3b8',
      badge: 'CONFIG / BUILD',
      category: 'config',
      districtName: 'Distrito Infraestructura (Config)'
    };
  }

  // 4. React / Vue / Svelte UI Components (.tsx, .jsx, .vue, .svelte) -> Bright Neon Cyan
  if (['tsx', 'jsx', 'vue', 'svelte'].includes(ext)) {
    return {
      color: '#00f5ff',
      glowColor: '#63f7ff',
      badge: ext.toUpperCase() + ' // UI',
      category: 'frontend',
      districtName: 'Distrito Comercial (Frontend UI)'
    };
  }

  // 5. HTML Views & Standalone Prototypes (.html) -> Warm Vivid Orange
  if (ext === 'html') {
    return {
      color: '#f97316',
      glowColor: '#fb923c',
      badge: 'HTML // VISTA',
      category: 'frontend',
      districtName: 'Distrito Vistas & UI (HTML)'
    };
  }

  // 6. CSS / Stylesheets & Design Tokens (.css, .scss, .sass, .less) -> Electric Purple
  if (['css', 'scss', 'sass', 'less'].includes(ext)) {
    return {
      color: '#a855f7',
      glowColor: '#c084fc',
      badge: 'ESTILOS / CSS',
      category: 'frontend',
      districtName: 'Distrito Diseño & Estilos'
    };
  }

  // 7. Database, SQL & ORM Models (Strict check on extension or db/models folder)
  // WILL NOT MATCH "Modelado3d" or "Modelaje3dciudad"!
  if (
    ['sql', 'prisma'].includes(ext) ||
    actualFileName.endsWith('.model.ts') ||
    actualFileName.endsWith('.model.js') ||
    actualFileName.endsWith('.entity.ts') ||
    actualFileName.endsWith('_model.py') ||
    actualFileName.includes('migration') ||
    dirSegments.some(s => s === 'db' || s === 'database' || s === 'models' || s === 'migrations' || s === 'entities' || s === 'schemas')
  ) {
    return {
      color: '#10b981',
      glowColor: '#34d399',
      badge: 'DATABASE',
      category: 'database',
      districtName: 'Distrito Industrial (Database)'
    };
  }

  // 8. Workers, Daemons, Shell, Native & Electron Runtime -> Royal Violet
  if (
    ['cpp', 'rs', 'go', 'sh', 'ps1', 'cjs'].includes(ext) ||
    dirSegments.some(s => s === 'electron' || s === 'workers' || s === 'daemon' || s === 'jobs' || s === 'tasks') ||
    actualFileName.includes('worker') ||
    actualFileName.includes('daemon')
  ) {
    return {
      color: '#8b5cf6',
      glowColor: '#a78bfa',
      badge: 'RUNTIME / WORKER',
      category: 'workers',
      districtName: 'Distrito Gubernamental (Workers)'
    };
  }

  // 9. Core TypeScript Logic & APIs (.ts) -> Deep Sapphire Blue
  if (ext === 'ts') {
    return {
      color: '#3b82f6',
      glowColor: '#60a5fa',
      badge: 'TYPESCRIPT CORE',
      category: 'core-api',
      districtName: 'Distrito Financiero (Core API)'
    };
  }

  // 10. JavaScript Logic (.js, .mjs) -> Warm Amber / Gold
  if (ext === 'js' || ext === 'mjs') {
    return {
      color: '#f59e0b',
      glowColor: '#fbbf24',
      badge: 'JAVASCRIPT',
      category: 'core-api',
      districtName: 'Distrito Financiero (Core API)'
    };
  }

  // 11. Python (.py) -> Deep Sapphire Blue
  if (ext === 'py') {
    return {
      color: '#3b82f6',
      glowColor: '#60a5fa',
      badge: 'PYTHON',
      category: 'core-api',
      districtName: 'Distrito Financiero (Core API)'
    };
  }

  // 12. Media & Vector Assets (.svg, .png, .jpg) -> Rose Pink
  if (['svg', 'png', 'jpg', 'ico', 'webp'].includes(ext)) {
    return {
      color: '#f43f5e',
      glowColor: '#fb7185',
      badge: 'ASSET / MEDIA',
      category: 'frontend',
      districtName: 'Distrito Diseño & Assets'
    };
  }

  // Default Fallback
  return {
    color: '#06b6d4',
    glowColor: '#22d3ee',
    badge: ext.toUpperCase() || 'CODE',
    category: 'core-api',
    districtName: 'Distrito Financiero (Core API)'
  };
}

export function generateBuildingTiers(
  lines: number,
  sizeBytes: number,
  lotW: number,
  lotD: number,
  isGodObjectParam: boolean = false
): {
  height: number;
  width: number;
  depth: number;
  buildingType: 'godObject' | 'skyscraper' | 'tower' | 'block' | 'pavilion';
  tiers: BuildingTier[];
  hasSpire: boolean;
  spireHeight: number;
  hasHelipad: boolean;
  hasCoolingTowers: boolean;
  hasEntrancePodium: boolean;
  hasCommunicationsDish: boolean;
  hasSolarPanels: boolean;
  accentStripes: boolean;
  isGodObject: boolean;
} {
  const isGodObject = isGodObjectParam || lines > 1100 || sizeBytes > 40000;
  let height: number;
  let buildingType: 'godObject' | 'skyscraper' | 'tower' | 'block' | 'pavilion';
  let tiers: BuildingTier[] = [];
  let hasSpire = false;
  let spireHeight = 0;
  let hasHelipad = false;
  let hasCoolingTowers = false;
  let hasEntrancePodium = true;
  let hasCommunicationsDish = false;
  let hasSolarPanels = false;
  let accentStripes = false;

  const w = lotW * 0.88;
  const d = lotD * 0.88;

  if (isGodObject) {
    buildingType = 'godObject';
    height = Math.min(65, 48 + Math.round((lines - 1100) * 0.012));
    hasSpire = true;
    spireHeight = 12;
    hasHelipad = true;
    hasCoolingTowers = true;
    hasCommunicationsDish = true;
    accentStripes = true;
    
    const h1 = height * 0.22;
    const h2 = height * 0.26;
    const h3 = height * 0.24;
    const h4 = height * 0.16;
    const h5 = height * 0.12;

    tiers = [
      { width: w, depth: d, height: h1, y: h1 / 2 },
      { width: w * 0.84, depth: d * 0.84, height: h2, y: h1 + h2 / 2 },
      { width: w * 0.68, depth: d * 0.68, height: h3, y: h1 + h2 + h3 / 2 },
      { width: w * 0.50, depth: d * 0.50, height: h4, y: h1 + h2 + h3 + h4 / 2 },
      { width: w * 0.32, depth: d * 0.32, height: h5, y: h1 + h2 + h3 + h4 + h5 / 2 }
    ];
  } else if (lines > 350) {
    buildingType = 'skyscraper';
    height = Math.min(46, 28 + Math.round((lines - 350) * 0.04));
    hasSpire = true;
    spireHeight = 7.5;
    hasHelipad = lines > 550;
    hasCoolingTowers = true;
    hasCommunicationsDish = lines > 700;
    accentStripes = true;

    const h1 = height * 0.28;
    const h2 = height * 0.32;
    const h3 = height * 0.26;
    const h4 = height * 0.14;

    tiers = [
      { width: w, depth: d, height: h1, y: h1 / 2 },
      { width: w * 0.82, depth: d * 0.82, height: h2, y: h1 + h2 / 2 },
      { width: w * 0.62, depth: d * 0.62, height: h3, y: h1 + h2 + h3 / 2 },
      { width: w * 0.40, depth: d * 0.40, height: h4, y: h1 + h2 + h3 + h4 / 2 }
    ];
  } else if (lines > 120) {
    buildingType = 'tower';
    height = Math.min(26, 16 + Math.round((lines - 120) * 0.042));
    hasHelipad = lines > 220;
    hasCoolingTowers = true;
    hasCommunicationsDish = true;

    const h1 = height * 0.35;
    const h2 = height * 0.48;
    const h3 = height * 0.17;

    tiers = [
      { width: w, depth: d, height: h1, y: h1 / 2 },
      { width: w * 0.80, depth: d * 0.80, height: h2, y: h1 + h2 / 2 },
      { width: w * 0.48, depth: d * 0.48, height: h3, y: h1 + h2 + h3 / 2 }
    ];
  } else if (lines > 40) {
    buildingType = 'block';
    height = Math.min(15, 10 + Math.round((lines - 40) * 0.06));
    hasCoolingTowers = true;
    hasSolarPanels = true;

    const h1 = height * 0.75;
    const h2 = height * 0.25;

    tiers = [
      { width: w, depth: d, height: h1, y: h1 / 2 },
      { width: w * 0.52, depth: d * 0.52, height: h2, y: h1 + h2 / 2 }
    ];
  } else {
    buildingType = 'pavilion';
    height = Math.min(9, 5 + Math.round(lines * 0.08));
    hasSolarPanels = true;

    const h1 = height * 0.8;
    const h2 = height * 0.2;

    tiers = [
      { width: w, depth: d, height: h1, y: h1 / 2 },
      { width: w * 0.45, depth: d * 0.45, height: h2, y: h1 + h2 / 2 }
    ];
  }

  return {
    height,
    width: w,
    depth: d,
    buildingType,
    tiers,
    hasSpire,
    spireHeight,
    hasHelipad,
    hasCoolingTowers,
    hasEntrancePodium,
    hasCommunicationsDish,
    hasSolarPanels,
    accentStripes,
    isGodObject
  };
}

// Default rich enterprise AST codebase
export const DEFAULT_ENTERPRISE_AST = [
  { name: 'UserManager.py [GOD OBJECT]', path: 'src/core/UserManager.py', lines: 3450, methods: 142, size: 124000 },
  { name: 'BillingService.py', path: 'src/api/BillingService.py', lines: 890, methods: 38, size: 32000 },
  { name: 'AuthController.java', path: 'src/auth/AuthController.java', lines: 620, methods: 24, size: 22000 },
  { name: 'QueryRouter.py', path: 'src/api/QueryRouter.py', lines: 1120, methods: 45, size: 39000 },
  { name: 'PaymentGateway.ts', path: 'src/api/PaymentGateway.ts', lines: 740, methods: 31, size: 26000 },
  { name: 'TokenAuth.go', path: 'src/auth/TokenAuth.go', lines: 480, methods: 19, size: 17000 },
  { name: 'PermissionMiddleware.py', path: 'src/core/PermissionMiddleware.py', lines: 310, methods: 14, size: 11000 },

  { name: 'App.tsx', path: 'src/App.tsx', lines: 520, methods: 22, size: 18500 },
  { name: 'CityViewport.tsx', path: 'src/components/CityViewport.tsx', lines: 680, methods: 28, size: 24000 },
  { name: 'TrafficCanvas.tsx', path: 'src/components/TrafficCanvas.tsx', lines: 510, methods: 22, size: 18000 },
  { name: 'AuthContext.tsx', path: 'src/context/AuthContext.tsx', lines: 210, methods: 9, size: 7500 },
  { name: 'StateStore.ts', path: 'src/store/StateStore.ts', lines: 340, methods: 15, size: 12000 },
  { name: 'TelemetryDashboard.tsx', path: 'src/components/TelemetryDashboard.tsx', lines: 430, methods: 18, size: 15000 },
  { name: 'NavigationRibbon.tsx', path: 'src/components/NavigationRibbon.tsx', lines: 290, methods: 12, size: 10500 },
  { name: 'ModalViewer.tsx', path: 'src/components/ModalViewer.tsx', lines: 180, methods: 8, size: 6200 },
  { name: 'ThemeContext.tsx', path: 'src/context/ThemeContext.tsx', lines: 140, methods: 6, size: 5200 },

  { name: 'PostgresPool.java', path: 'src/db/PostgresPool.java', lines: 750, methods: 32, size: 27000 },
  { name: 'TelemetryDB.go', path: 'src/db/TelemetryDB.go', lines: 460, methods: 19, size: 16500 },
  { name: 'RedisCache.py', path: 'src/cache/RedisCache.py', lines: 320, methods: 12, size: 11000 },
  { name: '0014_migration.py', path: 'src/migrations/0014_migration.py', lines: 180, methods: 6, size: 6400 },
  { name: 'AuditLogModel.py', path: 'src/models/AuditLogModel.py', lines: 270, methods: 11, size: 9500 },
  { name: 'SessionStore.go', path: 'src/db/SessionStore.go', lines: 390, methods: 16, size: 14000 },
  { name: 'InvoiceEntity.ts', path: 'src/models/InvoiceEntity.ts', lines: 340, methods: 15, size: 12500 },

  { name: 'CeleryWorker.py', path: 'src/workers/CeleryWorker.py', lines: 580, methods: 24, size: 21000 },
  { name: 'ASTParserService.py', path: 'src/services/ASTParserService.py', lines: 940, methods: 35, size: 33000 },
  { name: 'TrafficSimulator.cpp', path: 'src/engine/TrafficSimulator.cpp', lines: 810, methods: 29, size: 29000 },
  { name: 'AuditConsumer.ts', path: 'src/workers/AuditConsumer.ts', lines: 430, methods: 16, size: 15500 },
  { name: 'ReportGenerator.py', path: 'src/services/ReportGenerator.py', lines: 360, methods: 14, size: 13000 },
  { name: 'SyncDaemon.go', path: 'src/daemon/SyncDaemon.go', lines: 490, methods: 20, size: 17500 },

  { name: 'index.html', path: 'index.html', lines: 110, methods: 4, size: 4000 },
  { name: 'package.json', path: 'package.json', lines: 85, methods: 1, size: 3200 },
  { name: 'tailwind.config.js', path: 'tailwind.config.js', lines: 95, methods: 1, size: 3500 },
  { name: 'vite.config.ts', path: 'vite.config.ts', lines: 65, methods: 1, size: 2400 },
  { name: 'tsconfig.json', path: 'tsconfig.json', lines: 45, methods: 1, size: 1800 },
  { name: 'README.md', path: 'README.md', lines: 140, methods: 2, size: 5000 },
  { name: 'docker-compose.yml', path: 'docker-compose.yml', lines: 120, methods: 3, size: 4500 },

  { name: 'AuthService.test.ts', path: 'tests/AuthService.test.ts', lines: 320, methods: 14, size: 11500 },
  { name: 'Traffic.spec.tsx', path: 'tests/Traffic.spec.tsx', lines: 280, methods: 12, size: 9800 },
  { name: 'DatabasePool.test.py', path: 'tests/DatabasePool.test.py', lines: 410, methods: 18, size: 14500 }
];

// Concentric / Spiral grid generator so all blocks are 100% contiguous around (0, 0)
function getContiguousSpiralGridSlots(totalBlocks: number): Array<{ gx: number; gz: number }> {
  const slots: Array<{ gx: number; gz: number }> = [{ gx: 0, gz: 0 }];
  let x = 0;
  let z = 0;
  let dx = 0;
  let dz = -1;

  const maxCoord = Math.ceil(Math.sqrt(totalBlocks)) + 2;
  const maxSteps = maxCoord * maxCoord;

  for (let i = 0; i < maxSteps; i++) {
    if (slots.length >= totalBlocks) break;
    if (x === z || (x < 0 && x === -z) || (x > 0 && x === 1 - z)) {
      const temp = dx;
      dx = -dz;
      dz = temp;
    }
    x += dx;
    z += dz;
    slots.push({ gx: x, gz: z });
  }

  return slots;
}

// Subgrid lot positioning inside a block (22x22 usable area)
function getSubgridPositions(count: number): Array<{ x: number; z: number; lotW: number; lotD: number }> {
  if (count <= 1) return [{ x: 0, z: 0, lotW: 16, lotD: 16 }];
  if (count === 2) {
    return [
      { x: -5.5, z: 0, lotW: 10, lotD: 12 },
      { x: 5.5, z: 0, lotW: 10, lotD: 12 }
    ];
  }
  if (count === 3) {
    return [
      { x: -5.5, z: -5.5, lotW: 9.5, lotD: 9.5 },
      { x: 5.5, z: -5.5, lotW: 9.5, lotD: 9.5 },
      { x: 0, z: 5.5, lotW: 11, lotD: 9.5 }
    ];
  }
  if (count === 4) {
    return [
      { x: -5.5, z: -5.5, lotW: 9.5, lotD: 9.5 },
      { x: 5.5, z: -5.5, lotW: 9.5, lotD: 9.5 },
      { x: -5.5, z: 5.5, lotW: 9.5, lotD: 9.5 },
      { x: 5.5, z: 5.5, lotW: 9.5, lotD: 9.5 }
    ];
  }
  // 5 or 6 buildings per block
  return [
    { x: -6.0, z: -6.5, lotW: 8.5, lotD: 8.5 },
    { x: 6.0, z: -6.5, lotW: 8.5, lotD: 8.5 },
    { x: -6.0, z: 0, lotW: 8.5, lotD: 7.5 },
    { x: 6.0, z: 0, lotW: 8.5, lotD: 7.5 },
    { x: 0, z: 6.5, lotW: 10, lotD: 8.0 }
  ];
}

export function buildCompleteCity(rootNode: FileNode | null): CompleteCityModel {
  const blocks: CityBlockData[] = [];
  const allBuildings: BuildingData[] = [];
  const flatNodes = new Map<string, BuildingData>();

  // 1. Ingest real repository files
  let rawFiles: Array<{ name: string; path: string; lines: number; methods: number; size: number }> = [];

  if (rootNode) {
    function extractFiles(node: FileNode) {
      if (node.type === 'blob') {
        const lines = Math.max(12, Math.round((node.size || 600) / 36));
        const methods = Math.max(2, Math.round(Math.sqrt(lines) * 1.3));
        rawFiles.push({
          name: node.name,
          path: node.path || node.id,
          lines,
          methods,
          size: node.size || 1000
        });
      } else if (node.children) {
        node.children.forEach(extractFiles);
      }
    }
    extractFiles(rootNode);
  }

  if (rawFiles.length === 0) {
    rawFiles = [...DEFAULT_ENTERPRISE_AST];
  }

  let totalLines = 0;
  rawFiles.forEach((f) => {
    totalLines += f.lines;
  });

  // 2. Classify and enrich each file with distinct vibrant colors
  const enrichedFiles = rawFiles.map((file) => {
    const { color, glowColor, badge, category, districtName } = getBuildingColor(file.path, file.name);
    return {
      ...file,
      color,
      glowColor,
      badge,
      category,
      districtName
    };
  });

  // 3. Sort files descending by LOC so the skyline is integrated:
  // TALLEST skyscrapers occupy the center of the city, stepping down outward!
  enrichedFiles.sort((a, b) => b.lines - a.lines);

  // Group files into blocks (3 to 4 buildings per block)
  const buildingsPerBlock = enrichedFiles.length > 30 ? 4 : 3;
  const totalBlocks = Math.ceil(enrichedFiles.length / buildingsPerBlock);

  // 4. Generate contiguous grid slots starting from (0, 0)
  // No separated islands, no empty voids! Everything generates together!
  const gridSlots = getContiguousSpiralGridSlots(totalBlocks);

  let minGx = 0, maxGx = 0, minGz = 0, maxGz = 0;

  for (let bIdx = 0; bIdx < totalBlocks; bIdx++) {
    const slot = gridSlots[bIdx] || { gx: 0, gz: 0 };
    minGx = Math.min(minGx, slot.gx);
    maxGx = Math.max(maxGx, slot.gx);
    minGz = Math.min(minGz, slot.gz);
    maxGz = Math.max(maxGz, slot.gz);

    const chunk = enrichedFiles.slice(bIdx * buildingsPerBlock, (bIdx + 1) * buildingsPerBlock);
    const blockCenterX = slot.gx * BLOCK_PITCH;
    const blockCenterZ = slot.gz * BLOCK_PITCH;
    const subLots = getSubgridPositions(chunk.length);

    const blockBuildings: BuildingData[] = [];
    const dominantCategory = chunk[0]?.category || 'frontend';
    const dominantDistrict = chunk[0]?.districtName || 'Distrito Central';
    const dominantColor = chunk[0]?.color || '#00f5ff';

    chunk.forEach((file, fIdx) => {
      const lot = subLots[fIdx] || subLots[0];
      const isGod = file.name.includes('GOD OBJECT') || file.lines > 1100;

      const geom = generateBuildingTiers(file.lines, file.size, lot.lotW, lot.lotD, isGod);
      const absX = blockCenterX + lot.x;
      const absZ = blockCenterZ + lot.z;
      const ext = file.name.includes('.') ? file.name.split('.').pop() || '' : '';

      const building: BuildingData = {
        id: file.path,
        name: file.name,
        path: file.path,
        size: file.size,
        lines: file.lines,
        methods: file.methods,
        extension: ext,
        color: file.color,
        glowColor: file.glowColor,
        badge: file.badge,
        category: file.category,
        districtName: file.districtName,
        buildingType: geom.buildingType,
        isGodObject: geom.isGodObject,
        position: [lot.x, 0, lot.z],
        width: geom.width,
        depth: geom.depth,
        height: geom.height,
        tiers: geom.tiers,
        hasSpire: geom.hasSpire,
        spireHeight: geom.spireHeight,
        hasHelipad: geom.hasHelipad,
        hasCoolingTowers: geom.hasCoolingTowers,
        hasEntrancePodium: geom.hasEntrancePodium,
        hasCommunicationsDish: geom.hasCommunicationsDish,
        hasSolarPanels: geom.hasSolarPanels,
        accentStripes: geom.accentStripes,
        absolutePosition: [absX, 0, absZ]
      };

      blockBuildings.push(building);
      allBuildings.push(building);
      flatNodes.set(building.id, building);
    });

    blocks.push({
      id: `block-${slot.gx}-${slot.gz}`,
      gridX: slot.gx,
      gridZ: slot.gz,
      center: [blockCenterX, 0, blockCenterZ],
      width: BLOCK_SIZE,
      depth: BLOCK_SIZE,
      category: dominantCategory,
      districtName: dominantDistrict,
      districtColor: dominantColor,
      buildings: blockBuildings
    });
  }

  // 5. Compute category district summaries
  const districtCategories: DistrictCategory[] = ['frontend', 'core-api', 'database', 'workers', 'config', 'tests'];
  const districtMetaList: DistrictMeta[] = [];

  districtCategories.forEach((catKey) => {
    const catFiles = allBuildings.filter((b) => b.category === catKey);
    if (catFiles.length === 0) return;

    // Center of this category's buildings
    let sumX = 0, sumZ = 0;
    catFiles.forEach((b) => {
      sumX += b.absolutePosition[0];
      sumZ += b.absolutePosition[2];
    });
    const avgX = sumX / catFiles.length;
    const avgZ = sumZ / catFiles.length;

    const first = catFiles[0];
    districtMetaList.push({
      key: catKey,
      name: first.districtName.split('(')[0].trim(),
      subname: first.districtName.includes('(') ? first.districtName.split('(')[1].replace(')', '').trim() : first.badge,
      color: first.color,
      icon: catKey === 'database' ? 'database' : catKey === 'core-api' ? 'account_balance' : catKey === 'workers' ? 'memory' : catKey === 'tests' ? 'verified_user' : 'devices',
      count: catFiles.length,
      totalLoc: catFiles.reduce((acc, f) => acc + f.lines, 0),
      center: [avgX, 0, avgZ]
    });
  });

  // Calculate compact avenue lines covering the contiguous city + 1 margin block
  const avenueXList: number[] = [];
  const avenueZList: number[] = [];
  for (let i = minGx - 1; i <= maxGx + 2; i++) {
    avenueXList.push((i - 0.5) * BLOCK_PITCH);
  }
  for (let j = minGz - 1; j <= maxGz + 2; j++) {
    avenueZList.push((j - 0.5) * BLOCK_PITCH);
  }

  const cityWidth = (maxGx - minGx + 3) * BLOCK_PITCH;
  const cityDepth = (maxGz - minGz + 3) * BLOCK_PITCH;

  return {
    blocks,
    allBuildings,
    flatNodes,
    districts: districtMetaList,
    totalLines,
    totalClasses: allBuildings.length,
    avenueXList,
    avenueZList,
    cityWidth,
    cityDepth
  };
}
