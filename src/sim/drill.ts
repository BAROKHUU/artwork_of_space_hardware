import { makeRng } from './rng';

export type LayerKind = 'dust' | 'ejecta' | 'dense' | 'ice';

export interface CoreLayer {
  kind: LayerKind;
  endDepth: number;
  drillRate: number;
  heatRate: number;
}

export interface DrillState {
  depth: number;
  heat: number;
  jams: number;
  locked: boolean;
  releaseRequired: boolean;
  t: number;
  done: boolean;
  failed: boolean;
}

const COOL_RATE = 34;
const UNLOCK_HEAT = 35;

/** Builds three lunar or Martian regolith strata scaled to `targetDepth` from a deterministic seed. */
export function buildCoreLayers(targetDepth: number, seed: number, world: 'moon' | 'mars' = 'moon'): CoreLayer[] {
  const rng = makeRng(seed);
  const firstEnd = Number((targetDepth * (0.28 + rng() * 0.08)).toFixed(2));
  const secondEnd = Number((targetDepth * (0.64 + rng() * 0.08)).toFixed(2));
  return [
    { kind: 'dust', endDepth: firstEnd, drillRate: 0.36, heatRate: 16 },
    { kind: 'ejecta', endDepth: secondEnd, drillRate: 0.26, heatRate: 24 },
    { kind: world === 'mars' ? 'ice' : 'dense', endDepth: targetDepth, drillRate: 0.20, heatRate: world === 'mars' ? 28 : 32 },
  ];
}

export function layerAtDepth(layers: CoreLayer[], depth: number): CoreLayer {
  return layers.find((l) => depth < l.endDepth) ?? layers[layers.length - 1];
}

export function initialDrill(): DrillState {
  return { depth: 0, heat: 0, jams: 0, locked: false, releaseRequired: false, t: 0, done: false, failed: false };
}

export function stepDrill(
  s: DrillState,
  layers: CoreLayer[],
  targetDepth: number,
  maxJams: number,
  drilling: boolean,
  dt: number,
): DrillState {
  if (s.done || s.failed) return s;

  const releaseRequired = s.releaseRequired && drilling;
  const layer = layerAtDepth(layers, s.depth);
  const active = drilling && !s.locked && !releaseRequired;
  let heat = active ? s.heat + layer.heatRate * dt : Math.max(0, s.heat - COOL_RATE * dt);
  let depth = active ? Math.min(targetDepth, s.depth + layer.drillRate * dt) : s.depth;
  let jams = s.jams;
  let locked = s.locked;
  let nextReleaseRequired = releaseRequired;
  let failed = false;

  if (heat >= 100) {
    heat = 100;
    jams += 1;
    locked = true;
    nextReleaseRequired = true;
    if (jams >= maxJams) failed = true;
  } else if (locked && heat <= UNLOCK_HEAT && !nextReleaseRequired) {
    locked = false;
  }

  const done = !failed && depth >= targetDepth;
  if (done) depth = targetDepth;

  return { depth, heat, jams, locked, releaseRequired: nextReleaseRequired, t: s.t + dt, done, failed };
}
