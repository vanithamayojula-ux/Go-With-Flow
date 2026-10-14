import { createServer } from 'vite';
import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const testCases = [
  {
    world: 'sky-isles',
    name: 'before_01_sky_isles',
    title: 'World 1 — Sky Isles',
  },
  {
    world: 'verdant-wilds',
    name: 'before_02_verdant_wilds',
    title: 'World 2 — Verdant Wilds',
  },
  {
    world: 'crimson-dunes',
    name: 'before_03_crimson_dunes',
    title: 'World 3 — Crimson Dunes',
  },
  {
    world: 'crystal-heights',
    name: 'before_04_crystal_heights',
    title: 'World 4 — Crystal Heights',
  },
  {
    world: 'obsidian-core',
    name: 'before_05_obsidian_core',
    title: 'World 5 — Obsidian Core',
  },
];

async function main() {
  const outDir = path.resolve(process.cwd(), 'screenshots/sprint2_comparison');
  fs.mkdirSync(outDir, { recursive: true });

  console.log('Starting Vite server for baseline capture...');
  const server = await createServer({
    server: { port: 5185, host: '127.0.0.1' },
    configFile: path.resolve(process.cwd(), 'vite.config.ts'),
  });
  await server.listen();
  const address = server.httpServer?.address();
  const port = typeof address === 'object' && address ? address.port : 5185;

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  for (const tc of testCases) {
    console.log(`Capturing baseline for ${tc.title}...`);
    const url = `http://127.0.0.1:${port}/?hero=shadow`;
    await page.goto(url);
    await page.waitForTimeout(1000);

    const launchBtn = page.locator('button:has-text("LAUNCH RUN")');
    if (await launchBtn.count() > 0) {
      await launchBtn.click();
      await page.waitForTimeout(800);
    }

    await page.evaluate((w) => {
      if ((window as any).__jumpToWorld) {
        (window as any).__jumpToWorld(w);
      }
    }, tc.world);

    await page.waitForTimeout(2500);

    const shotPath = path.join(outDir, `${tc.name}.png`);
    await page.screenshot({ path: shotPath });
    console.log(`  ✓ Saved baseline: ${shotPath}`);
  }

  await browser.close();
  await server.close();
  console.log('Baseline capture complete.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
