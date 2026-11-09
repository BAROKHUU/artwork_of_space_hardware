import { useEffect, useMemo, useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { chapterById, chapters, hardwareById, photoUrl } from '../data';
import type { Beat, Chapter as ChapterData, Hardware, World } from '../data/types';
import { useGame } from '../state/store';
import { MissionShell } from '../missions/MissionShell';
import { GameCanvas } from '../three/GameCanvas';
import { Diorama } from '../three/Scenery';
import { Facts, FateBadge, Photo } from '../components/HardwareInfo';
import { distanceAU, lightHours, type ProbeId } from '../sim/ephemeris';
import { play } from '../audio/sfx';

gsap.registerPlugin(useGSAP);

function Backdrop({ world, focus }: { world: World; focus: Hardware | null }) {
  const fallback = focus ? <img className="backdrop-photo" src={photoUrl(focus.photo)} alt="" /> : <div className="backdrop-plain" />;
  return (
    <div className="backdrop">
      <GameCanvas camera={{ position: [8, 3, 8], fov: 45, far: 500 }} fallback={fallback}>
        <Diorama world={world} model={focus?.model ?? null} />
      </GameCanvas>
    </div>
  );
}

interface Line {
  who: 'echo' | 'control';
  text: string;
}

function Dialogue({ chapter, beat, onDone }: { chapter: ChapterData; beat: Extract<Beat, { kind: 'dialogue' }>; onDone: () => void }) {
  const { t } = useTranslation();
  const lines = t(`story:${chapter.id}.${beat.key}`, { returnObjects: true }) as unknown as Line[];
  const [i, setI] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const focus = beat.focus === 'echo' ? null : hardwareById[beat.focus];
  const world = focus?.world ?? chapter.world;

  useGSAP(
    () => {
      gsap.matchMedia().add('(prefers-reduced-motion: no-preference)', () => {
        gsap.from('.line-text', { y: 10, autoAlpha: 0, duration: 0.35, ease: 'power2.out' });
      });
    },
    { scope: box, dependencies: [i], revertOnUpdate: true },
  );

  const advance = () => {
    play('blip');
    if (i + 1 >= lines.length) onDone();
    else setI(i + 1);
  };

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        advance();
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });

  const line = lines[i];
  return (
    <div className="scene">
      <Backdrop world={world} focus={focus} />
      <div className={`dialogue who-${line.who}`} ref={box}>
        <p className="speaker">{t(`story:speakers.${line.who}`)}</p>
        <p className="line-text" aria-live="polite">{line.text}</p>
        <div className="row end">
          <button type="button" className="btn ghost" onClick={onDone}>{t('dialogue.skip')}</button>
          {i > 0 && <button type="button" className="btn ghost" onClick={() => setI(i - 1)}>{t('dialogue.back')}</button>}
          <button type="button" className="btn primary" onClick={advance}>{t('dialogue.next')}</button>
        </div>
      </div>
    </div>
  );
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
  const { t } = useTranslation();
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
              <p className="big-number">{(au * 149.5978707).toLocaleString(undefined, { maximumFractionDigits: 1, minimumFractionDigits: 1 })}<small> billion km</small></p>
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
  const [index, setIndex] = useState(saved);
  const [finished, setFinished] = useState(false);
  const fade = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIndex(useGame.getState().beat[id] ?? 0);
    setFinished(false);
  }, [id]);

  const beat = chapter?.beats[Math.min(index, chapter.beats.length - 1)];

  useGSAP(
    () => {
      gsap.matchMedia().add('(prefers-reduced-motion: no-preference)', () => {
        gsap.from(fade.current, { autoAlpha: 0, duration: 0.45, ease: 'power1.out' });
      });
    },
    { dependencies: [index, id, finished], revertOnUpdate: true },
  );

  const pips = useMemo(() => chapter?.beats.map((_, i) => i) ?? [], [chapter]);
  if (!chapter || !beat) return <main className="page"><h1>{t('common.notFound')}</h1><Link className="btn primary" to="/map">{t('common.backToMap')}</Link></main>;

  const next = () => {
    if (index + 1 >= chapter.beats.length) {
      completeChapter(chapter.id);
      setFinished(true);
    } else {
      setBeat(chapter.id, index + 1);
      setIndex(index + 1);
    }
  };

  const tint = `tint-${chapter.world}`;
  return (
    <main className={`chapter ${tint}`}>
      <div className="chapter-bar">
        <Link to="/map" className="exit">← {t('nav.map')}</Link>
        <span className="chapter-name">{chapter.era} · {t(`story:${chapter.id}.title`)}</span>
        <div className="pips" aria-hidden="true">{pips.map((p) => <i key={p} className={p < index || finished ? 'on' : p === index ? 'next' : ''} />)}</div>
      </div>
      <div className="chapter-body" ref={fade} key={`${id}-${index}-${finished}`}>
        {finished ? <ChapterDone chapter={chapter} /> : (
          <>
            {beat.kind === 'dialogue' && <Dialogue chapter={chapter} beat={beat} onDone={next} />}
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
