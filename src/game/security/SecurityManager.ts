/**
 * GoWithFlow — Security & Competitive Integrity Manager
 * Phase 17: Central coordinator unifying authentication, authorization, rate limiting,
 * score recalculation, reward idempotency, currency integrity, audit logging, and moderation.
 */

import { AuthService } from './authService';
import { AuthorizationGuard } from './authorizationGuard';
import { ScoreValidationPipeline } from './scoreValidationPipeline';
import { RewardIntegrityService } from './rewardIntegrityService';
import { CurrencyIntegrityService } from './currencyIntegrityService';
import { RateLimiter } from './rateLimiter';
import { SecurityAuditLogger } from './securityAuditLogger';
import { AdminModerationService } from './adminModerationService';
import { StorageSanitizer } from './storageSanitizer';
import { AccountLifecycleService } from './accountLifecycleService';
import {
  AuthSession,
  AuthoritativeCompetitiveRun,
  ScoreValidationResult,
} from './securityConfig';

export class SecurityManager {
  public authService: AuthService;
  public rateLimiter: RateLimiter;
  public auditLogger: SecurityAuditLogger;
  public scorePipeline: ScoreValidationPipeline;
  public rewardService: RewardIntegrityService;
  public currencyService: CurrencyIntegrityService;
  public moderationService: AdminModerationService;
  public lifecycleService: AccountLifecycleService;

  constructor() {
    this.authService = new AuthService();
    this.rateLimiter = new RateLimiter();
    this.auditLogger = new SecurityAuditLogger();
    this.scorePipeline = new ScoreValidationPipeline();
    this.rewardService = new RewardIntegrityService();
    this.currencyService = new CurrencyIntegrityService();
    this.moderationService = new AdminModerationService(this.auditLogger);
    this.lifecycleService = new AccountLifecycleService(this.authService, this.auditLogger);
  }

  /**
   * Authoritatively validate a competitive run submission through all security stages.
   * Includes rate limiting, player suspension checks, authorization, and the score recalculation pipeline.
   */
  public validateCompetitiveSubmission(
    session: AuthSession | null,
    run: AuthoritativeCompetitiveRun
  ): ScoreValidationResult {
    // 1. Rate Limiting Check
    const rateCheck = this.rateLimiter.check('run_submission', run.playerId || 'anonymous');
    if (!rateCheck.allowed) {
      this.auditLogger.log('WARN', 'RATE_LIMIT_EXCEEDED', {
        actorId: run.playerId,
        reason: `Submission rate limit exceeded. Retry in ${rateCheck.retryAfterSeconds}s`,
      });
      return {
        isValid: false,
        authoritativeScore: 0,
        claimedScore: run.score,
        reason: `Submission rate limit exceeded. Please wait ${rateCheck.retryAfterSeconds} seconds.`,
        flags: [{ code: 'RATE_LIMIT_EXCEEDED', message: 'Too many submissions', severity: 'WARN' }],
      };
    }

    // 2. Player Suspension Check
    if (run.playerId && this.moderationService.isPlayerSuspended(run.playerId)) {
      this.auditLogger.log('WARN', 'SUBMISSION_REJECTED', {
        actorId: run.playerId,
        reason: 'Suspended player attempted competitive run submission',
      });
      return {
        isValid: false,
        authoritativeScore: 0,
        claimedScore: run.score,
        reason: 'Account is temporarily suspended from competitive play.',
        flags: [{ code: 'PLAYER_SUSPENDED', message: 'Account is suspended', severity: 'CRITICAL' }],
      };
    }

    // 3. Authorization Check (if session provided)
    if (session) {
      const authz = AuthorizationGuard.canSubmitRun(session, run.playerId);
      if (!authz.authorized) {
        this.auditLogger.log('WARN', 'SUBMISSION_REJECTED', {
          actorId: session.playerId,
          targetId: run.playerId,
          reason: authz.error,
        });
        return {
          isValid: false,
          authoritativeScore: 0,
          claimedScore: run.score,
          reason: authz.error,
          flags: [{ code: 'UNAUTHORIZED_SUBMISSION', message: 'Unauthorized submission attempt', severity: 'CRITICAL' }],
        };
      }
    }

    // 4. Authoritative Multi-Stage Score Pipeline
    const validationResult = this.scorePipeline.validate(run);

    if (!validationResult.isValid) {
      this.auditLogger.log('WARN', 'SUBMISSION_REJECTED', {
        actorId: run.playerId,
        targetId: run.submissionId,
        reason: validationResult.reason,
        metadata: {
          claimedScore: run.score,
          calculatedScore: validationResult.authoritativeScore,
          flags: validationResult.flags.map(f => f.code),
        },
      });
    } else {
      this.auditLogger.log('INFO', 'SUBMISSION_ACCEPTED', {
        actorId: run.playerId,
        targetId: run.submissionId,
        metadata: {
          score: validationResult.authoritativeScore,
          distance: run.distance,
          modeId: run.modeId,
        },
      });
    }

    return validationResult;
  }
}
