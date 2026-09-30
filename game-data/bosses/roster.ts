import { guardianData } from './guardian';
import { ilyraData } from './ilyra';
import type { BossData } from './schema';
/** Every boss fought with the boss director, in the order of the journey. */
export const bossRoster: readonly BossData[] = [guardianData, ilyraData];
