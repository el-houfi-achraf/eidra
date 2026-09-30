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
  /** Defaults to the Faceless Guardian. */
  setBossHealth: (value: number, id?: string) => void;
  setEnemyHealth: (id: string, value: number) => void;
  save: () => Promise<void>;
}
declare global {
  interface Window {
    eidra?: DebugAPI;
  }
}
