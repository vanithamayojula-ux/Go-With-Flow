/**
 * GoWithFlow — Live Operations Configuration & Types
 * Phase 18: Seasonal events, rotating challenges, limited-time cosmetics, announcements, and snapshot schemas.
 */

import { WorldId } from '../worlds';
import { GameModeId } from '../modes/gameModeTypes';

export const LIVEOPS_STORAGE_KEY_CACHE = 'skyflow_liveops_cache_v1';
export const LIVEOPS_STORAGE_KEY_PROGRESS = 'skyflow_liveops_progress_v1';
export const LIVEOPS_STORAGE_KEY_ANNOUNCEMENTS = 'skyflow_liveops_announcements_v1';
export const LIVEOPS_SCHEMA_VERSION = 1;

export type SeasonStatus = 'upcoming' | 'active' | 'ending' | 'ended' | 'archived';

export interface SeasonTheme {
  name: string;
  tagline: string;
  focusWorld: WorldId;
  primaryColor: string;
  accentColor: string;
  icon: string;
}

export interface Season {
  id: string;
  number: number;
  name: string;
  theme: SeasonTheme;
  startsAt: number;
  endsAt: number;
  status: SeasonStatus;
  leaderboardIds: string[];
  challengeIds: string[];
  rewardIds: string[];
}

export type EventModifierType =
  | 'DOUBLE_XP'
  | 'SCORE_BOOST'
  | 'SHARD_RUSH'
  | 'WORLD_AFFINITY_BOOST';

export interface EventModifier {
  type: EventModifierType;
  multiplier: number;
  targetWorld?: WorldId;
  targetMode?: GameModeId;
  description: string;
}

export interface LiveEvent {
  id: string;
  name: string;
  tagline: string;
  description: string;
  icon: string;
  startsAt: number;
  endsAt: number;
  isActive: boolean;
  isArchiveEvent?: boolean;
  modifiers: EventModifier[];
  featuredCosmeticId?: string;
  rewardBadge?: string;
}

export type ChallengeCadence = 'daily' | 'weekly' | 'seasonal';

export interface RotatingChallenge {
  id: string;
  cadence: ChallengeCadence;
  title: string;
  description: string;
  icon: string;
  targetMetric: 'distance' | 'score' | 'shards' | 'near_misses' | 'world_reach' | 'survival_seconds';
  targetValue: number;
  currentValue: number;
  completed: boolean;
  claimed: boolean;
  startsAt: number;
  expiresAt: number;
  rewardXp: number;
  rewardShards: number;
  rewardCosmeticId?: string;
  targetWorld?: WorldId;
  targetMode?: GameModeId;
}

export type AnnouncementPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface Announcement {
  id: string;
  title: string;
  body: string;
  priority: AnnouncementPriority;
  icon?: string;
  startsAt: number;
  expiresAt: number;
  isDismissed?: boolean;
}

export interface SeasonPassTier {
  tier: number;
  requiredXp: number;
  rewardType: 'xp' | 'shards' | 'cosmetic' | 'badge';
  rewardValue: number | string;
  rewardLabel: string;
  rewardIcon: string;
  isUnlocked: boolean;
  isClaimed: boolean;
}

export interface LiveOpsSnapshot {
  version: number;
  publishedAt: number;
  effectiveAt: number;
  expiresAt: number;
  serverTimestamp: number;
  activeSeason: Season;
  upcomingSeason?: Season;
  activeEvents: LiveEvent[];
  dailyChallenge: RotatingChallenge;
  weeklyChallenge: RotatingChallenge;
  seasonPassTiers: SeasonPassTier[];
  announcements: Announcement[];
}

export interface SeasonalStatistics {
  seasonId: string;
  highestScore: number;
  longestDistance: number;
  challengesCompleted: number;
  totalChallengesAvailable: number;
  worldsVisitedCount: number;
  seasonRank: number;
  totalSeasonParticipants: number;
  seasonalXpEarned: number;
}
