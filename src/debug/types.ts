import type { Settings } from '../config/settings';
import type { AbilityId } from '../../game-data/abilities/abilities';
import type { MemoryFrame } from '../abilities/AbilitySystem';
export interface DebugSnapshot {
  state: string;
  player: { x: number; y: number; health: number; grounded: boolean; dashing: boolean };
  abilities: AbilityId[];
  energy: number;
  remanence: boolean;
  echo: MemoryFrame | null;
  checkpoint: string;
  chunks: string[];
  enemies: { id: string; x: number; y: number; health: number; state: string }[];
  boss: { health: number; state: string; phase: number };
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
  setBossHealth: (value: number) => void;
  save: () => Promise<void>;
}
declare global {
  interface Window {
    eidra?: DebugAPI;
  }
}
