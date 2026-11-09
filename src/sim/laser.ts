export const LIGHT_KM_S = 299792.458;
export const MOON_DISTANCE_KM = 384400;
export const MOON_RECESSION_CM_PER_YEAR = 3.8;

export const roundTripSeconds = (distanceKm: number) => (2 * distanceKm) / LIGHT_KM_S;
export const distanceFromEcho = (seconds: number) => (seconds * LIGHT_KM_S) / 2;

/** How far the Moon has drifted, in metres, since the Apollo 11 reflector arrived in 1969. */
export function moonDriftMeters(now: Date, sinceYear = 1969.55): number {
  const years = now.getUTCFullYear() + now.getUTCMonth() / 12 - sinceYear;
  return (years * MOON_RECESSION_CM_PER_YEAR) / 100;
}
