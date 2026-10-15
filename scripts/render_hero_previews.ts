// Renders select-screen portraits for every hero from its GLB into
// public/hero-previews/<id>.png. Requires the dev server (npm run dev) on :3000.
//   npx tsx scripts/render_hero_previews.ts [yawRadians]
import { chromium } from 'playwright';
import path from 'path';
import { HEROES } from '../src/game/heroes';

const BASE = process.env.PREVIEW_BASE || 'http://localhost:3000';
// model.glb faces the camera natively; the others ride sideways along +X, so turn
// them about -0.8 rad to get a three-quarter front view.
const yawFor = (id: string) => process.argv[2] ?? (id === 'custom' ? '0' : '-0.8');

async function main() {
  // Use the system Edge/Chrome by default so no Playwright browser download is needed.
  const channel = process.env.PREVIEW_CHANNEL || 'msedge';
  const browser = await chromium.launch({ channel, args: ['--use-gl=angle', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 512, height: 512 } });
  page.on('console', (m) => m.type() === 'error' && console.error(`  [page] ${m.text()}`));

  for (const hero of HEROES) {
    const color = hero.color.toString(16).padStart(6, '0');
    const url = `${BASE}/scripts/hero-preview.html?url=${encodeURIComponent(hero.modelUrl)}&color=${color}&yaw=${yawFor(hero.id)}`;
    const out = path.resolve('public/hero-previews', `${hero.id}.png`);
    console.log(`Rendering ${hero.name} (${hero.modelUrl}) -> ${out}`);
    await page.goto(url);
    await page.waitForFunction(() => (window as any).__ready || (window as any).__error, null, { timeout: 180_000 });
    const err = await page.evaluate(() => (window as any).__error);
    if (err) throw new Error(`Failed to render ${hero.id}: ${err}`);
    await page.locator('canvas').screenshot({ path: out });
  }

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
