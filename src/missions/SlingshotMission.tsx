import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { SlingshotConfig } from '../data/types';
import { JUPITER_ORBIT_AU, jupiterAt, simulateSlingshot, type SlingshotResult } from '../sim/orbit';
import { prefersReducedMotion } from '../three/GameCanvas';
import { play } from '../audio/sfx';
import { Readout, type MissionProps } from './common';

const VIEW_AU = 11.5;
const YEARS_PER_SECOND = 1.1;
const AU_MILLION_KM = 149.6;

function indexAt(path: SlingshotResult['path'], t: number): number {
  let lo = 0;
  let hi = path.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (path[mid][2] <= t) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

export function SlingshotMission({ config, onResult, lab, jupiterMass = 1 }: MissionProps<SlingshotConfig> & { jupiterMass?: number }) {
  const { t } = useTranslation();
  const [deg, setDeg] = useState(100);
  const [speed, setSpeed] = useState(38.8);
  const [run, setRun] = useState<SlingshotResult | null>(null);
  const [finished, setFinished] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [note, setNote] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timeRef = useRef(0);
  const [year, setYear] = useState(0);

  const ghost = useMemo(() => (run ? simulateSlingshot({ jupiterStartDeg: run.jupiterStartDeg, speedKms: speed, jupiterMass: 0 }) : null), [run, speed]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let frame = 0;
    let last = performance.now();
    let doneFired = false;
    timeRef.current = run && prefersReducedMotion() ? run.durationYears : 0;

    const draw = (now: number) => {
      const dpr = Math.min(window.devicePixelRatio, 2);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== Math.round(w * dpr)) canvas.width = Math.round(w * dpr);
      if (canvas.height !== Math.round(h * dpr)) canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = '#04050b';
      ctx.fillRect(0, 0, w, h);
      const scale = Math.min(w, h) / (2 * VIEW_AU);
      const cx = w / 2;
      const cy = h / 2;
      const X = (x: number) => cx + x * scale;
      const Y = (y: number) => cy - y * scale;

      const ring = (r: number, color: string, dash: number[] = []) => {
        ctx.strokeStyle = color;
        ctx.setLineDash(dash);
        ctx.beginPath();
        ctx.arc(cx, cy, r * scale, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      };
      ctx.lineWidth = 1;
      ring(1, 'rgba(120,170,255,.55)');
      ring(JUPITER_ORBIT_AU, 'rgba(255,200,140,.45)');
      ring(9.58, 'rgba(244,234,215,.2)', [3, 6]);

      const dt = (now - last) / 1000;
      last = now;
      if (run) timeRef.current = Math.min(run.durationYears, timeRef.current + dt * YEARS_PER_SECOND);
      const time = run ? timeRef.current : 0;
      const jStart = run ? run.jupiterStartDeg : deg;

      if (ghost && run) {
        ctx.strokeStyle = 'rgba(244,234,215,.28)';
        ctx.setLineDash([2, 5]);
        ctx.beginPath();
        const end = indexAt(ghost.path, time);
        for (let i = 0; i <= end; i++) ctx.lineTo(X(ghost.path[i][0]), Y(ghost.path[i][1]));
        ctx.stroke();
        ctx.setLineDash([]);
      }
      if (run) {
        ctx.strokeStyle = '#ff6a2b';
        ctx.lineWidth = 2;
        ctx.beginPath();
        const end = indexAt(run.path, time);
        for (let i = 0; i <= end; i++) ctx.lineTo(X(run.path[i][0]), Y(run.path[i][1]));
        ctx.stroke();
        ctx.lineWidth = 1;
        const p = run.path[end];
        ctx.fillStyle = '#f4ead7';
        ctx.beginPath();
        ctx.arc(X(p[0]), Y(p[1]), 3.5, 0, Math.PI * 2);
        ctx.fill();
      }

      const sun = ctx.createRadialGradient(cx, cy, 0, cx, cy, 16);
      sun.addColorStop(0, '#fff3c4');
      sun.addColorStop(0.5, '#ffbe55');
      sun.addColorStop(1, 'rgba(255,150,40,0)');
      ctx.fillStyle = sun;
      ctx.beginPath();
      ctx.arc(cx, cy, 16, 0, Math.PI * 2);
      ctx.fill();

      const earthAngle = time * Math.PI * 2;
      ctx.fillStyle = '#5a9bff';
      ctx.beginPath();
      ctx.arc(X(Math.cos(earthAngle)), Y(Math.sin(earthAngle)), 4, 0, Math.PI * 2);
      ctx.fill();

      const [jx, jy] = jupiterAt(jStart, time);
      ctx.fillStyle = '#e7b98a';
      ctx.beginPath();
      ctx.arc(X(jx), Y(jy), 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(160,100,60,.8)';
      ctx.fillRect(X(jx) - 8, Y(jy) - 2, 16, 3);

      ctx.fillStyle = 'rgba(244,234,215,.75)';
      ctx.font = '12px "IBM Plex Mono", monospace';
      ctx.fillText(t('missions:ch3_slingshot.earth'), X(1) + 8, Y(0) + 16);
      ctx.fillText(t('missions:ch3_slingshot.jupiter'), X(jx) + 13, Y(jy) + 4);
      ctx.fillText(t('missions:ch3_slingshot.saturnOrbit'), cx - 40, Y(9.58) - 6);

      if (run) {
        setYear(Math.round(time * 10) / 10);
        if (time >= run.durationYears && !doneFired) {
          doneFired = true;
          setFinished(true);
        }
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [run, deg, ghost, t]);

  useEffect(() => {
    if (!finished || !run) return;
    const gain = run.speedAfterKms - run.speedBeforeKms;
    if (lab) {
      setNote(t('missions:ch3_slingshot.resultGain', { gain: gain.toFixed(1) }));
      return;
    }
    if (run.outcome === 'boosted') {
      play('win');
      setNote(t('missions:ch3_slingshot.resultGain', { gain: gain.toFixed(1) }));
      const timer = window.setTimeout(() => onResult({ win: true, stars: attempts <= 2 ? 3 : attempts <= 5 ? 2 : 1 }), 1500);
      return () => window.clearTimeout(timer);
    }
    play('fail');
    setNote(t(`missions:ch3_slingshot.fail_${run.outcome}`));
  }, [finished, run, lab, attempts, onResult, t]);

  const launch = () => {
    play('blip');
    setFinished(false);
    setNote('');
    setAttempts((a) => a + 1);
    setRun(simulateSlingshot({ jupiterStartDeg: deg, speedKms: speed, jupiterMass }));
  };

  const edit = (fn: () => void) => {
    fn();
    setRun(null);
    setFinished(false);
    setYear(0);
  };

  const flying = !!run && !finished;
  return (
    <div className="stage slingshot">
      <canvas ref={canvasRef} className="orbit-canvas" role="img" aria-label={t('missions:ch3_slingshot.diagram')} />
      <div className="orbit-panel">
        <label>
          <span>{t('missions:ch3_slingshot.launchDay')} <b>{deg}°</b></span>
          <input type="range" min={config.degMin} max={config.degMax} step={1} value={deg} disabled={flying} onChange={(e) => edit(() => setDeg(Number(e.target.value)))} />
        </label>
        <label>
          <span>{t('missions:ch3_slingshot.speed')} <b>{speed.toFixed(1)} km/s</b></span>
          <input type="range" min={config.speedMin} max={config.speedMax} step={0.1} value={speed} disabled={flying} onChange={(e) => edit(() => setSpeed(Number(e.target.value)))} />
        </label>
        <div className="orbit-actions">
          <button type="button" className="btn primary" disabled={flying} onClick={launch}>
            {attempts ? t('missions:ch3_slingshot.relaunch') : t('missions:ch3_slingshot.launch')}
          </button>
          {!lab && attempts >= 2 && (
            <button
              type="button"
              className="btn"
              disabled={flying}
              onClick={() => edit(() => { setDeg(config.suggest.deg); setSpeed(config.suggest.speed); setNote(t('missions:ch3_slingshot.suggested')); })}
            >
              {t('missions:ch3_slingshot.suggest')}
            </button>
          )}
        </div>
        <div className="orbit-read">
          <Readout label={t('missions:ch3_slingshot.yearLabel')} value={year.toFixed(1)} />
          {finished && run && <Readout label={t('missions:ch3_slingshot.closestLabel')} value={(run.closestAU * AU_MILLION_KM).toFixed(1)} unit="M km" />}
        </div>
        <p className="orbit-note" role="status">{note}</p>
        <p className="orbit-legend"><i className="dash" /> {t('missions:ch3_slingshot.withoutJupiter')}</p>
      </div>
    </div>
  );
}
