import { chromium } from 'playwright';
import { createServer } from 'vite';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const screenshotDir = path.resolve(process.cwd(), 'screenshots');
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  console.log('Starting Vite Server...');
  const server = await createServer({
    server: { port: 5199 },
    configFile: false,
    plugins: [
      (await import('@vitejs/plugin-react')).default(),
      (await import('@tailwindcss/vite')).default(),
    ],
  });
  await server.listen();
  const url = 'http://localhost:5199';
  console.log(`Vite server running at ${url}`);

  const browser = await chromium.launch({ headless: true });
  
  try {
    // -------------------------------------------------------------
    // 1. Desktop Test & Screenshots (1440x900)
    // -------------------------------------------------------------
    console.log('\n--- Capturing Desktop Screenshots (1440x900) ---');
    const desktopPage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await desktopPage.goto(url);
    await desktopPage.waitForSelector('#opening-screen-root', { timeout: 10000 });
    
    // Screenshot 1: Desktop Main Menu
    await desktopPage.screenshot({ path: path.join(screenshotDir, 'desktop_menu.png'), fullPage: false });
    console.log('✓ Captured desktop_menu.png');

    // Screenshot 2: Pilot Guide / How To Play Modal
    await desktopPage.locator('button:has-text("PILOT GUIDE")').click();
    await desktopPage.waitForSelector('#how-to-modal-dialog', { timeout: 3000 });
    await desktopPage.screenshot({ path: path.join(screenshotDir, 'desktop_howto.png') });
    console.log('✓ Captured desktop_howto.png');
    await desktopPage.keyboard.press('Escape');
    await desktopPage.waitForSelector('#how-to-modal-dialog', { state: 'detached', timeout: 3000 });

    // Screenshot 3: Settings Modal
    await desktopPage.locator('button[aria-label="Open Game Settings"]').click();
    await desktopPage.waitForSelector('#settings-modal-dialog', { timeout: 3000 });
    await desktopPage.screenshot({ path: path.join(screenshotDir, 'desktop_settings.png') });
    console.log('✓ Captured desktop_settings.png');
    await desktopPage.keyboard.press('Escape');
    await desktopPage.waitForSelector('#settings-modal-dialog', { state: 'detached', timeout: 3000 });

    // Screenshot 4: Tech Bay / Cosmetics Modal
    await desktopPage.locator('button:has-text("TECH BAY")').click();
    await desktopPage.waitForSelector('#cosmetics-modal-dialog', { timeout: 3000 });
    await desktopPage.screenshot({ path: path.join(screenshotDir, 'desktop_tech_bay.png') });
    console.log('✓ Captured desktop_tech_bay.png');
    await desktopPage.keyboard.press('Escape');
    await desktopPage.waitForSelector('#cosmetics-modal-dialog', { state: 'detached', timeout: 3000 });

    // -------------------------------------------------------------
    // 2. Mobile Test & Screenshots (390x844)
    // -------------------------------------------------------------
    console.log('\n--- Capturing Mobile Screenshots (390x844) ---');
    const mobilePage = await browser.newPage({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
    });
    await mobilePage.goto(url);
    await mobilePage.waitForSelector('#opening-screen-root', { timeout: 10000 });

    // Screenshot 5: Mobile Main Menu (above the fold)
    await mobilePage.screenshot({ path: path.join(screenshotDir, 'mobile_main_portrait.png') });
    console.log('✓ Captured mobile_main_portrait.png');

    // Screenshot 6: Mobile Full Page
    await mobilePage.screenshot({ path: path.join(screenshotDir, 'mobile_full_page.png'), fullPage: true });
    console.log('✓ Captured mobile_full_page.png');

    console.log('\n=============================================');
    console.log('✓ ALL QA SCREENSHOTS GENERATED IN /screenshots');
    console.log('=============================================\n');
  } finally {
    await browser.close();
    await server.close();
  }
}

main().catch((err) => {
  console.error('Error capturing screenshots:', err);
  process.exit(1);
});
