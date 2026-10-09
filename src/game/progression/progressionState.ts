/**
 * GoWithFlow — Progression State Persistence & Migration Engine
 */

import { PROGRESSION_VERSION, calculateLevelFromXp } from './progressionConfig';
import { Challenge, generateDailyChallenges } from './challenges';

export interface ProgressionSaveData {
  version: number;
  xp: number;
  level: number;
  totalXpEarned: number;
  unlockedRewards: string[];           // IDs of claimed level rewards
  achievements: Record<string, boolean>; // achievementId -> boolean (completed)
  claimedAchievements: Record<string, boolean>; // achievementId -> boolean (claimed)
  challenges: Record<string, { current: number; completed: boolean; claimed: boolean }>;
  dailySeed: string;                    // "YYYY-MM-DD"
  dailyChallenges: Challenge[];
  selectedBadge?: string;
  lastUpdated: number;
}

export const STORAGE_KEY_PROGRESSION = 'skyflow_progression_v1';

export function getTodayDateString(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function createDefaultProgressionState(): ProgressionSaveData {
  const today = getTodayDateString();
  return {
    version: PROGRESSION_VERSION,
    xp: 0,
    level: 1,
    totalXpEarned: 0,
    unlockedRewards: [],
    achievements: {},
    claimedAchievements: {},
    challenges: {},
    dailySeed: today,
    dailyChallenges: generateDailyChallenges(today),
    selectedBadge: 'badge:sky-strider',
    lastUpdated: Date.now(),
  };
}

/**
 * Safely load or migrate progression state from localStorage.
 */
export function loadProgressionState(): ProgressionSaveData {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return createDefaultProgressionState();
  }

  const today = getTodayDateString();

  try {
    const raw = localStorage.getItem(STORAGE_KEY_PROGRESSION);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        // Validate required fields
        const state: ProgressionSaveData = {
          version: PROGRESSION_VERSION,
          xp: typeof parsed.xp === 'number' ? Math.max(0, parsed.xp) : 0,
          level: typeof parsed.level === 'number' ? Math.max(1, parsed.level) : 1,
          totalXpEarned: typeof parsed.totalXpEarned === 'number' ? Math.max(0, parsed.totalXpEarned) : 0,
          unlockedRewards: Array.isArray(parsed.unlockedRewards) ? parsed.unlockedRewards : [],
          achievements: parsed.achievements && typeof parsed.achievements === 'object' ? parsed.achievements : {},
          claimedAchievements: parsed.claimedAchievements && typeof parsed.claimedAchievements === 'object' ? parsed.claimedAchievements : {},
          challenges: parsed.challenges && typeof parsed.challenges === 'object' ? parsed.challenges : {},
          dailySeed: typeof parsed.dailySeed === 'string' ? parsed.dailySeed : today,
          dailyChallenges: Array.isArray(parsed.dailyChallenges) ? parsed.dailyChallenges : generateDailyChallenges(today),
          selectedBadge: typeof parsed.selectedBadge === 'string' ? parsed.selectedBadge : undefined,
          lastUpdated: Date.now(),
        };

        // If day changed, refresh daily challenges
        if (state.dailySeed !== today) {
          state.dailySeed = today;
          state.dailyChallenges = generateDailyChallenges(today);
        }

        return state;
      }
    }
  } catch (err) {
    console.warn('[ProgressionState] Failed to parse existing progression state, attempting migration...', err);
  }

  // No saved progression or corrupted: Migrate from old local storage keys
  return migrateFromLegacyData();
}

/**
 * Migration engine: Converts legacy save keys into modern ProgressionSaveData
 * without losing any player accomplishments or high score data.
 */
export function migrateFromLegacyData(overrides?: {
  bankedShards?: number;
  highScore?: number;
  bestDistance?: number;
}): ProgressionSaveData {
  const base = createDefaultProgressionState();

  try {
    let legacyDistance = overrides?.bestDistance ?? 0;
    let legacyScore = overrides?.highScore ?? 0;

    if (overrides === undefined && typeof localStorage !== 'undefined') {
      const savedDistance = localStorage.getItem('skyflow_best_distance');
      if (savedDistance) legacyDistance = parseInt(savedDistance, 10) || 0;

      const savedScore = localStorage.getItem('skyflow_high_score');
      if (savedScore) legacyScore = parseInt(savedScore, 10) || 0;
    }

    // Credit returning players with starter XP based on past achievements
    const starterXp = Math.floor(legacyDistance / 10) + Math.floor(legacyScore / 100);
    if (starterXp > 0) {
      const { newLevel, remainingXp } = calculateLevelFromXp(1, starterXp);
      base.level = newLevel;
      base.xp = remainingXp;
      base.totalXpEarned = starterXp;
      base.achievements['ach_first_flight'] = true;
    }

    // Check unlocked items
    if (typeof localStorage !== 'undefined') {
      const savedUnlocked = localStorage.getItem('skyflow_unlocked_items');
      if (savedUnlocked) {
        const items = JSON.parse(savedUnlocked);
        if (Array.isArray(items)) {
          if (items.includes('laser-edge')) base.unlockedRewards.push('reward_lvl_8_board');
          if (items.includes('void-stalker')) base.unlockedRewards.push('reward_lvl_15_board');
        }
      }
    }

    // Save initial migrated state
    saveProgressionState(base);
    console.log(`[ProgressionState] Successfully migrated legacy profile to Level ${base.level} with ${starterXp} earned XP.`);
    return base;
  } catch (err) {
    console.error('[ProgressionState] Legacy migration fallback triggered:', err);
    return base;
  }
}

/**
 * Persist progression state to localStorage.
 */
export function saveProgressionState(state: ProgressionSaveData): void {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
  try {
    state.lastUpdated = Date.now();
    localStorage.setItem(STORAGE_KEY_PROGRESSION, JSON.stringify(state));
  } catch (err) {
    console.error('[ProgressionState] Failed to persist progression state:', err);
  }
}
