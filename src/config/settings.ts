import { z } from 'zod';
export const SettingsSchema = z.object({
  preset: z.enum(['LOW', 'MEDIUM', 'HIGH', 'ULTRA']).default('MEDIUM'),
  master: z.number().min(0).max(1).default(0.65),
  music: z.number().min(0).max(1).default(0.6),
  effects: z.number().min(0).max(1).default(0.8),
  brightness: z.number().min(0.7).max(1.5).default(1),
  contrast: z.number().min(0.8).max(1.5).default(1),
  shake: z.number().min(0).max(1).default(0.4),
  cameraSensitivity: z.number().min(0.5).max(2).default(1),
  reducedMotion: z.boolean().default(false),
  chromaticAberration: z.boolean().default(false),
  subtitles: z.boolean().default(true),
  memoryToggle: z.boolean().default(true),
  assist: z.boolean().default(false),
  /** Contextual control prompts (tutorial). */
  hints: z.boolean().default(true),
  bindings: z.record(z.string(), z.string()).default({}),
});
export type Settings = z.infer<typeof SettingsSchema>;
export const defaultSettings = (): Settings => SettingsSchema.parse({});
export const presets = {
  LOW: {
    scale: 0.7,
    shadows: 0,
    particles: 18,
    post: false,
    texture: 512,
    lod: 0.4,
    fog: 0.013,
    effects: 0.4,
  },
  MEDIUM: {
    scale: 0.9,
    shadows: 0,
    particles: 40,
    post: true,
    texture: 1024,
    lod: 0.65,
    fog: 0.016,
    effects: 0.65,
  },
  HIGH: {
    scale: 1,
    shadows: 1024,
    particles: 72,
    post: true,
    texture: 2048,
    lod: 0.85,
    fog: 0.019,
    effects: 0.85,
  },
  ULTRA: {
    scale: 1.15,
    shadows: 2048,
    particles: 110,
    post: true,
    texture: 2048,
    lod: 1,
    fog: 0.02,
    effects: 1,
  },
} as const;
