import { createServer } from 'vite';
import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const outDir = path.resolve(process.cwd(), 'screenshots/verification');
fs.mkdirSync(outDir, { recursive: true });

async function main() {
  console.log('Starting Vite server for comprehensive verification...');
  const server = await createServer({
    server: { port: 5178, host: '127.0.0.1' },
    configFile: path.resolve(process.cwd(), 'vite.config.ts'),
  });
  await server.listen();
  const address = server.httpServer?.address();
  const port = typeof address === 'object' && address ? address.port : 5178;
  console.log(`Vite server running at http://127.0.0.1:${port}`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  // 1. Test Dune Nomad with Flame Emperor
  console.log('Testing Dune Nomad with Flame Emperor...');
  await page.goto(`http://127.0.0.1:${port}/?hero=flame&biome=dune-nomad`);
  await page.waitForTimeout(3500); // allow GLB load & skating
  await page.screenshot({ path: path.join(outDir, '01_dune_nomad_flame_running.png') });

  // Test lane change left
  await page.keyboard.press('KeyA');
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(outDir, '02_dune_nomad_flame_left_lane.png') });

  // Test lane change right
  await page.keyboard.press('KeyD');
  await page.waitForTimeout(400);
  await page.keyboard.press('KeyD');
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(outDir, '03_dune_nomad_flame_right_lane.png') });

  // Test in-game crouch slide
  await page.keyboard.down('ArrowDown');
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(outDir, '04_dune_nomad_flame_slide.png') });
  await page.keyboard.up('ArrowDown');
  await page.waitForTimeout(400);

  // Test in-game jump
  await page.keyboard.down('Space');
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(outDir, '05_dune_nomad_flame_jump.png') });
  await page.keyboard.up('Space');
  await page.waitForTimeout(600);

  // 2. Test Aurora Frost with Frost Guardian
  console.log('Testing Aurora Frost with Frost Guardian...');
  await page.goto(`http://127.0.0.1:${port}/?hero=frost&biome=aurora-frost`);
  await page.waitForTimeout(3500);
  await page.screenshot({ path: path.join(outDir, '06_aurora_frost_frost_guardian.png') });

  // 3. Test Bioluminescent Jungle with Thunder Rider
  console.log('Testing Bioluminescent Jungle with Thunder Rider...');
  await page.goto(`http://127.0.0.1:${port}/?hero=thunder&biome=bioluminescent-jungle`);
  await page.waitForTimeout(3500);
  await page.screenshot({ path: path.join(outDir, '07_jungle_thunder_rider.png') });

  // 4. Test Ember Core with Void Walker
  console.log('Testing Ember Core with Void Walker...');
  await page.goto(`http://127.0.0.1:${port}/?hero=void&biome=ember-core`);
  await page.waitForTimeout(3500);
  await page.screenshot({ path: path.join(outDir, '08_ember_core_void_walker.png') });

  // 5. Test Neon Undercity with Shadow Blade
  console.log('Testing Neon Undercity with Shadow Blade...');
  await page.goto(`http://127.0.0.1:${port}/?hero=shadow&biome=neon-undercity`);
  await page.waitForTimeout(3500);
  await page.screenshot({ path: path.join(outDir, '09_neon_undercity_shadow_blade.png') });

  // 6. Test Cyber Bay Modal
  console.log('Testing Cyber Bay modal...');
  const shopBtn = await page.$('button[title*="Cosmetics"], button[title*="Cyber"], button:has(svg.lucide-palette)');
  if (shopBtn) {
    await shopBtn.click({ force: true });
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(outDir, '10_cyber_bay_modal.png') });
  }

  await browser.close();
  await server.close();
  console.log('Verification run finished successfully!');
}

main().catch((err) => {
  console.error('Error during verification:', err);
  process.exit(1);
});
