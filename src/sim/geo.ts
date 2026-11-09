const RAD = Math.PI / 180;

/**
 * Lat/lon (degrees, east positive) to a point on a sphere whose longitude 0 faces +z.
 * Pair with a mesh rotated -90 degrees about Y so an equirectangular map lines up.
 */
export function latLonToVec3(lat: number, lon: number, r: number): [number, number, number] {
  const la = lat * RAD;
  const lo = lon * RAD;
  return [r * Math.cos(la) * Math.sin(lo), r * Math.sin(la), r * Math.cos(la) * Math.cos(lo)];
}

export function vec3ToLatLon(x: number, y: number, z: number): { lat: number; lon: number } {
  const r = Math.hypot(x, y, z);
  return { lat: Math.asin(y / r) / RAD, lon: Math.atan2(x, z) / RAD };
}

/** Great-circle separation between two lat/lon points, in degrees. */
export function angularDistanceDeg(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const dLa = (b.lat - a.lat) * RAD;
  const dLo = (b.lon - a.lon) * RAD;
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin(dLo / 2) ** 2;
  return (2 * Math.asin(Math.min(1, Math.sqrt(h)))) / RAD;
}
