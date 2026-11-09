import { useEffect, useLayoutEffect, useMemo, useRef, type ReactNode, type RefObject } from 'react';
import { OrbitControls, Stars } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { makeRng } from '../sim/rng';
import { makeTerrain, type Terrain } from '../sim/terrain';
import { useGame } from '../state/store';
import type { ModelId, World } from '../data/types';
import { Echo } from './Echo';
import { HardwareModel } from './models';
import { prefersReducedMotion } from './GameCanvas';

export const SUN_OFFSET = new THREE.Vector3(38, 46, 22);

const PALETTE = {
  moon: { low: new THREE.Color('#4f4f55'), high: new THREE.Color('#a8a7a8'), rock: '#77767b', sky: '#04050a', sun: '#fff6e8', ambient: 0.12, sunIntensity: 3.1 },
  mars: { low: new THREE.Color('#7a3c21'), high: new THREE.Color('#d08a55'), rock: '#5a3122', sky: '#c99a6d', sun: '#ffe2c0', ambient: 0.75, sunIntensity: 2.1 },
};

export function Sky({ world }: { world: 'moon' | 'mars' }) {
  if (world === 'mars') {
    return (
      <>
        <color attach="background" args={[PALETTE.mars.sky]} />
        <fog attach="fog" args={[PALETTE.mars.sky, 40, 175]} />
      </>
    );
  }
  return (
    <>
      <color attach="background" args={[PALETTE.moon.sky]} />
      <Stars radius={190} depth={40} count={2600} factor={5} saturation={0} fade speed={0.3} />
      <group position={[-90, 62, -150]}>
        <mesh>
          <sphereGeometry args={[11, 32, 24]} />
          <meshStandardMaterial color="#2f6fd1" emissive="#1e4fa5" emissiveIntensity={0.55} roughness={0.7} />
        </mesh>
        <mesh scale={1.012} position={[0.5, 0.3, 0.3]}>
          <sphereGeometry args={[11, 14, 10]} />
          <meshStandardMaterial color="#f3f6fb" transparent opacity={0.28} roughness={1} flatShading />
        </mesh>
      </group>
    </>
  );
}

export function Lights({ world, sunRef }: { world: 'moon' | 'mars'; sunRef?: RefObject<THREE.DirectionalLight | null> }) {
  const p = PALETTE[world];
  return (
    <>
      <ambientLight intensity={p.ambient} />
      <hemisphereLight args={[world === 'mars' ? '#ffd9b5' : '#8fa4c8', world === 'mars' ? '#70412a' : '#232327', world === 'mars' ? 0.7 : 0.28]} />
      <directionalLight
        ref={sunRef}
        position={SUN_OFFSET}
        intensity={p.sunIntensity}
        color={p.sun}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-38}
        shadow-camera-right={38}
        shadow-camera-top={38}
        shadow-camera-bottom={-38}
        shadow-camera-far={160}
        shadow-bias={-0.0006}
      />
    </>
  );
}

export function TerrainMesh({ terrain, world }: { terrain: Terrain; world: 'moon' | 'mars' }) {
  const low = useGame((s) => s.quality) === 'low';
  const geometry = useMemo(() => {
    const seg = low ? 90 : 150;
    const g = new THREE.PlaneGeometry(terrain.size, terrain.size, seg, seg);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    const { low: a, high: b } = PALETTE[world];
    for (let i = 0; i < pos.count; i++) {
      const h = terrain.heightAt(pos.getX(i), pos.getZ(i));
      pos.setY(i, h);
      c.copy(a).lerp(b, THREE.MathUtils.clamp(0.55 + h * 0.11 + Math.sin(i * 12.9898) * 0.045, 0, 1));
      c.toArray(colors, i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    g.computeVertexNormals();
    return g;
  }, [terrain, world, low]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial vertexColors flatShading roughness={1} />
    </mesh>
  );
}

export function Rocks({ terrain, world, count, seed, clear = [] }: { terrain: Terrain; world: 'moon' | 'mars'; count: number; seed: number; clear?: { x: number; z: number; r: number }[] }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const rng = makeRng(seed);
    const o = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      let x = 0;
      let z = 0;
      let s = 0;
      do {
        x = (rng() - 0.5) * terrain.size * 0.95;
        z = (rng() - 0.5) * terrain.size * 0.95;
        s = 0.12 + rng() ** 3 * 1.5;
      } while (clear.some((f) => Math.hypot(f.x - x, f.z - z) < f.r + s));
      o.position.set(x, terrain.heightAt(x, z) + s * 0.1, z);
      o.rotation.set(rng() * 6, rng() * 6, rng() * 6);
      o.scale.set(s, s * (0.55 + rng() * 0.5), s * (0.7 + rng() * 0.5));
      o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, [terrain, count, seed, clear]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]} castShadow receiveShadow>
      <dodecahedronGeometry args={[1, 0]} />
      <meshStandardMaterial color={PALETTE[world].rock} roughness={1} flatShading />
    </instancedMesh>
  );
}

function SlowOrbit({ radius, height, target }: { radius: number; height: number; target: number }) {
  useFrame((state) => {
    // A gentle sway, not a full circle, so Echo never drifts in front of the machine.
    const a = 0.7 + (prefersReducedMotion() ? 0 : Math.sin(state.clock.elapsedTime * 0.13) * 0.32);
    state.camera.position.set(Math.sin(a) * radius, height, Math.cos(a) * radius);
    state.camera.lookAt(0, target, 0);
  });
  return null;
}

function Drift({ children }: { children: ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (ref.current && !prefersReducedMotion()) ref.current.rotation.y += dt * 0.14;
  });
  return <group ref={ref}>{children}</group>;
}

export function DeepSpace() {
  return (
    <>
      <color attach="background" args={['#03040a']} />
      <Stars radius={120} depth={60} count={3600} factor={5} saturation={0.1} fade speed={0.4} />
      <ambientLight intensity={0.34} />
      <directionalLight position={[10, 6, 8]} intensity={3} color="#fff4df" />
    </>
  );
}

/** A slowly orbiting scene behind dialogue: the machine in focus, with Echo beside it. */
export function Diorama({ world, model, showEcho = true }: { world: World; model: ModelId | null; showEcho?: boolean }) {
  const terrain = useMemo(() => (world === 'deep' ? null : makeTerrain({ seed: 77, size: 110, amplitude: world === 'moon' ? 3 : 4.5, craterCount: world === 'moon' ? 22 : 6, flat: [{ x: 0, z: 0, r: 9 }] })), [world]);
  if (world === 'deep') {
    return (
      <>
        <DeepSpace />
        <SlowOrbit radius={7.6} height={1.2} target={0.2} />
        <Drift>{model ? <HardwareModel id={model} /> : <Echo position={[0, 0, 0]} />}</Drift>
      </>
    );
  }
  return (
    <>
      <Sky world={world} />
      <Lights world={world} />
      <TerrainMesh terrain={terrain!} world={world} />
      <Rocks terrain={terrain!} world={world} count={60} seed={5} clear={[{ x: 0, z: 0, r: 7 }]} />
      <SlowOrbit radius={model ? 10.5 : 6.5} height={model ? 3.2 : 2.6} target={model ? 0.3 : 0.5} />
      {model && <HardwareModel id={model} />}
      {showEcho && <Echo position={model ? [-3.9, 0, 3.2] : [0, 0, 0]} rotation={[0, model ? -2.2 : 0.6, 0]} />}
    </>
  );
}

/** Interactive model viewer used in the logbook. */
export function Turntable({ model, world }: { model: ModelId; world: World }) {
  return (
    <>
      <color attach="background" args={[world === 'mars' ? '#2a1610' : '#0a0c14']} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[6, 9, 6]} intensity={3} castShadow />
      <directionalLight position={[-6, 3, -5]} intensity={0.9} color="#9fb6ff" />
      <HardwareModel id={model} />
      <OrbitControls makeDefault enablePan={false} minDistance={4} maxDistance={15} target={[0, 1.3, 0]} autoRotate={!prefersReducedMotion()} autoRotateSpeed={1.1} />
    </>
  );
}
