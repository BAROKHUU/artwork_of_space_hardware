import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { DrillConfig } from '../data/types';
import { buildCoreLayers, initialDrill, layerAtDepth, stepDrill, type DrillState, type LayerKind } from '../sim/drill';
import { play } from '../audio/sfx';
import { useChatCue } from '../state/chatCue';
import { Gauge, HoldButton, Readout, useKeys, type MissionProps } from './common';

const LAYER_COLORS: Record<'moon' | 'mars', Record<LayerKind, string>> = {
  moon: { dust: '#3d3a38', ejecta: '#4e4842', dense: '#2b2930', ice: '#1b495c' },
  mars: { dust: '#753920', ejecta: '#572c1d', dense: '#3c2119', ice: '#164b5e' },
};

interface DrillMissionProps extends MissionProps<DrillConfig> {
  extraControls?: ReactNode;
  stageOverlay?: ReactNode;
}

export function DrillMission({ id, config, onResult, lab, extraControls, stageOverlay }: DrillMissionProps) {
  const { t } = useTranslation();
  const world = config.world ?? 'moon';
  const maxJams = config.maxJams ?? 3;
  const layers = useMemo(() => buildCoreLayers(config.targetDepth, config.seed, world), [config.targetDepth, config.seed, world]);
  const keys = useKeys();
  const holding = useRef(false);
  const sim = useRef<DrillState>(initialDrill());
  const prevJams = useRef(0);
  const warnedHeat = useRef(false);
  const activeRef = useRef(false);
  const ended = useRef(false);
  const endTimer = useRef<number | null>(null);
  const [hud, setHud] = useState<DrillState>(sim.current);
  const [active, setActive] = useState(false);

  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const keyDrill = keys.current.has('Space') || keys.current.has('ArrowDown') || keys.current.has('KeyS');
      const drilling = holding.current || keyDrill;

      if (!ended.current) {
        const next = stepDrill(sim.current, layers, config.targetDepth, maxJams, drilling, dt);
        sim.current = next;
        const isDrilling = drilling && !next.locked && !next.releaseRequired && !next.done && !next.failed;
        if (activeRef.current !== isDrilling) {
          activeRef.current = isDrilling;
          setActive(isDrilling);
        }
        if (next.heat >= 75 && !next.locked && !warnedHeat.current) {
          warnedHeat.current = true;
          play('warn');
        } else if (next.heat < 60) {
          warnedHeat.current = false;
        }
        if (next.jams > prevJams.current) {
          prevJams.current = next.jams;
          holding.current = false;
          play('fail');
          if (!lab) {
            useChatCue.getState().showPopup({
              kind: 'fail',
              textKey: 'chat.popup.failMission',
              prefill: t('chat.popup.prefillMission', { mission: t(`missions:${id}.title`) }),
            });
          }
        }
        if (next.done || next.failed) {
          ended.current = true;
          play(next.done ? 'win' : 'fail');
          if (next.done && !lab) useChatCue.getState().dismissFail();
          const stars = next.jams === 0 ? 3 : next.jams === 1 ? 2 : 1;
          endTimer.current = window.setTimeout(
            () => onResult(next.done ? { win: true, stars, values: { jams: next.jams } } : { win: false, failKey: 'fail_jam', values: { jams: next.jams } }),
            lab ? 250 : 850,
          );
        }
        setHud(next);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      if (endTimer.current !== null) window.clearTimeout(endTimer.current);
    };
  }, [layers, config.targetDepth, maxJams, keys, onResult, t, id, lab]);

  const layer = layerAtDepth(layers, hud.depth);
  const depthRatio = Math.min(1, hud.depth / config.targetDepth);
  const bitY = 48 + depthRatio * 240;
  const palette = LAYER_COLORS[world];

  return (
    <div className="lab-grid seismic-mission">
      <div className="lab-stage drill-stage">
        <div className="seismic-header">
          <span className="eyebrow">{t(world === 'mars' ? 'drill.marsRig' : 'drill.moonRig')}</span>
          <span className="seismic-state">{hud.locked ? t('drill.cooling') : active ? t('drill.drilling') : t('drill.ready')}</span>
        </div>
        <svg className="drill-display" viewBox="0 0 440 320" role="img" aria-label={lab ? t('lab.drill') : t(`missions:${id}.title`)}>
          <rect x="0" y="0" width="440" height="48" fill="#0c0e17" />
          {layers.map((l, i) => {
            const start = i === 0 ? 0 : layers[i - 1].endDepth;
            const y0 = 48 + (start / config.targetDepth) * 240;
            const h = ((l.endDepth - start) / config.targetDepth) * 240;
            return (
              <g key={l.kind}>
                <rect x="0" y={y0} width="440" height={h} fill={palette[l.kind]} />
                <line x1="0" y1={y0} x2="440" y2={y0} stroke={l.kind === 'ice' ? 'rgba(134, 229, 247, 0.45)' : 'rgba(244,234,215,0.18)'} strokeWidth="1" />
                <text x="16" y={y0 + 22} className="drill-layer-label">{t(`drill.layers.${l.kind}`)}</text>
                <text x="424" y={y0 + 22} textAnchor="end" className="drill-layer-label">{l.endDepth.toFixed(1)} m</text>
              </g>
            );
          })}
          <rect x="0" y="288" width="440" height="32" fill={world === 'mars' ? '#2c1812' : '#222127'} />
          <rect x="210" y="24" width="20" height={Math.max(24, bitY - 24)} fill="#b6bac6" rx="2" />
          <polygon points={`206,${bitY} 234,${bitY} 220,${bitY + 14}`} fill={hud.heat > 75 ? '#ff5a52' : '#ff6a2b'} />
          <line x1="0" y1="288" x2="440" y2="288" stroke="#37e6c0" strokeDasharray="6 4" strokeWidth="2" />
        </svg>
        {stageOverlay}
      </div>
      <aside className="lab-controls drill-controls">
        <div>
          <p className="eyebrow">{t(lab ? 'drill.eyebrow' : 'mission.objective')}</p>
          <h2>{lab ? t('lab.drill') : t(`missions:${id}.title`)}</h2>
        </div>
        <p className="hint">{t('drill.layerLabel', { layer: t(`drill.layers.${layer.kind}`) })}</p>
        <Gauge label={t('drill.depthLabel')} value={hud.depth} max={config.targetDepth} text={`${hud.depth.toFixed(2)} / ${config.targetDepth.toFixed(1)} m`} />
        <Gauge label={t('drill.heatLabel')} value={hud.heat} max={100} warn={hud.heat >= 75} text={`${Math.round(hud.heat)}%`} />
        <Readout label={t('drill.jamsLabel')} value={`${hud.jams} / ${maxJams}`} warn={hud.jams > 0} />
        <HoldButton label={t('drill.drillBtn')} className="btn primary" onChange={(down) => (holding.current = down)}>
          {hud.locked ? t('drill.cooling') : t('drill.drillBtn')}
        </HoldButton>
        <p className="hint">{t('drill.controls')}</p>
        {extraControls && <div className="drill-divider">{extraControls}</div>}
      </aside>
    </div>
  );
}
