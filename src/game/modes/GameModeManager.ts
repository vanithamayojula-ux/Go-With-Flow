/**
 * GoWithFlow — Game Mode Manager
 * Phase 15: Central mode coordinator, lifecycle dispatch, local record persistence,
 * progression feeding, and anti-exploit validations.
 */

import { PlayerStats } from '../../types';
import {
  GameMode,
  GameModeId,
  GameModeSummary,
  GameModeSaveData,
  GameModePersonalRecord,
  ChallengeDefinition,
  ChallengeModifier,
} from './gameModeTypes';
import {
  GAME_MODE_STORAGE_KEY,
  GAME_MODE_VERSION,
  GAME_MODE_DEFINITIONS,
  CURATED_CHALLENGES,
  getDailyChallenge,
  getWeeklyChallenge,
  getTodayUtcDate,
  getCurrentUtcWeek,
  createDefaultGameModeSaveData,
} from './gameModeConfig';
import { StandardRunMode } from './standardRun';
import { ScoreAttackMode } from './scoreAttack';
import { TimeTrialMode } from './timeTrial';
import { SurvivalMode } from './survival';
import { ChallengeRunMode } from './challengeRun';
import { ProgressionManager } from '../progression';

export class GameModeManager {
  private _state: GameModeSaveData;
  private _modes: Map<GameModeId, GameMode> = new Map();
  private _activeModeId: GameModeId = 'standard-run';
  private _activeChallengeId?: string;
  private _currentSummary: GameModeSummary | null = null;
  private _runHasStarted: boolean = false;
  private _hasAwardedProgression: boolean = false;

  constructor() {
    this._state = this.loadState();

    // Register mode instances
    this._modes.set('standard-run', new StandardRunMode());
    this._modes.set('score-attack', new ScoreAttackMode());
    this._modes.set('time-trial', new TimeTrialMode());
    this._modes.set('survival', new SurvivalMode());
    this._modes.set('challenge-run', new ChallengeRunMode());

    // Restore selected mode
    this.setMode(this._state.selectedMode, this._state.selectedChallengeId);
  }

  // --- State Persistence ---

  private loadState(): GameModeSaveData {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return createDefaultGameModeSaveData();
    }

    try {
      const raw = localStorage.getItem(GAME_MODE_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          return {
            version: GAME_MODE_VERSION,
            selectedMode: parsed.selectedMode || 'standard-run',
            selectedChallengeId: parsed.selectedChallengeId,
            records: parsed.records || {},
            completedChallenges: parsed.completedChallenges || {},
            claimedDailyChallenges: parsed.claimedDailyChallenges || {},
            claimedWeeklyChallenges: parsed.claimedWeeklyChallenges || {},
            totalRunsByMode: parsed.totalRunsByMode || {
              'standard-run': 0,
              'score-attack': 0,
              'time-trial': 0,
              'survival': 0,
              'challenge-run': 0,
            },
            lastUpdated: Date.now(),
          };
        }
      }
    } catch (err) {
      console.warn('[GameModeManager] Failed to load mode state, resetting to default.', err);
    }

    return createDefaultGameModeSaveData();
  }

  private saveState(): void {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
    try {
      this._state.lastUpdated = Date.now();
      localStorage.setItem(GAME_MODE_STORAGE_KEY, JSON.stringify(this._state));
    } catch (err) {
      console.error('[GameModeManager] Failed to save state to localStorage', err);
    }
  }

  // --- Mode Selection & Configuration ---

  public get activeModeId(): GameModeId {
    return this._activeModeId;
  }

  public get activeMode(): GameMode {
    const mode = this._modes.get(this._activeModeId);
    return mode || this._modes.get('standard-run')!;
  }

  public setMode(modeId: GameModeId, challengeId?: string): void {
    if (!this._modes.has(modeId)) {
      modeId = 'standard-run';
    }
    this._activeModeId = modeId;
    this._state.selectedMode = modeId;

    if (modeId === 'challenge-run') {
      const cMode = this._modes.get('challenge-run') as ChallengeRunMode;
      let targetChallenge: ChallengeDefinition | undefined;

      if (challengeId) {
        if (challengeId.startsWith('daily_')) {
          targetChallenge = getDailyChallenge();
        } else if (challengeId.startsWith('weekly_')) {
          targetChallenge = getWeeklyChallenge();
        } else {
          targetChallenge = CURATED_CHALLENGES.find(c => c.id === challengeId);
        }
      }

      if (!targetChallenge) {
        targetChallenge = CURATED_CHALLENGES[0];
      }

      this._activeChallengeId = targetChallenge.id;
      this._state.selectedChallengeId = targetChallenge.id;
      cMode.setChallenge(targetChallenge);
    } else {
      this._activeChallengeId = undefined;
      this._state.selectedChallengeId = undefined;
    }

    this.saveState();
  }

  public getSelectedChallengeId(): string | undefined {
    return this._activeChallengeId;
  }

  public getRecord(key: string): GameModePersonalRecord {
    if (!this._state.records[key]) {
      this._state.records[key] = {
        highestScore: 0,
        longestDistance: 0,
        bestTimeSeconds: 0,
        longestSurvivalTime: 0,
        mostNearMisses: 0,
        completedCount: 0,
        lastPlayedTimestamp: 0,
      };
    }
    return this._state.records[key];
  }

  // --- Run Lifecycle Hooks ---

  public onRunStart(): void {
    this._runHasStarted = true;
    this._hasAwardedProgression = false;
    this._currentSummary = null;

    const mode = this.activeMode;
    mode.initialize();

    // Increment mode play count
    this._state.totalRunsByMode[this._activeModeId] =
      (this._state.totalRunsByMode[this._activeModeId] || 0) + 1;
    this.saveState();
  }

  public update(delta: number, stats: PlayerStats): void {
    if (!this._runHasStarted) return;
    this.activeMode.update(delta, stats);
  }

  public onCollect(count: number, stats: PlayerStats): void {
    if (!this._runHasStarted) return;
    this.activeMode.onCollect(count, stats);
  }

  public onObstaclePassed(obstacleType: string, isNearMiss: boolean): void {
    if (!this._runHasStarted) return;
    this.activeMode.onObstaclePassed(obstacleType, isNearMiss);
  }

  public onWorldChanged(worldId: string, worldIndex: number): void {
    if (!this._runHasStarted) return;
    this.activeMode.onWorldChanged(worldId, worldIndex);
  }

  public onRevive(): void {
    if (!this._runHasStarted) return;
    this.activeMode.onRevive();
  }

  public onGameOver(finalStats: PlayerStats, progressionMgr?: ProgressionManager): GameModeSummary {
    this._runHasStarted = false;
    const mode = this.activeMode;
    mode.onGameOver(finalStats);

    const summary = mode.getSummary();
    const recordKey = this._activeChallengeId || this._activeModeId;
    const record = this.getRecord(recordKey);

    let isNewRecord = false;

    // Evaluate records based on mode
    if (this._activeModeId === 'time-trial') {
      if (summary.isCompleted) {
        if (record.bestTimeSeconds === 0 || summary.durationSeconds < record.bestTimeSeconds) {
          record.bestTimeSeconds = summary.durationSeconds;
          isNewRecord = true;
        }
      }
    } else if (this._activeModeId === 'survival') {
      if (summary.durationSeconds > record.longestSurvivalTime) {
        record.longestSurvivalTime = summary.durationSeconds;
        isNewRecord = true;
      }
    } else {
      if (summary.finalScore > record.highestScore) {
        record.highestScore = summary.finalScore;
        isNewRecord = true;
      }
    }

    if (summary.distance > record.longestDistance) {
      record.longestDistance = summary.distance;
    }
    if (summary.nearMisses > record.mostNearMisses) {
      record.mostNearMisses = summary.nearMisses;
    }
    if (summary.isCompleted) {
      record.completedCount++;
    }
    record.lastPlayedTimestamp = Date.now();

    summary.isNewRecord = isNewRecord;

    // Feed into Phase 13 Progression System (Anti-exploit single attribution)
    if (progressionMgr && !this._hasAwardedProgression) {
      this._hasAwardedProgression = true;

      // 1. Award Mode XP
      if (summary.xpAwarded > 0) {
        progressionMgr.addXp(summary.xpAwarded, `${mode.name} Performance`);
      }

      // 2. Mark challenge completed if applicable
      if (this._activeModeId === 'challenge-run' && this._activeChallengeId && summary.isCompleted) {
        this.claimChallengeCompletion(this._activeChallengeId, progressionMgr);
      }
    }

    this._currentSummary = summary;
    this.saveState();
    return summary;
  }

  /**
   * Idempotent challenge completion claiming
   */
  public claimChallengeCompletion(challengeId: string, progressionMgr?: ProgressionManager): boolean {
    const today = getTodayUtcDate();
    const thisWeek = getCurrentUtcWeek();

    if (challengeId.startsWith('daily_')) {
      if (this._state.claimedDailyChallenges[today]) {
        return false; // Already claimed today
      }
      this._state.claimedDailyChallenges[today] = true;
      if (progressionMgr) {
        progressionMgr.addXp(250, 'Daily Operation Complete');
      }
      this.saveState();
      return true;
    }

    if (challengeId.startsWith('weekly_')) {
      if (this._state.claimedWeeklyChallenges[thisWeek]) {
        return false; // Already claimed this week
      }
      this._state.claimedWeeklyChallenges[thisWeek] = true;
      if (progressionMgr) {
        progressionMgr.addXp(1200, 'Weekly Master Trial Complete');
      }
      this.saveState();
      return true;
    }

    // Curated standard challenge
    if (this._state.completedChallenges[challengeId]) {
      return false; // Already cleared once
    }

    this._state.completedChallenges[challengeId] = true;
    this.saveState();
    return true;
  }

  public isDailyClaimed(): boolean {
    return !!this._state.claimedDailyChallenges[getTodayUtcDate()];
  }

  public isWeeklyClaimed(): boolean {
    return !!this._state.claimedWeeklyChallenges[getCurrentUtcWeek()];
  }

  public isChallengeCompleted(id: string): boolean {
    if (id.startsWith('daily_')) return this.isDailyClaimed();
    if (id.startsWith('weekly_')) return this.isWeeklyClaimed();
    return !!this._state.completedChallenges[id];
  }

  public getLastSummary(): GameModeSummary | null {
    return this._currentSummary;
  }

  public isReviveAllowed(): boolean {
    return this.activeMode.allowsRevive;
  }

  public getAllRecords(): Record<string, GameModePersonalRecord> {
    return this._state.records;
  }
}
