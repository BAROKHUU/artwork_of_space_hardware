import { forwardRef, useRef, type RefObject } from 'react';
import { RoundedBox } from '@react-three/drei';
import { useFrame, type ThreeElements } from '@react-three/fiber';
import * as THREE from 'three';
import { prefersReducedMotion } from './GameCanvas';

const CREAM = new THREE.MeshStandardMaterial({ color: '#f4ead7', roughness: 0.42, metalness: 0.08 });
const ORANGE = new THREE.MeshStandardMaterial({ color: '#ff6a2b', roughness: 0.38, metalness: 0.15 });
const DARK = new THREE.MeshStandardMaterial({ color: '#22242c', roughness: 0.72, metalness: 0.2 });
const RIM = new THREE.MeshStandardMaterial({ color: '#b4b7be', roughness: 0.3, metalness: 0.85 });
const LENS = new THREE.MeshStandardMaterial({ color: '#0b0e16', roughness: 0.12, metalness: 0.5 });
const GLOW = new THREE.MeshStandardMaterial({ color: '#7ff0d4', emissive: '#37e6c0', emissiveIntensity: 2.2 });
const LUGS = Array.from({ length: 10 }, (_, i) => (i / 10) * Math.PI * 2);

/** A rubber tyre with tread lugs and a metal hub, so that rolling is visible. */
function Wheel({ x, z, angle }: { x: number; z: number; angle?: RefObject<number> }) {
  const spin = useRef<THREE.Group>(null);
  useFrame(() => {
    if (spin.current && angle) spin.current.rotation.x = -angle.current;
  });
  const side = x < 0 ? -1 : 1;
  return (
    <group position={[x, 0.36, z]}>
      <group ref={spin}>
        <mesh rotation={[0, 0, Math.PI / 2]} material={DARK} castShadow>
          <cylinderGeometry args={[0.33, 0.33, 0.3, 24]} />
        </mesh>
        <mesh position={[side * 0.16, 0, 0]} rotation={[0, 0, Math.PI / 2]} material={RIM}>
          <cylinderGeometry args={[0.18, 0.18, 0.03, 18]} />
        </mesh>
        <mesh position={[side * 0.18, 0, 0]} material={ORANGE}>
          <boxGeometry args={[0.02, 0.26, 0.05]} />
        </mesh>
        {LUGS.map((a) => (
          <mesh key={a} position={[0, Math.cos(a) * 0.335, Math.sin(a) * 0.335]} rotation={[-a, 0, 0]} material={DARK} castShadow>
            <boxGeometry args={[0.31, 0.05, 0.07]} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/** Echo: a stubby four-wheeled archive rover with one ring-lit eye and a dish that listens. */
export const Echo = forwardRef<THREE.Group, ThreeElements['group'] & { active?: boolean; wheelAngle?: RefObject<number> }>(function Echo({ active = true, wheelAngle, ...props }, ref) {
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
      <Wheel x={-0.62} z={-0.62} angle={wheelAngle} />
      <Wheel x={0.62} z={-0.62} angle={wheelAngle} />
      <Wheel x={-0.62} z={0.62} angle={wheelAngle} />
      <Wheel x={0.62} z={0.62} angle={wheelAngle} />
      <RoundedBox args={[1.12, 0.14, 1.56]} radius={0.05} smoothness={3} position={[0, 0.62, 0]} material={DARK} castShadow />
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.62, 0.36, 0]} rotation={[Math.PI / 2, 0, 0]} material={RIM}>
          <cylinderGeometry args={[0.035, 0.035, 1.24, 8]} />
        </mesh>
      ))}
      <RoundedBox args={[1.14, 0.82, 1.2]} radius={0.12} smoothness={4} position={[0, 1.1, 0.06]} material={CREAM} castShadow />
      <RoundedBox args={[1.2, 0.09, 1.26]} radius={0.04} smoothness={3} position={[0, 1.54, 0.06]} material={ORANGE} castShadow />
      <mesh position={[0, 0.98, 0.67]} material={ORANGE}>
        <boxGeometry args={[0.62, 0.05, 0.02]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.575, 1.1, 0.06]} material={DARK}>
          <boxGeometry args={[0.012, 0.3, 0.72]} />
        </mesh>
      ))}
      <mesh position={[0, 1.12, -0.56]} rotation={[Math.PI / 2, 0, 0]} material={RIM}>
        <cylinderGeometry args={[0.36, 0.36, 0.06, 28]} />
      </mesh>
      <mesh position={[0, 1.12, -0.58]} rotation={[Math.PI / 2, 0, 0]} material={LENS}>
        <cylinderGeometry args={[0.31, 0.31, 0.08, 28]} />
      </mesh>
      <mesh ref={ring} position={[0, 1.12, -0.63]} material={GLOW}>
        <torusGeometry args={[0.24, 0.045, 12, 36]} />
      </mesh>
      <group ref={dish} position={[0.26, 1.58, 0.4]}>
        <mesh position={[0, 0.3, 0]} material={RIM}>
          <cylinderGeometry args={[0.03, 0.03, 0.6, 10]} />
        </mesh>
        <mesh position={[0, 0.72, 0]} rotation={[Math.PI * 0.72, 0, 0]} material={ORANGE} castShadow>
          <coneGeometry args={[0.36, 0.2, 24, 1, true]} />
        </mesh>
        <mesh position={[0, 0.76, 0.02]} material={GLOW}>
          <sphereGeometry args={[0.05, 12, 12]} />
        </mesh>
      </group>
    </group>
  );
});
