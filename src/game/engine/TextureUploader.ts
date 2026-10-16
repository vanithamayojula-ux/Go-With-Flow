import * as THREE from 'three';
import { decodeTextureOffThread } from '../../graphics/assetLibrary';

// Pixel data sent to the GPU process per call. Chrome/Edge copy texture data
// through a shared transfer buffer: a single 4 MB upload (1024px RGBA) makes
// it grow, and growing waits for the GPU process to drain every queued frame
// (measured 200-550 ms on an integrated GPU). Slices this size never do.
const SLICE_BYTES = 64 * 1024;
const SLICES_PER_FRAME = 4;
// Shared by every uploader: pixel bytes per second. Pushed faster than the
// GPU process consumes them, the transfer buffer fills and each further call
// waits ~40 ms for it to drain. 8 MB/s still uploads a world's ~9 scanned
// textures in ~5 s, well inside its ~20 s preparation window.
const BYTES_PER_SECOND = 8 * 1024 * 1024;
const BURST_BYTES = 4 * SLICE_BYTES;
// A call that took this long waited on the GPU process: back off a little.
const SLOW_CALL_MS = 4;
const BACKOFF_MS = 120;
// Small textures (1x1 placeholders, data textures) go up whole within this.
const SMALL_BUDGET_MS = 2;

// Textures queued by any uploader (a gateway and its world share scans).
const inFlight = new WeakSet<THREE.Texture>();

// Token bucket shared by all uploaders (world and gateway upload together).
const rate = { allowance: BURST_BYTES, last: 0, backoffUntil: 0 };

function takeBytes(bytes: number, now: number): boolean {
  if (now < rate.backoffUntil) return false;
  rate.allowance = Math.min(BURST_BYTES, rate.allowance + ((now - rate.last) * BYTES_PER_SECOND) / 1000);
  rate.last = now;
  if (rate.allowance < Math.min(bytes, BURST_BYTES)) return false;
  rate.allowance -= bytes;
  return true;
}

function noteCall(ms: number, now: number): void {
  if (ms > SLOW_CALL_MS) rate.backoffUntil = now + BACKOFF_MS;
}

interface SliceJob {
  tex: THREE.Texture;
  data: ImageData;
  row: number;
  allocated: boolean;
}

/**
 * Ahead-of-time GPU uploads for textures a world or gateway is about to draw.
 * Image files are decoded by a worker into raw pixels, the texture's storage
 * is allocated empty, then the pixels go up in 64 KB row slices, rate
 * limited, over a few seconds, and the mip chain is generated on the GPU. Without a worker it falls
 * back to an off-thread ImageBitmap uploaded whole. Textures already on the
 * GPU are skipped.
 */
export class TextureUploader {
  private renderer: THREE.WebGLRenderer;
  private gl: WebGL2RenderingContext | null;
  // Waiting for their pixels.
  private decoding = new Set<THREE.Texture>();
  // Ready to upload whole (placeholders, bitmap fallback).
  private whole: THREE.Texture[] = [];
  private slices: SliceJob[] = [];
  // Wanted here but being uploaded by another uploader (shared scans).
  private elsewhere = new Set<THREE.Texture>();

  constructor(renderer: THREE.WebGLRenderer) {
    this.renderer = renderer;
    const gl = renderer.getContext();
    this.gl = typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext ? gl : null;
  }

  get pending(): number {
    for (const t of this.elsewhere) if (!inFlight.has(t)) this.elsewhere.delete(t);
    return this.decoding.size + this.whole.length + this.slices.length + this.elsewhere.size;
  }

  private uploaded(tex: THREE.Texture): boolean {
    const p = this.renderer.properties.get(tex) as { __version?: number };
    return p.__version === tex.version;
  }

  private has(tex: THREE.Texture): boolean {
    return this.decoding.has(tex) || this.whole.indexOf(tex) !== -1 || this.slices.some(j => j.tex === tex);
  }

  enqueue(tex: THREE.Texture | null | undefined): void {
    if (!tex || !(tex as any).isTexture || this.has(tex)) return;
    if (inFlight.has(tex)) {
      this.elsewhere.add(tex);
      return;
    }
    if ((tex as any).isRenderTargetTexture || (tex as any).isCubeTexture || (tex as any).isVideoTexture) return;
    const img = (tex as any).image;
    // Not loaded yet: it uploads on first use as before.
    if (!img) return;
    const isImg = typeof HTMLImageElement !== 'undefined' && img instanceof HTMLImageElement;
    if (isImg && !img.complete) return;
    if (this.uploaded(tex)) return;
    inFlight.add(tex);
    if (!isImg) {
      this.whole.push(tex);
      return;
    }
    this.decoding.add(tex);
    decodeTextureOffThread(tex).then(data => {
      if (!this.decoding.delete(tex)) {
        inFlight.delete(tex); // cleared meanwhile
        return;
      }
      const plain =
        data && this.gl && !(tex as any).isDataTexture && tex.mipmaps.length === 0 && tex.format === THREE.RGBAFormat && tex.type === THREE.UnsignedByteType;
      if (plain && data) this.slices.push({ tex, data, row: 0, allocated: false });
      else this.whole.push(tex);
    });
  }

  /** Upload what is ready, within a small per-frame budget. */
  pump(): void {
    const t0 = performance.now();
    while (this.whole.length > 0 && performance.now() - t0 < SMALL_BUDGET_MS) {
      const tex = this.whole[0];
      const img = tex.image as { width?: number; height?: number } | null;
      const bytes = (img?.width ?? 1) * (img?.height ?? 1) * 4;
      const now = performance.now();
      if (!takeBytes(bytes, now)) return;
      this.whole.shift();
      inFlight.delete(tex);
      if (!this.uploaded(tex)) {
        try {
          this.renderer.initTexture(tex);
        } catch {
          /* uploads on first use instead */
        }
      }
      const after = performance.now();
      noteCall(after - now, after);
      if (bytes > 64 * 64 * 4) return; // one large whole upload per frame
    }
    let budget = SLICES_PER_FRAME;
    while (budget > 0 && this.slices.length > 0) {
      const now = performance.now();
      if (!takeBytes(SLICE_BYTES, now)) return;
      const job = this.slices[0];
      if (!this.step(job)) {
        this.slices.shift();
        inFlight.delete(job.tex);
      }
      const after = performance.now();
      noteCall(after - now, after);
      if (after < rate.backoffUntil) return;
      budget--;
    }
  }

  /** One slice of a job; false once the job is finished (or abandoned). */
  private step(job: SliceJob): boolean {
    const gl = this.gl!;
    const tex = job.tex;
    const props = this.renderer.properties.get(tex) as { __webglTexture?: WebGLTexture; __version?: number };
    if (!job.allocated) {
      // Already on the GPU (drawn meanwhile): nothing to do.
      if (this.uploaded(tex)) return false;
      // Allocate the storage (and set the sampling parameters) without data.
      const source = tex.source as unknown as { dataReady: boolean };
      source.dataReady = false;
      try {
        this.renderer.initTexture(tex);
      } catch {
        source.dataReady = true;
        return false;
      } finally {
        source.dataReady = true;
      }
      job.allocated = true;
      if (!props.__webglTexture) return false;
    }
    // Disposed or re-uploaded by three meanwhile: drop the job.
    if (!props.__webglTexture || props.__version !== tex.version) return false;
    const { width, height } = job.data;
    if (width !== (tex.image as { width: number }).width || height !== (tex.image as { height: number }).height) {
      // Unexpected size: let three upload it the usual way instead.
      tex.needsUpdate = true;
      return false;
    }
    const state = this.renderer.state;
    state.bindTexture(gl.TEXTURE_2D, props.__webglTexture);
    state.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    state.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    state.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
    const rows = Math.max(1, Math.floor(SLICE_BYTES / (width * 4)));
    const h = Math.min(rows, height - job.row);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, job.row, width, h, gl.RGBA, gl.UNSIGNED_BYTE, job.data.data, job.row * width * 4);
    job.row += h;
    if (job.row < height) return true;
    if (tex.generateMipmaps && tex.minFilter !== THREE.NearestFilter && tex.minFilter !== THREE.LinearFilter) {
      gl.generateMipmap(gl.TEXTURE_2D);
    }
    return false;
  }

  clear(): void {
    // Half-uploaded textures: three uploads them whole on their next use.
    for (const job of this.slices) {
      if (job.allocated) job.tex.needsUpdate = true;
      inFlight.delete(job.tex);
    }
    for (const t of this.decoding) inFlight.delete(t);
    for (const t of this.whole) inFlight.delete(t);
    this.decoding.clear();
    this.elsewhere.clear();
    this.whole.length = 0;
    this.slices.length = 0;
  }
}
