import * as THREE from 'three';

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
  const phase = (seed % 97) * 0.13 + profile.width * 0.37;
  const leeSteep = 1.0 + profile.steepness * 0.8;
  // Asymmetric horns (one arm longer / further downwind), as wind is never
  // perfectly steady; and a wandering brink line.
  const asym = Math.sin(phase * 3.1) * 0.5;
  const slip = new THREE.Color(0xb98d5c);

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);

    const nx0 = x / (profile.width * 0.5);
    const nz = z / (profile.length * 0.5);
    // Skew the lateral coordinate so the two horns differ
    const nx = nx0 * (1 + asym * 0.18 * Math.sign(nx0)) + Math.sin(nz * 2.3 + phase) * 0.06;

    // Barchan-like profile: a sharp, curved crest (horns trailing downwind, +z),
    // a long convex windward ramp and a steeper, straight slip face, tapering
    // to nothing at the lateral edges.
    const crestZ = -0.2 + 0.36 * nx * nx + asym * 0.1 * nx + Math.sin(nx * 2.1 + phase) * 0.05 + Math.sin(nx * 5.3 + phase * 2) * 0.015;
    const lateral = Math.max(0, 1 - nx * nx);
    const envelope = Math.pow(lateral, 0.85);
    const dz = nz - crestZ;
    let prof: number;
    if (dz <= 0) {
      const u = Math.min(1, Math.max(0, 1 + dz / (1 + crestZ)));
      // Convex ramp that still climbs at the crest (sharp brink), soft at the foot
      const foot = Math.min(1, u / 0.3);
      prof = u * (1.3 - 0.3 * u) * foot * foot * (3 - 2 * foot);
    } else {
      const leeLen = Math.max(0.2, (1 - crestZ) * (0.55 + 0.35 * (1 - profile.steepness) / leeSteep));
      const v = Math.min(1, dz / leeLen);
      // slight rounding of the brink, then a straight slip face easing onto the floor
      prof = (1 - v) * (1 - v * 0.15) * (1 - Math.exp(-12 * (1 - v))) + Math.exp(-40 * dz) * 0.04;
      prof = Math.max(0, Math.min(1, prof));
    }
    const t = envelope;
    // Wind ripples (~4 m) only on the windward ramp, running across the wind
    // and bending with it; the slip face is smooth avalanche sand.
    const windward = dz <= 0 ? 1 : Math.exp(-dz * 30);
    const ripples =
      Math.sin(z * 1.55 + Math.sin(x * 0.21 + phase) * 1.8 + Math.sin(x * 0.67) * 0.4) * 0.055 * t * windward * Math.min(1, prof * 3);
    // Low secondary undulation so the ramp is never a perfect surface
    const swell = Math.sin(x * 0.19 + phase) * Math.sin(z * 0.13 - phase) * 0.35 * t * prof;
    const y = prof * envelope * profile.height * 0.82 + ripples + swell;
    pos.setY(i, y);

    const heightNorm = Math.min(1, Math.max(0, y / profile.height));
    const variation = Math.sin(x * 0.11 + z * 0.07 + phase) * 0.12;
    c.lerpColors(trough, crest, Math.min(1, Math.max(0, heightNorm * 0.85 + 0.1 + variation)));
    // Freshly avalanched slip faces are a touch darker and redder
    if (dz > 0) c.lerp(slip, Math.min(0.5, dz * 4) * t);
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
/**
 * Height of the desert ground bed at lateral x and chunk-local z (the bed is
 * periodic over `length`, so world z minus any chunk centre works).
 */
export function desertGroundHeight(x: number, zLocal: number, length = 60, seed = 555): number {
  const absX = Math.abs(x);
  if (absX <= 6.0) return -0.15;
  const zFreq = (Math.PI * 2) / length;
  const phase = (seed % 53) * 0.17;
  const sidePhase = x < 0 ? 2.7 : 0.0;
  const flank = absX - 6.0;
  const undulation =
    Math.sin(flank * 0.11 + 1.3 + sidePhase + phase) * 1.6 +
    Math.cos(zLocal * zFreq + flank * 0.09 + sidePhase) * 0.9 +
    Math.sin(zLocal * zFreq * 2 + absX * 0.21) * 0.35;
  return -0.15 + smoothstep(0, 14, flank) * (flank * 0.07 + undulation + 1.0);
}

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
