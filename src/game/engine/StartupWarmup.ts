import * as THREE from 'three';
import { GraphicsConfig } from '../../types';
import { WorldId, WORLD_ORDER } from '../WorldConfig';
import type { WorldStreamer } from './WorldStreamer';
import type { ShaderWarmup } from './ShaderWarmup';
import type { PortalSystem } from '../portal/PortalSystem';
import { ObstacleManager } from '../obstacles';

export interface StartupWarmupDeps {
  worlds: WorldStreamer;
  portals: PortalSystem;
  shaders: ShaderWarmup;
  obstacles: ObstacleManager;
  graphicsConfig: () => GraphicsConfig;
}

type Stage = 'build' | 'gateways' | 'assets' | 'compile' | 'compiling' | 'warm' | 'dispose' | 'done';

// Scanned textures/models usually arrive within a second (they were fetched
// while the opening screen was up); past this the warm-up goes on without
// them (anything they change compiles in the background mid-run instead).
const ASSET_WAIT_MS = 5000;

/**
 * Runs once, before the first run starts (the rider waits at the start line):
 * builds every other world and every gateway style once, hidden, compiles all
 * their shader programs in the background, draws each once off screen (main
 * and shadow pass: on ANGLE/D3D11 some programs only finish on their first
 * draw), then throws the instances away. ShaderWarmup keeps the programs, so
 * nothing mid-run ever links a shader: each world ahead of its gateway only
 * builds geometry and uploads textures, a few milliseconds per frame.
 *
 * One step per frame, so the start screen keeps rendering.
 */
export class StartupWarmup {
  private deps: StartupWarmupDeps;
  private stage: Stage = 'build';
  private queue: WorldId[];
  private roots: THREE.Object3D[][] = [];
  private warmIndex = 0;
  private assetDeadline = 0;
  private obstacleGroup: THREE.Group | null = null;
  readonly startedAt = performance.now();

  constructor(deps: StartupWarmupDeps) {
    this.deps = deps;
    const current = deps.worlds.currentWorldId;
    this.queue = WORLD_ORDER.filter(id => id !== current);
  }

  get done(): boolean {
    return this.stage === 'done';
  }

  /** Advance one step; returns true once finished. */
  step(): boolean {
    const d = this.deps;
    switch (this.stage) {
      case 'build': {
        const id = this.queue.shift();
        if (id) {
          const roots = d.worlds.buildPrewarmWorld(id, d.graphicsConfig());
          if (roots && roots.length > 0) this.roots.push(roots);
        }
        if (this.queue.length === 0) this.stage = 'gateways';
        return false;
      }
      case 'gateways':
        for (const g of d.portals.buildPrewarmGateways()) this.roots.push([g]);
        // Every obstacle material (types not on the road yet included).
        this.obstacleGroup = d.obstacles.buildWarmupGroup();
        this.roots.push([this.obstacleGroup]);
        this.assetDeadline = performance.now() + ASSET_WAIT_MS;
        this.stage = 'assets';
        return false;
      case 'assets':
        if (
          (d.worlds.prewarmAssetsSettled && d.portals.prewarmAssetsSettled && !ObstacleManager.isPreloading) ||
          performance.now() > this.assetDeadline
        ) {
          // The obstacle GLB models (both LOD levels), if they are in.
          if (ObstacleManager.isPreloadComplete) {
            for (const t of ObstacleManager.cachedTemplates) this.roots.push([t.pivot]);
          }
          this.stage = 'compile';
        }
        return false;
      case 'compile': {
        this.stage = 'compiling';
        const all: THREE.Object3D[] = [];
        for (const r of this.roots) for (const o of r) all.push(o);
        d.shaders.compile(all).then(() => {
          if (this.stage === 'compiling') this.stage = 'warm';
        });
        return false;
      }
      case 'compiling':
        return false;
      case 'warm':
        // First draws are synchronous: only with nothing else linking.
        if (d.shaders.busy) return false;
        if (this.warmIndex < this.roots.length) {
          d.shaders.warmDraw(this.roots[this.warmIndex++], () => true);
          return false;
        }
        this.stage = 'dispose';
        return false;
      case 'dispose':
        if (d.worlds.disposeNextPrewarmWorld()) return false;
        d.portals.disposePrewarmGateways();
        this.disposeObstacleGroup();
        this.roots.length = 0;
        this.stage = 'done';
        return true;
      case 'done':
        return true;
    }
  }

  /** Stop early (engine disposed / reset): drop the warm-up instances. */
  cancel(): void {
    while (this.deps.worlds.disposeNextPrewarmWorld()) {
      /* all of them */
    }
    this.deps.portals.disposePrewarmGateways();
    this.disposeObstacleGroup();
    this.roots.length = 0;
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
