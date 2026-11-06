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

