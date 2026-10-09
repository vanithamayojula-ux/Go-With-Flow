/**
 * GoWithFlow — Standard Run Game Mode
 * Preserves the default 5-world flight experience untouched.
 */

import { PlayerStats } from '../../types';
import {
  GameMode,
  GameModeId,
  GameModeSummary,
  ChallengeModifier,
} from './gameModeTypes';

export class StandardRunMode implements GameMode {
  public readonly id: GameModeId = 'standard-run';
  public readonly name: string = 'Standard Run';
  public readonly description: string = 'The core five-world exploration journey.';
  public readonly modifiers: ChallengeModifier[] = [];
  public readonly allowsRevive: boolean = true;

  private durationSeconds: number = 0;
  private currentStats: PlayerStats | null = null;
  private obstaclesPassedCount: number = 0;
  private worldReachedName: string = 'Sky Isles';

  public initialize(_initialModifiers?: ChallengeModifier[]): void {
    this.durationSeconds = 0;
    this.currentStats = null;
    this.obstaclesPassedCount = 0;
    this.worldReachedName = 'Sky Isles';
  }

  public update(delta: number, currentStats: PlayerStats): void {
    this.durationSeconds += delta;
    this.currentStats = currentStats;
  }

  public onCollect(_count: number, _currentStats: PlayerStats): void {
    // Normal shard/coin collection logic in playerMgr handles standard scoring
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
  }

  public onRevive(): void {
    // Allowed in standard run with no score deduction
  }

  public getScore(): number {
    return this.currentStats ? this.currentStats.score : 0;
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
    const shards = this.currentStats ? (this.currentStats.dataShardsCollected || this.currentStats.windOrbsCollected || 0) : 0;
    return {
      primaryLabel: 'SCORE',
      primaryValue: score.toLocaleString(),
      secondaryLabel: 'DISTANCE',
      secondaryValue: `${dist.toLocaleString()}m`,
      tertiaryLabel: 'SHARDS',
      tertiaryValue: shards.toString(),
    };
  }

  public isObjectiveCompleted(): boolean {
    // Standard run is continuous endless flight
    return false;
  }

  public getSummary(): GameModeSummary {
    const score = this.currentStats ? this.currentStats.score : 0;
    const dist = this.currentStats ? this.currentStats.distance : 0;
    const shards = this.currentStats ? (this.currentStats.dataShardsCollected || this.currentStats.windOrbsCollected || 0) : 0;
    const nearMisses = this.currentStats ? (this.currentStats.nearMissCount || 0) : 0;

    return {
      modeId: this.id,
      modeName: this.name,
      score,
      finalScore: score,
      distance: dist,
      durationSeconds: Math.floor(this.durationSeconds),
      shardsCollected: shards,
      nearMisses,
      obstaclesPassed: this.obstaclesPassedCount,
      worldReached: this.worldReachedName,
      isCompleted: false,
      isNewRecord: false,
      breakdown: [
        { label: 'Flight Distance', value: `${dist.toLocaleString()}m`, bonus: Math.floor(dist * 0.5) },
        { label: 'Data Shards Harvested', value: shards, bonus: shards * 100 },
        { label: 'Near-Miss Passes', value: nearMisses, bonus: nearMisses * 150 },
      ],
      xpAwarded: Math.min(1000, Math.floor(score * 0.05) + Math.floor(dist * 0.1)),
    };
  }

  public dispose(): void {
    this.currentStats = null;
  }
}
