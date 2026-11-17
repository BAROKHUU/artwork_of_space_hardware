import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { archiveChapters, hardwareById, moonChapters, photoUrl, textureUrl } from '../data';
import type { Chapter } from '../data/types';
import { play, playClip, preloadClip } from '../audio/sfx';
import { useGame } from '../state/store';
import { prefersReducedMotion } from '../three/GameCanvas';
import { chapterPortalBody, PORTAL_BODY_CONFIG, PortalPlanetCanvas, type PortalBody } from '../three/PortalPlanet';

type TabKey = 'moon' | 'expansions' | 'completed';

const CHAPTER_CARD_PHOTOS: Record<string, string> = {
  ch0: 'apollo15_descent',
  m2: 'moon_boulder.jpg',
  m3: 'moon_tycho.jpg',
  m4: 'apollo11_psep.jpg',
  m5: 'moon_earthrise.jpg',
};

function chapterCardArt(c: Chapter) {
  const custom = CHAPTER_CARD_PHOTOS[c.id];
  if (custom) return photoUrl(custom);
  const memory = c.beats.find((b) => b.kind === 'memory');
  return memory && memory.kind === 'memory' ? photoUrl(hardwareById[memory.hardware].photo) : textureUrl('moon');
}

function isChapterOpen(tab: TabKey, index: number, list: Chapter[], completed: Record<string, boolean>, explorer: boolean) {
  if (tab !== 'moon' || explorer || index === 0) return true;
  const prev = list[index - 1];
  return !!prev && !!completed[prev.id];
}

function defaultIndex(list: Chapter[], tab: TabKey, completed: Record<string, boolean>, beat: Record<string, number>, explorer: boolean) {
  if (list.length === 0) return 0;
  if (tab !== 'moon') return 0;
  const idx = list.findIndex((c, i) => isChapterOpen(tab, i, list, completed, explorer) && (!completed[c.id] || (beat[c.id] ?? 0) > 0));
  return idx >= 0 ? idx : Math.max(0, list.length - 1);
}

interface SideSlotProps {
  side: 'left' | 'right';
  body: PortalBody;
  num?: string;
  label: string;
  ariaLabel: string;
  onClick: () => void;
}

function SidePlanetButton({ side, body, num, label, ariaLabel, onClick }: SideSlotProps) {
  const cfg = PORTAL_BODY_CONFIG[body];
  return (
    <button
      type="button"
      className={`sp-edge sp-edge--${side}`}
      aria-label={ariaLabel}
      onClick={onClick}
    >
      <span
        className={`sp-edge__orb${cfg.ring ? ' has-ring' : ''}`}
        style={{
          backgroundImage: `url(${cfg.texture})`,
          '--orb-glow': cfg.glow,
        } as CSSProperties}
        aria-hidden="true"
      />
      <span className="sp-edge__meta">
        {num && <span className="sp-edge__num">{num}</span>}
        <span className="sp-edge__label">{label}</span>
      </span>
    </button>
  );
}

export function MapScreen() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const completed = useGame((s) => s.completed);
  const starsMap = useGame((s) => s.stars);
  const beat = useGame((s) => s.beat);
  const explorer = useGame((s) => s.explorer);

  const [tab, setTab] = useState<TabKey>('moon');
  const [view, setView] = useState<'portal' | 'grid'>('portal');
  const [warpingChapter, setWarpingChapter] = useState<Chapter | null>(null);
  const [pointer, setPointer] = useState({ x: 0, y: 0 });
  const [switchState, setSwitchState] = useState({ dir: 1, seq: 0 });
  const warpTimer = useRef<number | null>(null);
  const railRef = useRef<HTMLElement>(null);

  const completedList = useMemo(
    () => [...moonChapters, ...archiveChapters].filter((c) => !!completed[c.id]),
    [completed],
  );

  const list = tab === 'moon' ? moonChapters : tab === 'expansions' ? archiveChapters : completedList;
  const [index, setIndex] = useState(() => defaultIndex(moonChapters, 'moon', completed, beat, explorer));

  const switchTab = (next: TabKey) => {
    if (next === tab) return;
    play('blip');
    const nextList = next === 'moon' ? moonChapters : next === 'expansions' ? archiveChapters : completedList;
    setTab(next);
    setIndex(defaultIndex(nextList, next, completed, beat, explorer));
    setSwitchState((s) => ({ dir: 1, seq: s.seq + 1 }));
  };

  useEffect(() => {
    void preloadClip('map_warp');
    return () => {
      if (warpTimer.current) window.clearTimeout(warpTimer.current);
    };
  }, []);

  const safeIndex = list.length > 0 ? Math.min(index, list.length - 1) : 0;
  const selected = list[safeIndex] ?? null;

  useEffect(() => {
    if (view !== 'portal' || !railRef.current || list.length === 0) return;
    const btn = railRef.current.querySelector<HTMLElement>(`[data-stop-index="${safeIndex}"]`);
    if (btn && typeof btn.scrollIntoView === 'function') {
      btn.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    }
  }, [safeIndex, tab, view, list.length]);

  const doneMoon = moonChapters.filter((c) => completed[c.id]).length;
  const totalChapters = moonChapters.length + archiveChapters.length;

  const missionStats = useMemo(() => {
    if (!selected) return { count: 0, earned: 0, max: 0 };
    const missions = selected.beats.filter((b) => b.kind === 'mission');
    const earned = missions.reduce((sum, m) => sum + (starsMap[m.id] ?? 0), 0);
    return { count: missions.length, earned, max: missions.length * 3 };
  }, [selected, starsMap]);

  const open = selected ? isChapterOpen(tab, safeIndex, list, completed, explorer) : false;
  const actionLabel = selected
    ? completed[selected.id]
      ? t('map.replay')
      : (beat[selected.id] ?? 0) > 0
        ? t('map.resume')
        : t('map.enter')
    : t('map.play');

  const warpingId = warpingChapter?.id ?? null;

  const enterChapter = (c: Chapter, unlocked: boolean) => {
    if (!unlocked || warpingChapter) {
      if (!unlocked) play('fail');
      return;
    }
    play('ping');
    playClip('map_warp', 0.52);
    if (prefersReducedMotion()) {
      navigate(`/chapter/${c.id}`);
      return;
    }
    setWarpingChapter(c);
    warpTimer.current = window.setTimeout(() => {
      navigate(`/chapter/${c.id}`);
    }, 660);
  };

  const selectStop = (nextIdx: number, dir = 1) => {
    if (list.length === 0 || warpingChapter) return;
    const clamped = ((nextIdx % list.length) + list.length) % list.length;
    setIndex(clamped);
    setSwitchState((s) => ({ dir, seq: s.seq + 1 }));
    play('blip');
  };

  const onStagePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (prefersReducedMotion()) return;
    const vw = window.innerWidth || 1;
    const vh = window.innerHeight || 1;
    setPointer({
      x: (e.clientX / vw) * 2 - 1,
      y: (e.clientY / vh) * 2 - 1,
    });
  };

  const onStagePointerLeave = () => {
    setPointer({ x: 0, y: 0 });
  };

  const keyHandlerRef = useRef<(e: globalThis.KeyboardEvent) => void>(() => {});
  keyHandlerRef.current = (e: globalThis.KeyboardEvent) => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.isComposing) return;
    if (document.querySelector('dialog[open]')) return;
    const target = e.target;
    if (target instanceof HTMLElement && target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) return;
    if (view !== 'portal') return;

    if (list.length === 0) {
      if (e.code === 'KeyA' || e.key === 'ArrowLeft') { e.preventDefault(); switchTab('moon'); }
      else if (e.code === 'KeyD' || e.key === 'ArrowRight') { e.preventDefault(); switchTab('expansions'); }
      return;
    }

    if (e.code === 'KeyA' || e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      selectStop(safeIndex - 1, -1);
    } else if (e.code === 'KeyD' || e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      selectStop(safeIndex + 1, 1);
    } else if ((e.code === 'Space' || e.key === 'Enter') && selected) {
      if (e.repeat) return;
      if (target instanceof HTMLElement && target.closest('a, header button, .sp-topbar button, .sp-edge, .sp-scroll-circle')) return;
      e.preventDefault();
      enterChapter(selected, open);
    }
  };

  useEffect(() => {
    const onKeyDown = (e: globalThis.KeyboardEvent) => keyHandlerRef.current(e);
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const headerTitle = tab === 'moon'
    ? t('map.heading')
    : tab === 'expansions'
      ? t('map.expansionsHeading')
      : t('map.completedHeading');
  const headerSub = tab === 'moon'
    ? t('map.progress', { done: doneMoon, total: moonChapters.length })
    : tab === 'expansions'
      ? t('map.expansionsSub')
      : t('map.completedSub', { done: completedList.length, total: totalChapters });

  const prevIdx = list.length > 1 ? (safeIndex - 1 + list.length) % list.length : -1;
  const nextIdx = list.length > 1 ? (safeIndex + 1) % list.length : -1;
  const prevChapter = prevIdx >= 0 ? list[prevIdx] : null;
  const nextChapter = nextIdx >= 0 ? list[nextIdx] : null;

  return (
    <div
      className={`voyage sp-screen${warpingChapter ? ' is-warping' : ''}`}
      onPointerMove={onStagePointerMove}
      onPointerLeave={onStagePointerLeave}
    >
      <PortalPlanetCanvas
        chapter={warpingChapter ?? selected ?? moonChapters[0]}
        showPlanet={view === 'portal' || !!warpingChapter}
        launching={!!warpingChapter}
        switchDir={switchState.dir}
        switchSeq={switchState.seq}
        pointer={pointer}
      />
      <div className="voyage-vignette" aria-hidden="true" />
      <div className={`voyage-dive-fade${warpingChapter ? ' active' : ''}`} aria-hidden="true" />

      <header className="sp-topbar">
        <div className="sp-topbar__title">
          <h1>{headerTitle}</h1>
          <p>{headerSub}</p>
        </div>

        <div className="sp-topbar__nav">
          <div className="sp-tabs" role="tablist" aria-label={t('map.heading')}>
            <button type="button" role="tab" aria-selected={tab === 'moon'} className={`sp-tab${tab === 'moon' ? ' on' : ''}`} onClick={() => switchTab('moon')}>
              {t('map.tabMoon')}
            </button>
            {archiveChapters.length > 0 && (
              <button type="button" role="tab" aria-selected={tab === 'expansions'} className={`sp-tab${tab === 'expansions' ? ' on' : ''}`} onClick={() => switchTab('expansions')}>
                {t('map.tabExpansions')}
              </button>
            )}
            <button type="button" role="tab" aria-selected={tab === 'completed'} className={`sp-tab${tab === 'completed' ? ' on' : ''}`} onClick={() => switchTab('completed')}>
              {t('map.tabCompleted')}
              <span className="voyage-pill-count">{completedList.length}</span>
            </button>
          </div>

          {list.length > 0 && (
            <button
              type="button"
              className="sp-mode-btn"
              onClick={() => {
                play('blip');
                setView(view === 'portal' ? 'grid' : 'portal');
              }}
            >
              {view === 'portal' ? t('map.gridMode') : t('map.portalMode')}
            </button>
          )}
        </div>
      </header>

      {list.length === 0 ? (
        <div className="sp-stage sp-stage--empty">
          <SidePlanetButton
            side="left"
            body="moon"
            label={t('map.tabMoon')}
            ariaLabel={t('map.tabMoon')}
            onClick={() => switchTab('moon')}
          />
          <div className="panel voyage-empty__card">
            <span className="eyebrow">{t('map.tabCompleted')} · 0 / {totalChapters}</span>
            <h2>{t('map.completedHeading')}</h2>
            <p>{t('map.emptyCompleted')}</p>
            <button type="button" className="sp-cta-pill" onClick={() => switchTab('moon')}>
              {t('map.backToMoon')} →
            </button>
          </div>
          <SidePlanetButton
            side="right"
            body="mars"
            label={t('map.tabExpansions')}
            ariaLabel={t('map.tabExpansions')}
            onClick={() => switchTab('expansions')}
          />
        </div>
      ) : view === 'portal' && selected ? (
        <div className="sp-stage">
          <nav ref={railRef} className="voyage-rail sp-rail" aria-label={t('map.heading')}>
            {list.map((c, i) => {
              const itemOpen = isChapterOpen(tab, i, list, completed, explorer);
              const done = !!completed[c.id];
              const active = i === safeIndex;
              return (
                <button
                  key={c.id}
                  type="button"
                  data-stop-index={i}
                  className={`voyage-stop${active ? ' on' : ''}${done ? ' done' : ''}${itemOpen ? '' : ' locked'}`}
                  onClick={() => selectStop(i, i >= safeIndex ? 1 : -1)}
                  aria-current={active ? 'step' : undefined}
                >
                  <span className="voyage-stop__num">{String(i + 1).padStart(2, '0')}</span>
                  <span className="voyage-stop__name">{t(`story:${c.id}.title`)}</span>
                  {c.arc !== 'moon' && tab === 'completed' && (
                    <span className="voyage-stop__badge">{t('map.tagBonus')}</span>
                  )}
                </button>
              );
            })}
          </nav>

          {prevChapter ? (
            <SidePlanetButton
              side="left"
              body={chapterPortalBody(prevChapter)}
              num={String(prevIdx + 1).padStart(2, '0')}
              label={t(`story:${prevChapter.id}.title`)}
              ariaLabel={`${t('map.prevPlanet')}: ${t(`story:${prevChapter.id}.title`)}`}
              onClick={() => selectStop(prevIdx, -1)}
            />
          ) : (
            <SidePlanetButton
              side="left"
              body="moon"
              label={t('map.tabMoon')}
              ariaLabel={t('map.tabMoon')}
              onClick={() => switchTab('moon')}
            />
          )}

          <div className="sp-hero" key={selected.id}>
            <span className="sp-eyebrow">
              {selected.arc !== 'moon' ? `${t('map.tagBonus')} · ` : ''}
              {t('map.eyebrowWorld', { world: t(`world.${selected.world}`), n: safeIndex + 1, total: list.length })}
            </span>
            <h2 className="sp-title">{t(`story:${selected.id}.title`)}</h2>
            <span className="sp-rule" aria-hidden="true" />
            <p className="sp-tagline">{t(`story:${selected.id}.tagline`)}</p>

            <div className="sp-telemetry-line">
              <span><b>{t('map.telemetryEra')}:</b> {selected.era}</span>
              <span><b>{t('map.telemetryMissions')}:</b> {missionStats.count > 0 ? `${missionStats.count} · ★ ${missionStats.earned}/${missionStats.max}` : '—'}</span>
            </div>

            <div className="sp-cta-wrap">
              {open ? (
                <button
                  type="button"
                  className="sp-cta-pill"
                  onClick={() => enterChapter(selected, true)}
                >
                  {actionLabel} →
                </button>
              ) : (
                <button
                  type="button"
                  className="sp-cta-pill locked"
                  onClick={() => enterChapter(selected, false)}
                  aria-disabled="true"
                >
                  {t('map.locked')}
                </button>
              )}
              <p className="sp-keyhint">{t('map.keyHint')}</p>
            </div>
          </div>

          {nextChapter ? (
            <SidePlanetButton
              side="right"
              body={chapterPortalBody(nextChapter)}
              num={String(nextIdx + 1).padStart(2, '0')}
              label={t(`story:${nextChapter.id}.title`)}
              ariaLabel={`${t('map.nextPlanet')}: ${t(`story:${nextChapter.id}.title`)}`}
              onClick={() => selectStop(nextIdx, 1)}
            />
          ) : (
            <SidePlanetButton
              side="right"
              body="mars"
              label={t('map.tabExpansions')}
              ariaLabel={t('map.tabExpansions')}
              onClick={() => switchTab('expansions')}
            />
          )}

          <button
            type="button"
            className="sp-scroll-circle"
            title={t('map.gridMode')}
            aria-label={t('map.gridMode')}
            onClick={() => {
              play('blip');
              setView('grid');
            }}
          >
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M6 13l6 6 6-6" />
            </svg>
          </button>
        </div>
      ) : (
        <div className="page voyage-grid-wrap">
          <div className="chapter-grid">
            {list.map((c, i) => {
              const itemOpen = isChapterOpen(tab, i, list, completed, explorer);
              const done = !!completed[c.id];
              const stopLabel = done ? t('map.replay') : (beat[c.id] ?? 0) > 0 ? t('map.resume') : t('map.play');
              return (
                <div key={c.id} className={`stop${itemOpen ? '' : ' locked'}${done ? ' done' : ''}${warpingId === c.id ? ' launching' : ''}`}>
                  <div className="stop-img" style={{ backgroundImage: `url(${chapterCardArt(c)})` }} aria-hidden="true" />
                  {itemOpen ? (
                    <button type="button" className="stop-btn" onClick={() => enterChapter(c, itemOpen)}>
                      <span className="stop-era">{c.era}</span>
                      <span className={`stop-world w-${c.world}`}>
                        {c.arc !== 'moon' ? `${t('map.tagBonus')} · ` : ''}
                        {t(`world.${c.world}`)}
                      </span>
                      <h2>{t(`story:${c.id}.title`)}</h2>
                      <p>{t(`story:${c.id}.tagline`)}</p>
                      <span className="stop-cta">{stopLabel}</span>
                    </button>
                  ) : (
                    <div className="stop-inner">
                      <span className="stop-era">{c.era}</span>
                      <span className={`stop-world w-${c.world}`}>
                        {c.arc !== 'moon' ? `${t('map.tagBonus')} · ` : ''}
                        {t(`world.${c.world}`)}
                      </span>
                      <h2>{t(`story:${c.id}.title`)}</h2>
                      <p>{t(`story:${c.id}.tagline`)}</p>
                      <span className="stop-cta">{t('map.locked')}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
