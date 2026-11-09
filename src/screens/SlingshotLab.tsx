import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Slider } from '../components/Slider';
import { JUPITER_ORBIT_AU, flybyGain, jupiterAt, simulateFleet, simulateSlingshot, type SlingshotResult } from '../sim/orbit';
import { prefersReducedMotion } from '../three/GameCanvas';
import { play } from '../audio/sfx';

const VIEW_AU = 11.5;
const SATURN_ORBIT_AU = 9.58;
const FLEET_SIZE = 25;
const FLEET_SPREAD_DEG = 8;
const YEARS_PER_SECOND = 1.1;
const LAUNCH_SPEED_KMS = 38.9;

/** Blue for no boost, through green, to orange for a big one. */
const gainColor = (gain: number) => `hsl(${205 - Math.min(1, Math.max(0, gain) / 6) * 185} 92% 62%)`;

type Path = SlingshotResult['path'];

function indexAt(path: Path, t: number): number {
  let lo = 0;
  let hi = path.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (path[mid][2] <= t) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

function sampleAt(path: Path, t: number): [number, number] {
  const i = indexAt(path, t);
  const p = path[i];
  const q = path[Math.min(i + 1, path.length - 1)];
  const f = q[2] > p[2] ? Math.min(1, (t - p[2]) / (q[2] - p[2])) : 0;
  return [p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f];
}

function fit(canvas: HTMLCanvasElement) {
  const dpr = Math.min(window.devicePixelRatio, 2);
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (canvas.width !== Math.round(w * dpr)) canvas.width = Math.round(w * dpr);
  if (canvas.height !== Math.round(h * dpr)) canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w, h };
}

export default function SlingshotLab() {
  const { t } = useTranslation();
  const [deg, setDeg] = useState(69);
  const [mass, setMass] = useState(1);
  const [run, setRun] = useState<SlingshotResult | null>(null);
  const [fleet, setFleet] = useState<SlingshotResult[] | null>(null);
  const [finished, setFinished] = useState(false);
  const [note, setNote] = useState('');

  const mainRef = useRef<HTMLCanvasElement>(null);
  const timeRef = useRef(0);
  const viewRef = useRef({ cx: 0, cy: 0, scale: 1 });
  const dragging = useRef(false);

  const flying = !!run && !finished;
  const options = useMemo(() => ({ speedKms: LAUNCH_SPEED_KMS, jupiterMass: mass }), [mass]);
  const preview = useMemo(() => simulateSlingshot({ ...options, jupiterStartDeg: deg }), [options, deg]);
  const ghost = useMemo(() => (run ? simulateSlingshot({ jupiterStartDeg: run.jupiterStartDeg, speedKms: LAUNCH_SPEED_KMS, jupiterMass: 0 }) : null), [run]);

  const clearFlight = () => {
    setRun(null);
    setFleet(null);
    setFinished(false);
    setNote('');
  };
  const edit = (apply: () => void) => {
    if (flying) return;
    apply();
    clearFlight();
  };

  useEffect(() => {
    timeRef.current = run && prefersReducedMotion() ? run.durationYears : 0;
  }, [run]);

  useEffect(() => {
    const main = mainRef.current;
    if (!main) return;
    let frame = 0;
    let last = performance.now();
    let done = false;

    const trace = (ctx: CanvasRenderingContext2D, path: Path, time: number, X: (x: number) => number, Y: (y: number) => number) => {
      const end = indexAt(path, time);
      ctx.beginPath();
      for (let i = 0; i <= end; i++) ctx.lineTo(X(path[i][0]), Y(path[i][1]));
      const [px, py] = sampleAt(path, time);
      ctx.lineTo(X(px), Y(py));
      ctx.stroke();
      return [px, py];
    };

    const drawMain = (time: number) => {
      const { ctx, w, h } = fit(main);
      ctx.fillStyle = '#04050b';
      ctx.fillRect(0, 0, w, h);
      const scale = Math.min(w, h) / (2 * VIEW_AU);
      const cx = w / 2;
      const cy = h / 2;
      viewRef.current = { cx, cy, scale };
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
      ring(SATURN_ORBIT_AU, 'rgba(244,234,215,.2)', [3, 6]);

      if (!run) {
        ctx.strokeStyle = 'rgba(55,230,192,.75)';
        ctx.setLineDash([5, 5]);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (const p of preview.path) ctx.lineTo(X(p[0]), Y(p[1]));
        ctx.stroke();
        ctx.setLineDash([]);
      } else {
        if (ghost) {
          ctx.strokeStyle = 'rgba(244,234,215,.28)';
          ctx.lineWidth = 1;
          ctx.setLineDash([2, 5]);
          trace(ctx, ghost.path, time, X, Y);
          ctx.setLineDash([]);
        }
        if (fleet) {
          ctx.lineWidth = 1;
          ctx.globalAlpha = 0.62;
          for (const r of fleet) {
            if (r === run) continue;
            ctx.strokeStyle = gainColor(flybyGain(r));
            const [px, py] = trace(ctx, r.path, time, X, Y);
            ctx.fillStyle = ctx.strokeStyle;
            ctx.fillRect(X(px) - 1.5, Y(py) - 1.5, 3, 3);
          }
          ctx.globalAlpha = 1;
        }
        ctx.strokeStyle = '#ff6a2b';
        ctx.lineWidth = 2.2;
        const [px, py] = trace(ctx, run.path, time, X, Y);
        ctx.lineWidth = 1;
        ctx.fillStyle = '#f4ead7';
        ctx.beginPath();
        ctx.arc(X(px), Y(py), 3.6, 0, Math.PI * 2);
        ctx.fill();
      }

      const sun = ctx.createRadialGradient(cx, cy, 0, cx, cy, 18);
      sun.addColorStop(0, '#fff3c4');
      sun.addColorStop(0.5, '#ffbe55');
      sun.addColorStop(1, 'rgba(255,150,40,0)');
      ctx.fillStyle = sun;
      ctx.beginPath();
      ctx.arc(cx, cy, 18, 0, Math.PI * 2);
      ctx.fill();

      const earthAngle = time * Math.PI * 2;
      ctx.fillStyle = '#5a9bff';
      ctx.beginPath();
      ctx.arc(X(Math.cos(earthAngle)), Y(Math.sin(earthAngle)), 4, 0, Math.PI * 2);
      ctx.fill();

      const [jx, jy] = jupiterAt(run ? run.jupiterStartDeg : deg, time);
      ctx.fillStyle = '#e7b98a';
      ctx.beginPath();
      ctx.arc(X(jx), Y(jy), 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(150,92,55,.85)';
      ctx.fillRect(X(jx) - 9, Y(jy) - 3, 18, 2);
      ctx.fillRect(X(jx) - 8, Y(jy) + 2, 16, 2);
      if (!run) {
        ctx.strokeStyle = 'rgba(244,234,215,.5)';
        ctx.beginPath();
        ctx.arc(X(jx), Y(jy), 15, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.fillStyle = 'rgba(244,234,215,.78)';
      ctx.font = '12px "IBM Plex Mono", monospace';
      ctx.fillText(t('missions:ch3_slingshot.earth'), X(1) + 8, Y(0) + 16);
      ctx.fillText(t('missions:ch3_slingshot.jupiter'), X(jx) + 18, Y(jy) + 4);
      ctx.fillText(t('missions:ch3_slingshot.saturnOrbit'), cx - 40, Y(SATURN_ORBIT_AU) - 6);
    };

    const draw = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      if (run) timeRef.current = Math.min(run.durationYears, timeRef.current + dt * YEARS_PER_SECOND);
      const time = run ? timeRef.current : 0;
      drawMain(time);
      if (run && time >= run.durationYears && !done) {
        done = true;
        setFinished(true);
      }
      frame = run && time < run.durationYears ? requestAnimationFrame(draw) : 0;
    };

    frame = requestAnimationFrame(draw);
    const observer = new ResizeObserver(() => {
      if (frame === 0) {
        last = performance.now();
        frame = requestAnimationFrame(draw);
      }
    });
    observer.observe(main);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [run, fleet, preview, ghost, deg, t]);

  useEffect(() => {
    if (!finished || !run) return;
    if (fleet) {
      const boosted = fleet.filter((r) => r.outcome === 'boosted').length;
      setNote(t('slinglab.fleetResult', { n: boosted, total: fleet.length }));
    } else {
      setNote(t(flybyGain(run) >= 1 ? 'slinglab.boosted' : 'slinglab.noBoost'));
    }
    play(flybyGain(run) >= 1 ? 'win' : 'blip');
  }, [finished, run, fleet, t]);

  const launch = () => {
    play('blip');
    setFleet(null);
    setFinished(false);
    setNote('');
    setRun(simulateSlingshot({ ...options, jupiterStartDeg: deg }));
  };

  const launchFleet = () => {
    play('blip');
    const results = simulateFleet({ ...options, jupiterStartDeg: deg }, FLEET_SIZE, FLEET_SPREAD_DEG);
    const best = results.filter((r) => r.outcome !== 'hit').reduce((a, b) => (flybyGain(b) > flybyGain(a) ? b : a), results[0]);
    setFleet(results);
    setFinished(false);
    setNote('');
    setRun(best);
  };

  const toAU = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const { cx, cy, scale } = viewRef.current;
    return [(e.clientX - rect.left - cx) / scale, -(e.clientY - rect.top - cy) / scale];
  };

  const onDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (flying) return;
    const [x, y] = toAU(e);
    const [jx, jy] = jupiterAt(deg, 0);
    if (Math.hypot(x - jx, y - jy) * viewRef.current.scale < 22) {
      dragging.current = true;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
  };

  const onMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!dragging.current) return;
    const [x, y] = toAU(e);
    const next = Math.round((((Math.atan2(y, x) * 180) / Math.PI + 360) % 360) * 2) / 2;
    edit(() => setDeg(next));
  };

  return (
    <div className="lab-grid">
      <div className="lab-stage sling-lab">
        <canvas
          ref={mainRef}
          className="orbit-canvas"
          role="img"
          aria-label={t('missions:ch3_slingshot.diagram')}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={() => { dragging.current = false; }}
        />
        <p className="solar-note">{t('slinglab.dragHint')}</p>
      </div>
      <aside className="lab-controls sling-controls">
        <div className="row">
          <button type="button" className="btn primary" disabled={flying} onClick={launch}>{t('missions:ch3_slingshot.launch')}</button>
          <button type="button" className="btn" disabled={flying} onClick={launchFleet}>{t('slinglab.fleet', { n: FLEET_SIZE })}</button>
        </div>
        <p className="orbit-note" role="status">{note}</p>
        <Slider label={t('slinglab.position')} value={deg} min={0} max={359.5} step={0.5} unit="" display="" onChange={(v) => edit(() => setDeg(v))} />
        <Slider label={t('lab.jupiterMass')} value={mass} min={0} max={10} step={0.5} unit="×" onChange={(v) => edit(() => setMass(v))} />
        <p className="orbit-legend"><i className="dash" /> {t('missions:ch3_slingshot.withoutJupiter')}</p>
      </aside>
    </div>
  );
}
