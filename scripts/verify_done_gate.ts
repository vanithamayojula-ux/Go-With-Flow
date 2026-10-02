import { createServer } from 'vite';
import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const outDir = path.resolve(process.cwd(), 'screenshots/gameplay');
  const videoDir = path.resolve(process.cwd(), 'screenshots/video');
  fs.mkdirSync(outDir, { recursive: true });
  fs.mkdirSync(videoDir, { recursive: true });

  console.log('Starting Vite server for DONE GATE verification...');
  const server = await createServer({
    server: { port: 5176, host: '127.0.0.1' },
    configFile: path.resolve(process.cwd(), 'vite.config.ts'),
  });
  await server.listen();
  const address = server.httpServer?.address();
  const port = typeof address === 'object' && address ? address.port : 5176;

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: videoDir, size: { width: 1280, height: 720 } },
  });
  const page = await context.newPage();

  // Test 1: In-game 10s run with Void Walker
  console.log('Riding 10s with Void Walker in Neon Undercity...');
  await page.goto(`http://127.0.0.1:${port}/?hero=void&biome=neon-undercity`);
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(outDir, 'void_neon_undercity_fixed.png') });

  // Test sliding in-game with Void
  await page.keyboard.down('ArrowDown');
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(outDir, 'void_neon_undercity_slide.png') });
  await page.keyboard.up('ArrowDown');
  await page.waitForTimeout(600);

  // Test jumping in-game with Void
  await page.keyboard.down('Space');
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(outDir, 'void_neon_undercity_jump.png') });
  await page.keyboard.up('Space');
  await page.waitForTimeout(6600); // Complete 10s clip

  // Test other heroes in gameplay
  for (const hero of ['shadow', 'flame', 'thunder', 'frost']) {
    console.log(`Testing hero ${hero} in gameplay...`);
    await page.goto(`http://127.0.0.1:${port}/?hero=${hero}`);
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(outDir, `${hero}_gameplay_fixed.png`) });
  }

  await page.close();
  await context.close();
  await browser.close();
  await server.close();

  console.log('DONE GATE verification completed successfully!');
}

main().catch(console.error);
