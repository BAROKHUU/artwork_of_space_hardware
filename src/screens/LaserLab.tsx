import { useRef, useState } from 'react';
import { Stars } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useTranslation } from 'react-i18next';
import * as THREE from 'three';
import reflectorData from '../data/reflectors.json';
import { Slider } from '../components/Slider';
import { MOON_R, Moon, type Pulse } from '../missions/LaserMission';
import { angularDistanceDeg, latLonToVec3, vec3ToLatLon } from '../sim/geo';
import { MOON_DISTANCE_KM, distanceFromEcho, roundTripSeconds } from '../sim/laser';
import { GameCanvas } from '../three/GameCanvas';
import { play } from '../audio/sfx';

const SITES = reflectorData;
type Site = (typeof SITES)[number];

const CLICK_TOLERANCE_DEG = 6;
const BASE_CAMERA_Z = 9.4;

const toVector = (s: Site) => new THREE.Vector3(...latLonToVec3(s.lat, s.lon, MOON_R));

function Rig({ cameraZ }: { cameraZ: number }) {
  useFrame((state, dt) => {
    state.camera.position.z += (cameraZ - state.camera.position.z) * (1 - Math.exp(-dt * 5));
    state.camera.lookAt(0, 0, 0);
  });
  return null;
}

export default function LaserLab() {
  const { t } = useTranslation();
  const [siteId, setSiteId] = useState('a11');
  const [pulse, setPulse] = useState<Pulse | null>(null);
  const [message, setMessage] = useState('');
  const [km, setKm] = useState(MOON_DISTANCE_KM);
  const [echo, setEcho] = useState<number | null>(null);
  const busy = useRef(false);
  const afterPulse = useRef<(() => void) | null>(null);

  const site = SITES.find((s) => s.id === siteId)!;
  const cameraZ = Math.max(4.4, Math.min(26, (BASE_CAMERA_Z * km) / MOON_DISTANCE_KM));

  const fire = (target: THREE.Vector3, hit: boolean, done: () => void) => {
    if (busy.current) return;
    busy.current = true;
    afterPulse.current = done;
    play('blip');
    setMessage(t('laserlab.fired'));
    setPulse({ to: target, duration: roundTripSeconds(km), hit, start: -1 });
  };

  const onPulseEnd = () => {
    busy.current = false;
    setPulse(null);
    afterPulse.current?.();
    afterPulse.current = null;
  };

  const shoot = (target: Site, point?: THREE.Vector3) => {
    const seconds = roundTripSeconds(km);
    fire(point ?? toVector(target), true, () => {
      play('ping');
      setEcho(seconds);
      setMessage('');
    });
  };

  const onMoonClick = (point: THREE.Vector3) => {
    const where = vec3ToLatLon(point.x, point.y, point.z);
    const nearest = SITES.map((s) => ({ s, d: angularDistanceDeg(where, s) })).sort((a, b) => a.d - b.d)[0];
    if (nearest.d <= CLICK_TOLERANCE_DEG) {
      setSiteId(nearest.s.id);
      shoot(nearest.s, point);
    } else {
      fire(point, false, () => {
        play('fail');
        setEcho(null);
        setMessage(t('laserlab.miss'));
      });
    }
  };

  return (
    <div className="lab-grid">
      <div className="lab-stage">
        <GameCanvas camera={{ position: [0, 0, BASE_CAMERA_Z], fov: 42 }} shadows={false}>
          <color attach="background" args={['#03040a']} />
          <Stars radius={90} depth={30} count={2200} factor={4} saturation={0} fade speed={0.2} />
          <ambientLight intensity={0.1} />
          <directionalLight position={[3.4, 2, 9.4]} intensity={3.3} />
          <Rig cameraZ={cameraZ} />
          <Moon onShoot={onMoonClick} marker={null} pulse={pulse} onPulseEnd={onPulseEnd}>
            {SITES.map((s) => (
              <mesh key={s.id} position={latLonToVec3(s.lat, s.lon, MOON_R + 0.02)}>
                <sphereGeometry args={[s.id === siteId ? 0.1 : 0.06, 14, 14]} />
                <meshBasicMaterial color={s.id === siteId ? '#37e6c0' : '#ffb25a'} toneMapped={false} />
              </mesh>
            ))}
          </Moon>
        </GameCanvas>
        {message && <div className="laser-status" role="status">{message}</div>}
      </div>

      <aside className="lab-controls">
        <p className="solar-fact">{t('laserlab.about')}</p>
        <div className="site-list" role="radiogroup" aria-label={t('laserlab.site')}>
          {SITES.map((s) => <button type="button" key={s.id} role="radio" aria-checked={s.id === siteId} className={s.id === siteId ? 'on' : ''} onClick={() => setSiteId(s.id)}><span>{t(`laserlab.sites.${s.id}`)}</span></button>)}
        </div>
        <button type="button" className="btn primary" disabled={pulse !== null} onClick={() => shoot(site)}>{t('laserlab.fire')}</button>
        <Slider label={t('lab.moonDistance')} value={km} min={100000} max={1000000} step={1000} unit="km" onChange={(v) => { setKm(v); setEcho(null); }} />
        {echo !== null && <p className="laser-answer" role="status">{t('laserlab.result', { t: echo.toFixed(2), km: Math.round(distanceFromEcho(echo)).toLocaleString() })}</p>}
      </aside>
    </div>
  );
}
