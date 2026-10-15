import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export interface CrystalClusterArchetype {
  id: string;
  name: string;
  tier: 'spire' | 'cluster' | 'monolith' | 'shard';
  height: number;
  radius: number;
  facets: number;
  shardCount: number;
}

/**
 * Ice / quartz formations of the high-alpine glacier.
 * - 'celestial-spire'   : tall serac-like glacial ice tower
 * - 'prismatic-cluster' : clear quartz cluster (crystals radiating from a base)
 * - 'floating-monolith' : massive blocky ice serac (unused by default streaming)
 * - 'ground-shard'      : small ice / quartz shard group poking out of the snow
 */
export const CRYSTAL_ARCHETYPES: CrystalClusterArchetype[] = [
  {
    id: 'celestial-spire',
    name: 'Glacial Ice Serac',
    tier: 'spire',
    height: 22.0,
    radius: 3.2,
    facets: 6,
    shardCount: 5,
  },
  {
    id: 'prismatic-cluster',
    name: 'Clear Quartz Cluster',
    tier: 'cluster',
    height: 8.0,
    radius: 1.3,
    facets: 6,
    shardCount: 7,
  },
  {
    id: 'floating-monolith',
    name: 'Ice Serac Block',
    tier: 'monolith',
    height: 14.0,
    radius: 4.0,
    facets: 7,
    shardCount: 4,
  },
  {
    id: 'ground-shard',
    name: 'Ice Shards',
    tier: 'shard',
    height: 4.5,
    radius: 0.8,
    facets: 6,
    shardCount: 3,
  },
];

// Physically motivated base colours (sRGB hex -> converted to linear by THREE.Color)
const SNOW = new THREE.Color(0xe9eef3);
const SNOW_SHADE = new THREE.Color(0xd9e3ec);
const DIRTY_SNOW = new THREE.Color(0xa7a6a2);
const GRANITE_LIGHT = new THREE.Color(0x8a8f94);
const GRANITE_DARK = new THREE.Color(0x6f7377);
const ICE_TIP = new THREE.Color(0xf3f8fb);
const ICE_MID = new THREE.Color(0xd3e6f1);
const ICE_DEEP = new THREE.Color(0xa9cde0);
const _tmpRock = new THREE.Color();

/** Length (m) of one streamed ground chunk. Ground noise is periodic over it so chunks tile seamlessly. */
export const CRYSTAL_HEIGHTS_CHUNK_LENGTH = 60;

const TWO_PI = Math.PI * 2;
const ZK = TWO_PI / CRYSTAL_HEIGHTS_CHUNK_LENGTH;

function smooth01(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}

/**
 * Height of the snowfield at (x, z). z may be chunk-local or world-space: the
 * function is periodic in z with the chunk length, so both give the same value.
 * - |x| <= 5.5 : flat bed at y = -0.10 (hidden under the road slab)
 * - 5.5..7.5   : snow shoulder easing up to y = +0.05
 * - beyond     : snowfield rising into foothills (~25 m at |x| = 100)
 */
export function crystalHeightsGroundHeight(x: number, z: number, seed = 222): number {
  const ax = Math.abs(x);
  if (ax <= 5.5) return -0.1;
  if (ax <= 7.5) return -0.1 + ((ax - 5.5) / 2.0) * 0.15;

  const d = ax - 7.5;
  const base = 0.05 + d * 0.06 + d * d * 0.0022;
  const p = seed * 0.37;
  const n =
    Math.sin(x * 0.13 + z * ZK + p) * 0.9 +
    Math.sin(x * 0.31 - z * ZK * 2 + p * 1.7) * 0.45 +
    Math.sin(x * 0.047 + z * ZK * 3 + p * 0.6) * 0.35 * Math.cos(x * 0.09);
  const amp = smooth01(d / 10) * (1.0 + d * 0.045);
  return base + n * amp;
}

/**
 * Procedurally generates an ice / quartz formation (faceted hexagonal prisms with
 * pyramidal terminations) with blue-white vertex colours: deep glacial blue at the
 * base, clearer and whiter toward the tips.
 */
export function createProceduralCrystalGeometry(
  archetype: CrystalClusterArchetype,
  seed = 909
): THREE.BufferGeometry {
  const geometries: THREE.BufferGeometry[] = [];

  let s = seed;
  const rnd = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };

  const mainHeight = archetype.height;
  const mainRadius = archetype.radius;
  geometries.push(createSingleCrystalPrism(mainRadius, mainHeight, archetype.facets, 0.3));

  // Sub-crystals radiating outward from the base
  for (let i = 0; i < archetype.shardCount - 1; i++) {
    const angle = (i / (archetype.shardCount - 1)) * Math.PI * 2 + (rnd() - 0.5) * 0.4;
    const dist = mainRadius * (0.8 + rnd() * 0.5);
    const subHeight = mainHeight * (0.3 + rnd() * 0.3);
    const subRadius = mainRadius * (0.4 + rnd() * 0.2);

    const subGeom = createSingleCrystalPrism(subRadius, subHeight, archetype.facets, 0.3);
    subGeom.rotateY(rnd() * Math.PI);
    // Lean outward, away from the main crystal
    const tilt = 0.2 + rnd() * 0.25;
    subGeom.rotateZ(-Math.cos(angle) * tilt);
    subGeom.rotateX(Math.sin(angle) * tilt);
    subGeom.translate(Math.cos(angle) * dist, -subHeight * 0.06, Math.sin(angle) * dist);
    geometries.push(subGeom);
  }

  const merged = mergeCrystalGeometries(geometries);
  for (const g of geometries) g.dispose();
  // Sink slightly so the base is buried in the snow
  merged.translate(0, -mainHeight * 0.03, 0);
  merged.computeBoundingSphere();
  merged.computeBoundingBox();
  return merged;
}

/**
 * Maximum horizontal distance (m) of any vertex from the local Y axis.
 * Placement code uses it so a randomly rotated formation never reaches the road.
 */
export function getGeometryHorizontalRadius(geom: THREE.BufferGeometry): number {
  const pos = geom.attributes.position;
  let maxR2 = 0;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const r2 = x * x + z * z;
    if (r2 > maxR2) maxR2 = r2;
  }
  return Math.sqrt(maxR2);
}

/**
 * Single faceted crystal prism (pyramidal termination + hexagonal shaft).
 */
function createSingleCrystalPrism(
  radius: number,
  height: number,
  facets: number,
  tipRatio: number
): THREE.BufferGeometry {
  const geom = new THREE.BufferGeometry();
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  const shoulderHeight = height * (1.0 - tipRatio);

  positions.push(0, height, 0);
  colors.push(ICE_TIP.r, ICE_TIP.g, ICE_TIP.b);

  for (let i = 0; i < facets; i++) {
    const theta = (i / facets) * Math.PI * 2;
    positions.push(Math.cos(theta) * radius, shoulderHeight, Math.sin(theta) * radius);
    colors.push(ICE_MID.r, ICE_MID.g, ICE_MID.b);
  }

  for (let i = 0; i < facets; i++) {
    const theta = (i / facets) * Math.PI * 2;
    positions.push(Math.cos(theta) * radius * 0.9, 0, Math.sin(theta) * radius * 0.9);
    colors.push(ICE_DEEP.r, ICE_DEEP.g, ICE_DEEP.b);
  }

  for (let i = 0; i < facets; i++) {
    const next = (i + 1) % facets;
    indices.push(0, 1 + next, 1 + i);
  }

  for (let i = 0; i < facets; i++) {
    const next = (i + 1) % facets;
    const s1 = 1 + i;
    const s2 = 1 + next;
    const b1 = 1 + facets + i;
    const b2 = 1 + facets + next;
    indices.push(s1, s2, b1);
    indices.push(s2, b2, b1);
  }

  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geom.setIndex(indices);
  // Crystals stay faceted: expand to non-indexed so every face gets a flat normal
  const flat = geom.toNonIndexed();
  geom.dispose();
  flat.computeVertexNormals();
  return flat;
}

/**
 * Granite outcrop / boulder (kept the original export name).
 * A noise-displaced rounded rock, base slightly buried, snow settled on the
 * upward-facing surfaces. Smooth-shaded with planar UVs for the noise texture.
 */
export function createCelestialPlatformGeometry(
  width: number,
  depth: number,
  thickness: number,
  segments = 8
): THREE.BufferGeometry {
  const detail = Math.max(2, Math.min(4, Math.round(segments / 3)));
  let geom: THREE.BufferGeometry = new THREE.IcosahedronGeometry(1, detail);
  geom.deleteAttribute('normal');
  geom.deleteAttribute('uv');
  geom = mergeVertices(geom);

  const pos = geom.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const n =
      Math.sin(x * 3.1 + y * 1.7) * 0.12 +
      Math.sin(z * 4.3 - x * 2.2 + 1.3) * 0.08 +
      Math.sin(y * 6.7 + z * 5.1) * 0.04;
    const k = 1 + n;
    // Flatten the top a little (weathered tor), sink the base
    const yy = y > 0.35 ? 0.35 + (y - 0.35) * 0.6 : y;
    pos.setXYZ(i, x * k * width * 0.5, (yy * k + 0.25) * thickness * 0.75, z * k * depth * 0.5);
  }
  geom.computeVertexNormals();

  const norm = geom.attributes.normal;
  const colors: number[] = [];
  const uvs: number[] = [];
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const ny = norm.getY(i);
    const grain = Math.sin(x * 1.3 + z * 0.7) * 0.5 + 0.5;
    c.copy(GRANITE_DARK).lerp(GRANITE_LIGHT, grain);
    const snow = smooth01((ny - 0.62) / 0.2);
    c.lerp(SNOW, snow);
    colors.push(c.r, c.g, c.b);
    uvs.push(x / 4, (pos.getY(i) + z) / 4);
  }
  geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geom.computeBoundingSphere();
  geom.computeBoundingBox();
  return geom;
}

/**
 * Snowfield chunk around the road (kept the original export name).
 * Non-uniform columns put exact break points at |x| = 5.5 / 7.5 so the bed is
 * flat at y = -0.10 under the road slab and never rises above y = 0.05 within
 * |x| < 7.5. Height comes from crystalHeightsGroundHeight (periodic in z → seamless).
 */
export function createCelestialHighwayChunkGeometry(
  width: number,
  length: number,
  segmentsX = 14,
  segmentsZ = 16,
  seed = 616
): THREE.BufferGeometry {
  const half = width * 0.5;
  const outer = Math.max(4, Math.round(segmentsX / 2));
  const posCols: number[] = [0, 2.75, 5.5, 6.5, 7.5];
  for (let i = 1; i <= outer; i++) {
    const t = i / outer;
    posCols.push(7.5 + (half - 7.5) * Math.pow(t, 1.6));
  }
  const cols: number[] = [];
  for (let i = posCols.length - 1; i > 0; i--) cols.push(-posCols[i]);
  for (const x of posCols) cols.push(x);

  const nx = cols.length;
  const nz = segmentsZ + 1;
  const positions = new Float32Array(nx * nz * 3);
  const uvs = new Float32Array(nx * nz * 2);
  const uRepeats = Math.max(1, Math.round(length / 12));

  for (let iz = 0; iz < nz; iz++) {
    const z = -length * 0.5 + (iz / segmentsZ) * length;
    for (let ix = 0; ix < nx; ix++) {
      const x = cols[ix];
      const idx = iz * nx + ix;
      positions[idx * 3] = x;
      positions[idx * 3 + 1] = crystalHeightsGroundHeight(x, z, seed);
      positions[idx * 3 + 2] = z;
      uvs[idx * 2] = x / 12;
      uvs[idx * 2 + 1] = (iz / segmentsZ) * uRepeats;
    }
  }

  const indices: number[] = [];
  for (let iz = 0; iz < segmentsZ; iz++) {
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
  geom.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geom.setIndex(indices);
  geom.computeVertexNormals();

  // Colour: snow everywhere, dirty plough-snow along the shoulder, granite on steep faces
  const norm = geom.attributes.normal;
  const colors = new Float32Array(nx * nz * 3);
  const c = new THREE.Color();
  for (let i = 0; i < nx * nz; i++) {
    const x = positions[i * 3];
    const z = positions[i * 3 + 2];
    const ax = Math.abs(x);
    const ny = norm.getY(i);

    const drift = Math.sin(x * 0.21 + z * ZK * 2) * 0.5 + 0.5;
    c.copy(SNOW).lerp(SNOW_SHADE, drift * 0.6);

    if (ax < 8.5) {
      c.lerp(DIRTY_SNOW, 1.0 - smooth01((ax - 5.5) / 3.0));
    }

    const rockMask = smooth01((0.9 - ny) / 0.12);
    const rockPatch = ax > 14 ? smooth01((Math.sin(x * 0.17 + z * ZK * 3 + seed) - 0.55) / 0.3) : 0;
    const rock = Math.max(rockMask, rockPatch * 0.85);
    if (rock > 0) {
      const g = Math.sin(x * 0.9 + z * 0.4) * 0.5 + 0.5;
      _tmpRock.copy(GRANITE_DARK).lerp(GRANITE_LIGHT, g);
      c.lerp(_tmpRock, rock);
    }

    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geom.computeBoundingSphere();
  return geom;
}

/**
 * Snow-capped granite peak for the distant mountain ranges.
 * Radial grid with ridge noise, smooth normals, snow above a ragged snowline and
 * on gentle slopes, bare granite on steep faces.
 */
export function createAlpinePeakGeometry(radius: number, height: number, seed = 1): THREE.BufferGeometry {
  const rings = 14;
  const segs = 40;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const ph1 = seed * 1.7;
  const ph2 = seed * 2.9;
  const ph3 = seed * 0.6;
  const apexX = Math.sin(ph1) * radius * 0.06;
  const apexZ = Math.cos(ph2) * radius * 0.06;

  positions.push(apexX, height, apexZ);
  uvs.push(apexX / 30, apexZ / 30);

  for (let r = 1; r <= rings; r++) {
    const t = r / rings;
    for (let s = 0; s < segs; s++) {
      const theta = (s / segs) * TWO_PI;
      // Ridges: a few dominant arêtes plus finer gullies
      const ridge =
        Math.pow(Math.abs(Math.sin(theta * 1.5 + ph1)), 3) * 0.35 +
        Math.sin(theta * 5 + ph2) * 0.08 +
        Math.sin(theta * 11 + ph3 + t * 6) * 0.04;
      const rr = radius * t * (0.85 + ridge * 0.6);
      const profile = Math.pow(1 - t, 1.35);
      const rough = Math.sin(theta * 17 + t * 23 + ph3) * 0.025 + Math.sin(theta * 7 - t * 11 + ph1) * 0.03;
      const y = height * (profile * (0.8 + ridge * 0.7) + rough * (1 - t)) - height * 0.06 * t;
      const x = apexX * (1 - t) + Math.cos(theta) * rr;
      const z = apexZ * (1 - t) + Math.sin(theta) * rr;
      positions.push(x, y, z);
      uvs.push(x / 30, z / 30);
    }
  }

  for (let s = 0; s < segs; s++) {
    const next = (s + 1) % segs;
    indices.push(0, 1 + next, 1 + s);
  }
  for (let r = 1; r < rings; r++) {
    const a0 = 1 + (r - 1) * segs;
    const b0 = 1 + r * segs;
    for (let s = 0; s < segs; s++) {
      const next = (s + 1) % segs;
      indices.push(a0 + s, a0 + next, b0 + s);
      indices.push(a0 + next, b0 + next, b0 + s);
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geom.setIndex(indices);
  geom.computeVertexNormals();

  const pos = geom.attributes.position;
  const norm = geom.attributes.normal;
  const colors: number[] = [];
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const ny = norm.getY(i);
    const h = y / height;
    const snowline = 0.38 + Math.sin(x * 0.05 + z * 0.04 + ph1) * 0.08;
    const altitudeSnow = smooth01((h - snowline) / 0.12);
    const slopeSnow = smooth01((ny - 0.5) / 0.2);
    const lowSnow = smooth01((ny - 0.78) / 0.12); // flat benches hold snow at any height
    const snow = Math.max(altitudeSnow * slopeSnow, lowSnow * 0.9);
    const g = Math.sin(x * 0.11 + y * 0.07) * 0.5 + 0.5;
    c.copy(GRANITE_DARK).lerp(GRANITE_LIGHT, g).lerp(SNOW, snow);
    colors.push(c.r, c.g, c.b);
  }
  geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geom.computeBoundingSphere();
  return geom;
}

/**
 * Merge BufferGeometries (position / normal / color).
 */
function mergeCrystalGeometries(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const merged = new THREE.BufferGeometry();
  const posArr: number[] = [];
  const normArr: number[] = [];
  const colArr: number[] = [];

  for (const g of geometries) {
    const pos = g.attributes.position;
    const norm = g.attributes.normal;
    const col = g.attributes.color;

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
        colArr.push(ICE_MID.r, ICE_MID.g, ICE_MID.b);
      }
    }
  }

  merged.setAttribute('position', new THREE.Float32BufferAttribute(posArr, 3));
  merged.setAttribute('normal', new THREE.Float32BufferAttribute(normArr, 3));
  merged.setAttribute('color', new THREE.Float32BufferAttribute(colArr, 3));
  return merged;
}

/**
 * Shared tileable value-noise texture (256x256, linear) used to break up the
 * albedo and roughness of snow and granite. Returns null without a DOM (Node tests).
 */
export function createAlpineNoiseTexture(): THREE.Texture | null {
  if (typeof document === 'undefined') return null;
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  let s = 1337;
  const rand = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };

  const octaves = [8, 16, 32, 64, 128];
  const weights = [0.35, 0.25, 0.18, 0.12, 0.1];
  const lattices = octaves.map((n) => {
    const arr = new Float32Array(n * n);
    for (let i = 0; i < arr.length; i++) arr[i] = rand();
    return arr;
  });

  const img = ctx.createImageData(size, size);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let v = 0;
      for (let o = 0; o < octaves.length; o++) {
        const n = octaves[o];
        const lat = lattices[o];
        const fx = (px / size) * n;
        const fy = (py / size) * n;
        const x0 = Math.floor(fx);
        const y0 = Math.floor(fy);
        const tx = smooth01(fx - x0);
        const ty = smooth01(fy - y0);
        const x1 = (x0 + 1) % n;
        const y1 = (y0 + 1) % n;
        const a = lat[y0 * n + x0];
        const b = lat[y0 * n + x1];
        const c = lat[y1 * n + x0];
        const d = lat[y1 * n + x1];
        v += weights[o] * ((a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty);
      }
      // Mostly bright with soft darker mottling: multiplies vertex colour / roughness
      const val = Math.round(255 * (0.8 + 0.2 * v));
      const k = (py * size + px) * 4;
      img.data[k] = val;
      img.data[k + 1] = val;
      img.data[k + 2] = val;
      img.data[k + 3] = 255;
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
 * Shared Crystal Heights (alpine glacier) materials.
 */
export function createCrystalHeightsMaterials() {
  const noiseTexture = createAlpineNoiseTexture();

  // Streamed / distant ice & quartz formations: cheap glossy dielectric (no transmission)
  const crystalMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.12,
    metalness: 0.0,
    envMapIntensity: 1.25,
    flatShading: true,
  });

  // Snowfield, outcrops and mountains: vertex-coloured snow / granite
  const celestialGroundMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: noiseTexture ? 1.0 : 0.9,
    metalness: 0.0,
    flatShading: false,
    map: noiseTexture,
    roughnessMap: noiseTexture,
  });

  // Bare granite
  const celestialArchStoneMaterial = new THREE.MeshStandardMaterial({
    color: 0x7d8287,
    roughness: noiseTexture ? 0.95 : 0.85,
    metalness: 0.0,
    map: noiseTexture,
    roughnessMap: noiseTexture,
  });

  // Hero glacial ice (transmissive) — only for a handful of near-road pieces
  const energyCoreMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xeaf4fa,
    roughness: 0.08,
    metalness: 0.0,
    transmission: 0.85,
    ior: 1.31,
    thickness: 1.5,
    attenuationColor: new THREE.Color(0xbfe0f0),
    attenuationDistance: 4.0,
    flatShading: true,
  });

  return {
    crystalMaterial,
    celestialGroundMaterial,
    celestialArchStoneMaterial,
    energyCoreMaterial,
    noiseTexture,
  };
}
