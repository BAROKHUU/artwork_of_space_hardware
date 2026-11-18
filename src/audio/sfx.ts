import { mediaUrl } from '../media';
import { useGame } from '../state/store';

let ctx: AudioContext | null = null;
let noiseBuf: AudioBuffer | null = null;
const clipBuffers = new Map<string, AudioBuffer>();
const clipLoads = new Map<string, Promise<AudioBuffer | null>>();

export type AudioClip =
  | 'thruster_loop'
  | 'rotor_loop'
  | 'rover_loop'
  | 'scan_loop'
  | 'map_warp'
  | 'lander_touchdown'
  | 'lander_chute';

export interface SoundLoop {
  set: (intensity: number, rate?: number) => void;
  stop: () => void;
}

function ensureCtx(): AudioContext | null {
  if (typeof AudioContext === 'undefined') return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

export function preloadClip(clip: AudioClip): Promise<AudioBuffer | null> {
  const cached = clipBuffers.get(clip);
  if (cached) return Promise.resolve(cached);
  const existing = clipLoads.get(clip);
  if (existing) return existing;
  const ac = ensureCtx();
  if (!ac || typeof fetch === 'undefined') return Promise.resolve(null);
  const job = fetch(mediaUrl(`assets/audio/${clip}.mp3`))
    .then((res) => (res.ok ? res.arrayBuffer() : Promise.reject(new Error(`HTTP ${res.status}`))))
    .then((buf) => ac.decodeAudioData(buf))
    .then((decoded) => {
      clipBuffers.set(clip, decoded);
      return decoded;
    })
    .catch(() => null);
  clipLoads.set(clip, job);
  return job;
}

export function playClip(clip: AudioClip, gain = 0.45, rate = 1) {
  const { sound, volume } = useGame.getState();
  if (!sound || volume <= 0) return;
  const ac = ensureCtx();
  if (!ac) return;
  const trigger = (buf: AudioBuffer | null) => {
    const state = useGame.getState();
    if (!buf || !state.sound || state.volume <= 0) return;
    try {
      const src = ac.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = rate;
      const g = ac.createGain();
      g.gain.value = Math.max(0, Math.min(1, gain * state.volume));
      src.connect(g).connect(ac.destination);
      src.start();
    } catch {
      /* audio is optional */
    }
  };
  const ready = clipBuffers.get(clip);
  if (ready) trigger(ready);
  else void preloadClip(clip).then(trigger);
}

/** Creates a continuously modulated looping audio handle tied cleanly to mission physics or scanner state. */
export function createSoundLoop(clip: AudioClip, baseGain = 0.36): SoundLoop {
  let active = true;
  let started = false;
  let starting = false;
  let gainNode: GainNode | null = null;
  let sourceNode: AudioBufferSourceNode | null = null;
  let pendingIntensity = 0;
  let pendingRate = 1;

  const startLoop = (ac: AudioContext, buf: AudioBuffer) => {
    if (!active || started) return;
    try {
      const gain = ac.createGain();
      gain.gain.value = 0;
      const src = ac.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      src.loopStart = Math.min(0.06, buf.duration * 0.05);
      src.loopEnd = Math.max(src.loopStart + 0.1, buf.duration - 0.08);
      src.playbackRate.value = pendingRate;
      src.connect(gain).connect(ac.destination);
      src.start();
      gainNode = gain;
      sourceNode = src;
      started = true;
    } catch {
      /* audio is optional */
    }
  };

  return {
    set(intensity: number, rate = 1) {
      if (!active) return;
      const clamped = Math.max(0, Math.min(1, intensity));
      pendingIntensity = clamped;
      pendingRate = Math.max(0.4, Math.min(2, rate));
      const { sound, volume } = useGame.getState();
      const target = sound && volume > 0 ? clamped * baseGain * volume : 0;

      if (target > 0.004 && !started && !starting) {
        const ac = ensureCtx();
        if (ac) {
          const ready = clipBuffers.get(clip);
          if (ready) {
            startLoop(ac, ready);
          } else {
            starting = true;
            void preloadClip(clip).then((buf) => {
              starting = false;
              if (!active || !buf) return;
              startLoop(ac, buf);
              if (gainNode && sourceNode) {
                const now = ac.currentTime;
                const s = useGame.getState();
                const g = s.sound && s.volume > 0 ? pendingIntensity * baseGain * s.volume : 0;
                gainNode.gain.setTargetAtTime(g, now, 0.045);
                sourceNode.playbackRate.setTargetAtTime(pendingRate, now, 0.06);
              }
            });
          }
        }
      }

      if (started && gainNode && sourceNode && ctx) {
        const now = ctx.currentTime;
        gainNode.gain.setTargetAtTime(target, now, 0.045);
        sourceNode.playbackRate.setTargetAtTime(pendingRate, now, 0.06);
      }
    },
    stop() {
      active = false;
      try {
        sourceNode?.stop();
        sourceNode?.disconnect();
        gainNode?.disconnect();
      } catch {
        /* already stopped */
      }
      sourceNode = null;
      gainNode = null;
      started = false;
    },
  };
}

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

/** Synthesizes a filtered Martian wind / dust storm gust without bundled audio files. */
function stormGust(volume: number) {
  if (!ctx) return;
  if (!noiseBuf) {
    noiseBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.9), ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(180, ctx.currentTime);
  filter.frequency.exponentialRampToValueAtTime(520, ctx.currentTime + 0.35);
  filter.frequency.exponentialRampToValueAtTime(140, ctx.currentTime + 0.9);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.001, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.18);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.9);
  src.connect(filter).connect(gain).connect(ctx.destination);
  src.start();
}

const SOUNDS: Record<string, [number, number, number, OscillatorType, number][]> = {
  blip: [[880, 0, 0.07, 'triangle', 0.05]],
  ping: [[1320, 0, 0.12, 'sine', 0.08], [1760, 0.1, 0.25, 'sine', 0.06]],
  beacon: [[1046, 0, 0.055, 'sine', 0.032]],
  warn: [[880, 0, 0.055, 'sawtooth', 0.04], [660, 0.075, 0.07, 'sawtooth', 0.04]],
  win: [[523, 0, 0.14, 'triangle', 0.08], [659, 0.12, 0.14, 'triangle', 0.08], [784, 0.24, 0.3, 'triangle', 0.08]],
  fail: [[196, 0, 0.3, 'sawtooth', 0.05], [147, 0.18, 0.4, 'sawtooth', 0.05]],
  page: [[380, 0, 0.08, 'triangle', 0.025], [240, 0.035, 0.1, 'sine', 0.018]],
  type: [[720, 0, 0.018, 'square', 0.018]],
  boost: [[659, 0, 0.08, 'sine', 0.038], [988, 0.055, 0.11, 'triangle', 0.038], [1318, 0.11, 0.18, 'sine', 0.032]],
  storm: [],
};

const HAPTICS: Partial<Record<SoundName, number | number[]>> = {
  ping: 15,
  boost: 18,
  warn: 25,
  storm: [30, 40, 30],
  win: [20, 30, 35],
  fail: [45, 35, 55],
};

export type SoundName = 'blip' | 'ping' | 'beacon' | 'warn' | 'win' | 'fail' | 'page' | 'type' | 'boost' | 'storm';

export function play(name: SoundName, haptic = name === 'warn' || name === 'fail' || name === 'win' || name === 'storm') {
  const { sound, volume } = useGame.getState();
  if (!sound || volume <= 0) return;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    if (name === 'storm') stormGust(0.08 * volume);
    else SOUNDS[name].forEach(([f, s, l, t, v]) => tone(f, s, l, t, v * volume));
    if (haptic && typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      const pattern = HAPTICS[name];
      if (pattern) navigator.vibrate(pattern);
    }
  } catch {
    /* audio is optional */
  }
}
