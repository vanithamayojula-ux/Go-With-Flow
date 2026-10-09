/**
 * GoWithFlow — Central Progression Manager
 * Coordinates XP, Level-ups, Permanent Achievements, Daily Challenges, and Idempotent Rewards.
 */

import {
  ProgressionSaveData,
  loadProgressionState,
  saveProgressionState,
} from './progressionState';
import {
  getXpRequiredForLevel,
  calculateLevelFromXp,
  XP_SOURCES,
} from './progressionConfig';
import {
  Achievement,
  ACHIEVEMENTS,
  ACHIEVEMENT_MAP,
} from './achievements';
import {
  Challenge,
} from './challenges';
import {
  LevelReward,
  LEVEL_REWARDS_BY_LEVEL,
} from './rewards';

export interface ProgressionEvents {
  onXpGained?: (amount: number, reason: string) => void;
  onLevelUp?: (newLevel: number, reward?: LevelReward) => void;
  onAchievementUnlocked?: (achievement: Achievement) => void;
  onChallengeCompleted?: (challenge: Challenge) => void;
  onNotification?: (msg: string) => void;
}

export class ProgressionManager {
  private _state: ProgressionSaveData;
  private _events: ProgressionEvents;
  private _dirty = false;

  // Track session milestones in-run to prevent double-crediting
  private _sessionWorldsVisited = new Set<string>();
  private _sessionXpEarned = 0;

  constructor(events: ProgressionEvents = {}) {
    this._state = loadProgressionState();
    this._events = events;
  }

  public set onLevelUp(cb: ((newLevel: number, reward?: LevelReward) => void) | undefined) {
    this._events.onLevelUp = cb;
  }

  public set onAchievementUnlocked(cb: ((achievement: Achievement) => void) | undefined) {
    this._events.onAchievementUnlocked = cb;
  }

  public getData(): ProgressionSaveData {
    return this._state;
  }

  public getLevel(): number {
    return this._state.level;
  }

  public getActiveChallenges(): Challenge[] {
    return this._state.dailyChallenges;
  }

  public getAllAchievements(): (Achievement & { unlocked: boolean; claimed: boolean })[] {
    return ACHIEVEMENTS.map(a => ({
      ...a,
      unlocked: !!this._state.achievements[a.id],
      claimed: !!this._state.claimedAchievements[a.id],
    }));
  }

  public getAllRewards(): LevelReward[] {
    return Array.from(LEVEL_REWARDS_BY_LEVEL.values());
  }

  public claimChallengeReward(challengeId: string): { success: boolean; xp: number; shards: number } {
    const res = this.claimChallenge(challengeId);
    return res ? { success: true, ...res } : { success: false, xp: 0, shards: 0 };
  }

  public claimAchievementReward(achievementId: string): { success: boolean; xp: number; shards: number } {
    const res = this.claimAchievement(achievementId);
    return res ? { success: true, ...res } : { success: false, xp: 0, shards: 0 };
  }

  public get state(): Readonly<ProgressionSaveData> {
    return this._state;
  }

  public get level(): number {
    return this._state.level;
  }

  public get xp(): number {
    return this._state.xp;
  }

  public get xpRequired(): number {
    return getXpRequiredForLevel(this._state.level);
  }

  public get totalXpEarned(): number {
    return this._state.totalXpEarned;
  }

  public get achievements(): Achievement[] {
    return ACHIEVEMENTS;
  }

  public get dailyChallenges(): Challenge[] {
    return this._state.dailyChallenges;
  }

  public get sessionXpEarned(): number {
    return this._sessionXpEarned;
  }

  /**
   * Reset session-specific counters at the start of a fresh run.
   */
  public startRun(): void {
    this._sessionWorldsVisited.clear();
    this._sessionXpEarned = 0;
    this.recordWorldReached('sky-isles');
  }

  /**
   * Core XP accumulator. Evaluates level-ups and unlocks rewards.
   */
  public addXp(amount: number, reason: string): {
    newLevel: number;
    levelsGained: number;
    rewardsUnlocked: LevelReward[];
  } {
    if (amount <= 0) {
      return { newLevel: this._state.level, levelsGained: 0, rewardsUnlocked: [] };
    }

    this._state.xp += amount;
    this._state.totalXpEarned += amount;
    this._sessionXpEarned += amount;
    this._dirty = true;

    this._events.onXpGained?.(amount, reason);

    const { newLevel, remainingXp, levelsGained } = calculateLevelFromXp(
      this._state.level,
      this._state.xp
    );

    const rewardsUnlocked: LevelReward[] = [];

    if (levelsGained > 0) {
      const oldLevel = this._state.level;
      this._state.level = newLevel;
      this._state.xp = remainingXp;

      for (let lvl = oldLevel + 1; lvl <= newLevel; lvl++) {
        const reward = LEVEL_REWARDS_BY_LEVEL.get(lvl);
        if (reward) {
          rewardsUnlocked.push(reward);
          this._events.onLevelUp?.(lvl, reward);
          this._events.onNotification?.(`🎉 LEVEL UP! Reached Level ${lvl}! Unlocked: ${reward.name}`);
        } else {
          this._events.onLevelUp?.(lvl);
          this._events.onNotification?.(`🎉 LEVEL UP! Reached Level ${lvl}!`);
        }
      }
    }

    this.save();
    return { newLevel, levelsGained, rewardsUnlocked };
  }

  /**
   * Record distance traveled and grant incremental distance XP and challenge updates.
   */
  public recordDistanceMilestone(distanceMeters: number): void {
    // Update daily distance challenges
    for (const ch of this._state.dailyChallenges) {
      if (ch.category === 'distance' && !ch.completed) {
        ch.current = Math.max(ch.current, distanceMeters);
        if (ch.current >= ch.target) {
          this.completeChallenge(ch);
        }
      }
    }
  }

  /**
   * Record data shard collection event.
   */
  public recordShardCollection(count: number = 1): void {
    this.addXp(count * XP_SOURCES.SHARD_COLLECTED, 'Data Shards Collected');

    for (const ch of this._state.dailyChallenges) {
      if (ch.category === 'collection' && !ch.completed) {
        ch.current += count;
        if (ch.current >= ch.target) {
          this.completeChallenge(ch);
        }
      }
    }

    if (count >= 100) {
      this.unlockAchievement('ach_shards_100');
    }
  }

  /**
   * Record near miss execution.
   */
  public recordNearMiss(totalRunNearMisses: number = 1): void {
    this.addXp(XP_SOURCES.NEAR_MISS, 'Near Miss Bonus');

    for (const ch of this._state.dailyChallenges) {
      if (ch.category === 'skill' && !ch.completed && ch.id.includes('nearmiss')) {
        ch.current = Math.max(ch.current, totalRunNearMisses);
        if (ch.current >= ch.target) {
          this.completeChallenge(ch);
        }
      }
    }

    if (totalRunNearMisses >= 10) {
      this.unlockAchievement('ach_near_miss_10');
    }
  }

  /**
   * Record stunt trick landed.
   */
  public recordTrick(totalRunTricks: number = 1): void {
    this.addXp(XP_SOURCES.TRICK_LANDED, 'Stunt Trick Landed');

    for (const ch of this._state.dailyChallenges) {
      if (ch.category === 'skill' && !ch.completed && ch.id.includes('tricks')) {
        ch.current = Math.max(ch.current, totalRunTricks);
        if (ch.current >= ch.target) {
          this.completeChallenge(ch);
        }
      }
    }
  }

  /**
   * Record reaching a world sector during flight.
   */
  public recordWorldReached(worldId: string): void {
    if (!this._sessionWorldsVisited.has(worldId)) {
      this._sessionWorldsVisited.add(worldId);
      const bonus = XP_SOURCES.WORLD_REACHED[worldId] || 50;
      this.addXp(bonus, `Reached ${worldId.toUpperCase()}`);

      // Evaluate exploration achievements
      if (worldId === 'sky-isles') this.unlockAchievement('ach_first_flight');
      if (worldId === 'verdant-wilds') this.unlockAchievement('ach_into_wild');
      if (worldId === 'crimson-dunes') this.unlockAchievement('ach_red_horizon');
      if (worldId === 'crystal-heights') this.unlockAchievement('ach_crystal_voyager');
      if (worldId === 'obsidian-core') this.unlockAchievement('ach_heart_obsidian');

      // Evaluate world challenges
      for (const ch of this._state.dailyChallenges) {
        if (ch.category === 'world' && !ch.completed) {
          if (
            (ch.id.includes('verdant') && worldId === 'verdant-wilds') ||
            (ch.id.includes('crimson') && worldId === 'crimson-dunes') ||
            (ch.id.includes('crystal') && worldId === 'crystal-heights')
          ) {
            ch.current = ch.target;
            this.completeChallenge(ch);
          }
        }
      }
    }
  }

  /**
   * Record successful world transition corridor completion.
   */
  public recordWorldTransition(fromWorld: string, toWorld: string): void {
    this.addXp(XP_SOURCES.WORLD_TRANSITION, `Transitioned: ${fromWorld} -> ${toWorld}`);
    this.recordWorldReached(toWorld);
  }

  /**
   * Complete a challenge and notify.
   */
  private completeChallenge(challenge: Challenge): void {
    if (!challenge.completed) {
      challenge.completed = true;
      this._dirty = true;
      this._events.onChallengeCompleted?.(challenge);
      this._events.onNotification?.(`🏆 CHALLENGE COMPLETE: ${challenge.title}!`);
      this.save();
    }
  }

  /**
   * Unlock an achievement idempotently.
   */
  public unlockAchievement(achievementId: string): boolean {
    if (this._state.achievements[achievementId]) {
      return false; // Already unlocked
    }

    const ach = ACHIEVEMENT_MAP.get(achievementId);
    if (!ach) return false;

    this._state.achievements[achievementId] = true;
    this._dirty = true;

    this._events.onAchievementUnlocked?.(ach);
    this._events.onNotification?.(`🌟 ACHIEVEMENT UNLOCKED: ${ach.title}!`);
    this.save();
    return true;
  }

  /**
   * Claim an unlocked achievement reward idempotently.
   */
  public claimAchievement(achievementId: string): { xp: number; shards: number } | null {
    if (!this._state.achievements[achievementId]) return null;
    if (this._state.claimedAchievements[achievementId]) return null; // Already claimed

    const ach = ACHIEVEMENT_MAP.get(achievementId);
    if (!ach) return null;

    this._state.claimedAchievements[achievementId] = true;
    this.addXp(ach.xpReward, `Achievement Claim: ${ach.title}`);
    this.save();

    return { xp: ach.xpReward, shards: ach.shardReward };
  }

  /**
   * Claim a completed challenge reward idempotently.
   */
  public claimChallenge(challengeId: string): { xp: number; shards: number } | null {
    const ch = this._state.dailyChallenges.find(c => c.id === challengeId);
    if (!ch || !ch.completed || ch.claimed) return null;

    ch.claimed = true;
    this.addXp(ch.xpReward, `Challenge Claim: ${ch.title}`);
    this.save();

    return { xp: ch.xpReward, shards: ch.shardReward };
  }

  /**
   * Claim a level milestone cosmetic reward idempotently.
   */
  public claimLevelReward(level: number): LevelReward | null {
    if (this._state.level < level) return null;
    const reward = LEVEL_REWARDS_BY_LEVEL.get(level);
    if (!reward) return null;

    if (this._state.unlockedRewards.includes(reward.id)) {
      return null; // Already claimed
    }

    this._state.unlockedRewards.push(reward.id);
    this._dirty = true;
    this.save();
    return reward;
  }

  /**
   * Calculate final run summary XP and update score/distance achievements.
   */
  public finalizeRun(stats: {
    distance: number;
    score: number;
    shards: number;
    nearMisses: number;
    stumbles: number;
  }): { runXp: number; level: number; levelsGained: number } {
    // 1. Distance XP: 1 XP per 10m
    const distanceXp = Math.floor(stats.distance / XP_SOURCES.METERS_PER_XP);
    if (distanceXp > 0) {
      this.addXp(distanceXp, 'Run Distance Telemetry');
    }

    // 2. Score milestone achievements
    if (stats.score >= 50000) {
      this.unlockAchievement('ach_score_50k');
    }

    // 3. Untouchable check: 2000m with 0 stumbles
    if (stats.distance >= 2000 && stats.stumbles === 0) {
      this.unlockAchievement('ach_untouchable_2k');
    }

    this.save();

    return {
      runXp: this._sessionXpEarned,
      level: this._state.level,
      levelsGained: 0,
    };
  }

  /**
   * Persist progression state to localStorage.
   */
  public save(): void {
    if (this._dirty) {
      saveProgressionState(this._state);
      this._dirty = false;
    }
  }

  public dispose(): void {
    this.save();
  }
}
