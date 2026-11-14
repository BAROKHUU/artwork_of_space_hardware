import { describe, expect, it } from 'vitest';
import { clampPosition } from './chatPosition';

describe('chat position', () => {
  it('keeps the bot inside the viewport, including small screens', () => {
    expect(clampPosition({ x: -20, y: 900 }, 800, 600)).toEqual({ x: 0, y: 504 });
    expect(clampPosition({ x: 20, y: 20 }, 50, 50)).toEqual({ x: 0, y: 0 });
    expect(clampPosition({ x: 240, y: 180 }, 800, 600)).toEqual({ x: 240, y: 180 });
  });
});
