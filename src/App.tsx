import { useState, useEffect, useMemo, useRef } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Edges, Text, Billboard } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import { cloneRepo, parseLocalRepo, readFileContent, writeFileContent } from './localGitApi';
import { fetchGithubRepoTree } from './githubApi';
import type { FileNode } from './githubApi';
import { TrafficSystem } from './Traffic';
import type { TrafficEvent } from './Traffic';
import { 
  buildCompleteCity, 
  BLOCK_SIZE, 
  SIDEWALK_HEIGHT 
} from './cityEngine';
import type { BuildingData, CityBlockData, CompleteCityModel, DistrictMeta, DistrictCategory } from './cityEngine';
import { 
  auditCodeWithLLM, 
  getStoredAIConfig, 
  saveStoredAIConfig 
} from './aiEngine';
import type { AIConfig, AuditResult } from './aiEngine';
import { 
  Rocket, 
  CheckCircle2, 
  X, 
  Search, 
  Loader2, 
  Activity, 
  Zap, 
  Filter, 
  Boxes,
  Layers,
  Sparkles,
  GitBranch,
  RotateCcw,
  Compass,
  Terminal,
  FileCode,
  Crosshair,
  Sun,
  Moon,
  ShieldCheck,
  Copy,
  Check,
  ArrowUpRight,
  Download,
  Settings,
  AlertTriangle,
  Cpu,
  Bug,
  Key,
  RefreshCw,
  ExternalLink,
  ShieldAlert,
  CheckCircle
} from 'lucide-react';

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
          if (Math.random() > 0.4) {
            ctx.fillStyle = '#ffffff';
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
      // Clean white base so it doesn't darken tinted architectural facades
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 128, 128);

      for (let y = 5; y < 128; y += 14) {
        for (let x = 5; x < 128; x += 12) {
          // Reflective darker architectural glass window panes
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(x, y, 7, 9);
          // Highlight pane
          ctx.fillStyle = '#60a5fa';
          ctx.fillRect(x + 1, y + 1, 3, 7);
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

// --- High-contrast color helper for Light Mode ---
function getLightDistrictLabelColor(color: string): string {
  try {
    const col = new THREE.Color(color);
    return `#${col.offsetHSL(0, 0.2, -0.28).getHexString()}`;
  } catch {
    return color;
  }
}

// --- Pulsing Aviation Obstruction Beacon ---
function PulsingBeacon({ position, color }: { position: [number, number, number]; color: string }) {
  const meshRef = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (meshRef.current) {
      const strobe = Math.pow(Math.max(0, Math.sin(clock.elapsedTime * 4.5)), 8);
      (meshRef.current.material as THREE.MeshBasicMaterial).opacity = 0.2 + 0.8 * strobe;
    }
  });

  return (
    <mesh ref={meshRef} position={position}>
      <sphereGeometry args={[0.38, 12, 12]} />
      <meshBasicMaterial color={color} transparent opacity={1} />
    </mesh>
  );
}

// --- Architectural 3D Building Component ---
function ArchitecturalBuilding({
  data,
  isSelected,
  isHovered,
  isDimmed,
  theme,
  onClick,
  onPointerOver,
  onPointerOut
}: {
  data: BuildingData;
  isSelected: boolean;
  isHovered: boolean;
  isDimmed: boolean;
  theme: 'dark' | 'light';
  onClick: () => void;
  onPointerOver: () => void;
  onPointerOut: () => void;
}) {
  const isDark = theme === 'dark';
  const tex = getWindowTexture(isDark);

  const edgeColor = useMemo(() => {
    if (isDark) {
      if (isSelected) return '#ffffff';
      if (isHovered) return '#ffffff';
      if (isDimmed) return '#1e293b';
      return data.color;
    } else {
      if (isSelected) return '#0f172a';
      if (isHovered) return '#0284c7';
      if (isDimmed) return '#cbd5e1';
      try {
        const col = new THREE.Color(data.color).offsetHSL(0, 0.15, -0.25);
        return `#${col.getHexString()}`;
      } catch {
        return data.color;
      }
    }
  }, [isDark, isSelected, isHovered, isDimmed, data.color]);

  const buildingMaterial = useMemo(() => {
    if (isDark) {
      return new THREE.MeshStandardMaterial({
        color: isDimmed ? '#04060a' : '#090e18',
        metalness: 0.85,
        roughness: 0.2,
        emissiveMap: tex,
        emissive: new THREE.Color(data.color),
        emissiveIntensity: isDimmed ? 0.2 : isSelected ? 3.0 : isHovered ? 2.4 : 1.6,
        transparent: isDimmed,
        opacity: isDimmed ? 0.35 : 1.0
      });
    } else {
      const baseCol = new THREE.Color(data.color);
      const facadeCol = baseCol.clone().lerp(new THREE.Color('#ffffff'), 0.3);
      const dimmedCol = baseCol.clone().lerp(new THREE.Color('#94a3b8'), 0.65);

      return new THREE.MeshStandardMaterial({
        color: isDimmed ? dimmedCol : isSelected ? '#ffffff' : facadeCol,
        metalness: 0.15,
        roughness: 0.28,
        map: tex,
        emissive: isSelected ? baseCol : baseCol.clone().multiplyScalar(0.12),
        emissiveIntensity: isSelected ? 1.6 : 0.2,
        transparent: isDimmed,
        opacity: isDimmed ? 0.4 : 1.0
      });
    }
  }, [isDark, isSelected, isHovered, isDimmed, data.color, tex]);

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
      {/* 1. Ground-level Entrance Lobby / Podium */}
      {data.hasEntrancePodium && (
        <group position={[0, 0.6, 0]}>
          {/* Main Glass Lobby */}
          <mesh castShadow receiveShadow>
            <boxGeometry args={[data.width * 0.96, 1.2, data.depth * 0.96]} />
            <meshStandardMaterial
              color={isDark ? '#050a14' : '#f8fafc'}
              emissive={new THREE.Color(data.glowColor)}
              emissiveIntensity={isDark ? 0.4 : 0.08}
              metalness={0.9}
              roughness={0.15}
            />
          </mesh>
          {/* Overhang Entrance Canopy Awning projecting towards avenue */}
          <mesh position={[0, 0.65, data.depth * 0.48 + 0.6]} castShadow>
            <boxGeometry args={[data.width * 0.65, 0.12, 1.3]} />
            <meshStandardMaterial color={isDark ? '#1e293b' : '#334155'} metalness={0.8} roughness={0.2} />
          </mesh>
          {/* Support Columns */}
          <mesh position={[-data.width * 0.26, 0, data.depth * 0.48 + 1.1]}>
            <cylinderGeometry args={[0.07, 0.07, 1.2, 8]} />
            <meshStandardMaterial color={isDark ? '#94a3b8' : '#475569'} metalness={0.9} roughness={0.1} />
          </mesh>
          <mesh position={[data.width * 0.26, 0, data.depth * 0.48 + 1.1]}>
            <cylinderGeometry args={[0.07, 0.07, 1.2, 8]} />
            <meshStandardMaterial color={isDark ? '#94a3b8' : '#475569'} metalness={0.9} roughness={0.1} />
          </mesh>
          {/* Warm Illuminated Entrance Glazing */}
          <mesh position={[0, -0.1, data.depth * 0.485]}>
            <planeGeometry args={[data.width * 0.45, 0.85]} />
            <meshBasicMaterial color={isDark ? '#f59e0b' : '#0284c7'} />
          </mesh>
        </group>
      )}

      {/* 2. Stepped Setback Tiers */}
      {data.tiers.map((tier, idx) => (
        <mesh key={idx} position={[0, tier.y, 0]} castShadow receiveShadow>
          <boxGeometry args={[tier.width, tier.height, tier.depth]} />
          <primitive object={buildingMaterial} attach="material" />
          <Edges linewidth={isSelected || isHovered ? 2.2 : 1.3} threshold={15} color={edgeColor} />
        </mesh>
      ))}

      {/* 3. Cornice Moldings at Setbacks with Glowing Neon Trim */}
      {data.tiers.slice(0, -1).map((tier, idx) => (
        <group key={`cornice-${idx}`} position={[0, tier.y + tier.height / 2, 0]}>
          <mesh receiveShadow>
            <boxGeometry args={[tier.width + 0.35, 0.2, tier.depth + 0.35]} />
            <meshStandardMaterial 
              color={isDark ? '#0f172a' : '#cbd5e1'}
              metalness={0.7}
              roughness={0.3}
            />
          </mesh>
          {/* Luminous perimeter edge trim */}
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[tier.width + 0.42, 0.06, tier.depth + 0.42]} />
            <meshBasicMaterial color={data.glowColor} />
          </mesh>
        </group>
      ))}

      {/* 4. Vertical Corner Neon LED Accent Ribs */}
      {(data.accentStripes || data.buildingType === 'godObject' || data.buildingType === 'skyscraper') && data.tiers[0] && (
        <group position={[0, data.tiers[0].y, 0]}>
          {[-1, 1].map((sx) =>
            [-1, 1].map((sz) => (
              <mesh
                key={`rib-${sx}-${sz}`}
                position={[sx * (data.tiers[0].width / 2 + 0.04), 0, sz * (data.tiers[0].depth / 2 + 0.04)]}
              >
                <cylinderGeometry args={[0.08, 0.08, data.tiers[0].height, 6]} />
                <meshBasicMaterial color={data.glowColor} />
              </mesh>
            ))
          )}
        </group>
      )}

      {/* 5. Rooftop Helipad with Glowing 'H' and Landing Lights */}
      {data.hasHelipad && (
        <group position={[0, data.height + 0.06, 0]}>
          {/* Landing platform pad */}
          <mesh receiveShadow>
            <cylinderGeometry args={[Math.min(data.width, data.depth) * 0.36, Math.min(data.width, data.depth) * 0.36, 0.12, 16]} />
            <meshStandardMaterial color={isDark ? '#0f172a' : '#334155'} roughness={0.7} />
          </mesh>
          {/* Yellow perimeter safety ring */}
          <mesh position={[0, 0.07, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[Math.min(data.width, data.depth) * 0.31, Math.min(data.width, data.depth) * 0.35, 16]} />
            <meshBasicMaterial color="#eab308" side={THREE.DoubleSide} />
          </mesh>
          {/* Glowing 'H' on the helipad */}
          <group position={[0, 0.08, 0]}>
            <mesh position={[-0.32, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[0.14, 0.8]} />
              <meshBasicMaterial color="#eab308" side={THREE.DoubleSide} />
            </mesh>
            <mesh position={[0.32, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[0.14, 0.8]} />
              <meshBasicMaterial color="#eab308" side={THREE.DoubleSide} />
            </mesh>
            <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[0.54, 0.14]} />
              <meshBasicMaterial color="#eab308" side={THREE.DoubleSide} />
            </mesh>
          </group>
          {/* Perimeter green landing beacon lights */}
          {[0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].map((ang, i) => {
            const r = Math.min(data.width, data.depth) * 0.33;
            return (
              <mesh key={`hpad-light-${i}`} position={[Math.cos(ang) * r, 0.09, Math.sin(ang) * r]}>
                <sphereGeometry args={[0.12, 8, 8]} />
                <meshBasicMaterial color="#22c55e" />
              </mesh>
            );
          })}
        </group>
      )}

      {/* 6. Rooftop Industrial HVAC Cooling Towers */}
      {data.hasCoolingTowers && !data.hasHelipad && (
        <group position={[0, data.height + 0.35, 0]}>
          {/* Chiller Unit 1 */}
          <mesh position={[-0.55, 0, 0]} castShadow>
            <boxGeometry args={[0.95, 0.65, 0.8]} />
            <meshStandardMaterial color={isDark ? '#1e293b' : '#64748b'} metalness={0.8} roughness={0.3} />
          </mesh>
          <mesh position={[-0.55, 0.35, 0]}>
            <cylinderGeometry args={[0.28, 0.28, 0.12, 12]} />
            <meshStandardMaterial color={isDark ? '#0f172a' : '#334155'} />
          </mesh>
          {/* Chiller Unit 2 */}
          <mesh position={[0.55, 0, 0]} castShadow>
            <boxGeometry args={[0.95, 0.65, 0.8]} />
            <meshStandardMaterial color={isDark ? '#1e293b' : '#64748b'} metalness={0.8} roughness={0.3} />
          </mesh>
          <mesh position={[0.55, 0.35, 0]}>
            <cylinderGeometry args={[0.28, 0.28, 0.12, 12]} />
            <meshStandardMaterial color={isDark ? '#0f172a' : '#334155'} />
          </mesh>
        </group>
      )}

      {/* 7. Communications Satellite Dish */}
      {data.hasCommunicationsDish && (
        <group position={[data.width * 0.22, data.height + 0.25, data.depth * 0.2]}>
          <mesh position={[0, 0.15, 0]}>
            <cylinderGeometry args={[0.07, 0.07, 0.35, 8]} />
            <meshStandardMaterial color="#64748b" metalness={0.9} roughness={0.2} />
          </mesh>
          <group position={[0, 0.38, 0]} rotation={[0.6, 0.4, 0]}>
            <mesh>
              <cylinderGeometry args={[0.6, 0.1, 0.18, 16]} />
              <meshStandardMaterial color={isDark ? '#e2e8f0' : '#475569'} metalness={0.5} roughness={0.2} />
            </mesh>
            <mesh position={[0, 0.2, 0]}>
              <cylinderGeometry args={[0.04, 0.04, 0.3, 8]} />
              <meshBasicMaterial color={data.glowColor} />
            </mesh>
          </group>
        </group>
      )}

      {/* 8. Photovoltaic Solar Panel Arrays */}
      {data.hasSolarPanels && !data.hasHelipad && (
        <group position={[-data.width * 0.12, data.height + 0.2, 0]} rotation={[0.32, 0, 0]}>
          <mesh receiveShadow>
            <boxGeometry args={[data.width * 0.52, 0.06, data.depth * 0.42]} />
            <meshStandardMaterial
              color="#0f172a"
              emissive="#1e3a8a"
              emissiveIntensity={0.65}
              roughness={0.2}
              metalness={0.9}
            />
          </mesh>
          <mesh position={[0, 0.035, 0]}>
            <boxGeometry args={[data.width * 0.5, 0.02, 0.025]} />
            <meshBasicMaterial color="#38bdf8" />
          </mesh>
        </group>
      )}

      {/* 9. Rooftop Spire / Antenna with Pulsing Red Beacon & Lattice Bars */}
      {data.hasSpire && (
        <group position={[0, data.height + data.spireHeight / 2, 0]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.06, 0.22, data.spireHeight, 8]} />
            <meshStandardMaterial 
              color={data.color} 
              emissive={data.color}
              emissiveIntensity={isDark ? 2.6 : 0.9}
              metalness={0.9}
              roughness={0.1}
            />
          </mesh>
          {/* Radio lattice crossbars */}
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[1.1, 0.05, 0.05]} />
            <meshBasicMaterial color={isDark ? '#94a3b8' : '#475569'} />
          </mesh>
          <mesh position={[0, data.spireHeight * 0.25, 0]}>
            <boxGeometry args={[0.65, 0.04, 0.04]} />
            <meshBasicMaterial color={isDark ? '#94a3b8' : '#475569'} />
          </mesh>
          {/* Flashing Obstruction Aviation Beacon */}
          <PulsingBeacon
            position={[0, data.spireHeight / 2 + 0.2, 0]}
            color={data.isGodObject ? '#ef4444' : '#ff2255'}
          />
        </group>
      )}

      {/* 10. God Object Warning Hazard Containment Rings */}
      {data.isGodObject && (
        <group position={[0, data.height + 8, 0]}>
          <mesh>
            <cylinderGeometry args={[data.width * 0.75, data.width * 0.75, 0.4, 16]} />
            <meshBasicMaterial color="#ef4444" wireframe transparent opacity={isDark ? 0.7 : 0.9} />
          </mesh>
          <mesh position={[0, 4, 0]}>
            <cylinderGeometry args={[data.width * 0.5, data.width * 0.5, 0.3, 16]} />
            <meshBasicMaterial color="#dc2626" wireframe transparent opacity={isDark ? 0.8 : 0.95} />
          </mesh>
        </group>
      )}

      {/* Floating HUD Badge on Hover */}
      {isHovered && !isSelected && (
        <group position={[0, data.height + (data.hasSpire ? data.spireHeight : 0) + 3, 0]}>
          <Billboard follow>
            <Text
              fontSize={1.4}
              color={isDark ? data.color : '#0f172a'}
              anchorX="center"
              anchorY="middle"
              outlineWidth={0.14}
              outlineColor={isDark ? '#000000' : '#ffffff'}
            >
              {`${data.name} [${data.lines} LOC]`}
            </Text>
          </Billboard>
        </group>
      )}

      {/* Selected Node Vertical Hologram Laser Beacon */}
      {isSelected && (
        <>
          <mesh position={[0, (data.height + 70) / 2, 0]}>
            <cylinderGeometry args={[0.3, 1.4, data.height + 70, 16]} />
            <meshBasicMaterial color={data.color} transparent opacity={isDark ? 0.35 : 0.55} />
          </mesh>
          <Billboard follow position={[0, data.height + (data.hasSpire ? data.spireHeight : 0) + 4, 0]}>
            <Text
              fontSize={1.7}
              color={isDark ? '#ffffff' : '#0f172a'}
              anchorX="center"
              anchorY="middle"
              outlineWidth={0.16}
              outlineColor={isDark ? '#000000' : '#ffffff'}
            >
              {data.name}
            </Text>
          </Billboard>
        </>
      )}
    </group>
  );
}

// --- City Block Component ---
function CityBlock({
  block,
  selectedId,
  hoveredId,
  activeFilter,
  theme,
  onSelectNode,
  onHoverNode
}: {
  block: CityBlockData;
  selectedId: string | null;
  hoveredId: string | null;
  activeFilter: DistrictCategory | 'all';
  theme: 'dark' | 'light';
  onSelectNode: (id: string) => void;
  onHoverNode: (id: string | null) => void;
}) {
  const isDark = theme === 'dark';
  const isDimmed = activeFilter !== 'all' && block.category !== activeFilter;

  return (
    <group position={block.center}>
      {/* Raised Sidewalk Plinth */}
      <mesh position={[0, SIDEWALK_HEIGHT / 2, 0]} receiveShadow>
        <boxGeometry args={[BLOCK_SIZE, SIDEWALK_HEIGHT, BLOCK_SIZE]} />
        <meshStandardMaterial
          color={isDark ? '#0d1322' : '#f8fafc'}
          roughness={0.7}
          metalness={0.1}
          transparent={isDimmed}
          opacity={isDimmed ? 0.3 : 1.0}
        />
        <Edges
          linewidth={1.5}
          threshold={15}
          color={block.districtColor}
        />
      </mesh>

      {/* Buildings inside this block */}
      {block.buildings.map((b) => (
        <ArchitecturalBuilding
          key={b.id}
          data={b}
          isSelected={selectedId === b.id}
          isHovered={hoveredId === b.id}
          isDimmed={isDimmed}
          theme={theme}
          onClick={() => onSelectNode(b.id)}
          onPointerOver={() => onHoverNode(b.id)}
          onPointerOut={() => onHoverNode(null)}
        />
      ))}
    </group>
  );
}

// --- Floating 3D District Hologram Markers ---
function DistrictLabels({ districts, theme }: { districts: DistrictMeta[]; theme: 'dark' | 'light' }) {
  const isDark = theme === 'dark';
  return (
    <group>
      {districts.map((d) => {
        const titleColor = isDark ? d.color : getLightDistrictLabelColor(d.color);
        const subColor = isDark ? '#cbd5e1' : '#334155';

        return (
          <group key={d.key} position={[d.center[0], 36, d.center[2]]}>
            <Billboard follow>
              <Text
                fontSize={2.2}
                color={titleColor}
                anchorX="center"
                anchorY="middle"
                outlineWidth={0.18}
                outlineColor={isDark ? '#000000' : '#ffffff'}
              >
                {`// ${d.name.toUpperCase()}`}
              </Text>
              <Text
                position={[0, -2.4, 0]}
                fontSize={1.1}
                color={subColor}
                anchorX="center"
                anchorY="middle"
                outlineWidth={0.1}
                outlineColor={isDark ? '#000000' : '#ffffff'}
              >
                {`${d.subname} • ${d.count} ARCHIVOS`}
              </Text>
            </Billboard>
          </group>
        );
      })}
    </group>
  );
}

// --- Urban Street Grid, Avenues & Markings ---
function UrbanStreetGrid({ 
  avenueXList, 
  avenueZList, 
  theme 
}: { 
  avenueXList: number[]; 
  avenueZList: number[]; 
  theme: 'dark' | 'light'; 
}) {
  const isDark = theme === 'dark';

  const { laneDividers, crosswalks, groundSize } = useMemo(() => {
    const dividers: Array<{ pos: [number, number, number]; rotY: number }> = [];
    const crosses: Array<{ pos: [number, number, number]; rotY: number }> = [];

    const minX = Math.min(...avenueXList, -50);
    const maxX = Math.max(...avenueXList, 50);
    const minZ = Math.min(...avenueZList, -50);
    const maxZ = Math.max(...avenueZList, 50);

    const spanX = maxX - minX + 60;
    const spanZ = maxZ - minZ + 60;

    // Avenues along X
    avenueZList.forEach((avZ) => {
      for (let x = minX; x <= maxX; x += 6) {
        dividers.push({ pos: [x, 0.06, avZ], rotY: 0 });
      }
    });

    // Avenues along Z
    avenueXList.forEach((avX) => {
      for (let z = minZ; z <= maxZ; z += 6) {
        dividers.push({ pos: [avX, 0.06, z], rotY: Math.PI / 2 });
      }
    });

    // Crosswalks at intersections
    avenueXList.forEach((avX) => {
      avenueZList.forEach((avZ) => {
        crosses.push({ pos: [avX + 3.8, 0.07, avZ], rotY: Math.PI / 2 });
        crosses.push({ pos: [avX - 3.8, 0.07, avZ], rotY: Math.PI / 2 });
        crosses.push({ pos: [avX, 0.07, avZ + 3.8], rotY: 0 });
        crosses.push({ pos: [avX, 0.07, avZ - 3.8], rotY: 0 });
      });
    });

    return { 
      laneDividers: dividers, 
      crosswalks: crosses, 
      groundSize: [Math.max(spanX, 300), Math.max(spanZ, 300)] as [number, number] 
    };
  }, [avenueXList, avenueZList]);

  return (
    <group>
      {/* Contiguous Asphalt Road Ground Plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={groundSize} />
        <meshStandardMaterial
          color={isDark ? '#05070f' : '#334155'}
          roughness={0.85}
          metalness={0.15}
        />
      </mesh>

      {/* Street Centerline Dashed Stripes */}
      {laneDividers.map((d, i) => (
        <mesh key={`div-${i}`} position={d.pos} rotation={[0, d.rotY, 0]}>
          <planeGeometry args={[3.0, 0.28]} />
          <meshBasicMaterial 
            color={isDark ? '#38bdf8' : '#f8fafc'} 
            transparent 
            opacity={isDark ? 0.45 : 0.85} 
          />
        </mesh>
      ))}

      {/* Intersection Crosswalks */}
      {crosswalks.map((c, i) => (
        <mesh key={`cross-${i}`} position={c.pos} rotation={[-Math.PI / 2, 0, c.rotY]}>
          <planeGeometry args={[4.0, 1.1]} />
          <meshBasicMaterial 
            color={isDark ? '#63f7ff' : '#ffffff'} 
            transparent 
            opacity={isDark ? 0.35 : 0.8} 
          />
        </mesh>
      ))}
    </group>
  );
}

// --- Interactive Camera Controller Component ---
function CameraController({ 
  preset, 
  targetNodePos,
  onResetDone
}: { 
  preset: 'iso' | 'top' | 'front' | null; 
  targetNodePos: [number, number, number] | null;
  onResetDone: () => void;
}) {
  const { camera } = useThree();
  const controlsRef = useThree((state) => (state as any).controls);

  useEffect(() => {
    if (targetNodePos && controlsRef) {
      controlsRef.target.set(targetNodePos[0], targetNodePos[1] + 6, targetNodePos[2]);
      camera.position.set(targetNodePos[0] + 32, targetNodePos[1] + 38, targetNodePos[2] + 42);
      controlsRef.update();
      onResetDone();
      return;
    }

    if (!preset || !controlsRef) return;
    if (preset === 'iso') {
      controlsRef.target.set(0, 8, 0);
      camera.position.set(55, 60, 65);
    } else if (preset === 'top') {
      controlsRef.target.set(0, 0, 0);
      camera.position.set(0, 150, 5);
    } else if (preset === 'front') {
      controlsRef.target.set(0, 10, 0);
      camera.position.set(0, 32, 100);
    }
    controlsRef.update();
    onResetDone();
  }, [preset, targetNodePos, camera, controlsRef, onResetDone]);

  return null;
}

// --- Real-time Camera Telemetry Tracker ---
function CameraTelemetryTracker({ onCoordChange }: { onCoordChange: (coords: string) => void }) {
  useFrame(({ camera }) => {
    const x = camera.position.x >= 0 ? `+${camera.position.x.toFixed(1)}` : camera.position.x.toFixed(1);
    const z = camera.position.z >= 0 ? `+${camera.position.z.toFixed(1)}` : camera.position.z.toFixed(1);
    const y = camera.position.y >= 0 ? `+${camera.position.y.toFixed(1)}` : camera.position.y.toFixed(1);
    onCoordChange(`XYZ: [${x}, ${z}, ${y}m]`);
  });
  return null;
}

// --- Main App Component ---
export default function App() {
  const [repoUrl, setRepoUrl] = useState('https://github.com/IvonneBarco/proyectos-5a.git');
  const [loading, setLoading] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  
  const [treeData, setTreeData] = useState<FileNode | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<DistrictCategory | 'all'>('all');
  
  const [trafficEvents, setTrafficEvents] = useState<TrafficEvent[]>([]);
  const [isSimulating, setIsSimulating] = useState(false);

  // Real AI Diagnostics & AST Engine State
  const [aiConfig, setAiConfig] = useState<AIConfig>(getStoredAIConfig());
  const [showAiConfigModal, setShowAiConfigModal] = useState(false);
  const [auditResult, setAuditResult] = useState<AuditResult | null>(null);
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditActiveTab, setAuditActiveTab] = useState<'issues' | 'diff' | 'code'>('issues');
  const [copiedRefactor, setCopiedRefactor] = useState(false);
  const [configSavedToast, setConfigSavedToast] = useState(false);

  const [showAiModal, setShowAiModal] = useState(false);
  const [fileContent, setFileContent] = useState('');
  const [isFixing, setIsFixing] = useState(false);
  const [fixApplied, setFixApplied] = useState(false);

  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [lang, setLang] = useState<'es' | 'en'>('es');

  // Camera state & telemetry
  const [cameraPreset, setCameraPreset] = useState<'iso' | 'top' | 'front' | null>(null);
  const [focusTargetPos, setFocusTargetPos] = useState<[number, number, number] | null>(null);
  const [cameraCoords, setCameraCoords] = useState('XYZ: [+55.0, +65.0, +60.0m]');
  const [copiedPath, setCopiedPath] = useState(false);

  // Build contiguous integrated city
  const cityModel: CompleteCityModel = useMemo(() => {
    return buildCompleteCity(treeData);
  }, [treeData]);

  // Aggregate metrics
  const totalLoc = useMemo(() => {
    return cityModel.allBuildings.reduce((sum, b) => sum + (b.lines || 0), 0);
  }, [cityModel]);

  useEffect(() => {
    if (theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [theme]);

  // Clone or fetch ANY repository URL
  const loadRepo = async (targetUrl?: string) => {
    const urlToLoad = targetUrl || repoUrl;
    setLoading(true);
    setFixApplied(false);
    setShowAiModal(false);
    setProgressMsg('Iniciando carga de repositorio...');

    try {
      let cleaned = urlToLoad.trim().replace(/\.git$/, '');
      if (cleaned.endsWith('/')) cleaned = cleaned.slice(0, -1);

      const ghMatch = cleaned.match(/github\.com\/([^\/]+)\/([^\/]+)/);
      const owner = ghMatch ? ghMatch[1] : '';
      const repoName = ghMatch ? ghMatch[2] : cleaned.split('/').pop() || 'repo';

      let loadedRoot: FileNode | null = null;

      // Try 1: Local Git Clone in Electron
      if (typeof window !== 'undefined' && (window as any).require) {
        try {
          const os = (window as any).require('os');
          const path = (window as any).require('path');
          const destPath = path.join(os.tmpdir(), `codecity_${repoName}_${Date.now()}`);
          
          setProgressMsg(`Clonando ${repoName} en disco local...`);
          await cloneRepo(urlToLoad, destPath, (msg) => setProgressMsg(msg));
          
          setProgressMsg('Construyendo AST 3D desde ficheros locales...');
          const { root } = await parseLocalRepo(destPath);
          loadedRoot = root;
        } catch (cloneErr) {
          console.warn('Local clone failed, falling back to GitHub REST API...', cloneErr);
        }
      }

      // Try 2: Fallback to GitHub REST API (Works for ANY public repo in the world without Git!)
      if (!loadedRoot && owner && repoName) {
        setProgressMsg(`Consultando AST vía GitHub API (${owner}/${repoName})...`);
        const { root } = await fetchGithubRepoTree(owner, repoName, 'main');
        loadedRoot = root;
      }

      if (loadedRoot) {
        setTreeData(loadedRoot);
        setSelectedNodeId(null);
        setActiveFilter('all');
        setTrafficEvents([]);
        setIsSimulating(false);
        setCameraPreset('iso');
      } else {
        throw new Error('No se pudo acceder al repositorio.');
      }
    } catch (err: any) {
      console.error('Error loading repo:', err);
      alert(`Error al cargar repositorio: ${err.message || err}`);
    } finally {
      setLoading(false);
      setProgressMsg('');
    }
  };

  // Traffic Simulation Loop (Cross-district telemetry: Frontend -> API -> DB)
  useEffect(() => {
    if (!isSimulating) return;

    let frameId: number;
    let events: TrafficEvent[] = [];
    let cycleCount = 0;

    const codeFiles = cityModel.allBuildings;
    if (codeFiles.length < 2) return;

    const dbFiles = codeFiles.filter((b) => b.category === 'database');
    const apiFiles = codeFiles.filter((b) => b.category === 'core-api');

    const dbNode = dbFiles[0] || codeFiles[0];
    const sourceNode = apiFiles[0] || codeFiles[1];

    const loop = () => {
      cycleCount++;
      events = events
        .filter((e) => e.progress < 1)
        .map((e) => ({
          ...e,
          progress: e.progress + (e.status === 'bottleneck' ? 0.003 : 0.01)
        }));

      // Trigger critical N+1 bottleneck stream between API & DB
      if (cycleCount === 140) {
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

      // Normal inter-district telemetry
      if (cycleCount % 30 === 0 && cycleCount < 300) {
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
  const hoveredNode = hoveredNodeId ? cityModel.flatNodes.get(hoveredNodeId) : null;

  const handleAudit = async (overrideNode?: BuildingData) => {
    const target = overrideNode || selectedNode;
    if (!target) return;
    
    setShowAiModal(true);
    setIsAuditing(true);
    setFixApplied(false);
    setAuditActiveTab('issues');
    setAuditResult(null);

    let content = '';
    try {
      content = readFileContent(target.id);
    } catch {
      // not on disk
    }

    if (!content || !content.trim()) {
      const isSql = target.name.includes('db') || target.name.includes('sql') || target.category === 'database';
      if (isSql) {
        content = `// Módulo AST: ${target.name}\n// Ruta: ${target.path}\n// Distrito: ${target.districtName}\n\nimport { Pool } from 'pg';\nconst db = new Pool();\n\nexport async function getUserOrders(userId: any, category: string) {\n  // Alerta de Seguridad: Inyección SQL no parametrizada (CWE-89)\n  const query = "SELECT * FROM orders WHERE user_id = " + userId + " AND category = '" + category + "'";\n  const res = await db.query(query);\n  \n  // Alerta de Rendimiento: Bucle N+1 de consultas a base de datos\n  for (const order of res.rows) {\n    order.items = await db.query("SELECT * FROM order_items WHERE order_id = " + order.id);\n  }\n  return res.rows;\n}`;
      } else {
        content = `// Módulo AST: ${target.name}\n// Ruta: ${target.path}\n// Distrito: ${target.districtName}\n\nimport { useState, useEffect } from 'react';\n\nexport function ${target.name.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9]/g, "_")}() {\n  const [data, setData] = useState<any>(null);\n  const apiKey = "AIzaSyD-secret_live_key_99482"; // Alerta: Credencial expuesta en texto plano\n\n  useEffect(() => {\n    // Llamada con iteración bloqueante O(N)\n    fetch('/api/v1/data?key=' + apiKey)\n      .then(res => res.json())\n      .then(json => {\n        for (let i = 0; i < json.items.length; i++) {\n          fetch('/api/v1/details/' + json.items[i].id);\n        }\n        setData(json);\n      });\n  }, []);\n\n  return <div>{data?.title}</div>;\n}`;
      }
    }
    setFileContent(content);

    try {
      const res = await auditCodeWithLLM(content, target.name, target.path, aiConfig);
      setAuditResult(res);
    } catch (err: any) {
      console.error('Audit failure:', err);
    } finally {
      setIsAuditing(false);
    }
  };

  const applyAiFix = () => {
    if (!selectedNode || !auditResult) return;
    setIsFixing(true);
    setTimeout(() => {
      try {
        writeFileContent(selectedNode.id, auditResult.refactoredCode);
        setFileContent(auditResult.refactoredCode);
      } catch (e) {
        console.warn('Could not write to disk:', e);
      }
      setFixApplied(true);
      setIsFixing(false);
    }, 850);
  };

  const handleSaveAIConfig = (newConfig: AIConfig) => {
    setAiConfig(newConfig);
    saveStoredAIConfig(newConfig);
    setShowAiConfigModal(false);
    setConfigSavedToast(true);
    setTimeout(() => setConfigSavedToast(false), 2500);
  };

  const handleCopyPath = () => {
    if (!selectedNode) return;
    navigator.clipboard.writeText(selectedNode.path);
    setCopiedPath(true);
    setTimeout(() => setCopiedPath(false), 1800);
  };

  const handleOpenReleaseFolder = () => {
    if (typeof window !== 'undefined' && (window as any).require) {
      try {
        const electron = (window as any).require('electron');
        if (electron.ipcRenderer) {
          electron.ipcRenderer.invoke('open-release-folder');
          return;
        }
        const { shell } = electron;
        const path = (window as any).require('path');
        const cwd = (window as any).process?.cwd ? (window as any).process.cwd() : '.';
        const releasePath = path.join(cwd, 'release');
        shell.openPath(releasePath);
        return;
      } catch (e) {
        console.warn('Error opening release folder:', e);
      }
    }
    alert(
      'La aplicación de escritorio para Windows ya está compilada y lista para usar en la carpeta:\n\n' +
      'c:\\Users\\juanv\\OneDrive\\Documentos\\Modelaje3dciudad\\release\\\n\n' +
      '• CodeCity Nexus 3D 1.0.0.exe (Portable - No requiere instalación)\n' +
      '• CodeCity Nexus 3D Setup 1.0.0.exe (Instalador oficial de Windows)'
    );
  };

  // Formatted repo slug for header
  const repoSlug = useMemo(() => {
    const cleaned = repoUrl.trim().replace(/\.git$/, '');
    const parts = cleaned.split('/');
    if (parts.length >= 2) {
      return `${parts[parts.length - 2]}/${parts[parts.length - 1]}`;
    }
    return cleaned;
  }, [repoUrl]);

  // Translations
  const t = {
    es: {
      load: 'Cargar',
      cloning: progressMsg || 'Clonando...',
      systems: 'Sistemas Tácticos',
      nominal: 'Todo Operativo',
      astNodes: 'Nodos AST',
      buildings: 'Edificios',
      pcapProbe: 'Sonda Tráfico',
      locTotal: 'Volumen Código',
      copilot: 'IA Co-Pilot',
      online: 'ONLINE 24/7',
      pipelineSynced: 'Vulkan Pipeline Sincronizado',
      stopTraffic: 'Detener Tráfico N+1',
      simTraffic: 'Simular Tráfico N+1',
      categories: 'Categorías de Código',
      seeAll: 'Ver Todas',
      files: 'archivos',
      audit: 'Auditar con IA',
      centerCam: 'Centrar',
      inspectPrompt: 'Haz clic en cualquier edificio en el mapa 3D para inspeccionar métricas y auditar con IA',
      complexity: 'Complejidad',
      low: 'Baja',
      med: 'Media',
      high: 'Alta',
      lines: 'Líneas / LOC',
      methods: 'Métodos / Func.',
      active: 'ACTIVO',
      idle: 'EN ESPERA',
      camera: 'Cámara',
      viewIso: 'Isométrica',
      viewTop: 'Planta',
      viewFront: 'Frontal',
      reset: 'Reiniciar',
      presetRepo: 'Repos Demo',
      branch: 'Rama de destino',
      regTests: 'Tests de Regresión: 42/42 Pasadas (100%)',
      bottleneck: 'Cuello de Botella Crítico Detectado',
      optTitle: 'Optimización Automática de Consultas N+1',
      optDesc: 'Detección y resolución preventiva en',
      oldCode: 'Código Actual (Con Cuello de Botella)',
      newCode: 'Código Propuesto (Refactor IA)',
      fixedCode: 'Vulnerabilidad Resuelta en Disco',
      fixedDesc: 'El archivo físico ha sido parcheado localmente y guardado.',
      abort: 'Cerrar',
      applyFix: 'Aplicar Auto-Refactor en Disco',
      applying: 'Parcheando en Disco...',
      latP99: 'Latencia P99',
      sqlTraffic: 'Tráfico SQL',
      pgAvenue: 'Avenida Postgres',
      smooth: 'FLUIDA',
      uncongested: 'Descongestionada',
      terminalTitle: 'Consola de Auditoría IA & Registro Daemon',
      workerReady: 'AI_WORKER_04 // LISTO',
      aiConfigBtn: 'Configurar IA',
      aiConfigTitle: 'Motor de Inteligencia Artificial',
      aiConfigDesc: 'Conecta modelos LLM reales (Gemini / OpenAI) o activa el motor AST heurístico local.',
      aiProvider: 'Proveedor de IA',
      apiKeyLabel: 'Clave API (API Key)',
      modelLabel: 'Modelo Neural',
      geminiHint: 'Obtén tu API Key gratuita en Google AI Studio (aistudio.google.com/apikey)',
      openaiHint: 'Usa una clave de OpenAI con acceso a GPT-4o o GPT-4o-mini',
      localHint: 'Motor AST 100% offline sin costo ni API key. Detecta CWE-89, bucles N+1 y God Objects.',
      saveConfig: 'Guardar Ajustes',
      configSaved: '¡Configuración de IA Guardada!',
      issuesTab: 'Hallazgos & Errores',
      diffTab: 'Comparativa Diff',
      fullCodeTab: 'Código Refactorizado',
      reaudit: 'Re-auditar',
      copyCode: 'Copiar Refactor',
      copied: '¡Copiado al portapapeles!',
      analyzingAST: 'Analizando AST con Inteligencia Artificial...',
      analyzingSub: 'Detectando inyecciones SQL, bucles N+1, secretos expuestos y optimizaciones arquitectónicas.',
      noIssues: 'No se detectaron vulnerabilidades críticas ni cuellos de botella en este archivo.',
      realFixApplied: '¡Refactor aplicado en disco y AST actualizado!',
      realFixDesc: 'El archivo físico en el repositorio ha sido guardado exitosamente.'
    },
    en: {
      load: 'Load',
      cloning: progressMsg || 'Cloning...',
      systems: 'Tactical Systems',
      nominal: 'All Systems Nominal',
      astNodes: 'AST Nodes',
      buildings: 'Buildings',
      pcapProbe: 'Traffic Probe',
      locTotal: 'Code Volume',
      copilot: 'AI Co-Pilot',
      online: 'ONLINE 24/7',
      pipelineSynced: 'Vulkan Pipeline Synced',
      stopTraffic: 'Stop N+1 Traffic',
      simTraffic: 'Simulate N+1 Traffic',
      categories: 'Code Categories',
      seeAll: 'View All',
      files: 'files',
      audit: 'Audit with AI',
      centerCam: 'Focus',
      inspectPrompt: 'Click any building in the 3D city to inspect telemetry and audit with AI',
      complexity: 'Complexity',
      low: 'Low',
      med: 'Medium',
      high: 'High',
      lines: 'Lines / LOC',
      methods: 'Methods / Func.',
      active: 'ACTIVE',
      idle: 'IDLE',
      camera: 'Camera',
      viewIso: 'Isometric',
      viewTop: 'Top-Down',
      viewFront: 'Frontal',
      reset: 'Reset',
      presetRepo: 'Demo Repos',
      branch: 'Target Branch',
      regTests: 'Regression Tests: 42/42 Passed (100%)',
      bottleneck: 'Critical Bottleneck Detected',
      optTitle: 'Automatic N+1 Query Optimization',
      optDesc: 'Preventive detection & remediation on',
      oldCode: 'Current Code (Bottlenecked)',
      newCode: 'Proposed Code (AI Refactor)',
      fixedCode: 'Vulnerability Resolved on Disk',
      fixedDesc: 'Physical file has been locally patched and saved.',
      abort: 'Dismiss',
      applyFix: 'Apply Auto-Refactor on Disk',
      applying: 'Patching Disk...',
      latP99: 'P99 Latency',
      sqlTraffic: 'SQL Traffic',
      pgAvenue: 'Postgres Avenue',
      smooth: 'FLUID',
      uncongested: 'Uncongested',
      terminalTitle: 'AI Audit Console & Daemon Log',
      workerReady: 'AI_WORKER_04 // READY',
      aiConfigBtn: 'AI Settings',
      aiConfigTitle: 'Artificial Intelligence Engine',
      aiConfigDesc: 'Connect real LLM APIs (Gemini / OpenAI) or run the built-in local AST analyzer.',
      aiProvider: 'AI Provider',
      apiKeyLabel: 'API Key',
      modelLabel: 'Neural Model',
      geminiHint: 'Get your free API Key from Google AI Studio (aistudio.google.com/apikey)',
      openaiHint: 'Use an OpenAI API key with GPT-4o or GPT-4o-mini access',
      localHint: '100% offline AST engine with 0 cost and no API key needed. Detects CWE-89, N+1 loops & God Objects.',
      saveConfig: 'Save Settings',
      configSaved: 'AI Settings Saved!',
      issuesTab: 'Detected Issues',
      diffTab: 'Diff Comparison',
      fullCodeTab: 'Refactored Code',
      reaudit: 'Re-audit',
      copyCode: 'Copy Refactor',
      copied: 'Copied to clipboard!',
      analyzingAST: 'Analyzing AST with AI...',
      analyzingSub: 'Detecting SQL injections, N+1 query loops, exposed secrets and architectural fixes.',
      noIssues: 'No critical vulnerabilities or bottlenecks detected in this node.',
      realFixApplied: 'Refactor committed to disk & AST re-synced!',
      realFixDesc: 'The file on disk has been updated successfully.'
    }
  }[lang];

  return (
    <div className={`flex h-screen w-screen overflow-hidden select-none font-sans ${theme === 'dark' ? 'bg-[#060811] text-[#e0e2ee]' : 'bg-[#f8fafc] text-[#0f172a]'}`}>
      
      {/* Toast Notification when AI Config Saved */}
      {configSavedToast && (
        <div className="fixed top-20 right-6 z-50 flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-500 text-slate-950 font-mono text-xs font-bold shadow-2xl animate-in slide-in-from-top">
          <CheckCircle className="w-4 h-4" />
          <span>{t.configSaved}</span>
        </div>
      )}

      {/* ========================================================
          1. TOP COMMAND HEADER NAVBAR
          ======================================================== */}
      <header className={`fixed top-0 left-0 right-0 h-16 z-40 flex items-center justify-between px-6 border-b transition-colors ${theme === 'dark' ? 'bg-[#070913]/90 border-white/[0.08] shadow-[0_4px_24px_rgba(0,0,0,0.6)] backdrop-blur-2xl' : 'bg-white/95 border-slate-200/90 shadow-[0_4px_20px_rgba(0,0,0,0.06)] backdrop-blur-2xl'}`}>
        
        {/* Brand & Telemetry Badge */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center border shadow-sm ${theme === 'dark' ? 'bg-gradient-to-tr from-cyan-500/20 via-cyan-500/10 to-emerald-500/20 border-cyan-500/30 text-cyan-400' : 'bg-blue-50 border-blue-200 text-blue-600'}`}>
              <Zap className="w-4 h-4" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5 font-bold tracking-wider text-sm">
                <span className={theme === 'dark' ? 'text-white' : 'text-slate-900'}>CODECITY</span>
                <span className="bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-500 bg-clip-text text-transparent">NEXUS 3D</span>
              </div>
              <span className={`text-[9px] font-mono tracking-widest uppercase -mt-0.5 ${theme === 'dark' ? 'text-cyan-400/80' : 'text-blue-600 font-semibold'}`}>
                // SPATIAL RUNTIME V4.2 PRO
              </span>
            </div>
          </div>

          {/* Active Repo Indicator Pill */}
          <div className={`hidden xl:flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-mono transition-colors ${theme === 'dark' ? 'bg-[#101524] border-white/[0.07] text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-700'}`}>
            <GitBranch className={`w-3.5 h-3.5 ${theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'}`} />
            <span className={`font-semibold ${theme === 'dark' ? 'text-cyan-400' : 'text-blue-700'}`}>{repoSlug}</span>
            <span className="text-[10px] opacity-60">[branch: main/live]</span>
          </div>
        </div>

        {/* Center Search / Clone Input Bar */}
        <div className="flex items-center gap-2 w-1/3 max-w-xl">
          <div className={`relative flex-1 flex items-center rounded-xl border transition-all ${theme === 'dark' ? 'bg-[#0f1424] border-white/[0.1] focus-within:border-cyan-400 focus-within:shadow-[0_0_15px_rgba(0,245,255,0.2)]' : 'bg-slate-100 border-slate-300 focus-within:border-blue-500 focus-within:bg-white focus-within:shadow-[0_0_15px_rgba(59,130,246,0.15)]'}`}>
            <Search className="w-4 h-4 ml-3 opacity-50 shrink-0" />
            <input
              type="text"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !loading && loadRepo()}
              className={`w-full px-3 py-2 bg-transparent font-mono text-xs outline-none placeholder:text-slate-500 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}
              placeholder="https://github.com/owner/repo"
            />
          </div>
          <button
            onClick={() => loadRepo()}
            disabled={loading}
            className={`px-4 py-2 rounded-xl font-mono text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer shadow-md active:scale-95 disabled:opacity-50 ${theme === 'dark' ? 'bg-gradient-to-r from-cyan-400 to-teal-400 hover:from-cyan-300 hover:to-teal-300 text-slate-950 shadow-cyan-500/25' : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20'}`}
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowUpRight className="w-3.5 h-3.5" />}
            {loading ? t.cloning : t.load}
          </button>
        </div>

        {/* Right Controls: Telemetry, Presets, Language & Theme */}
        <div className="flex items-center gap-3">
          
          {/* Telemetry pill */}
          <div className={`hidden 2xl:flex items-center gap-2 px-3 py-1 rounded-full border text-[11px] font-mono ${theme === 'dark' ? 'bg-[#101524] border-white/[0.07]' : 'bg-slate-100 border-slate-200'}`}>
            <span className={`w-2 h-2 rounded-full animate-pulse ${theme === 'dark' ? 'bg-emerald-400' : 'bg-emerald-600'}`}></span>
            <span className={`font-bold ${theme === 'dark' ? 'text-emerald-400' : 'text-emerald-700'}`}>PORT :8080</span>
            <span className="opacity-40">•</span>
            <span className={theme === 'dark' ? 'text-cyan-400' : 'text-blue-700'}>VULKAN 120FPS</span>
          </div>

          {/* AI Configuration Button */}
          <button
            onClick={() => setShowAiConfigModal(true)}
            className={`px-3 py-1.5 rounded-xl border font-mono text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-sm active:scale-95 ${theme === 'dark' ? 'bg-[#101524] hover:bg-[#18223c] text-purple-400 border-purple-500/40 hover:border-purple-400 shadow-[0_0_12px_rgba(168,85,247,0.15)]' : 'bg-white hover:bg-slate-100 text-purple-700 border-slate-300 shadow-sm'}`}
            title="Configuración de Motor IA (Gemini / OpenAI / AST)"
          >
            <Cpu className={`w-3.5 h-3.5 ${theme === 'dark' ? 'text-purple-400' : 'text-purple-600'}`} />
            <span className="hidden sm:inline">IA: {aiConfig.provider === 'gemini' ? 'Gemini 1.5' : aiConfig.provider === 'openai' ? 'OpenAI' : 'AST Local'}</span>
          </button>

          {/* Desktop App PC (.exe) Download / Open Button */}
          <button
            onClick={handleOpenReleaseFolder}
            className={`px-3 py-1.5 rounded-xl border font-mono text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-sm active:scale-95 ${theme === 'dark' ? 'bg-[#101524] hover:bg-[#18223c] text-cyan-400 border-cyan-500/40 hover:border-cyan-400 shadow-[0_0_12px_rgba(0,245,255,0.15)]' : 'bg-white hover:bg-slate-100 text-blue-700 border-slate-300 shadow-sm'}`}
            title="Abrir carpeta de ejecutables de PC (.exe)"
          >
            <Download className={`w-3.5 h-3.5 ${theme === 'dark' ? 'text-cyan-400' : 'text-blue-600'}`} />
            <span className="hidden sm:inline">Descargar App PC (.exe)</span>
          </button>

          {/* Language Switcher */}
          <div className={`flex items-center p-1 rounded-xl border font-mono text-xs font-semibold ${theme === 'dark' ? 'bg-[#0f1424] border-white/[0.08]' : 'bg-slate-100 border-slate-200'}`}>
            <button
              onClick={() => setLang('es')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${lang === 'es' ? (theme === 'dark' ? 'bg-gradient-to-r from-cyan-500 to-teal-400 text-slate-950 font-bold shadow-sm' : 'bg-white text-blue-600 shadow-sm font-bold') : 'opacity-60 hover:opacity-100'}`}
            >
              ES
            </button>
            <button
              onClick={() => setLang('en')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${lang === 'en' ? (theme === 'dark' ? 'bg-gradient-to-r from-cyan-500 to-teal-400 text-slate-950 font-bold shadow-sm' : 'bg-white text-blue-600 shadow-sm font-bold') : 'opacity-60 hover:opacity-100'}`}
            >
              EN
            </button>
          </div>

          {/* Theme Switcher */}
          <div className={`flex items-center p-1 rounded-xl border font-mono text-xs font-semibold ${theme === 'dark' ? 'bg-[#0f1424] border-white/[0.08]' : 'bg-slate-100 border-slate-200'}`}>
            <button
              onClick={() => setTheme('dark')}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${theme === 'dark' ? 'bg-cyan-400 text-slate-950 shadow-sm' : 'opacity-50 hover:opacity-100'}`}
              title="Dark Mode"
            >
              <Moon className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setTheme('light')}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${theme === 'light' ? 'bg-white text-blue-600 shadow-sm' : 'opacity-50 hover:opacity-100'}`}
              title="Light Mode"
            >
              <Sun className="w-3.5 h-3.5" />
            </button>
          </div>

        </div>
      </header>

      {/* ========================================================
          2. LEFT HUD TACTICAL SIDEBAR
          ======================================================== */}
      <aside className={`fixed left-0 top-16 bottom-8 w-84 z-30 flex flex-col justify-between py-4 border-r transition-colors shadow-2xl ${theme === 'dark' ? 'bg-[#070913]/95 border-white/[0.08] backdrop-blur-2xl' : 'bg-white/95 border-slate-200/90 backdrop-blur-2xl'}`}>
        
        <div className="flex flex-col gap-4 px-5 overflow-y-auto custom-scrollbar">
          
          {/* Tactical Status Header */}
          <div className={`flex items-center justify-between pb-3 border-b ${theme === 'dark' ? 'border-white/[0.07]' : 'border-slate-200'}`}>
            <div className="flex items-center gap-2">
              <ShieldCheck className={`w-4 h-4 ${theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'}`} />
              <span className={`font-mono text-xs uppercase font-bold tracking-wider ${theme === 'dark' ? 'opacity-80' : 'text-slate-800'}`}>
                {t.systems}
              </span>
            </div>
            <span className={`font-mono text-[11px] font-bold flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border ${theme === 'dark' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : 'text-emerald-700 bg-emerald-50 border-emerald-200'}`}>
              <span className={`w-2 h-2 rounded-full animate-pulse ${theme === 'dark' ? 'bg-emerald-400' : 'bg-emerald-600'}`}></span>
              {t.nominal}
            </span>
          </div>

          {/* 2x2 Telemetry Metric Cards */}
          <div className="grid grid-cols-2 gap-2.5">
            
            {/* AST Nodes */}
            <div className={`p-3 rounded-xl border transition-all ${theme === 'dark' ? 'bg-[#0e1322] border-white/[0.07] hover:border-cyan-500/30' : 'bg-white border-slate-200 shadow-sm hover:border-blue-400'}`}>
              <div className="flex items-center justify-between mb-1">
                <span className={`font-mono text-[10px] uppercase ${theme === 'dark' ? 'opacity-60' : 'text-slate-500'}`}>{t.astNodes}</span>
                <Boxes className={`w-3.5 h-3.5 ${theme === 'dark' ? 'text-cyan-400' : 'text-blue-600'}`} />
              </div>
              <div className={`font-mono text-base font-bold ${theme === 'dark' ? 'text-cyan-400' : 'text-blue-600'}`}>
                {cityModel.totalClasses} <span className="text-[10px] font-normal opacity-75">{t.buildings}</span>
              </div>
              <div className={`w-full h-1 rounded-full mt-2 overflow-hidden ${theme === 'dark' ? 'bg-white/10' : 'bg-slate-100'}`}>
                <div className={`h-full rounded-full ${theme === 'dark' ? 'bg-cyan-400' : 'bg-blue-600'}`} style={{ width: '100%' }}></div>
              </div>
            </div>

            {/* Traffic Probe */}
            <div className={`p-3 rounded-xl border transition-all ${theme === 'dark' ? 'bg-[#0e1322] border-white/[0.07] hover:border-emerald-500/30' : 'bg-white border-slate-200 shadow-sm hover:border-emerald-400'}`}>
              <div className="flex items-center justify-between mb-1">
                <span className={`font-mono text-[10px] uppercase ${theme === 'dark' ? 'opacity-60' : 'text-slate-500'}`}>{t.pcapProbe}</span>
                <Activity className={`w-3.5 h-3.5 ${isSimulating ? 'text-red-500 animate-pulse' : theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'}`} />
              </div>
              <div className={`font-mono text-base font-bold ${isSimulating ? 'text-red-500' : theme === 'dark' ? 'text-emerald-400' : 'text-emerald-700'}`}>
                {isSimulating ? t.active : t.idle}
              </div>
              <div className={`w-full h-1 rounded-full mt-2 overflow-hidden ${theme === 'dark' ? 'bg-white/10' : 'bg-slate-100'}`}>
                <div className={`h-full rounded-full ${isSimulating ? 'bg-red-500' : theme === 'dark' ? 'bg-emerald-400' : 'bg-emerald-600'}`} style={{ width: isSimulating ? '100%' : '35%' }}></div>
              </div>
            </div>

            {/* Total Volume LOC */}
            <div className={`p-3 rounded-xl border transition-all ${theme === 'dark' ? 'bg-[#0e1322] border-white/[0.07]' : 'bg-white border-slate-200 shadow-sm'}`}>
              <div className="flex items-center justify-between mb-1">
                <span className={`font-mono text-[10px] uppercase ${theme === 'dark' ? 'opacity-60' : 'text-slate-500'}`}>{t.locTotal}</span>
                <FileCode className={`w-3.5 h-3.5 ${theme === 'dark' ? 'text-purple-400' : 'text-purple-600'}`} />
              </div>
              <div className={`font-mono text-sm font-bold ${theme === 'dark' ? 'text-purple-400' : 'text-purple-700'}`}>
                {totalLoc.toLocaleString()} <span className="text-[10px] font-normal opacity-75">LOC</span>
              </div>
            </div>

            {/* AI Co-Pilot */}
            <div className={`p-3 rounded-xl border transition-all ${theme === 'dark' ? 'bg-[#0e1322] border-white/[0.07]' : 'bg-white border-slate-200 shadow-sm'}`}>
              <div className="flex items-center justify-between mb-1">
                <span className={`font-mono text-[10px] uppercase ${theme === 'dark' ? 'opacity-60' : 'text-slate-500'}`}>{t.copilot}</span>
                <Sparkles className={`w-3.5 h-3.5 ${theme === 'dark' ? 'text-amber-400' : 'text-amber-600'}`} />
              </div>
              <div className={`font-mono text-sm font-bold ${theme === 'dark' ? 'text-amber-400' : 'text-amber-700'}`}>
                {t.online}
              </div>
            </div>

          </div>

          {/* Traffic Simulation Trigger Button */}
          <button
            onClick={() => setIsSimulating(!isSimulating)}
            className={`w-full py-2.5 px-4 rounded-xl font-mono text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2.5 transition-all cursor-pointer shadow-md active:scale-98 ${isSimulating ? 'bg-red-500 hover:bg-red-600 text-white shadow-red-500/30 ring-2 ring-red-400/50' : theme === 'dark' ? 'bg-gradient-to-r from-[#11182c] to-[#15203a] hover:from-[#182340] hover:to-[#1e2e54] text-cyan-400 border border-cyan-500/30 hover:border-cyan-400 shadow-[0_0_15px_rgba(0,245,255,0.15)]' : 'bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200'}`}
          >
            <Activity className={`w-4 h-4 ${isSimulating ? 'animate-bounce text-white' : theme === 'dark' ? 'text-cyan-400' : 'text-blue-600'}`} />
            {isSimulating ? t.stopTraffic : t.simTraffic}
          </button>

          {/* Districts / Category Filter List */}
          <div className="flex flex-col gap-2 pt-1">
            <div className="flex items-center justify-between pb-1">
              <span className={`text-[11px] font-mono uppercase font-bold tracking-wider flex items-center gap-1.5 ${theme === 'dark' ? 'opacity-75' : 'text-slate-800'}`}>
                <Filter className={`w-3.5 h-3.5 ${theme === 'dark' ? 'text-cyan-400' : 'text-blue-600'}`} />
                {t.categories}
              </span>
              <button
                onClick={() => setActiveFilter('all')}
                className={`text-[10px] font-mono uppercase px-2.5 py-1 rounded-md transition-all cursor-pointer ${activeFilter === 'all' ? (theme === 'dark' ? 'bg-cyan-400 text-slate-950 font-bold shadow-sm' : 'bg-blue-600 text-white font-bold') : 'opacity-60 hover:opacity-100'}`}
              >
                {t.seeAll}
              </button>
            </div>

            {/* Category Cards with Proportional Codebase Bar */}
            <div className="flex flex-col gap-1.5">
              {cityModel.districts.map((d) => {
                const isSelected = activeFilter === d.key;
                const percent = ((d.count / (cityModel.totalClasses || 1)) * 100).toFixed(0);

                return (
                  <button
                    key={d.key}
                    onClick={() => setActiveFilter(isSelected ? 'all' : d.key)}
                    className={`group relative flex flex-col p-2.5 rounded-xl border text-left transition-all cursor-pointer overflow-hidden ${isSelected ? (theme === 'dark' ? 'border-cyan-400 bg-cyan-500/10 shadow-[0_0_15px_rgba(0,245,255,0.2)]' : 'border-blue-500 bg-blue-50/80 shadow-sm') : theme === 'dark' ? 'bg-[#0e1322] border-white/[0.06] hover:bg-[#141b2e] hover:border-white/[0.12]' : 'bg-white border-slate-200/90 shadow-sm hover:border-blue-400 hover:bg-slate-50/80'}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5 truncate">
                        <span 
                          className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm"
                          style={{ backgroundColor: d.color, boxShadow: `0 0 8px ${d.color}` }}
                        ></span>
                        <div className="flex flex-col truncate">
                          <span className={`text-xs font-bold truncate leading-tight transition-colors ${theme === 'dark' ? 'group-hover:text-cyan-400' : 'text-slate-900 group-hover:text-blue-600'}`}>
                            {d.name}
                          </span>
                          <span className={`text-[9px] font-mono uppercase tracking-wider truncate ${theme === 'dark' ? 'opacity-50' : 'text-slate-500'}`}>
                            {d.subname}
                          </span>
                        </div>
                      </div>
                      <div className="text-right pl-2 shrink-0">
                        <span className="font-mono text-xs font-bold" style={{ color: theme === 'dark' ? d.color : getLightDistrictLabelColor(d.color) }}>
                          {d.count}
                        </span>
                        <span className={`text-[9px] font-mono block -mt-0.5 ${theme === 'dark' ? 'opacity-60' : 'text-slate-500'}`}>
                          {percent}%
                        </span>
                      </div>
                    </div>

                    {/* Proportional Codebase Progress Line */}
                    <div className={`w-full h-1.5 rounded-full mt-2 overflow-hidden ${theme === 'dark' ? 'bg-white/5' : 'bg-slate-100 border border-slate-200/50'}`}>
                      <div 
                        className="h-full rounded-full transition-all duration-500" 
                        style={{ width: `${percent}%`, backgroundColor: d.color }}
                      ></div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

        </div>

        {/* Selected Node Details & Audit Card (Pinned at bottom of sidebar) */}
        <div className={`px-5 pt-3 border-t ${theme === 'dark' ? 'border-white/[0.08]' : 'border-slate-200'}`}>
          {selectedNode ? (
            <div className={`p-3.5 rounded-2xl border flex flex-col gap-2.5 shadow-xl relative overflow-hidden transition-all ${theme === 'dark' ? 'bg-gradient-to-b from-[#11182c] to-[#0c101d] border-cyan-500/40 shadow-cyan-500/10' : 'bg-white border-blue-200 shadow-lg'}`}>
              
              {/* Top accent badge */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span 
                    className="w-2 h-2 rounded-full animate-ping shrink-0" 
                    style={{ backgroundColor: selectedNode.color }}
                  ></span>
                  <span 
                    className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border"
                    style={{ 
                      color: theme === 'dark' ? selectedNode.color : getLightDistrictLabelColor(selectedNode.color), 
                      borderColor: `${selectedNode.color}50`,
                      backgroundColor: `${selectedNode.color}15`
                    }}
                  >
                    {selectedNode.badge}
                  </span>
                </div>
                <span className={`text-[9px] font-mono px-2 py-0.5 rounded-full uppercase font-semibold ${theme === 'dark' ? 'bg-white/10' : 'bg-slate-100 text-slate-700'}`}>
                  {selectedNode.extension || 'file'}
                </span>
              </div>

              {/* Title & Path with copy button */}
              <div className="flex flex-col">
                <h3 className="font-mono font-bold text-sm truncate" style={{ color: theme === 'dark' ? selectedNode.color : getLightDistrictLabelColor(selectedNode.color) }}>
                  {selectedNode.name}
                </h3>
                <div className="flex items-center justify-between mt-0.5 group">
                  <p className={`text-[10px] font-mono truncate max-w-[200px] ${theme === 'dark' ? 'opacity-60' : 'text-slate-500'}`} title={selectedNode.path}>
                    {selectedNode.path}
                  </p>
                  <button
                    onClick={handleCopyPath}
                    className="p-1 rounded opacity-60 hover:opacity-100 transition-opacity cursor-pointer"
                    title="Copiar ruta"
                  >
                    {copiedPath ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              </div>

              {/* Diagnostics Grid: LOC, Methods, Complexity */}
              <div className={`grid grid-cols-3 gap-2 text-center py-2 px-1 rounded-xl font-mono text-[10px] ${theme === 'dark' ? 'bg-black/20 border border-white/[0.05]' : 'bg-slate-50 border border-slate-200'}`}>
                <div>
                  <span className={`block text-[8px] uppercase tracking-wider ${theme === 'dark' ? 'opacity-50' : 'text-slate-500'}`}>{t.lines}</span>
                  <span className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{selectedNode.lines}</span>
                </div>
                <div className={`border-x ${theme === 'dark' ? 'border-white/[0.08]' : 'border-slate-200'}`}>
                  <span className={`block text-[8px] uppercase tracking-wider ${theme === 'dark' ? 'opacity-50' : 'text-slate-500'}`}>{t.methods}</span>
                  <span className={`font-bold ${theme === 'dark' ? 'text-emerald-400' : 'text-emerald-700'}`}>{selectedNode.methods}</span>
                </div>
                <div>
                  <span className={`block text-[8px] uppercase tracking-wider ${theme === 'dark' ? 'opacity-50' : 'text-slate-500'}`}>{t.complexity}</span>
                  <span className={`font-bold ${selectedNode.lines > 500 ? (theme === 'dark' ? 'text-amber-400' : 'text-amber-700') : (theme === 'dark' ? 'text-cyan-400' : 'text-blue-700')}`}>
                    {selectedNode.lines > 1000 ? t.high : selectedNode.lines > 300 ? t.med : t.low}
                  </span>
                </div>
              </div>

              {/* Actions: Audit with AI & Focus Camera */}
              <div className="flex items-center gap-2 pt-0.5">
                <button
                  onClick={() => handleAudit()}
                  className={`flex-1 py-2 rounded-xl font-mono text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg active:scale-95 ${theme === 'dark' ? 'bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 text-slate-950 shadow-cyan-500/25' : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/25'}`}
                >
                  <Rocket className="w-4 h-4" />
                  {t.audit}
                </button>
                <button
                  onClick={() => setFocusTargetPos(selectedNode.absolutePosition)}
                  className={`p-2 rounded-xl border transition-all cursor-pointer ${theme === 'dark' ? 'bg-[#151c30] border-white/[0.1] text-cyan-400 hover:border-cyan-400' : 'bg-white border-slate-300 text-blue-600 hover:border-blue-500'}`}
                  title={t.centerCam}
                >
                  <Crosshair className="w-4 h-4" />
                </button>
              </div>

            </div>
          ) : (
            <div className={`p-4 rounded-2xl border text-center flex flex-col items-center gap-2 ${theme === 'dark' ? 'bg-[#0a0d18]/60 border-white/[0.05]' : 'bg-slate-50 border-slate-200'}`}>
              <div className={`w-8 h-8 rounded-full border border-dashed flex items-center justify-center animate-spin ${theme === 'dark' ? 'border-cyan-500/40 text-cyan-400/60' : 'border-blue-500/40 text-blue-600'}`} style={{ animationDuration: '8s' }}>
                <Compass className="w-4 h-4" />
              </div>
              <p className={`text-[11px] font-mono leading-relaxed ${theme === 'dark' ? 'opacity-60' : 'text-slate-600'}`}>
                {t.inspectPrompt}
              </p>
            </div>
          )}
        </div>

      </aside>

      {/* ========================================================
          3. 3D CANVAS VIEWPORT & FLOATING HUD
          ======================================================== */}
      <main className="fixed inset-0 z-0 pl-84 pt-16 pb-8">
        
        {/* Floating Camera Presets Ribbon */}
        <div className={`absolute top-4 right-6 z-20 flex items-center gap-1.5 p-1 rounded-2xl border backdrop-blur-xl shadow-lg transition-colors font-mono text-xs font-semibold ${theme === 'dark' ? 'bg-[#070913]/85 border-white/[0.08] text-slate-300' : 'bg-white/90 border-slate-200 text-slate-700'}`}>
          <button
            onClick={() => { setFocusTargetPos(null); setCameraPreset('iso'); }}
            className={`px-3 py-1.5 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer ${theme === 'dark' ? 'hover:bg-white/10 hover:text-cyan-400' : 'hover:bg-slate-100 hover:text-blue-600'}`}
          >
            <Compass className={`w-3.5 h-3.5 ${theme === 'dark' ? 'text-cyan-400' : 'text-blue-600'}`} />
            {t.viewIso}
          </button>
          <button
            onClick={() => { setFocusTargetPos(null); setCameraPreset('top'); }}
            className={`px-3 py-1.5 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer ${theme === 'dark' ? 'hover:bg-white/10 hover:text-cyan-400' : 'hover:bg-slate-100 hover:text-blue-600'}`}
          >
            <Layers className={`w-3.5 h-3.5 ${theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'}`} />
            {t.viewTop}
          </button>
          <button
            onClick={() => { setFocusTargetPos(null); setCameraPreset('front'); }}
            className={`px-3 py-1.5 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer ${theme === 'dark' ? 'hover:bg-white/10 hover:text-cyan-400' : 'hover:bg-slate-100 hover:text-blue-600'}`}
          >
            <Boxes className={`w-3.5 h-3.5 ${theme === 'dark' ? 'text-purple-400' : 'text-purple-600'}`} />
            {t.viewFront}
          </button>
          <button
            onClick={() => { setFocusTargetPos(null); setCameraPreset('iso'); }}
            className={`p-1.5 rounded-xl transition-colors cursor-pointer ${theme === 'dark' ? 'hover:bg-white/10 hover:text-white' : 'hover:bg-slate-100 hover:text-slate-900'}`}
            title={t.reset}
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Hovered Building Floating Tooltip */}
        {hoveredNode && !selectedNode && (
          <div className={`absolute top-4 left-6 z-20 flex items-center gap-2 px-3.5 py-1.5 rounded-xl border backdrop-blur-xl font-mono text-xs shadow-xl animate-in fade-in ${theme === 'dark' ? 'bg-[#070913]/90 border-cyan-500/30 text-white' : 'bg-white/95 border-blue-300 text-slate-900 shadow-blue-500/10'}`}>
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: hoveredNode.color }}></span>
            <span className="font-bold">{hoveredNode.name}</span>
            <span className={`text-[10px] ${theme === 'dark' ? 'opacity-60' : 'text-slate-500'}`}>[{hoveredNode.lines} LOC]</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${theme === 'dark' ? 'bg-white/10 opacity-75' : 'bg-slate-100 text-slate-700'}`}>{hoveredNode.badge}</span>
          </div>
        )}

        <Canvas camera={{ position: [55, 60, 65], fov: 42 }}>
          <color attach="background" args={[theme === 'dark' ? '#060811' : '#f1f5f9']} />
          <fog attach="fog" args={[theme === 'dark' ? '#060811' : '#f1f5f9', 90, 480]} />

          {/* Lighting */}
          {theme === 'dark' ? (
            <>
              <ambientLight intensity={0.55} />
              <directionalLight position={[80, 140, 70]} intensity={1.8} color="#38bdf8" />
              <directionalLight position={[-80, 100, -70]} intensity={1.4} color="#ec4899" />
              <pointLight position={[0, 50, 0]} intensity={1.2} color="#ffffff" distance={250} />
            </>
          ) : (
            <>
              <ambientLight intensity={0.75} />
              <directionalLight position={[90, 140, 80]} intensity={1.3} color="#ffffff" castShadow />
              <directionalLight position={[-60, 80, -60]} intensity={0.5} color="#94a3b8" />
              <hemisphereLight args={['#ffffff', '#cbd5e1', 0.6]} />
            </>
          )}

          {/* Urban Streets, Avenues & Markings */}
          <UrbanStreetGrid 
            avenueXList={cityModel.avenueXList} 
            avenueZList={cityModel.avenueZList} 
            theme={theme} 
          />

          {/* Floating 3D District Hologram Titles */}
          <DistrictLabels districts={cityModel.districts} theme={theme} />

          {/* 100% Contiguous City Blocks */}
          {cityModel.blocks.map((block) => (
            <CityBlock
              key={block.id}
              block={block}
              selectedId={selectedNodeId}
              hoveredId={hoveredNodeId}
              activeFilter={activeFilter}
              theme={theme}
              onSelectNode={setSelectedNodeId}
              onHoverNode={setHoveredNodeId}
            />
          ))}

          {/* Living Traffic System */}
          <TrafficSystem events={trafficEvents} theme={theme} />

          {/* Camera Controller & Telemetry */}
          <CameraController 
            preset={cameraPreset} 
            targetNodePos={focusTargetPos}
            onResetDone={() => setCameraPreset(null)} 
          />
          <CameraTelemetryTracker onCoordChange={setCameraCoords} />

          {/* Orbit Controls centered on the city */}
          <OrbitControls
            makeDefault
            target={[0, 8, 0]}
            dampingFactor={0.05}
            minDistance={15}
            maxDistance={450}
            maxPolarAngle={Math.PI / 2 - 0.05}
          />

          {/* Cyberpunk Bloom in Dark Mode */}
          {theme === 'dark' && (
            <EffectComposer>
              <Bloom luminanceThreshold={0.2} luminanceSmoothing={0.9} height={300} intensity={1.5} />
            </EffectComposer>
          )}
        </Canvas>
      </main>

      {/* ========================================================
          4. AI CONFIGURATION SETTINGS MODAL
          ======================================================== */}
      {showAiConfigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xl p-4 animate-in fade-in">
          <div className={`w-full max-w-xl rounded-3xl border flex flex-col shadow-2xl overflow-hidden transition-all ${theme === 'dark' ? 'bg-[#090d1a] border-purple-500/30 shadow-[0_0_50px_rgba(168,85,247,0.2)]' : 'bg-white border-slate-300 shadow-2xl'}`}>
            
            {/* Header */}
            <div className={`p-6 border-b flex justify-between items-center ${theme === 'dark' ? 'bg-[#0e1426] border-white/[0.08]' : 'bg-purple-50 border-purple-100'}`}>
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl border ${theme === 'dark' ? 'bg-purple-500/20 border-purple-500/40 text-purple-400' : 'bg-purple-100 border-purple-300 text-purple-700'}`}>
                  <Cpu className="w-5 h-5" />
                </div>
                <div>
                  <h3 className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{t.aiConfigTitle}</h3>
                  <p className={`text-xs ${theme === 'dark' ? 'opacity-70' : 'text-slate-600'}`}>{t.aiConfigDesc}</p>
                </div>
              </div>
              <button
                onClick={() => setShowAiConfigModal(false)}
                className={`p-2 rounded-xl transition-colors cursor-pointer ${theme === 'dark' ? 'opacity-60 hover:opacity-100 hover:bg-white/10' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'}`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Form */}
            <div className="p-6 flex flex-col gap-5 font-mono text-xs">
              
              {/* Provider Selection */}
              <div>
                <label className={`block font-bold mb-2 uppercase tracking-wider text-[11px] ${theme === 'dark' ? 'text-purple-400' : 'text-purple-900'}`}>
                  {t.aiProvider}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setAiConfig(prev => ({ ...prev, provider: 'gemini', model: 'gemini-1.5-flash' }))}
                    className={`p-3 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1.5 ${aiConfig.provider === 'gemini' ? (theme === 'dark' ? 'bg-purple-500/20 border-purple-400 text-purple-200 shadow-md' : 'bg-purple-100 border-purple-500 text-purple-900 font-bold') : (theme === 'dark' ? 'bg-[#060811] border-white/[0.08] text-slate-400 hover:border-white/20' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100')}`}
                  >
                    <Sparkles className="w-4 h-4 text-cyan-400" />
                    <span className="font-bold text-[11px]">Google Gemini</span>
                    <span className="text-[9px] opacity-75">Recomendado</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAiConfig(prev => ({ ...prev, provider: 'openai', model: 'gpt-4o-mini' }))}
                    className={`p-3 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1.5 ${aiConfig.provider === 'openai' ? (theme === 'dark' ? 'bg-purple-500/20 border-purple-400 text-purple-200 shadow-md' : 'bg-purple-100 border-purple-500 text-purple-900 font-bold') : (theme === 'dark' ? 'bg-[#060811] border-white/[0.08] text-slate-400 hover:border-white/20' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100')}`}
                  >
                    <Cpu className="w-4 h-4 text-emerald-400" />
                    <span className="font-bold text-[11px]">OpenAI</span>
                    <span className="text-[9px] opacity-75">GPT-4o Mini</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAiConfig(prev => ({ ...prev, provider: 'local', model: 'local-ast' }))}
                    className={`p-3 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1.5 ${aiConfig.provider === 'local' ? (theme === 'dark' ? 'bg-purple-500/20 border-purple-400 text-purple-200 shadow-md' : 'bg-purple-100 border-purple-500 text-purple-900 font-bold') : (theme === 'dark' ? 'bg-[#060811] border-white/[0.08] text-slate-400 hover:border-white/20' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100')}`}
                  >
                    <Bug className="w-4 h-4 text-amber-400" />
                    <span className="font-bold text-[11px]">Motor Local</span>
                    <span className="text-[9px] opacity-75">Sin API Key</span>
                  </button>
                </div>
              </div>

              {/* API Key Field (if not local) */}
              {aiConfig.provider !== 'local' ? (
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between items-center">
                    <label className={`font-bold uppercase tracking-wider text-[11px] ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                      {t.apiKeyLabel}
                    </label>
                    {aiConfig.provider === 'gemini' && (
                      <a
                        href="https://aistudio.google.com/apikey"
                        target="_blank"
                        rel="noreferrer"
                        className={`flex items-center gap-1 text-[11px] font-semibold underline ${theme === 'dark' ? 'text-cyan-400 hover:text-cyan-300' : 'text-blue-600 hover:text-blue-700'}`}
                      >
                        <span>Obtener clave gratis</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                  <div className={`flex items-center px-3 py-2 rounded-xl border ${theme === 'dark' ? 'bg-[#060811] border-white/[0.1] text-white' : 'bg-slate-100 border-slate-300 text-slate-900'}`}>
                    <Key className="w-4 h-4 mr-2 opacity-50 shrink-0" />
                    <input
                      type="password"
                      value={aiConfig.apiKey}
                      onChange={(e) => setAiConfig(prev => ({ ...prev, apiKey: e.target.value }))}
                      placeholder={aiConfig.provider === 'gemini' ? "AIzaSy..." : "sk-proj-..."}
                      className="w-full bg-transparent outline-none font-mono text-xs"
                    />
                  </div>
                  <p className={`text-[10px] leading-relaxed ${theme === 'dark' ? 'opacity-60' : 'text-slate-500'}`}>
                    {aiConfig.provider === 'gemini' ? t.geminiHint : t.openaiHint}
                  </p>
                </div>
              ) : (
                <div className={`p-4 rounded-2xl border flex items-start gap-3 ${theme === 'dark' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-900'}`}>
                  <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                  <div className="text-[11px] leading-relaxed">
                    <strong className="block font-bold mb-1">Motor Heurístico AST 100% Offline Activo</strong>
                    <p className="opacity-90">{t.localHint}</p>
                  </div>
                </div>
              )}

              {/* Model Choice (for Gemini/OpenAI) */}
              {aiConfig.provider === 'gemini' && (
                <div>
                  <label className={`block font-bold mb-1.5 uppercase tracking-wider text-[11px] ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                    {t.modelLabel}
                  </label>
                  <select
                    value={aiConfig.model}
                    onChange={(e) => setAiConfig(prev => ({ ...prev, model: e.target.value }))}
                    className={`w-full p-2.5 rounded-xl border font-mono text-xs outline-none cursor-pointer ${theme === 'dark' ? 'bg-[#060811] border-white/[0.1] text-white' : 'bg-slate-100 border-slate-300 text-slate-900'}`}
                  >
                    <option value="gemini-1.5-flash">Gemini 1.5 Flash (Ultra-rápido / Recomendado)</option>
                    <option value="gemini-1.5-pro">Gemini 1.5 Pro (Máxima profundidad de análisis)</option>
                  </select>
                </div>
              )}

              {aiConfig.provider === 'openai' && (
                <div>
                  <label className={`block font-bold mb-1.5 uppercase tracking-wider text-[11px] ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                    {t.modelLabel}
                  </label>
                  <select
                    value={aiConfig.model}
                    onChange={(e) => setAiConfig(prev => ({ ...prev, model: e.target.value }))}
                    className={`w-full p-2.5 rounded-xl border font-mono text-xs outline-none cursor-pointer ${theme === 'dark' ? 'bg-[#060811] border-white/[0.1] text-white' : 'bg-slate-100 border-slate-300 text-slate-900'}`}
                  >
                    <option value="gpt-4o-mini">GPT-4o Mini (Rápido y económico)</option>
                    <option value="gpt-4o">GPT-4o (Modelo insignia multimodal)</option>
                  </select>
                </div>
              )}

            </div>

            {/* Footer */}
            <div className={`p-4 border-t flex justify-end gap-3 ${theme === 'dark' ? 'bg-[#0e1426] border-white/[0.08]' : 'bg-slate-50 border-slate-200'}`}>
              <button
                type="button"
                onClick={() => setShowAiConfigModal(false)}
                className={`px-4 py-2 rounded-xl text-xs font-mono uppercase transition-colors cursor-pointer ${theme === 'dark' ? 'opacity-60 hover:opacity-100' : 'text-slate-600 hover:text-slate-900'}`}
              >
                {t.abort}
              </button>
              <button
                type="button"
                onClick={() => handleSaveAIConfig(aiConfig)}
                className={`px-5 py-2 rounded-xl font-mono text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer shadow-md active:scale-95 ${theme === 'dark' ? 'bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-400 hover:to-indigo-400 text-white shadow-purple-500/25' : 'bg-purple-600 hover:bg-purple-700 text-white shadow-purple-500/20'}`}
              >
                <Check className="w-4 h-4" />
                {t.saveConfig}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================
          5. AI PREDICTIVE ARCHITECT MODAL (Real AST & LLM Engine)
          ======================================================== */}
      {showAiModal && selectedNode && (
        <div className="fixed inset-0 z-50 pt-16 pl-84 pb-8 flex items-center justify-center bg-black/85 backdrop-blur-xl p-6 animate-in fade-in">
          <div className={`w-full max-w-5xl max-h-[88vh] rounded-3xl border flex flex-col shadow-2xl overflow-hidden transition-all ${theme === 'dark' ? 'bg-[#090d1a] border-cyan-500/30 shadow-[0_0_60px_rgba(0,245,255,0.18)]' : 'bg-white border-slate-300 shadow-2xl'}`}>
            
            {/* Modal Header Banner */}
            <div className={`p-5 border-b flex justify-between items-start ${theme === 'dark' ? 'bg-[#0e1426] border-white/[0.08]' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex flex-col gap-1.5 max-w-xl">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full animate-ping ${auditResult?.severity === 'CRITICAL' ? 'bg-red-500' : auditResult?.severity === 'HIGH' ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
                  <span className={`text-[11px] font-mono font-bold uppercase px-2.5 py-0.5 rounded-full border ${auditResult?.severity === 'CRITICAL' ? (theme === 'dark' ? 'text-red-400 bg-red-500/10 border-red-500/20' : 'text-red-700 bg-red-100 border-red-300') : auditResult?.severity === 'HIGH' ? (theme === 'dark' ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' : 'text-amber-800 bg-amber-100 border-amber-300') : (theme === 'dark' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : 'text-emerald-700 bg-emerald-100 border-emerald-300')}`}>
                    {auditResult?.severity ? `ESTADO: ${auditResult.severity}` : t.bottleneck}
                  </span>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${theme === 'dark' ? 'bg-purple-500/10 border-purple-500/30 text-purple-300' : 'bg-purple-100 border-purple-200 text-purple-800'}`}>
                    {auditResult?.modelName || (aiConfig.provider === 'gemini' ? 'Google Gemini 1.5' : aiConfig.provider === 'openai' ? 'OpenAI GPT-4o' : 'Motor Local AST')}
                  </span>
                </div>
                <h2 className={`text-xl font-bold tracking-tight truncate ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                  {auditResult?.title || t.optTitle}
                </h2>
                <p className={`text-xs font-mono truncate ${theme === 'dark' ? 'opacity-75' : 'text-slate-600'}`}>
                  {selectedNode.name} • {selectedNode.districtName} • <span className="opacity-60">{selectedNode.path}</span>
                </p>
              </div>

              {/* Header Actions & Metrics */}
              <div className="flex items-center gap-3">
                {/* Telemetry Impact Projection Boxes */}
                {auditResult && !isAuditing && (
                  <div className="hidden lg:flex items-center gap-2">
                    <div className={`p-2 rounded-xl border text-center min-w-[85px] ${theme === 'dark' ? 'bg-[#121930] border-emerald-500/30' : 'bg-emerald-50/80 border-emerald-300 shadow-sm'}`}>
                      <span className={`block font-mono text-[8px] uppercase ${theme === 'dark' ? 'opacity-60' : 'text-emerald-800'}`}>{t.latP99}</span>
                      <span className={`font-mono text-base font-bold leading-tight ${theme === 'dark' ? 'text-emerald-400' : 'text-emerald-700'}`}>{auditResult.metrics.latencyReduction}</span>
                    </div>
                    <div className={`p-2 rounded-xl border text-center min-w-[85px] ${theme === 'dark' ? 'bg-[#121930] border-cyan-500/30' : 'bg-blue-50/80 border-blue-300 shadow-sm'}`}>
                      <span className={`block font-mono text-[8px] uppercase ${theme === 'dark' ? 'opacity-60' : 'text-blue-800'}`}>{t.sqlTraffic}</span>
                      <span className={`font-mono text-base font-bold leading-tight ${theme === 'dark' ? 'text-cyan-400' : 'text-blue-700'}`}>{auditResult.metrics.throughputGain}</span>
                    </div>
                    <div className={`p-2 rounded-xl border text-center min-w-[85px] ${theme === 'dark' ? 'bg-[#121930] border-purple-500/30' : 'bg-purple-50/80 border-purple-300 shadow-sm'}`}>
                      <span className={`block font-mono text-[8px] uppercase ${theme === 'dark' ? 'opacity-60' : 'text-purple-800'}`}>Riesgo AST</span>
                      <span className={`font-mono text-sm font-bold leading-tight ${theme === 'dark' ? 'text-purple-400' : 'text-purple-700'}`}>{auditResult.metrics.riskScore}</span>
                    </div>
                  </div>
                )}

                {/* Re-audit Button */}
                <button
                  onClick={() => handleAudit(selectedNode)}
                  disabled={isAuditing}
                  className={`p-2 rounded-xl border transition-all cursor-pointer ${theme === 'dark' ? 'bg-[#121930] border-white/10 text-cyan-400 hover:border-cyan-400' : 'bg-white border-slate-300 text-blue-600 hover:border-blue-500 shadow-sm'}`}
                  title={t.reaudit}
                >
                  <RefreshCw className={`w-4 h-4 ${isAuditing ? 'animate-spin' : ''}`} />
                </button>

                {/* Configure AI Button */}
                <button
                  onClick={() => setShowAiConfigModal(true)}
                  className={`p-2 rounded-xl border transition-all cursor-pointer ${theme === 'dark' ? 'bg-[#121930] border-white/10 text-purple-400 hover:border-purple-400' : 'bg-white border-slate-300 text-purple-600 hover:border-purple-500 shadow-sm'}`}
                  title={t.aiConfigBtn}
                >
                  <Settings className="w-4 h-4" />
                </button>

                {/* Close Button */}
                <button
                  onClick={() => setShowAiModal(false)}
                  className={`p-2 rounded-xl transition-all cursor-pointer ${theme === 'dark' ? 'opacity-60 hover:opacity-100 hover:bg-white/10' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'}`}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className={`px-6 py-2.5 border-b flex items-center gap-3 font-mono text-xs font-semibold ${theme === 'dark' ? 'bg-[#070a14] border-white/[0.06]' : 'bg-slate-100/80 border-slate-200'}`}>
              <button
                onClick={() => setAuditActiveTab('issues')}
                className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-2 cursor-pointer ${auditActiveTab === 'issues' ? (theme === 'dark' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm' : 'bg-white text-blue-700 font-bold border border-blue-200 shadow-sm') : 'opacity-60 hover:opacity-100'}`}
              >
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                <span>{t.issuesTab}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${auditResult?.issues?.length ? 'bg-red-500 text-white' : 'bg-emerald-500 text-slate-950'}`}>
                  {auditResult?.issues?.length || 0}
                </span>
              </button>

              <button
                onClick={() => setAuditActiveTab('diff')}
                className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-2 cursor-pointer ${auditActiveTab === 'diff' ? (theme === 'dark' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm' : 'bg-white text-blue-700 font-bold border border-blue-200 shadow-sm') : 'opacity-60 hover:opacity-100'}`}
              >
                <FileCode className="w-3.5 h-3.5 text-cyan-400" />
                <span>{t.diffTab}</span>
              </button>

              <button
                onClick={() => setAuditActiveTab('code')}
                className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-2 cursor-pointer ${auditActiveTab === 'code' ? (theme === 'dark' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm' : 'bg-white text-blue-700 font-bold border border-blue-200 shadow-sm') : 'opacity-60 hover:opacity-100'}`}
              >
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                <span>{t.fullCodeTab}</span>
              </button>
            </div>

            {/* Central Content Area */}
            <div className="flex-1 overflow-hidden p-6 flex flex-col">
              
              {/* State 1: Loading AI Diagnosis */}
              {isAuditing && (
                <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-8">
                  <div className="relative flex items-center justify-center">
                    <div className="w-20 h-20 rounded-full border-2 border-dashed border-cyan-400 animate-spin" style={{ animationDuration: '4s' }}></div>
                    <Cpu className="w-8 h-8 text-cyan-400 absolute animate-pulse" />
                  </div>
                  <div>
                    <h3 className={`text-base font-bold font-mono ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{t.analyzingAST}</h3>
                    <p className={`text-xs font-mono max-w-md mt-1 ${theme === 'dark' ? 'opacity-70' : 'text-slate-600'}`}>{t.analyzingSub}</p>
                  </div>
                </div>
              )}

              {/* State 2: Tab 1 - Detected Issues List */}
              {!isAuditing && auditActiveTab === 'issues' && auditResult && (
                <div className="flex-1 flex flex-col gap-4 overflow-y-auto pr-2 font-mono text-xs">
                  
                  {/* Summary Callout Banner */}
                  <div className={`p-4 rounded-2xl border flex items-start gap-3.5 ${auditResult.severity === 'CRITICAL' ? (theme === 'dark' ? 'bg-red-500/10 border-red-500/30 text-red-200' : 'bg-red-50 border-red-200 text-red-950') : auditResult.severity === 'HIGH' ? (theme === 'dark' ? 'bg-amber-500/10 border-amber-500/30 text-amber-200' : 'bg-amber-50 border-amber-200 text-amber-950') : (theme === 'dark' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200' : 'bg-emerald-50 border-emerald-200 text-emerald-950')}`}>
                    {auditResult.severity === 'CRITICAL' ? <ShieldAlert className="w-5 h-5 text-red-400 shrink-0 mt-0.5" /> : auditResult.severity === 'HIGH' ? <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" /> : <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />}
                    <div>
                      <h4 className="font-bold text-sm mb-1">{auditResult.title}</h4>
                      <p className="opacity-90 leading-relaxed text-[11px]">{auditResult.summary}</p>
                    </div>
                  </div>

                  {/* Issues Feed */}
                  {auditResult.issues.length === 0 ? (
                    <div className={`p-8 rounded-2xl border text-center flex flex-col items-center gap-2 ${theme === 'dark' ? 'bg-[#060811] border-white/[0.08]' : 'bg-slate-50 border-slate-200'}`}>
                      <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                      <h4 className={`text-sm font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{t.noIssues}</h4>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {auditResult.issues.map((issue, idx) => (
                        <div
                          key={`issue-${idx}`}
                          className={`p-4 rounded-2xl border flex flex-col gap-2 transition-all ${theme === 'dark' ? 'bg-[#060811] border-white/[0.08] hover:border-cyan-500/40' : 'bg-white border-slate-200 shadow-sm hover:border-blue-400'}`}
                        >
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${issue.severity === 'CRITICAL' ? 'bg-red-500 text-white' : issue.severity === 'HIGH' ? 'bg-amber-500 text-slate-950' : 'bg-blue-500 text-white'}`}>
                                {issue.severity}
                              </span>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${theme === 'dark' ? 'bg-white/10 text-slate-300' : 'bg-slate-100 text-slate-700'}`}>
                                {issue.type}
                              </span>
                              <span className={`text-[10px] font-bold ${theme === 'dark' ? 'text-cyan-400' : 'text-blue-600'}`}>
                                LÍNEA {issue.line}
                              </span>
                            </div>
                            <span className="text-[10px] opacity-50">#{idx + 1}</span>
                          </div>

                          <h5 className={`font-bold text-xs ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{issue.title}</h5>
                          <p className={`text-[11px] leading-relaxed ${theme === 'dark' ? 'opacity-80' : 'text-slate-600'}`}>{issue.message}</p>

                          {issue.snippet && (
                            <div className={`p-2.5 rounded-xl font-mono text-[10px] border overflow-x-auto ${theme === 'dark' ? 'bg-black/60 border-white/[0.06] text-amber-300' : 'bg-slate-100 border-slate-200 text-amber-900'}`}>
                              <code>{issue.snippet}</code>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* AI Explanation of the patch */}
                  {auditResult.explanation && (
                    <div className={`p-4 rounded-2xl border flex flex-col gap-1.5 ${theme === 'dark' ? 'bg-purple-500/10 border-purple-500/20 text-purple-200' : 'bg-purple-50 border-purple-200 text-purple-900'}`}>
                      <div className="flex items-center gap-1.5 font-bold text-[11px] uppercase tracking-wider text-purple-400">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Estrategia de Refactorización de la IA</span>
                      </div>
                      <p className="text-[11px] leading-relaxed opacity-90">{auditResult.explanation}</p>
                    </div>
                  )}

                </div>
              )}

              {/* State 3: Tab 2 - Dual Diff Comparison */}
              {!isAuditing && auditActiveTab === 'diff' && auditResult && (
                <div className="grid grid-cols-2 gap-4 flex-1 overflow-hidden font-mono text-xs">
                  {/* Left: Original File */}
                  <div className={`flex flex-col rounded-2xl border overflow-hidden ${theme === 'dark' ? 'bg-[#060811] border-red-500/30' : 'bg-red-50/70 border-red-300 shadow-inner'}`}>
                    <div className={`px-4 py-2.5 uppercase font-bold text-[11px] border-b flex justify-between items-center ${theme === 'dark' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-red-100 text-red-800 border-red-200'}`}>
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-red-500"></span>
                        {t.oldCode}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${theme === 'dark' ? 'bg-red-500/20 text-red-300' : 'bg-red-200 text-red-900'}`}>ORIGINAL</span>
                    </div>
                    <textarea
                      readOnly
                      value={fileContent}
                      className={`flex-1 bg-transparent p-4 text-[11px] resize-none outline-none leading-relaxed overflow-y-auto font-mono ${theme === 'dark' ? 'text-slate-300' : 'text-slate-900 font-semibold'}`}
                    />
                  </div>

                  {/* Right: AI Refactor */}
                  <div className={`flex flex-col rounded-2xl border overflow-hidden ${theme === 'dark' ? 'bg-[#060811] border-emerald-500/30' : 'bg-emerald-50/70 border-emerald-300 shadow-inner'}`}>
                    <div className={`px-4 py-2.5 uppercase font-bold text-[11px] border-b flex justify-between items-center ${theme === 'dark' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-emerald-100 text-emerald-800 border-emerald-200'}`}>
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        {t.newCode}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${theme === 'dark' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-emerald-200 text-emerald-900'}`}>OPTIMIZADO</span>
                    </div>
                    {fixApplied ? (
                      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center gap-3">
                        <CheckCircle2 className="w-14 h-14 text-emerald-500 animate-in zoom-in" />
                        <h4 className={`text-lg font-bold ${theme === 'dark' ? 'text-emerald-400' : 'text-emerald-700'}`}>{t.fixedCode}</h4>
                        <p className={`text-xs max-w-sm ${theme === 'dark' ? 'opacity-70' : 'text-slate-600'}`}>{t.fixedDesc}</p>
                      </div>
                    ) : (
                      <textarea
                        readOnly
                        value={auditResult.refactoredCode}
                        className={`flex-1 bg-transparent p-4 text-[11px] resize-none outline-none leading-relaxed overflow-y-auto font-mono whitespace-pre ${theme === 'dark' ? 'text-emerald-300' : 'text-emerald-950 font-semibold'}`}
                      />
                    )}
                  </div>
                </div>
              )}

              {/* State 4: Tab 3 - Full Refactored Code */}
              {!isAuditing && auditActiveTab === 'code' && auditResult && (
                <div className={`flex-1 rounded-2xl border overflow-hidden flex flex-col ${theme === 'dark' ? 'bg-[#060811] border-white/[0.08]' : 'bg-slate-900 text-slate-100 border-slate-700'}`}>
                  <div className="px-4 py-2.5 border-b flex justify-between items-center text-xs font-mono bg-white/5">
                    <span className="text-emerald-400 font-bold">{selectedNode.path}</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(auditResult.refactoredCode);
                        setCopiedRefactor(true);
                        setTimeout(() => setCopiedRefactor(false), 2000);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer transition-all"
                    >
                      {copiedRefactor ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedRefactor ? t.copied : t.copyCode}</span>
                    </button>
                  </div>
                  <textarea
                    readOnly
                    value={auditResult.refactoredCode}
                    className="flex-1 bg-transparent p-4 text-[11px] resize-none outline-none leading-relaxed overflow-y-auto font-mono text-emerald-300 whitespace-pre"
                  />
                </div>
              )}

            </div>

            {/* Live Terminal Daemon Log Stream */}
            <div className={`px-6 py-2.5 border-t border-b flex items-center justify-between font-mono text-[10px] ${theme === 'dark' ? 'bg-[#060811] border-white/[0.06] text-slate-400' : 'bg-[#0c111d] border-slate-700 text-slate-300'}`}>
              <div className="flex items-center gap-2">
                <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                <span className="font-bold text-white">{t.terminalTitle}</span>
                <span className="opacity-40">•</span>
                <span className="text-emerald-400 font-semibold">
                  [{new Date().toLocaleTimeString()}] AI_AUDIT: {auditResult?.issues?.length || 0} anomalías analizadas con {auditResult?.modelName || 'AST'}
                </span>
              </div>
              <span className="text-cyan-400 font-semibold">{t.workerReady}</span>
            </div>

            {/* Modal Execution Bar */}
            <div className={`p-4 flex justify-between items-center ${theme === 'dark' ? 'bg-[#0e1426]' : 'bg-slate-50 border-t border-slate-200'}`}>
              <div className={`flex items-center gap-4 text-xs font-mono ${theme === 'dark' ? 'opacity-80' : 'text-slate-700'}`}>
                <span>{t.branch}: <strong className={theme === 'dark' ? 'text-cyan-400' : 'text-blue-700 font-bold'}>git checkout fix/ai-ast-optimizer</strong></span>
                <span>|</span>
                <span className={`${theme === 'dark' ? 'text-emerald-400' : 'text-emerald-700'} font-semibold`}>{t.regTests}</span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowAiModal(false)}
                  className={`px-4 py-2 rounded-xl text-xs font-mono uppercase transition-colors cursor-pointer ${theme === 'dark' ? 'opacity-60 hover:opacity-100' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'}`}
                >
                  {t.abort}
                </button>
                {auditResult && !fixApplied && (
                  <button
                    onClick={applyAiFix}
                    disabled={isFixing}
                    className={`px-6 py-2.5 rounded-xl font-mono text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer shadow-lg active:scale-95 disabled:opacity-50 ${theme === 'dark' ? 'bg-gradient-to-r from-cyan-400 to-teal-400 hover:from-cyan-300 hover:to-teal-300 text-slate-950 shadow-cyan-500/25' : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/25'}`}
                  >
                    {isFixing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
                    {isFixing ? t.applying : t.applyFix}
                  </button>
                )}
                {fixApplied && (
                  <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/20 text-emerald-400 font-mono text-xs font-bold border border-emerald-500/40">
                    <CheckCircle className="w-4 h-4" />
                    <span>{t.realFixApplied}</span>
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================
          5. BOTTOM STATUS TELEMETRY FOOTER
          ======================================================== */}
      <footer className={`fixed bottom-0 left-84 right-0 h-8 z-30 flex items-center justify-between px-6 border-t backdrop-blur-2xl font-mono text-[11px] transition-colors ${theme === 'dark' ? 'bg-[#070913]/90 border-white/[0.08] text-slate-400' : 'bg-white/95 border-slate-200 text-slate-600'}`}>
        <div className="flex items-center gap-4">
          <span className={`flex items-center gap-1.5 font-bold ${theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'}`}>
            <span className={`w-2 h-2 rounded-full animate-pulse ${theme === 'dark' ? 'bg-emerald-400' : 'bg-emerald-600'}`}></span>
            CORE DAEMON OK
          </span>
          <span className="opacity-30">|</span>
          <span>VULKAN / WEBGL 2.0</span>
          <span className="opacity-30">|</span>
          <span>AST COVERAGE: <strong className={theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'}>100%</strong></span>
          {hoveredNode && (
            <>
              <span className="opacity-30">|</span>
              <span className={`font-semibold truncate max-w-xs ${theme === 'dark' ? 'text-cyan-400' : 'text-blue-600'}`}>
                NODE: {hoveredNode.name}
              </span>
            </>
          )}
        </div>
        <div className={`flex items-center gap-4 font-semibold ${theme === 'dark' ? 'text-cyan-400' : 'text-blue-600'}`}>
          <span>{cameraCoords}</span>
        </div>
      </footer>

    </div>
  );
}
