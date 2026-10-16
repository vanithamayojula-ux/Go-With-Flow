import * as THREE from 'three';
import { TerrainManager, getBiomeAt, resetBiomeState, clearBiomeOverride } from './terrain';
import { FoliageManager } from './foliage';
import { SkyManager } from './sky';
import { PlayerManager } from './player';
import { ObstacleManager } from './obstacles';
import { AudioManager } from './audio';
import { ThemeManager } from './themeManager';
import { WorldManager } from './WorldManager';
import { WorldId } from './WorldConfig';
import { getWorldConfig } from './worlds';
import { PortalSystem } from './portal/PortalSystem';
import { SkyIslesWorld } from './worlds/skyIsles';
import { VerdantWildsWorld } from './worlds/verdantWilds';
import { CrimsonDunesWorld } from './worlds/crimsonDunes';
import { CrystalHeightsWorld } from './worlds/crystalHeights';
import { ObsidianCoreWorld } from './worlds/obsidianCore';
import { PostPipeline } from './engine/PostPipeline';
import { WorldConstructor, WorldStreamer } from './engine/WorldStreamer';
import { ShaderWarmup } from './engine/ShaderWarmup';
import { StartupWarmup } from './engine/StartupWarmup';
import { AdaptiveQuality, GpuTimer } from './perf/AdaptiveQuality';
import { liveStats } from '../state/liveStats';
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
  /**
   * Optional: live stats are published to the `liveStats` store
   * (src/state/liveStats.ts), which is what the HUD subscribes to.
   */
  onStatsUpdate?: (stats: PlayerStats, fps: number, drawCalls: number, instanceCount: number) => void;
  onNotification: (msg: string) => void;
  onGameOver?: () => void;
  /** Called when the engine wants the UI to show the pause menu (tab hidden / window blur). */
  onRequestPause?: () => void;
}

// Two Space presses (or screen taps) closer than this deploy the shield.
const DOUBLE_TAP_MS = 320;
// While the jetpack cruises above the track, coins in this radius fly up to it.
const JETPACK_COIN_PULL_RADIUS = 14.0;
const BASE_FOV = 62;
// Adaptive quality ignores the first seconds of a run (asset uploads, compiles).
const ADAPTIVE_SETTLE_MS = 2500;
// Motion blur only kicks in once the speed lines are strong (~45 m/s or boosting).
const MOTION_BLUR_THRESHOLD = 0.3;

const WORLD_CONSTRUCTORS: Record<WorldId, WorldConstructor> = {
  'sky-isles': SkyIslesWorld as unknown as WorldConstructor,
  'verdant-wilds': VerdantWildsWorld as unknown as WorldConstructor,
  'crimson-dunes': CrimsonDunesWorld as unknown as WorldConstructor,
  'crystal-heights': CrystalHeightsWorld as unknown as WorldConstructor,
  'obsidian-core': ObsidianCoreWorld as unknown as WorldConstructor,
};

const POWER_UP_LABELS: Record<string, 'magnet' | 'jetpack' | 'multiplier' | 'shield'> = {
  'quantum-magnet': 'magnet',
  'magnet': 'magnet',
  'sonic-jetpack': 'jetpack',
  'jetpack': 'jetpack',
  'overdrive-2x': 'multiplier',
  'multiplier2x': 'multiplier',
  'holo-shield': 'shield',
  'hoverboard-shield': 'shield',
};

function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || typeof el.tagName !== 'string') return false;
  const tag = el.tagName.toUpperCase();
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable === true;
}

/** MSAA on the HDR scene target only on the top tier (each resolve costs bandwidth). */
function msaaForPreset(preset: QualityPreset): boolean {
  return preset === 'desktop-full';
}

export class GameEngine {
  public container: HTMLElement;
  public renderer: THREE.WebGLRenderer;
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;

  // Post-processing (scene HDR target, quarter-res bloom, final pass)
  public post: PostPipeline;

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
  /** Campaign world instances (current + the next one while approaching its gateway). */
  public worlds: WorldStreamer;
  /** Async shader compiles (main + shadow-depth programs) for new content. */
  public shaders: ShaderWarmup;
  /** World-change portal gateways (one per world boundary) and their window pass. */
  public portals: PortalSystem;
  // Extra objects hidden in the portal window pass (reused array).
  private portalHidden: THREE.Object3D[] = [];

  // Adaptive render scale / quality
  public adaptive: AdaptiveQuality;
  private gpuTimer: GpuTimer;
  private adaptiveHoldUntil = 0;
  private drawingBufferSize = new THREE.Vector2();

  // Configuration & Settings State
  public graphicsConfig: GraphicsConfig;
  public lightingMode: LightingMode;
  public shaderParams: ShaderParams;
  public cosmeticsConfig: CosmeticsConfig;
  public isUpright: boolean;
  public isCinematicCam: boolean = false;
  // Field of view before the per-frame speed widening; wider in portrait.
  public baseFov: number = BASE_FOV;
  private _isPaused: boolean = false;
  // While paused one frame is rendered (so the menu has a backdrop and
  // settings changes show), then rendering stops until resumed.
  private pausedFrameRendered = false;

  /**
   * Pausing (or resuming) re-anchors the frame clock so the next delta is not
   * the whole pause, and drops held/buffered input so nothing fires on resume.
   */
  public get isPaused(): boolean {
    return this._isPaused;
  }
  public set isPaused(value: boolean) {
    if (value === this._isPaused) return;
    this._isPaused = value;
    this.lastTime = performance.now();
    this.pausedFrameRendered = false;
    this.releaseAllInput();
    if (this.adaptive) {
      this.adaptive.resetTimers();
      this.adaptiveHoldUntil = performance.now() + 1000;
    }
  }

  /** The HDR scene render target (kept for callers of the old field). */
  public get renderTarget(): THREE.WebGLRenderTarget {
    return this.post.sceneTarget;
  }

  public get postMaterial(): THREE.ShaderMaterial {
    return this.post.postMaterial;
  }

  // Callbacks
  public onStatsUpdate?: (stats: PlayerStats, fps: number, drawCalls: number, instanceCount: number) => void;
  public onNotification: (msg: string) => void;
  public onGameOver?: () => void;
  public onRequestPause?: () => void;

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
  private lastRafTime = -1;
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
  private lastFrameDt: number = 0;
  private lastSentGameState: string = 'playing';
  private lastBiome: BiomeType = getBiomeAt(0);
  private lastTier: string = 'Chill';
  private lastTransitionState: string = 'STABLE';
  private lastDrawCalls = 0;
  private lastHeroRig: unknown = null;
  // Before the first run: every world/gateway's shaders compiled and drawn
  // once while the rider waits at the start line (see StartupWarmup).
  private startup: StartupWarmup | null = null;
  private startupLabel: HTMLDivElement | null = null;
  private templatesCompiled = false;
  private orbsCollectedThisFrame = 0;
  private readonly collectChunkOrbs = (chunk: { foliageInstances: { orbs: any[] } }) => {
    this.orbsCollectedThisFrame += this.playerMgr.checkOrbCollection(chunk.foliageInstances.orbs);
  };

  // Event Handler References for clean removal
  private handleKeyDownBound: (e: KeyboardEvent) => void;
  private handleKeyUpBound: (e: KeyboardEvent) => void;
  private handlePointerDownBound: (e: PointerEvent) => void;
  private handlePointerMoveBound: (e: PointerEvent) => void;
  private handlePointerUpBound: () => void;
  private handleVisibilityChangeBound: () => void;
  private handleWindowBlurBound: () => void;

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
    this.onRequestPause = options.onRequestPause;

    const width = Math.max(this.container.clientWidth || window.innerWidth || 800, 100);
    const height = Math.max(this.container.clientHeight || window.innerHeight || 600, 100);

    // 1. Scene, Camera, Renderer
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, width / height, 0.2, 1200);

    const preset = this.graphicsConfig.preset;
    this.adaptive = new AdaptiveQuality({
      maxPixelRatio: this.getTargetDpr(preset),
      msaa: msaaForPreset(preset) && this.graphicsConfig.enablePostProcess,
      targetFps: this.graphicsConfig.targetFPS || 60,
    });
    const targetDpr = this.adaptive.level.pixelRatio;

    // With post-processing on, the canvas only receives the final full-screen
    // pass: a multisampled backbuffer would be pure waste (MSAA, when wanted,
    // lives on the HDR scene target instead).
    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.graphicsConfig.enablePostProcess && preset !== 'webgl-min',
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(targetDpr);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = this.graphicsConfig.enableShadows;
    // PCFSoftShadowMap is deprecated/removed in three r18x; PCF is the supported soft-ish filter.
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.container.appendChild(this.renderer.domElement);
    this.gpuTimer = new GpuTimer(this.renderer.getContext());

    // 2. Post-processing: linear HDR target; tone mapping + sRGB encoding
    // happen in the final pass.
    this.renderer.getDrawingBufferSize(this.drawingBufferSize);
    this.post = new PostPipeline(
      this.renderer,
      this.drawingBufferSize.x,
      this.drawingBufferSize.y,
      this.adaptive.level.msaa ? 4 : 0,
      {
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
        uResolution: { value: new THREE.Vector2(this.drawingBufferSize.x, this.drawingBufferSize.y) },
      }
    );
    this.post.postMaterial.uniforms.uBlurThreshold.value = MOTION_BLUR_THRESHOLD;

    // 3. Subsystem Managers Initialization
    this.skyMgr = new SkyManager(this.scene, this.renderer);
    this.skyMgr.applyLightingPreset(this.lightingMode);
    this.skyMgr.setShadowMapSize(preset === 'desktop-full' ? 2048 : 1024);
    this.skyMgr.setShadowsEnabled(this.graphicsConfig.enableShadows);

    this.terrainMgr = new TerrainManager(this.scene);
    this.foliageMgr = new FoliageManager(this.scene);

    this.playerMgr = new PlayerManager(this.scene, this.cosmeticsConfig);
    this.playerMgr.setUpright(this.isUpright);
    if (options.upgrades) this.playerMgr.applyUpgrades(options.upgrades);
    this.playerMgr.applyCosmetics(this.cosmeticsConfig);
    this.applyViewportFraming(width, height);

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

    this.shaders = new ShaderWarmup(this.renderer, this.camera, this.scene, () =>
      this.graphicsConfig.enablePostProcess ? this.post.sceneTarget : null
    );

    // Campaign worlds: Sky Isles now; each next world is built ahead of its
    // gateway (its reflection environment is baked once, in its own frame,
    // and its shaders compile in the background before it is ever drawn).
    this.worlds = new WorldStreamer(this.scene, this.renderer, this.camera, WORLD_CONSTRUCTORS, {
      onPreloadStart: id => this.skyMgr.prebakeEnvironment(id),
      compile: roots => this.shaders.compile(roots),
      needsCompile: object => this.shaders.needsCompile(object),
      warmDraw: (roots, filter) => {
        const ms = this.shaders.warmDraw(roots, filter);
        if (ms > 50 && typeof window !== 'undefined' && (window as any).__gameEngine === this) {
          console.info(`[GameEngine] warm draw ${Math.round(ms)} ms`);
        }
      },
      isBusy: () => this.shaders.busy,
    });
    this.worlds.reset('sky-isles', this.graphicsConfig);

    // Portal gateways: built alongside the next world, compiled and uploaded
    // before they can be seen; each frame the view through the one ahead is
    // rendered with the destination world's atmosphere (see renderPortalWindow).
    this.portals = new PortalSystem({
      scene: this.scene,
      renderer: this.renderer,
      sky: this.skyMgr,
      compile: roots => this.shaders.compile(roots),
      warmDraw: roots => {
        this.shaders.warmDraw(roots, () => true);
      },
      currentWorldRoots: () => this.worlds.getCurrentRoots(),
      isBusy: () => this.shaders.busy,
    });
    this.portalHidden = [this.playerMgr.group];

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
    this.handleWindowBlurBound = this.onWindowBlur.bind(this);

    window.addEventListener('keydown', this.handleKeyDownBound);
    window.addEventListener('keyup', this.handleKeyUpBound);
    this.container.addEventListener('pointerdown', this.handlePointerDownBound);
    window.addEventListener('pointermove', this.handlePointerMoveBound);
    window.addEventListener('pointerup', this.handlePointerUpBound);
    document.addEventListener('visibilitychange', this.handleVisibilityChangeBound);
    window.addEventListener('blur', this.handleWindowBlurBound);

    this.setupResizeObserver();
    this.applyPostTier();
    this.adaptiveHoldUntil = performance.now() + ADAPTIVE_SETTLE_MS;
  }

  /**
   * Compile every shader the opening seconds need before the first frame: the
   * post passes, the initial scene, and (once loaded) the obstacle models.
   */
  private prewarm(): void {
    try {
      // Every world's reflection environment, baked once now (part of the
      // start-up stall) instead of mid-run ahead of each gateway.
      this.skyMgr.prebakeAllEnvironments();
      this.post.compile();
      this.camera.position.copy(this.playerMgr.cameraPos);
      this.camera.lookAt(this.playerMgr.cameraLookAt);
      this.camera.updateMatrixWorld();
      // Whole scene: main-pass programs plus the shadow-depth variants of
      // every caster (those otherwise compile on first shadow draw).
      this.shaders.compile([this.scene]);
      // ...and one off-screen draw of everything, hidden things included
      // (portal warp rings, spare boards/helmets, shield): some programs only
      // finish compiling on their first real draw, which would otherwise land
      // mid-run (e.g. at the first portal).
      this.shaders.warmDraw([this.scene], () => true);
    } catch (err) {
      console.warn('[GameEngine] shader prewarm failed:', err);
    }
    this.adaptiveHoldUntil = performance.now() + ADAPTIVE_SETTLE_MS;
  }

  /** True while the start-up warm-up holds the rider at the start line. */
  public get warmingUp(): boolean {
    return this.startup !== null;
  }

  private beginStartupWarmup(): void {
    if (this.startup || this.isDisposed) return;
    this.startup = new StartupWarmup({
      worlds: this.worlds,
      portals: this.portals,
      shaders: this.shaders,
      obstacles: this.obstacleMgr,
      graphicsConfig: () => this.graphicsConfig,
    });
    if (typeof document !== 'undefined') {
      const label = document.createElement('div');
      label.textContent = 'Preparing worlds…';
      label.setAttribute('role', 'status');
      label.style.cssText =
        'position:absolute;left:50%;bottom:18%;transform:translateX(-50%);padding:6px 14px;border-radius:999px;' +
        'background:rgba(8,12,24,0.55);color:#e8f0ff;font:500 13px/1.2 system-ui,sans-serif;letter-spacing:0.04em;' +
        'pointer-events:none;z-index:5;';
      this.container.appendChild(label);
      this.startupLabel = label;
    }
  }

  private stepStartupWarmup(): void {
    const s = this.startup;
    if (!s) return;
    if (!s.step()) return;
    this.endStartupWarmup();
    if (typeof window !== 'undefined' && (window as any).__gameEngine === this) {
      console.info(`[GameEngine] start-up warm-up ${Math.round(performance.now() - s.startedAt)} ms, ${this.renderer.info.programs?.length ?? 0} programs`);
    }
    // The run starts now: no frame delta from the warm-up, and the adaptive
    // quality ignores the warm-up frames.
    this.lastTime = performance.now();
    this.adaptive.resetTimers();
    this.adaptiveHoldUntil = performance.now() + ADAPTIVE_SETTLE_MS;
  }

  private endStartupWarmup(): void {
    if (this.startup && !this.startup.done) this.startup.cancel();
    this.startup = null;
    if (this.startupLabel) {
      this.startupLabel.remove();
      this.startupLabel = null;
    }
  }

  /** Re-render one frame while paused (resize, settings change). */
  public requestRender(): void {
    this.pausedFrameRendered = false;
  }

  private onVisibilityChange(): void {
    // Reset delta-time anchor when tab visibility changes to prevent runaway physics
    this.lastTime = performance.now();
    if (typeof document !== 'undefined' && document.hidden) this.autoPause();
  }

  private onWindowBlur(): void {
    this.autoPause();
  }

  /** Tab hidden / window lost focus mid-run: freeze and ask the UI to show the pause menu. */
  private autoPause(): void {
    if (this.isDisposed || !this.onRequestPause) return;
    if (this.playerMgr.gameState !== 'playing') return;
    this.isPaused = true;
    this.onRequestPause();
  }

  private canAcceptGameplayInput(): boolean {
    return !this.isDisposed && !this._isPaused && !this.startup && this.playerMgr.gameState === 'playing';
  }

  private releaseAllInput(): void {
    this.keys.left = false;
    this.keys.right = false;
    this.keys.forward = false;
    this.keys.jump = false;
    this.keys.drift = false;
    this.keys.trickSpin = false;
    this.keys.trickFlip = false;
    this.keys.trickGrab = false;
    this.keys.trickPose = false;
    this.touchSwipeState.active = false;
    this.touchSwipeState.swiped = false;
    this.lastTapTime = 0;
    if (this.playerMgr) this.playerMgr.clearInputBuffers();
  }

  /** Portrait screens get a wider base FOV and a camera pulled back/up. */
  private applyViewportFraming(w: number, h: number): void {
    const aspect = w / h;
    this.camera.aspect = aspect;
    if (aspect < 1.0) {
      this.baseFov = Math.min(70, Math.max(BASE_FOV, 58 / Math.sqrt(aspect)));
      this.playerMgr.portraitCamOffset.set(0, 0.3, 1.5);
    } else {
      this.baseFov = BASE_FOV;
      this.playerMgr.portraitCamOffset.set(0, 0, 0);
    }
    this.camera.fov = this.baseFov;
    this.camera.updateProjectionMatrix();
  }

  /**
   * Shared by the double-tap and the HUD shield button. Returns true when a
   * shield was deployed; on cooldown it tells the player how long is left.
   */
  private tryDeployShield(): boolean {
    const result = this.playerMgr.tryDeployShield(this.audio);
    if (result === 'deployed') {
      this.onNotification('🛡️ Hoverboard Shield Deployed!');
      return true;
    }
    if (result === 'cooldown') {
      this.onNotification(`🛡️ Shield recharging (${Math.ceil(this.playerMgr.shieldCooldown)}s)`);
    }
    return false;
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

      this.applyViewportFraming(w, h);
      this.renderer.setPixelRatio(this.canvasPixelRatio());
      this.renderer.setSize(w, h);
      this.resizeRenderTargets();
      // A resize while paused still shows one correct frame.
      this.pausedFrameRendered = false;
    });
    this.resizeObserver.observe(this.container);
  }

  /** Match the post targets to the canvas drawing buffer (never the CSS size). */
  private resizeRenderTargets(): void {
    this.renderer.getDrawingBufferSize(this.drawingBufferSize);
    // With post-processing the scene renders into its own target: the
    // adaptive render scale applies there (the final pass upscales).
    if (this.graphicsConfig.enablePostProcess) {
      const s = Math.min(1, this.adaptive.level.pixelRatio / Math.max(1e-3, this.renderer.getPixelRatio()));
      this.drawingBufferSize.set(Math.max(1, Math.round(this.drawingBufferSize.x * s)), Math.max(1, Math.round(this.drawingBufferSize.y * s)));
    }
    this.post.setSize(this.drawingBufferSize.x, this.drawingBufferSize.y);
  }

  /**
   * Canvas pixel ratio. With post-processing on it stays at the ladder's top
   * level and adaptive steps only resize the offscreen targets: resizing the
   * canvas drawing buffer is synchronous in Chrome/Edge and waits for the GPU
   * to drain (a 600 ms hitch measured on an integrated GPU on battery).
   */
  private canvasPixelRatio(): number {
    return this.graphicsConfig.enablePostProcess ? this.adaptive.maxPixelRatio : this.adaptive.level.pixelRatio;
  }

  /** Apply the adaptive quality level: render scale, MSAA, bloom/motion blur tier. */
  private applyQualityLevel(): void {
    const level = this.adaptive.level;
    const pr = this.canvasPixelRatio();
    if (this.renderer.getPixelRatio() !== pr) {
      // setPixelRatio resizes only the drawing buffer; the canvas CSS size is untouched.
      this.renderer.setPixelRatio(pr);
    }
    this.resizeRenderTargets();
    this.post.setSamples(level.msaa ? 4 : 0);
    this.applyPostTier();
    this.pausedFrameRendered = false;
  }

  /** Per-tier post settings that don't change per frame. */
  private applyPostTier(): void {
    const u = this.post.postMaterial.uniforms;
    u.uMotionBlur.value = this.adaptive.level.motionBlur && this.graphicsConfig.preset !== 'webgl-min' ? 1 : 0;
  }

  /** (Re)build the adaptive ladder for the current preset and apply its top level. */
  private configureAdaptive(): void {
    const preset = this.graphicsConfig.preset;
    this.adaptive.configure({
      maxPixelRatio: this.getTargetDpr(preset),
      msaa: msaaForPreset(preset) && this.graphicsConfig.enablePostProcess,
      targetFps: this.graphicsConfig.targetFPS || 60,
    });
    this.adaptiveHoldUntil = performance.now() + ADAPTIVE_SETTLE_MS;
    this.applyQualityLevel();
  }

  /**
   * Compile an object's materials against the live scene (lights, fog,
   * environment) for the target it will actually be drawn into.
   */
  private compileObject(object: THREE.Object3D): Promise<unknown> {
    return this.shaders.compile([object]);
  }

  public start(): void {
    this.lastTime = performance.now();
    let first = true;
    const animate = (now: number) => {
      if (this.isDisposed) return;
      if (first) {
        // Compile on the first frame, not in the constructor: a StrictMode
        // double mount disposes the first engine before it ever runs.
        first = false;
        this.prewarm();
        this.beginStartupWarmup();
      }
      this.animationFrameId = requestAnimationFrame(animate);
      const rafDelta = this.lastRafTime >= 0 ? now - this.lastRafTime : 0;
      this.lastRafTime = now;
      if (this._isPaused) {
        // Paused: one frame for the menu backdrop / settings preview, then
        // nothing until resumed (the UI stays responsive, the GPU idles).
        if (this.pausedFrameRendered) {
          this.lastTime = now;
          return;
        }
        this.pausedFrameRendered = true;
      }
      const t0 = performance.now();
      this.update(now);
      this.render(now);
      this.sampleAdaptive(rafDelta, performance.now() - t0, now);
    };
    this.animationFrameId = requestAnimationFrame(animate);
  }

  private sampleAdaptive(frameMs: number, workMs: number, now: number): void {
    // Reading the timer is a synchronous GL query: it would wait for any
    // shader still linking in the background.
    const gpuMs = this.shaders.busy ? -1 : this.gpuTimer.poll();
    if (gpuMs >= 0) this.adaptive.reportGpuTime(gpuMs);
    if (this._isPaused || this.playerMgr.gameState !== 'playing' || now < this.adaptiveHoldUntil) return;
    if (this.adaptive.sample(frameMs, workMs, now)) {
      this.applyQualityLevel();
    }
  }

  private onKeyDown(e: KeyboardEvent): void {
    // Gameplay input only while a run is live: not paused, not behind the
    // game-over screen, and never while the player is typing in a form field.
    if (!this.canAcceptGameplayInput() || isTypingTarget(e.target)) return;
    const code = e.code;
    if (code === 'Space' || code === 'ArrowUp' || code === 'ArrowDown' || code === 'ArrowLeft' || code === 'ArrowRight') {
      e.preventDefault();
    }
    // OS key auto-repeat must not re-trigger lanes, jumps, slides, the shield
    // or tricks: every action needs a fresh press.
    if (e.repeat) return;

    if (code === 'KeyA' || code === 'ArrowLeft') {
      if (!this.keys.left) this.playerMgr.switchLane(-1, this.audio);
      this.keys.left = true;
    }
    if (code === 'KeyD' || code === 'ArrowRight') {
      if (!this.keys.right) this.playerMgr.switchLane(1, this.audio);
      this.keys.right = true;
    }
    if (code === 'KeyS' || code === 'ArrowDown') {
      this.playerMgr.requestSlide();
    }
    if (code === 'KeyW' || code === 'ArrowUp') {
      this.playerMgr.requestJump();
    }
    if (code === 'Space') {
      // Double-tap = shield (when charged); otherwise every tap is a buffered jump.
      const now = performance.now();
      if (now - this.lastTapTime < DOUBLE_TAP_MS && this.tryDeployShield()) {
        this.lastTapTime = 0;
      } else {
        this.playerMgr.requestJump();
        this.lastTapTime = now;
      }
    }
    if (code === 'ShiftLeft' || code === 'ShiftRight') {
      this.keys.drift = true;
    }
    // Tricks: J/K/L/I (shown in the HUD stunt rig) or 1-4.
    if (code === 'KeyJ' || code === 'Digit1') this.triggerTrick('spin');
    if (code === 'KeyK' || code === 'Digit2') this.triggerTrick('flip');
    if (code === 'KeyL' || code === 'Digit3') this.triggerTrick('grab');
    if (code === 'KeyI' || code === 'Digit4') this.triggerTrick('pose');
  }

  private onKeyUp(e: KeyboardEvent): void {
    // Releases are always honoured so no key stays "held" across a pause.
    const code = e.code;
    if (code === 'KeyA' || code === 'ArrowLeft') this.keys.left = false;
    if (code === 'KeyD' || code === 'ArrowRight') this.keys.right = false;
    if (code === 'KeyW' || code === 'ArrowUp' || code === 'Space') this.keys.jump = false;
    if (code === 'ShiftLeft' || code === 'ShiftRight') this.keys.drift = false;
  }

  private onPointerDown(e: PointerEvent): void {
    if (!this.canAcceptGameplayInput()) return;
    this.touchSwipeState.active = true;
    this.touchSwipeState.startX = e.clientX;
    this.touchSwipeState.startY = e.clientY;
    this.touchSwipeState.startTime = performance.now();
    this.touchSwipeState.swiped = false;
  }

  private onPointerMove(e: PointerEvent): void {
    if (!this.touchSwipeState.active || this.touchSwipeState.swiped) return;
    if (!this.canAcceptGameplayInput()) return;
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
          this.playerMgr.requestJump();
        } else {
          this.playerMgr.requestSlide();
        }
      }
    }
  }

  private onPointerUp(): void {
    if (this.touchSwipeState.active && !this.touchSwipeState.swiped && this.canAcceptGameplayInput()) {
      const now = performance.now();
      if (now - this.lastTapTime < DOUBLE_TAP_MS && this.tryDeployShield()) {
        this.lastTapTime = 0;
      } else {
        this.lastTapTime = now;
      }
    }
    this.touchSwipeState.active = false;
    this.touchSwipeState.swiped = false;
    this.keys.left = false;
    this.keys.right = false;
  }

  public update(now: number): void {
    // rAF timestamps can be older than a performance.now() anchor taken at
    // start/resume, so the raw delta may be negative: clamp to [0, 0.05].
    const elapsed = (now - this.lastTime) / 1000;
    this.lastTime = now;
    const realElapsed = Number.isFinite(elapsed) ? Math.max(0, elapsed) : 0;
    const rawDt = Math.min(realElapsed, 0.05);
    this.lastFrameDt = rawDt;
    const timeSeconds = now * 0.001;
    const currentBiome = this.playerMgr.stats.currentBiome;

    // Time Dilation for Near Miss Slow-Motion
    const timeScale = this.nearMissSlowMoTimer > 0 ? 0.42 : 1.0;
    // The rider holds at the start line while the start-up warm-up runs.
    const dt = this.startup ? 0 : rawDt * timeScale;
    if (this.nearMissSlowMoTimer > 0) {
      this.nearMissSlowMoTimer -= rawDt;
    }

    // FPS Counter Accumulator & Telemetry
    telemetry.recordFrame(rawDt);
    this.frameCount++;
    // Deferred first draws, at the start of a frame with no shader linking.
    this.shaders.tick();
    // FPS uses real elapsed time; the clamped physics delta counted every slow
    // frame as 50 ms, so hitches never showed below 20 fps.
    this.fpsAccum += realElapsed;
    if (this.fpsAccum >= 0.5) {
      this.currentFps = Math.round(this.frameCount / this.fpsAccum);
      this.frameCount = 0;
      this.fpsAccum = 0;
    }

    if (this.startup && !this.isPaused) this.stepStartupWarmup();

    if (!this.isPaused) {
      // 1. Player Physics & Controls
      this.playerMgr.update(dt, this.keys, timeSeconds, this.terrainMgr, this.audio, this.obstacleMgr);
      this.gameModeMgr.update(dt, this.playerMgr.stats);

      // 2. Obstacles, Collectibles, Collisions
      if (this.playerMgr.gameState === 'playing') {
        this.obstacleMgr.update(this.playerMgr.position.z, timeSeconds, this.playerMgr.stats.speed);

        // Jetpack flight cruises above the track: ground hazards can't touch it
        // and coins below are pulled up to the board instead.
        const jetpacking = this.playerMgr.isJetpacking;
        if (this.playerMgr.activePowerUps.magnetTimer > 0) {
          const magnetRadius = 26.0 + (this.playerMgr.upgrades?.magnetLevel ?? 1) * 4.0;
          this.obstacleMgr.attractCoinsToPlayer(this.playerMgr.position, magnetRadius, dt);
        } else if (jetpacking) {
          this.obstacleMgr.attractCoinsToPlayer(this.playerMgr.position, JETPACK_COIN_PULL_RADIUS, dt);
        }

        const collision = this.obstacleMgr.checkCollisions(this.playerMgr.position, this.playerMgr.isSliding);

        // Boost Gate Encounter
        if (collision.hitBoostGate) {
          this.playerMgr.applyBoostGateHit(this.audio);
          this.boostGlitchTimer = 0.65;
          this.screenShakeTimer = 0.22;
          this.screenShakeIntensity = 0.35;
          this.onNotification('⚡ BOOST ARCH CHARGED! SONIC ACCELERATION! ⚡');
        }

        // Near-Miss Bonus
        if (collision.nearMiss && !jetpacking) {
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
          this.onNotification('⚡ NEAR MISS! +3 Data Shards');
        }

        // Rail Grinding
        this.playerMgr.setGrinding(!jetpacking && !!collision.isGrinding, this.audio);

        if (collision.collectedCoins > 0) {
          this.playerMgr.addCoins(collision.collectedCoins);
          this.progressionMgr.recordShardCollection(collision.collectedCoins);
          this.gameModeMgr.onCollect(collision.collectedCoins, this.playerMgr.stats);
          this.audio.playDataShardCollect();
          // addCoins() grants exactly one shard per coin, so say that.
          const n = collision.collectedCoins;
          this.onNotification(n === 1 ? '+1 Data Shard!' : `+${n} Data Shards!`);
        }

        if (collision.collectedPowerUp) {
          this.playerMgr.applyPowerUp(collision.collectedPowerUp, this.audio);
          this.onNotification(this.powerUpNotification(collision.collectedPowerUp));
        }

        // Collisions: Stumble or Crash
        if (!jetpacking && (collision.hasCrashed || collision.hasStumbled)) {
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
            this.onNotification('💥 WIPEOUT!');
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
      const { metrics, shouldNotifyNewWorld, worldToAnnounce } = transitionResult;
      this.playerMgr.stats.currentWorldId = metrics.currentWorldId;

      // Portal gateway: crossing its plane (any lane, airborne or not) is the
      // world switch. It reports the same frame the world manager above flips
      // the current world, and the sky/world swap below happen on it too.
      const crossing = this.portals.update(this.playerMgr.position.z, timeSeconds, metrics.currentWorldId);
      if (crossing && this.playerMgr.gameState === 'playing') {
        const dest = getWorldConfig(crossing.worldId);
        this.playerMgr.triggerPortalWarp(dest.compatibleBiomes[0], this.audio);
        this.themeMgr.triggerPortalWarp(dest.palette.energy, this.playerMgr.position);
        this.obstacleMgr.clearAhead(this.playerMgr.position.z, 90);
      }

      if (metrics.state === 'TRANSITIONING' && this.lastTransitionState !== 'TRANSITIONING') {
        telemetry.startTransition();
      }
      this.lastTransitionState = metrics.state;

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

      // Check collectible shards in chunks (no iterator allocation per frame)
      this.orbsCollectedThisFrame = 0;
      this.terrainMgr.chunks.forEach(this.collectChunkOrbs);
      const collectedTotal = this.orbsCollectedThisFrame;
      if (collectedTotal > 0) {
        this.progressionMgr.recordShardCollection(collectedTotal);
        this.audio.playDataShardCollect();
        this.onNotification(`+${collectedTotal} Data Shard${collectedTotal === 1 ? '' : 's'} Harvested!`);
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

      // Sky, sun, fog, exposure and reflection environment are the current
      // world's, snapped (no blend): the next world is seen through the
      // gateway's window, and everything switches on the crossing frame.
      this.skyMgr.applyAtmosphere(metrics.currentWorldId);
      this.skyMgr.update(this.playerMgr.position, this.playerMgr.velocity.z, timeSeconds, this.playerMgr.stats.speed);
      this.themeMgr.update(dt, this.skyMgr, this.terrainMgr, this.obstacleMgr, this.playerMgr.position, timeSeconds);

      // Campaign worlds: current + (while approaching a gateway) the next one,
      // built over several frames ahead of the boundary.
      this.worlds.update(this.playerMgr.position.z, dt, timeSeconds, this.graphicsConfig, metrics);

      this.compileLateAssets();
    }
  }

  private powerUpNotification(type: string): string {
    // Durations come from the power-up just applied (base + upgrade level).
    const apu = this.playerMgr.activePowerUps;
    const secs = (d?: number) => `${Math.round((d ?? 0) * 10) / 10}s`;
    switch (POWER_UP_LABELS[type]) {
      case 'magnet':
        return `🧲 QUANTUM SHARD ATTRACTOR (${secs(apu.magnetMaxDuration)})`;
      case 'jetpack':
        return `🚀 HYPERDRIVE FLIGHT (${secs(apu.jetpackMaxDuration)})`;
      case 'multiplier':
        return `⚡ 2X OVERDRIVE MULTIPLIER (${secs(apu.multiplierMaxDuration)})`;
      case 'shield':
        return '🛡️ HOLO-DEFENSE SHIELD ENGAGED';
      default:
        return 'Power-Up Collected!';
    }
  }

  /**
   * Assets that finish loading after the engine started (hero GLB, obstacle
   * models) get their shaders compiled the moment they appear, off the render
   * path where possible (KHR_parallel_shader_compile).
   */
  private compileLateAssets(): void {
    const rig = this.playerMgr.playerCharacter ? this.playerMgr.playerCharacter.heroRig : undefined;
    if (rig !== this.lastHeroRig) {
      this.lastHeroRig = rig;
      if (rig) this.compileObject(this.playerMgr.group);
    }
    if (!this.templatesCompiled && ObstacleManager.isPreloadComplete) {
      this.templatesCompiled = true;
      // Templates are never in the scene; compile() only needs their trees
      // (the live scene supplies lights, fog and environment).
      const pivots = ObstacleManager.cachedTemplates.map(t => t.pivot);
      this.shaders.compile(pivots).then(() => {
        // First real draw happens off screen too (both LOD levels), once
        // nothing is linking (it would wait for every pending link).
        this.shaders.onIdle(() => {
          if (!this.isDisposed) this.shaders.warmDraw(pivots, () => true);
        });
      });
    }
  }

  public render(now: number): void {
    // update() runs first and has already advanced lastTime to `now`, so the
    // frame delta must come from update(); recomputing it here always gave 0,
    // which froze the HUD (stats were never emitted), the FOV lerp and
    // screen-shake decay.
    const rawDt = this.lastFrameDt;
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
      // Speed widening is added on top of the aspect-derived base (portrait is
      // wider), so the resize FOV is no longer overwritten every frame.
      const baseFov = this.baseFov;
      const targetFov = Math.min(
        baseFov + 8,
        Math.max(baseFov, baseFov + (this.playerMgr.stats.speed / 150) * 6 + (this.playerMgr.stats.isBoosting ? 2 : 0))
      );
      const fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, 3.5 * rawDt);
      if (Math.abs(fov - this.camera.fov) > 1e-4) {
        this.camera.fov = fov;
        this.camera.updateProjectionMatrix();
      }

      this.camera.position.copy(this.playerMgr.cameraPos);
      this.camera.position.x += screenShakeX;
      this.camera.position.y += screenShakeY;
      this.camera.up.set(0, 1, 0);
      this.camera.lookAt(this.playerMgr.cameraLookAt);

      if (Math.abs(this.playerMgr.cameraTilt) > 0.0001) {
        this.camera.rotateZ(this.playerMgr.cameraTilt);
      }
    }

    // Glitch timers drive both camera jitter (above) and the post-process
    // shader, so they must decay even when post-processing is off.
    if (this.boostGlitchTimer > 0) this.boostGlitchTimer = Math.max(0, this.boostGlitchTimer - rawDt);
    if (this.stumbleGlitchTimer > 0) this.stumbleGlitchTimer = Math.max(0, this.stumbleGlitchTimer - rawDt);

    this.gpuTimer.begin();
    let totalDrawCalls: number;
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
        glitchIntensity = Math.max(glitchIntensity, this.boostGlitchTimer * 0.85);
        chromaticAberration = Math.max(chromaticAberration, this.boostGlitchTimer * 0.008);
      }
      if (this.stumbleGlitchTimer > 0) {
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

      // A real lens only fringes slightly; the old neon look used up to 0.008.
      chromaticAberration = Math.min(chromaticAberration, 0.0015);
      // Lens fringing is a top-tier nicety (two extra taps at the frame edge).
      if (this.graphicsConfig.preset !== 'desktop-full') chromaticAberration = 0;

      if (this.graphicsConfig.reducedFlash) {
        glitchIntensity = 0;
        chromaticAberration = 0;
        this.screenShakeTimer = 0;
      }

      const u = this.post.postMaterial.uniforms;
      u.uTime.value = timeSeconds;
      u.uFilmGrain.value = this.shaderParams.filmGrainIntensity ?? 0.0;
      u.uColorLift.value = this.shaderParams.colorLift ?? 0.2;
      u.uRainIntensity.value = this.shaderParams.rainIntensity ?? 0.0;
      u.uBloom.value = (this.shaderParams.bloomIntensity ?? 0.55) * this.adaptive.level.bloomScale;
      u.uChromaticAberration.value = chromaticAberration;
      u.uScanlines.value = this.shaderParams.scanlineIntensity ?? 0.0;
      u.uGlitch.value = glitchIntensity;
      u.uWarpIntensity.value = this.portalFlash();
      u.uSpeedLines.value = effectiveSpeedLines;
      u.uHeatShimmer.value = heatShimmerFactor;

      this.renderPortalWindow(true);
      totalDrawCalls = this.post.render(this.scene, this.camera);
    } else {
      this.renderPortalWindow(false);
      this.renderer.setRenderTarget(null);
      this.renderer.render(this.scene, this.camera);
      totalDrawCalls = this.renderer.info.render.calls;
    }
    this.gpuTimer.end();
    this.lastDrawCalls = totalDrawCalls;

    this.statsUpdateTimer += rawDt;
    const stateChanged = this.playerMgr.gameState !== this.lastSentGameState;
    if (this.statsUpdateTimer >= 0.066 || stateChanged || this._isPaused) {
      this.statsUpdateTimer = 0;
      this.lastSentGameState = this.playerMgr.gameState;
      const instances =
        (this.foliageMgr.grassMesh ? this.foliageMgr.grassMesh.count : 0) +
        (this.foliageMgr.treeMesh ? this.foliageMgr.treeMesh.count : 0);
      liveStats.publish(this.playerMgr.stats, this.currentFps, totalDrawCalls, instances, this.adaptive.label);
      if (this.onStatsUpdate) this.onStatsUpdate(this.playerMgr.stats, this.currentFps, totalDrawCalls, instances);
    }
  }

  /**
   * Post-process flash on a portal crossing: a short exposure bloom that
   * peaks on the crossing frame (hiding the world swap) and is gone in ~0.3 s.
   */
  private portalFlash(): number {
    const warp = this.playerMgr.warpTimer;
    if (!(warp > 0) || this.graphicsConfig.reducedFlash) return 0;
    const elapsed = Math.max(0, 1.4 - warp);
    const w = 0.85 * Math.exp(-elapsed * 9);
    return w > 0.02 ? w : 0;
  }

  /**
   * The view through the gateway ahead, drawn before the main pass with the
   * destination world's atmosphere. Live on every tier with post-processing
   * except the lowest; half resolution, quarter on mobile / when adaptive
   * quality has scaled the frame down.
   */
  private renderPortalWindow(postEnabled: boolean): void {
    const preset = this.graphicsConfig.preset;
    const live = postEnabled && preset !== 'webgl-min';
    const scale = preset === 'mobile-opt' || this.adaptive.levelIndex > 0 ? 0.25 : 0.5;
    this.portals.renderWindow({
      camera: this.camera,
      width: this.drawingBufferSize.x,
      height: this.drawingBufferSize.y,
      live,
      scale,
      hide: this.portalHidden,
    });
  }

  /** Draw calls of the last rendered frame (scene + post passes). */
  public get drawCalls(): number {
    return this.lastDrawCalls;
  }

  // --- Dynamic Synchronization APIs ---

  public updateGraphicsConfig(config: GraphicsConfig): void {
    const prev = this.graphicsConfig;
    this.graphicsConfig = config;

    // Preset / post / target-FPS change: rebuild the quality ladder, which
    // resizes the render targets and rebuilds the MSAA scene target.
    if (
      prev.preset !== config.preset ||
      prev.enablePostProcess !== config.enablePostProcess ||
      prev.targetFPS !== config.targetFPS
    ) {
      this.configureAdaptive();
      this.skyMgr.setShadowMapSize(config.preset === 'desktop-full' ? 2048 : 1024);
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
    this.pausedFrameRendered = false;
  }

  public updateLightingMode(mode: LightingMode): void {
    this.lightingMode = mode;
    // Lighting comes from each world's physical atmosphere (see SkyManager).
    this.skyMgr.applyLightingPreset(mode);
    this.pausedFrameRendered = false;
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

    const pUniforms = this.post.postMaterial.uniforms;
    if (pUniforms.uFilmGrain) pUniforms.uFilmGrain.value = params.filmGrainIntensity;
    if (pUniforms.uBloom) pUniforms.uBloom.value = params.bloomIntensity;
    if (pUniforms.uColorLift) pUniforms.uColorLift.value = params.colorLift;
    if (pUniforms.uChromaticAberration) pUniforms.uChromaticAberration.value = params.chromaticAberration ?? 0.005;
    if (pUniforms.uScanlines) pUniforms.uScanlines.value = params.scanlineIntensity ?? 0.5;
    if (pUniforms.uSpeedLines && params.speedLineIntensity !== undefined) {
      pUniforms.uSpeedLines.value = params.speedLineIntensity;
    }
    this.pausedFrameRendered = false;
  }

  public resetRun(): void {
    // Fresh frame-clock anchor + no leftover input from the previous run.
    this.lastTime = performance.now();
    this.releaseAllInput();
    resetBiomeState();
    this.screenShakeTimer = 0;
    this.boostGlitchTimer = 0;
    this.stumbleGlitchTimer = 0;
    this.nearMissSlowMoTimer = 0;
    this.lastBiome = getBiomeAt(0);
    this.worldMgr.setWorld('sky-isles');
    this.playerMgr.resetRun();
    this.obstacleMgr.reset();
    this.terrainMgr.rebuildAroundPlayer(0, 0, 3);
    this.foliageMgr.updateFoliage(this.terrainMgr.chunks, 0, 0, this.graphicsConfig.vegetationDensity);

    // Back to Sky Isles: every world instance (current, next, retiring) is
    // dropped and the sky snaps to Sky Isles' atmosphere.
    this.worlds.reset('sky-isles', this.graphicsConfig);
    this.portals.reset();
    this.skyMgr.applyAtmosphere('sky-isles');
    this.gameModeMgr.onRunStart();
    this.adaptive.resetTimers();
    this.adaptiveHoldUntil = performance.now() + ADAPTIVE_SETTLE_MS;
    this.pausedFrameRendered = false;
  }

  public revivePlayer(): void {
    if (!this.gameModeMgr.isReviveAllowed()) {
      this.onNotification('⚠️ REVIVES ARE DISABLED IN THIS GAME MODE!');
      return;
    }
    this.lastTime = performance.now();
    this.releaseAllInput();
    this.playerMgr.revive(this.audio);
    this.gameModeMgr.onRevive();
    this.obstacleMgr.clearAhead(this.playerMgr.position.z, 30);
    this.onNotification('✨ Neural Link Restored! Resuming Flight!');
  }

  public deployShield(): void {
    // HUD / on-screen shield button: same cooldown as the double-tap.
    if (!this.canAcceptGameplayInput()) return;
    this.tryDeployShield();
  }

  public triggerTrick(trick: TrickType): void {
    // Shared by keyboard and on-screen buttons. No tricks while paused or
    // after a crash, and only tricks that actually fire count for XP.
    if (this.isPaused || this.playerMgr.gameState !== 'playing') return;
    if (this.playerMgr.triggerTrick(trick, this.audio)) {
      this.progressionMgr.recordTrick();
    }
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
    window.removeEventListener('blur', this.handleWindowBlurBound);

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    // Persist progression that was batched during the run.
    this.progressionMgr.save();

    this.endStartupWarmup();

    this.terrainMgr.dispose();
    this.foliageMgr.dispose();
    this.skyMgr.dispose();
    this.playerMgr.dispose();
    this.obstacleMgr.dispose();
    this.themeMgr.dispose();
    this.worldMgr.dispose();
    this.worlds.dispose();
    this.portals.dispose();

    this.gpuTimer.dispose();
    this.shaders.dispose();
    this.post.dispose();
    this.renderer.dispose();

    if (this.renderer.domElement && this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
    }
  }
}
