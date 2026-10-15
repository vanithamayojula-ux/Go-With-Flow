import * as THREE from 'three';
import { createRippleNormalMap } from '../shared/surfaceNormals';

export interface DuneProfile {
  id: string;
  name: string;
  tier: 'small' | 'medium' | 'large' | 'ridge';
  width: number;
  length: number;
  height: number;
  steepness: number;
}

export const DUNE_PROFILES: DuneProfile[] = [
  {
    id: 'large-crescent',
    name: 'Large Crescent Barchan Dune',
    tier: 'large',
    width: 48.0,
    length: 65.0,
    height: 18.0,
    steepness: 0.85,
  },
  {
    id: 'medium-dune',
    name: 'Sweeping Medium Dune',
    tier: 'medium',
    width: 32.0,
    length: 45.0,
    height: 10.5,
    steepness: 0.70,
  },
  {
    id: 'small-drift',
    name: 'Low Wind Drift Dune',
    tier: 'small',
    width: 18.0,
    length: 28.0,
    height: 5.0,
    steepness: 0.55,
  },
  {
    id: 'long-ridge',
    name: 'Flanking Longitudinal Sand Ridge',
    tier: 'ridge',
    width: 26.0,
    length: 80.0,
    height: 14.0,
    steepness: 0.90,
  },
];

export interface MesaArchetype {
  id: string;
  name: string;
  tier: 'horizon-monolith' | 'flank-butte';
  radiusTop: number;
  radiusBase: number;
  height: number;
  layerCount: number;
}

export const MESA_ARCHETYPES: MesaArchetype[] = [
  {
    id: 'horizon-monolith',
    name: 'Towering Horizon Red Mesa',
    tier: 'horizon-monolith',
    radiusTop: 36.0,
    radiusBase: 58.0,
    height: 52.0,
    layerCount: 5,
  },
  {
    id: 'flank-butte',
    name: 'Wind-Carved Sandstone Butte',
    tier: 'flank-butte',
    radiusTop: 14.0,
    radiusBase: 24.0,
    height: 28.0,
    layerCount: 4,
  },
];

/**
 * Upper bound on how far a mesa's footprint can extend from its axis, relative to
 * `radiusBase` (talus flare * ledge step * weathering). Used for road-clearance placement.
 */
export const MESA_MAX_RADIUS_FACTOR = 1.4;

/** Texture tile size in metres used when generating world-scale UVs. */
const UV_TILE_METRES = 8.0;

// Natural desert albedos (sRGB hex; THREE.Color converts them to linear working space).
const SAND_TROUGH = 0xc9a26b;
const SAND_CREST = 0xd8b27a;
const SAND_COMPACT = 0xb8956a;
const ROCK_MID = 0xa8704c;
const ROCK_LIGHT = 0xb5784f;
const ROCK_DARK = 0x7e5038;
const ROCK_CAP = 0xc29a72;

const smoothstep = (e0: number, e1: number, v: number): number => {
  const t = Math.min(1, Math.max(0, (v - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/** Rewrites a plane's UVs so the shared noise texture tiles at a constant world scale. */
function applyPlanarWorldUVs(geom: THREE.BufferGeometry): void {
  const pos = geom.attributes.position;
  const uv = geom.attributes.uv;
  if (!uv) return;
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, pos.getX(i) / UV_TILE_METRES, pos.getZ(i) / UV_TILE_METRES);
  }
  uv.needsUpdate = true;
}

/**
 * Creates procedural wind-swept dune geometry with natural sand vertex colours:
 * - Gentle windward slope vs steeper leeward slip-face (barchan morphology)
 * - Smooth (not faceted) surface that falls to y=0 at the plane edges
 * - Subtle lighter crests / darker troughs in real sand tones
 */
export function createProceduralDuneGeometry(
  profile: DuneProfile,
  segmentsX = 40,
  segmentsZ = 48,
  seed = 505
): THREE.BufferGeometry {
  const geom = new THREE.PlaneGeometry(profile.width, profile.length, segmentsX, segmentsZ);
  geom.rotateX(-Math.PI / 2);

  const pos = geom.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const trough = new THREE.Color(SAND_TROUGH);
  const crest = new THREE.Color(SAND_CREST);
  const c = new THREE.Color();
  const phase = (seed % 97) * 0.13;
  const leeSteep = 1.0 + profile.steepness * 0.8;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);

    const nx = x / (profile.width * 0.5);
    const nz = z / (profile.length * 0.5);

    // Curved crest line; distance is measured from it, compressed on the leeward side
    const crestLine = Math.sin(nx * 1.8 + 0.3 + phase) * 0.3;
    const dz = nz - crestLine;
    const dzScaled = dz < 0 ? dz / (1 + crestLine) : (dz / (1 - crestLine)) * leeSteep;
    const r = Math.sqrt(nx * nx + dzScaled * dzScaled);
    const t = Math.max(0, 1 - r);
    const hill = t * t * (3 - 2 * t);

    // Low-frequency wind ripples that fade out towards the dune edge
    const ripples = Math.sin(x * 0.32 + z * 0.17 + phase) * 0.22 * t;
    const y = hill * profile.height + ripples;
    pos.setY(i, y);

    const heightNorm = Math.min(1, Math.max(0, y / profile.height));
    const variation = Math.sin(x * 0.11 + z * 0.07 + phase) * 0.12;
    c.lerpColors(trough, crest, Math.min(1, Math.max(0, heightNorm * 0.85 + 0.1 + variation)));
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }

  geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  applyPlanarWorldUVs(geom);
  geom.computeVertexNormals();
  return geom;
}

/**
 * Creates layered flat-topped sandstone mesa geometry:
 * stepped sedimentary ledges, a talus flare at the base and banded strata colours.
 * Displacement is a pure function of (angle, height) so cap and wall vertices stay welded.
 */
export function createProceduralMesaGeometry(
  archetype: MesaArchetype,
  radialSegs = 28,
  seed = 707
): THREE.BufferGeometry {
  const heightSegs = archetype.layerCount * 6;
  const geom = new THREE.CylinderGeometry(
    archetype.radiusTop,
    archetype.radiusBase,
    archetype.height,
    radialSegs,
    heightSegs,
    false
  );
  geom.translate(0, archetype.height * 0.5, 0);

  const pos = geom.attributes.position;
  const uv = geom.attributes.uv;
  const torsoCount = (radialSegs + 1) * (heightSegs + 1);
  const colors = new Float32Array(pos.count * 3);

  const mid = new THREE.Color(ROCK_MID);
  const light = new THREE.Color(ROCK_LIGHT);
  const dark = new THREE.Color(ROCK_DARK);
  const cap = new THREE.Color(ROCK_CAP);
  const talus = new THREE.Color(SAND_TROUGH);
  const c = new THREE.Color();
  const phase = (seed % 89) * 0.21;

  const avgRadius = (archetype.radiusTop + archetype.radiusBase) * 0.5;
  const uRepeat = Math.max(1, Math.round((Math.PI * 2 * avgRadius) / UV_TILE_METRES));
  const capUVScale = (archetype.radiusTop * 2) / UV_TILE_METRES;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const theta = Math.atan2(x, z);
    const normY = y / archetype.height;

    // Stratified step cliffs (cliff faces alternating with narrow ledges)
    const stepBands = Math.sin(normY * Math.PI * (archetype.layerCount + 1));
    const stepLedge = stepBands > 0.3 ? 1.06 : 0.97;
    // Talus flare near the base
    const flare = 1 + Math.max(0, 0.15 - normY) * 1.2;
    // Deterministic wind weathering (periodic in theta => no seam cracks)
    const weathering =
      1 +
      0.035 * Math.sin(theta * 3 + phase) +
      0.022 * Math.sin(theta * 7 + y * 0.3 + phase) +
      0.012 * Math.sin(theta * 13 + y * 0.9);
    const k = stepLedge * flare * weathering;
    pos.setX(i, x * k);
    pos.setZ(i, z * k);

    // Strata colouring: alternating darker / lighter beds that wobble around the butte
    const strata = Math.sin(normY * Math.PI * archetype.layerCount * 3.2 + Math.sin(theta * 2 + phase) * 0.6);
    const fine = Math.sin(normY * Math.PI * archetype.layerCount * 9.0 + theta * 1.5) * 0.5 + 0.5;
    if (strata > 0.55) {
      c.lerpColors(mid, dark, (strata - 0.55) * 1.6);
    } else {
      c.lerpColors(mid, light, Math.max(0, 0.55 - strata) * 0.8);
    }
    c.lerp(dark, fine * 0.12);
    // Lighter caprock on top, sand-dusted talus at the foot
    if (normY > 0.9) c.lerp(cap, (normY - 0.9) * 6);
    if (normY < 0.12) c.lerp(talus, (0.12 - normY) * 6);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;

    if (uv) {
      if (i < torsoCount) {
        uv.setXY(i, uv.getX(i) * uRepeat, y / UV_TILE_METRES);
      } else {
        uv.setXY(i, uv.getX(i) * capUVScale, uv.getY(i) * capUVScale);
      }
    }
  }

  if (uv) uv.needsUpdate = true;
  geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geom.computeVertexNormals();
  return geom;
}

/**
 * Creates the desert ground bed for one streamed chunk.
 * The strip |x| <= 6 stays flat at y = -0.15 (hidden under the road slab / level with it);
 * beyond that the sand rises gradually into natural undulations.
 * All z-dependence is periodic over the chunk length so neighbouring chunks meet seamlessly.
 */
export function createDesertHighwayChunkGeometry(
  width: number,
  length: number,
  segmentsX = 80,
  segmentsZ = 24,
  seed = 808
): THREE.BufferGeometry {
  const geom = new THREE.PlaneGeometry(width, length, segmentsX, segmentsZ);
  geom.rotateX(-Math.PI / 2);

  const pos = geom.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const trough = new THREE.Color(SAND_TROUGH);
  const crest = new THREE.Color(SAND_CREST);
  const compact = new THREE.Color(SAND_COMPACT);
  const c = new THREE.Color();
  const zFreq = (Math.PI * 2) / length;
  const phase = (seed % 53) * 0.17;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const absX = Math.abs(x);
    const sidePhase = x < 0 ? 2.7 : 0.0;

    let y = -0.15;
    let undulation = 0;
    if (absX > 6.0) {
      const flank = absX - 6.0;
      undulation =
        Math.sin(flank * 0.11 + 1.3 + sidePhase + phase) * 1.6 +
        Math.cos(z * zFreq + flank * 0.09 + sidePhase) * 0.9 +
        Math.sin(z * zFreq * 2 + absX * 0.21) * 0.35;
      y = -0.15 + smoothstep(0, 14, flank) * (flank * 0.07 + undulation + 1.0);
    }
    pos.setY(i, y);

    const t = Math.min(1, Math.max(0, 0.5 + undulation * 0.2 + Math.sin(x * 0.23 + z * zFreq * 3) * 0.12));
    c.lerpColors(trough, crest, t);
    // Wind-compacted, slightly darker sand right beside the road
    c.lerp(compact, 1 - smoothstep(5.5, 12, absX));
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }

  geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  applyPlanarWorldUVs(geom);
  geom.computeVertexNormals();
  return geom;
}

/**
 * Generates a tileable 256x256 grayscale value-noise texture (with optional sand-ripple
 * component) for albedo / roughness / bump variation. Returns null without a DOM (Node tests).
 */
export function createCrimsonDunesNoiseTexture(seed = 1337, ripple = 0.0): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  let s = seed >>> 0;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };

  // Periodic lattices for each octave (cells per side must divide `size`)
  const octaves = [
    { cells: 4, amp: 0.35 },
    { cells: 16, amp: 0.3 },
    { cells: 32, amp: 0.2 },
    { cells: 128, amp: 0.15 },
  ];
  const lattices = octaves.map(o => {
    const arr = new Float32Array(o.cells * o.cells);
    for (let i = 0; i < arr.length; i++) arr[i] = rnd();
    return arr;
  });

  const img = ctx.createImageData(size, size);
  const data = img.data;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let n = 0;
      for (let o = 0; o < octaves.length; o++) {
        const cells = octaves[o].cells;
        const lat = lattices[o];
        const fx = (px / size) * cells;
        const fy = (py / size) * cells;
        const x0 = Math.floor(fx);
        const y0 = Math.floor(fy);
        const tx = fx - x0;
        const ty = fy - y0;
        const sx = tx * tx * (3 - 2 * tx);
        const sy = ty * ty * (3 - 2 * ty);
        const x1 = (x0 + 1) % cells;
        const y1 = (y0 + 1) % cells;
        const a = lat[y0 * cells + x0];
        const b = lat[y0 * cells + x1];
        const cc = lat[y1 * cells + x0];
        const d = lat[y1 * cells + x1];
        n += (a + (b - a) * sx + (cc - a) * sy + (a - b - cc + d) * sx * sy) * octaves[o].amp;
      }
      if (ripple > 0) {
        // Integer frequencies keep the ripple pattern tileable
        const r = Math.sin(((px * 6 + py * 2) / size) * Math.PI * 2 + n * 3.0) * 0.5 + 0.5;
        n = n * (1 - ripple) + r * ripple;
      }
      // Map to a gentle 0.78..1.0 range so the albedo is only modulated, not darkened
      const v = Math.round((0.78 + Math.min(1, Math.max(0, n)) * 0.22) * 255);
      const idx = (py * size + px) * 4;
      data[idx] = v;
      data[idx + 1] = v;
      data[idx + 2] = v;
      data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.NoColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Shared Crimson Dunes materials (physically based, natural desert albedos).
 */
export function createCrimsonDunesMaterials() {
  const noiseTexture = createCrimsonDunesNoiseTexture(1337, 0.25);

  // Wind ripples (~0.5 m wavelength over the 8 m UV tile) with sand grain;
  // they catch the low sun as fine parallel shadows across the dunes.
  const duneRipples = createRippleNormalMap({
    seed: 31,
    rippleU: 14,
    rippleV: 5,
    rippleHeight: 0.7,
    warp: 0.3,
    grain: 0.3,
    grainScale: 8,
    strength: 1.2,
  });
  const duneMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.96,
    metalness: 0.0,
    flatShading: false,
    map: noiseTexture,
    roughnessMap: noiseTexture,
    normalMap: duneRipples,
    normalScale: new THREE.Vector2(0.28, 0.28),
    bumpMap: duneRipples ? null : noiseTexture,
    bumpScale: 0.6,
  });

  const mesaRockMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.92,
    metalness: 0.0,
    flatShading: false,
    map: noiseTexture,
    roughnessMap: noiseTexture,
    bumpMap: noiseTexture,
    bumpScale: 1.4,
  });

  const ancientStoneMaterial = new THREE.MeshStandardMaterial({
    color: 0xa8907a, // Weathered desert stone
    roughness: 0.9,
    metalness: 0.0,
    map: noiseTexture,
    bumpMap: noiseTexture,
    bumpScale: 0.8,
  });

  const solarRelicMaterial = new THREE.MeshStandardMaterial({
    color: 0xb08d57, // Aged bronze
    emissive: 0xd97706,
    emissiveIntensity: 0.3,
    roughness: 0.4,
    metalness: 0.85,
  });

  return {
    duneMaterial,
    mesaRockMaterial,
    ancientStoneMaterial,
    solarRelicMaterial,
    noiseTexture,
  };
}
