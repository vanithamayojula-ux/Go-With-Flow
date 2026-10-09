/**
 * GoWithFlow — Authentication & Session Management Service
 * Phase 17 Section 2: Secure session tokens, expiration, refresh, logout, revocation, and token redaction.
 */

import {
  AuthSession,
  UserRole,
  SECURITY_STORAGE_KEY_SESSIONS,
} from './securityConfig';

const DEFAULT_SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

export function redactToken(token?: string): string {
  if (!token) return '[NO_TOKEN]';
  if (token.length < 12) return '***';
  return `${token.substring(0, 7)}...${token.substring(token.length - 4)}`;
}

export class AuthService {
  private _sessions: Map<string, AuthSession> = new Map();

  constructor() {
    this.loadSessions();
  }

  private loadSessions(): void {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
    try {
      const raw = localStorage.getItem(SECURITY_STORAGE_KEY_SESSIONS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          parsed.forEach((s: AuthSession) => {
            if (s && s.sessionId && s.token) {
              this._sessions.set(s.token, s);
            }
          });
        }
      }
    } catch (err) {
      console.warn('[AuthService] Could not parse stored sessions:', err);
    }
  }

  private saveSessions(): void {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
    try {
      const arr = Array.from(this._sessions.values());
      localStorage.setItem(SECURITY_STORAGE_KEY_SESSIONS, JSON.stringify(arr));
    } catch (err) {
      console.error('[AuthService] Failed to persist sessions:', err);
    }
  }

  private getCryptoRandomHex(byteCount: number): string {
    if (typeof globalThis !== 'undefined' && globalThis.crypto && typeof globalThis.crypto.getRandomValues === 'function') {
      const bytes = new Uint8Array(byteCount);
      globalThis.crypto.getRandomValues(bytes);
      return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    }
    return Math.random().toString(36).substring(2, 12) + Math.random().toString(36).substring(2, 12);
  }

  private generateSecureToken(sessionId: string): string {
    const randomHex = this.getCryptoRandomHex(16);
    return `sk_sess_${sessionId.substring(0, 8)}_${randomHex}`;
  }

  /**
   * Create an authoritative session for a player with specified role.
   * Note: In this client architecture, sessions are stored locally in localStorage.
   * In a full cloud deployment, sessions would be issued and verified by a remote auth service.
   */
  public createSession(playerId: string, username: string, role: UserRole = 'player'): AuthSession {
    const sessionId = 'sid_' + Date.now().toString(36) + '_' + this.getCryptoRandomHex(4);
    const token = this.generateSecureToken(sessionId);
    const now = Date.now();

    const session: AuthSession = {
      sessionId,
      token,
      playerId,
      username,
      role,
      issuedAt: now,
      expiresAt: now + DEFAULT_SESSION_DURATION_MS,
      nonce: this.getCryptoRandomHex(8),
      isRevoked: false,
    };

    this._sessions.set(token, session);
    this.saveSessions();
    return session;
  }

  /**
   * Validate a session token. Returns null if expired, revoked, or non-existent.
   */
  public validateSession(token?: string): AuthSession | null {
    if (!token || typeof token !== 'string') {
      return null;
    }

    const session = this._sessions.get(token);
    if (!session) {
      return null;
    }

    if (session.isRevoked) {
      return null;
    }

    if (Date.now() > session.expiresAt) {
      return null;
    }

    return session;
  }

  /**
   * Refresh an active session, extending its expiration time and rolling the nonce.
   */
  public refreshSession(token: string): { success: boolean; session?: AuthSession; error?: string } {
    const session = this.validateSession(token);
    if (!session) {
      return { success: false, error: 'Session is invalid or expired' };
    }

    const now = Date.now();
    session.expiresAt = now + DEFAULT_SESSION_DURATION_MS;
    session.nonce = Math.random().toString(36).substring(2, 10);
    this.saveSessions();

    return { success: true, session };
  }

  /**
   * Revoke a specific session (Logout).
   */
  public revokeSession(token: string): boolean {
    const session = this._sessions.get(token);
    if (session) {
      session.isRevoked = true;
      this.saveSessions();
      return true;
    }
    return false;
  }

  /**
   * Invalidate all sessions associated with a specific playerId (e.g. on account reset or security lock).
   */
  public revokeAllSessionsForPlayer(playerId: string): number {
    let count = 0;
    this._sessions.forEach(session => {
      if (session.playerId === playerId && !session.isRevoked) {
        session.isRevoked = true;
        count++;
      }
    });
    if (count > 0) {
      this.saveSessions();
    }
    return count;
  }

  /**
   * Clear all active sessions (e.g. testing)
   */
  public clearAllSessions(): void {
    this._sessions.clear();
    this.saveSessions();
  }
}
