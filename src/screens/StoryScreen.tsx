import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { IntroExperience } from './IntroExperience';
import { StoryControls, useStoryMusic } from '../components/StoryControls';
import { MoonRover } from '../components/MoonRover';
import { imageBase, mediaUrl } from '../media';
import { STORY_MODES, storyModeFrom, type StoryMode } from './storyModes';

// The book is a static page, so it learns where its images live from `?media=` (absent: its own folder).
const WATERCOLOR_MEDIA = imageBase('moon-stories-watercolor');
const WATERCOLOR_URL = `${import.meta.env.BASE_URL}moon-stories-watercolor/index.html${WATERCOLOR_MEDIA ? `?media=${encodeURIComponent(WATERCOLOR_MEDIA)}` : ''}`;
/** Scene 21 of the painted story: Cuội, ROVER and Moon Rabbit under the glowing banyan, Earth rising. */
const PICKER_BACKGROUND = mediaUrl('moon-stories-watercolor/assets/images/21.jpg');
const covers: Record<StoryMode, string> = {
  watercolor: mediaUrl('moon-stories-watercolor/assets/images/22.jpg'),
  lantern: mediaUrl('intro/images/8.jpg'),
};

function ModePicker() {
  const { t } = useTranslation();
  return (
    <main className="page story-modes">
      <div className="story-modes__bg" style={{ backgroundImage: `url("${PICKER_BACKGROUND}")` }} aria-hidden="true" />
      <header className="page-head">
        <p className="eyebrow">{t('storyModes.kicker')}</p>
        <h1>{t('storyModes.title')}</h1>
        <p>{t('storyModes.sub')}</p>
      </header>
      <div className="story-modes__grid">
        {STORY_MODES.map((mode) => (
          <Link key={mode} to={`/story?mode=${mode}`} className="story-mode-card">
            <img src={covers[mode]} alt="" loading="lazy" />
            <span className="story-mode-card__body">
              <span className="story-mode-card__tag">{t(`storyModes.${mode}.tag`)}</span>
              <strong>{t(`storyModes.${mode}.name`)}</strong>
              <span>{t(`storyModes.${mode}.desc`)}</span>
              <span className="story-mode-card__go">{t('storyModes.start')} <span aria-hidden="true">→</span></span>
            </span>
          </Link>
        ))}
      </div>
    </main>
  );
}

/**
 * The watercolor book is a separate static page (no build step), so it runs in a full-screen frame.
 * The controls sit on top in the same place as in the Lantern Show; its "Keep exploring" link leaves the frame.
 */
function WatercolorMode() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const music = useStoryMusic(true);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [atEnd, setAtEnd] = useState(false);

  // The book tells us when its ending is on screen, so ROVER can roll in.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== frameRef.current?.contentWindow) return;
      const data = event.data as { type?: unknown; atEnd?: unknown } | null;
      if (data?.type === 'echo:story-end' && typeof data.atEnd === 'boolean') setAtEnd(data.atEnd);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  return (
    <main className="story-watercolor">
      <iframe ref={frameRef} src={WATERCOLOR_URL} title={t('storyModes.watercolor.name')} />
      <MoonRover visible={atEnd} mode="watercolor" />
      <header className="intro-sample-header story-watercolor__header">
        <StoryControls musicAvailable={music.available} musicEnabled={music.enabled} onToggleMusic={music.toggle} onExit={() => navigate('/home')} />
      </header>
    </main>
  );
}

export function StoryScreen() {
  const [params] = useSearchParams();
  const mode = storyModeFrom(params.get('mode'));
  if (mode === 'watercolor') return <WatercolorMode />;
  if (mode === 'lantern') return <IntroExperience key="replay" directStart />;
  return <ModePicker />;
}
