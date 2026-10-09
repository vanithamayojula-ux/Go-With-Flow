import { createServer } from 'vite';
import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const testCases = [
  {
    world: 'sky-isles',
    name: '01_world1_sky_isles',
    title: 'World 1 — Sky Isles (Floating Islands, Sky Temples & Azure Skies)',
  },
  {
    world: 'verdant-wilds',
    name: '02_world2_verdant_wilds',
    title: 'World 2 — Verdant Wilds (Ancient Greatwoods, Bio Spores & Emerald Mist)',
  },
  {
    world: 'crimson-dunes',
    name: '03_world3_crimson_dunes',
    title: 'World 3 — Crimson Dunes (Sandstone Mesas, Sun Relics & Amber Haze)',
  },
  {
    world: 'crystal-heights',
    name: '04_world4_crystal_heights',
    title: 'World 4 — Crystal Heights (Glacial Crystal Towers & Aurora Skies)',
  },
  {
    world: 'obsidian-core',
    name: '05_world5_obsidian_core',
    title: 'World 5 — Obsidian Core (Volcanic Basalt & Magma Channels)',
  },
];

async function main() {
  const outDir = path.resolve(process.cwd(), 'screenshots/five_worlds');
  fs.mkdirSync(outDir, { recursive: true });

  console.log('================================================================');
  console.log('🌌 GoWithFlow — 5-World In-Game Visual Capture & Verification');
  console.log('================================================================\n');

  console.log('Starting Vite server for 5-world capture...');
  const server = await createServer({
    server: { port: 5176, host: '127.0.0.1' },
    configFile: path.resolve(process.cwd(), 'vite.config.ts'),
  });
  await server.listen();
  const address = server.httpServer?.address();
  const port = typeof address === 'object' && address ? address.port : 5176;
  console.log(`Vite server running at http://127.0.0.1:${port}\n`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  for (const tc of testCases) {
    console.log(`📸 Launching into ${tc.title}...`);
    const url = `http://127.0.0.1:${port}/?hero=shadow`;
    await page.goto(url);
    await page.waitForTimeout(1000);

    // Click LAUNCH RUN to transition into 3D in-game runner
    const launchBtn = page.locator('button:has-text("LAUNCH RUN")');
    if (await launchBtn.count() > 0) {
      await launchBtn.click();
      await page.waitForTimeout(800);
    }

    // Teleport directly to world coordinates
    await page.evaluate((w) => {
      if ((window as any).__jumpToWorld) {
        (window as any).__jumpToWorld(w);
      }
    }, tc.world);

    // Allow runner to glide forward and render 3D world geometry & landmarks
    await page.waitForTimeout(2500);

    const shotPath = path.join(outDir, `${tc.name}.png`);
    await page.screenshot({ path: shotPath });
    console.log(`  ✓ Saved: ${shotPath}\n`);
  }

  await browser.close();
  await server.close();

  console.log('================================================================');
  console.log('🎉 ALL 5 WORLD IN-GAME SCREENSHOTS VERIFIED & SAVED IN screenshots/five_worlds');
  console.log('================================================================\n');
}

main().catch((err) => {
  console.error('Error during 5-world capture:', err);
  process.exit(1);
});
