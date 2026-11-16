import { expect, it, vi } from 'vitest';
import * as THREE from 'three';
import chapters from '../data/chapters.json';
import type { Chapter } from '../data/types';
import { makeTerrain } from '../sim/terrain';
import { meshHeightAt, TILE_SIZE, terrainSegments } from '../sim/terrainMesh';
import { makeTerrainCover, makeTerrainTiles, updateTerrainCover } from './StreamedTerrain';

// Canvas textures need a browser; this geometry regression uses no textures.
vi.mock('./Scenery', async () => {
  const { Color } = await import('three');
  return { PALETTE: { moon: { low: new Color('#626264'), high: new Color('#bdbdbd') } }, regolithFor: vi.fn() };
});

const mission = (chapters as Chapter[]).find((chapter) => chapter.id === 'm2')!.beats.find((beat) => beat.kind === 'mission' && beat.template === 'drive');
if (!mission || mission.kind !== 'mission' || mission.template !== 'drive') throw new Error('Missing m2 drive terrain');
const config = mission.config;
const terrain = makeTerrain({ seed: config.seed, size: 260, amplitude: 5.5, craterCount: 58, sharpCraters: true,
  flat: [{ ...config.start, r: 5 }, ...config.targets.map((target) => ({ ...target, r: 6 }))] });

it.each([false, true])('fills m2 immediately, joins tile edges and covers the horizon while recycling (low=%s)', (low) => {
  const segments = terrainSegments(low), material = new THREE.MeshBasicMaterial();
  const tiles = makeTerrainTiles(terrain, 'moon', segments, material, 0, 0);
  expect(tiles).toHaveLength(49);
  expect(tiles.every(({ mesh, x, z }) => mesh.visible && Number.isFinite(x + z))).toBe(true);
  const left = tiles.find((tile) => tile.x === 0 && tile.z === 0)!.mesh.geometry;
  const right = tiles.find((tile) => tile.x === 1 && tile.z === 0)!.mesh.geometry;
  for (let row = 0; row <= segments; row++) {
    const a = row * (segments + 1) + segments, b = row * (segments + 1);
    expect(left.attributes.position.getY(a)).toBe(right.attributes.position.getY(b));
    for (const axis of ['getX', 'getY', 'getZ'] as const) expect(left.attributes.normal[axis](a)).toBe(right.attributes.normal[axis](b));
  }
  const camera = new THREE.PerspectiveCamera(55, 16 / 9, 0.1, 520);
  const ray = new THREE.Raycaster();
  const cover = new THREE.Mesh(makeTerrainCover(terrain, 'moon', segments, 0, 0), material);
  const positions = cover.geometry.attributes.position.array;
  const indices = cover.geometry.index;
  for (const [cx, cz] of [[0, 0], [1, 0], [-13, 0], [-13, -1]]) {
    updateTerrainCover(cover.geometry, terrain, 'moon', segments, cx, cz);
    expect(cover.geometry.attributes.position.array).toBe(positions);
    expect(cover.geometry.index).toBe(indices);
    const pos = cover.geometry.attributes.position;
    let error = 0;
    for (let i = 0; i < pos.count; i++) error = Math.max(error, Math.abs(pos.getY(i) - terrain.heightAt(cx * TILE_SIZE + pos.getX(i), cz * TILE_SIZE + pos.getZ(i))));
    expect(error).toBeLessThan(0.0001);
    const fresh = makeTerrainCover(terrain, 'moon', segments, cx, cz);
    const normals = cover.geometry.attributes.normal.array, expectedNormals = fresh.attributes.normal.array;
    let normalError = 0;
    for (let i = 0; i < normals.length; i++) normalError = Math.max(normalError, Math.abs(normals[i] - expectedNormals[i]));
    expect(normalError).toBeLessThan(0.0001);
    fresh.dispose();
    cover.position.set(cx * TILE_SIZE, -0.001, cz * TILE_SIZE);
    cover.updateMatrixWorld(true);
    camera.position.set(cx * TILE_SIZE, 8, cz * TILE_SIZE + 14);
    camera.lookAt(cx * TILE_SIZE, 1.4, cz * TILE_SIZE - 7);
    camera.updateMatrixWorld(true);
    for (const y of [0.5, 0.55]) for (const x of [-0.9, 0, 0.9]) {
      ray.setFromCamera(new THREE.Vector2(x, y), camera);
      if (cz === 0) expect(ray.intersectObject(cover).length, `ground at camera tile ${cx}, screen ${x}, ${y}`).toBeGreaterThan(0);
    }
    // Both the dense patch and every outer ring remain a connected surface.
    for (const x of [0, 112, 144, 208, 336, 519]) {
      ray.set(new THREE.Vector3(cx * TILE_SIZE + x, 20, cz * TILE_SIZE - 45), new THREE.Vector3(0, -1, 0));
      expect(ray.intersectObject(cover).length).toBeGreaterThan(0);
    }
    expect(cover.geometry.attributes.normal.count).toBe(cover.geometry.attributes.position.count);
  }
  // Contact heights follow both rendered triangles, including negative coordinates and tile seams.
  const heightAt = meshHeightAt(terrain.heightAt, segments), step = TILE_SIZE / segments;
  const points = [[16, 5], [-16, -5], [48, -48], [-48, 48], [0, 0]];
  for (const gx of [-30, -2, 0, 17, 30]) for (const [u, v] of [[0.2, 0.3], [0.8, 0.7]]) points.push([(gx + u) * step, (-gx + v) * step]);
  tiles.forEach(({ mesh }) => mesh.updateMatrixWorld(true));
  for (const [x, z] of points) {
    ray.set(new THREE.Vector3(x, 20, z), new THREE.Vector3(0, -1, 0));
    const hit = ray.intersectObjects(tiles.map(({ mesh }) => mesh))[0];
    expect(hit, `rendered ground at ${x}, ${z}`).toBeDefined();
    expect(Math.abs(hit.point.y - heightAt(x, z))).toBeLessThan(0.00001);
  }
  cover.geometry.dispose();
  tiles.forEach(({ mesh }) => mesh.geometry.dispose());
  material.dispose();
});

it('covers visible ground near far-plane corners across diagonal headings and screen shapes', () => {
  const material = new THREE.MeshBasicMaterial();
  const cover = new THREE.Mesh(makeTerrainCover({ size: 260, craters: [], heightAt: () => 0 }, 'moon', terrainSegments(true), 0, 0), material);
  cover.updateMatrixWorld(true);
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 520), ray = new THREE.Raycaster();
  for (const aspect of [9 / 16, 16 / 9, 32 / 9]) for (const heading of [1, 3, 5, 7].map((n) => n * Math.PI / 4)) {
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    camera.position.set(13, 8, -13);
    camera.lookAt(13 - Math.sin(heading) * 21, 1.4, -13 - Math.cos(heading) * 21);
    camera.updateMatrixWorld(true);
    const depth = camera.far * 0.99, halfHeight = depth * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const localY = (depth * camera.matrixWorld.elements[9] - camera.position.y) / camera.matrixWorld.elements[5];
    for (const x of [-0.99, 0.99]) {
      const ground = new THREE.Vector3(x * halfHeight * aspect, localY, -depth).applyMatrix4(camera.matrixWorld);
      const screen = ground.clone().project(camera);
      const label = `aspect ${aspect}, heading ${heading}, screen x ${x}`;
      expect(Math.max(Math.abs(screen.x), Math.abs(screen.y), Math.abs(screen.z)), label).toBeLessThan(1);
      // The far plane limits view depth; corner rays travel farther than camera.far.
      ray.setFromCamera(new THREE.Vector2(screen.x, screen.y), camera);
      const hit = ray.intersectObject(cover)[0];
      expect(hit, label).toBeDefined();
      expect(hit.distance, label).toBeGreaterThan(camera.far);
      expect(hit.point.distanceTo(ground), label).toBeLessThan(0.0001);
    }
  }
  cover.geometry.dispose();
  material.dispose();
});
