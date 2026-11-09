import { describe, expect, it } from 'vitest';
import { SOLID_ROCK_SIZE, resolveCollisions, scatterRocks, solidRocks } from './obstacles';
import { makeTerrain } from './terrain';

const terrain = makeTerrain({ seed: 11, size: 260, amplitude: 5, craterCount: 20 });

describe('rocks', () => {
  it('scatters the same field for the same seed, and keeps clear zones empty', () => {
    const clear = [{ x: 0, z: 0, r: 6 }];
    const a = scatterRocks(terrain, 180, 14, clear);
    expect(a).toEqual(scatterRocks(terrain, 180, 14, clear));
    for (const r of a) expect(Math.hypot(r.x, r.z)).toBeGreaterThan(6);
  });

  it('only treats rocks above the pebble size as solid', () => {
    const rocks = scatterRocks(terrain, 180, 14);
    expect(solidRocks(rocks).length).toBe(rocks.filter((r) => r.size >= SOLID_ROCK_SIZE).length);
    expect(solidRocks(rocks).length).toBeGreaterThan(20);
  });
});

describe('collision', () => {
  const rock = [{ x: 0, z: 0, r: 1 }];

  it('leaves a clear path untouched', () => {
    expect(resolveCollisions(5, 5, 0.9, rock)).toMatchObject({ x: 5, z: 5, hit: false });
  });

  it('stops a rover driving straight into a rock', () => {
    let z = 10;
    for (let i = 0; i < 400; i++) z = resolveCollisions(0, z - 0.1, 0.9, rock).z;
    expect(z).toBeCloseTo(1.9, 5);
  });

  it('slides around a rock on a glancing hit instead of sticking', () => {
    let x = 0.5;
    let z = 6;
    for (let i = 0; i < 200; i++) {
      const c = resolveCollisions(x, z - 0.1, 0.9, rock);
      x = c.x;
      z = c.z;
    }
    expect(z).toBeLessThan(-1);
  });

  it('never leaves the rover inside either of two touching rocks', () => {
    const pair = [{ x: -1, z: 0, r: 1 }, { x: 1.2, z: 0, r: 1 }];
    let z = 5;
    let x = 0;
    for (let i = 0; i < 200; i++) {
      const c = resolveCollisions(x, z - 0.1, 0.9, pair);
      x = c.x;
      z = c.z;
      for (const o of pair) expect(Math.hypot(x - o.x, z - o.z)).toBeGreaterThan(o.r + 0.9 - 0.25);
    }
  });
});
