/**
 * GoWithFlow — Authorization & Least-Privilege Guard
 * Phase 17 Section 3: Role-based access control, ownership verification, and safe error masking.
 */

import { AuthSession, SecurityPermission, ROLE_PERMISSIONS } from './securityConfig';

export interface AuthorizationResult {
  authorized: boolean;
  error?: string;
}

export class AuthorizationGuard {
  /**
   * Validates whether a session has a given permission.
   */
  public static hasPermission(session: AuthSession | null, permission: SecurityPermission): boolean {
    if (!session || session.isRevoked || Date.now() > session.expiresAt) {
      return false;
    }
    const permissions = ROLE_PERMISSIONS[session.role] || [];
    return permissions.includes(permission);
  }

  /**
   * Validates whether the caller has rights to modify a profile.
   * Player can only edit their own profile; admins can edit any profile.
   */
  public static canModifyProfile(session: AuthSession | null, targetPlayerId: string): AuthorizationResult {
    if (!session) {
      return { authorized: false, error: 'Unauthorized: Valid session required.' };
    }
    if (session.role === 'admin') {
      return { authorized: true };
    }
    if (session.playerId !== targetPlayerId) {
      return { authorized: false, error: 'Forbidden: Cannot modify another player\'s profile.' };
    }
    return { authorized: true };
  }

  /**
   * Validates whether the caller can submit a run for a given playerId.
   * Strictly limited to the authenticated player owning the run.
   */
  public static canSubmitRun(session: AuthSession | null, submissionPlayerId: string): AuthorizationResult {
    if (!session) {
      return { authorized: false, error: 'Unauthorized: Valid session required for competitive submission.' };
    }
    if (session.playerId !== submissionPlayerId) {
      return { authorized: false, error: 'Forbidden: Cannot submit scores on behalf of another player.' };
    }
    return { authorized: true };
  }

  /**
   * Validates whether the caller can claim a reward.
   */
  public static canClaimReward(session: AuthSession | null, targetPlayerId: string): AuthorizationResult {
    if (!session) {
      return { authorized: false, error: 'Unauthorized: Valid session required to claim rewards.' };
    }
    if (session.playerId !== targetPlayerId) {
      return { authorized: false, error: 'Forbidden: Cannot claim rewards for another player.' };
    }
    return { authorized: true };
  }

  /**
   * Validates whether the caller has moderation or administration privileges.
   */
  public static canModerate(session: AuthSession | null): AuthorizationResult {
    if (!session) {
      return { authorized: false, error: 'Unauthorized: Authentication required.' };
    }
    if (session.role !== 'moderator' && session.role !== 'admin') {
      return { authorized: false, error: 'Forbidden: Administrative privileges required.' };
    }
    return { authorized: true };
  }

  /**
   * Validates whether the caller has administrator privileges.
   */
  public static canAdminister(session: AuthSession | null): AuthorizationResult {
    if (!session) {
      return { authorized: false, error: 'Unauthorized: Authentication required.' };
    }
    if (session.role !== 'admin') {
      return { authorized: false, error: 'Forbidden: Administrator role required.' };
    }
    return { authorized: true };
  }
}
