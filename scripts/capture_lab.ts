import { createServer } from 'vite';
import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const heroes = ['shadow', 'flame', 'thunder', 'frost', 'void'];
const poses = ['bind', 'idle', 'run', 'slide', 'jump'];
const views = ['side', 'three', 'front'];

async function main() {
  const outDir = path.resolve(process.cwd(), 'screenshots/lab');
  fs.mkdirSync(outDir, { recursive: true });

  console.log('Starting Vite dev server...');
  const server = await createServer({
    server: { port: 5174, host: '127.0.0.1' },
    configFile: path.resolve(process.cwd(), 'vite.config.ts'),
  });
  await server.listen();
  const address = server.httpServer?.address();
  const port = typeof address === 'object' && address ? address.port : 5174;
  console.log(`Vite server running at http://127.0.0.1:${port}`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });

  for (const hero of heroes) {
    for (const pose of poses) {
      for (const view of views) {
        const time = pose === 'bind' || pose === 'idle' ? 0 : 1.0;
        const url = `http://127.0.0.1:${port}/hero-lab.html?hero=${hero}&pose=${pose}&view=${view}&time=${time}`;
        await page.goto(url);
        await page.waitForFunction(() => (window as any).__labReady === true, { timeout: 15000 });
        await page.waitForTimeout(400);

        const screenshotPath = path.join(outDir, `${hero}_${pose}_${view}.png`);
        await page.screenshot({ path: screenshotPath });
        console.log(`Captured ${hero} [${pose}] [${view}]`);
      }
    }
  }

  await browser.close();
  await server.close();
  console.log('All lab captures completed successfully!');
}

main().catch((err) => {
  console.error('Error during capture:', err);
  process.exit(1);
});
