import { chromium } from 'playwright';

async function test() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setContent('<h1>Hello Playwright</h1>');
  await page.screenshot({ path: 'test_screenshot.png' });
  await browser.close();
  console.log('Playwright screenshot success!');
}

test().catch(console.error);
