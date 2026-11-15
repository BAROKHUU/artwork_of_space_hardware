import { describe, expect, it } from 'vitest';
import { BOT_SIZE, clampPosition, panelLayout } from './chatPosition';

describe('chat position', () => {
  it('keeps the bot inside the viewport, including small screens', () => {
    expect(clampPosition({ x: -20, y: 900 }, 800, 600)).toEqual({ x: 0, y: 504 });
    expect(clampPosition({ x: 20, y: 20 }, 50, 50)).toEqual({ x: 0, y: 0 });
    expect(clampPosition({ x: 240, y: 180 }, 800, 600)).toEqual({ x: 240, y: 180 });
  });
  it('opens the panel above a low bot and below a high one, without covering it', () => {
    const low = panelLayout({ x: 1700, y: 840 }, 1846, 946, false);
    expect(low.y + low.height).toBeLessThanOrEqual(840);
    expect(low.x + low.width).toBeLessThanOrEqual(1846 - 8);
    const high = panelLayout({ x: 100, y: 40 }, 1846, 946, false);
    expect(high.y).toBeGreaterThanOrEqual(40 + BOT_SIZE);
  });
  it('makes the expanded panel larger but keeps it on screen', () => {
    const compact = panelLayout({ x: 1700, y: 840 }, 1846, 946, false);
    const expanded = panelLayout({ x: 1700, y: 840 }, 1846, 946, true);
    expect(expanded.width).toBeGreaterThan(compact.width);
    expect(expanded.height).toBeGreaterThan(compact.height);
    expect(expanded.x).toBeGreaterThanOrEqual(8);
    expect(expanded.y).toBeGreaterThanOrEqual(8);
    const phone = panelLayout({ x: 280, y: 730 }, 390, 844, true);
    expect(phone.width).toBe(374);
    expect(phone.x).toBe(8);
  });
});
