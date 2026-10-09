/**
 * GoWithFlow — Phase 17 Security & Integrity Test Suite
 * Validates cryptographic tokens, RBAC, rate-limiting, score recalculation,
 * replay protection, storage sanitization, and currency/reward integrity.
 */

import {
  SecurityManager,
  AuthService,
  AuthorizationGuard,
  ScoreValidationPipeline,
  RateLimiter,
  StorageSanitizer,
  RewardIntegrityService,
  CurrencyIntegrityService,
} from '../src/game/security';
import { AuthoritativeCompetitiveRun } from '../src/game/security/securityConfig';
import { CURRENT_SEASON_ID } from '../src/game/social/socialConfig';

// Mock localStorage for Node test runner
const mockStore = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => mockStore.get(k) || null,
  setItem: (k: string, v: string) => mockStore.set(k, v),
  removeItem: (k: string) => mockStore.delete(k),
  clear: () => mockStore.clear(),
};
(globalThis as any).window = globalThis;

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
console.log('🔒 Phase 17: Security & Competitive Integrity Test Suite');
console.log('====================================================\n');

// --- Group 1: Cryptographic Authentication & Session Tokens ---
console.log('--- Group 1: Cryptographic Tokens & Session Lifecycle ---');
const auth = new AuthService();
const sessionA = auth.createSession('usr_test_alpha', 'AlphaRunner', 'player');
const sessionB = auth.createSession('usr_test_beta', 'BetaRunner', 'moderator');

assert(sessionA.token.startsWith('sk_sess_'), 'Session token begins with sk_sess_ prefix');
assert(sessionA.token.length >= 32, 'Session token has high entropy (>= 32 chars)');
assert(sessionA.token !== sessionB.token, 'Consecutive tokens are unique');
assert(sessionA.nonce.length >= 8, 'Session includes cryptographic nonce');

const validA = auth.validateSession(sessionA.token);
assert(validA !== null && validA.playerId === 'usr_test_alpha', 'Valid session resolves cleanly');

auth.revokeSession(sessionA.token);
const revokedA = auth.validateSession(sessionA.token);
assert(revokedA === null, 'Revoked session fails validation');

// --- Group 2: Role-Based Access Control (RBAC) ---
console.log('\n--- Group 2: Role-Based Access Control (RBAC) ---');
const playerSession = auth.createSession('usr_player', 'PlayerOne', 'player');
const adminSession = auth.createSession('usr_admin', 'AdminUser', 'admin');

assert(AuthorizationGuard.canSubmitRun(playerSession, 'usr_player').authorized === true, 'Player can submit own run');
assert(AuthorizationGuard.canSubmitRun(playerSession, 'usr_other').authorized === false, 'Player cannot submit for another user');
assert(AuthorizationGuard.canModerate(playerSession).authorized === false, 'Player cannot access moderation');
assert(AuthorizationGuard.canModerate(adminSession).authorized === true, 'Admin has moderation access');
assert(AuthorizationGuard.canAdminister(adminSession).authorized === true, 'Admin has full administration access');

// --- Group 3: Sliding Window Rate Limiting ---
console.log('\n--- Group 3: Sliding Window Rate Limiting ---');
const limiter = new RateLimiter();
// Policy: 5 run submissions per 60s
let submissionsAllowed = 0;
for (let i = 0; i < 7; i++) {
  const check = limiter.check('run_submission', 'player_speed_tester');
  if (check.allowed) submissionsAllowed++;
}
assert(submissionsAllowed === 5, 'Rate limiter permits exactly 5 requests within sliding window');
const blockedCheck = limiter.check('run_submission', 'player_speed_tester');
assert(blockedCheck.allowed === false, 'Subsequent request is rejected by rate limiter');
assert(blockedCheck.retryAfterSeconds > 0, 'Rate limiter returns positive retry cooldown');

// --- Group 4: Authoritative Score Validation Pipeline ---
console.log('\n--- Group 4: Authoritative Score Validation & Anti-Cheat ---');
const pipeline = new ScoreValidationPipeline();

const legitimateRun: AuthoritativeCompetitiveRun = {
  submissionId: 'sub_legit_001',
  playerId: 'player_honest',
  username: 'HonestRunner',
  modeId: 'score-attack',
  seasonId: CURRENT_SEASON_ID,
  score: 45000,
  distance: 3000,
  durationMs: 150000, // 150s -> 20 m/s average speed
  worldReached: 'Verdant Wilds',
  shardsCollected: 30,
  nearMisses: 8,
  obstaclesPassed: 25,
  revivesUsed: 0,
  submittedAt: Date.now(),
};

const legitResult = pipeline.validate(legitimateRun);
assert(legitResult.isValid === true, 'Legitimate physics run passes validation');

// Test NaN / Infinity Fuzzing
const nanRun = { ...legitimateRun, score: NaN };
assert(pipeline.validate(nanRun).isValid === false, 'NaN score rejected');

const infRun = { ...legitimateRun, distance: Infinity };
assert(pipeline.validate(infRun).isValid === false, 'Infinity distance rejected');

// Test Superluminal Speed (> 25 m/s)
const warpRun: AuthoritativeCompetitiveRun = {
  ...legitimateRun,
  distance: 10000,
  durationMs: 10000, // 1000 m/s -> impossible
};
const warpResult = pipeline.validate(warpRun);
assert(warpResult.isValid === false, 'Superluminal velocity run rejected');

// Test Replay Deduplication
const dupResult = pipeline.validate(legitimateRun);
assert(dupResult.isValid === false, 'Duplicate run replay attack rejected');

// --- Group 5: Storage Sanitizer (XSS & Prototype Pollution Defense) ---
console.log('\n--- Group 5: Storage Sanitizer Defense ---');
mockStore.clear();

// 1. Prototype Pollution Filtering
const maliciousObject = JSON.parse('{"__proto__": {"polluted": true}, "validKey": "validValue"}');
StorageSanitizer.safeSetItem('skyflow_pollute_test', maliciousObject);
const retrieved = StorageSanitizer.safeGetItem<any>('skyflow_pollute_test', null);
assert(retrieved.validKey === 'validValue', 'Legitimate key preserved');
assert((Object.prototype as any).polluted === undefined, 'Prototype pollution vector stripped');

// 2. XSS Tag Stripping
StorageSanitizer.safeSetItem('skyflow_xss_test', '<script>alert("hacked")</script>Hello World');
const xssRetrieved = StorageSanitizer.safeGetItem<string>('skyflow_xss_test', '');
assert(!xssRetrieved.includes('<script>'), 'Script tags stripped during storage');
assert(xssRetrieved.includes('Hello World'), 'Safe content preserved');

// 3. Graceful JSON Parse Recovery
mockStore.set('skyflow_corrupt_test', '{ not valid json');
const recovered = StorageSanitizer.safeGetItem('skyflow_corrupt_test', { fallback: true });
assert(recovered.fallback === true, 'Corrupted JSON falls back safely without throwing');

// --- Group 6: Currency & Reward Integrity ---
console.log('\n--- Group 6: Currency & Reward Integrity ---');
const currency = new CurrencyIntegrityService();
const initialBalance = currency.getBalance('usr_wallet_test');
assert(initialBalance === 0, 'Fresh wallet balance starts at 0');

const creditRes = currency.credit('usr_wallet_test', 250, 'reward_grant', 'ref_grant_01');
assert(creditRes.success === true && creditRes.newBalance === 250, 'Currency credited cleanly (250 shards)');

const debitRes = currency.debit('usr_wallet_test', 100, 'cosmetic_purchase', 'item_skin_01');
assert(debitRes.success === true && debitRes.newBalance === 150, 'Currency debited cleanly (150 shards remaining)');

const overDebit = currency.debit('usr_wallet_test', 500, 'cosmetic_purchase', 'item_expensive');
assert(overDebit.success === false, 'Over-debit rejected (cannot produce negative balance)');
assert(currency.getBalance('usr_wallet_test') === 150, 'Balance invariant strictly maintained');

// Reward Idempotency
const rewards = new RewardIntegrityService();
const firstClaim = rewards.claimReward('usr_reward_test', 'achievement', 'ach_first_flight', { xp: 50 });
assert(firstClaim.granted === true && firstClaim.alreadyClaimed === false, 'First reward claim succeeds');

const secondClaim = rewards.claimReward('usr_reward_test', 'achievement', 'ach_first_flight', { xp: 50 });
assert(secondClaim.granted === false && secondClaim.alreadyClaimed === true, 'Duplicate reward claim idempotently rejected');

console.log('\n====================================================');
console.log(`TOTAL TESTS: ${passed + failed}`);
console.log(`PASSED: ${passed}`);
console.log(`FAILED: ${failed}`);
console.log('====================================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
