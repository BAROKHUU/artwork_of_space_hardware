import chaptersJson from './chapters.json';
import hardwareJson from './hardware.json';
import sourcesJson from './sources.json';
import type { Chapter, Hardware, MissionBeat, Source } from './types';

export const chapters = chaptersJson as unknown as Chapter[];
export const hardware = hardwareJson as unknown as Hardware[];
export const sources = sourcesJson as Record<string, Source>;

export const hardwareById = Object.fromEntries(hardware.map((h) => [h.id, h])) as Record<string, Hardware>;
export const chapterById = Object.fromEntries(chapters.map((c) => [c.id, c])) as Record<string, Chapter>;

export const missionBeats = chapters.flatMap((c) => c.beats.filter((b): b is MissionBeat => b.kind === 'mission'));

export const photoUrl = (photo: string) => `${import.meta.env.BASE_URL}assets/photos/${photo}.webp`;
export const textureUrl = (name: 'moon' | 'mars') => `${import.meta.env.BASE_URL}assets/textures/${name}.webp`;
