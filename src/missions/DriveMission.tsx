import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { useTranslation } from 'react-i18next';
import * as THREE from 'three';
import type { DriveConfig } from '../data/types';
import { emptyContact, resolveCollisions, scatterRocks, solidRocks, type Obstacle } from '../sim/obstacles';
import { makeTerrain, type Terrain } from '../sim/terrain';
import { dustLevel, stepBattery, sunlight } from '../sim/rover';
import { Echo } from '../three/Echo';
import { GameCanvas } from '../three/GameCanvas';
import { HardwareModel } from '../three/models';
import { Lights, Rocks, SHADOW_TEXEL, SUN_OFFSET, Sky, TerrainMesh } from '../three/Scenery';
import { play } from '../audio/sfx';
import { useGame } from '../state/store';
import { Gauge, HoldButton, useKeys, type HudChannel, type MissionProps } from './common';

const WORLD_LIMIT = 118;
const SCAN_SECONDS = 0.9;
const WAKE_LEVEL = 12;
const ROVER_RADIUS = 0.9;
const BEACON_ROCK_RADIUS = 1;
const PROP_RADIUS = 2.4;

// Frame-rate independent smoothing: the same feel at 30 fps and at 144 fps.
const damp = (rate: number, dt: number) => 1 - Math.exp(-rate * dt);

// The sun's axes, used to move the shadow map in whole texels so shadow edges don't shimmer.
const SUN_DIR = SUN_OFFSET.clone().normalize();
const SUN_RIGHT = new THREE.Vector3(0, 1, 0).cross(SUN_DIR).normalize();
const SUN_UP = SUN_DIR.clone().cross(SUN_RIGHT);

interface Hud {
  index: number;
  distance: number;
  battery: number;
  sun: number;
  dust: number;
  scan: number;
  tethered: boolean;
  asleep: boolean;
}

type Pad = { forward: boolean; back: boolean; left: boolean; right: boolean };

function Beacon({ x, z, y, state }: { x: number; z: number; y: number; state: 'next' | 'done' | 'later' }) {
  const color = state === 'done' ? '#37e6c0' : state === 'next' ? '#ff6a2b' : '#8b90a0';
  return (
    <group position={[x, y, z]}>
      <mesh position={[0, 16, 0]}>
        <cylinderGeometry args={[0.32, 0.32, 32, 8, 1, true]} />
        <meshBasicMaterial color={color} transparent opacity={state === 'later' ? 0.12 : 0.42} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.16, 0]}>
        <ringGeometry args={[3.2, 3.6, 40]} />
        <meshBasicMaterial color={color} transparent opacity={0.8} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.7, 0]} castShadow>
        <dodecahedronGeometry args={[BEACON_ROCK_RADIUS, 0]} />
        <meshStandardMaterial color={state === 'done' ? '#5ea99a' : '#8a6a4f'} flatShading roughness={1} />
      </mesh>
    </group>
  );
}

interface RoverProps {
  config: DriveConfig;
  terrain: Terrain;
  obstacles: Obstacle[];
  keys: ReturnType<typeof useKeys>;
  pad: RefObject<Pad>;
  light: RefObject<THREE.DirectionalLight | null>;
  arrow: RefObject<HTMLSpanElement | null>;
  hud: HudChannel<Hud>;
  onFinish: (r: 'win' | 'storm') => void;
  frozen: boolean;
}

function Rover({ config, terrain, obstacles, keys, pad, light, arrow, hud, onFinish, frozen }: RoverProps) {
  const ref = useRef<THREE.Group>(null);
  const sim = useRef({ x: config.start.x, z: config.start.z, heading: 0, speed: 0, index: 0, scan: 0, battery: 100, t: 0, asleep: false, hudAt: 0, done: false, tethered: false });
  const camPos = useRef(new THREE.Vector3(config.start.x, 8, config.start.z + 14));
  const camLook = useRef(new THREE.Vector3(config.start.x, 1, config.start.z - 4));
  const scratch = useRef({ wanted: new THREE.Vector3(), look: new THREE.Vector3(), contact: emptyContact() });
  const [progress, setProgress] = useState(0);

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const s = sim.current;
    const k = keys.current;
    const p = pad.current;
    if (!frozen && !s.done) {
      s.t += dt;
      const forward = k.has('ArrowUp') || k.has('KeyW') || p.forward;
      const back = k.has('ArrowDown') || k.has('KeyS') || p.back;
      const left = k.has('ArrowLeft') || k.has('KeyA') || p.left;
      const right = k.has('ArrowRight') || k.has('KeyD') || p.right;

      if (config.battery) {
        const moving = Math.abs(s.speed) > 0.2;
        s.battery = stepBattery(s.battery, moving, s.t, config.battery, dt);
        if (s.battery <= 0) s.asleep = true;
        else if (s.asleep && s.battery >= WAKE_LEVEL) s.asleep = false;
        if (dustLevel(s.t, config.battery.stormAt) >= 1) {
          s.done = true;
          onFinish('storm');
        }
      }

      const drive = s.asleep ? 0 : forward ? 1 : back ? -0.55 : 0;
      s.speed += (drive * 11 - s.speed) * damp(2.6, dt);
      if (!s.asleep) s.heading += ((left ? 1 : 0) - (right ? 1 : 0)) * dt * (1.9 - Math.min(0.7, Math.abs(s.speed) * 0.05));

      const dirX = -Math.sin(s.heading);
      const dirZ = -Math.cos(s.heading);
      const contact = resolveCollisions(s.x + dirX * s.speed * dt, s.z + dirZ * s.speed * dt, ROVER_RADIUS, obstacles, scratch.current.contact);
      if (contact.hit) {
        // Lose only the part of the speed aimed at the rock, so a glancing hit keeps sliding.
        const sign = Math.sign(s.speed);
        const into = Math.max(0, -(dirX * sign * contact.nx + dirZ * sign * contact.nz));
        s.speed *= 1 - into;
      }
      let nx = contact.x;
      let nz = contact.z;

      const limit = config.tether ?? WORLD_LIMIT;
      const cx = nx - config.start.x;
      const cz = nz - config.start.z;
      const r = Math.hypot(cx, cz);
      s.tethered = r > limit - 6;
      if (r > limit) {
        nx = config.start.x + (cx / r) * limit;
        nz = config.start.z + (cz / r) * limit;
        s.speed *= 0.3;
      }
      s.x = nx;
      s.z = nz;

      const tgt = config.targets[s.index];
      if (tgt && Math.hypot(tgt.x - s.x, tgt.z - s.z) < config.radius) {
        s.scan += dt;
        if (s.scan >= SCAN_SECONDS) {
          s.scan = 0;
          s.index += 1;
          play('ping');
          setProgress(s.index);
          if (s.index >= config.targets.length) {
            s.done = true;
            onFinish('win');
          }
        }
      } else s.scan = 0;
    }

    const y = terrain.heightAt(s.x, s.z);
    const e = 0.9;
    const pitch = Math.atan2(terrain.heightAt(s.x - Math.sin(s.heading) * e, s.z - Math.cos(s.heading) * e) - y, e);
    const roll = Math.atan2(terrain.heightAt(s.x + Math.cos(s.heading) * e, s.z - Math.sin(s.heading) * e) - y, e);
    if (ref.current) {
      ref.current.position.set(s.x, y, s.z);
      ref.current.rotation.set(pitch, s.heading, -roll, 'YXZ');
    }
    if (light.current) {
      const u = Math.round((s.x * SUN_RIGHT.x + s.z * SUN_RIGHT.z) / SHADOW_TEXEL) * SHADOW_TEXEL;
      const v = Math.round((s.x * SUN_UP.x + s.z * SUN_UP.z) / SHADOW_TEXEL) * SHADOW_TEXEL;
      const w = s.x * SUN_DIR.x + s.z * SUN_DIR.z;
      const ax = SUN_RIGHT.x * u + SUN_UP.x * v + SUN_DIR.x * w;
      const ay = SUN_RIGHT.y * u + SUN_UP.y * v + SUN_DIR.y * w;
      const az = SUN_RIGHT.z * u + SUN_UP.z * v + SUN_DIR.z * w;
      light.current.target.position.set(ax, ay, az);
      light.current.target.updateMatrixWorld();
      light.current.position.set(ax + SUN_OFFSET.x, ay + SUN_OFFSET.y, az + SUN_OFFSET.z);
    }

    const fx = -Math.sin(s.heading);
    const fz = -Math.cos(s.heading);
    const { wanted, look } = scratch.current;
    wanted.set(s.x - fx * 11, 0, s.z - fz * 11);
    wanted.y = Math.max(y + 5.2, terrain.heightAt(wanted.x, wanted.z) + 2.5);
    camPos.current.lerp(wanted, damp(4, dt));
    camLook.current.lerp(look.set(s.x + fx * 7, y + 1.4, s.z + fz * 7), damp(6, dt));
    state.camera.position.copy(camPos.current);
    state.camera.lookAt(camLook.current);

    const tgt = config.targets[Math.min(s.index, config.targets.length - 1)];
    const dx = tgt.x - s.x;
    const dz = tgt.z - s.z;
    // The arrow updates every frame without touching React.
    if (arrow.current) arrow.current.style.transform = `rotate(${s.heading - Math.atan2(-dx, -dz)}rad)`;

    s.hudAt += dt;
    if (s.hudAt > 0.12) {
      s.hudAt = 0;
      hud.current?.({
        index: s.index,
        distance: Math.hypot(dx, dz),
        battery: s.battery,
        sun: config.battery ? sunlight(s.t, config.battery.solLength) : 0,
        dust: config.battery ? dustLevel(s.t, config.battery.stormAt) : 0,
        scan: s.scan / SCAN_SECONDS,
        tethered: s.tethered,
        asleep: s.asleep,
      });
    }
  });

  return (
    <>
      <Echo ref={ref} />
      {config.targets.map((t, i) => (
        <Beacon key={i} x={t.x} z={t.z} y={terrain.heightAt(t.x, t.z)} state={i < progress ? 'done' : i === progress ? 'next' : 'later'} />
      ))}
    </>
  );
}

/** Holds its own state so readout updates never re-render the 3D scene. */
function DriveHud({ id, config, lab, channel, arrow }: { id: string; config: DriveConfig; lab?: boolean; channel: HudChannel<Hud>; arrow: RefObject<HTMLSpanElement | null> }) {
  const { t } = useTranslation();
  const [hud, setHud] = useState<Hud | null>(null);
  useEffect(() => {
    channel.current = setHud;
    return () => {
      channel.current = null;
    };
  }, [channel]);
  const facts = lab ? [] : (t(`missions:${id}.targets`, { returnObjects: true, defaultValue: [] }) as unknown as { name: string; found: string }[]);
  const current = hud ? facts[Math.min(hud.index, facts.length - 1)] : undefined;
  const lastFound = hud && hud.index > 0 ? facts[hud.index - 1] : undefined;
  return (
    <>
      {hud && !lab && (
        <div className="hud-top" aria-live="off">
          <div className="waypoint">
            <span className="arrow" ref={arrow} aria-hidden="true">▲</span>
            <div>
              <strong>{current ? t('hud.toTarget', { name: current.name, d: Math.round(hud.distance) }) : ''}</strong>
              <div className="pips">
                {config.targets.map((_, i) => <i key={i} className={i < hud.index ? 'on' : i === hud.index ? 'next' : ''} />)}
              </div>
            </div>
          </div>
          {config.battery && (
            <div className="gauges">
              <Gauge label={t('hud.battery')} value={hud.battery} max={100} warn={hud.battery < 20} />
              <Gauge label={t('hud.sun')} value={hud.sun} max={1} />
              <Gauge label={t('hud.dust')} value={hud.dust} max={1} warn={hud.dust > 0.6} />
            </div>
          )}
        </div>
      )}
      {hud && hud.scan > 0 && <div className="scanbar"><span>{t('hud.scanning')}</span><i style={{ width: `${hud.scan * 100}%` }} /></div>}
      {lastFound && <div className="toast" key={hud?.index} role="status">{lastFound.found}</div>}
      {hud?.tethered && config.tether && <div className="alert" role="alert">{t(`missions:${id}.tether`)}</div>}
      {hud?.asleep && <div className="alert" role="alert">{t(`missions:${id}.low`)}</div>}
    </>
  );
}

export function DriveMission({ id, config, onResult, lab }: MissionProps<DriveConfig>) {
  const { t } = useTranslation();
  const quality = useGame((s) => s.quality);
  const keys = useKeys();
  const pad = useRef<Pad>({ forward: false, back: false, left: false, right: false });
  const channel = useRef<((h: Hud) => void) | null>(null);
  const arrow = useRef<HTMLSpanElement>(null);
  const [finished, setFinished] = useState(false);
  const sun = useRef<THREE.DirectionalLight>(null);
  const clear = useMemo(() => [{ x: config.start.x, z: config.start.z, r: 5 }, ...config.targets.map((p) => ({ x: p.x, z: p.z, r: 6 })), ...(config.prop ? [{ x: config.prop.x, z: config.prop.z, r: 5 }] : [])], [config]);
  const terrain = useMemo(() => makeTerrain({ seed: config.seed, size: 260, amplitude: config.world === 'moon' ? 5.5 : 8, craterCount: config.world === 'moon' ? 58 : 14, flat: clear }), [config, clear]);
  const rocks = useMemo(() => scatterRocks(terrain, quality === 'low' ? 60 : 180, config.seed + 3, clear), [terrain, quality, config.seed, clear]);
  const obstacles = useMemo(
    () => [...solidRocks(rocks), ...config.targets.map((p) => ({ x: p.x, z: p.z, r: BEACON_ROCK_RADIUS })), ...(config.prop ? [{ x: config.prop.x, z: config.prop.z, r: PROP_RADIUS }] : [])],
    [rocks, config],
  );

  const finish = (r: 'win' | 'storm') => {
    setFinished(true);
    window.setTimeout(() => onResult(r === 'win' ? { win: true } : { win: false, failKey: 'fail_storm' }), 900);
  };

  const hold = (key: keyof Pad, label: string, glyph: string) => (
    <HoldButton label={label} className={`pad-${key}`} onChange={(v) => (pad.current[key] = v)}>
      {glyph}
    </HoldButton>
  );

  return (
    <div className="stage">
      <GameCanvas camera={{ position: [0, 8, 14], fov: 55, far: 520 }}>
        <Sky world={config.world} />
        <Lights world={config.world} sunRef={sun} />
        <TerrainMesh terrain={terrain} world={config.world} />
        <Rocks rocks={rocks} world={config.world} />
        {config.prop && (
          <group position={[config.prop.x, terrain.heightAt(config.prop.x, config.prop.z), config.prop.z]}>
            <HardwareModel id={config.prop.model} />
          </group>
        )}
        <Rover config={config} terrain={terrain} obstacles={obstacles} keys={keys} pad={pad} light={sun} arrow={arrow} hud={channel} onFinish={finish} frozen={finished} />
      </GameCanvas>

      <DriveHud id={id} config={config} lab={lab} channel={channel} arrow={arrow} />

      <p className="keys-hint">{t('hud.keys')}</p>
      <div className="dpad">
        {hold('left', t('hud.left'), '◀')}
        <div className="dpad-mid">
          {hold('forward', t('hud.forward'), '▲')}
          {hold('back', t('hud.backward'), '▼')}
        </div>
        {hold('right', t('hud.right'), '▶')}
      </div>
    </div>
  );
}
