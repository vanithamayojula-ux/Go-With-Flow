import * as THREE from 'three';
import { TerrainManager, setActiveBiome, resetBiomeState, clearBiomeOverride } from './terrain';
import { FoliageManager } from './foliage';
import { SkyManager, LIGHTING_PRESETS } from './sky';
import { PlayerManager } from './player';
import { ObstacleManager } from './obstacles';
import { AudioManager } from './audio';
import { ThemeManager } from './themeManager';
import { WorldManager } from './WorldManager';
import { SkyIslesWorld } from './worlds/skyIsles';
import { VerdantWildsWorld } from './worlds/verdantWilds';
import { CrimsonDunesWorld } from './worlds/crimsonDunes';
import { CrystalHeightsWorld } from './worlds/crystalHeights';
import { ObsidianCoreWorld } from './worlds/obsidianCore';
import { PostProcessShader } from '../graphics/shaders';
import { telemetry } from '../utils/performanceTelemetry';
import { reportGameError } from '../utils/errorMonitoring';
import { ProgressionManager } from './progression';
import { CosmeticManager } from './cosmetics';
import { GameModeManager } from './modes';
import {
  BiomeType,
  CosmeticsConfig,
  GraphicsConfig,
  LightingMode,
  PlayerStats,
  PlayerUpgrades,
  QualityPreset,
  ShaderParams,
  TrickType,
} from '../types';

export interface GameEngineOptions {
  container: HTMLElement;
  graphicsConfig: GraphicsConfig;
  lightingMode: LightingMode;
  shaderParams: ShaderParams;
  cosmeticsConfig: CosmeticsConfig;
  upgrades?: PlayerUpgrades;
  isUpright: boolean;
  audioManager: AudioManager;
  progressionMgr?: ProgressionManager;
  cosmeticMgr?: CosmeticManager;
  gameModeMgr?: GameModeManager;
  onStatsUpdate: (stats: PlayerStats, fps: number, drawCalls: number, instanceCount: number) => void;
  onNotification: (msg: string) => void;
  onGameOver?: () => void;
}

export class GameEngine {
  public container: HTMLElement;
  public renderer: THREE.WebGLRenderer;
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;

  // Render Target & Post-processing
  public renderTarget: THREE.WebGLRenderTarget;
  public postScene: THREE.Scene;
  public postCamera: THREE.OrthographicCamera;
  public postMaterial: THREE.ShaderMaterial;
  public postQuadGeom: THREE.PlaneGeometry;

  // Subsystem Managers
  public audio: AudioManager;
  public skyMgr: SkyManager;
  public terrainMgr: TerrainManager;
  public foliageMgr: FoliageManager;
  public playerMgr: PlayerManager;
  public obstacleMgr: ObstacleManager;
  public themeMgr: ThemeManager;
  public worldMgr: WorldManager;
  public progressionMgr: ProgressionManager;
  public cosmeticMgr: CosmeticManager;
  public gameModeMgr: GameModeManager;
  public skyIslesWorld: SkyIslesWorld | null = null;
  public verdantWildsWorld: VerdantWildsWorld | null = null;
  public crimsonDunesWorld: CrimsonDunesWorld | null = null;
  public crystalHeightsWorld: CrystalHeightsWorld | null = null;
  public obsidianCoreWorld: ObsidianCoreWorld | null = null;

  // Configuration & Settings State
  public graphicsConfig: GraphicsConfig;
  public lightingMode: LightingMode;
  public shaderParams: ShaderParams;
  public cosmeticsConfig: CosmeticsConfig;
  public isUpright: boolean;
  public isPaused: boolean = false;
  public isCinematicCam: boolean = false;

  // Callbacks
  public onStatsUpdate: (stats: PlayerStats, fps: number, drawCalls: number, instanceCount: number) => void;
  public onNotification: (msg: string) => void;
  public onGameOver?: () => void;

  // Input State
  public keys = {
    left: false,
    right: false,
    forward: false,
    jump: false,
    drift: false,
    trickSpin: false,
    trickFlip: false,
    trickGrab: false,
    trickPose: false,
  };

  private touchSwipeState = {
    startX: 0,
    startY: 0,
    startTime: 0,
    active: false,
    swiped: false,
  };
  private lastTapTime = 0;

  // Animation Loop & Diagnostics State
  private animationFrameId: number | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private isDisposed: boolean = false;

  private lastTime: number = performance.now();
  private frameCount: number = 0;
  private fpsAccum: number = 0;
  private currentFps: number = 60;
  private foliageTimer: number = 0;
  private boostGlitchTimer: number = 0;
  private stumbleGlitchTimer: number = 0;
  private screenShakeTimer: number = 0;
  private screenShakeIntensity: number = 0;
  private nearMissSlowMoTimer: number = 0;
  private statsUpdateTimer: number = 0;
  private lastSentGameState: string = 'playing';
  private lastBiome: BiomeType = 'neon-undercity';
  private lastTier: string = 'Chill';
  private lastTransitionState: string = 'STABLE';

  // Event Handler References for clean removal
  private handleKeyDownBound: (e: KeyboardEvent) => void;
  private handleKeyUpBound: (e: KeyboardEvent) => void;
  private handlePointerDownBound: (e: PointerEvent) => void;
  private handlePointerMoveBound: (e: PointerEvent) => void;
  private handlePointerUpBound: () => void;
  private handleVisibilityChangeBound: () => void;

  constructor(options: GameEngineOptions) {
    this.container = options.container;
    this.graphicsConfig = options.graphicsConfig;
    this.lightingMode = options.lightingMode;
    this.shaderParams = options.shaderParams;
    this.cosmeticsConfig = options.cosmeticsConfig;
    this.isUpright = options.isUpright;
    this.audio = options.audioManager;
    this.onStatsUpdate = options.onStatsUpdate;
    this.onNotification = options.onNotification;
    this.onGameOver = options.onGameOver;

    const width = Math.max(this.container.clientWidth || window.innerWidth || 800, 100);
    const height = Math.max(this.container.clientHeight || window.innerHeight || 600, 100);

    // 1. Scene, Camera, Renderer
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, width / height, 0.2, 1200);

    const targetDpr = this.getTargetDpr(this.graphicsConfig.preset);

    this.renderer = new THREE.WebGLRenderer({
      antialias: this.graphicsConfig.preset !== 'webgl-min',
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(targetDpr);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = this.graphicsConfig.enableShadows;
    this.container.appendChild(this.renderer.domElement);

    // 2. Post-processing Render Target & Quad
    this.renderTarget = new THREE.WebGLRenderTarget(width * targetDpr, height * targetDpr, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      samples: this.graphicsConfig.preset === 'desktop-full' ? 4 : 1,
      depthBuffer: true,
    });

    this.postScene = new THREE.Scene();
    this.postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, -1, 1);

    this.postMaterial = new THREE.ShaderMaterial({
      vertexShader: PostProcessShader.vertexShader,
      fragmentShader: PostProcessShader.fragmentShader,
      uniforms: {
        tDiffuse: { value: this.renderTarget.texture },
        uTime: { value: 0 },
        uFilmGrain: { value: this.shaderParams.filmGrainIntensity ?? 0.0 },
        uBloom: { value: this.shaderParams.bloomIntensity ?? 0.35 },
        uColorLift: { value: this.shaderParams.colorLift ?? 0.2 },
        uRainIntensity: { value: this.shaderParams.rainIntensity ?? 0.0 },
        uHighSpeedBlur: { value: 0 },
        uSpeedLines: { value: 0 },
        uHeatShimmer: { value: 0 },
        uChromaticAberration: { value: this.shaderParams.chromaticAberration ?? 0.0005 },
        uScanlines: { value: this.shaderParams.scanlineIntensity ?? 0.0 },
        uGlitch: { value: 0 },
        uWarpIntensity: { value: 0 },
        uResolution: { value: new THREE.Vector2(width * targetDpr, height * targetDpr) },
      },
      depthWrite: false,
      depthTest: false,
    });

    this.postQuadGeom = new THREE.PlaneGeometry(2, 2);
    const quadMesh = new THREE.Mesh(this.postQuadGeom, this.postMaterial);
    quadMesh.frustumCulled = false;
    this.postScene.add(quadMesh);

    // 3. Subsystem Managers Initialization
    this.skyMgr = new SkyManager(this.scene);
    this.skyMgr.applyLightingPreset(this.lightingMode);

    this.terrainMgr = new TerrainManager(this.scene);
    this.foliageMgr = new FoliageManager(this.scene);

    this.playerMgr = new PlayerManager(this.scene, this.cosmeticsConfig);
    this.playerMgr.setUpright(this.isUpright);
    if (options.upgrades) this.playerMgr.applyUpgrades(options.upgrades);
    this.playerMgr.applyCosmetics(this.cosmeticsConfig);

    this.obstacleMgr = new ObstacleManager(this.scene);
    this.themeMgr = new ThemeManager(this.scene);
    this.worldMgr = new WorldManager('sky-isles');
    this.progressionMgr = options.progressionMgr || new ProgressionManager();
    this.cosmeticMgr = options.cosmeticMgr || new CosmeticManager();
    this.gameModeMgr = options.gameModeMgr || new GameModeManager();
    this.gameModeMgr.onRunStart();

    // Hook progression notifications & auto-evaluate cosmetic unlocks
    this.progressionMgr.onLevelUp = (newLevel, rewards) => {
      this.onNotification(`🎉 LEVEL UP! REACHED LEVEL ${newLevel}!`);
      this.audio.playGoalCompleteSound();
      this.cosmeticMgr.evaluateProgressionUnlocks(this.progressionMgr);
    };
    this.progressionMgr.onAchievementUnlocked = ach => {
      this.onNotification(`🏆 ACHIEVEMENT UNLOCKED: ${ach.title.toUpperCase()}!`);
      this.audio.playGoalCompleteSound();
      this.cosmeticMgr.evaluateProgressionUnlocks(this.progressionMgr);
    };

    // Initial check for progression cosmetics
    this.cosmeticMgr.evaluateProgressionUnlocks(this.progressionMgr);

    // Instantiate Sky Isles world environment
    this.skyIslesWorld = new SkyIslesWorld(this.scene, this.graphicsConfig);

    // Populate initial chunks & foliage
    this.terrainMgr.update(this.playerMgr.position.z, this.playerMgr.position.x, 3);
    this.foliageMgr.updateFoliage(
      this.terrainMgr.chunks,
      this.playerMgr.position.z,
      this.playerMgr.position.x,
      this.graphicsConfig.vegetationDensity
    );

    // 4. Input & Resize Observers
    this.handleKeyDownBound = this.onKeyDown.bind(this);
    this.handleKeyUpBound = this.onKeyUp.bind(this);
    this.handlePointerDownBound = this.onPointerDown.bind(this);
    this.handlePointerMoveBound = this.onPointerMove.bind(this);
    this.handlePointerUpBound = this.onPointerUp.bind(this);
    this.handleVisibilityChangeBound = this.onVisibilityChange.bind(this);

    window.addEventListener('keydown', this.handleKeyDownBound);
    window.addEventListener('keyup', this.handleKeyUpBound);
    this.container.addEventListener('pointerdown', this.handlePointerDownBound);
    window.addEventListener('pointermove', this.handlePointerMoveBound);
    window.addEventListener('pointerup', this.handlePointerUpBound);
    document.addEventListener('visibilitychange', this.handleVisibilityChangeBound);

    this.setupResizeObserver();
  }

  private onVisibilityChange(): void {
    // Reset delta-time anchor when tab visibility changes to prevent runaway physics
    this.lastTime = performance.now();
  }

  private getTargetDpr(preset: QualityPreset): number {
    const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;
    switch (preset) {
      case 'desktop-full':
        // Cap at 1.5 to guarantee solid 60 FPS on 1080p/1440p integrated Intel Iris Xe
        return Math.min(dpr, 1.5);
      case 'mobile-opt':
        return Math.min(dpr, 1.2);
      case 'webgl-min':
        return 1.0;
      default:
        return Math.min(dpr, 1.5);
    }
  }

  private setupResizeObserver(): void {
    this.resizeObserver = new ResizeObserver(() => {
      if (this.isDisposed) return;
      const w = this.container.clientWidth || window.innerWidth || 800;
      const h = this.container.clientHeight || window.innerHeight || 600;
      if (w <= 0 || h <= 0) return;

      const aspect = w / h;
      this.camera.aspect = aspect;
      if (aspect < 1.0) {
        this.camera.fov = Math.min(70, Math.max(62, 58 / Math.sqrt(aspect)));
      } else {
        this.camera.fov = 62;
      }
      this.camera.updateProjectionMatrix();

      const pr = this.getTargetDpr(this.graphicsConfig.preset);
      this.renderer.setPixelRatio(pr);
      this.renderer.setSize(w, h);
      this.renderTarget.setSize(w * pr, h * pr);
      if (this.postMaterial.uniforms && this.postMaterial.uniforms.uResolution) {
        this.postMaterial.uniforms.uResolution.value.set(w * pr, h * pr);
      }
    });
    this.resizeObserver.observe(this.container);
  }

  public start(): void {
    this.lastTime = performance.now();
    const animate = (now: number) => {
      if (this.isDisposed) return;
      this.animationFrameId = requestAnimationFrame(animate);
      this.update(now);
      this.render(now);
    };
    this.animationFrameId = requestAnimationFrame(animate);
  }

  private onKeyDown(e: KeyboardEvent): void {
    const code = e.code;
    if (code === 'KeyA' || code === 'ArrowLeft') {
      if (!this.keys.left) this.playerMgr.switchLane(-1, this.audio);
      this.keys.left = true;
    }
    if (code === 'KeyD' || code === 'ArrowRight') {
      if (!this.keys.right) this.playerMgr.switchLane(1, this.audio);
      this.keys.right = true;
    }
    if (code === 'KeyS' || code === 'ArrowDown') {
      this.playerMgr.triggerSlide(this.audio);
      e.preventDefault();
    }
    if (code === 'KeyW' || code === 'ArrowUp') {
      if (!this.keys.jump && this.playerMgr.isGrounded) {
        this.audio.playJump();
        this.keys.jump = true;
      }
      e.preventDefault();
    }
    if (code === 'Space') {
      const now = performance.now();
      if (now - this.lastTapTime < 320) {
        this.playerMgr.activateHoverboardShield(this.audio);
        this.onNotification('🛡️ Hoverboard Shield Deployed!');
      } else {
        this.audio.playJump();
        this.keys.jump = true;
      }
      this.lastTapTime = now;
      e.preventDefault();
    }
    if (code === 'ShiftLeft' || code === 'ShiftRight') {
      this.keys.drift = true;
    }
    if (code === 'Digit1') this.playerMgr.triggerTrick('spin', this.audio);
    if (code === 'Digit2') this.playerMgr.triggerTrick('flip', this.audio);
    if (code === 'Digit3') this.playerMgr.triggerTrick('grab', this.audio);
    if (code === 'Digit4') this.playerMgr.triggerTrick('pose', this.audio);
  }

  private onKeyUp(e: KeyboardEvent): void {
    const code = e.code;
    if (code === 'KeyA' || code === 'ArrowLeft') this.keys.left = false;
    if (code === 'KeyD' || code === 'ArrowRight') this.keys.right = false;
    if (code === 'KeyW' || code === 'ArrowUp' || code === 'Space') this.keys.jump = false;
    if (code === 'ShiftLeft' || code === 'ShiftRight') this.keys.drift = false;
  }

  private onPointerDown(e: PointerEvent): void {
    this.touchSwipeState.active = true;
    this.touchSwipeState.startX = e.clientX;
    this.touchSwipeState.startY = e.clientY;
    this.touchSwipeState.startTime = performance.now();
    this.touchSwipeState.swiped = false;
  }

  private onPointerMove(e: PointerEvent): void {
    if (!this.touchSwipeState.active || this.touchSwipeState.swiped) return;
    const dx = e.clientX - this.touchSwipeState.startX;
    const dy = e.clientY - this.touchSwipeState.startY;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    if (absDx > 24 || absDy > 24) {
      this.touchSwipeState.swiped = true;
      if (absDx > absDy) {
        if (dx < 0) {
          this.playerMgr.switchLane(-1, this.audio);
        } else {
          this.playerMgr.switchLane(1, this.audio);
        }
      } else {
        if (dy < 0) {
          if (this.playerMgr.isGrounded) {
            this.audio.playJump();
            this.keys.jump = true;
            setTimeout(() => { this.keys.jump = false; }, 160);
          }
        } else {
          this.playerMgr.triggerSlide(this.audio);
        }
      }
    }
  }

  private onPointerUp(): void {
    if (this.touchSwipeState.active && !this.touchSwipeState.swiped) {
      const now = performance.now();
      if (now - this.lastTapTime < 320) {
        this.playerMgr.activateHoverboardShield(this.audio);
        this.onNotification('🛡️ Hoverboard Shield Deployed!');
      }
      this.lastTapTime = now;
    }
    this.touchSwipeState.active = false;
    this.touchSwipeState.swiped = false;
    this.keys.left = false;
    this.keys.right = false;
  }

  public update(now: number): void {
    const rawDt = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;
    const timeSeconds = now * 0.001;
    const currentBiome = this.playerMgr.stats.currentBiome;

    // Time Dilation for Near Miss Slow-Motion
    const timeScale = this.nearMissSlowMoTimer > 0 ? 0.42 : 1.0;
    const dt = rawDt * timeScale;
    if (this.nearMissSlowMoTimer > 0) {
      this.nearMissSlowMoTimer -= rawDt;
    }

    // FPS Counter Accumulator & Telemetry
    telemetry.recordFrame(rawDt);
    this.frameCount++;
    this.fpsAccum += rawDt;
    if (this.fpsAccum >= 0.5) {
      this.currentFps = Math.round(this.frameCount / this.fpsAccum);
      this.frameCount = 0;
      this.fpsAccum = 0;
    }

    if (!this.isPaused) {
      // 1. Player Physics & Controls
      this.playerMgr.update(dt, this.keys, timeSeconds, this.terrainMgr, this.audio, this.obstacleMgr);
      this.gameModeMgr.update(dt, this.playerMgr.stats);

      // 2. Obstacles, Collectibles, Collisions
      if (this.playerMgr.gameState === 'playing') {
        this.obstacleMgr.update(this.playerMgr.position.z, timeSeconds, this.playerMgr.stats.speed);

        if (this.playerMgr.activePowerUps.magnetTimer > 0) {
          const magnetRadius = 26.0 + (this.playerMgr.upgrades?.magnetLevel ?? 1) * 4.0;
          this.obstacleMgr.attractCoinsToPlayer(this.playerMgr.position, magnetRadius, dt);
        }

        const collision = this.obstacleMgr.checkCollisions(this.playerMgr.position, this.playerMgr.isSliding);

        // World Portal Warp: transition & rebuild
        if (collision.hitPortal) {
          const target = collision.hitPortal.targetBiome;
          setActiveBiome(target, this.playerMgr.position.z, 450);
          this.playerMgr.triggerPortalWarp(target, this.audio);
          this.themeMgr.triggerPortalWarp(target, this.playerMgr.position);
          this.obstacleMgr.clearAhead(this.playerMgr.position.z, 90);
          this.terrainMgr.rebuildAroundPlayer(this.playerMgr.position.z, this.playerMgr.position.x, 3);
          this.boostGlitchTimer = 0.85;
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
          this.onNotification(`🌀 PORTAL WARP! ENTERING ${bNameMap[target] || this.themeMgr.currentTheme.name.toUpperCase()}!`);
        }

        // Boost Gate Encounter
        if (collision.hitBoostGate) {
          this.playerMgr.applyBoostGateHit(this.audio);
          this.boostGlitchTimer = 0.65;
          this.screenShakeTimer = 0.22;
          this.screenShakeIntensity = 0.35;
          this.onNotification('⚡ BOOST ARCH CHARGED! SONIC ACCELERATION! ⚡');
        }

        // Near-Miss Bonus
        if (collision.nearMiss) {
          this.playerMgr.addCoins(3);
          this.playerMgr.overdriveMeter = Math.min(100, this.playerMgr.overdriveMeter + 10);
          this.playerMgr.stats.nearMissCount = (this.playerMgr.stats.nearMissCount || 0) + 1;
          this.progressionMgr.recordNearMiss();
          this.gameModeMgr.onObstaclePassed('hazard', true);
          this.nearMissSlowMoTimer = 0.22;
          this.screenShakeTimer = 0.16;
          this.screenShakeIntensity = 0.22;
          this.playerMgr.emitNearMissSparks(collision.nearMissPos || this.playerMgr.position);
          this.audio.playNearMissSound();
          this.onNotification('⚡ NEAR MISS! +300 Style Bonus');
        }

        // Rail Grinding
        this.playerMgr.setGrinding(!!collision.isGrinding, this.audio);

        if (collision.collectedCoins > 0) {
          this.playerMgr.addCoins(collision.collectedCoins);
          this.progressionMgr.recordShardCollection(collision.collectedCoins);
          this.gameModeMgr.onCollect(collision.collectedCoins, this.playerMgr.stats);
          this.audio.playDataShardCollect();
          this.onNotification(`+${collision.collectedCoins * 100 * this.playerMgr.scoreMultiplier} Data Shards!`);
        }

        if (collision.collectedPowerUp) {
          this.playerMgr.applyPowerUp(collision.collectedPowerUp, this.audio);
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
          this.onNotification(pNames[collision.collectedPowerUp] || 'Power-Up Collected!');
        }

        // Collisions: Stumble or Crash
        if (collision.hasCrashed || collision.hasStumbled) {
          if (this.playerMgr.activePowerUps.hoverboardShield) {
            this.playerMgr.absorbShieldHit();
            this.audio.playCarveWhoosh();
            this.stumbleGlitchTimer = 0.45;
            this.screenShakeTimer = 0.35;
            this.screenShakeIntensity = 0.55;
            this.onNotification('🛡️ HOLO-SHIELD DEFLECTED IMPACT!');
            if (collision.crashedObstacle) {
              this.obstacleMgr.removeObstacle(collision.crashedObstacle);
            }
          } else if (collision.hasCrashed) {
            this.playerMgr.crash();
            this.progressionMgr.finalizeRun({
              distance: this.playerMgr.stats.distance,
              score: this.playerMgr.stats.score,
              shards: this.playerMgr.stats.dataShardsCollected || this.playerMgr.stats.windOrbsCollected || 0,
              nearMisses: this.playerMgr.stats.nearMissCount || 0,
              stumbles: this.playerMgr.stats.stumbles || 0,
            });
            this.gameModeMgr.onGameOver(this.playerMgr.stats, this.progressionMgr);
            this.audio.playCrashSound();
            this.screenShakeTimer = 0.75;
            this.screenShakeIntensity = 1.05;
            this.onNotification('💥 SYSTEM CRASH! NEURAL DESYNC DETECTED');
            if (this.onGameOver) this.onGameOver();
          } else if (collision.hasStumbled) {
            this.playerMgr.stumble(this.audio);
            this.stumbleGlitchTimer = 0.6;
            this.screenShakeTimer = 0.45;
            this.screenShakeIntensity = 0.65;
            this.onNotification('⚠️ OBSTACLE IMPACT! STUMBLED (-20 OVERDRIVE)');
            if (collision.crashedObstacle) {
              this.obstacleMgr.removeObstacle(collision.crashedObstacle);
            }
          }
        }
      }

      // 3. World Distance Progression & Environmental Transitions
      const playerDistance = Math.max(0, this.playerMgr.position.z);
      const transitionResult = this.worldMgr.updateByDistance(playerDistance);
      const { metrics, blended, shouldNotifyNewWorld, worldToAnnounce } = transitionResult;
      this.playerMgr.stats.currentWorldId = metrics.currentWorldId;

      if (metrics.state === 'TRANSITIONING' && this.lastTransitionState !== 'TRANSITIONING') {
        telemetry.startTransition();
      }
      this.lastTransitionState = metrics.state;

      // Ensure active world(s) instances are preloaded & synced with zero popping
      this.syncActiveWorld(metrics);

      // Announce new world entry cleanly with debouncing
      if (shouldNotifyNewWorld && worldToAnnounce) {
        telemetry.endTransition();
        this.progressionMgr.recordWorldTransition(metrics.currentWorldId, worldToAnnounce.id);
        this.gameModeMgr.onWorldChanged(worldToAnnounce.id, worldToAnnounce.index);
        this.onNotification(`🌟 ENTERING ${worldToAnnounce.name.toUpperCase()} // ${worldToAnnounce.subtitle.toUpperCase()}`);
        this.audio.playBiomeShiftSound(worldToAnnounce.id);
      }

      // Biome & Tier Shifts (Legacy fallback compatibility)
      if (currentBiome !== this.lastBiome) {
        this.lastBiome = currentBiome;
        this.playerMgr.triggerBiomePullBack();
        this.audio.playBiomeShiftSound(currentBiome);
      }

      const currentTier = this.playerMgr.stats.styleTier;
      if (currentTier !== this.lastTier) {
        if (currentTier === 'Transcendent') {
          this.audio.playGoalCompleteSound();
          this.onNotification('⚡ MAX VELOCITY OVERDRIVE! PLASMA TRAIL ACTIVE! ⚡');
        } else if (currentTier === 'Flow') {
          this.onNotification('Overdrive Surge Achieved! +25% Speed Glide');
        }
        this.lastTier = currentTier;
      }

      // Check collectible shards in chunks
      let collectedTotal = 0;
      for (const chunk of this.terrainMgr.chunks.values()) {
        collectedTotal += this.playerMgr.checkOrbCollection(chunk.foliageInstances.orbs);
      }
      if (collectedTotal > 0) {
        this.progressionMgr.recordShardCollection(collectedTotal);
        this.audio.playDataShardCollect();
        this.onNotification(`+${collectedTotal * 200} Data Shards Harvested!`);
      }

      // Update Audio Dynamics
      this.audio.updateSpeed(this.playerMgr.stats.speed, this.playerMgr.stats.maxSpeed, this.playerMgr.stats.isBoosting);

      // Stream Terrain & Foliage
      this.terrainMgr.update(this.playerMgr.position.z, this.playerMgr.position.x, 3, timeSeconds, this.playerMgr.stats.speed);

      this.foliageTimer += dt;
      if (this.foliageTimer > 0.3) {
        this.foliageTimer = 0;
        this.foliageMgr.updateFoliage(
          this.terrainMgr.chunks,
          this.playerMgr.position.z,
          this.playerMgr.position.x,
          this.graphicsConfig.vegetationDensity
        );
      }

      const speedNorm = Math.min(this.playerMgr.stats.speed / 30, 1.5);
      this.foliageMgr.updateShaderTime(timeSeconds, speedNorm, this.camera.position);
      if (this.foliageMgr.grassMaterial.uniforms.uPlayerPos) {
        this.foliageMgr.grassMaterial.uniforms.uPlayerPos.value.copy(this.playerMgr.position);
      }

      // Apply Blended Sky & Atmospheric Lighting smoothly between worlds
      this.skyMgr.applyBlendedLighting(
        blended.skyTop,
        blended.skyBottom,
        blended.fogColor,
        blended.fogDensity,
        blended.ambientColor,
        blended.ambientIntensity,
        blended.sunColor,
        blended.sunIntensity
      );
      this.skyMgr.update(this.playerMgr.position, this.playerMgr.velocity.z, timeSeconds, this.playerMgr.stats.speed);
      if (this.skyMgr.skyMaterial && this.skyMgr.skyMaterial.uniforms.uGridMode) {
        this.skyMgr.skyMaterial.uniforms.uGridMode.value = currentBiome === 'the-grid' ? 1.0 : 0.0;
      }
      this.themeMgr.update(dt, this.skyMgr, this.terrainMgr, this.obstacleMgr, this.playerMgr.position, timeSeconds);

      // Active & Preloaded World Procedural Simulation
      this.updateActiveWorlds(dt, timeSeconds, metrics);
    }
  }

  public render(now: number): void {
    const rawDt = Math.min((now - this.lastTime) / 1000, 0.05);
    const timeSeconds = now * 0.001;
    const currentBiome = this.playerMgr.stats.currentBiome;

    // Screen Shake Decay & Accessibility Suppression
    let screenShakeX = 0;
    let screenShakeY = 0;
    if (this.graphicsConfig.reducedFlash) {
      this.screenShakeTimer = 0;
      this.stumbleGlitchTimer = 0;
    } else {
      if (this.screenShakeTimer > 0) {
        this.screenShakeTimer -= rawDt;
        const shakeMag = this.screenShakeIntensity * Math.min(1.0, this.screenShakeTimer / 0.5);
        screenShakeX = (Math.random() - 0.5) * shakeMag * 0.7;
        screenShakeY = (Math.random() - 0.5) * shakeMag * 0.7;
      } else if (this.stumbleGlitchTimer > 0) {
        screenShakeX = (Math.random() - 0.5) * this.stumbleGlitchTimer * 0.35;
        screenShakeY = (Math.random() - 0.5) * this.stumbleGlitchTimer * 0.35;
      }
    }

    if (this.isCinematicCam) {
      const radius = 8.5;
      const camX = this.playerMgr.position.x + Math.sin(timeSeconds * 0.4) * radius;
      const camZ = this.playerMgr.position.z + Math.cos(timeSeconds * 0.4) * radius;
      this.camera.position.set(camX, this.playerMgr.position.y + 4.5, camZ);
      this.camera.lookAt(this.playerMgr.position.x, this.playerMgr.position.y + 1.5, this.playerMgr.position.z);
    } else {
      const baseFov = 62;
      const targetFov = Math.min(
        70,
        Math.max(62, baseFov + (this.playerMgr.stats.speed / 150) * 6 + (this.playerMgr.stats.isBoosting ? 2 : 0))
      );
      this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, 3.5 * rawDt);
      this.camera.updateProjectionMatrix();

      this.camera.position.copy(this.playerMgr.cameraPos);
      this.camera.position.x += screenShakeX;
      this.camera.position.y += screenShakeY;
      this.camera.up.set(0, 1, 0);
      this.camera.lookAt(this.playerMgr.cameraLookAt);

      if (Math.abs(this.playerMgr.cameraTilt) > 0.0001) {
        this.camera.rotateZ(this.playerMgr.cameraTilt);
      }
    }

    // Terrain Uniforms Camera update
    if (this.terrainMgr.terrainMaterial.uniforms.uCameraPos) {
      this.terrainMgr.terrainMaterial.uniforms.uCameraPos.value.copy(this.camera.position);
    }
    if (this.terrainMgr.terrainMaterial.uniforms.uTime) {
      this.terrainMgr.terrainMaterial.uniforms.uTime.value = timeSeconds;
    }

    // Render Scene passes
    if (this.graphicsConfig.enablePostProcess) {
      const currentSpeed = this.playerMgr.stats.speed;
      let dynamicSpeedLines = 0.0;
      if (currentSpeed > 24) {
        const speedFactor = Math.min(1.0, (currentSpeed - 24) / 45.0);
        dynamicSpeedLines = 0.15 + speedFactor * 0.75;
      }
      if (this.playerMgr.stats.isBoosting) {
        dynamicSpeedLines = Math.max(dynamicSpeedLines, 0.95);
      }
      const effectiveSpeedLines =
        this.shaderParams.speedLineIntensity !== undefined && this.shaderParams.speedLineIntensity > 0
          ? Math.max(this.shaderParams.speedLineIntensity, dynamicSpeedLines)
          : dynamicSpeedLines;
      const heatShimmerFactor = currentBiome === 'orbital-ring' ? 1.0 : 0.0;

      let glitchIntensity = this.shaderParams.glitchIntensity ?? 0.0;
      let chromaticAberration = this.shaderParams.chromaticAberration ?? 0.0005;

      if (this.boostGlitchTimer > 0) {
        this.boostGlitchTimer -= rawDt;
        glitchIntensity = Math.max(glitchIntensity, this.boostGlitchTimer * 0.85);
        chromaticAberration = Math.max(chromaticAberration, this.boostGlitchTimer * 0.008);
      }
      if (this.stumbleGlitchTimer > 0) {
        this.stumbleGlitchTimer -= rawDt;
        glitchIntensity = Math.max(glitchIntensity, this.stumbleGlitchTimer * 0.7);
        chromaticAberration = Math.max(chromaticAberration, this.stumbleGlitchTimer * 0.006);
      }
      if (this.playerMgr.stats.isBoosting || this.playerMgr.boostTimer > 0) {
        chromaticAberration = Math.max(chromaticAberration, 0.0035);
      }
      if (this.playerMgr.stats.combo >= 3) {
        chromaticAberration = Math.max(chromaticAberration, 0.002);
      }
      if (this.playerMgr.gameState === 'game-over') {
        glitchIntensity = 0.85;
        chromaticAberration = 0.008;
      }

      if (this.graphicsConfig.reducedFlash) {
        glitchIntensity = 0;
        chromaticAberration = 0;
        this.screenShakeTimer = 0;
      }

      if (this.postMaterial.uniforms.uTime) this.postMaterial.uniforms.uTime.value = timeSeconds;
      if (this.postMaterial.uniforms.uFilmGrain) this.postMaterial.uniforms.uFilmGrain.value = this.shaderParams.filmGrainIntensity ?? 0.0;
      if (this.postMaterial.uniforms.uColorLift) this.postMaterial.uniforms.uColorLift.value = this.shaderParams.colorLift ?? 0.2;
      if (this.postMaterial.uniforms.uRainIntensity) {
        this.postMaterial.uniforms.uRainIntensity.value = this.shaderParams.rainIntensity ?? 0.0;
      }
      if (this.postMaterial.uniforms.uBloom) this.postMaterial.uniforms.uBloom.value = this.shaderParams.bloomIntensity ?? 0.55;
      if (this.postMaterial.uniforms.uChromaticAberration) this.postMaterial.uniforms.uChromaticAberration.value = chromaticAberration;
      if (this.postMaterial.uniforms.uScanlines) this.postMaterial.uniforms.uScanlines.value = this.shaderParams.scanlineIntensity ?? 0.0;
      if (this.postMaterial.uniforms.uGlitch) this.postMaterial.uniforms.uGlitch.value = glitchIntensity;
      if (this.postMaterial.uniforms.uWarpIntensity) {
        this.postMaterial.uniforms.uWarpIntensity.value = this.playerMgr.warpTimer > 0 ? this.playerMgr.warpTimer * 0.75 : 0.0;
      }
      if (this.postMaterial.uniforms.uSpeedLines) {
        this.postMaterial.uniforms.uSpeedLines.value = effectiveSpeedLines;
      }
      if (this.postMaterial.uniforms.uHeatShimmer) this.postMaterial.uniforms.uHeatShimmer.value = heatShimmerFactor;

      this.renderer.setRenderTarget(this.renderTarget);
      this.renderer.render(this.scene, this.camera);
      const sceneCalls = this.renderer.info.render.calls;

      this.renderer.setRenderTarget(null);
      this.renderer.render(this.postScene, this.postCamera);
      const totalDrawCalls = sceneCalls + this.renderer.info.render.calls;

      const instances = (this.foliageMgr.grassMesh ? this.foliageMgr.grassMesh.count : 0) +
        (this.foliageMgr.treeMesh ? this.foliageMgr.treeMesh.count : 0);

      this.statsUpdateTimer += rawDt;
      const stateChanged = this.playerMgr.gameState !== this.lastSentGameState;
      if (this.statsUpdateTimer >= 0.066 || stateChanged) {
        this.statsUpdateTimer = 0;
        this.lastSentGameState = this.playerMgr.gameState;
        this.onStatsUpdate(this.playerMgr.stats, this.currentFps, totalDrawCalls, instances);
      }
    } else {
      this.renderer.setRenderTarget(null);
      this.renderer.render(this.scene, this.camera);

      this.statsUpdateTimer += rawDt;
      if (this.statsUpdateTimer >= 0.066) {
        this.statsUpdateTimer = 0;
        this.onStatsUpdate(this.playerMgr.stats, this.currentFps, this.renderer.info.render.calls, 0);
      }
    }
  }

  // --- Dynamic Synchronization APIs ---

  public updateGraphicsConfig(config: GraphicsConfig): void {
    const prevPreset = this.graphicsConfig.preset;
    this.graphicsConfig = config;

    // Update DPR dynamically if preset changed
    const targetDpr = this.getTargetDpr(config.preset);
    if (this.renderer.getPixelRatio() !== targetDpr || prevPreset !== config.preset) {
      this.renderer.setPixelRatio(targetDpr);
      const w = Math.max(this.container.clientWidth || window.innerWidth || 800, 100);
      const h = Math.max(this.container.clientHeight || window.innerHeight || 600, 100);
      this.renderTarget.setSize(w * targetDpr, h * targetDpr);
      if (this.postMaterial.uniforms && this.postMaterial.uniforms.uResolution) {
        this.postMaterial.uniforms.uResolution.value.set(w * targetDpr, h * targetDpr);
      }
    }

    if (this.renderer.shadowMap.enabled !== config.enableShadows) {
      this.renderer.shadowMap.enabled = config.enableShadows;
      this.renderer.shadowMap.needsUpdate = true;
      this.skyMgr.setShadowsEnabled(config.enableShadows);
    }
    this.foliageMgr.updateFoliage(
      this.terrainMgr.chunks,
      this.playerMgr.position.z,
      this.playerMgr.position.x,
      config.vegetationDensity
    );
  }

  public updateLightingMode(mode: LightingMode): void {
    this.lightingMode = mode;
    this.skyMgr.applyLightingPreset(mode);
    const preset = LIGHTING_PRESETS[mode];
    if (preset) {
      const u = this.terrainMgr.terrainMaterial.uniforms;
      if (u.uSunColor) u.uSunColor.value.set(preset.sunColor);
      if (u.uSunDirection) u.uSunDirection.value.set(...preset.sunPosition).normalize();
      if (u.uAmbientColor) u.uAmbientColor.value.set(preset.ambientColor);
      if (u.uSlopeWarmColor) u.uSlopeWarmColor.value.set(preset.slopeWarm);
      if (u.uSlopeCoolColor) u.uSlopeCoolColor.value.set(preset.slopeCool);
    }
  }

  public updateShaderParams(params: ShaderParams): void {
    this.shaderParams = params;
    const gUniforms = this.foliageMgr.grassMaterial.uniforms;
    if (gUniforms.uWindSpeed) gUniforms.uWindSpeed.value = params.windSpeed;
    if (gUniforms.uWindStrength) gUniforms.uWindStrength.value = params.windStrength;
    if (gUniforms.uRimLightIntensity) gUniforms.uRimLightIntensity.value = params.rimLightIntensity;

    const treeUniforms = this.foliageMgr.treeMaterial.uniforms;
    if (treeUniforms.uWindSpeed) treeUniforms.uWindSpeed.value = params.windSpeed * 0.7;
    if (treeUniforms.uWindStrength) treeUniforms.uWindStrength.value = params.windStrength * 0.5;
    if (treeUniforms.uRimLightIntensity) treeUniforms.uRimLightIntensity.value = params.rimLightIntensity;

    const tUniforms = this.terrainMgr.terrainMaterial.uniforms;
    if (tUniforms.uCelRampHardness) tUniforms.uCelRampHardness.value = params.celRampHardness;
    if (tUniforms.uRimLightIntensity) tUniforms.uRimLightIntensity.value = params.rimLightIntensity;

    const pUniforms = this.postMaterial.uniforms;
    if (pUniforms.uFilmGrain) pUniforms.uFilmGrain.value = params.filmGrainIntensity;
    if (pUniforms.uBloom) pUniforms.uBloom.value = params.bloomIntensity;
    if (pUniforms.uColorLift) pUniforms.uColorLift.value = params.colorLift;
    if (pUniforms.uChromaticAberration) pUniforms.uChromaticAberration.value = params.chromaticAberration ?? 0.005;
    if (pUniforms.uScanlines) pUniforms.uScanlines.value = params.scanlineIntensity ?? 0.5;
    if (pUniforms.uSpeedLines && params.speedLineIntensity !== undefined) {
      pUniforms.uSpeedLines.value = params.speedLineIntensity;
    }
  }

  private syncActiveWorld(metrics?: { currentWorldId: string; nextWorldId: string; state: string }): void {
    const currentWorld = metrics ? metrics.currentWorldId : this.worldMgr.currentWorldId;
    const nextWorld = metrics ? metrics.nextWorldId : this.worldMgr.nextWorldId;
    const shouldPreloadNext = metrics ? (metrics.state === 'PREPARING' || metrics.state === 'TRANSITIONING') : false;

    // Check which worlds are required without allocating sets or arrays
    const needSkyIsles = currentWorld === 'sky-isles' || (shouldPreloadNext && nextWorld === 'sky-isles');
    const needVerdantWilds = currentWorld === 'verdant-wilds' || (shouldPreloadNext && nextWorld === 'verdant-wilds');
    const needCrimsonDunes = currentWorld === 'crimson-dunes' || (shouldPreloadNext && nextWorld === 'crimson-dunes');
    const needCrystalHeights = currentWorld === 'crystal-heights' || (shouldPreloadNext && nextWorld === 'crystal-heights');
    const needObsidianCore = currentWorld === 'obsidian-core' || (shouldPreloadNext && nextWorld === 'obsidian-core');

    // 1. Dispose worlds that are no longer needed (releasing all GPU/CPU memory)
    if (!needSkyIsles && this.skyIslesWorld) {
      this.skyIslesWorld.dispose();
      this.skyIslesWorld = null;
    }
    if (!needVerdantWilds && this.verdantWildsWorld) {
      this.verdantWildsWorld.dispose();
      this.verdantWildsWorld = null;
    }
    if (!needCrimsonDunes && this.crimsonDunesWorld) {
      this.crimsonDunesWorld.dispose();
      this.crimsonDunesWorld = null;
    }
    if (!needCrystalHeights && this.crystalHeightsWorld) {
      this.crystalHeightsWorld.dispose();
      this.crystalHeightsWorld = null;
    }
    if (!needObsidianCore && this.obsidianCoreWorld) {
      this.obsidianCoreWorld.dispose();
      this.obsidianCoreWorld = null;
    }

    // 2. Initialize required worlds smoothly ahead of boundary
    if (needSkyIsles && !this.skyIslesWorld) {
      this.skyIslesWorld = new SkyIslesWorld(this.scene, this.graphicsConfig);
    }
    if (needVerdantWilds && !this.verdantWildsWorld) {
      this.verdantWildsWorld = new VerdantWildsWorld(this.scene, this.graphicsConfig);
    }
    if (needCrimsonDunes && !this.crimsonDunesWorld) {
      this.crimsonDunesWorld = new CrimsonDunesWorld(this.scene, this.graphicsConfig);
    }
    if (needCrystalHeights && !this.crystalHeightsWorld) {
      this.crystalHeightsWorld = new CrystalHeightsWorld(this.scene, this.graphicsConfig);
    }
    if (needObsidianCore && !this.obsidianCoreWorld) {
      this.obsidianCoreWorld = new ObsidianCoreWorld(this.scene, this.graphicsConfig);
    }
  }

  private updateActiveWorlds(
    dt: number,
    timeSeconds: number,
    metrics: { currentWorldId: string; nextWorldId: string; state: string }
  ): void {
    const pZ = this.playerMgr.position.z;

    // Update active primary world
    if (metrics.currentWorldId === 'sky-isles' && this.skyIslesWorld) {
      this.skyIslesWorld.update(pZ, dt, timeSeconds, this.graphicsConfig);
    } else if (metrics.currentWorldId === 'verdant-wilds' && this.verdantWildsWorld) {
      this.verdantWildsWorld.update(pZ, dt, timeSeconds, this.graphicsConfig);
    } else if (metrics.currentWorldId === 'crimson-dunes' && this.crimsonDunesWorld) {
      this.crimsonDunesWorld.update(pZ, dt, timeSeconds, this.graphicsConfig);
    } else if (metrics.currentWorldId === 'crystal-heights' && this.crystalHeightsWorld) {
      this.crystalHeightsWorld.update(pZ, dt, timeSeconds, this.graphicsConfig);
    } else if (metrics.currentWorldId === 'obsidian-core' && this.obsidianCoreWorld) {
      this.obsidianCoreWorld.update(pZ, dt, timeSeconds, this.graphicsConfig);
    }

    // If preloading or transitioning into next world, update next world as well
    if (metrics.state === 'TRANSITIONING' || metrics.state === 'PREPARING') {
      if (metrics.nextWorldId === 'verdant-wilds' && this.verdantWildsWorld) {
        this.verdantWildsWorld.update(pZ, dt, timeSeconds, this.graphicsConfig);
      } else if (metrics.nextWorldId === 'crimson-dunes' && this.crimsonDunesWorld) {
        this.crimsonDunesWorld.update(pZ, dt, timeSeconds, this.graphicsConfig);
      } else if (metrics.nextWorldId === 'crystal-heights' && this.crystalHeightsWorld) {
        this.crystalHeightsWorld.update(pZ, dt, timeSeconds, this.graphicsConfig);
      } else if (metrics.nextWorldId === 'obsidian-core' && this.obsidianCoreWorld) {
        this.obsidianCoreWorld.update(pZ, dt, timeSeconds, this.graphicsConfig);
      }
    }
  }

  public resetRun(): void {
    resetBiomeState();
    this.lastBiome = 'neon-undercity';
    this.worldMgr.setWorld('sky-isles');
    this.playerMgr.resetRun();
    this.obstacleMgr.reset();
    this.terrainMgr.rebuildAroundPlayer(0, 0, 3);
    this.foliageMgr.updateFoliage(this.terrainMgr.chunks, 0, 0, this.graphicsConfig.vegetationDensity);

    if (this.obsidianCoreWorld) {
      this.obsidianCoreWorld.dispose();
      this.obsidianCoreWorld = null;
    }
    if (this.crystalHeightsWorld) {
      this.crystalHeightsWorld.dispose();
      this.crystalHeightsWorld = null;
    }
    if (this.crimsonDunesWorld) {
      this.crimsonDunesWorld.dispose();
      this.crimsonDunesWorld = null;
    }
    if (this.verdantWildsWorld) {
      this.verdantWildsWorld.dispose();
      this.verdantWildsWorld = null;
    }
    if (this.skyIslesWorld) {
      this.skyIslesWorld.dispose();
      this.skyIslesWorld = null;
    }
    this.skyIslesWorld = new SkyIslesWorld(this.scene, this.graphicsConfig);
    this.gameModeMgr.onRunStart();
  }

  public revivePlayer(): void {
    if (!this.gameModeMgr.isReviveAllowed()) {
      this.onNotification('⚠️ REVIVES ARE DISABLED IN THIS GAME MODE!');
      return;
    }
    this.playerMgr.revive(this.audio);
    this.gameModeMgr.onRevive();
    this.obstacleMgr.clearAhead(this.playerMgr.position.z, 30);
    this.onNotification('✨ Neural Link Restored! Resuming Flight!');
  }

  public deployShield(): void {
    this.playerMgr.activateHoverboardShield(this.audio);
    this.onNotification('🛡️ Hoverboard Shield Deployed!');
  }

  public triggerTrick(trick: TrickType): void {
    this.progressionMgr.recordTrick();
    this.playerMgr.triggerTrick(trick, this.audio);
  }

  public dispose(): void {
    if (this.isDisposed) return;
    this.isDisposed = true;

    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    window.removeEventListener('keydown', this.handleKeyDownBound);
    window.removeEventListener('keyup', this.handleKeyUpBound);
    this.container.removeEventListener('pointerdown', this.handlePointerDownBound);
    window.removeEventListener('pointermove', this.handlePointerMoveBound);
    window.removeEventListener('pointerup', this.handlePointerUpBound);
    document.removeEventListener('visibilitychange', this.handleVisibilityChangeBound);

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    this.terrainMgr.dispose();
    this.foliageMgr.dispose();
    this.skyMgr.dispose();
    this.playerMgr.dispose();
    this.obstacleMgr.dispose();
    this.themeMgr.dispose();
    this.worldMgr.dispose();
    if (this.skyIslesWorld) {
      this.skyIslesWorld.dispose();
      this.skyIslesWorld = null;
    }
    if (this.verdantWildsWorld) {
      this.verdantWildsWorld.dispose();
      this.verdantWildsWorld = null;
    }
    if (this.crimsonDunesWorld) {
      this.crimsonDunesWorld.dispose();
      this.crimsonDunesWorld = null;
    }
    if (this.crystalHeightsWorld) {
      this.crystalHeightsWorld.dispose();
      this.crystalHeightsWorld = null;
    }
    if (this.obsidianCoreWorld) {
      this.obsidianCoreWorld.dispose();
      this.obsidianCoreWorld = null;
    }

    this.renderTarget.dispose();
    this.postMaterial.dispose();
    this.postQuadGeom.dispose();
    this.renderer.dispose();

    if (this.renderer.domElement && this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
    }
  }
}
