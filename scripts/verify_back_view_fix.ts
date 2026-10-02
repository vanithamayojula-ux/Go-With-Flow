import { createServer } from 'vite';
import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const outDir = path.resolve(process.cwd(), 'screenshots/back_view_fixed');
  fs.mkdirSync(outDir, { recursive: true });

  const server = await createServer({
    server: { port: 5192, host: '127.0.0.1' },
    configFile: path.resolve(process.cwd(), 'vite.config.ts'),
  });
  await server.listen();
  const address = server.httpServer?.address();
  const port = typeof address === 'object' && address ? address.port : 5192;

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  // 1. Hero Lab Bind and Run back views for all heroes
  const heroes = ['void', 'shadow', 'flame', 'thunder', 'frost'];
  for (const hero of heroes) {
    // Bind Pose Back View (Verify opaque, no ghost)
    await page.goto(`http://127.0.0.1:${port}/hero-lab.html?hero=${hero}&pose=bind&view=back&time=0`);
    await page.waitForFunction(() => (window as any).__labReady === true, { timeout: 15000 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(outDir, `${hero}_bind_back.png`) });
    console.log(`Captured ${hero}_bind_back.png`);

    // Run Pose Back View (Verify boots locked to board, board wide & flat, no high kick)
    await page.goto(`http://127.0.0.1:${port}/hero-lab.html?hero=${hero}&pose=run&view=back&time=0`);
    await page.waitForFunction(() => (window as any).__labReady === true, { timeout: 15000 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(outDir, `${hero}_run_back.png`) });
    console.log(`Captured ${hero}_run_back.png`);

    // Run Pose Side View
    await page.goto(`http://127.0.0.1:${port}/hero-lab.html?hero=${hero}&pose=run&view=side&time=0`);
    await page.waitForFunction(() => (window as any).__labReady === true, { timeout: 15000 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(outDir, `${hero}_run_side.png`) });
    console.log(`Captured ${hero}_run_side.png`);
  }

  // 2. In-game gameplay verification for heroes
  for (const hero of ['void', 'shadow', 'flame', 'thunder', 'frost']) {
    await page.goto(`http://127.0.0.1:${port}/?hero=${hero}&autoplay=true`);
    await page.waitForFunction(() => !!(window as any).__playerManager?.playerCharacter?.heroRig, { timeout: 15000 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(outDir, `ingame_${hero}_gameplay_back.png`) });
    console.log(`Captured ingame_${hero}_gameplay_back.png`);
  }

  await browser.close();
  await server.close();
  console.log('All verification screenshots captured successfully!');
}

main().catch(console.error);
