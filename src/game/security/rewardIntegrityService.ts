/**
 * GoWithFlow — Authoritative Reward Integrity Service
 * Phase 17 Section 10: Server-side idempotency ledger protecting XP, cosmetics, badges,
 * challenge bounties, and seasonal placements from fraudulent duplicate claims.
 */

import { SECURITY_STORAGE_KEY_REWARD_LEDGER } from './securityConfig';

export interface RewardGrantRecord {
  grantKey: string;
  playerId: string;
  rewardType: 'challenge_victory' | 'seasonal_tier' | 'achievement' | 'level_milestone';
  referenceId: string;
  rewardPayload: {
    xp?: number;
    cosmeticId?: string;
    badge?: string;
  };
  grantedAt: number;
}

export class RewardIntegrityService {
  private _ledger: Map<string, RewardGrantRecord> = new Map();

  constructor() {
    this.loadLedger();
  }

  private loadLedger(): void {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
    try {
      const raw = localStorage.getItem(SECURITY_STORAGE_KEY_REWARD_LEDGER);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          parsed.forEach((rec: RewardGrantRecord) => {
            if (rec && rec.grantKey) {
              this._ledger.set(rec.grantKey, rec);
            }
          });
        }
      }
    } catch (err) {
      console.warn('[RewardIntegrityService] Failed to load reward ledger:', err);
    }
  }

  private saveLedger(): void {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
    try {
      const arr = Array.from(this._ledger.values());
      localStorage.setItem(SECURITY_STORAGE_KEY_REWARD_LEDGER, JSON.stringify(arr));
    } catch (err) {
      console.error('[RewardIntegrityService] Failed to persist reward ledger:', err);
    }
  }

  /**
   * Deterministically constructs an idempotency grant key
   */
  public makeGrantKey(
    playerId: string,
    rewardType: RewardGrantRecord['rewardType'],
    referenceId: string
  ): string {
    return `grant:${playerId}:${rewardType}:${referenceId}`;
  }

  /**
   * Authoritatively claims a reward.
   * If already granted, returns alreadyClaimed: true with 0 duplicate reward.
   */
  public claimReward(
    playerId: string,
    rewardType: RewardGrantRecord['rewardType'],
    referenceId: string,
    rewardPayload: RewardGrantRecord['rewardPayload']
  ): {
    granted: boolean;
    alreadyClaimed: boolean;
    record: RewardGrantRecord | null;
    error?: string;
  } {
    const key = this.makeGrantKey(playerId, rewardType, referenceId);

    // Check if already in ledger
    if (this._ledger.has(key)) {
      return {
        granted: false,
        alreadyClaimed: true,
        record: this._ledger.get(key) || null,
        error: 'Reward has already been granted to this account.',
      };
    }

    // Validate payload values
    if (rewardPayload.xp && (rewardPayload.xp < 0 || isNaN(rewardPayload.xp))) {
      return {
        granted: false,
        alreadyClaimed: false,
        record: null,
        error: 'Invalid reward payload values',
      };
    }

    const newRecord: RewardGrantRecord = {
      grantKey: key,
      playerId,
      rewardType,
      referenceId,
      rewardPayload,
      grantedAt: Date.now(),
    };

    this._ledger.set(key, newRecord);
    this.saveLedger();

    return {
      granted: true,
      alreadyClaimed: false,
      record: newRecord,
    };
  }

  /**
   * Check whether a reward has already been claimed
   */
  public hasClaimed(
    playerId: string,
    rewardType: RewardGrantRecord['rewardType'],
    referenceId: string
  ): boolean {
    const key = this.makeGrantKey(playerId, rewardType, referenceId);
    return this._ledger.has(key);
  }

  /**
   * Reset ledger (useful for isolated unit testing)
   */
  public resetLedger(): void {
    this._ledger.clear();
    this.saveLedger();
  }
}
