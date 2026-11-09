import table from '../data/generated/ephemeris.json';
import { LIGHT_KM_S } from './laser';

export const AU_KM = 149597870.7;
export type ProbeId = 'voyager1' | 'voyager2' | 'new_horizons' | 'pioneer10';

const START = Date.parse(`${table.startISO}T00:00:00Z`);
const STEP_MS = table.stepDays * 86400000;

/** Distance from Earth in AU, interpolated from the JPL Horizons table and clamped to its range. */
export function distanceAU(probe: ProbeId, when: Date): number {
  const rows = table.au[probe];
  const i = Math.min(rows.length - 1.0001, Math.max(0, (when.getTime() - START) / STEP_MS));
  const low = Math.floor(i);
  return rows[low] + (rows[low + 1] - rows[low]) * (i - low);
}

export const lightHours = (au: number) => (au * AU_KM) / LIGHT_KM_S / 3600;
