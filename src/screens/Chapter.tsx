import { useEffect, useMemo, useRef, useState } from 'react';
import { GameplayStory } from '../book/GameplayStory';
import { getStorySections } from '../book/content';
import type { StorySection } from '../book/types';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { chapterById, hardwareById, nextChapterInArc, photoUrl, sources } from '../data';
import type { Beat, Chapter as ChapterData } from '../data/types';
import { useChatCue } from '../state/chatCue';
import { useGame } from '../state/store';
import { MissionShell } from '../missions/MissionShell';
import { Facts, FateBadge, Photo } from '../components/HardwareInfo';
import { distanceAU, lightHours, type ProbeId } from '../sim/ephemeris';
import { play } from '../audio/sfx';
import { scoreLocally, validateReflectionReview } from '../assessment';

type QuizBeat = Extract<Beat, { kind: 'quiz' | 'apply' | 'precheck' | 'postcheck' }>;
type QuizImage = { id: string; photo: string; nasaId: string; credit: string; sources: string[] };

const quizImageAssets: Record<string, QuizImage> = {
  apollo11_psep: { id: 'apollo11_psep', photo: 'apollo11_psep.jpg', nasaId: 'as11-40-5951', credit: 'NASA', sources: ['apollo11_psep'] },
};

const quizEvidence: Record<string, string[]> = {
  ch1: ['ranger7', 'surveyor3'],
  ch2: ['lrrr', 'lrrr'],
  ch3: ['voyager2', 'voyager2'],
  ch4: ['viking1', 'viking1'],
  ch5: ['opportunity', 'opportunity'],
  ch6: ['ingenuity', 'perseverance'],
  ch7: ['voyager1', 'voyager1'],
  m2: ['lrv', 'lrv'],
  m3: ['ranger7', 'apollo12_descent'],
  m5: ['apollo11_psep', 'apollo11_psep'],
  moon: ['lrv', 'apollo11_descent', 'alsep12'],
  a2: ['lrv'],
  a3: ['ranger7'],
  a4: ['lrrr'],
  a5: ['alsep12'],
};

gsap.registerPlugin(useGSAP);

function Dialogue({ chapter, beat, sections, onDone, inPlace = false }: { chapter: ChapterData; beat: Extract<Beat, { kind: 'dialogue' }>; sections: StorySection[]; onDone: () => void; inPlace?: boolean }) {
  const section = sections.find((item) => item.key === beat.key);
  if (!section) return null;
  return <GameplayStory chapter={chapter} section={section} onContinue={onDone} inPlace={inPlace} />;
}
function Memory({ id, onDone }: { id: string; onDone: () => void }) {
  const { t } = useTranslation();
  const unlock = useGame((s) => s.unlock);
  const item = hardwareById[id];
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    unlock(id);
    play('ping');
  }, [id, unlock]);
  useGSAP(
    () => {
      gsap.matchMedia().add('(prefers-reduced-motion: no-preference)', () => {
        gsap.from('.memory-photo', { scale: 1.05, autoAlpha: 0, duration: 0.7, ease: 'power2.out' });
        gsap.from('.memory-body > *', { y: 16, autoAlpha: 0, duration: 0.5, stagger: 0.07, ease: 'power2.out', delay: 0.15 });
      });
    },
    { scope: root },
  );
  return (
    <div className="memory" ref={root}>
      <div className="memory-photo"><Photo item={item} /></div>
      <div className="memory-body">
        <p className="eyebrow ok">{t('memory.unlocked')}</p>
        <h1>{t(`hardware:${id}.name`)}</h1>
        <p className="where">{t(`hardware:${id}.where`)} <FateBadge fate={item.fate} /></p>
        <Facts item={item} />
        <button type="button" className="btn primary" onClick={onDone}>{t('memory.continue')}</button>
      </div>
    </div>
  );
}

function Quiz({ beat, onDone }: { beat: QuizBeat; onDone: () => void }) {
  const { t } = useTranslation();
  const saveQuiz = useGame((s) => s.saveQuiz);
  const savePrecheck = useGame((s) => s.savePrecheck);
  const savePostcheck = useGame((s) => s.savePostcheck);
  const items = t(`quiz:${beat.key}`, { returnObjects: true }) as unknown as { q: string; options: string[]; why: string }[];
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [answers, setAnswers] = useState<number[]>([]);
  const q = items[i];
  const answer = beat.answers[i];
  const evidenceId = quizEvidence[beat.key]?.[i] ?? '';
  const evidence = quizImageAssets[evidenceId] ?? hardwareById[evidenceId];
  const evidenceSource = evidence ? sources[evidence.sources[0]] : undefined;
  const evidenceName = evidence?.id === 'apollo11_psep' ? t('quiz.psepName') : evidence ? t(`hardware:${evidence.id}.name`) : '';
  const ungraded = beat.kind === 'precheck' || beat.kind === 'postcheck';
  const finish = () => {
    const finalAnswers = [...answers, picked!];
    if (beat.kind === 'precheck') savePrecheck(finalAnswers);
    else if (beat.kind === 'postcheck') savePostcheck(finalAnswers);
    else saveQuiz(beat.key, finalAnswers, beat.answers);
    onDone();
  };
  const advance = () => {
    if (i + 1 >= items.length) finish();
    else { setAnswers((current) => [...current, picked!]); setI(i + 1); setPicked(null); }
  };
  return (
    <section className="panel brief quiz">
      <p className="eyebrow">{ungraded ? t('learn.precheck.heading') : t('quiz.heading')} · {i + 1}/{items.length}</p>
      <h1>{q.q}</h1>
      {evidence && evidenceSource && <figure className="quiz-evidence">
        <img src={photoUrl(evidence.photo)} alt={evidenceName} loading="lazy" />
        <figcaption>
          <span>{t('quiz.nasaPhoto', { name: evidenceName, credit: evidence.credit, id: evidence.nasaId })}</span>
          <a href={evidenceSource.url} target="_blank" rel="noreferrer">{t('quiz.nasaSource', { source: evidenceSource.org })}</a>
        </figcaption>
      </figure>}
      <div className="options">
        {q.options.map((o, n) => (
          <button type="button" key={n} aria-pressed={picked === n} disabled={picked !== null && !ungraded} className={`option${!ungraded && picked !== null && n === answer ? ' right' : ''}${!ungraded && picked === n && n !== answer ? ' wrong' : ''}${ungraded && picked === n ? ' right' : ''}`} onClick={() => {
            setPicked(n);
            if (!ungraded) {
              const right = n === answer;
              play(right ? 'ping' : 'fail');
              if (right) useChatCue.getState().dismissFail();
              else useChatCue.getState().showPopup({ kind: 'fail', textKey: 'chat.popup.failQuiz', prefill: t('chat.popup.prefillQuiz', { question: q.q }) });
            }
          }}>{o}</button>
        ))}
      </div>
      {picked !== null && !ungraded && (
        <>
          <p className="lede" role="status"><b>{picked === answer ? t('quiz.correct') : t('quiz.incorrect')}</b> {q.why}</p>
          <button type="button" autoFocus className="btn primary" onClick={advance}>
            {i + 1 >= items.length ? t('quiz.finish') : t('quiz.next')}
          </button>
        </>
      )}
      {ungraded && <div className="row"><button type="button" className="btn primary" disabled={picked === null} onClick={advance}>{i + 1 >= items.length ? t('quiz.finish') : t('quiz.next')}</button>{beat.kind === 'precheck' && <button type="button" className="btn ghost" onClick={onDone}>{t('learn.precheck.skip')}</button>}</div>}
    </section>
  );
}

function Reflection({ beat, onDone }: { beat: Extract<Beat, { kind: 'reflect' }>; onDone: () => void }) {
  const { t } = useTranslation();
  const reading = useGame((s) => s.reading);
  const save = useGame((s) => s.saveReflection);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [review, setReview] = useState<ReturnType<typeof scoreLocally> | null>(null);
  const prompt = `learn.reflect.prompts.${beat.key}`;
  const submit = async () => {
    if (!text.trim()) return;
    setBusy(true);
    let result = scoreLocally(beat.key, text);
    try {
      const response = await fetch('/api/assess', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ questionId: beat.key, answer: text, language: document.documentElement.lang }), signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error('assessment_unavailable');
      const validated = validateReflectionReview(await response.json(), beat.key);
      if (validated) result = validated;
    } catch { /* local rubric is the offline-safe assessment */ }
    save(beat.key, text.trim(), result);
    setReview(result);
    setBusy(false);
  };
  const skip = () => { save(beat.key, '', null, true); onDone(); };
  return <section className="panel brief reflection">
    <p className="eyebrow">{t('learn.reflect.heading')}</p>
    <h1>{t(`${prompt}.question`)}</h1><p className="lede">{t(`${prompt}.context`)}</p>
    {review ? <>
      <p className="hint" role="status"><b>{t(review.source === 'gemini' ? 'learn.reflect.ai' : 'learn.reflect.fallback')}</b> {t('learn.reflect.score', { score: review.score, max: review.max })}</p>
      <button type="button" className="btn primary" onClick={onDone}>{t('learn.reflect.continue')}</button>
    </> : <>
      {reading === 'young' && <div className="reflection-support"><p>{t('learn.reflect.wordBank')}: {((t(`${prompt}.words`, { returnObjects: true }) as string[])).join(' · ')}</p><div className="row">{(t(`${prompt}.starters`, { returnObjects: true }) as string[]).map((starter) => <button key={starter} type="button" className="btn ghost" onClick={() => setText((value) => `${value}${value ? ' ' : ''}${starter} `)}>{starter}</button>)}</div></div>}
      <textarea aria-label={t(`${prompt}.question`)} placeholder={t(`${prompt}.placeholder`)} value={text} maxLength={1200} onChange={(event) => setText(event.target.value)} />
      <p className="small-note">{t('learn.reflect.minLength')}</p>
      <div className="row"><button type="button" className="btn primary" disabled={!text.trim() || busy} onClick={() => void submit()}>{t(busy ? 'learn.reflect.thinking' : 'learn.reflect.submit')}</button><button type="button" className="btn ghost" disabled={busy} onClick={skip}>{t('learn.reflect.skip')}</button></div>
    </>}
  </section>;
}

function MemoryArchive({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const [index, setIndex] = useState(-1);
  const cards = t('learn.archive.cards', { returnObjects: true }) as unknown as { title: string; body: string }[];
  const leafStage = index === cards.length;
  return <section className={`panel brief memory-archive${leafStage ? ' leaf-stage' : ''}`}>
    <p className="eyebrow">{t('learn.archive.kicker')}</p><h1>{t(index < 0 ? 'learn.archive.title' : leafStage ? 'learn.archive.finish' : `learn.archive.cards.${index}.title`)}</h1>
    <p className="lede">{t(index < 0 ? 'learn.archive.intro' : leafStage ? 'learn.archive.disclaimer' : `learn.archive.cards.${index}.body`)}</p>
    <p className="small-note">{t('learn.archive.source')}</p>
    <button type="button" className="btn primary" onClick={() => index < cards.length ? setIndex(index + 1) : onDone()}>{t(index >= cards.length ? 'learn.archive.finish' : 'learn.archive.next')}</button>
  </section>;
}

const PROBES: ProbeId[] = ['voyager1', 'voyager2', 'pioneer10', 'new_horizons'];
const ONE_LIGHT_DAY_MS = Date.parse('2026-11-18T10:16:00Z');

export function SignalBoard({ onDone }: { onDone?: () => void }) {
  const { t, i18n } = useTranslation();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const days = Math.ceil((ONE_LIGHT_DAY_MS - now.getTime()) / 86400000);
  return (
    <section className="panel signal">
      <h1>{t('signal.heading')}</h1>
      <p className="lede">{t('signal.intro')}</p>
      <div className="signal-grid">
        {PROBES.map((p) => {
          const au = distanceAU(p, now);
          const silent = p === 'pioneer10';
          return (
            <article key={p} className={silent ? 'silent' : ''}>
              <h2>{t(`hardware:${p}.name`)}</h2>
              <p className="big-number">{(au * 149.5978707).toLocaleString(i18n.language, { maximumFractionDigits: 1, minimumFractionDigits: 1 })}<small> {t('signal.billionKm')}</small></p>
              <p>{silent ? t('signal.lost') : `${t('signal.light')}: ${t('signal.lightValue', { h: lightHours(au).toFixed(2) })}`}</p>
              {p === 'voyager1' && <p className="milestone">{days > 0 ? t('signal.countdown', { d: days }) : t('signal.reached')}</p>}
            </article>
          );
        })}
      </div>
      {onDone && <button type="button" className="btn primary" onClick={onDone}>{t('signal.continue')}</button>}
    </section>
  );
}

function ChapterDone({ chapter }: { chapter: ChapterData }) {
  const { t } = useTranslation();
  const stars = useGame((s) => s.stars);
  const next = nextChapterInArc(chapter);
  const missions = chapter.beats.filter((b) => b.kind === 'mission');
  const earned = missions.reduce((sum, b) => sum + (b.kind === 'mission' ? (stars[b.id] ?? 0) : 0), 0);
  useEffect(() => play('win'), []);
  return (
    <section className="panel brief">
      <p className="eyebrow ok">{next ? t('complete.heading') : t('complete.finale')}</p>
      <h1>{t(`story:${chapter.id}.title`)}</h1>
      {missions.length > 0 && <p className="stars">{t('complete.stars', { n: earned, max: missions.length * 3 })}</p>}
      {!next && <p className="lede">{t('complete.finaleSub')}</p>}
      <div className="row">
        {next && <Link className="btn primary" to={`/chapter/${next.id}`}>{t('complete.next')}</Link>}
        <Link className={`btn ${next ? 'ghost' : 'primary'}`} to={next ? '/map' : '/lab'}>{next ? t('complete.map') : t('nav.lab')}</Link>
      </div>
    </section>
  );
}

export function Chapter() {
  const { id = '' } = useParams();
  const { t } = useTranslation();
  const chapter = chapterById[id];
  const saved = useGame((s) => s.beat[id] ?? 0);
  const setBeat = useGame((s) => s.setBeat);
  const completeChapter = useGame((s) => s.completeChapter);
  const sections = useMemo(() => getStorySections(id), [id]);
  const [index, setIndex] = useState(saved);
  const activeChapterId = useRef(id);
  const [finished, setFinished] = useState(false);
  const [heldMission, setHeldMission] = useState<number | null>(null);
  const fade = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIndex(useGame.getState().beat[id] ?? 0);
    setFinished(false);
    setHeldMission(null);
    activeChapterId.current = id;
    return () => useChatCue.getState().dismissFail();
  }, [id]);

  useEffect(() => {
    if (heldMission === null) return;
    const blockChute = (event: KeyboardEvent) => {
      if (event.code === 'KeyP') event.stopImmediatePropagation();
    };
    window.addEventListener('keydown', blockChute, true);
    return () => window.removeEventListener('keydown', blockChute, true);
  }, [heldMission]);

  const activeIndex = activeChapterId.current === id ? index : saved;
  const beat = chapter?.beats[Math.min(activeIndex, chapter.beats.length - 1)];

  useGSAP(
    () => {
      if (heldMission !== null) return;
      gsap.matchMedia().add('(prefers-reduced-motion: no-preference)', () => {
        gsap.from(fade.current, { autoAlpha: 0, duration: 0.45, ease: 'power1.out' });
      });
    },
    { dependencies: [activeIndex, id, finished], revertOnUpdate: true },
  );

  const pips = useMemo(() => chapter?.beats.map((_, i) => i) ?? [], [chapter]);
  if (!chapter || !beat) return <main className="page"><h1>{t('common.notFound')}</h1><Link className="btn primary" to="/map">{t('common.backToMap')}</Link></main>;

  const next = () => {
    setHeldMission(null);
    if (activeIndex + 1 >= chapter.beats.length) {
      completeChapter(chapter.id);
      setFinished(true);
    } else {
      setBeat(chapter.id, activeIndex + 1);
      setIndex(activeIndex + 1);
    }
  };

  const mission = heldMission !== null ? chapter.beats[heldMission] : beat.kind === 'mission' ? beat : null;
  const preserveMission = mission?.kind === 'mission' && (heldMission !== null || chapter.beats[activeIndex + 1]?.kind === 'dialogue');
  const missionSucceeded = preserveMission ? () => {
    setHeldMission(activeIndex);
    setBeat(chapter.id, activeIndex + 1);
    setIndex(activeIndex + 1);
  } : undefined;
  const tint = `tint-${chapter.world}`;
  return (
    <main className={`chapter ${tint}`}>
      <div className="chapter-bar">
        <Link to="/map" className="exit">← {t('nav.map')}</Link>
        <span className="chapter-name">{chapter.era} · {t(`story:${chapter.id}.title`)}</span>
        <div className="pips" aria-hidden="true">{pips.map((p) => <i key={p} className={p < activeIndex || finished ? 'on' : p === activeIndex ? 'next' : ''} />)}</div>
      </div>
      <div className="chapter-body" ref={fade}>
        {mission?.kind === 'mission' && !finished && <MissionShell key={`${id}-${mission.id}`} beat={mission} onDone={next} onSuccess={missionSucceeded} />}
        <div key={`${id}-${activeIndex}-${finished}`} className={heldMission !== null && beat.kind === 'dialogue' ? 'mission-dialogue' : undefined}>
        {finished ? <ChapterDone chapter={chapter} /> : (
          <>
            {beat.kind === 'dialogue' && <Dialogue chapter={chapter} beat={beat} sections={sections} onDone={next} inPlace={heldMission !== null} />}
            {beat.kind === 'memory' && <Memory id={beat.hardware} onDone={next} />}
            {(beat.kind === 'quiz' || beat.kind === 'apply' || beat.kind === 'precheck' || beat.kind === 'postcheck') && <Quiz beat={beat} onDone={next} />}
            {beat.kind === 'reflect' && <Reflection beat={beat} onDone={next} />}
            {beat.kind === 'archive' && <MemoryArchive onDone={next} />}
            {beat.kind === 'signal' && <SignalBoard onDone={next} />}
          </>
        )}
        </div>
      </div>
    </main>
  );
}
