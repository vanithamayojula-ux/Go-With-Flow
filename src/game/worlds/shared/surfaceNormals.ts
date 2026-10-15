import * as THREE from 'three';

/**
 * Tileable tangent-space normal maps for natural ground (no external assets).
 *
 * The height field is a sum of wind ripples (asymmetric crests, gentle windward
 * slope and steep lee face, sinuous via a noise warp) and fBm grain. All
 * frequencies are whole numbers of periods per tile so the map wraps cleanly.
 */
export interface RippleNormalOptions {
  size?: number;
  seed?: number;
  /** Ripple wave vector in periods per tile (integers keep it tileable). */
  rippleU?: number;
  rippleV?: number;
  rippleHeight?: number; // relative ripple amplitude
  warp?: number; // sinuosity of the crests (0..0.3)
  grain?: number; // fBm amplitude
  grainScale?: number; // base periods per tile for the fBm
  strength?: number; // slope multiplier when converting to normals
}

function makeLattice(n: number, rnd: () => number) {
  const a = new Float32Array(n * n);
  for (let i = 0; i < a.length; i++) a[i] = rnd();
  return a;
}

export function createRippleNormalMap(opts: RippleNormalOptions = {}): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const size = opts.size ?? 512;
  const rippleU = opts.rippleU ?? 14;
  const rippleV = opts.rippleV ?? 5;
  const rippleH = opts.rippleHeight ?? 1.0;
  const warp = opts.warp ?? 0.18;
  const grain = opts.grain ?? 0.35;
  const grainScale = opts.grainScale ?? 8;
  const strength = opts.strength ?? 1.0;

  let s = (opts.seed ?? 777) * 48271 + 1;
  const rnd = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };

  const octs = [grainScale, grainScale * 2, grainScale * 4, grainScale * 8, grainScale * 16].map((n) => Math.round(n));
  const lats = octs.map((n) => makeLattice(n, rnd));
  const warpLat = makeLattice(4, rnd);
  const sm = (t: number) => t * t * (3 - 2 * t);
  const sample = (lat: Float32Array, n: number, u: number, v: number) => {
    const fx = u * n;
    const fy = v * n;
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const tx = sm(fx - x0);
    const ty = sm(fy - y0);
    const xa = ((x0 % n) + n) % n;
    const ya = ((y0 % n) + n) % n;
    const xb = (xa + 1) % n;
    const yb = (ya + 1) % n;
    const a = lat[ya * n + xa];
    const b = lat[ya * n + xb];
    const c = lat[yb * n + xa];
    const d = lat[yb * n + xb];
    return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
  };

  const h = new Float32Array(size * size);
  for (let py = 0; py < size; py++) {
    const v = py / size;
    for (let px = 0; px < size; px++) {
      const u = px / size;
      // Sinuous crest lines
      const w = (sample(warpLat, 4, u, v) - 0.5) * 2 * warp;
      let phase = (rippleU * u + rippleV * v + w) % 1;
      if (phase < 0) phase += 1;
      // Asymmetric profile: long stoss rise (70 %), short steep lee (30 %)
      const ripple = phase < 0.7 ? phase / 0.7 : 1 - (phase - 0.7) / 0.3;
      let g = 0;
      let amp = 0.5;
      for (let o = 0; o < octs.length; o++) {
        g += (sample(lats[o], octs[o], u, v) - 0.5) * amp;
        amp *= 0.5;
      }
      h[py * size + px] = sm(ripple) * rippleH + g * grain * 2;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const img = ctx.createImageData(size, size);
  const at = (x: number, y: number) => h[(((y % size) + size) % size) * size + (((x % size) + size) % size)];
  const k = strength * size * 0.004;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const dx = (at(px + 1, py) - at(px - 1, py)) * k;
      const dy = (at(px, py + 1) - at(px, py - 1)) * k;
      const inv = 1 / Math.sqrt(dx * dx + dy * dy + 1);
      const o = (py * size + px) * 4;
      img.data[o] = (-dx * inv * 0.5 + 0.5) * 255;
      img.data[o + 1] = (dy * inv * 0.5 + 0.5) * 255;
      img.data[o + 2] = (inv * 0.5 + 0.5) * 255;
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.NoColorSpace;
  tex.anisotropy = 8;
  return tex;
}
