import { describe, expect, it } from 'vitest';
import { canCapture, signalActive, WINDOW_SECONDS } from './seismic';

describe('fixed seismic window', () => {
  it('matches all four signals throughout the capture window', () => {
    for (let time = 0; time < 36; time += 0.05) {
      const expected = [0, 1, 2, 3].every((channel) =>
        Array.from({ length: 121 }, (_, i) => signalActive(time - WINDOW_SECONDS * i / 120, channel, 123)).every(Boolean));
      expect(canCapture(time, 123)).toBe(expected);
    }
  });
  it('changes each run and cycle while leaving a playable window', () => {
    const pattern = (seed: number, cycle: number) => Array.from({ length: 240 }, (_, i) => canCapture(cycle * 12 + i * 0.05, seed));
    expect(pattern(123, 0)).not.toEqual(pattern(456, 0));
    expect(pattern(123, 0)).not.toEqual(pattern(123, 1));
    for (let seed = 1; seed <= 20; seed++) for (let cycle = 0; cycle < 4; cycle++) {
      expect(pattern(seed, cycle)).toContain(true);
    }
  });
});
