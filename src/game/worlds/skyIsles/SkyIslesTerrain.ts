import * as THREE from 'three';

export interface FloatingIslandArchetype {
  id: string;
  name: string;
  tier: 'small' | 'medium' | 'large' | 'traversal' | 'distant';
  radiusTop: number;
  depthRock: number;
  heightGrass: number;
  hasWaterfalls?: boolean;
  hasArchLandmark?: boolean;
}

export const ISLAND_ARCHETYPES: FloatingIslandArchetype[] = [
  {
    id: 'traversal-highway',
    name: 'Traversal Highway Bed',
    tier: 'traversal',
    radiusTop: 8.5,
    depthRock: 14.0,
    heightGrass: 2.2,
    hasWaterfalls: false,
  },
  {
    id: 'large-sanctuary',
    name: 'Large Sanctuary Isle',
    tier: 'large',
    radiusTop: 18.0,
    depthRock: 28.0,
    heightGrass: 3.5,
    hasWaterfalls: true,
  },
  {
    id: 'medium-plateau',
    name: 'Medium Sunlit Plateau',
    tier: 'medium',
    radiusTop: 11.0,
    depthRock: 19.0,
    heightGrass: 2.5,
    hasWaterfalls: false,
  },
  {
    id: 'small-satellite',
    name: 'Small Drifting Spire',
    tier: 'small',
    radiusTop: 5.5,
    depthRock: 12.0,
    heightGrass: 1.8,
    hasWaterfalls: false,
  },
  {
    id: 'distant-monolith',
    name: 'Distant Horizon Crag',
    tier: 'distant',
    radiusTop: 16.0,
    depthRock: 26.0,
    heightGrass: 3.0,
    hasWaterfalls: false,
  },
];

/** Metres covered by one repeat of the shared detail texture on island surfaces. */
const DETAIL_TILE_M = 4.0;

/** Outermost rim radius as a multiple of radiusTop (placement in SkyIslesWorld assumes <= 1.2). */
const MAX_RIM_FACTOR = 1.12;

/**
 * Height of the grass cap above the island origin at a horizontal distance
 * `dist` from the centre (dome profile used by the geometry). Decorations use
 * it to sit trees on the turf.
 */
export function skyIslesCapHeight(heightGrass: number, radiusTop: number, dist: number): number {
  const t = Math.min(1, dist / radiusTop);
  return heightGrass + 0.15 - 0.55 * t * t;
}

/**
 * Creates a procedural floating island geometry:
 * - A gently domed turf cap (geometry group 0, smooth-shaded grass material)
 * - An earthy soil lip and stratified rock underside tapering to an inverted
 *   crag with buttress ridges (geometry group 1, faceted rock material)
 * - Natural, linear-space vertex colours (grass patches, moss, strata bands)
 *   and metre-scaled UVs for the shared detail texture
 */
export function createProceduralIslandGeometry(
  radiusTop: number,
  depthRock: number,
  heightGrass: number,
  segments = 16,
  roughness = 0.35,
  seed = 42
): THREE.BufferGeometry {
  const geom = new THREE.BufferGeometry();
  const positions: number[] = [];
  const uvs: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  // Deterministic pseudo-random generator
  let s = seed;
  const rnd = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };

  // Dense enough rings for smooth-shaded rock (no low-poly facets)
  const slices = Math.max(24, Math.round(segments * 3));
  const roughK = roughness / 0.35;

  // Natural albedo palette (sRGB hex -> linear via THREE.Color)
  const grassA = new THREE.Color(0x4f7030);
  const grassB = new THREE.Color(0x6a843f);
  const grassDry = new THREE.Color(0x7d7a4a);
  const moss = new THREE.Color(0x4d5a31);
  const soil = new THREE.Color(0x4f4233);
  const rockLight = new THREE.Color(0x8a7f71);
  const rockDark = new THREE.Color(0x665c51);
  const rockDeep = new THREE.Color(0x4a443e);
  const tmp = new THREE.Color();
  const pushColor = (c: THREE.Color, jitter: number) => {
    const k = 1 + (rnd() - 0.5) * jitter;
    colors.push(c.r * k, c.g * k, c.b * k);
  };

  // Low-frequency angular lobes (buttresses / bays) shared by the rim and rock
  const ph1 = rnd() * Math.PI * 2;
  const ph2 = rnd() * Math.PI * 2;
  const ph3 = rnd() * Math.PI * 2;
  const ph4 = rnd() * Math.PI * 2;
  const lobe = (theta: number, p: number) =>
    (0.10 * Math.sin(3 * theta + ph1 + p * 1.5) +
      0.06 * Math.sin(5 * theta + ph2 - p * 2.0) +
      0.03 * Math.sin(11 * theta + ph3) +
      0.025 * Math.sin(19 * theta + ph4 + p * 7.0) * Math.sin(p * 9.0 + theta * 2.0)) * roughK;
  // Smooth fractured-rock relief (continuous, so smooth normals stay clean)
  const relief = (theta: number, p: number) =>
    0.035 * Math.sin(23 * theta + p * 11.0 + ph1) * Math.sin(13 * theta - p * 5.0 + ph2) +
    0.02 * Math.sin(37 * theta + p * 17.0 + ph3);

  // Large-scale grass patch variation
  const pa = rnd() * 10;
  const pb = rnd() * 10;
  const patch = (x: number, z: number) =>
    0.5 + 0.5 * Math.sin(x * 0.29 + pa) * Math.sin(z * 0.23 + pb) * 0.7 +
    0.15 * Math.sin((x + z) * 0.71 + pb);

  // ---------------------------------------------------------------------------
  // Group 0: turf cap (shared vertices, smooth normals)
  // ---------------------------------------------------------------------------
  const capRings = 5;
  positions.push(0, skyIslesCapHeight(heightGrass, radiusTop, 0), 0);
  uvs.push(0, 0);
  tmp.lerpColors(grassA, grassB, 0.5);
  pushColor(tmp, 0.08);

  const edgeX: number[] = [];
  const edgeY: number[] = [];
  const edgeZ: number[] = [];
  const edgeR: number[] = [];

  for (let r = 1; r <= capRings; r++) {
    const t = r / capRings;
    for (let i = 0; i < slices; i++) {
      const theta = (i / slices) * Math.PI * 2;
      const jitter = relief(theta, t) * roughK * (r === capRings ? 1.0 : 0.6);
      const rr = t * radiusTop * (1.0 + jitter + lobe(theta, 0) * 0.35 * t);
      const x = Math.cos(theta) * rr;
      const z = Math.sin(theta) * rr;
      const y = skyIslesCapHeight(heightGrass, radiusTop, rr) + Math.sin(x * 0.9 + z * 0.4) * Math.sin(z * 0.7 - x * 0.3) * 0.08 * t;

      positions.push(x, y, z);
      uvs.push(x / DETAIL_TILE_M, z / DETAIL_TILE_M);

      const pv = Math.min(1, Math.max(0, patch(x, z)));
      tmp.lerpColors(grassA, grassB, pv);
      if (r === capRings) tmp.lerp(grassDry, 0.35);
      pushColor(tmp, 0.1);

      if (r === capRings) {
        edgeX.push(x);
        edgeY.push(y);
        edgeZ.push(z);
        edgeR.push(rr);
      }
    }
  }

  // Centre fan (CCW seen from above -> normals up)
  for (let i = 0; i < slices; i++) {
    const next = (i + 1) % slices;
    indices.push(0, 1 + next, 1 + i);
  }
  // Cap strips
  for (let r = 0; r < capRings - 1; r++) {
    const inner = 1 + r * slices;
    const outer = 1 + (r + 1) * slices;
    for (let i = 0; i < slices; i++) {
      const next = (i + 1) % slices;
      const a = inner + i;
      const d = inner + next;
      const b = outer + i;
      const c = outer + next;
      indices.push(a, d, b);
      indices.push(d, c, b);
    }
  }
  const capIndexCount = indices.length;

  // ---------------------------------------------------------------------------
  // Group 1: soil lip + stratified rock underside (seam column duplicated so
  // the wrap-around UVs tile cleanly; faceted rock material)
  // ---------------------------------------------------------------------------
  const cols = slices + 1;
  const circumferenceTiles = Math.max(1, Math.round((Math.PI * 2 * radiusTop) / DETAIL_TILE_M));
  const rockStart = positions.length / 3;
  let rockRingCount = 0;

  const ringX = new Array<number>(slices);
  const ringY = new Array<number>(slices);
  const ringZ = new Array<number>(slices);

  const ringCol = new Float32Array(slices * 3);

  const emitRing = (colorFor: (i: number, y: number) => THREE.Color, jitter: number) => {
    for (let i = 0; i < slices; i++) {
      const c = colorFor(i, ringY[i]);
      const k = 1 + (rnd() - 0.5) * jitter;
      ringCol[i * 3] = c.r * k;
      ringCol[i * 3 + 1] = c.g * k;
      ringCol[i * 3 + 2] = c.b * k;
    }
    // Seam column (j === slices) repeats column 0 exactly
    for (let j = 0; j < cols; j++) {
      const i = j % slices;
      positions.push(ringX[i], ringY[i], ringZ[i]);
      uvs.push((j / slices) * circumferenceTiles, ringY[i] / DETAIL_TILE_M);
      colors.push(ringCol[i * 3], ringCol[i * 3 + 1], ringCol[i * 3 + 2]);
    }
    rockRingCount++;
  };

  // Ring A: duplicate of the turf edge, mossy soil
  for (let i = 0; i < slices; i++) {
    ringX[i] = edgeX[i];
    ringY[i] = edgeY[i];
    ringZ[i] = edgeZ[i];
  }
  emitRing(() => tmp.copy(moss), 0.12);

  // Ring B: slightly overhanging soil lip under the turf
  for (let i = 0; i < slices; i++) {
    const theta = (i / slices) * Math.PI * 2;
    const rr = Math.min(edgeR[i] * 1.03, radiusTop * MAX_RIM_FACTOR);
    ringX[i] = Math.cos(theta) * rr;
    ringZ[i] = Math.sin(theta) * rr;
    ringY[i] = edgeY[i] - 0.7 - rnd() * 0.25;
  }
  emitRing(() => tmp.copy(soil), 0.14);

  // Ring C: cliff shoulder, weathered rock with moss streaks
  for (let i = 0; i < slices; i++) {
    const theta = (i / slices) * Math.PI * 2;
    const rr = Math.min(edgeR[i] * (1.0 + (rnd() - 0.5) * 0.05), radiusTop * MAX_RIM_FACTOR);
    ringX[i] = Math.cos(theta) * rr;
    ringZ[i] = Math.sin(theta) * rr;
    ringY[i] = -0.5 - rnd() * 0.8;
  }
  emitRing(() => tmp.lerpColors(rockLight, moss, 0.25 + rnd() * 0.35), 0.12);

  // Underside rings: tapering inverted crag with strata and buttress ridges
  const underRings = 16;
  const topY = -1.0;
  // The rock carrot bends and goes lopsided with depth (never a lathe-turned cone)
  const bendA = rnd() * Math.PI * 2;
  const bendX = Math.cos(bendA) * radiusTop * (0.25 + rnd() * 0.25);
  const bendZ = Math.sin(bendA) * radiusTop * (0.25 + rnd() * 0.25);
  const lopPh = rnd() * Math.PI * 2;
  for (let k = 1; k <= underRings; k++) {
    const p = k / (underRings + 1);
    const ringJitter = 1.0 + (rnd() - 0.5) * 0.06 * roughK; // strata ledges
    // Short rocky shoulder, then a long tapering carrot of rock (reads as a
    // chunk torn out of the ground rather than a cylinder)
    const taper = p < 0.12 ? 1.0 - p * 0.6 : (1.0 - 0.072) * Math.pow((1.0 - p) / 0.88, 1.35);
    const baseR = radiusTop * taper * ringJitter;
    const baseY = topY - p * (depthRock + topY);
    for (let i = 0; i < slices; i++) {
      const theta = (i / slices) * Math.PI * 2;
      const rr = Math.min(
        baseR * (1.0 + lobe(theta, p) + relief(theta, p) * roughK),
        radiusTop * MAX_RIM_FACTOR
      );
      const lop = 1 + 0.22 * p * Math.sin(2 * theta + lopPh) + 0.12 * p * Math.sin(3 * theta + ph4 + p * 4);
      ringX[i] = Math.cos(theta) * rr * lop + bendX * p * p;
      ringZ[i] = Math.sin(theta) * rr * lop + bendZ * p * p;
      ringY[i] = baseY + Math.sin(theta * 4 + p * 6 + ph2) * 0.35;
    }
    const pk = p;
    emitRing((_i, y) => {
      const band = 0.5 + 0.5 * Math.sin(y * 1.7 + Math.sin(y * 0.43) * 2.0);
      tmp.lerpColors(rockDark, rockLight, band);
      return tmp.lerp(rockDeep, pk * 0.55);
    }, 0.1);
  }

  // Bottom tip of the inverted crag
  const tipIndex = positions.length / 3;
  positions.push(bendX + (rnd() - 0.5) * 1.5, -depthRock, bendZ + (rnd() - 0.5) * 1.5);
  uvs.push(circumferenceTiles * 0.5, -depthRock / DETAIL_TILE_M);
  pushColor(rockDeep, 0.05);

  // Rock strips (upper ring k -> lower ring k+1), outward-facing
  for (let r = 0; r < rockRingCount - 1; r++) {
    const upper = rockStart + r * cols;
    const lower = rockStart + (r + 1) * cols;
    for (let i = 0; i < slices; i++) {
      const a = upper + i;
      const d = upper + i + 1;
      const b = lower + i;
      const c = lower + i + 1;
      indices.push(a, d, b);
      indices.push(b, d, c);
    }
  }
  // Tip fan
  const lastRing = rockStart + (rockRingCount - 1) * cols;
  for (let i = 0; i < slices; i++) {
    indices.push(lastRing + i, lastRing + i + 1, tipIndex);
  }

  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geom.setIndex(indices);
  geom.addGroup(0, capIndexCount, 0);
  geom.addGroup(capIndexCount, indices.length - capIndexCount, 1);
  geom.computeVertexNormals();
  // The rock seam column duplicates column 0 (for UV wrap); average their
  // normals so smooth shading shows no vertical crease.
  const nrm = geom.getAttribute('normal') as THREE.BufferAttribute;
  for (let r = 0; r < rockRingCount; r++) {
    const a = rockStart + r * cols;
    const b = a + slices;
    const nx = nrm.getX(a) + nrm.getX(b);
    const ny = nrm.getY(a) + nrm.getY(b);
    const nz = nrm.getZ(a) + nrm.getZ(b);
    const l = Math.hypot(nx, ny, nz) || 1;
    nrm.setXYZ(a, nx / l, ny / l, nz / l);
    nrm.setXYZ(b, nx / l, ny / l, nz / l);
  }
  geom.computeBoundingSphere();

  return geom;
}
