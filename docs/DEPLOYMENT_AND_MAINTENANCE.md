# GoWithFlow — Deployment, Observability & Post-Launch Maintenance Manual

**Application Version**: `1.0.0`  
**Framework**: React 19 + TypeScript (ES2022) + Vite 8 + Three.js r0.186  
**Hosting Target**: Vercel / Static CDN Edge (HTTPS)  
**Production URL**: [https://flowrider.vercel.app](https://flowrider.vercel.app)

---

## 1. Development & Local Commands

```bash
# 1. Install dependencies cleanly
npm install

# 2. Local development server (port 3000)
npm run dev

# 3. Static type-check
npm run lint    # runs tsc --noEmit (strict ES2022)

# 4. Production build
npm run build   # builds minified client bundle to /dist

# 5. Production preview
npm run preview # launches local preview server on /dist

# 6. Automated Regression & Performance Test Suites
npx tsx scripts/test_phase8_performance.ts # Performance & memory budget verification
npx tsx scripts/test_phase9_polish.ts      # Tactile feel, audio synthesis & progression
npx tsx scripts/test_phase10_release.ts    # Comprehensive release regression suite
```

---

## 2. Core Architecture Summary

```text
┌────────────────────────────────────────────────────────┐
│             React UI Layer (App.tsx, HUD, Modals)      │
└───────────────────────────┬────────────────────────────┘
                            │ (Props, callbacks, synchronization)
┌───────────────────────────▼────────────────────────────┐
│         Integration Layer (GameCanvas.tsx)             │
└───────────────────────────┬────────────────────────────┘
                            │ (Owns DOM container & GameEngine)
┌───────────────────────────▼────────────────────────────┐
│            Game Engine (GameEngine.ts)                 │
│  - RAF Loop (update & render)                          │
│  - Telemetry & Error Boundary Hooks                    │
│  - Screen Shake & Accessibility (reducedFlash)         │
│  - RenderTarget & PostProcessShader                    │
└───────┬────────────┬─────────────┬─────────────┬───────┘
        │            │             │             │
┌───────▼──────┐ ┌───▼────────┐ ┌──▼──────────┐ ┌▼──────────────┐
│ WorldManager │ │PlayerMgr   │ │TerrainMgr   │ │ObstacleMgr    │
│ (5 Worlds)   │ │& Audio     │ │& Foliage    │ │& PowerUps     │
└──────────────┘ └────────────┘ └─────────────┘ └───────────────┘
```

---

## 3. The Five Campaign Worlds

Each world spans an exact 2,250-meter sector along the neon highway, transitioning seamlessly via 300-meter Hermite smoothstep corridors with preloaded assets and zero pop-in:

| Sector | World Name | Distance Range | Visual Identity & Palette | Atmospheric Signature | Sound Profile |
| :---: | :--- | :---: | :--- | :--- | :--- |
| **1** | **Sky Isles** | 0m – 2,249m | Ethereal floating islands, azure clouds, white marble pillars | Cyan & gold sunlight, high visibility | Airy synth chimes (D5, A5, D6) |
| **2** | **Verdant Wilds** | 2,250m – 4,499m | Ancient overgrown ruins, dense mossy canopy, floating orbs | Emerald mist, glowing spores, warm sunbeams | Organic major 7th chord (E4, A4, C#5, E5) |
| **3** | **Crimson Dunes** | 4,500m – 6,749m | Sandstone canyons, towering dunes, ancient weathered monoliths | Amber sun haze, heat shimmer | Mystic desert fifths (D4, A4, D5) |
| **4** | **Crystal Heights** | 6,750m – 8,999m | Celestial gemstone spires, floating prism shards | Deep violet cosmic starfield, magenta glow | Harmonic bell overtones (A5, E6, A6, C7) |
| **5** | **Obsidian Core** | 9,000m+ | Basalt hexagonal pillars, magma fissures, volcanic spires | Crimson dark smoke, ember ash particles | Subterranean sub-bass rumble (A1, E2, A2) |

---

## 4. Production Deployment Process (Vercel)

1. **Repository Link**: Connect `vanithamayojula-ux/Go-With-Flow` to Vercel.
2. **Framework Preset**: `Vite`.
3. **Build Command**: `npm run build` (or `vite build`).
4. **Output Directory**: `dist`.
5. **Environment Configuration**: No server secrets are required for client execution. Public placeholders in `.env.example` are documented.
6. **Immutable Routing**: [`vercel.json`](file:///c:/Users/HP/Downloads/gowithflow/vercel.json) handles rewrites for SPA routing and static assets:
   ```json
   {
     "framework": "vite",
     "buildCommand": "vite build",
     "outputDirectory": "dist",
     "rewrites": [
       { "source": "/hero-lab", "destination": "/hero-lab.html" },
       { "source": "/((?!assets|models|hero-lab.html|hero-previews|favicon.ico).*)", "destination": "/index.html" }
     ]
   }
   ```

---

## 5. Rollback & Emergency Recovery Procedure

If a production regression occurs:

1. **Instant Rollback via Vercel**:
   - Navigate to **Vercel Dashboard → Deployments**.
   - Locate the previous successful deployment corresponding to the known-good commit.
   - Click **Instant Rollback** to immediately promote that immutable deployment to production.
2. **Local Rollback**:
   ```bash
   # Revert to known-good release commit
   git checkout <RELEASE_TAG_OR_COMMIT>
   npm run lint && npm run build
   git push origin main
   ```
3. **Emergency Client-Side State Recovery**:
   - In case a player encounters a corrupted local save, the game automatically falls back to default values.
   - The user or developer can invoke `localStorage.clear()` or use the **Reset Saved State & Reload** button in the [`GameErrorBoundary`](file:///c:/Users/HP/Downloads/gowithflow/src/utils/errorMonitoring.tsx).

---

## 6. Observability & Runtime Telemetry APIs

The production runtime exposes two zero-overhead developer diagnostics objects on `window`:

### 1. Performance Telemetry
```js
window.__getGamePerformanceMetrics()
```
Returns:
```json
{
  "averageFps": 60,
  "minFps": 58,
  "maxFps": 60,
  "averageFrameTimeMs": 16.64,
  "longFrameCount": 0,
  "transitionCount": 2,
  "lastTransitionDurationMs": 2840,
  "version": "1.0.0"
}
```

### 2. Error Monitoring Buffer
```js
window.__getGameErrorLogs()
```
Returns an in-memory ring buffer (up to 20 entries) of captured non-fatal errors with timestamp, subsystem, world ID, and sanitized stack trace.

---

## 7. Troubleshooting Guide

| Issue | Root Cause | Solution |
| :--- | :--- | :--- |
| **Blank Screen on Startup** | Browser lacks WebGL2 support or context was lost | Check browser WebGL settings (`chrome://gpu`). Game renders [`GameErrorBoundary`](file:///c:/Users/HP/Downloads/gowithflow/src/utils/errorMonitoring.tsx) with a reload prompt. |
| **Audio Does Not Play** | Browser autoplay policy blocks Web Audio API before first user gesture | AudioContext initializes on first `pointerdown`, `keydown`, or `touchstart`. User click unmutes. |
| **Low FPS on Laptop** | High DPI rendering on integrated graphics (e.g. Intel Iris Xe) | Open **Settings & Engine** → select **Balanced (`mobile-opt`)** or **Low (`webgl-min`)**. Preset automatically adjusts DPR ($\le 1.2$), disables shadows, and scales vegetation density. |
| **Corrupted Save / High Score** | Invalid data in `localStorage` | All `localStorage.getItem` calls have guarded `try/catch` fallbacks to default values. |
| **Missing Textures in Node/SSR** | Node.js lacks browser canvas API | Guarded by `typeof document === 'undefined'` checks across procedural texture generators. |
