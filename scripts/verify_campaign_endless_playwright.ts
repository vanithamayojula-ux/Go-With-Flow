import { createServer } from 'vite';
import { chromium } from 'playwright';
import * as path from 'path';

async function main() {
  console.log('================================================================');
  console.log('🎮 GoWithFlow — Playwright Browser Test: Campaign & Endless Modes');
  console.log('================================================================\n');

  console.log('Starting Vite server for live browser test...');
  const server = await createServer({
    server: { port: 5192, host: '127.0.0.1' },
    configFile: path.resolve(process.cwd(), 'vite.config.ts'),
  });
  await server.listen();
  const address = server.httpServer?.address();
  const port = typeof address === 'object' && address ? address.port : 5192;
  const url = `http://127.0.0.1:${port}`;
  console.log(`Vite server running at ${url}\n`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  const errors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });
  page.on('pageerror', err => {
    errors.push(err.message);
  });

  let testsPassed = 0;
  let testsFailed = 0;

  function assert(condition: boolean, msg: string) {
    if (condition) {
      console.log(`  ✓ ${msg}`);
      testsPassed++;
    } else {
      console.error(`  ❌ FAILED: ${msg}`);
      testsFailed++;
    }
  }

  try {
    await page.goto(url);
    await page.waitForSelector('#opening-screen-root', { timeout: 10000 });
    assert(true, 'Opening screen rendered');

    // 1. Verify Mode Cards on Opening Screen
    const campaignBtn = page.locator('button:has-text("CAMPAIGN")').first();
    const endlessBtn = page.locator('button:has-text("ENDLESS")').first();
    assert(await campaignBtn.count() > 0, 'Campaign Mode button exists on opening screen');
    assert(await endlessBtn.count() > 0, 'Endless Mode button exists on opening screen');

    // 2. Click Campaign Mode
    await campaignBtn.click();
    await page.waitForTimeout(300);
    const sectorDropdown = page.locator('#campaign-starting-world');
    assert(await sectorDropdown.count() > 0, 'Campaign sector selector is visible');

    // 3. Launch Campaign Run
    const launchBtn = page.locator('button:has-text("LAUNCH RUN")');
    await launchBtn.click();
    await page.waitForTimeout(1000);

    // 4. Verify HUD for Campaign Mode
    const container = page.locator('#skyflow-app-container');
    const hudTextCampaign = await container.innerText();
    assert(hudTextCampaign.includes('SECTOR') || hudTextCampaign.includes('CAMPAIGN') || hudTextCampaign.includes('GATE'), 'Campaign HUD telemetry is displayed in-game');

    // 5. Trigger Game Over / Pause Menu Return
    await page.evaluate(() => {
      // Simulate run termination to return to menu
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape' }));
    });
    await page.waitForTimeout(500);

    // Click Return to Menu or click opening screen
    const returnBtn = page.locator('button:has-text("MAIN MENU"), button:has-text("QUIT RUN"), button:has-text("MENU")').first();
    if (await returnBtn.count() > 0) {
      await returnBtn.click();
      await page.waitForTimeout(500);
    } else {
      await page.goto(url);
      await page.waitForSelector('#opening-screen-root', { timeout: 10000 });
    }

    // 6. Select Endless Mode
    const endlessCard = page.locator('button:has-text("ENDLESS")').first();
    await endlessCard.click();
    await page.waitForTimeout(300);

    // Launch Endless Run
    const launchEndless = page.locator('button:has-text("LAUNCH RUN")');
    await launchEndless.click();
    await page.waitForTimeout(1000);

    // 7. Verify HUD for Endless Mode
    const hudTextEndless = await container.innerText();
    assert(hudTextEndless.includes('LOOP') || hudTextEndless.includes('RECORD') || hudTextEndless.includes('ENDLESS'), 'Endless HUD telemetry (Loop/Record) is displayed in-game');

    // 8. Verify LocalStorage Records
    const localStorageData = await page.evaluate(() => {
      return {
        campaignSave: localStorage.getItem('skyflow_campaign_save_v1'),
        endlessRecords: localStorage.getItem('skyflow_endless_records_v1'),
      };
    });
    assert(localStorageData.campaignSave !== null, 'Campaign state persisted to skyflow_campaign_save_v1');
    assert(localStorageData.endlessRecords !== null, 'Endless records persisted to skyflow_endless_records_v1');

    // 9. Check Console Errors
    const criticalErrors = errors.filter(e => !e.includes('favicon') && !e.includes('AudioContext'));
    assert(criticalErrors.length === 0, `No unhandled runtime console errors (found: ${criticalErrors.length})`);

  } catch (err: any) {
    console.error('Browser test error:', err);
    testsFailed++;
  } finally {
    await browser.close();
    await server.close();
  }

  console.log('\n================================================================');
  console.log(`BROWSER VERIFICATION SUMMARY:`);
  console.log(`PASSED: ${testsPassed}`);
  console.log(`FAILED: ${testsFailed}`);
  console.log('================================================================');

  if (testsFailed > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
