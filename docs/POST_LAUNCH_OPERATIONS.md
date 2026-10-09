# GoWithFlow — Post-Launch Monitoring, Stabilization & Operations Manual

**Game Version**: `1.0.0`  
**Operational Mindset**: **Observe → Diagnose → Fix → Test → Deploy → Monitor**

---

## 1. Post-Launch Production Baseline

| Metric | Target Baseline | Measured Status | Status |
| :--- | :--- | :--- | :---: |
| **Production Version** | `1.0.0` | `1.0.0` | **PASS** |
| **Deployment Target** | Vercel (Edge CDN) | [flowrider.vercel.app](https://flowrider.vercel.app) | **PASS** |
| **Average Frame Rate** | 60 FPS (Desktop / Balanced) | 59.8 – 60.0 FPS | **PASS** |
| **Worst-Performing World** | Crystal Heights / Obsidian Core | 92 meshes, 710 particles (< 800 budget) | **PASS** |
| **Transition Corridor Time** | 300m duration (~5.8s at 52m/s) | Smooth Hermite smoothstep, 0ms freeze | **PASS** |
| **Startup Success Rate** | 100% on WebGL2 browsers | Fallback handled via `GameErrorBoundary` | **PASS** |
| **Uncaught Runtime Errors** | 0 critical errors | Ring buffer limit 20, 0 unhandled crashes | **PASS** |
| **Asset Loading Failures** | 0 missing textures/geometries | All assets bundled or procedurally synthesized | **PASS** |

---

## 2. Real-World Error Monitoring & Triage Schema

Runtime exceptions are captured in-memory and logged with subsystem attribution:

```javascript
// Access in browser console or telemetry agent:
window.__getGameErrorLogs();
```

### Error Classification Matrix

| Subsystem | Typical Failure Modes | Prevention & Mitigation |
| :--- | :--- | :--- |
| **Startup / Mount** | WebGL context loss, SSR undefined `document` | `GameErrorBoundary` fallback, `typeof document === 'undefined'` guards. |
| **Rendering / WebGL** | Shader compilation error, device DPR overflow | Preset-based DPR clamping ($\le 1.5$ desktop, $\le 1.2$ mobile). |
| **World Transitions** | Asset preloading desync, state oscillation | Monotonic transition state machine (`STABLE` $\to$ `PREPARING` $\to$ `TRANSITIONING`). |
| **Player Physics** | Delta-time spike on tab switch | Tab `visibilitychange` listener resets clock; $dt \le 50\text{ ms}$ clamping. |
| **Audio Engine** | Autoplay policy lock, AudioContext suspension | Resumed on first user gesture (`pointerdown`, `keydown`, `touchstart`). |
| **Economy / Save** | Corrupted `localStorage` data | Wrapped in `try/catch` with fallback to default state; delta-banking protects revives. |

---

## 3. Player-Reported Issue Workflow

```text
1. REPORT       User submits report with device, browser, and world sector.
      ↓
2. REPRODUCE    Run locally using `npm run dev` or reproduce via `npx tsx scripts/...`.
      ↓
3. CLASSIFY     Assign severity (P0 Critical, P1 High, P2 Medium, P3 Low).
      ↓
4. ISOLATE      Identify root cause without introducing global mutable dependencies.
      ↓
5. FIX          Implement the minimal surgical patch.
      ↓
6. REGRESSION   Add test case to `scripts/test_phase12_stability.ts`.
      ↓
7. DEPLOY       Run `npm run lint && npm run build` -> deploy to staging/preview -> production.
      ↓
8. MONITOR      Verify production dashboard (`window.__getGameHealthDashboard()`).
```

---

## 4. Stability Severity Guidelines

- **P0 — Critical (Immediate Hotfix)**:
  Game cannot launch, white screen, corrupted save preventing startup, infinite loop, currency duplication exploit.
- **P1 — High (Next Maintenance Release)**:
  World transition stalls, player falling through floor, revive deduction failure, major FPS collapse below 25 FPS.
- **P2 — Medium**:
  Visual alignment glitches, audio node volume balance, UI clipping on non-standard aspect ratios.
- **P3 — Low (Backlog)**:
  Minor particle density spacing, subtle color tweak, non-blocking cosmetic polish.

---

## 5. Performance Regression Gate

Before merging or promoting any production release candidate:

1. `npm run lint` must exit with 0 errors.
2. `npm run build` must build cleanly.
3. `npx tsx scripts/test_phase8_performance.ts` must pass 100% of draw call and particle budgets.
4. `npx tsx scripts/test_phase9_polish.ts` must verify feel, audio signatures, and progression.
5. `npx tsx scripts/test_phase10_release.ts` must pass all 43 release assertions.
6. `npx tsx scripts/test_phase12_stability.ts` must verify stability gates and regression guards.

---

## 6. Observability Dashboard API

```javascript
window.__getGameHealthDashboard();
```

Output format:
```json
{
  "version": "1.0.0",
  "status": "OPTIMAL",
  "telemetry": {
    "averageFps": 60,
    "minFps": 58,
    "maxFps": 60,
    "averageFrameTimeMs": 16.67,
    "longFrameCount": 0,
    "transitionCount": 4,
    "lastTransitionDurationMs": 2850,
    "version": "1.0.0"
  },
  "errorCount": 0,
  "recentErrors": [],
  "memoryHeapMB": 38.4
}
```

---

## 7. Technical Debt Backlog

Ranked by player impact, performance cost, bug risk, and maintenance effort:

| Priority | Area | Description | Rationale |
| :---: | :--- | :--- | :--- |
| **1** | **Bundle Chunking** | Split Three.js GLTF/Meshopt loaders into dynamic imports via `build.rollupOptions.output.manualChunks`. | Reduces initial download payload for mobile connections below 500 kB. |
| **2** | **Legacy Biomes** | Consolidate legacy 8-theme definitions into the canonical 5-world architecture. | Prevents duplicate configuration maintenance in `themeManager.ts`. |
| **3** | **Canvas Textures** | Cache procedural canvas textures across repeated runs. | Eliminates tiny GC churn when recreating sprite particle textures. |

---

## 8. Monthly Health Check Checklist

- [ ] Clean install (`npm install`) succeeds.
- [ ] TypeScript check (`npm run lint`) passes with 0 errors.
- [ ] Production build (`npm run build`) builds cleanly.
- [ ] Performance benchmarks (`test_phase8_performance.ts`) pass within budget.
- [ ] Polish benchmarks (`test_phase9_polish.ts`) pass.
- [ ] Full release regression suite (`test_phase10_release.ts`) passes.
- [ ] Stability gate suite (`test_phase12_stability.ts`) passes.
- [ ] Production URL ([flowrider.vercel.app](https://flowrider.vercel.app)) loads cleanly without startup errors.
- [ ] Browser console exhibits 0 unhandled promise rejections.
- [ ] Security audit: 0 committed secrets, `.env` ignored.
- [ ] Documentation is updated with latest release tag.
