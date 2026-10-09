/**
 * GoWithFlow — Particle & Energy Effect Cosmetics Registry
 * Small performant particle bursts emitted on stunt tricks, near misses, and shard pickups.
 */

import { CosmeticItem } from './cosmeticTypes';

export const EFFECT_COSMETICS: CosmeticItem[] = [
  {
    id: 'effect_plasma_spark',
    name: 'Cyan Ion Sparks',
    category: 'energy-effect',
    rarity: 'Common',
    description: 'Crisp cyan plasma particle discharges on stunts and near misses.',
    icon: '⚡',
    unlockRequirement: {
      method: 'default',
      target: 0,
      description: 'Default Particle FX',
    },
    visualData: {
      sparkColor: 0x00f0ff,
      sparkScale: 1.0,
    },
  },
  {
    id: 'effect_verdant_fireflies',
    name: 'Emerald Fireflies',
    category: 'energy-effect',
    rarity: 'Rare',
    description: 'Gentle bio-luminescent forest spores floating around stunts.',
    icon: '✨',
    worldAffinity: 'verdant-wilds',
    unlockRequirement: {
      method: 'achievement',
      target: 'ach_into_wild',
      description: 'Unlock "Into The Wild" Achievement',
    },
    visualData: {
      sparkColor: 0x00ff88,
      sparkScale: 1.1,
    },
  },
  {
    id: 'effect_crimson_embers',
    name: 'Desert Embers',
    category: 'energy-effect',
    rarity: 'Rare',
    description: 'Smoldering crimson and gold sparks kicked up on impacts and tricks.',
    icon: '🔥',
    worldAffinity: 'crimson-dunes',
    unlockRequirement: {
      method: 'achievement',
      target: 'ach_red_horizon',
      description: 'Unlock "Red Horizon" Achievement',
    },
    visualData: {
      sparkColor: 0xff6600,
      sparkScale: 1.2,
    },
  },
  {
    id: 'effect_crystal_shards',
    name: 'Crystalline Glints',
    category: 'energy-effect',
    rarity: 'Epic',
    description: 'Prismatic starry glints refracting cosmic violet rays.',
    icon: '💠',
    worldAffinity: 'crystal-heights',
    unlockRequirement: {
      method: 'achievement',
      target: 'ach_crystal_voyager',
      description: 'Unlock "Crystal Voyager" Achievement',
    },
    visualData: {
      sparkColor: 0xd8b4fe,
      sparkScale: 1.25,
    },
  },
  {
    id: 'effect_obsidian_slag',
    name: 'Obsidian Magma Burst',
    category: 'energy-effect',
    rarity: 'Legendary',
    description: 'Volcanic core fiery bursts on near misses and high speeds.',
    icon: '💥',
    worldAffinity: 'obsidian-core',
    unlockRequirement: {
      method: 'achievement',
      target: 'ach_heart_obsidian',
      description: 'Unlock "Obsidian Depths" Achievement',
    },
    visualData: {
      sparkColor: 0xff2200,
      sparkScale: 1.35,
    },
  },
];

export const UI_THEME_COSMETICS: CosmeticItem[] = [
  {
    id: 'theme_default_cyan',
    name: 'Neon Cyan Protocol',
    category: 'ui-theme',
    rarity: 'Common',
    description: 'Default cyberpunk high-contrast cyan UI telemetry.',
    icon: '🔷',
    unlockRequirement: {
      method: 'default',
      target: 0,
      description: 'Default UI Theme',
    },
    visualData: {
      accentColor: '#00f0ff',
      hudThemeClass: 'theme-cyan',
    },
  },
  {
    id: 'theme_amber_dune',
    name: 'Amber Mesa Protocol',
    category: 'ui-theme',
    rarity: 'Rare',
    description: 'Warm gold and amber desert telemetry aesthetic.',
    icon: '🔶',
    unlockRequirement: {
      method: 'level',
      target: 5,
      description: 'Reach Pilot Rank 5',
    },
    visualData: {
      accentColor: '#f59e0b',
      hudThemeClass: 'theme-amber',
    },
  },
  {
    id: 'theme_violet_void',
    name: 'Cosmic Violet Protocol',
    category: 'ui-theme',
    rarity: 'Epic',
    description: 'Deep cosmic amethyst HUD highlights for night runners.',
    icon: '🟣',
    unlockRequirement: {
      method: 'level',
      target: 12,
      description: 'Reach Pilot Rank 12',
    },
    visualData: {
      accentColor: '#c084fc',
      hudThemeClass: 'theme-violet',
    },
  },
];
