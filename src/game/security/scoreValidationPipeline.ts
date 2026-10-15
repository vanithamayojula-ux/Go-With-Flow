/**
 * GoWithFlow — Local Score Sanity Checks (client-side only)
 * Phase 17 Section 5-9: Multi-stage pipeline verifying schema, auth, physics plausibility,
 * world progression coherence, local score recalculation, and replay deduplication.
 */

import {
  AuthoritativeCompetitiveRun,
  ScoreValidationResult,
  SuspiciousFlag,
} from './securityConfig';
import { CURRENT_SEASON_ID } from '../social/socialConfig';
import { GameModeId } from '../modes/gameModeTypes';
import { WORLD_ORDER, WORLD_LENGTH_DISTANCE } from '../WorldConfig';

// Hard cap on forward speed in player.ts (boost gates clamp to 65 m/s).
// The old 25 m/s limit rejected normal runs once the speed ramp kicked in.
const MAX_VELOCITY_MPS = 65.0;
const MIN_DURATION_MS = 3000;
// Shards include coins, terrain orbs and +3 per near miss; with the magnet a
// good run can exceed one per 20 m. Keep generous headroom (300 per 1,000 m).
const MAX_SHARDS_PER_METER = 0.3;

// World boundary thresholds (meters), derived from the real world layout so
// they can't drift from WorldConfig again (they were hard-coded at 2000m
// spacing while worlds are WORLD_LENGTH_DISTANCE = 2250m long).
const WORLD_DISTANCE_THRESHOLDS: Record<string, number> = Object.fromEntries(
  WORLD_ORDER.map((id, i) => [id, i * WORLD_LENGTH_DISTANCE])
);

export class ScoreValidationPipeline {
  private _processedRunFingerprints: Set<string> = new Set();

  /**
   * Generates a tamper-resistant fingerprint of the run to prevent replay attacks
   */
  public generateRunFingerprint(run: AuthoritativeCompetitiveRun): string {
    return `${run.playerId}:${run.modeId}:${Math.round(run.distance)}:${Math.round(run.durationMs)}:${run.shardsCollected}:${run.nearMisses}`;
  }

  /**
   * Locally recalculates theoretical score based on telemetry metrics
   */
  public recalculateAuthoritativeScore(
    run: Pick<AuthoritativeCompetitiveRun, 'distance' | 'durationMs' | 'shardsCollected' | 'nearMisses' | 'obstaclesPassed' | 'modeId'>
  ): {
    calculatedScore: number;
    maxPlausibleScore: number;
  } {
    const dist = Math.max(0, run.distance);
    const shards = Math.max(0, run.shardsCollected);
    const nearMisses = Math.max(0, run.nearMisses);
    const obstacles = Math.max(0, run.obstaclesPassed);
    const durationSec = Math.max(0, run.durationMs / 1000);

    // Ceiling derived from the scoring rules in player.ts / GameEngine.ts:
    //   riding    4 pts/m, x2 with the 2x power-up, x2 while grinding  -> 16 pts/m
    //   tricks    one per 0.3s, 350 x combo (combo <= 8)               -> ~3,000 pts/s sustained
    //   shards    up to 200 + 120 x 2 pts each
    //   near miss 300 pts; portal warps 1,500 each, one gateway per world
    //   boundary (every WORLD_LENGTH_DISTANCE m, four in the campaign)
    // The previous formula (1 pt/m) rejected every honest run over a few hundred metres.
    const portals = Math.min(WORLD_ORDER.length - 1, Math.floor(dist / WORLD_LENGTH_DISTANCE));
    let baseScore = Math.floor(
      dist * 16 + durationSec * 3000 + shards * 440 + nearMisses * 300 + obstacles * 50 + portals * 1500
    );

    switch (run.modeId) {
      case 'score-attack':
        baseScore *= 10; // chain multiplier caps at 10x
        break;
      case 'survival':
        baseScore += Math.floor(durationSec * 150);
        break;
      default:
        break;
    }

    // 15% tolerance plus a flat buffer for very short runs.
    const maxPlausibleScore = Math.floor(baseScore * 1.15) + 500;

    return {
      calculatedScore: baseScore,
      maxPlausibleScore,
    };
  }

  /**
   * Execute full multi-stage local validation pipeline
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

    // Stage 4: Local Score Recalculation
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
