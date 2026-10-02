import { createServer } from 'vite';
import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const outDir = path.resolve(process.cwd(), 'screenshots/steering_fix');
fs.mkdirSync(outDir, { recursive: true });

async function verifySteeringFix() {
  console.log('=== Verifying Steering Direction Fix ===\n');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // Center baseline
  await page.screenshot({ path: path.join(outDir, '00_center_lane.png') });
  console.log('✓ 00_center_lane.png captured');

  // Press Left Arrow (ArrowLeft) -> Must move to Screen-Left
  console.log('Pressing ArrowLeft...');
  await page.keyboard.press('ArrowLeft');
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(outDir, '01_arrow_left_pressed.png') });
  console.log('✓ 01_arrow_left_pressed.png captured (Should be SCREEN-LEFT)');

  // Press Right Arrow twice (ArrowRight) -> Center -> Screen-Right
  console.log('Pressing ArrowRight twice...');
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(250);
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(outDir, '02_arrow_right_pressed.png') });
  console.log('✓ 02_arrow_right_pressed.png captured (Should be SCREEN-RIGHT)');

  // Press D key -> already at right, press A key twice -> Center -> Screen-Left
  console.log('Pressing KeyA twice...');
  await page.keyboard.press('KeyA');
  await page.waitForTimeout(250);
  await page.keyboard.press('KeyA');
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(outDir, '03_key_a_pressed.png') });
  console.log('✓ 03_key_a_pressed.png captured (Should be SCREEN-LEFT)');

  await browser.close();
  console.log('\n=== Steering Fix Verification Complete! ===');
}

verifySteeringFix().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
