/**
 * GoWithFlow — Privacy & Account Lifecycle Service
 * Phase 17 Section 16-18: Privacy enforcement, data minimization, and safe account deletion workflow.
 */

import { AuthSession } from './securityConfig';
import { AuthService } from './authService';
import { SecurityAuditLogger } from './securityAuditLogger';
import { AuthorizationGuard } from './authorizationGuard';
import { ProfileService } from '../social/playerProfile';
import { LeaderboardService } from '../social/leaderboardService';
import { ChallengeService } from '../social/challengeService';

export class AccountLifecycleService {
  private _authService: AuthService;
  private _auditLogger: SecurityAuditLogger;

  constructor(authService: AuthService, auditLogger: SecurityAuditLogger) {
    this._authService = authService;
    this._auditLogger = auditLogger;
  }

  /**
   * Safe Account Deletion Workflow
   * Purges personal identity, revokes all sessions, anonymizes leaderboard rankings,
   * cancels pending challenges, and logs an immutable audit event.
   */
  public deleteAccount(
    session: AuthSession | null,
    targetPlayerId: string,
    profileService: ProfileService,
    leaderboardService?: LeaderboardService,
    challengeService?: ChallengeService
  ): { success: boolean; error?: string } {
    // 1. Authorization Gate (Self or Admin only)
    if (!session) {
      return { success: false, error: 'Unauthorized: Valid session required.' };
    }

    const isSelf = session.playerId === targetPlayerId;
    const isAdmin = AuthorizationGuard.canAdminister(session).authorized;

    if (!isSelf && !isAdmin) {
      return { success: false, error: 'Forbidden: Cannot delete another player\'s account.' };
    }

    // 2. Revoke all active sessions for player
    this._authService.revokeAllSessionsForPlayer(targetPlayerId);

    // 3. Anonymize/Clear profile identity
    const profile = profileService.getProfile();
    if (profile.id === targetPlayerId) {
      profileService.updatePrivacy({
        showOnLeaderboards: false,
        allowFriendChallenges: false,
        publicProfile: false,
      });
      profileService.saveProfile({
        ...profile,
        username: '[Deleted Pilot]',
        title: 'Unknown',
        highestScore: 0,
        longestDistance: 0,
        privacy: {
          showOnLeaderboards: false,
          allowFriendChallenges: false,
          publicProfile: false,
        },
      });
    }

    // 4. Remove from Leaderboards if accessible
    if (typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem('skyflow_social_leaderboard_v1');
        if (raw) {
          const entries = JSON.parse(raw);
          if (Array.isArray(entries)) {
            const filtered = entries.filter((e: { playerId: string }) => e.playerId !== targetPlayerId);
            localStorage.setItem('skyflow_social_leaderboard_v1', JSON.stringify(filtered));
          }
        }
      } catch {
        // Handled defensively
      }
    }

    // 5. Cancel active challenges created by this player
    if (challengeService) {
      const active = challengeService.getActiveChallenges();
      active.forEach(c => {
        if (c.challengerId === targetPlayerId) {
          c.status = 'expired';
        }
      });
    }

    // 6. Record Audit Log
    this._auditLogger.log('INFO', 'ACCOUNT_DELETED', {
      actorId: session.playerId,
      actorRole: session.role,
      targetId: targetPlayerId,
      reason: isSelf ? 'User requested account deletion' : 'Admin requested account deletion',
    });

    return { success: true };
  }
}
