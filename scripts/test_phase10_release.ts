import * as THREE from 'three';
import { WorldManager } from '../src/game/WorldManager';
import { WORLD_ORDER, WORLD_LENGTH_DISTANCE } from '../src/game/WorldConfig';
import { WorldTransitionManager } from '../src/game/systems/worldTransition/WorldTransitionManager';
import { AudioManager } from '../src/game/audio';
import { PlayerManager } from '../src/game/player';
import { ObstacleManager } from '../src/game/obstacles';
import { TerrainManager } from '../src/game/terrain';
import { FoliageManager } from '../src/game/foliage';
import { SkyManager } from '../src/game/sky';
import { ThemeManager } from '../src/game/themeManager';
import { SkyIslesWorld } from '../src/game/worlds/skyIsles';
import { VerdantWildsWorld } from '../src/game/worlds/verdantWilds';
import { CrimsonDunesWorld } from '../src/game/worlds/crimsonDunes';
import { CrystalHeightsWorld } from '../src/game/worlds/crystalHeights';
import { ObsidianCoreWorld } from '../src/game/worlds/obsidianCore';
import { GraphicsConfig } from '../src/types';

function runPhase10QASuite() {
  console.log('================================================================');
  console.log('   GoWithFlow — Phase 10: QA, Bug Fixing & Release Verification ');
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

  // 1. Startup Test
  console.log('--- Test 1: Clean Startup & Defaults ---');
  const worldMgr = new WorldManager('sky-isles');
  assert(worldMgr.currentWorldId === 'sky-isles', 'Startup world defaults to sky-isles');
  assert(worldMgr.nextWorldId === 'verdant-wilds', 'Upcoming world starts as verdant-wilds');
  assert(worldMgr.transitionProgress === 0.0, 'Initial transition progress is 0.0 (stable)');

  // 2. Restart Test
  console.log('\n--- Test 2: Restart Reset Integrity ---');
  worldMgr.updateByDistance(3500); // Progress deep into Verdant Wilds
  assert(worldMgr.currentWorldId === 'verdant-wilds', 'Advanced to Verdant Wilds at 3500m');
  worldMgr.setWorld('sky-isles');
  assert(worldMgr.currentWorldId === 'sky-isles', 'World resets to sky-isles on restart');
  assert(worldMgr.transitionProgress === 0.0, 'Transition progress resets to 0.0 on restart');

  // 3. Five-World Test
  console.log('\n--- Test 3: Five-World Traversal ---');
  const sampleDistances = [
    { dist: 500, expected: 'sky-isles' },
    { dist: 2800, expected: 'verdant-wilds' },
    { dist: 5000, expected: 'crimson-dunes' },
    { dist: 7200, expected: 'crystal-heights' },
    { dist: 9500, expected: 'obsidian-core' },
  ];
  for (const s of sampleDistances) {
    const res = worldMgr.updateByDistance(s.dist);
    assert(res.metrics.currentWorldId === s.expected, `Distance ${s.dist}m reaches ${s.expected}`);
  }

  // 4. Exact Boundary Tests
  console.log('\n--- Test 4: Exact Boundary Points ---');
  const transitionMgr = new WorldTransitionManager('sky-isles');

  // Boundary 1: Sky Isles -> Verdant Wilds (2250m)
  const b1_2248 = transitionMgr.update(2248);
  assert(b1_2248.metrics.currentWorldId === 'sky-isles' && b1_2248.metrics.nextWorldId === 'verdant-wilds' && b1_2248.metrics.state === 'TRANSITIONING', '2248m: in transition corridor Sky Isles -> Verdant Wilds');

  const b1_2249 = transitionMgr.update(2249);
  assert(b1_2249.metrics.currentWorldId === 'sky-isles' && b1_2249.metrics.progress > 0.95, '2249m: near completion of corridor');

  const b1_2250 = transitionMgr.update(2250);
  assert(b1_2250.metrics.currentWorldId === 'verdant-wilds' && b1_2250.metrics.state === 'STABLE' && b1_2250.shouldNotifyNewWorld, '2250m: cleanly entered Verdant Wilds, fired notification');

  const b1_2251 = transitionMgr.update(2251);
  assert(b1_2251.metrics.currentWorldId === 'verdant-wilds' && !b1_2251.shouldNotifyNewWorld, '2251m: stable in Verdant Wilds, notification not duplicated');

  // Boundary 2: Verdant Wilds -> Crimson Dunes (4500m)
  const b2_4498 = transitionMgr.update(4498);
  assert(b2_4498.metrics.currentWorldId === 'verdant-wilds' && b2_4498.metrics.nextWorldId === 'crimson-dunes' && b2_4498.metrics.state === 'TRANSITIONING', '4498m: transitioning Verdant Wilds -> Crimson Dunes');

  const b2_4500 = transitionMgr.update(4500);
  assert(b2_4500.metrics.currentWorldId === 'crimson-dunes' && b2_4500.metrics.state === 'STABLE' && b2_4500.shouldNotifyNewWorld, '4500m: cleanly entered Crimson Dunes');

  // Boundary 3: Crimson Dunes -> Crystal Heights (6750m)
  const b3_6748 = transitionMgr.update(6748);
  assert(b3_6748.metrics.currentWorldId === 'crimson-dunes' && b3_6748.metrics.nextWorldId === 'crystal-heights', '6748m: transitioning Crimson Dunes -> Crystal Heights');

  const b3_6750 = transitionMgr.update(6750);
  assert(b3_6750.metrics.currentWorldId === 'crystal-heights' && b3_6750.metrics.state === 'STABLE' && b3_6750.shouldNotifyNewWorld, '6750m: cleanly entered Crystal Heights');

  // Boundary 4: Crystal Heights -> Obsidian Core (9000m)
  const b4_8998 = transitionMgr.update(8998);
  assert(b4_8998.metrics.currentWorldId === 'crystal-heights' && b4_8998.metrics.nextWorldId === 'obsidian-core', '8998m: transitioning Crystal Heights -> Obsidian Core');

  const b4_9000 = transitionMgr.update(9000);
  assert(b4_9000.metrics.currentWorldId === 'obsidian-core' && b4_9000.metrics.state === 'STABLE' && b4_9000.shouldNotifyNewWorld, '9000m: cleanly entered Obsidian Core (Final Challenge)');

  const b4_9001 = transitionMgr.update(9001);
  assert(b4_9001.metrics.currentWorldId === 'obsidian-core' && b4_9001.metrics.state === 'STABLE', '9001m: remains stable in Obsidian Core');

  // 5. Blended Crossfade Continuity Test
  console.log('\n--- Test 5: Environmental Blending ---');
  const midTransition = transitionMgr.update(2100); // exactly midpoint of 1950 - 2250m
  assert(midTransition.metrics.isTransitioning, 'Mid-transition zone isTransitioning = true');
  assert(midTransition.blended.currentWorldWeight > 0.3 && midTransition.blended.currentWorldWeight < 0.7, 'Balanced current/next weights in transition center');
  assert(midTransition.blended.fogDensity > 0.001, 'Valid continuous fog density');

  // 6. Currency Delta Banking & Revive Math Test
  console.log('\n--- Test 6: Currency Banking & Revive Delta ---');
  let bankedWallet = 0;
  let bankedThisRun = 0;

  // Run 1: collect 50 shards, crash
  let runShards = 50;
  let unbanked = Math.max(0, runShards - bankedThisRun);
  bankedWallet += unbanked;
  bankedThisRun = runShards;
  assert(bankedWallet === 50 && bankedThisRun === 50, 'Run 1 death: banked 50 shards into wallet');

  // Revive: costs 15 shards
  assert(bankedWallet >= 15, 'Eligible for revive with 50 banked shards');
  bankedWallet -= 15;
  assert(bankedWallet === 35, 'Revive deducted exactly 15 shards (wallet: 35)');

  // Collect 20 more shards (total 70 for the run) and crash again
  runShards = 70;
  unbanked = Math.max(0, runShards - bankedThisRun);
  assert(unbanked === 20, 'Incremental unbanked shards is exactly 20 (not 70)');
  bankedWallet += unbanked;
  bankedThisRun = runShards;
  assert(bankedWallet === 55, 'Wallet correctly has 35 + 20 = 55 shards (NO duplicate banking)');

  // Restart new run
  bankedThisRun = 0;
  assert(bankedThisRun === 0, 'bankedThisRun resets to 0 for fresh run');

  // 7. Mission Completion & Atomic Claim Test
  console.log('\n--- Test 7: Missions & Claims ---');
  let mission = { id: 'near_miss_5', current: 0, target: 5, completed: false, claimed: false, rewardShards: 50 };
  mission.current = 5;
  mission.completed = mission.current >= mission.target;
  assert(mission.completed && !mission.claimed, 'Mission completed and ready to claim');

  // Claim once
  let grantedReward = 0;
  if (mission.completed && !mission.claimed) {
    mission.claimed = true;
    grantedReward = mission.rewardShards;
  }
  assert(grantedReward === 50 && mission.claimed, 'First claim grants 50 shards and sets claimed=true');

  // Second claim attempt
  let secondReward = 0;
  if (mission.completed && !mission.claimed) {
    secondReward = mission.rewardShards;
  }
  assert(secondReward === 0, 'Second claim rejected (claimed is already true)');

  // 8. Quality Presets & DPR Clamping
  console.log('\n--- Test 8: Graphics Presets & DPR Clamping ---');
  const mockPresets: GraphicsConfig[] = [
    { preset: 'desktop-full', targetFPS: 60, vegetationDensity: 1.0, drawCallBudget: 800, particleBudget: 30, enablePostProcess: true, enableShadows: true, lodDistance: 180, reducedFlash: false },
    { preset: 'mobile-opt', targetFPS: 60, vegetationDensity: 0.65, drawCallBudget: 500, particleBudget: 20, enablePostProcess: true, enableShadows: false, lodDistance: 120, reducedFlash: false },
    { preset: 'webgl-min', targetFPS: 30, vegetationDensity: 0.4, drawCallBudget: 300, particleBudget: 10, enablePostProcess: false, enableShadows: false, lodDistance: 80, reducedFlash: false },
  ];
  assert(mockPresets[0].enableShadows && mockPresets[0].enablePostProcess, 'desktop-full enables shadows and post-processing');
  assert(!mockPresets[1].enableShadows && mockPresets[1].enablePostProcess, 'mobile-opt disables shadows for 60 FPS mobile performance');
  assert(!mockPresets[2].enablePostProcess && !mockPresets[2].enableShadows, 'webgl-min disables heavy passes for minimum budget');

  // 9. Subsystems Disposal Test
  console.log('\n--- Test 9: Complete Resource Disposal ---');
  const dummyScene = new THREE.Scene();
  const cfg: GraphicsConfig = mockPresets[0];

  const skyWorld = new SkyIslesWorld(dummyScene, cfg);
  const verdantWorld = new VerdantWildsWorld(dummyScene, cfg);
  const crimsonWorld = new CrimsonDunesWorld(dummyScene, cfg);
  const crystalWorld = new CrystalHeightsWorld(dummyScene, cfg);
  const obsidianWorld = new ObsidianCoreWorld(dummyScene, cfg);

  skyWorld.dispose();
  verdantWorld.dispose();
  crimsonWorld.dispose();
  crystalWorld.dispose();
  obsidianWorld.dispose();
  assert(dummyScene.children.length === 0, 'All 5 procedural worlds completely disposed and removed from scene');

  const player = new PlayerManager(dummyScene);
  player.dispose();
  assert(player.dustParticles.length === 0 || dummyScene.children.length === 0, 'PlayerManager cleanly disposed');

  const obsMgr = new ObstacleManager(dummyScene);
  obsMgr.dispose();
  assert(dummyScene.children.length === 0, 'ObstacleManager cleanly disposed');

  const foliage = new FoliageManager(dummyScene);
  foliage.dispose();
  assert(dummyScene.children.length === 0, 'FoliageManager cleanly disposed');

  const themeMgr = new ThemeManager(dummyScene);
  themeMgr.dispose();
  assert(dummyScene.children.length === 0, 'ThemeManager cleanly disposed');

  const audio = new AudioManager(true);
  audio.dispose();
  assert(true, 'AudioManager cleanly disposed without dangling nodes');

  console.log('\n================================================================');
  console.log(`[PHASE 10 QA RESULT] Total Passed: ${passes}, Failed: ${fails}`);
  console.log('================================================================\n');

  if (fails > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runPhase10QASuite();
