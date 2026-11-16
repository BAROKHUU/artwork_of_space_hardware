import { describe, expect, it } from 'vitest';
import { buildImageBase, buildMediaUrl } from './media';

describe('media URLs', () => {
  it('serves files from /public when Cloudinary is not configured', () => {
    expect(buildMediaUrl('intro/videos/1.mp4')).toBe('/intro/videos/1.mp4');
    expect(buildMediaUrl('/intro/images/8.jpg', { base: './' })).toBe('./intro/images/8.jpg');
  });
  it('picks the Cloudinary resource type from the file extension', () => {
    const cloud = { cloud: 'demo', folder: 'echo' };
    expect(buildMediaUrl('intro/images/8.jpg', cloud)).toBe('https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/echo/intro/images/8.jpg');
    expect(buildMediaUrl('intro/videos/12.mp4', cloud)).toBe('https://res.cloudinary.com/demo/video/upload/echo/intro/videos/12.mp4');
    expect(buildMediaUrl('intro/reading-music.mp3', cloud)).toBe('https://res.cloudinary.com/demo/video/upload/echo/intro/reading-music.mp3');
  });
  it('encodes spaces so file names with spaces still load', () => {
    expect(buildMediaUrl('assets/chat_bot/Lunar Bot.png')).toBe('/assets/chat_bot/Lunar%20Bot.png');
  });
  it('serves 3D models as raw files that keep their extension', () => {
    expect(buildMediaUrl('assets/models/voyager.glb', { cloud: 'demo' })).toBe('https://res.cloudinary.com/demo/raw/upload/echo/assets/models/voyager.glb');
  });
  it('builds an image folder prefix only when Cloudinary is configured', () => {
    expect(buildImageBase('moon-stories-watercolor')).toBe('');
    expect(buildImageBase('/moon-stories-watercolor/', { cloud: 'demo' })).toBe('https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/echo/moon-stories-watercolor/');
  });
});
