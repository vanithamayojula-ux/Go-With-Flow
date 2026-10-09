import * as THREE from 'three';
import { PlayerManager } from '../src/game/player';
import { AudioManager } from '../src/game/audio';
import { WorldTransitionManager } from '../src/game/systems/worldTransition/WorldTransitionManager';
import { WORLDS } from '../src/game/worlds';
import { GraphicsConfig } from '../src/types';

function createDummyConfig(reducedFlash = false): GraphicsConfig {
  return {
    preset: 'desktop-full',
    targetFPS: 60,
    vegetationDensity: 1.0,
    drawCallBudget: 800,
    particleBudget: 800,
    enablePostProcess: true,
    enableShadows: true,
    lodDistance: 180,
    reducedFlash,
  };
}

function runPolishVerification() {
  console.log('================================================================');
  console.log('✨ PHASE 9 FINAL POLISH, GAME FEEL & PLAYER EXPERIENCE AUDIT');
  console.log('================================================================\n');

  let allPassed = true;

  // 1. Player Movement & Landing Impulse Verification
  console.log('--- 1. Testing Player Landing Impulse & Camera Feel ---');
  const scene = new THREE.Scene();
  const player = new PlayerManager(scene);
  const audio = new AudioManager();

  // Put player airborne
  player.position.y = 8.0;
  player.isGrounded = false;
  player.jumpVelocity = -6.0;

  // Simulate falling and landing
  const dummyInput = {
    left: false,
    right: false,
    forward: true,
    jump: false,
    drift: false,
  };

  player.update(0.016, dummyInput, 0.1, undefined, audio);

  // When player touches ground (y <= minY), landingImpulseY should trigger
  player.position.y = -0.5; // force below ground
  player.update(0.016, dummyInput, 0.12, undefined, audio);

  console.log(`  Player Grounded: ${player.isGrounded}`);
  console.log(`  Landing Impulse Y: ${player.landingImpulseY.toFixed(3)}`);
  const landingImpulseTriggered = player.landingImpulseY < -0.05;
  console.log(`  Landing Impulse Trigger Check: ${landingImpulseTriggered ? '✅ PASS' : '❌ FAIL'}`);
  if (!landingImpulseTriggered) allPassed = false;

  // Simulate subsequent frames for smooth recovery
  const prevImpulse = player.landingImpulseY;
  player.update(0.05, dummyInput, 0.17, undefined, audio);
  const impulseRecovering = Math.abs(player.landingImpulseY) < Math.abs(prevImpulse);
  console.log(`  Landing Impulse Damping Check: ${impulseRecovering ? '✅ PASS' : '❌ FAIL'}`);
  if (!impulseRecovering) allPassed = false;

  // Camera Speed Sensation check
  console.log(`  Camera Pos Z: ${player.cameraPos.z.toFixed(2)} (relative to player: ${(player.cameraPos.z - player.position.z).toFixed(2)})`);
  const cameraResponsive = player.cameraPos.z < player.position.z - 5.0;
  console.log(`  Camera Speed Sensation Check: ${cameraResponsive ? '✅ PASS' : '❌ FAIL'}`);
  if (!cameraResponsive) allPassed = false;
  console.log();

  // 2. Revive Feedback & Invulnerability Window
  console.log('--- 2. Testing Revive Feedback & Invulnerability Shield ---');
  player.crash();
  console.log(`  Player state after crash: ${player.gameState}`);
  if (player.gameState !== 'game-over') allPassed = false;

  player.revive(audio);
  console.log(`  Player state after revive: ${player.gameState}`);
  console.log(`  Shield active on revive: ${player.activePowerUps.hoverboardShield}`);
  const reviveOk = player.gameState === 'playing' && player.activePowerUps.hoverboardShield === true;
  console.log(`  Revive Invulnerability Check: ${reviveOk ? '✅ PASS' : '❌ FAIL'}`);
  if (!reviveOk) allPassed = false;
  console.log();

  // 3. World Introductions & Metadata Verification
  console.log('--- 3. Testing World Introduction Names & Subtitles ---');
  const expectedWorlds = [
    { id: 'sky-isles', name: 'Sky Isles', subtitle: 'The Beginning' },
    { id: 'verdant-wilds', name: 'Verdant Wilds', subtitle: 'The Living Forest' },
    { id: 'crimson-dunes', name: 'Crimson Dunes', subtitle: 'The Endless Desert' },
    { id: 'crystal-heights', name: 'Crystal Heights', subtitle: 'The Celestial Realm' },
    { id: 'obsidian-core', name: 'Obsidian Core', subtitle: 'The Final Challenge' },
  ];

  for (const exp of expectedWorlds) {
    const w = WORLDS[exp.id as keyof typeof WORLDS];
    const match = w && w.name === exp.name && w.subtitle === exp.subtitle;
    console.log(`  World: ${w.name.padEnd(16)} | Subtitle: ${w.subtitle.padEnd(22)} => ${match ? '✅ PASS' : '❌ FAIL'}`);
    if (!match) allPassed = false;
  }
  console.log();

  // 4. World Audio Ambience Signatures & Revive Sound
  console.log('--- 4. Testing World Audio Signatures & Synthesis ---');
  try {
    for (const exp of expectedWorlds) {
      audio.playBiomeShiftSound(exp.id);
    }
    audio.playReviveSound();
    audio.playNearMissSound();
    audio.playLanding();
    console.log('  All world sound signatures and gameplay SFX synthesize without error: ✅ PASS');
  } catch (err) {
    console.error('  Audio synthesis error:', err);
    allPassed = false;
  }
  console.log();

  // 5. Long Session Progression & Recycling Test
  console.log('--- 5. Testing Long Campaign Session (Repeated 5-World Runs) ---');
  const transMgr = new WorldTransitionManager('sky-isles');

  // Run 1: 0m to 10000m
  for (let d = 0; d <= 10000; d += 250) {
    transMgr.update(d);
  }
  console.log(`  Run 1 reached: ${transMgr.currentWorldId} at 10000m: ✅`);

  // Reset for Run 2
  transMgr.setWorld('sky-isles');
  for (let d = 0; d <= 10000; d += 250) {
    transMgr.update(d);
  }
  console.log(`  Run 2 reached: ${transMgr.currentWorldId} at 10000m: ✅`);

  const longSessionOk = transMgr.currentWorldId === 'obsidian-core';
  console.log(`  Multi-run Progression State Check: ${longSessionOk ? '✅ PASS' : '❌ FAIL'}`);
  if (!longSessionOk) allPassed = false;
  console.log();

  // Clean disposal
  player.dispose();
  audio.dispose();

  console.log('================================================================');
  if (allPassed) {
    console.log('🎉 ALL PHASE 9 FINAL POLISH AUDIT CHECKS PASSED!');
  } else {
    console.error('❌ SOME CHECKS FAILED!');
    process.exit(1);
  }
  console.log('================================================================');
}

runPolishVerification();
