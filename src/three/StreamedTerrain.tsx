import { useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { Surface } from '../data/types';
import type { RockField } from '../sim/obstacles';
import type { Terrain } from '../sim/terrain';
import { TILE_SIZE as SIZE, terrainSegments } from '../sim/terrainMesh';
import { useGame } from '../state/store';
import { PALETTE, regolithFor, rockGeometry } from './Scenery';

const RADIUS = 3;
// Cover diagonal far-plane corners on wide screens without adding vertices.
const HORIZON = 2048;

function fillTerrainVertices(g: THREE.BufferGeometry, terrain: Terrain, world: Surface, cx: number, cz: number, changed?: number[]) {
  const pos = g.attributes.position as THREE.BufferAttribute;
  const uv = g.attributes.uv as THREE.BufferAttribute;
  const color = g.attributes.color as THREE.BufferAttribute;
  const c = new THREE.Color();
  const { low, high } = PALETTE[world];
  for (let j = 0; j < (changed?.length ?? pos.count); j++) {
    const i = changed ? changed[j] : j;
    const x = cx * SIZE + pos.getX(i);
    const z = cz * SIZE + pos.getZ(i);
    const h = terrain.heightAt(x, z);
    pos.setY(i, h);
    uv.setXY(i, x / terrain.size + 0.5, 0.5 - z / terrain.size);
    const patches = Math.sin(x * 0.13) * Math.sin(z * 0.17) * 0.09 + Math.sin(x * 0.41 + z * 0.23) * 0.05;
    c.copy(low).lerp(high, THREE.MathUtils.clamp(0.62 + h * 0.09 + patches, 0, 1));
    color.setXYZ(i, c.r, c.g, c.b);
  }
  pos.needsUpdate = uv.needsUpdate = color.needsUpdate = true;
  if (!changed) g.computeVertexNormals();
}

/** Rebuild a reusable tile from world coordinates so adjacent edges agree. */
export function fillTerrainTile(g: THREE.PlaneGeometry, terrain: Terrain, world: Surface, cx: number, cz: number, segments: number) {
  fillTerrainVertices(g, terrain, world, cx, cz);
  // Shared world-space derivatives prevent lighting seams at tile boundaries.
  const pos = g.attributes.position as THREE.BufferAttribute;
  const normal = g.attributes.normal as THREE.BufferAttribute;
  const step = SIZE / segments;
  const n = new THREE.Vector3();
  for (let row = 0; row <= segments; row++) for (let col = 0; col <= segments; col++) {
    if (row !== 0 && row !== segments && col !== 0 && col !== segments) continue;
    const i = row * (segments + 1) + col;
    const x = cx * SIZE + pos.getX(i), z = cz * SIZE + pos.getZ(i);
    n.set(terrain.heightAt(x - step, z) - terrain.heightAt(x + step, z), 2 * step, terrain.heightAt(x, z - step) - terrain.heightAt(x, z + step)).normalize();
    normal.setXYZ(i, n.x, n.y, n.z);
  }
  normal.needsUpdate = true;
  g.computeBoundingSphere();
}

/** One connected background: exact central grid, progressively wider outer rings. */
export function makeTerrainCover(terrain: Terrain, world: Surface, segments: number, cx: number, cz: number) {
  const count = (RADIUS * 2 + 1) * segments;
  const half = SIZE * (RADIUS + 0.5);
  const geometry = new THREE.PlaneGeometry(half * 2, half * 2, count, count);
  geometry.rotateX(-Math.PI / 2);
  const positions = Array.from(geometry.attributes.position.array);
  const indices = Array.from(geometry.index!.array);
  let edge: number[] = [];
  for (let i = 0; i < count; i++) edge.push(i);
  for (let i = 0; i < count; i++) edge.push(i * (count + 1) + count);
  for (let i = count; i > 0; i--) edge.push(count * (count + 1) + i);
  for (let i = count; i > 0; i--) edge.push(i * (count + 1));
  for (const extent of [half + SIZE, half + SIZE * 3, half + SIZE * 7, HORIZON]) {
    const next = edge.map((_, i) => {
      const side = Math.floor(i / count), t = i % count / count;
      positions.push(side === 0 ? -extent + t * extent * 2 : side === 1 ? extent : side === 2 ? extent - t * extent * 2 : -extent,
        0, side === 0 ? -extent : side === 1 ? -extent + t * extent * 2 : side === 2 ? extent : extent - t * extent * 2);
      return positions.length / 3 - 1;
    });
    for (let i = 0; i < edge.length; i++) {
      const j = (i + 1) % edge.length;
      indices.push(edge[i], edge[j], next[i], edge[j], next[j], next[i]);
    }
    edge = next;
  }
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(positions.length / 3 * 2), 2));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(positions.length), 3));
  geometry.deleteAttribute('normal');
  geometry.setIndex(indices);
  fillTerrainVertices(geometry, terrain, world, cx, cz);
  const pos = geometry.attributes.position as THREE.BufferAttribute;
  const normal = geometry.attributes.normal as THREE.BufferAttribute;
  const step = SIZE / segments, n = new THREE.Vector3();
  for (let i = 0; i < (count + 1) ** 2; i++) {
    if (Math.floor(i / (count + 1)) % segments !== 0 && i % (count + 1) % segments !== 0) continue;
    const x = cx * SIZE + pos.getX(i), z = cz * SIZE + pos.getZ(i);
    n.set(terrain.heightAt(x - step, z) - terrain.heightAt(x + step, z), 2 * step, terrain.heightAt(x, z - step) - terrain.heightAt(x, z + step)).normalize();
    normal.setXYZ(i, n.x, n.y, n.z);
  }
  normal.needsUpdate = true;
  geometry.computeBoundingSphere();
  geometry.userData.center = { x: cx, z: cz };
  return geometry;
}

/** Keep overlapping samples; only the new strip and distant rings need resampling. */
export function updateTerrainCover(g: THREE.PlaneGeometry, terrain: Terrain, world: Surface, segments: number, cx: number, cz: number) {
  const count = (RADIUS * 2 + 1) * segments, previous = g.userData.center as { x: number; z: number };
  const dx = (cx - previous.x) * segments, dz = (cz - previous.z) * segments;
  if (!dx && !dz) return;
  const pos = g.attributes.position as THREE.BufferAttribute, uv = g.attributes.uv as THREE.BufferAttribute;
  const color = g.attributes.color as THREE.BufferAttribute, normal = g.attributes.normal as THREE.BufferAttribute;
  const old = { position: pos.array.slice(), uv: uv.array.slice(), color: color.array.slice(), normal: normal.array.slice() };
  const changed: number[] = [];
  for (let i = 0; i < pos.count; i++) {
    const row = Math.floor(i / (count + 1)), col = i % (count + 1);
    if (row > count || row + dz < 0 || row + dz > count || col + dx < 0 || col + dx > count) {
      changed.push(i);
      continue;
    }
    const from = (row + dz) * (count + 1) + col + dx;
    pos.setY(i, old.position[from * 3 + 1]);
    uv.setXY(i, old.uv[from * 2], old.uv[from * 2 + 1]);
    color.setXYZ(i, old.color[from * 3], old.color[from * 3 + 1], old.color[from * 3 + 2]);
  }
  fillTerrainVertices(g, terrain, world, cx, cz, changed);
  g.computeVertexNormals();
  for (let row = 0; row <= count; row++) for (let col = 0; col <= count; col++) {
    if (row + dz < 0 || row + dz > count || col + dx < 0 || col + dx > count) continue;
    const i = row * (count + 1) + col, from = (row + dz) * (count + 1) + col + dx;
    normal.setXYZ(i, old.normal[from * 3], old.normal[from * 3 + 1], old.normal[from * 3 + 2]);
  }
  const step = SIZE / segments, n = new THREE.Vector3();
  for (const i of changed) {
    if (i >= (count + 1) ** 2 || (Math.floor(i / (count + 1)) % segments !== 0 && i % (count + 1) % segments !== 0)) continue;
    const x = cx * SIZE + pos.getX(i), z = cz * SIZE + pos.getZ(i);
    n.set(terrain.heightAt(x - step, z) - terrain.heightAt(x + step, z), 2 * step, terrain.heightAt(x, z - step) - terrain.heightAt(x, z + step)).normalize();
    normal.setXYZ(i, n.x, n.y, n.z);
  }
  normal.needsUpdate = true;
  g.computeBoundingSphere();
  g.userData.center = { x: cx, z: cz };
}

export function makeTerrainTiles(terrain: Terrain, world: Surface, segments: number, material: THREE.Material, cx: number, cz: number) {
  return Array.from({ length: (RADIUS * 2 + 1) ** 2 }, (_, i) => {
    const geometry = new THREE.PlaneGeometry(SIZE, SIZE, segments, segments);
    geometry.rotateX(-Math.PI / 2);
    geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(geometry.attributes.position.count * 3), 3));
    const mesh = new THREE.Mesh(geometry, material);
    mesh.receiveShadow = true;
    const x = cx + i % (RADIUS * 2 + 1) - RADIUS, z = cz + Math.floor(i / (RADIUS * 2 + 1)) - RADIUS;
    fillTerrainTile(geometry, terrain, world, x, z, segments);
    mesh.position.set(x * SIZE, 0, z * SIZE);
    return { mesh, x, z };
  });
}

const ROCK_RADIUS = 3;
const MAX_ROCKS_PER_CELL = 8;
const keyOf = (x: number, z: number) => `${x},${z}`;

function StreamedRocks({ field, world }: { field: RockField; world: Surface }) {
  const mesh = useMemo(() => {
    const capacity = (ROCK_RADIUS * 2 + 1) ** 2 * MAX_ROCKS_PER_CELL;
    const m = new THREE.InstancedMesh(rockGeometry(), new THREE.MeshStandardMaterial({ color: PALETTE[world].rock, roughness: 0.95, flatShading: true }), capacity);
    m.castShadow = m.receiveShadow = true;
    m.count = 0;
    m.frustumCulled = false;
    m.userData.center = null;
    return m;
  }, [world]);
  useEffect(() => () => (mesh.material as THREE.Material).dispose(), [mesh]);
  useFrame(({ camera }) => {
    const cx = Math.floor(camera.position.x / field.cell);
    const cz = Math.floor(camera.position.z / field.cell);
    const center = keyOf(cx, cz);
    if (mesh.userData.center === center) return;
    mesh.userData.center = center;
    const o = new THREE.Object3D();
    let i = 0;
    for (let dz = -ROCK_RADIUS; dz <= ROCK_RADIUS; dz++) for (let dx = -ROCK_RADIUS; dx <= ROCK_RADIUS; dx++) {
      for (const r of field.at(cx + dx, cz + dz).slice(0, MAX_ROCKS_PER_CELL)) {
        o.position.set(r.x, r.y, r.z);
        o.rotation.set(...r.rotation);
        o.scale.set(...r.scale);
        o.updateMatrix();
        mesh.setMatrixAt(i++, o.matrix);
      }
    }
    mesh.count = i;
    mesh.instanceMatrix.needsUpdate = true;
  });
  return <primitive object={mesh} />;
}

export function StreamedTerrain({ terrain, world, rocks }: { terrain: Terrain; world: Surface; rocks?: RockField }) {
  const low = useGame((s) => s.quality) === 'low';
  const camera = useThree((s) => s.camera);
  const scene = useMemo(() => {
    const segments = terrainSegments(low);
    const cx = Math.floor(camera.position.x / SIZE + 0.5), cz = Math.floor(camera.position.z / SIZE + 0.5);
    const ground = regolithFor(world);
    const material = new THREE.MeshStandardMaterial({ vertexColors: true, map: ground.map, bumpMap: ground.bump, bumpScale: world === 'moon' ? 0.18 : 1.4, roughness: 1 });
    const group = new THREE.Group();
    const horizon = new THREE.Mesh(makeTerrainCover(terrain, world, segments, cx, cz), material);
    horizon.position.set(cx * SIZE, -0.001, cz * SIZE);
    horizon.receiveShadow = true;
    group.add(horizon);
    const tiles = makeTerrainTiles(terrain, world, segments, material, cx, cz);
    group.add(...tiles.map(({ mesh }) => mesh));
    return { group, tiles, segments, material, horizon, cx, cz };
  }, [terrain, world, low, camera]);
  useEffect(() => () => {
    scene.tiles.forEach(({ mesh }) => mesh.geometry.dispose());
    scene.material.dispose();
    scene.horizon.geometry.dispose();
  }, [scene]);
  useFrame(({ camera }) => {
    const cx = Math.floor(camera.position.x / SIZE + 0.5), cz = Math.floor(camera.position.z / SIZE + 0.5);
    if (scene.cx !== cx || scene.cz !== cz) {
      updateTerrainCover(scene.horizon.geometry, terrain, world, scene.segments, cx, cz);
      scene.horizon.position.set(cx * SIZE, -0.001, cz * SIZE);
      scene.cx = cx; scene.cz = cz;
    }
    // At most one tile per frame; retain existing tiles until their replacements are ready.
    let targetX = 0, targetZ = 0, best = Infinity;
    for (let dz = -RADIUS; dz <= RADIUS; dz++) for (let dx = -RADIUS; dx <= RADIUS; dx++) {
      const x = cx + dx, z = cz + dz, distance = dx * dx + dz * dz;
      if (distance < best && !scene.tiles.some((tile) => tile.x === x && tile.z === z)) {
        targetX = x; targetZ = z; best = distance;
      }
    }
    if (best === Infinity) return;
    const tile = scene.tiles.find((t) => Math.abs(t.x - cx) > RADIUS || Math.abs(t.z - cz) > RADIUS);
    if (!tile) return;
    fillTerrainTile(tile.mesh.geometry, terrain, world, targetX, targetZ, scene.segments);
    tile.x = targetX; tile.z = targetZ;
    tile.mesh.position.set(targetX * SIZE, 0, targetZ * SIZE);
    tile.mesh.visible = true;
  });
  return <><primitive object={scene.group} />{rocks && <StreamedRocks field={rocks} world={world} />}</>;
}
