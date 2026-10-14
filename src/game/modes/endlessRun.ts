/**
 * GoWithFlow — Endless Run Game Mode
 * Infinite 5-World cycling with progressive velocity escalation, loop tracking,
 * and isolated personal record persistence.
 */

import { PlayerStats } from '../../types';
import {
  GameMode,
  GameModeId,
  GameModeSummary,
  ChallengeModifier,
} from './gameModeTypes';
import { WORLD_LENGTH_DISTANCE } from '../WorldConfig';

export const ENDLESS_STORAGE_KEY = 'skyflow_endless_records_v1';
export const ENDLESS_TOTAL_CYCLE_DISTANCE = WORLD_LENGTH_DISTANCE * 5; // 11,250m per loop

export interface EndlessRecords {
  highestScore: number;
  longestDistance: number;
  highestLoop: number;
  totalRuns: number;
  lastPlayedTimestamp: number;
}

export function loadEndlessRecords(): EndlessRecords {
  if (typeof localStorage === 'undefined') {
    return {
      highestScore: 0,
      longestDistance: 0,
      highestLoop: 1,
      totalRuns: 0,
      lastPlayedTimestamp: Date.now(),
    };
  }

  try {
    const raw = localStorage.getItem(ENDLESS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return {
          highestScore: typeof parsed.highestScore === 'number' ? parsed.highestScore : 0,
          longestDistance: typeof parsed.longestDistance === 'number' ? parsed.longestDistance : 0,
          highestLoop: typeof parsed.highestLoop === 'number' ? Math.max(1, parsed.highestLoop) : 1,
          totalRuns: typeof parsed.totalRuns === 'number' ? parsed.totalRuns : 0,
          lastPlayedTimestamp: Date.now(),
        };
      }
    }
  } catch (err) {
    console.warn('[EndlessRunMode] Failed to parse endless records, using defaults', err);
  }

  return {
    highestScore: 0,
    longestDistance: 0,
    highestLoop: 1,
    totalRuns: 0,
    lastPlayedTimestamp: Date.now(),
  };
}

export function saveEndlessRecords(records: EndlessRecords): void {
  if (typeof localStorage === 'undefined') return;
  try {
    records.lastPlayedTimestamp = Date.now();
    localStorage.setItem(ENDLESS_STORAGE_KEY, JSON.stringify(records));
  } catch (err) {
    console.error('[EndlessRunMode] Failed to save endless records to localStorage', err);
  }
}

export class EndlessRunMode implements GameMode {
  public readonly id: GameModeId = 'endless';
  public readonly name: string = 'Endless Mode';
  public readonly description: string = 'Infinite flight across looping worlds with escalating difficulty.';
  public readonly modifiers: ChallengeModifier[] = [];
  public readonly allowsRevive: boolean = true;

  private durationSeconds: number = 0;
  private currentStats: PlayerStats | null = null;
  private obstaclesPassedCount: number = 0;
  private worldReachedName: string = 'Sky Isles';
  private records: EndlessRecords;

  constructor() {
    this.records = loadEndlessRecords();
  }

  public getRecords(): EndlessRecords {
    return this.records;
  }

  public initialize(_initialModifiers?: ChallengeModifier[]): void {
    this.durationSeconds = 0;
    this.currentStats = null;
    this.obstaclesPassedCount = 0;
    this.worldReachedName = 'Sky Isles';
    this.records = loadEndlessRecords();
    this.records.totalRuns++;
    saveEndlessRecords(this.records);
  }

  public update(delta: number, currentStats: PlayerStats): void {
    this.durationSeconds += delta;
    this.currentStats = currentStats;
  }

  public onCollect(_count: number, _currentStats: PlayerStats): void {
    // Collectibles tracked in stats
  }

  public onObstaclePassed(_obstacleType: string, _isNearMiss: boolean): void {
    this.obstaclesPassedCount++;
  }

  public onWorldChanged(worldId: string, _worldIndex: number): void {
    const worldNames: Record<string, string> = {
      'sky-isles': 'Sky Isles',
      'verdant-wilds': 'Verdant Wilds',
      'crimson-dunes': 'Crimson Dunes',
      'crystal-heights': 'Crystal Heights',
      'obsidian-core': 'Obsidian Core',
    };
    this.worldReachedName = worldNames[worldId] || worldId;
  }

  public onGameOver(finalStats: PlayerStats): void {
    this.currentStats = finalStats;

    const currentDist = finalStats.distance;
    const currentScore = finalStats.score;
    const currentLoop = Math.floor(currentDist / ENDLESS_TOTAL_CYCLE_DISTANCE) + 1;

    let updated = false;
    if (currentScore > this.records.highestScore) {
      this.records.highestScore = currentScore;
      updated = true;
    }
    if (currentDist > this.records.longestDistance) {
      this.records.longestDistance = currentDist;
      updated = true;
    }
    if (currentLoop > this.records.highestLoop) {
      this.records.highestLoop = currentLoop;
      updated = true;
    }

    if (updated || this.records.totalRuns % 5 === 0) {
      saveEndlessRecords(this.records);
    }
  }

  public onRevive(): void {
    // Permitted in endless mode
  }

  public getScore(): number {
    return this.currentStats ? this.currentStats.score : 0;
  }

  public getCurrentLoop(): number {
    if (!this.currentStats) return 1;
    return Math.floor(this.currentStats.distance / ENDLESS_TOTAL_CYCLE_DISTANCE) + 1;
  }

  public getHudMetrics(): {
    primaryLabel: string;
    primaryValue: string;
    secondaryLabel: string;
    secondaryValue: string;
    tertiaryLabel?: string;
    tertiaryValue?: string;
    statusBadge?: string;
  } {
    const score = this.currentStats ? this.currentStats.score : 0;
    const dist = this.currentStats ? this.currentStats.distance : 0;
    const loop = this.getCurrentLoop();
    const shards = this.currentStats ? (this.currentStats.dataShardsCollected || this.currentStats.windOrbsCollected || 0) : 0;

    return {
      primaryLabel: `LOOP ${loop}`,
      primaryValue: `${dist.toLocaleString()}m`,
      secondaryLabel: 'RECORD',
      secondaryValue: `${Math.max(dist, this.records.longestDistance).toLocaleString()}m`,
      tertiaryLabel: 'SHARDS',
      tertiaryValue: shards.toString(),
      statusBadge: `ENDLESS L${loop}`,
    };
  }

  public isObjectiveCompleted(): boolean {
    return false; // Endless mode is unending
  }

  public getSummary(): GameModeSummary {
    const score = this.currentStats ? this.currentStats.score : 0;
    const dist = this.currentStats ? this.currentStats.distance : 0;
    const loop = this.getCurrentLoop();
    const shards = this.currentStats ? (this.currentStats.dataShardsCollected || this.currentStats.windOrbsCollected || 0) : 0;
    const nearMisses = this.currentStats ? (this.currentStats.nearMissCount || 0) : 0;
    const isNewRecord = score >= this.records.highestScore || dist >= this.records.longestDistance;

    return {
      modeId: 'endless',
      modeName: 'Endless Mode',
      score,
      finalScore: score,
      distance: dist,
      durationSeconds: Math.round(this.durationSeconds),
      shardsCollected: shards,
      nearMisses,
      obstaclesPassed: this.obstaclesPassedCount,
      worldReached: `${this.worldReachedName} (Loop ${loop})`,
      isCompleted: false,
      isNewRecord,
      breakdown: [
        { label: 'Final Score', value: score.toLocaleString() },
        { label: 'Total Distance', value: `${dist.toLocaleString()}m` },
        { label: 'Loop Completed', value: `Loop ${loop}` },
        { label: 'Best Endless Dist', value: `${Math.max(dist, this.records.longestDistance).toLocaleString()}m` },
        { label: 'Shards Harvested', value: shards.toLocaleString() },
      ],
      xpAwarded: Math.round(dist * 0.12),
    };
  }

  public dispose(): void {
    this.currentStats = null;
  }
}
