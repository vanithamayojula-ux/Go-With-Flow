/**
 * GoWithFlow — Player Appearance Cosmetics Registry
 * Inspired by the five worlds progression with zero pay-to-win mechanics.
 */

import { CosmeticItem } from './cosmeticTypes';

export const PLAYER_COSMETICS: CosmeticItem[] = [
  {
    id: 'player_cloud_runner',
    name: 'Cloud Runner',
    category: 'player',
    rarity: 'Common',
    description: 'Classic aerofoil flight suit tuned for Sky Isles updrafts.',
    icon: '☁️',
    worldAffinity: 'sky-isles',
    unlockRequirement: {
      method: 'default',
      target: 0,
      description: 'Default Starter Suit',
    },
    visualData: {
      characterStyle: 'cyber-runner',
      armorVariant: 'carbon-fiber',
      visorColor: '#00f0ff',
      capeColor: '#00f0ff',
      boardId: 'cyber-phantom',
    },
  },
  {
    id: 'player_verdant_runner',
    name: 'Verdant Runner',
    category: 'player',
    rarity: 'Rare',
    description: 'Bio-synthetic kinetic exo-suit woven from deep wild vines.',
    icon: '🌿',
    worldAffinity: 'verdant-wilds',
    unlockRequirement: {
      method: 'world',
      target: 'verdant-wilds',
      description: 'Reach Verdant Wilds (Sector 2)',
    },
    visualData: {
      characterStyle: 'net-stalker',
      armorVariant: 'onyx-stealth',
      visorColor: '#00ff66',
      capeColor: '#10b981',
      boardId: 'grid-runner',
    },
  },
  {
    id: 'player_ember_runner',
    name: 'Ember Runner',
    category: 'player',
    rarity: 'Rare',
    description: 'Heat-shielded thermal racing armor built for dune heat.',
    icon: '🏜️',
    worldAffinity: 'crimson-dunes',
    unlockRequirement: {
      method: 'world',
      target: 'crimson-dunes',
      description: 'Reach Crimson Dunes (Sector 3)',
    },
    visualData: {
      characterStyle: 'grid-phantom',
      armorVariant: 'crimson-cyborg',
      visorColor: '#ff8800',
      capeColor: '#f59e0b',
      boardId: 'tokyo-neon',
    },
  },
  {
    id: 'player_crystal_runner',
    name: 'Crystal Runner',
    category: 'player',
    rarity: 'Epic',
    description: 'Resonant crystalline prism armor refracting celestial radiation.',
    icon: '💎',
    worldAffinity: 'crystal-heights',
    unlockRequirement: {
      method: 'world',
      target: 'crystal-heights',
      description: 'Reach Crystal Heights (Sector 4)',
    },
    visualData: {
      characterStyle: 'void-drifter',
      armorVariant: 'titanium-white',
      visorColor: '#c084fc',
      capeColor: '#a855f7',
      boardId: 'void-stalker',
    },
  },
  {
    id: 'player_obsidian_runner',
    name: 'Obsidian Core Runner',
    category: 'player',
    rarity: 'Legendary',
    description: 'Volcanic magma-forged dreadnought armor forged in the planet core.',
    icon: '🌋',
    worldAffinity: 'obsidian-core',
    unlockRequirement: {
      method: 'world',
      target: 'obsidian-core',
      description: 'Reach Obsidian Core (Sector 5)',
    },
    visualData: {
      characterStyle: 'grid-phantom',
      armorVariant: 'crimson-cyborg',
      visorColor: '#ff2200',
      capeColor: '#ef4444',
      boardId: 'laser-edge',
    },
  },
  {
    id: 'player_master_pilot',
    name: 'Aces High Legend',
    category: 'player',
    rarity: 'Legendary',
    description: 'Gilded holographic honors awarded only to veteran master pilots.',
    icon: '🌟',
    unlockRequirement: {
      method: 'level',
      target: 10,
      description: 'Reach Pilot Rank 10',
    },
    visualData: {
      characterStyle: 'cyber-runner',
      armorVariant: 'titanium-white',
      visorColor: '#fbbf24',
      capeColor: '#f59e0b',
      boardId: 'cyber-phantom',
    },
  },
];
