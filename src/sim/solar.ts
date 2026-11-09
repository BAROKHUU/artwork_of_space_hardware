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

/** Inside the span of the JPL elements (1800-2050) and the probe tables (to 2049). */
export const TIME_MIN = Date.UTC(1800, 0, 1);
export const TIME_MAX = Date.UTC(2049, 10, 30);

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
  const { base, rate } = planetData.planets[id];
  const T = (ms - MS_J2000) / MS_CENTURY;
  const [a, e, I, L, peri, node] = base.map((v, i) => v + rate[i] * T);
  return { a, e, inclination: I * RAD, meanAnomaly: (L - peri) * RAD, argPeri: (peri - node) * RAD, node: node * RAD };
}

function solveKepler(meanAnomaly: number, e: number): number {
  const M = ((meanAnomaly + Math.PI) % (2 * Math.PI)) - Math.PI;
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

const COMPRESSED_POWER = 0.45;
const TRUE_SCALE_UNITS_PER_AU = 0.16;

/**
 * Ecliptic AU to scene units, with ecliptic north as +y.
 * The compressed view shrinks distance with a power law so Mercury and Neptune fit on one screen.
 */
export function toScene(p: Vec3, scale: SolarScale, out: Vec3): Vec3 {
  const r = Math.hypot(p[0], p[1], p[2]);
  const k = scale === 'true' ? TRUE_SCALE_UNITS_PER_AU : r > 0 ? r ** (COMPRESSED_POWER - 1) : 0;
  out[0] = p[0] * k;
  out[1] = p[2] * k;
  out[2] = -p[1] * k;
  return out;
}

export interface ProbeTrack {
  startISO: string;
  xyz: number[];
}

/** Probe position between its table rows. Returns false before launch or past the end of the table. */
export function probePosition(track: ProbeTrack, stepDays: number, ms: number, out: Vec3): boolean {
  const i = (ms - Date.parse(`${track.startISO}T00:00:00Z`)) / (stepDays * 86400000);
  const last = track.xyz.length / 3 - 1;
  if (i < 0 || i > last) return false;
  const low = Math.min(Math.floor(i), last - 1);
  const f = i - low;
  for (let c = 0; c < 3; c++) out[c] = track.xyz[low * 3 + c] + (track.xyz[(low + 1) * 3 + c] - track.xyz[low * 3 + c]) * f;
  return true;
}
