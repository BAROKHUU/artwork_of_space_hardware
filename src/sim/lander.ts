/** One-dimensional descent model. Deliberately simplified: scales are shortened to game length. */
export interface LanderParams {
  g: number;
  thrust: number;
  /** Fuel (or battery) units used per second of thrust. */
  burn: number;
  /** Quadratic drag coefficient of the airframe. */
  drag: number;
  /** Extra quadratic drag once a parachute is open. */
  chuteDrag: number;
}

const LATERAL_THRUST = 5.5;
const LATERAL_DAMP = 1.6;
const MAX_VX = 8;

export interface LanderState {
  alt: number;
  vel: number;
  x: number;
  vx: number;
  fuel: number;
  chute: boolean;
  t: number;
  maxAlt: number;
}

export interface LanderInput {
  throttle: boolean;
  chute?: boolean;
  steer?: -1 | 0 | 1;
}

export function initialLander(alt: number, vel: number, fuel: number): LanderState {
  return { alt, vel, x: 0, vx: 0, fuel, chute: false, t: 0, maxAlt: alt };
}

export function stepLander(s: LanderState, p: LanderParams, input: LanderInput, dt: number): LanderState {
  const chute = s.chute || !!input.chute;
  const firing = input.throttle && s.fuel > 0;
  const steer = s.alt > 0 && s.fuel > 0 ? (input.steer ?? 0) : 0;
  const k = p.drag + (chute ? p.chuteDrag : 0);
  const accel = -p.g + (firing ? p.thrust : 0) - Math.sign(s.vel) * k * s.vel * s.vel;
  let vel = s.vel + accel * dt;
  let alt = s.alt + vel * dt;
  let vx = steer !== 0 ? s.vx + steer * LATERAL_THRUST * dt : s.vx * Math.exp(-LATERAL_DAMP * dt);
  vx = Math.max(-MAX_VX, Math.min(MAX_VX, vx));
  const x = s.x + vx * dt;
  if (alt <= 0) {
    alt = 0;
    vx = 0;
    // Resting on the ground: gravity cannot push the craft any lower.
    if (s.maxAlt < 0.2 && vel < 0) vel = 0;
  }
  const fuelUse = (firing ? p.burn * dt : 0) + (steer !== 0 ? p.burn * 0.35 * dt : 0);
  return {
    alt,
    vel,
    x,
    vx,
    chute,
    fuel: Math.max(0, s.fuel - fuelUse),
    t: s.t + dt,
    maxAlt: Math.max(s.maxAlt, alt),
  };
}

export const isDown = (s: LanderState) => s.alt <= 0 && s.maxAlt >= 0.2;
export const isSoftTouchdown = (s: LanderState, safeSpeed: number) => isDown(s) && Math.abs(s.vel) <= safeSpeed;
export const isOnTarget = (s: LanderState, targetX?: number, targetRadius?: number) =>
  targetX === undefined || targetRadius === undefined || Math.abs(s.x - targetX) <= targetRadius;
