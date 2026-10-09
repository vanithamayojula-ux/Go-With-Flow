/**
 * GoWithFlow — Visual Trail Cosmetics Registry
 * Lightweight ribbon trails referencing the 5 worlds progression.
 */

import { CosmeticItem } from './cosmeticTypes';

export const TRAIL_COSMETICS: CosmeticItem[] = [
  {
    id: 'trail_basic_cyan',
    name: 'Electric Cyan Trail',
    category: 'trail',
    rarity: 'Common',
    description: 'High-frequency ion streamline with cool cyan glow.',
    icon: '⚡',
    unlockRequirement: {
      method: 'default',
      target: 0,
      description: 'Default Starter Trail',
    },
    visualData: {
      colorA: '#00D2E0',
      colorB: '#0066FF',
      opacity: 0.65,
    },
  },
  {
    id: 'trail_sky_breeze',
    name: 'Sky Isles Breeze',
    category: 'trail',
    rarity: 'Common',
    description: 'Soft white and azure wind ribbons reminiscent of floating islands.',
    icon: '☁️',
    worldAffinity: 'sky-isles',
    unlockRequirement: {
      method: 'distance',
      target: 1000,
      description: 'Fly 1,000m in Sky Isles',
    },
    visualData: {
      colorA: '#e0f2fe',
      colorB: '#38bdf8',
      opacity: 0.7,
    },
  },
  {
    id: 'trail_forest_canopy',
    name: 'Verdant Flora Trail',
    category: 'trail',
    rarity: 'Rare',
    description: 'Emerald and mint bio-luminescent pollen trace.',
    icon: '🌿',
    worldAffinity: 'verdant-wilds',
    unlockRequirement: {
      method: 'world',
      target: 'verdant-wilds',
      description: 'Reach Verdant Wilds',
    },
    visualData: {
      colorA: '#10b981',
      colorB: '#34d399',
      opacity: 0.7,
    },
  },
  {
    id: 'trail_crimson_ember',
    name: 'Crimson Dune Ember',
    category: 'trail',
    rarity: 'Rare',
    description: 'Scorching desert thermal ribbon with amber and ruby highlights.',
    icon: '🏜️',
    worldAffinity: 'crimson-dunes',
    unlockRequirement: {
      method: 'world',
      target: 'crimson-dunes',
      description: 'Reach Crimson Dunes',
    },
    visualData: {
      colorA: '#f59e0b',
      colorB: '#ef4444',
      opacity: 0.75,
    },
  },
  {
    id: 'trail_crystal_aurora',
    name: 'Celestial Crystal Trail',
    category: 'trail',
    rarity: 'Epic',
    description: 'Reflective violet and cyan prism shimmer from the upper cosmos.',
    icon: '💎',
    worldAffinity: 'crystal-heights',
    unlockRequirement: {
      method: 'world',
      target: 'crystal-heights',
      description: 'Reach Crystal Heights',
    },
    visualData: {
      colorA: '#c084fc',
      colorB: '#38bdf8',
      opacity: 0.8,
    },
  },
  {
    id: 'trail_obsidian_magma',
    name: 'Obsidian Magma Surge',
    category: 'trail',
    rarity: 'Legendary',
    description: 'Molten rock core wake burning with incandescent orange heat.',
    icon: '🌋',
    worldAffinity: 'obsidian-core',
    unlockRequirement: {
      method: 'world',
      target: 'obsidian-core',
      description: 'Reach Obsidian Core',
    },
    visualData: {
      colorA: '#ff2200',
      colorB: '#ff6600',
      opacity: 0.85,
    },
  },
  {
    id: 'trail_plasma_rainbow',
    name: 'Transcendent Rainbow',
    category: 'trail',
    rarity: 'Legendary',
    description: 'Full-spectrum prism overcharge unlocked at high pilot levels.',
    icon: '🌈',
    unlockRequirement: {
      method: 'level',
      target: 8,
      description: 'Reach Pilot Rank 8',
    },
    visualData: {
      colorA: '#ec4899',
      colorB: '#06b6d4',
      opacity: 0.85,
    },
  },
];
