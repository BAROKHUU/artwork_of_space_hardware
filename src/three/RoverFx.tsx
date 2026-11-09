import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Terrain } from '../sim/terrain';

export interface RoverMotion {
  x: number;
  z: number;
  heading: number;
  speed: number;
}

const MAX_SEGMENTS = 1400;
const SEGMENT_LENGTH = 0.28;
const TRACK_WIDTH = 0.26;
const VERTS_PER_SEGMENT = 12;

/** Two wheel ruts laid on the ground as the rover moves; the oldest are overwritten first. */
export function Tracks({ motion, terrain, halfWidth, world }: { motion: RefObject<RoverMotion>; terrain: Terrain; halfWidth: number; world: 'moon' | 'mars' }) {
  const state = useRef({ x: motion.current.x, z: motion.current.z, head: 0, count: 0, left: null as null | THREE.Vector3, right: null as null | THREE.Vector3 });
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX_SEGMENTS * VERTS_PER_SEGMENT * 3), 3));
    g.setDrawRange(0, 0);
    return g;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame(() => {
    const s = state.current;
    const m = motion.current;
    if (Math.hypot(m.x - s.x, m.z - s.z) < SEGMENT_LENGTH) return;
    s.x = m.x;
    s.z = m.z;
    const sideX = Math.cos(m.heading);
    const sideZ = -Math.sin(m.heading);
    const at = (offset: number) => {
      const x = m.x + sideX * offset;
      const z = m.z + sideZ * offset;
      return new THREE.Vector3(x, terrain.heightAt(x, z) + 0.1, z);
    };
    const left = at(-halfWidth);
    const right = at(halfWidth);
    if (s.left && s.right) {
      const attr = geometry.attributes.position as THREE.BufferAttribute;
      const edge = (p: THREE.Vector3, sign: number) => [p.x + (sideX * sign * TRACK_WIDTH) / 2, p.y, p.z + (sideZ * sign * TRACK_WIDTH) / 2] as const;
      const writeQuad = (from: THREE.Vector3, to: THREE.Vector3, start: number) => {
        const a = edge(from, -1);
        const b = edge(from, 1);
        const c = edge(to, -1);
        const d = edge(to, 1);
        [a, b, c, b, d, c].forEach((v, i) => attr.setXYZ(start + i, v[0], v[1], v[2]));
      };
      const base = s.head * VERTS_PER_SEGMENT;
      writeQuad(s.left, left, base);
      writeQuad(s.right, right, base + 6);
      attr.needsUpdate = true;
      s.head = (s.head + 1) % MAX_SEGMENTS;
      s.count = Math.min(MAX_SEGMENTS, s.count + 1);
      geometry.setDrawRange(0, s.count * VERTS_PER_SEGMENT);
    }
    s.left = left;
    s.right = right;
  });

  return (
    <mesh geometry={geometry} frustumCulled={false} renderOrder={1}>
      <meshBasicMaterial color={world === 'mars' ? '#3c1c0e' : '#1d1d20'} transparent opacity={0.38} depthWrite={false} side={THREE.DoubleSide} polygonOffset polygonOffsetFactor={-6} polygonOffsetUnits={-6} />
    </mesh>
  );
}

const PARTICLES = 220;

/** Soil kicked up behind the wheels. It arcs and drops on the airless Moon, and hangs longer on Mars. */
export function WheelDust({ motion, terrain, halfWidth, world }: { motion: RefObject<RoverMotion>; terrain: Terrain; halfWidth: number; world: 'moon' | 'mars' }) {
  const sim = useRef({
    velocity: new Float32Array(PARTICLES * 3),
    next: 0,
    carry: 0,
  });
  const parts = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(PARTICLES * 3).fill(-999), 3));
    geometry.setAttribute('aLife', new THREE.BufferAttribute(new Float32Array(PARTICLES), 1));
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uColor: { value: new THREE.Color(world === 'mars' ? '#c8875a' : '#c2c0be') }, uScale: { value: 500 } },
      vertexShader: /* glsl */ `
        attribute float aLife;
        uniform float uScale;
        varying float vLife;
        void main() {
          vLife = aLife;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = (0.2 + (1.0 - aLife) * 0.75) * uScale / -mv.z;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        varying float vLife;
        void main() {
          float soft = smoothstep(1.0, 0.15, length(gl_PointCoord - 0.5) * 2.0);
          gl_FragColor = vec4(uColor, soft * vLife * 0.5);
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

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const pos = parts.geometry.attributes.position as THREE.BufferAttribute;
    const life = parts.geometry.attributes.aLife as THREE.BufferAttribute;
    const v = sim.current.velocity;
    const m = motion.current;
    const gravity = world === 'mars' ? 3.71 : 1.62;
    const fade = world === 'mars' ? 0.42 : 0.72;
    const drag = world === 'mars' ? 1.1 : 0;

    const emit = Math.min(1, Math.abs(m.speed) / 8) * 70 * dt + sim.current.carry;
    const count = Math.floor(emit);
    sim.current.carry = emit - count;
    const fwdX = -Math.sin(m.heading);
    const fwdZ = -Math.cos(m.heading);
    const sideX = Math.cos(m.heading);
    const sideZ = -Math.sin(m.heading);
    const back = -Math.sign(m.speed || 1);
    for (let i = 0; i < count; i++) {
      const n = sim.current.next;
      sim.current.next = (n + 1) % PARTICLES;
      const side = i % 2 ? halfWidth : -halfWidth;
      const x = m.x + sideX * side + fwdX * back * 0.7;
      const z = m.z + sideZ * side + fwdZ * back * 0.7;
      pos.setXYZ(n, x, terrain.heightAt(x, z) + 0.15, z);
      life.setX(n, 1);
      const kick = 0.6 + Math.random() * 1.5;
      v[n * 3] = fwdX * back * kick + (Math.random() - 0.5) * 1.1;
      v[n * 3 + 1] = 0.9 + Math.random() * 1.6;
      v[n * 3 + 2] = fwdZ * back * kick + (Math.random() - 0.5) * 1.1;
    }

    for (let i = 0; i < PARTICLES; i++) {
      const l = life.getX(i);
      if (l <= 0) continue;
      v[i * 3 + 1] -= gravity * dt;
      const keep = 1 - drag * dt;
      v[i * 3] *= keep;
      v[i * 3 + 2] *= keep;
      const x = pos.getX(i) + v[i * 3] * dt;
      const z = pos.getZ(i) + v[i * 3 + 2] * dt;
      const y = Math.max(terrain.heightAt(x, z) + 0.05, pos.getY(i) + v[i * 3 + 1] * dt);
      pos.setXYZ(i, x, y, z);
      life.setX(i, Math.max(0, l - fade * dt));
    }
    pos.needsUpdate = true;
    life.needsUpdate = true;
    parts.material.uniforms.uScale.value = (state.size.height * state.viewport.dpr * 0.5) / Math.tan(((state.camera as THREE.PerspectiveCamera).fov * Math.PI) / 360);
  });

  return <points geometry={parts.geometry} material={parts.material} frustumCulled={false} renderOrder={2} />;
}
