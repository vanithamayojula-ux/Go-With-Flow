import { createServer } from 'vite';
import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const outDir = path.resolve(process.cwd(), 'screenshots/quick');
  fs.mkdirSync(outDir, { recursive: true });

  const server = await createServer({
    server: { port: 5180, host: '127.0.0.1' },
    configFile: path.resolve(process.cwd(), 'vite.config.ts'),
  });
  await server.listen();

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });

  for (const hero of ['shadow', 'void', 'flame', 'thunder', 'frost']) {
    for (const view of ['side', 'three', 'front']) {
      const url = `http://127.0.0.1:5180/hero-lab.html?hero=${hero}&pose=run&view=${view}&time=1.0`;
      await page.goto(url);
      await page.waitForFunction(() => (window as any).__labReady === true, { timeout: 15000 });
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(outDir, `${hero}_run_${view}.png`) });
    }
  }

  await browser.close();
  await server.close();
  console.log('Quick capture completed!');
}

main().catch(console.error);
