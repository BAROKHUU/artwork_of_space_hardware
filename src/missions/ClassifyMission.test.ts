import { describe, expect, it } from 'vitest';
import { pickCraterRound } from './ClassifyMission';

describe('pickCraterRound', () => {
  it('picks smooth lightly-cratered patches as safest landing sites and shuffles deterministically', () => {
    const rounds = [0, 1, 2].map((r) => pickCraterRound(42, r, 'safest'));
    expect(pickCraterRound(42, 0, 'safest')).toEqual(rounds[0]);
    for (const r of rounds) {
      expect(r.patches).toHaveLength(4);
      expect(r.patches[r.answer]).toMatch(/\/(no-stay|yes-stay2)\.png$/);
    }
    expect(new Set(rounds.map((r) => r.answer)).size).toBeGreaterThan(1);
  });

  it('picks heavily-cratered patches as oldest exposed ground and shuffles deterministically', () => {
    const rounds = [0, 1, 2].map((r) => pickCraterRound(33, r, 'oldest'));
    expect(pickCraterRound(33, 0, 'oldest')).toEqual(rounds[0]);
    for (const r of rounds) {
      expect(r.patches).toHaveLength(4);
      expect(r.patches[r.answer]).toMatch(/\/(no-stay2|no-stay3|yes-stay)\.png$/);
    }
    expect(new Set(rounds.map((r) => r.answer)).size).toBeGreaterThan(1);
  });
});
