import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_VOLUME, normalizeVolume, useGame } from './store';

describe('app volume', () => {
  beforeEach(() => useGame.getState().reset());

  it('cleans saved values that are missing, out of range or not numbers', () => {
    expect(normalizeVolume(undefined)).toBe(DEFAULT_VOLUME);
    expect(normalizeVolume('0.5')).toBe(DEFAULT_VOLUME);
    expect(normalizeVolume(Number.NaN)).toBe(DEFAULT_VOLUME);
    expect(normalizeVolume(0.4)).toBe(0.4);
    expect(normalizeVolume(-2)).toBe(0);
    expect(normalizeVolume(7)).toBe(1);
  });

  it('clamps volume set from the settings panel and resets it', () => {
    useGame.getState().update({ volume: 0.25 });
    expect(useGame.getState().volume).toBe(0.25);
    useGame.getState().update({ volume: 3 });
    expect(useGame.getState().volume).toBe(1);
    useGame.getState().update({ volume: 0 });
    useGame.getState().reset();
    expect(useGame.getState().volume).toBe(DEFAULT_VOLUME);
  });
});
