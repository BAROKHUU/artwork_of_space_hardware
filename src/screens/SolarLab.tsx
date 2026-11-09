import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { OrbitControls, Stars } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useTranslation } from 'react-i18next';
import * as THREE from 'three';
import trajectories from '../data/generated/trajectories.json';
import type { HudChannel } from '../missions/common';
import { MS_PER_YEAR, PLANET_IDS, TIME_MAX, TIME_MIN, heliocentric, orbitPoints, orbitalPeriodYears, orbitalSpeedKms, probePosition, sliderFromSpeed, speedFromSlider, toScene, type PlanetId, type ProbeTrack, type SolarScale, type Vec3 } from '../sim/solar';
import { GameCanvas, prefersReducedMotion } from '../three/GameCanvas';

const ORBIT_SEGMENTS = 256;
const TRAIL_POINTS = 56;
const TRAIL_FRACTION = 0.22;
const HUD_INTERVAL = 0.125;
const TOUR_START = Date.UTC(1977, 7, 22);
const DEFAULT_SPEED = 30;
const TOUR_SPEED = 365.25;

const LOOK: Record<PlanetId, { color: string; size: number }> = {
  mercury: { color: '#a8a39b', size: 0.05 },
  venus: { color: '#e6c58d', size: 0.08 },
  earth: { color: '#4f8fe8', size: 0.085 },
  mars: { color: '#d3633a', size: 0.065 },
  jupiter: { color: '#d9ad80', size: 0.2 },
  saturn: { color: '#e2cf9c', size: 0.17 },
  uranus: { color: '#9ad8df', size: 0.12 },
  neptune: { color: '#5b7fe0', size: 0.12 },
};

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
  const scratch = useRef({ au: [0, 0, 0] as Vec3, scene: [0, 0, 0] as Vec3, v: new THREE.Vector3(), hudAt: HUD_INTERVAL });
  const small = view.scale === 'true' ? 0.5 : 1;

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
      const out = new Float32Array(xyz.length);
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
        probeGeometries[n].setDrawRange(0, Math.floor(done) + 1);
      } else {
        place(id, 0, 0, 0, false);
        probeGeometries[n].setDrawRange(0, 0);
      }
    });

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
      <ambientLight intensity={0.22} />
      <pointLight position={[0, 0, 0]} intensity={5} decay={0} />

      <mesh>
        <sphereGeometry args={[0.2 * small, 32, 24]} />
        <meshBasicMaterial color="#ffd27a" toneMapped={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.34 * small, 24, 16]} />
        <meshBasicMaterial color="#ff9a3c" transparent opacity={0.16} depthWrite={false} toneMapped={false} />
      </mesh>

      {PLANET_IDS.map((id, n) => (
        <group key={id}>
          <PathLine geometry={orbitGeometries[n]} visible={view.orbits} color={LOOK[id].color} opacity={selected === id ? 0.75 : 0.26} />
          <PathLine geometry={trailGeometries[n]} visible={view.trails} fade />
          <group ref={(g) => { planets.current[id] = g; }} scale={small * (selected === id ? 1.35 : 1)}>
            <mesh>
              <sphereGeometry args={[LOOK[id].size, 24, 16]} />
              <meshStandardMaterial color={LOOK[id].color} roughness={0.8} />
            </mesh>
            {id === 'saturn' && (
              <mesh rotation={[Math.PI / 2 - 0.45, 0, 0]}>
                <ringGeometry args={[LOOK[id].size * 1.35, LOOK[id].size * 2.25, 48]} />
                <meshBasicMaterial color="#d9c690" side={THREE.DoubleSide} transparent opacity={0.65} depthWrite={false} />
              </mesh>
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

      <OrbitControls makeDefault enablePan={false} minDistance={1.2} maxDistance={40} />
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
  const [view, setView] = useState<View>(() => ({ running: !prefersReducedMotion(), direction: 1, daysPerSecond: DEFAULT_SPEED, orbits: true, trails: true, probes: true, scale: 'compressed' }));
  const set = (patch: Partial<View>) => setView((v) => ({ ...v, ...patch }));

  const speedText = view.daysPerSecond < 365 ? t('solar.daysPerSecond', { n: Math.round(view.daysPerSecond) }) : t('solar.yearsPerSecond', { n: (view.daysPerSecond / 365.25).toFixed(view.daysPerSecond < 3652 ? 1 : 0) });
  const toggles = [['orbits', t('solar.orbits')], ['trails', t('solar.trails')], ['probes', t('solar.probes')]] as const;

  return (
    <div className="lab-grid">
      <div className="lab-stage">
        <GameCanvas camera={{ position: [0, 6.5, 7.5], fov: 45, far: 300 }} shadows={false}>
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
