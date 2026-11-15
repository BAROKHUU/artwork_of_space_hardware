/** The two ways to see the same Moon story. The id is what appears in the URL: #/story?mode=… */
export const STORY_MODES = ['watercolor', 'lantern'] as const;
export type StoryMode = (typeof STORY_MODES)[number];

/** Unknown or missing modes fall back to the mode picker. */
export function storyModeFrom(value: string | null): StoryMode | null {
  return STORY_MODES.includes(value as StoryMode) ? (value as StoryMode) : null;
}
