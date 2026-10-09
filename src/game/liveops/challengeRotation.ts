/**
 * GoWithFlow — Deterministic Rotating Challenges
 * Phase 18 Section 5-7: Daily and weekly challenge rotations, progress evaluation,
 * and deterministic seed scheduling.
 */

import { RotatingChallenge } from './liveOpsConfig';
import { GameModeSummary } from '../modes/gameModeTypes';

export interface ChallengeTemplateDefinition {
  title: string;
  description: string;
  icon: string;
  metric: RotatingChallenge['targetMetric'];
  target: number;
  rewardXp: number;
  rewardShards: number;
  targetWorld?: RotatingChallenge['targetWorld'];
  targetMode?: RotatingChallenge['targetMode'];
}

export const DAILY_CHALLENGE_TEMPLATES: ChallengeTemplateDefinition[] = [
  {
    title: 'Cloud Runner',
    description: 'Travel 2,500m across the skies.',
    icon: '☁️',
    metric: 'distance',
    target: 2500,
    rewardXp: 150,
    rewardShards: 50,
  },
  {
    title: 'Precision Grazer',
    description: 'Execute 15 near-miss passes in a single run.',
    icon: '⚡',
    metric: 'near_misses',
    target: 15,
    rewardXp: 200,
    rewardShards: 60,
  },
  {
    title: 'Shard Magnet',
    description: 'Collect 60 energy shards.',
    icon: '💎',
    metric: 'shards',
    target: 60,
    rewardXp: 175,
    rewardShards: 75,
  },
  {
    title: 'Sky Champion',
    description: 'Score 50,000 points in any mode.',
    icon: '🏆',
    metric: 'score',
    target: 50000,
    rewardXp: 250,
    rewardShards: 80,
  },
  {
    title: 'Verdant Expedition',
    description: 'Reach the Verdant Wilds sector.',
    icon: '🌿',
    metric: 'world_reach',
    target: 2250,
    rewardXp: 200,
    rewardShards: 60,
    targetWorld: 'verdant-wilds',
  },
  {
    title: 'Dune Navigator',
    description: 'Reach the Crimson Dunes sector.',
    icon: '🏜️',
    metric: 'world_reach',
    target: 4500,
    rewardXp: 280,
    rewardShards: 90,
    targetWorld: 'crimson-dunes',
  },
  {
    title: 'Survival Specialist',
    description: 'Survive for at least 90 seconds.',
    icon: '⏱️',
    metric: 'survival_seconds',
    target: 90,
    rewardXp: 220,
    rewardShards: 70,
  },
];

export const WEEKLY_CHALLENGE_TEMPLATES: ChallengeTemplateDefinition[] = [
  {
    title: 'Obsidian Descent',
    description: 'Reach Obsidian Core and confront the volcanic depths.',
    icon: '🌋',
    metric: 'world_reach',
    target: 9000,
    rewardXp: 800,
    rewardShards: 250,
    targetWorld: 'obsidian-core',
  },
  {
    title: 'Overdrive Grandmaster',
    description: 'Score 120,000 points in Score Attack mode.',
    icon: '🔥',
    metric: 'score',
    target: 120000,
    rewardXp: 950,
    rewardShards: 300,
    targetMode: 'score-attack',
  },
  {
    title: 'Grand Aviator Marathon',
    description: 'Accumulate 15,000 meters of total flight.',
    icon: '🚀',
    metric: 'distance',
    target: 15000,
    rewardXp: 850,
    rewardShards: 260,
  },
  {
    title: 'Reflex Ace',
    description: 'Perform 60 near-miss hazard grazes.',
    icon: '✨',
    metric: 'near_misses',
    target: 60,
    rewardXp: 900,
    rewardShards: 280,
  },
];

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const ONE_WEEK_MS = 7 * ONE_DAY_MS;

/**
 * Generate a deterministic rotating Daily Challenge for any given server timestamp
 */
export function getDeterministicDailyChallenge(serverTime: number): RotatingChallenge {
  const dayIndex = Math.floor(serverTime / ONE_DAY_MS);
  const templateIdx = Math.abs(dayIndex) % DAILY_CHALLENGE_TEMPLATES.length;
  const tmpl = DAILY_CHALLENGE_TEMPLATES[templateIdx];

  const dayStart = dayIndex * ONE_DAY_MS;
  const dayEnd = dayStart + ONE_DAY_MS;

  return {
    id: `rot_daily_${dayIndex}`,
    cadence: 'daily',
    title: tmpl.title,
    description: tmpl.description,
    icon: tmpl.icon,
    targetMetric: tmpl.metric,
    targetValue: tmpl.target,
    currentValue: 0,
    completed: false,
    claimed: false,
    startsAt: dayStart,
    expiresAt: dayEnd,
    rewardXp: tmpl.rewardXp,
    rewardShards: tmpl.rewardShards,
    targetWorld: tmpl.targetWorld,
    targetMode: tmpl.targetMode,
  };
}

/**
 * Generate a deterministic rotating Weekly Challenge for any given server timestamp
 */
export function getDeterministicWeeklyChallenge(serverTime: number): RotatingChallenge {
  const weekIndex = Math.floor(serverTime / ONE_WEEK_MS);
  const templateIdx = Math.abs(weekIndex) % WEEKLY_CHALLENGE_TEMPLATES.length;
  const tmpl = WEEKLY_CHALLENGE_TEMPLATES[templateIdx];

  const weekStart = weekIndex * ONE_WEEK_MS;
  const weekEnd = weekStart + ONE_WEEK_MS;

  return {
    id: `rot_weekly_${weekIndex}`,
    cadence: 'weekly',
    title: tmpl.title,
    description: tmpl.description,
    icon: tmpl.icon,
    targetMetric: tmpl.metric,
    targetValue: tmpl.target,
    currentValue: 0,
    completed: false,
    claimed: false,
    startsAt: weekStart,
    expiresAt: weekEnd,
    rewardXp: tmpl.rewardXp,
    rewardShards: tmpl.rewardShards,
    targetWorld: tmpl.targetWorld,
    targetMode: tmpl.targetMode,
  };
}

/**
 * Update challenge progress from a completed run summary
 */
export function evaluateChallengeProgress(
  challenge: RotatingChallenge,
  summary: GameModeSummary
): { updatedChallenge: RotatingChallenge; newlyCompleted: boolean } {
  if (challenge.completed) {
    return { updatedChallenge: challenge, newlyCompleted: false };
  }

  // Check target mode alignment if required
  if (challenge.targetMode && challenge.targetMode !== summary.modeId) {
    return { updatedChallenge: challenge, newlyCompleted: false };
  }

  let increment = 0;
  let isAbsolute = false;

  switch (challenge.targetMetric) {
    case 'distance':
      increment = summary.distance;
      break;
    case 'score':
      increment = summary.finalScore;
      break;
    case 'shards':
      increment = summary.shardsCollected;
      break;
    case 'near_misses':
      increment = summary.nearMisses;
      break;
    case 'survival_seconds':
      increment = summary.durationSeconds;
      break;
    case 'world_reach':
      // Check if player traversed target distance
      isAbsolute = true;
      increment = summary.distance;
      break;
  }

  let newValue = isAbsolute ? Math.max(challenge.currentValue, increment) : challenge.currentValue + increment;
  const completed = newValue >= challenge.targetValue;
  if (completed) {
    newValue = challenge.targetValue;
  }

  const updated: RotatingChallenge = {
    ...challenge,
    currentValue: newValue,
    completed,
  };

  return {
    updatedChallenge: updated,
    newlyCompleted: completed && !challenge.completed,
  };
}
