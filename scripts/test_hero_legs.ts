import { createServer } from 'vite';
import { chromium } from 'playwright';
import * as path from 'path';

async function main() {
  const server = await createServer({
    server: { port: 5183, host: '127.0.0.1' },
    configFile: path.resolve(process.cwd(), 'vite.config.ts'),
  });
  await server.listen();

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const url = `http://127.0.0.1:5183/hero-lab.html?hero=shadow&pose=run&view=side&time=0`;
  await page.goto(url);
  await page.waitForFunction(() => (window as any).__labReady === true, { timeout: 15000 });

  const info = await page.evaluate(() => (window as any).__labInfo);
  console.log('Shadow Bones in Run Pose:');
  for (const [name, b] of Object.entries(info.bones as Record<string, any>)) {
    console.log(`  ${name.padEnd(16)} WorldPos: [${b.worldPos.map((n: number) => n.toFixed(3)).join(', ')}]`);
  }

  await browser.close();
  await server.close();
}

main().catch(console.error);
