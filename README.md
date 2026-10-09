# ⚡ NEON DRIFT // GO-WITH-FLOW

<div align="center">

**High-Octane 3D Cyberpunk Highway Surfer & Stunt Action Engine**

*Built with React 19, TypeScript, Three.js (r0.186 imperative), Vite 8, and Tailwind v4*

[![Live Demo](https://img.shields.io/badge/Live%20Deploy-Vercel-00F0FF?style=for-the-badge&logo=vercel)](https://flowrider.vercel.app)
[![TypeScript](https://img.shields.io/badge/TypeScript-ES2022-3178C6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Three.js](https://img.shields.io/badge/Three.js-r0.186-black?style=for-the-badge&logo=three.js)](https://threejs.org/)

</div>

---

## 🎮 Live Game

Play directly in browser: **[flowrider.vercel.app](https://flowrider.vercel.app)**

---

## 🕹️ Controls & Navigation

### 💻 Desktop Keyboard
| Key | Action |
| :--- | :--- |
| <kbd>A</kbd> / <kbd>←</kbd> | Switch Lane Left |
| <kbd>D</kbd> / <kbd>→</kbd> | Switch Lane Right |
| <kbd>Space</kbd> / <kbd>W</kbd> / <kbd>↑</kbd> | Jump / Air Launch |
| <kbd>S</kbd> / <kbd>↓</kbd> | Fast Slide / Crouch Under Barriers |
| <kbd>Space</kbd> (Double Tap) | Deploy Holo-Defense Shield |
| <kbd>J</kbd> / <kbd>1</kbd> | **Cyber Corkscrew 360°** (Spin Trick) |
| <kbd>K</kbd> / <kbd>2</kbd> | **Laser Invert Backflip** (Flip Trick) |
| <kbd>L</kbd> / <kbd>3</kbd> | **Neon Rail Grab** (Grab Trick) |
| <kbd>I</kbd> / <kbd>4</kbd> | **Sonic Air Glide** (Pose Trick) |
| <kbd>ESC</kbd> / <kbd>P</kbd> | Pause Game / Neural Link Standby |

### 📱 Mobile Touch & Gestures
- **Swipe Left / Right**: Instant responsive 3-lane dodge
- **Swipe Up**: High-trajectory jump
- **Swipe Down**: Aerodynamic low-profile slide
- **Double Tap**: Holo-Shield activation
- **On-Screen Stunt Rig**: Dedicated buttons for stunt tricks (Spin, Flip, Grab, Glide) with hold-charge indicators

---

## ⚡ Core Gameplay & High-Velocity Systems

1. **3-Lane Track Navigation**:
   - Precision grid physics (`LANE_WIDTH = 2.6m`, `RAIL_X = 4.5m`).
   - Smoothstep lane transition easing with real-time carving roll and camera bank tilt.

2. **Neon Grind Rails & Boost Arches**:
   - **Grind Rails**: Jump onto elevated rails for continuous gold spark friction, $+100\%$ score multiplier bonus, and high-speed overdrive meter charging.
   - **Boost Gates**: Pass through pulsing holographic gateways for instant $+18\,\text{m/s}$ speed surges and FOV warp kicks.

3. **Aerial Stunts & Perfect Landing Mechanics**:
   - Chain multiple aerial maneuvers to build combo tiers (Blue $\to$ Cyan $\to$ Magenta $\to$ White-Hot).
   - Time trick execution before touching ground for **Perfect Landing** score bonuses.
   - Four distinct style tiers: `Chill` $\to$ `Breeze` $\to$ `Flow` $\to$ `Transcendent`.

4. **Multi-Row Obstacle Sequences & Slalom**:
   - Procedural slalom patterns (`L-C-R` / `R-C-L`) with guaranteed reachability and fair reaction gaps.
   - Dynamic jump/duck conflict prevention across consecutive obstacle rows.

5. **Daily Protocol Missions**:
   - Complete daily challenges (Near-Misses, High Score Targets, Distance Goals) to earn Data Shards for upgrades.

---

## 🌌 Biomes & Themes

The highway cycles through dynamic biomes every 450 meters or via warp portals:

- **Neon Undercity**: Wet reflective asphalt, towering skyscraper skylines, holographic advertisements.
- **Dune Nomad**: Golden amber sandstorms, glowing mesas, warm sunset haze.
- **Aurora Frost**: Glacier tundra, crystal ice highways, ethereal aurora borealis.
- **Bioluminescent Jungle**: Glowing fungal canopies, emerald spore clouds, dense foliage.
- **Ember Core**: Magma obsidian crusts, volcanic spires, blazing crimson embers.
- **Nebula Drift**: Deep space zero-g highways, celestial starfields, violet cosmic dust.
- **Sky Realm**: Floating cloud islands, celestial marble pillars, bright golden hour sunlight.
- **The Grid**: Wireframe digital vector cyberspace, laser highway delimiters.

---

## 🏄 5 Distinct Cyber-Surfboards

Equip unique hoverboards in the **Loadout Bay**:

1. **Cyber Phantom** (Default): Sleek dark carbon composite deck, balanced cyan perimeter rails, titanium stabilizer fins, dual plasma ion thrusters.
2. **Laser Edge**: Aggressive razor-sharp stealth speed wedge, crimson/ember edge rails, twin hot orange stringers, knife-edge fins, fiery hyper-afterburners.
3. **Grid Runner**: Faceted matrix composite deck, matrix-green neon rails, double circuit grid lines, triple emerald ion fins, dual turbine accelerators.
4. **Tokyo Neon**: Wide swallow-tail cruiser, asymmetric hot magenta/cyan neon rails, gold-anodized fins, dual high-output pulse thrusters.
5. **Void Stalker**: Ultra-black dark matter deck, twin-fork split nose, glowing purple void rails, obsidian dagger fins, triple antimatter micro-thrusters.

---

## 🦸 5 Playable Heroes

- **Shadow Blade**: Teleport dash, phase shift capability (Default).
- **Flame Emperor**: Immolation trail, burns obstacles on contact (150 Shards).
- **Thunder Rider**: Chain lightning speed burst and high-voltage overcharge (320 Shards).
- **Frost Guardian**: Glacial halt time-dilation wave (500 Shards).
- **Void Walker**: Antimatter phase shift through physical barriers (800 Shards).

---

## 🌍 The Five-World Campaign Progression

GoWithFlow features a seamless 5-world procedural journey, each spanning a 2,250-meter sector with signature atmospheric lighting, dynamic fog blending, and custom procedural sound signatures:

```text
☁️ Sector 1: Sky Isles (0m – 2,249m)
   "The Beginning" — Floating archipelago, ethereal airy synth chimes, high visibility cyan skies.
      ↓
🌿 Sector 2: Verdant Wilds (2,250m – 4,499m)
   "The Living Forest" — Ancient ruins, mossy overgrowth, warm major 7th chord ambience.
      ↓
🏜️ Sector 3: Crimson Dunes (4,500m – 6,749m)
   "The Endless Desert" — Sun-bleached sandstone canyons, golden dunes, mystic fifth acoustic timbre.
      ↓
💎 Sector 4: Crystal Heights (6,750m – 8,999m)
   "The Celestial Realm" — Monolithic crystal spires, harmonic celestial bells, cosmic violet skybox.
      ↓
🌋 Sector 5: Obsidian Core (9,000m+)
   "The Final Challenge" — Basalt columns, magma fissures, volcanic sub-bass drone, high-density obstacles.
```

- **Transition Corridors**: Seamless 300m crossfade zones (`t = 0.0 -> 1.0` via Hermite smoothstep) with zero loading screens, zero pop-in, and preloaded upcoming assets.
- **Directionality**: Continuous forward momentum highway runner.

---

## 🖥️ Graphics Fidelity Presets & Hardware Optimization

Configurable in **Settings & Engine** modal or persisted via `localStorage`:

| Preset | Target FPS | Shadows | Post-Processing | Vegetation Density | Target Hardware |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Ultra (PC)** (`desktop-full`) | 60 FPS | Dynamic Directional | Full (Bloom, Glitch, Aberration) | 100% | Discrete GPUs / High-end Laptops |
| **Balanced** (`mobile-opt`) | 60 FPS | Disabled | Optimized Screen Pass | 65% | Intel Core i5 / Intel Iris Xe / Mobile |
| **Economy** (`webgl-min`) | 30–60 FPS | Disabled | Disabled | 40% | Low-spec laptops / Chromebooks |

- **Adaptive DPR Clamping**: Clamped to $\le 1.5$ on desktop and $\le 1.2$ on mobile to prevent fillrate bottlenecks on integrated Intel Iris Xe graphics.
- **Accessibility (`reducedFlash`)**: Photo-sensitive safe mode that suppresses screen shake, high-frequency glitch artifacts, and sudden flashes.

---

## 🛠️ Tech Stack & Architecture

- **Framework**: [React 19](https://react.dev/) + TypeScript (ES2022 / bundler resolution)
- **3D Graphics**: [Three.js r0.186](https://threejs.org/) (Imperative scene management, custom GLSL vertex & fragment shaders, instanced meshes)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Bundler**: [Vite 8](https://vitejs.dev/)
- **Audio**: Web Audio API Procedural Synthwave Engine (Real-time 16-step bassline sequencer, 808 drums, FM laser SFX, world acoustic signatures)

---

## 🚀 Local Development & Verification

```bash
# 1. Clone repository
git clone https://github.com/vanithamayojula-ux/Go-With-Flow.git
cd Go-With-Flow

# 2. Install dependencies
npm install

# 3. Start development server
npm run dev

# 4. Type check & build production bundle
npm run lint    # runs tsc --noEmit (0 errors)
npm run build   # builds optimized static bundle to /dist
npm run preview # runs local production preview server

# 5. Automated Verification Suites
npx tsx scripts/test_phase8_performance.ts # Performance & budget benchmark
npx tsx scripts/test_phase9_polish.ts      # Game feel & audio audit
npx tsx scripts/test_phase10_release.ts    # Comprehensive release regression suite
npx tsx scripts/test_phase12_stability.ts  # Post-launch stability gate & regression checks
```

---

## 📜 License

MIT License © 2026 Neon Drift / Go-With-Flow
