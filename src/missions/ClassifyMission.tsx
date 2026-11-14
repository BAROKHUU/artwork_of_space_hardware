import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ClassifyConfig } from '../data/types';
import { makeRng } from '../sim/rng';
import { play } from '../audio/sfx';
import type { MissionProps } from './common';

const LETTERS = 'ABCD';
const starsFor = (mistakes: number) => (mistakes === 0 ? 3 : mistakes === 1 ? 2 : 1);

interface Patch {
  craters: { x: number; y: number; r: number }[];
  boulders: { x: number; y: number; r: number }[];
}

function makeRound(seed: number) {
  const rng = makeRng(seed);
  const answer = Math.floor(rng() * 4);
  const patches: Patch[] = Array.from({ length: 4 }, (_, i) => {
    const safe = i === answer;
    const craters = Array.from({ length: safe ? 2 + Math.floor(rng() * 2) : 7 + Math.floor(rng() * 5) }, () => ({ x: rng() * 200, y: rng() * 200, r: safe ? 4 + rng() * 5 : 8 + rng() * 22 }));
    const boulders = Array.from({ length: safe ? 2 : 12 + Math.floor(rng() * 12) }, () => ({ x: rng() * 200, y: rng() * 200, r: 1.5 + rng() * 2.5 }));
    return { craters, boulders };
  });
  return { answer, patches };
}

function PatchSvg({ patch, seed }: { patch: Patch; seed: number }) {
  const specks = useMemo(() => {
    const rng = makeRng(seed);
    return Array.from({ length: 90 }, () => [rng() * 200, rng() * 200, rng()] as const);
  }, [seed]);
  return (
    <svg viewBox="0 0 200 200" aria-hidden="true">
      <rect width="200" height="200" fill="#6f6e70" />
      {specks.map(([x, y, s], i) => <circle key={i} cx={x} cy={y} r={0.6 + s * 1.2} fill={s > 0.5 ? '#807f81' : '#5f5e60'} />)}
      {patch.craters.map((c, i) => (
        <g key={i}>
          <circle cx={c.x} cy={c.y} r={c.r} fill="#3e3d40" />
          <circle cx={c.x + c.r * 0.16} cy={c.y + c.r * 0.16} r={c.r * 0.86} fill="#58575a" />
          <path d={`M ${c.x - c.r} ${c.y} A ${c.r} ${c.r} 0 0 1 ${c.x} ${c.y - c.r}`} stroke="#9d9c9e" strokeWidth="1.4" fill="none" />
        </g>
      ))}
      {patch.boulders.map((b, i) => <circle key={i} cx={b.x} cy={b.y} r={b.r} fill="#1f1e21" />)}
    </svg>
  );
}

function Craters({ id, config, onResult }: MissionProps<Extract<ClassifyConfig, { visual: 'craters' }>>) {
  const { t } = useTranslation();
  const [round, setRound] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [mistakes, setMistakes] = useState(0);
  const data = useMemo(() => makeRound(config.seed + round * 101), [config.seed, round]);

  const pick = (i: number) => {
    if (picked !== null) return;
    setPicked(i);
    if (i === data.answer) play('ping');
    else {
      play('fail');
      setMistakes((m) => m + 1);
    }
  };
  const next = () => {
    if (round + 1 >= config.rounds) onResult({ win: true, stars: starsFor(mistakes) });
    else {
      setRound(round + 1);
      setPicked(null);
    }
  };

  return (
    <div className="board">
      <h2>{t(`missions:${id}.question`, { n: round + 1, total: config.rounds })}</h2>
      <div className="site-grid">
        {data.patches.map((p, i) => (
          <button type="button" key={`${round}-${i}`} className={`site${picked !== null && i === data.answer ? ' right' : ''}${picked === i && i !== data.answer ? ' wrong' : ''}`} disabled={picked !== null} onClick={() => pick(i)}>
            <PatchSvg patch={p} seed={config.seed + round * 7 + i} />
            <span>{t(`missions:${id}.site`, { letter: LETTERS[i] })}</span>
          </button>
        ))}
      </div>
      <div className="board-foot">
        <p role="status">{picked === null ? t(`missions:${id}.note`) : picked === data.answer ? t(`missions:${id}.right`) : t(`missions:${id}.wrong`, { letter: LETTERS[data.answer] })}</p>
        {picked !== null && <button type="button" className="btn primary" onClick={next}>{round + 1 >= config.rounds ? t('mission.continue') : t(`missions:${id}.next`)}</button>}
      </div>
    </div>
  );
}

const CURVES: Record<string, string> = {
  fresh: 'M 40 170 C 60 60, 80 50, 120 46 S 260 34, 340 30',
  heated: 'M 40 170 C 120 168, 240 166, 340 164',
  transit: 'M 40 48 L 125 48 C 145 48, 150 132, 190 132 C 230 132, 235 48, 255 48 L 340 48',
};

function Chart({ kind, x, y, none, noneLabel }: { kind: string; x: string; y: string; none: string; noneLabel: string }) {
  if (kind === 'organics') {
    return (
      <svg viewBox="0 0 360 200" className="chart" role="img" aria-label={noneLabel}>
        <line x1="40" y1="170" x2="340" y2="170" stroke="#6d7284" />
        <path d="M 40 160 L 80 158 L 120 161 L 160 157 L 200 160 L 240 158 L 280 161 L 340 159" stroke="#37e6c0" strokeWidth="2.5" fill="none" />
        <text x="190" y="90" textAnchor="middle" fill="#f4ead7" fontSize="17">0</text>
        <text x="190" y="112" textAnchor="middle" fill="#a7abba" fontSize="12">{none}</text>
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 360 200" className="chart" role="img" aria-label={`${y} over ${x}`}>
      <line x1="40" y1="20" x2="40" y2="170" stroke="#6d7284" />
      <line x1="40" y1="170" x2="340" y2="170" stroke="#6d7284" />
      <path d={CURVES[kind]} stroke="#ff6a2b" strokeWidth="3" fill="none" />
      <text x="190" y="194" textAnchor="middle" fill="#a7abba" fontSize="12">{x}</text>
      <text x="14" y="95" textAnchor="middle" fill="#a7abba" fontSize="12" transform="rotate(-90 14 95)">{y}</text>
    </svg>
  );
}

interface LrRound {
  chart: string;
  title: string;
  q: string;
  options: string[];
  explain: string;
}

function LabeledRelease({ id, config, onResult }: MissionProps<Extract<ClassifyConfig, { visual: 'lr' }>>) {
  const { t } = useTranslation();
  const rounds = t(`missions:${id}.rounds`, { returnObjects: true }) as unknown as LrRound[];
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [mistakes, setMistakes] = useState(0);
  const r = rounds[i];
  const pick = (o: number) => {
    if (picked !== null) return;
    setPicked(o);
    if (o === config.answers[i]) play('ping');
    else {
      play('fail');
      setMistakes((m) => m + 1);
    }
  };
  return (
    <div className="board narrow">
      <h2>{r.title}</h2>
      <Chart kind={r.chart} x={t(`missions:${id}.axisX`)} y={t(`missions:${id}.axisY`)} none={t(`missions:${id}.none`)} noneLabel={t(`missions:${id}.noneLabel`)} />
      <p className="board-q">{r.q}</p>
      <div className="options">
        {r.options.map((o, n) => (
          <button type="button" key={n} disabled={picked !== null} className={`option${picked !== null && n === config.answers[i] ? ' right' : ''}${picked === n && n !== config.answers[i] ? ' wrong' : ''}`} onClick={() => pick(n)}>{o}</button>
        ))}
      </div>
      <div className="board-foot">
        <p role="status">{picked !== null ? r.explain : t(`missions:${id}.note`)}</p>
        {picked !== null && (
          <button type="button" className="btn primary" onClick={() => { if (i + 1 >= rounds.length) onResult({ win: true, stars: starsFor(mistakes) }); else { setI(i + 1); setPicked(null); } }}>
            {i + 1 >= rounds.length ? t('mission.continue') : t(`missions:${id}.next`)}
          </button>
        )}
      </div>
    </div>
  );
}

function Golden({ id, config, onResult }: MissionProps<Extract<ClassifyConfig, { visual: 'golden' }>>) {
  const { t } = useTranslation();
  const [i, setI] = useState(0);
  const [answer, setAnswer] = useState<boolean | null>(null);
  const [mistakes, setMistakes] = useState(0);
  const item = config.items[i];
  const choose = (on: boolean) => {
    if (answer !== null) return;
    setAnswer(on);
    if (on === item.on) play('ping');
    else {
      play('fail');
      setMistakes((m) => m + 1);
    }
  };
  return (
    <div className="board narrow golden">
      <div className="record" aria-hidden="true"><i /></div>
      <p className="counter">{i + 1} / {config.items.length}</p>
      <h2>{t(`missions:${id}.items.${item.id}.name`)}</h2>
      <div className="options two">
        <button type="button" disabled={answer !== null} className={`option${answer !== null && item.on ? ' right' : ''}${answer === true && !item.on ? ' wrong' : ''}`} onClick={() => choose(true)}>{t(`missions:${id}.on`)}</button>
        <button type="button" disabled={answer !== null} className={`option${answer !== null && !item.on ? ' right' : ''}${answer === false && item.on ? ' wrong' : ''}`} onClick={() => choose(false)}>{t(`missions:${id}.off`)}</button>
      </div>
      <div className="board-foot">
        <p role="status">{answer !== null ? t(`missions:${id}.items.${item.id}.why`) : t(`missions:${id}.note`)}</p>
        {answer !== null && (
          <button type="button" className="btn primary" onClick={() => { if (i + 1 >= config.items.length) onResult({ win: true, stars: starsFor(mistakes) }); else { setI(i + 1); setAnswer(null); } }}>
            {i + 1 >= config.items.length ? t('mission.continue') : t(`missions:${id}.next`)}
          </button>
        )}
      </div>
    </div>
  );
}

export function ClassifyMission(props: MissionProps<ClassifyConfig>) {
  const { config } = props;
  if (config.visual === 'craters') return <Craters {...props} config={config} />;
  if (config.visual === 'lr') return <LabeledRelease {...props} config={config} />;
  return <Golden {...props} config={config} />;
}
