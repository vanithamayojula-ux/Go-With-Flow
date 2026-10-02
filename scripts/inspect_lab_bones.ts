import { createServer } from 'vite';
import { chromium } from 'playwright';
import * as path from 'path';

async function main() {
  const server = await createServer({
    server: { port: 5182, host: '127.0.0.1' },
    configFile: path.resolve(process.cwd(), 'vite.config.ts'),
  });
  await server.listen();

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  for (const hero of ['shadow', 'void', 'flame', 'thunder', 'frost']) {
    const url = `http://127.0.0.1:5182/hero-lab.html?hero=${hero}&pose=run&view=side&time=0`;
    await page.goto(url);
    await page.waitForFunction(() => (window as any).__labReady === true, { timeout: 15000 });
    const info = await page.evaluate(() => (window as any).__labInfo);
    console.log(`\n=================== HERO: ${hero.toUpperCase()} (RUN POSE) ===================`);
    for (const [name, b] of Object.entries(info.bones as Record<string, any>)) {
      console.log(`${name.padEnd(16)} WorldPos: [${b.worldPos.map((n: number) => n.toFixed(3)).join(', ')}] | LocalRotDeg: [${b.localRotDeg.map((n: number) => n.toFixed(1)).join(', ')}]`);
    }
  }

  await browser.close();
  await server.close();
}

main().catch(console.error);
