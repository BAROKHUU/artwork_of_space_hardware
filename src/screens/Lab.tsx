import { Suspense, lazy, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as THREE from 'three';
import type { DriveConfig, LandingConfig } from '../data/types';
import { Slider } from '../components/Slider';
import { DriveMission, type LabCamera, type LabVehicle } from '../missions/DriveMission';
import { LandingMission } from '../missions/LandingMission';
import type { MissionResult } from '../missions/common';

const SolarLab = lazy(() => import('./SolarLab'));
const SlingshotLab = lazy(() => import('./SlingshotLab'));
const LaserLab = lazy(() => import('./LaserLab'));

type Tab = 'landing' | 'slingshot' | 'solar' | 'laser' | 'drive';

const NO_OP = () => undefined;

function LandingLab() {
  const { t } = useTranslation();
  const [g, setG] = useState(1.62);
  const [thrust, setThrust] = useState(4.2);
  const [alt, setAlt] = useState(260);
  const [air, setAir] = useState(0);
  const [run, setRun] = useState(0);
  const [result, setResult] = useState<MissionResult | null>(null);
  const world = g > 6.5 ? 'earth' : g > 2.5 ? 'mars' : 'moon';
  const config = useMemo<LandingConfig>(() => ({ world, vehicle: 'surveyor', objective: 'touchdown', alt, vel: -20, fuel: 40, safe: 3, params: { g, thrust, burn: 1, drag: air * 1e-4, chuteDrag: 0 } }), [world, alt, g, thrust, air]);
  const restart = () => {
    setResult(null);
    setRun((r) => r + 1);
  };
  return (
    <div className="lab-grid">
      <div className="lab-stage">
        <LandingMission key={run} id="lab" lab config={config} onResult={setResult} />
        {result && (
          <div className="lab-result">
            <p>{result.win ? t('lab.landed', { v: result.values?.v }) : t('lab.crashed', { v: result.values?.v })}</p>
            <button type="button" className="btn primary" onClick={restart}>{t('lab.reset')}</button>
          </div>
        )}
      </div>
      <aside className="lab-controls">
        <div className="choice">
          {[['moon', 1.62], ['mars', 3.71], ['earth', 9.81]].map(([k, v]) => <button type="button" key={k} className={g === v ? 'on' : ''} onClick={() => { setG(v as number); setThrust(Math.min(20, Math.round((v as number) * 26) / 10)); restart(); }}>{t(`lab.${k}`)}</button>)}
        </div>
        <Slider label={t('lab.gravity')} value={g} min={0.5} max={12} step={0.01} unit="m/s²" onChange={setG} />
        <Slider label={t('lab.thrust')} value={thrust} min={1} max={20} step={0.1} unit="m/s²" onChange={setThrust} />
        <Slider label={t('lab.startAlt')} value={alt} min={50} max={800} step={10} unit="m" onChange={setAlt} />
        <Slider label={t('lab.air')} value={air} min={0} max={20} step={1} unit="" onChange={setAir} />
        <button type="button" className="btn" onClick={restart}>{t('lab.reset')}</button>
      </aside>
    </div>
  );
}

function DriveLab() {
  const { t } = useTranslation();
  const [world, setWorld] = useState<'moon' | 'mars'>('moon');
  const [vehicle, setVehicle] = useState<LabVehicle>('echo');
  const [camera, setCamera] = useState<LabCamera>('chase');
  const [elevation, setElevation] = useState(42);
  const [azimuth, setAzimuth] = useState(60);
  const config = useMemo<DriveConfig>(() => ({ world, seed: world === 'moon' ? 91 : 92, start: { x: 0, z: 0 }, targets: [{ x: 500, z: 500 }], radius: 1 }), [world]);
  const sun = useMemo(() => {
    const el = (elevation * Math.PI) / 180;
    const az = (azimuth * Math.PI) / 180;
    return new THREE.Vector3(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)).multiplyScalar(63);
  }, [elevation, azimuth]);
  const vehicles: LabVehicle[] = ['echo', 'sojourner', 'mer', 'curiosity', 'lrv'];
  const cameras: LabCamera[] = ['chase', 'high', 'cockpit'];
  return (
    <div className="lab-grid">
      <div className="lab-stage">
        <DriveMission key={`${world}-${vehicle}`} id="lab" lab config={config} onResult={NO_OP} vehicle={vehicle} sun={sun} cameraMode={camera} />
      </div>
      <aside className="lab-controls">
        <span className="control-label">{t('lab.world')}</span>
        <div className="choice">
          {(['moon', 'mars'] as const).map((w) => <button type="button" key={w} className={world === w ? 'on' : ''} onClick={() => setWorld(w)}>{t(`lab.${w}`)}</button>)}
        </div>
        <span className="control-label">{t('lab.vehicle')}</span>
        <div className="site-list">
          {vehicles.map((v) => <button type="button" key={v} className={vehicle === v ? 'on' : ''} aria-pressed={vehicle === v} onClick={() => setVehicle(v)}><span>{t(`lab.vehicles.${v}`)}</span></button>)}
        </div>
        <span className="control-label">{t('lab.camera')}</span>
        <div className="choice">
          {cameras.map((c) => <button type="button" key={c} className={camera === c ? 'on' : ''} onClick={() => setCamera(c)}>{t(`lab.cameras.${c}`)}</button>)}
        </div>
        <Slider label={t('lab.sunHeight')} value={elevation} min={2} max={85} step={1} unit="°" onChange={setElevation} />
        <Slider label={t('lab.sunDirection')} value={azimuth} min={0} max={359} step={1} unit="°" onChange={setAzimuth} />
      </aside>
    </div>
  );
}

export function Lab() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('landing');
  const tabs: Tab[] = ['landing', 'slingshot', 'solar', 'laser', 'drive'];
  return (
    <main className="page lab">
      <header className="page-head">
        <h1>{t('lab.heading')}</h1>
        <p>{t('lab.sub')}</p>
      </header>
      <div className="lab-tabs" role="tablist">
        {tabs.map((k) => (
          <button type="button" key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
            <strong>{t(`lab.${k}`)}</strong>
            <small>{t(`lab.${k}Sub`)}</small>
          </button>
        ))}
      </div>
      {tab === 'landing' && <LandingLab />}
      {tab === 'slingshot' && <Suspense fallback={<div className="loading" role="status">{t('common.loading')}</div>}><SlingshotLab /></Suspense>}
      {tab === 'solar' && <Suspense fallback={<div className="loading" role="status">{t('common.loading')}</div>}><SolarLab /></Suspense>}
      {tab === 'laser' && <Suspense fallback={<div className="loading" role="status">{t('common.loading')}</div>}><LaserLab /></Suspense>}
      {tab === 'drive' && <DriveLab />}
      <p className="lab-note">{t('lab.simNote')}</p>
    </main>
  );
}
