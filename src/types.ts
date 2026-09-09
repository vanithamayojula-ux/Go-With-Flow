export type LightingMode =
  | 'midnight-cyan'
  | 'synthwave-magenta'
  | 'toxic-matrix'
  | 'solar-amber'
  | 'golden-hour'
  | 'morning'
  | 'bright-day';

export type QualityPreset = 'desktop-full' | 'mobile-opt' | 'webgl-min';

export type BiomeType =
  | 'neon-undercity'
  | 'orbital-ring'
  | 'the-grid'
  | 'derelict-station'
  | 'meadow'
  | 'dunes'
  | 'sky-islands'
  | 'forest';

export type TrickType = 'spin' | 'flip' | 'grab' | 'pose';

export interface CosmeticsConfig {
  boardId:
    | 'cyber-phantom'
    | 'laser-edge'
    | 'grid-runner'
    | 'tokyo-neon'
    | 'void-stalker'
    | 'ivory-drift'
    | 'sakura-foil'
    | 'dune-glider'
    | 'celestia-blade'
    | 'forest-spirit';
  trailId:
    | 'electric-cyan'
    | 'hot-magenta'
    | 'acid-green'
    | 'plasma-rainbow'
    | 'verdant-breeze'
    | 'solar-flare'
    | 'aurora'
    | 'rainbow';
  capeColor: string;
  poseId: 'standard' | 'zen' | 'dancer';
  armorVariant?: 'carbon-fiber' | 'titanium-white' | 'onyx-stealth' | 'crimson-cyborg';
  visorColor?: string;
  underglowColor?: string;
  characterStyle?: 'ghibli-voyager' | 'desert-nomad' | 'forest-wanderer' | 'cyber-runner';
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
  speedLineIntensity?: number;
  heatShimmerIntensity?: number;
  rainIntensity?: number;
  chromaticAberration?: number;
  scanlineIntensity?: number;
  glitchIntensity?: number;
  wetRoadReflections?: number;
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

export type LaneIndex = -1 | 0 | 1;

export type ObstacleType =
  | 'laser-barrier'
  | 'overhead-conduit'
  | 'maglev-hauler'
  | 'maglev-ramp'
  | 'grind-rail'
  | 'boost-gate'
  | 'low-hurdle'
  | 'high-barrier'
  | 'spirit-train'
  | 'spirit-train-ramp';

export type PowerUpType =
  | 'quantum-magnet'
  | 'sonic-jetpack'
  | 'holo-shield'
  | 'overdrive-2x'
  | 'magnet'
  | 'jetpack'
  | 'hoverboard-shield'
  | 'multiplier2x';

export type GameState = 'playing' | 'crashed' | 'game-over';

export interface ActivePowerUps {
  magnetTimer: number;       // Remaining duration in seconds
  jetpackTimer: number;
  hoverboardShield: boolean; // Active until hit
  multiplierTimer: number;
}

export type OverdriveTier = 'Dormant' | 'Charged' | 'Overdrive' | 'Max-Velocity';
export type ComboTier = 'blue' | 'cyan' | 'magenta' | 'white-hot';

export interface PlayerStats {
  speed: number;
  maxSpeed: number;
  distance: number;
  score: number;
  highScore: number;
  styleMeter: number; // 0 to 100
  styleTier: 'Chill' | 'Breeze' | 'Flow' | 'Transcendent';
  overdriveMeter: number; // 0 to 100
  overdriveTier: OverdriveTier;
  comboTier: ComboTier;
  airTime: number;
  isGrounded: boolean;
  combo: number;
  windOrbsCollected: number;
  dataShardsCollected: number;
  currentBiome: BiomeType;
  currentFriction: number;
  activeTrickName: string | null;
  slowMoActive: boolean;
  isOnFloatingIsland: boolean;
  isBiomeTransitioning?: boolean;
  weather?: 'clear' | 'light-rain' | 'pollen-drift';

  // Cyber Navigation & Rail Grinding
  currentLane: LaneIndex;
  isSliding: boolean;
  slideTimer: number;
  isGrinding: boolean;
  isBoosting: boolean;
  boostEnergy: number;
  activePowerUps: ActivePowerUps;
  scoreMultiplier: number;
  gameState: GameState;
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

