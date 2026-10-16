import * as THREE from 'three';
import { WorldId, WORLD_ORDER, WORLD_LENGTH_DISTANCE } from '../WorldConfig';
import { SkyManager, getAtmosphereInfo } from '../sky';
import { StreamFade, FAR_FADE_END } from '../worlds/shared/distanceFade';
import { NEXT_WORLD_LEAD } from '../engine/WorldStreamer';
import { GATEWAY, GATEWAY_CROWN_Y } from './gatewayStyles';
import { PortalGateway } from './PortalGateway';
import { PortalWindow } from './PortalWindow';
import { TextureUploader } from '../engine/TextureUploader';

export interface PortalSystemDeps {
  scene: THREE.Scene;
  renderer: THREE.WebGLRenderer;
  sky: SkyManager;
  /** Async main + shadow-pass compile (ShaderWarmup.compile). */
  compile: (roots: THREE.Object3D[]) => Promise<void>;
  /** One off-screen draw (ShaderWarmup.warmDraw). */
  warmDraw: (roots: THREE.Object3D[]) => void;
  /** Roots of the current world (hidden in the window pass). */
  currentWorldRoots: () => readonly THREE.Object3D[];
  /** Shaders are linking: hold back synchronous GL work (uploads, first draws). */
  isBusy?: () => boolean;
}

export interface PortalCrossing {
  /** World entered. */
  worldId: WorldId;
  /** Boundary distance (m). */
  boundaryZ: number;
}

export interface PortalWindowOptions {
  camera: THREE.PerspectiveCamera;
  /** Main scene target size (drawing-buffer pixels). */
  width: number;
  height: number;
  /** Live window pass (post-processing on, not the lowest tier). */
  live: boolean;
  /** Window resolution relative to the main target (0.5 or 0.25). */
  scale: number;
  /** Extra objects hidden in the window pass (the rider, warp FX). */
  hide: readonly THREE.Object3D[];
}

type Phase = 'build' | 'compile' | 'compiling' | 'upload' | 'warm' | 'ready';

interface GatewaySlot {
  gate: PortalGateway;
  iter: Generator<void, void, unknown> | null;
  phase: Phase;
  crossed: boolean;
  uploads: THREE.Texture[];
  texturesCollected: boolean;
}

// The gateway (and its beam) start fading in this far out; the stone and
// membrane follow the far scenery band (fully visible inside ~640 m).
const BEAM_FADE_START = NEXT_WORLD_LEAD - 40;
const BEAM_FADE_LENGTH = 220;
const BEAM_INTENSITY = 0.8;
const WINDOW_CLIP_MARGIN = 3;
// Crossed gateways are removed once the rider is this far past them.
const REMOVE_BEHIND = 70;
// Don't wait for scanned textures past this distance to the gateway (they
// normally arrive within a second; the stone shows its fallback until then).
const TEXTURE_WAIT_UNTIL = FAR_FADE_END + 40;

const _tintTop = new THREE.Color();
const _tintHorizon = new THREE.Color();

/**
 * World-change portals. One monumental gateway stands across the road at each
 * world boundary (k x WORLD_LENGTH_DISTANCE), themed by the world it leads to.
 * It is built alongside the next world (~900 m ahead), compiled and uploaded
 * while still invisible, then fades in with the far scenery. Through its
 * opening the rider sees the next world under that world's own sky (see
 * PortalWindow). Crossing the boundary plane - at any lane, height or speed -
 * is the world switch; update() reports it on that exact frame.
 */
export class PortalSystem {
  private deps: PortalSystemDeps;
  private slots: GatewaySlot[] = [];
  private fade = new StreamFade();
  private window = new PortalWindow();
  private lastZ = Number.NaN;
  private playerZ = 0;
  private currentWorld: WorldId = 'sky-isles';
  // Reused per frame (allocation free window pass).
  private hideLists: (readonly THREE.Object3D[])[] = [[], []];
  private ownHidden: THREE.Object3D[] = [];
  private readonly withDestination = (draw: () => void) => {
    const slot = this.upcoming;
    if (slot) this.deps.sky.withAtmosphere(slot.gate.worldId, draw);
    else draw();
  };
  private upcoming: GatewaySlot | null = null;
  // Main target size seen by the last renderWindow() (to allocate ahead).
  private lastWidth = 0;
  private lastHeight = 0;
  private disposed = false;
  private uploader: TextureUploader;

  constructor(deps: PortalSystemDeps) {
    this.deps = deps;
    this.uploader = new TextureUploader(deps.renderer);
    this.fade.setRange(-Infinity, Infinity);
  }

  /** The gateway ahead (debug / tests). */
  get nextGateway(): PortalGateway | null {
    const s = this.findUpcoming();
    return s ? s.gate : null;
  }

  /** Preparation phase of the gateway ahead (debug readout). */
  get phase(): string {
    const s = this.findUpcoming();
    return s ? s.phase : '-';
  }

  /** CPU time of the last window pass (ms). */
  get windowMs(): number {
    return this.window.lastMs;
  }

  private findUpcoming(): GatewaySlot | null {
    for (const s of this.slots) if (!s.crossed) return s;
    return null;
  }

  /**
   * Per frame, after the rider moved. Returns the crossing when the rider's
   * z passed a world boundary this frame (the same frame the world manager
   * switches the current world), else null.
   */
  update(playerZ: number, timeSeconds: number, currentWorldId: WorldId): PortalCrossing | null {
    if (this.disposed) return null;
    const z = playerZ;
    this.playerZ = z;
    this.currentWorld = currentWorldId;
    this.fade.follow(z);
    this.window.uniforms.uTime.value = timeSeconds;

    // 1. Crossing: the boundary plane spans the whole road, so only z matters.
    let crossing: PortalCrossing | null = null;
    const L = WORLD_LENGTH_DISTANCE;
    if (Number.isFinite(this.lastZ) && z > this.lastZ) {
      const from = Math.floor(Math.max(0, this.lastZ) / L);
      const to = Math.floor(Math.max(0, z) / L);
      if (to > from && from + 1 < WORLD_ORDER.length) {
        const index = Math.min(to, WORLD_ORDER.length - 1);
        crossing = { worldId: WORLD_ORDER[index], boundaryZ: index * L };
      }
    }
    this.lastZ = z;
    for (const s of this.slots) {
      if (!s.crossed && z >= s.gate.boundaryZ) {
        s.crossed = true;
        // Through: the opening is just an arch now (the new world is all around).
        if (s.gate.membrane) s.gate.membrane.visible = false;
      } else if (s.crossed && z < s.gate.boundaryZ) {
        // Rewound before it (debug teleport): it is a gateway again.
        s.crossed = false;
        if (s.gate.membrane) s.gate.membrane.visible = true;
      }
    }

    // 2. Lifecycle: keep the gateway ahead (within the lead) and the one just
    // crossed (until it is well behind); drop anything else.
    const k = Math.floor(Math.max(0, z) / L);
    const nextIndex = k + 1;
    const aheadB = nextIndex < WORLD_ORDER.length ? nextIndex * L : Infinity;
    let w = 0;
    for (let r = 0; r < this.slots.length; r++) {
      const s = this.slots[r];
      const B = s.gate.boundaryZ;
      const keep = (B === aheadB && B - z <= NEXT_WORLD_LEAD + 60) || (s.crossed && z - B <= REMOVE_BEHIND);
      if (keep) this.slots[w++] = s;
      else {
        if (s.phase === 'upload') this.uploader.clear();
        s.gate.dispose();
      }
    }
    this.slots.length = w;
    if (aheadB !== Infinity && aheadB - z <= NEXT_WORLD_LEAD && !this.slots.some(s => s.gate.boundaryZ === aheadB)) {
      this.slots.push(this.create(WORLD_ORDER[nextIndex], aheadB));
    }

    // 3. Prepare / animate.
    this.upcoming = this.findUpcoming();
    for (const s of this.slots) {
      if (s.phase !== 'ready') this.advance(s, s.gate.boundaryZ - z);
      const beam = s.gate.beamUniforms;
      beam.uTime.value = timeSeconds;
      const f = THREE.MathUtils.clamp((BEAM_FADE_START - (s.gate.boundaryZ - z)) / BEAM_FADE_LENGTH, 0, 1);
      beam.uIntensity.value = BEAM_INTENSITY * f * f * (3 - 2 * f);
    }
    return crossing;
  }

  private create(worldId: WorldId, boundaryZ: number): GatewaySlot {
    const gate = new PortalGateway(worldId, boundaryZ, { fade: this.fade, membrane: this.window.uniforms });
    return { gate, iter: gate.build(), phase: 'build', crossed: false, uploads: [], texturesCollected: false };
  }

  /** One preparation step per frame; nothing here can stall a frame for long. */
  private advance(s: GatewaySlot, dist: number): void {
    const g = s.gate;
    switch (s.phase) {
      case 'build': {
        const t0 = performance.now();
        while (s.iter && performance.now() - t0 < 3) {
          if (s.iter.next().done) {
            s.iter = null;
            break;
          }
        }
        if (s.iter) return;
        // Static window tint (lowest tier): the destination's sky and haze.
        const info = getAtmosphereInfo(g.worldId);
        _tintTop.copy(info.skyColor).multiplyScalar(1.6);
        _tintHorizon.copy(info.fogColor).multiplyScalar(1.4);
        g.setStaticTint(_tintTop, _tintHorizon);
        g.group.visible = false;
        this.deps.scene.add(g.group);
        g.group.updateMatrixWorld(true);
        s.phase = 'compile';
        return;
      }
      case 'compile':
        s.phase = 'compiling';
        this.deps.compile([g.group]).then(() => {
          if (s.phase === 'compiling') s.phase = 'upload';
        });
        return;
      case 'compiling':
        return;
      case 'upload': {
        if (!g.texturesSettled && dist > TEXTURE_WAIT_UNTIL) return;
        // Texture uploads are synchronous: never while anything is linking.
        if (this.deps.isBusy && this.deps.isBusy()) return;
        if (!s.texturesCollected) {
          g.collectTextures(s.uploads);
          s.texturesCollected = true;
          for (const t of s.uploads) this.uploader.enqueue(t);
          s.uploads.length = 0;
        }
        // Decoded off the main thread, then one upload per frame.
        this.uploader.pump();
        if (this.uploader.pending > 0) return;
        s.phase = 'warm';
        return;
      }
      case 'warm':
        if (this.deps.isBusy && this.deps.isBusy()) return;
        // First real draw off screen (some programs finish linking on it),
        // and the window target allocated, before any of it is visible.
        this.deps.warmDraw([g.group]);
        if (this.lastWidth > 0) this.window.ensureTarget(this.deps.renderer, this.lastWidth, this.lastHeight);
        s.phase = 'ready';
        g.group.visible = true;
        return;
      case 'ready':
        return;
    }
  }

  /**
   * Render the view through the upcoming gateway (call right before the main
   * scene pass, after the camera is final for the frame).
   */
  renderWindow(o: PortalWindowOptions): void {
    const u = this.window.uniforms;
    this.lastWidth = o.width;
    this.lastHeight = o.height;
    const s = this.upcoming;
    if (!s || s.phase !== 'ready' || s.crossed || !s.gate.membrane) {
      u.uLive.value = 0;
      return;
    }
    const dist = s.gate.boundaryZ - this.playerZ;
    // Beyond the far fade band nothing of it is drawn yet.
    if (!o.live || dist > FAR_FADE_END + 20) {
      u.uLive.value = 0;
      return;
    }
    u.uExposure.value = getAtmosphereInfo(s.gate.worldId).exposure / Math.max(1e-3, getAtmosphereInfo(this.currentWorld).exposure);

    const own = this.ownHidden;
    own.length = 0;
    // The whole gateway: drawn at the window's reduced resolution its stone
    // would show as a jagged second copy along the rim.
    own.push(s.gate.group);
    for (const h of o.hide) own.push(h);
    this.hideLists[0] = this.deps.currentWorldRoots();
    this.hideLists[1] = own;

    const W = GATEWAY.OPEN_HALF_W;
    const drawn = this.window.render({
      renderer: this.deps.renderer,
      scene: this.deps.scene,
      camera: o.camera,
      width: o.width,
      height: o.height,
      scale: o.scale,
      // Clip a few metres in front of the membrane: the window then always has
      // road (identical in both worlds) under its bottom edge, instead of the
      // open road slab cut by the clip plane bleeding in through filtering.
      planeZ: s.gate.boundaryZ - WINDOW_CLIP_MARGIN,
      minX: -W,
      maxX: W,
      minY: GATEWAY.MEMBRANE_BOTTOM,
      maxY: GATEWAY.SPRING_Y + W,
      withDestination: this.withDestination,
      hide: this.hideLists,
    });
    u.uLive.value = drawn ? 1 : 0;
  }

  // Throw-away gateways built at start-up so every style's programs (lava,
  // ice, sand, snow variants) are linked and first-drawn before the run.
  private prewarmGates: PortalGateway[] = [];

  /** Build (hidden, in the scene) one gateway per boundary; returns their groups. */
  buildPrewarmGateways(): THREE.Object3D[] {
    const groups: THREE.Object3D[] = [];
    const L = WORLD_LENGTH_DISTANCE;
    for (let k = 1; k < WORLD_ORDER.length; k++) {
      try {
        const gate = new PortalGateway(WORLD_ORDER[k], k * L, { fade: this.fade, membrane: this.window.uniforms });
        const it = gate.build();
        while (!it.next().done) {
          /* all of it now */
        }
        gate.group.visible = false;
        this.deps.scene.add(gate.group);
        gate.group.updateMatrixWorld(true);
        this.prewarmGates.push(gate);
        groups.push(gate.group);
      } catch (err) {
        console.warn('[PortalSystem] warm-up gateway failed:', err);
      }
    }
    return groups;
  }

  /** Warm-up gateways have their scanned textures (or gave up loading them). */
  get prewarmAssetsSettled(): boolean {
    return this.prewarmGates.every(g => g.texturesSettled);
  }

  disposePrewarmGateways(): void {
    for (const g of this.prewarmGates) g.dispose();
    this.prewarmGates.length = 0;
  }

  /** New run: drop every gateway. */
  reset(): void {
    this.uploader.clear();
    for (const s of this.slots) s.gate.dispose();
    this.slots.length = 0;
    this.upcoming = null;
    this.lastZ = Number.NaN;
    this.window.uniforms.uLive.value = 0;
  }

  dispose(): void {
    this.reset();
    this.disposePrewarmGateways();
    this.window.dispose();
    this.disposed = true;
  }
}

/** Height of the gateway's crown (HUD/debug helpers). */
export const PORTAL_GATEWAY_HEIGHT = GATEWAY_CROWN_Y;
