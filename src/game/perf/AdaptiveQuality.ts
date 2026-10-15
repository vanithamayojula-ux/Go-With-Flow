/**
 * Adaptive render quality: watches frame time and steps the render resolution
 * (and then MSAA, bloom strength and motion blur) down when the GPU can't hold
 * the target frame rate, and back up when it has headroom. Only render
 * targets change; the canvas CSS size never does.
 *
 * Down: frame-time EMA above ~1.1x the frame budget for 2 s.
 * Up:   holding the target rate for 4 s with measured headroom (GPU timer
 *       when available, else CPU work time).
 * At least 3 s between steps; stepping back down soon after a step up blocks
 * further step ups from that level with an exponential backoff (no thrash).
 */

export interface QualityLevel {
  /** Renderer pixel ratio (render-target pixels per CSS pixel). */
  pixelRatio: number;
  msaa: boolean;
  /** Multiplier on the bloom strength. */
  bloomScale: number;
  motionBlur: boolean;
}

export interface AdaptiveQualityConfig {
  maxPixelRatio: number;
  msaa: boolean;
  targetFps: number;
}

const SCALE_STEPS = [1.5, 1.25, 1.0, 0.85];
const DOWN_SUSTAIN_MS = 2000;
const UP_SUSTAIN_MS = 4000;
const MIN_STEP_INTERVAL_MS = 3000;
const THRASH_WINDOW_MS = 8000;
const BACKOFF_START_MS = 20000;
const BACKOFF_MAX_MS = 300000;
const EMA_ALPHA = 0.06;

export class AdaptiveQuality {
  private levels: QualityLevel[] = [];
  private labels: string[] = [];
  private index = 0;
  private emaFrame = 16.7;
  private emaWork = 4;
  private emaGpu = -1;
  private slowSince = -1;
  private fastSince = -1;
  private lastChange = -Infinity;
  private lastUpAt = -Infinity;
  private upBlockedUntil: number[] = [];
  private backoff: number[] = [];
  private budgetMs = 1000 / 60;
  public enabled = true;

  constructor(cfg: AdaptiveQualityConfig) {
    this.configure(cfg);
  }

  /** Rebuild the ladder (preset / device change). Starts again at the top. */
  configure(cfg: AdaptiveQualityConfig): void {
    const maxPr = Math.max(0.5, cfg.maxPixelRatio);
    const scales: number[] = [maxPr];
    for (const s of SCALE_STEPS) if (s < maxPr - 0.01) scales.push(s);
    const levels: QualityLevel[] = scales.map(pixelRatio => ({ pixelRatio, msaa: cfg.msaa, bloomScale: 1, motionBlur: true }));
    const lowest = scales[scales.length - 1];
    if (cfg.msaa) levels.push({ pixelRatio: lowest, msaa: false, bloomScale: 1, motionBlur: true });
    levels.push({ pixelRatio: lowest, msaa: false, bloomScale: 0.5, motionBlur: false });
    this.levels = levels;
    this.labels = [];
    this.index = 0;
    this.upBlockedUntil = levels.map(() => 0);
    this.backoff = levels.map(() => BACKOFF_START_MS);
    this.budgetMs = 1000 / Math.max(20, cfg.targetFps || 60);
    this.resetTimers();
  }

  get level(): QualityLevel {
    return this.levels[this.index];
  }

  get levelIndex(): number {
    return this.index;
  }

  get frameEmaMs(): number {
    return this.emaFrame;
  }

  /** Short label for the debug readout, e.g. "1.25x" or "0.85x noAA" (cached per level). */
  get label(): string {
    let s = this.labels[this.index];
    if (s === undefined) {
      const l = this.level;
      s = `${l.pixelRatio.toFixed(2)}x`;
      if (!l.msaa && this.levels[0].msaa) s += ' noAA';
      if (l.bloomScale < 1) s += ' lite';
      this.labels[this.index] = s;
    }
    return s;
  }

  /** Forget timing history (after a pause, a reset, a hitch we caused ourselves). */
  resetTimers(): void {
    this.slowSince = -1;
    this.fastSince = -1;
    this.emaFrame = this.budgetMs;
  }

  /** Optional GPU frame time from a timer query (ms). */
  reportGpuTime(ms: number): void {
    this.emaGpu = this.emaGpu < 0 ? ms : this.emaGpu + (ms - this.emaGpu) * 0.1;
  }

  /**
   * Feed one frame. `frameMs` is the rAF-to-rAF delta, `workMs` the CPU time
   * spent in update+render. Returns true when the quality level changed.
   */
  sample(frameMs: number, workMs: number, now: number): boolean {
    if (!this.enabled || this.levels.length === 0) return false;
    // Hitches (tab switches, GC, asset uploads) say nothing about steady load.
    if (!(frameMs > 0) || frameMs > 250) return false;
    this.emaFrame += (frameMs - this.emaFrame) * EMA_ALPHA;
    this.emaWork += (workMs - this.emaWork) * EMA_ALPHA;

    const budget = this.budgetMs;
    const slow = this.emaFrame > budget * 1.1;
    const holding = this.emaFrame < budget * 1.06;
    const headroom = this.emaGpu >= 0 ? this.emaGpu < budget * 0.62 : this.emaWork < budget * 0.45;
    // Without vsync (or on a high-refresh display) the frame time itself shows headroom.
    const clearlyFast = this.emaFrame < budget * 0.72;

    if (slow) {
      this.fastSince = -1;
      if (this.slowSince < 0) this.slowSince = now;
    } else {
      this.slowSince = -1;
      if (clearlyFast || (holding && headroom)) {
        if (this.fastSince < 0) this.fastSince = now;
      } else {
        this.fastSince = -1;
      }
    }

    if (now - this.lastChange < MIN_STEP_INTERVAL_MS) return false;

    if (this.slowSince >= 0 && now - this.slowSince >= DOWN_SUSTAIN_MS && this.index < this.levels.length - 1) {
      // Stepping back down right after a step up: that level is too much.
      if (now - this.lastUpAt < THRASH_WINDOW_MS) {
        const from = this.index;
        this.upBlockedUntil[from + 1] = now + this.backoff[from + 1];
        this.backoff[from + 1] = Math.min(BACKOFF_MAX_MS, this.backoff[from + 1] * 2);
      }
      this.index++;
      this.lastChange = now;
      this.slowSince = -1;
      this.fastSince = -1;
      return true;
    }

    if (
      this.fastSince >= 0 &&
      now - this.fastSince >= UP_SUSTAIN_MS &&
      this.index > 0 &&
      now >= this.upBlockedUntil[this.index]
    ) {
      this.index--;
      this.lastChange = now;
      this.lastUpAt = now;
      this.slowSince = -1;
      this.fastSince = -1;
      return true;
    }
    return false;
  }
}

/**
 * GPU frame timing through EXT_disjoint_timer_query_webgl2 (when the browser
 * exposes it). One query in flight at a time; results arrive a few frames late.
 */
export class GpuTimer {
  private gl: WebGL2RenderingContext | null = null;
  private ext: any = null;
  private query: WebGLQuery | null = null;
  private active = false;

  constructor(gl: WebGLRenderingContext | WebGL2RenderingContext) {
    if (typeof (gl as WebGL2RenderingContext).createQuery !== 'function') return;
    const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
    if (!ext) return;
    this.gl = gl as WebGL2RenderingContext;
    this.ext = ext;
  }

  get supported(): boolean {
    return !!this.ext;
  }

  /** Start timing this frame's GPU work (no-op while a result is pending). */
  begin(): void {
    if (!this.gl || this.query || this.active) return;
    this.query = this.gl.createQuery();
    if (!this.query) return;
    this.gl.beginQuery(this.ext.TIME_ELAPSED_EXT, this.query);
    this.active = true;
  }

  end(): void {
    if (!this.gl || !this.active) return;
    this.gl.endQuery(this.ext.TIME_ELAPSED_EXT);
    this.active = false;
  }

  /** Returns the last frame's GPU time in ms once available, else -1. */
  poll(): number {
    const gl = this.gl;
    if (!gl || !this.query || this.active) return -1;
    if (!gl.getQueryParameter(this.query, gl.QUERY_RESULT_AVAILABLE)) return -1;
    const disjoint = gl.getParameter(this.ext.GPU_DISJOINT_EXT);
    const ns = gl.getQueryParameter(this.query, gl.QUERY_RESULT) as number;
    gl.deleteQuery(this.query);
    this.query = null;
    return disjoint ? -1 : ns / 1e6;
  }

  dispose(): void {
    if (this.gl && this.query) {
      if (this.active) this.gl.endQuery(this.ext.TIME_ELAPSED_EXT);
      this.gl.deleteQuery(this.query);
    }
    this.query = null;
    this.active = false;
  }
}
