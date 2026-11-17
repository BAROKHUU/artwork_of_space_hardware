import { describe, expect, it } from 'vitest';
import { BOT_SIZE, bubbleLayout, clampPosition, panelLayout } from './chatPosition';

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
  it('places the pop-up bubble above a low bot and below a high one inside viewport bounds', () => {
    const low = bubbleLayout({ x: 1700, y: 840 }, 1846, 946, { width: 220, height: 56 });
    expect(low.side).toBe('above');
    expect(low.y + 56).toBeLessThanOrEqual(840);
    expect(low.x + 220).toBeLessThanOrEqual(1846 - 8);
    expect(low.tailX).toBeGreaterThanOrEqual(18);
    expect(low.tailX).toBeLessThanOrEqual(220 - 18);

    const high = bubbleLayout({ x: 20, y: 40 }, 1846, 946, { width: 220, height: 56 });
    expect(high.side).toBe('below');
    expect(high.y).toBeGreaterThanOrEqual(40 + BOT_SIZE);
    expect(high.x).toBeGreaterThanOrEqual(8);

    const phone = bubbleLayout({ x: 278, y: 732 }, 390, 844, { width: 220, height: 56 });
    expect(phone.side).toBe('above');
    expect(phone.maxWidth).toBe(244);
    expect(phone.x).toBeGreaterThanOrEqual(8);
    expect(phone.x + 220).toBeLessThanOrEqual(390 - 8);
  });
});
