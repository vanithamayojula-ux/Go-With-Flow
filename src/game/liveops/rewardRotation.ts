/**
 * GoWithFlow — Seasonal Cosmetics & Reward Track Rotation
 * Phase 18 Section 10-13: Mini Season Pass (5 tiers), permanent cosmetic ownership,
 * and returning archive content.
 */

import { SeasonPassTier } from './liveOpsConfig';

export const CURATED_SEASON_PASS_TIERS: SeasonPassTier[] = [
  {
    tier: 1,
    requiredXp: 1000,
    rewardType: 'shards',
    rewardValue: 200,
    rewardLabel: '200 Neon Shards',
    rewardIcon: '💎',
    isUnlocked: false,
    isClaimed: false,
  },
  {
    tier: 2,
    requiredXp: 2500,
    rewardType: 'badge',
    rewardValue: 'badge:skybound-vanguard',
    rewardLabel: 'Sky Vanguard Emblem',
    rewardIcon: '🎖️',
    isUnlocked: false,
    isClaimed: false,
  },
  {
    tier: 3,
    requiredXp: 5000,
    rewardType: 'cosmetic',
    rewardValue: 'trail_sky_breeze',
    rewardLabel: 'Sky Isles Breeze Trail',
    rewardIcon: '☁️',
    isUnlocked: false,
    isClaimed: false,
  },
  {
    tier: 4,
    requiredXp: 8500,
    rewardType: 'cosmetic',
    rewardValue: 'theme_violet_void',
    rewardLabel: 'Violet Void HUD Theme',
    rewardIcon: '🌌',
    isUnlocked: false,
    isClaimed: false,
  },
  {
    tier: 5,
    requiredXp: 13000,
    rewardType: 'cosmetic',
    rewardValue: 'player_master_pilot',
    rewardLabel: 'Master Pilot Golden Frame',
    rewardIcon: '👑',
    isUnlocked: false,
    isClaimed: false,
  },
];

/**
 * Evaluates unlock status for season pass tiers based on current season XP
 */
export function evaluateSeasonPassTiers(
  tiers: SeasonPassTier[],
  seasonalXp: number,
  claimedTierKeys: Set<number>
): SeasonPassTier[] {
  return tiers.map(tier => ({
    ...tier,
    isUnlocked: seasonalXp >= tier.requiredXp,
    isClaimed: claimedTierKeys.has(tier.tier),
  }));
}
