/**
 * GoWithFlow — Friend & Player Challenge Service
 * Phase 16 Section 14-15: Asynchronous friend challenges, target matching, and reward resolution.
 */

import {
  FriendChallenge,
  SOCIAL_STORAGE_KEY_CHALLENGES,
} from './socialConfig';
import { GameModeId } from '../modes/gameModeTypes';
import { ProgressionManager } from '../progression';
import { StorageSanitizer } from '../security/storageSanitizer';

const SEED_FRIEND_CHALLENGES: FriendChallenge[] = [
  {
    id: 'fchal_seed_01',
    challengerId: 'usr_top_03',
    challengerName: 'Kitsune_Flow',
    modeId: 'score-attack',
    targetScore: 48500,
    targetDistance: 5200,
    worldReached: 'Crimson Dunes',
    createdAt: Date.now() - 3600000 * 5,
    expiresAt: Date.now() + 3600000 * 43,
    status: 'pending',
    claimed: false,
    rewardXp: 350,
    challengerScore: 48500,
  },
  {
    id: 'fchal_seed_02',
    challengerId: 'usr_top_04',
    challengerName: 'CyberPulse',
    modeId: 'standard-run',
    targetScore: 35000,
    targetDistance: 4000,
    worldReached: 'Verdant Wilds',
    createdAt: Date.now() - 3600000 * 12,
    expiresAt: Date.now() + 3600000 * 36,
    status: 'pending',
    claimed: false,
    rewardXp: 250,
    challengerScore: 35000,
  },
];

export class ChallengeService {
  private _challenges: FriendChallenge[] = [];

  constructor() {
    this._challenges = this.loadChallenges();
  }

  private loadChallenges(): FriendChallenge[] {
    const parsed = StorageSanitizer.safeGetItem<FriendChallenge[] | null>(SOCIAL_STORAGE_KEY_CHALLENGES, null);
    if (parsed && Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    this.saveChallenges(SEED_FRIEND_CHALLENGES);
    return [...SEED_FRIEND_CHALLENGES];
  }

  private saveChallenges(list: FriendChallenge[]): void {
    StorageSanitizer.safeSetItem(SOCIAL_STORAGE_KEY_CHALLENGES, list);
    this._challenges = list;
  }

  public getActiveChallenges(): FriendChallenge[] {
    const now = Date.now();
    // Prune or mark expired challenges
    this._challenges.forEach(c => {
      if (c.status === 'pending' && c.expiresAt < now) {
        c.status = 'expired';
      }
    });
    this.saveChallenges(this._challenges);
    return this._challenges.filter(c => c.status !== 'expired' || !c.claimed);
  }

  /**
   * Create an asynchronous challenge from a completed run
   */
  public createChallenge(
    challengerId: string,
    challengerName: string,
    modeId: GameModeId,
    score: number,
    distance: number,
    worldReached: string,
    durationHours: number = 48
  ): FriendChallenge {
    const newChallenge: FriendChallenge = {
      id: `fchal_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`,
      challengerId,
      challengerName,
      modeId,
      targetScore: score,
      targetDistance: distance,
      worldReached,
      createdAt: Date.now(),
      expiresAt: Date.now() + durationHours * 3600 * 1000,
      status: 'pending',
      claimed: false,
      rewardXp: 300,
      challengerScore: score,
    };

    this._challenges.unshift(newChallenge);
    this.saveChallenges(this._challenges);
    return newChallenge;
  }

  /**
   * Resolve an active challenge with an opponent's score.
   */
  public evaluateOpponentRun(
    challengeId: string,
    opponentScore: number,
    opponentId: string,
    progressionMgr?: ProgressionManager
  ): { isWon: boolean; challenge?: FriendChallenge; xpAwarded: number } {
    const challenge = this._challenges.find(c => c.id === challengeId);
    if (!challenge) {
      return { isWon: false, xpAwarded: 0 };
    }

    challenge.opponentScore = opponentScore;
    const isWon = opponentScore > challenge.targetScore;

    if (isWon) {
      challenge.status = 'completed';
      challenge.winnerId = opponentId;

      // Idempotent progression reward
      if (!challenge.claimed && progressionMgr) {
        challenge.claimed = true;
        progressionMgr.addXp(challenge.rewardXp, `Friend Challenge Victory: ${challenge.challengerName}`);
        this.saveChallenges(this._challenges);
        return { isWon: true, challenge, xpAwarded: challenge.rewardXp };
      }
    }

    this.saveChallenges(this._challenges);
    return { isWon, challenge, xpAwarded: 0 };
  }
}
