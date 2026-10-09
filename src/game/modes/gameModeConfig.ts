/**
 * GoWithFlow — Game Mode Config & Definitions
 * Phase 15: Config presets, rules, modifiers, and challenge catalogues.
 */

import {
  GameModeDefinition,
  GameModeId,
  ChallengeDefinition,
  GameModeSaveData,
  GameModePersonalRecord,
  ChallengeModifier,
} from './gameModeTypes';

export const GAME_MODE_STORAGE_KEY = 'skyflow_game_modes_v1';
export const GAME_MODE_VERSION = 1;

export const DEFAULT_PERSONAL_RECORD: GameModePersonalRecord = {
  highestScore: 0,
  longestDistance: 0,
  bestTimeSeconds: 0,
  longestSurvivalTime: 0,
  mostNearMisses: 0,
  completedCount: 0,
  lastPlayedTimestamp: 0,
};

export const GAME_MODE_DEFINITIONS: Record<GameModeId, GameModeDefinition> = {
  'standard-run': {
    id: 'standard-run',
    name: 'Standard Run',
    tagline: 'The Definitive Five-World Journey',
    icon: '☁️',
    description: 'Explore all five worlds at your own pace. Collect shards, unlock gear, and reach Obsidian Core.',
    rules: [
      { label: 'All 5 Worlds', allowed: true, description: 'Sky Isles to Obsidian Core progression active.' },
      { label: 'Full Progression', allowed: true, description: 'Full XP, daily missions, and achievement tracking.' },
      { label: 'Revives Permitted', allowed: true, description: 'Neural link restores allowed using data shards.' },
      { label: 'Standard Speed', allowed: true, description: 'Adaptive balanced velocity and difficulty curve.' },
    ],
    hasLeaderboard: true,
    allowsRevive: true,
    targetLabel: 'Endless Distance',
  },

  'score-attack': {
    id: 'score-attack',
    name: 'Score Attack',
    tagline: 'High-Score Mastery & Precision Multipliers',
    icon: '🏆',
    description: 'Score bonuses rewarded for continuous obstacle chains, grazing near-misses, and clean sector clears.',
    rules: [
      { label: 'Dynamic Multiplier', allowed: true, description: 'Stack combo chains to amplify score up to 10x.' },
      { label: 'Near-Miss Bonuses', allowed: true, description: 'High reward for tight grazing passes (+250 pts).' },
      { label: 'Sector Clear Milestones', allowed: true, description: 'Massive bonus for entering each subsequent world (+1,000 pts).' },
      { label: 'Revive Permitted', allowed: true, description: 'Allowed with 15% score penalty to preserve competitive integrity.' },
    ],
    hasLeaderboard: true,
    allowsRevive: true,
    targetLabel: 'Target Score: 50,000+',
  },

  'time-trial': {
    id: 'time-trial',
    name: 'Time Trial',
    tagline: 'High-Velocity Sector Sprint',
    icon: '⏱️',
    description: 'Race against the clock to reach target sector checkpoints in the fastest possible time.',
    rules: [
      { label: 'Target Distance', allowed: true, description: 'Sprint to reach 3,000m (Sector 3 Threshold).' },
      { label: 'Continuous Boosters', allowed: true, description: 'Boost gates spawn with higher frequency.' },
      { label: 'No Revive', allowed: false, description: 'A crash stops the clock. One run, pure precision.' },
      { label: 'Stopwatch Telemetry', allowed: true, description: 'Millisecond timer tracking personal bests.' },
    ],
    hasLeaderboard: true,
    allowsRevive: false,
    targetLabel: 'Target: 3,000m Sprint',
  },

  'survival': {
    id: 'survival',
    name: 'Survival',
    tagline: 'Relentless High-G Endurance',
    icon: '🔥',
    description: 'Obstacle density and velocity increase aggressively every 30 seconds. How long can you survive?',
    rules: [
      { label: 'Ramping Velocity', allowed: true, description: 'Speed climbs +2 km/h every 10 seconds without cap.' },
      { label: 'Dense Obstacles', allowed: true, description: 'Obstacle rows appear closer together over time.' },
      { label: 'No Shields / No Revive', allowed: false, description: 'One hit ends the run. Maximum stakes.' },
      { label: 'Survival Timer', allowed: true, description: 'Score strictly governed by time survived in seconds.' },
    ],
    hasLeaderboard: true,
    allowsRevive: false,
    targetLabel: 'Target: 3+ Minutes',
  },

  'challenge-run': {
    id: 'challenge-run',
    name: 'Curated Challenges',
    tagline: 'Special Condition Operational Trials',
    icon: '🎯',
    description: 'Tackle curated objectives with unique modifiers, daily rotations, and exclusive XP rewards.',
    rules: [
      { label: 'Custom Modifiers', allowed: true, description: 'Each challenge activates specific gameplay constraints.' },
      { label: 'Guaranteed XP Reward', allowed: true, description: 'Substantial progression boosts on verified completion.' },
      { label: 'Anti-Exploit Protection', allowed: true, description: 'Rewards claimable once per completion cycle.' },
      { label: 'Rotating Objectives', allowed: true, description: 'Fresh daily and weekly high-tier operations.' },
    ],
    hasLeaderboard: true,
    allowsRevive: false,
    targetLabel: 'Trial Clear',
  },
};

/**
 * Curated Challenge Catalogue (Phase 15 Section 6)
 */
export const CURATED_CHALLENGES: ChallengeDefinition[] = [
  {
    id: 'challenge_no_revive_obsidian',
    title: 'Pure Iron Flight',
    type: 'no-revive',
    description: 'Reach Crimson Dunes (2,400m) in a single run without using a single revive.',
    icon: '🛡️',
    target: 2400,
    targetLabel: 'Reach 2,400m (No Revive)',
    modifiers: [
      {
        id: 'mod_no_revive',
        name: 'Iron Will',
        description: 'Revives completely disabled',
        disableRevive: true,
        targetDistance: 2400,
      },
    ],
    rewardXp: 400,
    rewardCosmeticId: 'trail_crystal_aurora',
  },
  {
    id: 'challenge_collector_50',
    title: 'Data Harvester',
    type: 'collector',
    description: 'Gather 50 Data Shards or Wind Orbs in a single continuous flight.',
    icon: '💎',
    target: 50,
    targetLabel: 'Collect 50 Shards',
    modifiers: [
      {
        id: 'mod_collector',
        name: 'Shard Vacuum',
        description: 'Target: 50 shards collected',
        targetCollectibles: 50,
      },
    ],
    rewardXp: 350,
  },
  {
    id: 'challenge_perfect_run',
    title: 'Zero Impact Sector',
    type: 'perfect-run',
    description: 'Reach 1,500m without a single collision or obstacle stumble.',
    icon: '✨',
    target: 1500,
    targetLabel: 'Reach 1,500m Flawlessly',
    modifiers: [
      {
        id: 'mod_perfect',
        name: 'Untouchable',
        description: 'Any stumble or crash fails objective',
        targetDistance: 1500,
        disableRevive: true,
      },
    ],
    rewardXp: 500,
  },
  {
    id: 'challenge_world_explorer',
    title: 'Deep Core Expedition',
    type: 'world-explorer',
    description: 'Navigate through sectors and safely enter Crystal Heights (Sector 4).',
    icon: '🌌',
    target: 3600,
    targetLabel: 'Enter Crystal Heights',
    worldId: 'crystal-heights',
    modifiers: [
      {
        id: 'mod_crystal_target',
        name: 'Celestial Route',
        description: 'Destination: Crystal Heights',
        targetWorldId: 'crystal-heights',
      },
    ],
    rewardXp: 600,
  },
  {
    id: 'challenge_near_miss_master',
    title: 'Phantom Reflexes',
    type: 'near-miss-master',
    description: 'Perform 12 high-speed near-miss passes against hazards in one run.',
    icon: '⚡',
    target: 12,
    targetLabel: '12 Near-Misses',
    modifiers: [
      {
        id: 'mod_near_miss',
        name: 'Razor Blade',
        description: 'Target: 12 near-miss grazes',
        targetNearMisses: 12,
      },
    ],
    rewardXp: 450,
  },
  {
    id: 'challenge_speed_demon',
    title: 'Sonic Velocity',
    type: 'speed-demon',
    description: 'Maintain speed above 45 km/h for at least 45 cumulative seconds.',
    icon: '🚀',
    target: 45,
    targetLabel: '45s at 45+ km/h',
    modifiers: [
      {
        id: 'mod_speed_demon',
        name: 'Hyper Velocity',
        description: 'Hold >45 km/h for 45s',
        timeLimitSeconds: 45,
      },
    ],
    rewardXp: 400,
  },
];

/**
 * Deterministic Daily Challenge generator (Phase 15 Section 7)
 */
export function getDailyChallenge(dateStr?: string): ChallengeDefinition {
  const dateKey = dateStr || getTodayUtcDate();
  // Mulberry hash on date string
  let h = 0;
  for (let i = 0; i < dateKey.length; i++) {
    h = Math.imul(31, h) + dateKey.charCodeAt(i) | 0;
  }
  const seed = (h ^ (h >>> 16)) >>> 0;
  const index = seed % CURATED_CHALLENGES.length;
  const base = CURATED_CHALLENGES[index];

  return {
    ...base,
    id: `daily_${dateKey}`,
    title: `Daily Operation: ${base.title}`,
    isDaily: true,
    dateKey,
    rewardXp: base.rewardXp + 150, // Extra daily incentive
  };
}

/**
 * Deterministic Weekly Challenge generator (Phase 15 Section 8)
 */
export function getWeeklyChallenge(weekStr?: string): ChallengeDefinition {
  const weekKey = weekStr || getCurrentUtcWeek();
  return {
    id: `weekly_${weekKey}`,
    title: 'Weekly Master Trial: The Five Worlds',
    type: 'no-revive',
    description: 'Reach Obsidian Core (4,800m) without using a single revive.',
    icon: '🌋',
    target: 4800,
    targetLabel: 'Reach Obsidian Core (No Revives)',
    worldId: 'obsidian-core',
    modifiers: [
      {
        id: 'mod_weekly_obsidian',
        name: 'The Five Worlds Trial',
        description: 'Reach Sector 5 with zero revives',
        disableRevive: true,
        targetDistance: 4800,
        targetWorldId: 'obsidian-core',
      },
    ],
    rewardXp: 1200,
    rewardCosmeticId: 'player_obsidian_runner',
    isWeekly: true,
    dateKey: weekKey,
  };
}

export function getTodayUtcDate(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getCurrentUtcWeek(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  // Get ISO week number
  const target = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dayNr = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setUTCMonth(0, 1);
  if (target.getUTCDay() !== 4) {
    target.setUTCMonth(0, 1 + ((4 - target.getUTCDay()) + 7) % 7);
  }
  const weekNo = 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
  return `${y}-W${String(weekNo).padStart(2, '0')}`;
}

export function createDefaultGameModeSaveData(): GameModeSaveData {
  return {
    version: GAME_MODE_VERSION,
    selectedMode: 'standard-run',
    records: {
      'standard-run': { ...DEFAULT_PERSONAL_RECORD },
      'score-attack': { ...DEFAULT_PERSONAL_RECORD },
      'time-trial': { ...DEFAULT_PERSONAL_RECORD },
      'survival': { ...DEFAULT_PERSONAL_RECORD },
    },
    completedChallenges: {},
    claimedDailyChallenges: {},
    claimedWeeklyChallenges: {},
    totalRunsByMode: {
      'standard-run': 0,
      'score-attack': 0,
      'time-trial': 0,
      'survival': 0,
      'challenge-run': 0,
    },
    lastUpdated: Date.now(),
  };
}
