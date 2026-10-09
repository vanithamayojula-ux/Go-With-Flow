/**
 * GoWithFlow — Social & Competitive Manager
 * Phase 16: Central coordinator for profiles, rankings, submissions, friend challenges,
 * shareable result cards, and seasonal competitions.
 */

import { ProfileService } from './playerProfile';
import { LeaderboardService } from './leaderboardService';
import { ChallengeService } from './challengeService';
import { RunSubmissionValidator } from './runSubmission';
import {
  RunSubmission,
  ShareCardData,
  CURRENT_SEASON_ID,
  CURRENT_SEASON_NAME,
  SEASONAL_REWARDS,
} from './socialConfig';
import { ProgressionManager } from '../progression';
import { GameModeSummary } from '../modes/gameModeTypes';
import { SecurityManager } from '../security';
import { LiveOpsManager } from '../liveops';

export class SocialManager {
  public profileService: ProfileService;
  public leaderboardService: LeaderboardService;
  public challengeService: ChallengeService;
  public securityManager: SecurityManager;
  public liveOpsManager: LiveOpsManager;

  constructor() {
    this.profileService = new ProfileService();
    this.leaderboardService = new LeaderboardService();
    this.challengeService = new ChallengeService();
    this.securityManager = new SecurityManager();
    this.liveOpsManager = new LiveOpsManager(this.securityManager);
  }

  /**
   * Process and submit a completed run to the competitive social pipeline.
   * Completely decoupled from the real-time frame loop.
   */
  public submitRunSummary(
    summary: GameModeSummary,
    progressionMgr?: ProgressionManager
  ): { submitted: boolean; error?: string; isNewPersonalBest?: boolean } {
    const profile = this.profileService.getProfile();

    // 1. Update Profile Aggregated Records
    this.profileService.recordRunRecords(
      summary.finalScore,
      summary.distance,
      summary.modeId === 'time-trial' ? summary.durationSeconds : undefined,
      summary.modeId === 'survival' ? summary.durationSeconds : undefined
    );

    if (progressionMgr) {
      this.profileService.syncProgressionStats(progressionMgr);
    }

    // 2. Dispatch LiveOps seasonal challenges and event progression
    this.liveOpsManager.onRunComplete(summary, progressionMgr);

    // 3. Check Player Privacy Settings
    if (!profile.privacy.showOnLeaderboards) {
      return { submitted: false, error: 'Leaderboard submissions disabled in player privacy settings.' };
    }

    // 4. Construct Run Submission Payload
    const durationMs = Math.max(1000, summary.durationSeconds * 1000);
    const activeSeason = this.liveOpsManager.getActiveSeason();
    const submission: RunSubmission = {
      submissionId: `sub_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      playerId: profile.id,
      username: profile.username,
      modeId: summary.modeId,
      score: summary.finalScore,
      distance: summary.distance,
      durationMs,
      worldReached: summary.worldReached,
      shardsCollected: summary.shardsCollected,
      nearMisses: summary.nearMisses,
      obstaclesPassed: summary.obstaclesPassed,
      revivesUsed: summary.breakdown.some(b => b.label.includes('Revive Deduction')) ? 1 : 0,
      seasonId: activeSeason.id,
      timestamp: Date.now(),
    };

    submission.clientSignature = RunSubmissionValidator.signSubmission(submission);

    // 4. Authoritative Multi-Stage Security Validation
    const session = this.securityManager.authService.createSession(profile.id, profile.username, 'player');
    const secValidation = this.securityManager.validateCompetitiveSubmission(session, {
      submissionId: submission.submissionId,
      playerId: submission.playerId,
      username: submission.username,
      modeId: submission.modeId,
      seasonId: submission.seasonId,
      score: submission.score,
      distance: submission.distance,
      durationMs: submission.durationMs,
      worldReached: submission.worldReached,
      shardsCollected: submission.shardsCollected,
      nearMisses: submission.nearMisses,
      obstaclesPassed: submission.obstaclesPassed,
      revivesUsed: submission.revivesUsed,
      submittedAt: submission.timestamp,
    });

    if (!secValidation.isValid) {
      return {
        submitted: false,
        error: secValidation.reason,
      };
    }

    // Authoritatively enforced score
    submission.score = secValidation.authoritativeScore;

    // 5. Submit to Leaderboard Service
    const result = this.leaderboardService.submitRun(submission);

    return {
      submitted: result.success,
      error: result.error,
      isNewPersonalBest: summary.isNewRecord,
    };
  }

  /**
   * Safe Account Deletion Workflow (Privacy Right to Erasure)
   */
  public deleteAccount(): { success: boolean; error?: string } {
    const profile = this.profileService.getProfile();
    const session = this.securityManager.authService.createSession(profile.id, profile.username, 'player');
    return this.securityManager.lifecycleService.deleteAccount(
      session,
      profile.id,
      this.profileService,
      this.leaderboardService,
      this.challengeService
    );
  }

  /**
   * Generate a structured, privacy-safe share card object
   */
  public generateShareCard(summary: GameModeSummary): ShareCardData {
    const profile = this.profileService.getProfile();
    const modeNameMap: Record<string, string> = {
      'standard-run': 'STANDARD RUN',
      'score-attack': 'SCORE ATTACK',
      'time-trial': 'TIME TRIAL',
      'survival': 'SURVIVAL',
      'challenge-run': 'CHALLENGE TRIAL',
    };

    return {
      appName: 'GOWITHFLOW // NEON DRIFT',
      title: `${profile.username}'s Telemetry Record`,
      playerName: profile.username,
      modeName: modeNameMap[summary.modeId] || summary.modeName.toUpperCase(),
      score: summary.finalScore,
      distance: summary.distance,
      worldReached: summary.worldReached.toUpperCase(),
      seasonName: this.liveOpsManager.getActiveSeason().name.toUpperCase(),
      timestamp: Date.now(),
      shareUrl: typeof window !== 'undefined' ? window.location.origin : 'https://gowithflow.app',
    };
  }

  /**
   * Copies a compact ASCII / markdown summary card to clipboard
   */
  public async copyShareCardToClipboard(summary: GameModeSummary): Promise<boolean> {
    const card = this.generateShareCard(summary);
    const text = [
      `🌊 GOWITHFLOW // ${card.modeName}`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `👤 Pilot: ${card.playerName}`,
      `⚡ Score: ${card.score.toLocaleString()}`,
      `🚀 Distance: ${card.distance.toLocaleString()}m`,
      `🌌 Sector Reached: ${card.worldReached}`,
      `🏆 ${card.seasonName}`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `Play now: ${card.shareUrl}`,
    ].join('\n');

    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (err) {
        console.warn('Clipboard write failed', err);
      }
    }
    return false;
  }

  public getSeasonalRewards() {
    return SEASONAL_REWARDS;
  }
}
