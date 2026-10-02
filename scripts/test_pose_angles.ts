import { createServer } from 'vite';
import { chromium } from 'playwright';
import * as path from 'path';

async function main() {
  const server = await createServer({
    server: { port: 5185, host: '127.0.0.1' },
    configFile: path.resolve(process.cwd(), 'vite.config.ts'),
  });
  await server.listen();

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });

  const url = `http://127.0.0.1:5185/hero-lab.html?hero=shadow&pose=run&view=side&time=0`;
  await page.goto(url);
  await page.waitForFunction(() => (window as any).__labReady === true, { timeout: 15000 });

  await page.screenshot({ path: path.join(process.cwd(), 'screenshots/quick/shadow_current_run.png') });
  console.log('Saved shadow_current_run.png');

  await browser.close();
  await server.close();
}

main().catch(console.error);
