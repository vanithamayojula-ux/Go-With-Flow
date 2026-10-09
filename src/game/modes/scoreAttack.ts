/**
 * GoWithFlow — Score Attack Game Mode
 * Phase 15 Section 3: High-score optimization, multipliers, near-miss bonuses, and clean sector clears.
 */

import { PlayerStats } from '../../types';
import {
  GameMode,
  GameModeId,
  GameModeSummary,
  ChallengeModifier,
  GameModeScoreBreakdown,
} from './gameModeTypes';

export class ScoreAttackMode implements GameMode {
  public readonly id: GameModeId = 'score-attack';
  public readonly name: string = 'Score Attack';
  public readonly description: string = 'Maximize score through precision combos, near-miss chains, and sector clears.';
  public readonly modifiers: ChallengeModifier[] = [];
  public readonly allowsRevive: boolean = true;

  private durationSeconds: number = 0;
  private currentStats: PlayerStats | null = null;
  private obstaclesPassedCount: number = 0;
  private consecutivePasses: number = 0;
  private maxConsecutivePasses: number = 0;
  private nearMissCount: number = 0;
  private worldsVisited: Set<string> = new Set();
  private revivesUsed: number = 0;
  private currentWorldName: string = 'Sky Isles';

  // Dedicated Score Attack bonus metrics
  private nearMissBonusTotal: number = 0;
  private worldBonusTotal: number = 0;
  private comboChainBonusTotal: number = 0;

  public initialize(initialModifiers?: ChallengeModifier[]): void {
    this.durationSeconds = 0;
    this.currentStats = null;
    this.obstaclesPassedCount = 0;
    this.consecutivePasses = 0;
    this.maxConsecutivePasses = 0;
    this.nearMissCount = 0;
    this.worldsVisited.clear();
    this.worldsVisited.add('sky-isles');
    this.revivesUsed = 0;
    this.currentWorldName = 'Sky Isles';
    this.nearMissBonusTotal = 0;
    this.worldBonusTotal = 0;
    this.comboChainBonusTotal = 0;
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
    this.consecutivePasses++;
    if (this.consecutivePasses > this.maxConsecutivePasses) {
      this.maxConsecutivePasses = this.consecutivePasses;
    }

    // Every 5 consecutive passes award escalating chain bonus
    if (this.consecutivePasses % 5 === 0) {
      const bonus = this.consecutivePasses * 50;
      this.comboChainBonusTotal += bonus;
    }

    if (isNearMiss) {
      this.nearMissCount++;
      // Near miss in Score Attack gives +250 extra flat bonus
      this.nearMissBonusTotal += 250;
    }
  }

  public onWorldChanged(worldId: string, _worldIndex: number): void {
    if (!this.worldsVisited.has(worldId)) {
      this.worldsVisited.add(worldId);
      // Reaching a new world awards a major sector bonus: +1,000 pts
      this.worldBonusTotal += 1000;
    }

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
    this.revivesUsed++;
    this.consecutivePasses = 0; // Reset consecutive chain on stumble/crash
  }

  public computeBreakdown(): GameModeScoreBreakdown {
    const base = this.currentStats ? this.currentStats.score : 0;
    const distanceBonus = this.currentStats ? Math.floor(this.currentStats.distance * 0.8) : 0;
    const shards = this.currentStats ? (this.currentStats.dataShardsCollected || this.currentStats.windOrbsCollected || 0) : 0;
    const collectiblesBonus = shards * 120;
    const nearMissBonus = this.nearMissBonusTotal;
    const consecutivePassBonus = this.comboChainBonusTotal;
    const worldMilestoneBonus = this.worldBonusTotal;
    const perfectBonus = this.revivesUsed === 0 ? 500 : 0;

    const subtotal =
      base +
      distanceBonus +
      collectiblesBonus +
      nearMissBonus +
      consecutivePassBonus +
      worldMilestoneBonus +
      perfectBonus;

    // 15% penalty per revive to maintain competitive fairness
    const penaltyRate = Math.min(0.45, this.revivesUsed * 0.15);
    const penaltyDeduction = Math.floor(subtotal * penaltyRate);
    const totalScore = Math.max(0, subtotal - penaltyDeduction);

    return {
      baseScore: base,
      distanceBonus,
      collectiblesBonus,
      nearMissBonus,
      consecutivePassBonus,
      worldMilestoneBonus,
      perfectSectionBonus: perfectBonus,
      penaltyDeduction,
      totalScore,
    };
  }

  public getScore(): number {
    return this.computeBreakdown().totalScore;
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
    const total = this.getScore();
    const mult = this.currentStats ? this.currentStats.scoreMultiplier : 1;
    const dist = this.currentStats ? this.currentStats.distance : 0;

    return {
      primaryLabel: 'ATTACK SCORE',
      primaryValue: total.toLocaleString(),
      secondaryLabel: 'MULTIPLIER',
      secondaryValue: `${mult}x (Chain: ${this.consecutivePasses})`,
      tertiaryLabel: 'DISTANCE',
      tertiaryValue: `${dist.toLocaleString()}m`,
      statusBadge: this.revivesUsed > 0 ? `REVIVED (${this.revivesUsed})` : 'PERFECT FLIGHT',
    };
  }

  public isObjectiveCompleted(): boolean {
    return false;
  }

  public getSummary(): GameModeSummary {
    const breakdown = this.computeBreakdown();
    const dist = this.currentStats ? this.currentStats.distance : 0;
    const shards = this.currentStats ? (this.currentStats.dataShardsCollected || this.currentStats.windOrbsCollected || 0) : 0;

    return {
      modeId: this.id,
      modeName: this.name,
      score: breakdown.totalScore,
      finalScore: breakdown.totalScore,
      distance: dist,
      durationSeconds: Math.floor(this.durationSeconds),
      shardsCollected: shards,
      nearMisses: this.nearMissCount,
      obstaclesPassed: this.obstaclesPassedCount,
      worldReached: this.currentWorldName,
      isCompleted: false,
      isNewRecord: false,
      breakdown: [
        { label: 'Base Flight Telemetry', value: breakdown.baseScore.toLocaleString(), bonus: breakdown.baseScore },
        { label: 'Distance Progression', value: `${dist.toLocaleString()}m`, bonus: breakdown.distanceBonus },
        { label: 'Data Shards Collected', value: shards, bonus: breakdown.collectiblesBonus },
        { label: `Near-Miss Grazes (${this.nearMissCount})`, value: `+${breakdown.nearMissBonus.toLocaleString()}`, bonus: breakdown.nearMissBonus },
        { label: `Max Combo Chain (${this.maxConsecutivePasses})`, value: `+${breakdown.consecutivePassBonus.toLocaleString()}`, bonus: breakdown.consecutivePassBonus },
        { label: `Worlds Discovered (${this.worldsVisited.size})`, value: `+${breakdown.worldMilestoneBonus.toLocaleString()}`, bonus: breakdown.worldMilestoneBonus },
        { label: 'Flawless Flight Bonus', value: breakdown.perfectSectionBonus > 0 ? '+500' : '0 (Revived)', bonus: breakdown.perfectSectionBonus },
        { label: 'Revive Deduction', value: breakdown.penaltyDeduction > 0 ? `-${breakdown.penaltyDeduction.toLocaleString()}` : '0', bonus: -breakdown.penaltyDeduction },
      ],
      xpAwarded: Math.min(1800, Math.floor(breakdown.totalScore * 0.08)),
    };
  }

  public dispose(): void {
    this.currentStats = null;
    this.worldsVisited.clear();
  }
}
