import { useGame } from '../state/store';

let ctx: AudioContext | null = null;

function tone(freq: number, start: number, length: number, type: OscillatorType, volume: number) {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(volume, ctx.currentTime + start);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + length);
  osc.connect(gain).connect(ctx.destination);
  osc.start(ctx.currentTime + start);
  osc.stop(ctx.currentTime + start + length);
}

const SOUNDS: Record<string, [number, number, number, OscillatorType, number][]> = {
  blip: [[880, 0, 0.07, 'triangle', 0.05]],
  ping: [[1320, 0, 0.12, 'sine', 0.08], [1760, 0.1, 0.25, 'sine', 0.06]],
  win: [[523, 0, 0.14, 'triangle', 0.08], [659, 0.12, 0.14, 'triangle', 0.08], [784, 0.24, 0.3, 'triangle', 0.08]],
  fail: [[196, 0, 0.3, 'sawtooth', 0.05], [147, 0.18, 0.4, 'sawtooth', 0.05]],
};

export function play(name: keyof typeof SOUNDS) {
  if (!useGame.getState().sound) return;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    SOUNDS[name].forEach(([f, s, l, t, v]) => tone(f, s, l, t, v));
  } catch {
    /* audio is optional */
  }
}
