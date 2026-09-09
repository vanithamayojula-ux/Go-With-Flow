export type LightingMode = 'golden-hour' | 'morning' | 'bright-day';

export type QualityPreset = 'desktop-full' | 'mobile-opt' | 'webgl-min';

export type BiomeType = 'meadow' | 'dunes' | 'sky-islands' | 'forest';

export type TrickType = 'spin' | 'flip' | 'grab' | 'pose';

export interface CosmeticsConfig {
  boardId: 'ivory-drift' | 'sakura-foil' | 'dune-glider' | 'celestia-blade' | 'forest-spirit';
  trailId: 'verdant-breeze' | 'solar-flare' | 'aurora' | 'rainbow';
  capeColor: string;
  poseId: 'standard' | 'zen' | 'dancer';
  characterStyle?: 'ghibli-voyager' | 'desert-nomad' | 'forest-wanderer';
}

export interface SessionGoal {
  id: string;
  title: string;
  desc: string;
  target: number;
  current: number;
  completed: boolean;
  reward: string;
}

export interface ShaderParams {
  windSpeed: number;
  windStrength: number;
  rimLightIntensity: number;
  celRampHardness: number;
  slopeWarmth: number;
  filmGrainIntensity: number;
  bloomIntensity: number;
  colorLift: number;
  highSpeedBlur: number;
}

export interface GraphicsConfig {
  preset: QualityPreset;
  targetFPS: number;
  vegetationDensity: number;
  drawCallBudget: number;
  particleBudget: number;
  enablePostProcess: boolean;
  enableShadows: boolean;
  lodDistance: number;
}

export interface PlayerStats {
  speed: number;
  maxSpeed: number;
  distance: number;
  score: number;
  styleMeter: number; // 0 to 100
  styleTier: 'Chill' | 'Breeze' | 'Flow' | 'Transcendent';
  airTime: number;
  isGrounded: boolean;
  combo: number;
  windOrbsCollected: number;
  currentBiome: BiomeType;
  currentFriction: number;
  activeTrickName: string | null;
  slowMoActive: boolean;
  isOnFloatingIsland: boolean;
}

export interface FloatingIslandData {
  id: string;
  x: number;
  y: number;
  z: number;
  radius: number;
  mesh?: unknown;
}

export interface TerrainChunkData {
  key: string;
  chunkX: number;
  chunkZ: number;
  mesh: unknown;
}

