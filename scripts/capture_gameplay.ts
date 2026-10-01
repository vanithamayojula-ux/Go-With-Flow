import { createServer } from 'vite';
import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const testCases = [
  { hero: 'shadow', biome: 'neon-undercity', name: 'neon_undercity_shadow' },
  { hero: 'flame', biome: 'dune-nomad', name: 'dune_nomad_flame' },
  { hero: 'frost', biome: 'aurora-frost', name: 'aurora_frost_frost' },
  { hero: 'thunder', biome: 'bioluminescent-jungle', name: 'jungle_thunder' },
  { hero: 'void', biome: 'ember-core', name: 'ember_core_void' },
  { hero: 'flame', biome: 'nebula-drift', name: 'nebula_drift_flame' },
  { hero: 'shadow', biome: 'the-grid', name: 'the_grid_shadow' },
];

async function main() {
  const outDir = path.resolve(process.cwd(), 'screenshots/gameplay');
  fs.mkdirSync(outDir, { recursive: true });

  console.log('Starting Vite server for gameplay test...');
  const server = await createServer({
    server: { port: 5175, host: '127.0.0.1' },
    configFile: path.resolve(process.cwd(), 'vite.config.ts'),
  });
  await server.listen();
  const address = server.httpServer?.address();
  const port = typeof address === 'object' && address ? address.port : 5175;
  console.log(`Vite server running at http://127.0.0.1:${port}`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  for (const tc of testCases) {
    const url = `http://127.0.0.1:${port}/?hero=${tc.hero}&biome=${tc.biome}`;
    await page.goto(url);
    // Wait for canvas to load and render several frames
    await page.waitForTimeout(2500);

    // Let player skate for 1.5 seconds down the track
    await page.waitForTimeout(1500);

    const shotPath = path.join(outDir, `${tc.name}.png`);
    await page.screenshot({ path: shotPath });
    console.log(`Captured gameplay screenshot [${tc.name}] -> ${shotPath}`);
  }

  // Also test interactive controls: jump and slide in game
  console.log('Testing in-game slide & jump...');
  const url = `http://127.0.0.1:${port}/?hero=flame&biome=dune-nomad`;
  await page.goto(url);
  await page.waitForTimeout(1500);

  // Press ArrowDown (Slide)
  await page.keyboard.down('ArrowDown');
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(outDir, 'dune_nomad_flame_slide.png') });
  await page.keyboard.up('ArrowDown');
  await page.waitForTimeout(300);

  // Press Space (Jump)
  await page.keyboard.down('Space');
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(outDir, 'dune_nomad_flame_jump.png') });
  await page.keyboard.up('Space');

  await browser.close();
  await server.close();
  console.log('Gameplay capture completed successfully!');
}

main().catch((err) => {
  console.error('Error during gameplay capture:', err);
  process.exit(1);
});
