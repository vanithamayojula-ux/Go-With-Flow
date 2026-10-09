import { BiomeType, GraphicsConfig } from '../types';
import {
  WorldId,
  WorldConfig,
  WORLD_ORDER,
  WORLD_LENGTH_DISTANCE,
} from './WorldConfig';
import { skyIslesConfig } from './worlds/skyIsles';
import { verdantWildsConfig } from './worlds/verdantWilds';
import { crimsonDunesConfig } from './worlds/crimsonDunes';
import { crystalHeightsConfig } from './worlds/crystalHeights';
import { obsidianCoreConfig } from './worlds/obsidianCore';

export * from './WorldConfig';
export { skyIslesConfig } from './worlds/skyIsles';
export { verdantWildsConfig } from './worlds/verdantWilds';
export { crimsonDunesConfig } from './worlds/crimsonDunes';
export { crystalHeightsConfig } from './worlds/crystalHeights';
export { obsidianCoreConfig } from './worlds/obsidianCore';

/**
 * World Configurations Registry Map
 */
export const WORLDS: Record<WorldId, WorldConfig> = {
  'sky-isles': skyIslesConfig,
  'verdant-wilds': verdantWildsConfig,
  'crimson-dunes': crimsonDunesConfig,
  'crystal-heights': crystalHeightsConfig,
  'obsidian-core': obsidianCoreConfig,
};

/**
 * Biome to WorldId mapping for fast lookups.
 * Unlisted legacy or future biomes gracefully fall back to a suitable world theme.
 */
export const BIOME_TO_WORLD_MAP: Record<BiomeType, WorldId> = {
  // Sky Isles
  'sky-realm': 'sky-isles',
  'sky-islands': 'sky-isles',
  meadow: 'sky-isles',

  // Verdant Wilds
  'bioluminescent-jungle': 'verdant-wilds',
  'cyber-forest': 'verdant-wilds',
  forest: 'verdant-wilds',

  // Crimson Dunes
  'dune-nomad': 'crimson-dunes',
  'quantum-desert': 'crimson-dunes',
  dunes: 'crimson-dunes',

  // Crystal Heights
  'aurora-frost': 'crystal-heights',
  'crystal-glacier': 'crystal-heights',
  'nebula-drift': 'crystal-heights',
  'orbital-ring': 'crystal-heights',

  // Obsidian Core
  'ember-core': 'obsidian-core',
  'volcanic-forge': 'obsidian-core',

  // Cyber / Legacy Fallbacks
  'neon-undercity': 'sky-isles',
  'the-grid': 'crystal-heights',
  'derelict-station': 'obsidian-core',
  'bleach-bypass-steel': 'crystal-heights',
};

/**
 * Returns the strongly typed WorldConfig for a given WorldId.
 */
export function getWorldConfig(worldId: WorldId): WorldConfig {
  return WORLDS[worldId];
}

/**
 * Returns the WorldId associated with a BiomeType.
 */
export function getWorldIdForBiome(biome: BiomeType): WorldId {
  return BIOME_TO_WORLD_MAP[biome] ?? 'sky-isles';
}

/**
 * Returns the complete WorldConfig associated with a BiomeType.
 */
export function getWorldForBiome(biome: BiomeType): WorldConfig {
  const worldId = getWorldIdForBiome(biome);
  return getWorldConfig(worldId);
}

/**
 * Determines the campaign WorldConfig based on player distance.
 */
export function getWorldAtDistance(
  distance: number,
  lengthPerWorld = WORLD_LENGTH_DISTANCE
): WorldConfig {
  const safeDistance = Math.max(0, distance);
  const rawIndex = Math.floor(safeDistance / lengthPerWorld);
  const clampedIndex = Math.min(rawIndex, WORLD_ORDER.length - 1);
  const worldId = WORLD_ORDER[clampedIndex];
  return WORLDS[worldId];
}

/**
 * Scales the world decoration density according to the active GraphicsConfig preset.
 */
export function getEffectiveWorldDensity(
  world: WorldConfig | WorldId,
  graphicsConfig: GraphicsConfig
): number {
  const cfg = typeof world === 'string' ? getWorldConfig(world) : world;
  const baseDensity = cfg.decorations.density;

  let qualityScale = 1.0;
  switch (graphicsConfig.preset) {
    case 'desktop-full':
      qualityScale = 1.0;
      break;
    case 'mobile-opt':
      qualityScale = 0.65;
      break;
    case 'webgl-min':
      qualityScale = 0.35;
      break;
    default:
      qualityScale = 1.0;
  }

  const userVegetationSlider = typeof graphicsConfig.vegetationDensity === 'number'
    ? graphicsConfig.vegetationDensity
    : 1.0;

  return baseDensity * qualityScale * userVegetationSlider;
}
