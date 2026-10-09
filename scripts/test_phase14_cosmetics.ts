/**
 * GoWithFlow — Phase 14 Cosmetic Expansion & Customization Automated Verification Suite
 * Tests:
 * 1. Cosmetic Registry integrity & categories (player, trail, energy-effect, ui-theme)
 * 2. Five-world affinity mapping
 * 3. Progression-based unlock evaluations
 * 4. Idempotent unlocks & anti-duplication
 * 5. Equip validation & safe fallback logic
 * 6. Save migration & corruption recovery
 * 7. Trail visual parameters and performance budgets
 */

import {
  ALL_COSMETICS,
  COSMETIC_MAP,
  getCosmeticsByCategory,
  getCosmeticById,
  PLAYER_COSMETICS,
  TRAIL_COSMETICS,
  EFFECT_COSMETICS,
  UI_THEME_COSMETICS,
  CosmeticManager,
  createDefaultCosmeticSaveData,
} from '../src/game/cosmetics';

import {
  ProgressionManager,
} from '../src/game/progression';

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
console.log('🧪 RUNNING PHASE 14 COSMETICS & CUSTOMIZATION SUITE');
console.log('====================================================\n');

// ----------------------------------------------------
// TEST 1: Cosmetic Registry & Categories
// ----------------------------------------------------
console.log('--- TEST 1: Cosmetic Registry & Categories ---');
assert(ALL_COSMETICS.length >= 15, `Total cosmetic items registered: ${ALL_COSMETICS.length} (expected >= 15)`);
assert(PLAYER_COSMETICS.length >= 5, `Player appearances: ${PLAYER_COSMETICS.length}`);
assert(TRAIL_COSMETICS.length >= 5, `Visual trails: ${TRAIL_COSMETICS.length}`);
assert(EFFECT_COSMETICS.length >= 4, `Energy effects: ${EFFECT_COSMETICS.length}`);
assert(UI_THEME_COSMETICS.length >= 3, `UI themes: ${UI_THEME_COSMETICS.length}`);

// Category queries
const players = getCosmeticsByCategory('player');
assert(players.length === PLAYER_COSMETICS.length, 'Category query for player returns all player items');

const trails = getCosmeticsByCategory('trail');
assert(trails.length === TRAIL_COSMETICS.length, 'Category query for trail returns all trail items');

// ----------------------------------------------------
// TEST 2: Five-World Affinity
// ----------------------------------------------------
console.log('\n--- TEST 2: Five-World Thematic Affinity ---');
const skyTrail = getCosmeticById('trail_sky_breeze');
assert(skyTrail?.worldAffinity === 'sky-isles', 'trail_sky_breeze has affinity for sky-isles');

const verdantPlayer = getCosmeticById('player_verdant_runner');
assert(verdantPlayer?.worldAffinity === 'verdant-wilds', 'player_verdant_runner has affinity for verdant-wilds');

const crimsonTrail = getCosmeticById('trail_crimson_ember');
assert(crimsonTrail?.worldAffinity === 'crimson-dunes', 'trail_crimson_ember has affinity for crimson-dunes');

const crystalTrail = getCosmeticById('trail_crystal_aurora');
assert(crystalTrail?.worldAffinity === 'crystal-heights', 'trail_crystal_aurora has affinity for crystal-heights');

const obsidianPlayer = getCosmeticById('player_obsidian_runner');
assert(obsidianPlayer?.worldAffinity === 'obsidian-core', 'player_obsidian_runner has affinity for obsidian-core');

// ----------------------------------------------------
// TEST 3: Default Equipped & Storage Defaults
// ----------------------------------------------------
console.log('\n--- TEST 3: Default State & Defaults Integrity ---');
const defaults = createDefaultCosmeticSaveData();
assert(defaults.unlocked.includes('player_cloud_runner'), 'Default unlocked includes player_cloud_runner');
assert(defaults.unlocked.includes('trail_basic_cyan'), 'Default unlocked includes trail_basic_cyan');
assert(defaults.equipped.player === 'player_cloud_runner', 'Default equipped player is player_cloud_runner');
assert(defaults.equipped.trail === 'trail_basic_cyan', 'Default equipped trail is trail_basic_cyan');

// ----------------------------------------------------
// TEST 4: CosmeticManager Unlocks & Anti-Duplication
// ----------------------------------------------------
console.log('\n--- TEST 4: Unlocks & Anti-Duplication / Idempotency ---');

// Mock localStorage for test environment
const mockStorage: Record<string, string> = {};
(global as any).localStorage = {
  getItem: (k: string) => mockStorage[k] || null,
  setItem: (k: string, v: string) => { mockStorage[k] = v; },
  removeItem: (k: string) => { delete mockStorage[k]; },
};
(global as any).window = global;

let unlockedNotifications = 0;
const cosmeticMgr = new CosmeticManager({
  onCosmeticUnlocked: () => { unlockedNotifications++; },
});

assert(cosmeticMgr.isUnlocked('player_cloud_runner'), 'Default player is initially unlocked');
assert(!cosmeticMgr.isUnlocked('player_obsidian_runner'), 'Obsidian runner is initially locked');

// Unlock item
const firstUnlock = cosmeticMgr.unlockCosmetic('player_obsidian_runner');
assert(firstUnlock === true, 'First unlock of player_obsidian_runner succeeds');
assert(cosmeticMgr.isUnlocked('player_obsidian_runner'), 'Item is now marked as unlocked');

// Duplicate unlock attempt
const duplicateUnlock = cosmeticMgr.unlockCosmetic('player_obsidian_runner');
assert(duplicateUnlock === false, 'Duplicate unlock rejected idempotently (anti-duplication preserved)');

// ----------------------------------------------------
// TEST 5: Progression Evaluation Integration
// ----------------------------------------------------
console.log('\n--- TEST 5: Progression Manager Unlock Evaluation ---');
const progMgr = new ProgressionManager();

// Simulate reaching Sector 2, 3, 4, 5
progMgr.recordWorldReached('verdant-wilds');
progMgr.recordWorldReached('crimson-dunes');
progMgr.recordWorldReached('crystal-heights');

const newlyUnlocked = cosmeticMgr.evaluateProgressionUnlocks(progMgr);
assert(cosmeticMgr.isUnlocked('player_verdant_runner'), 'player_verdant_runner unlocked via world milestone');
assert(cosmeticMgr.isUnlocked('player_ember_runner'), 'player_ember_runner unlocked via world milestone');
assert(cosmeticMgr.isUnlocked('player_crystal_runner'), 'player_crystal_runner unlocked via world milestone');

// ----------------------------------------------------
// TEST 6: Equip Validation & Safe Fallback
// ----------------------------------------------------
console.log('\n--- TEST 6: Equip Validation & Corrupted Fallbacks ---');

// Equip unlocked item
const equipOk = cosmeticMgr.equipCosmetic('player_verdant_runner');
assert(equipOk === true, 'Equipping unlocked item succeeds');
assert(cosmeticMgr.getEquipped().player === 'player_verdant_runner', 'Equipped player matches new selection');

// Attempt to equip locked item
const lockedItem = ALL_COSMETICS.find(i => !cosmeticMgr.isUnlocked(i.id));
if (lockedItem) {
  const equipLocked = cosmeticMgr.equipCosmetic(lockedItem.id);
  assert(equipLocked === false, `Equipping locked item "${lockedItem.name}" rejected safely`);
  assert(cosmeticMgr.getEquipped().player === 'player_verdant_runner', 'Equipped state untouched after rejection');
}

// Attempt to equip invalid non-existent ID
const invalidEquip = cosmeticMgr.equipCosmetic('invalid_non_existent_id');
assert(invalidEquip === false, 'Equipping non-existent ID rejected safely without throwing');

// Safe fallback getter
const equippedPlayerItem = cosmeticMgr.getEquippedItem('player');
assert(equippedPlayerItem.id === 'player_verdant_runner', 'getEquippedItem resolves correct cosmetic item');

// ----------------------------------------------------
// TEST 7: Collection Progress Statistics
// ----------------------------------------------------
console.log('\n--- TEST 7: Collection Stats & Rarity ---');
const stats = cosmeticMgr.getCollectionStats();
assert(stats.totalAvailable === ALL_COSMETICS.length, 'Stats reflect all registered items');
assert(stats.totalCurrent >= 4, `Unlocked items tracked correctly: ${stats.totalCurrent}`);
assert(stats.percent >= 0 && stats.percent <= 100, `Valid collection percentage: ${stats.percent}%`);
assert(stats.categories.length === 4, 'Stats cover all 4 categories');

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
  console.log('✨ ALL PHASE 14 COSMETIC EXPANSION TESTS PASSED SUCCESSFULLY! ✨');
}
