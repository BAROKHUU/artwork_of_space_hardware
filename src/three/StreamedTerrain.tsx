import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Surface } from '../data/types';
import type { Terrain } from '../sim/terrain';
import { useGame } from '../state/store';
import { PALETTE, regolithFor } from './Scenery';

const SIZE = 32;
const RADIUS = 3;

/** Rebuild a reusable tile from world coordinates so adjacent edges agree. */
export function fillTerrainTile(g: THREE.PlaneGeometry, terrain: Terrain, world: Surface, cx: number, cz: number, segments: number) {
  const pos = g.attributes.position as THREE.BufferAttribute;
  const uv = g.attributes.uv as THREE.BufferAttribute;
  const color = g.attributes.color as THREE.BufferAttribute;
  const c = new THREE.Color();
  const { low, high } = PALETTE[world];
  for (let i = 0; i < pos.count; i++) {
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
  g.computeVertexNormals();
  // Shared world-space derivatives prevent lighting seams at tile boundaries.
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

export function StreamedTerrain({ terrain, world }: { terrain: Terrain; world: Surface }) {
  const low = useGame((s) => s.quality) === 'low';
  const scene = useMemo(() => {
    const segments = low ? 12 : 24;
    const ground = regolithFor(world);
    const material = new THREE.MeshStandardMaterial({ vertexColors: true, map: ground.map, bumpMap: ground.bump, bumpScale: world === 'moon' ? 0.18 : 1.4, roughness: 1 });
    const group = new THREE.Group();
    // Distant fill covers the horizon while detailed tiles are streamed in.
    const horizon = new THREE.Mesh(new THREE.PlaneGeometry(1800, 1800), new THREE.MeshStandardMaterial({ color: PALETTE[world].low, roughness: 1 }));
    horizon.rotation.x = -Math.PI / 2;
    horizon.position.y = -20;
    group.add(horizon);
    const tiles = Array.from({ length: (RADIUS * 2 + 1) ** 2 }, () => {
      const geometry = new THREE.PlaneGeometry(SIZE, SIZE, segments, segments);
      geometry.rotateX(-Math.PI / 2);
      geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(geometry.attributes.position.count * 3), 3));
      const mesh = new THREE.Mesh(geometry, material);
      mesh.receiveShadow = true;
      mesh.visible = false;
      group.add(mesh);
      return { mesh, x: Infinity, z: Infinity };
    });
    return { group, tiles, segments, material, horizon };
  }, [terrain, world, low]);
  useEffect(() => () => {
    scene.tiles.forEach(({ mesh }) => mesh.geometry.dispose());
    scene.material.dispose();
    scene.horizon.geometry.dispose();
    (scene.horizon.material as THREE.Material).dispose();
  }, [scene]);
  useFrame(({ camera }) => {
    const cx = Math.floor(camera.position.x / SIZE + 0.5), cz = Math.floor(camera.position.z / SIZE + 0.5);
    scene.horizon.position.x = cx * SIZE;
    scene.horizon.position.z = cz * SIZE;
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
  return <primitive object={scene.group} />;
}
