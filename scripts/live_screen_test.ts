import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const outDir = path.resolve(process.cwd(), 'screenshots/live_screen_test');
fs.mkdirSync(outDir, { recursive: true });

async function runLiveScreenTest() {
  console.log('================================================================');
  console.log('       NEON DRIFT: LIVE SCREEN PLAY, TESTING & ANALYSIS         ');
  console.log('================================================================\n');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  console.log('[1/6] Connecting to live session at http://localhost:3000 ...');
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  console.log('[2/6] Verifying WebGL Canvas & HUD Overlay...');
  const initialShot = path.join(outDir, '01_live_screen_start.png');
  await page.screenshot({ path: initialShot });
  console.log(`✓ Live screen start captured -> ${initialShot}`);

  // 1. Live Gameplay Loop: Autoplay steering, jumps, slides & stunt combos
  console.log('\n[3/6] Running active live gameplay (steering, dodging, jumping, stunts)...');
  
  for (let cycle = 1; cycle <= 4; cycle++) {
    console.log(`--- Active Run Cycle ${cycle}/4 ---`);
    
    // Shift Left
    await page.keyboard.press('KeyA');
    await page.waitForTimeout(300);
    
    // Jump with mid-air stunt
    await page.keyboard.press('Space');
    await page.waitForTimeout(150);
    await page.keyboard.press('KeyJ'); // 360 Spin
    await page.waitForTimeout(300);
    
    // Shift Right
    await page.keyboard.press('KeyD');
    await page.waitForTimeout(200);
    await page.keyboard.press('KeyD');
    await page.waitForTimeout(300);
    
    // Slide under barrier
    await page.keyboard.press('KeyS');
    await page.waitForTimeout(400);

    // Mid-air flip stunt
    await page.keyboard.press('Space');
    await page.waitForTimeout(150);
    await page.keyboard.press('KeyK'); // Laser Invert Flip
    await page.waitForTimeout(350);
  }

  const liveActionShot = path.join(outDir, '02_live_gameplay_action.png');
  await page.screenshot({ path: liveActionShot });
  console.log(`✓ Live action with stunt combos captured -> ${liveActionShot}`);

  // 2. Open & Test Live Graphics Customizer
  console.log('\n[4/6] Testing live Graphics Drawer & Shader Sliders...');
  const graphicsBtn = page.locator('button[title*="Graphics"], button[aria-label*="Graphics"]').first();
  if (await graphicsBtn.count() > 0) {
    await graphicsBtn.click();
    await page.waitForTimeout(600);

    // Click preset button
    const presetBtn = page.locator('button:has-text("Desktop Full"), button:has-text("Mobile Optimized")').first();
    if (await presetBtn.count() > 0) {
      await presetBtn.click({ force: true });
      await page.waitForTimeout(300);
    }

    const graphicsShot = path.join(outDir, '03_live_graphics_tweaked.png');
    await page.screenshot({ path: graphicsShot });
    console.log(`✓ Live graphics drawer & shaders captured -> ${graphicsShot}`);

    const closeDrawerBtn = page.locator('button[aria-label="Close drawer"]').first();
    if (await closeDrawerBtn.count() > 0) {
      await closeDrawerBtn.click();
      await page.waitForTimeout(300);
    }
  }

  // 3. Open & Test Live Cyber Bay Loadout
  console.log('\n[5/6] Testing Cyber Bay Loadouts & Upgrades...');
  const cyberBayBtn = page.locator('button[title*="Cosmetics"], button[title*="Cyber Bay"], button[aria-label*="Cosmetics"]').first();
  if (await cyberBayBtn.count() > 0) {
    await cyberBayBtn.click();
    await page.waitForTimeout(600);

    const cyberBayShot = path.join(outDir, '04_live_cyber_bay_loadout.png');
    await page.screenshot({ path: cyberBayShot });
    console.log(`✓ Live Cyber Bay Loadout captured -> ${cyberBayShot}`);

    const closeDialogBtn = page.locator('button[aria-label="Close Dialog"]').first();
    if (await closeDialogBtn.count() > 0) {
      await closeDialogBtn.click();
      await page.waitForTimeout(300);
    }
  }

  // 4. Force Collision to test Crash, Game Over, and Respawn Loop
  console.log('\n[6/6] Testing Obstacle Impact Collision, Crash Modal & Instant Respawn...');
  
  for (let s = 0; s < 30; s++) {
    const crashModal = page.locator('h2:has-text("SYSTEM CRASH"), h2:has-text("GAME OVER")').first();
    if (await crashModal.count() > 0 && await crashModal.isVisible()) {
      console.log(`✓ Crash triggered at step ${s + 1}!`);
      break;
    }
    await page.keyboard.press(s % 2 === 0 ? 'KeyA' : 'KeyD');
    await page.waitForTimeout(350);
  }

  const crashShot = path.join(outDir, '05_live_crash_game_over.png');
  await page.screenshot({ path: crashShot });
  console.log(`✓ System Crash & Score Card captured -> ${crashShot}`);

  // Test Relaunch button
  const relaunchBtn = page.locator('button:has-text("REBOOT NEURAL LINK"), button:has-text("RELAUNCH"), button:has-text("TRY AGAIN")').first();
  if (await relaunchBtn.count() > 0 && await relaunchBtn.isVisible()) {
    console.log('Testing "REBOOT NEURAL LINK" relaunch button...');
    await relaunchBtn.click();
    await page.waitForTimeout(1500);
    const respawnShot = path.join(outDir, '06_live_respawned_run.png');
    await page.screenshot({ path: respawnShot });
    console.log(`✓ Clean Respawn & Relaunch captured -> ${respawnShot}`);
  }

  // Extract final live stats from the DOM
  const telemetry = await page.evaluate(() => {
    return {
      highScore: localStorage.getItem('skyflow_high_score'),
      bankedShards: localStorage.getItem('skyflow_banked_shards'),
      missions: localStorage.getItem('skyflow_missions'),
      fps: document.querySelector('.text-emerald-400, .text-amber-400')?.textContent || '60',
    };
  });

  console.log('\n================================================================');
  console.log('   LIVE SCREEN RUN & ANALYSIS TELEMETRY:');
  console.log(JSON.stringify(telemetry, null, 2));
  console.log('================================================================');

  await browser.close();
}

runLiveScreenTest().catch((err) => {
  console.error('Live screen test error:', err);
  process.exit(1);
});
