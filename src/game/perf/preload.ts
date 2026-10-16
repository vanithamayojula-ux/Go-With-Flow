import { HeroId } from '../../types';
import { ObstacleManager } from '../obstacles';
import { loadHeroModel } from '../heroRig';
import { preloadWorldAssets } from '../../graphics/assetLibrary';
import { prepareRoadTextures, RoadTextureSpec } from '../../graphics/roadTextures';
import { DIVIDER_X, LANE_WIDTH, RAIL_X } from '../trackConfig';

/**
 * The highway's texture spec, exactly as TerrainManager requests it (same
 * values, same key order: the cache is keyed by its JSON). If the two ever
 * drift apart nothing breaks: the terrain just builds its maps itself.
 */
const ROAD_TEXTURE_SPEC: RoadTextureSpec = {
  halfWidth: RAIL_X,
  tileLength: 20,
  dividerX: DIVIDER_X,
  edgeLineX: LANE_WIDTH * 1.5 + 0.05,
  laneCentersX: [-LANE_WIDTH, 0, LANE_WIDTH],
  dashPeriod: 10,
  dashLength: 3,
};

// Longest the run start waits for the road maps from the worker before the
// terrain builds them itself (it never waits when the worker isn't there).
const ROAD_WAIT_MS = 4000;
let roadPromise: Promise<void> | null = null;

/** Start generating the highway's procedural maps in a worker (idempotent). */
export function preloadRoadTextures(): Promise<void> {
  if (!roadPromise) {
    try {
      roadPromise = prepareRoadTextures(ROAD_TEXTURE_SPEC).catch(() => undefined);
    } catch {
      roadPromise = Promise.resolve();
    }
  }
  return roadPromise;
}

/**
 * Resolves once the road maps are cached (generated off the main thread),
 * or after ROAD_WAIT_MS: the engine is constructed after this so building
 * the terrain is not a ~1.5 s main-thread task.
 */
export function whenRoadTexturesReady(): Promise<void> {
  const p = preloadRoadTextures();
  return Promise.race([p, new Promise<void>(resolve => setTimeout(resolve, ROAD_WAIT_MS))]);
}

/**
 * Start downloading/decoding the run's GLBs (hero + obstacle models with
 * their LODs) and the first world's scanned textures while the opening
 * screen is up, so the first seconds of a run don't stall on them (or on the
 * material swap when they would otherwise arrive mid-run). The highway maps
 * are generated in a worker meanwhile. Idempotent; failures fall back to the
 * procedural models exactly as before.
 */
export function preloadGameAssets(heroId?: HeroId): void {
  if (typeof window === 'undefined') return;
  // Off the main thread from the start (it takes ~1.5 s of worker time).
  void preloadRoadTextures();
  const start = () => {
    ObstacleManager.preloadObstacleModels().catch(() => undefined);
    if (heroId) loadHeroModel(heroId).catch(() => undefined);
    try {
      preloadWorldAssets('sky-isles').catch(() => undefined);
    } catch {
      /* the world falls back to its procedural textures */
    }
  };
  const ric = (window as any).requestIdleCallback as ((cb: () => void, opts?: { timeout: number }) => number) | undefined;
  if (typeof ric === 'function') ric(start, { timeout: 1200 });
  else window.setTimeout(start, 300);
}
