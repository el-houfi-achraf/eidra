import { openDB } from 'idb';
import type { IDBPDatabase } from 'idb';
import { z } from 'zod';
import { SettingsSchema, defaultSettings } from '../config/settings';
import type { Settings } from '../config/settings';
import { AbilityIdSchema } from '../../game-data/abilities/abilities';
import { SaveError } from '../core/errors';
export const SaveSchema = z.object({
  saveVersion: z.literal(2),
  slot: z.number().int().min(1).max(3),
  savedAt: z.number(),
  position: z.object({ x: z.number().finite(), y: z.number().finite() }),
  checkpoint: z.string(),
  abilities: z.array(AbilityIdSchema),
  health: z.number().min(0),
  healthUpgrades: z.number().int().min(0),
  collectibles: z.array(z.string()),
  shards: z.number().int().min(0),
  bosses: z.array(z.string()),
  quests: z.array(z.string()),
  discoveredAreas: z.array(z.string()),
  memories: z.array(z.string()),
  flags: z.array(z.string()),
  settings: SettingsSchema,
  playtime: z.number().nonnegative(),
});
export type SaveData = z.infer<typeof SaveSchema>;
export function migrateSave(raw: unknown): SaveData {
  const record = z.object({ saveVersion: z.number() }).passthrough().parse(raw);
  if (record.saveVersion === 1)
    return SaveSchema.parse({
      ...record,
      saveVersion: 2,
      flags: record.flags ?? [],
      shards: record.shards ?? 0,
      settings: record.settings ?? defaultSettings(),
    });
  if (record.saveVersion !== 2)
    throw new SaveError(
      'Cette sauvegarde provient d’une version non prise en charge. Elle n’a pas été modifiée.',
    );
  return SaveSchema.parse(raw);
}
export class SaveManager {
  private db: Promise<IDBPDatabase>;
  constructor(name = 'eidra-saves') {
    this.db = openDB(name, 1, {
      upgrade(db) {
        db.createObjectStore('saves', { keyPath: 'slot' });
        db.createObjectStore('settings');
      },
      blocked() {
        console.warn('[EIDRA] Close other game tabs to upgrade saves.');
      },
    });
  }
  async save(data: SaveData): Promise<void> {
    try {
      const valid = SaveSchema.parse(data);
      await (await this.db).put('saves', valid);
    } catch (cause) {
      throw new SaveError(
        'Sauvegarde impossible. Vérifiez l’espace disponible et les autorisations du navigateur.',
        { cause },
      );
    }
  }
  async load(slot = 1): Promise<SaveData | null> {
    try {
      const raw: unknown = await (await this.db).get('saves', slot);
      return raw ? migrateSave(raw) : null;
    } catch (cause) {
      if (cause instanceof SaveError) throw cause;
      throw new SaveError(
        'Cette sauvegarde est illisible. Elle a été conservée sans modification.',
        { cause },
      );
    }
  }
  async list(): Promise<(SaveData | null)[]> {
    return Promise.all([1, 2, 3].map((slot) => this.load(slot)));
  }
  async saveSettings(settings: Settings): Promise<void> {
    try {
      await (await this.db).put('settings', SettingsSchema.parse(settings), 'current');
    } catch (cause) {
      throw new SaveError('Les réglages n’ont pas pu être enregistrés.', { cause });
    }
  }
  async loadSettings(): Promise<Settings> {
    try {
      const raw: unknown = await (await this.db).get('settings', 'current');
      return raw ? SettingsSchema.parse(raw) : defaultSettings();
    } catch (cause) {
      throw new SaveError('Les réglages enregistrés sont illisibles.', { cause });
    }
  }
  async close(): Promise<void> {
    (await this.db).close();
  }
}
