/**
 * GoWithFlow — Phase 13 Progression System Automated Verification Suite
 * Tests XP math, level boundaries, multi-level ups, achievements, daily challenges,
 * legacy migration, idempotency, and anti-duplication.
 */

import {
  getXpRequiredForLevel,
  calculateLevelFromXp,
  getTotalXpForLevel,
  getXPProgress,
  XP_SOURCES,
} from '../src/game/progression/progressionConfig';

import {
  generateDailyChallenges,
  CHALLENGE_TEMPLATES,
} from '../src/game/progression/challenges';

import {
  ACHIEVEMENTS,
  ACHIEVEMENT_MAP,
} from '../src/game/progression/achievements';

import {
  LEVEL_REWARDS,
  LEVEL_REWARDS_BY_LEVEL,
} from '../src/game/progression/rewards';

import {
  createDefaultProgressionState,
  migrateFromLegacyData,
  ProgressionSaveData,
} from '../src/game/progression/progressionState';

import {
  ProgressionManager,
} from '../src/game/progression/ProgressionManager';

let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, details?: string) {
  if (condition) {
    passedTests++;
    console.log(`  ✓ PASS: ${testName}`);
  } else {
    failedTests++;
    console.error(`  ✗ FAIL: ${testName} ${details ? `(${details})` : ''}`);
  }
}

console.log('====================================================');
console.log('🧪 RUNNING PHASE 13 PROGRESSION VERIFICATION SUITE');
console.log('====================================================\n');

// ----------------------------------------------------
// TEST 1: XP Formula & Level Progression Curves
// ----------------------------------------------------
console.log('--- TEST 1: XP Formula & Level Curves ---');
const lvl1Req = getXpRequiredForLevel(1);
assert(lvl1Req === 250, 'Level 1 requires exactly 250 XP', `Got ${lvl1Req}`);

const lvl2Req = getXpRequiredForLevel(2);
assert(lvl2Req > lvl1Req, 'Level 2 requires more XP than Level 1', `Got ${lvl2Req}`);

const lvl5Req = getXpRequiredForLevel(5);
assert(lvl5Req === Math.floor(250 * Math.pow(5, 1.25)), 'Level 5 matches formula floor(250 * 5^1.25)', `Got ${lvl5Req}`);

// Boundary checks: required-1, required, required+1
const resJustBelow = calculateLevelFromXp(1, 249);
assert(resJustBelow.newLevel === 1 && resJustBelow.remainingXp === 249 && resJustBelow.levelsGained === 0,
  'XP (req - 1) stays at level 1 with 249 XP');

const resExact = calculateLevelFromXp(1, 250);
assert(resExact.newLevel === 2 && resExact.remainingXp === 0 && resExact.levelsGained === 1,
  'Exact XP (req) advances cleanly to level 2 with 0 carryover');

const resOver = calculateLevelFromXp(1, 255);
assert(resOver.newLevel === 2 && resOver.remainingXp === 5 && resOver.levelsGained === 1,
  'XP (req + 5) advances cleanly to level 2 with 5 carryover');

// Multi-level up check: 2000 XP in one burst
const resMulti = calculateLevelFromXp(1, 2000);
assert(resMulti.levelsGained > 1 && resMulti.newLevel > 2,
  `Multi-level burst advances multiple levels (Level ${resMulti.newLevel}, gained ${resMulti.levelsGained})`);

// ----------------------------------------------------
// TEST 2: Deterministic Daily Challenges
// ----------------------------------------------------
console.log('\n--- TEST 2: Deterministic Daily Challenge Generator ---');
const dateA = '2026-10-06';
const challengesA1 = generateDailyChallenges(dateA);
const challengesA2 = generateDailyChallenges(dateA);

assert(challengesA1.length === 3, 'Generates exactly 3 daily challenges');
assert(JSON.stringify(challengesA1) === JSON.stringify(challengesA2),
  'Same date string produces identical deterministic challenges');

const dateB = '2026-10-07';
const challengesB = generateDailyChallenges(dateB);
assert(challengesA1[0].id !== challengesB[0].id || challengesA1[1].id !== challengesB[1].id,
  'Different date strings yield different daily challenge sets');

// ----------------------------------------------------
// TEST 3: Achievements Registry & Integrity
// ----------------------------------------------------
console.log('\n--- TEST 3: Permanent Achievements Registry ---');
assert(ACHIEVEMENTS.length >= 10, `Registry contains ${ACHIEVEMENTS.length} permanent achievements`);
assert(ACHIEVEMENT_MAP.has('ach_first_flight'), 'Exploration achievement ach_first_flight exists');
assert(ACHIEVEMENT_MAP.has('ach_heart_obsidian'), 'Sector 5 achievement ach_heart_obsidian exists');
assert(ACHIEVEMENT_MAP.has('ach_untouchable_2k'), 'Skill achievement ach_untouchable_2k exists');

// ----------------------------------------------------
// TEST 4: Level Rewards Registry
// ----------------------------------------------------
console.log('\n--- TEST 4: Level Milestone Rewards Registry ---');
assert(LEVEL_REWARDS.length >= 7, `Level rewards registry has ${LEVEL_REWARDS.length} milestone tiers`);
assert(LEVEL_REWARDS_BY_LEVEL.has(2), 'Level 2 gives bonus shards');
assert(LEVEL_REWARDS_BY_LEVEL.has(8), 'Level 8 unlocks Laser Edge Hoverboard');
assert(LEVEL_REWARDS_BY_LEVEL.has(20), 'Level 20 unlocks Transcendent Legend Badge');

// ----------------------------------------------------
// TEST 5: Legacy Profile Migration
// ----------------------------------------------------
console.log('\n--- TEST 5: Backward-Compatible Legacy Profile Migration ---');
const legacySave = migrateFromLegacyData({
  bankedShards: 350,
  highScore: 12500,
  bestDistance: 1800,
});

assert(legacySave.level >= 2, `Legacy profile migrated with starter level ${legacySave.level} (expected >= 2)`);
assert(legacySave.totalXpEarned > 0, `Legacy profile credited with ${legacySave.totalXpEarned} initial XP`);
assert(legacySave.achievements['ach_first_flight'] === true, 'Legacy explorer credited with ach_first_flight');

// ----------------------------------------------------
// TEST 6: ProgressionManager Integration & Anti-Duplication
// ----------------------------------------------------
console.log('\n--- TEST 6: ProgressionManager & Anti-Duplication / Idempotency ---');

// Mock localStorage for test environment
const mockStorage: Record<string, string> = {};
(global as any).localStorage = {
  getItem: (k: string) => mockStorage[k] || null,
  setItem: (k: string, v: string) => { mockStorage[k] = v; },
  removeItem: (k: string) => { delete mockStorage[k]; },
};
(global as any).window = global;

let levelUpCount = 0;
let unlockedAchCount = 0;

const mgr = new ProgressionManager({
  onLevelUp: () => { levelUpCount++; },
  onAchievementUnlocked: () => { unlockedAchCount++; },
});

mgr.startRun();
assert(mgr.getLevel() === 1, 'Fresh manager starts at Level 1');

// Record near misses
mgr.recordNearMiss(1);
mgr.recordNearMiss(2);
assert(mgr.sessionXpEarned > 0, 'Near misses grant XP');

// Record shards
mgr.recordShardCollection(10);
assert(mgr.sessionXpEarned >= 50, 'Shard pickups grant XP');

// Unlock achievement idempotently
const firstUnlock = mgr.unlockAchievement('ach_near_miss_10');
assert(firstUnlock === true, 'First unlock of achievement succeeds');

const duplicateUnlock = mgr.unlockAchievement('ach_near_miss_10');
assert(duplicateUnlock === false, 'Duplicate unlock of achievement rejected idempotently');

// Claim achievement idempotently
const firstClaim = mgr.claimAchievement('ach_near_miss_10');
assert(firstClaim !== null && firstClaim.xp > 0, 'First claim of achievement succeeds');

const duplicateClaim = mgr.claimAchievement('ach_near_miss_10');
assert(duplicateClaim === null, 'Duplicate claim of achievement rejected idempotently');

// World Transitions
mgr.recordWorldReached('verdant-wilds');
mgr.recordWorldTransition('verdant-wilds', 'crimson-dunes');
assert(mgr.getData().achievements['ach_into_wild'] === true, 'Sector 2 achievement granted on world reached');
assert(mgr.getData().achievements['ach_red_horizon'] === true, 'Sector 3 achievement granted on transition');

// Finalize run
const runSummary = mgr.finalizeRun({
  distance: 2200,
  score: 55000,
  shards: 120,
  nearMisses: 12,
  stumbles: 0,
});

assert(runSummary.runXp > 0, 'Run summary calculated final XP');
assert(mgr.getData().achievements['ach_untouchable_2k'] === true, 'Granted ach_untouchable_2k for 2000m + 0 stumbles');
assert(mgr.getData().achievements['ach_score_50k'] === true, 'Granted ach_score_50k for 50,000+ score');

// ----------------------------------------------------
// SUMMARY
// ----------------------------------------------------
console.log('\n====================================================');
console.log(`TOTAL TESTS: ${passedTests + failedTests}`);
console.log(`PASSED: ${passedTests}`);
console.log(`FAILED: ${failedTests}`);
console.log('====================================================');

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('✨ ALL PHASE 13 PROGRESSION TESTS PASSED SUCCESSFULLY! ✨');
}
