import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { createCityMaterial } from './cityMaterial';
import { BLOCK, DISTRICTS, LOT, riskColor } from '../lib/cityLayout';
import type { Building, CityModel, DistrictKey } from '../lib/cityLayout';

export type ColorMode = 'district' | 'risk' | 'language';

const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: '#3b82f6', JavaScript: '#facc15', Python: '#38bdf8', Java: '#f97316', Kotlin: '#a855f7', Go: '#22d3ee',
  Rust: '#fb923c', 'C#': '#4ade80', 'C++': '#f472b6', C: '#94a3b8', Ruby: '#ef4444', PHP: '#818cf8', Swift: '#fb7185',
  Dart: '#2dd4bf', Vue: '#34d399', Svelte: '#f97316', HTML: '#f87171', CSS: '#c084fc', SCSS: '#e879f9', SQL: '#10b981',
  JSON: '#a3a3a3', YAML: '#fcd34d', Markdown: '#cbd5e1', Shell: '#84cc16', PowerShell: '#60a5fa',
};
export function languageColor(lang: string): string {
  return LANGUAGE_COLORS[lang] || '#64748b';
}

interface BuildingsProps {
  city: CityModel;
  dark: boolean;
  colorMode: ColorMode;
  riskByPath: Map<string, number>;
  languageByPath: Map<string, string>;
  selectedPath: string | null;
  hoveredPath: string | null;
  highlight: Set<string> | null; // filter / search / dependency focus
  onSelect: (path: string | null) => void;
  onHover: (path: string | null) => void;
}

export function Buildings({ city, dark, colorMode, riskByPath, languageByPath, selectedPath, hoveredPath, highlight, onSelect, onHover }: BuildingsProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const { material, uniforms } = useMemo(() => createCityMaterial({ windows: true, dark }), [dark]);

  const instances = useMemo(() => {
    const list: Array<{ b: Building; tier: number }> = [];
    city.buildings.forEach((b) => b.tiers.forEach((_, t) => list.push({ b, tier: t })));
    return list;
  }, [city]);

  const geometry = useMemo(() => {
    const g = new THREE.BoxGeometry(1, 1, 1);
    const n = instances.length;
    g.setAttribute('aColor', new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(new Float32Array(n), 1));
    g.setAttribute('aState', new THREE.InstancedBufferAttribute(new Float32Array(n), 1));
    return g;
  }, [instances]);

  // matrices + seeds
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const seed = geometry.getAttribute('aSeed') as THREE.InstancedBufferAttribute;
    instances.forEach(({ b, tier }, i) => {
      const t = b.tiers[tier];
      m.makeScale(t.w, t.h, t.d);
      m.setPosition(b.x, t.y + 0.5, b.z);
      mesh.setMatrixAt(i, m);
      seed.setX(i, (b.index * 0.6180339) % 1);
    });
    mesh.instanceMatrix.needsUpdate = true;
    seed.needsUpdate = true;
    mesh.computeBoundingSphere();
    mesh.computeBoundingBox();
  }, [instances, geometry]);

  // colours
  useEffect(() => {
    const col = geometry.getAttribute('aColor') as THREE.InstancedBufferAttribute;
    const c = new THREE.Color();
    instances.forEach(({ b }, i) => {
      const hex = colorMode === 'risk' ? riskColor(riskByPath.get(b.path)) : colorMode === 'language' ? languageColor(languageByPath.get(b.path) || '') : b.color;
      c.set(hex);
      col.setXYZ(i, c.r, c.g, c.b);
    });
    col.needsUpdate = true;
  }, [instances, geometry, colorMode, riskByPath, languageByPath]);

  // interaction state
  useEffect(() => {
    const st = geometry.getAttribute('aState') as THREE.InstancedBufferAttribute;
    instances.forEach(({ b }, i) => {
      let s = 0;
      if (highlight && !highlight.has(b.path)) s = 3;
      if (b.path === hoveredPath) s = 1;
      if (b.path === selectedPath) s = 2;
      st.setX(i, s);
    });
    st.needsUpdate = true;
  }, [instances, geometry, selectedPath, hoveredPath, highlight]);

  useFrame(({ clock }) => {
    uniforms.uTime.value = clock.elapsedTime;
  });

  const pathAt = (e: ThreeEvent<PointerEvent | MouseEvent>) => (e.instanceId !== undefined ? instances[e.instanceId]?.b.path ?? null : null);

  return (
    <instancedMesh
      key={instances.length + (dark ? 'd' : 'l')}
      ref={meshRef}
      args={[geometry, material, instances.length]}
      onPointerMove={(e) => {
        e.stopPropagation();
        const p = pathAt(e);
        if (p !== hoveredPath) onHover(p);
      }}
      onPointerOut={() => onHover(null)}
      onClick={(e) => {
        if (e.delta > 5) return;
        e.stopPropagation();
        onSelect(pathAt(e));
      }}
    />
  );
}

// ---------------------------------------------------------------
// Block plinths (sidewalks) and parks
// ---------------------------------------------------------------
export function Blocks({ city, dark, activeDistrict }: { city: CityModel; dark: boolean; activeDistrict: DistrictKey | null }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const { material } = useMemo(() => createCityMaterial({ windows: false, dark }), [dark]);
  const geometry = useMemo(() => {
    const g = new THREE.BoxGeometry(1, 1, 1);
    const n = city.blocks.length;
    g.setAttribute('aColor', new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(new Float32Array(n), 1));
    g.setAttribute('aState', new THREE.InstancedBufferAttribute(new Float32Array(n), 1));
    return g;
  }, [city]);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const col = geometry.getAttribute('aColor') as THREE.InstancedBufferAttribute;
    const st = geometry.getAttribute('aState') as THREE.InstancedBufferAttribute;
    const c = new THREE.Color();
    city.blocks.forEach((b, i) => {
      m.makeScale(BLOCK, 0.5, BLOCK);
      m.setPosition(b.x, 0.25, b.z);
      mesh.setMatrixAt(i, m);
      c.set(b.park ? '#22c55e' : DISTRICTS[b.district].color);
      col.setXYZ(i, c.r * 0.55, c.g * 0.55, c.b * 0.55);
      st.setX(i, activeDistrict && b.district !== activeDistrict ? 3 : 0);
    });
    mesh.instanceMatrix.needsUpdate = true;
    col.needsUpdate = true;
    st.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [city, geometry, activeDistrict]);

  const parks = city.blocks.filter((b) => b.park);
  const trees = useMemo(() => {
    const out: Array<[number, number, number]> = [];
    parks.forEach((p, pi) => {
      for (let i = 0; i < 14; i++) {
        const a = (i * 2.399 + pi) % (Math.PI * 2);
        const r = 3 + ((i * 37) % 9);
        out.push([p.x + Math.cos(a) * r, 0.5, p.z + Math.sin(a) * r]);
      }
    });
    return out;
  }, [parks]);

  return (
    <group>
      <instancedMesh key={city.blocks.length + (dark ? 'd' : 'l')} ref={meshRef} args={[geometry, material, city.blocks.length]} raycast={() => null} />
      {trees.length > 0 && <Trees positions={trees} dark={dark} />}
    </group>
  );
}

function Trees({ positions, dark }: { positions: Array<[number, number, number]>; dark: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    const m = new THREE.Matrix4();
    positions.forEach((p, i) => {
      const s = 0.8 + ((i * 13) % 7) / 10;
      m.makeScale(s, s * 1.6, s);
      m.setPosition(p[0], p[1] + 1.4 * s, p[2]);
      ref.current?.setMatrixAt(i, m);
    });
    if (ref.current) ref.current.instanceMatrix.needsUpdate = true;
  }, [positions]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, positions.length]} raycast={() => null}>
      <coneGeometry args={[1, 2, 7]} />
      <meshStandardMaterial color={dark ? '#14532d' : '#4ade80'} emissive={dark ? '#16a34a' : '#000000'} emissiveIntensity={dark ? 0.35 : 0} roughness={0.8} />
    </instancedMesh>
  );
}

