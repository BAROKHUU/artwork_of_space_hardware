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

function flameMaterial(core: number) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uFire: { value: 0 }, uLength: { value: 1 }, uCore: { value: core } },
    vertexShader: /* glsl */ `
      uniform float uTime, uLength;
      varying vec2 vUv;
      varying vec3 vNormalView, vView;
      void main() {
        vUv = uv;
        vec3 p = position;
        float seed = modelMatrix[3].x * 7.0 + modelMatrix[3].z * 3.0;
        p.xz *= 1.0 + 0.16 * uv.y * sin(uTime * 38.0 + uv.y * 9.0 + seed);
        p.x += 0.03 * uv.y * sin(uTime * 23.0 + seed);
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
        float facing = pow(abs(dot(normalize(vNormalView), normalize(vView))), 1.6);
        float streaks = fbm(vec2(vUv.x * 14.0, v * 3.5 - uTime * 7.0));
        float diamonds = 0.82 + 0.18 * sin(v * 26.0 - uTime * 3.0);
        float body = facing * pow(1.0 - v, 1.25) * (0.55 + 0.75 * streaks) * diamonds;
        vec3 hot = mix(vec3(1.0, 0.86, 0.62), vec3(0.78, 0.9, 1.0), uCore);
        vec3 mid = vec3(1.0, 0.47, 0.13);
        vec3 tail = vec3(0.75, 0.12, 0.04);
        vec3 color = mix(hot, mid, smoothstep(0.05, 0.42, v));
        color = mix(color, tail, smoothstep(0.42, 0.95, v));
        gl_FragColor = vec4(color * (1.5 + uCore), clamp(body * uFire, 0.0, 1.0));
        #include <colorspace_fragment>
      }
    `,
  });
}

function bellGeometry(width: number) {
  const profile = [[0.1, 0], [0.17, -0.06], [0.24, -0.2], [0.26, -0.38], [0.2, -0.62], [0.11, -0.84], [0, -1]].map(([r, y]) => new THREE.Vector2(r * width, y));
  const smooth = new THREE.SplineCurve(profile).getPoints(32);
  return new THREE.LatheGeometry(smooth, 28);
}

/** Exhaust from each engine of a lander. `fire` runs 0 to 1, and `height` is the craft's height above the ground. */
export function Engines({ vehicle, fire, height }: { vehicle: EngineVehicle; fire: RefObject<number>; height: RefObject<number> }) {
  const mounts = ENGINE_MOUNTS[vehicle];
  const light = useRef<THREE.PointLight>(null);
  const glows = useRef<(THREE.Sprite | null)[]>([]);
  const parts = useMemo(() => {
    const glow = radialGlow('rgba(255,244,220,1)', 'rgba(255,140,50,.55)');
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
    for (const m of [parts.outer, parts.inner]) {
      m.uniforms.uTime.value = t;
      m.uniforms.uFire.value = f;
    }
    // The flame stops at the ground rather than passing through it.
    const room = Math.max(0.15, height.current + mounts[0].y);
    parts.outer.uniforms.uLength.value = Math.min(room, MAX_FLAME * (0.65 + 0.35 * f) * flicker);
    parts.inner.uniforms.uLength.value = Math.min(room, MAX_FLAME * 0.55 * flicker);
    parts.sprite.opacity = f * 0.95;
    for (const g of glows.current) g?.scale.setScalar(0.85 * flicker);
    if (light.current) light.current.intensity = f * 42 * flicker;
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
      <pointLight ref={light} position={[0, -0.5, 0]} color="#ffae6b" intensity={0} distance={16} decay={1.7} />
    </>
  );
}

const DUST_COUNT = 320;
const DUST_COLOR: Record<Surface, string> = { moon: '#b6b4b2', mars: '#c58a5e', earth: '#9d8a68' };

/** Regolith thrown outward as the exhaust reaches the ground. */
export function GroundDust({ world, fire, height }: { world: Surface; fire: RefObject<number>; height: RefObject<number> }) {
  const parts = useMemo(() => {
    const seeds = new Float32Array(DUST_COUNT * 4);
    for (let i = 0; i < DUST_COUNT * 4; i += 4) {
      const a = (i / 4) * 2.399963; // golden angle spreads the particles evenly around the craft
      seeds.set([a, Math.random(), Math.random(), Math.random()], i);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(DUST_COUNT * 3), 3));
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uTime: { value: 0 }, uStrength: { value: 0 }, uScale: { value: 500 }, uColor: { value: new THREE.Color(DUST_COLOR[world]) } },
      vertexShader: /* glsl */ `
        attribute vec4 aSeed;
        uniform float uTime, uScale;
        varying float vAge;
        void main() {
          float age = fract(uTime * (0.55 + aSeed.y * 0.5) + aSeed.z);
          float reach = age * (2.0 + aSeed.y * 6.5);
          vec3 p = vec3(cos(aSeed.x) * reach, age * (1.0 - age * 0.72) * (0.5 + aSeed.w * 1.9), sin(aSeed.x) * reach);
          vAge = age;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = (0.28 + age * 1.5) * (0.6 + aSeed.w) * uScale / -mv.z;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uStrength;
        uniform vec3 uColor;
        varying float vAge;
        void main() {
          float d = length(gl_PointCoord - 0.5) * 2.0;
          float soft = smoothstep(1.0, 0.1, d);
          gl_FragColor = vec4(uColor, soft * pow(1.0 - vAge, 1.5) * 0.38 * uStrength);
          #include <colorspace_fragment>
        }
      `,
    });
    return { geometry, material };
  }, [world]);

  useEffect(
    () => () => {
      parts.geometry.dispose();
      parts.material.dispose();
    },
    [parts],
  );

  useFrame((state) => {
    const u = parts.material.uniforms;
    u.uTime.value = state.clock.elapsedTime;
    const near = THREE.MathUtils.smoothstep(9 - height.current, 0, 7);
    u.uStrength.value += (fire.current * near - u.uStrength.value) * 0.12;
    u.uScale.value = (state.size.height * state.viewport.dpr * 0.5) / Math.tan(((state.camera as THREE.PerspectiveCamera).fov * Math.PI) / 360);
  });

  return <points geometry={parts.geometry} material={parts.material} position={[0, 0.12, 0]} frustumCulled={false} renderOrder={1} />;
}
