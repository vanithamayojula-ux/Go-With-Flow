# Changelog

## 1.0.1 — October 2026 (stabilization pass)

Every fix below was reproduced first: in a headless browser, by stepping the engine at fixed frame rates, or with a Node test.

### Gameplay

- **Distance and score were frame-rate dependent.** They were added per frame with `Math.round()`, which rounded the distance step to 0 at 30 Hz and above. DST stayed at 0 m, the distance speed ramp never started, and distance missions never progressed. Riding score was 600 at 30 Hz, 1,185 at 60 Hz and 0 at 144 Hz over the same 20 s. Distance now equals metres travelled and score accumulates fractions. Regression test: `scripts/test_framerate_independence.ts`.
- **HUD frozen at its start values; camera shake never stopped.** `render()` recomputed the frame delta after `update()` had already advanced the clock, so it was always 0. Stats never reached React, and the shake and glitch timers never decayed.
- **Unlimited trick score.** Tricks had no cooldown and the combo never reset; mashing or holding a key scored 350 × combo every frame (a bot reached 4.3 M in 3 minutes). Tricks now have a 0.3 s lockout, the combo ends on landing, and key auto-repeat is ignored. Regression test: `scripts/test_trick_scoring.ts`.
- **J/K/L/I trick keys** shown in the HUD weren't wired; only 1–4 worked. Both work now.
- **The board kept moving after a crash.** Distance, score and missions kept counting behind the game-over screen, and a revive resumed further down the track. The player now stays put until revived or restarted.
- Tricks are ignored while paused or after a crash, and only tricks that actually fire count for XP. Keyboard tricks now count too; before, only the on-screen buttons did.
- Camera jitter from stumbles no longer persists when post-processing is off.
- Arrow keys in the hero roster skip locked heroes instead of looping back to the default.

### Heroes and assets

- Five unlockable heroes pointed at `/model02.glb` … `/model06.glb`, which never existed, and silently fell back to the procedural character. They now load `public/models/{shadow,flame,thunder,frost,void}.glb`.
- Skinned heroes were rendered as rigid statues. The rig picked its "custom model" path whenever the model path contained `model`, which matched every `models/*.glb`. Only Cyber Surfer uses that path now; the other five use their bone rigs.
- Hero models now load on hosts with a strict Content-Security-Policy, where they were invisible before. Models are fetched as bytes and parsed, so no `data:` or `blob:` fetches are made. Embedded textures load through `<img>`. `model.glb` was decoded from meshopt compression, so no WebAssembly is needed. `.b64.txt` copies of a GLB are accepted for hosts that only serve text types.
- Hero prices set to Flame 150, Thunder 320, Frost 500 and Void 800 shards (all were 0). A saved selection or `?hero=` link can no longer use a locked hero in production.
- Removed loading of four obstacle GLBs that aren't in the repo (one path was typed `/0bstacle02.glb`). Procedural obstacles are used.
- Fixed a leak: every obstacle spawned after preloading queued a callback that was never drained.
- Removed about 3.2 MB of unreferenced assets, the standalone viewer and the obstacle lab.

### Progression and leaderboard

- Claiming a challenge or achievement reward never credited shards and set the shard bank to `undefined`. Rewards are now added to the bank.
- Live-ops challenge and season-tier shard rewards went into a hidden ledger. They now go to the same bank as everything else.
- Both run validators capped average speed at 25 m/s and allowed about 1–75 points per metre. With the speed ramp working, every honest run over a few hundred metres was rejected. They now share one ceiling derived from the actual scoring rules, plus the engine's 65 m/s cap.
- World distance thresholds in validation were 2,000 m apart; worlds are 2,250 m. They're now derived from `WorldConfig`.

### Labels and honesty

- The leaderboard, live ops and "security" layers are local only. The UI now says so: rankings are saved on this device, the five seeded rivals show a SAMPLE badge, and "Friend Trials" is now "Practice Trials". Code comments no longer claim a server.
- HUD zone badges said "WORLD 1–15" while the campaign banner said "SECTOR 1 OF 5". Zones are now "ZONE n".
- Legacy zone ids got theme aliases instead of silently falling back to Neon Undercity.
- "Sky Realm // Ghibli Nature" is now "Sky Realm // Cloud Isles".

### Build and tooling

- `tsc --noEmit` went from 6 errors to 0. Two errors were real UI bugs: the progression modal read fields that don't exist and showed blank labels.
- Removed unused dependencies (`@google/genai`, `express`, `dotenv`, `@types/express`) and the AI Studio `.env.example`. No environment variables are needed.
- `npm test` runs the new regression tests and the existing phase suites.
- Touch devices start on the Balanced graphics preset.
- README and docs rewritten to match the code.

### Known gaps (not changed)

- Hero abilities (dash, burn, time dilation, …) exist only as data and roster tags; they don't affect gameplay.
- Leaderboards are local; going global needs a backend.
- The world `compatibleBiomes` lists are unused; the 14 zones rotate independently of the 5 worlds.
