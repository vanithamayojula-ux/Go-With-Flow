# GoWithFlow Architecture & Engineering Guide

## Overview

GoWithFlow is an arcade 3D endless cyber hoverboard runner built with **React**, **Three.js**, **GLSL Shaders**, and **Tailwind CSS**.

---

## 1. Core Architectural Layers

The architecture enforces strict unidirectional dependency flow:

```text
React UI (App, GameHUD, Modals)
      │
      ▼
Integration Layer (GameCanvas.tsx)
      │
      ▼
Game Engine (GameEngine.ts)
      │
      ▼
World Manager (WorldManager.ts) & Subsystem Managers
      │
      ▼
Three.js Scene Graph & WebGLRenderer
```

### Layer Descriptions

1. **React UI (`src/App.tsx`, `src/components/`):**
   - Renders DOM HUD telemetry, setting drawers, daily mission dialogs, loadout cosmetics modals, and pause/game-over screens.
   - Never contains Three.js nodes or direct render loop logic.
   - Communicates with the engine through props and event callbacks.

2. **Integration Layer (`src/components/GameCanvas.tsx`):**
   - Owns the DOM container `<div id="game-canvas-container" />`.
   - Initializes a single stable instance of `GameEngine` upon mount.
   - Dynamically synchronizes changing React configuration (`graphicsConfig`, `lightingMode`, `shaderParams`, `isCinematicCam`, `isPaused`) via `engine.update...()` without tearing down the WebGL canvas.
   - Exposes clean disposal on component unmount.

3. **Game Engine (`src/game/GameEngine.ts`):**
   - Owns the Three.js runtime: `WebGLRenderer`, `PerspectiveCamera`, `Scene`, `WebGLRenderTarget`, and `ResizeObserver`.
   - Drives the RAF animation loop (`update()` and `render()`).
   - Owns keyboard and pointer swipe gesture handling.
   - Coordinates subsystem updates: `PlayerManager`, `TerrainManager`, `ObstacleManager`, `FoliageManager`, `SkyManager`, `ThemeManager`, `WorldManager`, and `AudioManager`.

4. **World Manager (`src/game/WorldManager.ts`):**
   - Coordinates high-level campaign progression, tracking `currentWorldId`, `nextWorldId`, and world transitions.
   - Resolves worlds dynamically by run distance or active biome.
   - Evaluates effective decoration and vegetation density scaled by graphics presets.

5. **Subsystem Managers (`src/game/`):**
   - `PlayerManager`: 3-lane navigation, jump/slide mechanics, tricks, hoverboard physics, and cosmetics.
   - `TerrainManager`: 3-lane cyber highway chunk streaming, procedural curves, and biome theme materials.
   - `ObstacleManager`: deterministic pattern generator, grind rails, boost arches, overhead laser barriers, and power-ups.
   - `FoliageManager`: GPU instanced reeds and trees with wind vertex displacement.
   - `SkyManager`: multi-layer panoramic sky dome, galaxy parallax, and lighting presets.
   - `AudioManager`: Web Audio synthesized soundscapes, sfx triggers, and mute management.

---

## 2. World System Architecture

The campaign is organized into five authoritative worlds:

```text
1. Sky Isles       (#7DD3FC sky, islands structures, clouds atmosphere)
2. Verdant Wilds   (#86EFAC sky, ruins structures, fireflies atmosphere)
3. Crimson Dunes   (#FB923C sky, mesas structures, dust atmosphere)
4. Crystal Heights (#312E81 sky, crystal-spires structures, crystals atmosphere)
5. Obsidian Core   (#450A0A sky, volcanic-rock structures, embers atmosphere)
```

```text
Campaign Distance (z)
          │
          ▼
    World Config (src/game/WorldConfig.ts & src/game/worlds/)
          │
    ┌─────┴─────────────────────────┐
    ▼                               ▼
Legacy Biome Rotation        World Atmosphere & Styling
(src/game/terrain.ts)        (Lighting, Palettes, Density)
```

- Each world is allocated `2250` distance units in linear progression.
- Distances beyond 9000m stay clamped to `obsidian-core`.
- Legacy biomes (`neon-undercity`, `dune-nomad`, `aurora-frost`, `bioluminescent-jungle`, etc.) map directly to their corresponding world via `BIOME_TO_WORLD_MAP`.

---

## 3. How to Add a New World

When implementing new worlds or extending the campaign:

1. **Add the World ID:**
   In `src/game/WorldConfig.ts`, append the new identifier to `WorldId`:
   ```ts
   export type WorldId = ... | 'new-world-id';
   ```

2. **Append to Authoritative Campaign Order:**
   Update `WORLD_ORDER` in `src/game/WorldConfig.ts`.

3. **Define World Configuration:**
   Create `src/game/worlds/newWorld.ts`:
   ```ts
   import { WorldConfig } from '../WorldConfig';

   export const newWorldConfig: WorldConfig = {
     id: 'new-world-id',
     index: 5,
     name: 'New World',
     subtitle: 'Description',
     palette: { ... },
     lighting: { ... },
     atmosphere: { ... },
     decorations: { ... },
     compatibleBiomes: ['...'],
   };
   ```

4. **Register in Worlds Registry:**
   Export from `src/game/worlds.ts` and add to the `WORLDS` map:
   ```ts
   export { newWorldConfig } from './worlds/newWorld';
   // In WORLDS:
   'new-world-id': newWorldConfig,
   ```

5. **Map Compatible Biomes:**
   Add any new biomes or legacy biomes to `BIOME_TO_WORLD_MAP` in `src/game/worlds.ts`.

6. **Add Environment Visuals:**
   Use the world's `palette`, `lighting`, and `decorations` in `TerrainManager`, `SkyManager`, and `FoliageManager`.

---

## 4. Resource Lifecycle & Memory Rules

To maintain 60 FPS performance on Intel Iris Xe / integrated GPUs:
- **Zero Allocations in the Render Loop:** Avoid `new THREE.Vector3()` or geometry allocations inside `update()` or `render()`. Use scratch vectors.
- **Explicit Cleanup:** Every manager must provide a `dispose()` method freeing geometries, materials, render targets, and textures.
- **Audio Disposal:** `AudioManager.dispose()` stops oscillators, detaches window unlock listeners, and closes `AudioContext`.
- **Pure React Updaters:** Never execute side effects (like `localStorage.setItem`) inside React `setState` callbacks.
