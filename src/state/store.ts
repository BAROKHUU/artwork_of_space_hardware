import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import { DEFAULT_LANGUAGE } from '../i18n/languages';

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
  setStars: (mission: string, stars: number) => void;
  unlock: (hardware: string) => void;
  setBeat: (chapter: string, beat: number) => void;
  completeChapter: (chapter: string) => void;
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
      language: DEFAULT_LANGUAGE,
      quality: 'high',
      reading: 'young',
      sound: true,
      explorer: false,
      settingsOpen: false,
      setStars: (mission, stars) => set((s) => ({ stars: { ...s.stars, [mission]: Math.max(stars, s.stars[mission] ?? 0) } })),
      unlock: (hardware) => set((s) => ({ unlocked: { ...s.unlocked, [hardware]: true } })),
      setBeat: (chapter, beat) => set((s) => ({ beat: { ...s.beat, [chapter]: beat } })),
      completeChapter: (chapter) => set((s) => ({ completed: { ...s.completed, [chapter]: true }, beat: { ...s.beat, [chapter]: 0 } })),
      update: (patch) => set(patch),
      reset: () => set({ ...emptyProgress, explorer: false }),
    }),
    {
      name: 'echo-save',
      version: 1,
      storage: createJSONStorage(() => safeStorage),
      partialize: ({ settingsOpen: _open, setStars: _a, unlock: _b, setBeat: _c, completeChapter: _d, update: _e, reset: _f, ...saved }) => saved,
    },
  ),
);
