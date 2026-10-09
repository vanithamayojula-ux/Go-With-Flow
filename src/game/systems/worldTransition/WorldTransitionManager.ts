import * as THREE from 'three';
import {
  WorldId,
  WorldConfig,
  WORLD_ORDER,
  WORLD_LENGTH_DISTANCE,
} from '../../WorldConfig';
import { WORLDS, getWorldConfig } from '../../worlds';

export type TransitionState = 'STABLE' | 'PREPARING' | 'TRANSITIONING' | 'COMPLETING';

export interface WorldTransitionMetrics {
  currentWorldId: WorldId;
  nextWorldId: WorldId;
  previousWorldId: WorldId;
  state: TransitionState;
  progress: number; // 0.0 when stable in current world, 0.0 -> 1.0 during transition zone
  isTransitioning: boolean;
  preloadDistance: number;
  transitionZoneLength: number;
}

export interface BlendedEnvironmentParams {
  skyTop: THREE.Color;
  skyBottom: THREE.Color;
  fogColor: THREE.Color;
  fogDensity: number;
  ambientColor: THREE.Color;
  ambientIntensity: number;
  sunColor: THREE.Color;
  sunIntensity: number;
  terrainColor: THREE.Color;
  terrainAccentColor: THREE.Color;
  energyColor: THREE.Color;
  currentWorldWeight: number; // 1.0 -> 0.0
  nextWorldWeight: number;    // 0.0 -> 1.0
}

/**
 * WorldTransitionManager orchestrates:
 * 1. Tracking player distance across the 5 campaign worlds (0 - 2249m, 2250 - 4499m, etc.)
 * 2. Preloading the upcoming world during the approach window
 * 3. Smooth mathematical crossfading of sky, fog, ambient, and sun lighting in transition zones
 * 4. Firing world entry callbacks with debouncing
 * 5. Lifecycle recycling of previous world instances
 */
export class WorldTransitionManager {
  public readonly worldLength: number = WORLD_LENGTH_DISTANCE; // 2250m per world
  public readonly transitionZoneLength: number = 300; // 300m smooth transition corridor
  public readonly preloadDistance: number = 150; // Preload 150m ahead of transition zone

  private _currentState: TransitionState = 'STABLE';
  private _currentWorldId: WorldId = 'sky-isles';
  private _previousWorldId: WorldId = 'sky-isles';
  private _nextWorldId: WorldId = 'verdant-wilds';

  private _transitionProgress = 0.0;
  private _lastAnnouncedWorldId: WorldId = 'sky-isles';

  // Cached color objects for zero-garbage interpolation
  private _tempColA = new THREE.Color();
  private _tempColB = new THREE.Color();
  private _blendedSkyTop = new THREE.Color();
  private _blendedSkyBottom = new THREE.Color();
  private _blendedFogColor = new THREE.Color();
  private _blendedAmbientColor = new THREE.Color();
  private _blendedSunColor = new THREE.Color();
  private _blendedTerrainColor = new THREE.Color();
  private _blendedTerrainAccentColor = new THREE.Color();
  private _blendedEnergyColor = new THREE.Color();

  // Reusable blended environment params (zero per-frame allocations)
  private _blendedParams: BlendedEnvironmentParams = {
    skyTop: this._blendedSkyTop,
    skyBottom: this._blendedSkyBottom,
    fogColor: this._blendedFogColor,
    fogDensity: 0.0035,
    ambientColor: this._blendedAmbientColor,
    ambientIntensity: 0.65,
    sunColor: this._blendedSunColor,
    sunIntensity: 0.85,
    terrainColor: this._blendedTerrainColor,
    terrainAccentColor: this._blendedTerrainAccentColor,
    energyColor: this._blendedEnergyColor,
    currentWorldWeight: 1.0,
    nextWorldWeight: 0.0,
  };

  // Reusable metrics object (zero per-frame allocations)
  private _metrics: WorldTransitionMetrics = {
    currentWorldId: 'sky-isles',
    nextWorldId: 'verdant-wilds',
    previousWorldId: 'sky-isles',
    state: 'STABLE',
    progress: 0.0,
    isTransitioning: false,
    preloadDistance: 150,
    transitionZoneLength: 300,
  };

  private _updateResult = {
    metrics: this._metrics,
    blended: this._blendedParams,
    shouldNotifyNewWorld: false,
    worldToAnnounce: undefined as WorldConfig | undefined,
  };

  constructor(initialWorldId: WorldId = 'sky-isles') {
    this._currentWorldId = initialWorldId;
    this._previousWorldId = initialWorldId;
    this._nextWorldId = this.computeNextWorld(initialWorldId);
    this._metrics.currentWorldId = initialWorldId;
    this._metrics.previousWorldId = initialWorldId;
    this._metrics.nextWorldId = this._nextWorldId;
  }


  public get currentState(): TransitionState {
    return this._currentState;
  }

  public get currentWorldId(): WorldId {
    return this._currentWorldId;
  }

  public get previousWorldId(): WorldId {
    return this._previousWorldId;
  }

  public get nextWorldId(): WorldId {
    return this._nextWorldId;
  }

  public get transitionProgress(): number {
    return this._transitionProgress;
  }

  public get isTransitioning(): boolean {
    return this._currentState === 'TRANSITIONING';
  }

  public update(distance: number): {
    metrics: WorldTransitionMetrics;
    blended: BlendedEnvironmentParams;
    shouldNotifyNewWorld: boolean;
    worldToAnnounce?: WorldConfig;
  } {
    const safeDist = Math.max(0, distance);
    const rawIndex = Math.floor(safeDist / this.worldLength);
    const worldIndex = Math.min(rawIndex, WORLD_ORDER.length - 1);
    const targetWorldId = WORLD_ORDER[worldIndex];

    const isFinalWorld = worldIndex === WORLD_ORDER.length - 1;
    const worldStartDist = worldIndex * this.worldLength;
    const worldEndDist = worldStartDist + this.worldLength;
    const distToBoundary = worldEndDist - safeDist;

    // Transition Zone calculations
    const transitionStartDist = worldEndDist - this.transitionZoneLength;
    const preloadStartDist = transitionStartDist - this.preloadDistance;

    let shouldNotify = false;
    let worldToAnnounce: WorldConfig | undefined;

    if (isFinalWorld) {
      // Final world (Obsidian Core) remains stable indefinitely
      this._currentState = 'STABLE';
      this._currentWorldId = targetWorldId;
      this._transitionProgress = 0.0;
      this._nextWorldId = targetWorldId;
    } else if (safeDist < preloadStartDist) {
      // Deep within current world: STABLE
      this._currentState = 'STABLE';
      this._currentWorldId = targetWorldId;
      this._nextWorldId = WORLD_ORDER[worldIndex + 1];
      this._transitionProgress = 0.0;
    } else if (safeDist < transitionStartDist) {
      // Approaching boundary within preload range: PREPARING
      this._currentState = 'PREPARING';
      this._currentWorldId = targetWorldId;
      this._nextWorldId = WORLD_ORDER[worldIndex + 1];
      this._transitionProgress = 0.0;
    } else if (safeDist < worldEndDist) {
      // Crossing through transition corridor: TRANSITIONING
      this._currentState = 'TRANSITIONING';
      this._currentWorldId = targetWorldId;
      this._nextWorldId = WORLD_ORDER[worldIndex + 1];
      // Progress from 0.0 (start of transition zone) to 1.0 (boundary)
      const rawProg = (safeDist - transitionStartDist) / this.transitionZoneLength;
      // Smooth Hermite smoothstep interpolation
      this._transitionProgress = THREE.MathUtils.smoothstep(rawProg, 0.0, 1.0);
    } else {
      // Crossed boundary into next world: COMPLETING -> STABLE
      this._currentState = 'COMPLETING';
      this._previousWorldId = targetWorldId;
      const nextIdx = Math.min(worldIndex + 1, WORLD_ORDER.length - 1);
      this._currentWorldId = WORLD_ORDER[nextIdx];
      this._nextWorldId = this.computeNextWorld(this._currentWorldId);
      this._transitionProgress = 0.0;
    }

    // Check if new world announcement notification is due
    if (this._currentWorldId !== this._lastAnnouncedWorldId) {
      this._lastAnnouncedWorldId = this._currentWorldId;
      shouldNotify = true;
      worldToAnnounce = getWorldConfig(this._currentWorldId);
    }

    const currentCfg = getWorldConfig(this._currentWorldId);
    const nextCfg = getWorldConfig(this._nextWorldId);

    // Compute Blended Environmental Parameters
    this.calculateBlendedEnvironment(
      currentCfg,
      nextCfg,
      this._transitionProgress
    );

    this._metrics.currentWorldId = this._currentWorldId;
    this._metrics.nextWorldId = this._nextWorldId;
    this._metrics.previousWorldId = this._previousWorldId;
    this._metrics.state = this._currentState;
    this._metrics.progress = this._transitionProgress;
    this._metrics.isTransitioning = this._currentState === 'TRANSITIONING';
    this._metrics.preloadDistance = this.preloadDistance;
    this._metrics.transitionZoneLength = this.transitionZoneLength;

    this._updateResult.metrics = this._metrics;
    this._updateResult.blended = this._blendedParams;
    this._updateResult.shouldNotifyNewWorld = shouldNotify;
    this._updateResult.worldToAnnounce = worldToAnnounce;

    return this._updateResult;
  }

  private calculateBlendedEnvironment(
    curr: WorldConfig,
    next: WorldConfig,
    t: number
  ): BlendedEnvironmentParams {
    const nextWeight = this.isTransitioning ? t : 0.0;
    const currWeight = 1.0 - nextWeight;

    // 1. Sky Colors
    this._tempColA.set(curr.palette.skyTop);
    this._tempColB.set(next.palette.skyTop);
    this._blendedSkyTop.copy(this._tempColA).lerp(this._tempColB, nextWeight);

    this._tempColA.set(curr.palette.skyBottom);
    this._tempColB.set(next.palette.skyBottom);
    this._blendedSkyBottom.copy(this._tempColA).lerp(this._tempColB, nextWeight);

    // 2. Fog
    this._tempColA.set(curr.palette.fog);
    this._tempColB.set(next.palette.fog);
    this._blendedFogColor.copy(this._tempColA).lerp(this._tempColB, nextWeight);

    const fogDensity = THREE.MathUtils.lerp(
      curr.atmosphere.fogDensity,
      next.atmosphere.fogDensity,
      nextWeight
    );

    // 3. Ambient Lighting
    this._tempColA.set(curr.lighting.ambientColor);
    this._tempColB.set(next.lighting.ambientColor);
    this._blendedAmbientColor.copy(this._tempColA).lerp(this._tempColB, nextWeight);

    const ambientIntensity = THREE.MathUtils.lerp(
      curr.lighting.ambient,
      next.lighting.ambient,
      nextWeight
    );

    // 4. Sun Lighting
    this._tempColA.set(curr.lighting.sunColor);
    this._tempColB.set(next.lighting.sunColor);
    this._blendedSunColor.copy(this._tempColA).lerp(this._tempColB, nextWeight);

    const sunIntensity = THREE.MathUtils.lerp(
      curr.lighting.sun,
      next.lighting.sun,
      nextWeight
    );

    // 5. Terrain & Energy Colors
    this._tempColA.set(curr.palette.terrain);
    this._tempColB.set(next.palette.terrain);
    this._blendedTerrainColor.copy(this._tempColA).lerp(this._tempColB, nextWeight);

    this._tempColA.set(curr.palette.terrainAccent);
    this._tempColB.set(next.palette.terrainAccent);
    this._blendedTerrainAccentColor.copy(this._tempColA).lerp(this._tempColB, nextWeight);

    this._tempColA.set(curr.palette.energy);
    this._tempColB.set(next.palette.energy);
    this._blendedEnergyColor.copy(this._tempColA).lerp(this._tempColB, nextWeight);

    this._blendedParams.fogDensity = fogDensity;
    this._blendedParams.ambientIntensity = ambientIntensity;
    this._blendedParams.sunIntensity = sunIntensity;
    this._blendedParams.currentWorldWeight = currWeight;
    this._blendedParams.nextWorldWeight = nextWeight;

    return this._blendedParams;
  }

  private computeNextWorld(id: WorldId): WorldId {
    const idx = WORLD_ORDER.indexOf(id);
    if (idx !== -1 && idx < WORLD_ORDER.length - 1) {
      return WORLD_ORDER[idx + 1];
    }
    return id;
  }

  public getCurrentWorld(): WorldConfig {
    return getWorldConfig(this._currentWorldId);
  }

  public getCurrentWorldId(): WorldId {
    return this._currentWorldId;
  }

  public setWorld(worldId: WorldId): void {
    this._currentWorldId = worldId;
    this._previousWorldId = worldId;
    this._nextWorldId = this.computeNextWorld(worldId);
    this._lastAnnouncedWorldId = worldId;
    this._currentState = 'STABLE';
    this._transitionProgress = 0.0;
  }

  public reset(): void {
    this.setWorld('sky-isles');
  }

  public dispose(): void {
    this.reset();
  }
}
