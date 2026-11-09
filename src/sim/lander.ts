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

export interface LanderState {
  alt: number;
  vel: number;
  fuel: number;
  chute: boolean;
  t: number;
  maxAlt: number;
}

export interface LanderInput {
  throttle: boolean;
  chute?: boolean;
}

export function initialLander(alt: number, vel: number, fuel: number): LanderState {
  return { alt, vel, fuel, chute: false, t: 0, maxAlt: alt };
}

export function stepLander(s: LanderState, p: LanderParams, input: LanderInput, dt: number): LanderState {
  const chute = s.chute || !!input.chute;
  const firing = input.throttle && s.fuel > 0;
  const k = p.drag + (chute ? p.chuteDrag : 0);
  const accel = -p.g + (firing ? p.thrust : 0) - Math.sign(s.vel) * k * s.vel * s.vel;
  let vel = s.vel + accel * dt;
  let alt = s.alt + vel * dt;
  if (alt <= 0) {
    alt = 0;
    // Resting on the ground: gravity cannot push the craft any lower.
    if (s.maxAlt < 0.2 && vel < 0) vel = 0;
  }
  return {
    alt,
    vel,
    chute,
    fuel: Math.max(0, s.fuel - (firing ? p.burn * dt : 0)),
    t: s.t + dt,
    maxAlt: Math.max(s.maxAlt, alt),
  };
}

export const isDown = (s: LanderState) => s.alt <= 0 && s.maxAlt >= 0.2;
export const isSoftTouchdown = (s: LanderState, safeSpeed: number) => isDown(s) && Math.abs(s.vel) <= safeSpeed;
