import { useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { ThreeElements } from '@react-three/fiber';
import { Cuoi } from './Cuoi';

const fur = new THREE.MeshStandardMaterial({ color: '#d7d2c7', roughness: 0.92, flatShading: true });
const furLight = new THREE.MeshStandardMaterial({ color: '#f0e9db', roughness: 0.9, flatShading: true });
const earInner = new THREE.MeshStandardMaterial({ color: '#b77f78', roughness: 0.9, flatShading: true });
const eye = new THREE.MeshStandardMaterial({ color: '#211d1b', roughness: 0.35 });
const nose = new THREE.MeshStandardMaterial({ color: '#ad6c70', roughness: 0.8 });
const bark = new THREE.MeshStandardMaterial({ color: '#665044', roughness: 1, flatShading: true });
const barkLight = new THREE.MeshStandardMaterial({ color: '#8a684c', roughness: 1, flatShading: true });
const leaf = new THREE.MeshStandardMaterial({ color: '#426b50', roughness: 0.92, flatShading: true });
const leafLight = new THREE.MeshStandardMaterial({ color: '#79966a', roughness: 0.9, flatShading: true, emissive: '#26391e', emissiveIntensity: 0.18 });
const fruit = new THREE.MeshStandardMaterial({ color: '#e9c77d', roughness: 0.65, emissive: '#b88731', emissiveIntensity: 0.45 });
const cuoiSkin = new THREE.MeshStandardMaterial({ color: '#c98d69', roughness: 0.88, flatShading: true });
const cuoiCloth = new THREE.MeshStandardMaterial({ color: '#654632', roughness: 0.96, flatShading: true });
const cuoiClothLight = new THREE.MeshStandardMaterial({ color: '#95704e', roughness: 0.96, flatShading: true });
const cuoiPants = new THREE.MeshStandardMaterial({ color: '#302824', roughness: 0.98, flatShading: true });
const cuoiHair = new THREE.MeshStandardMaterial({ color: '#211a17', roughness: 0.96, flatShading: true });
const cuoiHeadband = new THREE.MeshStandardMaterial({ color: '#754331', roughness: 0.9, flatShading: true });
const cuoiSash = new THREE.MeshStandardMaterial({ color: '#74412e', roughness: 0.95, flatShading: true });
const cuoiSandal = new THREE.MeshStandardMaterial({ color: '#b89360', roughness: 0.92, flatShading: true });
const samplerHandle = new THREE.MeshStandardMaterial({ color: '#a77b4c', roughness: 0.92 });
const scoopMetal = new THREE.MeshStandardMaterial({ color: '#8d9293', roughness: 0.55, metalness: 0.68 });
const cheek = new THREE.MeshStandardMaterial({ color: '#e5a09a', roughness: 0.86, flatShading: true });
const blush = new THREE.MeshStandardMaterial({ color: '#f2b6a9', roughness: 0.9, flatShading: true, transparent: true, opacity: 0.82 });
const moonGold = new THREE.MeshStandardMaterial({ color: '#e8bd62', roughness: 0.68, metalness: 0.08, flatShading: true });
const eyeHighlight = new THREE.MeshBasicMaterial({ color: '#fff7e7' });
const carrot = new THREE.MeshStandardMaterial({ color: '#e5844f', roughness: 0.84, flatShading: true });
const carrotLeaf = new THREE.MeshStandardMaterial({ color: '#6c9b67', roughness: 0.9, flatShading: true });

function Branch({ from, to, radius, material = bark }: { from: [number, number, number]; to: [number, number, number]; radius: number; material?: THREE.Material }) {
  const start = new THREE.Vector3(...from);
  const end = new THREE.Vector3(...to);
  const delta = end.clone().sub(start);
  const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.clone().normalize());
  return <mesh position={start.add(end).multiplyScalar(0.5)} quaternion={quaternion} material={material} castShadow receiveShadow>
    <cylinderGeometry args={[radius * 0.72, radius, delta.length(), 9]} />
  </mesh>;
}

export function MoonRabbit(props: ThreeElements['group']) {
  // Character faces local +Z; the rover's forward direction is local -Z.
  // Keep the rabbit aligned with the rover convoy by turning it toward -Z.
  return <group name="Moon Rabbit" rotation={[0, Math.PI, 0]} {...props}>
    <mesh position={[0, 0.45, 0]} scale={[0.32, 0.39, 0.27]} material={fur} castShadow><sphereGeometry args={[1, 18, 14]} /></mesh>
    <mesh position={[0, 0.42, 0.19]} scale={[0.22, 0.28, 0.12]} material={furLight}><sphereGeometry args={[1, 16, 12]} /></mesh>
    <mesh position={[0, 0.23, 0.02]} scale={[0.23, 0.11, 0.24]} material={furLight} castShadow><sphereGeometry args={[1, 14, 10]} /></mesh>
    <mesh position={[0, 0.91, 0.05]} scale={[0.27, 0.25, 0.24]} material={furLight} castShadow><sphereGeometry args={[1, 18, 14]} /></mesh>
    {[-1, 1].map((side) => <group key={side} position={[side * 0.15, 1.13, 0.02]} rotation={[0, 0, side * -0.18]}>
      <mesh scale={[0.09, 0.28, 0.075]} material={furLight} castShadow><sphereGeometry args={[1, 14, 12]} /></mesh>
      <mesh position={[0, 0.01, 0.064]} scale={[0.047, 0.21, 0.018]} material={earInner}><sphereGeometry args={[1, 12, 10]} /></mesh>
    </group>)}
    {[-1, 1].map((side) => <group key={`face-${side}`}>
      <mesh position={[side * 0.105, 0.94, 0.252]} scale={[0.043, 0.055, 0.024]} material={eye}><sphereGeometry args={[1, 12, 10]} /></mesh>
      <mesh position={[side * 0.18, 0.82, 0.22]} scale={[0.08, 0.05, 0.04]} material={earInner}><sphereGeometry args={[1, 12, 8]} /></mesh>
      <mesh position={[side * 0.20, 0.19, 0.12]} scale={[0.13, 0.1, 0.19]} material={furLight} castShadow><sphereGeometry args={[1, 12, 10]} /></mesh>
    </group>)}
    <mesh position={[0, 0.87, 0.278]} scale={[0.045, 0.032, 0.025]} material={nose}><sphereGeometry args={[1, 12, 10]} /></mesh>
    <mesh position={[0, 0.80, 0.265]} scale={[0.018, 0.06, 0.012]} material={fur}><boxGeometry args={[1, 1, 1]} /></mesh>
    <mesh position={[-0.14, 0.86, 0.238]} scale={[0.048, 0.026, 0.012]} material={cheek}><sphereGeometry args={[1, 12, 8]} /></mesh>
    <mesh position={[0.14, 0.86, 0.238]} scale={[0.048, 0.026, 0.012]} material={cheek}><sphereGeometry args={[1, 12, 8]} /></mesh>
    <mesh position={[-0.105, 0.955, 0.264]} scale={[0.014, 0.014, 0.008]} material={eyeHighlight}><sphereGeometry args={[1, 8, 6]} /></mesh>
    <mesh position={[0.105, 0.955, 0.264]} scale={[0.014, 0.014, 0.008]} material={eyeHighlight}><sphereGeometry args={[1, 8, 6]} /></mesh>
    <mesh position={[0, 0.69, -0.25]} scale={[0.14, 0.14, 0.14]} material={furLight} castShadow><sphereGeometry args={[1, 12, 10]} /></mesh>
    <group position={[0.24, 0.58, 0.12]} rotation={[0, 0, -0.35]}>
      <mesh position={[0, -0.16, 0]} scale={[0.065, 0.16, 0.065]} material={carrot} castShadow><coneGeometry args={[1, 1, 8]} /></mesh>
      <mesh position={[-0.035, 0.02, 0]} rotation={[0, 0, -0.45]} scale={[0.025, 0.09, 0.02]} material={carrotLeaf}><coneGeometry args={[1, 1, 6]} /></mesh>
      <mesh position={[0.035, 0.02, 0]} rotation={[0, 0, 0.45]} scale={[0.025, 0.09, 0.02]} material={carrotLeaf}><coneGeometry args={[1, 1, 6]} /></mesh>
    </group>
  </group>;
}

export function MoonCuoi({ workingRef, movingRef, runningRef, ...props }: ThreeElements['group'] & { workingRef?: RefObject<boolean>; movingRef?: RefObject<boolean>; runningRef?: RefObject<boolean> }) {
  return <group name="Uncle Cuoi" {...props}>
    <Cuoi movingRef={movingRef} workingRef={workingRef} runningRef={runningRef} />
  </group>;
}

export function MoonCuoiLegacy({ workingRef, movingRef, ...props }: ThreeElements['group'] & { workingRef?: RefObject<boolean>; movingRef?: RefObject<boolean> }) {
  const toolArm = useRef<THREE.Group>(null);
  const freeArm = useRef<THREE.Group>(null);
  const leftLeg = useRef<THREE.Group>(null);
  const rightLeg = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const time = clock.elapsedTime;
    const working = workingRef?.current ?? false;
    const moving = movingRef?.current ?? false;
    if (toolArm.current) toolArm.current.rotation.x = working ? -0.8 + Math.sin(time * 9) * 0.28 : moving ? -0.12 + Math.sin(time * 7) * 0.12 : -0.12;
    if (freeArm.current) freeArm.current.rotation.x = moving ? Math.sin(time * 7 + Math.PI) * 0.22 : 0;
    if (leftLeg.current) leftLeg.current.rotation.x = working ? 0.38 : moving ? Math.sin(time * 7) * 0.28 : 0;
    if (rightLeg.current) rightLeg.current.rotation.x = working ? 0.38 : moving ? Math.sin(time * 7 + Math.PI) * 0.28 : 0;
  });

  return <group name="Uncle Cuoi" {...props}>
    <mesh position={[0, 0.35, 0]} scale={[0.24, 0.34, 0.17]} material={cuoiPants} castShadow><capsuleGeometry args={[0.15, 0.38, 5, 9]} /></mesh>
    {[-1, 1].map((side) => <group key={`leg-${side}`} ref={side < 0 ? leftLeg : rightLeg} position={[side * 0.12, 0.18, 0]}>
      <mesh position={[side * 0.025, -0.12, 0]} scale={[0.09, 0.24, 0.1]} material={cuoiPants} castShadow><capsuleGeometry args={[0.085, 0.23, 4, 8]} /></mesh>
      <mesh position={[0, -0.27, 0.06]} scale={[0.1, 0.045, 0.16]} material={cuoiSandal} castShadow><boxGeometry args={[1, 1, 1]} /></mesh>
      <mesh position={[0, -0.24, 0.08]} scale={[0.12, 0.035, 0.045]} material={cuoiSandal}><boxGeometry args={[1, 1, 1]} /></mesh>
    </group>)}
    <mesh position={[0, 0.88, 0]} scale={[0.38, 0.43, 0.23]} material={cuoiCloth} castShadow><capsuleGeometry args={[0.22, 0.53, 5, 10]} /></mesh>
    <mesh position={[0, 0.63, 0.05]} rotation={[0, 0, -0.04]} scale={[0.4, 0.08, 0.25]} material={cuoiClothLight} castShadow><boxGeometry args={[1, 1, 1]} /></mesh>
    <mesh position={[0, 0.65, 0.19]} scale={[0.3, 0.045, 0.025]} material={cuoiSash} castShadow><boxGeometry args={[1, 1, 1]} /></mesh>
    {[0.78, 0.94, 1.1].map((y) => <mesh key={`button-${y}`} position={[0, y, 0.235]} scale={[0.026, 0.026, 0.018]} material={moonGold} castShadow><sphereGeometry args={[1, 10, 8]} /></mesh>)}
    <mesh position={[0.1, 0.46, 0.2]} rotation={[0, 0, -0.2]} scale={[0.12, 0.3, 0.035]} material={cuoiSash} castShadow><boxGeometry args={[1, 1, 1]} /></mesh>
    <mesh position={[0.12, 1.06, 0.22]} rotation={[0, 0, -0.36]} scale={[0.13, 0.43, 0.025]} material={cuoiClothLight} castShadow><boxGeometry args={[1, 1, 1]} /></mesh>
    {Array.from({ length: 5 }, (_, index) => <mesh key={`scarf-${index}`} position={[0.12, 0.77 + index * 0.12, 0.248]} scale={[0.13, 0.014, 0.006]} material={index % 2 ? cuoiCloth : cuoiSandal}><boxGeometry args={[1, 1, 1]} /></mesh>)}
    <mesh position={[0, 1.53, 0.03]} scale={[0.25, 0.28, 0.23]} material={cuoiSkin} castShadow><sphereGeometry args={[1, 16, 12]} /></mesh>
    <mesh position={[0, 1.68, 0]} scale={[0.24, 0.16, 0.22]} material={cuoiHair} castShadow><sphereGeometry args={[1, 14, 10]} /></mesh>
    <mesh position={[0, 1.57, 0.22]} scale={[0.24, 0.07, 0.035]} material={cuoiHeadband} castShadow><boxGeometry args={[1, 1, 1]} /></mesh>
    <mesh position={[-0.2, 1.52, 0]} rotation={[0.12, 0, -0.12]} scale={[0.06, 0.23, 0.045]} material={cuoiHeadband} castShadow><boxGeometry args={[1, 1, 1]} /></mesh>
    {[-1, 1].map((side) => <group key={`face-${side}`}>
      <mesh position={[side * 0.09, 1.55, 0.23]} scale={[0.035, 0.045, 0.018]} material={eye}><sphereGeometry args={[1, 12, 10]} /></mesh>
      <mesh position={[side * 0.078, 1.568, 0.246]} scale={[0.011, 0.011, 0.007]} material={eyeHighlight}><sphereGeometry args={[1, 8, 6]} /></mesh>
      <mesh position={[side * 0.19, 1.45, 0.227]} scale={[0.052, 0.026, 0.012]} material={blush}><sphereGeometry args={[1, 12, 8]} /></mesh>
      <mesh position={[side * 0.255, 1.52, 0.02]} scale={[0.04, 0.06, 0.035]} material={cuoiSkin}><sphereGeometry args={[1, 10, 8]} /></mesh>
    </group>)}
    <mesh position={[0, 1.49, 0.25]} scale={[0.035, 0.018, 0.02]} material={cuoiSash}><sphereGeometry args={[1, 10, 8]} /></mesh>
    <mesh position={[0, 1.41, 0.238]} rotation={[0, 0, Math.PI]} scale={[0.07, 0.035, 0.012]} material={cuoiHeadband}><torusGeometry args={[1, 0.34, 6, 12, Math.PI]} /></mesh>
    <group ref={toolArm} position={[-0.25, 1.14, 0]}>
      <mesh position={[0, -0.25, 0.02]} rotation={[0.08, 0, 0.18]} scale={[0.085, 0.28, 0.09]} material={cuoiClothLight} castShadow><capsuleGeometry args={[0.07, 0.27, 4, 8]} /></mesh>
      <mesh position={[-0.03, -0.47, 0.1]} scale={[0.065, 0.065, 0.065]} material={cuoiSkin} castShadow><sphereGeometry args={[1, 10, 8]} /></mesh>
      <mesh position={[-0.1, -0.48, 0.13]} rotation={[0.15, 0, Math.PI / 2]} scale={[0.025, 0.34, 0.025]} material={samplerHandle} castShadow><cylinderGeometry args={[1, 1, 1, 8]} /></mesh>
      <mesh position={[-0.1, -0.28, 0.13]} rotation={[0.08, 0, 0.18]} scale={[0.16, 0.035, 0.1]} material={scoopMetal} castShadow><boxGeometry args={[1, 1, 1]} /></mesh>
    </group>
    <group ref={freeArm} position={[0.27, 1.12, 0]} rotation={[0, 0, -0.35]}>
      <mesh position={[0, -0.24, 0]} scale={[0.07, 0.26, 0.075]} material={cuoiClothLight} castShadow><capsuleGeometry args={[0.06, 0.25, 4, 8]} /></mesh>
      <mesh position={[0, -0.42, 0.05]} scale={[0.055, 0.055, 0.055]} material={cuoiSkin} castShadow><sphereGeometry args={[1, 10, 8]} /></mesh>
    </group>
  </group>;
}

export function BanyanTree(props: ThreeElements['group']) {
  return <group name="Moon Banyan Tree" {...props}>
    <mesh position={[0, 0.96, 0]} scale={[0.36, 1.08, 0.34]} material={bark} castShadow receiveShadow><cylinderGeometry args={[0.25, 0.5, 1.9, 12]} /></mesh>
    <mesh position={[0, 1.48, 0]} scale={[0.9, 0.22, 0.82]} material={barkLight} castShadow><sphereGeometry args={[1, 16, 10]} /></mesh>
    {[-1, 1].flatMap((side) => [-1, 1].map((depth) => <group key={`${side}-${depth}`}>
      <Branch from={[side * 0.1, 1.25, depth * 0.1]} to={[side * 0.78, 2.05, depth * 0.55]} radius={0.16} material={barkLight} />
      <Branch from={[side * 0.5, 1.76, depth * 0.35]} to={[side * 1.15, 2.16, depth * 0.52]} radius={0.095} />
      <Branch from={[side * 0.58, 1.35, depth * 0.3]} to={[side * 0.62, 0.16, depth * 0.36]} radius={0.055} material={barkLight} />
    </group>))}
    {[-1, 1].map((side) => <Branch key={`high-${side}`} from={[0, 1.9, 0]} to={[side * 0.48, 2.65, 0]} radius={0.13} material={barkLight} />)}
    {[
      [-1.05, 2.28, -0.2, 0.58], [-0.55, 2.72, 0.16, 0.62], [0, 2.82, -0.15, 0.66],
      [0.63, 2.65, 0.18, 0.66], [1.12, 2.28, -0.12, 0.58], [-0.82, 2.08, 0.48, 0.55],
      [0.02, 2.35, 0.56, 0.72], [0.82, 2.08, 0.46, 0.55],
    ].map(([x, y, z, size], index) => <mesh key={`crown-${index}`} position={[x, y, z]} scale={[size, size * 0.72, size * 0.72]} material={index % 2 ? leafLight : leaf} castShadow receiveShadow>
      <sphereGeometry args={[1, 14, 10]} />
    </mesh>)}
    {[
      [-0.48, 2.92, 0.48], [0.18, 2.64, 0.62], [0.72, 2.38, 0.50], [-0.86, 2.36, 0.35],
    ].map(([x, y, z], index) => <mesh key={`fruit-${index}`} position={[x, y, z]} material={fruit} castShadow>
      <sphereGeometry args={[0.045, 10, 8]} />
    </mesh>)}
  </group>;
}
