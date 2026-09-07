import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

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
}

export function TrafficSystem({ events }: TrafficProps) {
  return (
    <group>
      {events.map((event) => (
        <Vehicle key={event.id} event={event} />
      ))}
    </group>
  );
}

function Vehicle({ event }: { event: TrafficEvent }) {
  const meshRef = useRef<THREE.Mesh>(null);
  
  const start = new THREE.Vector3(...event.sourcePos);
  start.y += 0.5;
  const end = new THREE.Vector3(...event.targetPos);
  end.y += 0.5;

  const isError = event.status === 'bottleneck';
  const color = isError ? "#ff0033" : "#00ffcc";
  const size = isError ? 0.6 : 0.3; // Larger if error

  useFrame(() => {
    if (meshRef.current) {
      // Add an arc to the trajectory
      const currentPos = new THREE.Vector3().lerpVectors(start, end, event.progress);
      // Parabola equation for the arc height
      const arcHeight = Math.sin(event.progress * Math.PI) * (isError ? 2 : 5); 
      currentPos.y += arcHeight;
      
      meshRef.current.position.copy(currentPos);
    }
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[size, 16, 16]} />
      <meshStandardMaterial 
        color={color} 
        emissive={color} 
        emissiveIntensity={isError ? 5 : 3} 
      />
    </mesh>
  );
}
