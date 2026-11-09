import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { OrbitControls, Stars, useTexture } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useTranslation } from 'react-i18next';
import * as THREE from 'three';
import trajectories from '../data/generated/trajectories.json';
import type { HudChannel } from '../missions/common';
import { ATMOSPHERE_SCALE, MOON_ORBIT_RADIUS, MOON_RADIUS, MS_PER_YEAR, PLANET_IDS, PLANET_RADIUS, SATURN_RING_OUTER, sizeFactor, TIME_MAX, TIME_MIN, heliocentric, orbitPoints, orbitalPeriodYears, orbitalSpeedKms, probePosition, sliderFromSpeed, speedFromSlider, toScene, type PlanetId, type ProbeTrack, type SolarScale, type Vec3 } from '../sim/solar';
import { GameCanvas, prefersReducedMotion } from '../three/GameCanvas';
import { planetMapUrl, textureUrl } from '../data';
import { radialGlow } from '../three/Plume';

const ORBIT_SEGMENTS = 256;
const TRAIL_POINTS = 56;
const TRAIL_FRACTION = 0.22;
const HUD_INTERVAL = 0.125;
const TOUR_START = Date.UTC(1977, 7, 22);
const DEFAULT_SPEED = 30;
const TOUR_SPEED = 365.25;

const COLOR: Record<PlanetId, string> = { mercury: '#a8a39b', venus: '#e6c58d', earth: '#4f8fe8', mars: '#d3633a', jupiter: '#d9ad80', saturn: '#e2cf9c', uranus: '#9ad8df', neptune: '#5b7fe0' };
const LOOK = Object.fromEntries(PLANET_IDS.map((id) => [id, { color: COLOR[id], size: PLANET_RADIUS[id] }])) as Record<PlanetId, { color: string; size: number }>;

/** Camera distance that shows all the planets in each view. */
const FIT_DISTANCE: Record<SolarScale, number> = { compressed: 14.5, true: 28 };

/** Axial tilt in degrees and rotation period in Earth days (negative is retrograde). NASA Planetary Fact Sheet. */
const BODY: Record<PlanetId, { tilt: number; day: number; air?: string }> = {
  mercury: { tilt: 0.03, day: 58.65 },
  venus: { tilt: 177.4, day: -243.02, air: '#f2d38a' },
  earth: { tilt: 23.44, day: 0.997, air: '#5aa2ff' },
  mars: { tilt: 25.19, day: 1.026, air: '#e8a070' },
  jupiter: { tilt: 3.13, day: 0.414, air: '#e7c49a' },
  saturn: { tilt: 26.73, day: 0.444, air: '#e8d9a8' },
  uranus: { tilt: 97.77, day: -0.718, air: '#a8e4ea' },
  neptune: { tilt: 28.32, day: 0.671, air: '#6d95f0' },
};
const UP = new THREE.Vector3(0, 1, 0);
const MAX_SPIN = 0.9;
const MOON_MONTH_DAYS = 27.32;
const RAD = Math.PI / 180;

function atmosphere(color: string) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    uniforms: { uColor: { value: new THREE.Color(color) } },
    vertexShader: /* glsl */ `
      varying float vZ;
      varying float vLit;
      void main() {
        vZ = normalize(normalMatrix * normal).z;
        vec4 world = modelMatrix * vec4(position, 1.0);
        vLit = dot(normalize(mat3(modelMatrix) * normal), normalize(-world.xyz));
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      varying float vZ;
      varying float vLit;
      void main() {
        float rim = max(pow(0.7 - vZ, 3.0) - 0.343, 0.0);
        float light = smoothstep(-0.35, 0.6, vLit);
        gl_FragColor = vec4(uColor, clamp(rim * light * 0.95, 0.0, 1.0));
        #include <colorspace_fragment>
      }
    `,
  });
}

const SOFT_NOISE = /* glsl */ `
  float h3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
  float n3(vec3 p) {
    vec3 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(h3(i), h3(i + vec3(1, 0, 0)), f.x), mix(h3(i + vec3(0, 1, 0)), h3(i + vec3(1, 1, 0)), f.x), f.y),
               mix(mix(h3(i + vec3(0, 0, 1)), h3(i + vec3(1, 0, 1)), f.x), mix(h3(i + vec3(0, 1, 1)), h3(i + vec3(1, 1, 1)), f.x), f.y), f.z);
  }
  float fbm3(vec3 p) { float a = 0.5, v = 0.0; for (int i = 0; i < 5; i++) { v += a * n3(p); p *= 2.03; a *= 0.5; } return v; }
`;

function sunMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    toneMapped: false,
    vertexShader: /* glsl */ `
      varying vec3 vP;
      varying float vFacing;
      void main() {
        vP = normalize(position);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vFacing = dot(normalize(normalMatrix * normal), normalize(-mv.xyz));
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      varying vec3 vP;
      varying float vFacing;
      ${SOFT_NOISE}
      void main() {
        float a = fbm3(vP * 5.0 + vec3(0.0, uTime * 0.05, uTime * 0.03));
        float b = fbm3(vP * 16.0 + a * 2.5 + uTime * 0.09);
        float heat = clamp(a * 0.55 + b * 0.75, 0.0, 1.0);
        vec3 color = mix(vec3(0.95, 0.27, 0.03), vec3(1.0, 0.72, 0.2), smoothstep(0.32, 0.62, heat));
        color = mix(color, vec3(1.0, 0.96, 0.78), smoothstep(0.62, 0.84, heat));
        color *= 0.72 + 0.38 * pow(max(vFacing, 0.0), 0.6);
        gl_FragColor = vec4(color, 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
}

function cloudMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec3 vP;
      varying float vLit;
      void main() {
        vP = normalize(position);
        vec4 world = modelMatrix * vec4(position, 1.0);
        vLit = dot(normalize(mat3(modelMatrix) * normal), normalize(-world.xyz));
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      varying vec3 vP;
      varying float vLit;
      ${SOFT_NOISE}
      void main() {
        float band = 0.82 + 0.18 * cos(vP.y * 7.0);
        float cloud = smoothstep(0.5, 0.74, fbm3(vP * 4.2 + vec3(uTime * 0.012, 0.0, 0.0)) * band);
        float light = smoothstep(-0.12, 0.45, vLit);
        gl_FragColor = vec4(vec3(1.0), cloud * 0.82 * (0.08 + 0.92 * light));
        #include <colorspace_fragment>
      }
    `,
  });
}

/** A ring whose texture runs across its width, with the real main gaps. */
function saturnRings(inner: number, outer: number) {
  const geometry = new THREE.RingGeometry(inner, outer, 128, 1);
  const pos = geometry.attributes.position as THREE.BufferAttribute;
  const uv = geometry.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (Math.hypot(pos.getX(i), pos.getY(i)) - inner) / (outer - inner), 0.5);
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 4;
  const ctx = canvas.getContext('2d')!;
  for (let x = 0; x < 1024; x++) {
    const f = x / 1024;
    // C ring is faint, B ring is bright, the Cassini Division is nearly empty, and the A ring has the Encke Gap.
    const gap = (f > 0.70 && f < 0.77) || (f > 0.935 && f < 0.945);
    const base = f < 0.22 ? 0.2 : f < 0.7 ? 0.9 : gap ? 0.03 : 0.62;
    const a = gap ? base : base * (0.72 + 0.28 * Math.abs(Math.sin(x * 0.37) * Math.cos(x * 0.113)));
    const v = 190 + Math.floor(a * 55);
    ctx.fillStyle = `rgba(${v},${v - 14},${v - 46},${a})`;
    ctx.fillRect(x, 0, 1, 4);
  }
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  return { geometry, map };
}

const PROBE_IDS = Object.keys(trajectories.probes) as (keyof typeof trajectories.probes)[];
type ProbeId = (typeof PROBE_IDS)[number];
const PROBE_COLOR: Record<ProbeId, string> = { pioneer10: '#b6a1ff', voyager1: '#37e6c0', voyager2: '#ffb25a', new_horizons: '#ff8cc0' };
const track = (id: ProbeId) => trajectories.probes[id] as ProbeTrack;

interface View {
  running: boolean;
  direction: 1 | -1;
  daysPerSecond: number;
  orbits: boolean;
  trails: boolean;
  probes: boolean;
  scale: SolarScale;
  follow: boolean;
}

interface Reading {
  ms: number;
  planets: Record<PlanetId, { au: number; kms: number }>;
  probes: Partial<Record<ProbeId, number>>;
}

function makeLine(positions: Float32Array) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  return g;
}

/** A THREE.Line held as a primitive; its material is owned here because fiber won't dispose primitives. */
function PathLine({ geometry, visible = true, color, opacity = 1, fade = false }: { geometry: THREE.BufferGeometry; visible?: boolean; color?: string; opacity?: number; fade?: boolean }) {
  const line = useMemo(
    () =>
      new THREE.Line(
        geometry,
        new THREE.LineBasicMaterial({ color: fade ? undefined : color, vertexColors: fade, transparent: true, depthWrite: false, toneMapped: !fade, blending: fade ? THREE.AdditiveBlending : THREE.NormalBlending }),
      ),
    [geometry, color, fade],
  );
  useEffect(() => () => (line.material as THREE.LineBasicMaterial).dispose(), [line]);
  return <primitive object={line} visible={visible} frustumCulled={false} material-opacity={opacity} />;
}

interface SystemProps {
  view: View;
  clock: RefObject<number>;
  channel: HudChannel<Reading>;
  labels: RefObject<Record<string, HTMLSpanElement | null>>;
  selected: PlanetId;
  onSelect: (id: PlanetId) => void;
}

function System({ view, clock, channel, labels, selected, onSelect }: SystemProps) {
  const planets = useRef<Partial<Record<PlanetId, THREE.Group | null>>>({});
  const probes = useRef<Partial<Record<ProbeId, THREE.Mesh | null>>>({});
  const scratch = useRef({ au: [0, 0, 0] as Vec3, scene: [0, 0, 0] as Vec3, v: new THREE.Vector3(), hudAt: HUD_INTERVAL, orbitEpoch: clock.current, followKey: 'sun', blend: 1, fromTarget: new THREE.Vector3(), fromOffset: new THREE.Vector3(), focus: new THREE.Vector3(), offset: new THREE.Vector3(), sunward: new THREE.Vector3(), lift: new THREE.Vector3(0, 0.3, 0), moon: 0 });
  const spins = useRef<Partial<Record<PlanetId, THREE.Group | null>>>({});
  const moon = useRef<THREE.Group>(null);
  const maps = useTexture(useMemo(() => ({ ...Object.fromEntries(PLANET_IDS.map((id) => [id, planetMapUrl(id)])), moon: textureUrl('moon') }), [])) as Record<PlanetId | 'moon', THREE.Texture>;
  const gl = useThree((s) => s.gl);
  useLayoutEffect(() => {
    const anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy());
    for (const map of Object.values(maps)) {
      map.anisotropy = anisotropy;
      map.needsUpdate = true;
    }
  }, [maps, gl]);
  const look = useMemo(
    () => ({
      sun: sunMaterial(),
      clouds: cloudMaterial(),
      halo: new THREE.SpriteMaterial({ map: radialGlow('rgba(255,226,150,.95)', 'rgba(255,130,40,.3)'), blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
      air: Object.fromEntries(PLANET_IDS.flatMap((id) => (BODY[id].air ? [[id, atmosphere(BODY[id].air!)]] : []))) as Partial<Record<PlanetId, THREE.ShaderMaterial>>,
      rings: saturnRings(LOOK.saturn.size * 1.24, LOOK.saturn.size * SATURN_RING_OUTER),
    }),
    [],
  );
  useEffect(
    () => () => {
      look.sun.dispose();
      look.clouds.dispose();
      look.halo.map?.dispose();
      look.halo.dispose();
      Object.values(look.air).forEach((m) => m?.dispose());
      look.rings.geometry.dispose();
      look.rings.map.dispose();
    },
    [look],
  );

  const small = sizeFactor(view.scale);
  const camera = useThree((st) => st.camera);
  const fittedScale = useRef(view.scale);
  useEffect(() => {
    if (fittedScale.current === view.scale) return;
    fittedScale.current = view.scale;
    if (!view.follow) camera.position.setLength(FIT_DISTANCE[view.scale]);
  }, [view.scale, view.follow, camera]);

  const orbitGeometries = useMemo(() => {
    const ms = clock.current;
    const au: Vec3 = [0, 0, 0];
    const scene: Vec3 = [0, 0, 0];
    return PLANET_IDS.map((id) => {
      const src = orbitPoints(id, ms, ORBIT_SEGMENTS);
      const out = new Float32Array(src.length);
      for (let i = 0; i < src.length; i += 3) {
        au[0] = src[i];
        au[1] = src[i + 1];
        au[2] = src[i + 2];
        out.set(toScene(au, view.scale, scene), i);
      }
      return makeLine(out);
    });
  }, [view.scale, clock]);

  const probeGeometries = useMemo(() => {
    const au: Vec3 = [0, 0, 0];
    const scene: Vec3 = [0, 0, 0];
    return PROBE_IDS.map((id) => {
      const { xyz } = track(id);
      // One spare vertex carries the line on to the probe once it coasts past the end of the table.
      const out = new Float32Array(xyz.length + 3);
      for (let i = 0; i < xyz.length; i += 3) {
        au[0] = xyz[i];
        au[1] = xyz[i + 1];
        au[2] = xyz[i + 2];
        out.set(toScene(au, view.scale, scene), i);
      }
      return makeLine(out);
    });
  }, [view.scale]);

  const trailGeometries = useMemo(
    () =>
      PLANET_IDS.map((id) => {
        const g = makeLine(new Float32Array(TRAIL_POINTS * 3));
        const color = new THREE.Color(LOOK[id].color);
        const colors = new Float32Array(TRAIL_POINTS * 3);
        for (let i = 0; i < TRAIL_POINTS; i++) {
          // Bright at the planet, fading to the background colour at the tail.
          const fade = (1 - i / (TRAIL_POINTS - 1)) ** 1.6;
          colors[i * 3] = color.r * fade;
          colors[i * 3 + 1] = color.g * fade;
          colors[i * 3 + 2] = color.b * fade;
        }
        g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        return g;
      }),
    [],
  );

  useEffect(() => () => orbitGeometries.forEach((g) => g.dispose()), [orbitGeometries]);
  useEffect(() => () => probeGeometries.forEach((g) => g.dispose()), [probeGeometries]);
  useEffect(() => () => trailGeometries.forEach((g) => g.dispose()), [trailGeometries]);

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    if (view.running) clock.current = Math.max(TIME_MIN, Math.min(TIME_MAX, clock.current + view.direction * view.daysPerSecond * dt * 86400000));
    const ms = clock.current;
    const c = scratch.current;
    const { width, height } = state.size;
    look.sun.uniforms.uTime.value = state.clock.elapsedTime;
    look.clouds.uniforms.uTime.value = state.clock.elapsedTime;

    // Orbits slowly change shape over centuries, so the drawn ellipses are refreshed as time moves.
    if (Math.abs(ms - c.orbitEpoch) > 15 * MS_PER_YEAR) {
      c.orbitEpoch = ms;
      PLANET_IDS.forEach((id, n) => {
        const src = orbitPoints(id, ms, ORBIT_SEGMENTS);
        const attr = orbitGeometries[n].attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < src.length; i += 3) {
          c.au[0] = src[i];
          c.au[1] = src[i + 1];
          c.au[2] = src[i + 2];
          toScene(c.au, view.scale, c.scene);
          attr.setXYZ(i / 3, c.scene[0], c.scene[1], c.scene[2]);
        }
        attr.needsUpdate = true;
      });
    }

    const place = (key: string, x: number, y: number, z: number, show: boolean) => {
      const el = labels.current[key];
      if (!el) return;
      c.v.set(x, y, z).project(state.camera);
      const visible = show && c.v.z < 1;
      el.style.visibility = visible ? 'visible' : 'hidden';
      if (visible) el.style.transform = `translate(${((c.v.x + 1) / 2) * width + 10}px, ${((1 - c.v.y) / 2) * height - 8}px)`;
    };

    PLANET_IDS.forEach((id, n) => {
      heliocentric(id, ms, c.au);
      toScene(c.au, view.scale, c.scene);
      const [x, y, z] = c.scene;
      planets.current[id]?.position.set(x, y, z);
      place(id, x, y, z, true);
      if (id === selected) c.focus.set(x, y, z);

      // Real day lengths would strobe at high time speeds, so visible spin is capped.
      if (view.running) {
        const rate = Math.min(MAX_SPIN, ((Math.PI * 2) / Math.abs(BODY[id].day)) * view.daysPerSecond) * Math.sign(BODY[id].day) * view.direction;
        const spin = spins.current[id];
        if (spin) spin.rotation.y += rate * dt;
      }

      if (view.trails) {
        const attr = trailGeometries[n].attributes.position as THREE.BufferAttribute;
        const span = orbitalPeriodYears(id) * MS_PER_YEAR * TRAIL_FRACTION;
        for (let i = 0; i < TRAIL_POINTS; i++) {
          heliocentric(id, ms - (i / (TRAIL_POINTS - 1)) * span, c.au);
          toScene(c.au, view.scale, c.scene);
          attr.setXYZ(i, c.scene[0], c.scene[1], c.scene[2]);
        }
        attr.needsUpdate = true;
      }
    });

    PROBE_IDS.forEach((id, n) => {
      const active = view.probes && probePosition(track(id), trajectories.stepDays, ms, c.au);
      const marker = probes.current[id];
      if (marker) marker.visible = active;
      if (active) {
        toScene(c.au, view.scale, c.scene);
        marker?.position.set(c.scene[0], c.scene[1], c.scene[2]);
        place(id, c.scene[0], c.scene[1], c.scene[2], true);
        const done = (ms - Date.parse(`${track(id).startISO}T00:00:00Z`)) / (trajectories.stepDays * 86400000);
        const rows = track(id).xyz.length / 3;
        if (done >= rows - 1) {
          const attr = probeGeometries[n].attributes.position as THREE.BufferAttribute;
          attr.setXYZ(rows, c.scene[0], c.scene[1], c.scene[2]);
          attr.needsUpdate = true;
          probeGeometries[n].setDrawRange(0, rows + 1);
        } else probeGeometries[n].setDrawRange(0, Math.floor(done) + 1);
      } else {
        place(id, 0, 0, 0, false);
        probeGeometries[n].setDrawRange(0, 0);
      }
    });

    if (view.running) c.moon += Math.min(MAX_SPIN, ((Math.PI * 2) / MOON_MONTH_DAYS) * view.daysPerSecond) * view.direction * dt;
    moon.current?.position.set(Math.cos(c.moon) * MOON_ORBIT_RADIUS, 0, Math.sin(c.moon) * MOON_ORBIT_RADIUS);

    const controls = state.controls as unknown as { target: THREE.Vector3 } | null;
    if (controls) {
      const key = view.follow ? selected : 'sun';
      if (key !== c.followKey) {
        c.followKey = key;
        c.blend = 0;
        c.fromTarget.copy(controls.target);
        c.fromOffset.copy(state.camera.position).sub(controls.target);
      }
      if (!view.follow) c.focus.set(0, 0, 0);
      if (c.blend < 1) {
        c.blend = Math.min(1, c.blend + dt / 1.2);
        const e = c.blend * c.blend * (3 - 2 * c.blend);
        const startLength = c.fromOffset.length();
        const endLength = view.follow ? LOOK[selected].size * small * (selected === 'saturn' ? 13 : 8) : Math.max(startLength, 9);
        c.offset.copy(c.fromOffset).normalize();
        if (view.follow && c.focus.lengthSq() > 0) {
          // Swing round to the sunlit side, with the Sun over the viewer's shoulder.
          c.sunward.copy(c.focus).negate().normalize().applyAxisAngle(UP, 0.75).add(c.lift).normalize();
          c.offset.lerp(c.sunward, e).normalize();
        }
        c.offset.multiplyScalar(startLength + (endLength - startLength) * e);
        controls.target.lerpVectors(c.fromTarget, c.focus, e);
        state.camera.position.copy(controls.target).add(c.offset);
      } else if (view.follow) {
        state.camera.position.add(c.v.subVectors(c.focus, controls.target));
        controls.target.copy(c.focus);
      }
    }

    c.hudAt += dt;
    if (c.hudAt >= HUD_INTERVAL) {
      c.hudAt = 0;
      const planetRows = {} as Reading['planets'];
      for (const id of PLANET_IDS) {
        heliocentric(id, ms, c.au);
        const au = Math.hypot(c.au[0], c.au[1], c.au[2]);
        planetRows[id] = { au, kms: orbitalSpeedKms(id, ms, au) };
      }
      const probeRows: Reading['probes'] = {};
      for (const id of PROBE_IDS) if (probePosition(track(id), trajectories.stepDays, ms, c.au)) probeRows[id] = Math.hypot(c.au[0], c.au[1], c.au[2]);
      channel.current?.({ ms, planets: planetRows, probes: probeRows });
    }
  });

  return (
    <>
      <color attach="background" args={['#03040a']} />
      <Stars radius={90} depth={40} count={2600} factor={3.5} saturation={0} fade speed={0.2} />
      <ambientLight intensity={0.1} />
      <pointLight position={[0, 0, 0]} intensity={6.5} decay={0} />

      <mesh material={look.sun}>
        <sphereGeometry args={[0.2 * small, 48, 32]} />
      </mesh>
      <sprite material={look.halo} scale={1.25 * small} />

      {PLANET_IDS.map((id, n) => (
        <group key={id}>
          <PathLine geometry={orbitGeometries[n]} visible={view.orbits} color={LOOK[id].color} opacity={selected === id ? 0.75 : 0.26} />
          <PathLine geometry={trailGeometries[n]} visible={view.trails} fade />
          <group ref={(g) => { planets.current[id] = g; }} scale={small}>
            <group rotation={[0, 0, BODY[id].tilt * RAD]}>
              <group ref={(g) => { spins.current[id] = g; }}>
                <mesh>
                  <sphereGeometry args={[LOOK[id].size, 64, 44]} />
                  <meshStandardMaterial map={maps[id]} roughness={id === 'earth' ? 0.62 : 0.92} metalness={0} />
                </mesh>
                {id === 'earth' && (
                  <mesh material={look.clouds} scale={1.012}>
                    <sphereGeometry args={[LOOK[id].size, 48, 32]} />
                  </mesh>
                )}
              </group>
              {id === 'saturn' && (
                <mesh geometry={look.rings.geometry} rotation={[-Math.PI / 2, 0, 0]}>
                  <meshStandardMaterial map={look.rings.map} side={THREE.DoubleSide} transparent depthWrite={false} roughness={1} />
                </mesh>
              )}
            </group>
            {look.air[id] && (
              <mesh material={look.air[id]} scale={ATMOSPHERE_SCALE}>
                <sphereGeometry args={[LOOK[id].size, 40, 28]} />
              </mesh>
            )}
            {id === 'earth' && (
              <group ref={moon}>
                <mesh>
                  <sphereGeometry args={[MOON_RADIUS, 28, 20]} />
                  <meshStandardMaterial map={maps.moon} roughness={1} />
                </mesh>
              </group>
            )}
            <mesh
              onClick={(e) => {
                if (e.delta > 6) return;
                e.stopPropagation();
                onSelect(id);
              }}
              onPointerOver={() => (document.body.style.cursor = 'pointer')}
              onPointerOut={() => (document.body.style.cursor = '')}
            >
              <sphereGeometry args={[Math.max(0.26, LOOK[id].size * 1.5), 10, 8]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>
          </group>
        </group>
      ))}

      {PROBE_IDS.map((id, n) => (
        <group key={id} visible={view.probes}>
          <PathLine geometry={probeGeometries[n]} color={PROBE_COLOR[id]} opacity={0.8} />
          <mesh ref={(m) => { probes.current[id] = m; }} visible={false}>
            <octahedronGeometry args={[0.055 * (small === 1 ? 1 : 0.7), 0]} />
            <meshBasicMaterial color={PROBE_COLOR[id]} toneMapped={false} />
          </mesh>
        </group>
      ))}

      <OrbitControls makeDefault enablePan={false} minDistance={view.follow ? LOOK[selected].size * small * 2 : 1.2} maxDistance={view.follow ? 14 : 40} />
    </>
  );
}

/** Holds its own state so readings never re-render the 3D scene. */
function Readings({ channel, selected, onSelect, children }: { channel: HudChannel<Reading>; selected: PlanetId; onSelect: (id: PlanetId) => void; children: ReactNode }) {
  const { t, i18n } = useTranslation();
  const [reading, setReading] = useState<Reading | null>(null);
  useEffect(() => {
    channel.current = setReading;
    return () => {
      channel.current = null;
    };
  }, [channel]);
  const dateText = useMemo(() => new Intl.DateTimeFormat(i18n.language, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }), [i18n.language]);
  return (
    <>
      <p className="solar-date" aria-live="off">{reading ? dateText.format(reading.ms) : '—'}</p>
      {children}
      <table className="planet-rows">
        <thead>
          <tr><th scope="col">{t('solar.planet')}</th><th scope="col">{t('solar.distance')}</th><th scope="col">{t('solar.speed')}</th></tr>
        </thead>
        <tbody>
          {PLANET_IDS.map((id) => (
            <tr key={id} className={selected === id ? 'on' : ''}>
              <th scope="row"><button type="button" onClick={() => onSelect(id)} aria-pressed={selected === id}><i style={{ background: LOOK[id].color }} />{t(`solar.names.${id}`)}</button></th>
              <td>{reading ? reading.planets[id].au.toFixed(2) : '—'}</td>
              <td>{reading ? reading.planets[id].kms.toFixed(1) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="solar-fact">{t('solar.period', { name: t(`solar.names.${selected}`), y: orbitalPeriodYears(selected).toFixed(orbitalPeriodYears(selected) < 10 ? 2 : 1) })}</p>
      <ul className="probe-rows">
        {PROBE_IDS.map((id) => (
          <li key={id}>
            <i style={{ background: PROBE_COLOR[id] }} />
            <span>{t(`hardware:${id}.name`)}</span>
            <b>{reading?.probes[id] !== undefined ? t('atlas.au', { v: reading.probes[id].toFixed(1) }) : t('solar.notLaunched')}</b>
          </li>
        ))}
      </ul>
    </>
  );
}

export default function SolarLab() {
  const { t } = useTranslation();
  const clock = useRef(Math.min(Date.now(), TIME_MAX));
  const channel = useRef<((r: Reading) => void) | null>(null);
  const labels = useRef<Record<string, HTMLSpanElement | null>>({});
  const [selected, setSelected] = useState<PlanetId>('earth');
  const [view, setView] = useState<View>(() => ({ running: !prefersReducedMotion(), direction: 1, daysPerSecond: DEFAULT_SPEED, orbits: true, trails: true, probes: true, scale: 'compressed', follow: false }));
  const set = (patch: Partial<View>) => setView((v) => ({ ...v, ...patch }));

  const speedText = view.daysPerSecond < 365 ? t('solar.daysPerSecond', { n: Math.round(view.daysPerSecond) }) : t('solar.yearsPerSecond', { n: (view.daysPerSecond / 365.25).toFixed(view.daysPerSecond < 3652 ? 1 : 0) });

  const toggles = [['orbits', t('solar.orbits')], ['trails', t('solar.trails')], ['probes', t('solar.probes')]] as const;

  return (
    <div className="lab-grid">
      <div className="lab-stage">
        <GameCanvas camera={{ position: [0, 9.4, 11], fov: 45, far: 300 }} shadows={false}>
          <System view={view} clock={clock} channel={channel} labels={labels} selected={selected} onSelect={setSelected} />
        </GameCanvas>
        <div className="solar-labels" aria-hidden="true">
          {PLANET_IDS.map((id) => <span key={id} className={selected === id ? 'on' : ''} ref={(el) => { labels.current[id] = el; }}>{t(`solar.names.${id}`)}</span>)}
          {PROBE_IDS.map((id) => <span key={id} className="probe" ref={(el) => { labels.current[id] = el; }} style={{ color: PROBE_COLOR[id] }}>{t(`hardware:${id}.name`)}</span>)}
        </div>
        <p className="solar-note">{t('solar.note')}</p>
      </div>
      <aside className="lab-controls solar-controls">
        <Readings channel={channel} selected={selected} onSelect={setSelected}>
        <div className="row">
          <button type="button" className="btn primary" onClick={() => set({ running: !view.running })}>{view.running ? t('solar.pause') : t('solar.play')}</button>
          <button type="button" className="btn" aria-pressed={view.direction === -1} onClick={() => set({ direction: view.direction === 1 ? -1 : 1 })}>{view.direction === 1 ? t('solar.reverse') : t('solar.forward')}</button>
          <button type="button" className="btn" onClick={() => { clock.current = Date.now(); }}>{t('solar.today')}</button>
          <button type="button" className={`btn${view.follow ? ' active' : ''}`} aria-pressed={view.follow} onClick={() => set({ follow: !view.follow })}>{view.follow ? t('solar.unfollow') : t('solar.follow', { name: t(`solar.names.${selected}`) })}</button>
        </div>
        <label className="slider">
          <span>{t('solar.timeSpeed')} <b>{speedText}</b></span>
          <input type="range" min={0} max={100} step={1} value={Math.round(sliderFromSpeed(view.daysPerSecond))} onChange={(e) => set({ daysPerSecond: speedFromSlider(Number(e.target.value)) })} />
        </label>
        <button type="button" className="btn" onClick={() => { clock.current = TOUR_START; set({ running: true, direction: 1, daysPerSecond: TOUR_SPEED, probes: true }); }}>{t('solar.tour')}</button>
        </Readings>
        <div className="choice" role="radiogroup" aria-label={t('solar.scale')}>
          {(['compressed', 'true'] as const).map((s) => <button type="button" key={s} role="radio" aria-checked={view.scale === s} className={view.scale === s ? 'on' : ''} onClick={() => set({ scale: s })}>{t(`solar.${s}`)}</button>)}
        </div>
        <div className="solar-toggles">
          {toggles.map(([key, label]) => <label key={key}><input type="checkbox" checked={view[key]} onChange={(e) => set({ [key]: e.target.checked })} /> {label}</label>)}
        </div>
      </aside>
    </div>
  );
}
