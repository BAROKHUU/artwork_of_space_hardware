import { describe, expect, it } from 'vitest';
import { chapters } from '../data';
import story from '../locales/en/story.json';
import { allStorySections, getStorySections, storyPageById, storySectionById } from './content';

describe('storybook content', () => {
  it('covers every dialogue beat in story order without changing any dialogue', () => {
    const expected = chapters.flatMap((chapter) => chapter.beats.flatMap((beat, beatIndex) => beat.kind === 'dialogue' ? [{ chapterId: chapter.id, key: beat.key, beatIndex }] : []));
    expect(allStorySections.map(({ chapterId, key, beatIndex }) => ({ chapterId, key, beatIndex }))).toEqual(expected);
    for (const section of allStorySections) {
      const lines = (story as Record<string, Record<string, unknown>>)[section.chapterId][section.key] as unknown[];
      expect(section.pages.flatMap((page) => lines.slice(page.start, page.end))).toEqual(lines);
      expect(section.pages.map((page) => page.start)).toEqual(section.pages.map((_, index) => index * 2));
      for (const page of section.pages) expect(page.end - page.start).toBeLessThanOrEqual(2);
    }
  });

  it('resolves chapters, sections, and page IDs', () => {
    const section = allStorySections[0];
    expect(getStorySections(section.chapterId)).toContain(section);
    expect(storySectionById(section.id)).toBe(section);
    expect(storyPageById(section.pages[0].id)).toBe(section.pages[0]);
    expect(storySectionById('missing')).toBeUndefined();
    expect(storyPageById('missing')).toBeUndefined();
  });
});
