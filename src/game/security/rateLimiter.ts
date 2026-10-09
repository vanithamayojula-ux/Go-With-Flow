/**
 * GoWithFlow — API & Action Rate Limiter
 * Phase 17 Section 13-14: Sliding window rate limiting across endpoints to prevent request flooding,
 * brute-force attacks, submission spamming, and leaderboard manipulation.
 */

import { RateLimitedAction, RATE_LIMIT_POLICIES } from './securityConfig';

interface RateLimitRecord {
  timestamps: number[];
}

export class RateLimiter {
  private _records: Map<string, RateLimitRecord> = new Map();

  /**
   * Generates a composite key from action and subject identifier (IP, playerId, or session)
   */
  private makeKey(action: RateLimitedAction, identifier: string): string {
    return `${action}:${identifier}`;
  }

  /**
   * Check whether an action is permitted within its rate limit window.
   */
  public check(
    action: RateLimitedAction,
    identifier: string
  ): { allowed: boolean; remaining: number; retryAfterSeconds: number } {
    const policy = RATE_LIMIT_POLICIES[action] || { maxRequests: 30, windowMs: 60000 };
    const now = Date.now();
    const key = this.makeKey(action, identifier);

    let record = this._records.get(key);
    if (!record) {
      record = { timestamps: [] };
      this._records.set(key, record);
    }

    // Filter out timestamps outside the active window
    const windowStart = now - policy.windowMs;
    record.timestamps = record.timestamps.filter(ts => ts > windowStart);

    if (record.timestamps.length >= policy.maxRequests) {
      const oldestTimestamp = record.timestamps[0];
      const expiry = oldestTimestamp + policy.windowMs;
      const retryAfterSeconds = Math.max(1, Math.ceil((expiry - now) / 1000));

      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds,
      };
    }

    // Record this execution
    record.timestamps.push(now);
    const remaining = policy.maxRequests - record.timestamps.length;

    return {
      allowed: true,
      remaining,
      retryAfterSeconds: 0,
    };
  }

  /**
   * Reset rate limit state for a specific subject or all subjects (useful in tests/admin reset)
   */
  public reset(action?: RateLimitedAction, identifier?: string): void {
    if (action && identifier) {
      this._records.delete(this.makeKey(action, identifier));
    } else {
      this._records.clear();
    }
  }
}
