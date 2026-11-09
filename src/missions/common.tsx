import { useEffect, useRef, type ReactNode } from 'react';

export interface MissionResult {
  win: boolean;
  failKey?: string;
  values?: Record<string, string | number>;
  /** Overrides the attempt-based star score. */
  stars?: number;
}

export interface MissionProps<C> {
  id: string;
  config: C;
  onResult: (r: MissionResult) => void;
  /** In the Lab there is no briefing, and goals are optional. */
  lab?: boolean;
}

const GAME_KEYS = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyP']);

/** Live set of held keys. Stops arrows and Space from scrolling or re-pressing focused buttons. */
export function useKeys() {
  const keys = useRef(new Set<string>());
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (!GAME_KEYS.has(e.code) || (e.target as HTMLElement).tagName === 'INPUT') return;
      e.preventDefault();
      keys.current.add(e.code);
    };
    const up = (e: KeyboardEvent) => {
      if (GAME_KEYS.has(e.code) && (e.target as HTMLElement).tagName !== 'INPUT') e.preventDefault();
      keys.current.delete(e.code);
    };
    const clear = () => keys.current.clear();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', clear);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', clear);
    };
  }, []);
  return keys;
}

/** A button that reports held state, for touch and mouse. */
export function HoldButton({ onChange, className = '', children, label }: { onChange: (held: boolean) => void; className?: string; children: ReactNode; label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      className={`hold ${className}`}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        onChange(true);
      }}
      onPointerUp={() => onChange(false)}
      onPointerCancel={() => onChange(false)}
      onContextMenu={(e) => e.preventDefault()}
    >
      {children}
    </button>
  );
}

export function Gauge({ label, value, max, warn = false, text }: { label: string; value: number; max: number; warn?: boolean; text?: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className={`gauge${warn ? ' warn' : ''}`}>
      <div className="gauge-head">
        <span>{label}</span>
        <span>{text ?? `${Math.round(pct)}%`}</span>
      </div>
      <div className="gauge-bar" role="progressbar" aria-label={label} aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
        <i style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function Readout({ label, value, unit, warn = false }: { label: string; value: string; unit?: string; warn?: boolean }) {
  return (
    <div className={`readout${warn ? ' warn' : ''}`}>
      <span className="readout-label">{label}</span>
      <span className="readout-value">
        {value}
        {unit && <small>{unit}</small>}
      </span>
    </div>
  );
}
