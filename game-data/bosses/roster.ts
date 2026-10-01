import { guardianData } from './guardian';
import { ilyraData } from './ilyra';
import { keeperData } from './keeper';
import { wardenData } from './warden';
import type { BossData } from './schema';
/** Every arena guardian, fought with the boss director, in the order of the journey. */
export const bossRoster: readonly BossData[] = [keeperData, guardianData, wardenData, ilyraData];
