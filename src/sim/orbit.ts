/** Planar Sun + Jupiter model in AU and years. Good enough to show a real gravity assist. */
const GM_SUN = 4 * Math.PI * Math.PI;
const JUPITER_MASS_RATIO = 9.546e-4;
export const JUPITER_ORBIT_AU = 5.204;
const JUPITER_RATE = (2 * Math.PI) / 11.862;
const JUPITER_RADIUS_AU = 0.000478;
export const KMS_PER_AU_YR = 4.7404;
const RAD = Math.PI / 180;

/** The flyby must add at least this much heliocentric speed to count as a slingshot. */
export const BOOST_GAIN_KMS = 1;

export type SlingshotOutcome = 'boosted' | 'short' | 'missed' | 'bound' | 'hit';

export interface SlingshotInput {
  /** Where Jupiter sits, in degrees ahead of Earth, on launch day. */
  jupiterStartDeg: number;
  /** Heliocentric launch speed in km/s. */
  speedKms: number;
  /** 1 is the real Jupiter, 0 removes it. */
  jupiterMass?: number;
  maxYears?: number;
}

export interface SlingshotResult {
  path: [number, number, number][];
  outcome: SlingshotOutcome;
  closestAU: number;
  closestYear: number;
  speedBeforeKms: number;
  speedAfterKms: number;
  durationYears: number;
  jupiterStartDeg: number;
}

export function jupiterAt(startDeg: number, t: number): [number, number] {
  const a = startDeg * RAD + JUPITER_RATE * t;
  return [JUPITER_ORBIT_AU * Math.cos(a), JUPITER_ORBIT_AU * Math.sin(a)];
}

type V = [number, number, number, number];

function deriv(t: number, s: V, startDeg: number, gmJ: number): V {
  const [x, y, vx, vy] = s;
  const r3 = Math.hypot(x, y) ** 3;
  const [jx, jy] = jupiterAt(startDeg, t);
  const dx = jx - x;
  const dy = jy - y;
  const d3 = Math.max(Math.hypot(dx, dy), 1e-5) ** 3;
  return [vx, vy, (-GM_SUN * x) / r3 + (gmJ * dx) / d3, (-GM_SUN * y) / r3 + (gmJ * dy) / d3];
}

const add = (s: V, k: V, h: number): V => [s[0] + k[0] * h, s[1] + k[1] * h, s[2] + k[2] * h, s[3] + k[3] * h];

export function simulateSlingshot(input: SlingshotInput): SlingshotResult {
  const { jupiterStartDeg, speedKms, jupiterMass = 1, maxYears = 14 } = input;
  const gmJ = GM_SUN * JUPITER_MASS_RATIO * jupiterMass;
  let s: V = [1, 0, 0, speedKms / KMS_PER_AU_YR];
  let t = 0;
  let closestAU = Infinity;
  let closestYear = 0;
  let maxR = 1;
  let hit = false;
  let speedIn = 0;
  let energyIn = 0;
  let energyOut: number | null = null;
  let lastSample = -1;
  const path: [number, number, number][] = [];

  while (t < maxYears) {
    const r = Math.hypot(s[0], s[1]);
    const [jx, jy] = jupiterAt(jupiterStartDeg, t);
    const rJ = Math.hypot(jx - s[0], jy - s[1]);
    maxR = Math.max(maxR, r);
    if (rJ < closestAU) {
      closestAU = rJ;
      closestYear = t;
    }
    const speedNow = Math.hypot(s[2], s[3]) * KMS_PER_AU_YR;
    const energyNow = (s[2] * s[2] + s[3] * s[3]) / 2 - GM_SUN / r;
    if (rJ < 1 && speedIn === 0) {
      speedIn = speedNow;
      energyIn = energyNow;
    }
    if (rJ >= 1 && speedIn > 0 && energyOut === null) energyOut = energyNow;
    if (t - lastSample >= 0.02 || rJ < 0.3) {
      path.push([s[0], s[1], t]);
      lastSample = t;
    }
    if (jupiterMass > 0 && rJ < JUPITER_RADIUS_AU) {
      hit = true;
      break;
    }
    if (r > 45) break;

    const h = Math.min(0.01, 0.02 * Math.min(r ** 1.5, jupiterMass > 0 ? rJ ** 1.5 / Math.sqrt(JUPITER_MASS_RATIO * jupiterMass) : Infinity));
    const dt = Math.max(h, 2e-6);
    const k1 = deriv(t, s, jupiterStartDeg, gmJ);
    const k2 = deriv(t + dt / 2, add(s, k1, dt / 2), jupiterStartDeg, gmJ);
    const k3 = deriv(t + dt / 2, add(s, k2, dt / 2), jupiterStartDeg, gmJ);
    const k4 = deriv(t + dt, add(s, k3, dt), jupiterStartDeg, gmJ);
    s = [
      s[0] + (dt / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]),
      s[1] + (dt / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]),
      s[2] + (dt / 6) * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]),
      s[3] + (dt / 6) * (k1[3] + 2 * k2[3] + 2 * k3[3] + k4[3]),
    ];
    t += dt;
  }
  path.push([s[0], s[1], t]);

  const speedEnd = Math.hypot(s[2], s[3]) * KMS_PER_AU_YR;
  const speedBeforeKms = speedIn || speedEnd;
  // Orbital energy isolates Jupiter's contribution from the Sun's slowing pull during the encounter.
  const energyGain = speedIn > 0 ? (energyOut ?? (speedEnd / KMS_PER_AU_YR) ** 2 / 2 - GM_SUN / Math.hypot(s[0], s[1])) - energyIn : 0;
  const speedAfterKms = Math.sqrt(Math.max(0, speedBeforeKms ** 2 + 2 * energyGain * KMS_PER_AU_YR ** 2));
  const outcome: SlingshotOutcome = hit
    ? 'hit'
    : speedAfterKms - speedBeforeKms >= BOOST_GAIN_KMS
      ? 'boosted'
      : maxR < JUPITER_ORBIT_AU - 0.25
        ? 'short'
        : closestAU > 0.6
          ? 'missed'
          : 'bound';

  return {
    path,
    outcome,
    closestAU,
    closestYear,
    speedBeforeKms,
    speedAfterKms,
    durationYears: t,
    jupiterStartDeg,
  };
}
