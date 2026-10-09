import { BiomeType, GraphicsConfig } from '../types';

export type WorldId =
  | 'sky-isles'
  | 'verdant-wilds'
  | 'crimson-dunes'
  | 'crystal-heights'
  | 'obsidian-core';

export interface WorldPalette {
  skyTop: string;
  skyBottom: string;
  fog: string;
  terrain: string;
  terrainAccent: string;
  energy: string;
}

export interface WorldLightingConfig {
  ambient: number;
  sun: number;
  ambientColor: string;
  sunColor: string;
  sunPosition?: [number, number, number];
}

export type AtmosphereParticleType =
  | 'clouds'
  | 'fireflies'
  | 'dust'
  | 'crystals'
  | 'embers';

export interface WorldAtmosphereConfig {
  particleType: AtmosphereParticleType;
  particleDensity: number;
  fogDensity: number;
}

export type WorldStructureType =
  | 'islands'
  | 'ruins'
  | 'mesas'
  | 'crystal-spires'
  | 'volcanic-rock';

export interface WorldDecorationsConfig {
  vegetation: string;
  structures: WorldStructureType;
  density: number;
}

export interface WorldConfig {
  id: WorldId;
  index: number;
  name: string;
  subtitle: string;
  palette: WorldPalette;
  lighting: WorldLightingConfig;
  atmosphere: WorldAtmosphereConfig;
  decorations: WorldDecorationsConfig;
  compatibleBiomes: readonly BiomeType[];
}

/**
 * Authoritative campaign order for the five worlds.
 */
export const WORLD_ORDER: readonly WorldId[] = [
  'sky-isles',
  'verdant-wilds',
  'crimson-dunes',
  'crystal-heights',
  'obsidian-core',
] as const;

/**
 * Configurable length (in distance units) allocated to each world before transitioning.
 */
export const WORLD_LENGTH_DISTANCE = 2250;
