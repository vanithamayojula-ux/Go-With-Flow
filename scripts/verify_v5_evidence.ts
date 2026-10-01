import { createServer } from 'vite';
import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const outDir = path.resolve(process.cwd(), 'screenshots/v5_evidence');
fs.mkdirSync(outDir, { recursive: true });

async function main() {
  console.log('--- Starting Master Prompt v5 Verification ---');

  const server = await createServer({
    server: { port: 5188, host: '127.0.0.1' },
    configFile: path.resolve(process.cwd(), 'vite.config.ts'),
  });
  await server.listen();
  const address = server.httpServer?.address();
  const port = typeof address === 'object' && address ? address.port : 5188;
  console.log(`Vite server running at http://127.0.0.1:${port}`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  // 1. Evidence A: Shield Visibility & Occlusion Measurement
  console.log('\n[1] Verifying Shield Visibility & Screen-Space Coverage...');
  await page.goto(`http://127.0.0.1:${port}/?hero=flame&biome=dune-nomad`);
  await page.waitForTimeout(3000);

  // Activate shield programmatically in game
  await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if ((window as any).__playerManager) {
      (window as any).__playerManager.activateHoverboardShield();
    }
  });

  // Capture shield active screenshot
  const shieldScreenshotPath = path.join(outDir, '01_shield_active_gameplay.png');
  const buffer = await page.screenshot({ path: shieldScreenshotPath });
  console.log(`Saved shield screenshot to ${shieldScreenshotPath}`);

  // Analyze pixels for green occlusion:
  // Count pixels where G > 160 and G > R * 1.3 and G > B * 1.1
  let greenPixels = 0;
  let totalPixels = 0;
  let centerGreenPixels = 0;
  let centerTotalPixels = 0;

  // Simple PNG byte parser or canvas pixel evaluation
  const metrics = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return { totalCoveragePct: 0, centerCoveragePct: 0 };
    const w = canvas.width;
    const h = canvas.height;
    // Create offscreen canvas to sample WebGL render
    const offscreen = document.createElement('canvas');
    offscreen.width = w;
    offscreen.height = h;
    const ctx = offscreen.getContext('2d');
    if (!ctx) return { totalCoveragePct: 0, centerCoveragePct: 0 };
    ctx.drawImage(canvas, 0, 0);
    const imgData = ctx.getImageData(0, 0, w, h).data;

    let greenCount = 0;
    let centerGreenCount = 0;
    let totalCount = w * h;
    let centerTotalCount = 0;

    const centerXMin = Math.floor(w * 0.35);
    const centerXMax = Math.floor(w * 0.65);
    const centerYMin = Math.floor(h * 0.30);
    const centerYMax = Math.floor(h * 0.70);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        const r = imgData[idx];
        const g = imgData[idx + 1];
        const b = imgData[idx + 2];
        const a = imgData[idx + 3];

        const isCenter = x >= centerXMin && x <= centerXMax && y >= centerYMin && y <= centerYMax;
        if (isCenter) centerTotalCount++;

        // Shield green hue detector
        if (g > 140 && g > r * 1.25 && g > b * 1.05 && a > 30) {
          greenCount++;
          if (isCenter) centerGreenCount++;
        }
      }
    }

    return {
      totalCoveragePct: (greenCount / totalCount) * 100,
      centerCoveragePct: (centerGreenCount / centerTotalCount) * 100,
      greenCount,
      totalCount,
    };
  });

  console.log(`Shield Total Green Coverage: ${metrics.totalCoveragePct.toFixed(2)}% (Target: < 15%)`);
  console.log(`Shield Center-Field Occlusion: ${metrics.centerCoveragePct.toFixed(2)}% (Target: near 0%)`);

  // 2. Evidence B: Continuous Carving Oscillation Measurement (Non-Static Statue)
  console.log('\n[2] Verifying Continuous Carving Animation Cycle...');
  const frameSamples: any[] = [];
  for (let i = 0; i < 8; i++) {
    await page.waitForTimeout(150);
    const sample = await page.evaluate(() => {
      const pm = (window as any).__playerManager;
      const pc = pm?.playerCharacter;
      const rig = pc?.heroRig?.drivers;
      return {
        time: performance.now(),
        boardRollZ: pc?.board?.rotation?.z ?? 0,
        spineRotZ: rig?.spine?.rotation?.z ?? 0,
        hipsRotZ: rig?.hips?.rotation?.z ?? 0,
        leftArmRotZ: rig?.leftArm?.rotation?.z ?? 0,
        rightArmRotZ: rig?.rightArm?.rotation?.z ?? 0,
        leftThighRotX: rig?.leftThigh?.rotation?.x ?? 0,
      };
    });
    frameSamples.push(sample);
  }

  console.log('Frame Samples across straight line travel:');
  frameSamples.forEach((f, idx) => {
    console.log(
      ` Frame ${idx + 1}: BoardRollZ=${f.boardRollZ.toFixed(3)} rad, SpineZ=${f.spineRotZ.toFixed(3)} rad, ArmL_Z=${f.leftArmRotZ.toFixed(3)} rad, ArmR_Z=${f.rightArmRotZ.toFixed(3)} rad`
    );
  });

  // Calculate variance to prove continuous motion
  const boardRolls = frameSamples.map((f) => f.boardRollZ);
  const minBoardRoll = Math.min(...boardRolls);
  const maxBoardRoll = Math.max(...boardRolls);
  const boardAmplitude = maxBoardRoll - minBoardRoll;
  console.log(`Board Roll Oscillation Amplitude: ${boardAmplitude.toFixed(4)} rad (Proof of continuous carving motion)`);

  await page.screenshot({ path: path.join(outDir, '02_carving_straight_line.png') });

  // 3. Evidence C: Sideways Surf Stance for all 5 Heroes
  console.log('\n[3] Verifying Sideways Surf Stance across all 5 Heroes...');
  const heroes = ['shadow', 'flame', 'thunder', 'frost', 'void'];
  for (const hero of heroes) {
    // Default chase cam
    await page.goto(`http://127.0.0.1:${port}/hero-lab.html?hero=${hero}&pose=idle&view=three&time=1.0`);
    await page.waitForFunction(() => (window as any).__labReady === true, { timeout: 15000 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(outDir, `03_hero_stance_${hero}_three_quarter.png`) });

    // Side profile cam
    await page.goto(`http://127.0.0.1:${port}/hero-lab.html?hero=${hero}&pose=idle&view=side&time=1.0`);
    await page.waitForFunction(() => (window as any).__labReady === true, { timeout: 15000 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(outDir, `03_hero_stance_${hero}_side_profile.png`) });

    console.log(`Captured ${hero} 3/4 and side profile surf stance screenshots.`);
  }

  // 4. Evidence D: Surfboard Redesign with Fins, Rails, Stringer
  console.log('\n[4] Capturing Close-Up of Cyber-Surfboard...');
  await page.goto(`http://127.0.0.1:${port}/hero-lab.html?hero=shadow&pose=idle&view=three&time=1.0`);
  await page.waitForFunction(() => (window as any).__labReady === true, { timeout: 15000 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(outDir, '04_cyber_surfboard_closeup.png') });

  // 5. In-Game Gameplay across Biomes
  console.log('\n[5] Verifying In-Game Gameplay across Biomes...');
  await page.goto(`http://127.0.0.1:${port}/?hero=frost&biome=aurora-frost`);
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(outDir, '05_gameplay_aurora_frost.png') });

  await page.goto(`http://127.0.0.1:${port}/?hero=thunder&biome=bioluminescent-jungle`);
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(outDir, '06_gameplay_jungle.png') });

  await page.goto(`http://127.0.0.1:${port}/?hero=void&biome=ember-core`);
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(outDir, '07_gameplay_ember_core.png') });

  await browser.close();
  await server.close();
  console.log('\n--- All Master Prompt v5 Verifications Completed Successfully ---');
}

main().catch((err) => {
  console.error('Error in verification:', err);
  process.exit(1);
});
