import * as THREE from 'three';

/**
 * Diagonal two-colour safety stripes (as on barrier boards and road chevrons).
 * Returns null without a DOM (tests import game modules under Node).
 */
export function createStripeTexture(
  colorA: string,
  colorB: string,
  stripes = 6,
  size = 256
): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = colorA;
  ctx.fillRect(0, 0, size, size);

  // 45-degree bands that tile seamlessly
  const band = size / stripes;
  ctx.fillStyle = colorB;
  for (let i = -stripes; i < stripes * 2; i += 2) {
    ctx.beginPath();
    ctx.moveTo(i * band, 0);
    ctx.lineTo((i + 1) * band, 0);
    ctx.lineTo((i + 1) * band - size, size);
    ctx.lineTo(i * band - size, size);
    ctx.closePath();
    ctx.fill();
  }

  // Light wear so the paint doesn't look computer-perfect
  const img = ctx.getImageData(0, 0, size, size);
  for (let p = 0; p < img.data.length; p += 4) {
    const n = (Math.random() - 0.5) * 18;
    img.data[p] = Math.max(0, Math.min(255, img.data[p] + n));
    img.data[p + 1] = Math.max(0, Math.min(255, img.data[p + 1] + n));
    img.data[p + 2] = Math.max(0, Math.min(255, img.data[p + 2] + n));
  }
  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/**
 * Brushed-metal grain map (sRGB grey, used as albedo): fine directional grain along U
 * with a few longer scratches, for anodised / brushed steel frames. Values
 * stay in a narrow band (multiplies the material colour).
 * Returns null without a DOM.
 */
export function createBrushedMetalTexture(size = 256): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  let s = 4711;
  const rnd = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  // Per-row grain (brushing runs along x), smoothed a little along x
  const rows = new Float32Array(size);
  for (let y = 0; y < size; y++) rows[y] = rnd();
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const grain = rows[y] * 0.55 + rows[(y + 1) % size] * 0.25 + rows[(y + size - 1) % size] * 0.2;
      const fleck = rnd() * 0.15;
      const v = 0.78 + (grain - 0.5) * 0.28 + fleck - 0.075;
      const o = (y * size + x) * 4;
      const g = Math.round(Math.max(0, Math.min(1, v)) * 255);
      img.data[o] = g;
      img.data[o + 1] = g;
      img.data[o + 2] = g;
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  // A few long, faint scratches
  ctx.strokeStyle = 'rgba(255,255,255,0.10)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 14; i++) {
    const y0 = rnd() * size;
    ctx.beginPath();
    ctx.moveTo(0, y0);
    ctx.lineTo(size, y0 + (rnd() - 0.5) * 18);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}
