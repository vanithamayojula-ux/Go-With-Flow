/**
 * GoWithFlow — Campaign Mode Types & Interfaces
 * 5-World Campaign Architecture: Objectives, Sector Progression, Stars, and Persistence.
 */

import { WorldId } from '../WorldConfig';
import { PlayerStats } from '../../types';

export type CampaignWorldId = WorldId;

export type ObjectiveType =
  | 'distance'
  | 'shards'
  | 'near-misses'
  | 'overdrive'
  | 'combo'
  | 'no-revive';

export interface WorldObjective {
  id: string;
  label: string;
  description: string;
  target: number;
  type: ObjectiveType;
  rewardShards: number;
}

export interface WorldCampaignConfig {
  worldId: CampaignWorldId;
  sectorIndex: number; // 1 to 5
  name: string;
  subtitle: string;
  startDistance: number;
  targetDistance: number;
  length: number;
  speedMultiplier: number;
  obstacleGapMultiplier: number;
  primaryObjective: WorldObjective;
  secondaryObjective: WorldObjective;
  bonusObjective: WorldObjective;
  completionBonusShards: number;
  completionBonusXp: number;
}

export interface CampaignSaveData {
  version: number;
  highestSectorUnlocked: number; // 1 to 5
  completedSectors: Record<string, boolean>; // e.g. 'sky-isles': true
  sectorStars: Record<string, number>; // e.g. 'sky-isles': 3
  objectivesCompleted: Record<string, boolean>; // objectiveId -> boolean
  campaignCompleted: boolean;
  campaignHighScore: number;
  campaignBestTimeSeconds: number;
  campaignRunCount: number;
  lastPlayedTimestamp: number;
}

export interface SectorCompletionResult {
  worldId: CampaignWorldId;
  sectorIndex: number;
  isNewUnlock: boolean;
  starsEarned: number;
  shardsAwarded: number;
  xpAwarded: number;
  isCampaignComplete: boolean;
  objectivesAchieved: string[];
}
