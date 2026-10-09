/**
 * GoWithFlow — Survival Game Mode
 * Phase 15 Section 5: High-G endurance mode with escalating velocity, obstacle density, and no revives.
 */

import { PlayerStats } from '../../types';
import {
  GameMode,
  GameModeId,
  GameModeSummary,
  ChallengeModifier,
} from './gameModeTypes';

export class SurvivalMode implements GameMode {
  public readonly id: GameModeId = 'survival';
  public readonly name: string = 'Survival';
  public readonly description: string = 'Endure escalating speed and hazard density for as long as possible.';
  public readonly modifiers: ChallengeModifier[] = [
    {
      id: 'mod_survival_scaling',
      name: 'Dynamic High-G Overload',
      description: 'Progressive velocity and hazard pressure increase every 15 seconds.',
    },
  ];
  public readonly allowsRevive: boolean = false; // Survival is 1 hit knockout

  private durationSeconds: number = 0;
  private currentStats: PlayerStats | null = null;
  private obstaclesPassedCount: number = 0;
  private nearMissCount: number = 0;
  private currentWorldName: string = 'Sky Isles';
  private targetSurvivalTime: number = 180; // 3 minutes benchmark

  public initialize(_initialModifiers?: ChallengeModifier[]): void {
    this.durationSeconds = 0;
    this.currentStats = null;
    this.obstaclesPassedCount = 0;
    this.nearMissCount = 0;
    this.currentWorldName = 'Sky Isles';
  }

  public update(delta: number, currentStats: PlayerStats): void {
    this.durationSeconds += delta;
    this.currentStats = currentStats;
  }

  public onCollect(_count: number, currentStats: PlayerStats): void {
    this.currentStats = currentStats;
  }

  public onObstaclePassed(_obstacleType: string, isNearMiss: boolean): void {
    this.obstaclesPassedCount++;
    if (isNearMiss) {
      this.nearMissCount++;
    }
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
  }

  public onRevive(): void {
    // Revive not permitted in Survival
  }

  public getScore(): number {
    // Score directly governed by seconds survived * 100 + obstacle dodges * 50
    const timeScore = Math.floor(this.durationSeconds * 100);
    const passScore = this.obstaclesPassedCount * 50;
    const nearMissScore = this.nearMissCount * 150;
    return timeScore + passScore + nearMissScore;
  }

  public getDifficultyTier(): string {
    if (this.durationSeconds > 180) return 'OVERDRIVE EXTREME';
    if (this.durationSeconds > 120) return 'HIGH-G TIER 3';
    if (this.durationSeconds > 60) return 'INTENSE TIER 2';
    return 'NOMINAL TIER 1';
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
    const mins = Math.floor(this.durationSeconds / 60);
    const secs = Math.floor(this.durationSeconds % 60);
    const timeFormatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    const speed = this.currentStats ? `${this.currentStats.speed} km/h` : '0 km/h';

    return {
      primaryLabel: 'SURVIVAL TIME',
      primaryValue: timeFormatted,
      secondaryLabel: 'CURRENT SPEED',
      secondaryValue: speed,
      tertiaryLabel: 'HAZARDS CLEARED',
      tertiaryValue: this.obstaclesPassedCount.toString(),
      statusBadge: this.getDifficultyTier(),
    };
  }

  public isObjectiveCompleted(): boolean {
    return this.durationSeconds >= this.targetSurvivalTime;
  }

  public getSummary(): GameModeSummary {
    const score = this.getScore();
    const dist = this.currentStats ? this.currentStats.distance : 0;
    const shards = this.currentStats ? (this.currentStats.dataShardsCollected || this.currentStats.windOrbsCollected || 0) : 0;
    const mins = Math.floor(this.durationSeconds / 60);
    const secs = Math.floor(this.durationSeconds % 60);
    const timeFormatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

    return {
      modeId: this.id,
      modeName: this.name,
      score,
      finalScore: score,
      distance: dist,
      durationSeconds: Math.floor(this.durationSeconds),
      shardsCollected: shards,
      nearMisses: this.nearMissCount,
      obstaclesPassed: this.obstaclesPassedCount,
      worldReached: this.currentWorldName,
      isCompleted: this.durationSeconds >= this.targetSurvivalTime,
      isNewRecord: false,
      breakdown: [
        { label: 'Time Survived', value: timeFormatted, bonus: Math.floor(this.durationSeconds * 100) },
        { label: 'Hazards Evaded', value: this.obstaclesPassedCount, bonus: this.obstaclesPassedCount * 50 },
        { label: 'Near-Miss Grazes', value: this.nearMissCount, bonus: this.nearMissCount * 150 },
        { label: 'Endurance Tier Achieved', value: this.getDifficultyTier() },
      ],
      xpAwarded: Math.min(1500, Math.floor(this.durationSeconds * 4) + Math.floor(dist * 0.08)),
    };
  }

  public dispose(): void {
    this.currentStats = null;
  }
}
