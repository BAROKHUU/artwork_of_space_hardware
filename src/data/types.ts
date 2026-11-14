import type { LanderParams } from '../sim/lander';
import type { BatteryParams } from '../sim/rover';

export type World = 'moon' | 'mars' | 'deep';
/** The ground a scene can be set on. */
export type Surface = 'moon' | 'mars' | 'earth';
export type Fate = 'operating' | 'silent' | 'retired' | 'drifting';
export type ModelId = 'ranger' | 'surveyor' | 'descent' | 'lrrr' | 'lrv' | 'pioneer' | 'voyager' | 'viking' | 'sojourner' | 'mer' | 'curiosity' | 'perseverance' | 'ingenuity' | 'newhorizons';

/** Which journey a chapter belongs to. Moon chapters are the main story; archive chapters are optional. */
export type Arc = 'moon' | 'archive';
export type DriveVehicle = 'echo' | 'lrv';

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
  /** Which body the player drives. Defaults to Echo. */
  vehicle?: DriveVehicle;
}

export interface LandingConfig {
  world: Surface;
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
  | { visual: 'samples'; rounds: number; seed: number }
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
  /** A scenario question scored as Knowledge Application (20% of MMLS). */
  | { kind: 'apply'; key: string; answers: number[] }
  /** Ungraded "what do you think?" questions asked before the chapter, for Learning Gain. */
  | { kind: 'precheck'; key: string; answers: number[] }
  /** Ungraded post-story questions paired with the pre-check for learning gain. */
  | { kind: 'postcheck'; key: string; answers: number[] }
  /** An open-ended question assessed by Gemini, with a deterministic fallback. */
  | { kind: 'reflect'; key: string }
  /** A fictional memory-archive sequence, used for PSEP. */
  | { kind: 'archive'; key: string }
  | { kind: 'signal' }
  | MissionBeat;

export interface Chapter {
  id: string;
  arc?: Arc;
  world: World;
  era: string;
  beats: Beat[];
}

export interface Source {
  org: string;
  title: string;
  url: string;
}
