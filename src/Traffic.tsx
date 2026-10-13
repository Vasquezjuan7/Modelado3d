import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { BLOCK_PITCH, GRID_RADIUS } from './cityEngine';

export interface TrafficEvent {
  id: string;
  sourceId: string;
  targetId: string;
  status: 'active' | 'bottleneck' | 'done';
  type: 'http' | 'sql';
  progress: number;
  sourcePos: [number, number, number];
  targetPos: [number, number, number];
}

interface TrafficProps {
  events: TrafficEvent[];
  theme?: 'dark' | 'light';
}

interface AmbientCarState {
  id: number;
  pos: THREE.Vector3;
  dir: THREE.Vector3; // (1,0,0), (-1,0,0), (0,0,1), (0,0,-1)
  speed: number;
  color: string;
}

export function TrafficSystem({ events, theme = 'dark' }: TrafficProps) {
  const isDark = theme === 'dark';

  // Generate 20 ambient city cars navigating the avenues
  const ambientCars = useMemo<AmbientCarState[]>(() => {
    const cars: AmbientCarState[] = [];
    const avenueCoords: number[] = [];
    for (let i = -GRID_RADIUS; i <= GRID_RADIUS + 1; i++) {
      avenueCoords.push((i - 0.5) * BLOCK_PITCH);
    }

    const colors = isDark 
      ? ['#63f7ff', '#4edea3', '#ffbe3b', '#e2e8f0', '#00f5ff']
      : ['#334155', '#475569', '#1e293b', '#2563eb', '#dc2626'];

    for (let i = 0; i < 22; i++) {
      const isHorizontal = Math.random() > 0.5;
      const avIdx = Math.floor(Math.random() * avenueCoords.length);
      const avCoord = avenueCoords[avIdx];
      const offset = (Math.random() - 0.5) * (BLOCK_PITCH * (GRID_RADIUS * 2));

      // Lane offset (-1.2 or +1.2 from avenue center)
      const laneOffset = Math.random() > 0.5 ? 1.4 : -1.4;

      const posX = isHorizontal ? offset : avCoord + laneOffset;
      const posZ = isHorizontal ? avCoord + laneOffset : offset;

      const dirX = isHorizontal ? (laneOffset > 0 ? 1 : -1) : 0;
      const dirZ = !isHorizontal ? (laneOffset > 0 ? 1 : -1) : 0;

      cars.push({
        id: i,
        pos: new THREE.Vector3(posX, 0.25, posZ),
        dir: new THREE.Vector3(dirX, 0, dirZ),
        speed: 0.28 + Math.random() * 0.2,
        color: colors[i % colors.length]
      });
    }
    return cars;
  }, [isDark]);

  return (
    <group>
      {/* Ambient Street Traffic */}
      {ambientCars.map((car) => (
        <AmbientVehicle key={car.id} car={car} isDark={isDark} />
      ))}

      {/* Interactive Telemetry Data Packets */}
      {events.map((event) => (
        <DataPacketVehicle key={event.id} event={event} isDark={isDark} />
      ))}
    </group>
  );
}

function AmbientVehicle({ car, isDark }: { car: AmbientCarState; isDark: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  const stateRef = useRef(car);

  const maxBound = (GRID_RADIUS + 1.2) * BLOCK_PITCH;

  useFrame(() => {
    if (!groupRef.current) return;
    const st = stateRef.current;

    st.pos.addScaledVector(st.dir, st.speed);

    // Boundary wrap
    if (st.pos.x > maxBound) st.pos.x = -maxBound;
    if (st.pos.x < -maxBound) st.pos.x = maxBound;
    if (st.pos.z > maxBound) st.pos.z = -maxBound;
    if (st.pos.z < -maxBound) st.pos.z = maxBound;

    groupRef.current.position.copy(st.pos);

    // Point in direction of motion
    if (st.dir.lengthSq() > 0.1) {
      groupRef.current.lookAt(st.pos.clone().add(st.dir));
    }
  });

  return (
    <group ref={groupRef} position={car.pos.toArray()}>
      {/* Car Body Chassis */}
      <mesh position={[0, 0.35, 0]}>
        <boxGeometry args={[1.3, 0.5, 2.6]} />
        <meshStandardMaterial color={car.color} roughness={0.3} metalness={0.7} />
      </mesh>
      {/* Cabin Roof */}
      <mesh position={[0, 0.7, -0.1]}>
        <boxGeometry args={[1.0, 0.42, 1.4]} />
        <meshStandardMaterial color={isDark ? '#05070e' : '#1e293b'} roughness={0.2} metalness={0.9} />
      </mesh>
      {/* Headlights (+Z is forward) */}
      <mesh position={[-0.45, 0.35, 1.32]}>
        <boxGeometry args={[0.2, 0.12, 0.05]} />
        <meshBasicMaterial color={isDark ? '#63f7ff' : '#fef08a'} />
      </mesh>
      <mesh position={[0.45, 0.35, 1.32]}>
        <boxGeometry args={[0.2, 0.12, 0.05]} />
        <meshBasicMaterial color={isDark ? '#63f7ff' : '#fef08a'} />
      </mesh>
      {/* Taillights (-Z is rear) */}
      <mesh position={[-0.45, 0.35, -1.32]}>
        <boxGeometry args={[0.2, 0.12, 0.05]} />
        <meshBasicMaterial color="#ef4444" />
      </mesh>
      <mesh position={[0.45, 0.35, -1.32]}>
        <boxGeometry args={[0.2, 0.12, 0.05]} />
        <meshBasicMaterial color="#ef4444" />
      </mesh>
    </group>
  );
}

function DataPacketVehicle({ event, isDark }: { event: TrafficEvent; isDark: boolean }) {
  const meshRef = useRef<THREE.Group>(null);

  const start = useMemo(() => new THREE.Vector3(...event.sourcePos), [event.sourcePos]);
  const end = useMemo(() => new THREE.Vector3(...event.targetPos), [event.targetPos]);

  const isBottleneck = event.status === 'bottleneck';
  const color = isBottleneck ? '#ef4444' : (isDark ? '#00f5ff' : '#2563eb');

  useFrame(() => {
    if (!meshRef.current) return;

    const p = Math.max(0, Math.min(1, event.progress));
    const currentPos = new THREE.Vector3();
    const direction = new THREE.Vector3();

    // Manhattan road routing: Start -> nearest avenue -> target avenue -> End
    if (p < 0.5) {
      const localP = p * 2;
      currentPos.lerpVectors(start, new THREE.Vector3(end.x, start.y, start.z), localP);
      direction.set(end.x > start.x ? 1 : -1, 0, 0);
    } else {
      const localP = (p - 0.5) * 2;
      currentPos.lerpVectors(new THREE.Vector3(end.x, start.y, start.z), end, localP);
      direction.set(0, 0, end.z > start.z ? 1 : -1);
    }

    currentPos.y = 0.35;
    meshRef.current.position.copy(currentPos);

    if (direction.lengthSq() > 0.1) {
      meshRef.current.lookAt(currentPos.clone().add(direction));
    }
  });

  return (
    <group ref={meshRef}>
      {/* Streamlined Transport Pod */}
      <mesh position={[0, 0.35, 0]}>
        <boxGeometry args={[1.4, 0.65, 2.8]} />
        <meshStandardMaterial 
          color={color} 
          emissive={color} 
          emissiveIntensity={isBottleneck ? 2.5 : 1.2} 
          metalness={0.9} 
          roughness={0.1} 
        />
      </mesh>
      {/* Hazard Siren / Indicator */}
      {isBottleneck && (
        <mesh position={[0, 0.9, 0]}>
          <cylinderGeometry args={[0.2, 0.2, 0.3, 8]} />
          <meshBasicMaterial color="#ff0000" />
        </mesh>
      )}
      {/* Headlights */}
      <mesh position={[-0.45, 0.35, 1.42]}>
        <boxGeometry args={[0.22, 0.14, 0.05]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      <mesh position={[0.45, 0.35, 1.42]}>
        <boxGeometry args={[0.22, 0.14, 0.05]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      {/* Taillights */}
      <mesh position={[-0.45, 0.35, -1.42]}>
        <boxGeometry args={[0.22, 0.14, 0.05]} />
        <meshBasicMaterial color="#ff0055" />
      </mesh>
      <mesh position={[0.45, 0.35, -1.42]}>
        <boxGeometry args={[0.22, 0.14, 0.05]} />
        <meshBasicMaterial color="#ff0055" />
      </mesh>
    </group>
  );
}