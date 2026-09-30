import type { Settings } from '../config/settings';
import type { AbilityId } from '../../game-data/abilities/abilities';
import type { MemoryFrame } from '../abilities/AbilitySystem';
export interface BossSnapshot {
  id: string;
  health: number;
  state: string;
  phase: number;
  pattern: string;
  targets: number[];
  /** How it moves: march, hover, leap or glide. */
  movement: string;
  x: number;
  /** Lasting effects of its signature ability. */
  effects: {
    /** Where its standard stands. */
    standard: number | null;
    geysers: number[];
    /** Positions of its standing reflections. */
    reflections: number[];
    /** A command is watching Eidra. */
    gaze: boolean;
    leaping: boolean;
  };
}
export interface DebugSnapshot {
  state: string;
  player: {
    x: number;
    y: number;
    vy: number;
    health: number;
    maxHealth: number;
    grounded: boolean;
    dashing: boolean;
    /** Seconds of invulnerability left (respawn grace, recent hit, dash). */
    invulnerable: number;
  };
  resonance: number;
  /** Thrown cards in flight. */
  cards: { x: number; y: number }[];
  shards: number;
  healthUpgrades: number;
  abilities: AbilityId[];
  energy: number;
  remanence: boolean;
  echo: MemoryFrame | null;
  checkpoint: string;
  chunks: string[];
  enemies: { id: string; x: number; y: number; health: number; state: string }[];
  /** The Faceless Guardian (Act I). */
  boss: BossSnapshot;
  /** Every boss of the journey. */
  bosses: BossSnapshot[];
  /** Gates currently barring the way (arena gates and the counterweight seal). */
  gates: string[];
  settings: Settings;
  memories: string[];
  flags: string[];
  gamepad: boolean;
  /** Device of the latest input; prompts follow it. */
  device: 'keyboard' | 'gamepad';
  /** The controller in hand: family of its glyphs and the layout used to read it. */
  pad: { name: string; family: string; profile: string } | null;
  meshes: number;
  bodies: number;
  renderer: string;
  fps: number;
  metrics: {
    cpuMs: number;
    gpuMs: number | null;
    drawCalls: number;
    triangles: number;
    frameMs: number;
  } | null;
}
export interface DebugAPI {
  snapshot: () => DebugSnapshot;
  teleport: (x: number, y?: number) => void;
  unlock: (id: AbilityId) => void;
  damage: (amount: number) => void;
  addShards: (amount: number) => void;
  /** Sets the resonance (0..99): the cards orbiting Eidra. */
  setResonance: (value: number) => void;
  /** Defaults to the Faceless Guardian. */
  setBossHealth: (value: number, id?: string) => void;
  /** Makes a boss use `pattern` next (it must be in its current phase's rotation). */
  forceBossPattern: (id: string, pattern: string) => void;
  setEnemyHealth: (id: string, value: number) => void;
  save: () => Promise<void>;
}
declare global {
  interface Window {
    eidra?: DebugAPI;
  }
}
