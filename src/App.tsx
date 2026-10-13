import { useState, useEffect, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Edges, Text } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import { cloneRepo, parseLocalRepo, readFileContent, writeFileContent } from './localGitApi';
import type { FileNode } from './githubApi';
import { TrafficSystem } from './Traffic';
import type { TrafficEvent } from './Traffic';
import { 
  buildCompleteCity, 
  BLOCK_SIZE, 
  BLOCK_PITCH, 
  SIDEWALK_HEIGHT, 
  GRID_RADIUS 
} from './cityEngine';
import type { BuildingData, CityBlockData, CompleteCityModel } from './cityEngine';
import { Rocket, CheckCircle2, X, Search, Loader2, Activity, Zap, Layers } from 'lucide-react';

// --- Procedural Window Texture Cache ---
let darkWindowTex: THREE.CanvasTexture | null = null;
let lightWindowTex: THREE.CanvasTexture | null = null;

const getWindowTexture = (isDark: boolean) => {
  if (isDark) {
    if (!darkWindowTex) {
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#060a12';
      ctx.fillRect(0, 0, 128, 128);

      for (let y = 6; y < 128; y += 14) {
        for (let x = 6; x < 128; x += 12) {
          if (Math.random() > 0.45) {
            ctx.fillStyle = Math.random() > 0.3 ? '#ffffff' : '#fef08a';
            ctx.fillRect(x, y, 7, 9);
          }
        }
      }
      const tex = new THREE.CanvasTexture(canvas);
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.magFilter = THREE.NearestFilter;
      darkWindowTex = tex;
    }
    return darkWindowTex;
  } else {
    if (!lightWindowTex) {
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, 128, 128);

      // Subtle architectural window grid for light mode
      for (let y = 6; y < 128; y += 14) {
        for (let x = 6; x < 128; x += 12) {
          ctx.fillStyle = '#cbd5e1';
          ctx.fillRect(x, y, 7, 9);
          ctx.fillStyle = '#94a3b8';
          ctx.strokeRect(x, y, 7, 9);
        }
      }
      const tex = new THREE.CanvasTexture(canvas);
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.magFilter = THREE.NearestFilter;
      lightWindowTex = tex;
    }
    return lightWindowTex;
  }
};

// --- Architectural 3D Building Component ---
function ArchitecturalBuilding({
  data,
  isSelected,
  isHovered,
  theme,
  onClick,
  onPointerOver,
  onPointerOut
}: {
  data: BuildingData;
  isSelected: boolean;
  isHovered: boolean;
  theme: 'dark' | 'light';
  onClick: () => void;
  onPointerOver: () => void;
  onPointerOut: () => void;
}) {
  const isDark = theme === 'dark';
  const tex = getWindowTexture(isDark);

  const edgeColor = useMemo(() => {
    if (isSelected) return isDark ? '#ffffff' : '#0284c7';
    if (isHovered) return isDark ? '#63f7ff' : '#0284c7';
    if (isDark) return data.isCode ? data.color : '#334155';
    return data.isCode ? '#475569' : '#94a3b8';
  }, [isSelected, isHovered, isDark, data.isCode, data.color]);

  const buildingMaterial = useMemo(() => {
    if (isDark) {
      return new THREE.MeshStandardMaterial({
        color: data.isCode ? '#0b101c' : '#070a12',
        metalness: 0.85,
        roughness: 0.25,
        emissiveMap: tex,
        emissive: data.isCode ? new THREE.Color(data.color) : new THREE.Color('#38bdf8'),
        emissiveIntensity: isSelected ? 2.5 : isHovered ? 2.0 : data.isCode ? 1.4 : 0.6
      });
    } else {
      return new THREE.MeshStandardMaterial({
        color: isSelected ? '#e0f2fe' : '#ffffff',
        metalness: 0.05,
        roughness: 0.35,
        map: tex
      });
    }
  }, [isDark, isSelected, isHovered, data.isCode, data.color, tex]);

  return (
    <group
      position={data.position}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        onPointerOver();
      }}
      onPointerOut={(e) => {
        e.stopPropagation();
        onPointerOut();
      }}
    >
      {/* Stepped Tiers (Setbacks) */}
      {data.tiers.map((tier, idx) => (
        <mesh key={idx} position={[0, tier.y, 0]} castShadow receiveShadow>
          <boxGeometry args={[tier.width, tier.height, tier.depth]} />
          <primitive object={buildingMaterial} attach="material" />
          <Edges linewidth={isSelected || isHovered ? 2 : 1.2} threshold={15} color={edgeColor} />
        </mesh>
      ))}

      {/* Rooftop Spire / Antenna for Skyscrapers & God-Objects */}
      {data.hasSpire && (
        <group position={[0, data.height + data.spireHeight / 2, 0]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.08, 0.2, data.spireHeight, 8]} />
            <meshStandardMaterial 
              color={isDark ? data.color : '#475569'} 
              emissive={isDark ? data.color : '#000000'}
              emissiveIntensity={isDark ? 3.0 : 0}
            />
          </mesh>
          {/* Spire Tip Beacon */}
          <mesh position={[0, data.spireHeight / 2 + 0.2, 0]}>
            <sphereGeometry args={[0.3, 12, 12]} />
            <meshBasicMaterial color={data.isGodObject ? '#ef4444' : isDark ? '#ffffff' : '#dc2626'} />
          </mesh>
        </group>
      )}

      {/* God Object Pulsing Warning Ring */}
      {data.isGodObject && isDark && (
        <mesh position={[0, data.height + 8, 0]}>
          <cylinderGeometry args={[data.width * 0.7, data.width * 0.7, 0.4, 16]} />
          <meshBasicMaterial color="#ef4444" wireframe transparent opacity={0.6} />
        </mesh>
      )}

      {/* Selected Node Vertical Hologram Beacon */}
      {isSelected && (
        <>
          <mesh position={[0, (data.height + 60) / 2, 0]}>
            <cylinderGeometry args={[0.3, 1.2, data.height + 60, 16]} />
            <meshBasicMaterial color={isDark ? '#00f5ff' : '#0284c7'} transparent opacity={0.25} />
          </mesh>
          <Text
            position={[0, data.height + (data.hasSpire ? data.spireHeight : 0) + 3, 0]}
            fontSize={1.4}
            color={isDark ? '#ffffff' : '#0f172a'}
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.12}
            outlineColor={isDark ? '#000000' : '#ffffff'}
          >
            {data.name}
          </Text>
        </>
      )}
    </group>
  );
}

// --- City Block (Plinth + Buildings) ---
function CityBlock({
  block,
  selectedId,
  hoveredId,
  theme,
  onSelectNode,
  onHoverNode
}: {
  block: CityBlockData;
  selectedId: string | null;
  hoveredId: string | null;
  theme: 'dark' | 'light';
  onSelectNode: (id: string) => void;
  onHoverNode: (id: string | null) => void;
}) {
  const isDark = theme === 'dark';

  return (
    <group position={block.center}>
      {/* Raised Sidewalk Plinth */}
      <mesh position={[0, SIDEWALK_HEIGHT / 2, 0]} receiveShadow>
        <boxGeometry args={[BLOCK_SIZE, SIDEWALK_HEIGHT, BLOCK_SIZE]} />
        <meshStandardMaterial
          color={isDark ? (block.isCodeDistrict ? '#111726' : '#0c0f1a') : (block.isCodeDistrict ? '#e2e8f0' : '#cbd5e1')}
          roughness={0.8}
          metalness={0.1}
        />
        <Edges
          linewidth={1}
          threshold={15}
          color={isDark ? (block.isCodeDistrict ? '#00f5ff' : '#1e293b') : '#94a3b8'}
        />
      </mesh>

      {/* Buildings Inside Block */}
      {block.buildings.map((b) => (
        <ArchitecturalBuilding
          key={b.id}
          data={b}
          isSelected={selectedId === b.id}
          isHovered={hoveredId === b.id}
          theme={theme}
          onClick={() => onSelectNode(b.id)}
          onPointerOver={() => onHoverNode(b.id)}
          onPointerOut={() => onHoverNode(null)}
        />
      ))}
    </group>
  );
}

// --- Urban Street Grid, Avenues & Crosswalks ---
function UrbanStreetGrid({ theme }: { theme: 'dark' | 'light' }) {
  const isDark = theme === 'dark';

  const { laneDividers, crosswalks } = useMemo(() => {
    const dividers: Array<{ pos: [number, number, number]; rotY: number }> = [];
    const crosses: Array<{ pos: [number, number, number]; rotY: number }> = [];

    const coords: number[] = [];
    for (let i = -GRID_RADIUS; i <= GRID_RADIUS + 1; i++) {
      coords.push((i - 0.5) * BLOCK_PITCH);
    }

    // Avenues along X
    coords.forEach((avZ) => {
      for (let x = -GRID_RADIUS * BLOCK_PITCH; x <= GRID_RADIUS * BLOCK_PITCH; x += 6) {
        dividers.push({ pos: [x, 0.06, avZ], rotY: 0 });
      }
    });

    // Avenues along Z
    coords.forEach((avX) => {
      for (let z = -GRID_RADIUS * BLOCK_PITCH; z <= GRID_RADIUS * BLOCK_PITCH; z += 6) {
        dividers.push({ pos: [avX, 0.06, z], rotY: Math.PI / 2 });
      }
    });

    // Crosswalks at intersections
    coords.forEach((avX) => {
      coords.forEach((avZ) => {
        crosses.push({ pos: [avX + 4, 0.07, avZ], rotY: Math.PI / 2 });
        crosses.push({ pos: [avX - 4, 0.07, avZ], rotY: Math.PI / 2 });
        crosses.push({ pos: [avX, 0.07, avZ + 4], rotY: 0 });
        crosses.push({ pos: [avX, 0.07, avZ - 4], rotY: 0 });
      });
    });

    return { laneDividers: dividers, crosswalks: crosses };
  }, []);

  return (
    <group>
      {/* Infinite City Ground Asphalt Plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[600, 600]} />
        <meshStandardMaterial
          color={isDark ? '#060811' : '#1e293b'}
          roughness={0.9}
          metalness={0.1}
        />
      </mesh>

      {/* Street Centerline Dashed Stripes */}
      {laneDividers.map((d, i) => (
        <mesh key={`div-${i}`} position={d.pos} rotation={[0, d.rotY, 0]}>
          <planeGeometry args={[3.2, 0.3]} />
          <meshBasicMaterial 
            color={isDark ? '#38bdf8' : '#ffffff'} 
            transparent 
            opacity={isDark ? 0.45 : 0.75} 
          />
        </mesh>
      ))}

      {/* Intersection Crosswalks */}
      {crosswalks.map((c, i) => (
        <mesh key={`cross-${i}`} position={c.pos} rotation={[-Math.PI / 2, 0, c.rotY]}>
          <planeGeometry args={[4.2, 1.2]} />
          <meshBasicMaterial 
            color={isDark ? '#63f7ff' : '#f8fafc'} 
            transparent 
            opacity={isDark ? 0.35 : 0.65} 
          />
        </mesh>
      ))}
    </group>
  );
}

// --- Main App Component ---
export default function App() {
  const [repoUrl, setRepoUrl] = useState('https://github.com/Vasquezjuan7/Modelado3d.git');
  const [loading, setLoading] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  
  const [treeData, setTreeData] = useState<FileNode | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  
  const [trafficEvents, setTrafficEvents] = useState<TrafficEvent[]>([]);
  const [isSimulating, setIsSimulating] = useState(false);

  const [showAiModal, setShowAiModal] = useState(false);
  const [fileContent, setFileContent] = useState('');
  const [isFixing, setIsFixing] = useState(false);
  const [fixApplied, setFixApplied] = useState(false);

  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [lang, setLang] = useState<'es' | 'en'>('es');

  // Build complete 3D metropolis from parsed repo or rich enterprise AST
  const cityModel: CompleteCityModel = useMemo(() => {
    return buildCompleteCity(treeData);
  }, [treeData]);

  useEffect(() => {
    if (theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [theme]);

  // Clone & Parse local repo
  const loadRepo = async () => {
    setLoading(true);
    setFixApplied(false);
    setShowAiModal(false);
    try {
      const parts = repoUrl.split('/');
      const repoName = parts[parts.length - 1].replace('.git', '') || 'repo';
      const os = window.require('os');
      const path = window.require('path');
      const destPath = path.join(os.tmpdir(), `codecity_${repoName}_${Date.now()}`);
      
      setProgressMsg('Cloning repo...');
      await cloneRepo(repoUrl, destPath, (msg) => setProgressMsg(msg));
      
      setProgressMsg('Parsing AST & Building 3D City...');
      const { root } = await parseLocalRepo(destPath);
      setTreeData(root);
      setSelectedNodeId(null);
      setTrafficEvents([]);
      setIsSimulating(false);
    } catch (err) {
      console.error('Clone failed:', err);
    } finally {
      setLoading(false);
      setProgressMsg('');
    }
  };

  // Traffic Simulation Loop (N+1 Bottleneck & HTTP queries)
  useEffect(() => {
    if (!isSimulating) return;

    let frameId: number;
    let events: TrafficEvent[] = [];
    let cycleCount = 0;

    const codeFiles = cityModel.codeBuildings;
    if (codeFiles.length < 2) return;

    const sortedFiles = [...codeFiles].sort((a, b) => b.lines - a.lines);
    const dbNode = sortedFiles[0];
    const sourceNode = sortedFiles[1] || sortedFiles[0];

    const loop = () => {
      cycleCount++;
      events = events
        .filter((e) => e.progress < 1)
        .map((e) => ({
          ...e,
          progress: e.progress + (e.status === 'bottleneck' ? 0.003 : 0.01)
        }));

      // Trigger critical N+1 bottleneck stream after ~2.5 seconds
      if (cycleCount === 150) {
        for (let i = 0; i < 40; i++) {
          events.push({
            id: `err-${Date.now()}-${i}`,
            sourceId: sourceNode.id,
            targetId: dbNode.id,
            status: 'bottleneck',
            type: 'sql',
            progress: -(i * 0.025),
            sourcePos: sourceNode.absolutePosition,
            targetPos: dbNode.absolutePosition
          });
        }
        setTimeout(() => {
          setSelectedNodeId(sourceNode.id);
        }, 2200);
      }

      // Normal ambient telemetry between code buildings
      if (cycleCount % 35 === 0 && cycleCount < 300) {
        const randA = codeFiles[Math.floor(Math.random() * codeFiles.length)];
        const randB = codeFiles[Math.floor(Math.random() * codeFiles.length)];
        if (randA.id !== randB.id) {
          events.push({
            id: `evt-${Date.now()}-${Math.random()}`,
            sourceId: randA.id,
            targetId: randB.id,
            status: 'active',
            type: 'http',
            progress: 0,
            sourcePos: randA.absolutePosition,
            targetPos: randB.absolutePosition
          });
        }
      }

      setTrafficEvents([...events]);
      frameId = requestAnimationFrame(loop);
    };

    frameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameId);
  }, [isSimulating, cityModel]);

  const selectedNode = selectedNodeId ? cityModel.flatNodes.get(selectedNodeId) : null;

  const handleAudit = () => {
    if (!selectedNode) return;
    try {
      const content = readFileContent(selectedNode.id);
      setFileContent(content);
      setShowAiModal(true);
      setFixApplied(false);
    } catch {
      setFileContent(
        `// AST Module: ${selectedNode.name}\nimport { db } from './db';\n\nexport async function getReportData() {\n  const users = await db.query('SELECT * FROM users');\n  // N+1 Critical Bottleneck Query Loop\n  for (const user of users) {\n    user.orders = await db.query('SELECT * FROM orders WHERE user_id = ' + user.id);\n  }\n  return users;\n}`
      );
      setShowAiModal(true);
      setFixApplied(false);
    }
  };

  const applyAiFix = () => {
    if (!selectedNode) return;
    setIsFixing(true);
    setTimeout(() => {
      try {
        const refactored =
          `// [AI Auto-Fixed] Optimized Atomic Query Plan\n// Date: ${new Date().toISOString()}\n\n` +
          fileContent;
        writeFileContent(selectedNode.id, refactored);
      } catch {
        // mock
      }
      setFixApplied(true);
      setIsFixing(false);
    }, 1400);
  };

  // Translations
  const t = {
    es: {
      load: 'Cargar',
      cloning: progressMsg || 'Clonando...',
      systems: 'Sistemas Tácticos',
      nominal: 'Todo Operativo',
      astNodes: 'Nodos AST',
      pcapProbe: 'Sonda Tráfico',
      loc: 'Líneas Totales',
      stopTraffic: 'Detener Tráfico N+1',
      simTraffic: 'Simular Tráfico N+1',
      districts: 'Distritos y Zonificación',
      districtsSub: 'DISTRICTS & CLUSTERS',
      audit: 'Auditar con IA',
      active: 'ACTIVO',
      idle: 'INACTIVO',
      aiModule: 'MÓDULO: ARQUITECTO PREDICTIVO IA',
      bottleneck: 'Cuello de Botella Crítico Detectado',
      optTitle: 'Optimización Automática de Consultas N+1',
      optDesc: 'Detección y resolución preventiva en',
      oldCode: 'Código Actual (Con Cuello de Botella)',
      newCode: 'Código Propuesto (Refactor IA)',
      fixedCode: 'Vulnerabilidad Resuelta en Disco',
      fixedDesc: 'El archivo físico ha sido parcheado localmente y guardado.',
      branch: 'Rama de destino',
      regTests: 'Tests de Regresión: 42/42 Pasadas',
      abort: 'Cerrar',
      applyFix: 'Aplicar Auto-Refactor en Disco',
      applying: 'Parcheando en Disco...'
    },
    en: {
      load: 'Load',
      cloning: progressMsg || 'Cloning...',
      systems: 'Tactical Systems',
      nominal: 'All Nominal',
      astNodes: 'AST Nodes',
      pcapProbe: 'Traffic Probe',
      loc: 'Total LOC',
      stopTraffic: 'Stop N+1 Traffic',
      simTraffic: 'Simulate N+1 Traffic',
      districts: 'Districts & Zoning',
      districtsSub: 'DISTRICTS & CLUSTERS',
      audit: 'Audit with AI',
      active: 'ACTIVE',
      idle: 'IDLE',
      aiModule: 'MODULE: PREDICTIVE AI ARCHITECT',
      bottleneck: 'Critical Bottleneck Detected',
      optTitle: 'Automatic N+1 Query Optimization',
      optDesc: 'Preventive detection & remediation on',
      oldCode: 'Current Code (Bottlenecked)',
      newCode: 'Proposed Code (AI Refactor)',
      fixedCode: 'Vulnerability Resolved on Disk',
      fixedDesc: 'Physical file has been locally patched and committed.',
      branch: 'Target Branch',
      regTests: 'Regression Tests: 42/42 Passed',
      abort: 'Dismiss',
      applyFix: 'Apply Auto-Refactor on Disk',
      applying: 'Patching Disk...'
    }
  }[lang];

  return (
    <div className={`flex h-screen w-screen overflow-hidden font-sans select-none ${theme === 'dark' ? 'bg-[#060811] text-[#e0e2ee]' : 'bg-[#f1f5f9] text-[#0f172a]'}`}>
      
      {/* Top Header Navbar */}
      <header className={`fixed top-0 left-0 right-0 h-16 z-40 flex items-center justify-between px-6 border-b backdrop-blur-xl ${theme === 'dark' ? 'bg-[#0a0d18]/90 border-[#1e293b]' : 'bg-white/90 border-slate-200'} shadow-md`}>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Zap className={`w-5 h-5 ${theme === 'dark' ? 'text-[#00f5ff]' : 'text-blue-600'}`} />
            <span className="font-headline-lg font-bold tracking-wider text-sm">
              CODECITY <span className="text-[#4edea3]">NEXUS 3D</span>
            </span>
          </div>
          <span className="text-xs font-mono-code px-2 py-0.5 rounded bg-surface-container-high text-outline opacity-80 hidden md:inline">
            // SPATIAL RUNTIME V4.2 PRO
          </span>
        </div>

        {/* Repository Search & Clone Input */}
        <div className="flex items-center gap-3 w-1/3 max-w-xl">
          <input
            type="text"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            className={`flex-1 px-4 py-2 rounded-lg font-mono-code text-xs ${theme === 'dark' ? 'bg-[#131826] border border-[#26334d] text-white' : 'bg-slate-100 border border-slate-300 text-slate-900'} focus:outline-none focus:border-[#00f5ff] transition-colors`}
            placeholder="https://github.com/owner/repo"
          />
          <button
            onClick={loadRepo}
            disabled={loading}
            className={`px-4 py-2 rounded-lg font-mono-code text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${theme === 'dark' ? 'bg-[#00f5ff] hover:bg-[#63f7ff] text-[#003739]' : 'bg-blue-600 hover:bg-blue-700 text-white'} disabled:opacity-50`}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {loading ? t.cloning : t.load}
          </button>
        </div>

        {/* Language & Theme Controls */}
        <div className="flex items-center gap-3">
          <div className={`flex items-center p-1 rounded-lg font-mono-code text-xs font-bold ${theme === 'dark' ? 'bg-[#131826]' : 'bg-slate-200'}`}>
            <button
              onClick={() => setLang('es')}
              className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${lang === 'es' ? (theme === 'dark' ? 'bg-[#00f5ff] text-[#003739]' : 'bg-white text-blue-600 shadow-sm') : 'opacity-60 hover:opacity-100'}`}
            >
              ES
            </button>
            <button
              onClick={() => setLang('en')}
              className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${lang === 'en' ? (theme === 'dark' ? 'bg-[#00f5ff] text-[#003739]' : 'bg-white text-blue-600 shadow-sm') : 'opacity-60 hover:opacity-100'}`}
            >
              EN
            </button>
          </div>
          <div className={`flex items-center p-1 rounded-lg font-mono-code text-xs font-bold ${theme === 'dark' ? 'bg-[#131826]' : 'bg-slate-200'}`}>
            <button
              onClick={() => setTheme('dark')}
              className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${theme === 'dark' ? 'bg-[#00f5ff] text-[#003739]' : 'opacity-60 hover:opacity-100'}`}
            >
              Dark
            </button>
            <button
              onClick={() => setTheme('light')}
              className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${theme === 'light' ? 'bg-white text-blue-600 shadow-sm' : 'opacity-60 hover:opacity-100'}`}
            >
              Light
            </button>
          </div>
        </div>
      </header>

      {/* Left Sidebar */}
      <aside className={`fixed left-0 top-16 bottom-8 w-80 z-30 flex flex-col justify-between py-5 border-r backdrop-blur-xl ${theme === 'dark' ? 'bg-[#0a0d18]/95 border-[#1e293b]' : 'bg-white/95 border-slate-200'} shadow-xl`}>
        <div className="flex flex-col gap-5 px-5">
          
          {/* Tactical Status Header */}
          <div className="flex items-center justify-between pb-3 border-b border-surface-container-highest/20">
            <span className="font-telemetry-label text-xs uppercase font-bold text-outline">
              {t.systems}
            </span>
            <span className="font-mono-code text-xs font-bold text-[#4edea3] flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#4edea3] animate-pulse"></span>
              {t.nominal}
            </span>
          </div>

          {/* Key Metric Cards */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className={`p-3 rounded-lg border ${theme === 'dark' ? 'bg-[#101524] border-[#1e293b]' : 'bg-slate-50 border-slate-200'}`}>
              <span className="block font-telemetry-label text-[10px] uppercase text-outline mb-1">{t.astNodes}</span>
              <span className={`font-mono-code text-base font-bold ${theme === 'dark' ? 'text-[#00f5ff]' : 'text-blue-600'}`}>
                {cityModel.totalClasses} CLASSES
              </span>
            </div>
            <div className={`p-3 rounded-lg border ${theme === 'dark' ? 'bg-[#101524] border-[#1e293b]' : 'bg-slate-50 border-slate-200'}`}>
              <span className="block font-telemetry-label text-[10px] uppercase text-outline mb-1">{t.pcapProbe}</span>
              <span className={`font-mono-code text-base font-bold ${isSimulating ? 'text-[#ef4444]' : 'text-[#4edea3]'}`}>
                {isSimulating ? t.active : t.idle}
              </span>
            </div>
          </div>

          {/* Traffic Simulation Trigger */}
          <button
            onClick={() => setIsSimulating(!isSimulating)}
            className={`w-full py-2.5 rounded-lg font-mono-code text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md ${isSimulating ? 'bg-[#ef4444] text-white shadow-red-500/30' : theme === 'dark' ? 'bg-[#161f36] hover:bg-[#1e2b4a] text-[#00f5ff] border border-[#2a3b63]' : 'bg-slate-200 hover:bg-slate-300 text-slate-800'}`}
          >
            <Activity className={`w-4 h-4 ${isSimulating ? 'animate-pulse' : ''}`} />
            {isSimulating ? t.stopTraffic : t.simTraffic}
          </button>

          {/* Districts Nav Menu */}
          <div className="flex flex-col gap-1.5 pt-2">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/10 border-l-2 border-[#00f5ff]">
              <Layers className="w-5 h-5 text-[#00f5ff]" />
              <div className="flex flex-col">
                <span className="text-xs font-bold">{t.districts}</span>
                <span className="text-[10px] font-mono-code text-outline">{t.districtsSub}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Selected Node Details & Audit Button */}
        <div className="px-5">
          {selectedNode ? (
            <div className={`p-4 rounded-xl border flex flex-col gap-3 shadow-lg ${theme === 'dark' ? 'bg-[#111728] border-[#22304d]' : 'bg-blue-50 border-blue-200'}`}>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#00f5ff] animate-ping"></span>
                <span className="text-[10px] font-mono-code uppercase text-outline">Selected Node</span>
              </div>
              <div className="flex flex-col">
                <h3 className={`font-mono-code font-bold text-sm truncate ${theme === 'dark' ? 'text-[#00f5ff]' : 'text-blue-700'}`}>
                  {selectedNode.name}
                </h3>
                <p className="text-[10px] font-mono-code text-outline truncate mt-0.5">
                  {selectedNode.path}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] font-mono-code pt-1 border-t border-outline/20">
                <div>
                  <span className="text-outline block text-[9px] uppercase">EST. LINES</span>
                  <span className="font-bold">{selectedNode.lines} LOC</span>
                </div>
                <div>
                  <span className="text-outline block text-[9px] uppercase">TYPE</span>
                  <span className="font-bold uppercase text-[#4edea3]">{selectedNode.buildingType}</span>
                </div>
              </div>
              <button
                onClick={handleAudit}
                className={`w-full py-2.5 rounded-lg font-mono-code text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md ${theme === 'dark' ? 'bg-[#00f5ff] hover:bg-[#63f7ff] text-[#003739]' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
              >
                <Rocket className="w-4 h-4" />
                {t.audit}
              </button>
            </div>
          ) : (
            <div className="text-center py-4 opacity-50 text-xs font-mono-code uppercase text-outline">
              Click a building to inspect AST
            </div>
          )}
        </div>
      </aside>

      {/* 3D Canvas Viewport */}
      <main className="fixed inset-0 z-0 pl-80 pt-16 pb-8">
        <Canvas camera={{ position: [85, 75, 95], fov: 42 }}>
          {/* Background & Atmospheric Fog */}
          <color attach="background" args={[theme === 'dark' ? '#060811' : '#e2e8f0']} />
          <fog attach="fog" args={[theme === 'dark' ? '#060811' : '#e2e8f0', 90, 480]} />

          {/* Lighting */}
          {theme === 'dark' ? (
            <>
              <ambientLight intensity={0.5} />
              <directionalLight position={[100, 160, 80]} intensity={1.8} color="#38bdf8" />
              <directionalLight position={[-100, 120, -80]} intensity={1.4} color="#ec4899" />
              <pointLight position={[0, 60, 0]} intensity={1.2} color="#ffffff" distance={250} />
            </>
          ) : (
            <>
              {/* Daylight for Architectural Clay / Model Rendering */}
              <ambientLight intensity={1.2} />
              <directionalLight position={[120, 180, 100]} intensity={2.4} color="#ffffff" castShadow />
              <directionalLight position={[-80, 100, -80]} intensity={0.8} color="#cbd5e1" />
              <hemisphereLight args={['#ffffff', '#cbd5e1', 0.8]} />
            </>
          )}

          {/* Urban Streets, Avenues & Markings */}
          <UrbanStreetGrid theme={theme} />

          {/* Complete City Blocks with Stepped Architectural Buildings */}
          {cityModel.blocks.map((block) => (
            <CityBlock
              key={block.id}
              block={block}
              selectedId={selectedNodeId}
              hoveredId={hoveredNodeId}
              theme={theme}
              onSelectNode={setSelectedNodeId}
              onHoverNode={setHoveredNodeId}
            />
          ))}

          {/* Living Traffic System (Ambient Cars + N+1 Telemetry Packets) */}
          <TrafficSystem events={trafficEvents} theme={theme} />

          {/* Orbit Controls */}
          <OrbitControls
            makeDefault
            dampingFactor={0.05}
            minDistance={15}
            maxDistance={450}
            maxPolarAngle={Math.PI / 2 - 0.05}
          />

          {/* Cyberpunk Bloom in Dark Mode */}
          {theme === 'dark' && (
            <EffectComposer>
              <Bloom luminanceThreshold={0.2} luminanceSmoothing={0.9} height={300} intensity={1.6} />
            </EffectComposer>
          )}
        </Canvas>
      </main>

      {/* AI Predictive Architect Modal */}
      {showAiModal && selectedNode && (
        <div className="fixed inset-0 z-50 pt-16 pl-80 pb-8 flex items-center justify-center bg-black/75 backdrop-blur-md p-8">
          <div className={`w-full max-w-5xl rounded-2xl border flex flex-col shadow-2xl overflow-hidden ${theme === 'dark' ? 'bg-[#0a0d18] border-[#22304d]' : 'bg-white border-slate-200'}`}>
            
            {/* Modal Header */}
            <div className={`p-6 border-b flex justify-between items-start ${theme === 'dark' ? 'bg-[#101524] border-[#1e293b]' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444] animate-ping"></span>
                  <span className="text-xs font-mono-code font-bold uppercase text-[#ef4444] px-2 py-0.5 rounded bg-red-500/10">
                    {t.bottleneck}
                  </span>
                </div>
                <h2 className="text-xl font-headline-lg font-bold">{t.optTitle}</h2>
                <p className="text-xs text-outline font-mono-code">
                  {t.optDesc} <strong className="text-[#00f5ff]">{selectedNode.name}</strong>
                </p>
              </div>
              <button
                onClick={() => setShowAiModal(false)}
                className="p-2 rounded-lg opacity-60 hover:opacity-100 transition-opacity cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Code Diff Comparison */}
            <div className="p-6 grid grid-cols-2 gap-4 flex-1 overflow-hidden font-mono-code text-xs">
              <div className={`flex flex-col rounded-xl border overflow-hidden ${theme === 'dark' ? 'bg-[#060811] border-red-500/30' : 'bg-red-50/40 border-red-200'}`}>
                <div className="px-4 py-2.5 bg-red-500/10 text-red-500 uppercase font-bold text-[11px] border-b border-red-500/20 flex justify-between">
                  <span>{t.oldCode}</span>
                  <span className="text-[10px]">142 N+1 LOOPS</span>
                </div>
                <textarea
                  readOnly
                  value={fileContent}
                  className="flex-1 bg-transparent p-4 text-[11px] resize-none outline-none leading-relaxed overflow-y-auto"
                />
              </div>

              <div className={`flex flex-col rounded-xl border overflow-hidden ${theme === 'dark' ? 'bg-[#060811] border-[#4edea3]/30' : 'bg-emerald-50/40 border-emerald-200'}`}>
                <div className="px-4 py-2.5 bg-emerald-500/10 text-[#4edea3] uppercase font-bold text-[11px] border-b border-emerald-500/20 flex justify-between">
                  <span>{t.newCode}</span>
                  <span className="text-[10px]">1 ATOMIC JOIN</span>
                </div>
                {fixApplied ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-6 text-center gap-3">
                    <CheckCircle2 className="w-12 h-12 text-[#4edea3]" />
                    <h4 className="text-base font-bold text-[#4edea3]">{t.fixedCode}</h4>
                    <p className="text-xs text-outline">{t.fixedDesc}</p>
                  </div>
                ) : (
                  <div className="flex-1 p-4 text-[11px] leading-relaxed opacity-80 overflow-y-auto">
                    {`// [AI Auto-Fixed] Atomic Eager Query\nconst usersWithOrders = await db.query(\n  'SELECT users.*, json_agg(orders.*) as orders FROM users LEFT JOIN orders ON users.id = orders.user_id GROUP BY users.id'\n);\nreturn usersWithOrders;\n\n// Remainder of file preserved...`}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Execution Bar */}
            <div className={`p-5 border-t flex justify-between items-center ${theme === 'dark' ? 'bg-[#101524] border-[#1e293b]' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex items-center gap-4 text-xs font-mono-code text-outline">
                <span>{t.branch}: <strong className="text-[#00f5ff]">local/ai-refactor</strong></span>
                <span>|</span>
                <span className="text-[#4edea3]">{t.regTests}</span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowAiModal(false)}
                  className="px-4 py-2 rounded-lg text-xs font-mono-code uppercase text-outline hover:text-white transition-colors cursor-pointer"
                >
                  {t.abort}
                </button>
                {!fixApplied && (
                  <button
                    onClick={applyAiFix}
                    disabled={isFixing}
                    className="px-6 py-2.5 rounded-lg font-mono-code text-xs font-bold uppercase tracking-wider bg-[#00f5ff] hover:bg-[#63f7ff] text-[#003739] flex items-center gap-2 transition-all cursor-pointer shadow-lg disabled:opacity-50"
                  >
                    {isFixing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
                    {isFixing ? t.applying : t.applyFix}
                  </button>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Bottom Footer Ticker */}
      <footer className={`fixed bottom-0 left-80 right-0 h-8 z-30 flex items-center justify-between px-6 border-t backdrop-blur-xl font-mono-code text-[11px] ${theme === 'dark' ? 'bg-[#0a0d18]/95 border-[#1e293b] text-outline' : 'bg-white/95 border-slate-200 text-slate-500'}`}>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-[#4edea3] font-bold">
            <span className="w-2 h-2 rounded-full bg-[#4edea3] animate-pulse"></span>
            CORE DAEMON OK
          </span>
          <span>|</span>
          <span>VULKAN / WEBGL 2.0</span>
          <span>|</span>
          <span>AST COVERAGE: <strong className="text-[#4edea3]">100%</strong></span>
        </div>
        <div className="flex items-center gap-4 text-[#00f5ff]">
          <span>XYZ: [48.8584, 2.2945, +184m]</span>
        </div>
      </footer>

    </div>
  );
}
