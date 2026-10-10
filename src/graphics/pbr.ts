import * as THREE from 'three';

/**
 * Physically Based Rendering asset factory.
 *
 * Every generator returns a coherent map set (albedo / normal / roughness /
 * metalness / AO) derived from a shared procedural height field, so surfaces
 * read as real materials under IBL instead of flat-shaded colour.
 */

export interface PBRMapSet {
  map: THREE.CanvasTexture;
  normalMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
  aoMap: THREE.CanvasTexture;
  metalnessMap?: THREE.CanvasTexture;
}

function makeCanvas(size: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  return { canvas, ctx };
}

function toTexture(canvas: HTMLCanvasElement, repeat: number, srgb: boolean): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.anisotropy = 8;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Derive a tangent-space normal map from a greyscale height canvas using a
 * Sobel gradient. Wrapping samples keep the result seamless on tiled surfaces.
 */
function heightToNormal(heightCanvas: HTMLCanvasElement, strength = 2.0): THREE.CanvasTexture {
  const size = heightCanvas.width;
  const hctx = heightCanvas.getContext('2d', { willReadFrequently: true })!;
  const src = hctx.getImageData(0, 0, size, size).data;

  const { canvas, ctx } = makeCanvas(size);
  const out = ctx.createImageData(size, size);

  const at = (x: number, y: number) => {
    const xx = (x + size) % size;
    const yy = (y + size) % size;
    return src[(yy * size + xx) * 4] / 255;
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const tl = at(x - 1, y - 1), t = at(x, y - 1), tr = at(x + 1, y - 1);
      const l = at(x - 1, y), r = at(x + 1, y);
      const bl = at(x - 1, y + 1), b = at(x, y + 1), br = at(x + 1, y + 1);

      const dx = (tr + 2 * r + br) - (tl + 2 * l + bl);
      const dy = (bl + 2 * b + br) - (tl + 2 * t + tr);

      let nx = -dx * strength;
      let ny = -dy * strength;
      const nz = 1.0;
      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len; ny /= len;
      const nzn = nz / len;

      const i = (y * size + x) * 4;
      out.data[i] = (nx * 0.5 + 0.5) * 255;
      out.data[i + 1] = (ny * 0.5 + 0.5) * 255;
      out.data[i + 2] = (nzn * 0.5 + 0.5) * 255;
      out.data[i + 3] = 255;
    }
  }

  ctx.putImageData(out, 0, 0);
  return toTexture(canvas, 1, false);
}

/** Multi-octave value noise rendered straight into a canvas (greyscale height). */
function paintFbmHeight(
  ctx: CanvasRenderingContext2D,
  size: number,
  octaves: { scale: number; amplitude: number }[],
  seedOffset = 0
): ImageData {
  const img = ctx.createImageData(size, size);

  // Precompute hash grid per octave for deterministic, tileable sampling.
  const hashAt = (xi: number, yi: number, period: number) => {
    const x = ((xi % period) + period) % period;
    const y = ((yi % period) + period) % period;
    const n = Math.sin((x * 127.1 + y * 311.7 + seedOffset * 74.7)) * 43758.5453;
    return n - Math.floor(n);
  };

  const smooth = (t: number) => t * t * (3 - 2 * t);

  const sample = (px: number, py: number, period: number) => {
    const fx = px * period, fy = py * period;
    const ix = Math.floor(fx), iy = Math.floor(fy);
    const tx = smooth(fx - ix), ty = smooth(fy - iy);
    const a = hashAt(ix, iy, period);
    const b = hashAt(ix + 1, iy, period);
    const c = hashAt(ix, iy + 1, period);
    const d = hashAt(ix + 1, iy + 1, period);
    return (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      let sum = 0, norm = 0;
      for (const o of octaves) {
        sum += sample(u, v, o.scale) * o.amplitude;
        norm += o.amplitude;
      }
      const n = sum / norm;
      const val = Math.round(THREE.MathUtils.clamp(n, 0, 1) * 255);
      const i = (y * size + x) * 4;
      img.data[i] = val;
      img.data[i + 1] = val;
      img.data[i + 2] = val;
      img.data[i + 3] = 255;
    }
  }

  return img;
}

function writeTexturePair(
  height: HTMLCanvasElement,
  lo: [number, number, number],
  hi: [number, number, number],
  repeat: number
): { albedo: THREE.CanvasTexture; roughness: THREE.CanvasTexture } {
  const size = height.width;
  const hData = height.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, size, size).data;

  const albedoCtx = makeCanvas(size).ctx;
  const roughCtx = makeCanvas(size).ctx;
  const aImg = albedoCtx.createImageData(size, size);
  const rImg = roughCtx.createImageData(size, size);

  for (let i = 0; i < size * size; i++) {
    const n = hData[i * 4] / 255;
    for (let c = 0; c < 3; c++) {
      const v = (lo[c] + (hi[c] - lo[c]) * n) * 255;
      aImg.data[i * 4 + c] = v;
    }
    aImg.data[i * 4 + 3] = 255;

    // Inverse the height relationship so crevices read as rougher than peaks.
    const rough = THREE.MathUtils.clamp(hi[0] / 255 + (1 - n) * 0.45, 0, 1);
    const rv = Math.round(rough * 255);
    rImg.data[i * 4] = rv;
    rImg.data[i * 4 + 1] = rv;
    rImg.data[i * 4 + 2] = rv;
    rImg.data[i * 4 + 3] = 255;
  }

  albedoCtx.putImageData(aImg, 0, 0);
  roughCtx.putImageData(rImg, 0, 0);

  return {
    albedo: toTexture(albedoCtx.canvas, repeat, true),
    roughness: toTexture(roughCtx.canvas, repeat, false),
  };
}

/** Ambient occlusion approximation: darken by local height occlusion. */
function heightToAO(height: HTMLCanvasElement, radius = 6, strength = 0.85): THREE.CanvasTexture {
  const size = height.width;
  const src = height.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, size, size).data;
  const { canvas, ctx } = makeCanvas(size);
  const img = ctx.createImageData(size, size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const h = src[(y * size + x) * 4] / 255;
      let occ = 0;
      let samples = 0;
      for (let dy = -radius; dy <= radius; dy += 2) {
        for (let dx = -radius; dx <= radius; dx += 2) {
          const hh = src[((((y + dy) % size + size) % size) * size + (((x + dx) % size + size) % size)) * 4] / 255;
          occ += Math.max(0, hh - h);
          samples++;
        }
      }
      const ao = THREE.MathUtils.clamp(1 - (occ / samples) * strength * 3, 0, 1);
      const v = Math.round(ao * 255);
      const i = (y * size + x) * 4;
      img.data[i] = v;
      img.data[i + 1] = v;
      img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  return toTexture(canvas, 1, false);
}

/**
 * Wet night asphalt: aggregate grain, tar seams, patch repairs, faint oil sheen.
 */
export function createAsphaltPBR(repeat = 24): PBRMapSet {
  const size = 512;
  const { canvas: heightCanvas, ctx: hctx } = makeCanvas(size);
  hctx.putImageData(
    paintFbmHeight(hctx, size, [
      { scale: 48, amplitude: 0.5 },
      { scale: 128, amplitude: 0.3 },
      { scale: 256, amplitude: 0.2 },
    ], 3),
    0, 0
  );

  const { albedo, roughness } = writeTexturePair(
    heightCanvas,
    [0.020, 0.024, 0.030],
    [0.075, 0.082, 0.095],
    repeat
  );

  // Tar seams + patch repairs painted on top of the aggregate albedo.
  const actx = albedo.image as HTMLCanvasElement;
  const a = actx.getContext('2d')!;
  a.globalAlpha = 0.55;
  a.strokeStyle = '#0a0b0e';
  for (let i = 0; i < 14; i++) {
    a.lineWidth = 2 + Math.random() * 5;
    a.beginPath();
    const y = Math.random() * size;
    a.moveTo(0, y);
    for (let x = 0; x <= size; x += 32) a.lineTo(x, y + (Math.random() - 0.5) * 10);
    a.stroke();
  }
  a.globalAlpha = 0.18;
  a.fillStyle = '#20242c';
  for (let i = 0; i < 5; i++) {
    const px = Math.random() * size, py = Math.random() * size;
    const w = 40 + Math.random() * 120, h = 40 + Math.random() * 120;
    a.fillRect(px, py, w, h);
  }
  a.globalAlpha = 1;

  // Damp patches read as lower roughness than the surrounding aggregate.
  const rctx = (roughness.image as HTMLCanvasElement).getContext('2d')!;
  rctx.globalAlpha = 0.5;
  rctx.fillStyle = '#3a3a3a';
  for (let i = 0; i < 12; i++) {
    const px = Math.random() * size, py = Math.random() * size;
    const r = 20 + Math.random() * 60;
    const g = rctx.createRadialGradient(px, py, 0, px, py, r);
    g.addColorStop(0, 'rgba(58,58,58,0.9)');
    g.addColorStop(1, 'rgba(58,58,58,0)');
    rctx.fillStyle = g;
    rctx.beginPath();
    rctx.arc(px, py, r, 0, Math.PI * 2);
    rctx.fill();
  }
  rctx.globalAlpha = 1;

  return {
    map: albedo,
    normalMap: heightToNormal(heightCanvas, 1.6),
    roughnessMap: roughness,
    aoMap: heightToAO(heightCanvas, 5, 0.6),
  };
}

/** Poured concrete / composite panel: fine pitting, form-tie holes, chamfered seams. */
export function createConcretePBR(repeat = 8): PBRMapSet {
  const size = 512;
  const { canvas: heightCanvas, ctx: hctx } = makeCanvas(size);
  hctx.putImageData(
    paintFbmHeight(hctx, size, [
      { scale: 16, amplitude: 0.25 },
      { scale: 64, amplitude: 0.45 },
      { scale: 200, amplitude: 0.3 },
    ], 11),
    0, 0
  );

  const { albedo, roughness } = writeTexturePair(
    heightCanvas,
    [0.085, 0.090, 0.100],
    [0.190, 0.198, 0.212],
    repeat
  );

  const a = (albedo.image as HTMLCanvasElement).getContext('2d')!;
  a.globalAlpha = 0.30;
  a.strokeStyle = '#2a2e35';
  a.lineWidth = 3;
  for (let i = 1; i < 4; i++) {
    a.beginPath();
    a.moveTo(0, (size / 4) * i);
    a.lineTo(size, (size / 4) * i);
    a.stroke();
    a.beginPath();
    a.moveTo((size / 4) * i, 0);
    a.lineTo((size / 4) * i, size);
    a.stroke();
  }
  a.globalAlpha = 0.45;
  a.fillStyle = '#15181d';
  for (let gy = 0; gy < 4; gy++) {
    for (let gx = 0; gx < 4; gx++) {
      a.beginPath();
      a.arc((size / 4) * gx + size / 8, (size / 4) * gy + size / 8, 4, 0, Math.PI * 2);
      a.fill();
    }
  }
  a.globalAlpha = 1;

  return {
    map: albedo,
    normalMap: heightToNormal(heightCanvas, 1.1),
    roughnessMap: roughness,
    aoMap: heightToAO(heightCanvas, 7, 0.5),
  };
}

/** Brushed / anodised structural metal: directional grain, panel lines, rivets. */
export function createBrushedMetalPBR(repeat = 6, tint: [number, number, number] = [0.16, 0.18, 0.22]): PBRMapSet {
  const size = 512;
  const { canvas: heightCanvas, ctx: hctx } = makeCanvas(size);

  hctx.putImageData(
    paintFbmHeight(hctx, size, [
      { scale: 8, amplitude: 0.6 },
      { scale: 32, amplitude: 0.25 },
      { scale: 128, amplitude: 0.15 },
    ], 23),
    0, 0
  );

  // Anisotropic brushing: fine horizontal streaks.
  hctx.globalAlpha = 0.18;
  for (let i = 0; i < 900; i++) {
    const y = Math.random() * size;
    const w = 20 + Math.random() * 200;
    hctx.strokeStyle = Math.random() > 0.5 ? '#ffffff' : '#000000';
    hctx.lineWidth = 1;
    hctx.beginPath();
    hctx.moveTo(Math.random() * size, y);
    hctx.lineTo(Math.random() * size + w, y + (Math.random() - 0.5) * 2);
    hctx.stroke();
  }
  hctx.globalAlpha = 1;

  const { albedo, roughness } = writeTexturePair(
    heightCanvas,
    [tint[0] * 0.6, tint[1] * 0.6, tint[2] * 0.6],
    [tint[0] * 1.35, tint[1] * 1.35, tint[2] * 1.35],
    repeat
  );

  const a = (albedo.image as HTMLCanvasElement).getContext('2d')!;
  a.globalAlpha = 0.5;
  a.strokeStyle = '#0d1016';
  a.lineWidth = 4;
  a.strokeRect(2, 2, size - 4, size - 4);
  a.lineWidth = 2;
  a.beginPath();
  a.moveTo(size / 2, 0); a.lineTo(size / 2, size);
  a.stroke();
  a.globalAlpha = 0.35;
  a.fillStyle = '#2a3040';
  for (let i = 0; i < 16; i++) {
    a.beginPath();
    a.arc(24 + (i % 4) * ((size - 48) / 3), 24 + Math.floor(i / 4) * ((size - 48) / 3), 5, 0, Math.PI * 2);
    a.fill();
  }
  a.globalAlpha = 1;

  return {
    map: albedo,
    normalMap: heightToNormal(heightCanvas, 0.9),
    roughnessMap: roughness,
    aoMap: heightToAO(heightCanvas, 6, 0.55),
  };
}

/** Compacted gravel / dirt shoulder used on the embankments flanking the highway. */
export function createGravelPBR(repeat = 12): PBRMapSet {
  const size = 512;
  const { canvas: heightCanvas, ctx: hctx } = makeCanvas(size);
  hctx.putImageData(
    paintFbmHeight(hctx, size, [
      { scale: 96, amplitude: 0.65 },
      { scale: 32, amplitude: 0.25 },
      { scale: 220, amplitude: 0.1 },
    ], 41),
    0, 0
  );

  const { albedo, roughness } = writeTexturePair(
    heightCanvas,
    [0.055, 0.052, 0.048],
    [0.145, 0.138, 0.125],
    repeat
  );

  return {
    map: albedo,
    normalMap: heightToNormal(heightCanvas, 2.2),
    roughnessMap: roughness,
    aoMap: heightToAO(heightCanvas, 4, 0.9),
  };
}

/** Full PBR material built from a generated map set, wired for IBL. */
export function createPBRStandardMaterial(
  maps: PBRMapSet,
  params: THREE.MeshStandardMaterialParameters = {}
): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    map: maps.map,
    normalMap: maps.normalMap,
    roughnessMap: maps.roughnessMap,
    aoMap: maps.aoMap,
    roughness: 1.0,
    metalness: 0.0,
    envMapIntensity: 1.0,
    ...params,
  });
  mat.aoMapIntensity = params.aoMapIntensity ?? 0.85;
  return mat;
}

/** Apply a generated map set onto an existing standard material in place. */
export function applyPBRMaps(
  mat: THREE.MeshStandardMaterial,
  maps: PBRMapSet,
  options: { normalScale?: number; aoMapIntensity?: number } = {}
): THREE.MeshStandardMaterial {
  mat.map = maps.map;
  mat.normalMap = maps.normalMap;
  mat.roughnessMap = maps.roughnessMap;
  mat.aoMap = maps.aoMap;
  mat.aoMapIntensity = options.aoMapIntensity ?? 0.85;
  if (options.normalScale !== undefined) {
    mat.normalScale.set(options.normalScale, options.normalScale);
  }
  mat.needsUpdate = true;
  return mat;
}

export function disposePBRMaps(maps: PBRMapSet): void {
  maps.map.dispose();
  maps.normalMap.dispose();
  maps.roughnessMap.dispose();
  maps.aoMap.dispose();
  maps.metalnessMap?.dispose();
}