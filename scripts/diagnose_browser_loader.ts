import { createServer } from 'vite';
import { chromium } from 'playwright';
import * as path from 'path';

async function main() {
  const server = await createServer({
    server: { port: 5198, host: '127.0.0.1' },
    configFile: path.resolve(process.cwd(), 'vite.config.ts'),
  });
  await server.listen();
  const address = server.httpServer?.address();
  const port = typeof address === 'object' && address ? address.port : 5198;

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  page.on('console', msg => console.log(`[PAGE LOG ${msg.type()}]:`, msg.text()));
  page.on('pageerror', err => console.error('[PAGE ERROR]:', err));

  await page.goto(`http://127.0.0.1:${port}/?hero=void&autoplay=true`);
  await page.waitForTimeout(3000);

  const res = await page.evaluate(async () => {
    const pm = (window as any).__playerManager;
    console.log('Testing pm.switchHero manually in browser:');
    if (!pm) return { err: 'No pm' };
    const success = await pm.playerCharacter.setHero('void');
    return {
      success,
      activeHeroId: pm.playerCharacter.activeHeroId,
      hasHeroRig: !!pm.playerCharacter.heroRig,
      spineVisible: pm.playerCharacter.spineGroup?.visible,
    };
  });

  console.log('Manual switchHero evaluation result:', res);
  await page.screenshot({ path: 'screenshots/back_view_fixed/after_manual_switch.png' });

  await browser.close();
  await server.close();
}

main().catch(console.error);
