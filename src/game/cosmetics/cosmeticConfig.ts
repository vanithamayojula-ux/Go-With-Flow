/**
 * GoWithFlow — Cosmetic Configuration & Defaults
 */

import { CosmeticSaveData } from './cosmeticTypes';

export const COSMETIC_VERSION = 1;
export const STORAGE_KEY_COSMETICS = 'skyflow_cosmetics_v2';

export const DEFAULT_EQUIPPED = {
  player: 'player_cloud_runner',
  trail: 'trail_basic_cyan',
  effect: 'effect_plasma_spark',
  uiTheme: 'theme_default_cyan',
};

export function createDefaultCosmeticSaveData(): CosmeticSaveData {
  return {
    version: COSMETIC_VERSION,
    unlocked: [
      'player_cloud_runner',
      'trail_basic_cyan',
      'effect_plasma_spark',
      'theme_default_cyan',
    ],
    equipped: { ...DEFAULT_EQUIPPED },
  };
}
