# NEON DRIFT // GO-WITH-FLOW

A 3D cyberpunk hoverboard runner for the browser. Ride a three-lane neon highway through five campaign worlds, dodge barriers, grind rails, hit boost arches and chain aerial tricks.

Built with React 19, TypeScript, Three.js r0.186, Vite 8 and Tailwind v4. Everything runs client-side; progress is saved in the browser.

**Play:** [flowrider.vercel.app](https://flowrider.vercel.app)

---

## Controls

### Keyboard

| Key | Action |
| :--- | :--- |
| <kbd>A</kbd> / <kbd>←</kbd> | Lane left |
| <kbd>D</kbd> / <kbd>→</kbd> | Lane right |
| <kbd>Space</kbd> / <kbd>W</kbd> / <kbd>↑</kbd> | Jump |
| <kbd>S</kbd> / <kbd>↓</kbd> | Slide under barriers |
| <kbd>Space</kbd> twice quickly | Deploy shield |
| <kbd>J</kbd> / <kbd>1</kbd> | 360° Spin |
| <kbd>K</kbd> / <kbd>2</kbd> | Flip |
| <kbd>L</kbd> / <kbd>3</kbd> | Rail Grab |
| <kbd>I</kbd> / <kbd>4</kbd> | Air Glide |
| <kbd>Esc</kbd> / <kbd>P</kbd> | Pause |

### Touch

- Swipe left/right to change lanes, up to jump, down to slide
- Double tap for the shield
- On-screen buttons for the four tricks

---

## Gameplay

- **Three lanes, rising speed.** You start at about 6 m/s; speed ramps with distance, overdrive, grinding and boost arches (engine cap 65 m/s).
- **Grind rails** double the riding score while you're on them.
- **Boost arches** add +18 m/s and a FOV kick.
- **Tricks.** One trick at a time (0.3 s lockout). Each trick in the same airborne chain raises the combo (max ×8) and scores 350 × combo. Landing ends the chain.
- **Style tiers:** Chill → Breeze → Flow → Transcendent, driven by overdrive and combo.
- **Near misses** add shards, overdrive and a brief slow-motion.
- **Daily missions** (near misses, score target, distance target) pay out shards.
- **Modes:** Standard Run, Score Attack, Time Trial, Survival and Curated Challenges.

### Worlds and zones

The campaign has **five worlds**, each 2,250 m long, with their own lighting, fog, decorations and audio:

| Sector | World | Distance |
| :--- | :--- | :--- |
| 1 | Sky Isles | 0 – 2,249 m |
| 2 | Verdant Wilds | 2,250 – 4,499 m |
| 3 | Crimson Dunes | 4,500 – 6,749 m |
| 4 | Crystal Heights | 6,750 – 8,999 m |
| 5 | Obsidian Core | 9,000 m + |

A portal gateway spans the road at each world boundary: an ~18 m stone arch built from the next world's materials (mossy ruin, carved sandstone, granite and ice, basalt with lava veins) with a thin rim of light and a faint beam of light rising from it, visible from far away. Through its opening you see the next world under its own sky and light, and the world (sky, sun, fog, scenery) switches exactly as you pass through, in any lane, on the ground or in the air. The HUD counts down the last 600 m to each portal. Obsidian Core is the final world, with no portal after it. The track surface, skyline and friction follow the current world's zone (Sky Realm, Bioluminescent Jungle, Dune Nomad, Aurora Frost, Ember Core).

---

## Unlockables

Shards are earned during runs and from missions, challenges and achievements.

### Heroes

| Hero | Cost |
| :--- | :--- |
| Cyber Surfer | Free (default) |
| Shadow Blade | Free |
| Flame Emperor | 150 shards |
| Thunder Rider | 320 shards |
| Frost Guardian | 500 shards |
| Void Walker | 800 shards |

Heroes are cosmetic: each has its own 3D model. The ability tags shown in the roster (e.g. DASH) are placeholders and don't change gameplay yet.

### Hoverboards

Cyber Phantom (free), Laser Edge (75), Grid Runner (150), Tokyo Neon (250), Void Stalker (400).

### Tech Bay upgrades

Magnet, jetpack, overdrive core and shield capacitor, each with several levels.

---

## Leaderboards and live ops are local

The leaderboard, practice challenges, seasons, live events, profile and "security" checks all run in the browser and save to `localStorage`. There is no backend.

- Your runs are ranked against five built-in **SAMPLE** rivals, not real players.
- Run validation (speed, score and world-progression sanity checks) catches bugs and corrupted saves. It does not stop a determined cheater, because anyone can edit `localStorage`.
- Making leaderboards global would need a server that stores runs and repeats the validation in `src/game/security/scoreValidationPipeline.ts`.

---

## Graphics presets

Change these in **Settings**. Your choice is saved in the browser.

| Preset | Shadows | Post-processing | Vegetation | Pixel ratio cap |
| :--- | :--- | :--- | :--- | :--- |
| **Ultra** (`desktop-full`) | On | Bloom, aberration, speed lines | 100% | 1.5 |
| **Balanced** (`mobile-opt`) | Off | On | 65% | 1.2 |
| **Economy** (`webgl-min`) | Off | Off | 40% | 1.0 |

The first launch uses Ultra on desktop and Balanced on touch devices. **Reduced flash** in Settings turns off screen shake and glitch effects.

---

## Development

```bash
npm install
npm run dev       # http://localhost:3000
npm run lint      # tsc --noEmit
npm test          # gameplay regression tests + phase suites (Node, no browser)
npm run build     # production bundle in dist/
npm run preview   # serve dist/
```

No environment variables are needed.

`hero-lab.html` (linked from the **LAB** button on the main menu) shows the selected hero's 3D model and poses. The other scripts in `scripts/` are one-off Playwright diagnostics and expect a dev server on specific ports.

### Project layout

```text
src/
  App.tsx                 React shell: menus, HUD state, saves
  components/             UI: HUD, modals, GameCanvas (mounts the engine)
  game/
    GameEngine.ts         render loop, input, wiring between systems
    player.ts             movement, tricks, scoring
    obstacles.ts          barriers, rails, boost arches, pickups
    portal/               world-boundary gateways and the view-through-the-portal pass
    terrain.ts            track streaming and the 14-zone rotation
    WorldManager.ts       5-world campaign progression and blending
    worlds/               per-world decorations and atmosphere
    heroes.ts             hero roster, prices, model paths
    modes/ progression/ cosmetics/
    social/ liveops/ security/   local-only systems (see above)
public/
  model.glb               Cyber Surfer
  models/                 Shadow, Flame, Thunder, Frost, Void
```

See `docs/ARCHITECTURE.md` for more detail and `CHANGELOG.md` for recent fixes.

---

## License

MIT © 2026 Neon Drift / Go-With-Flow
