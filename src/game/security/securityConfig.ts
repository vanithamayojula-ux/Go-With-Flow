/**
 * GoWithFlow — Security & Competitive Integrity Configuration
 * Phase 17: Roles, Permissions, Session Tokens, Audit Logs, Rate Limits, and Security Policies.
 */

import { GameModeId } from '../modes/gameModeTypes';

export const SECURITY_STORAGE_KEY_SESSIONS = 'skyflow_sec_sessions_v1';
export const SECURITY_STORAGE_KEY_AUDIT_LOGS = 'skyflow_sec_audit_logs_v1';
export const SECURITY_STORAGE_KEY_REWARD_LEDGER = 'skyflow_sec_reward_ledger_v1';
export const SECURITY_STORAGE_KEY_CURRENCY_LEDGER = 'skyflow_sec_currency_ledger_v1';
export const SECURITY_STORAGE_KEY_BANNED_PLAYERS = 'skyflow_sec_banned_players_v1';

export type UserRole = 'player' | 'moderator' | 'admin';

export type SecurityPermission =
  | 'read_leaderboards'
  | 'submit_run'
  | 'manage_profile'
  | 'create_challenge'
  | 'claim_reward'
  | 'moderate_leaderboard'
  | 'ban_player'
  | 'view_audit_logs'
  | 'system_admin';

export const ROLE_PERMISSIONS: Record<UserRole, SecurityPermission[]> = {
  player: [
    'read_leaderboards',
    'submit_run',
    'manage_profile',
    'create_challenge',
    'claim_reward',
  ],
  moderator: [
    'read_leaderboards',
    'submit_run',
    'manage_profile',
    'create_challenge',
    'claim_reward',
    'moderate_leaderboard',
    'ban_player',
    'view_audit_logs',
  ],
  admin: [
    'read_leaderboards',
    'submit_run',
    'manage_profile',
    'create_challenge',
    'claim_reward',
    'moderate_leaderboard',
    'ban_player',
    'view_audit_logs',
    'system_admin',
  ],
};

export interface AuthSession {
  sessionId: string;
  token: string;
  playerId: string;
  username: string;
  role: UserRole;
  issuedAt: number;
  expiresAt: number;
  nonce: string;
  isRevoked: boolean;
}

export type AuditSeverity = 'INFO' | 'WARN' | 'CRITICAL';

export type AuditActionType =
  | 'AUTH_LOGIN'
  | 'AUTH_LOGOUT'
  | 'AUTH_FAILED'
  | 'SESSION_REVOKED'
  | 'SUSPICIOUS_SCORE'
  | 'SUBMISSION_ACCEPTED'
  | 'SUBMISSION_REJECTED'
  | 'REWARD_CLAIMED'
  | 'REWARD_DUPLICATE_ATTEMPT'
  | 'CURRENCY_TRANSACTION'
  | 'CURRENCY_ANOMALY'
  | 'RATE_LIMIT_EXCEEDED'
  | 'ADMIN_ACTION'
  | 'PLAYER_SUSPENDED'
  | 'LEADERBOARD_MODERATED'
  | 'ACCOUNT_DELETED'
  | 'SECURITY_ANOMALY';

export interface SecurityAuditEntry {
  id: string;
  timestamp: number;
  severity: AuditSeverity;
  action: AuditActionType;
  actorId?: string;
  actorRole?: UserRole;
  targetId?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}

export interface RateLimitPolicy {
  maxRequests: number;
  windowMs: number;
}

export type RateLimitedAction =
  | 'auth_attempt'
  | 'run_submission'
  | 'name_change'
  | 'leaderboard_query'
  | 'challenge_create'
  | 'reward_claim'
  | 'admin_operation';

export const RATE_LIMIT_POLICIES: Record<RateLimitedAction, RateLimitPolicy> = {
  auth_attempt: { maxRequests: 5, windowMs: 60 * 1000 },
  run_submission: { maxRequests: 5, windowMs: 60 * 1000 },
  name_change: { maxRequests: 2, windowMs: 600 * 1000 },
  leaderboard_query: { maxRequests: 60, windowMs: 60 * 1000 },
  challenge_create: { maxRequests: 10, windowMs: 60 * 1000 },
  reward_claim: { maxRequests: 10, windowMs: 60 * 1000 },
  admin_operation: { maxRequests: 20, windowMs: 60 * 1000 },
};

/**
 * Compact telemetry verification event sequence
 */
export type TelemetryEventType =
  | 'START'
  | 'WORLD_TRANSITION'
  | 'COLLECTIBLE'
  | 'OBSTACLE_PASS'
  | 'NEAR_MISS'
  | 'REVIVE'
  | 'GAME_OVER';

export interface CompactTelemetryEvent {
  t: TelemetryEventType;
  timeMs: number;
  dist: number;
  val?: number | string;
}

export interface AuthoritativeCompetitiveRun {
  submissionId: string;
  playerId: string;
  username: string;
  modeId: GameModeId;
  seasonId: string;
  score: number;
  distance: number;
  durationMs: number;
  worldReached: string;
  shardsCollected: number;
  nearMisses: number;
  obstaclesPassed: number;
  revivesUsed: number;
  submittedAt: number;
  events?: CompactTelemetryEvent[];
}

export interface SuspiciousFlag {
  code: string;
  message: string;
  severity: 'WARN' | 'CRITICAL';
}

export interface ScoreValidationResult {
  isValid: boolean;
  authoritativeScore: number;
  claimedScore: number;
  reason?: string;
  flags: SuspiciousFlag[];
}

export interface CurrencyTransaction {
  id: string;
  playerId: string;
  type: 'deposit_shards' | 'revive_fee' | 'reward_grant' | 'cosmetic_purchase';
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  timestamp: number;
  referenceId?: string;
}
