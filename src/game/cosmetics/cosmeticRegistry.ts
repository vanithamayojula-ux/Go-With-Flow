/**
 * GoWithFlow — Central Cosmetic Registry
 */

import { CosmeticItem, CosmeticCategory } from './cosmeticTypes';
import { PLAYER_COSMETICS } from './playerCosmetics';
import { TRAIL_COSMETICS } from './trailCosmetics';
import { EFFECT_COSMETICS, UI_THEME_COSMETICS } from './effectCosmetics';

export const ALL_COSMETICS: CosmeticItem[] = [
  ...PLAYER_COSMETICS,
  ...TRAIL_COSMETICS,
  ...EFFECT_COSMETICS,
  ...UI_THEME_COSMETICS,
];

export const COSMETIC_MAP = new Map<string, CosmeticItem>(
  ALL_COSMETICS.map(item => [item.id, item])
);

export function getCosmeticsByCategory(category: CosmeticCategory): CosmeticItem[] {
  return ALL_COSMETICS.filter(item => item.category === category);
}

export function getCosmeticById(id: string): CosmeticItem | undefined {
  return COSMETIC_MAP.get(id);
}
