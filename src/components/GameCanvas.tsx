import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { TerrainManager, setActiveBiome } from '../game/terrain';
import { FoliageManager } from '../game/foliage';
import { SkyManager, LIGHTING_PRESETS } from '../game/sky';
import { PlayerManager } from '../game/player';
import { ObstacleManager } from '../game/obstacles';
import { AudioManager } from '../game/audio';
import { PostProcessShader } from '../graphics/shaders';
import { BiomeType, CosmeticsConfig, GraphicsConfig, LightingMode, PlayerStats, ShaderParams, TrickType } from '../types';

interface GameCanvasProps {
  graphicsConfig: GraphicsConfig;
  lightingMode: LightingMode;
  shaderParams: ShaderParams;
  cosmeticsConfig: CosmeticsConfig;
  activeMobileTrick: TrickType | null;
  onClearMobileTrick: () => void;
  onStatsUpdate: (stats: PlayerStats, fps: number, drawCalls: number, instanceCount: number) => void;
  audioManagerRef: React.MutableRefObject<AudioManager | null>;
  isCinematicCam: boolean;
  isUpright?: boolean;
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
  activeMobileTrick,
  onClearMobileTrick,
  onStatsUpdate,
  audioManagerRef,
  isCinematicCam,
  isUpright = true,
  onNotification,
  onGameOver,
  restartTrigger,
  reviveTrigger,
  shieldTrigger,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);

  const terrainMgrRef = useRef<TerrainManager | null>(null);
  const foliageMgrRef = useRef<FoliageManager | null>(null);
  const skyMgrRef = useRef<SkyManager | null>(null);
  const playerMgrRef = useRef<PlayerManager | null>(null);
  const obstacleMgrRef = useRef<ObstacleManager | null>(null);

  // Post-processing
  const renderTargetRef = useRef<THREE.WebGLRenderTarget | null>(null);
  const postSceneRef = useRef<THREE.Scene | null>(null);
  const postCameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const postMaterialRef = useRef<THREE.ShaderMaterial | null>(null);

  // Biome & tier tracking for audio & announcements
  const lastBiomeRef = useRef<BiomeType>('meadow');
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
    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(62, width / height, 0.2, 1200);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2.5));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = graphicsConfig.enableShadows;
    rendererRef.current = renderer;
    container.appendChild(renderer.domElement);

    // 3. Post-processing render target & quad
    const dpr = renderer.getPixelRatio();
    const rt = new THREE.WebGLRenderTarget(width * dpr, height * dpr, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
    });
    renderTargetRef.current = rt;

    const postScene = new THREE.Scene();
    postSceneRef.current = postScene;
    const postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    postCameraRef.current = postCamera;

    const postMaterial = new THREE.ShaderMaterial({
      vertexShader: PostProcessShader.vertexShader,
      fragmentShader: PostProcessShader.fragmentShader,
      uniforms: {
        tDiffuse: { value: rt.texture },
        uTime: { value: 0 },
        uFilmGrain: { value: 0 },
        uBloom: { value: shaderParams.bloomIntensity ?? 0.35 },
        uColorLift: { value: shaderParams.colorLift ?? 0.2 },
        uHighSpeedBlur: { value: 0 },
        uSpeedLines: { value: 0 },
        uHeatShimmer: { value: 0 },
        uChromaticAberration: { value: shaderParams.chromaticAberration ?? 0.0005 },
        uScanlines: { value: shaderParams.scanlineIntensity ?? 0.0 },
        uGlitch: { value: 0 },
        uWarpIntensity: { value: 0 },
        uResolution: { value: new THREE.Vector2(width * dpr, height * dpr) },
      },
      depthWrite: false,
      depthTest: false,
    });
    postMaterialRef.current = postMaterial;

    const quadGeom = new THREE.PlaneGeometry(2, 2);
    const quadMesh = new THREE.Mesh(quadGeom, postMaterial);
    postScene.add(quadMesh);

    // 4. Managers
    const skyMgr = new SkyManager(scene);
    skyMgrRef.current = skyMgr;
    skyMgr.applyLightingPreset(lightingMode);

    const terrainMgr = new TerrainManager(scene);
    terrainMgrRef.current = terrainMgr;

    const foliageMgr = new FoliageManager(scene);
    foliageMgrRef.current = foliageMgr;

    const playerMgr = new PlayerManager(scene);
    playerMgr.setUpright(isUpright);
    playerMgrRef.current = playerMgr;

    const obstacleMgr = new ObstacleManager(scene);
    obstacleMgrRef.current = obstacleMgr;

    // Initial terrain & foliage population
    terrainMgr.update(playerMgr.position.z, playerMgr.position.x, 3);
    foliageMgr.updateFoliage(terrainMgr.chunks, playerMgr.position.z, playerMgr.position.x, graphicsConfig.vegetationDensity);

    // 5. Input Listeners (Subway Surfers 3-Lane, Jump, Slide & Shield Double-Tap)
    let lastSpaceTime = 0;

    const onKeyDown = (e: KeyboardEvent) => {
      const code = e.code;
      if (code === 'KeyA' || code === 'ArrowLeft') {
        if (!keysRef.current.left) playerMgr.switchLane(1, audio);
        keysRef.current.left = true;
      }
      if (code === 'KeyD' || code === 'ArrowRight') {
        if (!keysRef.current.right) playerMgr.switchLane(-1, audio);
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
            playerMgr.switchLane(1, audio);
          } else {
            playerMgr.switchLane(-1, audio);
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
      if (!container || !renderer || !camera || !rt) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
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
      const pr = renderer.getPixelRatio();
      rt.setSize(w * pr, h * pr);
      if (postMaterialRef.current && postMaterialRef.current.uniforms && postMaterialRef.current.uniforms.uResolution) {
        postMaterialRef.current.uniforms.uResolution.value.set(w * pr, h * pr);
      }
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

    const animate = (now: number) => {
      animationFrameId = requestAnimationFrame(animate);

      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;
      const timeSeconds = now * 0.001;

      // FPS tracking
      frameCount++;
      fpsAccum += dt;
      if (fpsAccum >= 0.5) {
        currentFps = Math.round(frameCount / fpsAccum);
        frameCount = 0;
        fpsAccum = 0;
      }

      // Update Player with terrainManager and audioManager
      playerMgr.update(dt, keysRef.current, timeSeconds, terrainMgr, audio);

      // Obstacles, Pickups & Collision Loop
      if (playerMgr.gameState === 'playing') {
        obstacleMgr.update(playerMgr.position.z, timeSeconds);

        if (playerMgr.activePowerUps.magnetTimer > 0) {
          obstacleMgr.attractCoinsToPlayer(playerMgr.position, 28.0, dt);
        }

        const collision = obstacleMgr.checkCollisions(playerMgr.position, playerMgr.isSliding);

        // World Portal Warp
        if (collision.hitPortal) {
          const target = collision.hitPortal.targetBiome;
          setActiveBiome(target);
          playerMgr.triggerPortalWarp(target, audio);
          boostGlitchTimer = 0.85;
          const bNameMap: Record<string, string> = {
            'neon-undercity': 'NEON UNDERCITY // SECTOR 01',
            'quantum-desert': 'QUANTUM DESERT // SOLAR DUNES',
            'cyber-forest': 'CYBER FOREST // BIOLUMINESCENT CANOPY',
            'orbital-ring': 'ORBITAL RING // STRATOSPHERE',
            'the-grid': 'THE GRID // VECTOR CYBERSPACE',
            'volcanic-forge': 'VOLCANIC FORGE // MAGMA OBSIDIAN CORE',
            'crystal-glacier': 'CRYSTAL GLACIER // FROST REALM',
            'derelict-station': 'DERELICT STATION // HAZARD ZONE',
          };
          onNotification(`🌀 PORTAL WARP! ENTERING ${bNameMap[target] || target}!`);
        }

        // Boost Gate acceleration
        if (collision.hitBoostGate) {
          playerMgr.applyBoostGateHit(audio);
          boostGlitchTimer = 0.55;
          onNotification('⚡ BOOST ARCH CHARGED! SONIC ACCELERATION! ⚡');
        }

        // Near-Miss Style Bonus
        if (collision.nearMiss) {
          playerMgr.addCoins(3);
          playerMgr.overdriveMeter = Math.min(100, playerMgr.overdriveMeter + 10);
          audio.playTrickSound('Near Miss', 2);
          onNotification('⚡ NEAR MISS! +300 Style Bonus');
        }

        // Rail Grinding
        playerMgr.setGrinding(collision.isGrinding, audio);

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
        }

        // Obstacle Impact & Stumble Reaction (Preserves endless-flow feeling)
        if (collision.hasStumbled) {
          if (playerMgr.activePowerUps.hoverboardShield) {
            playerMgr.absorbShieldHit();
            audio.playCarveWhoosh();
            onNotification('🛡️ SHIELD DEFLECTED IMPACT!');
            if (collision.crashedObstacle) {
              obstacleMgr.removeObstacle(collision.crashedObstacle);
            }
          } else {
            playerMgr.stumble(audio);
            stumbleGlitchTimer = 0.6;
            onNotification('⚠️ OBSTACLE IMPACT! STUMBLED (-20 OVERDRIVE)');
            if (collision.crashedObstacle) {
              obstacleMgr.removeObstacle(collision.crashedObstacle);
            }
          }
        }

        if (collision.hasCrashed) {
          playerMgr.crash();
          audio.playCrashSound();
          onNotification('💥 SYSTEM CRASH! NEURAL DESYNC DETECTED');
          if (onGameOver) {
            onGameOver();
          }
        }
      }

      // Biome transition detection & audio
      const currentBiome = playerMgr.stats.currentBiome;
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

      // Stream Terrain & Foliage
      terrainMgr.update(playerMgr.position.z, playerMgr.position.x, 3, timeSeconds);

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

      // Update Sky & Parallax Clouds
      skyMgr.update(playerMgr.position, playerMgr.velocity.z, timeSeconds);
      if (skyMgr.skyMaterial && skyMgr.skyMaterial.uniforms.uGridMode) {
        skyMgr.skyMaterial.uniforms.uGridMode.value = currentBiome === 'the-grid' ? 1.0 : 0.0;
      }

      // Update Camera (Surfer Cam or Cinematic Fly Cam)
      if (isCinematicCam) {
        camera.up.set(0, 1, 0);
        const radius = 18;
        const camX = playerMgr.position.x + Math.sin(timeSeconds * 0.4) * radius;
        const camZ = playerMgr.position.z + Math.cos(timeSeconds * 0.4) * radius;
        camera.position.set(camX, playerMgr.position.y + 6, camZ);
        camera.lookAt(playerMgr.position.x, playerMgr.position.y + 1.5, playerMgr.position.z);
      } else {
        camera.position.copy(playerMgr.cameraPos);
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
      if (graphicsConfig.enablePostProcess && rt && postScene && postCamera && postMaterial) {
        // Step 0 fix: strictly clamp both blurFactor and speedLinesFactor to [0, 1]
        const blurFactor = Math.min(1.0, Math.max(0.0, (playerMgr.stats.speed - 26) / 50));
        const speedLinesFactor = Math.min(1.0, Math.max(0.0, (playerMgr.stats.speed - 28) / 45));
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
        if (playerMgr.gameState === 'gameover') {
          glitchIntensity = 0.85;
          chromaticAberration = 0.008;
        }

        if (postMaterial.uniforms.uTime) postMaterial.uniforms.uTime.value = timeSeconds;
        if (postMaterial.uniforms.uHighSpeedBlur) postMaterial.uniforms.uHighSpeedBlur.value = 0.0;
        if (postMaterial.uniforms.uBloom) postMaterial.uniforms.uBloom.value = shaderParams.bloomIntensity ?? 0.55;
        if (postMaterial.uniforms.uChromaticAberration) postMaterial.uniforms.uChromaticAberration.value = chromaticAberration;
        if (postMaterial.uniforms.uScanlines) postMaterial.uniforms.uScanlines.value = shaderParams.scanlineIntensity ?? 0.0;
        if (postMaterial.uniforms.uGlitch) postMaterial.uniforms.uGlitch.value = glitchIntensity;
        if (postMaterial.uniforms.uWarpIntensity) {
          postMaterial.uniforms.uWarpIntensity.value = playerMgr.warpTimer > 0 ? playerMgr.warpTimer * 0.75 : 0.0;
        }
        if (postMaterial.uniforms.uSpeedLines) {
          postMaterial.uniforms.uSpeedLines.value = playerMgr.stats.isBoosting ? 1.0 : speedLinesFactor;
        }
        if (postMaterial.uniforms.uHeatShimmer) postMaterial.uniforms.uHeatShimmer.value = heatShimmerFactor;

        renderer.setRenderTarget(rt);
        renderer.render(scene, camera);

        renderer.setRenderTarget(null);
        renderer.render(postScene, postCamera);
      } else {
        renderer.setRenderTarget(null);
        renderer.render(scene, camera);
      }

      // Inform parent HUD of live stats
      const drawCalls = renderer.info.render.calls;
      const instances = (foliageMgr.grassMesh ? foliageMgr.grassMesh.count : 0) + (foliageMgr.treeMesh ? foliageMgr.treeMesh.count : 0);
      onStatsUpdate(playerMgr.stats, currentFps, drawCalls, instances);
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
      rt.dispose();
      postMaterial.dispose();
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
    }
  }, [shaderParams]);

  return (
    <div
      ref={containerRef}
      id="game-canvas-container"
      className="relative w-full h-full overflow-hidden select-none touch-none bg-slate-900"
    />
  );
};
