import { createServer } from 'vite';
import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const outDir = path.resolve(process.cwd(), 'screenshots/full_qa');
fs.mkdirSync(outDir, { recursive: true });

async function main() {
  console.log('=== Neon Drift Full Motion + Graphics QA Suite ===\n');

  // 1. Start Vite Server
  console.log('[1/5] Starting Vite local server...');
  const server = await createServer({
    server: { port: 5190, host: '127.0.0.1' },
    configFile: path.resolve(process.cwd(), 'vite.config.ts'),
  });
  await server.listen();
  const address = server.httpServer?.address();
  const port = typeof address === 'object' && address ? address.port : 5190;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`Vite server running at ${baseUrl}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.setViewportSize({ width: 1280, height: 720 });

  // 2. Baseline Performance & Telemetry
  console.log('\n[2/5] Capturing Baseline Performance & Telemetry...');
  await page.goto(`${baseUrl}/?hero=shadow&biome=neon-undercity`);
  await page.waitForTimeout(3000);

  const baselineMetrics = await page.evaluate(() => {
    const fpsEl = document.querySelector('.text-emerald-400, .text-amber-400');
    return {
      url: window.location.href,
      playerReady: !!(window as any).__playerManager,
    };
  });

  const baselineScreenshot = path.join(outDir, '00_baseline_runway.png');
  await page.screenshot({ path: baselineScreenshot });
  console.log(`✓ Baseline captured -> ${baselineScreenshot}`);

  // 3. Motion Tests (Lane, Jump, Slide, Tricks, Grind, Boost, Shield, Crash)
  console.log('\n[3/5] Running Motion & Controls QA...');

  // Lane Change Left (A)
  await page.keyboard.press('KeyA');
  await page.waitForTimeout(400);
  const laneLeftShot = path.join(outDir, '01_motion_lane_left.png');
  await page.screenshot({ path: laneLeftShot });
  console.log(`✓ Lane Switch Left (A) -> ${laneLeftShot}`);

  // Lane Change Right (D)
  await page.keyboard.press('KeyD');
  await page.waitForTimeout(300);
  await page.keyboard.press('KeyD');
  await page.waitForTimeout(400);
  const laneRightShot = path.join(outDir, '02_motion_lane_right.png');
  await page.screenshot({ path: laneRightShot });
  console.log(`✓ Lane Switch Right (D) -> ${laneRightShot}`);

  // Reset to center
  await page.keyboard.press('KeyA');
  await page.waitForTimeout(300);

  // In-Game Jump (Space)
  await page.keyboard.down('Space');
  await page.waitForTimeout(250);
  const jumpShot = path.join(outDir, '03_motion_jump_air.png');
  await page.screenshot({ path: jumpShot });
  await page.keyboard.up('Space');
  await page.waitForTimeout(500);
  console.log(`✓ Jump Air-Tuck -> ${jumpShot}`);

  // In-Game Slide (S / Down)
  await page.keyboard.down('ArrowDown');
  await page.waitForTimeout(250);
  const slideShot = path.join(outDir, '04_motion_slide_crouch.png');
  await page.screenshot({ path: slideShot });
  await page.keyboard.up('ArrowDown');
  await page.waitForTimeout(400);
  console.log(`✓ Slide Crouch -> ${slideShot}`);

  // Aerial Stunt Tricks (J, K, L, I)
  await page.keyboard.press('KeyJ'); // Spin
  await page.waitForTimeout(300);
  const trickSpinShot = path.join(outDir, '05_trick_spin_corkscrew.png');
  await page.screenshot({ path: trickSpinShot });
  await page.waitForTimeout(500);
  console.log(`✓ Trick 1 (Spin Corkscrew) -> ${trickSpinShot}`);

  await page.keyboard.press('KeyK'); // Flip
  await page.waitForTimeout(300);
  const trickFlipShot = path.join(outDir, '06_trick_flip_backflip.png');
  await page.screenshot({ path: trickFlipShot });
  await page.waitForTimeout(500);
  console.log(`✓ Trick 2 (Invert Flip) -> ${trickFlipShot}`);

  // Holo-Shield Activation (Double Space)
  await page.keyboard.press('Space');
  await page.waitForTimeout(100);
  await page.keyboard.press('Space');
  await page.waitForTimeout(400);
  const shieldShot = path.join(outDir, '07_holo_shield_active.png');
  await page.screenshot({ path: shieldShot });
  console.log(`✓ Holo-Shield Active -> ${shieldShot}`);

  // 4. All 9 Biomes Graphics & Shaders QA
  console.log('\n[4/5] Capturing All 9 Dynamic Biomes...');
  const biomes = [
    { id: 'neon-undercity', name: 'Neon Undercity', hero: 'shadow' },
    { id: 'dune-nomad', name: 'Dune Nomad', hero: 'flame' },
    { id: 'aurora-frost', name: 'Aurora Frost', hero: 'frost' },
    { id: 'bioluminescent-jungle', name: 'Bioluminescent Jungle', hero: 'thunder' },
    { id: 'ember-core', name: 'Ember Core', hero: 'void' },
    { id: 'nebula-drift', name: 'Nebula Drift', hero: 'shadow' },
    { id: 'sky-realm', name: 'Sky Realm', hero: 'flame' },
    { id: 'the-grid', name: 'The Grid', hero: 'thunder' },
    { id: 'derelict-station', name: 'Derelict Station', hero: 'frost' },
  ];

  for (let i = 0; i < biomes.length; i++) {
    const b = biomes[i];
    await page.goto(`${baseUrl}/?hero=${b.hero}&biome=${b.id}`);
    await page.waitForTimeout(3200);
    const bShot = path.join(outDir, `08_biome_${i + 1}_${b.id}.png`);
    await page.screenshot({ path: bShot });
    console.log(`✓ Biome [${b.name}] -> ${bShot}`);
  }

  // 5. Hero Lab Matrix (5 Heroes x 6 Poses)
  console.log('\n[5/5] Running Hero Lab Matrix (5 Heroes x 6 Poses)...');
  const heroes = ['shadow', 'flame', 'thunder', 'frost', 'void'];
  const poses = ['bind', 'idle', 'run', 'slide', 'jump', 'grind'];

  for (const hero of heroes) {
    for (const pose of poses) {
      await page.goto(`${baseUrl}/hero-lab.html?hero=${hero}&pose=${pose}&view=three&time=1.0`);
      await page.waitForFunction(() => (window as any).__labReady === true, { timeout: 15000 });
      await page.waitForTimeout(250);
      const heroShot = path.join(outDir, `hero_${hero}_${pose}.png`);
      await page.screenshot({ path: heroShot });
    }
    console.log(`✓ Hero [${hero.toUpperCase()}] all 6 poses captured`);
  }

  // Mobile Viewport Test (390 x 844)
  console.log('\nTesting Mobile Touch UI & Viewport (390x844)...');
  const mobilePage = await context.newPage();
  await mobilePage.setViewportSize({ width: 390, height: 844 });
  await mobilePage.goto(`${baseUrl}/?hero=shadow&biome=neon-undercity`);
  await mobilePage.waitForTimeout(3000);
  const mobileShot = path.join(outDir, '09_mobile_viewport_390x844.png');
  await mobilePage.screenshot({ path: mobileShot });
  console.log(`✓ Mobile Viewport (390x844) -> ${mobileShot}`);
  await mobilePage.close();

  // Cyber Bay / Shop Modal
  console.log('Testing Cyber Bay Modal...');
  const shopBtn = await page.$('button[title*="Cosmetics"], button[title*="Cyber"], button:has(svg.lucide-palette)');
  if (shopBtn) {
    await shopBtn.click({ force: true });
    await page.waitForTimeout(800);
    const shopShot = path.join(outDir, '10_cyber_bay_surfboards.png');
    await page.screenshot({ path: shopShot });
    console.log(`✓ Cyber Bay Modal -> ${shopShot}`);
  }

  await browser.close();
  await server.close();
  console.log('\n=== Full QA Suite Execution Complete! ===');
}

main().catch((err) => {
  console.error('QA Suite Error:', err);
  process.exit(1);
});
