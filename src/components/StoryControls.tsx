import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { mediaUrl } from '../media';
import { useGame } from '../state/store';

/** Background music sits well under narration; the Settings volume scales it. */
const MUSIC_LEVEL = 0.34;

/**
 * Reading music shared by both story modes. It plays while `active`, follows the Settings volume,
 * and switches itself off if the browser blocks autoplay so the button shows the true state.
 */
export function useStoryMusic(active: boolean) {
  const volume = useGame((s) => s.volume);
  const [enabled, setEnabled] = useState(true);
  const [available, setAvailable] = useState(true);
  const musicRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!active) return undefined;
    const music = new Audio(mediaUrl('intro/reading-music.mp3'));
    music.loop = true;
    music.preload = 'auto';
    musicRef.current = music;
    setAvailable(true);
    const onError = () => { setAvailable(false); setEnabled(false); };
    music.addEventListener('error', onError);
    return () => {
      music.removeEventListener('error', onError);
      music.pause();
      music.src = '';
      musicRef.current = null;
    };
  }, [active]);

  useEffect(() => {
    if (musicRef.current) musicRef.current.volume = MUSIC_LEVEL * volume;
  }, [active, volume]);

  useEffect(() => {
    const music = musicRef.current;
    if (!music) return;
    if (enabled) void music.play().catch(() => setEnabled(false));
    else music.pause();
  }, [active, enabled]);

  const toggle = useCallback(() => setEnabled((value) => !value), []);
  return { enabled, available, toggle };
}

/** The top-right controls shared by every story mode: music, change mode, and exit. */
export function StoryControls({ musicAvailable = true, musicEnabled, onToggleMusic, onExit, showModeSwitch = true }: {
  musicAvailable?: boolean;
  musicEnabled: boolean;
  onToggleMusic: () => void;
  onExit: () => void;
  showModeSwitch?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="story-controls">
      {musicAvailable && <button className={`story-control story-control--icon${musicEnabled ? '' : ' is-off'}`} type="button" onClick={onToggleMusic} aria-pressed={musicEnabled} aria-label={t(musicEnabled ? 'storyModes.musicOff' : 'storyModes.musicOn')} title={t(musicEnabled ? 'storyModes.musicOff' : 'storyModes.musicOn')}>
        <span aria-hidden="true">♫</span>
      </button>}
      {showModeSwitch && (
        <Link className="story-control" to="/story" aria-label={t('storyModes.switch')}>
          <span aria-hidden="true">⇄</span><span className="story-control__text">{t('storyModes.switch')}</span>
        </Link>
      )}
      <button className="story-control story-control--primary" type="button" onClick={onExit} aria-label={t('introStory.exit')}>
        <span className="story-control__text">{t('introStory.exit')}</span><span aria-hidden="true">✕</span>
      </button>
    </div>
  );
}
