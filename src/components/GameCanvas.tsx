import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { TerrainManager } from '../game/terrain';
import { FoliageManager } from '../game/foliage';
import { SkyManager, LIGHTING_PRESETS } from '../game/sky';
import { PlayerManager } from '../game/player';
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
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);

  const terrainMgrRef = useRef<TerrainManager | null>(null);
  const foliageMgrRef = useRef<FoliageManager | null>(null);
  const skyMgrRef = useRef<SkyManager | null>(null);
  const playerMgrRef = useRef<PlayerManager | null>(null);

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
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, graphicsConfig.preset === 'desktop-full' ? 2 : 1.5));
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
        uFilmGrain: { value: shaderParams.filmGrainIntensity },
        uBloom: { value: shaderParams.bloomIntensity },
        uColorLift: { value: shaderParams.colorLift },
        uHighSpeedBlur: { value: 0 },
        uSpeedLines: { value: 0 },
        uHeatShimmer: { value: 0 },
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

    // Initial terrain & foliage population
    terrainMgr.update(playerMgr.position.z, playerMgr.position.x, 3);
    foliageMgr.updateFoliage(terrainMgr.chunks, playerMgr.position.z, playerMgr.position.x, graphicsConfig.vegetationDensity);

    // 5. Input Listeners
    const onKeyDown = (e: KeyboardEvent) => {
      const code = e.code;
      if (code === 'KeyA' || code === 'ArrowLeft') keysRef.current.left = true;
      if (code === 'KeyD' || code === 'ArrowRight') keysRef.current.right = true;
      if (code === 'KeyW' || code === 'ArrowUp') keysRef.current.forward = true;
      if (code === 'Space') {
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
      if (code === 'KeyW' || code === 'ArrowUp') keysRef.current.forward = false;
      if (code === 'Space') keysRef.current.jump = false;
      if (code === 'ShiftLeft' || code === 'ShiftRight') keysRef.current.drift = false;

      if (code === 'KeyJ' || code === 'Digit1') keysRef.current.trickSpin = false;
      if (code === 'KeyK' || code === 'Digit2') keysRef.current.trickFlip = false;
      if (code === 'KeyL' || code === 'Digit3') keysRef.current.trickGrab = false;
      if (code === 'KeyI' || code === 'Digit4') keysRef.current.trickPose = false;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    // Pointer / Touch gestures for mobile
    const onPointerDown = (e: PointerEvent) => {
      touchStateRef.current.active = true;
      touchStateRef.current.startX = e.clientX;
      touchStateRef.current.startY = e.clientY;
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!touchStateRef.current.active) return;
      const dx = e.clientX - touchStateRef.current.startX;
      const dy = e.clientY - touchStateRef.current.startY;

      if (dx < -30) {
        keysRef.current.left = true;
        keysRef.current.right = false;
      } else if (dx > 30) {
        keysRef.current.right = true;
        keysRef.current.left = false;
      } else {
        keysRef.current.left = false;
        keysRef.current.right = false;
      }

      if (dy < -40) {
        keysRef.current.forward = true;
      } else {
        keysRef.current.forward = false;
      }
    };

    const onPointerUp = () => {
      touchStateRef.current.active = false;
      keysRef.current.left = false;
      keysRef.current.right = false;
      keysRef.current.forward = false;
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
      if (postMaterialRef.current) {
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

      // Biome transition detection & audio
      const currentBiome = playerMgr.stats.currentBiome;
      if (currentBiome !== lastBiomeRef.current) {
        lastBiomeRef.current = currentBiome;
        playerMgr.triggerBiomePullBack(); // Cinematic wide establishing shot pull-back!
        audio.playBiomeShiftSound(currentBiome);
        const biomeNames: Record<BiomeType, string> = {
          meadow: 'Verdant Meadow Plains',
          dunes: 'Golden Sand Dunes',
          'sky-islands': 'Ethereal Sky Islands',
          forest: 'Whisperwood Forest',
        };
        onNotification(`Entering ${biomeNames[currentBiome]}!`);
      }

      // Style tier transition detection
      const currentTier = playerMgr.stats.styleTier;
      if (currentTier !== lastTierRef.current) {
        if (currentTier === 'Transcendent') {
          audio.playGoalCompleteSound();
          onNotification('✨ TRANSCENDENT FLOW! Rainbow Trail & Speed Boost Active!');
        } else if (currentTier === 'Flow') {
          onNotification('Flow State Achieved! +25% Speed Glide');
        }
        lastTierRef.current = currentTier;
      }

      // Check collectibles across chunks
      let collectedTotal = 0;
      terrainMgr.chunks.forEach(chunk => {
        collectedTotal += playerMgr.checkOrbCollection(chunk.foliageInstances.orbs);
      });
      if (collectedTotal > 0) {
        audio.playOrbChime();
        onNotification(`+${collectedTotal * 200} Wind Orb Collected!`);
      }

      // Update Audio Wind
      audio.updateWind(playerMgr.stats.speed, playerMgr.stats.maxSpeed, Math.abs(playerMgr.carveAngle) > 0.15);

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
        // High speed radial motion blur factor & anime speed lines
        const blurFactor = Math.max(0, (playerMgr.stats.speed - 26) / 16);
        const speedLinesFactor = Math.max(0, (playerMgr.stats.speed - 28) / 12);
        const heatShimmerFactor = currentBiome === 'dunes' ? 1.0 : 0.0;

        postMaterial.uniforms.uTime.value = timeSeconds;
        postMaterial.uniforms.uHighSpeedBlur.value = blurFactor * shaderParams.highSpeedBlur;
        if (postMaterial.uniforms.uSpeedLines) postMaterial.uniforms.uSpeedLines.value = speedLinesFactor;
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
      const instances = foliageMgr.grassMesh.count + foliageMgr.treeMesh.count;
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

      skyMgr.dispose();
      terrainMgr.dispose();
      foliageMgr.dispose();
      playerMgr.dispose();
      quadGeom.dispose();
      postMaterial.dispose();
      rt.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement) {
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
        terrainMgrRef.current.terrainMaterial.uniforms.uSunColor.value.set(preset.sunColor);
        terrainMgrRef.current.terrainMaterial.uniforms.uSunDirection.value.set(...preset.sunPosition).normalize();
        terrainMgrRef.current.terrainMaterial.uniforms.uAmbientColor.value.set(preset.ambientColor);
        terrainMgrRef.current.terrainMaterial.uniforms.uSlopeWarmColor.value.set(preset.slopeWarm);
        terrainMgrRef.current.terrainMaterial.uniforms.uSlopeCoolColor.value.set(preset.slopeCool);
      }
    }
  }, [lightingMode]);

  // Update Shader Parameters dynamically
  useEffect(() => {
    if (foliageMgrRef.current) {
      foliageMgrRef.current.grassMaterial.uniforms.uWindSpeed.value = shaderParams.windSpeed;
      foliageMgrRef.current.grassMaterial.uniforms.uWindStrength.value = shaderParams.windStrength;
      foliageMgrRef.current.grassMaterial.uniforms.uRimLightIntensity.value = shaderParams.rimLightIntensity;

      foliageMgrRef.current.treeMaterial.uniforms.uWindSpeed.value = shaderParams.windSpeed * 0.7;
      foliageMgrRef.current.treeMaterial.uniforms.uWindStrength.value = shaderParams.windStrength * 0.5;
      foliageMgrRef.current.treeMaterial.uniforms.uRimLightIntensity.value = shaderParams.rimLightIntensity;
    }

    if (terrainMgrRef.current) {
      terrainMgrRef.current.terrainMaterial.uniforms.uCelRampHardness.value = shaderParams.celRampHardness;
      terrainMgrRef.current.terrainMaterial.uniforms.uRimLightIntensity.value = shaderParams.rimLightIntensity;
    }

    if (postMaterialRef.current) {
      postMaterialRef.current.uniforms.uFilmGrain.value = shaderParams.filmGrainIntensity;
      postMaterialRef.current.uniforms.uBloom.value = shaderParams.bloomIntensity;
      postMaterialRef.current.uniforms.uColorLift.value = shaderParams.colorLift;
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
