import { createServer } from 'vite';
import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const outDir = path.resolve(process.cwd(), 'screenshots/back_diagnostics');
  fs.mkdirSync(outDir, { recursive: true });

  const server = await createServer({
    server: { port: 5188, host: '127.0.0.1' },
    configFile: path.resolve(process.cwd(), 'vite.config.ts'),
  });
  await server.listen();
  const address = server.httpServer?.address();
  const port = typeof address === 'object' && address ? address.port : 5188;

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  // 1. Lab captures for all heroes with back view
  for (const hero of ['void', 'shadow', 'flame', 'thunder', 'frost']) {
    for (const pose of ['bind', 'run']) {
      await page.goto(`http://127.0.0.1:${port}/hero-lab.html?hero=${hero}&pose=${pose}&view=back&time=0`);
      await page.waitForFunction(() => (window as any).__labReady === true, { timeout: 15000 });
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(outDir, `${hero}_${pose}_back.png`) });
      console.log(`Captured ${hero}_${pose}_back.png`);
    }
  }

  // 2. In-game gameplay capture with void hero
  await page.goto(`http://127.0.0.1:${port}/?hero=void&autoplay=true`);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(outDir, `ingame_void_back.png`) });
  console.log(`Captured ingame_void_back.png`);

  await browser.close();
  await server.close();
}

main().catch(console.error);
