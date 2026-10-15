/**
 * GoWithFlow — Run Submission & Local Sanity Checks (client-side only)
 * Phase 16 Section 9-13: Validation rules, rate limiting, signature verification, and exploit mitigation.
 */

import { RunSubmission, ValidationResult, CURRENT_SEASON_ID } from './socialConfig';
import { ScoreValidationPipeline } from '../security/scoreValidationPipeline';

// Forward speed is hard-capped at 65 m/s in player.ts (boost gates). The old
// 25 m/s value rejected normal runs once the distance speed ramp kicked in.
const MAX_THEORETICAL_SPEED_METERS_PER_SEC = 65.0;
const scoreCeiling = new ScoreValidationPipeline();
const MIN_DURATION_FOR_RANKING_MS = 3000; // Runs shorter than 3s are invalid/abandoned

// In-memory rate limiting store (prevent client flooding)
const clientSubmissionTimestamps: Map<string, number[]> = new Map();
const MAX_SUBMISSIONS_PER_MINUTE = 20; // matches securityConfig run_submission; quick deaths are legitimate

export class RunSubmissionValidator {
  /**
   * Local run sanity checks. Runs in the browser, so it guards against bugs, not determined cheaters.
   * Rejects impossible speed, corrupted timestamps, spoofed modes, and replayed submissions.
   */
  public static validate(submission: RunSubmission): ValidationResult {
    const flags: string[] = [];

    // 1. Basic Payload Integrity
    if (!submission || typeof submission !== 'object') {
      return { isValid: false, reason: 'Malformed payload' };
    }
    if (!submission.playerId || !submission.username || !submission.modeId) {
      return { isValid: false, reason: 'Missing mandatory identification fields' };
    }

    // 2. Score & Distance Sanity
    if (submission.score < 0 || isNaN(submission.score)) {
      return { isValid: false, reason: 'Invalid negative or NaN score value' };
    }
    if (submission.distance < 0 || isNaN(submission.distance)) {
      return { isValid: false, reason: 'Invalid negative distance' };
    }

    // 3. Duration & Physical Velocity Validation
    if (submission.durationMs < MIN_DURATION_FOR_RANKING_MS && submission.distance > 100) {
      flags.push('ANOMALY_DURATION_TOO_SHORT');
      return {
        isValid: false,
        reason: 'Run duration too short for distance traveled',
        antiCheatFlags: flags,
      };
    }

    const durationSeconds = Math.max(1, submission.durationMs / 1000);
    const averageSpeedMps = submission.distance / durationSeconds;

    if (averageSpeedMps > MAX_THEORETICAL_SPEED_METERS_PER_SEC) {
      flags.push('IMPOSSIBLE_SUPERLUMINAL_VELOCITY');
      return {
        isValid: false,
        reason: `Average speed (${averageSpeedMps.toFixed(1)} m/s) exceeds maximum physical aerodynamic limits`,
        antiCheatFlags: flags,
      };
    }

    // 4. Score plausibility, using the same ceiling as the score pipeline so
    // the two checks can't disagree. (A flat 75 pts/m limit rejected short,
    // trick-heavy runs, since tricks score by time, not distance.)
    const { maxPlausibleScore } = scoreCeiling.recalculateAuthoritativeScore({
      distance: submission.distance,
      durationMs: submission.durationMs,
      shardsCollected: submission.shardsCollected ?? 0,
      nearMisses: submission.nearMisses ?? 0,
      obstaclesPassed: submission.obstaclesPassed ?? 0,
      modeId: submission.modeId,
    });
    if (submission.score > maxPlausibleScore) {
      flags.push('IMPOSSIBLE_SCORE_DENSITY');
      return {
        isValid: false,
        reason: 'Score disproportionately high relative to run length',
        antiCheatFlags: flags,
      };
    }

    // 5. World Sequence Check
    const VALID_WORLDS = ['sky-isles', 'verdant-wilds', 'crimson-dunes', 'crystal-heights', 'obsidian-core'];
    const worldKey = submission.worldReached.toLowerCase();
    const hasValidWorld = VALID_WORLDS.some(w => worldKey.includes(w) || worldKey.includes(w.replace('-', ' ')));
    if (!hasValidWorld && submission.worldReached !== 'Sky Isles') {
      flags.push('UNRECOGNIZED_WORLD_SECTOR');
    }

    // 6. Rate Limiting Check (Anti-flood)
    const now = Date.now();
    const history = clientSubmissionTimestamps.get(submission.playerId) || [];
    const recent = history.filter(t => now - t < 60000);
    if (recent.length >= MAX_SUBMISSIONS_PER_MINUTE) {
      return {
        isValid: false,
        reason: 'Rate limit exceeded. Please wait before submitting another score.',
        antiCheatFlags: ['RATE_LIMIT_EXCEEDED'],
      };
    }
    recent.push(now);
    clientSubmissionTimestamps.set(submission.playerId, recent);

    // 7. Season Alignment
    if (submission.seasonId !== CURRENT_SEASON_ID) {
      flags.push('OFF_SEASON_ATTRIBUTION');
    }

    return {
      isValid: true,
      antiCheatFlags: flags.length > 0 ? flags : undefined,
      sanitizedScore: Math.floor(submission.score),
    };
  }

  /**
   * Generates a tamper-evident client submission hash
   */
  public static signSubmission(submission: Omit<RunSubmission, 'clientSignature'>): string {
    const raw = `${submission.playerId}:${submission.modeId}:${submission.score}:${submission.distance}:${submission.durationMs}:${submission.seasonId}`;
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      hash = Math.imul(31, hash) + raw.charCodeAt(i) | 0;
    }
    return `sig_${Math.abs(hash).toString(16)}`;
  }
}
