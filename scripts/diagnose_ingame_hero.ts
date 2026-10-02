import { createServer } from 'vite';
import { chromium } from 'playwright';
import * as path from 'path';

async function main() {
  const server = await createServer({
    server: { port: 5195, host: '127.0.0.1' },
    configFile: path.resolve(process.cwd(), 'vite.config.ts'),
  });
  await server.listen();
  const address = server.httpServer?.address();
  const port = typeof address === 'object' && address ? address.port : 5195;

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));

  await page.goto(`http://127.0.0.1:${port}/?hero=void&autoplay=true`);
  await page.waitForTimeout(3500);

  const heroState = await page.evaluate(() => {
    const pm = (window as any).__playerManager;
    if (!pm) return { error: 'No playerManager' };
    const pc = pm.playerCharacter;
    return {
      activeHeroId: pc.activeHeroId,
      hasHeroRig: !!pc.heroRig,
      spineVisible: pc.spineGroup ? pc.spineGroup.visible : null,
      heroRigRootChildren: pc.heroRig ? pc.heroRig.root.children.length : 0,
      boardVisible: !!pc.board,
      currentCosmetics: pm.currentCosmetics,
    };
  });

  console.log('Hero State in Gameplay:', heroState);
  await page.screenshot({ path: 'screenshots/back_view_fixed/gameplay_diag.png' });

  await browser.close();
  await server.close();
}

main().catch(console.error);
