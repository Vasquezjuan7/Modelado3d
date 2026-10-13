import type { FileNode } from './githubApi';

export type DistrictCategory = 'frontend' | 'core-api' | 'database' | 'workers' | 'config' | 'tests';

export interface DistrictMeta {
  key: DistrictCategory;
  name: string;
  subname: string;
  color: string;
  plateColor: string;
  icon: string;
  center: [number, number, number];
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  count: number;
  totalLoc: number;
}

export interface BuildingTier {
  width: number;
  depth: number;
  height: number;
  y: number; // Center Y
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
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
}

export const BLOCK_SIZE = 26;
export const STREET_WIDTH = 6;
export const BLOCK_PITCH = BLOCK_SIZE + STREET_WIDTH; // 32
export const SIDEWALK_HEIGHT = 0.3;
export const GRID_RADIUS = 4;

// Categorize any file into 6 core architectural districts
export function categorizeFile(filePath: string, fileName: string): {
  category: DistrictCategory;
  districtName: string;
  color: string;
} {
  const p = filePath.toLowerCase();
  const n = fileName.toLowerCase();
  const ext = n.includes('.') ? n.split('.').pop() || '' : '';

  // 1. Tests & QA
  if (
    p.includes('test') ||
    p.includes('spec') ||
    p.includes('__tests__') ||
    p.includes('cypress') ||
    p.includes('jest') ||
    n.includes('.test.') ||
    n.includes('.spec.')
  ) {
    return { category: 'tests', districtName: 'Distrito Seguridad & Tests', color: '#ec4899' };
  }

  // 2. Database & Storage Models
  if (
    p.includes('db') ||
    p.includes('database') ||
    p.includes('model') ||
    p.includes('schema') ||
    p.includes('migration') ||
    p.includes('sql') ||
    p.includes('prisma') ||
    p.includes('entity') ||
    p.includes('redis') ||
    p.includes('postgres') ||
    ['sql', 'prisma'].includes(ext)
  ) {
    return { category: 'database', districtName: 'Distrito Industrial (Database & Storage)', color: '#10b981' };
  }

  // 3. Workers, Daemons & Runtime
  if (
    p.includes('worker') ||
    p.includes('job') ||
    p.includes('queue') ||
    p.includes('celery') ||
    p.includes('daemon') ||
    p.includes('task') ||
    p.includes('cron') ||
    p.includes('engine') ||
    p.includes('stream') ||
    ['cpp', 'rs', 'go', 'sh', 'bash'].includes(ext)
  ) {
    return { category: 'workers', districtName: 'Distrito Gubernamental (Workers & Daemons)', color: '#a855f7' };
  }

  // 4. Core Logic & API
  if (
    p.includes('api') ||
    p.includes('route') ||
    p.includes('controller') ||
    p.includes('service') ||
    p.includes('handler') ||
    p.includes('auth') ||
    p.includes('token') ||
    p.includes('core') ||
    p.includes('server') ||
    p.includes('middleware') ||
    p.includes('router') ||
    ['py', 'java', 'php', 'rb'].includes(ext)
  ) {
    return { category: 'core-api', districtName: 'Distrito Financiero (Core API & Auth)', color: '#f59e0b' };
  }

  // 5. Config, Build & Infrastructure
  if (
    p.includes('config') ||
    p.includes('docker') ||
    p.includes('.github') ||
    p.includes('build') ||
    p.includes('scripts') ||
    ['json', 'yaml', 'yml', 'toml', 'env', 'md', 'lock', 'xml'].includes(ext) ||
    n.startsWith('vite.') ||
    n.startsWith('webpack.') ||
    n.startsWith('tailwind.') ||
    n.startsWith('tsconfig') ||
    n.startsWith('package.')
  ) {
    return { category: 'config', districtName: 'Distrito Infraestructura (Config & Build)', color: '#64748b' };
  }

  // 6. Frontend & UI (Default for tsx, jsx, vue, html, css, ui, etc.)
  return { category: 'frontend', districtName: 'Distrito Comercial (Frontend & UI)', color: '#00f5ff' };
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
  isGodObject: boolean;
} {
  const isGodObject = isGodObjectParam || lines > 1200 || sizeBytes > 42000;
  let height: number;
  let buildingType: 'godObject' | 'skyscraper' | 'tower' | 'block' | 'pavilion';
  let tiers: BuildingTier[] = [];
  let hasSpire = false;
  let spireHeight = 0;
  let hasHelipad = false;

  const w = lotW * 0.88;
  const d = lotD * 0.88;

  if (isGodObject) {
    buildingType = 'godObject';
    height = Math.min(65, 48 + Math.round((lines - 1200) * 0.012));
    hasSpire = true;
    spireHeight = 11;
    
    // 5-tier stepped setback skyscraper
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
    spireHeight = 6.5;

    // 4-tier stepped setback skyscraper
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

    // 3-tier mid-rise tower
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

    // 2-tier commercial block
    const h1 = height * 0.75;
    const h2 = height * 0.25;

    tiers = [
      { width: w, depth: d, height: h1, y: h1 / 2 },
      { width: w * 0.52, depth: d * 0.52, height: h2, y: h1 + h2 / 2 }
    ];
  } else {
    buildingType = 'pavilion';
    height = Math.min(9, 5 + Math.round(lines * 0.08));

    // 2-tier low-rise pavilion
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
    isGodObject
  };
}

// Default rich enterprise AST codebase
export const DEFAULT_ENTERPRISE_AST = [
  // Financial District (Core API & Auth) - Includes God Object
  { name: 'UserManager.py [GOD OBJECT]', path: 'src/core/UserManager.py', lines: 3450, methods: 142, size: 124000 },
  { name: 'BillingService.py', path: 'src/api/BillingService.py', lines: 890, methods: 38, size: 32000 },
  { name: 'AuthController.java', path: 'src/auth/AuthController.java', lines: 620, methods: 24, size: 22000 },
  { name: 'QueryRouter.py', path: 'src/api/QueryRouter.py', lines: 1120, methods: 45, size: 39000 },
  { name: 'PaymentGateway.ts', path: 'src/api/PaymentGateway.ts', lines: 740, methods: 31, size: 26000 },
  { name: 'TokenAuth.go', path: 'src/auth/TokenAuth.go', lines: 480, methods: 19, size: 17000 },
  { name: 'PermissionMiddleware.py', path: 'src/core/PermissionMiddleware.py', lines: 310, methods: 14, size: 11000 },

  // Commercial District (Frontend & UI)
  { name: 'App.tsx', path: 'src/App.tsx', lines: 520, methods: 22, size: 18500 },
  { name: 'CityViewport.tsx', path: 'src/components/CityViewport.tsx', lines: 680, methods: 28, size: 24000 },
  { name: 'TrafficCanvas.tsx', path: 'src/components/TrafficCanvas.tsx', lines: 510, methods: 22, size: 18000 },
  { name: 'AuthContext.tsx', path: 'src/context/AuthContext.tsx', lines: 210, methods: 9, size: 7500 },
  { name: 'StateStore.ts', path: 'src/store/StateStore.ts', lines: 340, methods: 15, size: 12000 },
  { name: 'TelemetryDashboard.tsx', path: 'src/components/TelemetryDashboard.tsx', lines: 430, methods: 18, size: 15000 },
  { name: 'NavigationRibbon.tsx', path: 'src/components/NavigationRibbon.tsx', lines: 290, methods: 12, size: 10500 },
  { name: 'ModalViewer.tsx', path: 'src/components/ModalViewer.tsx', lines: 180, methods: 8, size: 6200 },
  { name: 'ThemeContext.tsx', path: 'src/context/ThemeContext.tsx', lines: 140, methods: 6, size: 5200 },

  // Industrial District (Database & Storage)
  { name: 'PostgresPool.java', path: 'src/db/PostgresPool.java', lines: 750, methods: 32, size: 27000 },
  { name: 'TelemetryDB.go', path: 'src/db/TelemetryDB.go', lines: 460, methods: 19, size: 16500 },
  { name: 'RedisCache.py', path: 'src/cache/RedisCache.py', lines: 320, methods: 12, size: 11000 },
  { name: '0014_migration.py', path: 'src/migrations/0014_migration.py', lines: 180, methods: 6, size: 6400 },
  { name: 'AuditLogModel.py', path: 'src/models/AuditLogModel.py', lines: 270, methods: 11, size: 9500 },
  { name: 'SessionStore.go', path: 'src/db/SessionStore.go', lines: 390, methods: 16, size: 14000 },
  { name: 'InvoiceEntity.ts', path: 'src/models/InvoiceEntity.ts', lines: 340, methods: 15, size: 12500 },

  // Government District (Workers & Daemons)
  { name: 'CeleryWorker.py', path: 'src/workers/CeleryWorker.py', lines: 580, methods: 24, size: 21000 },
  { name: 'ASTParserService.py', path: 'src/services/ASTParserService.py', lines: 940, methods: 35, size: 33000 },
  { name: 'TrafficSimulator.cpp', path: 'src/engine/TrafficSimulator.cpp', lines: 810, methods: 29, size: 29000 },
  { name: 'AuditConsumer.ts', path: 'src/workers/AuditConsumer.ts', lines: 430, methods: 16, size: 15500 },
  { name: 'ReportGenerator.py', path: 'src/services/ReportGenerator.py', lines: 360, methods: 14, size: 13000 },
  { name: 'SyncDaemon.go', path: 'src/daemon/SyncDaemon.go', lines: 490, methods: 20, size: 17500 },

  // Infrastructure & Config District
  { name: 'index.html', path: 'index.html', lines: 110, methods: 4, size: 4000 },
  { name: 'package.json', path: 'package.json', lines: 85, methods: 1, size: 3200 },
  { name: 'tailwind.config.js', path: 'tailwind.config.js', lines: 95, methods: 1, size: 3500 },
  { name: 'vite.config.ts', path: 'vite.config.ts', lines: 65, methods: 1, size: 2400 },
  { name: 'tsconfig.json', path: 'tsconfig.json', lines: 45, methods: 1, size: 1800 },
  { name: 'README.md', path: 'README.md', lines: 140, methods: 2, size: 5000 },
  { name: 'docker-compose.yml', path: 'docker-compose.yml', lines: 120, methods: 3, size: 4500 },

  // Quality & Security (Tests & QA)
  { name: 'AuthService.test.ts', path: 'tests/AuthService.test.ts', lines: 320, methods: 14, size: 11500 },
  { name: 'Traffic.spec.tsx', path: 'tests/Traffic.spec.tsx', lines: 280, methods: 12, size: 9800 },
  { name: 'DatabasePool.test.py', path: 'tests/DatabasePool.test.py', lines: 410, methods: 18, size: 14500 }
];

export function buildCompleteCity(rootNode: FileNode | null): CompleteCityModel {
  const blocks: CityBlockData[] = [];
  const allBuildings: BuildingData[] = [];
  const flatNodes = new Map<string, BuildingData>();

  // 1. Ingest real repository files from AST or default
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

  // 2. Classify EVERY file into functional categories
  const categoryBuckets: Record<DistrictCategory, Array<{
    name: string;
    path: string;
    lines: number;
    methods: number;
    size: number;
    districtName: string;
    color: string;
    category: DistrictCategory;
  }>> = {
    'frontend': [],
    'core-api': [],
    'database': [],
    'workers': [],
    'config': [],
    'tests': []
  };

  rawFiles.forEach((file) => {
    const { category, districtName, color } = categorizeFile(file.path, file.name);
    categoryBuckets[category].push({
      ...file,
      category,
      districtName,
      color
    });
  });

  // Sort each bucket by LOC descending so the tallest skyscrapers crown the center of their district
  Object.keys(categoryBuckets).forEach((k) => {
    categoryBuckets[k as DistrictCategory].sort((a, b) => b.lines - a.lines);
  });

  // 3. Sector Coordinate Allocations for Districts in Urban Grid
  // Frontend: Sector NW (negative X, negative Z)
  // Core API: Sector NE (positive X, negative Z)
  // Database: Sector SW (negative X, positive Z)
  // Workers: Sector SE (positive X, positive Z)
  // Config & Tests: Central Avenues (X around 0)
  const sectorAssignments: Record<DistrictCategory, Array<{ gx: number; gz: number }>> = {
    'frontend': [
      { gx: -1, gz: -1 }, { gx: -2, gz: -1 }, { gx: -1, gz: -2 }, { gx: -2, gz: -2 },
      { gx: -3, gz: -1 }, { gx: -3, gz: -2 }, { gx: -1, gz: -3 }, { gx: -2, gz: -3 }, { gx: -3, gz: -3 }
    ],
    'core-api': [
      { gx: 1, gz: -1 }, { gx: 2, gz: -1 }, { gx: 1, gz: -2 }, { gx: 2, gz: -2 },
      { gx: 3, gz: -1 }, { gx: 3, gz: -2 }, { gx: 1, gz: -3 }, { gx: 2, gz: -3 }, { gx: 3, gz: -3 }
    ],
    'database': [
      { gx: -1, gz: 1 }, { gx: -2, gz: 1 }, { gx: -1, gz: 2 }, { gx: -2, gz: 2 },
      { gx: -3, gz: 1 }, { gx: -3, gz: 2 }, { gx: -1, gz: 3 }, { gx: -2, gz: 3 }, { gx: -3, gz: 3 }
    ],
    'workers': [
      { gx: 1, gz: 1 }, { gx: 2, gz: 1 }, { gx: 1, gz: 2 }, { gx: 2, gz: 2 },
      { gx: 3, gz: 1 }, { gx: 3, gz: 2 }, { gx: 1, gz: 3 }, { gx: 2, gz: 3 }, { gx: 3, gz: 3 }
    ],
    'config': [
      { gx: 0, gz: 0 }, { gx: 0, gz: -1 }, { gx: 0, gz: 1 }, { gx: 0, gz: -2 }, { gx: 0, gz: 2 }
    ],
    'tests': [
      { gx: 0, gz: -3 }, { gx: 0, gz: 3 }, { gx: -1, gz: 0 }, { gx: 1, gz: 0 }
    ]
  };

  // Subgrid lot positioning inside a block (22x22 usable lot)
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

  const districtSummaries: DistrictMeta[] = [
    {
      key: 'frontend',
      name: 'Distrito Comercial',
      subname: 'Frontend & UI Components',
      color: '#00f5ff',
      plateColor: '#002830',
      icon: 'devices',
      center: [-1.5 * BLOCK_PITCH, 0, -1.5 * BLOCK_PITCH],
      bounds: { minX: -3 * BLOCK_PITCH, maxX: -BLOCK_PITCH, minZ: -3 * BLOCK_PITCH, maxZ: -BLOCK_PITCH },
      count: categoryBuckets.frontend.length,
      totalLoc: categoryBuckets.frontend.reduce((acc, f) => acc + f.lines, 0)
    },
    {
      key: 'core-api',
      name: 'Distrito Financiero',
      subname: 'Core Logic, API & Auth',
      color: '#f59e0b',
      plateColor: '#302000',
      icon: 'account_balance',
      center: [1.5 * BLOCK_PITCH, 0, -1.5 * BLOCK_PITCH],
      bounds: { minX: BLOCK_PITCH, maxX: 3 * BLOCK_PITCH, minZ: -3 * BLOCK_PITCH, maxZ: -BLOCK_PITCH },
      count: categoryBuckets['core-api'].length,
      totalLoc: categoryBuckets['core-api'].reduce((acc, f) => acc + f.lines, 0)
    },
    {
      key: 'database',
      name: 'Distrito Industrial',
      subname: 'Database, Models & Storage',
      color: '#10b981',
      plateColor: '#002b1b',
      icon: 'database',
      center: [-1.5 * BLOCK_PITCH, 0, 1.5 * BLOCK_PITCH],
      bounds: { minX: -3 * BLOCK_PITCH, maxX: -BLOCK_PITCH, minZ: BLOCK_PITCH, maxZ: 3 * BLOCK_PITCH },
      count: categoryBuckets.database.length,
      totalLoc: categoryBuckets.database.reduce((acc, f) => acc + f.lines, 0)
    },
    {
      key: 'workers',
      name: 'Distrito Gubernamental',
      subname: 'Workers, Queues & Daemons',
      color: '#a855f7',
      plateColor: '#280036',
      icon: 'memory',
      center: [1.5 * BLOCK_PITCH, 0, 1.5 * BLOCK_PITCH],
      bounds: { minX: BLOCK_PITCH, maxX: 3 * BLOCK_PITCH, minZ: BLOCK_PITCH, maxZ: 3 * BLOCK_PITCH },
      count: categoryBuckets.workers.length,
      totalLoc: categoryBuckets.workers.reduce((acc, f) => acc + f.lines, 0)
    },
    {
      key: 'config',
      name: 'Distrito Infraestructura',
      subname: 'Config, Build & Devops',
      color: '#64748b',
      plateColor: '#1e2430',
      icon: 'settings',
      center: [0, 0, 0],
      bounds: { minX: -BLOCK_PITCH, maxX: BLOCK_PITCH, minZ: -2 * BLOCK_PITCH, maxZ: 2 * BLOCK_PITCH },
      count: categoryBuckets.config.length,
      totalLoc: categoryBuckets.config.reduce((acc, f) => acc + f.lines, 0)
    },
    {
      key: 'tests',
      name: 'Distrito Seguridad',
      subname: 'Testing & Quality Assurance',
      color: '#ec4899',
      plateColor: '#380020',
      icon: 'verified_user',
      center: [0, 0, 3 * BLOCK_PITCH],
      bounds: { minX: -BLOCK_PITCH, maxX: BLOCK_PITCH, minZ: 2 * BLOCK_PITCH, maxZ: 3 * BLOCK_PITCH },
      count: categoryBuckets.tests.length,
      totalLoc: categoryBuckets.tests.reduce((acc, f) => acc + f.lines, 0)
    }
  ];

  // 4. Distribute files into blocks for each category
  // EVERY building is functional and linked to a real file!
  Object.keys(categoryBuckets).forEach((catKey) => {
    const category = catKey as DistrictCategory;
    const files = categoryBuckets[category];
    if (files.length === 0) return;

    const slots = sectorAssignments[category] || sectorAssignments['config'];
    // Group files into chunks of 2 to 4 per block
    const filesPerBlock = Math.max(2, Math.min(4, Math.ceil(files.length / slots.length)));

    let slotIdx = 0;
    for (let i = 0; i < files.length; i += filesPerBlock) {
      const slot = slots[slotIdx % slots.length];
      const chunk = files.slice(i, i + filesPerBlock);

      const blockCenterX = slot.gx * BLOCK_PITCH;
      const blockCenterZ = slot.gz * BLOCK_PITCH;
      const subLots = getSubgridPositions(chunk.length);

      const blockBuildings: BuildingData[] = [];

      chunk.forEach((file, fIdx) => {
        const lot = subLots[fIdx] || subLots[0];
        const isGod = file.name.includes('GOD OBJECT') || file.lines > 1200;

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
          absolutePosition: [absX, 0, absZ]
        };

        blockBuildings.push(building);
        allBuildings.push(building);
        flatNodes.set(building.id, building);
      });

      const distMeta = districtSummaries.find((d) => d.key === category)!;

      blocks.push({
        id: `block-${slot.gx}-${slot.gz}-${slotIdx}`,
        gridX: slot.gx,
        gridZ: slot.gz,
        center: [blockCenterX, 0, blockCenterZ],
        width: BLOCK_SIZE,
        depth: BLOCK_SIZE,
        category,
        districtName: distMeta.name,
        districtColor: distMeta.color,
        buildings: blockBuildings
      });

      slotIdx++;
    }
  });

  // Calculate avenue centerlines for traffic
  const avenueXList: number[] = [];
  const avenueZList: number[] = [];
  for (let i = -4; i <= 4; i++) {
    avenueXList.push((i - 0.5) * BLOCK_PITCH);
    avenueZList.push((i - 0.5) * BLOCK_PITCH);
  }

  return {
    blocks,
    allBuildings,
    flatNodes,
    districts: districtSummaries,
    totalLines,
    totalClasses: allBuildings.length,
    avenueXList,
    avenueZList,
    bounds: {
      minX: -4 * BLOCK_PITCH,
      maxX: 4 * BLOCK_PITCH,
      minZ: -4 * BLOCK_PITCH,
      maxZ: 4 * BLOCK_PITCH
    }
  };
}
