import { forwardRef, useRef, type RefObject } from 'react';
import { RoundedBox } from '@react-three/drei';
import { useFrame, type ThreeElements } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { prefersReducedMotion } from './GameCanvas';

const CREAM = new THREE.MeshStandardMaterial({ color: '#d8d5c7', roughness: 0.8, metalness: 0.1 });
const ORANGE = new THREE.MeshStandardMaterial({ color: '#c85b32', roughness: 0.72, metalness: 0.15 });
const DARK = new THREE.MeshStandardMaterial({ color: '#22242c', roughness: 0.72, metalness: 0.2 });
const RIM = new THREE.MeshStandardMaterial({ color: '#b4b7be', roughness: 0.3, metalness: 0.85 });
const LENS = new THREE.MeshStandardMaterial({ color: '#0b0e16', roughness: 0.12, metalness: 0.5 });
const GLOW = new THREE.MeshStandardMaterial({ color: '#7ff0d4', emissive: '#37e6c0', emissiveIntensity: 2.2 });
const PANEL = new THREE.MeshStandardMaterial({ color: '#a5aaa5', roughness: 0.82, metalness: 0.18 });
const LUGS = Array.from({ length: 14 }, (_, i) => (i / 14) * Math.PI * 2);
const TREAD = mergeGeometries(LUGS.flatMap((a) => [-1, 1].map((s) => {
  const g = new THREE.BoxGeometry(0.15, 0.045, 0.065);
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(0, Math.cos(a) * 0.335, Math.sin(a) * 0.335),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(-a, 0, 0)),
    new THREE.Vector3(1, 1, 1),
  );
  const local = new THREE.Matrix4().compose(new THREE.Vector3(s * 0.075, 0, 0), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, s * 0.25, 0)), new THREE.Vector3(1, 1, 1));
  g.applyMatrix4(m.multiply(local));
  return g;
})));

function Strut({ from, to, radius = 0.035 }: { from: [number, number, number]; to: [number, number, number]; radius?: number }) {
  const start = new THREE.Vector3(...from), end = new THREE.Vector3(...to);
  const delta = end.clone().sub(start);
  const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.clone().normalize());
  return <mesh position={start.add(end).multiplyScalar(0.5)} quaternion={quaternion} material={RIM} castShadow><cylinderGeometry args={[radius, radius, delta.length(), 8]} /></mesh>;
}

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
        <mesh position={[side * 0.18, 0, 0]} rotation={[0, 0, Math.PI / 2]} material={DARK}>
          <cylinderGeometry args={[0.055, 0.055, 0.045, 12]} />
        </mesh>
        <mesh geometry={TREAD} material={DARK} />
      </group>
    </group>
  );
}

/** KaraokeNhacTre retains Echo's mounting points and animated wheel interface. */
export const KaraokeNhacTre = forwardRef<THREE.Group, ThreeElements['group'] & { active?: boolean; wheelAngle?: RefObject<number> }>(function KaraokeNhacTre({ active = true, wheelAngle, ...props }, ref) {
  const dish = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!active || prefersReducedMotion()) return;
    const t = state.clock.elapsedTime;
    if (dish.current) dish.current.rotation.y = Math.sin(t * 0.9) * 0.6;
    if (ring.current) ring.current.scale.setScalar(1 + Math.sin(t * 4) * 0.05);
  });
  return (
    <group name="KaraokeNhacTre" ref={ref} {...props}>
      <Wheel x={-0.62} z={-0.62} angle={wheelAngle} />
      <Wheel x={0.62} z={-0.62} angle={wheelAngle} />
      <Wheel x={-0.62} z={0.62} angle={wheelAngle} />
      <Wheel x={0.62} z={0.62} angle={wheelAngle} />
      <RoundedBox args={[1.12, 0.14, 1.56]} radius={0.05} smoothness={3} position={[0, 0.62, 0]} material={DARK} castShadow />
      {[-1, 1].map((s) => (
        <group key={s} name="suspension">
          <Strut from={[s * 0.48, 0.67, -0.4]} to={[s * 0.62, 0.36, -0.62]} />
          <Strut from={[s * 0.48, 0.67, 0.4]} to={[s * 0.62, 0.36, 0.62]} />
          <Strut from={[s * 0.62, 0.36, -0.62]} to={[s * 0.62, 0.36, 0.62]} radius={0.027} />
          <mesh position={[s * 0.56, 0.58, 0]} rotation={[0, 0, Math.PI / 2]} material={DARK}><cylinderGeometry args={[0.095, 0.095, 0.1, 12]} /></mesh>
        </group>
      ))}
      <RoundedBox args={[1.14, 0.82, 1.2]} radius={0.12} smoothness={4} position={[0, 1.1, 0.06]} material={CREAM} castShadow />
      <RoundedBox args={[1.2, 0.09, 1.26]} radius={0.04} smoothness={3} position={[0, 1.54, 0.06]} material={ORANGE} castShadow />
      <mesh position={[0, 0.98, 0.67]} material={ORANGE}>
        <boxGeometry args={[0.62, 0.05, 0.02]} />
      </mesh>
      {[-1, 1].map((s) => (
        <group key={s} name="side-instruments">
          <RoundedBox args={[0.04, 0.54, 0.82]} radius={0.025} position={[s * 0.575, 1.12, 0.05]} material={PANEL} />
          {[-0.22, 0.13, 0.38].map((z) => <mesh key={z} position={[s * 0.599, 1.12, z]} material={DARK}><boxGeometry args={[0.01, 0.42, 0.018]} /></mesh>)}
          <mesh position={[s * 0.602, 1.2, 0.05]} material={ORANGE}><boxGeometry args={[0.016, 0.1, 0.16]} /></mesh>
          {[0.84, 1.38].map((y) => [-0.29, 0.39].map((z) => <mesh key={`${y}-${z}`} position={[s * 0.6, y, z]} rotation={[0, 0, Math.PI / 2]} material={RIM}><cylinderGeometry args={[0.025, 0.025, 0.018, 8]} /></mesh>))}
        </group>
      ))}
      <group name="deck-equipment">
        <RoundedBox args={[0.42, 0.22, 0.42]} radius={0.035} position={[-0.28, 1.7, 0.20]} material={PANEL} castShadow />
        <RoundedBox args={[0.38, 0.06, 0.35]} radius={0.02} position={[-0.28, 1.83, 0.20]} material={DARK} />
        <Strut from={[-0.48, 1.58, -0.43]} to={[-0.48, 1.93, -0.43]} radius={0.025} />
        <mesh position={[-0.48, 1.95, -0.43]} material={ORANGE}><sphereGeometry args={[0.045, 10, 8]} /></mesh>
      </group>
      <mesh position={[0, 1.12, -0.56]} rotation={[Math.PI / 2, 0, 0]} material={RIM}>
        <cylinderGeometry args={[0.36, 0.36, 0.06, 28]} />
      </mesh>
      <mesh position={[0, 1.12, -0.58]} rotation={[Math.PI / 2, 0, 0]} material={LENS}>
        <cylinderGeometry args={[0.31, 0.31, 0.08, 28]} />
      </mesh>
      <mesh ref={ring} position={[0, 1.12, -0.63]} material={GLOW}>
        <torusGeometry args={[0.24, 0.045, 12, 36]} />
      </mesh>
      <group name="camera-mast">
        <RoundedBox args={[0.24, 0.10, 0.22]} radius={0.03} position={[-0.3, 1.61, -0.36]} material={DARK} />
        <Strut from={[-0.30, 1.66, -0.36]} to={[-0.30, 2.04, -0.39]} radius={0.045} />
        <RoundedBox args={[0.52, 0.18, 0.20]} radius={0.035} position={[-0.30, 2.08, -0.42]} material={PANEL} castShadow />
        {[-0.44, -0.17].map((x) => <group key={x}>
          <mesh position={[x, 2.08, -0.53]} rotation={[Math.PI / 2, 0, 0]} material={DARK}><cylinderGeometry args={[0.065, 0.065, 0.025, 12]} /></mesh>
          <mesh position={[x, 2.08, -0.55]} rotation={[Math.PI / 2, 0, 0]} material={LENS}><cylinderGeometry args={[0.043, 0.043, 0.015, 12]} /></mesh>
        </group>)}
      </group>
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
