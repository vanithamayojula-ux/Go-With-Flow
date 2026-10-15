import * as THREE from 'three';
import type { MembraneSharedUniforms } from './PortalGateway';

/** Rectangle on screen (render-target pixels, y from the top). */
interface PixelRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface WindowPassParams {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  /** Size of the main scene target (drawing-buffer pixels). */
  width: number;
  height: number;
  /** Resolution of the window relative to the main target (0.5 / 0.25). */
  scale: number;
  /** World z of the portal plane; geometry in front of it is clipped. */
  planeZ: number;
  /** Opening bounds in world space (for the screen rectangle). */
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  /** Draws the scene with the destination's atmosphere (SkyManager.withAtmosphere). */
  withDestination: (draw: () => void) => void;
  /** Objects hidden during the pass (current world, gateway, rider...). */
  hide: readonly (readonly THREE.Object3D[])[];
}

const _v = new THREE.Vector3();
const _plane = new THREE.Plane();

/**
 * The view through the portal: the scene drawn from the main camera, with
 * the destination world's sky, fog, sun and environment, into a reduced
 * resolution linear HDR target (same format as the main scene target, so it
 * goes through the same tone mapping in the final pass).
 *
 * Only the gateway opening's screen rectangle is rendered: a camera with the
 * same pose and projection, restricted to that sub-rectangle with
 * setViewOffset (pixel-exact with the main view; frustum culling then also
 * drops everything outside the opening). Its near plane is replaced by the
 * portal plane (oblique near-plane clipping, which only changes the depth row
 * of the projection), so nothing on this side of the gateway - the rider,
 * obstacles, the current world - can leak into the window. No shadow-map
 * update in this pass: the main pass's map is reused.
 */
export class PortalWindow {
  readonly uniforms: MembraneSharedUniforms = {
    tWindow: { value: null },
    uRect: { value: new THREE.Vector4(0, 0, 1, 1) },
    uWinScale: { value: new THREE.Vector2(1, 1) },
    uWinTexel: { value: new THREE.Vector2(1, 1) },
    uLive: { value: 0 },
    uExposure: { value: 1 },
    uTime: { value: 0 },
  };

  private target: THREE.WebGLRenderTarget | null = null;
  private camera = new THREE.PerspectiveCamera();
  private rect: PixelRect = { x: 0, y: 0, w: 1, h: 1 };
  private hiddenState: boolean[] = [];
  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene | null = null;
  private readonly draw = () => {
    if (this.renderer && this.scene) this.renderer.render(this.scene, this.camera);
  };
  /** Milliseconds (CPU) of the last pass, for the debug readout. */
  lastMs = 0;

  constructor() {
    this.camera.matrixAutoUpdate = true;
  }

  /** Allocate (or resize) the target for a main target of width x height. */
  ensureTarget(renderer: THREE.WebGLRenderer, width: number, height: number): THREE.WebGLRenderTarget {
    // Sized for the half-resolution case; lower scales use a sub-viewport.
    const w = Math.max(1, Math.ceil(width * 0.5));
    const h = Math.max(1, Math.ceil(height * 0.5));
    if (!this.target) {
      this.target = new THREE.WebGLRenderTarget(w, h, {
        type: THREE.HalfFloatType,
        format: THREE.RGBAFormat,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        depthBuffer: true,
        samples: 0,
      });
      this.target.texture.name = 'PortalWindow';
      this.target.texture.generateMipmaps = false;
      this.uniforms.tWindow.value = this.target.texture;
      // Allocate the GL storage now (not on the first visible frame).
      const prev = renderer.getRenderTarget();
      renderer.setRenderTarget(this.target);
      renderer.clear(true, true, false);
      renderer.setRenderTarget(prev);
    } else if (this.target.width !== w || this.target.height !== h) {
      this.target.setSize(w, h);
    }
    this.uniforms.uWinTexel.value.set(1 / w, 1 / h);
    return this.target;
  }

  /**
   * Screen rectangle of the opening (expanded a few pixels for the rim
   * ripple), or null when it is entirely off screen.
   */
  private computeRect(cam: THREE.PerspectiveCamera, p: WindowPassParams): PixelRect | null {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let behind = false;
    for (let i = 0; i < 4; i++) {
      _v.set(i & 1 ? p.maxX : p.minX, i & 2 ? p.maxY : p.minY, p.planeZ);
      _v.applyMatrix4(cam.matrixWorldInverse);
      if (_v.z > -cam.near) {
        behind = true;
        break;
      }
      _v.applyMatrix4(cam.projectionMatrix);
      const sx = (_v.x * 0.5 + 0.5) * p.width;
      const sy = (0.5 - _v.y * 0.5) * p.height;
      if (sx < minX) minX = sx;
      if (sx > maxX) maxX = sx;
      if (sy < minY) minY = sy;
      if (sy > maxY) maxY = sy;
    }
    const r = this.rect;
    if (behind) {
      r.x = 0;
      r.y = 0;
      r.w = p.width;
      r.h = p.height;
      return r;
    }
    const pad = 6;
    const x0 = Math.max(0, Math.floor(minX) - pad);
    const y0 = Math.max(0, Math.floor(minY) - pad);
    const x1 = Math.min(p.width, Math.ceil(maxX) + pad);
    const y1 = Math.min(p.height, Math.ceil(maxY) + pad);
    if (x1 - x0 < 1 || y1 - y0 < 1) return null;
    r.x = x0;
    r.y = y0;
    r.w = x1 - x0;
    r.h = y1 - y0;
    return r;
  }

  /** Replace the near plane by the portal plane (Lengyel's oblique clipping). */
  private applyObliqueNearPlane(cam: THREE.PerspectiveCamera, planeZ: number): void {
    // Keep z >= planeZ: n = +Z, n.p + c >= 0.
    _plane.normal.set(0, 0, 1);
    _plane.constant = -planeZ;
    _plane.applyMatrix4(cam.matrixWorldInverse);
    const cx = _plane.normal.x;
    const cy = _plane.normal.y;
    const cz = _plane.normal.z;
    const cw = _plane.constant;
    const e = cam.projectionMatrix.elements;
    const qx = (Math.sign(cx) + e[8]) / e[0];
    const qy = (Math.sign(cy) + e[9]) / e[5];
    const qz = -1;
    const qw = (1 + e[10]) / e[14];
    const d = cx * qx + cy * qy + cz * qz + cw * qw;
    if (!(d > 1e-6)) return; // degenerate (plane through the camera): keep the plain projection
    const s = 2 / d;
    e[2] = cx * s;
    e[6] = cy * s;
    e[10] = cz * s + 1;
    e[14] = cw * s;
    cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
  }

  /**
   * Render the window for this frame. Returns false (nothing drawn) when the
   * opening is off screen. Allocation free.
   */
  render(p: WindowPassParams): boolean {
    const t0 = performance.now();
    const main = p.camera;
    main.updateMatrixWorld();
    const rect = this.computeRect(main, p);
    if (!rect) return false;
    const target = this.ensureTarget(p.renderer, p.width, p.height);

    // Same pose and lens as the main camera, restricted to the rectangle.
    const cam = this.camera;
    cam.position.copy(main.position);
    cam.quaternion.copy(main.quaternion);
    cam.scale.copy(main.scale);
    cam.fov = main.fov;
    cam.aspect = main.aspect;
    cam.near = main.near;
    cam.far = main.far;
    cam.zoom = main.zoom;
    cam.filmGauge = main.filmGauge;
    cam.filmOffset = main.filmOffset;
    cam.layers.mask = main.layers.mask;
    cam.setViewOffset(p.width, p.height, rect.x, rect.y, rect.w, rect.h); // updates the projection
    cam.updateMatrixWorld();
    this.applyObliqueNearPlane(cam, p.planeZ);

    const vw = Math.max(1, Math.min(target.width, Math.round(rect.w * p.scale)));
    const vh = Math.max(1, Math.min(target.height, Math.round(rect.h * p.scale)));
    target.viewport.set(0, 0, vw, vh);
    target.scissor.set(0, 0, vw, vh);
    target.scissorTest = true;

    const u = this.uniforms;
    // Bottom-origin rectangle for gl_FragCoord.
    u.uRect.value.set(rect.x, p.height - (rect.y + rect.h), rect.w, rect.h);
    u.uWinScale.value.set(vw / target.width, vh / target.height);

    const r = p.renderer;
    const shadow = r.shadowMap;
    const prevTarget = r.getRenderTarget();
    const prevAuto = shadow.autoUpdate;
    const prevNeeds = shadow.needsUpdate;
    shadow.autoUpdate = false;
    shadow.needsUpdate = false;

    // Hide (and later restore) everything that must not appear in the window.
    const hidden = this.hiddenState;
    let k = 0;
    for (const list of p.hide) {
      for (const o of list) {
        hidden[k++] = o.visible;
        o.visible = false;
      }
    }

    this.renderer = r;
    this.scene = p.scene;
    try {
      r.setRenderTarget(target);
      p.withDestination(this.draw);
    } finally {
      k = 0;
      for (const list of p.hide) {
        for (const o of list) o.visible = hidden[k++];
      }
      r.setRenderTarget(prevTarget);
      shadow.autoUpdate = prevAuto;
      shadow.needsUpdate = prevNeeds;
      this.renderer = null;
      this.scene = null;
    }
    this.lastMs = performance.now() - t0;
    return true;
  }

  dispose(): void {
    this.target?.dispose();
    this.target = null;
    this.uniforms.tWindow.value = null;
  }
}
