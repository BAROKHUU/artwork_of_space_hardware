import { makeRng } from './rng';

export interface TerrainOptions {
  seed: number;
  size: number;
  amplitude: number;
  craterCount: number;
  sharpCraters?: boolean;
  /** Discs kept level so landing pads and mission targets stay reachable. */
  flat?: { x: number; z: number; r: number }[];
  /**
   * Craters everywhere instead of only inside `size`: each 48 m cell makes its own, from its
   * coordinates, at the same density. Lets a rover drive forever with no visible edge.
   */
  endless?: boolean;
}

export interface Crater {
  x: number;
  z: number;
  r: number;
  depth: number;
}

export interface Terrain {
  size: number;
  craters: Crater[];
  heightAt: (x: number, z: number) => number;
}

const smooth = (t: number) => t * t * (3 - 2 * t);

function hash(ix: number, iz: number, seed: number): number {
  let h = Math.imul(ix, 374761393) + Math.imul(iz, 668265263) + Math.imul(seed, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function valueNoise(x: number, z: number, seed: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = smooth(x - ix);
  const fz = smooth(z - iz);
  const a = hash(ix, iz, seed);
  const b = hash(ix + 1, iz, seed);
  const c = hash(ix, iz + 1, seed);
  const d = hash(ix + 1, iz + 1, seed);
  return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
}

/** Craters reach at most 13 m × 1.5; a 48 m cell means only the 3×3 cells around a point matter. */
export const CRATER_CELL = 48;

export function makeTerrain({ seed, size, amplitude, craterCount, sharpCraters = false, flat = [], endless = false }: TerrainOptions): Terrain {
  const blocked = (x: number, z: number, r: number) => flat.some((f) => Math.hypot(f.x - x, f.z - z) < f.r + r * 1.4);
  const crater = (rng: () => number, x: number, z: number): Crater | null => {
    const r = 2 + rng() ** 2 * 11;
    return blocked(x, z, r) ? null : { x, z, r, depth: r * (0.16 + rng() * 0.1) };
  };

  const rng = makeRng(seed);
  const fixed: Crater[] = [];
  if (!endless) {
    for (let i = 0; i < craterCount; i++) {
      // Same draw order as before endless terrain existed, so saved missions keep their layout.
      const r = 2 + rng() ** 2 * 11;
      const x = (rng() - 0.5) * size;
      const z = (rng() - 0.5) * size;
      if (blocked(x, z, r)) continue;
      fixed.push({ x, z, r, depth: r * (0.16 + rng() * 0.1) });
    }
  }

  const perCell = (craterCount / (size * size)) * CRATER_CELL * CRATER_CELL;
  const cells = new Map<number, Crater[]>();
  const cellCraters = (cx: number, cz: number): Crater[] => {
    const key = cx * 65536 + cz;
    let list = cells.get(key);
    if (list) return list;
    const cellRng = makeRng(Math.floor(hash(cx, cz, seed + 101) * 4294967296));
    const count = Math.floor(perCell + cellRng());
    list = [];
    for (let i = 0; i < count; i++) {
      const c = crater(cellRng, (cx + cellRng()) * CRATER_CELL, (cz + cellRng()) * CRATER_CELL);
      if (c) list.push(c);
    }
    if (cells.size > 4096) cells.clear();
    cells.set(key, list);
    return list;
  };
  const near: Crater[] = [];
  const cratersNear = (x: number, z: number): Crater[] => {
    if (!endless) return fixed;
    const cx = Math.floor(x / CRATER_CELL);
    const cz = Math.floor(z / CRATER_CELL);
    near.length = 0;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) near.push(...cellCraters(cx + dx, cz + dz));
    return near;
  };
  const half = Math.ceil(size / 2 / CRATER_CELL);
  const craters: Crater[] = endless
    ? Array.from({ length: (half * 2) ** 2 }, (_, i) => cellCraters((i % (half * 2)) - half, Math.floor(i / (half * 2)) - half)).flat()
    : fixed;

  const heightAt = (x: number, z: number) => {
    let h = 0;
    let freq = 0.035;
    let amp = amplitude;
    for (let o = 0; o < 4; o++) {
      h += (valueNoise(x * freq, z * freq, seed + o) - 0.5) * amp;
      freq *= 2.1;
      amp *= 0.45;
    }
    for (const c of cratersNear(x, z)) {
      const d = Math.hypot(x - c.x, z - c.z);
      if (d > c.r * 1.5) continue;
      let q = d / c.r;
      if (sharpCraters) {
        // Broad floors, steep inner walls and a broken, narrow crest; shared by mesh and collision.
        q += (valueNoise(x / c.r * 4, z / c.r * 4, seed + 17) - 0.5) * 0.1 * Math.min(q / 0.48, 1);
        h += c.depth * (q < 0.48 ? -1 : q < 1 ? -1 + 1.2 * ((q - 0.48) / 0.52) ** 1.25 : 0.2 * (1 - smooth(Math.min((q - 1) / 0.45, 1))));
      } else {
        h += q < 1 ? -c.depth * (1 - q * q) + c.depth * 0.15 : c.depth * 0.15 * (1 - smooth((q - 1) / 0.5));
      }
    }
    let keep = 1;
    for (const f of flat) {
      const d = Math.hypot(x - f.x, z - f.z);
      const outer = f.r * 1.8;
      if (d < outer) keep = Math.min(keep, d < f.r ? 0 : smooth((d - f.r) / (outer - f.r)));
    }
    return h * keep;
  };

  return { size, craters, heightAt };
}
