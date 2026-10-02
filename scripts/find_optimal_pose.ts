import { createServer } from 'vite';
import { chromium } from 'playwright';
import * as path from 'path';

async function main() {
  const server = await createServer({
    server: { port: 5184, host: '127.0.0.1' },
    configFile: path.resolve(process.cwd(), 'vite.config.ts'),
  });
  await server.listen();

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });

  for (const hero of ['shadow', 'flame', 'thunder', 'frost', 'void']) {
    const url = `http://127.0.0.1:5184/hero-lab.html?hero=${hero}&pose=run&view=side&time=0`;
    await page.goto(url);
    await page.waitForFunction(() => (window as any).__labReady === true, { timeout: 15000 });
    const info = await page.evaluate(() => (window as any).__labInfo);
    console.log(`\n=================== HERO: ${hero.toUpperCase()} ===================`);
    console.log('Hips Pos:', info.bones.hips?.worldPos);
    console.log('Left Shin / Knee Pos:', info.bones.shinL?.worldPos);
    console.log('Right Shin / Knee Pos:', info.bones.shinR?.worldPos);
    console.log('Left Hand / Forearm Pos:', info.bones.foreArmL?.worldPos);
    console.log('Right Hand / Forearm Pos:', info.bones.foreArmR?.worldPos);

    await page.screenshot({ path: path.join(process.cwd(), `screenshots/quick/${hero}_side_test.png`) });
  }

  await browser.close();
  await server.close();
}

main().catch(console.error);
