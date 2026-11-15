import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const WATERCOLOR_URL = '/moon-stories-watercolor/index.html';

/**
 * One "Story" tab that offers both ways to see the story.
 * The top bar's nav scrolls sideways, which would clip a normal dropdown,
 * so the menu is placed with fixed coordinates under the button.
 */
export function StoryMenu() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<CSSProperties>({});
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const toggle = () => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) setPosition({ top: rect.bottom + 8, left: Math.max(16, Math.min(rect.left, window.innerWidth - 316)) });
    setOpen((value) => !value);
  };

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return undefined;
    menuRef.current?.querySelector<HTMLElement>('a')?.focus();
    const close = (event: Event) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    const onScroll = () => setOpen(false);
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onScroll);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onScroll);
      window.removeEventListener('scroll', onScroll);
    };
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={`story-tab${pathname === '/story' ? ' active' : ''}`}
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={toggle}
      >
        {t('nav.story')} <span aria-hidden="true">▾</span>
      </button>
      {open && (
        <div ref={menuRef} id={menuId} className="story-menu" style={position} role="group" aria-label={t('nav.storyMenu')}>
          <Link to="/story" className="story-menu__item" onClick={() => setOpen(false)}>
            <strong>{t('nav.storyVideo')}</strong>
            <small>{t('nav.storyVideoNote')}</small>
          </Link>
          <a href={WATERCOLOR_URL} className="story-menu__item">
            <strong>{t('nav.storyWatercolor')}</strong>
            <small>{t('nav.storyWatercolorNote')}</small>
          </a>
        </div>
      )}
    </>
  );
}
