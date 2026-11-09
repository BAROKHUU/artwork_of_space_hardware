import { describe, expect, it } from 'vitest';
import trajectories from '../data/generated/trajectories.json';
import { MS_PER_YEAR, TIME_MAX, TIME_MIN, heliocentric, orbitPoints, orbitalPeriodYears, orbitalSpeedKms, probePosition, sliderFromSpeed, speedFromSlider, toScene, type PlanetId, type Vec3 } from './solar';

const DAY = Date.UTC(2026, 10, 9);
const dist = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const r = (p: Vec3) => Math.hypot(...p);

describe('planet positions', () => {
  // Heliocentric ecliptic vectors from JPL Horizons for 9 November 2026.
  const horizons: [PlanetId, Vec3, number][] = [
    ['earth', [0.68543, 0.71534, 0], 0.01],
    ['mars', [-0.39340, 1.55317, 0.04219], 0.01],
    ['jupiter', [-3.71037, 3.81117, 0.06718], 0.03],
    ['neptune', [29.83064, 1.50306, -0.71839], 0.05],
  ];
  it.each(horizons)('%s matches JPL Horizons', (id, expected, tolerance) => {
    expect(dist(heliocentric(id, DAY), expected)).toBeLessThan(tolerance);
  });

  it('gives the known orbital periods', () => {
    expect(orbitalPeriodYears('earth')).toBeCloseTo(1, 2);
    expect(orbitalPeriodYears('jupiter')).toBeCloseTo(11.86, 1);
    expect(orbitalPeriodYears('neptune')).toBeGreaterThan(164);
  });

  it('returns to the same place after one period', () => {
    const t = DAY + orbitalPeriodYears('mars') * MS_PER_YEAR;
    expect(dist(heliocentric('mars', DAY), heliocentric('mars', t))).toBeLessThan(0.02);
  });

  it('moves fastest at perihelion, as Kepler said', () => {
    let min = Infinity;
    let max = 0;
    const p: Vec3 = [0, 0, 0];
    for (let d = 0; d < 88; d += 0.25) {
      const t = DAY + d * 86400000;
      heliocentric('mercury', t, p);
      const v = orbitalSpeedKms('mercury', t, r(p));
      min = Math.min(min, v);
      max = Math.max(max, v);
    }
    expect(max).toBeCloseTo(58.98, 0);
    expect(min).toBeCloseTo(38.86, 0);
  });

  it('produces a closed ellipse', () => {
    const pts = orbitPoints('mars', DAY, 64);
    expect(pts.length).toBe(65 * 3);
    for (let c = 0; c < 3; c++) expect(pts[c]).toBeCloseTo(pts[64 * 3 + c], 4);
  });

  it('stays valid across the whole time range', () => {
    for (const t of [TIME_MIN, TIME_MAX]) expect(r(heliocentric('earth', t))).toBeCloseTo(1, 1);
  });
});

describe('view helpers', () => {
  it('speed slider spans one day to one century per second, both ways', () => {
    expect(speedFromSlider(0)).toBeCloseTo(1, 6);
    expect(speedFromSlider(100)).toBeCloseTo(36525, 3);
    expect(sliderFromSpeed(speedFromSlider(37))).toBeCloseTo(37, 6);
  });

  it('compressed view keeps planet order while fitting them closer together', () => {
    const near = toScene([0.39, 0, 0], 'compressed', [0, 0, 0]);
    const far = toScene([30, 0, 0], 'compressed', [0, 0, 0]);
    expect(far[0]).toBeGreaterThan(near[0]);
    expect(far[0] / near[0]).toBeLessThan(10);
    expect(toScene([30, 0, 0], 'true', [0, 0, 0])[0] / toScene([0.39, 0, 0], 'true', [0, 0, 0])[0]).toBeCloseTo(30 / 0.39, 3);
  });

  it('maps ecliptic north to scene up', () => {
    expect(toScene([0, 0, 2], 'true', [0, 0, 0])[1]).toBeGreaterThan(0);
  });
});

describe('probe tracks', () => {
  const { voyager1, voyager2 } = trajectories.probes;
  const p: Vec3 = [0, 0, 0];

  it('hides a probe before launch', () => {
    expect(probePosition(voyager1, trajectories.stepDays, Date.UTC(1970, 0, 1), p)).toBe(false);
  });

  it('agrees with the one light-day milestone for Voyager 1', () => {
    expect(probePosition(voyager1, trajectories.stepDays, Date.UTC(2026, 10, 18), p)).toBe(true);
    expect(Math.abs(r(p) - 173.1)).toBeLessThan(1.5);
  });

  it('brings the real Voyager 2 path to Neptune on its flyby date', () => {
    const t = Date.UTC(1989, 7, 25);
    probePosition(voyager2, trajectories.stepDays, t, p);
    expect(dist(p, heliocentric('neptune', t))).toBeLessThan(0.5);
  });
});
