import chaptersJson from './chapters.json';
import hardwareJson from './hardware.json';
import backdropsJson from './backdrops.json';
import sourcesJson from './sources.json';
import type { Chapter, Hardware, MissionBeat, Source } from './types';

export const chapters = chaptersJson as unknown as Chapter[];
export const hardware = hardwareJson as unknown as Hardware[];
export const sources = sourcesJson as Record<string, Source>;

/** The Moon story, in order. This is the journey the title screen starts. */
export const moonChapters = chapters.filter((chapter) => chapter.arc === 'moon');
/** The original Echo survey. Kept, translated where possible, and reachable from the Archive. */
export const archiveChapters = chapters.filter((chapter) => chapter.arc !== 'moon');

export const hardwareById = Object.fromEntries(hardware.map((h) => [h.id, h])) as Record<string, Hardware>;
export const chapterById = Object.fromEntries(chapters.map((c) => [c.id, c])) as Record<string, Chapter>;

/** Next chapter inside the same journey, so the archive never leads into the Moon story by accident. */
export function nextChapterInArc(chapter: Chapter): Chapter | undefined {
  const group = chapter.arc === 'moon' ? moonChapters : archiveChapters;
  const index = group.findIndex((item) => item.id === chapter.id);
  return index >= 0 ? group[index + 1] : undefined;
}

export const missionBeats = chapters.flatMap((c) => c.beats.filter((b): b is MissionBeat => b.kind === 'mission'));

export interface Backdrop {
  nasaId: string;
  credit: string;
  /** Darkening applied over the image so text keeps at least 4.5:1 contrast. */
  scrim: number;
}
export const backdrops = backdropsJson as Record<string, Backdrop>;
export const backdropUrl = (name: string) => `${import.meta.env.BASE_URL}assets/backdrops/${name}.webp`;

export const photoUrl = (photo: string) => `${import.meta.env.BASE_URL}assets/photos/${photo}.webp`;
export const modelUrl = (id: string) => `${import.meta.env.BASE_URL}assets/models/${id}.glb`;
export const planetMapUrl = (id: string) => (id === 'mars' ? textureUrl('mars') : `${import.meta.env.BASE_URL}assets/textures/planets/${id}.webp`);
export const textureUrl = (name: 'moon' | 'mars') => `${import.meta.env.BASE_URL}assets/textures/${name}.webp`;
