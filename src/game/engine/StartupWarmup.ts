import * as THREE from 'three';
import { GraphicsConfig } from '../../types';
import { WorldId, WORLD_ORDER } from '../WorldConfig';
import type { WorldStreamer } from './WorldStreamer';
import type { ShaderWarmup } from './ShaderWarmup';
import type { PostPipeline } from './PostPipeline';
import type { PortalSystem } from '../portal/PortalSystem';
import type { SkyManager } from '../sky';
import { ObstacleManager } from '../obstacles';
import { TextureUploader } from './TextureUploader';
import { WORLD_ENV_MODELS, WORLD_TEXTURE_SETS, getLoadedEnvModel, getLoadedTextureSet } from '../../graphics/assetLibrary';

export interface StartupWarmupDeps {
  worlds: WorldStreamer;
  portals: PortalSystem;
  shaders: ShaderWarmup;
  obstacles: ObstacleManager;
  sky: SkyManager;
  post: PostPipeline;
  scene: THREE.Scene;
  renderer: THREE.WebGLRenderer;
  graphicsConfig: () => GraphicsConfig;
}

type Stage =
  | 'current'
  | 'env'
  | 'build'
  | 'gateways'
  | 'compiling'
  | 'assets'
  | 'upload'
  | 'warm'
  | 'dispose'
  | 'done';

// Per-frame budget for CPU-side construction (world slices) and for the
// off-screen first draws. Every step stays well under one long task.
const BUILD_BUDGET_MS = 14;
const WARM_BUDGET_MS = 14;
// The opening world's scanned textures/models were fetched while the title
// screen was up and normally are in long before this; past it the run starts
// with whatever arrived (the rest swaps in mid-run, same programs).
const ASSET_WAIT_MS = 1500;
// Its textures go up sliced, at a boosted rate (nothing else is drawn yet);
// past this the remainder uploads on first use.
const UPLOAD_WAIT_MS = 2000;
const UPLOAD_BOOST = 12;

const TEXTURE_KEYS = [
  'map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap', 'alphaMap',
  'bumpMap', 'displacementMap', 'lightMap', 'specularMap', 'clearcoatNormalMap',
] as const;

function isDrawable(o: THREE.Object3D): boolean {
  return (o as THREE.Mesh).isMesh === true || (o as THREE.Points).isPoints === true || (o as THREE.Line).isLine === true || (o as THREE.Sprite).isSprite === true;
}

/** One unit of off-screen first drawing: some objects of a root, drawn together. */
interface WarmUnit {
  roots: THREE.Object3D[];
  objects: Set<THREE.Object3D>;
}

/**
 * Runs once, before the first run starts (the rider waits at the start line,
 * behind the loading overlay, and the main scene is not drawn yet). CPU work
 * overlaps the background shader links wherever possible:
 *
 *  1. the current world built in slices, while the post and PMREM programs
 *     link in the background;
 *  2. the five reflection environments baked, one per frame (the current
 *     world's first, applied at once), the opening world's textures going up
 *     (sliced, boosted rate) in the same frames; then the live scene compiled;
 *  3. every other world and every gateway style built once, hidden, with
 *     placeholder textures (nothing downloaded: the scans fill the same
 *     slots, so the programs are identical), plus every obstacle type, each
 *     compiled (main + shadow pass) the moment it is built;
 *  4. the opening world's remaining textures uploaded;
 *  5. one off-screen draw per distinct draw configuration (main + shadow
 *     pass; on ANGLE/D3D11 some programs only finish on their first draw),
 *     ~11 ms of them per frame, each unit's textures uploaded first;
 *  6. the throw-away instances disposed, one per frame.
 *
 * ShaderWarmup keeps the programs, so nothing mid-run ever links a shader:
 * each world ahead of its gateway only builds geometry and uploads textures.
 * Every step is budgeted: no frame of the warm-up is a long task.
 */
export class StartupWarmup {
  private deps: StartupWarmupDeps;
  private stage: Stage = 'current';
  private kicked = false;
  private kickDone = false;
  private scansQueued = false;
  private queue: WorldId[];
  private building: WorldId | null = null;
  private roots: THREE.Object3D[][] = [];
  private prewarmRoots = new Set<THREE.Object3D>();
  private gatewayIndex = 1;
  private compilesPending = 0;
  private units: WarmUnit[] = [];
  private unitIndex = 0;
  private assetDeadline = 0;
  private uploadDeadline = 0;
  private stageStart = performance.now();
  private obstacleGroup: THREE.Group | null = null;
  private uploader: TextureUploader;
  private unitTextures: THREE.Texture[] = [];
  private batch = new Set<THREE.Object3D>();
  private batchSize = 4;
  readonly startedAt = performance.now();
  /** Milliseconds spent per stage (debug readout). */
  readonly timings: Record<string, number> = {};

  constructor(deps: StartupWarmupDeps) {
    this.deps = deps;
    const current = deps.worlds.currentWorldId;
    this.queue = WORLD_ORDER.filter(id => id !== current);
    this.uploader = new TextureUploader(deps.renderer);
    this.assetDeadline = performance.now() + ASSET_WAIT_MS;
    TextureUploader.setBoost(UPLOAD_BOOST);
  }

  get done(): boolean {
    return this.stage === 'done';
  }

  /**
   * The engine may stream / update the worlds: only once the scene is drawn
   * (updating earlier would build chunks and kick draw-guard compiles while
   * the warm-up needs the GPU free of links for its bakes and uploads).
   */
  get currentReady(): boolean {
    return this.renderReady;
  }

  /**
   * The live scene may be drawn: everything in it was compiled, its textures
   * uploaded and first-drawn off screen (a normal frame can't stall).
   */
  get renderReady(): boolean {
    return this.stage === 'dispose' || this.stage === 'done';
  }

  /** Current stage (debug readout). */
  get stageName(): string {
    return this.stage;
  }

  private setStage(stage: Stage): void {
    const now = performance.now();
    this.timings[this.stage] = (this.timings[this.stage] ?? 0) + (now - this.stageStart);
    this.stageStart = now;
    this.stage = stage;
  }

  /** Advance one step (call once per frame); returns true once finished. */
  step(): boolean {
    const d = this.deps;
    switch (this.stage) {
      case 'current':
        if (!this.kicked) {
          // Post passes and the PMREM bake's programs link in the background
          // while the current world is built (CPU only).
          this.kicked = true;
          const done = () => {
            this.kickDone = true;
          };
          Promise.all([d.post.compileAsync(), d.sky.compileEnvironmentAsync()]).then(done, done);
        }
        // The opening world's scans (fetched on the title screen) go up from
        // the moment no link is in flight, alongside the CPU-only build.
        if (this.kickDone) this.pumpOpeningScans();
        if (d.worlds.warmCurrent(BUILD_BUDGET_MS)) this.setStage('env');
        return false;
      case 'env': {
        // One reflection environment per frame (current world first) and the
        // opening world's textures, with no link in flight (both are
        // synchronous GL work that would wait for it).
        if (!this.kickDone || d.shaders.busy) return false;
        this.pumpOpeningScans();
        d.worlds.pumpCurrentUploads();
        if (!d.sky.bakeNextEnvironment()) return false;
        // Everything live (current world, road, rider, sky) plus the
        // shadow-depth variants of every caster.
        this.compile([d.scene]);
        this.setStage('build');
        return false;
      }
      case 'build': {
        // Each world compiled the moment it is built: its programs link in
        // the background while the next one is built.
        const id = this.building ?? this.queue.shift() ?? null;
        if (id) {
          const r = d.worlds.buildPrewarmWorld(id, d.graphicsConfig(), BUILD_BUDGET_MS);
          if (r === 'busy') {
            this.building = id;
            return false;
          }
          this.building = null;
          if (r && r.length > 0) {
            this.addRoots(r);
            this.compile(r);
          }
        }
        if (this.queue.length === 0 && !this.building) this.setStage('gateways');
        return false;
      }
      case 'gateways': {
        // One gateway style per frame, then every obstacle material.
        if (this.gatewayIndex <= d.portals.prewarmGatewayCount) {
          const g = d.portals.buildPrewarmGateway(this.gatewayIndex++);
          if (g) {
            this.addRoots([g]);
            this.compile([g]);
          }
          return false;
        }
        this.obstacleGroup = d.obstacles.buildWarmupGroup();
        this.addRoots([this.obstacleGroup]);
        this.compile([this.obstacleGroup]);
        this.setStage('compiling');
        return false;
      }
      case 'compiling':
        if (this.compilesPending > 0) return false;
        this.setStage('assets');
        return false;
      case 'assets': {
        const now = performance.now();
        const settled = d.worlds.currentAssetsSettled && !ObstacleManager.isPreloading;
        if (!settled && now < this.assetDeadline) return false;
        // The obstacle GLB models (both LOD levels), if they are in.
        if (ObstacleManager.isPreloadComplete) {
          const pivots = ObstacleManager.cachedTemplates.map(t => t.pivot);
          if (pivots.length > 0) {
            this.roots.push(pivots);
            this.compile(pivots);
          }
        }
        this.uploadDeadline = now + UPLOAD_WAIT_MS;
        this.setStage('upload');
        return false;
      }
      case 'upload': {
        // The opening world's scans (and anything it swapped in), sliced.
        if (d.shaders.busy) return false;
        this.pumpOpeningScans();
        const pending = d.worlds.pumpCurrentUploads() + this.uploader.pending;
        if (pending > 0 && performance.now() < this.uploadDeadline) return false;
        if (this.compilesPending > 0) return false;
        this.units = this.buildUnits();
        this.unitIndex = 0;
        this.setStage('warm');
        return false;
      }
      case 'warm': {
        // First draws are synchronous: only with nothing else linking, each
        // unit's textures uploaded first (else the draw uploads them whole).
        if (d.shaders.busy) return false;
        const t0 = performance.now();
        while (this.unitIndex < this.units.length) {
          // Consecutive units of the same roots go in one draw call batch
          // (each warm draw renders the scene once), as many as the last
          // draw's cost suggests fit in the frame's budget.
          const first = this.units[this.unitIndex];
          const batch = this.batch;
          batch.clear();
          let n = 0;
          while (this.unitIndex + n < this.units.length && n < this.batchSize) {
            const u = this.units[this.unitIndex + n];
            if (u.roots !== first.roots) break;
            if (!this.texturesReady(u)) {
              if (n === 0) return false;
              break;
            }
            for (const o of u.objects) batch.add(o);
            n++;
          }
          const ts = performance.now();
          d.shaders.warmDraw(first.roots, o => batch.has(o));
          const ms = performance.now() - ts;
          this.unitIndex += n;
          // Cheap draws (programs already first-drawn): larger batches.
          this.batchSize = ms < 2 ? Math.min(64, this.batchSize * 2) : ms > 6 ? Math.max(1, this.batchSize >> 1) : this.batchSize;
          if (performance.now() - t0 >= WARM_BUDGET_MS) return false;
        }
        TextureUploader.setBoost(1);
        this.setStage('dispose');
        return false;
      }
      case 'dispose':
        if (d.worlds.disposeNextPrewarmWorld()) return false;
        d.portals.disposePrewarmGateways();
        this.disposeObstacleGroup();
        this.roots.length = 0;
        this.units.length = 0;
        this.setStage('done');
        return true;
      case 'done':
        return true;
    }
  }

  /** Queue (once loaded) and upload the current world's scanned textures. */
  private pumpOpeningScans(): void {
    const id = this.deps.worlds.currentWorldId;
    if (id && !this.scansQueued) {
      let all = true;
      for (const stem of WORLD_TEXTURE_SETS[id] ?? []) {
        const set = getLoadedTextureSet(stem);
        if (!set) {
          all = false;
          continue;
        }
        this.uploader.enqueue(set.map);
        this.uploader.enqueue(set.normalMap);
        this.uploader.enqueue(set.armMap);
      }
      for (const m of WORLD_ENV_MODELS[id] ?? []) {
        const model = getLoadedEnvModel(m);
        if (!model) {
          all = false;
          continue;
        }
        this.uploader.enqueue(model.map);
        this.uploader.enqueue(model.normalMap);
        this.uploader.enqueue(model.armMap);
      }
      this.scansQueued = all;
    }
    this.uploader.pump();
  }

  private compile(roots: THREE.Object3D[]): void {
    this.compilesPending++;
    this.deps.shaders.compile(roots).finally(() => this.compilesPending--);
  }

  private addRoots(r: THREE.Object3D[]): void {
    this.roots.push(r);
    for (const o of r) this.prewarmRoots.add(o);
  }

  /**
   * Warm units: every top-level child of each warm-up root (a chunk, a pool,
   * an atmosphere, a gateway part...) and of the live scene (the current
   * world, the road, the rider, the sky...), drawn whole.
   */
  private buildUnits(): WarmUnit[] {
    const units: WarmUnit[] = [];
    // One first draw per distinct configuration is enough: same program(s),
    // same vertex layout, same instancing / shadow use. (Hundreds of pool
    // and chunk meshes share a few dozen of them.)
    const seen = new Set<string>();
    const add = (roots: THREE.Object3D[], top: THREE.Object3D) => {
      const objects = new Set<THREE.Object3D>();
      top.traverse(o => {
        if (!isDrawable(o)) return;
        const sig = this.drawSignature(o);
        if (sig !== null) {
          if (seen.has(sig)) return;
          seen.add(sig);
        }
        objects.add(o);
      });
      if (objects.size > 0) units.push({ roots, objects });
    };
    const scene = this.deps.scene;
    for (const child of scene.children) {
      if (this.prewarmRoots.has(child) || (child as THREE.Light).isLight) continue;
      if (isDrawable(child)) add([scene], child);
      else for (const c of child.children) add([scene], c);
    }
    for (const group of this.roots) {
      for (const root of group) {
        if (isDrawable(root)) add(group, root);
        for (const c of root.children) add(group, c);
      }
    }
    return units;
  }

  private programIds = new WeakMap<object, number>();
  private nextProgramId = 1;
  private layoutIds = new WeakMap<THREE.BufferGeometry, string>();

  /** Identifies what a first draw of `o` would set up (null: unknown, draw it). */
  private drawSignature(o: THREE.Object3D): string | null {
    const mesh = o as THREE.Mesh;
    const geometry = mesh.geometry as THREE.BufferGeometry | undefined;
    const m = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (!geometry || !m) return null;
    const props = this.deps.renderer.properties;
    let progs = '';
    for (const mat of Array.isArray(m) ? m : [m]) {
      const program = (props.get(mat) as { currentProgram?: object }).currentProgram;
      if (!program) return null;
      let id = this.programIds.get(program);
      if (id === undefined) {
        id = this.nextProgramId++;
        this.programIds.set(program, id);
      }
      progs += id + ',' + mat.side + ',';
    }
    let layout = this.layoutIds.get(geometry);
    if (layout === undefined) {
      layout = '';
      for (const name of Object.keys(geometry.attributes).sort()) {
        const a = geometry.attributes[name] as THREE.BufferAttribute;
        layout += name + a.itemSize + (a.normalized ? 'n' : '') + ((a.array && a.array.constructor && a.array.constructor.name) || '') + (a as unknown as THREE.InterleavedBufferAttribute).isInterleavedBufferAttribute + ';';
      }
      layout += geometry.index ? 'i' + geometry.index.array.constructor.name : '';
      this.layoutIds.set(geometry, layout);
    }
    const inst = (o as THREE.InstancedMesh).isInstancedMesh ? 'I' + ((o as THREE.InstancedMesh).instanceColor ? 'c' : '') : '';
    const kind = (o as THREE.Points).isPoints ? 'P' : (o as THREE.Line).isLine ? 'L' : (o as THREE.Sprite).isSprite ? 'S' : 'M';
    return kind + inst + (o.castShadow ? 's' : '') + '|' + progs + '|' + layout;
  }

  /** Queue the unit's textures for upload; true once none is pending. */
  private texturesReady(unit: WarmUnit): boolean {
    const up = this.uploader;
    const list = this.unitTextures;
    list.length = 0;
    for (const o of unit.objects) {
      const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
      if (!m) continue;
      for (const mat of Array.isArray(m) ? m : [m]) {
        const anyMat = mat as unknown as Record<string, unknown>;
        for (const k of TEXTURE_KEYS) {
          const t = anyMat[k] as THREE.Texture | null | undefined;
          if (t && t.isTexture) list.push(t);
        }
        const uniforms = anyMat.uniforms as Record<string, THREE.IUniform> | undefined;
        if (uniforms) {
          for (const key in uniforms) {
            const v = uniforms[key] && uniforms[key].value;
            if (v && (v as THREE.Texture).isTexture) list.push(v as THREE.Texture);
          }
        }
      }
    }
    for (const t of list) up.enqueue(t);
    up.pump();
    return up.pending === 0;
  }

  /** Stop early (engine disposed / reset): drop the warm-up instances. */
  cancel(): void {
    while (this.deps.worlds.disposeNextPrewarmWorld()) {
      /* all of them */
    }
    this.deps.portals.disposePrewarmGateways();
    this.disposeObstacleGroup();
    this.uploader.clear();
    TextureUploader.setBoost(1);
    this.roots.length = 0;
    this.units.length = 0;
    this.stage = 'done';
  }

  private disposeObstacleGroup(): void {
    const g = this.obstacleGroup;
    if (!g) return;
    this.obstacleGroup = null;
    g.removeFromParent();
    (g.userData.warmupGeometry as THREE.BufferGeometry | undefined)?.dispose();
  }
}
