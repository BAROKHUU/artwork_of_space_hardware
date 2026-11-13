import { describe, expect, it } from 'vitest';
import { allStorySections } from './content';
import { emptyBookProgress, normalizeBookProgress, setBookBookmark } from './progress';

describe('book progress', () => {
  const first = allStorySections[0];
  const next = allStorySections[1];
  const firstPage = first.pages[0];

  it('migrates completed and progressed legacy story beats into reached section keys', () => {
    const value = normalizeBookProgress({ completed: { [first.chapterId]: true }, beat: { [next.chapterId]: next.beatIndex + 1 } });
    expect(value.reached[first.id]).toBe(true);
    expect(value.reached[next.id]).toBe(true);
  });
  it('migrates the v1 top-level store fields and isolates explorer story progress', () => {
    const legacy = {
      completed: { [first.chapterId]: true },
      beat: { [next.chapterId]: next.beatIndex + 1 },
      explorer: false,
    };
    const migrated = normalizeBookProgress({
      completed: legacy.completed, beat: legacy.beat, explorer: legacy.explorer,
    }, [...new Set(allStorySections.map((section) => section.chapterId))], true);
    expect(migrated.reached).toEqual({ [first.id]: true, [next.id]: true });
    const explorer = normalizeBookProgress({ ...legacy, explorer: true }, [...new Set(allStorySections.map((section) => section.chapterId))], true);
    expect(explorer.reached).toEqual({});
  });

  it('does not migrate legacy story progress for explorer playthroughs', () => {
    const value = normalizeBookProgress({ explorer: true, completed: { [first.chapterId]: true }, beat: { [next.chapterId]: next.beatIndex + 1 } }, [...new Set(allStorySections.map((section) => section.chapterId))], true);
    expect(value.reached).toEqual({});
  });

  it('normalizes stale and cross-section bookmarks, preserving independent game and reader pages', () => {
    const value = normalizeBookProgress({
      gamePages: { [first.id]: firstPage.id, stale: firstPage.id, [next.id]: firstPage.id },
      readerPages: { [first.id]: first.pages.at(-1)?.id },
      readerSections: { [first.chapterId]: first.id, stale: 'missing', [next.chapterId]: first.id },
      reached: { stale: true, [first.id]: true },
      openedChapters: { stale: true },
      readerChapter: 'stale',
    });
    expect(value.gamePages).toEqual({ [first.id]: firstPage.id });
    expect(value.readerPages[first.id]).toBe(first.pages.at(-1)?.id);
    expect(value.reached).toEqual({ [first.id]: true });
    expect(value.openedChapters).toEqual({});
    expect(value.readerSections).toEqual({ [first.chapterId]: first.id });
  });

  it('provides empty progress for initialization and reset', () => {
    expect(emptyBookProgress()).toEqual({ reached: {}, gamePages: {}, readerPages: {}, openedChapters: {}, readerChapter: null, readerSections: {} });
  });
  it('stores separate game and reader bookmarks and remembers the reader section', () => {
    const game = setBookBookmark(emptyBookProgress(), 'game', first.id, firstPage.id);
    const readerPage = first.pages.at(-1)!;
    const reader = setBookBookmark(game, 'reader', first.id, readerPage.id);
    expect(reader.gamePages[first.id]).toBe(firstPage.id);
    expect(reader.readerPages[first.id]).toBe(readerPage.id);
    expect(reader.readerSections[first.chapterId]).toBe(first.id);
    expect(setBookBookmark(reader, 'reader', next.id, firstPage.id)).toBe(reader);
  });
});
