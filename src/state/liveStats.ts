import { useSyncExternalStore } from 'react';
import { PlayerStats } from '../types';

/**
 * Live run telemetry pushed by the engine (~15x/s) and read by the HUD via
 * useSyncExternalStore, so only subscribed components re-render: the App
 * shell no longer re-renders on every stats tick.
 */
export interface LiveStatsSnapshot {
  /** Copy of the player's stats at publish time (new object only when it changed). */
  stats: PlayerStats;
  fps: number;
  drawCalls: number;
  instances: number;
  /** Adaptive render scale label for the debug readout (e.g. "1.25x"). */
  renderScale: string;
  /** Increments on every publish. */
  version: number;
}

type Listener = () => void;

const DEFAULT_STATS: PlayerStats = {
  speed: 24,
  maxSpeed: 52,
  distance: 0,
  score: 0,
  highScore: 0,
  styleMeter: 25,
  styleTier: 'Chill',
  overdriveMeter: 25,
  overdriveTier: 'Charged',
  comboTier: 'blue',
  airTime: 0,
  isGrounded: true,
  combo: 0,
  windOrbsCollected: 0,
  dataShardsCollected: 0,
  currentBiome: 'neon-undercity',
  currentFriction: 0.02,
  activeTrickName: null,
  slowMoActive: false,
  isOnFloatingIsland: false,
  currentLane: 0,
  isSliding: false,
  slideTimer: 0,
  isGrinding: false,
  isBoosting: false,
  boostEnergy: 100,
  activePowerUps: {
    magnetTimer: 0,
    jetpackTimer: 0,
    hoverboardShield: false,
    multiplierTimer: 0,
  },
  scoreMultiplier: 1,
  gameState: 'playing',
  isHolding: true,
};

const listeners = new Set<Listener>();
let snapshot: LiveStatsSnapshot = {
  stats: DEFAULT_STATS,
  fps: 60,
  drawCalls: 0,
  instances: 0,
  renderScale: '',
  version: 0,
};
// The engine's own (mutable) stats object, for callers that must write back
// into the running game (e.g. revive spending run shards).
let liveObject: PlayerStats | null = null;
let highScoreFloor = 0;

// Cheap change signature over the fields any UI shows.
let lastSig = '';
function signature(s: PlayerStats): string {
  const p = s.activePowerUps;
  return (
    s.gameState + '|' + Math.floor(s.score) + '|' + Math.floor(s.distance) + '|' + s.speed + '|' +
    s.dataShardsCollected + '|' + s.combo + '|' + (s.activeTrickName || '') + '|' + Math.round(s.overdriveMeter || 0) + '|' +
    s.isGrounded + s.isGrinding + s.isBoosting + s.slowMoActive + s.isSliding + '|' + s.currentLane + '|' +
    (s.currentWorldId || '') + s.currentBiome + '|' + s.highScore + '|' + s.scoreMultiplier + '|' +
    (p ? (p.magnetTimer > 0 ? p.magnetTimer.toFixed(1) : '0') + (p.jetpackTimer > 0 ? p.jetpackTimer.toFixed(1) : '0') +
      (p.multiplierTimer > 0 ? p.multiplierTimer.toFixed(1) : '0') + p.hoverboardShield : '') + '|' +
    (s.shieldCooldown !== undefined ? Math.ceil(s.shieldCooldown) : '') + '|' + (s.overdriveTier || '') + (s.styleTier || '') + '|' + !!s.isHolding
  );
}

function emit(): void {
  for (const l of listeners) l();
}

export const liveStats = {
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  getSnapshot(): LiveStatsSnapshot {
    return snapshot;
  },

  /** The engine's live stats object (mutations reach the running game). */
  getLiveStats(): PlayerStats {
    return liveObject ?? snapshot.stats;
  },

  /** Best score known to the UI; published stats never show less. */
  setHighScoreFloor(score: number): void {
    highScoreFloor = Math.max(0, score || 0);
  },

  /** Engine -> store. Copies the stats only when something visible changed. */
  publish(stats: PlayerStats, fps: number, drawCalls: number, instances: number, renderScale: string): void {
    liveObject = stats;
    const best = Math.max(stats.highScore || 0, highScoreFloor, stats.score || 0);
    if (best !== stats.highScore) stats.highScore = best;
    const sig = signature(stats);
    const statsChanged = sig !== lastSig;
    if (
      !statsChanged &&
      fps === snapshot.fps &&
      drawCalls === snapshot.drawCalls &&
      instances === snapshot.instances &&
      renderScale === snapshot.renderScale
    ) {
      return;
    }
    lastSig = sig;
    snapshot = {
      stats: statsChanged ? { ...stats, activePowerUps: { ...stats.activePowerUps } } : snapshot.stats,
      fps,
      drawCalls,
      instances,
      renderScale,
      version: snapshot.version + 1,
    };
    emit();
  },

  /** Re-publish after writing into getLiveStats() from the UI (e.g. revive). */
  refresh(): void {
    const s = liveObject;
    if (!s) return;
    lastSig = '';
    this.publish(s, snapshot.fps, snapshot.drawCalls, snapshot.instances, snapshot.renderScale);
  },
};

/** Full snapshot: re-renders on every publish (the in-run HUD). */
export function useLiveStats(): LiveStatsSnapshot {
  return useSyncExternalStore(liveStats.subscribe, liveStats.getSnapshot, liveStats.getSnapshot);
}

/** Only the stats object: re-renders when a visible stat changed. */
export function useLiveStatsOnly(): PlayerStats {
  const get = () => snapshot.stats;
  return useSyncExternalStore(liveStats.subscribe, get, get);
}

/**
 * A derived primitive (boolean/number/string): re-renders only when it
 * changes. `select` must return a primitive or a stable reference.
 */
export function useLiveStatsSelector<T>(select: (s: LiveStatsSnapshot) => T): T {
  const get = () => select(snapshot);
  return useSyncExternalStore(liveStats.subscribe, get, get);
}
