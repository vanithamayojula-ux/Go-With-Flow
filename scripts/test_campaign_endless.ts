/**
 * GoWithFlow — Comprehensive Campaign & Endless Mode Test Suite
 * Verifies:
 * - 5-World Campaign Progression Structure (0 - 11,250m)
 * - Objective evaluation, Star rating (1-3 stars/world, 15 total), and rewards
 * - Offline persistence in localStorage with corrupted save recovery
 * - Increasing challenge between worlds (speed & obstacle scaling)
 * - World completion feedback & Obsidian Core campaign victory
 * - Independent Endless Mode with infinite 5-world looping (Loop 1, Loop 2...)
 * - Increasing difficulty over distance & loop count
 * - Local records storage for Endless distance and score
 * - Mode independence: zero cross-mode state corruption
 */

import { CampaignManager } from '../src/game/campaign/CampaignManager';
import {
  WORLD_CAMPAIGN_CONFIGS,
  CAMPAIGN_WORLD_ORDER,
  CAMPAIGN_STORAGE_KEY,
  CAMPAIGN_TOTAL_DISTANCE,
} from '../src/game/campaign/campaignConfig';
import { CampaignRunMode } from '../src/game/modes/campaignRun';
import {
  EndlessRunMode,
  ENDLESS_STORAGE_KEY,
  loadEndlessRecords,
  saveEndlessRecords,
} from '../src/game/modes/endlessRun';
import { GameModeManager } from '../src/game/modes/GameModeManager';
import { WorldTransitionManager } from '../src/game/systems/worldTransition/WorldTransitionManager';
import { PlayerStats } from '../src/types';

// Mock browser localStorage
const mockStorage: Record<string, string> = {};
(global as any).localStorage = {
  getItem: (k: string) => (k in mockStorage ? mockStorage[k] : null),
  setItem: (k: string, v: string) => { mockStorage[k] = String(v); },
  removeItem: (k: string) => { delete mockStorage[k]; },
  clear: () => { for (const k in mockStorage) delete mockStorage[k]; },
};

function createMockStats(overrides: Partial<PlayerStats> = {}): PlayerStats {
  return {
    speed: 24,
    maxSpeed: 150,
    distance: 0,
    score: 0,
    highScore: 10000,
    styleMeter: 30,
    styleTier: 'Breeze',
    overdriveMeter: 40,
    overdriveTier: 'Charged',
    comboTier: 'blue',
    airTime: 0,
    isGrounded: true,
    combo: 0,
    windOrbsCollected: 0,
    dataShardsCollected: 0,
    currentBiome: 'sky-realm',
    currentWorldId: 'sky-isles',
    currentFriction: 0.005,
    activeTrickName: null,
    slowMoActive: false,
    isOnFloatingIsland: false,
    currentLane: 0,
    isSliding: false,
    slideTimer: 0,
    isGrinding: false,
    isBoosting: false,
    boostEnergy: 100,
    activePowerUps: {
      magnetTimer: 0,
      jetpackTimer: 0,
      hoverboardShield: false,
      multiplierTimer: 0,
    },
    scoreMultiplier: 1,
    gameState: 'playing',
    nearMissCount: 0,
    stumbles: 0,
    ...overrides,
  };
}

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${testName}`);
  } else {
    failed++;
    console.error(`  ✕ FAILED: ${testName}`);
  }
}

console.log('================================================================');
console.log('🎮 GoWithFlow — Campaign & Endless Modes Verification Suite');
console.log('================================================================\n');

// Group 1: 5-World Campaign Structure & Configuration
console.log('--- Group 1: 5-World Campaign Structure ---');
assert(CAMPAIGN_WORLD_ORDER.length === 5, 'Campaign order contains exactly 5 worlds');
assert(CAMPAIGN_WORLD_ORDER[0] === 'sky-isles', 'Sector 1 is Sky Isles');
assert(CAMPAIGN_WORLD_ORDER[1] === 'verdant-wilds', 'Sector 2 is Verdant Wilds');
assert(CAMPAIGN_WORLD_ORDER[2] === 'crimson-dunes', 'Sector 3 is Crimson Dunes');
assert(CAMPAIGN_WORLD_ORDER[3] === 'crystal-heights', 'Sector 4 is Crystal Heights');
assert(CAMPAIGN_WORLD_ORDER[4] === 'obsidian-core', 'Sector 5 is Obsidian Core');
assert(CAMPAIGN_TOTAL_DISTANCE === 11250, 'Total campaign length is 11,250m');

// Verify increasing challenge across the 5 worlds
let prevSpeed = 0;
let prevGap = 2.0;
for (const wId of CAMPAIGN_WORLD_ORDER) {
  const cfg = WORLD_CAMPAIGN_CONFIGS[wId];
  assert(cfg.speedMultiplier > prevSpeed, `${cfg.name} has escalating speed multiplier (${cfg.speedMultiplier}x > ${prevSpeed}x)`);
  assert(cfg.obstacleGapMultiplier <= prevGap, `${cfg.name} has tightening obstacle gap spacing (${cfg.obstacleGapMultiplier}x <= ${prevGap}x)`);
  prevSpeed = cfg.speedMultiplier;
  prevGap = cfg.obstacleGapMultiplier;
}

// Group 2: Campaign Progression, Objectives & Star Evaluation
console.log('\n--- Group 2: Campaign Progression & Objectives ---');
localStorage.clear();
const campaignMgr = new CampaignManager();
assert(campaignMgr.highestSectorUnlocked === 1, 'Initial campaign state starts at Sector 1');
assert(campaignMgr.isWorldUnlocked('sky-isles') === true, 'Sky Isles unlocked by default');
assert(campaignMgr.isWorldUnlocked('verdant-wilds') === false, 'Verdant Wilds locked initially');

campaignMgr.onRunStart();
// Simulate player completing Sector 1 (Sky Isles) with 20 shards and no revive
const s1Stats = createMockStats({ distance: 2300, dataShardsCollected: 25, score: 7500 });
const resS1 = campaignMgr.evaluateSectorProgress(s1Stats);
assert(resS1 !== null, 'Sector 1 completion detected at 2,300m');
assert(resS1?.isNewUnlock === true, 'Sector 1 completion unlocks next sector');
assert(campaignMgr.highestSectorUnlocked === 2, 'Highest sector unlocked is now Sector 2 (Verdant Wilds)');
assert(campaignMgr.isWorldUnlocked('verdant-wilds') === true, 'Verdant Wilds is now unlocked');
assert(resS1?.starsEarned === 3, 'All 3 objectives achieved on clean Sector 1 run (⭐⭐⭐)');

// Simulate player completing through to Obsidian Core (Sector 5, 11,250m)
const s5Stats = createMockStats({
  distance: 11300,
  dataShardsCollected: 65,
  score: 45000,
  overdriveTier: 'Max-Velocity',
  overdriveMeter: 100,
});
// Update campaign manager with the max overdrive achievement
campaignMgr.update(s5Stats);
const resS5 = campaignMgr.evaluateSectorProgress(s5Stats);
assert(resS5 !== null, 'Obsidian Core completion detected at 11,300m');
assert(resS5?.isCampaignComplete === true, 'Final sector triggers isCampaignComplete flag');
assert(campaignMgr.isCampaignCompleted() === true, 'CampaignManager records campaignCompleted: true');
assert(campaignMgr.getTotalStarsEarned() > 0, 'Stars earned recorded across campaign');

// Group 3: Campaign Offline Persistence & Corrupted Save Handling
console.log('\n--- Group 3: Campaign Persistence & Fault Tolerance ---');
// Verify saved state in localStorage
const savedRaw = localStorage.getItem(CAMPAIGN_STORAGE_KEY);
assert(savedRaw !== null && savedRaw.length > 0, 'Campaign state persisted to localStorage');
const restoredMgr = new CampaignManager();
assert(restoredMgr.isCampaignCompleted() === true, 'Restored CampaignManager preserves completed state');
assert(restoredMgr.highestSectorUnlocked >= 2, 'Restored CampaignManager preserves unlocked sectors');

// Test corrupted JSON recovery
localStorage.setItem(CAMPAIGN_STORAGE_KEY, '{invalid_json--bad_format');
const recoveredMgr = new CampaignManager();
assert(recoveredMgr.highestSectorUnlocked === 1, 'Corrupted save safely falls back to default state (Sector 1)');
assert(recoveredMgr.isCampaignCompleted() === false, 'Corrupted save safely resets campaignCompleted flag');

// Group 4: Endless Mode World Looping & Difficulty Scaling
console.log('\n--- Group 4: Endless Mode Looping & Difficulty Scaling ---');
localStorage.clear();
const transitionMgr = new WorldTransitionManager();
transitionMgr.setLooping(true);

// Loop 1 checks
const t0 = transitionMgr.update(500);
assert(t0.metrics.currentWorldId === 'sky-isles', '0 - 2,250m is Sky Isles (Loop 1)');
const t1 = transitionMgr.update(3000);
assert(t1.metrics.currentWorldId === 'verdant-wilds', '2,250 - 4,500m is Verdant Wilds (Loop 1)');
const t4 = transitionMgr.update(10000);
assert(t4.metrics.currentWorldId === 'obsidian-core', '9,000 - 11,250m is Obsidian Core (Loop 1)');

// Loop 2 transition boundary check (at 11,250m)
const tLoop2Approach = transitionMgr.update(11100);
assert(tLoop2Approach.metrics.nextWorldId === 'sky-isles', 'At end of Obsidian Core, next world smoothly targets Sky Isles (Loop 2)');
assert(tLoop2Approach.metrics.isTransitioning === true, 'Transition corridor active approaching 11,250m boundary');

// Crossing into Loop 2 at 11,500m
const tLoop2 = transitionMgr.update(11500);
assert(tLoop2.metrics.currentWorldId === 'sky-isles', '11,250 - 13,500m loops back into Sky Isles (Loop 2)');
assert(tLoop2.metrics.loopNumber === 2, 'Loop counter correctly reports Loop 2');

// Loop 3 at 23,000m
const tLoop3 = transitionMgr.update(23000);
assert(tLoop3.metrics.loopNumber === 3, '23,000m reaches Loop 3');

// Group 5: Endless Mode Records Persistence
console.log('\n--- Group 5: Endless Records Persistence ---');
localStorage.clear();
const endlessMode = new EndlessRunMode();
endlessMode.initialize();
assert(endlessMode.getRecords().longestDistance === 0, 'Initial endless longest distance is 0');

// Simulate a run reaching 7,500m with 18,000 score
endlessMode.onGameOver(createMockStats({ distance: 7500, score: 18000 }));
const rec1 = loadEndlessRecords();
assert(rec1.longestDistance === 7500, 'Endless longest distance 7,500m persisted locally');
assert(rec1.highestScore === 18000, 'Endless highest score 18,000 persisted locally');

// Second run with lower distance does not overwrite personal best
const endlessMode2 = new EndlessRunMode();
endlessMode2.initialize();
endlessMode2.onGameOver(createMockStats({ distance: 4200, score: 9500 }));
const rec2 = loadEndlessRecords();
assert(rec2.longestDistance === 7500, 'Personal best distance preserved across shorter runs');
assert(rec2.highestScore === 18000, 'Personal best score preserved across lower-scoring runs');

// Group 6: Cross-Mode Isolation & Integrity
console.log('\n--- Group 6: Mode Independence & Non-Corruption ---');
// Verify resetting Campaign does NOT affect Endless
const endlessBefore = loadEndlessRecords();
assert(endlessBefore.longestDistance === 7500, 'Endless record present before campaign reset');

const campMgrToReset = new CampaignManager();
campMgrToReset.resetCampaignProgress();
assert(campMgrToReset.highestSectorUnlocked === 1, 'Campaign reset to Sector 1');

const endlessAfter = loadEndlessRecords();
assert(endlessAfter.longestDistance === 7500, 'Endless records untouched by Campaign reset');
assert(endlessAfter.highestScore === 18000, 'Endless high score untouched by Campaign reset');

// Verify GameModeManager mode switches
const modeMgr = new GameModeManager(campMgrToReset);
modeMgr.setMode('campaign');
assert(modeMgr.activeModeId === 'campaign', 'Mode switched to Campaign');
assert(modeMgr.activeMode.name === 'Campaign Mode', 'Active mode reports Campaign Mode');

modeMgr.setMode('endless');
assert(modeMgr.activeModeId === 'endless', 'Mode switched to Endless');
assert(modeMgr.activeMode.name === 'Endless Mode', 'Active mode reports Endless Mode');

console.log('\n================================================================');
console.log(`TOTAL TESTS: ${passed + failed}`);
console.log(`PASSED: ${passed}`);
console.log(`FAILED: ${failed}`);
console.log('================================================================');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
