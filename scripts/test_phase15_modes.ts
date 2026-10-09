/**
 * GoWithFlow — Phase 15 Automated Test & Verification Suite
 * Tests Game Modes Architecture, Standard Run, Score Attack, Time Trial,
 * Survival, Curated Challenges, Daily Rotations, Weekly Operations,
 * Anti-Exploit protections, and Progression Integration.
 */

import {
  GameModeManager,
  StandardRunMode,
  ScoreAttackMode,
  TimeTrialMode,
  SurvivalMode,
  ChallengeRunMode,
  GAME_MODE_DEFINITIONS,
  CURATED_CHALLENGES,
  getDailyChallenge,
  getWeeklyChallenge,
  getTodayUtcDate,
  getCurrentUtcWeek,
} from '../src/game/modes';
import { ProgressionManager } from '../src/game/progression';
import { PlayerStats } from '../src/types';

// Mock browser localStorage for node test execution
const storageMock: Record<string, string> = {};
(global as any).localStorage = {
  getItem: (k: string) => storageMock[k] || null,
  setItem: (k: string, v: string) => { storageMock[k] = String(v); },
  removeItem: (k: string) => { delete storageMock[k]; },
  clear: () => { for (const k in storageMock) delete storageMock[k]; },
};

function createMockStats(overrides: Partial<PlayerStats> = {}): PlayerStats {
  return {
    speed: 36,
    maxSpeed: 52,
    distance: 1200,
    score: 4500,
    highScore: 10000,
    styleMeter: 50,
    styleTier: 'Flow',
    overdriveMeter: 60,
    overdriveTier: 'Overdrive',
    comboTier: 'magenta',
    airTime: 0,
    isGrounded: true,
    combo: 4,
    windOrbsCollected: 15,
    dataShardsCollected: 15,
    currentBiome: 'neon-undercity',
    currentFriction: 0.02,
    activeTrickName: null,
    slowMoActive: false,
    isOnFloatingIsland: false,
    currentLane: 0,
    isSliding: false,
    slideTimer: 0,
    isGrinding: false,
    isBoosting: false,
    boostEnergy: 50,
    activePowerUps: {
      magnetTimer: 0,
      jetpackTimer: 0,
      hoverboardShield: false,
      multiplierTimer: 0,
    },
    scoreMultiplier: 2,
    gameState: 'playing',
    nearMissCount: 3,
    stumbles: 0,
    ...overrides,
  };
}

let passed = 0;
let failed = 0;

function assert(cond: boolean, msg: string) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${msg}`);
  } else {
    failed++;
    console.error(`  ✕ FAILED: ${msg}`);
  }
}

console.log('====================================================');
console.log('🎮 Phase 15: Game Modes & Challenges Verification');
console.log('====================================================\n');

// Group 1: Configuration & Registry
console.log('--- Group 1: Mode Definitions & Modifiers ---');
assert(Object.keys(GAME_MODE_DEFINITIONS).length === 5, 'All 5 game modes registered (Standard, Score Attack, Time Trial, Survival, Challenges)');
assert(GAME_MODE_DEFINITIONS['standard-run'].allowsRevive === true, 'Standard Run permits revives');
assert(GAME_MODE_DEFINITIONS['time-trial'].allowsRevive === false, 'Time Trial prohibits revives');
assert(GAME_MODE_DEFINITIONS['survival'].allowsRevive === false, 'Survival prohibits revives');
assert(CURATED_CHALLENGES.length >= 6, 'Curated challenge catalogue contains at least 6 diverse trials');

// Group 2: Standard Run Preservation
console.log('\n--- Group 2: Standard Run Preservation ---');
const stdMode = new StandardRunMode();
stdMode.initialize();
assert(stdMode.id === 'standard-run', 'Standard mode identifier is standard-run');
assert(stdMode.allowsRevive === true, 'Standard mode retains revives');
const mockStats1 = createMockStats({ score: 8500, distance: 2200 });
stdMode.update(10, mockStats1);
stdMode.onObstaclePassed('hazard', false);
assert(stdMode.getScore() === 8500, 'Standard run score directly preserves player score');
const stdSummary = stdMode.getSummary();
assert(stdSummary.finalScore === 8500, 'Standard summary matches final score');
assert(stdSummary.isCompleted === false, 'Standard run is endless exploration');

// Group 3: Score Attack Mechanics
console.log('\n--- Group 3: Score Attack Mechanics ---');
const saMode = new ScoreAttackMode();
saMode.initialize();
assert(saMode.id === 'score-attack', 'Score Attack mode identifier is score-attack');
const mockStats2 = createMockStats({ score: 5000, distance: 1000, dataShardsCollected: 10 });
saMode.update(5, mockStats2);

// Simulate combo chains and near-misses
for (let i = 0; i < 10; i++) {
  saMode.onObstaclePassed('barrier', i % 3 === 0);
}
saMode.onWorldChanged('verdant-wilds', 1);

const breakdown = saMode.computeBreakdown();
assert(breakdown.baseScore === 5000, 'Base score recorded correctly');
assert(breakdown.nearMissBonus > 0, 'Near-miss bonuses awarded for grazes');
assert(breakdown.worldMilestoneBonus === 1000, 'Sector clear milestone bonus (+1000) credited');
assert(breakdown.totalScore > breakdown.baseScore, 'Total Score Attack score amplifies base score');

// Test Revive Penalty in Score Attack
const scoreBeforeRevive = breakdown.totalScore;
saMode.onRevive();
const breakdownAfterRevive = saMode.computeBreakdown();
assert(breakdownAfterRevive.penaltyDeduction > 0, 'Revive applies competitive penalty in Score Attack');
assert(breakdownAfterRevive.totalScore < scoreBeforeRevive, 'Score Attack score decreases upon revive');

// Group 4: Time Trial Mechanics
console.log('\n--- Group 4: Time Trial Mechanics ---');
const ttMode = new TimeTrialMode();
ttMode.initialize();
assert(ttMode.targetDistance === 3000, 'Time Trial defaults to 3,000m target');
assert(ttMode.allowsRevive === false, 'Time Trial strictly disables revives');

// Run before reaching distance
ttMode.update(15.25, createMockStats({ distance: 1500 }));
assert(ttMode.isObjectiveCompleted() === false, 'Time Trial not complete before target distance');

// Run past target distance
ttMode.update(12.75, createMockStats({ distance: 3050 }));
assert(ttMode.isObjectiveCompleted() === true, 'Time Trial triggers completion on reaching target distance');
const ttSummary = ttMode.getSummary();
assert(ttSummary.isCompleted === true, 'Time trial summary records completed status');
assert(ttSummary.durationSeconds > 0, 'Time trial recorded positive finish duration');

// Group 5: Survival Mechanics
console.log('\n--- Group 5: Survival Mechanics ---');
const survMode = new SurvivalMode();
survMode.initialize();
assert(survMode.allowsRevive === false, 'Survival mode strictly disables revives');
survMode.update(65, createMockStats({ distance: 1800 }));
assert(survMode.getDifficultyTier() === 'INTENSE TIER 2', 'Survival scales to Tier 2 after 60 seconds');
survMode.update(65, createMockStats({ distance: 3200 }));
assert(survMode.getDifficultyTier() === 'HIGH-G TIER 3', 'Survival scales to Tier 3 after 120 seconds');
assert(survMode.getScore() > 0, 'Survival scores time elapsed and hazards cleared');

// Group 6: Curated Challenges & Rotating Directives
console.log('\n--- Group 6: Curated Challenges & Rotating Directives ---');
const ironWillDef = CURATED_CHALLENGES.find(c => c.id === 'challenge_no_revive_obsidian')!;
const cMode = new ChallengeRunMode(ironWillDef);
cMode.initialize();
assert(cMode.allowsRevive === false, 'Iron Will challenge disallows revives');

// Fail condition: revive used
cMode.onRevive();
cMode.update(5, createMockStats({ distance: 2500 }));
assert(cMode.isObjectiveCompleted() === false, 'Iron Will challenge fails if revive was used');

// Clean run: reaches target with zero revives
cMode.initialize();
cMode.update(10, createMockStats({ distance: 2450 }));
assert(cMode.isObjectiveCompleted() === true, 'Iron Will challenge completes when 2,400m reached without revive');

// Daily & Weekly deterministic generation
const todayKey = getTodayUtcDate();
const thisWeekKey = getCurrentUtcWeek();
const daily1 = getDailyChallenge(todayKey);
const daily2 = getDailyChallenge(todayKey);
assert(daily1.id === daily2.id, 'Daily challenge is deterministic for the same date');
assert(daily1.isDaily === true, 'Daily challenge flagged as daily');

const weekly = getWeeklyChallenge(thisWeekKey);
assert(weekly.isWeekly === true, 'Weekly challenge flagged as weekly');
assert(weekly.target === 4800, 'Weekly challenge targets 4,800m (Obsidian Core)');

// Group 7: GameModeManager, Persistence & Anti-Exploit
console.log('\n--- Group 7: GameModeManager & Progression Integration ---');
localStorage.clear();
const progressionMgr = new ProgressionManager();
const modeMgr = new GameModeManager();

assert(modeMgr.activeModeId === 'standard-run', 'Default mode initialized to standard-run');
modeMgr.setMode('score-attack');
assert(modeMgr.activeModeId === 'score-attack', 'Mode switches to score-attack');

// Test run lifecycle and single attribution
modeMgr.onRunStart();
modeMgr.update(10, createMockStats({ score: 12000, distance: 2500 }));
const initialXp = progressionMgr.getData().xp;

// Conclude run
const summary = modeMgr.onGameOver(createMockStats({ score: 12000, distance: 2500 }), progressionMgr);
assert(summary.finalScore > 0, 'Summary produced with positive score');
assert(progressionMgr.getData().xp > initialXp, 'XP successfully awarded to ProgressionManager');

// Anti-exploit check: multiple onGameOver calls on same run do not duplicate rewards
const xpAfterFirstFinish = progressionMgr.getData().xp;
modeMgr.onGameOver(createMockStats({ score: 12000, distance: 2500 }), progressionMgr);
assert(progressionMgr.getData().xp === xpAfterFirstFinish, 'Anti-exploit prevents duplicate reward award on repeated calls');

// Test Daily Challenge Claim idempotency
const canClaimDaily1 = modeMgr.claimChallengeCompletion('daily_' + todayKey, progressionMgr);
assert(canClaimDaily1 === true, 'First daily challenge claim succeeds');
const canClaimDaily2 = modeMgr.claimChallengeCompletion('daily_' + todayKey, progressionMgr);
assert(canClaimDaily2 === false, 'Duplicate daily challenge claim rejected');

// Test Weekly Challenge Claim idempotency
const canClaimWeekly1 = modeMgr.claimChallengeCompletion('weekly_' + thisWeekKey, progressionMgr);
assert(canClaimWeekly1 === true, 'First weekly challenge claim succeeds');
const canClaimWeekly2 = modeMgr.claimChallengeCompletion('weekly_' + thisWeekKey, progressionMgr);
assert(canClaimWeekly2 === false, 'Duplicate weekly challenge claim rejected');

// Personal Record Persistence Check
const saRecord = modeMgr.getRecord('score-attack');
assert(saRecord.highestScore > 0, 'Personal best score persisted');
assert(saRecord.longestDistance > 0, 'Personal best distance persisted');

console.log('\n====================================================');
console.log(`TOTAL TESTS: ${passed + failed}`);
console.log(`PASSED: ${passed}`);
console.log(`FAILED: ${failed}`);
console.log('====================================================');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
