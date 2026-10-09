/**
 * GoWithFlow — Phase 16 Automated Test & Verification Suite
 * Tests Social Architecture, Profiles, Online Leaderboard Service, Friend Challenges,
 * Share Cards, Server-Side Anti-Cheat Validation, Rate Limiting, Privacy & Offline Queuing.
 */

import {
  SocialManager,
  ProfileService,
  LeaderboardService,
  ChallengeService,
  RunSubmissionValidator,
  CURRENT_SEASON_ID,
  RunSubmission,
} from '../src/game/social';
import { ProgressionManager } from '../src/game/progression';
import { GameModeSummary } from '../src/game/modes';

// Mock localStorage for node environment
const storageMock: Record<string, string> = {};
(global as any).localStorage = {
  getItem: (k: string) => storageMock[k] || null,
  setItem: (k: string, v: string) => { storageMock[k] = String(v); },
  removeItem: (k: string) => { delete storageMock[k]; },
  clear: () => { for (const k in storageMock) delete storageMock[k]; },
};

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
console.log('🏆 Phase 16: Social Features, Leaderboards & Replay');
console.log('====================================================\n');

// Group 1: Player Profile & Identity
console.log('--- Group 1: Player Profile & Identity ---');
const profileSvc = new ProfileService();
const prof = profileSvc.getProfile();
assert(prof.accountType === 'guest', 'Fresh player initializes as guest account');
assert(prof.username.length >= 3, 'Guest receives valid default username');
assert(prof.privacy.showOnLeaderboards === true, 'Default privacy permits leaderboard rankings');

// Username Sanitization Tests
const validRename = profileSvc.updateUsername('Aero_Pilot99');
assert(validRename.success === true, 'Valid alphanumeric username accepted');
assert(profileSvc.getProfile().username === 'Aero_Pilot99', 'Username updated in profile state');

const shortRename = profileSvc.updateUsername('ab');
assert(shortRename.success === false, 'Too-short username (<3 chars) rejected');

const badCharRename = profileSvc.updateUsername('bad*user!');
assert(badCharRename.success === false, 'Special character username rejected');

// Privacy Update
profileSvc.updatePrivacy({ showOnLeaderboards: false });
assert(profileSvc.getProfile().privacy.showOnLeaderboards === false, 'Privacy settings updated cleanly');
profileSvc.updatePrivacy({ showOnLeaderboards: true }); // revert for subsequent tests

// Group 2: Server-Side Run Validation & Anti-Cheat
console.log('\n--- Group 2: Anti-Cheat & Server-Side Run Validation ---');
const validRun: RunSubmission = {
  submissionId: 'sub_test_01',
  playerId: prof.id,
  username: prof.username,
  modeId: 'score-attack',
  score: 45000,
  distance: 3500,
  durationMs: 180000, // 3 minutes
  worldReached: 'Crimson Dunes',
  shardsCollected: 30,
  nearMisses: 5,
  obstaclesPassed: 40,
  revivesUsed: 0,
  seasonId: CURRENT_SEASON_ID,
  timestamp: Date.now(),
};

const validRes = RunSubmissionValidator.validate(validRun);
assert(validRes.isValid === true, 'Legitimate run passes server validation');

// Anomaly 1: Superluminal speed (e.g. 50,000m in 10 seconds -> 5,000 m/s)
const speedHackRun: RunSubmission = {
  ...validRun,
  distance: 50000,
  durationMs: 10000, // 10s
};
const speedRes = RunSubmissionValidator.validate(speedHackRun);
assert(speedRes.isValid === false, 'Superluminal impossible speed rejected');
assert(speedRes.antiCheatFlags?.includes('IMPOSSIBLE_SUPERLUMINAL_VELOCITY') === true, 'Flagged with IMPOSSIBLE_SUPERLUMINAL_VELOCITY');

// Anomaly 2: Disproportionate score density (e.g. 10,000,000 pts for 500m)
const scoreHackRun: RunSubmission = {
  ...validRun,
  score: 10000000,
  distance: 500,
  durationMs: 40000,
};
const scoreRes = RunSubmissionValidator.validate(scoreHackRun);
assert(scoreRes.isValid === false, 'Disproportionate score-to-distance ratio rejected');
assert(scoreRes.antiCheatFlags?.includes('IMPOSSIBLE_SCORE_DENSITY') === true, 'Flagged with IMPOSSIBLE_SCORE_DENSITY');

// Signature Generation
const sig = RunSubmissionValidator.signSubmission(validRun);
assert(sig.startsWith('sig_'), 'Generated tamper-evident client signature');

// Group 3: Online Leaderboard Service
console.log('\n--- Group 3: Online Leaderboard Service ---');
const leaderSvc = new LeaderboardService();
const initialBoard = leaderSvc.getLeaderboard('score', 'seasonal', 'all');
assert(initialBoard.length >= 5, 'Leaderboard seeded with community benchmark entries');

// Submit valid run
const subRes = leaderSvc.submitRun(validRun);
assert(subRes.success === true, 'Run successfully ranked on leaderboard');

const updatedBoard = leaderSvc.getLeaderboard('score', 'seasonal', 'all');
const playerEntry = updatedBoard.find(e => e.playerId === prof.id);
assert(playerEntry !== undefined, 'Player entry now present on leaderboard');
assert(playerEntry?.score === 45000, 'Score matches submitted value');

// Player rank lookup
const pRank = leaderSvc.getPlayerRank(prof.id);
assert(pRank.rank > 0, 'Player rank correctly computed');

// Test Offline Queuing & Flush
const offlineRun: RunSubmission = {
  ...validRun,
  submissionId: 'sub_offline_02',
  score: 52000,
  distance: 4000,
  durationMs: 200000,
};
leaderSvc.queueOfflineRun(offlineRun);
const synced = leaderSvc.flushOfflineQueue();
assert(synced === 1, 'Offline queued run successfully synced upon reconnection');

// Group 4: Friend Challenges
console.log('\n--- Group 4: Friend Challenges ---');
const chalSvc = new ChallengeService();
const activeChals = chalSvc.getActiveChallenges();
assert(activeChals.length >= 2, 'Friend challenges loaded active challenges');

const newChal = chalSvc.createChallenge(
  prof.id,
  prof.username,
  'score-attack',
  60000,
  5000,
  'Crimson Dunes'
);
assert(newChal.challengerName === prof.username, 'Challenge created with challenger username');
assert(newChal.targetScore === 60000, 'Challenge target score recorded');

// Evaluate opponent loss
const lossRes = chalSvc.evaluateOpponentRun(newChal.id, 45000, 'opp_01');
assert(lossRes.isWon === false, 'Opponent score lower than target results in loss');

// Evaluate opponent win with progression reward
const progMgr = new ProgressionManager();
const initialProgXp = progMgr.getData().xp;
const winRes = chalSvc.evaluateOpponentRun(newChal.id, 65000, 'opp_01', progMgr);
assert(winRes.isWon === true, 'Opponent score beating target results in victory');
assert(winRes.xpAwarded === 300, 'Reward XP awarded for challenge completion');
assert(progMgr.getData().xp > initialProgXp, 'XP credited to ProgressionManager');

// Idempotent duplicate claim check
const dupRes = chalSvc.evaluateOpponentRun(newChal.id, 70000, 'opp_01', progMgr);
assert(dupRes.xpAwarded === 0, 'Duplicate reward claim rejected idempotently');

// Group 5: Shareable Result Cards & SocialManager
console.log('\n--- Group 5: Shareable Run Cards & SocialManager ---');
const socialMgr = new SocialManager();
const activeProfile = socialMgr.profileService.getProfile();
const mockSummary: GameModeSummary = {
  modeId: 'score-attack',
  modeName: 'Score Attack',
  score: 82450,
  finalScore: 82450,
  distance: 6400,
  durationSeconds: 320,
  shardsCollected: 45,
  nearMisses: 12,
  obstaclesPassed: 65,
  worldReached: 'Crystal Heights',
  isCompleted: false,
  isNewRecord: true,
  breakdown: [
    { label: 'Distance Progression', value: '6,400m' },
    { label: 'Near Miss Grazes', value: '+3,000' },
  ],
  xpAwarded: 650,
};

const card = socialMgr.generateShareCard(mockSummary);
assert(card.playerName === activeProfile.username, 'Share card includes pilot name');
assert(card.score === 82450, 'Share card reflects score');
assert(card.worldReached.includes('CRYSTAL HEIGHTS'), 'Share card reflects world reached');
assert(card.seasonName.includes('SEASON 01'), 'Share card includes season name');

// Ensure privacy allows leaderboard submissions in test instance
socialMgr.profileService.updatePrivacy({ showOnLeaderboards: true });

// Submit run via SocialManager end-of-run lifecycle
const submitRunRes = socialMgr.submitRunSummary(mockSummary, progMgr);
if (!submitRunRes.submitted) {
  console.log('Submission failed reason:', submitRunRes.error);
}
assert(submitRunRes.submitted === true, 'SocialManager submits run summary seamlessly');

// Group 6: Seasonal Competition Rewards
console.log('\n--- Group 6: Seasonal Competition Rewards ---');
const rewards = socialMgr.getSeasonalRewards();
assert(rewards.length === 3, 'Seasonal tier rewards registered (Apex, Elite, Vanguard)');
assert(rewards[0].rewardCosmeticId === 'player_master_pilot', 'Apex tier awards player_master_pilot');

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
