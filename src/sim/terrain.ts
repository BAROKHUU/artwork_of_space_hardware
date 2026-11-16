import { makeRng } from './rng';

export interface TerrainOptions {
  seed: number;
  size: number;
  amplitude: number;
  craterCount: number;
  /** Discs kept level so landing pads and mission targets stay reachable. */
  flat?: { x: number; z: number; r: number }[];
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

export function makeTerrain({ seed, size, amplitude, craterCount, flat = [] }: TerrainOptions): Terrain {
  const rng = makeRng(seed);
  const craters: Crater[] = [];
  for (let i = 0; i < craterCount; i++) {
    const r = 2 + rng() ** 2 * 11;
    const x = (rng() - 0.5) * size;
    const z = (rng() - 0.5) * size;
    if (flat.some((f) => Math.hypot(f.x - x, f.z - z) < f.r + r * 1.4)) continue;
    craters.push({ x, z, r, depth: r * (0.16 + rng() * 0.1) });
  }

  const heightAt = (x: number, z: number) => {
    let h = 0;
    let freq = 0.035;
    let amp = amplitude;
    for (let o = 0; o < 4; o++) {
      h += (valueNoise(x * freq, z * freq, seed + o) - 0.5) * amp;
      freq *= 2.1;
      amp *= 0.45;
    }
    for (const c of craters) {
      const d = Math.hypot(x - c.x, z - c.z);
      if (d > c.r * 1.5) continue;
      const q = d / c.r;
      h += q < 1 ? -c.depth * (1 - q * q) + c.depth * 0.15 : c.depth * 0.15 * (1 - smooth((q - 1) / 0.5));
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
