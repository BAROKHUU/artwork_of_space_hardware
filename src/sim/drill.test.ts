import { describe, expect, it } from 'vitest';
import { buildCoreLayers, initialDrill, stepDrill } from './drill';

describe('drill simulation', () => {
  it('reaches target depth cleanly when pulsed to manage heat', () => {
    const layers = buildCoreLayers(2.4, 16);
    let s = initialDrill();
    for (let i = 0; i < 60 * 30 && !s.done && !s.failed; i++) {
      const drilling = s.heat < 75;
      s = stepDrill(s, layers, 2.4, 3, drilling, 1 / 60);
    }
    expect(s.done).toBe(true);
    expect(s.failed).toBe(false);
    expect(s.jams).toBe(0);
    expect(s.depth).toBe(2.4);
  });

  it('requires releasing after an overheat so holding continuously only counts one jam', () => {
    const layers = buildCoreLayers(2.4, 16);
    let s = initialDrill();
    for (let i = 0; i < 60 * 15; i++) {
      s = stepDrill(s, layers, 2.4, 3, true, 1 / 60);
    }
    expect(s.jams).toBe(1);
    expect(s.locked).toBe(true);
    expect(s.releaseRequired).toBe(true);
    expect(s.failed).toBe(false);

    // Releasing clears releaseRequired and unlocks once cooled.
    s = stepDrill(s, layers, 2.4, 3, false, 1 / 60);
    expect(s.releaseRequired).toBe(false);
    expect(s.locked).toBe(false);
  });

  it('fails after maxJams separate overheat cycles', () => {
    const layers = buildCoreLayers(2.4, 16);
    let s = initialDrill();
    for (let cycle = 0; cycle < 3; cycle++) {
      while (!s.locked && !s.failed) s = stepDrill(s, layers, 2.4, 3, true, 1 / 60);
      while (s.locked && !s.failed) s = stepDrill(s, layers, 2.4, 3, false, 1 / 60);
    }
    expect(s.failed).toBe(true);
    expect(s.jams).toBe(3);
  });
});
