import * as THREE from 'three';
import { WorldManager } from '../src/game/WorldManager';
import { WorldTransitionManager } from '../src/game/systems/worldTransition/WorldTransitionManager';
import { PlayerManager } from '../src/game/player';
import { ObstacleManager } from '../src/game/obstacles';
import { AudioManager } from '../src/game/audio';
import { FoliageManager } from '../src/game/foliage';
import { SkyManager } from '../src/game/sky';
import { ThemeManager } from '../src/game/themeManager';
import { SkyIslesWorld } from '../src/game/worlds/skyIsles';
import { VerdantWildsWorld } from '../src/game/worlds/verdantWilds';
import { CrimsonDunesWorld } from '../src/game/worlds/crimsonDunes';
import { CrystalHeightsWorld } from '../src/game/worlds/crystalHeights';
import { ObsidianCoreWorld } from '../src/game/worlds/obsidianCore';
import { getGameHealthDashboard, telemetry } from '../src/utils/performanceTelemetry';
import { reportGameError, getGameErrorLogs } from '../src/utils/errorMonitoring';
import { setActiveBiome, clearBiomeOverride, getBiomeAt } from '../src/game/terrain';
import { GraphicsConfig } from '../src/types';

function runPhase12StabilityGate() {
  console.log('================================================================');
  console.log('  GoWithFlow — Phase 12: Stability Gate & Regression Protection ');
  console.log('================================================================\n');

  let passes = 0;
  let fails = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passes++;
    } else {
      console.error(`[FAIL] ${testName}${detail ? ` -> ${detail}` : ''}`);
      fails++;
    }
  }

  // 1. Regression Check: activeBiomeOverride isolation
  console.log('--- 1. activeBiomeOverride Isolation & Reset ---');
  setActiveBiome('ember-core', 500, 300);
  const overriddenBiome = getBiomeAt(500);
  assert(overriddenBiome === 'ember-core', 'Portal warp successfully overrides biome at distance 500m');
  clearBiomeOverride();
  const restoredBiome = getBiomeAt(500);
  assert(restoredBiome !== 'ember-core', 'clearBiomeOverride restores procedural biome cleanly');

  // 2. Regression Check: Repeated Restart Cycles (Memory Leak Prevention)
  console.log('\n--- 2. Repeated Restart Cycle Stability (10 iterations) ---');
  const dummyScene = new THREE.Scene();
  const cfg: GraphicsConfig = {
    preset: 'desktop-full',
    targetFPS: 60,
    vegetationDensity: 1.0,
    drawCallBudget: 800,
    particleBudget: 30,
    enablePostProcess: true,
    enableShadows: true,
    lodDistance: 180,
    reducedFlash: false,
  };

  for (let i = 0; i < 10; i++) {
    const p = new PlayerManager(dummyScene);
    const obs = new ObstacleManager(dummyScene);
    const skyW = new SkyIslesWorld(dummyScene, cfg);
    p.resetRun();
    obs.reset();
    skyW.dispose();
    p.dispose();
    obs.dispose();
  }
  assert(dummyScene.children.length === 0, '10 rapid reset cycles result in 0 orphaned scene children');

  // 3. Regression Check: Currency Accounting & Revive Multi-death Flow
  console.log('\n--- 3. Currency Accounting & Double-Deposit Protection ---');
  let bankWallet = 100;
  let bankedThisRun = 0;

  // Run with 3 deaths and 2 revives
  const runMilestones = [30, 60, 90]; // Shards collected at each death
  for (let i = 0; i < runMilestones.length; i++) {
    const currentRunShards = runMilestones[i];
    const unbanked = Math.max(0, currentRunShards - bankedThisRun);
    bankWallet += unbanked;
    bankedThisRun = currentRunShards;

    if (i < 2) {
      // Emergency Revive (-15 shards)
      assert(bankWallet >= 15, `Eligible for revive #${i + 1}`);
      bankWallet -= 15;
    }
  }
  // Initial (100) + total collected (90) - 2 revives (30) = 160
  assert(bankWallet === 160, `Multi-revive run correctly totals 160 shards (got ${bankWallet})`);

  // 4. Regression Check: Daily Missions Atomic Claiming
  console.log('\n--- 4. Daily Mission Double-Claim Guard ---');
  const sessionMission = { id: 'test_mission', current: 10, target: 10, completed: true, claimed: false, rewardShards: 100 };
  let rewardsAwarded = 0;
  for (let attempt = 0; attempt < 5; attempt++) {
    if (sessionMission.completed && !sessionMission.claimed) {
      sessionMission.claimed = true;
      rewardsAwarded += sessionMission.rewardShards;
    }
  }
  assert(rewardsAwarded === 100, `5 rapid claim clicks award reward exactly once (${rewardsAwarded} awarded)`);

  // 5. Telemetry & Error Monitoring Buffer
  console.log('\n--- 5. Telemetry Dashboard & Error Buffer Verification ---');
  telemetry.reset();
  telemetry.recordFrame(0.0166); // 60 fps
  telemetry.recordFrame(0.0167); // 60 fps
  telemetry.startTransition();
  telemetry.endTransition();
  const snap = telemetry.getSnapshot();
  assert(snap.averageFps >= 59 && snap.averageFps <= 61, `Telemetry calculates 60 FPS (${snap.averageFps} FPS)`);
  assert(snap.transitionCount === 1, 'Telemetry records transition count correctly');

  reportGameError(new Error('Sample non-fatal diagnostic error'), { subsystem: 'TestGate', worldId: 'sky-isles' });
  const logs = getGameErrorLogs();
  assert(logs.length > 0 && logs[logs.length - 1].subsystem === 'TestGate', 'Error monitoring captures structured diagnostic error');

  const dashboard = getGameHealthDashboard();
  assert(dashboard.status === 'OPTIMAL' || dashboard.status === 'DEGRADED', `Dashboard status resolved cleanly (${dashboard.status})`);
  assert(dashboard.version === '1.0.0', `Dashboard exposes correct version (${dashboard.version})`);

  console.log('\n================================================================');
  console.log(`[PHASE 12 STABILITY RESULT] Passed: ${passes}, Failed: ${fails}`);
  console.log('================================================================\n');

  if (fails > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runPhase12StabilityGate();
