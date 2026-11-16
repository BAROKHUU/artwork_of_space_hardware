import * as THREE from 'three';
import type { Terrain } from '../sim/terrain';

/** Side of one streamed ground tile, in metres. */
export const TILE = 32;
/** Skirts hang below every tile edge, so detail changes between neighbours never open a gap. */
const SKIRT = 1.6;

/** A tile grid plus a skirt: each edge vertex has a twin hanging `SKIRT` metres lower. */
export function tileGeometry(segments: number): THREE.BufferGeometry {
  const n = segments + 1;
  const loop: number[] = [];
  for (let c = 0; c < segments; c++) loop.push(c);
  for (let r = 0; r < segments; r++) loop.push(r * n + segments);
  for (let c = segments; c > 0; c--) loop.push(segments * n + c);
  for (let r = segments; r > 0; r--) loop.push(r * n);
  const count = n * n + loop.length;
  const index: number[] = [];
  for (let r = 0; r < segments; r++) for (let c = 0; c < segments; c++) {
    const a = r * n + c;
    index.push(a, a + n, a + 1, a + 1, a + n, a + n + 1);
  }
  loop.forEach((edge, i) => {
    const next = loop[(i + 1) % loop.length];
    const s = n * n + i;
    const t = n * n + ((i + 1) % loop.length);
    // Both windings: skirts are seen from whichever side faces the camera.
    index.push(edge, s, next, next, s, t, edge, next, s, next, t, s);
  });
  const g = new THREE.BufferGeometry();
  g.setIndex(index);
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
  g.userData = { segments, loop };
  return g;
}

/** Fills a tile from world coordinates; normals come from the height field, so shared edges light the same. */
export function fillTerrainTile(g: THREE.BufferGeometry, terrain: Terrain, palette: { low: THREE.Color; high: THREE.Color }, cx: number, cz: number) {
  const { segments, loop } = g.userData as { segments: number; loop: number[] };
  const n = segments + 1;
  const step = TILE / segments;
  const pos = g.attributes.position as THREE.BufferAttribute;
  const normal = g.attributes.normal as THREE.BufferAttribute;
  const color = g.attributes.color as THREE.BufferAttribute;
  const uv = g.attributes.uv as THREE.BufferAttribute;
  const c = new THREE.Color();
  const v = new THREE.Vector3();
  const { low, high } = palette;
  const e = Math.min(step, 1);
  for (let r = 0; r < n; r++) for (let col = 0; col < n; col++) {
    const i = r * n + col;
    const lx = -TILE / 2 + col * step;
    const lz = -TILE / 2 + r * step;
    const x = cx * TILE + lx;
    const z = cz * TILE + lz;
    const h = terrain.heightAt(x, z);
    pos.setXYZ(i, lx, h, lz);
    v.set(terrain.heightAt(x - e, z) - terrain.heightAt(x + e, z), 2 * e, terrain.heightAt(x, z - e) - terrain.heightAt(x, z + e)).normalize();
    normal.setXYZ(i, v.x, v.y, v.z);
    uv.setXY(i, x / terrain.size + 0.5, 0.5 - z / terrain.size);
    const patches = Math.sin(x * 0.13) * Math.sin(z * 0.17) * 0.09 + Math.sin(x * 0.41 + z * 0.23) * 0.05;
    c.copy(low).lerp(high, THREE.MathUtils.clamp(0.62 + h * 0.09 + patches, 0, 1));
    color.setXYZ(i, c.r, c.g, c.b);
  }
  loop.forEach((edge, k) => {
    const s = n * n + k;
    pos.setXYZ(s, pos.getX(edge), pos.getY(edge) - SKIRT, pos.getZ(edge));
    normal.setXYZ(s, normal.getX(edge), normal.getY(edge), normal.getZ(edge));
    color.setXYZ(s, color.getX(edge), color.getY(edge), color.getZ(edge));
    uv.setXY(s, uv.getX(edge), uv.getY(edge));
  });
  pos.needsUpdate = normal.needsUpdate = color.needsUpdate = uv.needsUpdate = true;
  g.computeBoundingSphere();
}
