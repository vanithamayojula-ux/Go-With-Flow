/**
 * GoWithFlow — Game Mode System Types & Interfaces
 * Phase 15: Replay Modes, Score Attack, Time Trial, Survival, and Custom Challenges
 */

import { PlayerStats } from '../../types';

export type GameModeId =
  | 'standard-run'
  | 'score-attack'
  | 'time-trial'
  | 'survival'
  | 'challenge-run';

export type ChallengeType =
  | 'no-revive'
  | 'collector'
  | 'perfect-run'
  | 'world-explorer'
  | 'speed-demon'
  | 'near-miss-master'
  | 'daily-challenge'
  | 'weekly-challenge';

export interface ChallengeModifier {
  id: string;
  name: string;
  description: string;
  speedMultiplier?: number;
  obstacleDensityMultiplier?: number;
  collectibleMultiplier?: number;
  disableRevive?: boolean;
  disableCertainPowerups?: boolean;
  targetDistance?: number;
  targetScore?: number;
  targetCollectibles?: number;
  targetNearMisses?: number;
  targetWorldId?: string;
  timeLimitSeconds?: number;
  xpRewardBonus?: number;
  exclusiveCosmeticId?: string;
}

export interface GameModeRule {
  label: string;
  allowed: boolean;
  description: string;
}

export interface GameModeDefinition {
  id: GameModeId;
  name: string;
  tagline: string;
  icon: string;
  description: string;
  rules: GameModeRule[];
  defaultModifiers?: ChallengeModifier[];
  hasLeaderboard: boolean;
  allowsRevive: boolean;
  targetLabel?: string;
}

export interface GameModeSummary {
  modeId: GameModeId;
  modeName: string;
  score: number;
  finalScore: number;
  distance: number;
  durationSeconds: number;
  shardsCollected: number;
  nearMisses: number;
  obstaclesPassed: number;
  worldReached: string;
  isCompleted: boolean;
  isNewRecord: boolean;
  breakdown: { label: string; value: number | string; bonus?: number }[];
  xpAwarded: number;
  claimedReward?: {
    xp: number;
    cosmeticId?: string;
    badgeId?: string;
  };
}

export interface GameModeScoreBreakdown {
  baseScore: number;
  distanceBonus: number;
  collectiblesBonus: number;
  nearMissBonus: number;
  consecutivePassBonus: number;
  worldMilestoneBonus: number;
  perfectSectionBonus: number;
  penaltyDeduction: number;
  totalScore: number;
}

export interface GameModePersonalRecord {
  highestScore: number;
  longestDistance: number;
  bestTimeSeconds: number; // For time-trial, lower is better (0 means not set)
  longestSurvivalTime: number; // For survival
  mostNearMisses: number;
  completedCount: number;
  lastPlayedTimestamp: number;
}

export interface ChallengeDefinition {
  id: string;
  title: string;
  type: ChallengeType;
  description: string;
  icon: string;
  target: number;
  targetLabel: string;
  worldId?: string;
  modifiers: ChallengeModifier[];
  rewardXp: number;
  rewardCosmeticId?: string;
  isDaily?: boolean;
  isWeekly?: boolean;
  dateKey?: string; // e.g. "YYYY-MM-DD" or "YYYY-Www"
}

export interface GameModeSaveData {
  version: number;
  selectedMode: GameModeId;
  selectedChallengeId?: string;
  records: Record<string, GameModePersonalRecord>; // key: modeId or challengeId
  completedChallenges: Record<string, boolean>; // challengeId -> completed
  claimedDailyChallenges: Record<string, boolean>; // dateKey -> claimed
  claimedWeeklyChallenges: Record<string, boolean>; // weekKey -> claimed
  totalRunsByMode: Record<GameModeId, number>;
  lastUpdated: number;
}

/**
 * Common GameMode lifecycle contract.
 * Reuses player movement, obstacles, collectibles, worlds, progression, and cosmetics.
 */
export interface GameMode {
  readonly id: GameModeId;
  readonly name: string;
  readonly description: string;
  readonly modifiers: ChallengeModifier[];
  readonly allowsRevive: boolean;

  /** Initialize or reset mode state for a new run */
  initialize(initialModifiers?: ChallengeModifier[]): void;

  /** Frame update called during active gameplay */
  update(delta: number, currentStats: PlayerStats): void;

  /** Hooked when player collects shards/orbs */
  onCollect(count: number, currentStats: PlayerStats): void;

  /** Hooked when an obstacle is cleared or dodged */
  onObstaclePassed(obstacleType: string, isNearMiss: boolean): void;

  /** Hooked when player enters a new world */
  onWorldChanged(worldId: string, worldIndex: number): void;

  /** Hooked on crash or run termination */
  onGameOver(finalStats: PlayerStats): void;

  /** Hooked when player revives */
  onRevive(): void;

  /** Compute current or final mode score */
  getScore(): number;

  /** Get mode-specific HUD display values */
  getHudMetrics(): {
    primaryLabel: string;
    primaryValue: string;
    secondaryLabel: string;
    secondaryValue: string;
    tertiaryLabel?: string;
    tertiaryValue?: string;
    statusBadge?: string;
  };

  /** Check if mode objective has been accomplished */
  isObjectiveCompleted(): boolean;

  /** Generate comprehensive end-of-run summary */
  getSummary(): GameModeSummary;

  /** Clean up resources */
  dispose(): void;
}
