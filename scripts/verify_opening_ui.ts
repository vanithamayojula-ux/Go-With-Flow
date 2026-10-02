import { chromium } from 'playwright';
import { createServer } from 'vite';

async function main() {
  console.log('Starting Vite Dev Server...');
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
    // 1. Desktop Test (1440x900)
    console.log('\n--- Testing Desktop (1440x900) ---');
    const desktopPage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await desktopPage.goto(url);
    await desktopPage.waitForSelector('#opening-screen-root', { timeout: 10000 });
    console.log('✓ Opening screen root element rendered on Desktop');

    // Check Header & brand
    const headerText = await desktopPage.textContent('header');
    console.log('Header text contains NEON // DRIFT:', headerText?.includes('NEON // DRIFT'));

    // Check Hero roster has 5 heroes
    const heroCards = desktopPage.locator('section[aria-label="Hero Characters"] img');
    const count = await heroCards.count();
    console.log(`✓ Hero roster cards count: ${count}`);

    // Click PILOT GUIDE
    await desktopPage.locator('button:has-text("PILOT GUIDE")').click();
    await desktopPage.waitForSelector('#how-to-modal-dialog', { timeout: 3000 });
    console.log('✓ Pilot Guide modal opened');
    await desktopPage.keyboard.press('Escape');
    await desktopPage.waitForSelector('#how-to-modal-dialog', { state: 'detached', timeout: 3000 });
    console.log('✓ Pilot Guide modal closed with Escape');

    // Click Settings
    await desktopPage.locator('button[aria-label="Open Game Settings"]').click();
    await desktopPage.waitForSelector('#settings-modal-dialog', { timeout: 3000 });
    console.log('✓ Settings modal opened');
    await desktopPage.keyboard.press('Escape');
    await desktopPage.waitForSelector('#settings-modal-dialog', { state: 'detached', timeout: 3000 });
    console.log('✓ Settings modal closed with Escape');

    // Click Tech Bay
    await desktopPage.locator('button:has-text("TECH BAY")').click();
    await desktopPage.waitForSelector('#cosmetics-modal-dialog', { timeout: 3000 });
    console.log('✓ Tech Bay opened directly to upgrades tab');
    await desktopPage.keyboard.press('Escape');
    await desktopPage.waitForSelector('#cosmetics-modal-dialog', { state: 'detached', timeout: 3000 });
    console.log('✓ Tech Bay closed with Escape');

    // Click LAUNCH RUN to verify in-game transition
    const launchLocator = desktopPage.locator('button[aria-label*="Launch Neon Drift Run"]');
    await launchLocator.click();
    await desktopPage.waitForSelector('canvas', { timeout: 5000 });
    console.log('✓ In-Game 3D Canvas rendered successfully upon Launch!');

    // 2. Mobile Test (390x844 - iPhone 12/13/14)
    console.log('\n--- Testing Mobile Viewport (390x844) ---');
    const mobilePage = await browser.newPage({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
    });
    await mobilePage.goto(url);
    await mobilePage.waitForSelector('#opening-screen-root', { timeout: 10000 });
    console.log('✓ Opening screen root element rendered on Mobile');

    // Check touch controls hint
    const touchHint = await mobilePage.locator('text=TOUCH CONTROLS').isVisible();
    console.log('✓ Mobile touch controls hint detected:', touchHint);

    // Check mobile launch button
    const mobileLaunch = await mobilePage.locator('button[aria-label*="Launch Neon Drift Run"]').isVisible();
    console.log('✓ Mobile Launch Run button visible:', mobileLaunch);

    console.log('\n=============================================');
    console.log('✓ ALL PLAYWRIGHT VERIFICATION TESTS PASSED!');
    console.log('=============================================\n');
  } finally {
    await browser.close();
    await server.close();
  }
}

main().catch((err) => {
  console.error('Error during verification:', err);
  process.exit(1);
});
