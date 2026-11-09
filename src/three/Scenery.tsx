import { useEffect, useLayoutEffect, useMemo, useRef, type ReactNode, type RefObject } from 'react';
import { OrbitControls, Stars, useTexture } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { scatterRocks, type Rock } from '../sim/obstacles';
import { makeRng } from '../sim/rng';
import { planetMapUrl } from '../data';
import { radialGlow } from './Plume';
import { makeTerrain, type Terrain } from '../sim/terrain';
import { useGame } from '../state/store';
import type { ModelId, Surface, World } from '../data/types';
import { Echo } from './Echo';
import { HardwareModel } from './models';
import { prefersReducedMotion } from './GameCanvas';

export const SUN_OFFSET = new THREE.Vector3(38, 46, 22);
const SHADOW_MAP_SIZE = 1024;
const SHADOW_HALF_SPAN = 38;
export const SHADOW_TEXEL = (SHADOW_HALF_SPAN * 2) / SHADOW_MAP_SIZE;

const PALETTE = {
  moon: { low: new THREE.Color('#62626a'), high: new THREE.Color('#bdbcbd'), rock: '#77767b', sky: '#04050a', sun: '#fff6e8', ambient: 0.12, sunIntensity: 3.1 },
  earth: { low: new THREE.Color('#3c6a2c'), high: new THREE.Color('#9ab765'), rock: '#7d786f', sky: '#9fcdf0', sun: '#fff5e2', ambient: 0.62, sunIntensity: 2.7 },
  mars: { low: new THREE.Color('#8a4526'), high: new THREE.Color('#dc9a66'), rock: '#5a3122', sky: '#c99a6d', sun: '#ffe2c0', ambient: 0.75, sunIntensity: 2.1 },
};

function regolith(world: Surface) {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#b8b8b8';
  ctx.fillRect(0, 0, size, size);
  const rng = makeRng(world === 'moon' ? 21 : world === 'mars' ? 34 : 55);
  // Everything is drawn at its wrapped positions too, so the tile has no seams.
  const stamp = (x: number, y: number, r: number, fill: string) => {
    ctx.fillStyle = fill;
    for (const dx of [-size, 0, size]) {
      for (const dy of [-size, 0, size]) {
        ctx.beginPath();
        ctx.arc(x + dx, y + dy, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  };
  for (let i = 0; i < 260; i++) {
    const v = 160 + Math.floor(rng() * 70);
    stamp(rng() * size, rng() * size, 20 + rng() * 60, `rgba(${v},${v},${v},.22)`);
  }
  if (world === 'moon') {
    for (let i = 0; i < 130; i++) {
      const x = rng() * size;
      const y = rng() * size;
      const r = 2 + rng() ** 2 * 15;
      stamp(x - r * 0.15, y - r * 0.15, r * 1.12, 'rgba(236,236,236,.5)');
      stamp(x, y, r, 'rgba(120,120,120,.6)');
    }
  } else if (world === 'earth') {
    for (let i = 0; i < 1500; i++) {
      const v = rng() > 0.5 ? 225 : 120;
      const x = rng() * size;
      const y = rng() * size;
      ctx.strokeStyle = `rgba(${v},${v},${v},.34)`;
      ctx.lineWidth = 1 + rng();
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (rng() - 0.5) * 9, y - 5 - rng() * 9);
      ctx.stroke();
    }
  } else {
    for (let i = 0; i < 70; i++) {
      const y = rng() * size;
      ctx.strokeStyle = `rgba(${130 + i},${130 + i},${130 + i},.13)`;
      ctx.lineWidth = 2 + rng() * 4;
      ctx.beginPath();
      for (let x = -10; x <= size + 10; x += 16) ctx.lineTo(x, y + Math.sin((x / size) * Math.PI * 2 * (1 + (i % 3))) * 9);
      ctx.stroke();
    }
  }
  for (let i = 0; i < 5200; i++) {
    const v = rng() > 0.5 ? 245 : 75;
    stamp(rng() * size, rng() * size, 0.4 + rng() * 1.3, `rgba(${v},${v},${v},.42)`);
  }
  const make = () => {
    const t = new THREE.CanvasTexture(canvas);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(30, 30);
    t.anisotropy = 8;
    return t;
  };
  const map = make();
  map.colorSpace = THREE.SRGBColorSpace;
  return { map, bump: make() };
}

const REGOLITH: Partial<Record<Surface, ReturnType<typeof regolith>>> = {};
const regolithFor = (world: Surface) => (REGOLITH[world] ??= regolith(world));

const sunElevation = (sun: THREE.Vector3) => Math.asin(sun.y / sun.length());

function skyColors(world: Surface, sun: THREE.Vector3) {
  const day = THREE.MathUtils.smoothstep(sunElevation(sun), -0.05, 0.42);
  const [nightHorizon, dayHorizon, nightZenith, dayZenith] = world === 'earth' ? ['#39435c', '#d3e8f6', '#141b36', '#2b76d2'] : ['#5b4a4c', '#d6ab7e', '#1f1a24', '#a87a58'];
  return {
    horizon: new THREE.Color(nightHorizon).lerp(new THREE.Color(dayHorizon), day),
    zenith: new THREE.Color(nightZenith).lerp(new THREE.Color(dayZenith), day),
  };
}

/** A sky with an atmosphere. Mars has the blue glow that really surrounds its Sun; Earth's glow is warm. */
function SkyDome({ sun, world }: { sun: THREE.Vector3; world: Surface }) {
  const ref = useRef<THREE.Mesh>(null);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: { uSun: { value: new THREE.Vector3() }, uHorizon: { value: new THREE.Color() }, uZenith: { value: new THREE.Color() }, uLow: { value: 0 }, uGlow: { value: new THREE.Vector3() } },
        vertexShader: /* glsl */ `
          varying vec3 vDir;
          void main() {
            vDir = normalize(position);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 uSun, uHorizon, uZenith, uGlow;
          uniform float uLow;
          varying vec3 vDir;
          void main() {
            vec3 d = normalize(vDir);
            float up = clamp(d.y, 0.0, 1.0);
            vec3 sky = mix(uHorizon, uZenith, pow(up, 0.55));
            float near = max(dot(d, uSun), 0.0);
            sky += uGlow * pow(near, 14.0) * (0.25 + 0.75 * uLow);
            sky += vec3(1.0, 0.92, 0.82) * smoothstep(0.9994, 0.99985, near);
            gl_FragColor = vec4(sky, 1.0);
            #include <colorspace_fragment>
          }
        `,
      }),
    [],
  );
  useEffect(() => {
    const { horizon, zenith } = skyColors(world, sun);
    if (world === 'earth') material.uniforms.uGlow.value.set(0.6, 0.55, 0.42);
    else material.uniforms.uGlow.value.set(0.26, 0.42, 0.62);
    material.uniforms.uSun.value.copy(sun).normalize();
    material.uniforms.uHorizon.value.copy(horizon);
    material.uniforms.uZenith.value.copy(zenith);
    material.uniforms.uLow.value = 1 - THREE.MathUtils.smoothstep(sunElevation(sun), 0.05, 0.6);
  }, [sun, material, world]);
  useEffect(() => () => material.dispose(), [material]);
  useFrame((state) => ref.current?.position.copy(state.camera.position));
  return (
    <mesh ref={ref} material={material} renderOrder={-1} frustumCulled={false}>
      <sphereGeometry args={[320, 32, 20]} />
    </mesh>
  );
}

function MoonSky({ sun }: { sun: THREE.Vector3 }) {
  const earthMap = useTexture(planetMapUrl('earth'));
  const halo = useMemo(() => new THREE.SpriteMaterial({ map: radialGlow('rgba(255,250,235,1)', 'rgba(255,230,190,.26)'), blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false }), []);
  useEffect(
    () => () => {
      halo.map?.dispose();
      halo.dispose();
    },
    [halo],
  );
  const dir = useMemo(() => sun.clone().normalize().multiplyScalar(300), [sun]);
  return (
    <>
      <color attach="background" args={[PALETTE.moon.sky]} />
      <Stars radius={190} depth={40} count={2600} factor={5} saturation={0} fade speed={0.3} />
      <sprite material={halo} position={dir} scale={46} />
      <mesh position={[-90, 62, -150]} rotation={[0.3, 2.2, 0.2]}>
        <sphereGeometry args={[11, 48, 32]} />
        <meshStandardMaterial map={earthMap} roughness={0.7} emissive="#123a7a" emissiveIntensity={0.14} />
      </mesh>
    </>
  );
}

const HEMISPHERE: Record<Surface, { sky: string; ground: string; strength: number }> = {
  moon: { sky: '#8fa4c8', ground: '#232327', strength: 0.28 },
  mars: { sky: '#ffd9b5', ground: '#70412a', strength: 0.7 },
  earth: { sky: '#c4e0ff', ground: '#587a44', strength: 0.85 },
};

export function Sky({ world, sun = SUN_OFFSET }: { world: Surface; sun?: THREE.Vector3 }) {
  const fogColor = useMemo(() => (world === 'moon' ? '' : `#${skyColors(world, sun).horizon.getHexString()}`), [world, sun]);
  if (world !== 'moon') {
    return (
      <>
        <color attach="background" args={[fogColor]} />
        <fog attach="fog" args={[fogColor, world === 'earth' ? 80 : 45, world === 'earth' ? 280 : 180]} />
        <SkyDome sun={sun} world={world} />
      </>
    );
  }
  return <MoonSky sun={sun} />;
}

export function Lights({ world, sunRef, sun = SUN_OFFSET }: { world: Surface; sunRef?: RefObject<THREE.DirectionalLight | null>; sun?: THREE.Vector3 }) {
  const p = PALETTE[world];
  const day = THREE.MathUtils.smoothstep(sunElevation(sun), -0.02, 0.32);
  const color = useMemo(() => new THREE.Color(p.sun).lerp(new THREE.Color(world === 'mars' ? '#ffb889' : '#fff0dc'), 1 - day), [p.sun, world, day]);
  return (
    <>
      <ambientLight intensity={p.ambient * (0.35 + 0.65 * day)} />
      <hemisphereLight args={[HEMISPHERE[world].sky, HEMISPHERE[world].ground, HEMISPHERE[world].strength * (0.3 + 0.7 * day)]} />
      <directionalLight
        ref={sunRef}
        position={sun}
        intensity={p.sunIntensity * (0.15 + 0.85 * day)}
        color={color}
        castShadow
        shadow-mapSize={[SHADOW_MAP_SIZE, SHADOW_MAP_SIZE]}
        shadow-camera-left={-SHADOW_HALF_SPAN}
        shadow-camera-right={SHADOW_HALF_SPAN}
        shadow-camera-top={SHADOW_HALF_SPAN}
        shadow-camera-bottom={-SHADOW_HALF_SPAN}
        shadow-camera-far={170}
        shadow-bias={-0.0006}
        shadow-normalBias={0.04}
      />
    </>
  );
}

export function TerrainMesh({ terrain, world }: { terrain: Terrain; world: Surface }) {
  const low = useGame((s) => s.quality) === 'low';
  const ground = useMemo(() => regolithFor(world), [world]);
  const geometry = useMemo(() => {
    const seg = low ? 110 : 230;
    const g = new THREE.PlaneGeometry(terrain.size, terrain.size, seg, seg);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    const { low: a, high: b } = PALETTE[world];
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const h = terrain.heightAt(x, z);
      pos.setY(i, h);
      const patches = Math.sin(x * 0.13) * Math.sin(z * 0.17) * 0.09 + Math.sin(x * 0.41 + z * 0.23) * 0.05;
      c.copy(a).lerp(b, THREE.MathUtils.clamp(0.62 + h * 0.09 + patches, 0, 1));
      c.toArray(colors, i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    g.computeVertexNormals();
    return g;
  }, [terrain, world, low]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial vertexColors map={ground.map} bumpMap={ground.bump} bumpScale={1.4} roughness={1} />
    </mesh>
  );
}

function Instanced({ transforms, color, castShadow = false, roughness = 1, children }: { transforms: { p: [number, number, number]; s: [number, number, number] }[]; color: string; castShadow?: boolean; roughness?: number; children: ReactNode }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const o = new THREE.Object3D();
    transforms.forEach((t, i) => {
      o.position.set(...t.p);
      o.scale.set(...t.s);
      o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [transforms]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, transforms.length]} castShadow={castShadow} frustumCulled={false}>
      {children}
      <meshStandardMaterial color={color} roughness={roughness} flatShading />
    </instancedMesh>
  );
}

/** Forest and clouds, so that Earth could never be mistaken for anywhere else. */
export function EarthScenery({ terrain, keepClear }: { terrain: Terrain; keepClear: number }) {
  const { trunks, crowns, clouds } = useMemo(() => {
    const rng = makeRng(77);
    const trunkList: { p: [number, number, number]; s: [number, number, number] }[] = [];
    const crownList: typeof trunkList = [];
    while (crownList.length < 190) {
      const x = (rng() - 0.5) * terrain.size * 0.92;
      const z = (rng() - 0.5) * terrain.size * 0.92;
      if (Math.hypot(x, z) < keepClear) continue;
      const h = 2.2 + rng() * 2.4;
      const y = terrain.heightAt(x, z);
      trunkList.push({ p: [x, y + h * 0.3, z], s: [0.2 * h, h * 0.6, 0.2 * h] });
      crownList.push({ p: [x, y + h * 1.05, z], s: [h * 0.62, h * 0.95, h * 0.62] });
    }
    const puffs: typeof trunkList = [];
    for (let c = 0; c < 24; c++) {
      const cx = (rng() - 0.5) * 420;
      const cz = (rng() - 0.5) * 420 - 40;
      const cy = 62 + rng() * 34;
      for (let n = 0; n < 6; n++) {
        const size = 6 + rng() * 9;
        puffs.push({ p: [cx + (rng() - 0.5) * 34, cy + rng() * 3, cz + (rng() - 0.5) * 16], s: [size * 1.6, size * 0.55, size] });
      }
    }
    return { trunks: trunkList, crowns: crownList, clouds: puffs };
  }, [terrain, keepClear]);
  return (
    <>
      <Instanced transforms={trunks} color="#5b4230"><cylinderGeometry args={[0.7, 1, 1, 6]} /></Instanced>
      <Instanced transforms={crowns} color="#2f6b34" castShadow><coneGeometry args={[1, 1.5, 7]} /></Instanced>
      <Instanced transforms={clouds} color="#ffffff"><sphereGeometry args={[1, 10, 8]} /></Instanced>
    </>
  );
}

let sharedRock: THREE.BufferGeometry | null = null;
/** An icosphere pushed in and out, so rocks look chipped rather than like dice. */
function rockGeometry() {
  if (sharedRock) return sharedRock;
  const g = new THREE.IcosahedronGeometry(1, 2);
  const pos = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const bump = 1 + 0.2 * Math.sin(x * 3.3 + y * 2.1) * Math.cos(z * 4.1 - y) + 0.13 * Math.sin(x * 7.1 - z * 6.3 + y * 5.2);
    pos.setXYZ(i, x * bump, y * bump * 0.82, z * bump);
  }
  g.computeVertexNormals();
  sharedRock = g;
  return g;
}

export function Rocks({ rocks, world }: { rocks: Rock[]; world: Surface }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const o = new THREE.Object3D();
    rocks.forEach((r, i) => {
      o.position.set(r.x, r.y, r.z);
      o.rotation.set(...r.rotation);
      o.scale.set(...r.scale);
      o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [rocks]);
  return (
    <instancedMesh key={rocks.length} ref={ref} args={[undefined, undefined, rocks.length]} castShadow receiveShadow>
      <primitive object={rockGeometry()} attach="geometry" />
      <meshStandardMaterial color={PALETTE[world].rock} roughness={0.95} flatShading />
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
  const rocks = useMemo(() => (terrain ? scatterRocks(terrain, 60, 5, [{ x: 0, z: 0, r: 7 }]) : []), [terrain]);
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
      <Rocks rocks={rocks} world={world} />
      <SlowOrbit radius={model ? 10.5 : 6.5} height={model ? 3.2 : 2.6} target={model ? 0.3 : 0.5} />
      {model && <HardwareModel id={model} />}
      {showEcho && <Echo position={model ? [-3.9, 0, 3.2] : [0, 0, 0]} rotation={[0, model ? -2.2 : 0.6, 0]} />}
    </>
  );
}

/** Interactive model viewer used in the logbook. */
const VIEW_DISTANCE: Partial<Record<ModelId, number>> = { voyager: 11.5, pioneer: 9, ranger: 8, lrrr: 4 };

export function Turntable({ model, world }: { model: ModelId; world: World }) {
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    camera.position.setLength(VIEW_DISTANCE[model] ?? 7);
  }, [camera, model]);
  return (
    <>
      <color attach="background" args={[world === 'mars' ? '#2a1610' : '#0a0c14']} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[6, 9, 6]} intensity={3} castShadow />
      <directionalLight position={[-6, 3, -5]} intensity={0.9} color="#9fb6ff" />
      <HardwareModel id={model} />
      <OrbitControls makeDefault enablePan={false} minDistance={2.5} maxDistance={18} target={[0, 1.3, 0]} autoRotate={!prefersReducedMotion()} autoRotateSpeed={1.1} />
    </>
  );
}
