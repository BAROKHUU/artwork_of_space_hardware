import { describe, expect, it } from 'vitest';
import { STORY_MODES, storyModeFrom } from './storyModes';

describe('story modes', () => {
  it('accepts the known modes from the URL', () => {
    for (const mode of STORY_MODES) expect(storyModeFrom(mode)).toBe(mode);
  });

  it('sends unknown or missing modes to the picker', () => {
    expect(storyModeFrom(null)).toBeNull();
    expect(storyModeFrom('')).toBeNull();
    expect(storyModeFrom('video')).toBeNull();
    expect(storyModeFrom('Watercolor')).toBeNull();
  });
});
