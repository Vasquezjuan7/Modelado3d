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

// ---------------------------------------------------------------
// Data packets travelling along real import dependencies
// ---------------------------------------------------------------
interface Packet {
  pts: THREE.Vector3[];
  segLen: number[];
  total: number;
  d: number;
  speed: number;
  bottleneck: boolean;
  color: THREE.Color;
  bornAt: number;
}

const MAX_PACKETS = 420;

function nearest(list: number[], v: number) {
  let best = list[0];
  for (const x of list) if (Math.abs(x - v) < Math.abs(best - v)) best = x;
  return best;
}

export function DataPackets({
  city,
  edges,
  mode,
  hotPaths,
  onStats,
}: {
  city: CityModel;
  edges: DependencyEdge[];
  mode: TrafficMode;
  hotPaths: Set<string>; // files with N+1 / perf findings
  onStats: (s: TrafficStats) => void;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const packets = useRef<Packet[]>([]);
  const spawnAcc = useRef(0);
  const statAcc = useRef({ t: 0, delivered: 0, latencies: [] as number[] });

  const routes = useMemo(() => {
    let list = edges.filter((e) => city.byPath.has(e.from) && city.byPath.has(e.to));
    if (list.length < 10) {
      // No resolvable imports (e.g. non-JS repos): synthesize traffic between districts
      const b = city.buildings;
      const synth: DependencyEdge[] = [];
      for (let i = 0; i < Math.min(200, b.length * 2); i++) {
        const a = b[(i * 7919) % b.length];
        const c = b[(i * 104729 + 13) % b.length];
        if (a !== c) synth.push({ from: a.path, to: c.path });
      }
      list = list.concat(synth);
    }
    return list;
  }, [edges, city]);

  const hotRoutes = useMemo(() => {
    const dataPaths = new Set(city.buildings.filter((b) => b.district === 'data').map((b) => b.path));
    const r = routes.filter((e) => hotPaths.has(e.from) || dataPaths.has(e.to));
    return r.length ? r : routes.slice(0, 20);
  }, [routes, hotPaths, city]);

  useEffect(() => {
    packets.current = [];
  }, [city, mode]);

  useLayoutEffect(() => {
    const c = new THREE.Color('#ffffff');
    for (let i = 0; i < MAX_PACKETS; i++) ref.current?.setColorAt(i, c);
  }, []);

  const makePacket = (e: DependencyEdge, bottleneck: boolean, now: number): Packet | null => {
    const a = city.byPath.get(e.from);
    const b = city.byPath.get(e.to);
    if (!a || !b) return null;
    const rz = nearest(city.roadsZ, a.z);
    const rx = nearest(city.roadsX, b.x);
    const y = 0.9;
    const pts = [
      new THREE.Vector3(a.x, y, a.z),
      new THREE.Vector3(a.x, y, rz),
      new THREE.Vector3(rx, y, rz),
      new THREE.Vector3(rx, y, b.z),
      new THREE.Vector3(b.x, y, b.z),
    ];
    const segLen = pts.slice(1).map((p, i) => p.distanceTo(pts[i]));
    const total = segLen.reduce((s, v) => s + v, 0);
    if (total < 1) return null;
    return {
      pts, segLen, total, d: 0,
      speed: bottleneck ? 9 + Math.random() * 4 : 34 + Math.random() * 18,
      bottleneck,
      color: new THREE.Color(bottleneck ? '#ff2d55' : a.color),
      bornAt: now,
    };
  };

  const m = useMemo(() => new THREE.Matrix4(), []);
  const pos = useMemo(() => new THREE.Vector3(), []);
  const scl = useMemo(() => new THREE.Vector3(), []);
  const quat = useMemo(() => new THREE.Quaternion(), []);
  const hidden = useMemo(() => new THREE.Matrix4().makeScale(0, 0, 0), []);

  useFrame(({ clock }, dt) => {
    const mesh = ref.current;
    if (!mesh) return;
    const step = Math.min(dt, 0.05);
    const now = clock.elapsedTime;

    if (mode !== 'off' && routes.length) {
      const rate = mode === 'stress' ? 70 : 22; // packets per second
      spawnAcc.current += rate * step;
      while (spawnAcc.current >= 1 && packets.current.length < MAX_PACKETS) {
        spawnAcc.current -= 1;
        const stress = mode === 'stress' && Math.random() < 0.65;
        const e = stress ? hotRoutes[Math.floor(Math.random() * hotRoutes.length)] : routes[Math.floor(Math.random() * routes.length)];
        const p = makePacket(e, stress, now);
        if (p) packets.current.push(p);
      }
    }

    // congestion slows bottleneck packets further when many share the road
    const bottlenecks = packets.current.filter((p) => p.bottleneck).length;
    const congestion = 1 / (1 + bottlenecks / 60);

    const alive: Packet[] = [];
    for (const p of packets.current) {
      p.d += p.speed * step * (p.bottleneck ? congestion : 1);
      if (p.d >= p.total) {
        statAcc.current.delivered++;
        statAcc.current.latencies.push((now - p.bornAt) * (p.bottleneck ? 120 : 9));
        continue;
      }
      alive.push(p);
    }
    packets.current = alive;

    const c = new THREE.Color();
    for (let i = 0; i < MAX_PACKETS; i++) {
      const p = alive[i];
      if (!p) {
        mesh.setMatrixAt(i, hidden);
        continue;
      }
      let d = p.d;
      let seg = 0;
      while (seg < p.segLen.length - 1 && d > p.segLen[seg]) {
        d -= p.segLen[seg];
        seg++;
      }
      const a = p.pts[seg];
      const b = p.pts[seg + 1];
      const t = p.segLen[seg] > 0 ? Math.min(1, d / p.segLen[seg]) : 1;
      pos.lerpVectors(a, b, t);
      const alongX = Math.abs(b.x - a.x) > Math.abs(b.z - a.z);
      const size = p.bottleneck ? 1.1 : 0.75;
      scl.set(alongX ? 2.4 : size, size, alongX ? size : 2.4);
      m.compose(pos, quat, scl);
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, c.copy(p.color).multiplyScalar(2.2));
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

    statAcc.current.t += step;
    if (statAcc.current.t >= 0.6) {
      const lat = statAcc.current.latencies.sort((x, y) => x - y);
      const p99 = lat.length ? lat[Math.min(lat.length - 1, Math.floor(lat.length * 0.99))] : 0;
      onStats({
        packetsPerSec: Math.round(statAcc.current.delivered / statAcc.current.t),
        p99: Math.round(p99),
        congested: bottlenecks,
        inFlight: alive.length,
      });
      statAcc.current = { t: 0, delivered: 0, latencies: [] };
    }
  });

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, MAX_PACKETS]} frustumCulled={false} raycast={() => null}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  );
}

// ---------------------------------------------------------------
// Dependency arcs for the selected building
// ---------------------------------------------------------------
export function DependencyArcs({ city, edges, selected, dark }: { city: CityModel; edges: DependencyEdge[]; selected: string | null; dark: boolean }) {
  const arcs = useMemo(() => {
    if (!selected) return [];
    const src = city.byPath.get(selected);
    if (!src) return [];
    const out: Array<{ key: string; start: THREE.Vector3; end: THREE.Vector3; mid: THREE.Vector3; color: string }> = [];
    for (const e of edges) {
      if (e.from !== selected && e.to !== selected) continue;
      const other = city.byPath.get(e.from === selected ? e.to : e.from);
      if (!other) continue;
      const start = new THREE.Vector3(src.x, src.h + 1, src.z);
      const end = new THREE.Vector3(other.x, other.h + 1, other.z);
      const dist = start.distanceTo(end);
      const mid = start.clone().lerp(end, 0.5);
      mid.y = Math.max(start.y, end.y) + 6 + dist * 0.25;
      out.push({ key: e.from + '>' + e.to, start, end, mid, color: e.from === selected ? (dark ? '#22d3ee' : '#0284c7') : (dark ? '#fbbf24' : '#d97706') });
      if (out.length >= 80) break;
    }
    return out;
  }, [city, edges, selected, dark]);

  return (
    <group>
      {arcs.map((a) => (
        <QuadraticBezierLine key={a.key} start={a.start} end={a.end} mid={a.mid} color={a.color} lineWidth={2} transparent opacity={0.9} dashed={false} />
      ))}
    </group>
  );
}
