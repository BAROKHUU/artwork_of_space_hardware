export const TILE_SIZE = 32;
export const terrainSegments = (low: boolean) => low ? 12 : 24;

/** Sample the same two triangles as the rendered terrain grid. */
export function meshHeightAt(heightAt: (x: number, z: number) => number, segments: number) {
  const step = TILE_SIZE / segments;
  return (x: number, z: number) => {
    const gx = Math.floor(x / step) * step;
    const gz = Math.floor(z / step) * step;
    const u = (x - gx) / step;
    const v = (z - gz) / step;
    const a = heightAt(gx, gz);
    const b = heightAt(gx, gz + step);
    const d = heightAt(gx + step, gz);
    const c = heightAt(gx + step, gz + step);
    return u + v <= 1
      ? a + u * (d - a) + v * (b - a)
      : c + (1 - u) * (b - c) + (1 - v) * (d - c);
  };
}
