import { allStorySections, storyPageById, storySectionById } from './content';
import type { StorySectionId } from './types';

export interface BookProgress {
  reached: Record<string, true>;
  gamePages: Record<string, string>;
  readerPages: Record<string, string>;
  openedChapters: Record<string, true>;
  readerChapter: string | null;
  readerSections: Record<string, string>;
}

export const emptyBookProgress = (): BookProgress => ({
  reached: {}, gamePages: {}, readerPages: {}, openedChapters: {}, readerChapter: null, readerSections: {},
});

type LegacyProgress = Partial<BookProgress> & {
  completed?: Record<string, boolean>;
  beat?: Record<string, number>;
  explorer?: boolean;
};

function validRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function normalizeBookProgress(
  value: unknown,
  chapters: readonly string[] = Array.from(new Set(allStorySections.map((section) => section.chapterId))),
  migrateLegacy = true,
): BookProgress {
  const legacy = (value && typeof value === 'object' ? value : {}) as LegacyProgress;
  const normalized = emptyBookProgress();
  const sectionIds = new Set(allStorySections.map((section) => section.id));
  const chapterIds = new Set(chapters);
  const reached = validRecord(legacy.reached);
  const openedChapters = validRecord(legacy.openedChapters);
  for (const id of Object.keys(reached)) if (sectionIds.has(id) && reached[id] === true) normalized.reached[id] = true;
  for (const id of Object.keys(openedChapters)) if (chapterIds.has(id) && openedChapters[id] === true) normalized.openedChapters[id] = true;

  const normalizeBookmarks = (source: unknown, target: Record<string, string>) => {
    for (const [sectionId, pageId] of Object.entries(validRecord(source))) {
      const page = typeof pageId === 'string' ? storyPageById(pageId) : undefined;
      if (sectionIds.has(sectionId) && page?.sectionId === sectionId && chapterIds.has(storySectionById(sectionId)?.chapterId ?? '')) target[sectionId] = pageId as string;
    }
  };
  normalizeBookmarks(legacy.gamePages, normalized.gamePages);
  normalizeBookmarks(legacy.readerPages, normalized.readerPages);

  if (migrateLegacy && !legacy.explorer) {
    const completed = validRecord(legacy.completed);
    const beat = validRecord(legacy.beat);
    for (const section of allStorySections) {
      if (completed[section.chapterId] === true) normalized.reached[section.id] = true;
      const savedBeat = beat[section.chapterId];
      if (typeof savedBeat === 'number' && Number.isInteger(savedBeat) && savedBeat > section.beatIndex) normalized.reached[section.id] = true;
    }
  }

  for (const [chapterId, sectionId] of Object.entries(validRecord(legacy.readerSections))) {
    if (chapterIds.has(chapterId) && typeof sectionId === 'string' && storySectionById(sectionId)?.chapterId === chapterId) normalized.readerSections[chapterId] = sectionId;
  }
  normalized.readerChapter = typeof legacy.readerChapter === 'string' && chapterIds.has(legacy.readerChapter) ? legacy.readerChapter : null;
  return normalized;
}

export function setBookBookmark(progress: BookProgress, mode: 'game' | 'reader', sectionId: string, pageId: string): BookProgress {
  const section = storySectionById(sectionId);
  const page = storyPageById(pageId);
  if (!section || !page || page.sectionId !== sectionId) return progress;
  const field = mode === 'game' ? 'gamePages' : 'readerPages';
  return {
    ...progress,
    [field]: { ...progress[field], [sectionId]: pageId },
    ...(mode === 'reader' ? { readerSections: { ...progress.readerSections, [section.chapterId]: sectionId } } : {}),
  };
}

export function validBookSectionId(value: string): value is StorySectionId {
  return storySectionById(value) !== undefined;
}
