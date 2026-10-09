/**
 * GoWithFlow — Permanent Achievements Registry
 */

export interface Achievement {
  id: string;
  title: string;
  description: string;
  category: 'exploration' | 'skill' | 'collection';
  icon: string;
  xpReward: number;
  shardReward: number;
}

export const ACHIEVEMENTS: Achievement[] = [
  // 1. Exploration
  {
    id: 'ach_first_flight',
    title: 'First Flight',
    description: 'Launch your hoverboard and begin your journey in Sky Isles',
    category: 'exploration',
    icon: '☁️',
    xpReward: 50,
    shardReward: 25,
  },
  {
    id: 'ach_into_wild',
    title: 'Into the Wild',
    description: 'Traverse the 2,250m boundary into Verdant Wilds',
    category: 'exploration',
    icon: '🌿',
    xpReward: 100,
    shardReward: 50,
  },
  {
    id: 'ach_red_horizon',
    title: 'Red Horizon',
    description: 'Cross the 4,500m boundary into Crimson Dunes',
    category: 'exploration',
    icon: '🏜️',
    xpReward: 150,
    shardReward: 75,
  },
  {
    id: 'ach_crystal_voyager',
    title: 'Celestial Voyager',
    description: 'Ascend across 6,750m into Crystal Heights',
    category: 'exploration',
    icon: '💎',
    xpReward: 200,
    shardReward: 100,
  },
  {
    id: 'ach_heart_obsidian',
    title: 'Heart of Obsidian',
    description: 'Penetrate the deepest subterranean depths of Obsidian Core (9,000m+)',
    category: 'exploration',
    icon: '🌋',
    xpReward: 350,
    shardReward: 150,
  },

  // 2. Skill
  {
    id: 'ach_near_miss_10',
    title: 'Phantom Reflexes',
    description: 'Perform 10 razor-sharp near-misses with cyber obstacles in a single run',
    category: 'skill',
    icon: '⚡',
    xpReward: 120,
    shardReward: 60,
  },
  {
    id: 'ach_transcendent_flow',
    title: 'Transcendent Flow',
    description: 'Reach Style Tier: Transcendent and activate hyper-velocity plasma trail',
    category: 'skill',
    icon: '🔥',
    xpReward: 150,
    shardReward: 75,
  },
  {
    id: 'ach_untouchable_2k',
    title: 'Untouchable',
    description: 'Drift 2,000 meters in a single run without suffering a single stumble or crash',
    category: 'skill',
    icon: '🛡️',
    xpReward: 200,
    shardReward: 100,
  },
  {
    id: 'ach_aerial_virtuoso',
    title: 'Aerial Virtuoso',
    description: 'Execute all 4 stunt trick maneuvers (Spin, Flip, Grab, Glide) in one run',
    category: 'skill',
    icon: '✨',
    xpReward: 180,
    shardReward: 80,
  },

  // 3. Collection & Mastery
  {
    id: 'ach_shards_100',
    title: 'Data Harvester',
    description: 'Harvest 100 Data Shards in a single cyber run',
    category: 'collection',
    icon: '💎',
    xpReward: 100,
    shardReward: 50,
  },
  {
    id: 'ach_vault_500',
    title: 'Cyber Vault',
    description: 'Accumulate a total persistent wallet of 500 Data Shards',
    category: 'collection',
    icon: '🏦',
    xpReward: 200,
    shardReward: 100,
  },
  {
    id: 'ach_score_50k',
    title: 'High Sync Rating',
    description: 'Reach a score of 50,000 points in a single cyber run',
    category: 'collection',
    icon: '🏆',
    xpReward: 250,
    shardReward: 120,
  },
];

export const ACHIEVEMENT_MAP = new Map<string, Achievement>(
  ACHIEVEMENTS.map(a => [a.id, a])
);
