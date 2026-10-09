/**
 * GoWithFlow — Master Phase 1–18 Test Runner & Verification Suite
 * Executes all automated test runners sequentially and reports overall release readiness.
 */

import { spawnSync } from 'child_process';
import path from 'path';

interface SuiteResult {
  suiteName: string;
  scriptPath: string;
  passed: boolean;
  exitCode: number;
  durationMs: number;
  output: string;
}

const SUITES = [
  { name: 'Phase 8 — Performance & Resource Budgets', script: 'scripts/test_phase8_performance.ts' },
  { name: 'Phase 9 — Polish, Audio & Accessibility', script: 'scripts/test_phase9_polish.ts' },
  { name: 'Phase 10 — Release QA & Subsystem Disposal', script: 'scripts/test_phase10_release.ts' },
  { name: 'Phase 12 — Post-Launch Stability & Monitoring', script: 'scripts/test_phase12_stability.ts' },
  { name: 'Phase 13 — Advanced Progression & Challenges', script: 'scripts/test_phase13_progression.ts' },
  { name: 'Phase 14 — Cosmetics & Customization Registry', script: 'scripts/test_phase14_cosmetics.ts' },
  { name: 'Phase 15 — Game Modes & Scoring Directives', script: 'scripts/test_phase15_modes.ts' },
  { name: 'Phase 16 — Social, Leaderboards & Replay Cards', script: 'scripts/test_phase16_social.ts' },
  { name: 'Phase 17 — Security, Anti-Cheat & Storage Defense', script: 'scripts/test_phase17_security.ts' },
  { name: 'Phase 18 — LiveOps, Seasons & Event Rotations', script: 'scripts/test_phase18_liveops.ts' },
];

console.log('================================================================');
console.log('🎮 GoWithFlow — Comprehensive Phase 1–18 Release Gate Runner');
console.log('================================================================\n');

const results: SuiteResult[] = [];
const startTime = Date.now();

for (const suite of SUITES) {
  process.stdout.write(`▶ Running ${suite.name}... `);
  const suiteStart = Date.now();
  const res = spawnSync('npx', ['tsx', suite.script], {
    cwd: process.cwd(),
    encoding: 'utf-8',
    shell: true,
  });
  const durationMs = Date.now() - suiteStart;
  const passed = res.status === 0;

  if (passed) {
    console.log(`✅ PASSED (${(durationMs / 1000).toFixed(2)}s)`);
  } else {
    console.log(`❌ FAILED (Exit Code ${res.status})`);
    if (res.stderr) console.error(res.stderr);
  }

  results.push({
    suiteName: suite.name,
    scriptPath: suite.script,
    passed,
    exitCode: res.status ?? 1,
    durationMs,
    output: res.stdout + '\n' + res.stderr,
  });
}

const totalDurationSec = ((Date.now() - startTime) / 1000).toFixed(2);
const totalPassed = results.filter(r => r.passed).length;
const totalFailed = results.filter(r => !r.passed).length;

console.log('\n================================================================');
console.log('📊 MASTER TEST RESULTS SUMMARY');
console.log('================================================================');
console.table(
  results.map(r => ({
    'Test Suite': r.suiteName,
    Status: r.passed ? '✅ PASSED' : '❌ FAILED',
    'Duration (s)': (r.durationMs / 1000).toFixed(2),
  }))
);

console.log(`Total Suites: ${results.length}`);
console.log(`Passed: ${totalPassed}`);
console.log(`Failed: ${totalFailed}`);
console.log(`Total Execution Time: ${totalDurationSec}s\n`);

if (totalFailed > 0) {
  console.error('❌ RELEASE GATE FAILED: Some test suites encountered failures.');
  process.exit(1);
} else {
  console.log('🎉 RELEASE GATE PASSED: All Phase 1–18 verification suites 100% green!');
  process.exit(0);
}
