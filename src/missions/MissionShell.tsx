import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { MissionBeat } from '../data/types';
import { useChatCue } from '../state/chatCue';
import { useGame } from '../state/store';
import { play, playClip, preloadClip } from '../audio/sfx';
import { prefersReducedMotion } from '../three/GameCanvas';
import { ClassifyMission } from './ClassifyMission';
import { DrillMission } from './DrillMission';
import { DriveMission } from './DriveMission';
import { LandingMission } from './LandingMission';
import { LaserMission } from './LaserMission';
import { SeismicMission } from './SeismicMission';
import { SlingshotMission } from './SlingshotMission';
import type { MissionResult } from './common';

type Phase = 'brief' | 'play' | 'fail' | 'win';

export function MissionShell({ beat, onDone, onSuccess }: { beat: MissionBeat; onDone: () => void; onSuccess?: () => void }) {
  const { t } = useTranslation();
  const setStars = useGame((s) => s.setStars);
  const recordMissionFailure = useGame((s) => s.recordMissionFailure);
  const resetMissionFailures = useGame((s) => s.resetMissionFailures);
  const assisted = useGame((s) => Boolean(s.assistedMissions[beat.id]));
  const [phase, setPhase] = useState<Phase>('brief');
  const [launching, setLaunching] = useState(false);
  const [attempt, setAttempt] = useState(1);
  const [result, setResult] = useState<MissionResult | null>(null);
  const [earned, setEarned] = useState(0);
  const active = useRef(true);
  const launchTimer = useRef<number | null>(null);
  useEffect(() => {
    active.current = true;
    void preloadClip('map_warp');
    return () => {
      active.current = false;
      if (launchTimer.current !== null) window.clearTimeout(launchTimer.current);
    };
  }, []);
  const startMission = () => {
    if (launching) return;
    play('ping');
    playClip('map_warp', 0.34, 1.15);
    if (prefersReducedMotion()) {
      setPhase('play');
      return;
    }
    setLaunching(true);
    launchTimer.current = window.setTimeout(() => {
      if (!active.current) return;
      setLaunching(false);
      setPhase('play');
    }, 380);
  };
  const leave = () => {
    active.current = false;
    useChatCue.getState().dismissFail();
    onDone();
  };
  const key = `missions:${beat.id}`;
  const interpolation = {
    ...('safe' in beat.config ? { safe: beat.config.safe } : {}),
    ...('hold' in beat.config ? { hold: beat.config.hold } : {}),
    ...('shots' in beat.config ? { shots: beat.config.shots } : {}),
    ...('captures' in beat.config ? { captures: beat.config.captures } : {}),
    ...('targetDepth' in beat.config ? { targetDepth: beat.config.targetDepth } : {}),
  };

  const onResult = useCallback(
    (r: MissionResult) => {
      if (!active.current) return;
      setResult(r);
      if (r.win) {
        const stars = Math.max(1, r.stars ?? (attempt === 1 ? 3 : attempt === 2 ? 2 : 1));
        setEarned(stars);
        setStars(beat.id, stars);
        resetMissionFailures(beat.id);
        useChatCue.getState().dismissFail();
        play('win');
        setPhase('win');
        onSuccess?.();
      } else {
        recordMissionFailure(beat.id);
        useChatCue.getState().showPopup({
          kind: 'fail',
          textKey: attempt >= 2 ? 'chat.popup.failMissionAlt' : 'chat.popup.failMission',
          prefill: t('chat.popup.prefillMission', { mission: t(`${key}.title`) }),
        });
        setPhase('fail');
      }
    },
    [attempt, beat.id, key, onSuccess, recordMissionFailure, resetMissionFailures, setStars, t],
  );

  const retry = () => {
    useChatCue.getState().dismissFail();
    setAttempt((a) => a + 1);
    setResult(null);
    setPhase('play');
  };

  const common = { id: beat.id, onResult };
  return (
    <div className="mission">
      {(phase === 'play' || (phase === 'win' && onSuccess)) && (
        <div inert={phase === 'win'} style={{ height: '100%' }}>
          {beat.template === 'drive' && <DriveMission key={attempt} {...common} config={beat.config} vehicle={beat.config.vehicle} />}
          {beat.template === 'landing' && <LandingMission key={attempt} {...common} config={beat.config} />}
          {beat.template === 'laser' && <LaserMission key={attempt} {...common} config={beat.config} />}
          {beat.template === 'slingshot' && <SlingshotMission key={attempt} {...common} config={beat.config} />}
          {beat.template === 'classify' && <ClassifyMission key={attempt} {...common} config={beat.config} assisted={assisted} />}
          {beat.template === 'seismic' && <SeismicMission key={attempt} {...common} config={beat.config} />}
          {beat.template === 'drill' && <DrillMission key={attempt} {...common} config={beat.config} />}
          {phase === 'play' && <button type="button" className="skip-link" onClick={leave}>{t('mission.skip')}</button>}
        </div>
      )}

      {phase === 'brief' && (
        <section className={`panel brief brief-portal${launching ? ' brief-launching' : ''}`}>
          <div className="brief-portal__portal" aria-hidden="true">
            <span className="eyebrow">{t('mission.objective')}</span>
            <span className="brief-portal__dot" />
          </div>
          <h1>{t(`${key}.title`)}</h1>
          <p className="lede">{t(`${key}.goal`, interpolation)}</p>
          <p className="hint"><b>{t('mission.hint')}</b> {t(`${key}.hint`)}</p>
          <div className="row">
            <button type="button" autoFocus className="btn primary" onClick={startMission}>{t('mission.start')}</button>
            <button type="button" className="btn ghost" onClick={leave}>{t('mission.skip')}</button>
          </div>
        </section>
      )}

      {phase === 'fail' && (
        <section className="panel brief">
          <p className="eyebrow warn">{t('mission.failed')}</p>
          <h1>{t(`${key}.title`)}</h1>
          <p className="lede">{result?.failKey ? t(`${key}.${result.failKey}`, result.values ?? {}) : ''}</p>
          <p className="hint"><b>{t('mission.hint')}</b> {t(`${key}.hint`)}{assisted && <> · {t('mission.assist')}</>}</p>
          <div className="row">
            <button type="button" autoFocus className="btn primary" onClick={retry}>{t('mission.retry')}</button>
            <button type="button" className="btn ghost" onClick={leave}>{t('mission.skip')}</button>
          </div>
        </section>
      )}

      {phase === 'win' && !onSuccess && (
        <section className="panel brief">
          <p className="eyebrow ok">{t('mission.complete')}</p>
          <h1>{t(`${key}.title`)}</h1>
          <p className="stars" aria-label={t('complete.stars', { n: earned, max: 3 })}>{'★'.repeat(earned)}<span>{'★'.repeat(3 - earned)}</span></p>
          <p className="lede">{t(`${key}.success`)}</p>
          <button type="button" autoFocus className="btn primary" onClick={leave}>{t('mission.continue')}</button>
        </section>
      )}
    </div>
  );
}
