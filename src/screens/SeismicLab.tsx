import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { canCapture, signalActive } from '../sim/seismic';

const A = 380;
const B = 500;
const RATE = 100;
const SIGNALS = [
  { amplitude: 5, frequency: 7, detail: 1 },
  { amplitude: 14, frequency: 14, detail: 3 },
  { amplitude: 22, frequency: 27, detail: 4 },
  { amplitude: 32, frequency: 38, detail: 4 },
];

function trace(time: number, channel: number, seed: number) {
  const y = 65 + channel * 82;
  const { amplitude, frequency, detail } = SIGNALS[channel];
  let path = '';
  for (let x = 0; x <= 800; x += 2) {
    const sample = time + (x - B) / RATE;
    const wave = signalActive(sample, channel, seed)
      ? Math.sin(sample * frequency + channel) * amplitude + Math.sin(sample * (frequency * 1.7) + channel) * detail
      : 0;
    path += `${x === 0 ? 'M' : 'L'}${x} ${(y + wave).toFixed(1)} `;
  }
  return path;
}

export default function SeismicLab() {
  const { t } = useTranslation();
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [time, setTime] = useState(0);
  const [result, setResult] = useState<'hit' | 'miss' | null>(null);
  const clock = useRef(0);
  const seed = useRef(Math.random() * 100000);

  useEffect(() => {
    if (!running) return;
    let frame = 0;
    let previous = performance.now();
    const tick = (now: number) => {
      clock.current += Math.min((now - previous) / 1000, 0.1) * speed;
      previous = now;
      setTime(clock.current);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [running, speed]);

  const start = () => {
    seed.current = Math.random() * 100000;
    clock.current = 0;
    setTime(0);
    setResult(null);
    setRunning(true);
  };

  return (
    <div className="lab-grid">
      <div className="lab-stage seismic-stage">
        <div className="seismic-header"><span className="eyebrow">{t('seismic.recorder')}</span><span className="seismic-state">{t(running ? 'seismic.running' : 'seismic.ready')}</span></div>
        <svg className="seismic-display" viewBox="0 0 800 360" role="img" aria-label={t('seismic.graph')} preserveAspectRatio="none">
          <rect x={A} y="20" width={B - A} height="325" className="seismic-window" />
          {[0, 1, 2, 3].map((i) => <g key={i}>
            <line x1="0" x2="800" y1={65 + i * 82} y2={65 + i * 82} className="seismic-baseline" />
            <path d={trace(time, i, seed.current)} className="seismic-wave" />
            <text x="12" y={52 + i * 82} className="seismic-label">S{i + 1}</text>
          </g>)}
          <line x1={A} x2={A} y1="20" y2="345" className="seismic-bar" />
          <line x1={B} x2={B} y1="20" y2="345" className="seismic-bar" />
          <text x={A + 5} y="16" className="seismic-marker">A</text><text x={B + 5} y="16" className="seismic-marker">B</text>
        </svg>
        <div className="seismic-footer"><span>{t('seismic.direction')}</span><span>A — B · 1.2 s</span></div>
      </div>
      <aside className="lab-controls">
        <div><p className="eyebrow">{t('seismic.eyebrow')}</p><h2>{t('seismic.title')}</h2></div>
        <p className="hint">{t('seismic.instructions')}</p>
        <span className="control-label">{t('seismic.speed')}</span>
        <div className="choice">{([1, 1.5] as const).map((value) => <button type="button" key={value} className={speed === value ? 'on' : ''} aria-pressed={speed === value} onClick={() => setSpeed(value)}>{t(value === 1 ? 'seismic.normal' : 'seismic.fast')}</button>)}</div>
        <button type="button" className="btn" onClick={start}>{t(running ? 'seismic.restart' : 'seismic.start')}</button>
        <button type="button" className="btn primary" disabled={!running} onClick={() => setResult(canCapture(time, seed.current) ? 'hit' : 'miss')}>{t('seismic.capture')}</button>
        <p className={`seismic-result ${result ?? ''}`} role="status" aria-live="polite">{result ? t(`seismic.${result}`) : t('seismic.waiting')}</p>
      </aside>
    </div>
  );
}
