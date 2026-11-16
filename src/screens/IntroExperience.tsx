import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { lazy } from 'react';
import { mediaUrl } from '../media';
import { INTRO_SCENES, useGame } from '../state/store';
import { activeIntroVideo } from './introMedia';
import { StoryControls, useStoryMusic } from '../components/StoryControls';
import { useDismissibleDialog } from '../components/useDismissibleDialog';

const Title = lazy(() => import('./Title').then((m) => ({ default: m.Title })));

const authoredScenes = [
  { number: '01', title: 'SCENE 1. OPENING', video: mediaUrl('intro/Video/1.mp4'), text: `In The Moon. Dark. A tiny sound.\n\nNARRATOR: Every night, Uncle Cuội sits under his banyan tree. Everyone knows two things about him: he loves telling stories, and he appears every full moon.\n\nOn the night of the Mid-Autumn Festival, the Moon shone brighter than ever.\n\nBeneath his ancient Banyan Tree, Uncle Cuội was telling the Moon Rabbit an old story.\n\nSuddenly, a tiny sound broke the silence.\n\nMOON RABBIT: Uncle! What’s that sound?\n\nUNCLE CUỘI: (whispering) Tick... tick... Rabbit, I think something is alive out there.\n\nMOON RABBIT: Is this another one of your tall tales?\n\nUNCLE CUỘI: Not this time. Come on!` },
  { number: '02', title: 'SCENE 2. THE LITTLE ONE IN THE DUST', video: mediaUrl('intro/Video/2.mp4'), text: `Sea of Tranquillity. A small metal package sits half-buried in grey dust.\n\nNARRATOR: In 1969, two astronauts walked here: Neil Armstrong and Buzz Aldrin. A third, Michael, waited in orbit. Before they left, they set down a small package of instruments.\n\nROVER: Hello? Are you... real?\n\nMOON RABBIT: (jumping back) It talks!\n\nROVER: I’m ROVER. I had a job. I had an ear for listening to the Moon shake, and a little mirror. And then everyone left. Did they forget me?\n\nUNCLE CUỘI: Why would they leave you?\n\nNARRATOR: The astronauts collected Moon rocks and deployed scientific instruments designed to remain on the lunar surface, sending their discoveries back to Earth.` },
  { number: '03', title: 'SCENE 3. THE ROVER THAT WENT QUIET', video: mediaUrl('intro/Video/3.mp4'), text: `Under the banyan tree. The roots glow softly.\n\nBANYAN TREE: Tell me, ROVER. What did your ear hear?\n\nROVER:\n\n“I listened for moonquakes and space rocks hitting the Moon. I worked for about three weeks. Then, one day, my signals stopped.”\n\nMOON RABBIT:\n\n“Only three weeks? Was that all?”\n\nBANYAN TREE:\n\n“Three weeks was enough to begin something extraordinary. Your discoveries helped scientists build better instruments for future missions.”\n\n(Pause. ROVER’s light flickers.)\n\nROVER: But now everything is silent. Nobody calls, nobody answers. I think I’ve been forgotten.` },
  { number: '04', title: 'SCENE 4. THE COLDEST NIGHT (climax)', video: mediaUrl('intro/Video/4.mp4'), text: `The Moon’s long night. Stars are sharp. Cuội and Rabbit huddle by ROVER.\n\nMOON RABBIT: (softly) ROVER... is the mirror still working?\n\nROVER: It’s just glass. It has no battery and no wires. It can’t call anyone. It can only wait.\n\nUNCLE CUỘI: (quietly, for the first time without a joke) I know that feeling. I tell the truth and nobody believes me. Maybe we’re all just waiting.\n\nSilence. ROVER’s light dims almost to nothing.` },
  { number: '05', title: 'SCENE 5. THE TWIST: A THIN LINE OF LIGHT', video: mediaUrl('intro/Video/5.mp4'), text: `A faint green beam streaks up from Earth and strikes ROVER’s mirror. It flashes back.\n\nMOON RABBIT:\n\n“Look! A light from Earth!”\n\nBANYAN TREE:\n\n"That's a laser! Scientists are sending light toward your little mirror."\n\nROVER:\n\n"My mirror? After all these years?"\n\nBANYAN TREE:\n\n"Yes! It reflects the light to Earth, helping scientists measure the distance to the Moon."\n\nROVER:\n\n"So... I'm still helping them discover something?"\n\nBANYAN TREE:\n\n"Of course. You were never forgotten, little one."\n\nROVER:\n\n"Then my story isn't over!"` },
  { number: '06', title: 'SCENE 6. FIND YOU', video: mediaUrl('intro/Video/6.mp4'), text: `BANYAN TREE: "Look, little one. Your discoveries have reached further than you can imagine."\n\nThe golden leaf reveals a child in Vietnam drawing a picture of the Moon.\n\nEASEP: "Someone is dreaming about exploring the Moon?"\n\nUNCLE CUỘI: "Yes. And perhaps one day, that child will discover something we have never imagined."\n\nMOON RABBIT: "Maybe the next great explorer is right there!"\n\nThe child slowly turns toward the audience.\n\nCHILD: "Maybe that explorer could be me..."\n\n(Pause)\n\n"Or maybe... YOU!"\n\nNARRATOR: "Every great discovery begins with a curious mind. And every dream begins with someone who dares to imagine."\n\nALL CHARACTERS:\n\n"FIND U IN THE YOUNIVERSE!"` },
  { number: '07', title: 'CLOSING SCENE', video: mediaUrl('intro/Video/7.mp4'), text: `Your roots remind you where you come from. Your dreams decide how far you can go.` },
];

// The 22 visuals are beats inside the seven authored scenes, not new story scenes.
const videoFiles = Array.from({ length: INTRO_SCENES }, (_, index) => mediaUrl(`intro/Video/${index + 1}.mp4`));
const beatsPerScene = [3, 3, 3, 3, 4, 4, 2];
const scenes = videoFiles.flatMap((video, videoIndex) => {
  let offset = 0;
  const authoredIndex = beatsPerScene.findIndex((count) => {
    const inScene = videoIndex >= offset && videoIndex < offset + count;
    offset += count;
    return inScene;
  });
  const scene = authoredScenes[authoredIndex];
  const sceneStart = beatsPerScene.slice(0, authoredIndex).reduce((sum, count) => sum + count, 0);
  const beatIndex = videoIndex - sceneStart;
  const paragraphs = scene.text.split(/\n\s*\n/);
  const start = Math.floor((beatIndex * paragraphs.length) / beatsPerScene[authoredIndex]);
  const end = Math.floor(((beatIndex + 1) * paragraphs.length) / beatsPerScene[authoredIndex]);
  return [{ number: String(videoIndex + 1).padStart(2, '0'), title: scene.title, video, text: paragraphs.slice(start, end).join('\n\n') }];
});

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
  if (!started) return <main className="intro-gate" style={{ backgroundImage: `url("${mediaUrl('intro/Image/8.jpg')}")` }}><div className="intro-gate__glow" /><p className="intro-kicker">A story of NASA’s forgotten machines</p><h1>FIND U<br /><em>IN THE YOUNIVERSE</em></h1><button className="btn primary big intro-start" type="button" onClick={() => setIntroductionOpen(true)}>Choose how to read <span aria-hidden="true">↓</span></button><p className="intro-quote">“Old roots hold tight; new dreams take flight”</p><p className="intro-gate__copy">A Vietnamese-inspired journey through NASA's forgotten machines, scientific discoveries, and the dreams of tomorrow's explorers.</p><dialog className="legend-modal" aria-labelledby="legend-title" {...introductionDialog}><button className="legend-modal__close" type="button" onClick={() => setIntroductionOpen(false)} aria-label="Close introduction">×</button><p className="intro-kicker">Before the moon story begins</p><h2 id="legend-title">The Legend of Cuội on the Moon</h2><div className="legend-modal__rule" /><p>Once upon a time, there was a woodcutter named Cuội. One day, while walking through the forest, he suddenly encountered a tiger cub charging towards him. With no time to escape, he bravely raised his axe and fought the tiger. Since the tiger cub was still young and weaker than a human, Cuội struck it with his axe, and it fell to the ground.</p><p>Just then, the mother tiger returned. Cuội quickly threw down his axe and climbed up a nearby tree. From above, he saw the mother tiger run to a bush nearby, pick some leaves, and chew them before feeding them to her cub. After a short while, the tiger cub began to move, wagged its tail, and miraculously came back to life.</p><p>After the mother tiger had carried her cub away, Cuội went to the bush, dug up the plant by its roots, and took it home.</p><p className="legend-modal__hint">A Vietnamese legend about memory, wonder, and the roots that reach all the way to the Moon.</p><div className="intro-reading-options"><Link className="btn primary big" to="/story?mode=lantern">{t('storyModes.lantern.name')} <span aria-hidden="true">→</span></Link><Link className="btn ghost big" to="/story?mode=watercolor">{t('storyModes.watercolor.name')} <span aria-hidden="true">→</span></Link></div></dialog></main>;

  return <main className="intro-scrollbook" ref={readerRef} tabIndex={-1} aria-label={t('storyModes.lantern.name')}>
    <div className="intro-fixed-scene" aria-hidden="true">
      <video key={activeScene} className="is-active" src={activeIntroVideo(scenes, activeScene)} autoPlay muted loop playsInline preload="none" />
      <div className="intro-fixed-scene__wash" />
    </div>
    <header className="intro-sample-header"><span>FIND U IN THE YOUNIVERSE</span><span>{String(activeScene + 1).padStart(2, '0')} / 22</span><StoryControls musicAvailable={music.available} musicEnabled={music.enabled} onToggleMusic={music.toggle} onExit={exit} showModeSwitch={directStart} /></header>
    <nav className="intro-filmstrip" aria-label="Story scenes">{scenes.map((scene, index) => <a href={`#story-${scene.number}`} onClick={(event) => jumpToScene(event, scene.number)} className={index === activeScene ? 'is-active' : ''} key={scene.number} aria-label={`Jump to story image ${scene.number}`}><img src={mediaUrl(`intro/Image/${index + 1}.jpg`)} alt="" loading="lazy" decoding="async" /><span>{scene.number}</span></a>)}</nav>
    <div className="intro-scrollbook__steps">
      {scenes.map((scene, index) => <section className="intro-step" id={`story-${scene.number}`} data-scene={index} key={scene.number}>
        <article className="intro-dialogue">
          <p className="intro-scene__number">{scene.number} / 22</p><h2>{scene.title}</h2>
          {scene.text && <div className="intro-scene__text">{scene.text.split('\n').map((line, lineIndex) => <p key={`${scene.number}-${lineIndex}`}>{line || ' '}</p>)}</div>}
          {index === scenes.length - 1 && <button className="btn primary big" type="button" onClick={finish}>Keep exploring <span aria-hidden="true">→</span></button>}
        </article>
      </section>)}
    </div>
  </main>;
}
