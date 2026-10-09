/**
 * GoWithFlow — Social & Competitive Architecture Types & Config
 * Phase 16: Profiles, Online Leaderboards, Challenges, Seasonal Operations, Anti-Cheat & Privacy
 */

import { GameModeId } from '../modes/gameModeTypes';

export const SOCIAL_STORAGE_KEY_PROFILE = 'skyflow_social_profile_v1';
export const SOCIAL_STORAGE_KEY_LEADERBOARD = 'skyflow_social_leaderboard_v1';
export const SOCIAL_STORAGE_KEY_CHALLENGES = 'skyflow_social_challenges_v1';
export const SOCIAL_VERSION = 1;

export const CURRENT_SEASON_ID = 'season_01_skybound';
export const CURRENT_SEASON_NAME = 'SEASON 01 // SKYBOUND';
export const CURRENT_SEASON_TAG = 'October 2026';

export type AccountType = 'guest' | 'cloud';

export interface PrivacySettings {
  showOnLeaderboards: boolean;
  allowFriendChallenges: boolean;
  publicProfile: boolean;
}

export interface PlayerProfile {
  id: string; // Unique pseudonymous uuid
  username: string;
  accountType: AccountType;
  title: string;
  avatarIcon: string;
  level: number;
  achievementsCount: number;
  worldsDiscovered: number;
  highestScore: number;
  longestDistance: number;
  bestTimeTrialSeconds: number;
  longestSurvivalSeconds: number;
  seasonId: string;
  privacy: PrivacySettings;
  createdAt: number;
  lastActiveAt: number;
  renameCooldownUntil: number;
}

export interface RunSubmission {
  submissionId: string;
  playerId: string;
  username: string;
  modeId: GameModeId;
  challengeId?: string;
  score: number;
  distance: number;
  durationMs: number;
  worldReached: string;
  shardsCollected: number;
  nearMisses: number;
  obstaclesPassed: number;
  revivesUsed: number;
  seasonId: string;
  timestamp: number;
  clientSignature?: string;
}

export interface ValidationResult {
  isValid: boolean;
  reason?: string;
  antiCheatFlags?: string[];
  sanitizedScore?: number;
}

export type LeaderboardCategory = 'score' | 'distance' | 'time' | 'survival';
export type LeaderboardTimeWindow = 'all-time' | 'weekly' | 'seasonal';

export interface LeaderboardEntry {
  rank: number;
  playerId: string;
  username: string;
  title?: string;
  avatarIcon?: string;
  modeId: GameModeId;
  score: number;
  distance: number;
  durationFormatted: string;
  worldReached: string;
  seasonId: string;
  timestamp: number;
  isCurrentPlayer?: boolean;
}

export interface FriendChallenge {
  id: string;
  challengerId: string;
  challengerName: string;
  targetPlayerId?: string; // Optional: If empty, shareable link challenge
  modeId: GameModeId;
  targetScore: number;
  targetDistance: number;
  worldReached: string;
  createdAt: number;
  expiresAt: number;
  status: 'pending' | 'accepted' | 'completed' | 'expired';
  claimed: boolean;
  rewardXp: number;
  winnerId?: string;
  challengerScore: number;
  opponentScore?: number;
}

export interface ShareCardData {
  appName: string;
  title: string;
  playerName: string;
  modeName: string;
  score: number;
  distance: number;
  worldReached: string;
  seasonName: string;
  timestamp: number;
  shareUrl: string;
}

export interface SeasonalTierReward {
  tierName: string;
  topPercentile: number;
  rewardBadge: string;
  rewardCosmeticId: string;
  rewardXp: number;
}

export const SEASONAL_REWARDS: SeasonalTierReward[] = [
  {
    tierName: 'Skybound Apex (Top 1%)',
    topPercentile: 1,
    rewardBadge: 'badge:apex-sky-runner',
    rewardCosmeticId: 'player_master_pilot',
    rewardXp: 2500,
  },
  {
    tierName: 'Skybound Elite (Top 5%)',
    topPercentile: 5,
    rewardBadge: 'badge:skybound-elite',
    rewardCosmeticId: 'trail_plasma_rainbow',
    rewardXp: 1500,
  },
  {
    tierName: 'Skybound Vanguard (Top 25%)',
    topPercentile: 25,
    rewardBadge: 'badge:skybound-vanguard',
    rewardCosmeticId: 'theme_violet_void',
    rewardXp: 800,
  },
];
