import manifest from '../data/storybook.json';
import story from '../locales/en/story.json';
import { chapterById } from '../data';
import type { StoryPageSpec, StorySection } from './types';

interface ManifestEntry { chapterId: string; key: string; focus: string }
const entries = manifest as ManifestEntry[];
const storyById = story as unknown as Record<string, { title: string; [key: string]: unknown }>;

function buildSections(): StorySection[] {
  return entries.flatMap(({ chapterId, key, focus }) => {
    const chapter = chapterById[chapterId];
    const lines = storyById[chapterId]?.[key];
    if (!chapter || !Array.isArray(lines) || lines.length === 0) return [];
    const beatIndex = chapter.beats.findIndex((beat) => beat.kind === 'dialogue' && beat.key === key);
    if (beatIndex < 0) return [];
    const sectionId = `${chapterId}.${key}`;
    const pages: StoryPageSpec[] = [];
    for (let start = 0; start < lines.length; start += 2) {
      const end = Math.min(start + 2, lines.length);
      pages.push({ id: `${sectionId}.${start + 1}`, sectionId, start, end, focus, world: chapter.world });
    }
    return [{ id: sectionId, chapterId, title: storyById[chapterId].title, key, beatIndex, pages }];
  });
}

export const allStorySections: StorySection[] = buildSections();
const sectionById = Object.fromEntries(allStorySections.map((section) => [section.id, section]));
const pageById = Object.fromEntries(allStorySections.flatMap((section) => section.pages.map((page) => [page.id, page])));

export function getStorySections(chapterId: string): StorySection[] {
  return allStorySections.filter((section) => section.chapterId === chapterId);
}

export function storySectionById(id: string): StorySection | undefined {
  return sectionById[id];
}

export function storyPageById(id: string): StoryPageSpec | undefined {
  return pageById[id];
}
