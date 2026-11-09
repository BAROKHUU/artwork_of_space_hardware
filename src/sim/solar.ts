import planetData from '../data/generated/planets.json';
import { KMS_PER_AU_YR } from './orbit';

export const PLANET_IDS = ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'] as const;
export type PlanetId = (typeof PLANET_IDS)[number];
export type SolarScale = 'compressed' | 'true';
export type Vec3 = [number, number, number];

const RAD = Math.PI / 180;
const GM_SUN = 4 * Math.PI * Math.PI;
const MS_J2000 = Date.UTC(2000, 0, 1, 12);
const MS_CENTURY = 36525 * 86400000;
export const MS_PER_YEAR = 365.25 * 86400000;

/** Inside the 3000 BC to 3000 AD span of the JPL elements. */
export const TIME_MIN = Date.UTC(1000, 0, 1);
export const TIME_MAX = Date.UTC(3000, 0, 1);

const MIN_DAYS_PER_SECOND = 1;
const MAX_DAYS_PER_SECOND = 36525;
const SPEED_RANGE = Math.log10(MAX_DAYS_PER_SECOND / MIN_DAYS_PER_SECOND);

/** Maps a 0-100 slider to simulated days per real second, on a log scale. */
export const speedFromSlider = (v: number) => MIN_DAYS_PER_SECOND * 10 ** ((v / 100) * SPEED_RANGE);
export const sliderFromSpeed = (daysPerSecond: number) => (Math.log10(daysPerSecond / MIN_DAYS_PER_SECOND) / SPEED_RANGE) * 100;

interface Elements {
  a: number;
  e: number;
  inclination: number;
  meanAnomaly: number;
  argPeri: number;
  node: number;
}

function elementsAt(id: PlanetId, ms: number): Elements {
  const { base, rate, extra } = planetData.planets[id];
  const T = (ms - MS_J2000) / MS_CENTURY;
  const [a, e, I, L, peri, node] = base.map((v, i) => v + rate[i] * T);
  // Jupiter to Neptune carry extra long-period terms over this long a span.
  const [b, c, s, f] = extra;
  const correction = b * T * T + c * Math.cos(f * T * RAD) + s * Math.sin(f * T * RAD);
  return { a, e, inclination: I * RAD, meanAnomaly: (L - peri + correction) * RAD, argPeri: (peri - node) * RAD, node: node * RAD };
}

function solveKepler(meanAnomaly: number, e: number): number {
  const turn = 2 * Math.PI;
  const M = ((((meanAnomaly + Math.PI) % turn) + turn) % turn) - Math.PI;
  let E = M + e * Math.sin(M);
  for (let i = 0; i < 6; i++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  return E;
}

function fromEccentricAnomaly(el: Elements, E: number, out: Vec3): Vec3 {
  const xp = el.a * (Math.cos(E) - el.e);
  const yp = el.a * Math.sqrt(1 - el.e * el.e) * Math.sin(E);
  const cw = Math.cos(el.argPeri);
  const sw = Math.sin(el.argPeri);
  const cO = Math.cos(el.node);
  const sO = Math.sin(el.node);
  const cI = Math.cos(el.inclination);
  const sI = Math.sin(el.inclination);
  out[0] = (cw * cO - sw * sO * cI) * xp + (-sw * cO - cw * sO * cI) * yp;
  out[1] = (cw * sO + sw * cO * cI) * xp + (-sw * sO + cw * cO * cI) * yp;
  out[2] = sw * sI * xp + cw * sI * yp;
  return out;
}

/** Heliocentric ecliptic position in AU. Writes into `out` so it can run every frame without garbage. */
export function heliocentric(id: PlanetId, ms: number, out: Vec3 = [0, 0, 0]): Vec3 {
  const el = elementsAt(id, ms);
  return fromEccentricAnomaly(el, solveKepler(el.meanAnomaly, el.e), out);
}

export const orbitalPeriodYears = (id: PlanetId) => planetData.planets[id].base[0] ** 1.5;

/** Current orbital speed from the vis-viva equation, in km/s. */
export function orbitalSpeedKms(id: PlanetId, ms: number, r: number): number {
  return Math.sqrt(GM_SUN * (2 / r - 1 / elementsAt(id, ms).a)) * KMS_PER_AU_YR;
}

/** One full ellipse as flat x, y, z values, closed back to its start. */
export function orbitPoints(id: PlanetId, ms: number, segments: number): Float32Array {
  const el = elementsAt(id, ms);
  const out = new Float32Array((segments + 1) * 3);
  const p: Vec3 = [0, 0, 0];
  for (let i = 0; i <= segments; i++) {
    fromEccentricAnomaly(el, (i / segments) * Math.PI * 2, p);
    out.set(p, i * 3);
  }
  return out;
}

/** How planets are drawn, in scene units. Sizes are enlarged; these numbers set how close they may get. */
export const PLANET_RADIUS: Record<PlanetId, number> = { mercury: 0.05, venus: 0.08, earth: 0.085, mars: 0.065, jupiter: 0.2, saturn: 0.17, uranus: 0.12, neptune: 0.12 };
export const ATMOSPHERE_SCALE = 1.1;
export const SATURN_RING_OUTER = 2.27;
export const MOON_ORBIT_RADIUS = PLANET_RADIUS.earth * 2;
export const MOON_RADIUS = PLANET_RADIUS.earth * 0.27;

const COMPRESSED_SCALE = 1.35;
const COMPRESSED_SOFTENING_AU = 0.25;
const TRUE_SCALE_UNITS_PER_AU = 0.45;

/** Planets are drawn smaller in the true-distance view, where the inner orbits sit close together. */
export const sizeFactor = (scale: SolarScale) => (scale === 'true' ? 0.4 : 1);

/** How far from its centre anything belonging to a planet reaches: rings, atmosphere, or the Moon. */
export function bodyReach(id: PlanetId): number {
  if (id === 'earth') return MOON_ORBIT_RADIUS + MOON_RADIUS;
  if (id === 'saturn') return PLANET_RADIUS.saturn * SATURN_RING_OUTER;
  return PLANET_RADIUS[id] * ATMOSPHERE_SCALE;
}

/** Distance from the Sun on screen, for a distance in AU. Always increases, so orbits keep their order. */
export function sceneRadius(au: number, scale: SolarScale): number {
  return scale === 'true' ? au * TRUE_SCALE_UNITS_PER_AU : COMPRESSED_SCALE * Math.log(1 + au / COMPRESSED_SOFTENING_AU);
}

/**
 * Ecliptic AU to scene units, with ecliptic north as +y.
 * The compressed view spreads the crowded inner planets apart while still fitting Neptune on screen.
 */
export function toScene(p: Vec3, scale: SolarScale, out: Vec3): Vec3 {
  const r = Math.hypot(p[0], p[1], p[2]);
  const k = r > 0 ? sceneRadius(r, scale) / r : 0;
  out[0] = p[0] * k;
  out[1] = p[2] * k;
  out[2] = -p[1] * k;
  return out;
}

export interface ProbeTrack {
  startISO: string;
  xyz: number[];
}

/**
 * Probe position between its table rows. Past the table the probe is far from every planet,
 * so it coasts in a straight line along its final direction. Returns false before launch.
 */
export function probePosition(track: ProbeTrack, stepDays: number, ms: number, out: Vec3): boolean {
  const i = (ms - Date.parse(`${track.startISO}T00:00:00Z`)) / (stepDays * 86400000);
  const last = track.xyz.length / 3 - 1;
  if (i < 0) return false;
  if (i > last) {
    for (let c = 0; c < 3; c++) out[c] = track.xyz[last * 3 + c] + (track.xyz[last * 3 + c] - track.xyz[(last - 1) * 3 + c]) * (i - last);
    return true;
  }
  const low = Math.min(Math.floor(i), last - 1);
  const f = i - low;
  for (let c = 0; c < 3; c++) out[c] = track.xyz[low * 3 + c] + (track.xyz[(low + 1) * 3 + c] - track.xyz[low * 3 + c]) * f;
  return true;
}
