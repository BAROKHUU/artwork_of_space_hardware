import { describe, expect, it } from 'vitest';
import { Euler, Vector3 } from 'three';
import { roverGroundPose } from './rover';

describe('rover ground contact', () => {
  const track = 0.69, wheelbase = 0.866, radius = 0.33;
  const pose = () => ({ y: 0, pitch: 0, roll: 0 });

  it('keeps the wheel bottoms on level ground and reuses its output', () => {
    const out = pose();
    expect(roverGroundPose(() => 2, 3, -4, 1, track, wheelbase, radius, out)).toBe(out);
    expect(out).toEqual({ y: 2, pitch: 0, roll: 0 });
  });

  it('aligns with a slope at every heading, with no tire penetrating the surface', () => {
    const height = (x: number, z: number) => 0.23 * x + 0.13 * z;
    const normal = new Vector3(-0.23, 1, -0.13).normalize();
    for (const heading of [0, 0.7, Math.PI / 2, Math.PI, -2.1]) {
      const p = roverGroundPose(height, 3, -4, heading, track, wheelbase, radius, pose());
      const rotation = new Euler(p.pitch, heading, p.roll, 'YXZ');
      expect(new Vector3(0, 1, 0).applyEuler(rotation).distanceTo(normal)).toBeLessThan(1e-10);
      expect(p.y).toBeCloseTo(height(3, -4), 10);
      for (const x of [-track, track]) for (const z of [-wheelbase, wheelbase]) {
        const center = new Vector3(x, radius, z).applyEuler(rotation).add(new Vector3(3, p.y, -4));
        const clearance = (center.y - height(center.x, center.z)) / Math.hypot(0.23, 1, 0.13);
        expect(clearance).toBeGreaterThanOrEqual(radius - 1e-10);
      }
    }
  });

  it('lifts the chassis over an uneven wheel footprint', () => {
    const height = (x: number, z: number) => Math.sin(x * 2) * Math.cos(z) * 0.4;
    const p = roverGroundPose(height, 0, 0, 0.7, track, wheelbase, radius, pose());
    const rotation = new Euler(p.pitch, 0.7, p.roll, 'YXZ');
    for (const x of [-track, track]) for (const z of [-wheelbase, wheelbase]) {
      const center = new Vector3(x, radius, z).applyEuler(rotation);
      expect(p.y + center.y - radius).toBeGreaterThanOrEqual(height(center.x, center.z) - 1e-10);
    }
  });
});
