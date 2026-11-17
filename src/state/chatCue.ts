import { create } from 'zustand';

export type ChatPopupKind = 'intro' | 'fail';

export interface ChatPopup {
  id: number;
  kind: ChatPopupKind;
  textKey: string;
  prefill?: string;
}

export interface ChatOpenRequest {
  id: number;
  prefill?: string;
}

interface ChatCueState {
  popup: ChatPopup | null;
  openReq: ChatOpenRequest | null;
  showPopup: (input: { kind: ChatPopupKind; textKey: string; prefill?: string }) => number | null;
  dismissPopup: (id?: number) => void;
  dismissFail: () => void;
  openChat: (prefill?: string) => void;
  consumeOpenReq: (id: number) => void;
}

let nextId = 0;

/**
 * Ephemeral UI cue bridge between missions/quizzes/timers and the global RISE BOT portal.
 * Kept out of persisted save state (`store.ts`) so pop-ups never pollute `localStorage['echo-save']`.
 */
export const useChatCue = create<ChatCueState>((set, get) => ({
  popup: null,
  openReq: null,
  showPopup: ({ kind, textKey, prefill }) => {
    const current = get().popup;
    if (kind === 'intro' && current?.kind === 'fail') return null;
    const id = ++nextId;
    set({ popup: { id, kind, textKey, prefill } });
    return id;
  },
  dismissPopup: (id) =>
    set((state) => {
      if (!state.popup) return state;
      if (id !== undefined && state.popup.id !== id) return state;
      return { popup: null };
    }),
  dismissFail: () =>
    set((state) => (state.popup?.kind === 'fail' ? { popup: null } : state)),
  openChat: (prefill) => {
    const id = ++nextId;
    set({ popup: null, openReq: { id, prefill } });
  },
  consumeOpenReq: (id) =>
    set((state) => (state.openReq?.id === id ? { openReq: null } : state)),
}));
