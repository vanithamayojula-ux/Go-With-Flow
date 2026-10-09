import {
  WorldId,
  WorldConfig,
  WORLD_ORDER,
  WORLD_LENGTH_DISTANCE,
} from './WorldConfig';
import {
  WORLDS,
  getWorldConfig,
  getWorldForBiome,
  getWorldIdForBiome,
  getWorldAtDistance,
  getEffectiveWorldDensity,
} from './worlds';
import { BiomeType, GraphicsConfig } from '../types';
import {
  WorldTransitionManager,
  WorldTransitionMetrics,
  BlendedEnvironmentParams,
} from './systems/worldTransition';

export class WorldManager {
  private _transitionManager: WorldTransitionManager;

  constructor(initialWorldId: WorldId = 'sky-isles') {
    this._transitionManager = new WorldTransitionManager(initialWorldId);
  }

  public get transitionManager(): WorldTransitionManager {
    return this._transitionManager;
  }

  public get currentWorldId(): WorldId {
    return this._transitionManager.currentWorldId;
  }

  public get currentWorldConfig(): WorldConfig {
    return getWorldConfig(this._transitionManager.currentWorldId);
  }

  public get previousWorldId(): WorldId {
    return this._transitionManager.previousWorldId;
  }

  public get nextWorldId(): WorldId {
    return this._transitionManager.nextWorldId;
  }

  public get nextWorldConfig(): WorldConfig {
    return getWorldConfig(this._transitionManager.nextWorldId);
  }

  public get transitionProgress(): number {
    return this._transitionManager.transitionProgress;
  }

  public getCurrentWorld(): WorldConfig {
    return this.currentWorldConfig;
  }

  public getCurrentWorldId(): WorldId {
    return this.currentWorldId;
  }

  /**
   * Set the active world explicitly.
   */
  public setWorld(worldId: WorldId): void {
    this._transitionManager.setWorld(worldId);
  }

  /**
   * Update world progression based on distance. Returns transition metrics and blended environment.
   */
  public updateByDistance(distance: number): {
    metrics: WorldTransitionMetrics;
    blended: BlendedEnvironmentParams;
    shouldNotifyNewWorld: boolean;
    worldToAnnounce?: WorldConfig;
  } {
    return this._transitionManager.update(distance);
  }

  /**
   * Compute world from active biome.
   */
  public updateByBiome(biome: BiomeType): WorldConfig {
    const worldId = getWorldIdForBiome(biome);
    this.setWorld(worldId);
    return this.currentWorldConfig;
  }

  /**
   * Scales decoration density according to graphics quality.
   */
  public getEffectiveDensity(graphicsConfig: GraphicsConfig): number {
    return getEffectiveWorldDensity(this.currentWorldConfig, graphicsConfig);
  }

  /**
   * Clean up world manager state on session end.
   */
  public dispose(): void {
    this._transitionManager.dispose();
  }
}
