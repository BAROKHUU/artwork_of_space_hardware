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
