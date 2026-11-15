import { describe, expect, it } from 'vitest';
import { activeIntroVideo } from './introMedia';

describe('intro video selection', () => {
  it('mounts only the requested scene video', () => {
    const scenes = [{ video: '/intro/1.mp4' }, { video: '/intro/2.mp4' }, { video: '/intro/3.mp4' }];
    expect(activeIntroVideo(scenes, 1)).toBe('/intro/2.mp4');
  });
});
