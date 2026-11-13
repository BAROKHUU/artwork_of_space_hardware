import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import HTMLFlipBook, { type BookSnapshot, type FlipBookHandle } from '@gullabs/react-flipbook';
import { useTranslation } from 'react-i18next';
import type { Chapter } from '../data/types';
import { backdrops, backdropUrl, hardwareById, photoUrl } from '../data';
import { useGame } from '../state/store';
import { play } from '../audio/sfx';
import { StoryPage } from './StoryPage';
import type { StoryPageSpec, StorySection } from './types';
import './book.css';

interface StoryBookProps {
  chapter: Chapter;
  sections: StorySection[];
  mode: 'game' | 'reader';
  activeSectionId?: string;
  onContinue?: () => void;
  onSkip?: () => void;
}

interface StoryLine { who: 'echo' | 'control'; text: string }
interface BookLeaf {
  type: 'cover' | 'story' | 'back';
  section?: StorySection;
  page?: StoryPageSpec;
  lines?: StoryLine[];
}

const PAGE_WIDTH = 380;
const PAGE_HEIGHT = 520;

export function StoryBook({ chapter, sections, mode, activeSectionId, onContinue, onSkip }: StoryBookProps) {
  const { t } = useTranslation();
  const bookRef = useRef<FlipBookHandle | null>(null);
  const hostRef = useRef<HTMLElement>(null);
  const markBookOpened = useGame((state) => state.markBookOpened);
  const setBookPage = useGame((state) => state.setBookPage);
  const enterStory = useGame((state) => state.enterStory);
  const setReaderChapter = useGame((state) => state.setReaderChapter);
  const gamePages = useGame((state) => state.book.gamePages);
  const readerPages = useGame((state) => state.book.readerPages);
  const savedReaderSection = useGame((state) => state.book.readerSections[chapter.id]);
  const [visiblePages, setVisiblePages] = useState<number[]>([0]);
  const [reducedMotion, setReducedMotion] = useState(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  const clearGameBookPage = useGame((state) => state.clearGameBookPage);

  const visibleSections = useMemo(() => {
    const candidates = sections.filter((section) => section.chapterId === chapter.id);
    return mode === 'game' && activeSectionId ? candidates.filter((section) => section.id === activeSectionId) : candidates;
  }, [sections, chapter.id, mode, activeSectionId]);
  const leaves = useMemo<BookLeaf[]>(() => [
    { type: 'cover' },
    ...visibleSections.flatMap((section) => {
      const lines = t(`story:${section.chapterId}.${section.key}`, { returnObjects: true }) as unknown as StoryLine[];
      return section.pages.map((page) => {
        const hardware = hardwareById[page.focus];
        const backdrop = backdrops[chapter.world];
        const image = page.image ?? (hardware ? {
          src: photoUrl(hardware.photo),
          alt: t(`hardware:${hardware.id}.name`),
          credit: t('logbook.credit', { credit: hardware.credit, id: hardware.nasaId }),
        } : {
          src: backdropUrl(chapter.world),
          alt: t(`world.${chapter.world}`),
          credit: t('logbook.credit', { credit: backdrop.credit, id: backdrop.nasaId }),
        });
        const enriched: StoryPageSpec = {
          ...page,
          image,
          fact: page.fact ?? (hardware ? t(`hardware:${hardware.id}.learned`) : undefined),
        };
        return { type: 'story' as const, section, page: enriched, lines: lines.slice(page.start, page.end) };
      });
    }),
    { type: 'back' },
  ], [visibleSections, t, chapter.world]);
  const contentPages = leaves.slice(1, -1);
  const initialPageKey = `${mode}:${chapter.id}:${mode === 'game' ? activeSectionId ?? '' : ''}`;
  const initialPageRef = useRef<{ key: string; page: number } | null>(null);
  if (initialPageRef.current?.key !== initialPageKey) {
    const requestedSection = mode === 'game'
      ? activeSectionId
      : savedReaderSection ?? visibleSections.find((section) => readerPages[section.id])?.id;
    const requestedPage = requestedSection ? (mode === 'game' ? gamePages[requestedSection] : readerPages[requestedSection]) : undefined;
    const found = leaves.findIndex((leaf) => leaf.type === 'story' && leaf.section?.id === requestedSection && leaf.page?.id === requestedPage);
    const sectionStart = mode === 'reader' && requestedSection
      ? leaves.findIndex((leaf) => leaf.type === 'story' && leaf.section?.id === requestedSection)
      : -1;
    initialPageRef.current = { key: initialPageKey, page: found >= 1 ? found : sectionStart >= 1 ? sectionStart : 0 };
  }
  const initialPage = initialPageRef.current.page;

  useEffect(() => {
    markBookOpened(chapter.id);
    if (mode === 'game' && activeSectionId) enterStory(activeSectionId);
  }, [chapter.id, mode, activeSectionId, markBookOpened, enterStory]);

  const syncBookmark = useCallback((snapshot: BookSnapshot) => {
    setVisiblePages(snapshot.visiblePages);
    const leaf = leaves[snapshot.page];
    if (leaf?.type !== 'story' || !leaf.section || !leaf.page) return;
    setBookPage(mode, leaf.section.id, leaf.page.id);
    if (mode === 'reader') setReaderChapter(chapter.id);
  }, [leaves, mode, setBookPage, setReaderChapter, chapter.id]);

  const onPageChange = useCallback((snapshot: BookSnapshot) => {
    syncBookmark(snapshot);
    play('page');
  }, [syncBookmark]);
  const continueStory = useCallback(() => {
    if (mode === 'game' && activeSectionId) clearGameBookPage(activeSectionId);
    onContinue?.();
  }, [mode, activeSectionId, clearGameBookPage, onContinue]);
  const skipStory = useCallback(() => {
    if (mode === 'game' && activeSectionId) clearGameBookPage(activeSectionId);
    onSkip?.();
  }, [mode, activeSectionId, clearGameBookPage, onSkip]);

  const onKeyDown = useCallback((event: KeyboardEvent<HTMLElement>) => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    const target = event.target;
    if (!(target instanceof Node) || !hostRef.current?.contains(target)) return;
    if (target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(target.tagName))) return;
    if (event.key === 'ArrowRight' || event.key === 'PageDown') {
      event.preventDefault();
      bookRef.current?.flipNext();
    } else if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
      event.preventDefault();
      bookRef.current?.flipPrev();
    } else if (event.key === 'Home') {
      event.preventDefault();
      bookRef.current?.flipToPage(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      bookRef.current?.flipToPage(leaves.length - 1);
    }
  }, [leaves.length]);

  const renderLeaf = (leaf: BookLeaf, index: number) => {
    if (leaf.type === 'cover') return <div key="cover" className="story-page-host" data-density="hard"><StoryPage chapterId={chapter.id} lines={[]} pageNumber={1} totalPages={contentPages.length} cover /></div>;
    if (leaf.type === 'back') return <div key="back-cover" className="story-page-host" data-density="hard"><StoryPage chapterId={chapter.id} lines={[]} pageNumber={contentPages.length} totalPages={contentPages.length} backCover /></div>;
    if (!leaf.section || !leaf.page) return <div className="story-page-host" key={`empty-${index}`} />;
    return <div key={leaf.page.id} className="story-page-host"><StoryPage chapterId={chapter.id} section={leaf.section} page={leaf.page} lines={leaf.lines ?? []} pageNumber={index} totalPages={contentPages.length} /></div>;
  };

  if (visibleSections.length === 0 || contentPages.length === 0) {
    return <section className="story-book-fallback" aria-label={t('book.reading')}>
      <p className="story-kicker">{t(`story:${chapter.id}.title`)}</p>
      {visibleSections.map((section) => {
        const lines = t(`story:${section.chapterId}.${section.key}`, { returnObjects: true }) as unknown as StoryLine[];
        return <section key={section.id}><h2>{section.title}</h2>{lines.map((line, i) => <p key={`${section.id}-${i}`}><strong>{t(`story:speakers.${line.who}`)}:</strong> {line.text}</p>)}</section>;
      })}
      {mode === 'game' && <div className="story-actions"><button className="btn ghost" type="button" onClick={skipStory}>{t('book.skip')}</button></div>}
    </section>;
  }

  const isFinalPage = visiblePages.includes(leaves.length - 2);
  return <section className="story-book-shell" ref={hostRef} onKeyDown={onKeyDown} aria-label={t('book.reading')} tabIndex={0}>
    <div className="story-book-controls" aria-label={t('book.reading')}>
      <button className="btn ghost" type="button" onClick={() => bookRef.current?.flipPrev()}>{t('book.previous')}</button>
      <button className="btn ghost" type="button" onClick={() => bookRef.current?.flipNext()}>{t('book.next')}</button>
    </div>
    <div className="story-book-frame">
      <HTMLFlipBook
        key={initialPageKey}
        ref={bookRef}
        width={PAGE_WIDTH}
        height={PAGE_HEIGHT}
        sizing="responsive"
        minWidth={260}
        maxWidth={PAGE_WIDTH}
        minHeight={356}
        maxHeight={PAGE_HEIGHT}
        autoSize
        usePortrait
        hardCovers
        initialPage={initialPage}
        useKeyboard={false}
        respectReducedMotion
        flippingTime={reducedMotion ? 0 : 700}
        allowTouchScroll
        respectInteractiveContent
        controls="none"
        aria-label={`${t('book.bookTitle')}: ${t(`story:${chapter.id}.title`)}`}
        liveRegion
        liveRegionText={(page, pageCount) => t('book.pageOf', { page: page + 1, total: pageCount })}
        onLoaded={syncBookmark}
        onPageChange={onPageChange}
        pageBackground="#f6f0df"
        className="story-flipbook"
      >
        {leaves.map(renderLeaf)}
      </HTMLFlipBook>
    </div>
    {mode === 'game' && <div className="story-actions">
      {isFinalPage && <button className="btn primary" type="button" onClick={continueStory}>{t('book.continue')}</button>}
      <button className="btn ghost" type="button" onClick={skipStory}>{t('book.skip')}</button>
    </div>}
    {mode === 'reader' && <p className="story-reader-caption">{t('book.reading')}</p>}
  </section>;
}
