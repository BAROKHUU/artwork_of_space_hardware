import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Surface } from '../data/types';
import type { RockField } from '../sim/obstacles';
import type { Terrain } from '../sim/terrain';
import { useGame } from '../state/store';
import { PALETTE, regolithFor, rockGeometry } from './Scenery';
import { TILE, fillTerrainTile, tileGeometry } from './terrainTiles';

/**
 * Endless ground: only the tiles around the camera exist. Near tiles are detailed, far ones coarse,
 * and fog hides where the last ring stops, so the surface seems to go on forever at a fixed cost.
 */
const RADIUS = 4;
/** Segments per tile by ring (Chebyshev distance from the camera's tile). */
const RINGS = [{ upTo: 1, segments: 24 }, { upTo: 2, segments: 12 }, { upTo: RADIUS, segments: 6 }];
const ROCK_RADIUS = 3;
const MAX_ROCKS_PER_CELL = 8;
/** Vertex budget per frame once the first view is built; about one detailed tile. */
const FRAME_BUDGET = 1400;

export const FOG_NEAR = TILE * (RADIUS - 1.6);
export const FOG_FAR = TILE * (RADIUS + 0.35);

const ringOf = (dx: number, dz: number) => Math.max(Math.abs(dx), Math.abs(dz));
const lodFor = (ring: number) => RINGS.findIndex((r) => ring <= r.upTo);

interface Slot { mesh: THREE.Mesh; lod: number; key: number | null }
const keyOf = (x: number, z: number) => x * 65536 + z;

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
  const scene = useMemo(() => {
    const ground = regolithFor(world);
    const material = new THREE.MeshStandardMaterial({ vertexColors: true, map: ground.map, bumpMap: ground.bump, bumpScale: world === 'moon' ? 0.18 : 1.4, roughness: 1 });
    const group = new THREE.Group();
    // Far below the last ring and lost in fog: only shows if a tile is still being built.
    const horizon = new THREE.Mesh(new THREE.PlaneGeometry(1800, 1800), new THREE.MeshStandardMaterial({ color: PALETTE[world].low, roughness: 1 }));
    horizon.rotation.x = -Math.PI / 2;
    horizon.position.y = -20;
    group.add(horizon);
    const pools = RINGS.map((ring, lod) => {
      const inner = lod === 0 ? 0 : (RINGS[lod - 1].upTo * 2 + 1) ** 2;
      const slots = (ring.upTo * 2 + 1) ** 2 - inner;
      const segments = Math.max(4, low ? Math.round(ring.segments / 2) : ring.segments);
      return Array.from({ length: slots }, (): Slot => {
        const mesh = new THREE.Mesh(tileGeometry(segments), material);
        mesh.receiveShadow = true;
        mesh.visible = false;
        group.add(mesh);
        return { mesh, lod, key: null };
      });
    });
    return { group, pools, material, horizon, active: new Map<number, Slot>(), built: false, center: NaN, pending: true };
  }, [terrain, world, low]);
  useEffect(() => () => {
    scene.pools.flat().forEach(({ mesh }) => mesh.geometry.dispose());
    scene.material.dispose();
    scene.horizon.geometry.dispose();
    (scene.horizon.material as THREE.Material).dispose();
  }, [scene]);

  useFrame(({ camera }) => {
    const cx = Math.floor(camera.position.x / TILE + 0.5);
    const cz = Math.floor(camera.position.z / TILE + 0.5);
    // Nothing to do until the camera enters another tile or tiles are still being built.
    if (keyOf(cx, cz) === scene.center && !scene.pending) return;
    scene.center = keyOf(cx, cz);
    scene.horizon.position.set(cx * TILE, -20, cz * TILE);
    const wanted = new Map<number, { x: number; z: number; lod: number; ring: number }>();
    for (let dz = -RADIUS; dz <= RADIUS; dz++) for (let dx = -RADIUS; dx <= RADIUS; dx++) {
      const ring = ringOf(dx, dz);
      wanted.set(keyOf(cx + dx, cz + dz), { x: cx + dx, z: cz + dz, lod: lodFor(ring), ring });
    }
    // Tiles that left the view or changed detail go back to their pool.
    for (const [key, slot] of scene.active) {
      const want = wanted.get(key);
      if (!want || want.lod !== slot.lod) {
        slot.key = null;
        scene.active.delete(key);
        if (!want) slot.mesh.visible = false;
      }
    }
    const missing = [...wanted.entries()].filter(([key]) => !scene.active.has(key)).sort((a, b) => a[1].ring - b[1].ring);
    // The first view is built at once; afterwards, a small budget per frame keeps driving smooth.
    let budget = scene.built ? FRAME_BUDGET : Infinity;
    let filled = 0;
    for (const [key, want] of missing) {
      const slot = scene.pools[want.lod].find((s) => s.key === null);
      if (!slot) continue;
      const cost = slot.mesh.geometry.attributes.position.count;
      if (cost > budget && budget !== FRAME_BUDGET) break;
      budget -= cost;
      // Hide whatever tile of another detail level still sits here.
      for (const pool of scene.pools) for (const other of pool) if (other.key === null && other !== slot && other.mesh.visible && other.mesh.position.x === want.x * TILE && other.mesh.position.z === want.z * TILE) other.mesh.visible = false;
      fillTerrainTile(slot.mesh.geometry, terrain, PALETTE[world], want.x, want.z);
      slot.mesh.position.set(want.x * TILE, 0, want.z * TILE);
      slot.mesh.visible = true;
      slot.key = key;
      scene.active.set(key, slot);
      filled++;
      if (budget <= 0) break;
    }
    scene.pending = filled < missing.length;
    // Idle slots that are no longer anywhere in view stay hidden.
    for (const pool of scene.pools) for (const s of pool) {
      if (s.key !== null || !s.mesh.visible) continue;
      const tx = Math.round(s.mesh.position.x / TILE);
      const tz = Math.round(s.mesh.position.z / TILE);
      if (!wanted.has(keyOf(tx, tz)) || scene.active.has(keyOf(tx, tz))) s.mesh.visible = false;
    }
    scene.built = true;
  });

  const sky = PALETTE[world].sky;
  return (
    <>
      {/* Earth and Mars skies bring their own fog; the airless Moon only needs it to hide the last ring. */}
      {world === 'moon' && <fog attach="fog" args={[sky, FOG_NEAR, FOG_FAR]} />}
      <primitive object={scene.group} />
      {rocks && <StreamedRocks field={rocks} world={world} />}
    </>
  );
}
