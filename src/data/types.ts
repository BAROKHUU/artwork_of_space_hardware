import type { LanderParams } from '../sim/lander';
import type { BatteryParams } from '../sim/rover';

export type World = 'moon' | 'mars' | 'deep';
export type Fate = 'operating' | 'silent' | 'retired' | 'drifting';
export type ModelId = 'ranger' | 'surveyor' | 'descent' | 'lrrr' | 'lrv' | 'pioneer' | 'voyager' | 'viking' | 'sojourner' | 'mer' | 'curiosity' | 'ingenuity' | 'newhorizons';

export interface Hardware {
  id: string;
  world: World;
  model: ModelId;
  fate: Fate;
  lat?: number;
  lon?: number;
  photo: string;
  nasaId: string;
  credit: string;
  dates: Partial<Record<'launched' | 'landed' | 'interstellar' | 'lastContact' | 'ended', string>>;
  sources: string[];
}

export interface DriveConfig {
  world: 'moon' | 'mars';
  seed: number;
  start: { x: number; z: number };
  targets: { x: number; z: number }[];
  radius: number;
  tether?: number;
  prop?: { model: ModelId; x: number; z: number };
  battery?: BatteryParams;
}

export interface LandingConfig {
  world: 'moon' | 'mars';
  vehicle: 'surveyor' | 'viking' | 'ingenuity';
  objective: 'touchdown' | 'hover';
  alt: number;
  vel: number;
  fuel: number;
  safe: number;
  hasChute?: boolean;
  band?: [number, number];
  hold?: number;
  params: LanderParams;
}

export interface LaserConfig {
  target: { lat: number; lon: number };
  radiusDeg: number;
  shots: number;
}

export interface SlingshotConfig {
  degMin: number;
  degMax: number;
  speedMin: number;
  speedMax: number;
  suggest: { speed: number; deg: number };
}

export type ClassifyConfig =
  | { visual: 'craters'; rounds: number; seed: number }
  | { visual: 'lr'; answers: number[] }
  | { visual: 'golden'; items: { id: string; on: boolean }[] };

export type MissionBeat =
  | { kind: 'mission'; id: string; template: 'drive'; config: DriveConfig }
  | { kind: 'mission'; id: string; template: 'landing'; config: LandingConfig }
  | { kind: 'mission'; id: string; template: 'laser'; config: LaserConfig }
  | { kind: 'mission'; id: string; template: 'slingshot'; config: SlingshotConfig }
  | { kind: 'mission'; id: string; template: 'classify'; config: ClassifyConfig };

export type Beat =
  | { kind: 'dialogue'; key: string; focus: string }
  | { kind: 'memory'; hardware: string }
  | { kind: 'quiz'; key: string; answers: number[] }
  | { kind: 'signal' }
  | MissionBeat;

export interface Chapter {
  id: string;
  world: World;
  era: string;
  beats: Beat[];
}

export interface Source {
  org: string;
  title: string;
  url: string;
}
