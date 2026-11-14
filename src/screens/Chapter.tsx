import { useEffect, useMemo, useRef, useState } from 'react';
import { GameplayStory } from '../book/GameplayStory';
import { getStorySections } from '../book/content';
import type { StorySection } from '../book/types';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { chapterById, chapters, hardwareById } from '../data';
import type { Beat, Chapter as ChapterData } from '../data/types';
import { useGame } from '../state/store';
import { MissionShell } from '../missions/MissionShell';
import { Facts, FateBadge, Photo } from '../components/HardwareInfo';
import { distanceAU, lightHours, type ProbeId } from '../sim/ephemeris';
import { play } from '../audio/sfx';

gsap.registerPlugin(useGSAP);

function Dialogue({ chapter, beat, sections, onDone }: { chapter: ChapterData; beat: Extract<Beat, { kind: 'dialogue' }>; sections: StorySection[]; onDone: () => void }) {
  const section = sections.find((item) => item.key === beat.key);
  if (!section) return null;
  return <GameplayStory chapter={chapter} section={section} onContinue={onDone} />;
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

function Quiz({ beat, onDone }: { beat: Extract<Beat, { kind: 'quiz' }>; onDone: () => void }) {
  const { t } = useTranslation();
  const items = t(`quiz:${beat.key}`, { returnObjects: true }) as unknown as { q: string; options: string[]; why: string }[];
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const q = items[i];
  const answer = beat.answers[i];
  return (
    <section className="panel brief quiz">
      <p className="eyebrow">{t('quiz.heading')} · {i + 1}/{items.length}</p>
      <h1>{q.q}</h1>
      <div className="options">
        {q.options.map((o, n) => (
          <button type="button" key={n} disabled={picked !== null} className={`option${picked !== null && n === answer ? ' right' : ''}${picked === n && n !== answer ? ' wrong' : ''}`} onClick={() => { setPicked(n); play(n === answer ? 'ping' : 'fail'); }}>{o}</button>
        ))}
      </div>
      {picked !== null && (
        <>
          <p className="lede" role="status"><b>{picked === answer ? t('quiz.correct') : t('quiz.incorrect')}</b> {q.why}</p>
          <button type="button" autoFocus className="btn primary" onClick={() => { if (i + 1 >= items.length) onDone(); else { setI(i + 1); setPicked(null); } }}>
            {i + 1 >= items.length ? t('quiz.finish') : t('quiz.next')}
          </button>
        </>
      )}
    </section>
  );
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
  const index = chapters.indexOf(chapter);
  const next = chapters[index + 1];
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
  const fade = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIndex(useGame.getState().beat[id] ?? 0);
    setFinished(false);
    activeChapterId.current = id;
  }, [id]);

  const activeIndex = activeChapterId.current === id ? index : saved;
  const beat = chapter?.beats[Math.min(activeIndex, chapter.beats.length - 1)];

  useGSAP(
    () => {
      gsap.matchMedia().add('(prefers-reduced-motion: no-preference)', () => {
        gsap.from(fade.current, { autoAlpha: 0, duration: 0.45, ease: 'power1.out' });
      });
    },
    { dependencies: [activeIndex, id, finished], revertOnUpdate: true },
  );

  const pips = useMemo(() => chapter?.beats.map((_, i) => i) ?? [], [chapter]);
  if (!chapter || !beat) return <main className="page"><h1>{t('common.notFound')}</h1><Link className="btn primary" to="/map">{t('common.backToMap')}</Link></main>;

  const next = () => {
    if (activeIndex + 1 >= chapter.beats.length) {
      completeChapter(chapter.id);
      setFinished(true);
    } else {
      setBeat(chapter.id, activeIndex + 1);
      setIndex(activeIndex + 1);
    }
  };

  const tint = `tint-${chapter.world}`;
  return (
    <main className={`chapter ${tint}`}>
      <div className="chapter-bar">
        <Link to="/map" className="exit">← {t('nav.map')}</Link>
        <span className="chapter-name">{chapter.era} · {t(`story:${chapter.id}.title`)}</span>
        <div className="pips" aria-hidden="true">{pips.map((p) => <i key={p} className={p < activeIndex || finished ? 'on' : p === activeIndex ? 'next' : ''} />)}</div>
      </div>
      <div className="chapter-body" ref={fade} key={`${id}-${activeIndex}-${finished}`}>
        {finished ? <ChapterDone chapter={chapter} /> : (
          <>
            {beat.kind === 'dialogue' && <Dialogue chapter={chapter} beat={beat} sections={sections} onDone={next} />}
            {beat.kind === 'memory' && <Memory id={beat.hardware} onDone={next} />}
            {beat.kind === 'mission' && <MissionShell beat={beat} onDone={next} />}
            {beat.kind === 'quiz' && <Quiz beat={beat} onDone={next} />}
            {beat.kind === 'signal' && <SignalBoard onDone={next} />}
          </>
        )}
      </div>
    </main>
  );
}
