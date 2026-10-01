import { createServer } from 'vite';
import { chromium } from 'playwright';
import * as path from 'path';

async function main() {
  const server = await createServer({
    server: { port: 5177, host: '127.0.0.1' },
    configFile: path.resolve(process.cwd(), 'vite.config.ts'),
  });
  await server.listen();
  const address = server.httpServer?.address();
  const port = typeof address === 'object' && address ? address.port : 5177;

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  await page.goto(`http://127.0.0.1:${port}/?hero=flame&biome=dune-nomad`);
  await page.waitForTimeout(3000);

  const heroStatus = await page.evaluate(() => {
    return {
      activeHero: (window as any).__heroReady,
      localStorage: localStorage.getItem('skyflow_cosmetics'),
    };
  });
  console.log('Hero Status in Browser:', heroStatus);

  await browser.close();
  await server.close();
}

main().catch(console.error);
