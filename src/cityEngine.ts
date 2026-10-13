import type { FileNode } from './githubApi';

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
  buildingType: 'godObject' | 'skyscraper' | 'tower' | 'block' | 'pavilion';
  isCode: boolean;
  isGodObject: boolean;
  position: [number, number, number];
  width: number;
  depth: number;
  height: number;
  tiers: BuildingTier[];
  hasSpire: boolean;
  spireHeight: number;
  hasHelipad: boolean;
  districtName: string;
  absolutePosition: [number, number, number];
}

export interface CityBlockData {
  id: string;
  gridX: number;
  gridZ: number;
  center: [number, number, number];
  width: number;
  depth: number;
  isCodeDistrict: boolean;
  districtName: string;
  buildings: BuildingData[];
}

export interface CompleteCityModel {
  blocks: CityBlockData[];
  allBuildings: BuildingData[];
  codeBuildings: BuildingData[];
  flatNodes: Map<string, BuildingData>;
  totalLines: number;
  totalClasses: number;
  avenueXList: number[];
  avenueZList: number[];
}

export const BLOCK_SIZE = 28;
export const STREET_WIDTH = 6;
export const BLOCK_PITCH = BLOCK_SIZE + STREET_WIDTH; // 34
export const SIDEWALK_HEIGHT = 0.3;
export const GRID_RADIUS = 3; // -3 to +3 = 7x7 blocks = 49 blocks

export const getExtensionColor = (ext?: string): string => {
  switch (ext?.toLowerCase()) {
    case 'ts':
    case 'tsx':
      return '#00dce5'; // Cyan
    case 'js':
    case 'jsx':
      return '#f59e0b'; // Amber / Yellow
    case 'py':
      return '#3b82f6'; // Python Blue
    case 'java':
      return '#ea580c'; // Java Orange
    case 'go':
      return '#06b6d4'; // Go Teal
    case 'rs':
      return '#f97316'; // Rust Orange
    case 'html':
      return '#ef4444'; // HTML Red
    case 'css':
      return '#a855f7'; // CSS Purple
    case 'json':
      return '#64748b'; // Slate Gray
    case 'sql':
      return '#10b981'; // Emerald Green
    case 'md':
      return '#94a3b8'; // Light Slate
    default:
      return '#38bdf8'; // Sky Blue
  }
};

function getExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
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
  const isGodObject = isGodObjectParam || lines > 1400 || sizeBytes > 45000;
  let height: number;
  let buildingType: 'godObject' | 'skyscraper' | 'tower' | 'block' | 'pavilion';
  let tiers: BuildingTier[] = [];
  let hasSpire = false;
  let spireHeight = 0;
  let hasHelipad = false;

  const w = lotW * 0.86;
  const d = lotD * 0.86;

  if (isGodObject) {
    buildingType = 'godObject';
    height = Math.min(65, 48 + Math.round((lines - 1400) * 0.01));
    hasSpire = true;
    spireHeight = 10;
    
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
  } else if (lines > 380) {
    buildingType = 'skyscraper';
    height = Math.min(46, 28 + Math.round((lines - 380) * 0.04));
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
  } else if (lines > 140) {
    buildingType = 'tower';
    height = Math.min(26, 16 + Math.round((lines - 140) * 0.042));
    hasHelipad = lines > 260;

    // 3-tier mid-rise tower
    const h1 = height * 0.35;
    const h2 = height * 0.48;
    const h3 = height * 0.17;

    tiers = [
      { width: w, depth: d, height: h1, y: h1 / 2 },
      { width: w * 0.80, depth: d * 0.80, height: h2, y: h1 + h2 / 2 },
      { width: w * 0.48, depth: d * 0.48, height: h3, y: h1 + h2 + h3 / 2 }
    ];
  } else if (lines > 50) {
    buildingType = 'block';
    height = Math.min(15, 10 + Math.round((lines - 50) * 0.06));

    // 2-tier commercial block
    const h1 = height * 0.75;
    const h2 = height * 0.25;

    tiers = [
      { width: w, depth: d, height: h1, y: h1 / 2 },
      { width: w * 0.52, depth: d * 0.52, height: h2, y: h1 + h2 / 2 }
    ];
  } else {
    buildingType = 'pavilion';
    height = Math.min(9, 5 + Math.round(lines * 0.07));

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

// Procedural random helper with deterministic seed
function pseudoRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

// Stitch-inspired default enterprise AST codebase
export const DEFAULT_ENTERPRISE_AST = [
  // Financial & API Core (with famous God Object)
  { name: 'UserManager.py [GOD OBJECT]', path: 'src/core/UserManager.py', lines: 3450, methods: 142, size: 124000, district: 'Financial Core' },
  { name: 'BillingService.py', path: 'src/api/BillingService.py', lines: 890, methods: 38, size: 32000, district: 'Financial Core' },
  { name: 'AuthController.java', path: 'src/auth/AuthController.java', lines: 620, methods: 24, size: 22000, district: 'Financial Core' },
  { name: 'QueryRouter.py', path: 'src/api/QueryRouter.py', lines: 1120, methods: 45, size: 39000, district: 'Financial Core' },
  { name: 'PaymentGateway.ts', path: 'src/api/PaymentGateway.ts', lines: 740, methods: 31, size: 26000, district: 'Financial Core' },
  { name: 'TokenAuth.go', path: 'src/auth/TokenAuth.go', lines: 480, methods: 19, size: 17000, district: 'Financial Core' },

  // Commercial District (React Frontend)
  { name: 'App.tsx', path: 'src/App.tsx', lines: 520, methods: 22, size: 18500, district: 'Frontend Tech' },
  { name: 'CityViewport.tsx', path: 'src/components/CityViewport.tsx', lines: 680, methods: 28, size: 24000, district: 'Frontend Tech' },
  { name: 'TrafficCanvas.tsx', path: 'src/components/TrafficCanvas.tsx', lines: 510, methods: 22, size: 18000, district: 'Frontend Tech' },
  { name: 'AuthContext.tsx', path: 'src/context/AuthContext.tsx', lines: 210, methods: 9, size: 7500, district: 'Frontend Tech' },
  { name: 'StateStore.ts', path: 'src/store/StateStore.ts', lines: 340, methods: 15, size: 12000, district: 'Frontend Tech' },
  { name: 'TelemetryDashboard.tsx', path: 'src/components/TelemetryDashboard.tsx', lines: 430, methods: 18, size: 15000, district: 'Frontend Tech' },
  { name: 'NavigationRibbon.tsx', path: 'src/components/NavigationRibbon.tsx', lines: 290, methods: 12, size: 10500, district: 'Frontend Tech' },
  { name: 'ModalViewer.tsx', path: 'src/components/ModalViewer.tsx', lines: 180, methods: 8, size: 6200, district: 'Frontend Tech' },

  // Industrial District (PostgreSQL, Redis & Models)
  { name: 'PostgresPool.java', path: 'src/db/PostgresPool.java', lines: 750, methods: 32, size: 27000, district: 'Database Center' },
  { name: 'TelemetryDB.go', path: 'src/db/TelemetryDB.go', lines: 460, methods: 19, size: 16500, district: 'Database Center' },
  { name: 'RedisCache.py', path: 'src/cache/RedisCache.py', lines: 320, methods: 12, size: 11000, district: 'Database Center' },
  { name: '0014_migration.py', path: 'src/migrations/0014_migration.py', lines: 180, methods: 6, size: 6400, district: 'Database Center' },
  { name: 'AuditLogModel.py', path: 'src/models/AuditLogModel.py', lines: 270, methods: 11, size: 9500, district: 'Database Center' },
  { name: 'SessionStore.go', path: 'src/db/SessionStore.go', lines: 390, methods: 16, size: 14000, district: 'Database Center' },

  // Government & Workers District
  { name: 'CeleryWorker.py', path: 'src/workers/CeleryWorker.py', lines: 580, methods: 24, size: 21000, district: 'Workers & Cloud' },
  { name: 'ASTParserService.py', path: 'src/services/ASTParserService.py', lines: 940, methods: 35, size: 33000, district: 'Workers & Cloud' },
  { name: 'TrafficSimulator.cpp', path: 'src/engine/TrafficSimulator.cpp', lines: 810, methods: 29, size: 29000, district: 'Workers & Cloud' },
  { name: 'AuditConsumer.ts', path: 'src/workers/AuditConsumer.ts', lines: 430, methods: 16, size: 15500, district: 'Workers & Cloud' },
  { name: 'ReportGenerator.py', path: 'src/services/ReportGenerator.py', lines: 360, methods: 14, size: 13000, district: 'Workers & Cloud' },
  { name: 'SyncDaemon.go', path: 'src/daemon/SyncDaemon.go', lines: 490, methods: 20, size: 17500, district: 'Workers & Cloud' },

  // Architecture & Shared Utilities
  { name: 'index.html', path: 'index.html', lines: 110, methods: 4, size: 4000, district: 'Infrastructure' },
  { name: 'package.json', path: 'package.json', lines: 85, methods: 1, size: 3200, district: 'Infrastructure' },
  { name: 'tailwind.config.js', path: 'tailwind.config.js', lines: 95, methods: 1, size: 3500, district: 'Infrastructure' },
  { name: 'vite.config.ts', path: 'vite.config.ts', lines: 65, methods: 1, size: 2400, district: 'Infrastructure' },
  { name: 'tsconfig.json', path: 'tsconfig.json', lines: 45, methods: 1, size: 1800, district: 'Infrastructure' },
  { name: 'README.md', path: 'README.md', lines: 140, methods: 2, size: 5000, district: 'Infrastructure' },
  { name: 'docker-compose.yml', path: 'docker-compose.yml', lines: 120, methods: 3, size: 4500, district: 'Infrastructure' }
];

export function buildCompleteCity(rootNode: FileNode | null): CompleteCityModel {
  const blocks: CityBlockData[] = [];
  const allBuildings: BuildingData[] = [];
  const codeBuildings: BuildingData[] = [];
  const flatNodes = new Map<string, BuildingData>();

  // 1. Collect all real code files from rootNode if provided, otherwise default AST
  let rawFiles: Array<{ name: string; path: string; lines: number; methods: number; size: number; district: string }> = [];

  if (rootNode) {
    function extractFiles(node: FileNode, currentDistrict: string) {
      if (node.type === 'blob') {
        const lines = Math.max(15, Math.round((node.size || 600) / 36));
        const methods = Math.max(2, Math.round(Math.sqrt(lines) * 1.3));
        rawFiles.push({
          name: node.name,
          path: node.path || node.id,
          lines,
          methods,
          size: node.size || 1000,
          district: currentDistrict || 'Main District'
        });
      } else if (node.children) {
        const districtName = node.name !== 'root' ? node.name : currentDistrict;
        node.children.forEach(child => extractFiles(child, districtName || 'Main District'));
      }
    }
    extractFiles(rootNode, 'Downtown Core');
  }

  if (rawFiles.length === 0) {
    rawFiles = [...DEFAULT_ENTERPRISE_AST];
  }

  let totalLines = 0;
  rawFiles.forEach(f => { totalLines += f.lines; });

  // 2. Group code files into districts/blocks
  // We place code files in the central grid blocks: (gx, gz) in [-1..1, -1..1] or [-2..2, -1..1]
  const districtGroups = new Map<string, typeof rawFiles>();
  rawFiles.forEach(f => {
    const d = f.district || 'Downtown';
    if (!districtGroups.has(d)) districtGroups.set(d, []);
    districtGroups.get(d)!.push(f);
  });

  // Target slots for central code blocks
  const codeBlockSlots: Array<{ gx: number; gz: number }> = [
    { gx: 0, gz: 0 },
    { gx: -1, gz: 0 },
    { gx: 1, gz: 0 },
    { gx: 0, gz: -1 },
    { gx: 0, gz: 1 },
    { gx: -1, gz: -1 },
    { gx: 1, gz: -1 },
    { gx: -1, gz: 1 },
    { gx: 1, gz: 1 },
    { gx: -2, gz: 0 },
    { gx: 2, gz: 0 },
    { gx: -2, gz: -1 },
    { gx: 2, gz: -1 },
    { gx: -2, gz: 1 },
    { gx: 2, gz: 1 }
  ];

  // Distribute files across code block slots
  const allCodeFiles = Array.from(districtGroups.values()).flat();
  allCodeFiles.sort((a, b) => b.lines - a.lines);

  const filesPerBlock = Math.max(2, Math.min(5, Math.ceil(allCodeFiles.length / Math.min(codeBlockSlots.length, 9))));
  const codeBlocksMap = new Map<string, typeof rawFiles>();

  let slotIndex = 0;
  for (let i = 0; i < allCodeFiles.length; i += filesPerBlock) {
    if (slotIndex >= codeBlockSlots.length) break;
    const chunk = allCodeFiles.slice(i, i + filesPerBlock);
    const slot = codeBlockSlots[slotIndex];
    const key = `${slot.gx},${slot.gz}`;
    codeBlocksMap.set(key, chunk);
    slotIndex++;
  }

  // Subgrid layout coordinates inside a block of usable size 22x22
  function getSubgridPositions(count: number): Array<{ x: number; z: number; lotW: number; lotD: number }> {
    if (count === 1) {
      return [{ x: 0, z: 0, lotW: 16, lotD: 16 }];
    }
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
    return [
      { x: -6.0, z: -6.5, lotW: 8.5, lotD: 8.5 },
      { x: 6.0, z: -6.5, lotW: 8.5, lotD: 8.5 },
      { x: -6.0, z: 0, lotW: 8.5, lotD: 7.5 },
      { x: 6.0, z: 0, lotW: 8.5, lotD: 7.5 },
      { x: 0, z: 6.5, lotW: 10, lotD: 8.0 }
    ];
  }

  // 3. Generate ALL 49 BLOCKS in the 7x7 grid (-3 to +3)
  for (let gx = -GRID_RADIUS; gx <= GRID_RADIUS; gx++) {
    for (let gz = -GRID_RADIUS; gz <= GRID_RADIUS; gz++) {
      const blockKey = `${gx},${gz}`;
      const blockCenterX = gx * BLOCK_PITCH;
      const blockCenterZ = gz * BLOCK_PITCH;
      const isCodeBlock = codeBlocksMap.has(blockKey);

      const blockBuildings: BuildingData[] = [];

      if (isCodeBlock) {
        const files = codeBlocksMap.get(blockKey)!;
        const slots = getSubgridPositions(files.length);

        files.forEach((file, idx) => {
          const slot = slots[idx] || slots[0];
          const ext = getExtension(file.name);
          const color = getExtensionColor(ext);
          const isGod = file.name.includes('GOD OBJECT') || file.lines > 1500;

          const geom = generateBuildingTiers(file.lines, file.size, slot.lotW, slot.lotD, isGod);
          const absX = blockCenterX + slot.x;
          const absZ = blockCenterZ + slot.z;

          const building: BuildingData = {
            id: file.path,
            name: file.name,
            path: file.path,
            size: file.size,
            lines: file.lines,
            methods: file.methods,
            extension: ext,
            color,
            buildingType: geom.buildingType,
            isCode: true,
            isGodObject: geom.isGodObject,
            position: [slot.x, 0, slot.z],
            width: geom.width,
            depth: geom.depth,
            height: geom.height,
            tiers: geom.tiers,
            hasSpire: geom.hasSpire,
            spireHeight: geom.spireHeight,
            hasHelipad: geom.hasHelipad,
            districtName: file.district,
            absolutePosition: [absX, 0, absZ]
          };

          blockBuildings.push(building);
          codeBuildings.push(building);
          allBuildings.push(building);
          flatNodes.set(building.id, building);
        });
      } else {
        const seedBase = (gx + 10) * 37 + (gz + 10) * 89;
        const count = 3 + Math.floor(pseudoRandom(seedBase) * 2);
        const slots = getSubgridPositions(count);

        const distFromCenter = Math.sqrt(gx * gx + gz * gz);
        const heightMultiplier = Math.max(0.4, 1.1 - distFromCenter * 0.18);

        slots.forEach((slot, sIdx) => {
          const bSeed = seedBase + sIdx * 17;
          const randomLines = Math.round((60 + pseudoRandom(bSeed) * 550) * heightMultiplier);
          const geom = generateBuildingTiers(randomLines, randomLines * 35, slot.lotW, slot.lotD, false);

          const absX = blockCenterX + slot.x;
          const absZ = blockCenterZ + slot.z;

          const building: BuildingData = {
            id: `metro-bld-${gx}-${gz}-${sIdx}`,
            name: `Metro Tower ${gx}.${gz}.${sIdx + 1}`,
            path: `metropolis/sector_${gx}_${gz}/bld_${sIdx}`,
            size: randomLines * 35,
            lines: randomLines,
            methods: Math.max(2, Math.round(Math.sqrt(randomLines))),
            extension: 'civic',
            color: '#64748b',
            buildingType: geom.buildingType,
            isCode: false,
            isGodObject: false,
            position: [slot.x, 0, slot.z],
            width: geom.width,
            depth: geom.depth,
            height: geom.height,
            tiers: geom.tiers,
            hasSpire: geom.hasSpire && pseudoRandom(bSeed + 5) > 0.4,
            spireHeight: geom.spireHeight,
            hasHelipad: geom.hasHelipad,
            districtName: `Metropolitan Sector ${gx >= 0 ? 'E' : 'W'}${Math.abs(gx)}-${gz >= 0 ? 'N' : 'S'}${Math.abs(gz)}`,
            absolutePosition: [absX, 0, absZ]
          };

          blockBuildings.push(building);
          allBuildings.push(building);
        });
      }

      blocks.push({
        id: `block-${gx}-${gz}`,
        gridX: gx,
        gridZ: gz,
        center: [blockCenterX, 0, blockCenterZ],
        width: BLOCK_SIZE,
        depth: BLOCK_SIZE,
        isCodeDistrict: isCodeBlock,
        districtName: isCodeBlock ? 'Downtown Core' : 'Metropolis',
        buildings: blockBuildings
      });
    }
  }

  const avenueXList: number[] = [];
  const avenueZList: number[] = [];
  for (let i = -GRID_RADIUS; i <= GRID_RADIUS + 1; i++) {
    avenueXList.push((i - 0.5) * BLOCK_PITCH);
    avenueZList.push((i - 0.5) * BLOCK_PITCH);
  }

  return {
    blocks,
    allBuildings,
    codeBuildings,
    flatNodes,
    totalLines,
    totalClasses: codeBuildings.length,
    avenueXList,
    avenueZList
  };
}
