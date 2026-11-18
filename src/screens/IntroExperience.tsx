import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { lazy } from 'react';
import { mediaUrl } from '../media';
import { INTRO_SCENES, useGame } from '../state/store';
import { activeIntroVideo } from './introMedia';
import { StoryControls, useStoryMusic } from '../components/StoryControls';
import { useDismissibleDialog } from '../components/useDismissibleDialog';
import { MoonRover } from '../components/MoonRover';

const Title = lazy(() => import('./Title').then((m) => ({ default: m.Title })));

const VIDEO_FILES = Array.from({ length: INTRO_SCENES }, (_, index) => mediaUrl(`intro/videos/${index + 1}.mp4`));
const BEATS_PER_SCENE = [3, 3, 3, 3, 4, 4, 2];

interface AuthoredScene {
  title: string;
  text: string;
}

export function IntroExperience({ directStart = false }: { directStart?: boolean }) {
  const savedIntro = useGame((s) => s.intro);
  const setIntroScene = useGame((s) => s.setIntroScene);
  const finishIntro = useGame((s) => s.finishIntro);
  // Resume unfinished reading; completed readers can replay without losing saved progress.
  const [resumeScene] = useState(() => (directStart && savedIntro.finished ? 0 : savedIntro.scene));
  const started = directStart;
  const [introductionOpen, setIntroductionOpen] = useState(false);
  const introductionDialog = useDismissibleDialog(introductionOpen, () => setIntroductionOpen(false));
  const [activeScene, setActiveScene] = useState(resumeScene);
  // Someone who has already read the story lands on the title screen instead of the story again.
  const finished = !directStart && savedIntro.finished;
  const { t } = useTranslation();
  const navigate = useNavigate();

  const scenes = useMemo(() => {
    const raw = t('introStory.scenes', { returnObjects: true }) as unknown as AuthoredScene[];
    const authored = Array.isArray(raw) ? raw : [];
    return VIDEO_FILES.flatMap((video, videoIndex) => {
      let offset = 0;
      const authoredIndex = BEATS_PER_SCENE.findIndex((count) => {
        const inScene = videoIndex >= offset && videoIndex < offset + count;
        offset += count;
        return inScene;
      });
      const scene = authored[authoredIndex] ?? { title: '', text: '' };
      const sceneStart = BEATS_PER_SCENE.slice(0, authoredIndex).reduce((sum, count) => sum + count, 0);
      const beatIndex = videoIndex - sceneStart;
      const paragraphs = scene.text.split(/\n\s*\n/);
      const start = Math.floor((beatIndex * paragraphs.length) / BEATS_PER_SCENE[authoredIndex]);
      const end = Math.floor(((beatIndex + 1) * paragraphs.length) / BEATS_PER_SCENE[authoredIndex]);
      return [{ number: String(videoIndex + 1).padStart(2, '0'), title: scene.title, video, text: paragraphs.slice(start, end).join('\n\n') }];
    });
  }, [t]);
  const finish = () => {
    finishIntro();
    navigate('/home');
  };
  const exit = () => navigate('/story');
  const music = useStoryMusic(started && !finished);
  const readerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!started) return;
    readerRef.current?.focus({ preventScroll: true });
    if (resumeScene === 0) return;
    const frame = requestAnimationFrame(() => {
      document.getElementById(`story-${scenes[resumeScene].number}`)?.scrollIntoView({ block: 'center' });
    });
    return () => cancelAnimationFrame(frame);
  }, [started, resumeScene]);

  useEffect(() => {
    if (started && !finished && !savedIntro.finished) setIntroScene(Math.max(savedIntro.scene, activeScene));
  }, [started, finished, activeScene, savedIntro.scene, savedIntro.finished, setIntroScene]);

  useEffect(() => {
    if (!started) return undefined;
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) setActiveScene(Number((visible.target as HTMLElement).dataset.scene ?? 0));
    }, { threshold: [0.25, 0.5, 0.75], rootMargin: '-12% 0px -12% 0px' });
    document.querySelectorAll<HTMLElement>('[data-scene]').forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [started]);

  useEffect(() => {
    const activeThumb = document.querySelector<HTMLElement>(`.intro-filmstrip a:nth-child(${activeScene + 1})`);
    activeThumb?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [activeScene]);

  const jumpToScene = (event: React.MouseEvent<HTMLAnchorElement>, sceneNumber: string) => {
    event.preventDefault();
    document.getElementById(`story-${sceneNumber}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  if (finished) return <Title />;
  if (!started) return <main className="intro-gate" style={{ backgroundImage: `url("${mediaUrl('intro/images/8.jpg')}")` }}><div className="intro-gate__glow" /><p className="intro-kicker">{t('introStory.kicker')}</p><h1>FIND U<br /><em>{t('introStory.heroEm')}</em></h1><button className="btn primary big intro-start" type="button" onClick={() => setIntroductionOpen(true)}>{t('introStory.chooseHow')} <span aria-hidden="true">↓</span></button><p className="intro-quote">{t('introStory.quote')}</p><p className="intro-gate__copy">{t('introStory.copy')}</p><dialog className="legend-modal" aria-labelledby="legend-title" {...introductionDialog}><button className="legend-modal__close" type="button" onClick={() => setIntroductionOpen(false)} aria-label={t('introStory.closeModal')}>×</button><p className="intro-kicker">{t('introStory.legendKicker')}</p><h2 id="legend-title">{t('introStory.legendTitle')}</h2><div className="legend-modal__rule" /><p>{t('introStory.legendP1')}</p><p>{t('introStory.legendP2')}</p><p>{t('introStory.legendP3')}</p><p className="legend-modal__hint">{t('introStory.legendHint')}</p><div className="intro-reading-options"><Link className="btn primary big" to="/story?mode=lantern">{t('storyModes.lantern.name')} <span aria-hidden="true">→</span></Link><Link className="btn ghost big" to="/story?mode=watercolor">{t('storyModes.watercolor.name')} <span aria-hidden="true">→</span></Link></div></dialog></main>;

  return <main className="intro-scrollbook" ref={readerRef} tabIndex={-1} aria-label={t('storyModes.lantern.name')}>
    <div className="intro-fixed-scene" aria-hidden="true">
      <video key={activeScene} className="is-active" src={activeIntroVideo(scenes, activeScene)} autoPlay muted loop playsInline preload="none" />
      <div className="intro-fixed-scene__wash" />
    </div>
    <header className="intro-sample-header"><span>FIND U IN THE YOUNIVERSE</span><span>{String(activeScene + 1).padStart(2, '0')} / 22</span><StoryControls musicAvailable={music.available} musicEnabled={music.enabled} onToggleMusic={music.toggle} onExit={exit} showModeSwitch={directStart} /></header>
    <nav className="intro-filmstrip" aria-label="Story scenes">{scenes.map((scene, index) => <a href={`#story-${scene.number}`} onClick={(event) => jumpToScene(event, scene.number)} className={index === activeScene ? 'is-active' : ''} key={scene.number} aria-label={`Jump to story image ${scene.number}`}><img src={mediaUrl(`intro/images/${index + 1}.jpg`)} alt="" loading="lazy" decoding="async" /><span>{scene.number}</span></a>)}</nav>
    <div className="intro-scrollbook__steps">
      {scenes.map((scene, index) => <section className="intro-step" id={`story-${scene.number}`} data-scene={index} key={scene.number}>
        <article className="intro-dialogue">
          <p className="intro-scene__number">{scene.number} / 22</p><h2>{scene.title}</h2>
          {scene.text && <div className="intro-scene__text">{scene.text.split('\n').map((line, lineIndex) => <p key={`${scene.number}-${lineIndex}`}>{line || ' '}</p>)}</div>}
          {index === scenes.length - 1 && <button className="btn primary big" type="button" onClick={finish}>{t('introStory.keepExploring')} <span aria-hidden="true">→</span></button>}
        </article>
      </section>)}
    </div>
    <MoonRover visible={activeScene === scenes.length - 1} mode="lantern" />
  </main>;
}
