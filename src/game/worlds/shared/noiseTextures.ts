import * as THREE from 'three';
import { createRippleNormalMap, RippleNormalOptions } from './surfaceNormals';

/**
 * Session-wide caches for procedurally generated canvas textures. Each texture
 * is generated once (first use) and reused by every world instance; world
 * dispose() must NOT dispose these.
 *
 * All generators return null without a DOM (Node tests).
 */

function mulberry(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Tileable fBm value noise in [0, 1], `size` x `size`. */
function fbmField(size: number, seed: number, baseCells: number, octaves: number): Float32Array {
  const rnd = mulberry(seed);
  const field = new Float32Array(size * size);
  let amp = 0.5;
  let cells = baseCells;
  let total = 0;
  for (let o = 0; o < octaves; o++) {
    const lat = new Float32Array(cells * cells);
    for (let i = 0; i < lat.length; i++) lat[i] = rnd();
    for (let py = 0; py < size; py++) {
      const fy = (py / size) * cells;
      const y0 = Math.floor(fy);
      let ty = fy - y0;
      ty = ty * ty * (3 - 2 * ty);
      const ya = y0 % cells;
      const yb = (y0 + 1) % cells;
      for (let px = 0; px < size; px++) {
        const fx = (px / size) * cells;
        const x0 = Math.floor(fx);
        let tx = fx - x0;
        tx = tx * tx * (3 - 2 * tx);
        const xa = x0 % cells;
        const xb = (x0 + 1) % cells;
        const top = lat[ya * cells + xa] + (lat[ya * cells + xb] - lat[ya * cells + xa]) * tx;
        const bot = lat[yb * cells + xa] + (lat[yb * cells + xb] - lat[yb * cells + xa]) * tx;
        field[py * size + px] += (top + (bot - top) * ty) * amp;
      }
    }
    total += amp;
    amp *= 0.5;
    cells *= 2;
  }
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < field.length; i++) {
    const v = field[i] / total;
    field[i] = v;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const range = Math.max(1e-5, max - min);
  for (let i = 0; i < field.length; i++) field[i] = (field[i] - min) / range;
  return field;
}

let macroNoise: THREE.CanvasTexture | null | undefined;

/**
 * 256x256 tileable macro noise: R and G are two independent fBm fields
 * (linear). Sampled at very low world frequencies to vary tint / roughness and
 * to mask detail blending, so scanned tiles never visibly repeat.
 */
export function getMacroNoiseTexture(): THREE.CanvasTexture | null {
  if (macroNoise !== undefined) return macroNoise;
  if (typeof document === 'undefined') return null;
  const size = 256;
  const a = fbmField(size, 9127, 4, 5);
  const b = fbmField(size, 3301, 4, 5);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    macroNoise = null;
    return null;
  }
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    img.data[i * 4] = Math.round(a[i] * 255);
    img.data[i * 4 + 1] = Math.round(b[i] * 255);
    img.data[i * 4 + 2] = 128;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.NoColorSpace;
  tex.anisotropy = 4;
  tex.name = 'gwf-macro-noise';
  macroNoise = tex;
  return tex;
}

const greyNoiseCache = new Map<string, THREE.CanvasTexture | null>();

/**
 * Tileable grey value noise mapped to [lo, 1] (linear), used by procedural
 * fallbacks as an albedo / roughness modulator. Cached by parameters.
 */
export function getGreyNoiseTexture(seed = 1337, lo = 0.78, baseCells = 4, size = 256): THREE.CanvasTexture | null {
  const key = `${seed}|${lo}|${baseCells}|${size}`;
  if (greyNoiseCache.has(key)) return greyNoiseCache.get(key)!;
  if (typeof document === 'undefined') return null;
  const field = fbmField(size, seed, baseCells, 6);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const v = Math.round((lo + (1 - lo) * field[i]) * 255);
    img.data[i * 4] = v;
    img.data[i * 4 + 1] = v;
    img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.NoColorSpace;
  tex.anisotropy = 4;
  greyNoiseCache.set(key, tex);
  return tex;
}

const rippleCache = new Map<string, THREE.CanvasTexture | null>();

/** Cached wrapper around createRippleNormalMap (512^2, ~1.5 M samples each). */
export function getRippleNormalMap(opts: RippleNormalOptions): THREE.CanvasTexture | null {
  const key = JSON.stringify(opts);
  if (rippleCache.has(key)) return rippleCache.get(key)!;
  if (typeof document === 'undefined') return null;
  const tex = createRippleNormalMap(opts);
  rippleCache.set(key, tex);
  return tex;
}
