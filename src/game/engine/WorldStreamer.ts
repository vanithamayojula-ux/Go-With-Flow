import * as THREE from 'three';
import { GraphicsConfig } from '../../types';
import { WorldId, WORLD_ORDER, WORLD_LENGTH_DISTANCE } from '../WorldConfig';

/**
 * What the engine needs from a campaign world. `setStreamRange`, `prepare`
 * and `warmup` are optional so worlds that don't implement them still work
 * (they fall back to a hidden pre-build, see below).
 */
export interface StreamableWorld {
  group: THREE.Group;
  update(playerZ: number, dt: number, time: number, graphicsConfig: GraphicsConfig): void;
  dispose(): void;
  /** Only spawn scenery whose z is in [minZ, maxZ). */
  setStreamRange?(minZ: number, maxZ: number): void;
  /** Async load of the world's textures/models; it renders with fallbacks until then. */
  prepare?(): Promise<void>;
  /** Do a slice of deferred construction work; true once fully built. */
  warmup?(budgetMs: number): boolean;
}

export type WorldConstructor = new (scene: THREE.Scene, graphicsConfig: GraphicsConfig) => StreamableWorld;

export interface WorldStreamerHooks {
  /** A world was created ahead of its boundary (bake its environment here). */
  onPreloadStart?(worldId: WorldId): void;
  /**
   * Compile every shader these objects need (main + shadow pass) without
   * stalling; resolve once all programs are linked.
   */
  compile?(roots: THREE.Object3D[]): Promise<void>;
  /** True if drawing this object now would compile a shader on the spot. */
  needsCompile?(object: THREE.Object3D): boolean;
  /** Draw these objects once, off screen (first real draws can still stall). */
  warmDraw?(roots: THREE.Object3D[], filter: (o: THREE.Object3D) => boolean): void;
}

export interface WorldStreamMetrics {
  currentWorldId: string;
  nextWorldId: string;
  state: string;
}

type Phase = 'env' | 'warmup' | 'prebuild' | 'compile' | 'compiling' | 'upload' | 'warmdraw' | 'ready';

interface WorldSlot {
  id: WorldId;
  index: number;
  world: StreamableWorld;
  /** Objects the constructor added straight to the scene (world roots). */
  roots: THREE.Object3D[];
  /** Implements setStreamRange: may be updated (and seen) before its boundary. */
  streaming: boolean;
  /** Not drawn (roots invisible). */
  hidden: boolean;
  /** Preparation step for a world built ahead of its gateway. */
  phase: Phase;
  prepared: boolean;
  /** prepare() resolved after compiling started: compile + upload again. */
  dirty: boolean;
  /** Frame on which the current phase started. */
  phaseFrame: number;
  /** One object per distinct draw configuration, drawn off screen in batches. */
  warmList: THREE.Object3D[];
}

interface RetiredWorld {
  slot: WorldSlot;
  disposeAtFrame: number;
}

// The next world is created this far before its gateway (~20 s of riding),
// so building, compiling and uploading it finish long before any of it can
// be seen (scenery only fades in within ~430 m of the rider).
export const NEXT_WORLD_LEAD = 900;
// Below this distance to the gateway the next world's scenery may be on
// screen, so it can no longer be hidden to recompile it.
const VISIBLE_RANGE = 480;
const WARMUP_BUDGET_MS = 4;
// GPU texture uploads (and mip generation) for the next world, per frame.
const TEXTURE_UPLOAD_BUDGET_MS = 3;
const TEXTURE_KEYS = [
  'map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap', 'alphaMap',
  'bumpMap', 'displacementMap', 'lightMap', 'specularMap', 'clearcoatNormalMap',
] as const;
// Old worlds keep their scenery behind the camera for a moment after the
// crossing, then go (one disposal per frame, never on the crossing frame).
const RETIRE_DELAY_FRAMES = 90;
// Top-level units (chunks, pools, atmosphere) drawn off screen per frame
// while preparing the next world.
const WARM_DRAWS_PER_FRAME = 2;

function worldStart(index: number): number {
  // The first world starts at the start line (matches the worlds' own default span).
  return index * WORLD_LENGTH_DISTANCE;
}

function worldEnd(index: number): number {
  return index >= WORLD_ORDER.length - 1 ? Infinity : (index + 1) * WORLD_LENGTH_DISTANCE;
}

function setRootsVisible(slot: WorldSlot, visible: boolean): void {
  for (const r of slot.roots) r.visible = visible;
}

/**
 * Owns the campaign world instances. The next world is created ~900 m before
 * its gateway, built in small slices, its shaders compiled asynchronously
 * (main + shadow pass) and its textures uploaded, all while it is hidden; it
 * only becomes drawable once nothing about it can stall a frame. It is then
 * updated alongside the current world (its scenery appears beyond the gateway
 * as the rider nears it), and crossing the boundary just swaps which one is
 * current. The old world is disposed ~1.5 s later, one world per frame.
 */
export class WorldStreamer {
  private scene: THREE.Scene;
  private renderer: THREE.WebGLRenderer | null;
  private camera: THREE.Camera;
  private ctors: Record<WorldId, WorldConstructor>;
  private hooks: WorldStreamerHooks;

  private current: WorldSlot | null = null;
  private next: WorldSlot | null = null;
  private retired: RetiredWorld[] = [];
  private textureQueue: THREE.Texture[] = [];
  // Streamed objects already checked by the draw guard.
  private guarded = new WeakSet<THREE.Object3D>();
  private frame = 0;
  private disposed = false;

  constructor(
    scene: THREE.Scene,
    renderer: THREE.WebGLRenderer | null,
    camera: THREE.Camera,
    ctors: Record<WorldId, WorldConstructor>,
    hooks: WorldStreamerHooks = {}
  ) {
    this.scene = scene;
    this.renderer = renderer;
    this.camera = camera;
    this.ctors = ctors;
    this.hooks = hooks;
  }

  get currentWorldId(): WorldId | null {
    return this.current ? this.current.id : null;
  }

  get nextWorldId(): WorldId | null {
    return this.next ? this.next.id : null;
  }

  /** Current world instance (debug / tests). */
  get currentWorld(): StreamableWorld | null {
    return this.current ? this.current.world : null;
  }

  get nextWorld(): StreamableWorld | null {
    return this.next ? this.next.world : null;
  }

  /** The next world is built, compiled and uploaded (drawable without stalls). */
  get nextReady(): boolean {
    return !!this.next && this.next.phase === 'ready';
  }

  /** Preparation phase of the next world (debug readout). */
  get nextPhase(): string {
    return this.next ? this.next.phase + (this.next.prepared ? '+assets' : '') + (this.next.hidden ? '(hidden)' : '') : '-';
  }

  /** Roots of the current world (scene children it added). */
  getCurrentRoots(): THREE.Object3D[] {
    return this.current ? this.current.roots : [];
  }

  /** Drop every world now and start fresh in `worldId` (run start / restart / quit). */
  reset(worldId: WorldId, graphicsConfig: GraphicsConfig): void {
    this.disposeAll();
    this.current = this.create(worldId, graphicsConfig, false);
  }

  private create(id: WorldId, graphicsConfig: GraphicsConfig, ahead: boolean): WorldSlot {
    const index = Math.max(0, WORLD_ORDER.indexOf(id));
    const before = this.scene.children.length;
    const world = new this.ctors[id](this.scene, graphicsConfig);
    const roots = this.scene.children.slice(before);
    if (world.group && roots.indexOf(world.group) === -1) roots.push(world.group);

    const streaming = typeof world.setStreamRange === 'function';
    if (streaming) world.setStreamRange!(worldStart(index), worldEnd(index));

    const slot: WorldSlot = {
      id,
      index,
      world,
      roots,
      streaming,
      hidden: false,
      phase: ahead ? 'env' : 'ready',
      prepared: typeof world.prepare !== 'function',
      dirty: false,
      phaseFrame: this.frame,
      warmList: [],
    };

    // Built ahead of its gateway: invisible until it is safe to draw.
    if (ahead) {
      slot.hidden = true;
      setRootsVisible(slot, false);
    }

    if (typeof world.prepare === 'function') {
      world
        .prepare()
        .catch(err => console.warn(`[WorldStreamer] prepare() failed for ${id}:`, err))
        .then(() => {
          slot.prepared = true;
          // Scanned textures/models were swapped into its materials: those
          // need compiling and uploading too.
          if (slot.phase !== 'env' && slot.phase !== 'warmup' && slot.phase !== 'prebuild') slot.dirty = true;
        });
    }
    return slot;
  }

  private retire(slot: WorldSlot | null): void {
    if (!slot) return;
    // A world without a stream range also spawned scenery past its boundary,
    // over the new world: hide it at once (a visibility flip is free).
    if (!slot.streaming || slot.hidden) setRootsVisible(slot, false);
    // Disposal (GL deletes) happens a bit later, off the crossing frame.
    this.retired.push({ slot, disposeAtFrame: this.frame + RETIRE_DELAY_FRAMES });
  }

  private setPhase(slot: WorldSlot, phase: Phase): void {
    slot.phase = phase;
    slot.phaseFrame = this.frame;
  }

  update(playerZ: number, dt: number, time: number, graphicsConfig: GraphicsConfig, metrics: WorldStreamMetrics): void {
    if (this.disposed) return;
    this.frame++;
    const wantId = metrics.currentWorldId as WorldId;

    // 1. Crossing: promote the prepared next world. Anything else (debug
    // teleport, backwards jump) falls back to building the world in place.
    if (!this.current || this.current.id !== wantId) {
      if (this.next && this.next.id === wantId) {
        this.retire(this.current);
        this.current = this.next;
        this.next = null;
        if (this.current.hidden) {
          this.current.hidden = false;
          setRootsVisible(this.current, true);
        }
        this.current.phase = 'ready';
      } else if (this.ctors[wantId]) {
        this.retire(this.current);
        this.retire(this.next);
        this.next = null;
        this.textureQueue.length = 0;
        this.current = this.create(wantId, graphicsConfig, false);
      }
    }

    // 2. Create the next world well ahead of its gateway.
    const cur = this.current;
    const nextIndex = cur ? cur.index + 1 : -1;
    const nextId = nextIndex > 0 && nextIndex < WORLD_ORDER.length ? WORLD_ORDER[nextIndex] : null;
    const gateway = cur ? worldEnd(cur.index) : Infinity;
    const approaching =
      !!nextId &&
      !!this.ctors[nextId] &&
      (playerZ >= gateway - NEXT_WORLD_LEAD || metrics.state === 'PREPARING' || metrics.state === 'TRANSITIONING');
    if (this.next && (!approaching || this.next.id !== nextId)) {
      this.retire(this.next);
      this.next = null;
      this.textureQueue.length = 0;
    }
    if (approaching && !this.next && nextId) {
      this.next = this.create(nextId, graphicsConfig, true);
    }

    // 3. Prepare the next world, one step per frame.
    const n = this.next;
    if (n) this.advancePreparation(n, playerZ, gateway, dt, time, graphicsConfig);

    // 4. Simulate. A drawable streaming next world is updated every frame
    // with the real position: its scenery appears beyond the gateway.
    if (cur) cur.world.update(playerZ, dt, time, graphicsConfig);
    if (n && n.streaming && !n.hidden) n.world.update(playerZ, dt, time, graphicsConfig);

    // 4b. Draw guard: scenery a world created just now whose shaders aren't
    // compiled stays hidden until its async compile finishes, instead of
    // stalling this frame (~100-300 ms per program on ANGLE/D3D11).
    if (cur) this.guardNewObjects(cur);
    if (n && !n.hidden) this.guardNewObjects(n);

    // 5. Pending texture uploads.
    this.pumpTextureUploads();

    // 6. Retired worlds: one disposal per frame once their delay is up.
    if (this.retired.length > 0 && this.retired[0].disposeAtFrame <= this.frame) {
      const r = this.retired.shift()!;
      this.disposeSlot(r.slot);
    }
  }

  private advancePreparation(
    n: WorldSlot,
    playerZ: number,
    gateway: number,
    dt: number,
    time: number,
    graphicsConfig: GraphicsConfig
  ): void {
    const age = this.frame - n.phaseFrame;
    switch (n.phase) {
      case 'env':
        // Its own frame: bake the reflection environment.
        if (age >= 2) {
          this.hooks.onPreloadStart?.(n.id);
          this.setPhase(n, 'warmup');
        }
        return;
      case 'warmup':
        if (!n.world.warmup || n.world.warmup(WARMUP_BUDGET_MS)) this.setPhase(n, 'prebuild');
        return;
      case 'prebuild':
        // Worlds without a stream range: spawn (hidden) the scenery that will
        // surround the rider at the gateway, so crossing only flips visibility.
        if (!n.streaming) n.world.update(worldStart(n.index) + 1, dt, time, graphicsConfig);
        this.setPhase(n, 'compile');
        return;
      case 'compile':
        if (age < 1) return;
        this.setPhase(n, 'compiling');
        n.dirty = false;
        this.compileRoots(n.roots).then(() => {
          if (this.next === n && n.phase === 'compiling') {
            this.queueTextures(n);
            this.setPhase(n, 'upload');
          }
        });
        return;
      case 'compiling':
        return;
      case 'upload':
        if (this.textureQueue.length > 0) return;
        n.warmList = this.collectWarmList(n.roots);
        this.setPhase(n, 'warmdraw');
        return;
      case 'warmdraw': {
        // Some programs only finish compiling on their first real draw
        // (ANGLE/D3D11 point sprites, input-layout variants): draw one object
        // per configuration off screen, a few per frame, long before the
        // rider can see any of it.
        if (this.hooks.warmDraw && n.warmList.length > 0) {
          const batch = new Set<THREE.Object3D>();
          for (const unit of n.warmList.splice(0, WARM_DRAWS_PER_FRAME)) unit.traverse(o => { batch.add(o); });
          this.hooks.warmDraw(n.roots, o => batch.has(o));
          if (n.warmList.length > 0) return;
        }
        this.setPhase(n, 'ready');
        // Everything in it now is compiled: the draw guard can skip it.
        for (const root of n.roots) for (const child of root.children) this.guarded.add(child);
        // Nothing left that could stall: let it be drawn (streaming worlds;
        // the others are revealed at the crossing).
        if (n.streaming && n.hidden) {
          n.hidden = false;
          setRootsVisible(n, true);
        }
        return;
      }
      case 'ready':
        // prepare() swapped new textures/materials in: recompile + upload,
        // hidden again while none of it can be on screen yet.
        if (n.dirty) {
          if (n.streaming && !n.hidden && gateway - playerZ > VISIBLE_RANGE) {
            n.hidden = true;
            setRootsVisible(n, false);
          }
          this.setPhase(n, 'compile');
        }
        return;
    }
  }

  private guardNewObjects(slot: WorldSlot): void {
    const needs = this.hooks.needsCompile;
    if (!needs) return;
    for (let r = 0; r < slot.roots.length; r++) {
      const children = slot.roots[r].children;
      for (let i = 0; i < children.length; i++) {
        const child = children[i];
        if (this.guarded.has(child)) continue;
        this.guarded.add(child);
        if (!child.visible || !needs(child)) continue;
        child.visible = false;
        this.compileRoots([child]).then(() => {
          child.visible = true;
        });
      }
    }
  }

  /**
   * Units of off-screen warm drawing: each top-level child of the world's
   * roots (a chunk, a pool, the atmosphere...), drawn whole, so every object
   * gets its first real draw (no guessing which configurations matter).
   */
  private collectWarmList(roots: THREE.Object3D[]): THREE.Object3D[] {
    const list: THREE.Object3D[] = [];
    for (const root of roots) {
      if ((root as THREE.Mesh).isMesh || (root as THREE.Points).isPoints) list.push(root);
      for (const child of root.children) list.push(child);
    }
    return list;
  }

  private compileRoots(roots: THREE.Object3D[]): Promise<void> {
    if (this.hooks.compile) return this.hooks.compile(roots);
    const renderer = this.renderer;
    if (!renderer) return Promise.resolve();
    return Promise.all(roots.map(r => renderer.compileAsync(r, this.camera, this.scene))).then(
      () => undefined,
      () => undefined
    );
  }

  private queueTextures(slot: WorldSlot): void {
    const seen = new Set<THREE.Texture>(this.textureQueue);
    const push = (t: unknown) => {
      const tex = t as THREE.Texture | null;
      if (!tex || !(tex as any).isTexture || seen.has(tex)) return;
      if ((tex as any).isRenderTargetTexture || (tex as any).isCubeTexture) return;
      seen.add(tex);
      this.textureQueue.push(tex);
    };
    for (const root of slot.roots) {
      root.traverse(o => {
        const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
        if (!m) return;
        const mats = Array.isArray(m) ? m : [m];
        for (const mat of mats) {
          const anyMat = mat as any;
          for (const k of TEXTURE_KEYS) push(anyMat[k]);
          const uniforms = anyMat.uniforms as Record<string, THREE.IUniform> | undefined;
          if (uniforms) for (const key in uniforms) push(uniforms[key] && uniforms[key].value);
        }
      });
    }
  }

  private pumpTextureUploads(): void {
    const renderer = this.renderer;
    if (!renderer || this.textureQueue.length === 0) return;
    const t0 = performance.now();
    while (this.textureQueue.length > 0 && performance.now() - t0 < TEXTURE_UPLOAD_BUDGET_MS) {
      const tex = this.textureQueue.pop()!;
      const img = (tex as any).image;
      // Not loaded yet: it uploads on first use as before.
      if (!img) continue;
      if (typeof HTMLImageElement !== 'undefined' && img instanceof HTMLImageElement && !img.complete) continue;
      try {
        renderer.initTexture(tex);
      } catch {
        /* uploads on first use instead */
      }
    }
  }

  private disposeSlot(slot: WorldSlot): void {
    try {
      slot.world.dispose();
    } catch (err) {
      console.warn(`[WorldStreamer] dispose failed for ${slot.id}:`, err);
    }
    // Anything the world added to the scene but did not remove itself.
    for (const r of slot.roots) if (r.parent === this.scene) this.scene.remove(r);
  }

  private disposeAll(): void {
    this.textureQueue.length = 0;
    for (const r of this.retired) this.disposeSlot(r.slot);
    this.retired.length = 0;
    if (this.next) this.disposeSlot(this.next);
    if (this.current) this.disposeSlot(this.current);
    this.next = null;
    this.current = null;
  }

  dispose(): void {
    this.disposeAll();
    this.disposed = true;
  }
}
