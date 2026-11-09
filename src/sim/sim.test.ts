import { describe, expect, it } from 'vitest';
import { angularDistanceDeg, latLonToVec3, vec3ToLatLon } from './geo';
import { distanceFromEcho, moonDriftMeters, roundTripSeconds } from './laser';
import { initialLander, isDown, isSoftTouchdown, stepLander, type LanderParams } from './lander';
import { simulateFleet, simulateSlingshot } from './orbit';
import { distanceAU, lightHours } from './ephemeris';
import { makeTerrain } from './terrain';

const SURVEYOR: LanderParams = { g: 1.62, thrust: 4.2, burn: 1, drag: 0, chuteDrag: 0 };

function fly(p: LanderParams, alt: number, vel: number, fuel: number, policy: (s: ReturnType<typeof initialLander>) => { throttle: boolean; chute?: boolean }) {
  let s = initialLander(alt, vel, fuel);
  for (let i = 0; i < 60 * 300 && !isDown(s); i++) s = stepLander(s, p, policy(s), 1 / 60);
  return s;
}

describe('lander', () => {
  it('crashes when the pilot does nothing', () => {
    expect(isSoftTouchdown(fly(SURVEYOR, 260, -30, 30, () => ({ throttle: false })), 3)).toBe(false);
  });
  it('can be landed softly by a simple suicide-burn pilot', () => {
    const s = fly(SURVEYOR, 260, -30, 30, (l) => ({ throttle: l.vel < -2 && l.alt < (l.vel * l.vel) / (2 * 2.2) + 8 }));
    expect(isSoftTouchdown(s, 3)).toBe(true);
    expect(s.fuel).toBeGreaterThan(0);
  });
  it('Mars descent needs the parachute and is winnable', () => {
    const v: LanderParams = { g: 3.71, thrust: 7.5, burn: 1, drag: 2e-5, chuteDrag: 1e-3 };
    const noChute = fly(v, 2000, -120, 30, (l) => ({ throttle: l.alt < 500 }));
    expect(isSoftTouchdown(noChute, 3)).toBe(false);
    const good = fly(v, 2000, -120, 30, (l) => ({ chute: true, throttle: l.vel < -2 && l.alt < (l.vel * l.vel) / (2 * 3.2) + 15 }));
    expect(isSoftTouchdown(good, 3)).toBe(true);
  });
  it('stays on the ground before lift-off', () => {
    const s = stepLander(initialLander(0, 0, 90), { g: 3.71, thrust: 5, burn: 1, drag: 0.02, chuteDrag: 0 }, { throttle: false }, 1 / 60);
    expect(s.vel).toBe(0);
    expect(isDown(s)).toBe(false);
  });
});

describe('slingshot', () => {
  const grid = () => {
    const wins: [number, number][] = [];
    for (let deg = 40; deg <= 140; deg += 2) for (let v = 38.4; v <= 39.25; v += 0.1) if (simulateSlingshot({ jupiterStartDeg: deg, speedKms: v }).outcome === 'boosted') wins.push([deg, Number(v.toFixed(1))]);
    return wins;
  };
  it('has a launch window that is neither impossible nor trivial', () => {
    const wins = grid();
    expect(wins.length).toBeGreaterThan(25);
    expect(wins.length).toBeLessThan(51 * 9 * 0.4);
  });
  it('never gains speed without Jupiter at game speeds', () => {
    for (const v of [38.4, 39.5, 40]) expect(simulateSlingshot({ jupiterStartDeg: 90, speedKms: v, jupiterMass: 0 }).outcome).not.toBe('boosted');
  });
  it('reports a short trajectory when launched too slowly', () => {
    expect(simulateSlingshot({ jupiterStartDeg: 90, speedKms: 37.8 }).outcome).toBe('short');
  });
});

describe('slingshot lab', () => {
  const base = { jupiterStartDeg: 69, speedKms: 38.9 };
  it('bends the path when a gravity well is dropped nearby', () => {
    const plain = simulateSlingshot({ ...base, jupiterMass: 0 });
    const pulled = simulateSlingshot({ ...base, jupiterMass: 0, wells: [{ x: -2, y: 2.5, mass: 30 }] });
    const end = (r: typeof plain) => r.path.at(-1)!;
    expect(Math.hypot(end(plain)[0] - end(pulled)[0], end(plain)[1] - end(pulled)[1])).toBeGreaterThan(0.5);
  });
  it('spreads a fleet evenly around the launch day', () => {
    const fleet = simulateFleet(base, 5, 4);
    expect(fleet.map((r) => r.jupiterStartDeg)).toEqual([65, 67, 69, 71, 73]);
  });
});

describe('laser and geometry', () => {
  it('matches the 2.56 second Earth-Moon echo', () => {
    expect(roundTripSeconds(384400)).toBeCloseTo(2.564, 2);
    expect(distanceFromEcho(roundTripSeconds(384400))).toBeCloseTo(384400, 3);
  });
  it('accumulates about two metres of drift since 1969', () => {
    expect(moonDriftMeters(new Date('2026-11-09'))).toBeGreaterThan(2);
    expect(moonDriftMeters(new Date('2026-11-09'))).toBeLessThan(2.4);
  });
  it('round-trips coordinates', () => {
    const p = vec3ToLatLon(...latLonToVec3(26.13, 3.63, 2));
    expect(p.lat).toBeCloseTo(26.13, 6);
    expect(p.lon).toBeCloseTo(3.63, 6);
    expect(angularDistanceDeg({ lat: 0, lon: 0 }, { lat: 0, lon: 90 })).toBeCloseTo(90, 6);
  });
});

describe('ephemeris', () => {
  it('puts Voyager 1 at one light-day around 18 November 2026', () => {
    expect(lightHours(distanceAU('voyager1', new Date('2026-11-18T10:16:00Z')))).toBeCloseTo(24, 1);
  });
});

describe('terrain', () => {
  it('is deterministic and level on flat pads', () => {
    const o = { seed: 7, size: 200, amplitude: 4, craterCount: 30, flat: [{ x: 5, z: 5, r: 6 }] };
    const a = makeTerrain(o);
    const b = makeTerrain(o);
    expect(a.heightAt(33, -12)).toBe(b.heightAt(33, -12));
    expect(a.heightAt(5, 5)).toBe(0);
  });
});
