import * as THREE from 'three';

/**
 * Procedural PBR maps for a worn asphalt highway with painted lane markings.
 *
 * One texture tile spans the full road width (u: x = -halfWidth..+halfWidth)
 * and `tileLength` metres of road (v), so it repeats cleanly along the road.
 */
export interface RoadTextureSpec {
  halfWidth: number; // metres from centre line to the road plane edge
  tileLength: number; // metres of road covered by one texture tile
  dividerX: number; // |x| of the dashed lane dividers
  edgeLineX: number; // |x| of the solid edge lines
  laneCentersX: number[]; // lane centres, for wheel-path wear
}

export interface RoadTextures {
  map: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
  normalMap: THREE.CanvasTexture;
}

const SIZE = 1024;

// Small deterministic PRNG so the road looks the same every run.
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Tileable value noise on a `cells` x `cells` lattice.
function valueNoise(rand: () => number, cells: number) {
  const lattice = new Float32Array(cells * cells);
  for (let i = 0; i < lattice.length; i++) lattice[i] = rand();
  return (u: number, v: number) => {
    const x = u * cells;
    const y = v * cells;
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = x - x0;
    const fy = y - y0;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const at = (ix: number, iy: number) => lattice[((iy % cells) + cells) % cells * cells + (((ix % cells) + cells) % cells)];
    const a = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * sx;
    const b = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * sx;
    return a + (b - a) * sy;
  };
}

function makeCanvas() {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d')!;
  return { canvas, ctx, img: ctx.createImageData(SIZE, SIZE) };
}

export function createRoadTextures(spec: RoadTextureSpec): RoadTextures {
  const rand = mulberry32(1337);
  const broad = valueNoise(rand, 8); // patches of repair / discolouration
  const mid = valueNoise(rand, 64); // mottling
  const fine = valueNoise(rand, 256); // grit

  const width = spec.halfWidth * 2;
  const metresPerPxU = width / SIZE;
  const metresPerPxV = spec.tileLength / SIZE;

  // Paint mask (0..1) for a pixel at road-space (x, z within tile)
  const paintAt = (x: number, z: number): number => {
    const ax = Math.abs(x);
    let paint = 0;
    // Solid edge lines, 15 cm wide
    if (Math.abs(ax - spec.edgeLineX) < 0.075) paint = 1;
    // Dashed lane dividers, 12 cm wide: 3 m painted per tile
    if (Math.abs(ax - spec.dividerX) < 0.06 && z < 3.0) paint = 1;
    return paint;
  };

  // Height field shared by albedo, roughness and normal generation
  const height = new Float32Array(SIZE * SIZE);
  const paintMask = new Float32Array(SIZE * SIZE);
  const wear = new Float32Array(SIZE * SIZE);

  for (let py = 0; py < SIZE; py++) {
    const v = py / SIZE;
    const z = v * spec.tileLength;
    for (let px = 0; px < SIZE; px++) {
      const u = px / SIZE;
      const x = u * width - spec.halfWidth;
      const i = py * SIZE + px;

      const grit = fine(u, v);
      // Aggregate stones: sparse bright specks
      const stone = rand() > 0.985 ? 0.6 + rand() * 0.4 : 0;
      height[i] = grit * 0.6 + stone * 0.4;

      // Paint, with chipped/faded edges
      const p = paintAt(x, z);
      paintMask[i] = p > 0 ? THREE.MathUtils.clamp(0.75 + (mid(u * 2, v * 2) - 0.5) * 0.8 + (grit - 0.5) * 0.4, 0, 1) : 0;

      // Wheel paths: polished, slightly darker bands 0.75 m either side of lane centre
      let w = 0;
      for (const lc of spec.laneCentersX) {
        const d1 = Math.abs(x - (lc - 0.75));
        const d2 = Math.abs(x - (lc + 0.75));
        w = Math.max(w, Math.exp(-(d1 * d1) / 0.06), Math.exp(-(d2 * d2) / 0.06));
      }
      wear[i] = w;
    }
  }

  // Albedo
  const albedo = makeCanvas();
  for (let i = 0; i < SIZE * SIZE; i++) {
    const px = i % SIZE;
    const py = (i / SIZE) | 0;
    const u = px / SIZE;
    const v = py / SIZE;
    let g = 52 + (broad(u, v) - 0.5) * 18 + (mid(u, v) - 0.5) * 14 + (height[i] - 0.4) * 34;
    g *= 1.0 - wear[i] * 0.12;
    let r = g * 0.98;
    let gg = g;
    let b = g * 1.03;
    const p = paintMask[i];
    if (p > 0) {
      const paint = 225 + (height[i] - 0.4) * 30;
      r = r + (paint - r) * p;
      gg = gg + (paint * 0.99 - gg) * p;
      b = b + (paint * 0.94 - b) * p;
    }
    const o = i * 4;
    albedo.img.data[o] = THREE.MathUtils.clamp(r, 0, 255);
    albedo.img.data[o + 1] = THREE.MathUtils.clamp(gg, 0, 255);
    albedo.img.data[o + 2] = THREE.MathUtils.clamp(b, 0, 255);
    albedo.img.data[o + 3] = 255;
  }
  albedo.ctx.putImageData(albedo.img, 0, 0);

  // Roughness (green channel is what three.js samples)
  const rough = makeCanvas();
  for (let i = 0; i < SIZE * SIZE; i++) {
    let r = 0.9 + (height[i] - 0.4) * 0.12 - wear[i] * 0.14;
    r = r + (0.55 - r) * paintMask[i];
    const val = THREE.MathUtils.clamp(r, 0, 1) * 255;
    const o = i * 4;
    rough.img.data[o] = val;
    rough.img.data[o + 1] = val;
    rough.img.data[o + 2] = val;
    rough.img.data[o + 3] = 255;
  }
  rough.ctx.putImageData(rough.img, 0, 0);

  // Normal map from the height field (paint sits ~1 mm proud)
  const normal = makeCanvas();
  const hAt = (x: number, y: number) => {
    const i = ((y + SIZE) % SIZE) * SIZE + ((x + SIZE) % SIZE);
    return height[i] * 0.004 + paintMask[i] * 0.001; // metres
  };
  for (let py = 0; py < SIZE; py++) {
    for (let px = 0; px < SIZE; px++) {
      const dx = (hAt(px + 1, py) - hAt(px - 1, py)) / (2 * metresPerPxU);
      const dy = (hAt(px, py + 1) - hAt(px, py - 1)) / (2 * metresPerPxV);
      const inv = 1 / Math.sqrt(dx * dx + dy * dy + 1);
      const o = (py * SIZE + px) * 4;
      normal.img.data[o] = (-dx * inv * 0.5 + 0.5) * 255;
      normal.img.data[o + 1] = (-dy * inv * 0.5 + 0.5) * 255;
      normal.img.data[o + 2] = (inv * 0.5 + 0.5) * 255;
      normal.img.data[o + 3] = 255;
    }
  }
  normal.ctx.putImageData(normal.img, 0, 0);

  const finish = (canvas: HTMLCanvasElement, srgb: boolean) => {
    const t = new THREE.CanvasTexture(canvas);
    t.wrapS = THREE.ClampToEdgeWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    return t;
  };

  return {
    map: finish(albedo.canvas, true),
    roughnessMap: finish(rough.canvas, false),
    normalMap: finish(normal.canvas, false),
  };
}
