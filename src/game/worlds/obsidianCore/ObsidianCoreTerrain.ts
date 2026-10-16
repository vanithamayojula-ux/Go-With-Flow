import * as THREE from 'three';

export interface VolcanicArchetype {
  id: string;
  name: string;
  tier: 'spire' | 'basalt-cluster' | 'caldera-peak' | 'jagged-rock';
  height: number;
  radius: number;
  facets: number;
}

export const VOLCANIC_ARCHETYPES: VolcanicArchetype[] = [
  {
    id: 'obsidian-spire',
    name: 'Jagged Obsidian Spire',
    tier: 'spire',
    height: 38.0,
    radius: 3.5,
    facets: 5,
  },
  {
    id: 'basalt-cluster',
    name: 'Hexagonal Basalt Column Cluster',
    tier: 'basalt-cluster',
    height: 22.0,
    radius: 4.8,
    facets: 6,
  },
  {
    id: 'caldera-peak',
    name: 'Towering Horizon Caldera Volcano',
    tier: 'caldera-peak',
    height: 65.0,
    radius: 45.0,
    facets: 12,
  },
  {
    id: 'jagged-rock',
    name: 'Fractured Volcanic Crag',
    tier: 'jagged-rock',
    height: 12.0,
    radius: 2.8,
    facets: 5,
  },
];

// ---------------------------------------------------------------------------
// Cross-section of the volcanic corridor (all distances are |x| in metres)
//   0    .. 6.0   flat bed under the road slab (y = -0.06, never above -0.05)
//   6.0  .. 10.0  ash shoulder rising gently to ~0.4 m
//   10.0 .. 11.2  scorched bank dropping into the lava channel
//   11.2 .. 16.8  lava channel floor (y = -2.2), covered by the lava surface
//   16.8 .. 19.0  far bank rising to 1.2 m
//   19.0 ..       basalt ridge climbing away from the road
// ---------------------------------------------------------------------------
export const VOLCANIC_ROAD_BED_Y = -0.06;
export const VOLCANIC_LAVA_SURFACE_Y = -1.4;
export const VOLCANIC_LAVA_INNER_X = 10.6;
export const VOLCANIC_LAVA_OUTER_X = 17.6;

const CHUNK_PERIOD = 60;
const TAU = Math.PI * 2;

function smooth01(t: number): number {
  const c = t < 0 ? 0 : t > 1 ? 1 : t;
  return c * c * (3 - 2 * c);
}

/** Smooth noise in [-1, 1] that is periodic in z over one 60 m chunk (seamless tiling). */
function corridorNoise(x: number, z: number): number {
  const w = (z * TAU) / CHUNK_PERIOD;
  return (
    0.5 * Math.sin(w * 2 + x * 0.31) +
    0.3 * Math.sin(w * 3 + x * 0.73 + 1.7) +
    0.2 * Math.sin(w * 5 - x * 0.57 + 0.4)
  );
}

/**
 * Terrain height of the volcanic corridor at world (x, z). Periodic in z over
 * 60 m so chunk-instanced ground meshes line up seamlessly.
 */
export function volcanicGroundHeight(x: number, z: number): number {
  const ax = Math.abs(x);
  if (ax <= 6.0) return VOLCANIC_ROAD_BED_Y;
  const n = corridorNoise(x, z);

  if (ax <= 10.0) {
    const t = (ax - 6.0) / 4.0;
    return VOLCANIC_ROAD_BED_Y + smooth01(t) * 0.45 + n * 0.12 * t;
  }
  if (ax <= 11.2) {
    const top = VOLCANIC_ROAD_BED_Y + 0.45 + n * 0.12;
    return THREE.MathUtils.lerp(top, -2.2, smooth01((ax - 10.0) / 1.2));
  }
  if (ax <= 16.8) return -2.2;
  if (ax <= 19.0) {
    return THREE.MathUtils.lerp(-2.2, 1.2, smooth01((ax - 16.8) / 2.2));
  }
  const f = ax - 19.0;
  const ramp = Math.min(1, f / 4);
  const broad = Math.sin(((z * TAU) / CHUNK_PERIOD) + x * 0.09) * 2.2;
  return 1.2 + Math.min(f * 0.6, 16.0) + (n * 1.6 + broad) * ramp;
}

// ---------------------------------------------------------------------------
// Shared procedural textures (generated once, browser only)
// ---------------------------------------------------------------------------
let sharedNoiseTexture: THREE.CanvasTexture | null = null;
let sharedLavaTexture: THREE.CanvasTexture | null = null;

function hash2(ix: number, iy: number, seed: number): number {
  const s = Math.sin(ix * 127.1 + iy * 311.7 + seed * 74.7) * 43758.5453;
  return s - Math.floor(s);
}

/**
 * Tileable 256x256 grey value-noise texture (values ~0.62..1.0) used to break up
 * albedo and roughness on rock and ash. Returns null when no DOM is available.
 */
export function getVolcanicNoiseTexture(): THREE.CanvasTexture | null {
  if (sharedNoiseTexture) return sharedNoiseTexture;
  if (typeof document === 'undefined') return null;

  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const img = ctx.createImageData(size, size);

  const octaves = [
    { cells: 8, amp: 0.45 },
    { cells: 16, amp: 0.27 },
    { cells: 32, amp: 0.17 },
    { cells: 64, amp: 0.11 },
  ];

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let v = 0;
      for (let o = 0; o < octaves.length; o++) {
        const cells = octaves[o].cells;
        const fx = (px / size) * cells;
        const fy = (py / size) * cells;
        const x0 = Math.floor(fx);
        const y0 = Math.floor(fy);
        const tx = smooth01(fx - x0);
        const ty = smooth01(fy - y0);
        const x1 = (x0 + 1) % cells;
        const y1 = (y0 + 1) % cells;
        const a = hash2(x0, y0, o);
        const b = hash2(x1, y0, o);
        const c = hash2(x0, y1, o);
        const d = hash2(x1, y1, o);
        v += (a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty) * octaves[o].amp;
      }
      const g = Math.round((0.62 + v * 0.38) * 255);
      const i = (py * size + px) * 4;
      img.data[i] = g;
      img.data[i + 1] = g;
      img.data[i + 2] = g;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.NoColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  sharedNoiseTexture = tex;
  return tex;
}

/**
 * Tileable 128x128 lava emissive texture: thin, irregular glowing seams between
 * cooled crust plates (domain-warped toroidal Voronoi F2-F1 with varying seam
 * width, broken up by noise), mostly dark crust. Returns null without a DOM.
 */
export function getVolcanicLavaTexture(): THREE.CanvasTexture | null {
  if (!sharedLavaTexture) {
    const it = buildVolcanicLavaTextureGen();
    while (!it.next().done) {
      /* run to completion */
    }
  }
  return sharedLavaTexture;
}

/** Tileable value noise (period `cells` lattice units). */
function tileNoise(x: number, y: number, cells: number, seed: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = smooth01(x - x0);
  const ty = smooth01(y - y0);
  const xa = ((x0 % cells) + cells) % cells;
  const ya = ((y0 % cells) + cells) % cells;
  const xb = (xa + 1) % cells;
  const yb = (ya + 1) % cells;
  const a = hash2(xa, ya, seed);
  const b = hash2(xb, ya, seed);
  const c = hash2(xa, yb, seed);
  const d = hash2(xb, yb, seed);
  return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
}

function tileFbm(u: number, v: number, cells: number, seed: number): number {
  let sum = 0;
  let amp = 0.5;
  let c = cells;
  for (let o = 0; o < 3; o++) {
    sum += tileNoise(u * c, v * c, c, seed + o * 7) * amp;
    amp *= 0.5;
    c *= 2;
  }
  return sum / 0.875;
}

/** Builds the shared lava texture, yielding every 8 rows (for sliced warmup). */
export function* buildVolcanicLavaTextureGen(): Generator<void, void> {
  if (sharedLavaTexture) return;
  if (typeof document === 'undefined') return;

  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const img = ctx.createImageData(size, size);

  const pointCount = 30;
  const pts: number[] = [];
  for (let i = 0; i < pointCount; i++) {
    pts.push(hash2(i, 3, 11) * size, hash2(i, 7, 19) * size);
  }

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const u = px / size;
      const v = py / size;
      // Domain warp: bends the plate edges so no regular cell pattern survives
      const wx = (tileFbm(u, v, 4, 31) - 0.5) * 24;
      const wy = (tileFbm(u + 0.37, v + 0.61, 4, 57) - 0.5) * 24;
      const qx = px + wx;
      const qy = py + wy;
      let f1 = 1e9;
      let f2 = 1e9;
      for (let i = 0; i < pointCount; i++) {
        let dx = Math.abs(qx - pts[i * 2]) % size;
        let dy = Math.abs(qy - pts[i * 2 + 1]) % size;
        if (dx > size * 0.5) dx = size - dx;
        if (dy > size * 0.5) dy = size - dy;
        const d = dx * dx + dy * dy;
        if (d < f1) {
          f2 = f1;
          f1 = d;
        } else if (d < f2) {
          f2 = d;
        }
      }
      const edge = Math.sqrt(f2) - Math.sqrt(f1);
      // Seam width and heat vary along the network; some seams have crusted over
      const n = tileFbm(u, v, 8, 91);
      const width = 0.3 + 1.0 * n;
      const seam = Math.exp(-(edge * edge) / (width * width));
      const alive = smooth01((n - 0.28) / 0.3);
      const flicker = 0.75 + 0.25 * tileFbm(u, v, 16, 13);
      const heat = Math.min(1, seam * alive * flicker + 0.015);
      const i = (py * size + px) * 4;
      // Blackbody-ish ramp: deep red -> orange, yellow only in the hottest core
      img.data[i] = Math.round(255 * Math.min(1, Math.pow(heat, 0.9)));
      img.data[i + 1] = Math.round(255 * Math.pow(heat, 2.1) * 0.62);
      img.data[i + 2] = Math.round(255 * Math.pow(heat, 4.0) * 0.28);
      img.data[i + 3] = 255;
    }
    if ((py & 7) === 7) yield;
  }
  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  sharedLavaTexture = tex;
}

// ---------------------------------------------------------------------------
// Palette (sRGB hex, converted to linear by THREE.Color)
// ---------------------------------------------------------------------------
const C_BASALT_DARK = new THREE.Color(0x2b2a2a);
const C_BASALT_LIGHT = new THREE.Color(0x3a3734);
const C_ASH = new THREE.Color(0x4a4744);
const C_ASH_DARK = new THREE.Color(0x3d3a37);
const C_SCORCHED = new THREE.Color(0x2a221e);
const C_OBSIDIAN = new THREE.Color(0x17171b);
const C_OBSIDIAN_EDGE = new THREE.Color(0x2a2832);
const C_SOOT = new THREE.Color(0x1d1b1a);

/**
 * Creates volcanic rock formation geometry (faceted basalt columns, obsidian
 * shards, horizon caldera cone) with natural basalt / obsidian / ash vertex colours.
 */
export function createProceduralVolcanicRockGeometry(
  archetype: VolcanicArchetype,
  seed = 404
): THREE.BufferGeometry {
  const tmp = new THREE.Color();

  if (archetype.tier === 'caldera-peak') {
    // Smooth ash-covered stratovolcano with a dark crater rim
    const radial = 36;
    const geom = new THREE.CylinderGeometry(
      archetype.radius * 0.28,
      archetype.radius,
      archetype.height,
      radial,
      10
    );
    geom.translate(0, archetype.height * 0.5, 0);

    const pos = geom.attributes.position;
    const colors: number[] = [];

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      const normY = y / archetype.height;
      const ang = Math.atan2(z, x);

      // Erosion gullies and lumpy flanks (skip the very top/bottom rings)
      if (normY > 0.001 && normY < 0.999) {
        const gully = Math.sin(ang * 9 + seed) * 0.05 + Math.sin(ang * 23 + normY * 6) * 0.025;
        const k = 1 + gully * (0.4 + normY);
        pos.setX(i, x * k);
        pos.setZ(i, z * k);
      }

      // Ash slopes, darker basalt flows streaking down from the rim
      const streak = Math.max(0, Math.sin(ang * 7 + seed * 0.3)) * normY;
      tmp.copy(C_ASH).lerp(C_BASALT_DARK, Math.min(1, streak * 1.2 + normY * 0.35));
      if (normY > 0.93) tmp.lerp(C_SOOT, 0.6);
      colors.push(tmp.r, tmp.g, tmp.b);
    }
    geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    scaleUv(geom, 6, 4);
    geom.computeVertexNormals();
    return geom;
  }

  // Basalt column cluster / obsidian shard group / crag
  const geometries: THREE.BufferGeometry[] = [];
  const columnCount = archetype.tier === 'basalt-cluster' ? 5 : 3;
  const isObsidian = archetype.tier === 'spire';

  let s = seed;
  const rnd = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };

  if (archetype.tier === 'basalt-cluster') {
    // Columnar basalt: many slender, tightly packed hexagonal columns with flat
    // (slightly weathered) tops, stepping down from a high point like a
    // cooled flow broken along its joints. All share one lean.
    const spacing = 1.55;
    const colR = spacing * 0.56;
    const leanX = (rnd() - 0.5) * 0.12;
    const leanZ = (rnd() - 0.5) * 0.12;
    const peakX = (rnd() - 0.5) * 2.0;
    const peakZ = (rnd() - 0.5) * 2.0;
    const maxH = archetype.height * 0.5;
    for (let q = -3; q <= 3; q++) {
      for (let r = -3; r <= 3; r++) {
        if (Math.abs(q + r) > 3) continue;
        const px = spacing * (q + r * 0.5);
        const pz = spacing * r * 0.866;
        const d = Math.hypot(px - peakX, pz - peakZ);
        if (d > spacing * 3.2 && rnd() < 0.6) continue;
        // Dome-ish envelope with broken steps
        const env = Math.max(0, 1 - Math.pow(d / (spacing * 3.6), 1.6));
        const step = 0.55 + rnd() * 0.45;
        const colHeight = Math.max(0.8, maxH * env * step + rnd() * 0.6);
        const girth = colR * (0.82 + rnd() * 0.3);
        const prism = new THREE.CylinderGeometry(girth * (0.9 + rnd() * 0.08), girth, colHeight, 6, 2);
        prism.rotateY(Math.PI / 6 + (rnd() - 0.5) * 0.25);
        prism.translate(0, colHeight * 0.5 - 0.4, 0);
        const pos = prism.attributes.position;
        // Weathered column heads: joints break at an angle, edges spall
        const topY = colHeight - 0.4;
        const tiltA = (rnd() - 0.5) * 0.9;
        const tiltB = (rnd() - 0.5) * 0.9;
        for (let i = 0; i < pos.count; i++) {
          if (pos.getY(i) < topY - 1e-3) continue;
          const vx = pos.getX(i);
          const vz = pos.getZ(i);
          const chip = Math.sin(vx * 7.3 + vz * 5.1 + chipPhase(px, pz)) * 0.12;
          pos.setY(i, topY + vx * tiltA + vz * tiltB + chip);
        }
        const colors: number[] = [];
        const tone = rnd();
        for (let i = 0; i < pos.count; i++) {
          const y = pos.getY(i);
          const h = (y + 0.4) / colHeight;
          tmp.copy(C_BASALT_DARK).lerp(C_BASALT_LIGHT, tone * 0.8);
          tmp.lerp(C_SOOT, Math.max(0, 1 - (y + 0.4) / 2.0) * 0.5);
          if (h > 0.97) tmp.lerp(C_ASH, 0.35 + tone * 0.3);
          colors.push(tmp.r, tmp.g, tmp.b);
        }
        prism.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        scaleUv(prism, 1, Math.max(1, colHeight / 3));
        prism.rotateZ(leanX + (rnd() - 0.5) * 0.03);
        prism.rotateX(leanZ + (rnd() - 0.5) * 0.03);
        prism.translate(px, 0, pz);
        geometries.push(prism);
      }
    }
    const mergedCols = mergeBufferGeometriesCustom(geometries);
    for (const g of geometries) g.dispose();
    return mergedCols;
  }

  for (let c = 0; c < columnCount; c++) {
    const angle = (c / columnCount) * Math.PI * 2;
    const dist = c === 0 ? 0 : archetype.radius * (0.5 + rnd() * 0.5);
    const colHeight = c === 0 ? archetype.height : archetype.height * (0.45 + rnd() * 0.45);
    const colRadius = archetype.radius * (0.35 + rnd() * 0.25);

    const prism = new THREE.CylinderGeometry(
      isObsidian ? colRadius * 0.22 : colRadius * 0.65,
      colRadius,
      colHeight,
      isObsidian ? archetype.facets + 2 : archetype.facets,
      isObsidian ? 7 : 4
    );
    prism.translate(0, colHeight * 0.5, 0);

    const pos = prism.attributes.position;
    if (isObsidian) {
      // Irregular crag: per-ring radial jitter, a wandering axis and a broken,
      // off-centre summit (shared ring vertices move together: no cracks)
      const ph = rnd() * 10;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const z = pos.getZ(i);
        const h = y / colHeight;
        const ang = Math.atan2(z, x);
        const jag = 1 + Math.sin(ang * 3 + ph + h * 5) * 0.22 + Math.sin(ang * 7 - ph * 1.3 + h * 11) * 0.12;
        const bend = Math.sin(h * 2.6 + ph) * colRadius * 0.45 * h;
        pos.setXYZ(i, x * jag + bend, y * (1 - 0.18 * Math.max(0, Math.cos(ang * 2 + ph)) * h * h), z * jag * 0.8 + bend * 0.4);
      }
    }
    const colors: number[] = [];
    const tone = rnd();

    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const h = y / colHeight;
      if (isObsidian) {
        // Glassy black obsidian, slightly lighter conchoidal edges near the tip
        tmp.copy(C_OBSIDIAN).lerp(C_OBSIDIAN_EDGE, h * 0.6 * tone);
      } else {
        // Basalt: soot-darkened base, natural tonal variation, ash dusting on top
        tmp.copy(C_BASALT_DARK).lerp(C_BASALT_LIGHT, tone);
        tmp.lerp(C_SOOT, Math.max(0, 1 - y / 3.0) * 0.6);
        if (h > 0.9) tmp.lerp(C_ASH, 0.55);
      }
      colors.push(tmp.r, tmp.g, tmp.b);
    }
    prism.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    scaleUv(prism, 2, Math.max(1, colHeight / 4));

    // Slight organic tilt
    const tilt = 0.08 + rnd() * 0.12;
    prism.rotateZ(Math.cos(angle) * tilt);
    prism.rotateX(Math.sin(angle) * tilt);
    prism.translate(Math.cos(angle) * dist, 0, Math.sin(angle) * dist);

    geometries.push(prism);
  }

  const merged = mergeBufferGeometriesCustom(geometries);
  for (const g of geometries) g.dispose();
  return merged;
}

function chipPhase(x: number, z: number): number {
  return x * 1.7 + z * 2.9;
}

function scaleUv(geom: THREE.BufferGeometry, su: number, sv: number): void {
  const uv = geom.attributes.uv as THREE.BufferAttribute | undefined;
  if (!uv) return;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
  }
}

/** Builds an indexed grid from explicit x stations and z rows. */
function buildStationGrid(
  xs: number[],
  zs: number[],
  heightFn: (x: number, z: number) => number,
  colorFn: (x: number, y: number, z: number, out: THREE.Color) => void,
  uvScale: number
): THREE.BufferGeometry {
  const positions: number[] = [];
  const colors: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const col = new THREE.Color();

  for (let iz = 0; iz < zs.length; iz++) {
    for (let ix = 0; ix < xs.length; ix++) {
      const x = xs[ix];
      const z = zs[iz];
      const y = heightFn(x, z);
      positions.push(x, y, z);
      colorFn(x, y, z, col);
      colors.push(col.r, col.g, col.b);
      uvs.push(x / uvScale, z / uvScale);
    }
  }

  const row = xs.length;
  for (let iz = 0; iz < zs.length - 1; iz++) {
    for (let ix = 0; ix < row - 1; ix++) {
      const a = iz * row + ix;
      const b = a + 1;
      const c = a + row;
      const d = c + 1;
      // Counter-clockwise when viewed from +Y
      indices.push(a, c, b, b, c, d);
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}

/**
 * Creates the volcanic ground chunk around the highway:
 * - Flat bed under the road (|x| <= 6, y = -0.06, hidden under the road slab)
 * - Ash shoulders, scorched banks and a sunken lava channel each side
 * - Basalt ridges climbing away from the corridor
 * Heights follow volcanicGroundHeight(); the chunk tiles seamlessly every 60 m.
 */
export function createVolcanicHighwayChunkGeometry(
  width: number,
  length: number,
  segmentsX = 14,
  segmentsZ = 16,
  seed = 666
): THREE.BufferGeometry {
  void seed;
  const half = width * 0.5;

  // Explicit stations so the flat bed and channel edges are represented exactly
  const inner = [0, 3.0, 5.5, 6.0, 7.0, 8.0, 9.0, 10.0, 10.6, 11.2, 14.0, 16.8, 17.6, 18.4, 19.0];
  const outer: number[] = [];
  const outerSegs = Math.max(6, segmentsX);
  const outerStart = 19.0;
  if (half > outerStart) {
    for (let i = 1; i <= outerSegs; i++) {
      // Denser near the road, coarser far away
      const t = i / outerSegs;
      outer.push(outerStart + (half - outerStart) * t * t * 0.5 + (half - outerStart) * t * 0.5);
    }
  }
  const pos = inner.filter(v => v < half).concat(outer.filter(v => v > outerStart));
  const xs: number[] = [];
  for (let i = pos.length - 1; i > 0; i--) xs.push(-pos[i]);
  for (const v of pos) xs.push(v);

  const rows = Math.max(segmentsZ, 24);
  const zs: number[] = [];
  for (let i = 0; i <= rows; i++) zs.push(-length * 0.5 + (length * i) / rows);

  const tmp = new THREE.Color();
  return buildStationGrid(
    xs,
    zs,
    volcanicGroundHeight,
    (x, y, z, out) => {
      const ax = Math.abs(x);
      const n = corridorNoise(x * 1.7, z * 2.0) * 0.5 + 0.5;
      if (ax <= 6.0) {
        out.copy(C_BASALT_DARK).lerp(C_ASH_DARK, n * 0.5);
      } else if (ax <= 10.0) {
        // Ash shoulder with darker scoria patches
        out.copy(C_ASH).lerp(C_ASH_DARK, n);
      } else if (ax <= 19.0) {
        // Scorched banks and channel floor
        out.copy(C_SCORCHED).lerp(C_SOOT, ax > 11.2 && ax < 16.8 ? 1 : n * 0.5);
      } else {
        // Basalt ridges, ash settling on gentler, higher ground
        tmp.copy(C_BASALT_DARK).lerp(C_BASALT_LIGHT, n);
        out.copy(tmp).lerp(C_ASH, Math.max(0, Math.min(1, (y - 4) / 10)) * (0.3 + n * 0.5));
      }
    },
    7.5
  );
}

/**
 * Creates the cooled lava crust filling both side channels (|x| 10.4..17.8,
 * around y = -1.4): a lumpy, ridged surface (pressure ridges along the flow)
 * whose edges dive into the channel banks. One 60 m chunk long, periodic in z
 * so chunks tile seamlessly. Shaded by the terrain material (scanned basalt
 * with lava glowing in its cracks).
 */
export function createLavaRiverGeometry(length = 60, segmentsZ = 24): THREE.BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  const across: number[] = [];
  const n = 11;
  for (let i = 0; i < n; i++) across.push(10.4 + (7.4 * i) / (n - 1));
  const rows = Math.max(segmentsZ, 24);

  for (const side of [-1, 1]) {
    const base = positions.length / 3;
    const xs = side < 0 ? across.map(v => -v).reverse() : across;
    for (let iz = 0; iz <= rows; iz++) {
      const z = -length * 0.5 + (length * iz) / rows;
      const w = (z * TAU) / CHUNK_PERIOD;
      for (const x of xs) {
        const ax = Math.abs(x);
        const t = (ax - VOLCANIC_LAVA_INNER_X) / (VOLCANIC_LAVA_OUTER_X - VOLCANIC_LAVA_INNER_X);
        // Crust bulges in the middle of the flow and sags at the banks
        const crown = Math.sin(Math.min(1, Math.max(0, t)) * Math.PI) * 0.22;
        const ridges =
          Math.sin(w * 7 + ax * 0.9 + side) * 0.09 +
          Math.sin(w * 13 - ax * 1.7 + side * 2.1) * 0.05 +
          corridorNoise(x * 2.3, z * 1.0) * 0.08;
        const edgeDrop = ax < 10.8 || ax > 17.4 ? -0.35 : 0;
        positions.push(x, VOLCANIC_LAVA_SURFACE_Y + crown + ridges + edgeDrop, z);
      }
    }
    const row = xs.length;
    for (let iz = 0; iz < rows; iz++) {
      for (let ix = 0; ix < row - 1; ix++) {
        const a = base + iz * row + ix;
        const b = a + 1;
        const c = a + row;
        const d = c + 1;
        indices.push(a, c, b, b, c, d);
      }
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((positions.length / 3) * 2), 2));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  geom.computeBoundingSphere();
  return geom;
}

/**
 * Creates a lava-fall sheet: a plane pouring down a cliff face, bottom at y = 0,
 * leaning back towards -Z by `tilt` radians. Colour comes from the emissive lava material.
 */
export function createMagmaWaterfallGeometry(
  width: number,
  height: number,
  segmentsX = 4,
  segmentsY = 8,
  tilt = 0
): THREE.BufferGeometry {
  const geom = new THREE.PlaneGeometry(width, height, segmentsX, segmentsY);
  geom.translate(0, height * 0.5, 0);
  if (tilt !== 0) geom.rotateX(-tilt);
  scaleUv(geom, width / 6, height / 6);

  const pos = geom.attributes.position;
  const colors: number[] = [];
  for (let i = 0; i < pos.count; i++) {
    // Diffuse tint (mostly hidden by emission): dark crust
    colors.push(0.03, 0.008, 0.0);
  }
  geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geom.computeVertexNormals();
  return geom;
}

/**
 * Merge geometries helper (position, normal, colour, uv)
 */
function mergeBufferGeometriesCustom(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const merged = new THREE.BufferGeometry();
  const posArr: number[] = [];
  const normArr: number[] = [];
  const colArr: number[] = [];
  const uvArr: number[] = [];

  for (const src of geometries) {
    const g = src.index ? src.toNonIndexed() : src;
    const pos = g.attributes.position;
    const norm = g.attributes.normal;
    const col = g.attributes.color;
    const uv = g.attributes.uv;

    for (let i = 0; i < pos.count; i++) {
      posArr.push(pos.getX(i), pos.getY(i), pos.getZ(i));
      if (norm) {
        normArr.push(norm.getX(i), norm.getY(i), norm.getZ(i));
      } else {
        normArr.push(0, 1, 0);
      }
      if (col) {
        colArr.push(col.getX(i), col.getY(i), col.getZ(i));
      } else {
        colArr.push(0.03, 0.03, 0.03);
      }
      if (uv) {
        uvArr.push(uv.getX(i), uv.getY(i));
      } else {
        uvArr.push(0, 0);
      }
    }
    if (g !== src) g.dispose();
  }

  merged.setAttribute('position', new THREE.Float32BufferAttribute(posArr, 3));
  merged.setAttribute('normal', new THREE.Float32BufferAttribute(normArr, 3));
  merged.setAttribute('color', new THREE.Float32BufferAttribute(colArr, 3));
  merged.setAttribute('uv', new THREE.Float32BufferAttribute(uvArr, 2));
  merged.computeBoundingSphere();
  return merged;
}

/** Lava glow (HDR). Bright enough to bloom, not to blow the frame out. */
export const OBSIDIAN_LAVA_EMISSIVE = 2.0;
