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
