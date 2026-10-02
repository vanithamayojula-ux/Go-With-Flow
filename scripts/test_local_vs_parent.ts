import { createServer } from 'vite';
import { chromium } from 'playwright';
import * as path from 'path';

async function main() {
  const server = await createServer({
    server: { port: 5190, host: '127.0.0.1' },
    configFile: path.resolve(process.cwd(), 'vite.config.ts'),
  });
  await server.listen();
  const address = server.httpServer?.address();
  const port = typeof address === 'object' && address ? address.port : 5190;

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  for (const hero of ['void', 'shadow', 'flame', 'thunder', 'frost']) {
    await page.goto(`http://127.0.0.1:${port}/hero-lab.html?hero=${hero}&pose=run&view=back&time=0`);
    await page.waitForFunction(() => (window as any).__labReady === true, { timeout: 15000 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: `screenshots/back_diagnostics/${hero}_back_test.png` });

    await page.goto(`http://127.0.0.1:${port}/hero-lab.html?hero=${hero}&pose=run&view=side&time=0`);
    await page.waitForFunction(() => (window as any).__labReady === true, { timeout: 15000 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: `screenshots/back_diagnostics/${hero}_side_test.png` });
  }

  await browser.close();
  await server.close();
  console.log('Capture complete');
}

main().catch(console.error);
