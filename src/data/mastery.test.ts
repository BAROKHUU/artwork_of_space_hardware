import { describe, expect, it } from 'vitest';
import { hardware, missionBeats } from './index';
import { hardwareMastery, missionIdsForHardware } from './mastery';

describe('hardware mastery mapping', () => {
  const validMissions = new Set(missionBeats.map((m) => m.id));

  it('maps every hardware record to at least one existing mission', () => {
    for (const item of hardware) {
      const ids = missionIdsForHardware(item.id);
      expect(ids.length, item.id).toBeGreaterThan(0);
      for (const id of ids) expect(validMissions.has(id), `${item.id} -> ${id}`).toBe(true);
    }
  });

  it('tracks best star score and unlocks mastery at 3 stars', () => {
    expect(hardwareMastery('viking2', {})).toEqual({ stars: 0, mastered: false });
    expect(hardwareMastery('viking2', { ch4_viking2: 2 })).toEqual({ stars: 2, mastered: false });
    expect(hardwareMastery('viking2', { ch4_viking2: 3 })).toEqual({ stars: 3, mastered: true });
    expect(hardwareMastery('lrrr', { ch2_laser: 2, m5_laser: 3 })).toEqual({ stars: 3, mastered: true });
  });
});
