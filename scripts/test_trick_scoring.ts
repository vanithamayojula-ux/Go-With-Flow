/**
 * Regression test: trick input can't be spammed for unbounded score.
 *
 * Tricks used to have no cooldown and the combo never reset, so holding or
 * mashing a trick key scored 350 x combo every frame.
 *
 * Run: npx tsx scripts/test_trick_scoring.ts
 */
import * as THREE from 'three';
import { PlayerManager } from '../src/game/player';

const IDLE = { left: false, right: false, forward: false, jump: false, drift: false, trickSpin: false, trickFlip: false, trickGrab: false, trickPose: false };

let passes = 0;
let fails = 0;
function assert(cond: boolean, name: string, detail = '') {
  if (cond) { console.log(`[PASS] ${name}`); passes++; }
  else { console.error(`[FAIL] ${name}${detail ? ' -> ' + detail : ''}`); fails++; }
}

// 1. Calling triggerTrick every frame for 10s is rate-limited.
{
  const p = new PlayerManager(new THREE.Scene());
  p.resetRun();
  const hz = 60, dt = 1 / hz;
  let accepted = 0;
  let maxCombo = 0;
  for (let i = 0; i < hz * 10; i++) {
    if (p.triggerTrick('spin', null) !== false) accepted++;
    (p as any).update(dt, IDLE, i * dt, null, null, null);
    maxCombo = Math.max(maxCombo, p.stats.combo);
  }
  // 0.3s lockout -> at most ~34 tricks in 10s (slow-mo makes it fewer).
  assert(accepted <= 35, `trick spam is rate-limited (${accepted} tricks in 10s)`);
  assert(maxCombo <= 8, `combo stays capped at 8 (max ${maxCombo})`);
  assert(p.stats.score < 120000, `10s of spam stays bounded (score ${p.stats.score})`);
}

// 2. Landing ends the combo.
{
  const p = new PlayerManager(new THREE.Scene());
  p.resetRun();
  const dt = 1 / 60;
  p.triggerTrick('flip', null);
  assert(p.stats.combo === 1, 'first trick starts a combo');
  let landed = false;
  for (let i = 0; i < 60 * 5 && !landed; i++) {
    (p as any).update(dt, IDLE, i * dt, null, null, null);
    if (i > 5 && p.isGrounded) landed = true;
  }
  assert(landed, 'player lands after a trick jump');
  assert(p.stats.combo === 0, `combo resets on landing (combo ${p.stats.combo})`);
}

console.log(`\n${passes} passed, ${fails} failed`);
if (fails > 0) process.exit(1);
