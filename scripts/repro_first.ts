import { createServer } from 'vite';
import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

async function repro() {
  const outDir = path.resolve(process.cwd(), 'screenshots/repro_initial');
  fs.mkdirSync(outDir, { recursive: true });

  const server = await createServer({
    server: { port: 5178, host: '127.0.0.1' },
    configFile: path.resolve(process.cwd(), 'vite.config.ts'),
  });
  await server.listen();
  const address = server.httpServer?.address();
  const port = typeof address === 'object' && address ? address.port : 5178;

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });

  const consoleMsgs: string[] = [];
  page.on('console', msg => consoleMsgs.push(msg.text()));

  const poses = ['bind', 'idle', 'run', 'slide', 'jump'];
  const views = ['front', 'side', 'three'];

  for (const pose of poses) {
    for (const view of views) {
      const url = `http://127.0.0.1:${port}/hero-lab.html?hero=void&pose=${pose}&view=${view}&time=0`;
      await page.goto(url);
      await page.waitForFunction(() => (window as any).__labReady === true, { timeout: 15000 });
      await page.waitForTimeout(400);

      const info = await page.evaluate(() => (window as any).__labInfo);
      if (pose === 'bind' && view === 'front') {
        const boneCount = Object.keys(info.bones || {}).length;
        console.log('Void bone count:', boneCount);
        console.log('Bone names:', Object.keys(info.bones || {}));
      }
      const screenshotPath = path.join(outDir, `void_${pose}_${view}.png`);
      await page.screenshot({ path: screenshotPath });
    }
  }

  // Also capture in-game void
  console.log('Capturing in-game void...');
  await page.goto(`http://127.0.0.1:${port}/?hero=void`);
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(outDir, `void_gameplay_initial.png`) });

  console.log('Console messages:', consoleMsgs.slice(0, 10));

  await browser.close();
  await server.close();
  console.log('Repro screenshots saved to screenshots/repro_initial');
}

repro().catch(console.error);
