/**
 * GoWithFlow — Cosmetic System Types
 */

export type CosmeticCategory = 'player' | 'trail' | 'energy-effect' | 'ui-theme';

export type CosmeticRarity = 'Common' | 'Rare' | 'Epic' | 'Legendary';

export type UnlockMethod =
  | 'default'
  | 'level'
  | 'achievement'
  | 'challenge'
  | 'world'
  | 'distance'
  | 'score'
  | 'shards';

export interface UnlockRequirement {
  method: UnlockMethod;
  target: number | string;
  description: string;
  current?: number;
}

export interface CosmeticItem {
  id: string;
  name: string;
  category: CosmeticCategory;
  rarity: CosmeticRarity;
  description: string;
  icon: string;
  worldAffinity?: 'sky-isles' | 'verdant-wilds' | 'crimson-dunes' | 'crystal-heights' | 'obsidian-core';
  unlockRequirement: UnlockRequirement;
  visualData: {
    // For trails
    colorA?: string;
    colorB?: string;
    opacity?: number;
    // For player
    characterStyle?: string;
    armorVariant?: string;
    visorColor?: string;
    capeColor?: string;
    boardId?: string;
    // For energy effects
    sparkColor?: number;
    sparkScale?: number;
    // For UI themes
    accentColor?: string;
    hudThemeClass?: string;
  };
}

export interface CosmeticSaveData {
  version: number;
  unlocked: string[]; // List of unlocked cosmetic IDs
  equipped: {
    player: string;
    trail: string;
    effect: string;
    uiTheme: string;
  };
}
