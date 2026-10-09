/**
 * GoWithFlow — Phase 18 Automated Test Suite: Live Operations, Seasonal Events & Rotating Content
 * Validates Seasons 01-05, deterministic daily/weekly challenges, limited-time events,
 * additive modifiers, mini season pass, announcements, emergency killswitches, and offline caching.
 */

import {
  LiveOpsManager,
  LiveOpsServer,
  CURATED_SEASONS,
  evaluateSeasonStatus,
  getActiveSeasonForTime,
  getDeterministicDailyChallenge,
  getDeterministicWeeklyChallenge,
  evaluateChallengeProgress,
  CURATED_EVENTS,
  isEventActive,
  getActiveModifiers,
  calculateEffectiveXpMultiplier,
  calculateEffectiveScoreMultiplier,
  AnnouncementService,
  CURATED_SEASON_PASS_TIERS,
  evaluateSeasonPassTiers,
  LIVEOPS_STORAGE_KEY_CACHE,
} from '../src/game/liveops';
import { SecurityManager } from '../src/game/security';
import { ProgressionManager } from '../src/game/progression';
import { GameModeSummary } from '../src/game/modes/gameModeTypes';

// Mock localStorage for node test runner
const mockStore = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => mockStore.get(k) || null,
  setItem: (k: string, v: string) => mockStore.set(k, v),
  removeItem: (k: string) => mockStore.delete(k),
  clear: () => mockStore.clear(),
};
(globalThis as any).window = globalThis;
Object.defineProperty(globalThis, 'navigator', {
  get: () => ({ onLine: true }),
  configurable: true,
});

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`  ✓ ${msg}`);
    passed++;
  } else {
    console.error(`  ✕ FAILED: ${msg}`);
    failed++;
  }
}

console.log('====================================================');
console.log('🌟 Phase 18: Live Operations, Seasons & Rotating Content');
console.log('====================================================\n');

// --- Group 1: Curated Seasons 01-05 & Lifecycle ---
console.log('--- Group 1: Curated Seasons & Authoritative Lifecycle ---');
assert(CURATED_SEASONS.length === 5, 'Exactly 5 curated seasons registered (Skybound to Corefall)');
assert(CURATED_SEASONS[0].theme.focusWorld === 'sky-isles', 'Season 01 focuses on Sky Isles');
assert(CURATED_SEASONS[1].theme.focusWorld === 'verdant-wilds', 'Season 02 focuses on Verdant Wilds');
assert(CURATED_SEASONS[2].theme.focusWorld === 'crimson-dunes', 'Season 03 focuses on Crimson Dunes');
assert(CURATED_SEASONS[3].theme.focusWorld === 'crystal-heights', 'Season 04 focuses on Crystal Heights');
assert(CURATED_SEASONS[4].theme.focusWorld === 'obsidian-core', 'Season 05 focuses on Obsidian Core');

const s01 = CURATED_SEASONS[0];
assert(evaluateSeasonStatus(s01, s01.startsAt - 1000) === 'upcoming', 'Season before startsAt resolves as upcoming');
assert(evaluateSeasonStatus(s01, s01.startsAt + 10000) === 'active', 'Season within window resolves as active');
assert(evaluateSeasonStatus(s01, s01.endsAt - 3600000) === 'ending', 'Season in final 48 hours resolves as ending');
assert(evaluateSeasonStatus(s01, s01.endsAt + 1000) === 'ended', 'Season after endsAt resolves as ended');

const activeForNow = getActiveSeasonForTime(s01.startsAt + 5000);
assert(activeForNow.id === 'season_01_skybound', 'Active season resolved accurately for server timestamp');

// --- Group 2: Season Rollover & Transition ---
console.log('\n--- Group 2: Season Rollover & Transition ---');
const server = new LiveOpsServer();
const rolloverRes = server.advanceToNextSeason(s01.startsAt + 1000);
assert(rolloverRes.archivedSeason.status === 'archived', 'Previous season cleanly marked as archived');
assert(rolloverRes.newSeason.number === 2, 'New season automatically transitioned to Season 2');
assert(rolloverRes.newSeason.status === 'active', 'New season active and ready for competition');

// --- Group 3: Deterministic Rotating Challenges ---
console.log('\n--- Group 3: Deterministic Rotating Challenges ---');
const testTime = 1790812800000; // Fixed timestamp
const daily1 = getDeterministicDailyChallenge(testTime);
const daily2 = getDeterministicDailyChallenge(testTime);
assert(daily1.id === daily2.id, 'Daily challenge ID deterministic for given date');
assert(daily1.title === daily2.title, 'Daily challenge content identical across multiple client calls');

const nextDayTime = testTime + 24 * 60 * 60 * 1000;
const nextDaily = getDeterministicDailyChallenge(nextDayTime);
assert(nextDaily.id !== daily1.id, 'Daily challenge rotates to next day after 24 hours');

const weekly1 = getDeterministicWeeklyChallenge(testTime);
const weekly2 = getDeterministicWeeklyChallenge(testTime + 2 * 24 * 60 * 60 * 1000);
assert(weekly1.id === weekly2.id, 'Weekly challenge remains consistent across the same week');

// Progress evaluation
const mockRun: GameModeSummary = {
  modeId: 'standard-run',
  modeName: 'Standard Run',
  score: 65000,
  finalScore: 65000,
  distance: 3000,
  durationSeconds: 150,
  shardsCollected: 50,
  nearMisses: 10,
  obstaclesPassed: 40,
  worldReached: 'Verdant Wilds',
  isCompleted: false,
  isNewRecord: false,
  breakdown: [],
  xpAwarded: 300,
};

let chal = { ...daily1, targetMetric: 'distance' as const, targetValue: 2500, currentValue: 0, completed: false };
const evalRes = evaluateChallengeProgress(chal, mockRun);
assert(evalRes.newlyCompleted === true, 'Distance challenge newly completed after 3000m run');
assert(evalRes.updatedChallenge.currentValue === 2500, 'Current value clamped to target on completion');

// --- Group 4: Limited-Time Events & Modifiers ---
console.log('\n--- Group 4: Limited-Time Events & Additive Modifiers ---');
const doubleXpEvent = CURATED_EVENTS[0];
assert(isEventActive(doubleXpEvent, doubleXpEvent.startsAt + 10000) === true, 'Double XP event active within time window');
assert(isEventActive(doubleXpEvent, doubleXpEvent.endsAt + 10000) === false, 'Double XP event inactive after endsAt');

const activeMods = getActiveModifiers([doubleXpEvent], doubleXpEvent.startsAt + 10000);
assert(activeMods.length === 1, 'Extracted active event modifiers');
const xpMult = calculateEffectiveXpMultiplier(activeMods);
assert(xpMult === 2.0, 'XP multiplier correctly computes 2.0x during Double XP boost');

const crystalEvent = CURATED_EVENTS[1];
const crystalMods = crystalEvent.modifiers;
const scoreMultCrystal = calculateEffectiveScoreMultiplier(crystalMods, 'crystal-heights');
const scoreMultOther = calculateEffectiveScoreMultiplier(crystalMods, 'sky-isles');
assert(scoreMultCrystal === 1.25, 'Score multiplier active in target world (Crystal Heights)');
assert(scoreMultOther === 1.0, 'Score multiplier neutral in non-target worlds');

// --- Group 5: Mini Season Pass & Permanent Rewards ---
console.log('\n--- Group 5: Mini Season Pass & Permanent Rewards ---');
assert(CURATED_SEASON_PASS_TIERS.length === 5, 'Season pass contains exactly 5 milestone tiers');
const tiersEval1 = evaluateSeasonPassTiers(CURATED_SEASON_PASS_TIERS, 3000, new Set());
assert(tiersEval1[0].isUnlocked === true, 'Tier 1 (1,000 XP) unlocked at 3,000 XP');
assert(tiersEval1[1].isUnlocked === true, 'Tier 2 (2,500 XP) unlocked at 3,000 XP');
assert(tiersEval1[2].isUnlocked === false, 'Tier 3 (5,000 XP) remains locked at 3,000 XP');

const tiersEval2 = evaluateSeasonPassTiers(CURATED_SEASON_PASS_TIERS, 3000, new Set([1]));
assert(tiersEval2[0].isClaimed === true, 'Tier 1 correctly marked as claimed');
assert(tiersEval2[1].isClaimed === false, 'Tier 2 remains unclaimed');

// --- Group 6: In-Game Announcements ---
console.log('\n--- Group 6: In-Game Announcements ---');
const annService = new AnnouncementService();
annService.resetDismissals();
const activeAnnouncements = annService.getActiveAnnouncements([
  {
    id: 'ann_test_01',
    title: 'Update 1.0',
    body: 'Welcome to GoWithFlow',
    priority: 'high',
    startsAt: Date.now() - 1000,
    expiresAt: Date.now() + 100000,
  },
], Date.now());
assert(activeAnnouncements.length === 1, 'Active announcement retrieved successfully');

annService.dismissAnnouncement('ann_test_01');
const afterDismiss = annService.getActiveAnnouncements([
  {
    id: 'ann_test_01',
    title: 'Update 1.0',
    body: 'Welcome to GoWithFlow',
    priority: 'high',
    startsAt: Date.now() - 1000,
    expiresAt: Date.now() + 100000,
  },
], Date.now());
assert(afterDismiss.length === 0, 'Dismissed announcement excluded from active broadcasts');

// --- Group 7: LiveOps Server Snapshot & Emergency Controls ---
console.log('\n--- Group 7: Server Snapshots & Emergency Controls ---');
const snapshot = server.generateSnapshot();
const validation = server.validateSnapshot(snapshot);
assert(validation.isValid === true, 'Generated server snapshot passes schema validation');

server.emergencyDisableEvent('evt_double_xp_launch', 'Mitigating exploit');
const snapshotAfterDisable = server.generateSnapshot();
assert(
  !snapshotAfterDisable.activeEvents.some(e => e.id === 'evt_double_xp_launch'),
  'Emergency disabled event successfully omitted from snapshot'
);

server.emergencyPauseLeaderboards('Scheduled database maintenance');
const pauseStatus = server.isLeaderboardsPaused();
assert(pauseStatus.paused === true, 'Emergency paused leaderboards successfully');
assert(pauseStatus.reason === 'Scheduled database maintenance', 'Leaderboards pause reason recorded');
server.emergencyResumeLeaderboards();
assert(server.isLeaderboardsPaused().paused === false, 'Emergency leaderboard pause resumed cleanly');

// --- Group 8: Client LiveOpsManager & End-to-End Run ---
console.log('\n--- Group 8: Client LiveOpsManager & Run Lifecycle ---');
mockStore.clear();
const secMgr = new SecurityManager();
const progMgr = new ProgressionManager();
const liveOpsMgr = new LiveOpsManager(secMgr);

assert(liveOpsMgr.getActiveSeason().id === 'season_01_skybound', 'LiveOpsManager boots with Season 01');
assert(liveOpsMgr.isOnline() === true, 'LiveOpsManager initializes in online state');

// Test run lifecycle lock
const modifiersLocked = liveOpsMgr.onRunStart();
assert(Array.isArray(modifiersLocked), 'Run start returns locked event modifiers');

// Complete run and evaluate dispatch
const runResult = liveOpsMgr.onRunComplete(mockRun, progMgr);
assert(runResult.seasonalXpGained > 0, 'Seasonal XP credited from completed run');

// Test Claim Challenge Reward
const daily = liveOpsMgr.getDailyChallenge();
daily.completed = true; // force complete for test
const claimRes = liveOpsMgr.claimChallengeReward(daily.id, 'player_test_123', progMgr);
assert(claimRes.success === true, 'Claim challenge reward succeeds');
assert(claimRes.xpAwarded > 0, 'XP awarded from challenge claim');

// Test Duplicate Claim Rejection
const dupClaim = liveOpsMgr.claimChallengeReward(daily.id, 'player_test_123', progMgr);
assert(dupClaim.success === false, 'Duplicate challenge claim rejected idempotently');

// Test Seasonal Statistics
const stats = liveOpsMgr.getSeasonalStatistics();
assert(stats.seasonId === 'season_01_skybound', 'Seasonal stats reflect active season');
assert(stats.highestScore === 65000, 'Seasonal stats record highest score');
assert(stats.longestDistance === 3000, 'Seasonal stats record longest distance');

// Test Offline / Storage Corruption Defense
mockStore.set(LIVEOPS_STORAGE_KEY_CACHE, '{ malformed: json [');
const recoveredMgr = new LiveOpsManager(secMgr);
assert(recoveredMgr.getActiveSeason().name.includes('Skybound'), 'Corrupted cache safely recovers without crashing');

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
