/**
 * Regression test: distance, score and speed must not depend on frame rate.
 *
 * Distance and score used to be accumulated with Math.round() of a per-frame
 * delta, which rounded to 0 at 30 Hz and above: DST stayed at 0m, the speed
 * ramp never started, and score scaled with refresh rate (0 at 144 Hz).
 *
 * Run: npx tsx scripts/test_framerate_independence.ts
 */
import * as THREE from 'three';
import { PlayerManager } from '../src/game/player';

const IDLE_INPUT = {
  left: false,
  right: false,
  forward: false,
  jump: false,
  drift: false,
  trickSpin: false,
  trickFlip: false,
  trickGrab: false,
  trickPose: false,
};

function simulate(hz: number, seconds: number) {
  const player = new PlayerManager(new THREE.Scene());
  player.resetRun();
  const dt = 1 / hz;
  for (let i = 0; i < hz * seconds; i++) {
    (player as any).update(dt, IDLE_INPUT, i * dt, null, null, null);
  }
  return {
    hz,
    z: player.position.z,
    distance: player.stats.distance,
    score: player.stats.score,
    speed: player.velocity.z,
  };
}

let passes = 0;
let fails = 0;
function assert(cond: boolean, name: string, detail = '') {
  if (cond) {
    console.log(`[PASS] ${name}`);
    passes++;
  } else {
    console.error(`[FAIL] ${name}${detail ? ' -> ' + detail : ''}`);
    fails++;
  }
}

const SECONDS = 20;
const results = [30, 60, 120, 144].map(hz => simulate(hz, SECONDS));
console.table(results.map(r => ({ ...r, z: +r.z.toFixed(1), speed: +r.speed.toFixed(2) })));

const ref = results.find(r => r.hz === 60)!;
for (const r of results) {
  assert(r.distance > 100, `${r.hz} Hz: distance advances (${r.distance} m)`);
  assert(Math.abs(r.distance - Math.floor(r.z)) <= 1, `${r.hz} Hz: distance matches metres travelled`);
  assert(r.score > 0, `${r.hz} Hz: score advances (${r.score})`);
  assert(Math.abs(r.distance - ref.distance) / ref.distance < 0.02, `${r.hz} Hz: distance within 2% of 60 Hz`, `${r.distance} vs ${ref.distance}`);
  assert(Math.abs(r.score - ref.score) / ref.score < 0.02, `${r.hz} Hz: score within 2% of 60 Hz`, `${r.score} vs ${ref.score}`);
  assert(r.speed > 8.5, `${r.hz} Hz: distance speed ramp kicks in (${r.speed.toFixed(1)} m/s)`);
}

// After a crash the board must stay put: no distance or score accrues
// behind the game-over screen.
{
  const player = new PlayerManager(new THREE.Scene());
  player.resetRun();
  const dt = 1 / 60;
  for (let i = 0; i < 60 * 5; i++) (player as any).update(dt, IDLE_INPUT, i * dt, null, null, null);
  player.crash();
  const before = { d: player.stats.distance, s: player.stats.score, z: player.position.z };
  for (let i = 0; i < 60 * 10; i++) (player as any).update(dt, IDLE_INPUT, 5 + i * dt, null, null, null);
  assert(player.stats.distance === before.d, `no distance after crash (${before.d} -> ${player.stats.distance})`);
  assert(player.stats.score === before.s, `no score after crash (${before.s} -> ${player.stats.score})`);
  assert(Math.abs(player.position.z - before.z) < 0.01, 'player does not move after crash');
}

console.log(`\n${passes} passed, ${fails} failed`);
if (fails > 0) process.exit(1);
