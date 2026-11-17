import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Surface } from '../data/types';
import { ENGINE_MOUNTS, type EngineVehicle } from './models';

const MAX_FLAME = 2.5;
const NOISE_GLSL = /* glsl */ `
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }
  float fbm(vec2 p) { return 0.55 * noise(p) + 0.3 * noise(p * 2.1) + 0.15 * noise(p * 4.3); }
`;

/** A soft round glow, shared by flames and the Sun. */
export function radialGlow(inner: string, outer: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, inner);
  g.addColorStop(0.35, outer);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Soft procedural billowing smoke puff texture shared by thrusters and rover wheel dust. */
export function smokeTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const lobes = [
    [64, 64, 52, 0.36],
    [48, 56, 36, 0.28],
    [80, 58, 34, 0.26],
    [60, 44, 32, 0.24],
    [66, 76, 34, 0.22],
  ] as const;
  for (const [x, y, r, alpha] of lobes) {
    const g = ctx.createRadialGradient(x, y, 2, x, y, r);
    g.addColorStop(0, `rgba(255,255,255,${alpha})`);
    g.addColorStop(0.55, `rgba(255,255,255,${alpha * 0.45})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function flameMaterial(core: number) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uFire: { value: 0 }, uLength: { value: 1 }, uCore: { value: core }, uSpread: { value: 1 }, uGround: { value: 0 } },
    vertexShader: /* glsl */ `
      uniform float uTime, uLength, uSpread, uGround, uCore;
      varying vec2 vUv;
      varying vec3 vNormalView, vView;
      void main() {
        vUv = uv;
        vec3 p = position;
        float v = uv.y;
        float seed = modelMatrix[3].x * 7.0 + modelMatrix[3].z * 3.0;
        // Vacuum/low-air plumes bell outward; ground impingement fans the lower jet into a splash sheet.
        float flare = mix(1.0, uSpread, v * (1.0 - 0.35 * uCore)) * (1.0 + pow(v, 2.2) * 1.45 * uGround);
        float wave = 1.0 + 0.14 * v * sin(uTime * 42.0 + v * 11.0 + seed);
        p.xz *= flare * wave;
        p.x += 0.032 * v * sin(uTime * 25.0 + seed);
        p.z += 0.025 * v * cos(uTime * 21.0 + seed);
        p.y *= uLength;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vNormalView = normalize(normalMatrix * normal);
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime, uFire, uCore;
      varying vec2 vUv;
      varying vec3 vNormalView, vView;
      ${NOISE_GLSL}
      void main() {
        float v = vUv.y;
        float facing = pow(abs(dot(normalize(vNormalView), normalize(vView))), 1.45);
        float streaks = fbm(vec2(vUv.x * 16.0, v * 4.2 - uTime * 9.5));
        // Mach shock diamonds along the supersonic core.
        float diamondWave = pow(0.5 + 0.5 * cos(v * 34.0 - uTime * 16.0), 5.0) * exp(-v * 2.2);
        float diamonds = mix(0.86 + 0.14 * sin(v * 24.0 - uTime * 4.0), 0.72 + 0.85 * diamondWave, uCore);
        float body = facing * pow(1.0 - v, 1.18) * (0.52 + 0.82 * streaks) * diamonds;
        vec3 hot = mix(vec3(1.0, 0.9, 0.68), vec3(0.76, 0.91, 1.0), uCore);
        vec3 mid = vec3(1.0, 0.5, 0.14);
        vec3 tail = vec3(0.72, 0.13, 0.04);
        vec3 color = mix(hot, mid, smoothstep(0.06, 0.44, v));
        color = mix(color, tail, smoothstep(0.44, 0.95, v));
        color += vec3(0.35, 0.45, 0.65) * diamondWave * uCore;
        gl_FragColor = vec4(color * (1.55 + uCore * 1.15), clamp(body * uFire, 0.0, 1.0));
        #include <colorspace_fragment>
      }
    `,
  });
}

function bellGeometry(width: number) {
  const profile = [[0.1, 0], [0.17, -0.06], [0.24, -0.2], [0.26, -0.38], [0.2, -0.62], [0.11, -0.84], [0, -1]].map(([r, y]) => new THREE.Vector2(r * width, y));
  const smooth = new THREE.SplineCurve(profile).getPoints(22);
  return new THREE.LatheGeometry(smooth, 20);
}

/** Exhaust from each engine of a lander. `fire` runs 0 to 1, and `height` is the craft's height above the ground. */
export function Engines({ vehicle, world = 'moon', fire, height }: { vehicle: EngineVehicle; world?: Surface; fire: RefObject<number>; height: RefObject<number> }) {
  const mounts = ENGINE_MOUNTS[vehicle];
  const light = useRef<THREE.PointLight>(null);
  const glows = useRef<(THREE.Sprite | null)[]>([]);
  const spread = world === 'moon' ? 1.42 : world === 'mars' ? 1.08 : 0.88;
  const parts = useMemo(() => {
    const glow = radialGlow('rgba(255,248,230,1)', 'rgba(255,138,48,.58)');
    return {
      outerGeometry: bellGeometry(1.05),
      innerGeometry: bellGeometry(0.42),
      outer: flameMaterial(0),
      inner: flameMaterial(1),
      glow,
      sprite: new THREE.SpriteMaterial({ map: glow, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false }),
    };
  }, []);

  useEffect(
    () => () => {
      parts.outerGeometry.dispose();
      parts.innerGeometry.dispose();
      parts.outer.dispose();
      parts.inner.dispose();
      parts.glow.dispose();
      parts.sprite.dispose();
    },
    [parts],
  );

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const f = fire.current;
    const flicker = 0.88 + Math.sin(t * 61) * 0.07 + Math.sin(t * 37) * 0.05;
    const ground = THREE.MathUtils.smoothstep(2.6 - height.current, 0, 2.6);
    for (const m of [parts.outer, parts.inner]) {
      m.uniforms.uTime.value = t;
      m.uniforms.uFire.value = f;
      m.uniforms.uSpread.value = spread;
      m.uniforms.uGround.value = ground;
    }
    // The flame stops at the ground rather than passing through it.
    const room = Math.max(0.15, height.current + mounts[0].y);
    parts.outer.uniforms.uLength.value = Math.min(room, MAX_FLAME * (0.65 + 0.35 * f) * flicker);
    parts.inner.uniforms.uLength.value = Math.min(room, MAX_FLAME * 0.56 * flicker);
    parts.sprite.opacity = f * 0.98;
    for (const g of glows.current) g?.scale.setScalar((0.88 + ground * 0.3) * flicker);
    if (light.current) light.current.intensity = f * (44 + ground * 22) * flicker;
  });

  return (
    <>
      {mounts.map((m, i) => (
        <group key={i} position={[m.x, m.y, m.z]}>
          <mesh geometry={parts.outerGeometry} material={parts.outer} frustumCulled={false} renderOrder={2} />
          <mesh geometry={parts.innerGeometry} material={parts.inner} frustumCulled={false} renderOrder={3} />
          <sprite ref={(s) => { glows.current[i] = s; }} material={parts.sprite} position={[0, -0.08, 0]} renderOrder={4} />
        </group>
      ))}
      <pointLight ref={light} position={[0, -0.5, 0]} color="#ffae6b" intensity={0} distance={18} decay={1.6} />
    </>
  );
}

const DUST_COUNT = 300;
const DUST_COLOR: Record<Surface, string> = { moon: '#b6b4b2', mars: '#c58a5e', earth: '#9d8a68' };

/** Regolith thrown outward as the exhaust reaches the ground. */
export function GroundDust({ world, fire, height, x }: { world: Surface; fire: RefObject<number>; height: RefObject<number>; x?: RefObject<number> }) {
  const pointsRef = useRef<THREE.Points>(null);
  const parts = useMemo(() => {
    const seeds = new Float32Array(DUST_COUNT * 4);
    for (let i = 0; i < DUST_COUNT * 4; i += 4) {
      const a = (i / 4) * 2.399963; // golden angle spreads the particles evenly around the craft
      seeds.set([a, Math.random(), Math.random(), Math.random()], i);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(DUST_COUNT * 3), 3));
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));
    const map = smokeTexture();
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uStrength: { value: 0 },
        uScale: { value: 500 },
        uColor: { value: new THREE.Color(DUST_COLOR[world]) },
        uGlow: { value: 0 },
        uAtmo: { value: world === 'moon' ? 0 : 1 },
        uMap: { value: map },
      },
      vertexShader: /* glsl */ `
        attribute vec4 aSeed;
        uniform float uTime, uScale, uAtmo;
        varying float vAge, vRot, vCore;
        void main() {
          float age = fract(uTime * (0.48 + aSeed.y * 0.45) + aSeed.z);
          float billow = mix(0.65, 1.45, uAtmo);
          float reach = pow(age, 0.82) * (2.4 + aSeed.y * 7.2);
          float swirl = sin(uTime * 2.2 + aSeed.x * 3.0) * 0.28 * age * uAtmo;
          vec3 p = vec3(
            cos(aSeed.x + swirl) * reach,
            age * (1.0 - age * (0.78 - 0.18 * uAtmo)) * (0.42 + aSeed.w * 1.9 * billow),
            sin(aSeed.x + swirl) * reach
          );
          vAge = age;
          vRot = aSeed.z * 6.283 + age * (aSeed.w - 0.5) * 2.4;
          vCore = (1.0 - smoothstep(0.0, 0.42, age)) * (1.0 - aSeed.y * 0.5);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = clamp((0.42 + age * 2.1 * billow) * (0.65 + aSeed.w * 0.8) * uScale / max(-mv.z, 0.5), 2.0, 124.0);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uStrength, uGlow;
        uniform vec3 uColor;
        uniform sampler2D uMap;
        varying float vAge, vRot, vCore;
        void main() {
          vec2 uv = gl_PointCoord - 0.5;
          float c = cos(vRot), s = sin(vRot);
          vec2 ruv = vec2(uv.x * c - uv.y * s, uv.x * s + uv.y * c) + 0.5;
          float puff = texture2D(uMap, ruv).a;
          float alpha = puff * pow(1.0 - vAge, 1.35) * 0.62 * uStrength;
          if (alpha < 0.004) discard;
          vec3 lit = mix(uColor * 0.82, uColor * 1.15, 0.5 - uv.y);
          vec3 blast = mix(lit, vec3(1.0, 0.58, 0.28), vCore * uGlow * 0.55);
          gl_FragColor = vec4(blast, alpha);
          #include <colorspace_fragment>
        }
      `,
    });
    return { geometry, material, map };
  }, [world]);

  useEffect(
    () => () => {
      parts.geometry.dispose();
      parts.material.dispose();
      parts.map.dispose();
    },
    [parts],
  );

  useFrame((state) => {
    const u = parts.material.uniforms;
    u.uTime.value = state.clock.elapsedTime;
    const near = THREE.MathUtils.smoothstep(10 - height.current, 0, 8);
    u.uStrength.value += (fire.current * near - u.uStrength.value) * 0.14;
    u.uGlow.value = fire.current * THREE.MathUtils.smoothstep(4.5 - height.current, 0, 4.5);
    u.uScale.value = (state.size.height * state.viewport.dpr * 0.5) / Math.tan(((state.camera as THREE.PerspectiveCamera).fov * Math.PI) / 360);
    if (pointsRef.current && x) pointsRef.current.position.x = x.current;
  });

  return <points ref={pointsRef} geometry={parts.geometry} material={parts.material} position={[0, 0.12, 0]} frustumCulled={false} renderOrder={1} />;
}
