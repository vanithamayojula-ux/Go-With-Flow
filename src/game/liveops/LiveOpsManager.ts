/**
 * GoWithFlow — Live Operations Client Coordinator
 * Phase 18: Non-blocking cache loading, background sync, offline resilience,
 * challenge progress dispatch, and reward integrity integration.
 */

import {
  LiveOpsSnapshot,
  RotatingChallenge,
  Season,
  LiveEvent,
  EventModifier,
  Announcement,
  SeasonPassTier,
  SeasonalStatistics,
  LIVEOPS_STORAGE_KEY_CACHE,
  LIVEOPS_STORAGE_KEY_PROGRESS,
} from './liveOpsConfig';
import { LiveOpsServer } from './liveOpsServer';
import { AnnouncementService } from './announcementConfig';
import {
  evaluateChallengeProgress,
  getDeterministicDailyChallenge,
  getDeterministicWeeklyChallenge,
} from './challengeRotation';
import {
  getActiveModifiers,
  calculateEffectiveXpMultiplier,
  calculateEffectiveScoreMultiplier,
} from './eventConfig';
import { evaluateSeasonPassTiers } from './rewardRotation';
import { StorageSanitizer } from '../security/storageSanitizer';
import { SecurityManager } from '../security';
import { GameModeSummary } from '../modes/gameModeTypes';
import { ProgressionManager } from '../progression';

interface LiveOpsPlayerProgress {
  seasonalXp: number;
  challengesCompletedCount: number;
  claimedChallengeIds: string[];
  claimedSeasonPassTiers: number[];
  highestScore: number;
  longestDistance: number;
  worldsVisited: string[];
  dailyChallengeState?: RotatingChallenge;
  weeklyChallengeState?: RotatingChallenge;
}

export class LiveOpsManager {
  private _server: LiveOpsServer;
  private _snapshot: LiveOpsSnapshot;
  private _announcementService: AnnouncementService;
  private _progress: LiveOpsPlayerProgress;
  private _isOnline: boolean = true;
  private _securityManager?: SecurityManager;

  // Active run snapshot to protect mid-run modifier consistency
  private _activeRunModifiers: EventModifier[] | null = null;

  constructor(securityManager?: SecurityManager) {
    this._securityManager = securityManager;
    this._server = new LiveOpsServer();
    this._announcementService = new AnnouncementService();

    // 1. Load player progress
    this._progress = this.loadPlayerProgress();

    // 2. Load cached snapshot immediately (Never blocks gameplay startup!)
    this._snapshot = this.loadCachedSnapshot();

    // 3. Initiate non-blocking background synchronization
    this.syncWithServerInBackground();
  }

  private loadCachedSnapshot(): LiveOpsSnapshot {
    const cached = StorageSanitizer.safeGetItem<LiveOpsSnapshot | null>(
      LIVEOPS_STORAGE_KEY_CACHE,
      null
    );

    if (cached) {
      const validation = this._server.validateSnapshot(cached);
      if (validation.isValid) {
        return cached;
      }
      console.warn('[LiveOpsManager] Corrupted cached snapshot, generating fallback:', validation.errors);
    }

    // Generate immediate clean fallback snapshot from server
    const fallback = this._server.generateSnapshot();
    this.saveCachedSnapshot(fallback);
    return fallback;
  }

  private saveCachedSnapshot(snapshot: LiveOpsSnapshot): void {
    StorageSanitizer.safeSetItem(LIVEOPS_STORAGE_KEY_CACHE, snapshot);
    this._snapshot = snapshot;
  }

  private loadPlayerProgress(): LiveOpsPlayerProgress {
    const cached = StorageSanitizer.safeGetItem<Partial<LiveOpsPlayerProgress> | null>(
      LIVEOPS_STORAGE_KEY_PROGRESS,
      null
    );

    return {
      seasonalXp: cached?.seasonalXp || 0,
      challengesCompletedCount: cached?.challengesCompletedCount || 0,
      claimedChallengeIds: cached?.claimedChallengeIds || [],
      claimedSeasonPassTiers: cached?.claimedSeasonPassTiers || [],
      highestScore: cached?.highestScore || 0,
      longestDistance: cached?.longestDistance || 0,
      worldsVisited: cached?.worldsVisited || [],
      dailyChallengeState: cached?.dailyChallengeState,
      weeklyChallengeState: cached?.weeklyChallengeState,
    };
  }

  private savePlayerProgress(): void {
    StorageSanitizer.safeSetItem(LIVEOPS_STORAGE_KEY_PROGRESS, this._progress);
  }

  /**
   * Non-blocking background sync with server
   */
  public async syncWithServerInBackground(): Promise<boolean> {
    try {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        this._isOnline = false;
        return false;
      }

      // Fetch fresh authoritative snapshot
      const fresh = this._server.generateSnapshot();
      const validation = this._server.validateSnapshot(fresh);

      if (validation.isValid) {
        this._isOnline = true;
        this.saveCachedSnapshot(fresh);
        this.refreshChallengeInstances();
        return true;
      } else {
        console.warn('[LiveOpsManager] Fresh snapshot failed validation, preserving cache:', validation.errors);
        return false;
      }
    } catch (err) {
      this._isOnline = false;
      console.warn('[LiveOpsManager] Background sync failed, continuing offline:', err);
      return false;
    }
  }

  /**
   * Reconciles current active daily & weekly challenges with persisted progress
   */
  private refreshChallengeInstances(): void {
    const now = this._snapshot.serverTimestamp || Date.now();

    // Daily
    const authoritativeDaily = getDeterministicDailyChallenge(now);
    if (!this._progress.dailyChallengeState || this._progress.dailyChallengeState.id !== authoritativeDaily.id) {
      this._progress.dailyChallengeState = authoritativeDaily;
    }

    // Weekly
    const authoritativeWeekly = getDeterministicWeeklyChallenge(now);
    if (!this._progress.weeklyChallengeState || this._progress.weeklyChallengeState.id !== authoritativeWeekly.id) {
      this._progress.weeklyChallengeState = authoritativeWeekly;
    }

    this.savePlayerProgress();
  }

  // --- RUN LIFECYCLE & MODIFIERS (Sections 8, 9, 18) ---

  /**
   * Call when player starts a run: captures active event modifiers to guarantee mid-run stability
   */
  public onRunStart(): EventModifier[] {
    const now = Date.now();
    this._activeRunModifiers = getActiveModifiers(this._snapshot.activeEvents, now);
    return [...this._activeRunModifiers];
  }

  /**
   * Returns modifiers locked at the start of current flight
   */
  public getActiveRunModifiers(): EventModifier[] {
    return this._activeRunModifiers || getActiveModifiers(this._snapshot.activeEvents, Date.now());
  }

  /**
   * Calculates dynamic XP multiplier for rewards
   */
  public getEffectiveXpMultiplier(): number {
    return calculateEffectiveXpMultiplier(this.getActiveRunModifiers());
  }

  /**
   * Calculates score multiplier for world
   */
  public getEffectiveScoreMultiplier(worldId?: string): number {
    return calculateEffectiveScoreMultiplier(this.getActiveRunModifiers(), worldId);
  }

  /**
   * Call on run completion: updates challenges and stats
   */
  public onRunComplete(
    summary: GameModeSummary,
    progressionMgr?: ProgressionManager
  ): {
    completedDaily: boolean;
    completedWeekly: boolean;
    seasonalXpGained: number;
  } {
    // 1. Release active run modifier lock
    this._activeRunModifiers = null;

    // 2. Update seasonal statistics
    if (summary.finalScore > this._progress.highestScore) {
      this._progress.highestScore = summary.finalScore;
    }
    if (summary.distance > this._progress.longestDistance) {
      this._progress.longestDistance = summary.distance;
    }
    if (!this._progress.worldsVisited.includes(summary.worldReached)) {
      this._progress.worldsVisited.push(summary.worldReached);
    }

    // 3. Evaluate Daily Challenge
    let completedDaily = false;
    if (this._progress.dailyChallengeState && !this._progress.dailyChallengeState.completed) {
      const res = evaluateChallengeProgress(this._progress.dailyChallengeState, summary);
      this._progress.dailyChallengeState = res.updatedChallenge;
      if (res.newlyCompleted) {
        completedDaily = true;
        this._progress.challengesCompletedCount++;
      }
    }

    // 4. Evaluate Weekly Challenge
    let completedWeekly = false;
    if (this._progress.weeklyChallengeState && !this._progress.weeklyChallengeState.completed) {
      const res = evaluateChallengeProgress(this._progress.weeklyChallengeState, summary);
      this._progress.weeklyChallengeState = res.updatedChallenge;
      if (res.newlyCompleted) {
        completedWeekly = true;
        this._progress.challengesCompletedCount++;
      }
    }

    // 5. Calculate Seasonal XP gained
    const xpMultiplier = this.getEffectiveXpMultiplier();
    const baseRunXp = summary.xpAwarded || Math.floor(summary.distance / 10);
    const bonusSeasonalXp = Math.floor(baseRunXp * xpMultiplier);
    this._progress.seasonalXp += bonusSeasonalXp;

    this.savePlayerProgress();

    return {
      completedDaily,
      completedWeekly,
      seasonalXpGained: bonusSeasonalXp,
    };
  }

  // --- CHALLENGE CLAIMS WITH FRAUD PROTECTION (Phase 17/18) ---

  public claimChallengeReward(
    challengeId: string,
    playerId: string,
    progressionMgr?: ProgressionManager
  ): { success: boolean; error?: string; xpAwarded: number; shardsAwarded: number } {
    let challenge: RotatingChallenge | undefined;
    if (this._progress.dailyChallengeState?.id === challengeId) {
      challenge = this._progress.dailyChallengeState;
    } else if (this._progress.weeklyChallengeState?.id === challengeId) {
      challenge = this._progress.weeklyChallengeState;
    }

    if (!challenge) {
      return { success: false, error: 'Challenge not found', xpAwarded: 0, shardsAwarded: 0 };
    }
    if (!challenge.completed) {
      return { success: false, error: 'Challenge is not yet completed', xpAwarded: 0, shardsAwarded: 0 };
    }
    if (challenge.claimed || this._progress.claimedChallengeIds.includes(challengeId)) {
      return { success: false, error: 'Reward already claimed', xpAwarded: 0, shardsAwarded: 0 };
    }

    // Authoritative idempotency check via SecurityManager if available
    if (this._securityManager) {
      const grantRes = this._securityManager.rewardService.claimReward(
        playerId,
        'challenge_victory',
        challengeId,
        { xp: challenge.rewardXp }
      );
      if (grantRes.alreadyClaimed) {
        return { success: false, error: 'Reward has already been granted to this account', xpAwarded: 0, shardsAwarded: 0 };
      }
    }

    challenge.claimed = true;
    this._progress.claimedChallengeIds.push(challengeId);

    // Apply progression reward
    if (progressionMgr) {
      progressionMgr.addXp(challenge.rewardXp, `LiveOps Challenge: ${challenge.title}`);
    }
    if (this._securityManager) {
      this._securityManager.currencyService.credit(playerId, challenge.rewardShards, 'reward_grant', challengeId);
    }

    this.savePlayerProgress();
    return {
      success: true,
      xpAwarded: challenge.rewardXp,
      shardsAwarded: challenge.rewardShards,
    };
  }

  // --- SEASON PASS PROGRESSION & CLAIMS (Section 13) ---

  public getSeasonPassTiers(): SeasonPassTier[] {
    const claimedSet = new Set(this._progress.claimedSeasonPassTiers);
    return evaluateSeasonPassTiers(
      this._snapshot.seasonPassTiers,
      this._progress.seasonalXp,
      claimedSet
    );
  }

  public claimSeasonPassTier(
    tierNumber: number,
    playerId: string,
    progressionMgr?: ProgressionManager
  ): { success: boolean; tier?: SeasonPassTier; error?: string } {
    const tiers = this.getSeasonPassTiers();
    const tier = tiers.find(t => t.tier === tierNumber);

    if (!tier) {
      return { success: false, error: 'Tier not found' };
    }
    if (!tier.isUnlocked) {
      return { success: false, error: 'Tier is not unlocked yet' };
    }
    if (tier.isClaimed || this._progress.claimedSeasonPassTiers.includes(tierNumber)) {
      return { success: false, error: 'Tier reward already claimed' };
    }

    // Server-authoritative idempotency check via SecurityManager
    if (this._securityManager) {
      const grantRes = this._securityManager.rewardService.claimReward(
        playerId,
        'seasonal_tier',
        `tier_${tierNumber}`,
        {
          xp: typeof tier.rewardValue === 'number' && tier.rewardType === 'xp' ? tier.rewardValue : undefined,
          cosmeticId: typeof tier.rewardValue === 'string' && tier.rewardType === 'cosmetic' ? tier.rewardValue : undefined,
          badge: typeof tier.rewardValue === 'string' && tier.rewardType === 'badge' ? tier.rewardValue : undefined,
        }
      );
      if (grantRes.alreadyClaimed) {
        return { success: false, error: 'Tier reward already claimed authoritatively' };
      }
    }

    this._progress.claimedSeasonPassTiers.push(tierNumber);

    // Credit reward to player
    if (progressionMgr) {
      if (tier.rewardType === 'xp' && typeof tier.rewardValue === 'number') {
        progressionMgr.addXp(tier.rewardValue, `Season Pass Tier ${tierNumber}`);
      }
    }
    if (this._securityManager && tier.rewardType === 'shards' && typeof tier.rewardValue === 'number') {
      this._securityManager.currencyService.credit(playerId, tier.rewardValue, 'reward_grant', `season_pass_tier_${tierNumber}`);
    }

    this.savePlayerProgress();
    return { success: true, tier: { ...tier, isClaimed: true } };
  }

  // --- GETTERS & METADATA ---

  public getActiveSeason(): Readonly<Season> {
    return this._snapshot.activeSeason;
  }

  public getActiveEvents(): Readonly<LiveEvent[]> {
    const now = Date.now();
    return this._snapshot.activeEvents.filter(e => e.isActive && now >= e.startsAt && now <= e.endsAt);
  }

  public getDailyChallenge(): RotatingChallenge {
    if (!this._progress.dailyChallengeState) {
      this.refreshChallengeInstances();
    }
    return this._progress.dailyChallengeState!;
  }

  public getWeeklyChallenge(): RotatingChallenge {
    if (!this._progress.weeklyChallengeState) {
      this.refreshChallengeInstances();
    }
    return this._progress.weeklyChallengeState!;
  }

  public getAnnouncements(): Announcement[] {
    return this._announcementService.getActiveAnnouncements(
      this._snapshot.announcements,
      Date.now()
    );
  }

  public dismissAnnouncement(id: string): void {
    this._announcementService.dismissAnnouncement(id);
  }

  public getSeasonalStatistics(): SeasonalStatistics {
    return {
      seasonId: this._snapshot.activeSeason.id,
      highestScore: this._progress.highestScore,
      longestDistance: this._progress.longestDistance,
      challengesCompleted: this._progress.challengesCompletedCount,
      totalChallengesAvailable: 20,
      worldsVisitedCount: this._progress.worldsVisited.length,
      seasonRank: 142, // Simulated active rank
      totalSeasonParticipants: 4250,
      seasonalXpEarned: this._progress.seasonalXp,
    };
  }

  public isOnline(): boolean {
    return this._isOnline;
  }

  public getSnapshot(): Readonly<LiveOpsSnapshot> {
    return this._snapshot;
  }

  public getServer(): LiveOpsServer {
    return this._server;
  }
}
