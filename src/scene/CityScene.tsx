import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, OrbitControls } from '@react-three/drei';
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { Blocks, Buildings, Landmarks, Roads } from './CityMeshes';
import type { ColorMode } from './CityMeshes';
import { AmbientCars, DataPackets, DependencyArcs } from './Traffic';
import type { TrafficMode, TrafficStats } from './Traffic';
import { DISTRICTS } from '../lib/cityLayout';
import type { CityModel, DistrictKey } from '../lib/cityLayout';
import type { DependencyEdge } from '../lib/codeMetrics';

export type CameraCommand =
  | { kind: 'preset'; preset: 'iso' | 'top' | 'front'; nonce: number }
  | { kind: 'focus'; path: string; nonce: number }
  | { kind: 'district'; key: DistrictKey; nonce: number };

export interface CitySceneProps {
  city: CityModel;
  edges: DependencyEdge[];
  dark: boolean;
  lang: 'es' | 'en';
  colorMode: ColorMode;
  riskByPath: Map<string, number>;
  languageByPath: Map<string, string>;
  selectedPath: string | null;
  hoveredPath: string | null;
  highlight: Set<string> | null;
  activeDistrict: DistrictKey | null;
  showLabels: boolean;
  showArcs: boolean;
  traffic: TrafficMode;
  hotPaths: Set<string>;
  cameraCommand: CameraCommand | null;
  autoRotate: boolean;
  quality: 'high' | 'low';
  onSelect: (p: string | null) => void;
  onHover: (p: string | null) => void;
  onTrafficStats: (s: TrafficStats) => void;
}

function CameraRig({ city, command }: { city: CityModel; command: CameraCommand | null }) {
  const { camera, controls } = useThree() as unknown as { camera: THREE.PerspectiveCamera; controls: OrbitControlsImpl | null };
  const goal = useRef<{ pos: THREE.Vector3; target: THREE.Vector3 } | null>(null);
  const size = Math.max(city.bounds.maxX - city.bounds.minX, city.bounds.maxZ - city.bounds.minZ, 80);

  const presetFor = (preset: 'iso' | 'top' | 'front') => {
    const r = size * 0.85 + city.maxHeight * 0.6;
    if (preset === 'top') return { pos: new THREE.Vector3(0, r * 1.45, 0.01), target: new THREE.Vector3(0, 0, 0) };
    if (preset === 'front') return { pos: new THREE.Vector3(0, city.maxHeight * 0.55 + 12, r * 1.1), target: new THREE.Vector3(0, city.maxHeight * 0.3, 0) };
    return { pos: new THREE.Vector3(r * 0.72, r * 0.62, r * 0.82), target: new THREE.Vector3(0, city.maxHeight * 0.12, 0) };
  };

  // initial framing whenever a new city is loaded
  useEffect(() => {
    const p = presetFor('iso');
    camera.position.copy(p.pos.clone().multiplyScalar(1.6));
    goal.current = p;
    camera.far = Math.max(4000, size * 12);
    camera.updateProjectionMatrix();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city]);

  useEffect(() => {
    if (!command) return;
    if (command.kind === 'preset') goal.current = presetFor(command.preset);
    if (command.kind === 'focus') {
      const b = city.byPath.get(command.path);
      if (b) {
        const dist = 26 + b.h * 1.1;
        goal.current = { pos: new THREE.Vector3(b.x + dist * 0.75, b.h * 0.7 + dist * 0.55, b.z + dist * 0.9), target: new THREE.Vector3(b.x, b.h * 0.45, b.z) };
      }
    }
    if (command.kind === 'district') {
      const d = city.districts.find((x) => x.key === command.key);
      if (d) {
        const span = Math.max(d.maxX - d.minX, d.maxZ - d.minZ) + 40;
        goal.current = { pos: new THREE.Vector3(d.center[0] + span * 0.6, span * 0.75, d.center[1] + span * 0.8), target: new THREE.Vector3(d.center[0], 4, d.center[1]) };
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [command]);

  useFrame((_, dt) => {
    if (!goal.current || !controls) return;
    const k = 1 - Math.pow(0.0025, Math.min(dt, 0.05));
    camera.position.lerp(goal.current.pos, k);
    controls.target.lerp(goal.current.target, k);
    controls.update();
    if (camera.position.distanceTo(goal.current.pos) < 0.5 && controls.target.distanceTo(goal.current.target) < 0.5) goal.current = null;
  });

  // user interaction cancels the animation
  useEffect(() => {
    if (!controls) return;
    const cancel = () => (goal.current = null);
    controls.addEventListener('start', cancel);
    return () => controls.removeEventListener('start', cancel);
  }, [controls]);

  return null;
}

function DistrictLabels({ city, dark, lang, activeDistrict }: { city: CityModel; dark: boolean; lang: 'es' | 'en'; activeDistrict: DistrictKey | null }) {
  return (
    <>
      {city.districts.map((d) => {
        const def = DISTRICTS[d.key];
        const faded = activeDistrict && activeDistrict !== d.key;
        return (
          <Html key={d.key} position={[d.center[0], Math.min(city.maxHeight, 40) + 10, d.center[1]]} center zIndexRange={[10, 0]} style={{ pointerEvents: 'none', opacity: faded ? 0.25 : 1, transition: 'opacity .3s' }}>
            <div className={`whitespace-nowrap rounded-full border px-3 py-1 text-center backdrop-blur-md ${dark ? 'border-white/10 bg-black/55' : 'border-slate-300/70 bg-white/80 shadow-sm'}`}>
              <div className="flex items-center gap-2 text-[11px] font-semibold tracking-wide" style={{ color: dark ? def.color : '#0f172a' }}>
                <span className="h-2 w-2 rounded-full" style={{ background: def.color, boxShadow: `0 0 10px ${def.color}` }} />
                {def.name[lang]}
                <span className={`font-mono text-[10px] font-normal ${dark ? 'text-slate-400' : 'text-slate-500'}`}>{d.count}</span>
              </div>
            </div>
          </Html>
        );
      })}
    </>
  );
}

function HoverTag({ city, path, dark, lang }: { city: CityModel; path: string; dark: boolean; lang: 'es' | 'en' }) {
  const b = city.byPath.get(path);
  if (!b) return null;
  return (
    <Html position={[b.x, b.h + 2.5, b.z]} center zIndexRange={[20, 10]} style={{ pointerEvents: 'none' }}>
      <div className={`whitespace-nowrap rounded-lg border px-2.5 py-1.5 font-mono text-[11px] shadow-xl backdrop-blur-md ${dark ? 'border-white/15 bg-[#0b0f1a]/90 text-slate-100' : 'border-slate-200 bg-white/95 text-slate-800'}`}>
        <span className="font-semibold" style={{ color: dark ? b.color : undefined }}>{b.name}</span>
        <span className="ml-2 opacity-60">{b.lines.toLocaleString()} {lang === 'es' ? 'líneas' : 'lines'}</span>
      </div>
    </Html>
  );
}

function SelectionBeam({ city, path }: { city: CityModel; path: string | null }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (ref.current) (ref.current.material as THREE.MeshBasicMaterial).opacity = 0.18 + 0.1 * Math.sin(clock.elapsedTime * 3);
  });
  const b = path ? city.byPath.get(path) : null;
  if (!b) return null;
  const h = 160;
  return (
    <mesh ref={ref} position={[b.x, h / 2, b.z]} raycast={() => null}>
      <cylinderGeometry args={[Math.max(b.w, b.d) * 0.55, Math.max(b.w, b.d) * 0.75, h, 24, 1, true]} />
      <meshBasicMaterial color={b.color} transparent opacity={0.2} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
    </mesh>
  );
}

