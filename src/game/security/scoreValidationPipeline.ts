/**
 * GoWithFlow — Server-Authoritative Score Validation & Recalculation Pipeline
 * Phase 17 Section 5-9: Multi-stage pipeline verifying schema, auth, physics plausibility,
 * world progression coherence, authoritative score recalculation, and replay deduplication.
 */

import {
  AuthoritativeCompetitiveRun,
  ScoreValidationResult,
  SuspiciousFlag,
} from './securityConfig';
import { CURRENT_SEASON_ID } from '../social/socialConfig';
import { GameModeId } from '../modes/gameModeTypes';

const MAX_VELOCITY_MPS = 25.0; // 90 km/h aerodynamic ceiling
const MIN_DURATION_MS = 3000;
const MAX_SHARDS_PER_METER = 0.05; // ~50 shards per 1,000m max

// World boundary thresholds (meters)
const WORLD_DISTANCE_THRESHOLDS: Record<string, number> = {
  'sky-isles': 0,
  'verdant-wilds': 2000,
  'crimson-dunes': 4000,
  'crystal-heights': 6000,
  'obsidian-core': 8000,
};

export class ScoreValidationPipeline {
  private _processedRunFingerprints: Set<string> = new Set();

  /**
   * Generates a tamper-resistant fingerprint of the run to prevent replay attacks
   */
  public generateRunFingerprint(run: AuthoritativeCompetitiveRun): string {
    return `${run.playerId}:${run.modeId}:${Math.round(run.distance)}:${Math.round(run.durationMs)}:${run.shardsCollected}:${run.nearMisses}`;
  }

  /**
   * Authoritatively recalculates theoretical score based on telemetry metrics
   */
  public recalculateAuthoritativeScore(run: AuthoritativeCompetitiveRun): {
    calculatedScore: number;
    maxPlausibleScore: number;
  } {
    const dist = Math.max(0, run.distance);
    const shards = Math.max(0, run.shardsCollected);
    const nearMisses = Math.max(0, run.nearMisses);
    const obstacles = Math.max(0, run.obstaclesPassed);

    let baseScore = 0;
    let maxMultiplier = 1.0;

    switch (run.modeId) {
      case 'score-attack':
        // Overdrive combo multiplier caps at 10.0x
        maxMultiplier = 10.0;
        baseScore = Math.floor(
          dist * 1.0 + (shards * 100 + nearMisses * 250 + obstacles * 50) * maxMultiplier
        );
        break;

      case 'time-trial':
        baseScore = Math.floor(dist * 1.5 + shards * 120 + nearMisses * 300);
        break;

      case 'survival':
        const durationSec = run.durationMs / 1000;
        baseScore = Math.floor(durationSec * 150 + dist * 0.8 + shards * 100 + nearMisses * 200);
        break;

      case 'standard-run':
      case 'challenge-run':
      default:
        // Standard baseline: distance + pickups + grazes + obstacle hurdles
        baseScore = Math.floor(dist * 1.0 + shards * 100 + nearMisses * 250 + obstacles * 50);
        break;
    }

    // Allow 15% tolerance buffer for discrete timing & combo momentum float calculations
    const maxPlausibleScore = Math.floor(baseScore * 1.15) + 500;

    return {
      calculatedScore: baseScore,
      maxPlausibleScore,
    };
  }

  /**
   * Execute full multi-stage authoritative validation pipeline
   */
  public validate(run: AuthoritativeCompetitiveRun): ScoreValidationResult {
    const flags: SuspiciousFlag[] = [];

    // Stage 1: Schema & Payload Sanitization
    if (!run || typeof run !== 'object') {
      return {
        isValid: false,
        authoritativeScore: 0,
        claimedScore: 0,
        reason: 'Malformed payload: object required',
        flags: [{ code: 'SCHEMA_INVALID', message: 'Payload object missing', severity: 'CRITICAL' }],
      };
    }

    if (!run.playerId || !run.modeId || typeof run.score !== 'number' || typeof run.distance !== 'number') {
      return {
        isValid: false,
        authoritativeScore: 0,
        claimedScore: run.score || 0,
        reason: 'Missing mandatory competitive run telemetry fields',
        flags: [{ code: 'SCHEMA_FIELDS_MISSING', message: 'Mandatory telemetry fields missing', severity: 'CRITICAL' }],
      };
    }

    if (isNaN(run.score) || !isFinite(run.score) || isNaN(run.distance) || !isFinite(run.distance)) {
      return {
        isValid: false,
        authoritativeScore: 0,
        claimedScore: 0,
        reason: 'Numerical values must be finite and valid numbers',
        flags: [{ code: 'NUMERICAL_INTEGRITY_FAIL', message: 'Non-finite numbers detected', severity: 'CRITICAL' }],
      };
    }

    // Stage 2: Mode & Season Verification
    const VALID_MODES: GameModeId[] = ['standard-run', 'score-attack', 'time-trial', 'survival', 'challenge-run'];
    if (!VALID_MODES.includes(run.modeId)) {
      flags.push({
        code: 'INVALID_GAME_MODE',
        message: `Unknown or unauthorized game mode: ${run.modeId}`,
        severity: 'CRITICAL',
      });
      return {
        isValid: false,
        authoritativeScore: 0,
        claimedScore: run.score,
        reason: 'Invalid game mode specification',
        flags,
      };
    }

    if (run.seasonId !== CURRENT_SEASON_ID) {
      flags.push({
        code: 'SEASON_MISMATCH',
        message: `Run submitted for inactive season: ${run.seasonId}`,
        severity: 'WARN',
      });
      return {
        isValid: false,
        authoritativeScore: 0,
        claimedScore: run.score,
        reason: 'Submissions for expired or inactive seasons are rejected',
        flags,
      };
    }

    // Stage 3: Physics & Timing Plausibility
    if (run.durationMs < MIN_DURATION_MS && run.distance > 50) {
      flags.push({
        code: 'DURATION_TOO_SHORT',
        message: `Run duration (${run.durationMs}ms) too short for distance (${run.distance}m)`,
        severity: 'CRITICAL',
      });
      return {
        isValid: false,
        authoritativeScore: 0,
        claimedScore: run.score,
        reason: 'Run duration too short for distance traversed',
        flags,
      };
    }

    const durationSec = Math.max(1, run.durationMs / 1000);
    const avgVelocity = run.distance / durationSec;
    if (avgVelocity > MAX_VELOCITY_MPS) {
      flags.push({
        code: 'SUPERLUMINAL_VELOCITY',
        message: `Average velocity (${avgVelocity.toFixed(1)} m/s) exceeds maximum physical ceiling (${MAX_VELOCITY_MPS} m/s)`,
        severity: 'CRITICAL',
      });
      return {
        isValid: false,
        authoritativeScore: 0,
        claimedScore: run.score,
        reason: 'Physical flight speed exceeds theoretical aerodynamic limits',
        flags,
      };
    }

    // World Progression Coherence
    const worldNorm = (run.worldReached || '').toLowerCase().replace(' ', '-');
    for (const [worldKey, minDistance] of Object.entries(WORLD_DISTANCE_THRESHOLDS)) {
      if (worldNorm.includes(worldKey) && run.distance < minDistance) {
        flags.push({
          code: 'IMPOSSIBLE_WORLD_PROGRESSION',
          message: `Reached ${worldKey} at only ${run.distance}m (minimum required: ${minDistance}m)`,
          severity: 'CRITICAL',
        });
        return {
          isValid: false,
          authoritativeScore: 0,
          claimedScore: run.score,
          reason: 'World sector reached contradicts distance progressed',
          flags,
        };
      }
    }

    // Collectibles & Hazards density plausibility
    if (run.distance > 100 && (run.shardsCollected / run.distance) > MAX_SHARDS_PER_METER) {
      flags.push({
        code: 'ANOMALOUS_COLLECTIBLE_DENSITY',
        message: `Collectible shard density (${(run.shardsCollected / run.distance).toFixed(3)} shards/m) is impossibly high`,
        severity: 'CRITICAL',
      });
      return {
        isValid: false,
        authoritativeScore: 0,
        claimedScore: run.score,
        reason: 'Shard pickup count exceeds maximum procedural density',
        flags,
      };
    }

    // Stage 4: Authoritative Score Recalculation
    const { calculatedScore, maxPlausibleScore } = this.recalculateAuthoritativeScore(run);
    if (run.score > maxPlausibleScore) {
      flags.push({
        code: 'SCORE_INFLATION_DETECTED',
        message: `Claimed score (${run.score}) exceeds server calculated maximum plausible ceiling (${maxPlausibleScore})`,
        severity: 'CRITICAL',
      });
      return {
        isValid: false,
        authoritativeScore: calculatedScore,
        claimedScore: run.score,
        reason: 'Claimed score deviates beyond verified physical calculations',
        flags,
      };
    }

    // Stage 5: Deduplication / Replay Detection
    const fingerprint = this.generateRunFingerprint(run);
    if (this._processedRunFingerprints.has(fingerprint)) {
      flags.push({
        code: 'REPLAY_ATTACK_DETECTED',
        message: 'Identical run telemetry fingerprint previously submitted',
        severity: 'CRITICAL',
      });
      return {
        isValid: false,
        authoritativeScore: 0,
        claimedScore: run.score,
        reason: 'Duplicate run submission rejected',
        flags,
      };
    }

    // Mark fingerprint as processed
    this._processedRunFingerprints.add(fingerprint);

    return {
      isValid: true,
      authoritativeScore: Math.floor(run.score),
      claimedScore: run.score,
      flags,
    };
  }

  /**
   * Reset processed fingerprints (useful for test isolation)
   */
  public resetFingerprints(): void {
    this._processedRunFingerprints.clear();
  }
}
