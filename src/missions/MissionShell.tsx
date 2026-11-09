import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { MissionBeat } from '../data/types';
import { useGame } from '../state/store';
import { play } from '../audio/sfx';
import { ClassifyMission } from './ClassifyMission';
import { DriveMission } from './DriveMission';
import { LandingMission } from './LandingMission';
import { LaserMission } from './LaserMission';
import { SlingshotMission } from './SlingshotMission';
import type { MissionResult } from './common';

type Phase = 'brief' | 'play' | 'fail' | 'win';

export function MissionShell({ beat, onDone }: { beat: MissionBeat; onDone: () => void }) {
  const { t } = useTranslation();
  const setStars = useGame((s) => s.setStars);
  const [phase, setPhase] = useState<Phase>('brief');
  const [attempt, setAttempt] = useState(1);
  const [result, setResult] = useState<MissionResult | null>(null);
  const [earned, setEarned] = useState(0);
  const key = `missions:${beat.id}`;
  const interpolation = { ...('safe' in beat.config ? { safe: beat.config.safe } : {}), ...('hold' in beat.config ? { hold: beat.config.hold } : {}), ...('shots' in beat.config ? { shots: beat.config.shots } : {}) };

  const onResult = useCallback(
    (r: MissionResult) => {
      setResult(r);
      if (r.win) {
        const stars = Math.max(1, r.stars ?? (attempt === 1 ? 3 : attempt === 2 ? 2 : 1));
        setEarned(stars);
        setStars(beat.id, stars);
        play('win');
        setPhase('win');
      } else setPhase('fail');
    },
    [attempt, beat.id, setStars],
  );

  const retry = () => {
    setAttempt((a) => a + 1);
    setResult(null);
    setPhase('play');
  };

  const common = { id: beat.id, onResult };
  return (
    <div className="mission">
      {phase === 'play' && (
        <>
          {beat.template === 'drive' && <DriveMission key={attempt} {...common} config={beat.config} />}
          {beat.template === 'landing' && <LandingMission key={attempt} {...common} config={beat.config} />}
          {beat.template === 'laser' && <LaserMission key={attempt} {...common} config={beat.config} />}
          {beat.template === 'slingshot' && <SlingshotMission key={attempt} {...common} config={beat.config} />}
          {beat.template === 'classify' && <ClassifyMission key={attempt} {...common} config={beat.config} />}
          <button type="button" className="skip-link" onClick={onDone}>{t('mission.skip')}</button>
        </>
      )}

      {phase === 'brief' && (
        <section className="panel brief">
          <p className="eyebrow">{t('mission.objective')}</p>
          <h1>{t(`${key}.title`)}</h1>
          <p className="lede">{t(`${key}.goal`, interpolation)}</p>
          <p className="hint"><b>{t('mission.hint')}</b> {t(`${key}.hint`)}</p>
          <div className="row">
            <button type="button" autoFocus className="btn primary" onClick={() => { play('blip'); setPhase('play'); }}>{t('mission.start')}</button>
            <button type="button" className="btn ghost" onClick={onDone}>{t('mission.skip')}</button>
          </div>
        </section>
      )}

      {phase === 'fail' && (
        <section className="panel brief">
          <p className="eyebrow warn">{t('mission.failed')}</p>
          <h1>{t(`${key}.title`)}</h1>
          <p className="lede">{result?.failKey ? t(`${key}.${result.failKey}`, result.values ?? {}) : ''}</p>
          <p className="hint"><b>{t('mission.hint')}</b> {t(`${key}.hint`)}</p>
          <div className="row">
            <button type="button" autoFocus className="btn primary" onClick={retry}>{t('mission.retry')}</button>
            <button type="button" className="btn ghost" onClick={onDone}>{t('mission.skip')}</button>
          </div>
        </section>
      )}

      {phase === 'win' && (
        <section className="panel brief">
          <p className="eyebrow ok">{t('mission.complete')}</p>
          <h1>{t(`${key}.title`)}</h1>
          <p className="stars" aria-label={t('complete.stars', { n: earned, max: 3 })}>{'★'.repeat(earned)}<span>{'★'.repeat(3 - earned)}</span></p>
          <p className="lede">{t(`${key}.success`)}</p>
          <button type="button" autoFocus className="btn primary" onClick={onDone}>{t('mission.continue')}</button>
        </section>
      )}
    </div>
  );
}
