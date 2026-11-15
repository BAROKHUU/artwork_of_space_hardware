import { describe, expect, it } from 'vitest';
import { buildMediaUrl } from './media';

describe('media URLs', () => {
  it('serves files from /public when Cloudinary is not configured', () => {
    expect(buildMediaUrl('intro/Video/1.mp4')).toBe('/intro/Video/1.mp4');
    expect(buildMediaUrl('/intro/Image/8.jpg', { base: './' })).toBe('./intro/Image/8.jpg');
  });
  it('picks the Cloudinary resource type from the file extension', () => {
    const cloud = { cloud: 'demo', folder: 'echo' };
    expect(buildMediaUrl('intro/Image/8.jpg', cloud)).toBe('https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/echo/intro/Image/8.jpg');
    expect(buildMediaUrl('intro/Video/12.mp4', cloud)).toBe('https://res.cloudinary.com/demo/video/upload/echo/intro/Video/12.mp4');
    expect(buildMediaUrl('intro/reading-music.mp3', cloud)).toBe('https://res.cloudinary.com/demo/video/upload/echo/intro/reading-music.mp3');
  });
  it('encodes spaces so file names with spaces still load', () => {
    expect(buildMediaUrl('assets/chat_bot/Lunar Bot.png')).toBe('/assets/chat_bot/Lunar%20Bot.png');
  });
});
