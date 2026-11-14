export type StorySectionId = string;
export type StoryPageId = string;

export interface StoryPageSpec {
  id: StoryPageId;
  sectionId: StorySectionId;
  /** Zero-based inclusive line index in the section's localized dialogue. */
  start: number;
  /** Zero-based exclusive line index in the section's localized dialogue. */
  end: number;
  focus: string;
  world: 'moon' | 'mars' | 'deep';
  image?: { src: string; alt: string; credit: string };
  fact?: string;
}

export interface StorySection {
  id: StorySectionId;
  chapterId: string;
  title: string;
  key: string;
  beatIndex: number;
  pages: StoryPageSpec[];
}
