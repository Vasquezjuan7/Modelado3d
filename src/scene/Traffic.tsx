import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { QuadraticBezierLine } from '@react-three/drei';
import * as THREE from 'three';
import type { CityModel } from '../lib/cityLayout';
import type { DependencyEdge } from '../lib/codeMetrics';

export type TrafficMode = 'off' | 'live' | 'stress';

export interface TrafficStats {
  packetsPerSec: number;
  p99: number;
  congested: number;
  inFlight: number;
}

// ---------------------------------------------------------------
// Ambient cars driving along every road
// ---------------------------------------------------------------
export function AmbientCars({ city, dark }: { city: CityModel; dark: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const cars = useMemo(() => {
    const roads = [
      ...city.roadsZ.map((z) => ({ axis: 'x' as const, c: z, min: city.bounds.minX, max: city.bounds.maxX })),
      ...city.roadsX.map((x) => ({ axis: 'z' as const, c: x, min: city.bounds.minZ, max: city.bounds.maxZ })),
    ];
    const count = Math.min(260, roads.length * 5);
    const palette = dark ? ['#e2e8f0', '#fbbf24', '#38bdf8', '#f472b6', '#a3e635'] : ['#1e293b', '#dc2626', '#2563eb', '#f8fafc', '#0f766e'];
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    return Array.from({ length: count }, (_, i) => {
      const r = roads[i % roads.length];
      const dir = rnd() > 0.5 ? 1 : -1;
      return { ...r, dir, lane: dir * 1.7, t: r.min + rnd() * (r.max - r.min), speed: 7 + rnd() * 9, color: palette[i % palette.length] };
    });
  }, [city, dark]);

  useLayoutEffect(() => {
    const c = new THREE.Color();
    cars.forEach((car, i) => ref.current?.setColorAt(i, c.set(car.color)));
    if (ref.current?.instanceColor) ref.current.instanceColor.needsUpdate = true;
  }, [cars]);

  const m = useMemo(() => new THREE.Matrix4(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const s = useMemo(() => new THREE.Vector3(1.1, 0.7, 2.3), []);
  const p = useMemo(() => new THREE.Vector3(), []);
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), []);

  useFrame((_, dt) => {
    const mesh = ref.current;
    if (!mesh) return;
    const step = Math.min(dt, 0.05);
    cars.forEach((car, i) => {
      car.t += car.dir * car.speed * step;
      if (car.t > car.max) car.t = car.min;
      if (car.t < car.min) car.t = car.max;
      if (car.axis === 'x') {
        p.set(car.t, 0.45, car.c + car.lane);
        q.setFromAxisAngle(up, car.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
      } else {
        p.set(car.c - car.lane, 0.45, car.t);
        q.setFromAxisAngle(up, car.dir > 0 ? 0 : Math.PI);
      }
      m.compose(p, q, s);
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, cars.length]} raycast={() => null}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial toneMapped={!dark} />
    </instancedMesh>
  );
}

