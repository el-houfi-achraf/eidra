import type { Settings } from '../config/settings';
import type { AbilityId } from '../../game-data/abilities/abilities';
import type { MemoryFrame } from '../abilities/AbilitySystem';
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
  boss: { health: number; state: string; phase: number; pattern: string; targets: number[] };
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
  setBossHealth: (value: number) => void;
  setEnemyHealth: (id: string, value: number) => void;
  save: () => Promise<void>;
}
declare global {
  interface Window {
    eidra?: DebugAPI;
  }
}
