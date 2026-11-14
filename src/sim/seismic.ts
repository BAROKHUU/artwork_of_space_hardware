export const WINDOW_SECONDS = 1.2;
const PERIOD = 12;

function random(seed: number, cycle: number, key: number): number {
  const value = Math.sin(seed * 12.9898 + cycle * 78.233 + key * 37.719) * 43758.5453;
  return value - Math.floor(value);
}

function burst(cycle: number, channel: number, seed: number) {
  const commonStart = 2 + random(seed, cycle, 0) * 3;
  const commonEnd = commonStart + 1.5 + random(seed, cycle, 1) * 0.6;
  return {
    start: cycle * PERIOD + commonStart - random(seed, cycle, 2 + channel * 2) * 1.5,
    end: cycle * PERIOD + commonEnd + random(seed, cycle, 3 + channel * 2) * 1.5,
  };
}

export function signalActive(time: number, channel: number, seed: number): boolean {
  const { start, end } = burst(Math.floor(time / PERIOD), channel, seed);
  return time >= start && time <= end;
}

export function canCapture(time: number, seed: number): boolean {
  const cycle = Math.floor(time / PERIOD);
  return [0, 1, 2, 3].every((channel) => {
    const { start, end } = burst(cycle, channel, seed);
    return time - WINDOW_SECONDS >= start && time <= end;
  });
}
