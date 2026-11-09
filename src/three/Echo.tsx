import { forwardRef, useRef } from 'react';
import { useFrame, type ThreeElements } from '@react-three/fiber';
import * as THREE from 'three';
import { prefersReducedMotion } from './GameCanvas';

const CREAM = new THREE.MeshStandardMaterial({ color: '#f4ead7', roughness: 0.55 });
const ORANGE = new THREE.MeshStandardMaterial({ color: '#ff6a2b', roughness: 0.45 });
const DARK = new THREE.MeshStandardMaterial({ color: '#22242c', roughness: 0.8 });
const LENS = new THREE.MeshStandardMaterial({ color: '#0b0e16', roughness: 0.15, metalness: 0.4 });
const GLOW = new THREE.MeshStandardMaterial({ color: '#7ff0d4', emissive: '#37e6c0', emissiveIntensity: 2.2 });

function Wheel({ x, z }: { x: number; z: number }) {
  return (
    <mesh position={[x, 0.34, z]} rotation={[0, 0, Math.PI / 2]} material={DARK} castShadow>
      <cylinderGeometry args={[0.34, 0.34, 0.26, 14]} />
    </mesh>
  );
}

/** Echo: a stubby four-wheeled archive rover with one ring-lit eye and a dish that listens. */
export const Echo = forwardRef<THREE.Group, ThreeElements['group'] & { active?: boolean }>(function Echo({ active = true, ...props }, ref) {
  const dish = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!active || prefersReducedMotion()) return;
    const t = state.clock.elapsedTime;
    if (dish.current) dish.current.rotation.y = Math.sin(t * 0.9) * 0.6;
    if (ring.current) ring.current.scale.setScalar(1 + Math.sin(t * 4) * 0.05);
  });
  return (
    <group ref={ref} {...props}>
      <Wheel x={-0.62} z={-0.62} />
      <Wheel x={0.62} z={-0.62} />
      <Wheel x={-0.62} z={0.62} />
      <Wheel x={0.62} z={0.62} />
      <mesh position={[0, 0.62, 0]} material={DARK} castShadow>
        <boxGeometry args={[1, 0.16, 1.5]} />
      </mesh>
      <mesh position={[0, 1.1, 0.06]} material={CREAM} castShadow>
        <boxGeometry args={[1.14, 0.82, 1.2]} />
      </mesh>
      <mesh position={[0, 1.54, 0.06]} material={ORANGE} castShadow>
        <boxGeometry args={[1.2, 0.08, 1.26]} />
      </mesh>
      <mesh position={[0, 1.12, -0.56]} rotation={[Math.PI / 2, 0, 0]} material={LENS}>
        <cylinderGeometry args={[0.32, 0.32, 0.08, 24]} />
      </mesh>
      <mesh ref={ring} position={[0, 1.12, -0.61]} material={GLOW}>
        <torusGeometry args={[0.24, 0.045, 10, 28]} />
      </mesh>
      <group ref={dish} position={[0.26, 1.58, 0.4]}>
        <mesh position={[0, 0.3, 0]} material={DARK}>
          <cylinderGeometry args={[0.03, 0.03, 0.6, 8]} />
        </mesh>
        <mesh position={[0, 0.72, 0]} rotation={[Math.PI * 0.72, 0, 0]} material={ORANGE} castShadow>
          <coneGeometry args={[0.36, 0.2, 18, 1, true]} />
        </mesh>
        <mesh position={[0, 0.76, 0.02]} material={GLOW}>
          <sphereGeometry args={[0.05, 10, 10]} />
        </mesh>
      </group>
    </group>
  );
});
