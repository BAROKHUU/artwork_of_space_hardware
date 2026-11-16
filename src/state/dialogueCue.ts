import { create } from 'zustand';

export type Speaker = 'echo' | 'control' | 'lrv' | 'cuoi' | 'rabbit';

/**
 * Who is speaking in a dialogue shown on top of a finished mission. The mission scene reads it
 * every frame to turn its camera toward the speaker; null when no in-place dialogue is open.
 */
export const useDialogueCue = create<{ speaker: Speaker | null; setSpeaker: (speaker: Speaker | null) => void }>((set) => ({
  speaker: null,
  setSpeaker: (speaker) => set({ speaker }),
}));
