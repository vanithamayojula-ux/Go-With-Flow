/**
 * GoWithFlow — Authoritative Live Operations Server Engine
 * Phase 18 Section 2, 14-15, 28-29: Authoritative snapshots, versioning, season transitions,
 * configuration validation, and emergency controls.
 */

import {
  LiveOpsSnapshot,
  Season,
  LiveEvent,
  LIVEOPS_SCHEMA_VERSION,
} from './liveOpsConfig';
import {
  CURATED_SEASONS,
  getActiveSeasonForTime,
  evaluateSeasonStatus,
  SEASON_DURATION_MS,
} from './seasonConfig';
import {
  CURATED_EVENTS,
  isEventActive,
} from './eventConfig';
import {
  getDeterministicDailyChallenge,
  getDeterministicWeeklyChallenge,
} from './challengeRotation';
import { CURATED_ANNOUNCEMENTS } from './announcementConfig';
import { CURATED_SEASON_PASS_TIERS } from './rewardRotation';

export class LiveOpsServer {
  private _version: number = 100;
  private _seasons: Season[] = [...CURATED_SEASONS];
  private _events: LiveEvent[] = [...CURATED_EVENTS];
  private _emergencyOverrides: {
    disabledEventIds: Set<string>;
    disabledChallengeIds: Set<string>;
    leaderboardsPaused: boolean;
    pauseReason?: string;
  } = {
    disabledEventIds: new Set(),
    disabledChallengeIds: new Set(),
    leaderboardsPaused: false,
  };

  /**
   * Generates a fully validated, versioned LiveOpsSnapshot
   */
  public generateSnapshot(authoritativeServerTime: number = Date.now()): LiveOpsSnapshot {
    // 1. Resolve Active Season
    const activeSeason = this.resolveActiveSeason(authoritativeServerTime);

    // 2. Resolve Upcoming Season (if any)
    const upcomingSeason = this._seasons.find(
      s => s.number === activeSeason.number + 1
    );

    // 3. Resolve Active Events (filtering out disabled overrides)
    const activeEvents = this._events
      .filter(e => !this._emergencyOverrides.disabledEventIds.has(e.id))
      .filter(e => isEventActive(e, authoritativeServerTime));

    // 4. Resolve Deterministic Daily & Weekly Challenges
    const dailyChallenge = getDeterministicDailyChallenge(authoritativeServerTime);
    const weeklyChallenge = getDeterministicWeeklyChallenge(authoritativeServerTime);

    // 5. Construct Snapshot
    const snapshot: LiveOpsSnapshot = {
      version: this._version,
      publishedAt: authoritativeServerTime,
      effectiveAt: authoritativeServerTime,
      expiresAt: authoritativeServerTime + 60 * 60 * 1000, // 1 hour TTL
      serverTimestamp: authoritativeServerTime,
      activeSeason,
      upcomingSeason,
      activeEvents,
      dailyChallenge,
      weeklyChallenge,
      seasonPassTiers: [...CURATED_SEASON_PASS_TIERS],
      announcements: [...CURATED_ANNOUNCEMENTS],
    };

    return snapshot;
  }

  /**
   * Validates snapshot data integrity before distribution
   */
  public validateSnapshot(snapshot: unknown): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!snapshot || typeof snapshot !== 'object') {
      return { isValid: false, errors: ['Snapshot must be a valid non-null object'] };
    }

    const s = snapshot as Partial<LiveOpsSnapshot>;
    if (typeof s.version !== 'number' || s.version <= 0) {
      errors.push('Invalid snapshot version');
    }
    if (!s.activeSeason || !s.activeSeason.id || !s.activeSeason.name) {
      errors.push('Missing or corrupted active season specification');
    }
    if (!Array.isArray(s.activeEvents)) {
      errors.push('activeEvents must be an array');
    }
    if (!s.dailyChallenge || !s.dailyChallenge.id) {
      errors.push('Missing or invalid daily challenge');
    }
    if (!s.weeklyChallenge || !s.weeklyChallenge.id) {
      errors.push('Missing or invalid weekly challenge');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  private resolveActiveSeason(serverTime: number): Season {
    for (const season of this._seasons) {
      const status = evaluateSeasonStatus(season, serverTime);
      if (status === 'active' || status === 'ending') {
        return { ...season, status };
      }
    }
    // Fallback to Season 1
    return { ...this._seasons[0], status: 'active' };
  }

  /**
   * Season Rollover / Transition Lifecycle (Phase 18 Section 3 & 24)
   * Archives current season and activates the next season.
   */
  public advanceToNextSeason(serverTime: number = Date.now()): {
    archivedSeason: Season;
    newSeason: Season;
  } {
    const activeRef = this.resolveActiveSeason(serverTime);
    // Mark archived in local _seasons array (not the shared CURATED_SEASONS reference)
    const activeInArray = this._seasons.find(s => s.id === activeRef.id);
    if (activeInArray) {
      activeInArray.status = 'archived';
    }
    const archivedSeason: Season = { ...activeRef, status: 'archived' };

    const nextSeasonRef = this._seasons.find(s => s.number === activeRef.number + 1);
    const targetSeason: Season = nextSeasonRef
      ? { ...nextSeasonRef, status: 'active', startsAt: serverTime, endsAt: serverTime + SEASON_DURATION_MS }
      : {
          ...activeRef,
          id: `season_${String(activeRef.number + 1).padStart(2, '0')}_infinite`,
          number: activeRef.number + 1,
          name: `Season ${activeRef.number + 1} — Infinite Horizon`,
          startsAt: serverTime,
          endsAt: serverTime + SEASON_DURATION_MS,
          status: 'active' as const,
        };

    this._version++;
    return {
      archivedSeason,
      newSeason: targetSeason,
    };
  }

  // --- EMERGENCY ADMINISTRATIVE CONTROLS (Phase 18 Section 29) ---

  public emergencyDisableEvent(eventId: string, reason: string): boolean {
    this._emergencyOverrides.disabledEventIds.add(eventId);
    this._version++;
    console.warn(`[LIVEOPS EMERGENCY] Disabled event "${eventId}". Reason: ${reason}`);
    return true;
  }

  public emergencyEnableEvent(eventId: string): boolean {
    this._emergencyOverrides.disabledEventIds.delete(eventId);
    this._version++;
    return true;
  }

  public emergencyDisableChallenge(challengeId: string, reason: string): boolean {
    this._emergencyOverrides.disabledChallengeIds.add(challengeId);
    this._version++;
    console.warn(`[LIVEOPS EMERGENCY] Disabled challenge "${challengeId}". Reason: ${reason}`);
    return true;
  }

  public emergencyPauseLeaderboards(reason: string): void {
    this._emergencyOverrides.leaderboardsPaused = true;
    this._emergencyOverrides.pauseReason = reason;
    this._version++;
    console.warn(`[LIVEOPS EMERGENCY] Leaderboard submissions PAUSED. Reason: ${reason}`);
  }

  public emergencyResumeLeaderboards(): void {
    this._emergencyOverrides.leaderboardsPaused = false;
    this._emergencyOverrides.pauseReason = undefined;
    this._version++;
  }

  public isLeaderboardsPaused(): { paused: boolean; reason?: string } {
    return {
      paused: this._emergencyOverrides.leaderboardsPaused,
      reason: this._emergencyOverrides.pauseReason,
    };
  }

  public extendSeason(seasonId: string, additionalHours: number): boolean {
    const season = this._seasons.find(s => s.id === seasonId);
    if (!season) return false;
    season.endsAt += additionalHours * 3600 * 1000;
    this._version++;
    return true;
  }
}
