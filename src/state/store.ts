import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import { DEFAULT_LANGUAGE } from '../i18n/languages';
import { chapters } from '../data';
import { storySectionById } from '../book/content';
import { emptyBookProgress, normalizeBookProgress, setBookBookmark, type BookProgress } from '../book/progress';
export type Quality = 'high' | 'low' | 'off';
export type Reading = 'young' | 'older';

interface GameState {
  completed: Record<string, boolean>;
  stars: Record<string, number>;
  unlocked: Record<string, boolean>;
  beat: Record<string, number>;
  language: string;
  quality: Quality;
  reading: Reading;
  sound: boolean;
  explorer: boolean;
  settingsOpen: boolean;
  book: BookProgress;
  setStars: (mission: string, stars: number) => void;
  unlock: (hardware: string) => void;
  setBeat: (chapter: string, beat: number) => void;
  completeChapter: (chapter: string) => void;
  enterStory: (sectionId: string) => void;
  markBookOpened: (chapterId: string) => void;
  setBookPage: (mode: 'game' | 'reader', sectionId: string, pageId: string) => void;
  clearGameBookPage: (sectionId: string) => void;
  setReaderChapter: (chapterId: string) => void;
  update: (patch: Partial<Pick<GameState, 'language' | 'quality' | 'reading' | 'sound' | 'explorer' | 'settingsOpen'>>) => void;
  reset: () => void;
}

const emptyProgress = { completed: {}, stars: {}, unlocked: {}, beat: {} };

/** Private windows can throw on storage access; the game still runs, it just won't remember. */
const safeStorage: StateStorage = {
  getItem: (k) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  setItem: (k, v) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* progress simply isn't saved */
    }
  },
  removeItem: (k) => {
    try {
      localStorage.removeItem(k);
    } catch {
      /* nothing to remove */
    }
  },
};

export const useGame = create<GameState>()(
  persist(
    (set) => ({
      ...emptyProgress,
      book: emptyBookProgress(),
      language: DEFAULT_LANGUAGE,
      quality: 'high',
      reading: 'young',
      sound: true,
      explorer: false,
      settingsOpen: false,
      setStars: (mission, stars) => set((s) => ({ stars: { ...s.stars, [mission]: Math.max(stars, s.stars[mission] ?? 0) } })),
      unlock: (hardware) => set((s) => ({ unlocked: { ...s.unlocked, [hardware]: true } })),
      setBeat: (chapter, beat) => {
        const limit = chapters.find((item) => item.id === chapter)?.beats.length;
        if (limit === undefined || !Number.isInteger(beat) || beat < 0 || beat > limit) return;
        set((s) => ({ beat: { ...s.beat, [chapter]: beat } }));
      },
      completeChapter: (chapter) => {
        if (!chapters.some((item) => item.id === chapter)) return;
        set((s) => ({ completed: { ...s.completed, [chapter]: true }, beat: { ...s.beat, [chapter]: 0 } }));
      },
      enterStory: (sectionId) => {
        if (!storySectionById(sectionId)) return;
        set((s) => {
          const progress = normalizeBookProgress(s.book);
          return { book: { ...progress, reached: { ...progress.reached, [sectionId]: true } } };
        });
      },
      markBookOpened: (chapterId) => {
        if (!chapters.some((item) => item.id === chapterId)) return;
        set((s) => {
          const progress = normalizeBookProgress(s.book);
          return { book: { ...progress, openedChapters: { ...progress.openedChapters, [chapterId]: true } } };
        });
      },
      setBookPage: (mode, sectionId, pageId) => {
        if (mode !== 'game' && mode !== 'reader') return;
        set((s) => ({ book: setBookBookmark(normalizeBookProgress(s.book), mode, sectionId, pageId) }));
      },
      clearGameBookPage: (sectionId) => {
        if (!storySectionById(sectionId)) return;
        set((s) => {
          const progress = normalizeBookProgress(s.book);
          const gamePages = { ...progress.gamePages };
          delete gamePages[sectionId];
          return { book: { ...progress, gamePages } };
        });
      },
      setReaderChapter: (chapterId) => {
        if (chapterId !== '' && !chapters.some((item) => item.id === chapterId)) return;
        set((s) => ({ book: { ...normalizeBookProgress(s.book), readerChapter: chapterId || null } }));
      },
      update: (patch) => set(patch),
      reset: () => set({ ...emptyProgress, language: DEFAULT_LANGUAGE, quality: 'high', reading: 'young', sound: true, explorer: false, settingsOpen: false, book: emptyBookProgress() }),
    }),
    {
      name: 'echo-save',
      version: 2,
      storage: createJSONStorage(() => safeStorage),
      migrate: (persisted, version) => {
        const old = persisted as Partial<GameState>;
        const book = version < 2
          ? normalizeBookProgress({
              completed: old.completed,
              beat: old.beat,
              explorer: old.explorer,
            }, chapters.map((chapter) => chapter.id), true)
          : normalizeBookProgress(old.book, chapters.map((chapter) => chapter.id), false);
        return {
          ...old,
          completed: old.completed ?? {},
          stars: old.stars ?? {},
          unlocked: old.unlocked ?? {},
          beat: old.beat ?? {},
          book,
        };
      },
      merge: (persisted, current) => {
        const saved = persisted as Partial<GameState> | undefined;
        if (!saved) return current;
        return {
          ...current,
          ...saved,
          book: normalizeBookProgress(saved.book, chapters.map((chapter) => chapter.id), false),
        };
      },
      partialize: ({ settingsOpen: _open, setStars: _a, unlock: _b, setBeat: _c, completeChapter: _d, enterStory: _g, markBookOpened: _h, setBookPage: _i, clearGameBookPage: _j, setReaderChapter: _k, update: _e, reset: _f, ...saved }) => saved,
    },
  ),
);
