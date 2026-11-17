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
const landingSurfaceImages = [
  ['yes-stay', 'no-stay', 'no-stay1', 'no-stay2'],
  ['yes-stay2', 'no-stay3', 'no-stay', 'no-stay1'],
  ['yes-stay', 'no-stay2', 'yes-stay2', 'no-stay3'],
].map((round) => round.map((name) => mediaUrl(`assets/missions/${name}.png`)));

function Craters({ id, config, onResult }: MissionProps<Extract<ClassifyConfig, { visual: 'craters' }>> & { assisted?: boolean }) {
  const { t } = useTranslation();
  const [round, setRound] = useState(0); const [pick, setPick] = useState<number | null>(null); const [mistakes, setMistakes] = useState(0);
  const data = useMemo(() => ({ answer: 0, patches: landingSurfaceImages[round % landingSurfaceImages.length] }), [round]);
  const choose = (value: number) => { if (pick !== null) return; setPick(value); if (value === data.answer) { play('ping'); useChatCue.getState().dismissFail(); } else { play('fail'); setMistakes((v) => v + 1); notifyClassifyFail(t, id); } };
  const next = () => round + 1 >= config.rounds ? onResult({ win: true, stars: stars(mistakes) }) : (setRound(round + 1), setPick(null));
  return <div className="board"><h2>{t(`missions:${id}.question`, { n: round + 1, total: config.rounds })}</h2><div className="site-grid">{data.patches.map((image, i) => <button type="button" className={`site${pick !== null && i === data.answer ? ' right' : ''}${pick === i && i !== data.answer ? ' wrong' : ''}`} disabled={pick !== null} onClick={() => choose(i)} key={image}><img src={image} alt={t(`missions:${id}.site`, { letter: LETTERS[i] })} /><span>{t(`missions:${id}.site`, { letter: LETTERS[i] })}</span></button>)}</div><div className="board-foot"><p role="status">{pick === null ? t(`missions:${id}.note`) : pick === data.answer ? t(`missions:${id}.right`) : t(`missions:${id}.wrong`, { letter: LETTERS[data.answer] })}</p>{pick !== null && <button type="button" className="btn primary" onClick={next}>{round + 1 >= config.rounds ? t('mission.continue') : t(`missions:${id}.next`)}</button>}</div></div>;
}

function Samples({ id, config, onResult }: MissionProps<Extract<ClassifyConfig, { visual: 'samples' }>>) {
  const { t } = useTranslation(); const types = ['basalt', 'anorthosite', 'breccia'] as const;
  const [round, setRound] = useState(0); const [pick, setPick] = useState<string | null>(null); const [mistakes, setMistakes] = useState(0);
  const answer = types[Math.floor(makeRng(config.seed + round * 31)() * types.length)];
  const colors = { basalt: ['#25242a', '#77727b'], anorthosite: ['#c6bfad', '#eee8da'], breccia: ['#6d5548', '#b9a08c'] } as const;
  const choose = (value: string) => { if (pick !== null) return; setPick(value); if (value === answer) { play('ping'); useChatCue.getState().dismissFail(); } else { play('fail'); setMistakes((v) => v + 1); notifyClassifyFail(t, id); } };
  const next = () => round + 1 >= config.rounds ? onResult({ win: true, stars: stars(mistakes) }) : (setRound(round + 1), setPick(null));
  return <div className="board narrow"><h2>{t(`missions:${id}.question`, { n: round + 1, total: config.rounds })}</h2><svg viewBox="0 0 360 150" className="chart" aria-label={t(`missions:${id}.props.${answer}`)}><rect width="360" height="150" fill={colors[answer][0]} />{Array.from({ length: 18 }, (_, i) => <circle key={i} cx={(i * 79) % 340 + 10} cy={(i * 47) % 130 + 10} r={5 + i % 4 * 3} fill={colors[answer][1]} opacity=".6" />)}</svg><p className="hint">{t(`missions:${id}.props.${answer}`)}</p><div className="options">{types.map((type) => <button type="button" className={`option${pick && type === answer ? ' right' : ''}${pick === type && type !== answer ? ' wrong' : ''}`} disabled={pick !== null} onClick={() => choose(type)} key={type}>{t(`missions:${id}.names.${type}`)}</button>)}</div><div className="board-foot"><p role="status">{pick ? pick === answer ? t(`missions:${id}.right`, { name: t(`missions:${id}.names.${answer}`) }) : t(`missions:${id}.wrong`) : t(`missions:${id}.note`)}</p>{pick && <button type="button" className="btn primary" onClick={next}>{round + 1 >= config.rounds ? t('mission.continue') : t(`missions:${id}.next`)}</button>}</div></div>;
}

function LabeledRelease({ id, config, onResult }: MissionProps<Extract<ClassifyConfig, { visual: 'lr' }>>) { const { t } = useTranslation(); const rounds = t(`missions:${id}.rounds`, { returnObjects: true }) as unknown as { chart: string; title: string; q: string; options: string[]; explain: string }[]; const [index, setIndex] = useState(0); const [pick, setPick] = useState<number | null>(null); const [mistakes, setMistakes] = useState(0); const item = rounds[index]; const choose = (value: number) => { if (pick !== null) return; setPick(value); if (value === config.answers[index]) { play('ping'); useChatCue.getState().dismissFail(); } else { play('fail'); setMistakes((v) => v + 1); notifyClassifyFail(t, id); } }; const next = () => index + 1 >= rounds.length ? onResult({ win: true, stars: stars(mistakes) }) : (setIndex(index + 1), setPick(null)); return <div className="board narrow"><h2>{item.title}</h2><p className="board-q">{item.q}</p><div className="options">{item.options.map((option, i) => <button type="button" className={`option${pick !== null && i === config.answers[index] ? ' right' : ''}${pick === i && i !== config.answers[index] ? ' wrong' : ''}`} disabled={pick !== null} onClick={() => choose(i)} key={option}>{option}</button>)}</div><div className="board-foot"><p role="status">{pick !== null ? item.explain : t(`missions:${id}.note`)}</p>{pick !== null && <button type="button" className="btn primary" onClick={next}>{index + 1 >= rounds.length ? t('mission.continue') : t(`missions:${id}.next`)}</button>}</div></div>; }

function Golden({ id, config, onResult }: MissionProps<Extract<ClassifyConfig, { visual: 'golden' }>>) { const { t } = useTranslation(); const [index, setIndex] = useState(0); const [pick, setPick] = useState<boolean | null>(null); const [mistakes, setMistakes] = useState(0); const item = config.items[index]; const choose = (value: boolean) => { if (pick !== null) return; setPick(value); if (value === item.on) { play('ping'); useChatCue.getState().dismissFail(); } else { play('fail'); setMistakes((v) => v + 1); notifyClassifyFail(t, id); } }; const next = () => index + 1 >= config.items.length ? onResult({ win: true, stars: stars(mistakes) }) : (setIndex(index + 1), setPick(null)); return <div className="board narrow golden"><div className="record" aria-hidden="true"><i /></div><h2>{t(`missions:${id}.items.${item.id}.name`)}</h2><div className="options two"><button type="button" className={`option${pick !== null && item.on ? ' right' : ''}`} disabled={pick !== null} onClick={() => choose(true)}>{t(`missions:${id}.on`)}</button><button type="button" className={`option${pick !== null && !item.on ? ' right' : ''}`} disabled={pick !== null} onClick={() => choose(false)}>{t(`missions:${id}.off`)}</button></div><div className="board-foot"><p role="status">{pick !== null ? t(`missions:${id}.items.${item.id}.why`) : t(`missions:${id}.note`)}</p>{pick !== null && <button type="button" className="btn primary" onClick={next}>{index + 1 >= config.items.length ? t('mission.continue') : t(`missions:${id}.next`)}</button>}</div></div>; }

export function ClassifyMission(props: MissionProps<ClassifyConfig>) { if (props.config.visual === 'craters') return <Craters {...props} config={props.config} />; if (props.config.visual === 'samples') return <Samples {...props} config={props.config} />; if (props.config.visual === 'lr') return <LabeledRelease {...props} config={props.config} />; return <Golden {...props} config={props.config} />; }
