import { createServer } from 'vite';
import { chromium } from 'playwright';
import * as path from 'path';

async function main() {
  const server = await createServer({
    server: { port: 5189, host: '127.0.0.1' },
    configFile: path.resolve(process.cwd(), 'vite.config.ts'),
  });
  await server.listen();
  const address = server.httpServer?.address();
  const port = typeof address === 'object' && address ? address.port : 5189;

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  await page.goto(`http://127.0.0.1:${port}/hero-lab.html?hero=void&pose=run&view=back&time=0`);
  await page.waitForFunction(() => (window as any).__labReady === true, { timeout: 15000 });
  
  const info = await page.evaluate(() => (window as any).__labInfo);
  console.log('Void bone positions in run pose:');
  console.log(JSON.stringify(info.bones, null, 2));

  await page.screenshot({ path: 'screenshots/back_diagnostics/test_void_run_back.png' });
  await browser.close();
  await server.close();
}

main().catch(console.error);
