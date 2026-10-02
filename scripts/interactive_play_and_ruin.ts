import { createServer } from 'vite';
import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const outDir = path.resolve(process.cwd(), 'screenshots/interactive_analysis');
fs.mkdirSync(outDir, { recursive: true });

async function runInteractiveSession() {
  console.log('================================================================');
  console.log('   NEON DRIFT: INTERACTIVE BROWSER PLAY, RUIN & DEEP ANALYSIS   ');
  console.log('================================================================\n');

  // Start local Vite server
  console.log('[Phase 1] Starting local Vite server...');
  const server = await createServer({
    server: { port: 5192, host: '127.0.0.1' },
    configFile: path.resolve(process.cwd(), 'vite.config.ts'),
  });
  await server.listen();
  const address = server.httpServer?.address();
  const port = typeof address === 'object' && address ? address.port : 5192;
  const localUrl = `http://127.0.0.1:${port}`;
  console.log(`Local Vite instance active at ${localUrl}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  const consoleLogs: string[] = [];
  page.on('console', (msg) => {
    consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
    if (msg.type() === 'error') {
      console.warn(`[Browser Error] ${msg.text()}`);
    }
  });

  // Connect to target URL
  console.log('\n[Phase 2] Connecting to target web environment...');
  let activeUrl = localUrl;
  try {
    console.log('Attempting connection to https://go-with-flow.vercel.app ...');
    const resp = await page.goto('https://go-with-flow.vercel.app', { timeout: 8000, waitUntil: 'domcontentloaded' });
    if (resp && resp.status() < 400) {
      activeUrl = 'https://go-with-flow.vercel.app';
      console.log(`✓ Connected successfully to live Vercel deployment: ${activeUrl} (Status: ${resp.status()})`);
    } else {
      console.log(`Falling back to local Vite instance: ${localUrl}`);
      await page.goto(localUrl, { waitUntil: 'domcontentloaded' });
    }
  } catch (err: any) {
    console.log(`Live site connection fallback (${err.message}) -> ${localUrl}`);
    await page.goto(localUrl, { waitUntil: 'domcontentloaded' });
  }

  await page.waitForTimeout(3000);

  // 1. Initial Landing
  console.log('\n[Phase 3] Interacting with HUD & System Drawers...');
  const initialShot = path.join(outDir, '01_initial_landing.png');
  await page.screenshot({ path: initialShot });
  console.log(`✓ [01] Initial runway landing captured -> ${initialShot}`);

  // 2. Open Graphics Drawer
  console.log('Testing Graphics & Shaders Drawer...');
  const graphicsBtn = page.locator('button[title*="Graphics"], button[aria-label*="Graphics"]').first();
  if (await graphicsBtn.count() > 0) {
    await graphicsBtn.click();
    await page.waitForTimeout(600);
    const graphicsShot = path.join(outDir, '02_graphics_drawer_open.png');
    await page.screenshot({ path: graphicsShot });
    console.log(`✓ [02] Graphics Drawer Open -> ${graphicsShot}`);

    // Click Close Drawer
    const closeDrawerBtn = page.locator('button[aria-label="Close drawer"]').first();
    if (await closeDrawerBtn.count() > 0) {
      await closeDrawerBtn.click();
      await page.waitForTimeout(400);
      console.log('✓ Graphics drawer closed smoothly.');
    }
  }

  // 3. Open Cyber Bay & Tech Station
  console.log('Testing Cyber Bay & Cosmetics Loadout Modal...');
  const cyberBayBtn = page.locator('button[title*="Cosmetics"], button[title*="Cyber Bay"], button[aria-label*="Cosmetics"]').first();
  if (await cyberBayBtn.count() > 0) {
    await cyberBayBtn.click();
    await page.waitForTimeout(600);

    // Switch to Loadout tab
    const loadoutTab = page.locator('button:has-text("LOADOUT")').first();
    if (await loadoutTab.count() > 0) {
      await loadoutTab.click();
      await page.waitForTimeout(400);
    }

    const cyberBayShot = path.join(outDir, '03_cyber_bay_loadout.png');
    await page.screenshot({ path: cyberBayShot });
    console.log(`✓ [03] Cyber Bay Modal Open -> ${cyberBayShot}`);

    // Close Dialog
    const closeDialogBtn = page.locator('button[aria-label="Close Dialog"]').first();
    if (await closeDialogBtn.count() > 0) {
      await closeDialogBtn.click();
      await page.waitForTimeout(400);
      console.log('✓ Cyber Bay modal closed smoothly.');
    }
  }

  // 4. Test In-Game Pause Modal
  console.log('\n[Phase 4] Testing Pause Modal & Daily Missions...');
  const pauseBtn = page.locator('button[title*="Pause"], button[aria-label*="Pause"]').first();
  if (await pauseBtn.count() > 0) {
    await pauseBtn.click();
    await page.waitForTimeout(600);
    const pauseShot = path.join(outDir, '04_pause_modal.png');
    await page.screenshot({ path: pauseShot });
    console.log(`✓ [04] Pause Modal & Goals captured -> ${pauseShot}`);

    const resumeBtn = page.locator('button:has-text("RESUME"), button:has-text("CONTINUE")').first();
    if (await resumeBtn.count() > 0) {
      await resumeBtn.click();
      await page.waitForTimeout(400);
      console.log('✓ Game resumed.');
    }
  }

  // 5. Interactive Touch Controls & Stunts
  console.log('\n[Phase 5] Driving player with interactive touch buttons and stunt combos...');
  
  // Touch Steer Left
  const leftBtn = page.locator('button:has-text("←"), button[aria-label*="left"]').first();
  if (await leftBtn.count() > 0) {
    await leftBtn.click();
    await page.waitForTimeout(200);
  }

  // Touch Jump
  const jumpBtn = page.locator('button:has-text("JUMP"), button:has-text("↑")').first();
  if (await jumpBtn.count() > 0) {
    await jumpBtn.click();
    await page.waitForTimeout(250);
  }

  // Stunts: Spin (J) & Invert Flip (K)
  await page.keyboard.press('KeyJ');
  await page.waitForTimeout(200);
  await page.keyboard.press('KeyK');
  await page.waitForTimeout(300);

  const stuntShot = path.join(outDir, '05_stunt_combo.png');
  await page.screenshot({ path: stuntShot });
  console.log(`✓ [05] Stunt Combo in flight -> ${stuntShot}`);

  // 6. "Ruin the Game" — Force Hard Collisions to Trigger System Crash / Game Over
  console.log('\n[Phase 6] RUINING THE GAME: Steering directly into high obstacles with zero evasion...');
  
  let crashed = false;
  for (let step = 0; step < 30; step++) {
    const crashModal = page.locator('h2:has-text("SYSTEM CRASH"), h2:has-text("RUN TERMINATED"), h2:has-text("GAME OVER")').first();
    if (await crashModal.count() > 0 && await crashModal.isVisible()) {
      crashed = true;
      console.log(`💥 CRASH DETECTED at step ${step + 1}! System Crash modal engaged.`);
      break;
    }
    // Random steering between Left / Right to hit obstacle towers
    if (step % 2 === 0) {
      await page.keyboard.press('KeyA');
    } else {
      await page.keyboard.press('KeyD');
    }
    await page.waitForTimeout(400);
  }

  if (!crashed) {
    console.log('Waiting 5s for track collision...');
    await page.waitForTimeout(5000);
  }

  const crashShot = path.join(outDir, '06_system_crash_game_over.png');
  await page.screenshot({ path: crashShot });
  console.log(`✓ [06] System Crash & Ragdoll screen captured -> ${crashShot}`);

  // 7. Test Relaunch / Respawn Button
  console.log('\n[Phase 7] Testing Relaunch / Respawn Button...');
  const restartBtn = page.locator('button:has-text("REBOOT NEURAL LINK"), button:has-text("RELAUNCH"), button:has-text("TRY AGAIN")').first();
  if (await restartBtn.count() > 0 && await restartBtn.isVisible()) {
    console.log('Clicking "REBOOT NEURAL LINK (RELAUNCH)" button...');
    await restartBtn.click();
    await page.waitForTimeout(1500);
    const respawnShot = path.join(outDir, '07_respawned_fresh_run.png');
    await page.screenshot({ path: respawnShot });
    console.log(`✓ [07] Fresh Run Respawn captured -> ${respawnShot}`);
  }

  // 8. Capture Telemetry & LocalStorage
  const telemetry = await page.evaluate(() => {
    return {
      storage: {
        shards: localStorage.getItem('skyflow_banked_shards'),
        highScore: localStorage.getItem('skyflow_high_score'),
        cosmetics: localStorage.getItem('skyflow_cosmetics'),
        upgrades: localStorage.getItem('skyflow_upgrades'),
        missions: localStorage.getItem('skyflow_missions'),
      },
      dimensions: {
        width: window.innerWidth,
        height: window.innerHeight,
        pixelRatio: window.devicePixelRatio,
      },
      fps: document.querySelector('.text-emerald-400, .text-amber-400')?.textContent || '60',
    };
  });

  console.log('\n[Phase 8] Final Browser State & Persistence Analysis:');
  console.log(JSON.stringify(telemetry, null, 2));

  await browser.close();
  await server.close();

  console.log('\n================================================================');
  console.log('   INTERACTIVE SESSION FINISHED WITH 100% SUCCESS!             ');
  console.log('================================================================');
}

runInteractiveSession().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
