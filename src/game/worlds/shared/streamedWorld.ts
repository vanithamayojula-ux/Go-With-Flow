import * as THREE from 'three';
import { GraphicsConfig } from '../../../types';
import { WorldId } from '../../WorldConfig';
import { preloadWorldAssets, releaseWorldTextures } from '../../../graphics/assetLibrary';
import { InstancePool, PoolHandle } from './instancePool';
import { StreamFade, getWorldFade, defaultWorldSpan, nearWorldBoundary, NEAR_FADE_END } from './distanceFade';

export interface StreamChunk {
  index: number;
  /** World z range covered by the chunk [z0, z1). */
  z0: number;
  z1: number;
  centerZ: number;
  objects: THREE.Object3D[];
  handles: PoolHandle[];
}

/**
 * A deferred construction step. It may return an iterator (e.g. a generator)
 * to be resumed across warmup slices, yielding at safe points.
 */
export type WarmTask = () => void | Iterator<unknown>;

/**
 * Shadow casters keep this far (plus their own horizontal reach) from the
 * stream range ends: the shadow pass is not clipped at the range, so a caster
 * right at a gateway would throw its shadow across into the neighbouring world.
 */
export const SHADOW_EDGE_MARGIN = 15;
/** Length of the range start that warmup() pre-spawns (kept until the rider arrives). */
export const PRESPAWN_LENGTH = 300;

const now = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/**
 * Shared streaming / lifecycle core of the five campaign worlds.
 *
 * Contract used by the engine (see each world's class):
 *  - constructor(scene, graphicsConfig): cheap (no canvas / geometry work).
 *  - setStreamRange(minZ, maxZ): only scenery with z in [minZ, maxZ) is spawned;
 *    geometry crossing the range ends is clipped in the shader. Defaults to the
 *    world's own span [k * 2250, (k + 1) * 2250) (open-ended for the last).
 *  - warmup(budgetMs): runs the deferred construction (materials, textures,
 *    template geometry, pools, then the first chunks at the range start) in
 *    slices of at most ~budgetMs; returns true when everything is done.
 *  - prepare(): fetches the world's scanned CC0 assets and upgrades materials /
 *    instanced geometry in place. The world renders with procedural fallbacks
 *    before it resolves.
 *  - update(playerZ, dt, time, cfg): streams chunks (finishing any warmup that
 *    was never run) and animates.
 *
 * Chunks are aligned to the world's span start so the first chunk begins
 * exactly at the gateway: chunk i covers [origin + i * L, origin + (i + 1) * L).
 */
export abstract class StreamedWorld {
  public scene: THREE.Scene;
  public group: THREE.Group;

  protected readonly worldId: WorldId;
  protected graphicsConfig: GraphicsConfig;
  protected readonly fade: StreamFade;
  protected readonly origin: number;
  protected streamMin: number;
  protected streamMax: number;
  protected abstract readonly chunkLength: number;
  /** Chunks are kept / spawned over [playerZ - behindDist, playerZ + aheadDist). */
  protected aheadDist = NEAR_FADE_END + 40;
  protected behindDist = 110;
  protected chunks = new Map<number, StreamChunk>();
  protected pools: InstancePool[] = [];
  protected lastPlayerZ = Number.NaN;
  protected disposed = false;

  private warmQueue: WarmTask[] = [];
  /** A generator task in progress (resumed across warmup slices). */
  private warmIter: Iterator<unknown> | null = null;
  private warmQueued = false;
  private warmIndex = 0;
  private kitReady = false;
  private assetsLoaded = false;
  private assetsApplied = false;
  private preparePromise: Promise<void> | null = null;
  private lastStreamKey = Number.NaN;

  constructor(scene: THREE.Scene, graphicsConfig: GraphicsConfig, worldId: WorldId, groupName: string) {
    this.scene = scene;
    this.graphicsConfig = graphicsConfig;
    this.worldId = worldId;
    this.group = new THREE.Group();
    this.group.name = groupName;
    this.scene.add(this.group);
    const [a, b] = defaultWorldSpan(worldId);
    this.origin = a;
    this.streamMin = a;
    this.streamMax = b;
    this.fade = getWorldFade(worldId);
    this.fade.setRange(a, b);
  }

  // -------------------------------------------------------------------------
  // Contract
  // -------------------------------------------------------------------------

  public setStreamRange(minZ: number, maxZ: number): void {
    this.streamMin = minZ;
    this.streamMax = maxZ;
    this.fade.setRange(minZ, maxZ);
    // Drop chunks that now lie completely outside the range
    for (const chunk of Array.from(this.chunks.values())) {
      if (chunk.z0 >= maxZ || chunk.z1 <= minZ) this.releaseChunk(chunk);
    }
    this.lastStreamKey = Number.NaN;
  }

  public getStreamRange(): [number, number] {
    return [this.streamMin, this.streamMax];
  }

  /** Debug: when an array, every warm step appends [worldId, step, ms]. */
  public static warmLog: Array<[string, number | string, number]> | null = null;

  public warmup(budgetMs: number): boolean {
    if (this.disposed) return true;
    this.ensureQueue();
    const t0 = now();
    const log = StreamedWorld.warmLog;
    // Deferred construction: at least one step per call, then stop at the budget
    while (this.warmIter || this.warmIndex < this.warmQueue.length) {
      const ts = now();
      this.stepWarm();
      if (log) log.push([this.worldId, this.warmIndex - 1, now() - ts]);
      if (now() - t0 >= budgetMs) return false;
    }
    if (!this.kitReady) {
      const ts = now();
      this.finishKit();
      if (log) log.push([this.worldId, 'pools', now() - ts]);
      if (now() - t0 >= budgetMs) return false;
    }
    // Pre-spawn the first chunks of the range (at least one per call)
    const startZ = Number.isFinite(this.lastPlayerZ)
      ? Math.max(this.streamMin, this.lastPlayerZ - this.behindDist)
      : this.streamMin;
    const endZ = Math.min(this.streamMax, startZ + Math.min(this.aheadDist, PRESPAWN_LENGTH));
    do {
      const idx = this.nextMissingChunk(startZ, endZ);
      if (idx === null) return true;
      const ts = now();
      this.spawnIndex(idx);
      this.flushPools();
      if (log) log.push([this.worldId, 'chunk', now() - ts]);
    } while (now() - t0 < budgetMs);
    return this.nextMissingChunk(startZ, endZ) === null;
  }

  public prepare(): Promise<void> {
    if (this.preparePromise) return this.preparePromise;
    this.preparePromise = preloadWorldAssets(this.worldId).then(() => {
      if (this.disposed) return;
      this.assetsLoaded = true;
      if (this.kitReady) this.applyAssetsOnce();
    });
    return this.preparePromise;
  }

  public update(playerZ: number, dt: number, time: number, graphicsConfig: GraphicsConfig): void {
    if (this.disposed) return;
    this.graphicsConfig = graphicsConfig;
    if (!this.kitReady) this.runAllWarm();
    // Fallback if the engine never called prepare(): start fetching the scans now
    if (!this.preparePromise && typeof document !== 'undefined') void this.prepare();
    this.lastPlayerZ = playerZ;
    this.fade.follow(playerZ);
    this.stream(playerZ);
    this.animate(playerZ, dt, time);
    this.flushPools();
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const chunk of Array.from(this.chunks.values())) this.releaseChunk(chunk);
    this.chunks.clear();
    for (const p of this.pools) p.dispose();
    this.pools = [];
    this.disposeWorld();
    this.scene.remove(this.group);
    this.group.clear();
    releaseWorldTextures(this.worldId);
  }

  // -------------------------------------------------------------------------
  // Subclass hooks
  // -------------------------------------------------------------------------

  /** Deferred construction steps (each should take a few ms at most). */
  protected abstract warmTasks(): WarmTask[];
  /** Called once all warm tasks ran (create pools etc. may also live here). */
  protected onKitReady(): void {}
  /** Swap scanned textures / models into the existing materials and pools. */
  protected abstract applyScannedAssets(): void;
  protected abstract spawnChunk(chunk: StreamChunk): void;
  /** Per-frame animation (atmosphere, emissive pulses, ...). */
  protected abstract animate(playerZ: number, dt: number, time: number): void;
  /** Release subsystems (atmosphere, decorations); chunks and pools are already gone. */
  protected abstract disposeWorld(): void;

  // -------------------------------------------------------------------------
  // Helpers for subclasses
  // -------------------------------------------------------------------------

  protected addPool(pool: InstancePool): InstancePool {
    this.pools.push(pool);
    this.group.add(pool.mesh);
    return pool;
  }

  /**
   * Adds an instance to `pool` and records it on the chunk. Shadow casters
   * whose footprint comes within SHADOW_EDGE_MARGIN of a range end are skipped.
   */
  protected place(chunk: StreamChunk, pool: InstancePool | null, matrix: THREE.Matrix4, color?: THREE.Color): boolean {
    if (!pool) return false;
    if (pool.wantsShadow && !this.shadowSafe(pool, matrix)) return false;
    const h = pool.add(matrix, color);
    if (!h) return false;
    chunk.handles.push(h);
    return true;
  }

  /**
   * Places one multi-part structure (one pool per part, same transform). All
   * parts or none: if any shadow-casting part is too close to a range end the
   * whole structure is skipped.
   */
  protected placeParts(chunk: StreamChunk, pools: Array<InstancePool | null>, matrix: THREE.Matrix4): boolean {
    for (const p of pools) if (p && p.wantsShadow && !this.shadowSafe(p, matrix)) return false;
    let ok = false;
    for (const p of pools) {
      if (!p) continue;
      const h = p.add(matrix);
      if (h) {
        chunk.handles.push(h);
        ok = true;
      }
    }
    return ok;
  }

  /** True when a caster at `matrix` stays SHADOW_EDGE_MARGIN clear of both range ends. */
  protected shadowSafe(pool: InstancePool, matrix: THREE.Matrix4): boolean {
    const e = matrix.elements;
    const sx = Math.hypot(e[0], e[1], e[2]);
    const sz = Math.hypot(e[8], e[9], e[10]);
    const r = pool.horizontalReach() * Math.max(sx, sz) + SHADOW_EDGE_MARGIN;
    const z = e[14];
    return z - r >= this.streamMin && z + r < this.streamMax;
  }

  protected addObject(chunk: StreamChunk, obj: THREE.Object3D): void {
    this.group.add(obj);
    chunk.objects.push(obj);
  }

  /** True when [z - r, z + r] lies inside the stream range. */
  protected inRange(z: number, r = 0): boolean {
    return z - r >= this.streamMin && z + r < this.streamMax;
  }

  /**
   * Road-spanning structures (arches, gates) must not compete with the world
   * portals: never within 300 m of a world boundary or of the range ends.
   */
  protected canSpanRoad(z: number): boolean {
    if (nearWorldBoundary(z, 300)) return false;
    return z - 300 >= this.streamMin && z + 300 < this.streamMax;
  }

  /** Whether the rider is inside (or right at the edge of) this world's range. */
  protected playerInRange(playerZ: number, margin = 30): boolean {
    return playerZ >= this.streamMin - margin && playerZ < this.streamMax + margin;
  }

  protected get shadows(): boolean {
    return this.graphicsConfig.enableShadows;
  }

  protected get preset(): GraphicsConfig['preset'] {
    return this.graphicsConfig.preset;
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  private ensureQueue(): void {
    if (this.warmQueued) return;
    this.warmQueued = true;
    this.warmQueue = this.warmTasks();
  }

  /** Runs one task, or one step of a generator task. */
  private stepWarm(): void {
    if (this.warmIter) {
      if (this.warmIter.next().done) this.warmIter = null;
      return;
    }
    const r = this.warmQueue[this.warmIndex++]();
    if (r && typeof (r as Iterator<unknown>).next === 'function') {
      this.warmIter = r as Iterator<unknown>;
      if (this.warmIter.next().done) this.warmIter = null;
    }
  }

  private runAllWarm(): void {
    this.ensureQueue();
    while (this.warmIter || this.warmIndex < this.warmQueue.length) this.stepWarm();
    this.finishKit();
  }

  private finishKit(): void {
    if (this.kitReady) return;
    this.kitReady = true;
    this.onKitReady();
    if (this.assetsLoaded) this.applyAssetsOnce();
  }

  private applyAssetsOnce(): void {
    if (this.assetsApplied || this.disposed) return;
    this.assetsApplied = true;
    this.applyScannedAssets();
  }

  private flushPools(): void {
    const shadows = this.graphicsConfig.enableShadows;
    for (let i = 0; i < this.pools.length; i++) {
      const p = this.pools[i];
      p.mesh.castShadow = p.wantsShadow && shadows;
      p.flush();
    }
  }

  private chunkIndexAt(z: number): number {
    return Math.floor((z - this.origin) / this.chunkLength);
  }

  private nextMissingChunk(fromZ: number, toZ: number): number | null {
    if (!(toZ > fromZ)) return null;
    const i0 = this.chunkIndexAt(fromZ);
    const i1 = this.chunkIndexAt(toZ - 1e-6);
    for (let i = i0; i <= i1; i++) {
      if (!this.chunks.has(i) && this.chunkIntersectsRange(i)) return i;
    }
    return null;
  }

  private chunkIntersectsRange(i: number): boolean {
    const z0 = this.origin + i * this.chunkLength;
    return z0 < this.streamMax && z0 + this.chunkLength > this.streamMin;
  }

  private spawnIndex(i: number): void {
    const L = this.chunkLength;
    const z0 = this.origin + i * L;
    const chunk: StreamChunk = { index: i, z0, z1: z0 + L, centerZ: z0 + L * 0.5, objects: [], handles: [] };
    this.chunks.set(i, chunk);
    this.spawnChunk(chunk);
  }

  protected releaseChunk(chunk: StreamChunk): void {
    for (const o of chunk.objects) o.removeFromParent();
    for (const h of chunk.handles) h.pool.remove(h);
    chunk.objects.length = 0;
    chunk.handles.length = 0;
    this.chunks.delete(chunk.index);
  }

  private stream(playerZ: number): void {
    // Re-evaluate only when the rider moved a few metres (or the range changed)
    const key = Math.floor(playerZ / 5);
    if (key === this.lastStreamKey) return;
    this.lastStreamKey = key;

    const lo = Math.max(playerZ - this.behindDist, this.streamMin);
    const hi = Math.min(playerZ + this.aheadDist, this.streamMax);

    // Keep chunks pre-spawned by warmup() ahead of the rider (they are still
    // inside the distance fade); only drop what is behind, out of range, or
    // implausibly far ahead.
    // While the rider has not reached the range yet, the pre-spawned start of
    // the range ([streamMin, streamMin + PRESPAWN_LENGTH)) is always kept, so
    // the engine's hidden pre-warm is never thrown away and re-spawned.
    const farLimit = playerZ + this.aheadDist + 800;
    const keepEnd = playerZ < this.streamMin ? this.streamMin + PRESPAWN_LENGTH : -Infinity;
    for (const chunk of this.chunks.values()) {
      if (chunk.z0 >= this.streamMax || chunk.z1 <= this.streamMin) {
        this.releaseChunk(chunk);
        continue;
      }
      if (chunk.z0 < keepEnd) continue;
      if (chunk.z1 <= lo || chunk.z0 >= farLimit) this.releaseChunk(chunk);
    }
    if (!(hi > lo)) return;

    // Everything near the rider spawns at once; far chunks (still inside the
    // fade band) one per evaluation to spread the cost over frames.
    const urgentEnd = Math.min(hi, playerZ + 220);
    let idx = this.nextMissingChunk(lo, urgentEnd);
    while (idx !== null) {
      this.spawnIndex(idx);
      idx = this.nextMissingChunk(lo, urgentEnd);
    }
    idx = this.nextMissingChunk(lo, hi);
    if (idx !== null) {
      this.spawnIndex(idx);
      // keep evaluating next frame until all far chunks exist
      this.lastStreamKey = Number.NaN;
    }
  }
}
