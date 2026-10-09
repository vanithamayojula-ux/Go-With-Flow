/**
 * GoWithFlow — Time Trial Game Mode
 * Phase 15 Section 4: Sprint against the clock to reach target checkpoint distance as fast as possible.
 */

import { PlayerStats } from '../../types';
import {
  GameMode,
  GameModeId,
  GameModeSummary,
  ChallengeModifier,
} from './gameModeTypes';

export class TimeTrialMode implements GameMode {
  public readonly id: GameModeId = 'time-trial';
  public readonly name: string = 'Time Trial';
  public readonly description: string = 'Reach the 3,000m sector checkpoint in the fastest possible time.';
  public readonly modifiers: ChallengeModifier[] = [];
  public readonly allowsRevive: boolean = false; // Strictly 1 attempt, no revive

  public targetDistance: number = 3000;
  private durationSeconds: number = 0;
  private currentStats: PlayerStats | null = null;
  private obstaclesPassedCount: number = 0;
  private isFinished: boolean = false;
  private finishTimeSeconds: number = 0;
  private currentWorldName: string = 'Sky Isles';

  public initialize(initialModifiers?: ChallengeModifier[]): void {
    this.targetDistance = 3000;
    if (initialModifiers) {
      const distMod = initialModifiers.find(m => m.targetDistance);
      if (distMod && distMod.targetDistance) {
        this.targetDistance = distMod.targetDistance;
      }
    }
    this.durationSeconds = 0;
    this.currentStats = null;
    this.obstaclesPassedCount = 0;
    this.isFinished = false;
    this.finishTimeSeconds = 0;
    this.currentWorldName = 'Sky Isles';
  }

  public update(delta: number, currentStats: PlayerStats): void {
    this.currentStats = currentStats;

    if (!this.isFinished) {
      this.durationSeconds += delta;

      // Check checkpoint reach
      if (currentStats.distance >= this.targetDistance) {
        this.isFinished = true;
        this.finishTimeSeconds = this.durationSeconds;
      }
    }
  }

  public onCollect(_count: number, currentStats: PlayerStats): void {
    this.currentStats = currentStats;
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
    this.currentWorldName = worldNames[worldId] || worldId;
  }

  public onGameOver(finalStats: PlayerStats): void {
    this.currentStats = finalStats;
    if (!this.isFinished && finalStats.distance >= this.targetDistance) {
      this.isFinished = true;
      this.finishTimeSeconds = this.durationSeconds;
    }
  }

  public onRevive(): void {
    // Revives disabled in Time Trial
  }

  public formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
  }

  public getScore(): number {
    // Time trial score: Higher if faster completion, otherwise distance reached
    if (this.isFinished) {
      // Base completion 10,000 pts minus 10 pts per second taken
      return Math.max(1000, 10000 - Math.floor(this.finishTimeSeconds * 10));
    }
    return this.currentStats ? Math.floor(this.currentStats.distance) : 0;
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
    const dist = this.currentStats ? this.currentStats.distance : 0;
    const remaining = Math.max(0, this.targetDistance - dist);
    const displayTime = this.isFinished ? this.finishTimeSeconds : this.durationSeconds;

    return {
      primaryLabel: 'CHRONO TIME',
      primaryValue: this.formatTime(displayTime),
      secondaryLabel: 'TARGET',
      secondaryValue: `${this.targetDistance.toLocaleString()}m`,
      tertiaryLabel: 'REMAINING',
      tertiaryValue: `${remaining.toLocaleString()}m`,
      statusBadge: this.isFinished ? 'GOAL COMPLETED!' : 'SPRINT ACTIVE',
    };
  }

  public isObjectiveCompleted(): boolean {
    return this.isFinished;
  }

  public getSummary(): GameModeSummary {
    const dist = this.currentStats ? this.currentStats.distance : 0;
    const shards = this.currentStats ? (this.currentStats.dataShardsCollected || this.currentStats.windOrbsCollected || 0) : 0;
    const nearMisses = this.currentStats ? (this.currentStats.nearMissCount || 0) : 0;
    const timeUsed = this.isFinished ? this.finishTimeSeconds : this.durationSeconds;
    const score = this.getScore();

    return {
      modeId: this.id,
      modeName: this.name,
      score,
      finalScore: score,
      distance: dist,
      durationSeconds: Number(timeUsed.toFixed(2)),
      shardsCollected: shards,
      nearMisses,
      obstaclesPassed: this.obstaclesPassedCount,
      worldReached: this.currentWorldName,
      isCompleted: this.isFinished,
      isNewRecord: false,
      breakdown: [
        { label: 'Target Distance', value: `${this.targetDistance.toLocaleString()}m` },
        { label: 'Distance Covered', value: `${dist.toLocaleString()}m` },
        { label: 'Official Chrono Time', value: this.formatTime(timeUsed) },
        { label: 'Trial Status', value: this.isFinished ? 'COMPLETED' : 'INCOMPLETE (CRASHED)' },
      ],
      xpAwarded: this.isFinished ? 600 : Math.floor(dist * 0.1),
    };
  }

  public dispose(): void {
    this.currentStats = null;
  }
}
