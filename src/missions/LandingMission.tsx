import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { useTranslation } from 'react-i18next';
import * as THREE from 'three';
import type { LandingConfig } from '../data/types';
import { initialLander, isDown, stepLander, type LanderState } from '../sim/lander';
import { scatterRocks } from '../sim/obstacles';
import { makeTerrain } from '../sim/terrain';
import { GameCanvas } from '../three/GameCanvas';
import { HardwareModel } from '../three/models';
import { Lights, Rocks, Sky, TerrainMesh } from '../three/Scenery';
import { play } from '../audio/sfx';
import { Gauge, HoldButton, Readout, useKeys, type HudChannel, type MissionProps } from './common';

const STEP = 1 / 120;
const visualAlt = (alt: number, hover: boolean) => (hover ? alt * 1.15 : 15 * Math.log10(1 + alt / 4));

interface Hud {
  alt: number;
  vel: number;
  fuel: number;
  chute: boolean;
  firing: boolean;
  held: number;
}

function Flight({ config, input, keys, channel, onEnd }: { config: LandingConfig; input: RefObject<{ throttle: boolean; chute: boolean }>; keys: ReturnType<typeof useKeys>; channel: HudChannel<Hud>; onEnd: (s: LanderState, heldEnough: boolean) => void }) {
  const hover = config.objective === 'hover';
  const craft = useRef<THREE.Group>(null);
  const plume = useRef<THREE.Mesh>(null);
  const rotor = useRef<THREE.Group>(null);
  const canopy = useRef<THREE.Group>(null);
  const streaks = useRef<THREE.Group>(null);
  const sim = useRef({ s: initialLander(config.alt, config.vel, config.fuel), prevAlt: config.alt, acc: 0, hudAt: 0, over: false, held: 0, tilt: 0 });

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const c = sim.current;
    const k = keys.current;
    const throttle = input.current.throttle || k.has('Space') || k.has('ArrowUp') || k.has('KeyW');
    const chute = !!config.hasChute && input.current.chute;
    if (!c.over) {
      c.acc += dt;
      while (c.acc >= STEP && !c.over) {
        c.acc -= STEP;
        c.prevAlt = c.s.alt;
        c.s = stepLander(c.s, config.params, { throttle, chute }, STEP);
        if (hover && config.band && c.s.alt >= config.band[0] && c.s.alt <= config.band[1]) c.held = Math.min(config.hold ?? 0, c.held + STEP);
        if (isDown(c.s)) {
          const soft = Math.abs(c.s.vel) <= config.safe;
          const enough = !hover || c.held >= (config.hold ?? 0);
          if (hover && soft && !enough) {
            // A gentle hop isn't failure; let the player lift off again.
            c.s = { ...c.s, vel: 0, maxAlt: 0 };
          } else {
            c.over = true;
            if (!soft) c.tilt = 0.75;
            onEnd(c.s, enough);
          }
        } else if (c.s.fuel <= 0 && c.s.alt > 0 && hover) {
          c.over = true;
          onEnd(c.s, false);
        }
      }
    }
    const s = c.s;
    const firing = throttle && s.fuel > 0 && !c.over;
    // Physics runs in fixed steps; blend the last two so motion stays even at any frame rate.
    const shownAlt = c.over ? s.alt : c.prevAlt + (s.alt - c.prevAlt) * (c.acc / STEP);
    const y = visualAlt(shownAlt, hover);
    if (craft.current) {
      craft.current.position.y = y;
      craft.current.rotation.z += (c.tilt - craft.current.rotation.z) * Math.min(1, dt * 7);
    }
    if (plume.current) {
      plume.current.visible = firing && !hover;
      plume.current.scale.y = 0.8 + Math.random() * 0.5;
    }
    if (rotor.current) rotor.current.rotation.y += dt * (firing ? 60 : 8);
    if (canopy.current) canopy.current.visible = chute && s.alt > 0.5;
    if (streaks.current) {
      streaks.current.position.y = ((shownAlt * (hover ? 1.15 : 0.5)) % 12) + y - 6;
      streaks.current.visible = !hover && s.alt > 6;
    }
    const camY = hover ? 4.5 : Math.max(y + 5.5, 4);
    state.camera.position.set(hover ? 5 : 8, camY, hover ? 12 : 17);
    state.camera.lookAt(0, hover ? 3.4 : Math.max(y - 2, 1), 0);

    c.hudAt += dt;
    if (c.hudAt > 0.1) {
      c.hudAt = 0;
      channel.current?.({ alt: s.alt, vel: s.vel, fuel: s.fuel, chute, firing, held: c.held });
    }
  });

  const streakPositions = useMemo(() => Array.from({ length: 36 }, (_, i) => [Math.sin(i * 7.3) * 15, (i * 37) % 24, Math.cos(i * 3.1) * 15 - 2] as const), []);

  return (
    <>
      <group ref={craft} position={[0, visualAlt(config.alt, hover), 0]}>
        <HardwareModel id={config.vehicle} />
        {config.vehicle === 'ingenuity' && (
          <group ref={rotor} position={[0, 1.65, 0]}>
            <mesh>
              <cylinderGeometry args={[1.5, 1.5, 0.01, 24]} />
              <meshBasicMaterial color="#f4ead7" transparent opacity={0.2} depthWrite={false} />
            </mesh>
          </group>
        )}
        <mesh ref={plume} position={[0, 0.05, 0]} rotation={[Math.PI, 0, 0]} visible={false}>
          <coneGeometry args={[0.55, 2.6, 12, 1, true]} />
          <meshBasicMaterial color="#ffb25a" transparent opacity={0.75} depthWrite={false} toneMapped={false} />
        </mesh>
        {config.hasChute && (
          <group ref={canopy} visible={false} position={[0, 9, 0]}>
            <mesh>
              <sphereGeometry args={[3.2, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
              <meshStandardMaterial color="#ff6a2b" side={THREE.DoubleSide} />
            </mesh>
            {[0, 1.57, 3.14, 4.71].map((a) => (
              <mesh key={a} position={[Math.cos(a) * 1.6, -3.3, Math.sin(a) * 1.6]} rotation={[Math.sin(a) * 0.45, 0, -Math.cos(a) * 0.45]}>
                <cylinderGeometry args={[0.012, 0.012, 7.4, 4]} />
                <meshBasicMaterial color="#f4ead7" />
              </mesh>
            ))}
          </group>
        )}
      </group>
      <group ref={streaks}>
        {streakPositions.map((p, i) => (
          <mesh key={i} position={p as unknown as [number, number, number]}>
            <boxGeometry args={[0.03, 1.3, 0.03]} />
            <meshBasicMaterial color="#f4ead7" transparent opacity={0.3} />
          </mesh>
        ))}
      </group>
      {hover && config.band && (
        <mesh position={[0, ((config.band[0] + config.band[1]) / 2) * 1.15, 0]}>
          <cylinderGeometry args={[3.3, 3.3, (config.band[1] - config.band[0]) * 1.15, 32, 1, true]} />
          <meshBasicMaterial color="#37e6c0" transparent opacity={0.18} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      )}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]}>
        <ringGeometry args={[3.4, 3.8, 40]} />
        <meshBasicMaterial color="#37e6c0" transparent opacity={0.7} toneMapped={false} />
      </mesh>
    </>
  );
}

/** Holds its own state so readout updates never re-render the 3D scene. */
function LandingHud({ config, channel, input, lab }: { config: LandingConfig; channel: HudChannel<Hud>; input: RefObject<{ throttle: boolean; chute: boolean }>; lab?: boolean }) {
  const { t } = useTranslation();
  const [hud, setHud] = useState<Hud>({ alt: config.alt, vel: config.vel, fuel: config.fuel, chute: false, firing: false, held: 0 });
  useEffect(() => {
    channel.current = setHud;
    return () => {
      channel.current = null;
    };
  }, [channel]);
  const hover = config.objective === 'hover';
  const fast = Math.abs(hud.vel) > config.safe;
  return (
    <>
      <div className="hud-side">
        <Readout label={t('hud.altitude')} value={hud.alt.toFixed(hud.alt < 20 ? 1 : 0)} unit="m" />
        <Readout label={t('hud.speed')} value={Math.abs(hud.vel).toFixed(1)} unit="m/s" warn={fast} />
        <p className="safe-note">{t('hud.safe', { v: config.safe })}</p>
        <Gauge label={hover ? t('hud.power') : t('hud.fuel')} value={hud.fuel} max={config.fuel} warn={hud.fuel / config.fuel < 0.2} />
        {hover && config.hold ? <Gauge label={t('hud.hold')} value={hud.held} max={config.hold} text={`${hud.held.toFixed(1)} / ${config.hold} s`} /> : null}
      </div>
      <p className="keys-hint">{t('hud.thrustKeys')}{config.hasChute ? ` · ${t('hud.chuteKeys')}` : ''}</p>
      <div className={`action-row${lab ? ' always' : ''}`}>
        {config.hasChute && (
          <button type="button" className={`chute-btn${hud.chute ? ' done' : ''}`} disabled={hud.chute} onClick={() => { input.current.chute = true; play('blip'); }}>
            {hud.chute ? t('hud.chuteOpen') : t('hud.chute')}
          </button>
        )}
        <HoldButton label={hover ? t('hud.rotor') : t('hud.thrust')} className={`thrust${hud.firing ? ' firing' : ''}`} onChange={(v) => (input.current.throttle = v)}>
          {hover ? t('hud.rotor') : t('hud.thrust')}
        </HoldButton>
      </div>
    </>
  );
}

export function LandingMission({ config, onResult, lab }: MissionProps<LandingConfig>) {
  const keys = useKeys();
  const input = useRef({ throttle: false, chute: false });
  const channel = useRef<((h: Hud) => void) | null>(null);

  // Latched on keydown: a quick tap can begin and end between two rendered frames.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'KeyP' || !config.hasChute || input.current.chute) return;
      input.current.chute = true;
      play('blip');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [config.hasChute]);

  const clear = useMemo(() => [{ x: 0, z: 0, r: 8 }], []);
  const terrain = useMemo(() => makeTerrain({ seed: 31, size: 260, amplitude: config.world === 'moon' ? 4 : 6, craterCount: config.world === 'moon' ? 45 : 10, flat: clear }), [config.world, clear]);
  const rocks = useMemo(() => scatterRocks(terrain, 110, 8, clear), [terrain, clear]);

  const end = (s: LanderState, heldEnough: boolean) => {
    const speed = Math.abs(s.vel);
    const soft = speed <= config.safe;
    const win = soft && heldEnough;
    play(win ? 'win' : 'fail');
    const failKey = soft ? 'fail_fuel' : s.fuel <= 0 ? 'fail_fuel' : 'fail_crash';
    window.setTimeout(() => onResult({ win, failKey, values: { speed: speed.toFixed(1), v: speed.toFixed(1) } }), 900);
  };

  return (
    <div className="stage">
      <GameCanvas camera={{ position: [8, 10, 17], fov: 50, far: 700 }}>
        <Sky world={config.world} />
        <Lights world={config.world} />
        <TerrainMesh terrain={terrain} world={config.world} />
        <Rocks rocks={rocks} world={config.world} />
        <Flight config={config} input={input} keys={keys} channel={channel} onEnd={end} />
      </GameCanvas>
      <LandingHud config={config} channel={channel} input={input} lab={lab} />
    </div>
  );
}
