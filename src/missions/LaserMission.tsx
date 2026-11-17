import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Stars, useTexture } from '@react-three/drei';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useTranslation } from 'react-i18next';
import * as THREE from 'three';
import { textureUrl } from '../data';
import type { LaserConfig } from '../data/types';
import { angularDistanceDeg, latLonToVec3, vec3ToLatLon } from '../sim/geo';
import { MOON_DISTANCE_KM, distanceFromEcho, moonDriftMeters, roundTripSeconds } from '../sim/laser';
import { GameCanvas } from '../three/GameCanvas';
import { play } from '../audio/sfx';
import { useChatCue } from '../state/chatCue';
import { Readout, type MissionProps } from './common';

export const MOON_R = 3;
const STATION = new THREE.Vector3(0, -6.2, 6.6);

export interface Pulse {
  to: THREE.Vector3;
  duration: number;
  hit: boolean;
  start: number;
}

function TargetMarker({ position }: { position: [number, number, number] }) {
  const ref = useRef<THREE.Group>(null);
  const quat = useMemo(
    () => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(...position).normalize()),
    [position],
  );
  useFrame((state) => {
    if (!ref.current) return;
    const s = 1 + 0.16 * Math.sin(state.clock.elapsedTime * 5);
    ref.current.scale.setScalar(s);
  });
  return (
    <group ref={ref} position={position} quaternion={quat}>
      <mesh>
        <ringGeometry args={[0.16, 0.23, 32]} />
        <meshBasicMaterial color="#ff6a2b" side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      <mesh>
        <ringGeometry args={[0.07, 0.11, 24]} />
        <meshBasicMaterial color="#37e6c0" side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.055, 12, 12]} />
        <meshBasicMaterial color="#fff6e8" toneMapped={false} />
      </mesh>
    </group>
  );
}

export function Moon({ onShoot, marker, pulse, onPulseEnd, children }: { onShoot: (p: THREE.Vector3) => void; marker: [number, number, number] | null; pulse: Pulse | null; onPulseEnd: () => void; children?: ReactNode }) {
  const map = useTexture(textureUrl('moon'));
  const dot = useRef<THREE.Mesh>(null);
  const beam = useRef<THREE.Mesh>(null);
  const ended = useRef<Pulse | null>(null);

  useFrame((state) => {
    if (!dot.current || !beam.current) return;
    if (!pulse) {
      dot.current.visible = false;
      beam.current.visible = false;
      return;
    }
    if (pulse.start < 0) pulse.start = state.clock.elapsedTime;
    const f = (state.clock.elapsedTime - pulse.start) / pulse.duration;
    if (f >= 1) {
      if (ended.current !== pulse) {
        ended.current = pulse;
        onPulseEnd();
      }
      return;
    }
    // Out for the first half. A missed pulse scatters and never returns.
    const leg = f < 0.5 ? f * 2 : pulse.hit ? 2 - f * 2 : 1;
    dot.current.visible = pulse.hit || f < 0.5;
    dot.current.position.lerpVectors(STATION, pulse.to, leg);
    beam.current.visible = true;
    const mid = STATION.clone().lerp(pulse.to, 0.5);
    beam.current.position.copy(mid);
    beam.current.scale.y = STATION.distanceTo(pulse.to);
    beam.current.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), pulse.to.clone().sub(STATION).normalize());
  });

  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta <= 6) onShoot(e.point.clone());
  };

  return (
    <>
      <mesh rotation={[0, -Math.PI / 2, 0]} onClick={click}>
        <sphereGeometry args={[MOON_R, 96, 64]} />
        <meshStandardMaterial map={map} roughness={1} />
      </mesh>
      {children}
      {marker && <TargetMarker position={marker} />}
      <mesh ref={beam} visible={false}>
        <cylinderGeometry args={[0.012, 0.012, 1, 6]} />
        <meshBasicMaterial color="#37e6c0" transparent opacity={0.45} toneMapped={false} depthWrite={false} />
      </mesh>
      <mesh ref={dot} visible={false}>
        <sphereGeometry args={[0.06, 10, 10]} />
        <meshBasicMaterial color="#d6fff5" toneMapped={false} />
      </mesh>
    </>
  );
}

export function LaserMission({ id, config, onResult, lab, distanceKm = MOON_DISTANCE_KM }: MissionProps<LaserConfig> & { distanceKm?: number }) {
  const { t } = useTranslation();
  const [pulse, setPulse] = useState<Pulse | null>(null);
  const [echoes, setEchoes] = useState(0);
  const [misses, setMisses] = useState(0);
  const [message, setMessage] = useState<string>('');
  const [lastEcho, setLastEcho] = useState<number | null>(null);
  const busy = useRef(false);
  const winTimer = useRef<number | null>(null);

  useEffect(() => () => {
    if (winTimer.current !== null) window.clearTimeout(winTimer.current);
  }, []);

  const echoSeconds = roundTripSeconds(distanceKm);

  const shoot = (point: THREE.Vector3) => {
    if (busy.current) return;
    const where = vec3ToLatLon(point.x, point.y, point.z);
    const hit = lab || angularDistanceDeg(where, config.target) <= config.radiusDeg;
    busy.current = true;
    play('blip');
    setMessage(t(`missions:${id}.fire`));
    setPulse({ to: point, duration: echoSeconds, hit, start: -1 });
  };

  const pulseEnd = () => {
    const hit = pulse?.hit;
    busy.current = false;
    setPulse(null);
    if (hit) {
      play('ping');
      useChatCue.getState().dismissFail();
      setLastEcho(echoSeconds);
      setMessage(t(`missions:${id}.hit`, { t: echoSeconds.toFixed(2) }));
      const next = echoes + 1;
      setEchoes(next);
      if (!lab && next >= config.shots) {
        winTimer.current = window.setTimeout(() => onResult({ win: true, stars: misses === 0 ? 3 : misses <= 3 ? 2 : 1 }), 1100);
      }
    } else {
      play('fail');
      const nextMisses = misses + 1;
      setMisses(nextMisses);
      setMessage(t(`missions:${id}.miss`));
      if (!lab && nextMisses >= 2) {
        useChatCue.getState().showPopup({
          kind: 'fail',
          textKey: 'chat.popup.failMission',
          prefill: t('chat.popup.prefillMission', { mission: t(`missions:${id}.title`) }),
        });
      }
    }
  };

  const marker = !lab && misses >= 3 ? latLonToVec3(config.target.lat, config.target.lon, MOON_R + 0.02) : null;
  const drift = moonDriftMeters(new Date()).toFixed(1);

  return (
    <div className="stage">
      <GameCanvas camera={{ position: [0, 0, 9.4], fov: 42 }}>
        <color attach="background" args={['#03040a']} />
        <Stars radius={90} depth={30} count={2200} factor={4} saturation={0} fade speed={0.2} />
        <ambientLight intensity={0.35} />
        <directionalLight position={[3, 2, 10]} intensity={3.1} />
        <Moon onShoot={shoot} marker={marker} pulse={pulse} onPulseEnd={pulseEnd} />
      </GameCanvas>
      <div className="hud-side">
        {!lab && <Readout label={t(`missions:${id}.shots`)} value={`${echoes} / ${config.shots}`} />}
        <Readout label={t(`missions:${id}.distance`)} value={lastEcho ? Math.round(distanceFromEcho(lastEcho)).toLocaleString() : '—'} unit="km" />
        <Readout label={t('lab.echoTime')} value={lastEcho ? lastEcho.toFixed(2) : '—'} unit="s" />
        {echoes > 0 && !lab && <p className="safe-note">{t(`missions:${id}.drift`, { m: drift })}</p>}
        {!lab && misses >= 3 && <p className="safe-note">{t(`missions:${id}.markerHint`)}</p>}
      </div>
      <div className="laser-status" role="status">
        {!lab && misses >= 3 && (!message || message === t(`missions:${id}.miss`)) ? t(`missions:${id}.markerHint`) : message || t(`missions:${id}.instruction`)}
      </div>
    </div>
  );
}
