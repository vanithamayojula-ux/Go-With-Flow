/**
 * GoWithFlow — Campaign Mode Configurations & Objective Catalog
 * 5-World Campaign Progression: Sky Isles -> Verdant Wilds -> Crimson Dunes -> Crystal Heights -> Obsidian Core
 */

import { CampaignWorldId, WorldCampaignConfig, CampaignSaveData } from './campaignTypes';
import { WORLD_LENGTH_DISTANCE } from '../WorldConfig';

export const CAMPAIGN_STORAGE_KEY = 'skyflow_campaign_save_v1';
export const CAMPAIGN_VERSION = 1;

export const CAMPAIGN_TOTAL_DISTANCE = WORLD_LENGTH_DISTANCE * 5; // 11,250m

export const WORLD_CAMPAIGN_CONFIGS: Record<CampaignWorldId, WorldCampaignConfig> = {
  'sky-isles': {
    worldId: 'sky-isles',
    sectorIndex: 1,
    name: 'Sky Isles',
    subtitle: 'Ascension & Aerodynamics',
    startDistance: 0,
    targetDistance: WORLD_LENGTH_DISTANCE, // 2,250m
    length: WORLD_LENGTH_DISTANCE,
    speedMultiplier: 1.0,
    obstacleGapMultiplier: 1.0,
    primaryObjective: {
      id: 'obj_sky_dist',
      label: 'Traverse Sky Isles',
      description: 'Reach Sector 2 gateway at 2,250m',
      target: 2250,
      type: 'distance',
      rewardShards: 50,
    },
    secondaryObjective: {
      id: 'obj_sky_shards',
      label: 'Energy Harvester',
      description: 'Collect 20 data shards in Sky Isles',
      target: 20,
      type: 'shards',
      rewardShards: 30,
    },
    bonusObjective: {
      id: 'obj_sky_no_revive',
      label: 'Clean Flight',
      description: 'Clear Sector 1 without using emergency reboot',
      target: 1,
      type: 'no-revive',
      rewardShards: 40,
    },
    completionBonusShards: 100,
    completionBonusXp: 200,
  },

  'verdant-wilds': {
    worldId: 'verdant-wilds',
    sectorIndex: 2,
    name: 'Verdant Wilds',
    subtitle: 'Canopy Labyrinth & Bioluminescence',
    startDistance: WORLD_LENGTH_DISTANCE, // 2,250m
    targetDistance: WORLD_LENGTH_DISTANCE * 2, // 4,500m
    length: WORLD_LENGTH_DISTANCE,
    speedMultiplier: 1.12,
    obstacleGapMultiplier: 0.95,
    primaryObjective: {
      id: 'obj_verdant_dist',
      label: 'Navigate the Canopy',
      description: 'Reach Sector 3 gateway at 4,500m',
      target: 4500,
      type: 'distance',
      rewardShards: 75,
    },
    secondaryObjective: {
      id: 'obj_verdant_near_miss',
      label: 'Brush the Canopy',
      description: 'Execute 4 near-misses with hazards',
      target: 4,
      type: 'near-misses',
      rewardShards: 45,
    },
    bonusObjective: {
      id: 'obj_verdant_overdrive',
      label: 'Bioluminescent Flow',
      description: 'Charge Overdrive meter to 100%',
      target: 100,
      type: 'overdrive',
      rewardShards: 50,
    },
    completionBonusShards: 150,
    completionBonusXp: 300,
  },

  'crimson-dunes': {
    worldId: 'crimson-dunes',
    sectorIndex: 3,
    name: 'Crimson Dunes',
    subtitle: 'Solar Heat & Sandstorm Gusts',
    startDistance: WORLD_LENGTH_DISTANCE * 2, // 4,500m
    targetDistance: WORLD_LENGTH_DISTANCE * 3, // 6,750m
    length: WORLD_LENGTH_DISTANCE,
    speedMultiplier: 1.25,
    obstacleGapMultiplier: 0.90,
    primaryObjective: {
      id: 'obj_crimson_dist',
      label: 'Cross the Great Dunes',
      description: 'Reach Sector 4 gateway at 6,750m',
      target: 6750,
      type: 'distance',
      rewardShards: 100,
    },
    secondaryObjective: {
      id: 'obj_crimson_shards',
      label: 'Sunken Relic Recovery',
      description: 'Collect 40 data shards in total',
      target: 40,
      type: 'shards',
      rewardShards: 60,
    },
    bonusObjective: {
      id: 'obj_crimson_combo',
      label: 'Desert Velocity',
      description: 'Achieve a 4x trick combo or higher',
      target: 4,
      type: 'combo',
      rewardShards: 70,
    },
    completionBonusShards: 200,
    completionBonusXp: 450,
  },

  'crystal-heights': {
    worldId: 'crystal-heights',
    sectorIndex: 4,
    name: 'Crystal Heights',
    subtitle: 'Glacial Spires & Aurora Drift',
    startDistance: WORLD_LENGTH_DISTANCE * 3, // 6,750m
    targetDistance: WORLD_LENGTH_DISTANCE * 4, // 9,000m
    length: WORLD_LENGTH_DISTANCE,
    speedMultiplier: 1.40,
    obstacleGapMultiplier: 0.85,
    primaryObjective: {
      id: 'obj_crystal_dist',
      label: 'Ascend the Glacial Peak',
      description: 'Reach Sector 5 gateway at 9,000m',
      target: 9000,
      type: 'distance',
      rewardShards: 125,
    },
    secondaryObjective: {
      id: 'obj_crystal_near_miss',
      label: 'Needle Threader',
      description: 'Perform 8 near-misses with crystal hazards',
      target: 8,
      type: 'near-misses',
      rewardShards: 75,
    },
    bonusObjective: {
      id: 'obj_crystal_no_revive',
      label: 'Pure Cold Focus',
      description: 'Pass Sector 4 with no neural desyncs',
      target: 1,
      type: 'no-revive',
      rewardShards: 80,
    },
    completionBonusShards: 250,
    completionBonusXp: 600,
  },

  'obsidian-core': {
    worldId: 'obsidian-core',
    sectorIndex: 5,
    name: 'Obsidian Core',
    subtitle: 'The Magma Crucible & Final Threshold',
    startDistance: WORLD_LENGTH_DISTANCE * 4, // 9,000m
    targetDistance: CAMPAIGN_TOTAL_DISTANCE, // 11,250m
    length: WORLD_LENGTH_DISTANCE,
    speedMultiplier: 1.55,
    obstacleGapMultiplier: 0.80,
    primaryObjective: {
      id: 'obj_obsidian_dist',
      label: 'Conquer the Obsidian Core',
      description: 'Reach the Core Extraction Gate at 11,250m',
      target: 11250,
      type: 'distance',
      rewardShards: 200,
    },
    secondaryObjective: {
      id: 'obj_obsidian_shards',
      label: 'Core Shard Resonance',
      description: 'Gather 60 cumulative data shards',
      target: 60,
      type: 'shards',
      rewardShards: 100,
    },
    bonusObjective: {
      id: 'obj_obsidian_overdrive',
      label: 'Maximum Overdrive',
      description: 'Trigger Max-Velocity Overdrive tier',
      target: 1,
      type: 'overdrive',
      rewardShards: 150,
    },
    completionBonusShards: 500,
    completionBonusXp: 1000,
  },
};

export const CAMPAIGN_WORLD_ORDER: CampaignWorldId[] = [
  'sky-isles',
  'verdant-wilds',
  'crimson-dunes',
  'crystal-heights',
  'obsidian-core',
];

export function createDefaultCampaignSaveData(): CampaignSaveData {
  return {
    version: CAMPAIGN_VERSION,
    highestSectorUnlocked: 1, // Sky Isles unlocked by default
    completedSectors: {},
    sectorStars: {
      'sky-isles': 0,
      'verdant-wilds': 0,
      'crimson-dunes': 0,
      'crystal-heights': 0,
      'obsidian-core': 0,
    },
    objectivesCompleted: {},
    campaignCompleted: false,
    campaignHighScore: 0,
    campaignBestTimeSeconds: 0,
    campaignRunCount: 0,
    lastPlayedTimestamp: Date.now(),
  };
}
