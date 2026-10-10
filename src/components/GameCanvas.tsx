import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { TerrainManager, setActiveBiome } from '../game/terrain';
import { FoliageManager } from '../game/foliage';
import { SkyManager, LIGHTING_PRESETS } from '../game/sky';
import { PlayerManager } from '../game/player';
import { ObstacleManager } from '../game/obstacles';
import { AudioManager } from '../game/audio';
import { ThemeManager } from '../game/themeManager';
import { PostPipeline } from '../graphics/postPipeline';
import { BiomeType, CosmeticsConfig, GraphicsConfig, LightingMode, PlayerStats, PlayerUpgrades, ShaderParams, ShadowQuality, TrickType } from '../types';

/** Map the quality setting to a shadow filtering mode with the right cost/quality trade. */
function shadowTypeFor(quality?: ShadowQuality): THREE.ShadowMapType {
  switch (quality) {
    case 'ultra':
      return THREE.VSMShadowMap;
    case 'high':
      return THREE.PCFSoftShadowMap;
    case 'medium':
      return THREE.PCFShadowMap;
    default:
      return THREE.PCFShadowMap;
  }
}

interface GameCanvasProps {
  graphicsConfig: GraphicsConfig;
  lightingMode: LightingMode;
  shaderParams: ShaderParams;
  cosmeticsConfig: CosmeticsConfig;
  upgrades?: PlayerUpgrades;
  activeMobileTrick: TrickType | null;
  onClearMobileTrick: () => void;
  onStatsUpdate: (stats: PlayerStats, fps: number, drawCalls: number, instanceCount: number) => void;
  audioManagerRef: React.MutableRefObject<AudioManager | null>;
  isCinematicCam: boolean;
  isUpright?: boolean;
  isPaused?: boolean;
  onNotification: (msg: string) => void;
  onGameOver?: () => void;
  restartTrigger?: number;
  reviveTrigger?: number;
  shieldTrigger?: number;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
  graphicsConfig,
  lightingMode,
  shaderParams,
  cosmeticsConfig,
  upgrades,
  activeMobileTrick,
  onClearMobileTrick,
  onStatsUpdate,
  audioManagerRef,
  isCinematicCam,
  isUpright = true,
  isPaused = false,
  onNotification,
  onGameOver,
  restartTrigger,
  reviveTrigger,
  shieldTrigger,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isPausedRef = useRef(false);
  isPausedRef.current = isPaused;
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);

  const terrainMgrRef = useRef<TerrainManager | null>(null);
  const foliageMgrRef = useRef<FoliageManager | null>(null);
  const skyMgrRef = useRef<SkyManager | null>(null);
  const playerMgrRef = useRef<PlayerManager | null>(null);
  const obstacleMgrRef = useRef<ObstacleManager | null>(null);
  const themeMgrRef = useRef<ThemeManager | null>(null);

  // Post-processing
  const renderTargetRef = useRef<THREE.WebGLRenderTarget | null>(null);
  const postMaterialRef = useRef<THREE.ShaderMaterial | null>(null);
  const pipelineRef = useRef<PostPipeline | null>(null);

  // Reused per-frame vectors for the post pipeline's sun projection. Allocating
  // these inside the render loop produced steady GC pressure at 60fps.
  const sunWorldScratch = useRef(new THREE.Vector3()).current;
  const sunColorScratch = useRef(new THREE.Color()).current;

  // Biome & tier tracking for audio & announcements
  const lastBiomeRef = useRef<BiomeType>('neon-undercity');
  const lastTierRef = useRef<string>('Chill');

  // Input states
  const keysRef = useRef({
    left: false,
    right: false,
    forward: false,
    jump: false,
    drift: false,
    trickSpin: false,
    trickFlip: false,
    trickGrab: false,
    trickPose: false,
  });

  // Touch touch handling
  const touchStateRef = useRef({
    startX: 0,
    startY: 0,
    active: false,
  });

  // Apply cosmetics dynamically
  useEffect(() => {
    if (playerMgrRef.current) {
      playerMgrRef.current.applyCosmetics(cosmeticsConfig);
    }
  }, [cosmeticsConfig]);

  // Support URL biome param & dynamic biome switching
  useEffect(() => {
    try {
      const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
      const urlBiome = params?.get('biome') as BiomeType | null;
      if (urlBiome) {
        setActiveBiome(urlBiome);
      }
      (window as any).__setActiveBiome = (b: BiomeType | null) => {
        setActiveBiome(b);
        if (terrainMgrRef.current && playerMgrRef.current) {
          terrainMgrRef.current.rebuildAroundPlayer(playerMgrRef.current.stats.distance, 0, 4);
        }
      };
    } catch {}
  }, []);

  // Apply player cyber upgrades dynamically
  useEffect(() => {
    if (playerMgrRef.current && upgrades) {
      playerMgrRef.current.applyUpgrades(upgrades);
    }
  }, [upgrades]);

  // Sync upright mode to player camera
  useEffect(() => {
    if (playerMgrRef.current) {
      playerMgrRef.current.setUpright(isUpright);
    }
  }, [isUpright]);

  // Handle on-screen mobile trick trigger
  useEffect(() => {
    if (activeMobileTrick && playerMgrRef.current) {
      playerMgrRef.current.triggerTrick(activeMobileTrick, audioManagerRef.current);
      onClearMobileTrick();
    }
  }, [activeMobileTrick, onClearMobileTrick, audioManagerRef]);

  // Handle restart run trigger
  useEffect(() => {
    if (restartTrigger && playerMgrRef.current && obstacleMgrRef.current) {
      playerMgrRef.current.resetRun();
      obstacleMgrRef.current.reset();
      onNotification('✨ Journey Begun Anew!');
    }
  }, [restartTrigger, onNotification]);

  // Handle revive trigger
  useEffect(() => {
    if (reviveTrigger && playerMgrRef.current && obstacleMgrRef.current) {
      playerMgrRef.current.revive();
      obstacleMgrRef.current.clearAhead(playerMgrRef.current.position.z, 60);
      onNotification('🌸 Spirit Revived! Shield Active!');
    }
  }, [reviveTrigger, onNotification]);

  // Handle shield trigger from HUD or action button
  useEffect(() => {
    if (shieldTrigger && playerMgrRef.current) {
      playerMgrRef.current.activateHoverboardShield(audioManagerRef.current);
      onNotification('🛡️ Hoverboard Shield Deployed!');
    }
  }, [shieldTrigger, onNotification, audioManagerRef]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 1. Audio Manager
    if (!audioManagerRef.current) {
      audioManagerRef.current = new AudioManager();
    }
    const audio = audioManagerRef.current;

    // 2. Three.js Scene, Camera, Renderer
    const width = Math.max(container.clientWidth || window.innerWidth || 800, 100);
    const height = Math.max(container.clientHeight || window.innerHeight || 600, 100);

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(62, width / height, 0.2, 1200);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      antialias: false, // MSAA happens on the HDR target; canvas AA would double it
      powerPreference: 'high-performance',
      stencil: false,
      depth: true,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2.5));
    // The composite pass tonemaps and encodes sRGB itself, so the renderer must
    // stay in linear NoToneMapping — double tone-mapping was washing out neons.
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = graphicsConfig.enableShadows;
    renderer.shadowMap.type = shadowTypeFor(graphicsConfig.shadowQuality);
    renderer.shadowMap.autoUpdate = true;
    rendererRef.current = renderer;
    container.appendChild(renderer.domElement);

    // 3. Multi-pass post-processing pipeline (SSAO / SSR / volumetrics / DoF / AA)
    const pipeline = new PostPipeline(renderer, scene, camera, width, height, graphicsConfig, shaderParams);
    pipelineRef.current = pipeline;
    renderTargetRef.current = pipeline.sceneTarget;
    postMaterialRef.current = pipeline.compositeMaterial;

    // 4. Managers
    const skyMgr = new SkyManager(scene);
    skyMgrRef.current = skyMgr;
    skyMgr.applyLightingPreset(lightingMode);

    const terrainMgr = new TerrainManager(scene);
    terrainMgrRef.current = terrainMgr;

    const foliageMgr = new FoliageManager(scene);
    foliageMgrRef.current = foliageMgr;

    const playerMgr = new PlayerManager(scene, cosmeticsConfig);
    playerMgr.setUpright(isUpright);
    if (upgrades) playerMgr.applyUpgrades(upgrades);
    playerMgr.applyCosmetics(cosmeticsConfig);
    playerMgrRef.current = playerMgr;
    const obstacleMgr = new ObstacleManager(scene);
    obstacleMgrRef.current = obstacleMgr;

    const themeMgr = new ThemeManager(scene);
    themeMgrRef.current = themeMgr;

    if (typeof window !== 'undefined') {
      (window as any).__playerManager = playerMgr;
    }

    // Initial terrain & foliage population
    terrainMgr.update(playerMgr.position.z, playerMgr.position.x, 3);
    foliageMgr.updateFoliage(terrainMgr.chunks, playerMgr.position.z, playerMgr.position.x, graphicsConfig.vegetationDensity);

    // 5. Input Listeners (Subway Surfers 3-Lane, Jump, Slide & Shield Double-Tap)
    let lastSpaceTime = 0;

    const onKeyDown = (e: KeyboardEvent) => {
      const code = e.code;
      if (code === 'KeyA' || code === 'ArrowLeft') {
        if (!keysRef.current.left) playerMgr.switchLane(-1, audio);
        keysRef.current.left = true;
      }
      if (code === 'KeyD' || code === 'ArrowRight') {
        if (!keysRef.current.right) playerMgr.switchLane(1, audio);
        keysRef.current.right = true;
      }
      if (code === 'KeyS' || code === 'ArrowDown') {
        playerMgr.triggerSlide(audio);
        e.preventDefault();
      }
      if (code === 'KeyW' || code === 'ArrowUp') {
        if (!keysRef.current.jump && playerMgr.isGrounded) {
          audio.playJump();
        }
        keysRef.current.jump = true;
        keysRef.current.forward = true;
        e.preventDefault();
      }
      if (code === 'Space') {
        const now = performance.now();
        if (now - lastSpaceTime < 340) {
          playerMgr.activateHoverboardShield(audio);
          onNotification('🛡️ Hoverboard Shield Deployed!');
        }
        lastSpaceTime = now;

        if (!keysRef.current.jump && playerMgr.isGrounded) {
          audio.playJump();
        }
        keysRef.current.jump = true;
        e.preventDefault();
      }
      if (code === 'ShiftLeft' || code === 'ShiftRight') {
        if (!keysRef.current.drift) audio.playCarveWhoosh();
        keysRef.current.drift = true;
      }

      // Trick Keybinds (J=Spin, K=Flip, L=Grab, I=Pose, or digits 1-4)
      if (code === 'KeyJ' || code === 'Digit1') keysRef.current.trickSpin = true;
      if (code === 'KeyK' || code === 'Digit2') keysRef.current.trickFlip = true;
      if (code === 'KeyL' || code === 'Digit3') keysRef.current.trickGrab = true;
      if (code === 'KeyI' || code === 'Digit4') keysRef.current.trickPose = true;
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const code = e.code;
      if (code === 'KeyA' || code === 'ArrowLeft') keysRef.current.left = false;
      if (code === 'KeyD' || code === 'ArrowRight') keysRef.current.right = false;
      if (code === 'KeyW' || code === 'ArrowUp') {
        keysRef.current.forward = false;
        keysRef.current.jump = false;
      }
      if (code === 'Space') keysRef.current.jump = false;
      if (code === 'ShiftLeft' || code === 'ShiftRight') keysRef.current.drift = false;

      if (code === 'KeyJ' || code === 'Digit1') keysRef.current.trickSpin = false;
      if (code === 'KeyK' || code === 'Digit2') keysRef.current.trickFlip = false;
      if (code === 'KeyL' || code === 'Digit3') keysRef.current.trickGrab = false;
      if (code === 'KeyI' || code === 'Digit4') keysRef.current.trickPose = false;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    // Pointer / Touch gestures for Subway Surfers swipe & double-tap
    let lastTapTime = 0;
    const swipeState = {
      startX: 0,
      startY: 0,
      active: false,
      startTime: 0,
      swiped: false,
    };

    const onPointerDown = (e: PointerEvent) => {
      swipeState.active = true;
      swipeState.startX = e.clientX;
      swipeState.startY = e.clientY;
      swipeState.startTime = performance.now();
      swipeState.swiped = false;
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!swipeState.active || swipeState.swiped) return;
      const dx = e.clientX - swipeState.startX;
      const dy = e.clientY - swipeState.startY;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      if (absDx > 24 || absDy > 24) {
        swipeState.swiped = true;
        if (absDx > absDy) {
          // Horizontal Swipe: 3-Lane Switch
          if (dx < 0) {
            // Swipe Left = Move Left (-1)
            playerMgr.switchLane(-1, audio);
          } else {
            // Swipe Right = Move Right (+1)
            playerMgr.switchLane(1, audio);
          }
        } else {
          // Vertical Swipe: Jump or Slide
          if (dy < 0) {
            // Swipe Up = Jump
            if (playerMgr.isGrounded) {
              audio.playJump();
              keysRef.current.jump = true;
              setTimeout(() => { keysRef.current.jump = false; }, 160);
            }
          } else {
            // Swipe Down = Slide / Fast fall
            playerMgr.triggerSlide(audio);
          }
        }
      }
    };

    const onPointerUp = () => {
      if (swipeState.active && !swipeState.swiped) {
        const now = performance.now();
        if (now - lastTapTime < 320) {
          playerMgr.activateHoverboardShield(audio);
          onNotification('🛡️ Hoverboard Shield Deployed!');
        }
        lastTapTime = now;
      }
      swipeState.active = false;
      swipeState.swiped = false;
      keysRef.current.left = false;
      keysRef.current.right = false;
    };

    container.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    // 6. Resize Observer
    const resizeObserver = new ResizeObserver(() => {
      if (!container || !renderer || !camera) return;
      const w = container.clientWidth || window.innerWidth || 800;
      const h = container.clientHeight || window.innerHeight || 600;
      if (w <= 0 || h <= 0) return;
      const aspect = w / h;
      camera.aspect = aspect;
      if (aspect < 1.0) {
        // Upright Portrait view: slightly wider vertical FOV for grand scale
        camera.fov = Math.min(70, Math.max(62, 58 / Math.sqrt(aspect)));
      } else {
        camera.fov = 62;
      }
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      // The pipeline owns all render targets and resizes them together, so the
      // scene target never drifts out of sync with the canvas.
      pipeline.setSize(w, h);
    });
    resizeObserver.observe(container);

    // 7. Render & Physics Loop
    let animationFrameId: number;
    let lastTime = performance.now();
    let frameCount = 0;
    let fpsAccum = 0;
    let currentFps = 60;
    let foliageTimer = 0;
    let boostGlitchTimer = 0;
    let stumbleGlitchTimer = 0;
    let screenShakeTimer = 0;
    let screenShakeIntensity = 0;
    let nearMissSlowMoTimer = 0;
    let statsUpdateTimer = 0;
    let lastSentGameState = playerMgr.gameState;

    const animate = (now: number) => {
      animationFrameId = requestAnimationFrame(animate);

      const rawDt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;
      const timeSeconds = now * 0.001;
      const currentBiome = playerMgr.stats.currentBiome;

      // Matrix-style Slow-Motion Dilation on Near Miss (0.42x time speed for 200ms)
      const timeScale = nearMissSlowMoTimer > 0 ? 0.42 : 1.0;
      const dt = rawDt * timeScale;
      if (nearMissSlowMoTimer > 0) {
        nearMissSlowMoTimer -= rawDt;
      }

      // FPS tracking
      frameCount++;
      fpsAccum += rawDt;
      if (fpsAccum >= 0.5) {
        currentFps = Math.round(frameCount / fpsAccum);
        frameCount = 0;
        fpsAccum = 0;
      }

      // Only update simulation and physics if not paused
      if (!isPausedRef.current) {
        // Update Player with terrainManager, audioManager, and obstacleManager
        playerMgr.update(dt, keysRef.current, timeSeconds, terrainMgr, audio, obstacleMgr);

        // Obstacles, Pickups & Collision Loop
        if (playerMgr.gameState === 'playing') {
        obstacleMgr.update(playerMgr.position.z, timeSeconds, playerMgr.speedUnitsPerSecond);

        if (playerMgr.activePowerUps.magnetTimer > 0) {
          const magnetRadius = 26.0 + (playerMgr.upgrades?.magnetLevel ?? 1) * 4.0;
          obstacleMgr.attractCoinsToPlayer(playerMgr.position, magnetRadius, dt);
        }

        const collision = obstacleMgr.checkCollisions(playerMgr.position, playerMgr.isSliding);

        // World Portal Warp - Clear ahead for 90m & rebuild chunks to give seamless transition
        if (collision.hitPortal) {
          const target = collision.hitPortal.targetBiome;
          setActiveBiome(target);
          playerMgr.triggerPortalWarp(target, audio);
          themeMgr.triggerPortalWarp(target, playerMgr.position);
          obstacleMgr.clearAhead(playerMgr.position.z, 90);
          terrainMgr.rebuildAroundPlayer(playerMgr.position.z, playerMgr.position.x, 3);
          boostGlitchTimer = 0.85;
          const bNameMap: Record<string, string> = {
            'neon-undercity': 'NEON UNDERCITY // SECTOR 01',
            'dune-nomad': 'DUNE NOMAD // AMBER MESAS',
            'aurora-frost': 'AURORA FROST // GLACIER TUNDRA',
            'bioluminescent-jungle': 'BIOLUMINESCENT JUNGLE',
            'ember-core': 'EMBER CORE // MAGMA OBSIDIAN',
            'nebula-drift': 'NEBULA DRIFT // STELLAR VOID',
            'sky-realm': 'SKY REALM // GHIBLI NATURE',
            'quantum-desert': 'QUANTUM DESERT // AMBER MESAS',
            'cyber-forest': 'CYBER FOREST // BIOLUMINESCENT CANOPY',
            'orbital-ring': 'ORBITAL RING // STELLAR VOID',
            'the-grid': 'THE GRID // VECTOR CYBERSPACE',
            'volcanic-forge': 'VOLCANIC FORGE // MAGMA OBSIDIAN',
            'crystal-glacier': 'CRYSTAL GLACIER // FROST REALM',
            'derelict-station': 'DERELICT STATION // HAZARD ZONE',
          };
          onNotification(`🌀 PORTAL WARP! ENTERING ${bNameMap[target] || themeMgr.currentTheme.name.toUpperCase()}!`);
        }

        // Boost Gate acceleration
        if (collision.hitBoostGate) {
          playerMgr.applyBoostGateHit(audio);
          boostGlitchTimer = 0.55;
          screenShakeTimer = 0.22;
          screenShakeIntensity = 0.35;
          onNotification('⚡ BOOST ARCH CHARGED! SONIC ACCELERATION! ⚡');
          if (typeof navigator !== 'undefined' && navigator.vibrate) {
            try { navigator.vibrate([15, 20, 25]); } catch {}
          }
        }

        // Near-Miss Style Bonus & Slow-Mo Polish (Step 3 & 7)
        if (collision.nearMiss) {
          playerMgr.addCoins(3);
          playerMgr.overdriveMeter = Math.min(100, playerMgr.overdriveMeter + 10);
          playerMgr.stats.nearMissCount = (playerMgr.stats.nearMissCount || 0) + 1;
          nearMissSlowMoTimer = 0.22; // Satisfying micro-slowmo brush with death
          screenShakeTimer = 0.16;
          screenShakeIntensity = 0.22;
          playerMgr.emitNearMissSparks(collision.nearMissPos || playerMgr.position);
          audio.playNearMissSound();
          onNotification('⚡ NEAR MISS! +300 Style Bonus');
          if (typeof navigator !== 'undefined' && navigator.vibrate) {
            try { navigator.vibrate(18); } catch {}
          }
        }

        // Rail Grinding
        playerMgr.setGrinding(!!collision.isGrinding, audio);

        if (collision.collectedCoins > 0) {
          playerMgr.addCoins(collision.collectedCoins);
          audio.playDataShardCollect();
          onNotification(`+${collision.collectedCoins * 100 * playerMgr.scoreMultiplier} Data Shards!`);
        }

        if (collision.collectedPowerUp) {
          playerMgr.applyPowerUp(collision.collectedPowerUp, audio);
          const pNames: Record<string, string> = {
            'quantum-magnet': '🧲 QUANTUM SHARD ATTRACTOR (12s)',
            'sonic-jetpack': '🚀 HYPERDRIVE FLIGHT (8.5s)',
            'holo-shield': '🛡️ HOLO-DEFENSE SHIELD ENGAGED',
            'overdrive-2x': '⚡ 2X OVERDRIVE MULTIPLIER (15s)',
            'magnet': '🧲 QUANTUM SHARD ATTRACTOR (12s)',
            'jetpack': '🚀 HYPERDRIVE FLIGHT (8.5s)',
            'hoverboard-shield': '🛡️ HOLO-DEFENSE SHIELD ENGAGED',
            'multiplier2x': '⚡ 2X OVERDRIVE MULTIPLIER (15s)',
          };
          onNotification(pNames[collision.collectedPowerUp] || 'Power-Up Collected!');
          if (typeof navigator !== 'undefined' && navigator.vibrate) {
            try { navigator.vibrate([20, 30, 40]); } catch {}
          }
        }

        // Obstacle Impact & Collision Reaction
        if (collision.hasCrashed || collision.hasStumbled) {
          if (playerMgr.activePowerUps.hoverboardShield) {
            playerMgr.absorbShieldHit();
            audio.playCarveWhoosh();
            stumbleGlitchTimer = 0.45;
            screenShakeTimer = 0.35;
            screenShakeIntensity = 0.55;
            onNotification('🛡️ HOLO-SHIELD DEFLECTED IMPACT!');
            if (typeof navigator !== 'undefined' && navigator.vibrate) {
              try { navigator.vibrate([30, 30, 45]); } catch {}
            }
            if (collision.crashedObstacle) {
              obstacleMgr.removeObstacle(collision.crashedObstacle);
            }
          } else if (collision.hasCrashed) {
            playerMgr.crash();
            audio.playCrashSound();
            screenShakeTimer = 0.75;
            screenShakeIntensity = 1.05;
            onNotification('💥 SYSTEM CRASH! NEURAL DESYNC DETECTED');
            if (typeof navigator !== 'undefined' && navigator.vibrate) {
              try { navigator.vibrate([60, 40, 100]); } catch {}
            }
            if (onGameOver) {
              onGameOver();
            }
          } else if (collision.hasStumbled) {
            playerMgr.stumble(audio);
            stumbleGlitchTimer = 0.6;
            screenShakeTimer = 0.45;
            screenShakeIntensity = 0.65;
            onNotification('⚠️ OBSTACLE IMPACT! STUMBLED (-20 OVERDRIVE)');
            if (typeof navigator !== 'undefined' && navigator.vibrate) {
              try { navigator.vibrate([35, 25, 45]); } catch {}
            }
            if (collision.crashedObstacle) {
              obstacleMgr.removeObstacle(collision.crashedObstacle);
            }
          }
        }
      }

      // Biome transition detection & audio
      if (currentBiome !== lastBiomeRef.current) {
        lastBiomeRef.current = currentBiome;
        playerMgr.triggerBiomePullBack(); // Cinematic wide establishing shot pull-back!
        audio.playBiomeShiftSound(currentBiome);
        const biomeNames: Record<string, string> = {
          'neon-undercity': 'NEON UNDERCITY // SECTOR 01',
          'quantum-desert': 'QUANTUM DESERT // SOLAR DUNES',
          'cyber-forest': 'CYBER FOREST // BIOLUMINESCENT CANOPY',
          'orbital-ring': 'ORBITAL RING // STRATOSPHERE',
          'the-grid': 'THE GRID // VECTOR CYBERSPACE',
          'volcanic-forge': 'VOLCANIC FORGE // MAGMA OBSIDIAN CORE',
          'crystal-glacier': 'CRYSTAL GLACIER // FROST REALM',
          'derelict-station': 'DERELICT STATION // HAZARD ZONE',
          meadow: 'NEON UNDERCITY // SECTOR 01',
          dunes: 'QUANTUM DESERT // SOLAR DUNES',
          'sky-islands': 'ORBITAL RING // STRATOSPHERE',
          forest: 'CYBER FOREST // BIOLUMINESCENT CANOPY',
        };
        onNotification(`Entering ${biomeNames[currentBiome] || currentBiome}!`);
      }

      // Style & Overdrive tier transition detection
      const currentTier = playerMgr.stats.styleTier;
      if (currentTier !== lastTierRef.current) {
        if (currentTier === 'Transcendent') {
          audio.playGoalCompleteSound();
          onNotification('⚡ MAX VELOCITY OVERDRIVE! PLASMA TRAIL ACTIVE! ⚡');
        } else if (currentTier === 'Flow') {
          onNotification('Overdrive Surge Achieved! +25% Speed Glide');
        }
        lastTierRef.current = currentTier;
      }

      // Check collectibles across chunks
      let collectedTotal = 0;
      terrainMgr.chunks.forEach(chunk => {
        collectedTotal += playerMgr.checkOrbCollection(chunk.foliageInstances.orbs);
      });
      if (collectedTotal > 0) {
        audio.playDataShardCollect();
        onNotification(`+${collectedTotal * 200} Data Shards Harvested!`);
      }

      // Update Audio Dynamics
      audio.updateSpeed(playerMgr.stats.speed, playerMgr.stats.maxSpeed, playerMgr.stats.isBoosting);

      // Stream Terrain & Foliage (Passing live player speed for animated motion blur and building pulses)
      terrainMgr.update(playerMgr.position.z, playerMgr.position.x, 3, timeSeconds, playerMgr.speedUnitsPerSecond);

      foliageTimer += dt;
      if (foliageTimer > 0.3) {
        foliageTimer = 0;
        foliageMgr.updateFoliage(terrainMgr.chunks, playerMgr.position.z, playerMgr.position.x, graphicsConfig.vegetationDensity);
      }

      // Update Foliage Wind & Interactive Player Bending Uniforms
      const speedNorm = Math.min(playerMgr.stats.speed / 30, 1.5);
      foliageMgr.updateShaderTime(timeSeconds, speedNorm, camera.position);
      if (foliageMgr.grassMaterial.uniforms.uPlayerPos) {
        foliageMgr.grassMaterial.uniforms.uPlayerPos.value.copy(playerMgr.position);
      }

      // Update Sky & Deep Galaxy Parallax
      skyMgr.update(playerMgr.position, playerMgr.velocity.z, timeSeconds, playerMgr.speedUnitsPerSecond);
      if (skyMgr.skyMaterial && skyMgr.skyMaterial.uniforms.uGridMode) {
        skyMgr.skyMaterial.uniforms.uGridMode.value = currentBiome === 'the-grid' ? 1.0 : 0.0;
      }

      // Update Multiverse Visual Theme & Particles
      themeMgr.update(dt, skyMgr, terrainMgr, obstacleMgr, playerMgr.position, timeSeconds);
    }

      // Dynamic camera FOV widen at high speed/boost & screen shake impulse (Trauma decay)
      let screenShakeX = 0;
      let screenShakeY = 0;
      if (screenShakeTimer > 0) {
        screenShakeTimer -= rawDt;
        const shakeMag = screenShakeIntensity * Math.min(1.0, screenShakeTimer / 0.5);
        screenShakeX = (Math.random() - 0.5) * shakeMag * 0.7;
        screenShakeY = (Math.random() - 0.5) * shakeMag * 0.7;
      } else if (stumbleGlitchTimer > 0) {
        screenShakeX = (Math.random() - 0.5) * stumbleGlitchTimer * 0.35;
        screenShakeY = (Math.random() - 0.5) * stumbleGlitchTimer * 0.35;
      }

      if (isCinematicCam) {
        camera.up.set(0, 1, 0);
        const radius = 18;
        const camX = playerMgr.position.x + Math.sin(timeSeconds * 0.4) * radius;
        const camZ = playerMgr.position.z + Math.cos(timeSeconds * 0.4) * radius;
        camera.lookAt(playerMgr.position.x, playerMgr.position.y + 1.5, playerMgr.position.z);
      } else {
        const baseFov = 62;
        const targetFov = Math.min(70, Math.max(62, baseFov + (playerMgr.stats.speed / 150) * 6 + (playerMgr.stats.isBoosting ? 2 : 0)));
        camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, 3.5 * dt);
        camera.updateProjectionMatrix();

        camera.position.copy(playerMgr.cameraPos);
        camera.position.x += screenShakeX;
        camera.position.y += screenShakeY;
        camera.up.set(0, 1, 0);
        camera.lookAt(playerMgr.cameraLookAt);
        // Dynamic camera roll tilt on carve without Euler wipeout or 180 deg reverse flip
        if (Math.abs(playerMgr.cameraTilt) > 0.0001) {
          camera.rotateZ(playerMgr.cameraTilt);
        }
      }

      // Terrain Uniforms Camera & Time update
      if (terrainMgr.terrainMaterial.uniforms.uCameraPos) {
        terrainMgr.terrainMaterial.uniforms.uCameraPos.value.copy(camera.position);
      }
      if (terrainMgr.terrainMaterial.uniforms.uTime) {
        terrainMgr.terrainMaterial.uniforms.uTime.value = timeSeconds;
      }

      // Render Scene
      // Dynamic speed line modulation based on player speed stats (Step 3: Forward speed streaks):
      // As speed exceeds 25, smoothly increase forward streaks from 0.1 to 0.95
      const currentSpeed = playerMgr.stats.speed;
      let dynamicSpeedLines = 0.0;
      if (currentSpeed > 24) {
        const speedFactor = Math.min(1.0, (currentSpeed - 24) / 45.0);
        dynamicSpeedLines = 0.15 + speedFactor * 0.75;
      }
      if (playerMgr.stats.isBoosting) {
        dynamicSpeedLines = Math.max(dynamicSpeedLines, 0.95);
      }
      const effectiveSpeedLines = shaderParams.speedLineIntensity !== undefined && shaderParams.speedLineIntensity > 0
        ? Math.max(shaderParams.speedLineIntensity, dynamicSpeedLines)
        : dynamicSpeedLines;
      const heatShimmerFactor = currentBiome === 'orbital-ring' ? 1.0 : 0.0;

      // Glitch and chromatic aberration pulse during boost, combos, or stumble
      let glitchIntensity = shaderParams.glitchIntensity ?? 0.0;
      let chromaticAberration = shaderParams.chromaticAberration ?? 0.0005;

      if (boostGlitchTimer > 0) {
        boostGlitchTimer -= dt;
        glitchIntensity = Math.max(glitchIntensity, boostGlitchTimer * 0.85);
        chromaticAberration = Math.max(chromaticAberration, boostGlitchTimer * 0.008);
      }
      if (stumbleGlitchTimer > 0) {
        stumbleGlitchTimer -= dt;
        glitchIntensity = Math.max(glitchIntensity, stumbleGlitchTimer * 0.7);
        chromaticAberration = Math.max(chromaticAberration, stumbleGlitchTimer * 0.006);
      }
      if (playerMgr.stats.isBoosting || playerMgr.boostTimer > 0) {
        chromaticAberration = Math.max(chromaticAberration, 0.0035);
      }
      if (playerMgr.stats.combo >= 3) {
        chromaticAberration = Math.max(chromaticAberration, 0.002);
      }
      if (playerMgr.gameState === 'game-over') {
        glitchIntensity = 0.85;
        chromaticAberration = 0.008;
      }

      if (graphicsConfig.reducedFlash) {
        glitchIntensity = 0;
        chromaticAberration = 0;
        screenShakeTimer = 0;
      }

      const instances = (foliageMgr.grassMesh ? foliageMgr.grassMesh.count : 0) + (foliageMgr.treeMesh ? foliageMgr.treeMesh.count : 0);

      // Draw-call counts are read *after* the frame completes so the HUD
      // reflects the scene plus every post-processing pass.
      renderer.info.autoReset = false;
      renderer.info.reset();

      if (graphicsConfig.enablePostProcess) {
        const preset = LIGHTING_PRESETS[lightingMode] ?? LIGHTING_PRESETS['midnight-cyan'];
        const sunDir = sunWorldScratch.set(...preset.sunPosition).normalize();

        pipeline.render({
          time: timeSeconds,
          speedLines: effectiveSpeedLines,
          glitch: glitchIntensity,
          warp: playerMgr.warpTimer > 0 ? playerMgr.warpTimer * 0.75 : 0.0,
          heatShimmer: heatShimmerFactor,
          chromaticAberration,
          sunWorldPos: sunDir.multiplyScalar(400).add(camera.position),
          sunColor: sunColorScratch.set(preset.sunColor),
          // Shafts are strongest in hazy, fog-heavy biomes and absent in vacuum.
          volumetricStrength: (preset.hazeDensity ?? 0.9) * 0.3,
          focusDistance: isCinematicCam ? 16.0 : 9.0,
          focusRange: isCinematicCam ? 26.0 : 18.0,
        });
      } else {
        renderer.setRenderTarget(null);
        renderer.render(scene, camera);
      }

      const totalDrawCalls = renderer.info.render.calls;

      statsUpdateTimer += rawDt;
      const stateChanged = playerMgr.gameState !== lastSentGameState;
      if (statsUpdateTimer >= 0.066 || stateChanged) {
        statsUpdateTimer = 0;
        lastSentGameState = playerMgr.gameState;
        renderer.info.autoReset = true;
        onStatsUpdate(playerMgr.stats, currentFps, totalDrawCalls, instances);
      }
    };

    animationFrameId = requestAnimationFrame(animate);

    // Cleanup
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      container.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      resizeObserver.disconnect();

      terrainMgr.dispose();
      foliageMgr.dispose();
      skyMgr.dispose();
      playerMgr.dispose();
      obstacleMgr.dispose();
      themeMgr.dispose();
      pipeline.dispose();
      renderer.dispose();

      if (renderer.domElement && renderer.domElement.parentElement) {
        renderer.domElement.parentElement.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Update Lighting Presets dynamically
  useEffect(() => {
    if (skyMgrRef.current) {
      skyMgrRef.current.applyLightingPreset(lightingMode);
      const preset = LIGHTING_PRESETS[lightingMode];
      if (terrainMgrRef.current && preset) {
        const u = terrainMgrRef.current.terrainMaterial.uniforms;
        if (u.uSunColor) u.uSunColor.value.set(preset.sunColor);
        if (u.uSunDirection) u.uSunDirection.value.set(...preset.sunPosition).normalize();
        if (u.uAmbientColor) u.uAmbientColor.value.set(preset.ambientColor);
        if (u.uSlopeWarmColor) u.uSlopeWarmColor.value.set(preset.slopeWarm);
        if (u.uSlopeCoolColor) u.uSlopeCoolColor.value.set(preset.slopeCool);
      }
    }
  }, [lightingMode]);

  // Update Shader Parameters dynamically
  useEffect(() => {
    if (foliageMgrRef.current) {
      const gUniforms = foliageMgrRef.current.grassMaterial.uniforms;
      if (gUniforms.uWindSpeed) gUniforms.uWindSpeed.value = shaderParams.windSpeed;
      if (gUniforms.uWindStrength) gUniforms.uWindStrength.value = shaderParams.windStrength;
      if (gUniforms.uRimLightIntensity) gUniforms.uRimLightIntensity.value = shaderParams.rimLightIntensity;

      const treeUniforms = foliageMgrRef.current.treeMaterial.uniforms;
      if (treeUniforms.uWindSpeed) treeUniforms.uWindSpeed.value = shaderParams.windSpeed * 0.7;
      if (treeUniforms.uWindStrength) treeUniforms.uWindStrength.value = shaderParams.windStrength * 0.5;
      if (treeUniforms.uRimLightIntensity) treeUniforms.uRimLightIntensity.value = shaderParams.rimLightIntensity;
    }

    if (terrainMgrRef.current) {
      const tUniforms = terrainMgrRef.current.terrainMaterial.uniforms;
      if (tUniforms.uCelRampHardness) tUniforms.uCelRampHardness.value = shaderParams.celRampHardness;
      if (tUniforms.uRimLightIntensity) tUniforms.uRimLightIntensity.value = shaderParams.rimLightIntensity;
    }

    if (postMaterialRef.current) {
      const pUniforms = postMaterialRef.current.uniforms;
      if (pUniforms.uFilmGrain) pUniforms.uFilmGrain.value = shaderParams.filmGrainIntensity;
      if (pUniforms.uBloom) pUniforms.uBloom.value = shaderParams.bloomIntensity;
      if (pUniforms.uColorLift) pUniforms.uColorLift.value = shaderParams.colorLift;
      if (pUniforms.uChromaticAberration) pUniforms.uChromaticAberration.value = shaderParams.chromaticAberration ?? 0.005;
      if (pUniforms.uScanlines) pUniforms.uScanlines.value = shaderParams.scanlineIntensity ?? 0.5;
      if (pUniforms.uSpeedLines && shaderParams.speedLineIntensity !== undefined) pUniforms.uSpeedLines.value = shaderParams.speedLineIntensity;
    }
  }, [shaderParams]);

  // Push graphics-config changes (quality toggles, shadows) into the live
  // renderer and pipeline so settings apply without remounting the canvas.
  useEffect(() => {
    rendererRef.current.shadowMap.enabled = graphicsConfig.enableShadows;
    rendererRef.current.shadowMap.type = shadowTypeFor(graphicsConfig.shadowQuality);
    rendererRef.current.shadowMap.needsUpdate = true;
    if (pipelineRef.current) {
      pipelineRef.current.updateConfig(graphicsConfig, shaderParams);
    }
  }, [graphicsConfig, shaderParams]);

  return (
    <div
      ref={containerRef}
      id="game-canvas-container"
      className="relative w-full h-full overflow-hidden select-none touch-none bg-slate-900"
    />
  );
};
