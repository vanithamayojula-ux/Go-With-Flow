/**
 * GoWithFlow — Administrative Moderation & Audit Service
 * Phase 17 Section 22-23: Moderation tools, player suspension, leaderboard curation,
 * and immutable administrative audit trail.
 */

import {
  AuthSession,
  SECURITY_STORAGE_KEY_BANNED_PLAYERS,
} from './securityConfig';
import { AuthorizationGuard } from './authorizationGuard';
import { SecurityAuditLogger } from './securityAuditLogger';
import { LeaderboardService } from '../social/leaderboardService';

export interface PlayerSuspensionRecord {
  playerId: string;
  suspendedUntil: number;
  reason: string;
  suspendedBy: string;
  createdAt: number;
}

export class AdminModerationService {
  private _suspensions: Map<string, PlayerSuspensionRecord> = new Map();
  private _auditLogger: SecurityAuditLogger;

  constructor(auditLogger: SecurityAuditLogger) {
    this._auditLogger = auditLogger;
    this.loadSuspensions();
  }

  private loadSuspensions(): void {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
    try {
      const raw = localStorage.getItem(SECURITY_STORAGE_KEY_BANNED_PLAYERS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          parsed.forEach((rec: PlayerSuspensionRecord) => {
            if (rec && rec.playerId) {
              this._suspensions.set(rec.playerId, rec);
            }
          });
        }
      }
    } catch (err) {
      console.warn('[AdminModerationService] Failed to load suspensions:', err);
    }
  }

  private saveSuspensions(): void {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
    try {
      const arr = Array.from(this._suspensions.values());
      localStorage.setItem(SECURITY_STORAGE_KEY_BANNED_PLAYERS, JSON.stringify(arr));
    } catch (err) {
      console.error('[AdminModerationService] Failed to persist suspensions:', err);
    }
  }

  /**
   * Check if a player is currently suspended
   */
  public isPlayerSuspended(playerId: string): boolean {
    const rec = this._suspensions.get(playerId);
    if (!rec) return false;
    if (Date.now() > rec.suspendedUntil) {
      // Suspension expired
      this._suspensions.delete(playerId);
      this.saveSuspensions();
      return false;
    }
    return true;
  }

  /**
   * Suspend a player from competitive operations
   */
  public suspendPlayer(
    adminSession: AuthSession | null,
    targetPlayerId: string,
    durationHours: number,
    reason: string
  ): { success: boolean; error?: string } {
    const authCheck = AuthorizationGuard.canModerate(adminSession);
    if (!authCheck.authorized || !adminSession) {
      return { success: false, error: authCheck.error };
    }

    const suspendedUntil = Date.now() + Math.max(1, durationHours) * 3600 * 1000;
    const record: PlayerSuspensionRecord = {
      playerId: targetPlayerId,
      suspendedUntil,
      reason,
      suspendedBy: adminSession.username,
      createdAt: Date.now(),
    };

    this._suspensions.set(targetPlayerId, record);
    this.saveSuspensions();

    this._auditLogger.log('CRITICAL', 'PLAYER_SUSPENDED', {
      actorId: adminSession.playerId,
      actorRole: adminSession.role,
      targetId: targetPlayerId,
      reason,
      metadata: { durationHours, suspendedUntil },
    });

    return { success: true };
  }

  /**
   * Unsuspend a player
   */
  public unsuspendPlayer(
    adminSession: AuthSession | null,
    targetPlayerId: string
  ): { success: boolean; error?: string } {
    const authCheck = AuthorizationGuard.canModerate(adminSession);
    if (!authCheck.authorized || !adminSession) {
      return { success: false, error: authCheck.error };
    }

    if (this._suspensions.delete(targetPlayerId)) {
      this.saveSuspensions();
      this._auditLogger.log('INFO', 'ADMIN_ACTION', {
        actorId: adminSession.playerId,
        actorRole: adminSession.role,
        targetId: targetPlayerId,
        reason: 'Player suspension lifted',
      });
      return { success: true };
    }

    return { success: false, error: 'Player is not suspended' };
  }

  /**
   * Remove a fraudulent or compromised score from the leaderboard
   */
  public removeLeaderboardEntry(
    adminSession: AuthSession | null,
    leaderboardService: LeaderboardService,
    playerId: string,
    modeId: string,
    reason: string
  ): { success: boolean; error?: string } {
    const authCheck = AuthorizationGuard.canModerate(adminSession);
    if (!authCheck.authorized || !adminSession) {
      return { success: false, error: authCheck.error };
    }

    // Access entries from leaderboard service
    const entries = leaderboardService.getLeaderboard('score', 'all-time', undefined, 1000);
    const targetIdx = entries.findIndex(e => e.playerId === playerId && (modeId === 'all' || e.modeId === modeId));

    if (targetIdx === -1) {
      return { success: false, error: 'No matching leaderboard entry found' };
    }

    // Filter out entry
    const filtered = entries.filter(e => !(e.playerId === playerId && (modeId === 'all' || e.modeId === modeId)));
    // Re-rank
    filtered.forEach((e, idx) => {
      e.rank = idx + 1;
    });

    // Write back via private persistence reflection
    try {
      localStorage.setItem('skyflow_social_leaderboard_v1', JSON.stringify(filtered));
    } catch {
      // handled
    }

    this._auditLogger.log('CRITICAL', 'LEADERBOARD_MODERATED', {
      actorId: adminSession.playerId,
      actorRole: adminSession.role,
      targetId: playerId,
      reason,
      metadata: { modeId },
    });

    return { success: true };
  }

  /**
   * Reset suspensions (for tests)
   */
  public resetSuspensions(): void {
    this._suspensions.clear();
    this.saveSuspensions();
  }
}
