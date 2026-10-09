/**
 * GoWithFlow — Challenge Run Game Mode
 * Phase 15 Section 6-9: Runs tailored challenge definitions (No-Revive, Collector, Perfect Run, Speed Demon, Near Miss Master, Daily, Weekly)
 */

import { PlayerStats } from '../../types';
import {
  GameMode,
  GameModeId,
  GameModeSummary,
  ChallengeModifier,
  ChallengeDefinition,
} from './gameModeTypes';
import { CURATED_CHALLENGES } from './gameModeConfig';

export class ChallengeRunMode implements GameMode {
  public readonly id: GameModeId = 'challenge-run';
  public name: string = 'Curated Challenge';
  public description: string = 'Operational trial under special modifiers.';
  public modifiers: ChallengeModifier[] = [];
  public allowsRevive: boolean = false;

  private challengeDef: ChallengeDefinition;
  private durationSeconds: number = 0;
  private currentStats: PlayerStats | null = null;
  private obstaclesPassedCount: number = 0;
  private nearMissCount: number = 0;
  private shardsCollectedCount: number = 0;
  private revivesUsed: number = 0;
  private stumblesOccurred: number = 0;
  private speedHoldTimer: number = 0;
  private currentWorldName: string = 'Sky Isles';
  private targetWorldReached: boolean = false;
  private isCompleted: boolean = false;

  constructor(challengeDef?: ChallengeDefinition) {
    this.challengeDef = challengeDef || CURATED_CHALLENGES[0];
    this.name = this.challengeDef.title;
    this.description = this.challengeDef.description;
    this.modifiers = this.challengeDef.modifiers;
    this.allowsRevive = !this.modifiers.some(m => m.disableRevive);
  }

  public setChallenge(def: ChallengeDefinition): void {
    this.challengeDef = def;
    this.name = def.title;
    this.description = def.description;
    this.modifiers = def.modifiers;
    this.allowsRevive = !def.modifiers.some(m => m.disableRevive);
    this.initialize();
  }

  public getChallengeDef(): ChallengeDefinition {
    return this.challengeDef;
  }

  public initialize(initialModifiers?: ChallengeModifier[]): void {
    if (initialModifiers && initialModifiers.length > 0) {
      this.modifiers = initialModifiers;
      this.allowsRevive = !initialModifiers.some(m => m.disableRevive);
    }
    this.durationSeconds = 0;
    this.currentStats = null;
    this.obstaclesPassedCount = 0;
    this.nearMissCount = 0;
    this.shardsCollectedCount = 0;
    this.revivesUsed = 0;
    this.stumblesOccurred = 0;
    this.speedHoldTimer = 0;
    this.currentWorldName = 'Sky Isles';
    this.targetWorldReached = false;
    this.isCompleted = false;
  }

  public update(delta: number, currentStats: PlayerStats): void {
    this.durationSeconds += delta;
    this.currentStats = currentStats;

    // Track speed hold for speed-demon challenge
    if (currentStats.speed >= 45) {
      this.speedHoldTimer += delta;
    }

    if (currentStats.stumbles && currentStats.stumbles > this.stumblesOccurred) {
      this.stumblesOccurred = currentStats.stumbles;
    }

    this.checkCompletion();
  }

  public onCollect(count: number, currentStats: PlayerStats): void {
    this.shardsCollectedCount += count;
    this.currentStats = currentStats;
    this.checkCompletion();
  }

  public onObstaclePassed(_obstacleType: string, isNearMiss: boolean): void {
    this.obstaclesPassedCount++;
    if (isNearMiss) {
      this.nearMissCount++;
      this.checkCompletion();
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

    if (this.challengeDef.worldId === worldId) {
      this.targetWorldReached = true;
      this.checkCompletion();
    }
  }

  public onGameOver(finalStats: PlayerStats): void {
    this.currentStats = finalStats;
    this.checkCompletion();
  }

  public onRevive(): void {
    this.revivesUsed++;
  }

  private checkCompletion(): void {
    if (this.isCompleted) return;

    const dist = this.currentStats ? this.currentStats.distance : 0;
    const type = this.challengeDef.type;

    switch (type) {
      case 'no-revive':
        if (this.revivesUsed === 0 && dist >= this.challengeDef.target) {
          this.isCompleted = true;
        }
        break;

      case 'collector':
        if (this.shardsCollectedCount >= this.challengeDef.target) {
          this.isCompleted = true;
        }
        break;

      case 'perfect-run':
        if (this.stumblesOccurred === 0 && this.revivesUsed === 0 && dist >= this.challengeDef.target) {
          this.isCompleted = true;
        }
        break;

      case 'world-explorer':
        if (this.targetWorldReached || (this.challengeDef.target && dist >= this.challengeDef.target)) {
          this.isCompleted = true;
        }
        break;

      case 'near-miss-master':
        if (this.nearMissCount >= this.challengeDef.target) {
          this.isCompleted = true;
        }
        break;

      case 'speed-demon':
        if (this.speedHoldTimer >= this.challengeDef.target) {
          this.isCompleted = true;
        }
        break;

      default:
        if (dist >= this.challengeDef.target) {
          this.isCompleted = true;
        }
        break;
    }
  }

  public getScore(): number {
    return this.currentStats ? this.currentStats.score : 0;
  }

  public isObjectiveCompleted(): boolean {
    return this.isCompleted;
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
    let currentVal = 0;
    const targetVal = this.challengeDef.target;
    let unit = '';

    switch (this.challengeDef.type) {
      case 'no-revive':
      case 'perfect-run':
        currentVal = this.currentStats ? this.currentStats.distance : 0;
        unit = 'm';
        break;
      case 'collector':
        currentVal = this.shardsCollectedCount;
        unit = ' shards';
        break;
      case 'near-miss-master':
        currentVal = this.nearMissCount;
        unit = ' misses';
        break;
      case 'speed-demon':
        currentVal = Math.floor(this.speedHoldTimer);
        unit = 's';
        break;
      case 'world-explorer':
        currentVal = this.currentStats ? this.currentStats.distance : 0;
        unit = 'm';
        break;
      default:
        currentVal = this.currentStats ? this.currentStats.distance : 0;
        unit = 'm';
    }

    return {
      primaryLabel: 'TRIAL PROGRESS',
      primaryValue: `${currentVal.toLocaleString()}/${targetVal.toLocaleString()}${unit}`,
      secondaryLabel: 'STATUS',
      secondaryValue: this.isCompleted ? 'OBJECTIVE MET' : 'IN PROGRESS',
      tertiaryLabel: 'TRIAL',
      tertiaryValue: this.challengeDef.title,
      statusBadge: this.isCompleted ? 'CLEAR!' : (this.revivesUsed > 0 && !this.allowsRevive ? 'DISQUALIFIED' : 'ACTIVE'),
    };
  }

  public getSummary(): GameModeSummary {
    const score = this.getScore();
    const dist = this.currentStats ? this.currentStats.distance : 0;
    const shards = this.shardsCollectedCount;

    return {
      modeId: this.id,
      modeName: this.challengeDef.title,
      score,
      finalScore: score,
      distance: dist,
      durationSeconds: Math.floor(this.durationSeconds),
      shardsCollected: shards,
      nearMisses: this.nearMissCount,
      obstaclesPassed: this.obstaclesPassedCount,
      worldReached: this.currentWorldName,
      isCompleted: this.isCompleted,
      isNewRecord: false,
      breakdown: [
        { label: 'Operational Goal', value: this.challengeDef.targetLabel },
        { label: 'Trial Outcome', value: this.isCompleted ? 'OBJECTIVE SUCCESS' : 'FAILED / INCOMPLETE' },
        { label: 'Flight Distance', value: `${dist.toLocaleString()}m` },
        { label: 'Base Reward', value: `+${this.challengeDef.rewardXp} XP` },
      ],
      xpAwarded: this.isCompleted ? this.challengeDef.rewardXp : Math.floor(dist * 0.05),
      claimedReward: this.isCompleted
        ? {
            xp: this.challengeDef.rewardXp,
            cosmeticId: this.challengeDef.rewardCosmeticId,
          }
        : undefined,
    };
  }

  public dispose(): void {
    this.currentStats = null;
  }
}
