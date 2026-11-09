import { Suspense, lazy, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { chapterById } from '../data';
import type { DriveConfig, LandingConfig, LaserConfig, SlingshotConfig } from '../data/types';
import { MOON_DISTANCE_KM } from '../sim/laser';
import { DriveMission } from '../missions/DriveMission';
import { LandingMission } from '../missions/LandingMission';
import { LaserMission } from '../missions/LaserMission';
import { SlingshotMission } from '../missions/SlingshotMission';
import type { MissionResult } from '../missions/common';

const SolarLab = lazy(() => import('./SolarLab'));

type Tab = 'landing' | 'slingshot' | 'solar' | 'laser' | 'drive';

function Slider({ label, value, min, max, step, unit, onChange }: { label: string; value: number; min: number; max: number; step: number; unit: string; onChange: (v: number) => void }) {
  return (
    <label className="slider">
      <span>{label} <b>{value.toLocaleString()} {unit}</b></span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

const NO_OP = () => undefined;

function LandingLab() {
  const { t } = useTranslation();
  const [g, setG] = useState(1.62);
  const [thrust, setThrust] = useState(4.2);
  const [alt, setAlt] = useState(260);
  const [air, setAir] = useState(0);
  const [run, setRun] = useState(0);
  const [result, setResult] = useState<MissionResult | null>(null);
  const world = g > 2.5 ? 'mars' : 'moon';
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
          {[['moon', 1.62], ['mars', 3.71], ['earth', 9.81]].map(([k, v]) => <button type="button" key={k} className={g === v ? 'on' : ''} onClick={() => { setG(v as number); restart(); }}>{t(`lab.${k}`)}</button>)}
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

const slingshotConfig = chapterById.ch3.beats.find((b) => b.kind === 'mission')!;
const laserConfig = chapterById.ch2.beats.find((b) => b.kind === 'mission' && b.template === 'laser')!;

function SlingshotLab() {
  const { t } = useTranslation();
  const [mass, setMass] = useState(1);
  return (
    <div className="lab-grid">
      <div className="lab-stage">
        <SlingshotMission id="lab" lab jupiterMass={mass} config={{ ...(slingshotConfig as { config: SlingshotConfig }).config, degMin: 0, degMax: 180, speedMin: 37, speedMax: 42 }} onResult={NO_OP} />
      </div>
      <aside className="lab-controls">
        <Slider label={t('lab.jupiterMass')} value={mass} min={0} max={10} step={0.5} unit="×" onChange={setMass} />
      </aside>
    </div>
  );
}

function LaserLab() {
  const { t } = useTranslation();
  const [km, setKm] = useState(MOON_DISTANCE_KM);
  return (
    <div className="lab-grid">
      <div className="lab-stage">
        <LaserMission id="lab" lab distanceKm={km} config={(laserConfig as { config: LaserConfig }).config} onResult={NO_OP} />
      </div>
      <aside className="lab-controls">
        <Slider label={t('lab.moonDistance')} value={km} min={100000} max={1000000} step={1000} unit="km" onChange={setKm} />
      </aside>
    </div>
  );
}

function DriveLab() {
  const { t } = useTranslation();
  const [world, setWorld] = useState<'moon' | 'mars'>('moon');
  const config = useMemo<DriveConfig>(() => ({ world, seed: world === 'moon' ? 91 : 92, start: { x: 0, z: 0 }, targets: [{ x: 500, z: 500 }], radius: 1 }), [world]);
  return (
    <div className="lab-grid">
      <div className="lab-stage">
        <DriveMission key={world} id="lab" lab config={config} onResult={NO_OP} />
      </div>
      <aside className="lab-controls">
        <span className="control-label">{t('lab.world')}</span>
        <div className="choice">
          {(['moon', 'mars'] as const).map((w) => <button type="button" key={w} className={world === w ? 'on' : ''} onClick={() => setWorld(w)}>{t(`lab.${w}`)}</button>)}
        </div>
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
      {tab === 'slingshot' && <SlingshotLab />}
      {tab === 'solar' && <Suspense fallback={<div className="loading" role="status">{t('common.loading')}</div>}><SolarLab /></Suspense>}
      {tab === 'laser' && <LaserLab />}
      {tab === 'drive' && <DriveLab />}
      <p className="lab-note">{t('lab.simNote')}</p>
    </main>
  );
}
