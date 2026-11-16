import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { makeTerrain } from '../sim/terrain';
import { TILE, fillTerrainTile, tileGeometry } from './terrainTiles';

const terrain = makeTerrain({ seed: 3, size: 260, amplitude: 5.5, craterCount: 58, sharpCraters: true, endless: true });
const palette = { low: new THREE.Color('#626264'), high: new THREE.Color('#bdbdbd') };

function heights(segments: number, cx: number, cz: number) {
  const g = tileGeometry(segments);
  fillTerrainTile(g, terrain, palette, cx, cz);
  const pos = g.attributes.position;
  const n = segments + 1;
  return { pos, n, at: (r: number, c: number) => pos.getY(r * n + c) };
}

describe('streamed terrain tiles', () => {
  it('follows the height field in world space, far from the start too', () => {
    const { pos, at } = heights(12, 120, -80);
    expect(at(0, 0)).toBeCloseTo(terrain.heightAt(120 * TILE - TILE / 2, -80 * TILE - TILE / 2), 5);
    expect(pos.getX(0)).toBeCloseTo(-TILE / 2);
  });

  it('shares edge heights with a neighbour of different detail', () => {
    const fine = heights(24, 0, 0);
    const coarse = heights(6, 1, 0);
    // The fine tile's right edge and the coarse tile's left edge meet at the same points.
    for (let r = 0; r <= 6; r++) expect(fine.at(r * 4, 24)).toBeCloseTo(coarse.at(r, 0), 5);
  });

  it('hangs a skirt below every edge vertex', () => {
    const { pos, n } = heights(6, 2, 3);
    for (let i = n * n; i < pos.count; i++) {
      let lowest = Infinity;
      for (let j = 0; j < n * n; j++) if (pos.getX(j) === pos.getX(i) && pos.getZ(j) === pos.getZ(i)) lowest = Math.min(lowest, pos.getY(j));
      expect(pos.getY(i)).toBeLessThan(lowest);
    }
  });
});
