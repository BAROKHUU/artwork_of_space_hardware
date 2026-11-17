import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ClassifyConfig } from '../data/types';
import { makeRng } from '../sim/rng';
import { play } from '../audio/sfx';
import { useChatCue } from '../state/chatCue';
import type { MissionProps } from './common';
import { mediaUrl } from '../media';

function notifyClassifyFail(t: ReturnType<typeof useTranslation>['t'], id: string) {
  useChatCue.getState().showPopup({
    kind: 'fail',
    textKey: 'chat.popup.failMissionAlt',
    prefill: t('chat.popup.prefillMission', { mission: t(`missions:${id}.title`) }),
  });
}

const stars = (mistakes: number) => mistakes === 0 ? 3 : mistakes === 1 ? 2 : 1;
const LETTERS = ['A', 'B', 'C', 'D'];
type CraterCriterion = 'safest' | 'oldest';

// Verified directly against the surface imagery:
// - `no-stay` & `yes-stay2`: smooth, lightly cratered plains (safest to land, youngest)
// - `no-stay1`: moderate isolated craters
// - `yes-stay`, `no-stay2`, `no-stay3`: heavily cratered / weathered surfaces (oldest, hazardous)
const SAFEST_ROUNDS: { name: string; target: boolean }[][] = [
  [
    { name: 'no-stay', target: true },
    { name: 'yes-stay', target: false },
    { name: 'no-stay2', target: false },
    { name: 'no-stay3', target: false },
  ],
  [
    { name: 'yes-stay2', target: true },
    { name: 'no-stay1', target: false },
    { name: 'no-stay2', target: false },
    { name: 'no-stay3', target: false },
  ],
  [
    { name: 'no-stay', target: true },
    { name: 'yes-stay', target: false },
    { name: 'no-stay1', target: false },
    { name: 'no-stay3', target: false },
  ],
];

const OLDEST_ROUNDS: { name: string; target: boolean }[][] = [
  [
    { name: 'no-stay2', target: true },
    { name: 'no-stay', target: false },
    { name: 'yes-stay2', target: false },
    { name: 'no-stay1', target: false },
  ],
  [
    { name: 'no-stay3', target: true },
    { name: 'no-stay', target: false },
    { name: 'yes-stay2', target: false },
    { name: 'no-stay1', target: false },
  ],
  [
    { name: 'yes-stay', target: true },
    { name: 'no-stay', target: false },
    { name: 'yes-stay2', target: false },
    { name: 'no-stay1', target: false },
  ],
];

/** Deterministically shuffles a crater-classification round for either safest landing or oldest ground. */
export function pickCraterRound(seed: number, round: number, criterion: CraterCriterion = 'safest') {
  const pool = criterion === 'oldest' ? OLDEST_ROUNDS : SAFEST_ROUNDS;
  const base = pool[round % pool.length].map((item) => ({
    ...item,
    image: mediaUrl(`assets/missions/${item.name}.png`),
  }));
  const rng = makeRng(seed + round * 37);
  for (let i = base.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [base[i], base[j]] = [base[j], base[i]];
  }
  return {
    patches: base.map((p) => p.image),
    answer: base.findIndex((p) => p.target),
  };
}

function Craters({ id, config, onResult }: MissionProps<Extract<ClassifyConfig, { visual: 'craters' }>> & { assisted?: boolean }) {
  const { t } = useTranslation();
  const [round, setRound] = useState(0); const [pick, setPick] = useState<number | null>(null); const [mistakes, setMistakes] = useState(0);
  const criterion: CraterCriterion = config.criterion ?? (id === 'm3_craters' ? 'oldest' : 'safest');
  const data = useMemo(() => pickCraterRound(config.seed, round, criterion), [config.seed, round, criterion]);
  const choose = (value: number) => { if (pick !== null) return; setPick(value); if (value === data.answer) { play('ping'); useChatCue.getState().dismissFail(); } else { play('fail'); setMistakes((v) => v + 1); notifyClassifyFail(t, id); } };
  const next = () => round + 1 >= config.rounds ? onResult({ win: true, stars: stars(mistakes) }) : (setRound(round + 1), setPick(null));
  return <div className="board"><h2>{t(`missions:${id}.question`, { n: round + 1, total: config.rounds })}</h2><div className="site-grid">{data.patches.map((image, i) => <button type="button" className={`site${pick !== null && i === data.answer ? ' right' : ''}${pick === i && i !== data.answer ? ' wrong' : ''}`} disabled={pick !== null} onClick={() => choose(i)} key={`${round}-${i}`}><img src={image} alt={t(`missions:${id}.site`, { letter: LETTERS[i] })} /><span>{t(`missions:${id}.site`, { letter: LETTERS[i] })}</span></button>)}</div><div className="board-foot"><p role="status">{pick === null ? t(`missions:${id}.note`) : pick === data.answer ? t(`missions:${id}.right`) : t(`missions:${id}.wrong`, { letter: LETTERS[data.answer] })}</p>{pick !== null && <button type="button" className="btn primary" onClick={next}>{round + 1 >= config.rounds ? t('mission.continue') : t(`missions:${id}.next`)}</button>}</div></div>;
}

function SampleSpecimen({ type, seed, label }: { type: 'basalt' | 'anorthosite' | 'breccia'; seed: number; label: string }) {
  const features = useMemo(() => {
    const rng = makeRng(seed);
    return Array.from({ length: 24 }, () => ({
      x: 24 + rng() * 312,
      y: 16 + rng() * 118,
      r: 3 + rng() * 10,
      rot: Math.floor(rng() * 180),
      tone: rng(),
    }));
  }, [seed]);

  const bg = type === 'basalt' ? '#1f2027' : type === 'anorthosite' ? '#d4cdbd' : '#655246';
  return (
    <svg viewBox="0 0 360 150" className="chart" role="img" aria-label={label}>
      <rect width="360" height="150" fill={bg} rx="8" />
      {type === 'basalt' &&
        features.map((f, i) => (
          <g key={i}>
            <circle cx={f.x} cy={f.y} r={f.r * 0.65} fill="#0e0f14" stroke="#454754" strokeWidth="1.2" opacity=".88" />
            {i % 3 === 0 && <circle cx={f.x + 8} cy={f.y - 4} r="1.8" fill="#7c8778" opacity=".6" />}
          </g>
        ))}
      {type === 'anorthosite' &&
        features.map((f, i) => (
          <rect
            key={i}
            x={f.x - f.r}
            y={f.y - 3}
            width={f.r * 2.2}
            height={5 + (i % 3)}
            rx="1.5"
            transform={`rotate(${f.rot} ${f.x} ${f.y})`}
            fill={f.tone > 0.5 ? '#f4efe3' : '#b7af9d'}
            stroke="#9a9180"
            strokeWidth="0.6"
            opacity=".85"
          />
        ))}
      {type === 'breccia' &&
        features.map((f, i) => (
          <polygon
            key={i}
            points={`${f.x},${f.y - f.r} ${f.x + f.r * 1.1},${f.y - f.r * 0.2} ${f.x + f.r * 0.6},${f.y + f.r} ${f.x - f.r * 0.9},${f.y + f.r * 0.5}`}
            transform={`rotate(${f.rot} ${f.x} ${f.y})`}
            fill={f.tone > 0.6 ? '#d8cfc0' : f.tone > 0.25 ? '#413936' : '#9c8676'}
            stroke="#2a2320"
            strokeWidth="0.8"
            opacity=".9"
          />
        ))}
    </svg>
  );
}

function Samples({ id, config, onResult }: MissionProps<Extract<ClassifyConfig, { visual: 'samples' }>>) {
  const { t } = useTranslation(); const types = ['basalt', 'anorthosite', 'breccia'] as const;
  const [round, setRound] = useState(0); const [pick, setPick] = useState<string | null>(null); const [mistakes, setMistakes] = useState(0);
  const answer = types[Math.floor(makeRng(config.seed + round * 31)() * types.length)];
  const choose = (value: string) => { if (pick !== null) return; setPick(value); if (value === answer) { play('ping'); useChatCue.getState().dismissFail(); } else { play('fail'); setMistakes((v) => v + 1); notifyClassifyFail(t, id); } };
  const next = () => round + 1 >= config.rounds ? onResult({ win: true, stars: stars(mistakes) }) : (setRound(round + 1), setPick(null));
  return <div className="board narrow"><h2>{t(`missions:${id}.question`, { n: round + 1, total: config.rounds })}</h2><SampleSpecimen type={answer} seed={config.seed + round * 31} label={t(`missions:${id}.props.${answer}`)} /><p className="hint">{t(`missions:${id}.props.${answer}`)}</p><div className="options">{types.map((type) => <button type="button" className={`option${pick && type === answer ? ' right' : ''}${pick === type && type !== answer ? ' wrong' : ''}`} disabled={pick !== null} onClick={() => choose(type)} key={type}>{t(`missions:${id}.names.${type}`)}</button>)}</div><div className="board-foot"><p role="status">{pick ? pick === answer ? t(`missions:${id}.right`, { name: t(`missions:${id}.names.${answer}`) }) : t(`missions:${id}.wrong`) : t(`missions:${id}.note`)}</p>{pick && <button type="button" className="btn primary" onClick={next}>{round + 1 >= config.rounds ? t('mission.continue') : t(`missions:${id}.next`)}</button>}</div></div>;
}

const CHART_PATHS: Record<string, string> = {
  fresh: 'M36,118 C65,116 82,42 128,32 C178,22 238,24 328,28',
  heated: 'M36,116 L328,114',
  organics: 'M36,116 L120,115 L190,116 L260,115 L328,116',
  transit: 'M36,36 L78,36 L86,62 L106,62 L114,36 L168,36 L176,62 L196,62 L204,36 L258,36 L266,62 L286,62 L294,36 L328,36',
};

function ScienceChart({ chart, axisX, axisY, label }: { chart: string; axisX: string; axisY: string; label: string }) {
  const path = CHART_PATHS[chart] ?? CHART_PATHS.organics;
  return (
    <svg viewBox="0 0 360 150" className="chart" role="img" aria-label={label}>
      <rect width="360" height="150" fill="#0d111a" rx="8" />
      <line x1="36" y1="20" x2="36" y2="122" stroke="rgba(244,234,215,0.3)" strokeWidth="1.2" />
      <line x1="36" y1="122" x2="334" y2="122" stroke="rgba(244,234,215,0.3)" strokeWidth="1.2" />
      <path d={path} fill="none" stroke={chart === 'fresh' || chart === 'transit' ? '#37e6c0' : '#ffb25a'} strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
      <text x="185" y="142" textAnchor="middle" fill="#aeb2c0" fontSize="11">{axisX}</text>
      <text x="14" y="72" textAnchor="middle" fill="#aeb2c0" fontSize="11" transform="rotate(-90 14 72)">{axisY}</text>
    </svg>
  );
}

function LabeledRelease({ id, config, onResult }: MissionProps<Extract<ClassifyConfig, { visual: 'lr' }>>) { const { t } = useTranslation(); const rounds = t(`missions:${id}.rounds`, { returnObjects: true }) as unknown as { chart: string; title: string; q: string; options: string[]; explain: string }[]; const [index, setIndex] = useState(0); const [pick, setPick] = useState<number | null>(null); const [mistakes, setMistakes] = useState(0); const item = rounds[index]; const choose = (value: number) => { if (pick !== null) return; setPick(value); if (value === config.answers[index]) { play('ping'); useChatCue.getState().dismissFail(); } else { play('fail'); setMistakes((v) => v + 1); notifyClassifyFail(t, id); } }; const next = () => index + 1 >= rounds.length ? onResult({ win: true, stars: stars(mistakes) }) : (setIndex(index + 1), setPick(null)); return <div className="board narrow"><h2>{item.title}</h2><ScienceChart chart={item.chart} axisX={t(`missions:${id}.axisX`)} axisY={t(`missions:${id}.axisY`)} label={item.title} /><p className="board-q">{item.q}</p><div className="options">{item.options.map((option, i) => <button type="button" className={`option${pick !== null && i === config.answers[index] ? ' right' : ''}${pick === i && i !== config.answers[index] ? ' wrong' : ''}`} disabled={pick !== null} onClick={() => choose(i)} key={option}>{option}</button>)}</div><div className="board-foot"><p role="status">{pick !== null ? item.explain : t(`missions:${id}.note`)}</p>{pick !== null && <button type="button" className="btn primary" onClick={next}>{index + 1 >= rounds.length ? t('mission.continue') : t(`missions:${id}.next`)}</button>}</div></div>; }

function Golden({ id, config, onResult }: MissionProps<Extract<ClassifyConfig, { visual: 'golden' }>>) { const { t } = useTranslation(); const [index, setIndex] = useState(0); const [pick, setPick] = useState<boolean | null>(null); const [mistakes, setMistakes] = useState(0); const item = config.items[index]; const choose = (value: boolean) => { if (pick !== null) return; setPick(value); if (value === item.on) { play('ping'); useChatCue.getState().dismissFail(); } else { play('fail'); setMistakes((v) => v + 1); notifyClassifyFail(t, id); } }; const next = () => index + 1 >= config.items.length ? onResult({ win: true, stars: stars(mistakes) }) : (setIndex(index + 1), setPick(null)); return <div className="board narrow golden"><div className="record" aria-hidden="true"><i /></div><h2>{t(`missions:${id}.items.${item.id}.name`)}</h2><div className="options two"><button type="button" className={`option${pick !== null && item.on ? ' right' : ''}`} disabled={pick !== null} onClick={() => choose(true)}>{t(`missions:${id}.on`)}</button><button type="button" className={`option${pick !== null && !item.on ? ' right' : ''}`} disabled={pick !== null} onClick={() => choose(false)}>{t(`missions:${id}.off`)}</button></div><div className="board-foot"><p role="status">{pick !== null ? t(`missions:${id}.items.${item.id}.why`) : t(`missions:${id}.note`)}</p>{pick !== null && <button type="button" className="btn primary" onClick={next}>{index + 1 >= config.items.length ? t('mission.continue') : t(`missions:${id}.next`)}</button>}</div></div>; }

export function ClassifyMission(props: MissionProps<ClassifyConfig>) { if (props.config.visual === 'craters') return <Craters {...props} config={props.config} />; if (props.config.visual === 'samples') return <Samples {...props} config={props.config} />; if (props.config.visual === 'lr') return <LabeledRelease {...props} config={props.config} />; return <Golden {...props} config={props.config} />; }
