/**
 * GoWithFlow — Progression Configuration & XP Curve Formulas
 */

export const PROGRESSION_VERSION = 1;

/**
 * Returns XP required to advance from `level` to `level + 1`.
 * Level 1 requires 250 XP. Curves upward progressively.
 */
export function getXpRequiredForLevel(level: number): number {
  if (level < 1) return 250;
  return Math.floor(250 * Math.pow(level, 1.25));
}

/**
 * Cumulative total XP required to reach a specific level starting from level 1 with 0 XP.
 */
export function getTotalXpForLevel(targetLevel: number): number {
  let total = 0;
  for (let lvl = 1; lvl < targetLevel; lvl++) {
    total += getXpRequiredForLevel(lvl);
  }
  return total;
}

/**
 * Given current level and current XP stored in that level,
 * calculates the level progression details.
 */
export function calculateLevelFromXp(currentLevel: number, currentXp: number): {
  newLevel: number;
  remainingXp: number;
  levelsGained: number;
} {
  let lvl = currentLevel;
  let xp = currentXp;
  let levelsGained = 0;

  while (true) {
    const required = getXpRequiredForLevel(lvl);
    if (xp >= required) {
      xp -= required;
      lvl++;
      levelsGained++;
    } else {
      break;
    }
  }

  return {
    newLevel: lvl,
    remainingXp: xp,
    levelsGained,
  };
}

export const XP_SOURCES = {
  METERS_PER_XP: 10,       // 1 XP per 10 meters traveled
  SHARD_COLLECTED: 5,      // 5 XP per data shard
  NEAR_MISS: 25,           // 25 XP per near miss
  TRICK_LANDED: 15,        // 15 XP per stunt trick
  BOOST_GATE: 20,          // 20 XP per boost arch passed
  WORLD_TRANSITION: 150,   // 150 XP per successful world boundary transition
  WORLD_REACHED: {
    'sky-isles': 50,
    'verdant-wilds': 100,
    'crimson-dunes': 150,
    'crystal-heights': 200,
    'obsidian-core': 300,
  } as Record<string, number>,
};

/**
 * Return user-friendly progress metrics for UI display.
 */
export function getXPProgress(xp: number, level: number = 1): {
  currentLevel: number;
  currentLevelXP: number;
  nextLevelXPRequired: number;
  xpRemaining: number;
  percent: number;
} {
  const req = getXpRequiredForLevel(level);
  const curXp = Math.max(0, xp);
  const remaining = Math.max(0, req - curXp);
  const pct = Math.min(100, Math.max(0, Math.round((curXp / req) * 100)));

  return {
    currentLevel: level,
    currentLevelXP: curXp,
    nextLevelXPRequired: req,
    xpRemaining: remaining,
    percent: pct,
  };
}
