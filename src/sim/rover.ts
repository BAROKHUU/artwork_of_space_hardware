export interface BatteryParams {
  drainPerSecond: number;
  chargePerSecond: number;
  solLength: number;
  /** Seconds until the dust fully blocks the Sun. Infinity means no storm. */
  stormAt: number;
}

export const sunlight = (t: number, solLength: number) => Math.max(0, Math.sin((t / solLength) * Math.PI * 2 + 0.6));
export const dustLevel = (t: number, stormAt: number) => (Number.isFinite(stormAt) ? Math.min(1, (t / stormAt) ** 3) : 0);

export function stepBattery(level: number, moving: boolean, t: number, p: BatteryParams, dt: number): number {
  const solar = sunlight(t, p.solLength) * (1 - dustLevel(t, p.stormAt)) * p.chargePerSecond;
  return Math.min(100, Math.max(0, level + (solar - (moving ? p.drainPerSecond : 0)) * dt));
}

export interface GroundPose { y: number; pitch: number; roll: number }

/** Fit the wheel footprint, then lift the rigid chassis until every tire clears the ground. */
export function roverGroundPose(
  heightAt: (x: number, z: number) => number, x: number, z: number, heading: number,
  halfTrack: number, halfWheelbase: number, wheelRadius: number, out: GroundPose,
): GroundPose {
  const c = Math.cos(heading), s = Math.sin(heading);
  const sample = (u: number, v: number) => heightAt(x + c * u + s * v, z - s * u + c * v);
  const fl = sample(-halfTrack, -halfWheelbase), fr = sample(halfTrack, -halfWheelbase);
  const rl = sample(-halfTrack, halfWheelbase), rr = sample(halfTrack, halfWheelbase);
  out.pitch = Math.atan2(fl + fr - rl - rr, 4 * halfWheelbase);
  out.roll = Math.atan2((fr + rr - fl - rl) * Math.cos(out.pitch), 4 * halfTrack);
  const cp = Math.cos(out.pitch), sp = Math.sin(out.pitch), cr = Math.cos(out.roll), sr = Math.sin(out.roll);
  out.y = -Infinity;
  for (let side = -1; side <= 1; side += 2) for (let axle = -1; axle <= 1; axle += 2) {
    const u = side * halfTrack, v = axle * halfWheelbase;
    const rx = cr * u - sr * wheelRadius, ry = sr * u + cr * wheelRadius;
    const rz = sp * ry + cp * v;
    // ponytail: rigid chassis with spherical tire envelopes; add suspension only for independent wheel travel.
    out.y = Math.max(out.y, sample(rx, rz) + wheelRadius / (cp * cr) - (cp * ry - sp * v));
  }
  return out;
}
