import * as THREE from 'three';
import { SkyIslesWorld } from '../src/game/worlds/skyIsles/SkyIslesWorld';
import { VerdantWildsWorld } from '../src/game/worlds/verdantWilds/VerdantWildsWorld';
import { CrimsonDunesWorld } from '../src/game/worlds/crimsonDunes/CrimsonDunesWorld';
import { CrystalHeightsWorld } from '../src/game/worlds/crystalHeights/CrystalHeightsWorld';
import { ObsidianCoreWorld } from '../src/game/worlds/obsidianCore/ObsidianCoreWorld';
import { WorldTransitionManager } from '../src/game/systems/worldTransition/WorldTransitionManager';
import { GraphicsConfig, QualityPreset } from '../src/types';

function createConfig(preset: QualityPreset): GraphicsConfig {
  return {
    preset,
    targetFPS: preset === 'webgl-min' ? 30 : 60,
    vegetationDensity: preset === 'desktop-full' ? 1.0 : (preset === 'mobile-opt' ? 0.65 : 0.4),
    drawCallBudget: preset === 'desktop-full' ? 800 : (preset === 'mobile-opt' ? 500 : 250),
    particleBudget: preset === 'desktop-full' ? 800 : (preset === 'mobile-opt' ? 500 : 250),
    enablePostProcess: preset !== 'webgl-min',
    enableShadows: preset === 'desktop-full',
    lodDistance: 180,
    reducedFlash: false,
  };
}

function countSceneObjects(scene: THREE.Scene): { meshes: number; points: number; total: number } {
  let meshes = 0;
  let points = 0;
  let total = 0;
  scene.traverse(obj => {
    total++;
    if (obj instanceof THREE.Mesh) meshes++;
    if (obj instanceof THREE.Points) points++;
  });
  return { meshes, points, total };
}

function countSceneParticles(scene: THREE.Scene): number {
  let particles = 0;
  scene.traverse(obj => {
    if (obj instanceof THREE.Points && obj.geometry) {
      const posAttr = obj.geometry.getAttribute('position');
      if (posAttr) {
        particles += posAttr.count;
      }
    }
  });
  return particles;
}

function runBenchmark() {
  console.log('================================================================');
  console.log('⚡ PHASE 8 PERFORMANCE & STABILITY VERIFICATION BENCHMARK');
  console.log('Target Hardware: Intel Core i5 / Intel Iris Xe Integrated Graphics');
  console.log('================================================================\n');

  let allPassed = true;

  // 1. Preset & Particle Budgets across all 5 worlds
  const presets: QualityPreset[] = ['desktop-full', 'mobile-opt', 'webgl-min'];

  for (const preset of presets) {
    console.log(`--- Testing Graphics Preset: [${preset.toUpperCase()}] ---`);
    const config = createConfig(preset);
    const scene = new THREE.Scene();

    const worldCtors = [
      { id: 'sky-isles', ctor: SkyIslesWorld },
      { id: 'verdant-wilds', ctor: VerdantWildsWorld },
      { id: 'crimson-dunes', ctor: CrimsonDunesWorld },
      { id: 'crystal-heights', ctor: CrystalHeightsWorld },
      { id: 'obsidianCore', ctor: ObsidianCoreWorld },
    ];

    for (const { id, ctor } of worldCtors) {
      const worldScene = new THREE.Scene();
      const worldInstance = new ctor(worldScene, config);

      // Simulate player updates over 30 frames
      for (let f = 0; f < 30; f++) {
        worldInstance.update(f * 20, 0.016, f * 0.016, config);
      }

      const counts = countSceneObjects(worldScene);
      const particles = countSceneParticles(worldScene);

      // Assert particle budget
      const particleBudget = config.particleBudget;
      const isParticleBudgetOk = particles <= particleBudget;

      console.log(`  ${id.padEnd(16)} | Meshes: ${String(counts.meshes).padStart(3)} | Points: ${String(counts.points).padStart(2)} | Particles: ${String(particles).padStart(4)} (Budget: ${particleBudget}) => ${isParticleBudgetOk ? '✅ PASS' : '❌ FAIL'}`);

      if (!isParticleBudgetOk) {
        allPassed = false;
        console.error(`  [FAIL] ${id} exceeded particle budget for ${preset}: ${particles} > ${particleBudget}`);
      }

      // Test clean disposal
      worldInstance.dispose();
      const afterCounts = countSceneObjects(worldScene);
      if (afterCounts.total > 1) { // 1 is scene itself
        allPassed = false;
        console.error(`  [FAIL] Memory leak after dispose for ${id}: ${afterCounts.total} objects remaining in scene!`);
      }
    }
    console.log();
  }

  // 2. World Transition Corridor & Dual-World Concurrency Budget
  console.log('--- Testing World Transition Corridor Budget (Dual-World Concurrency) ---');
  const desktopConfig = createConfig('desktop-full');
  const transitionScene = new THREE.Scene();

  // In transition zone (e.g. at 2100m between Sky Isles and Verdant Wilds)
  const skyWorld = new SkyIslesWorld(transitionScene, desktopConfig);
  const verdantWorld = new VerdantWildsWorld(transitionScene, desktopConfig);

  skyWorld.update(2150, 0.016, 1.0, desktopConfig);
  verdantWorld.update(2150, 0.016, 1.0, desktopConfig);

  const dualCounts = countSceneObjects(transitionScene);
  const dualParticles = countSceneParticles(transitionScene);

  console.log(`  Dual-World Corridor: Meshes: ${dualCounts.meshes} | Points: ${dualCounts.points} | Particles: ${dualParticles}`);
  const maxDualParticles = 800;
  const isDualBudgetOk = dualParticles <= maxDualParticles;
  console.log(`  Dual-World Particle Budget Check (<= ${maxDualParticles}): ${isDualBudgetOk ? '✅ PASS' : '❌ FAIL'}`);
  if (!isDualBudgetOk) allPassed = false;

  skyWorld.dispose();
  verdantWorld.dispose();
  console.log();

  // 3. WorldTransitionManager Progression & Zero-Allocation Verification
  console.log('--- Testing WorldTransitionManager Progression & Zero-Allocation ---');
  const transMgr = new WorldTransitionManager('sky-isles');

  // Verify transition states and progression
  const distances = [
    { dist: 500, expectedWorld: 'sky-isles', expectedState: 'STABLE' },
    { dist: 1850, expectedWorld: 'sky-isles', expectedState: 'PREPARING' },
    { dist: 2100, expectedWorld: 'sky-isles', expectedState: 'TRANSITIONING' },
    { dist: 2260, expectedWorld: 'verdant-wilds', expectedState: 'STABLE' },
    { dist: 4350, expectedWorld: 'verdant-wilds', expectedState: 'TRANSITIONING' },
    { dist: 4510, expectedWorld: 'crimson-dunes', expectedState: 'STABLE' },
    { dist: 6600, expectedWorld: 'crimson-dunes', expectedState: 'TRANSITIONING' },
    { dist: 6760, expectedWorld: 'crystal-heights', expectedState: 'STABLE' },
    { dist: 8850, expectedWorld: 'crystal-heights', expectedState: 'TRANSITIONING' },
    { dist: 9050, expectedWorld: 'obsidian-core', expectedState: 'STABLE' },
  ];

  for (const tc of distances) {
    const res = transMgr.update(tc.dist);
    const passWorld = res.metrics.currentWorldId === tc.expectedWorld;
    const passState = res.metrics.state === tc.expectedState;
    const ok = passWorld && passState;
    if (!ok) allPassed = false;
    console.log(`  Dist: ${String(tc.dist).padStart(5)}m | World: ${res.metrics.currentWorldId.padEnd(15)} (exp: ${tc.expectedWorld.padEnd(15)}) | State: ${res.metrics.state.padEnd(13)} (exp: ${tc.expectedState.padEnd(13)}) => ${ok ? '✅ PASS' : '❌ FAIL'}`);
  }

  // Verify object reference reuse across consecutive updates (zero allocations)
  const refA = transMgr.update(100);
  const refB = transMgr.update(101);
  const sameMetricsRef = refA.metrics === refB.metrics;
  const sameBlendedRef = refA.blended === refB.blended;
  const zeroAllocPass = sameMetricsRef && sameBlendedRef;
  console.log(`  Zero-Heap-Allocation Verification: ${zeroAllocPass ? '✅ PASS (Objects reused in-place)' : '❌ FAIL (Allocating on heap)'}`);
  if (!zeroAllocPass) allPassed = false;
  console.log();

  // 4. Final Verdict
  console.log('================================================================');
  if (allPassed) {
    console.log('🎉 ALL PHASE 8 PERFORMANCE AND STABILITY BENCHMARKS PASSED!');
    console.log('Ready for Intel Iris Xe / integrated graphics deployment.');
  } else {
    console.error('❌ SOME BENCHMARKS FAILED! Review details above.');
    process.exit(1);
  }
  console.log('================================================================');
}

runBenchmark();
