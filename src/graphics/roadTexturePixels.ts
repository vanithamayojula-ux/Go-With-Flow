/**
 * Pixel generation for the procedural asphalt maps (see roadTextures.ts).
 * Pure computation, no DOM and no three.js, so it also runs in a worker
 * (roadTextures.worker.ts): building the three 1024 x 2048 maps takes ~1.5 s
 * of main-thread time otherwise.
 */

export interface RoadTextureSpec {
  halfWidth: number; // metres from centre line to the road plane edge
  tileLength: number; // metres of road covered by one texture tile
  dividerX: number; // |x| of the dashed lane dividers
  edgeLineX: number; // |x| of the solid edge lines
  laneCentersX: number[]; // lane centres, for wheel-path wear
  dashPeriod?: number; // metres per dash cycle (default 10)
  dashLength?: number; // painted metres per cycle (default 3)
}

/** RGBA8 pixels of the three maps (rows top to bottom, as in a canvas). */
export interface RoadPixels {
  width: number;
  height: number;
  albedo: Uint8ClampedArray;
  roughness: Uint8ClampedArray;
  normal: Uint8ClampedArray;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
// Same as THREE.MathUtils.smoothstep(x, min, max).
const smoothstep = (x: number, min: number, max: number) => {
  if (x <= min) return 0;
  if (x >= max) return 1;
  const t = (x - min) / (max - min);
  return t * t * (3 - 2 * t);
};

const SIZE_U = 1024; // across the road (~9 mm/px for a 9 m deck)
const PX_PER_METRE_V = 102.4; // along the road (~1 cm/px)

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

// Tileable value noise on a `cellsU` x `cellsV` lattice.
function valueNoise(rand: () => number, cellsU: number, cellsV = cellsU) {
  const lattice = new Float32Array(cellsU * cellsV);
  for (let i = 0; i < lattice.length; i++) lattice[i] = rand();
  const at = (ix: number, iy: number) =>
    lattice[(((iy % cellsV) + cellsV) % cellsV) * cellsU + (((ix % cellsU) + cellsU) % cellsU)];
  return (u: number, v: number) => {
    const x = u * cellsU;
    const y = v * cellsV;
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = x - x0;
    const fy = y - y0;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const a = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * sx;
    const b = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * sx;
    return a + (b - a) * sy;
  };
}

export function computeRoadPixels(spec: RoadTextureSpec): RoadPixels {
  const W = SIZE_U;
  const H = Math.round(spec.tileLength * PX_PER_METRE_V);
  const N = W * H;
  const dashPeriod = spec.dashPeriod ?? 10;
  const dashLength = spec.dashLength ?? 3;

  const rand = mulberry32(1337);
  const vCells = (base: number) => Math.max(1, Math.round((base * spec.tileLength) / 10));
  const broad = valueNoise(rand, 6, vCells(6)); // discolouration over metres
  const mid = valueNoise(rand, 48, vCells(48)); // mottling
  const fine = valueNoise(rand, 384, vCells(384)); // grit
  const streakN = valueNoise(rand, 24, vCells(6)); // lengthwise oil/wear streaks

  const width = spec.halfWidth * 2;
  const mPerPxU = width / W;
  const mPerPxV = spec.tileLength / H;
  const xOfPx = (px: number) => (px / W) * width - spec.halfWidth;

  // --- Cracks and sealed cracks ("tar snakes"), stamped into masks -----------
  const crack = new Float32Array(N); // open hairline cracks (dark, recessed)
  const seal = new Float32Array(N); // bitumen crack sealant (black, glossy)
  const stamp = (mask: Float32Array, cx: number, cy: number, radiusPx: number, strength: number) => {
    const r = Math.ceil(radiusPx);
    for (let oy = -r; oy <= r; oy++) {
      const py = (((Math.round(cy) + oy) % H) + H) % H;
      for (let ox = -r; ox <= r; ox++) {
        const px = Math.round(cx) + ox;
        if (px < 0 || px >= W) continue;
        const d = Math.sqrt(ox * ox + oy * oy) / Math.max(radiusPx, 0.5);
        if (d > 1) continue;
        const i = py * W + px;
        mask[i] = Math.max(mask[i], strength * (1 - d * d));
      }
    }
  };
  const walkCrack = (mask: Float32Array, x0: number, z0: number, heading: number, lengthM: number, radiusPx: number) => {
    let x = x0;
    let z = z0;
    let h = heading;
    const step = 0.02;
    for (let s = 0; s < lengthM / step; s++) {
      h += (rand() - 0.5) * 0.35;
      x += Math.sin(h) * step;
      z += Math.cos(h) * step;
      if (Math.abs(x) > spec.halfWidth) break;
      stamp(mask, (x + spec.halfWidth) / mPerPxU, z / mPerPxV, radiusPx, 0.7 + rand() * 0.3);
      // occasional short branch
      if (rand() < 0.004) walkCrack(mask, x, z, h + (rand() < 0.5 ? 1 : -1) * (0.6 + rand() * 0.6), 0.2 + rand() * 0.6, radiusPx * 0.8);
    }
  };
  const tileScale = spec.tileLength / 10;
  // Longitudinal cracks near lane joints, transverse thermal cracks
  for (let k = 0; k < Math.round(4 * tileScale); k++) {
    const lx = (rand() < 0.5 ? -1 : 1) * (spec.dividerX + (rand() - 0.5) * 0.5);
    walkCrack(crack, lx, rand() * spec.tileLength, (rand() - 0.5) * 0.2, 1.5 + rand() * 4, 0.7);
  }
  for (let k = 0; k < Math.round(3 * tileScale); k++) {
    walkCrack(crack, (rand() - 0.5) * width * 0.9, rand() * spec.tileLength, Math.PI / 2 + (rand() - 0.5) * 0.4, 1 + rand() * 3, 0.6);
  }
  for (let k = 0; k < Math.round(3 * tileScale); k++) {
    const vertical = rand() < 0.6;
    walkCrack(
      seal,
      (rand() - 0.5) * width * 0.85,
      rand() * spec.tileLength,
      vertical ? (rand() - 0.5) * 0.3 : Math.PI / 2 + (rand() - 0.5) * 0.5,
      1.5 + rand() * 4,
      1.7
    );
  }

  // --- Repair patches: rectangles of newer (darker) or older (greyer) asphalt -
  interface Patch { x0: number; x1: number; z0: number; z1: number; tone: number }
  const patches: Patch[] = [];
  for (let k = 0; k < Math.round(1.5 * tileScale); k++) {
    const pw = 0.8 + rand() * 1.8;
    const pl = 1.0 + rand() * 3.0;
    const cx = (rand() - 0.5) * (width - pw - 0.6);
    const cz = rand() * spec.tileLength;
    patches.push({ x0: cx - pw / 2, x1: cx + pw / 2, z0: cz - pl / 2, z1: cz + pl / 2, tone: rand() < 0.7 ? -6 : 5 });
  }
  const patchAt = (x: number, z: number): { tone: number; edge: number } => {
    for (const p of patches) {
      for (const zz of [z, z + spec.tileLength, z - spec.tileLength]) {
        if (x >= p.x0 && x <= p.x1 && zz >= p.z0 && zz <= p.z1) {
          const e = Math.min(x - p.x0, p.x1 - x, zz - p.z0, p.z1 - zz);
          // Feathered tone so a patch reads as resurfacing, not a cast shadow
          return { tone: p.tone * Math.min(1, e / 0.15), edge: e < 0.02 ? 1 : 0 };
        }
      }
    }
    return { tone: 0, edge: 0 };
  };

  // Paint mask (0..1) for a pixel at road-space (x, z within tile)
  const paintAt = (x: number, z: number): number => {
    const ax = Math.abs(x);
    let paint = 0;
    // Solid edge lines, 15 cm wide
    if (Math.abs(ax - spec.edgeLineX) < 0.075) paint = 1;
    // Dashed lane dividers, 12 cm wide
    if (Math.abs(ax - spec.dividerX) < 0.06 && z % dashPeriod < dashLength) paint = 1;
    return paint;
  };

  // Height field shared by albedo, roughness and normal generation
  const height = new Float32Array(N);
  const paintMask = new Float32Array(N);
  const wheel = new Float32Array(N); // polished wheel paths
  const oil = new Float32Array(N); // drip line along the lane centre
  const patchTone = new Float32Array(N);
  const patchEdge = new Float32Array(N);
  const shoulder = new Float32Array(N); // dust/grit drifted against the curb

  for (let py = 0; py < H; py++) {
    const v = py / H;
    const z = v * spec.tileLength;
    for (let px = 0; px < W; px++) {
      const u = px / W;
      const x = xOfPx(px);
      const i = py * W + px;

      const grit = fine(u, v);
      // Aggregate stones: sparse bright specks
      const stone = rand() > 0.982 ? 0.5 + rand() * 0.5 : 0;
      const pt = patchAt(x, z);
      patchTone[i] = pt.tone;
      patchEdge[i] = pt.edge;
      // Patches are smoother (fresher binder, fewer exposed stones)
      const texScale = pt.tone < 0 ? 0.6 : 1;
      height[i] = (grit * 0.6 + stone * 0.4) * texScale - crack[i] * 0.9 - seal[i] * 0.15 + pt.edge * 0.25;

      // Paint, with chipped/faded edges
      const p = paintAt(x, z);
      paintMask[i] = p > 0 ? clamp(0.78 + (mid(u * 2, v * 2) - 0.5) * 0.8 + (grit - 0.5) * 0.4 - crack[i], 0, 1) : 0;

      // Wheel paths 0.75 m either side of each lane centre; oil drips between them
      let w = 0;
      let o = 0;
      for (const lc of spec.laneCentersX) {
        const d1 = x - (lc - 0.78);
        const d2 = x - (lc + 0.78);
        w = Math.max(w, Math.exp(-(d1 * d1) / 0.09), Math.exp(-(d2 * d2) / 0.09));
        const dc = x - lc;
        o = Math.max(o, Math.exp(-(dc * dc) / 0.05));
      }
      const streak = 0.55 + streakN(u, v) * 0.9;
      wheel[i] = w * clamp(streak, 0, 1.2);
      oil[i] = o * clamp(streakN(u + 0.37, v) * 1.6 - 0.35, 0, 1);

      const ax = Math.abs(x);
      shoulder[i] = smoothstep(ax, spec.edgeLineX + 0.05, spec.halfWidth) * (0.6 + mid(u * 3, v * 3) * 0.6);
    }
  }

  // Albedo: neutral, slightly warm mid-grey (~95 sRGB), like weathered asphalt
  const albedo = { data: new Uint8ClampedArray(N * 4) };
  for (let i = 0; i < N; i++) {
    const px = i % W;
    const py = (i / W) | 0;
    const u = px / W;
    const v = py / H;
    let g = 97 + (broad(u, v) - 0.5) * 20 + (mid(u, v) - 0.5) * 14 + (height[i] - 0.35) * 36 + patchTone[i];
    g *= 1.0 - wheel[i] * 0.09 - oil[i] * 0.22;
    g = g * (1 - crack[i] * 0.5) * (1 - seal[i] * 0.55);
    let r = g * 1.02;
    let gg = g;
    let b = g * 0.955;
    // Dust drifted against the curb: lighter, browner
    const s = shoulder[i];
    r += (138 - r) * s * 0.35;
    gg += (126 - gg) * s * 0.35;
    b += (108 - b) * s * 0.35;
    const p = paintMask[i];
    if (p > 0) {
      const paint = 222 + (height[i] - 0.4) * 30 - wheel[i] * 25;
      r = r + (paint - r) * p;
      gg = gg + (paint * 0.985 - gg) * p;
      b = b + (paint * 0.93 - b) * p;
    }
    const o = i * 4;
    albedo.data[o] = clamp(r, 0, 255);
    albedo.data[o + 1] = clamp(gg, 0, 255);
    albedo.data[o + 2] = clamp(b, 0, 255);
    albedo.data[o + 3] = 255;
  }

  // Roughness (green channel is what three.js samples)
  const rough = { data: new Uint8ClampedArray(N * 4) };
  for (let i = 0; i < N; i++) {
    let r = 0.92 + (height[i] - 0.4) * 0.1 - wheel[i] * 0.16 - oil[i] * 0.18;
    r = r + (0.42 - r) * seal[i];
    r = r + (0.6 - r) * paintMask[i];
    const val = clamp(r, 0, 1) * 255;
    const o = i * 4;
    rough.data[o] = val;
    rough.data[o + 1] = val;
    rough.data[o + 2] = val;
    rough.data[o + 3] = 255;
  }

  // Normal map from the height field (paint sits ~1 mm proud)
  const normal = { data: new Uint8ClampedArray(N * 4) };
  const hAt = (x: number, y: number) => {
    const xc = Math.min(W - 1, Math.max(0, x));
    const i = ((y + H) % H) * W + xc;
    return height[i] * 0.004 + paintMask[i] * 0.001; // metres
  };
  for (let py = 0; py < H; py++) {
    for (let px = 0; px < W; px++) {
      const dx = (hAt(px + 1, py) - hAt(px - 1, py)) / (2 * mPerPxU);
      const dy = (hAt(px, py + 1) - hAt(px, py - 1)) / (2 * mPerPxV);
      const inv = 1 / Math.sqrt(dx * dx + dy * dy + 1);
      const o = (py * W + px) * 4;
      normal.data[o] = (-dx * inv * 0.5 + 0.5) * 255;
      normal.data[o + 1] = (-dy * inv * 0.5 + 0.5) * 255;
      normal.data[o + 2] = (inv * 0.5 + 0.5) * 255;
      normal.data[o + 3] = 255;
    }
  }

  return { width: W, height: H, albedo: albedo.data, roughness: rough.data, normal: normal.data };
}
