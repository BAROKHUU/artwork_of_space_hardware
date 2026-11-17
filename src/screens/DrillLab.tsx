import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DrillConfig } from '../data/types';
import { Slider } from '../components/Slider';
import { DrillMission } from '../missions/DrillMission';
import type { MissionResult } from '../missions/common';

export default function DrillLab() {
  const { t } = useTranslation();
  const [world, setWorld] = useState<'moon' | 'mars'>('moon');
  const [targetDepth, setTargetDepth] = useState(2.4);
  const [maxJams, setMaxJams] = useState(3);
  const [run, setRun] = useState(0);
  const [result, setResult] = useState<MissionResult | null>(null);

  const config = useMemo<DrillConfig>(() => ({ world, targetDepth, seed: 16 + run, maxJams }), [world, targetDepth, run, maxJams]);
  const restart = () => {
    setResult(null);
    setRun((r) => r + 1);
  };

  return (
    <DrillMission
      key={`${world}-${targetDepth}-${maxJams}-${run}`}
      id="lab_drill"
      lab
      config={config}
      onResult={setResult}
      stageOverlay={
        result && (
          <div className="lab-result">
            <p>{result.win ? t('drill.labDone', { depth: targetDepth.toFixed(1), jams: result.values?.jams ?? 0 }) : t('drill.labFail', { jams: result.values?.jams ?? maxJams })}</p>
            <button type="button" className="btn primary" onClick={restart}>{t('lab.reset')}</button>
          </div>
        )
      }
      extraControls={
        <>
          <span className="control-label">{t('lab.world')}</span>
          <div className="choice">
            {(['moon', 'mars'] as const).map((w) => (
              <button type="button" key={w} className={world === w ? 'on' : ''} onClick={() => { setWorld(w); restart(); }}>
                {t(`lab.${w}`)}
              </button>
            ))}
          </div>
          <Slider label={t('drill.targetDepth')} value={targetDepth} min={1.5} max={4.0} step={0.1} unit="m" onChange={(v) => { setTargetDepth(v); restart(); }} />
          <Slider label={t('drill.maxJams')} value={maxJams} min={1} max={5} step={1} unit="" onChange={(v) => { setMaxJams(v); restart(); }} />
          <button type="button" className="btn" onClick={restart}>{t('lab.reset')}</button>
        </>
      }
    />
  );
}
