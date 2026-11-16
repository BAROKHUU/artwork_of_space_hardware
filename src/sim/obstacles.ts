import { makeRng } from './rng';
import type { Terrain } from './terrain';

export interface Rock {
  x: number;
  y: number;
  z: number;
  size: number;
  rotation: [number, number, number];
  scale: [number, number, number];
}

export interface Obstacle {
  x: number;
  z: number;
  r: number;
}

export interface Contact {
  x: number;
  z: number;
  hit: boolean;
  /** Unit vector pointing from the obstacle toward the rover at the last contact. */
  nx: number;
  nz: number;
}

/** Pebbles below this size are low enough for the wheels to roll over. */
export const SOLID_ROCK_SIZE = 0.3;

function placeRock(terrain: Terrain, rng: () => number, pick: () => [number, number], clear: Obstacle[]): Rock | null {
  let x = 0;
  let z = 0;
  let size = 0;
  // A few tries; a cell that sits inside a clear zone simply gets fewer rocks.
  for (let attempt = 0; ; attempt++) {
    [x, z] = pick();
    size = 0.12 + rng() ** 3 * 1.5;
    if (!clear.some((f) => Math.hypot(f.x - x, f.z - z) < f.r + size)) break;
    if (attempt > 24) return null;
  }
  const rotation: [number, number, number] = [rng() * 6, rng() * 6, rng() * 6];
  const scale: [number, number, number] = [size, size * (0.55 + rng() * 0.5), size * (0.7 + rng() * 0.5)];
  return { x, y: terrain.heightAt(x, z) + size * 0.1, z, size, rotation, scale };
}

export function scatterRocks(terrain: Terrain, count: number, seed: number, clear: Obstacle[] = []): Rock[] {
  const rng = makeRng(seed);
  const pick = (): [number, number] => [(rng() - 0.5) * terrain.size * 0.95, (rng() - 0.5) * terrain.size * 0.95];
  return Array.from({ length: count }, () => placeRock(terrain, rng, pick, clear)).filter((r): r is Rock => r !== null);
}

/**
 * The rocks of one square cell of an endless field, made from the cell's coordinates: the same
 * cell always gets the same rocks, so the streamed scenery and the collision check agree.
 */
export function rocksInCell(terrain: Terrain, cx: number, cz: number, cell: number, perCell: number, seed: number, clear: Obstacle[] = []): Rock[] {
  const rng = makeRng((Math.imul(cx, 73856093) ^ Math.imul(cz, 19349663) ^ Math.imul(seed, 83492791)) >>> 0);
  const count = Math.floor(perCell + rng());
  const pick = (): [number, number] => [(cx + rng()) * cell, (cz + rng()) * cell];
  const rocks: Rock[] = [];
  for (let i = 0; i < count; i++) {
    const rock = placeRock(terrain, rng, pick, clear);
    if (rock) rocks.push(rock);
  }
  return rocks;
}

/** Footprint circles for every rock too big to drive over. */
export function solidRocks(rocks: Rock[]): Obstacle[] {
  return rocks.filter((r) => r.size >= SOLID_ROCK_SIZE).map((r) => ({ x: r.x, z: r.z, r: ((r.scale[0] + r.scale[2]) / 2) * 0.9 }));
}

export const emptyContact = (): Contact => ({ x: 0, z: 0, hit: false, nx: 0, nz: 0 });

/**
 * Pushes a circular body out of any obstacle it overlaps, so it stops head-on and slides on a glancing hit.
 * Two passes settle the case of a body wedged between neighbouring rocks. Writes into `out` to avoid per-frame garbage.
 */
export function resolveCollisions(x: number, z: number, radius: number, obstacles: Obstacle[], out: Contact = emptyContact()): Contact {
  out.x = x;
  out.z = z;
  out.hit = false;
  for (let pass = 0; pass < 2; pass++) {
    for (const o of obstacles) {
      const reach = radius + o.r;
      const dx = out.x - o.x;
      const dz = out.z - o.z;
      if (Math.abs(dx) > reach || Math.abs(dz) > reach) continue;
      const d = Math.hypot(dx, dz);
      if (d >= reach) continue;
      out.nx = d > 1e-6 ? dx / d : 1;
      out.nz = d > 1e-6 ? dz / d : 0;
      out.x = o.x + out.nx * reach;
      out.z = o.z + out.nz * reach;
      out.hit = true;
    }
  }
  return out;
}

export interface RockField {
  /** Side of one square cell, in metres. */
  cell: number;
  /** The rocks of one cell; built once, then served from a cache. */
  at: (cx: number, cz: number) => Rock[];
}

/** An endless, repeatable rock field shared by the streamed scenery and the rover's collision check. */
export function rockField(terrain: Terrain, cell: number, perCell: number, seed: number, clear: Obstacle[] = []): RockField {
  const cache = new Map<number, Rock[]>();
  return {
    cell,
    at: (cx, cz) => {
      const key = cx * 65536 + cz;
      let rocks = cache.get(key);
      if (!rocks) {
        if (cache.size > 2048) cache.clear();
        rocks = rocksInCell(terrain, cx, cz, cell, perCell, seed, clear);
        cache.set(key, rocks);
      }
      return rocks;
    },
  };
}
