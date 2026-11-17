import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { useTranslation } from 'react-i18next';
import * as THREE from 'three';
import type { DriveConfig, ScanKind } from '../data/types';
import { emptyContact, resolveCollisions, rockField, solidRocks, type Obstacle, type RockField } from '../sim/obstacles';
import { makeTerrain, type Terrain } from '../sim/terrain';
import { meshHeightAt, terrainSegments } from '../sim/terrainMesh';
import { dustLevel, roverGroundPose, stepBattery, sunlight } from '../sim/rover';
import { Tracks, WheelDust } from '../three/RoverFx';
import { GameCanvas } from '../three/GameCanvas';
import { HardwareModel } from '../three/models';
import { MoonCuoi, MoonRabbit } from '../three/MoonCharacters';
import { Lights, SHADOW_TEXEL, SUN_OFFSET, Sky } from '../three/Scenery';
import { StreamedTerrain } from '../three/StreamedTerrain';
import { TILE } from '../three/terrainTiles';
import { useDialogueCue, type Speaker } from '../state/dialogueCue';
import { play } from '../audio/sfx';
import { useGame } from '../state/store';
import { Gauge, HoldButton, Readout, useKeys, type HudChannel, type MissionProps } from './common';

const SCAN_SECONDS = 1.65;
const WAKE_LEVEL = 12;

export type LabVehicle = 'sojourner' | 'mer' | 'curiosity' | 'lrv';
export type LabCamera = 'chase' | 'high' | 'cockpit';
const VEHICLES: Record<LabVehicle, { radius: number; track: number; wheelbase: number; wheelRadius: number; camera: number; eye: number }> = {
  sojourner: { radius: 1, track: 0.78, wheelbase: 1.8, wheelRadius: 0, camera: 0.85, eye: 1.5 },
  mer: { radius: 1.5, track: 0.95, wheelbase: 1.8, wheelRadius: 0, camera: 1.15, eye: 2.5 },
  curiosity: { radius: 1.8, track: 1.27, wheelbase: 1.8, wheelRadius: 0, camera: 1.35, eye: 3.4 },
  lrv: { radius: 1.6, track: 0.69, wheelbase: 1.732, wheelRadius: 0.33, camera: 1.2, eye: 1.9 },
};
const BEACON_ROCK_RADIUS = 1;
const PROP_RADIUS = 2.4;
/** Same rock density as the old 260 m field (180 rocks, 60 on low graphics), now per 32 m cell. */
const ROCKS_PER_CELL = { high: (180 / (260 * 0.95) ** 2) * TILE * TILE, low: (60 / (260 * 0.95) ** 2) * TILE * TILE };
/** Keeps the target indicator inside the screen edges (fraction of half the width/height). */
const EDGE_X = 0.86;
const EDGE_Y = 0.74;

// Frame-rate independent smoothing: the same feel at 30 fps and at 144 fps.
const damp = (rate: number, dt: number) => 1 - Math.exp(-rate * dt);
/** Turns the short way round, so a character never spins a full circle to face the camera. */
const dampAngle = (from: number, to: number, rate: number, dt: number) => from + Math.atan2(Math.sin(to - from), Math.cos(to - from)) * damp(rate, dt);

/** The sun's axes, used to move the shadow map in whole texels so shadow edges don't shimmer. */
function sunAxes(sun: THREE.Vector3) {
  const dir = sun.clone().normalize();
  const right = new THREE.Vector3(0, 1, 0).cross(dir).normalize();
  return { dir, right, up: dir.clone().cross(right) };
}

interface Hud {
  index: number;
  distance: number;
  battery: number;
  sun: number;
  dust: number;
  scan: number;
  tethered: boolean;
  asleep: boolean;
  speed: number;
  odometer: number;
  slope: number;
}

type Pad = { forward: boolean; back: boolean; left: boolean; right: boolean };

const ROCK_TINT: Record<'basalt' | 'anorthosite' | 'breccia' | 'mineral', string> = {
  basalt: '#3e4048',
  anorthosite: '#d5cfc0',
  breccia: '#8d7564',
  mineral: '#a65a3a',
};

function Beacon({ x, z, y, state, kind = 'beacon', quiet = false, scanning = false }: { x: number; z: number; y: number; state: 'next' | 'done' | 'later'; kind?: ScanKind; quiet?: boolean; scanning?: boolean }) {
  const color = scanning ? '#37e6c0' : state === 'done' ? '#37e6c0' : state === 'next' ? '#ff6a2b' : '#8b90a0';
  const emissive = scanning ? '#185449' : '#000000';
  return (
    <group position={[x, y, z]}>
      {/* Once the mission is won the beam and ring step aside for the conversation. */}
      <mesh position={[0, 16, 0]} visible={!quiet}>
        <cylinderGeometry args={[0.32, 0.32, 32, 8, 1, true]} />
        <meshBasicMaterial color={color} transparent opacity={state === 'later' ? 0.12 : 0.42} depthWrite={false} toneMapped={false} fog={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.16, 0]} visible={!quiet}>
        <ringGeometry args={[3.2, 3.6, 40]} />
        <meshBasicMaterial color={color} transparent opacity={0.8} toneMapped={false} fog={false} />
      </mesh>
      {scanning && !quiet && (
        <mesh position={[0, 1.35, 0]}>
          <cylinderGeometry args={[1.35, 1.8, 2.5, 24, 1, true]} />
          <meshBasicMaterial color="#37e6c0" transparent opacity={0.22} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} fog={false} />
        </mesh>
      )}
      {kind === 'beacon' ? (
        <group>
          <mesh position={[0, 0.75, 0]} castShadow>
            <cylinderGeometry args={[0.1, 0.16, 1.5, 10]} />
            <meshStandardMaterial color="#b6bac6" metalness={0.5} roughness={0.45} />
          </mesh>
          <mesh position={[0, 1.65, 0]}>
            <octahedronGeometry args={[0.34, 0]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={scanning ? 1.1 : 0.45} roughness={0.3} />
          </mesh>
        </group>
      ) : kind === 'signal' ? (
        <group>
          <mesh position={[0, 0.36, 0]} castShadow>
            <boxGeometry args={[1.15, 0.72, 0.95]} />
            <meshStandardMaterial color="#c9a84c" metalness={0.55} roughness={0.35} emissive={emissive} />
          </mesh>
          <mesh position={[0, 0.76, 0]} castShadow>
            <boxGeometry args={[1.55, 0.08, 0.55]} />
            <meshStandardMaterial color="#364b68" metalness={0.4} roughness={0.4} />
          </mesh>
          <mesh position={[0.32, 1.32, 0]}>
            <cylinderGeometry args={[0.04, 0.04, 1.1, 8]} />
            <meshStandardMaterial color="#d9dde6" metalness={0.6} roughness={0.3} />
          </mesh>
        </group>
      ) : (
        <mesh position={[0, 0.7, 0]} castShadow>
          <dodecahedronGeometry args={[BEACON_ROCK_RADIUS, 0]} />
          <meshStandardMaterial color={scanning ? '#6df5d8' : state === 'done' ? '#5ea99a' : ROCK_TINT[kind]} emissive={emissive} flatShading roughness={1} />
        </mesh>
      )}
    </group>
  );
}

interface RoverProps {
  missionId: string;
  config: DriveConfig;
  terrain: Terrain;
  /** Beacons and props; rocks come from `field` around wherever the rover is. */
  fixed: Obstacle[];
  field: RockField;
  keys: ReturnType<typeof useKeys>;
  pad: RefObject<Pad>;
  light: RefObject<THREE.DirectionalLight | null>;
  arrow: RefObject<HTMLSpanElement | null>;
  edge: RefObject<HTMLDivElement | null>;
  hud: HudChannel<Hud>;
  onFinish: (r: 'win' | 'storm') => void;
  frozen: boolean;
  /** The mission was won: Cuội and the Moon Rabbit come to the rover and the dialogue plays here. */
  celebrate: boolean;
  vehicle: LabVehicle;
  sun: THREE.Vector3;
  cameraMode: LabCamera;
  look: RefObject<LookOffset>;
}

interface LookOffset {
  yaw: number;
  pitch: number;
  active: boolean;
}

const LOOK_SENSITIVITY = 0.006;
const CHASE_ELEVATION = Math.atan2(5.2, 11);
const CHASE_DISTANCE = Math.hypot(5.2, 11);

type View = 'wide' | 'friends' | 'rover';
const viewFor = (speaker: Speaker | null): View => (speaker === 'cuoi' || speaker === 'rabbit' ? 'friends' : speaker === 'lrv' || speaker === 'echo' ? 'rover' : 'wide');

function Rover({ missionId, config, terrain, fixed, field, keys, pad, light, arrow, edge, hud, onFinish, frozen, celebrate, vehicle, sun, cameraMode, look: lookOffset }: RoverProps) {
  const specs = VEHICLES[vehicle];
  const axes = useMemo(() => sunAxes(sun), [sun]);
  const ref = useRef<THREE.Group>(null);
  const sim = useRef({ x: config.start.x, z: config.start.z, heading: 0, speed: 0, index: 0, scan: 0, battery: 100, t: 0, asleep: false, hudAt: 0, done: false, tethered: false, odometer: 0 });
  const camPos = useRef(new THREE.Vector3(config.start.x, 8, config.start.z + 14));
  const camLook = useRef(new THREE.Vector3(config.start.x, 1, config.start.z - 4));
  const scratch = useRef({ wanted: new THREE.Vector3(), look: new THREE.Vector3(), contact: emptyContact(), pose: { y: 0, pitch: 0, roll: 0 } });
  const [progress, setProgress] = useState(0);
  const [scanning, setScanning] = useState(false);
  const scanActive = useRef(false);
  const cuoiWorking = useRef(false);
  const cuoiMoving = useRef(false);
  const cuoiRunning = useRef(false);
  const cuoiRef = useRef<THREE.Group>(null);
  const withCuoi = config.world === 'moon' && vehicle === 'lrv' && config.cuoi !== false;
  const friendsCome = celebrate && config.world === 'moon';
  const cuoiPosition = useRef(new THREE.Vector3(config.start.x + specs.radius + 1.1, terrain.heightAt(config.start.x + specs.radius + 1.1, config.start.z) + 0.08, config.start.z));
  const cuoiRotation = useRef(0);
  const rabbitRef = useRef<THREE.Group>(null);
  const rabbitPosition = useRef(new THREE.Vector3());
  const rabbitRotation = useRef(0);
  const arrived = useRef(false);
  // The side of the rover facing away from the last target: the cast stands and the camera films there.
  const away = useRef(1);
  // Rocks near the rover, rebuilt only when it drives into another cell.
  const nearby = useRef<{ cell: number; list: Obstacle[] }>({ cell: NaN, list: fixed });
  const projected = useRef(new THREE.Vector3());

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const s = sim.current;
    const maxSpeed = missionId === 'm2_collect' ? 12 : 11;
    cuoiWorking.current = withCuoi && s.scan > 0;
    if (!friendsCome) {
      const speed = Math.abs(s.speed);
      cuoiMoving.current = withCuoi && !frozen && !cuoiWorking.current && speed > 0.3;
      cuoiRunning.current = cuoiMoving.current && speed >= maxSpeed * 0.5;
    } else {
      cuoiRunning.current = false;
    }
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
          return;
        }
      }

      const tgt = config.targets[s.index];
      const atSample = missionId === 'm2_collect' && tgt && Math.hypot(tgt.x - s.x, tgt.z - s.z) < config.radius;
      const drive = s.asleep || atSample ? 0 : forward ? 1 : back ? -0.55 : 0;
      s.speed = atSample ? 0 : s.speed + (drive * maxSpeed - s.speed) * damp(missionId === 'm2_collect' ? 3.4 : 2.6, dt);
      s.odometer += Math.abs(s.speed) * dt;
      if (!s.asleep) s.heading += ((left ? 1 : 0) - (right ? 1 : 0)) * dt * (1.9 - Math.min(0.7, Math.abs(s.speed) * 0.05));

      const dirX = -Math.sin(s.heading);
      const dirZ = -Math.cos(s.heading);
      const rcx = Math.floor(s.x / field.cell);
      const rcz = Math.floor(s.z / field.cell);
      if (nearby.current.cell !== rcx * 65536 + rcz) {
        const list = [...fixed];
        for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) list.push(...solidRocks(field.at(rcx + dx, rcz + dz)));
        nearby.current = { cell: rcx * 65536 + rcz, list };
      }
      const contact = resolveCollisions(s.x + dirX * s.speed * dt, s.z + dirZ * s.speed * dt, specs.radius, nearby.current.list, scratch.current.contact);
      if (contact.hit) {
        // Lose only the part of the speed aimed at the rock, so a glancing hit keeps sliding.
        const sign = Math.sign(s.speed);
        const into = Math.max(0, -(dirX * sign * contact.nx + dirZ * sign * contact.nz));
        s.speed *= 1 - into;
      }
      let nx = contact.x;
      let nz = contact.z;

      const limit = config.tether ?? Infinity;
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

      if (tgt && Math.hypot(tgt.x - s.x, tgt.z - s.z) < config.radius) {
        s.scan += dt;
        if (!scanActive.current) {
          scanActive.current = true;
          setScanning(true);
        }
        if (s.scan >= SCAN_SECONDS) {
          s.scan = 0;
          s.index += 1;
          scanActive.current = false;
          setScanning(false);
          play('ping');
          setProgress(s.index);
          if (s.index >= config.targets.length) {
            s.done = true;
            onFinish('win');
          }
        }
      } else {
        s.scan = 0;
        if (scanActive.current) {
          scanActive.current = false;
          setScanning(false);
        }
      }
    }

    const { y, pitch, roll } = roverGroundPose(terrain.heightAt, s.x, s.z, s.heading, specs.track, specs.wheelbase / 2, specs.wheelRadius, scratch.current.pose);
    const fx = -Math.sin(s.heading);
    const fz = -Math.cos(s.heading);
    const sideX = Math.cos(s.heading);
    const sideZ = -Math.sin(s.heading);
    // After a win, Cuội and the rabbit walk up beside the rover and stand facing the camera.
    const spot = (side: number, ahead: number, out: THREE.Vector3) => out.set(s.x + sideX * side * away.current + fx * ahead, 0, s.z + sideZ * side * away.current + fz * ahead);
    if (friendsCome && !arrived.current) {
      arrived.current = true;
      const last = config.targets[config.targets.length - 1];
      away.current = (last.x - s.x) * sideX + (last.z - s.z) * sideZ > 0 ? -1 : 1;
      // Whoever was not riding along arrives from behind the rover.
      if (!withCuoi) spot(5, -9, cuoiPosition.current);
      spot(7, -11, rabbitPosition.current);
      rabbitRotation.current = s.heading;
    }
    const cuoiGoal = friendsCome ? spot(2.4, -0.1, scratch.current.look) : spot(specs.radius + 1.1, 0, scratch.current.look);
    const goalX = cuoiGoal.x;
    const goalZ = cuoiGoal.z;
    const walkRate = friendsCome ? 1.4 : 2.7;
    // Delay only the horizontal follow; feet stay planted on the terrain instead of floating.
    cuoiPosition.current.x = THREE.MathUtils.damp(cuoiPosition.current.x, goalX, walkRate, dt);
    cuoiPosition.current.z = THREE.MathUtils.damp(cuoiPosition.current.z, goalZ, walkRate, dt);
    cuoiPosition.current.y = terrain.heightAt(cuoiPosition.current.x, cuoiPosition.current.z);
    const cuoiLeft = Math.hypot(goalX - cuoiPosition.current.x, goalZ - cuoiPosition.current.z);
    // Characters face local +Z. Walking, they face their path; standing, they face the camera.
    const camera = state.camera.position;
    const desiredCuoiRotation = !friendsCome
      ? s.heading + Math.PI
      : cuoiLeft > 0.35
        ? Math.atan2(goalX - cuoiPosition.current.x, goalZ - cuoiPosition.current.z)
        : Math.atan2(camera.x - cuoiPosition.current.x, camera.z - cuoiPosition.current.z);
    if (friendsCome) cuoiMoving.current = cuoiLeft > 0.35;
    cuoiRotation.current = dampAngle(cuoiRotation.current, desiredCuoiRotation, 5, dt);
    if (cuoiRef.current) {
      cuoiRef.current.position.copy(cuoiPosition.current);
      cuoiRef.current.rotation.y = cuoiRotation.current;
      cuoiRef.current.visible = config.world === 'moon' && vehicle === 'lrv';
    }
    if (friendsCome && rabbitRef.current) {
      const goal = spot(2.5, -1.35, scratch.current.wanted);
      const r = rabbitPosition.current;
      r.x = THREE.MathUtils.damp(r.x, goal.x, 1.8, dt);
      r.z = THREE.MathUtils.damp(r.z, goal.z, 1.8, dt);
      const left = Math.hypot(goal.x - r.x, goal.z - r.z);
      // Little hops while travelling, then still.
      r.y = terrain.heightAt(r.x, r.z) + (left > 0.3 ? Math.abs(Math.sin(state.clock.elapsedTime * 9)) * 0.22 : 0);
      // The rabbit model faces local -Z, hence the half turn.
      const want = left > 0.3 ? Math.atan2(goal.x - r.x, goal.z - r.z) + Math.PI : Math.atan2(camera.x - r.x, camera.z - r.z) + Math.PI;
      rabbitRotation.current = dampAngle(rabbitRotation.current, want, 6, dt);
      rabbitRef.current.position.copy(r);
      rabbitRef.current.rotation.y = rabbitRotation.current;
    }
    if (ref.current) {
      ref.current.visible = cameraMode !== 'cockpit';
      ref.current.position.set(s.x, y, s.z);
      ref.current.rotation.set(pitch, s.heading, roll, 'YXZ');
    }
    if (light.current) {
      const { dir, right, up } = axes;
      const u = Math.round((s.x * right.x + s.z * right.z) / SHADOW_TEXEL) * SHADOW_TEXEL;
      const v = Math.round((s.x * up.x + s.z * up.z) / SHADOW_TEXEL) * SHADOW_TEXEL;
      const w = s.x * dir.x + s.z * dir.z;
      const ax = right.x * u + up.x * v + dir.x * w;
      const ay = right.y * u + up.y * v + dir.y * w;
      const az = right.z * u + up.z * v + dir.z * w;
      light.current.target.position.set(ax, ay, az);
      light.current.target.updateMatrixWorld();
      light.current.position.set(ax + sun.x, ay + sun.y, az + sun.z);
    }

    const { wanted, look } = scratch.current;
    const { yaw, pitch: tilt, active } = lookOffset.current;
    const follow = active ? 16 : 4;
    const yawX = -Math.sin(s.heading + yaw);
    const yawZ = -Math.cos(s.heading + yaw);
    if (friendsCome) {
      // A small film crew: a wide shot, then whoever speaks. Shots are set around the parked rover.
      const view = viewFor(useDialogueCue.getState().speaker);
      const ox = sideX * away.current;
      const oz = sideZ * away.current;
      const friendsX = s.x + ox * 2.45 - fx * 0.7;
      const friendsZ = s.z + oz * 2.45 - fz * 0.7;
      if (view === 'friends') {
        // From outside, looking back at the two of them with the rover behind.
        wanted.set(friendsX + ox * 4.3 + fx * 0.8, 0, friendsZ + oz * 4.3 + fz * 0.8);
        look.set(friendsX, y + 0.85, friendsZ);
      } else if (view === 'rover') {
        wanted.set(s.x + ox * 4.4 + fx * 3.4, 0, s.z + oz * 4.4 + fz * 3.4);
        look.set(s.x, y + 0.8, s.z);
      } else {
        wanted.set(s.x + ox * 8.5 - fx * 4.5, 0, s.z + oz * 8.5 - fz * 4.5);
        look.set(s.x + ox * 1.3, y + 0.9, s.z + oz * 1.3);
      }
      wanted.y = Math.max(y + (view === 'wide' ? 4 : 1.9), terrain.heightAt(wanted.x, wanted.z) + 1.3);
      camPos.current.lerp(wanted, damp(2.6, dt));
      camLook.current.lerp(look, damp(3.2, dt));
    } else if (cameraMode === 'cockpit') {
      wanted.set(s.x + fx * (specs.radius * 0.7), y + specs.eye, s.z + fz * (specs.radius * 0.7));
      camPos.current.lerp(wanted, damp(14, dt));
      camLook.current.lerp(look.set(s.x + yawX * 26, y + specs.eye - 1.2 + pitch * 18 - tilt * 26, s.z + yawZ * 26), damp(active ? 24 : 14, dt));
    } else if (cameraMode === 'high') {
      const c = Math.cos(yaw);
      const n = Math.sin(yaw);
      const lift = Math.max(10, 34 + tilt * 30);
      wanted.set(s.x + 8 * c + 16 * n, y + lift, s.z - 8 * n + 16 * c);
      camPos.current.lerp(wanted, damp(follow, dt));
      camLook.current.lerp(look.set(s.x, y, s.z), damp(6, dt));
    } else {
      const elevation = Math.max(0.1, Math.min(1.4, CHASE_ELEVATION + tilt));
      const reach = CHASE_DISTANCE * specs.camera;
      const flat = Math.cos(elevation) * reach;
      wanted.set(s.x - yawX * flat, 0, s.z - yawZ * flat);
      wanted.y = Math.max(y + Math.sin(elevation) * reach, terrain.heightAt(wanted.x, wanted.z) + 2.5);
      camPos.current.lerp(wanted, damp(follow, dt));
      // Looking ahead only makes sense from behind; when orbiting, keep the rover centred.
      const lead = 7 * Math.max(0, 1 - Math.abs(yaw) / 0.9);
      camLook.current.lerp(look.set(s.x + fx * lead, y + 1.4, s.z + fz * lead), damp(active ? 16 : 6, dt));
    }
    state.camera.position.copy(camPos.current);
    state.camera.lookAt(camLook.current);

    const tgt = config.targets[Math.min(s.index, config.targets.length - 1)];
    const dx = tgt.x - s.x;
    const dz = tgt.z - s.z;
    // The arrow updates every frame without touching React.
    if (arrow.current) arrow.current.style.transform = `rotate(${s.heading - Math.atan2(-dx, -dz)}rad)`;
    // When the next target leaves the screen, an indicator on the screen edge points back to it.
    if (edge.current) {
      const p = projected.current.set(tgt.x, terrain.heightAt(tgt.x, tgt.z) + 2, tgt.z).project(state.camera);
      const behind = p.z > 1;
      const offscreen = behind || Math.abs(p.x) > EDGE_X || Math.abs(p.y) > EDGE_Y;
      const show = offscreen && !frozen && !s.done;
      edge.current.hidden = !show;
      if (show) {
        let ex = behind ? -p.x : p.x;
        let ey = behind ? -p.y : p.y;
        if (Math.hypot(ex, ey) < 1e-3) ey = -1;
        const k = 1 / Math.max(Math.abs(ex) / EDGE_X, Math.abs(ey) / EDGE_Y);
        ex *= k;
        ey *= k;
        edge.current.style.left = `${(ex * 0.5 + 0.5) * 100}%`;
        edge.current.style.top = `${(-ey * 0.5 + 0.5) * 100}%`;
        edge.current.style.setProperty('--edge-angle', `${Math.atan2(ex, ey)}rad`);
      }
    }

    s.hudAt += dt;
    if (s.hudAt > (s.scan > 0 ? 0.04 : 0.12)) {
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
        speed: Math.abs(s.speed),
        odometer: s.odometer,
        slope: (Math.max(Math.abs(pitch), Math.abs(roll)) * 180) / Math.PI,
      });
    }
  });

  return (
    <>
      <group ref={ref}>
        <HardwareModel id={vehicle} />
      </group>
      {(withCuoi || friendsCome) && <group ref={cuoiRef}><MoonCuoi scale={0.72} workingRef={cuoiWorking} movingRef={cuoiMoving} runningRef={cuoiRunning} /></group>}
      {friendsCome && <group ref={rabbitRef} position={rabbitPosition.current}><MoonRabbit scale={0.62} /></group>}
      <Tracks motion={sim} terrain={terrain} halfWidth={specs.track} world={config.world} />
      <WheelDust motion={sim} terrain={terrain} halfWidth={specs.track} world={config.world} />
      {config.targets.map((t, i) => (
        <Beacon key={i} x={t.x} z={t.z} y={terrain.heightAt(t.x, t.z)} state={i < progress ? 'done' : i === progress ? 'next' : 'later'} kind={t.kind ?? 'beacon'} quiet={friendsCome} scanning={scanning && i === progress} />
      ))}
    </>
  );
}

function HoloGlyph({ kind }: { kind: ScanKind }) {
  return (
    <svg viewBox="0 0 80 80" className="scan-holo__svg" aria-hidden="true">
      {kind === 'basalt' && (
        <g fill="rgba(55,230,192,.14)" stroke="#37e6c0" strokeWidth="1.6" strokeLinejoin="round">
          <polygon points="18,54 14,34 30,18 54,16 66,34 60,58 34,64" />
          <polyline points="14,34 38,38 54,16" fill="none" opacity=".7" />
          <line x1="38" y1="38" x2="34" y2="64" opacity=".7" />
          <circle cx="28" cy="30" r="3" />
          <circle cx="48" cy="44" r="3.5" />
          <circle cx="44" cy="27" r="2.2" />
        </g>
      )}
      {kind === 'anorthosite' && (
        <g fill="rgba(244,234,215,.16)" stroke="#37e6c0" strokeWidth="1.6" strokeLinejoin="round">
          <polygon points="16,52 22,22 46,14 64,28 58,56 32,62" />
          <rect x="26" y="28" width="16" height="6" transform="rotate(-22 34 31)" />
          <rect x="36" y="40" width="18" height="6" transform="rotate(28 45 43)" />
          <rect x="24" y="44" width="14" height="5" transform="rotate(12 31 46)" />
        </g>
      )}
      {kind === 'breccia' && (
        <g fill="rgba(55,230,192,.14)" stroke="#37e6c0" strokeWidth="1.6" strokeLinejoin="round">
          <polygon points="15,50 18,24 42,15 65,26 61,55 36,64" />
          <polygon points="24,36 33,24 41,34 31,42" fill="rgba(255,178,90,.24)" />
          <polygon points="44,30 56,33 52,46 42,42" fill="rgba(55,230,192,.26)" />
          <polygon points="28,48 40,46 45,56 31,57" fill="rgba(255,178,90,.18)" />
        </g>
      )}
      {kind === 'mineral' && (
        <g fill="rgba(55,230,192,.14)" stroke="#37e6c0" strokeWidth="1.6" strokeLinejoin="round">
          <polygon points="14,56 20,26 42,20 64,28 66,56" />
          <path d="M18,40 Q40,34 62,40" fill="none" opacity=".75" />
          <path d="M16,48 Q40,44 64,48" fill="none" opacity=".75" />
          <circle cx="32" cy="30" r="3" fill="#ffb25a" />
          <circle cx="48" cy="33" r="2.6" fill="#ffb25a" />
        </g>
      )}
      {kind === 'signal' && (
        <g fill="none" stroke="#37e6c0" strokeWidth="1.7" strokeLinecap="round">
          <rect x="24" y="48" width="32" height="14" rx="2" fill="rgba(55,230,192,.14)" />
          <line x1="40" y1="48" x2="40" y2="30" />
          <circle cx="40" cy="28" r="3" fill="#37e6c0" />
          <path d="M29,22 A16,16 0 0,1 51,22" />
          <path d="M22,16 A25,25 0 0,1 58,16" opacity=".7" />
        </g>
      )}
      {kind === 'beacon' && (
        <g fill="rgba(55,230,192,.16)" stroke="#37e6c0" strokeWidth="1.6" strokeLinejoin="round">
          <polygon points="40,14 62,40 40,66 18,40" />
          <polygon points="40,24 52,40 40,56 28,40" fill="none" opacity=".7" />
        </g>
      )}
    </svg>
  );
}

function ScanHologram({ kind, name, progress }: { kind: ScanKind; name?: string; progress: number }) {
  const { t } = useTranslation();
  const p = Math.max(0, Math.min(1, progress));
  const glyphBlur = ((1 - p) * 8.5).toFixed(1);
  const labelBlur = (Math.max(0, 1 - p * 1.2) * 6.5).toFixed(1);
  const clarity = Number((0.42 + p * 0.58).toFixed(2));
  return (
    <div className="scan-holo" role="status" aria-live="polite">
      <div className="scan-holo__frame">
        <div className="scan-holo__glyph" style={{ filter: `blur(${glyphBlur}px)`, opacity: clarity }}>
          <HoloGlyph kind={kind} />
        </div>
        <div className="scan-holo__sweep" aria-hidden="true" />
      </div>
      <div className="scan-holo__info">
        <div className="scan-holo__head">
          <span className="scan-holo__eyebrow">{t('hud.scanning')}</span>
          <span className="scan-holo__pct">{Math.round(p * 100)}%</span>
        </div>
        <strong className="scan-holo__type" style={{ filter: `blur(${labelBlur}px)`, opacity: clarity }}>
          {t(`hud.scanKinds.${kind}`)}
        </strong>
        <span className="scan-holo__meta">
          {p >= 0.85 ? t('hud.scanLocked') : name || t('hud.scanAnalyzing')}
        </span>
        <div className="scan-holo__bar"><i style={{ width: `${p * 100}%` }} /></div>
      </div>
    </div>
  );
}

/** Holds its own state so readout updates never re-render the 3D scene. */
function DriveHud({ id, config, lab, channel, arrow, edge }: { id: string; config: DriveConfig; lab?: boolean; channel: HudChannel<Hud>; arrow: RefObject<HTMLSpanElement | null>; edge: RefObject<HTMLDivElement | null> }) {
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
  const currentKind: ScanKind = hud ? config.targets[Math.min(hud.index, config.targets.length - 1)]?.kind ?? 'beacon' : 'beacon';
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
      {hud && lab && (
        <div className="hud-side">
          <Readout label={t('hud.speed')} value={hud.speed.toFixed(1)} unit="m/s" />
          <Readout label={t('hud.odometer')} value={hud.odometer.toFixed(0)} unit="m" />
          <Readout label={t('hud.slope')} value={hud.slope.toFixed(0)} unit="°" />
        </div>
      )}
      {!lab && (
        <div className="edge-target" ref={edge} hidden role="status">
          <span className="edge-target__arrow" aria-hidden="true">▲</span>
          <span className="edge-target__label">{t('hud.backToTarget', { d: hud ? Math.round(hud.distance) : 0 })}</span>
        </div>
      )}
      {hud && hud.scan > 0 && <ScanHologram kind={currentKind} name={current?.name} progress={hud.scan} />}
      {lastFound && <div className="toast" key={hud?.index} role="status">{lastFound.found}</div>}
      {hud?.tethered && config.tether && <div className="alert" role="alert">{t(`missions:${id}.tether`)}</div>}
      {hud?.asleep && <div className="alert" role="alert">{t(`missions:${id}.low`)}</div>}
    </>
  );
}

const DUSK_SUN_OFFSET = new THREE.Vector3(56, 26, -32);

export function DriveMission({ id, config, onResult, lab, vehicle = 'lrv', sun, cameraMode = 'chase' }: MissionProps<DriveConfig> & { vehicle?: LabVehicle; sun?: THREE.Vector3; cameraMode?: LabCamera }) {
  const { t } = useTranslation();
  const quality = useGame((s) => s.quality);
  const keys = useKeys();
  const pad = useRef<Pad>({ forward: false, back: false, left: false, right: false });
  const channel = useRef<((h: Hud) => void) | null>(null);
  const lookOffset = useRef<LookOffset>({ yaw: 0, pitch: 0, active: false });
  const lastPointer = useRef({ x: 0, y: 0 });
  useEffect(() => {
    lookOffset.current.yaw = 0;
    lookOffset.current.pitch = 0;
  }, [cameraMode]);
  const lookHandlers = lab
    ? {
        onContextMenu: (e: ReactMouseEvent) => e.preventDefault(),
        onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => {
          if (e.button !== 2) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          lookOffset.current.active = true;
          lastPointer.current = { x: e.clientX, y: e.clientY };
        },
        onPointerMove: (e: ReactPointerEvent<HTMLDivElement>) => {
          if (!lookOffset.current.active) return;
          lookOffset.current.yaw -= (e.clientX - lastPointer.current.x) * LOOK_SENSITIVITY;
          lookOffset.current.pitch = Math.max(-0.6, Math.min(1, lookOffset.current.pitch + (e.clientY - lastPointer.current.y) * LOOK_SENSITIVITY));
          lastPointer.current = { x: e.clientX, y: e.clientY };
        },
        onPointerUp: (e: ReactPointerEvent<HTMLDivElement>) => {
          if (e.button === 2) lookOffset.current.active = false;
        },
      }
    : {};
  const arrow = useRef<HTMLSpanElement>(null);
  const edge = useRef<HTMLDivElement>(null);
  const [finished, setFinished] = useState<'win' | 'storm' | null>(null);
  const sunLight = useRef<THREE.DirectionalLight>(null);
  const sunVector = useMemo(() => sun ?? (config.dusk ? DUSK_SUN_OFFSET : SUN_OFFSET), [sun, config.dusk]);
  const clear = useMemo(() => [{ x: config.start.x, z: config.start.z, r: 5 }, ...config.targets.map((p) => ({ x: p.x, z: p.z, r: 6 })), ...(config.prop ? [{ x: config.prop.x, z: config.prop.z, r: 5 }] : [])], [config]);
  const terrain = useMemo(() => makeTerrain({ seed: config.seed, size: 260, amplitude: config.world === 'moon' ? 5.5 : 8, craterCount: config.world === 'moon' ? 58 : 14, sharpCraters: config.world === 'moon', flat: clear, endless: true }), [config, clear]);
  const groundTerrain = useMemo(() => ({ ...terrain, heightAt: meshHeightAt(terrain.heightAt, terrainSegments(quality === 'low')) }), [terrain, quality]);
  const field = useMemo(() => rockField(groundTerrain, TILE, quality === 'low' ? ROCKS_PER_CELL.low : ROCKS_PER_CELL.high, config.seed + 3, clear), [groundTerrain, quality, config.seed, clear]);
  const fixed = useMemo(
    () => [...config.targets.map((p) => ({ x: p.x, z: p.z, r: BEACON_ROCK_RADIUS })), ...(config.prop ? [{ x: config.prop.x, z: config.prop.z, r: PROP_RADIUS }] : [])],
    [config],
  );

  const finish = (r: 'win' | 'storm') => {
    setFinished(r);
    window.setTimeout(() => onResult(r === 'win' ? { win: true } : { win: false, failKey: 'fail_storm' }), 900);
  };

  const hold = (key: keyof Pad, label: string, glyph: string) => (
    <HoldButton label={label} className={`pad-${key}`} onChange={(v) => (pad.current[key] = v)}>
      {glyph}
    </HoldButton>
  );

  return (
    <div className={`stage${finished === 'win' ? ' is-celebrating' : ''}`} {...lookHandlers}>
      <GameCanvas camera={{ position: [0, 8, 14], fov: 55, far: 520 }}>
        <Sky world={config.world} sun={sunVector} />
        <Lights world={config.world} sunRef={sunLight} sun={sunVector} />
        <StreamedTerrain terrain={terrain} world={config.world} rocks={field} />
        {config.prop && (
          <group position={[config.prop.x, groundTerrain.heightAt(config.prop.x, config.prop.z), config.prop.z]}>
            <HardwareModel id={config.prop.model} />
          </group>
        )}
        <Rover missionId={id} config={config} terrain={groundTerrain} fixed={fixed} field={field} keys={keys} pad={pad} light={sunLight} arrow={arrow} edge={edge} hud={channel} onFinish={finish} frozen={finished !== null} celebrate={finished === 'win' && !lab} vehicle={vehicle} sun={sunVector} cameraMode={cameraMode} look={lookOffset} />
      </GameCanvas>

      <DriveHud id={id} config={config} lab={lab} channel={channel} arrow={arrow} edge={edge} />

      <p className="keys-hint">{t('hud.keys')}{lab ? ` · ${t('hud.lookKeys')}` : ''}</p>
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
