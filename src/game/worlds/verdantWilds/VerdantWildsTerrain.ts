import * as THREE from 'three';

export interface TreeArchetype {
  id: string;
  name: string;
  tier: 'ancient' | 'canopy' | 'slender' | 'dead';
  height: number;
  trunkRadius: number;
  crownRadius: number;
  canopyClusters: number;
}

export const TREE_ARCHETYPES: TreeArchetype[] = [
  {
    id: 'ancient-greatwood',
    name: 'Ancient Greatwood Tree',
    tier: 'ancient',
    height: 38.0,
    trunkRadius: 3.2,
    crownRadius: 18.0,
    canopyClusters: 7,
  },
  {
    id: 'canopy-broadleaf',
    name: 'Canopy Broadleaf Tree',
    tier: 'canopy',
    height: 24.0,
    trunkRadius: 1.8,
    crownRadius: 11.5,
    canopyClusters: 5,
  },
  {
    id: 'slender-willow',
    name: 'Verdant Slender Tree',
    tier: 'slender',
    height: 16.0,
    trunkRadius: 1.0,
    crownRadius: 7.0,
    canopyClusters: 3,
  },
  {
    id: 'ancient-snag',
    name: 'Weathered Ancient Snag',
    tier: 'dead',
    height: 20.0,
    trunkRadius: 2.2,
    crownRadius: 0.0,
    canopyClusters: 0,
  },
];

/**
 * Lowest local height any foliage / limb may reach. Trees are scaled 0.85..1.25,
 * so 9.6 m local keeps every leaf above y = 8 m in world space (road clearance).
 */
export const TREE_FOLIAGE_MIN_Y = 9.6;

// ---------------------------------------------------------------------------
// Ground profile (shared by the embankment mesh and prop placement)
// ---------------------------------------------------------------------------

/** Height of the bed hidden under the road slab (|x| < 5.5). */
export const FOREST_ROAD_BED_Y = -0.08;
/** Bed stays flat out to this |x| before any bank / ditch begins. */
export const FOREST_ROAD_BED_HALF_WIDTH = 5.5;
/** Flat-floored roadside drainage ditch (stream channel). */
export const FOREST_DITCH_INNER_X = 8.5;
export const FOREST_DITCH_OUTER_X = 12.5;
export const FOREST_DITCH_Y = -0.35;

const DEFAULT_GROUND_LENGTH = 60;
const DEFAULT_GROUND_SEED = 77;

function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

/**
 * Forest floor height at lateral `x` and chunk-local `zLocal`.
 * Periodic in z over `length` so neighbouring chunks tile seamlessly.
 */
export function sampleForestFloorHeight(
  x: number,
  zLocal: number,
  length = DEFAULT_GROUND_LENGTH,
  seed = DEFAULT_GROUND_SEED
): number {
  const a = Math.abs(x);
  if (a <= FOREST_ROAD_BED_HALF_WIDTH) return FOREST_ROAD_BED_Y;

  const k = (Math.PI * 2) / length;
  const ph = seed * 0.37;

  // Verge slopes gently down into the ditch
  let y =
    FOREST_ROAD_BED_Y +
    (FOREST_DITCH_Y - FOREST_ROAD_BED_Y) *
      smoothstep(FOREST_ROAD_BED_HALF_WIDTH, FOREST_DITCH_INNER_X, a);

  // Forest bank rises beyond the ditch
  y += smoothstep(FOREST_DITCH_OUTER_X, 21, a) * 2.2 + Math.max(0, a - 21) * 0.08;

  // Rolling forest-floor undulation (zero inside the ditch)
  const hillMask = smoothstep(FOREST_DITCH_OUTER_X, 23, a);
  if (hillMask > 0) {
    const hills =
      Math.sin(x * 0.19 + ph) * 0.9 +
      Math.sin(zLocal * k * 2 + x * 0.13 + ph * 1.7) * 0.75 +
      Math.sin(zLocal * k * 5 - x * 0.31 + ph * 0.6) * 0.3 +
      Math.cos(zLocal * k * 9 + x * 0.57) * 0.12;
    y += hills * hillMask;
  }
  return y;
}

// ---------------------------------------------------------------------------
// Trees
// ---------------------------------------------------------------------------

// Natural albedos (converted from sRGB hex into the linear working space)
// Bark vertex colours are relative tints around 1.0: they multiply the bark
// material (scanned bark, or the procedural fallback colour).
const BARK_DARK = new THREE.Color(0.86, 0.86, 0.86);
const BARK_LIGHT = new THREE.Color(1.08, 1.06, 1.02);
const BARK_DEAD = new THREE.Color(1.25, 1.3, 1.35);
const BARK_MOSS = new THREE.Color(0.62, 0.82, 0.42);
const LEAF_DARK = new THREE.Color(0x2f4a1e);
const LEAF_LIGHT = new THREE.Color(0x4f6b2a);
const LEAF_SHADE = new THREE.Color(0x1f3214);

/**
 * Procedurally generates a composite tree geometry (buttressed trunk, limbs and
 * soft leafy crown clumps) with natural vertex colours and smooth normals.
 * All foliage sits above TREE_FOLIAGE_MIN_Y (local units).
 */
export function createProceduralTreeGeometry(archetype: TreeArchetype, seed = 101): THREE.BufferGeometry {
  const it = createProceduralTreeGeometryGen(archetype, seed);
  let r = it.next();
  while (!r.done) r = it.next();
  return r.value;
}

/** Same as createProceduralTreeGeometry, yielding after each crown clump (for sliced warmup). */
export function* createProceduralTreeGeometryGen(
  archetype: TreeArchetype,
  seed = 101
): Generator<void, THREE.BufferGeometry> {
  const geometries: THREE.BufferGeometry[] = []; // bark: trunk + limbs
  const clumps: THREE.BufferGeometry[] = []; // leafy crown masses

  let s = seed;
  const rnd = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };

  const isDead = archetype.tier === 'dead';
  const tmpColor = new THREE.Color();
  // Alpha-tested leaf cards (geometry group 1) break up the crown silhouette
  const leafCards: THREE.BufferGeometry[] = [];

  // 1. Trunk with buttress roots
  const trunkHeight = archetype.height * (isDead ? 0.85 : 0.7);
  const sink = 0.6; // base sits below ground so slopes never show a gap
  const rBase = archetype.trunkRadius * (archetype.tier === 'ancient' ? 0.95 : 0.8);
  const rTop = archetype.trunkRadius * (isDead ? 0.3 : 0.38);
  const radialSegments = archetype.tier === 'ancient' ? 18 : 14;
  const trunkGeom = new THREE.CylinderGeometry(rTop, rBase, trunkHeight, radialSegments, 12);
  trunkGeom.translate(0, trunkHeight * 0.5 - sink, 0);

  const pos = trunkGeom.attributes.position;
  const uv = trunkGeom.attributes.uv;
  const colors: number[] = [];
  const flareHeight = rBase * 1.6;
  const barkBase = isDead ? BARK_DEAD : BARK_DARK;

  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const r = Math.hypot(x, z);
    const ang = Math.atan2(z, x);
    const yAbove = y + sink;

    // Buttress roots: flare near the ground with lobed ridges
    const flareT = Math.max(0, 1 - yAbove / flareHeight);
    const flare = 1 + flareT * flareT * 0.75 * (0.75 + 0.25 * Math.sin(ang * 5 + seed));
    // Fine bark ridging
    const ridge = 1 + 0.035 * Math.sin(ang * 11 + yAbove * 0.35);
    const nr = r * flare * ridge;
    // Gentle natural lean / sway of the bole
    const lean = Math.sin(yAbove * 0.12 + seed) * archetype.trunkRadius * 0.12;

    pos.setX(i, Math.cos(ang) * nr + lean);
    pos.setZ(i, Math.sin(ang) * nr);

    // Bark colour with mossy base and moss on one side
    const n = 0.5 + 0.5 * Math.sin(ang * 3 + yAbove * 0.7 + seed);
    tmpColor.copy(barkBase).lerp(BARK_LIGHT, isDead ? n * 0.3 : n);
    const moss =
      (1 - smoothstep(0, 3.5, yAbove)) * 0.75 +
      Math.max(0, Math.cos(ang - 1.0)) * 0.3 * (1 - smoothstep(4, 12, yAbove));
    tmpColor.lerp(BARK_MOSS, Math.min(0.85, moss));
    colors.push(tmpColor.r, tmpColor.g, tmpColor.b);

    uv.setXY(i, uv.getX(i) * Math.max(2, Math.round((Math.PI * 2 * rBase) / 2.4)), uv.getY(i) * (trunkHeight / 2.4));
  }
  trunkGeom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  trunkGeom.computeVertexNormals();
  geometries.push(trunkGeom);

  // 2. Main limbs reaching into the crown (always above the clearance height)
  const limbCount = isDead ? 2 : Math.max(2, archetype.canopyClusters - 1);
  for (let l = 0; l < limbCount; l++) {
    const len = archetype.height * (isDead ? 0.18 : 0.26) * (0.8 + rnd() * 0.4);
    const tilt = 0.6 + rnd() * 0.35;
    const h0 = Math.max(
      TREE_FOLIAGE_MIN_Y + 1.0,
      trunkHeight * (0.6 + rnd() * 0.3) - sink
    );
    const limb = new THREE.CylinderGeometry(rTop * 0.45, rTop * 0.85, len, 8, 3);
    limb.translate(0, len * 0.5, 0);
    limb.rotateZ(-tilt);
    limb.rotateY((l / limbCount) * Math.PI * 2 + rnd() * 0.6);
    limb.translate(0, h0, 0);
    const lCol: number[] = [];
    const lPos = limb.attributes.position;
    const lUv = limb.attributes.uv;
    for (let j = 0; j < lPos.count; j++) {
      tmpColor.copy(barkBase).lerp(BARK_LIGHT, 0.4);
      lCol.push(tmpColor.r, tmpColor.g, tmpColor.b);
      lUv.setXY(j, lUv.getX(j) * 2, lUv.getY(j) * (len / 2.4));
    }
    limb.setAttribute('color', new THREE.Float32BufferAttribute(lCol, 3));
    limb.computeVertexNormals();
    geometries.push(limb);
  }

  // 3. Leafy crown: many soft, lumpy clumps with smooth normals
  if (archetype.canopyClusters > 0) {
    const clumpCount = archetype.canopyClusters * 2 + 2;
    const crownCY = archetype.height * 0.74;
    const vAxis = archetype.height * 0.17;
    const hAxis = archetype.crownRadius * 0.62;
    const golden = Math.PI * (3 - Math.sqrt(5));
    const dir = new THREE.Vector3();
    const nrm = new THREE.Vector3();

    for (let c = 0; c < clumpCount; c++) {
      const radius = archetype.crownRadius * (0.3 + rnd() * 0.2);
      const angle = c * golden + rnd() * 0.5;
      const distF = Math.sqrt(rnd());
      const cx = Math.cos(angle) * hAxis * distF;
      const cz = Math.sin(angle) * hAxis * distF;
      let cy = crownCY + (rnd() * 2 - 1) * vAxis + (1 - distF) * vAxis * 0.5;
      cy = Math.max(cy, TREE_FOLIAGE_MIN_Y + radius * 1.25);
      const tint = 0.88 + rnd() * 0.2;
      const phase = rnd() * 10;

      // Core mass is smaller than the crown clump: the alpha-tested leaf cards
      // around it form the silhouette, so the crown never reads as a smooth blob.
      const core = 0.74;
      const clump = new THREE.IcosahedronGeometry(1, 2);
      const cPos = clump.attributes.position;
      const cNorm = clump.attributes.normal;
      const cUv = clump.attributes.uv;
      const cColors: number[] = [];

      for (let j = 0; j < cPos.count; j++) {
        dir.set(cPos.getX(j), cPos.getY(j), cPos.getZ(j)).normalize();
        const bump =
          1 +
          0.14 * Math.sin(dir.x * 5.1 + phase) * Math.sin(dir.y * 4.3 + seed) +
          0.08 * Math.sin(dir.z * 9.7 + phase * 2) +
          0.05 * Math.sin(dir.x * 15.3 + dir.y * 7.1 + phase * 3) * Math.sin(dir.z * 13.9 - dir.y * 5.3 + seed);
        const yScale = dir.y < 0 ? 0.6 : 0.85; // flatter underside
        const px = cx + dir.x * radius * core * bump;
        const py = cy + dir.y * radius * core * bump * yScale;
        const pz = cz + dir.z * radius * core * bump;
        cPos.setXYZ(j, px, py, pz);

        // Soft, slightly up-biased normals read as a leafy mass, not a facet
        nrm.set(dir.x, dir.y * 1.2 + 0.25, dir.z).normalize();
        cNorm.setXYZ(j, nrm.x, nrm.y, nrm.z);

        // Sunlit top, shaded underside, darker crown interior
        const hf = Math.min(1, Math.max(0, (dir.y + 1) * 0.5));
        const outer = Math.min(1, distF + 0.35);
        const var01 = 0.5 + 0.5 * Math.sin(dir.x * 7 + dir.z * 5 + phase);
        tmpColor.copy(LEAF_DARK).lerp(LEAF_LIGHT, Math.min(1, hf * 0.75 + var01 * 0.25));
        tmpColor.lerp(LEAF_SHADE, (1 - hf) * 0.55 * (1.2 - outer));
        tmpColor.multiplyScalar(tint * 0.82);
        cColors.push(tmpColor.r, tmpColor.g, tmpColor.b);

        cUv.setXY(j, cUv.getX(j) * 3, cUv.getY(j) * 3);
      }
      clump.setAttribute('color', new THREE.Float32BufferAttribute(cColors, 3));
      clumps.push(clump);

      // Leaf cards scattered over the clump surface (upper-biased), each a
      // two-sided quad whose normals point out of the crown so both faces
      // shade like the foliage mass around them.
      const cardCount = 20;
      const cardPos: number[] = [];
      const cardNrm: number[] = [];
      const cardCol: number[] = [];
      const cardUv: number[] = [];
      const cardIdx: number[] = [];
      const u = new THREE.Vector3();
      const w = new THREE.Vector3();
      const rv = new THREE.Vector3();
      for (let k = 0; k < cardCount; k++) {
        dir.set(rnd() * 2 - 1, rnd() * 1.4 - 0.3, rnd() * 2 - 1).normalize();
        const centre = new THREE.Vector3(cx, cy, cz).addScaledVector(dir, radius * (0.6 + rnd() * 0.45));
        const half = radius * (0.36 + rnd() * 0.24);
        rv.set(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1).normalize();
        u.crossVectors(dir, rv).normalize();
        if (u.lengthSq() < 1e-6) u.set(1, 0, 0);
        w.crossVectors(u, dir).normalize();
        // Tilt the card partly toward the outward direction for variety
        w.lerp(dir, rnd() * 0.5).normalize();
        nrm.set(dir.x, dir.y * 1.2 + 0.25, dir.z).normalize();
        const hf = Math.min(1, Math.max(0, (dir.y + 1) * 0.5));
        const shade = (0.62 + hf * 0.45) * tint;
        const base = cardPos.length / 3;
        const corners: Array<[number, number]> = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
        for (const [a, b] of corners) {
          cardPos.push(
            centre.x + (u.x * a + w.x * b) * half,
            centre.y + (u.y * a + w.y * b) * half,
            centre.z + (u.z * a + w.z * b) * half
          );
          cardNrm.push(nrm.x, nrm.y, nrm.z);
          cardCol.push(shade, shade, shade);
          cardUv.push((a + 1) / 2, (b + 1) / 2);
        }
        // Front and back faces (reverse winding) share the outward normal
        cardIdx.push(base, base + 1, base + 2, base, base + 2, base + 3);
        cardIdx.push(base, base + 2, base + 1, base, base + 3, base + 2);
      }
      const cards = new THREE.BufferGeometry();
      cards.setAttribute('position', new THREE.Float32BufferAttribute(cardPos, 3));
      cards.setAttribute('normal', new THREE.Float32BufferAttribute(cardNrm, 3));
      cards.setAttribute('color', new THREE.Float32BufferAttribute(cardCol, 3));
      cards.setAttribute('uv', new THREE.Float32BufferAttribute(cardUv, 2));
      cards.setIndex(cardIdx);
      leafCards.push(cards);
      yield;
    }
  }

  // Groups: 0 = bark (trunk + limbs), 1 = crown clumps, 2 = leaf cards
  const count = (list: THREE.BufferGeometry[]) => {
    let n = 0;
    for (const g of list) n += g.index ? g.index.count : g.attributes.position.count;
    return n;
  };
  const barkCount = count(geometries);
  const clumpCount = count(clumps);
  const merged = mergeBufferGeometriesCustom([...geometries, ...clumps, ...leafCards]);
  for (const g of geometries) g.dispose();
  for (const g of clumps) g.dispose();
  for (const g of leafCards) g.dispose();
  merged.clearGroups();
  merged.addGroup(0, barkCount, 0);
  if (clumpCount > 0) merged.addGroup(barkCount, clumpCount, 1);
  if (merged.index && merged.index.count > barkCount + clumpCount) {
    merged.addGroup(barkCount + clumpCount, merged.index.count - barkCount - clumpCount, 2);
  }
  merged.computeBoundingSphere();
  merged.computeBoundingBox();
  return merged;
}

// ---------------------------------------------------------------------------
// Ground
// ---------------------------------------------------------------------------

const SOIL_UNDER_ROAD = new THREE.Color(0x2e2a22);
const VERGE_LITTER = new THREE.Color(0x4a3f2c);
const VERGE_MOSS = new THREE.Color(0x4b5a2c);
const DITCH_MUD = new THREE.Color(0x3a3624);
const DITCH_MOSS = new THREE.Color(0x3d4a26);
const FLOOR_MOSS = new THREE.Color(0x556b2f);
const FLOOR_LOAM = new THREE.Color(0x3d4a26);
const FLOOR_LITTER = new THREE.Color(0x5a4a32);

/**
 * Creates the forest floor ground chunk: a flat bed hidden under the road slab
 * (|x| <= 5.5, y = -0.08), a gentle verge into a flat roadside ditch
 * (8.5..12.5 m), then a mossy bank rising into rolling forest floor.
 * Heights are periodic over `length`, and normals are analytic, so chunks tile
 * without seams.
 */
export function createForestFloorEmbankmentGeometry(
  width: number,
  length: number,
  segmentsX = 16,
  segmentsZ = 20,
  seed = 42
): THREE.BufferGeometry {
  const half = width / 2;

  // Lateral columns: dense where the profile changes, coarser further out
  const cols: number[] = [1.75, 3.5, 5.5, 6.5, 7.5, 8.5, 9.5, 10.5, 11.5, 12.5].filter(
    v => v < half
  );
  const step = width / Math.max(8, segmentsX);
  let last = cols.length ? cols[cols.length - 1] : 0;
  while (last + step < half - step * 0.25) {
    last += step;
    cols.push(last);
  }
  cols.push(half);
  const xs: number[] = [];
  for (let i = cols.length - 1; i >= 0; i--) xs.push(-cols[i]);
  xs.push(0);
  for (const c of cols) xs.push(c);

  const rows = Math.max(4, segmentsZ);
  const nx = xs.length;
  const nz = rows + 1;

  const positions = new Float32Array(nx * nz * 3);
  const normals = new Float32Array(nx * nz * 3);
  const uvs = new Float32Array(nx * nz * 2);
  const colors = new Float32Array(nx * nz * 3);
  const tmp = new THREE.Color();
  const tmp2 = new THREE.Color();
  const n = new THREE.Vector3();
  const k = (Math.PI * 2) / length;
  const eps = 0.25;

  let vi = 0;
  for (let iz = 0; iz < nz; iz++) {
    const z = -length / 2 + (iz / rows) * length;
    for (let ix = 0; ix < nx; ix++) {
      const x = xs[ix];
      const y = sampleForestFloorHeight(x, z, length, seed);
      positions[vi * 3] = x;
      positions[vi * 3 + 1] = y;
      positions[vi * 3 + 2] = z;

      const dx =
        (sampleForestFloorHeight(x + eps, z, length, seed) -
          sampleForestFloorHeight(x - eps, z, length, seed)) /
        (2 * eps);
      const dz =
        (sampleForestFloorHeight(x, z + eps, length, seed) -
          sampleForestFloorHeight(x, z - eps, length, seed)) /
        (2 * eps);
      n.set(-dx, 1, -dz).normalize();
      normals[vi * 3] = n.x;
      normals[vi * 3 + 1] = n.y;
      normals[vi * 3 + 2] = n.z;

      // World-scaled UVs (60 / 4 = 15 whole repeats per chunk -> seamless)
      uvs[vi * 2] = x / 4;
      uvs[vi * 2 + 1] = z / 4;

      // Natural forest floor colouring
      const a = Math.abs(x);
      const n1 = 0.5 + 0.5 * Math.sin(x * 0.7 + z * k * 7 + seed);
      const n2 = 0.5 + 0.5 * Math.sin(x * 0.23 - z * k * 3 + seed * 0.5);
      // Forest floor
      tmp.copy(FLOOR_LOAM).lerp(FLOOR_MOSS, n1).lerp(FLOOR_LITTER, n2 * 0.45);
      // Ditch
      const ditchW =
        smoothstep(7.5, 8.75, a) * (1 - smoothstep(12.0, 14.0, a));
      if (ditchW > 0) {
        tmp2.copy(DITCH_MUD).lerp(DITCH_MOSS, n1);
        tmp.lerp(tmp2, ditchW);
      }
      // Verge
      const vergeW = 1 - smoothstep(7.0, 8.5, a);
      if (vergeW > 0) {
        tmp2.copy(VERGE_LITTER).lerp(VERGE_MOSS, n1 * 0.7);
        tmp.lerp(tmp2, vergeW);
      }
      // Under the road slab
      tmp.lerp(SOIL_UNDER_ROAD, 1 - smoothstep(5.0, 5.6, a));

      colors[vi * 3] = tmp.r;
      colors[vi * 3 + 1] = tmp.g;
      colors[vi * 3 + 2] = tmp.b;
      vi++;
    }
  }

  const indices: number[] = [];
  for (let iz = 0; iz < rows; iz++) {
    for (let ix = 0; ix < nx - 1; ix++) {
      const a = iz * nx + ix;
      const b = a + 1;
      const c = a + nx;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geom.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geom.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geom.setIndex(indices);
  geom.computeBoundingSphere();
  geom.computeBoundingBox();
  return geom;
}

/**
 * Merges indexed / non-indexed geometries (position, normal, color, uv)
 * into a single indexed geometry without external dependencies.
 */
function mergeBufferGeometriesCustom(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry {
  let vertexTotal = 0;
  let indexTotal = 0;
  for (const g of geometries) {
    const count = g.attributes.position.count;
    vertexTotal += count;
    indexTotal += g.index ? g.index.count : count;
  }

  const posArr = new Float32Array(vertexTotal * 3);
  const normArr = new Float32Array(vertexTotal * 3);
  const colArr = new Float32Array(vertexTotal * 3);
  const uvArr = new Float32Array(vertexTotal * 2);
  const indexArr = new Uint32Array(indexTotal);

  let vOff = 0;
  let iOff = 0;
  for (const g of geometries) {
    const pos = g.attributes.position;
    const norm = g.attributes.normal;
    const col = g.attributes.color;
    const uv = g.attributes.uv;

    for (let i = 0; i < pos.count; i++) {
      const o = (vOff + i) * 3;
      posArr[o] = pos.getX(i);
      posArr[o + 1] = pos.getY(i);
      posArr[o + 2] = pos.getZ(i);
      if (norm) {
        normArr[o] = norm.getX(i);
        normArr[o + 1] = norm.getY(i);
        normArr[o + 2] = norm.getZ(i);
      } else {
        normArr[o + 1] = 1;
      }
      if (col) {
        colArr[o] = col.getX(i);
        colArr[o + 1] = col.getY(i);
        colArr[o + 2] = col.getZ(i);
      } else {
        colArr[o] = colArr[o + 1] = colArr[o + 2] = 0.2;
      }
      if (uv) {
        uvArr[(vOff + i) * 2] = uv.getX(i);
        uvArr[(vOff + i) * 2 + 1] = uv.getY(i);
      }
    }

    if (g.index) {
      for (let i = 0; i < g.index.count; i++) indexArr[iOff + i] = g.index.getX(i) + vOff;
      iOff += g.index.count;
    } else {
      for (let i = 0; i < pos.count; i++) indexArr[iOff + i] = vOff + i;
      iOff += pos.count;
    }
    vOff += pos.count;
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(normArr, 3));
  merged.setAttribute('color', new THREE.BufferAttribute(colArr, 3));
  merged.setAttribute('uv', new THREE.BufferAttribute(uvArr, 2));
  merged.setIndex(new THREE.BufferAttribute(indexArr, 1));
  return merged;
}

/**
 * 256x256 RGBA sprite of overlapping broadleaf leaves (sRGB albedo, alpha
 * coverage) inside a ragged disc. Returns null without a DOM.
 */
let leafTextureCache: THREE.CanvasTexture | null | undefined;
export function getLeafClusterTexture(): THREE.CanvasTexture | null {
  if (leafTextureCache !== undefined) return leafTextureCache;
  if (typeof document === 'undefined') return null;
  leafTextureCache = createLeafClusterTexture();
  return leafTextureCache;
}

function createLeafClusterTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  let s = 24601;
  const rnd = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  ctx.clearRect(0, 0, size, size);
  const leaves = 950;
  for (let i = 0; i < leaves; i++) {
    // Denser toward the centre, ragged toward the rim
    const ang = rnd() * Math.PI * 2;
    const rad = Math.pow(rnd(), 0.55) * size * 0.44;
    const x = size / 2 + Math.cos(ang) * rad;
    const y = size / 2 + Math.sin(ang) * rad;
    const len = 14 + rnd() * 12;
    const wid = len * (0.42 + rnd() * 0.15);
    const rot = rnd() * Math.PI * 2;
    // Mid-green leaves with yellow-green sunlit and dark olive variants
    const t = rnd();
    const r = Math.round(46 + t * 50 + (rnd() - 0.5) * 12);
    const g = Math.round(70 + t * 52 + (rnd() - 0.5) * 14);
    const b = Math.round(26 + t * 18 + (rnd() - 0.5) * 8);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.fillStyle = 'rgb(' + r + ',' + g + ',' + b + ')';
    ctx.beginPath();
    ctx.moveTo(-len / 2, 0);
    ctx.quadraticCurveTo(0, -wid, len / 2, 0);
    ctx.quadraticCurveTo(0, wid, -len / 2, 0);
    ctx.fill();
    // Midrib
    ctx.strokeStyle = 'rgba(' + Math.round(r * 0.75) + ',' + Math.round(g * 0.8) + ',' + Math.round(b * 0.7) + ',0.9)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(-len / 2, 0);
    ctx.lineTo(len / 2, 0);
    ctx.stroke();
    ctx.restore();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
