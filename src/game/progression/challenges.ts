/**
 * GoWithFlow — Dynamic Challenges & Deterministic Daily Quests
 */

export interface Challenge {
  id: string;
  title: string;
  description: string;
  category: 'distance' | 'collection' | 'skill' | 'world';
  target: number;
  current: number;
  completed: boolean;
  claimed: boolean;
  xpReward: number;
  shardReward: number;
}

export interface ChallengeTemplate {
  id: string;
  title: string;
  description: string;
  category: 'distance' | 'collection' | 'skill' | 'world';
  target: number;
  xpReward: number;
  shardReward: number;
}

export const CHALLENGE_TEMPLATES: ChallengeTemplate[] = [
  // Distance
  {
    id: 'ch_dist_1500',
    title: 'Highway Cruiser',
    description: 'Travel 1,500m on the neon track',
    category: 'distance',
    target: 1500,
    xpReward: 80,
    shardReward: 40,
  },
  {
    id: 'ch_dist_3000',
    title: 'Sector Drifter',
    description: 'Travel 3,000m across multiple biomes',
    category: 'distance',
    target: 3000,
    xpReward: 160,
    shardReward: 80,
  },
  {
    id: 'ch_dist_5000',
    title: 'Endurance Flier',
    description: 'Travel 5,000m into deep sectors',
    category: 'distance',
    target: 5000,
    xpReward: 250,
    shardReward: 120,
  },

  // Collection
  {
    id: 'ch_collect_50',
    title: 'Shard Scavenger',
    description: 'Harvest 50 Data Shards',
    category: 'collection',
    target: 50,
    xpReward: 75,
    shardReward: 35,
  },
  {
    id: 'ch_collect_120',
    title: 'Cluster Magnet',
    description: 'Harvest 120 Data Shards',
    category: 'collection',
    target: 120,
    xpReward: 150,
    shardReward: 75,
  },

  // Skill
  {
    id: 'ch_nearmiss_6',
    title: 'Razor Edge',
    description: 'Perform 6 near misses with cyber barriers',
    category: 'skill',
    target: 6,
    xpReward: 100,
    shardReward: 50,
  },
  {
    id: 'ch_tricks_8',
    title: 'Aerial Flow',
    description: 'Execute 8 aerial stunt tricks',
    category: 'skill',
    target: 8,
    xpReward: 90,
    shardReward: 45,
  },

  // World milestones
  {
    id: 'ch_reach_verdant',
    title: 'Forest Infiltration',
    description: 'Reach Verdant Wilds (Sector 2)',
    category: 'world',
    target: 2250,
    xpReward: 120,
    shardReward: 60,
  },
  {
    id: 'ch_reach_crimson',
    title: 'Desert Explorer',
    description: 'Reach Crimson Dunes (Sector 3)',
    category: 'world',
    target: 4500,
    xpReward: 180,
    shardReward: 90,
  },
  {
    id: 'ch_reach_crystal',
    title: 'Celestial Ascent',
    description: 'Reach Crystal Heights (Sector 4)',
    category: 'world',
    target: 6750,
    xpReward: 220,
    shardReward: 110,
  },
];

/**
 * Hash a string to a 32-bit integer for deterministic pseudo-random seed.
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Generate 3 deterministic daily challenges based on UTC date string (e.g. "2026-10-06").
 */
export function generateDailyChallenges(dateStr: string): Challenge[] {
  const seed = hashString(`gowithflow_daily_${dateStr}`);
  const pool = [...CHALLENGE_TEMPLATES];
  const selected: ChallengeTemplate[] = [];

  // Deterministically pick 3 distinct templates from different categories if possible
  let currentSeed = seed;
  while (selected.length < 3 && pool.length > 0) {
    const idx = currentSeed % pool.length;
    selected.push(pool.splice(idx, 1)[0]);
    currentSeed = (currentSeed * 1664525 + 1013904223) >>> 0;
  }

  return selected.map(tmpl => ({
    id: `${tmpl.id}_${dateStr}`,
    title: tmpl.title,
    description: tmpl.description,
    category: tmpl.category,
    target: tmpl.target,
    current: 0,
    completed: false,
    claimed: false,
    xpReward: tmpl.xpReward,
    shardReward: tmpl.shardReward,
  }));
}
