import { HeroId } from '../../types';
import { ObstacleManager } from '../obstacles';
import { loadHeroModel } from '../heroRig';
import { preloadWorldAssets } from '../../graphics/assetLibrary';

/**
 * Start downloading/decoding the run's GLBs (hero + obstacle models with
 * their LODs) and the first world's scanned textures while the opening
 * screen is up, so the first seconds of a run don't stall on them (or on the
 * material swap when they would otherwise arrive mid-run). Idempotent;
 * failures fall back to the procedural models exactly as before.
 */
export function preloadGameAssets(heroId?: HeroId): void {
  if (typeof window === 'undefined') return;
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
