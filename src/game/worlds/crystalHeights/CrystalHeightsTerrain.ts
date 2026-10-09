import * as THREE from 'three';
import { GraphicsConfig } from '../../../types';

export interface CrystalClusterArchetype {
  id: string;
  name: string;
  tier: 'spire' | 'cluster' | 'monolith' | 'shard';
  height: number;
  radius: number;
  facets: number;
  shardCount: number;
}

export const CRYSTAL_ARCHETYPES: CrystalClusterArchetype[] = [
  {
    id: 'celestial-spire',
    name: 'Monumental Celestial Spire',
    tier: 'spire',
    height: 36.0,
    radius: 3.8,
    facets: 6,
    shardCount: 5,
  },
  {
    id: 'prismatic-cluster',
    name: 'Prismatic Crystal Cluster',
    tier: 'cluster',
    height: 18.0,
    radius: 2.2,
    facets: 6,
    shardCount: 7,
  },
  {
    id: 'floating-monolith',
    name: 'Floating Geode Monolith',
    tier: 'monolith',
    height: 24.0,
    radius: 5.5,
    facets: 7,
    shardCount: 4,
  },
  {
    id: 'ground-shard',
    name: 'Sharp Crystalline Ground Shard',
    tier: 'shard',
    height: 9.0,
    radius: 1.4,
    facets: 5,
    shardCount: 3,
  },
];

/**
 * Procedurally generates crystalline formation geometry (faceted dual-cone prisms)
 * with embedded vertex colors:
 * - Crystal base: Deep cosmic purple (#4338CA to #6D28D9)
 * - Crystal apex & faceted edges: Radiant cyan & lavender (#67E8F9 to #A78BFA)
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

  // Center Main Spire
  const mainHeight = archetype.height;
  const mainRadius = archetype.radius;
  const mainGeom = createSingleCrystalPrism(mainRadius, mainHeight, archetype.facets, 0.45);
  geometries.push(mainGeom);

  // Sub-shards branching around base
  for (let i = 0; i < archetype.shardCount - 1; i++) {
    const angle = (i / (archetype.shardCount - 1)) * Math.PI * 2 + (rnd() - 0.5) * 0.4;
    const dist = mainRadius * (1.1 + rnd() * 0.7);
    const subHeight = mainHeight * (0.35 + rnd() * 0.35);
    const subRadius = mainRadius * (0.45 + rnd() * 0.25);

    const subGeom = createSingleCrystalPrism(subRadius, subHeight, archetype.facets, 0.4);
    // Tilt outward away from center
    const tilt = 0.22 + rnd() * 0.25;
    subGeom.rotateZ(Math.cos(angle) * tilt);
    subGeom.rotateX(Math.sin(angle) * tilt);
    subGeom.translate(Math.cos(angle) * dist, 0, Math.sin(angle) * dist);

    geometries.push(subGeom);
  }

  return mergeCrystalGeometries(geometries);
}

/**
 * Creates single faceted crystal prism (tapered top pyramid + hexagonal shaft)
 */
function createSingleCrystalPrism(
  radius: number,
  height: number,
  facets: number,
  tipRatio: number
): THREE.BufferGeometry {
  const geom = new THREE.BufferGeometry();
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  const tipHeight = height;
  const shoulderHeight = height * (1.0 - tipRatio);

  // Tip Vertex
  positions.push(0, tipHeight, 0);
  normals.push(0, 1, 0);
  // Apex Cyan highlight (#67E8F9 = 0.40, 0.91, 0.98)
  colors.push(0.40, 0.91, 0.98);

  // Shoulder Ring Vertices
  for (let i = 0; i < facets; i++) {
    const theta = (i / facets) * Math.PI * 2;
    const px = Math.cos(theta) * radius;
    const pz = Math.sin(theta) * radius;
    positions.push(px, shoulderHeight, pz);
    normals.push(px / radius, 0.4, pz / radius);
    // Shoulder Lavender (#A78BFA = 0.65, 0.54, 0.98)
    colors.push(0.65, 0.54, 0.98);
  }

  // Base Ring Vertices
  for (let i = 0; i < facets; i++) {
    const theta = (i / facets) * Math.PI * 2;
    const px = Math.cos(theta) * (radius * 0.85);
    const pz = Math.sin(theta) * (radius * 0.85);
    positions.push(px, 0, pz);
    normals.push(px / radius, -0.2, pz / radius);
    // Base Deep Indigo/Purple (#4338CA = 0.26, 0.22, 0.79)
    colors.push(0.26, 0.22, 0.79);
  }

  // Indices for tip cap triangles
  for (let i = 0; i < facets; i++) {
    const next = (i + 1) % facets;
    indices.push(0, 1 + i, 1 + next);
  }

  // Indices for side quads (as 2 triangles)
  for (let i = 0; i < facets; i++) {
    const next = (i + 1) % facets;
    const s1 = 1 + i;
    const s2 = 1 + next;
    const b1 = 1 + facets + i;
    const b2 = 1 + facets + next;
    indices.push(s1, b1, s2);
    indices.push(s2, b1, b2);
  }

  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();

  return geom;
}

/**
 * Creates floating celestial rock island/platform:
 * Dark faceted celestial rock underside with crystalline upper terrace.
 */
export function createCelestialPlatformGeometry(
  width: number,
  depth: number,
  thickness: number,
  segments = 8
): THREE.BufferGeometry {
  const geom = new THREE.CylinderGeometry(width * 0.5, width * 0.25, thickness, segments, 2);
  geom.translate(0, -thickness * 0.5, 0);

  const pos = geom.attributes.position;
  const colors: number[] = [];

  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    // Deep starry void rock (#0F172A) at base, transitioning to violet rim (#6D28D9) at top
    const blend = Math.max(0, Math.min(1.0, (y + thickness) / thickness));
    const r = THREE.MathUtils.lerp(0.06, 0.42, blend);
    const g = THREE.MathUtils.lerp(0.09, 0.16, blend);
    const b = THREE.MathUtils.lerp(0.16, 0.85, blend);
    colors.push(r, g, b);
  }

  geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geom.computeVertexNormals();
  return geom;
}

/**
 * Creates celestial highway roadbed chunk:
 * - Level central paved star-stone route (|X| <= 7.0) with glowing circuit lines
 * - Elevated crystalline crag flanks with embedded energy veins
 */
export function createCelestialHighwayChunkGeometry(
  width: number,
  length: number,
  segmentsX = 14,
  segmentsZ = 16,
  seed = 616
): THREE.BufferGeometry {
  const geom = new THREE.PlaneGeometry(width, length, segmentsX, segmentsZ);
  geom.rotateX(-Math.PI / 2);

  const pos = geom.attributes.position;
  const colors: number[] = [];

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const absX = Math.abs(x);

    let y = 0;
    if (absX > 8.0) {
      // Floating celestial cliff edges and crystal crags
      const flankDist = absX - 8.0;
      y = Math.sin(flankDist * 0.35 + seed) * 1.8 + Math.cos(z * 0.18) * 1.5 + flankDist * 0.25;
    } else {
      // Pristine celestial pathway
      y = -0.10;
    }
    pos.setY(i, y);

    if (absX <= 7.0) {
      // Dark star-stone pavers (#1E1B4B) with luminous cyan circuit grooves (#22D3EE)
      const isPathRune = (Math.abs(absX - 3.5) < 0.35 && Math.abs(Math.sin(z * 0.4)) > 0.6) || (absX < 0.4);
      if (isPathRune) {
        // Glowing cyan energy conduit
        colors.push(0.13, 0.83, 0.93);
      } else {
        // Star-stone paver
        colors.push(0.14, 0.12, 0.32);
      }
    } else {
      // Luminous crystal crags (#312E81 to #7C3AED)
      const crystalMix = Math.sin(x * 0.4 + z * 0.3) * 0.5 + 0.5;
      const r = THREE.MathUtils.lerp(0.18, 0.48, crystalMix);
      const g = THREE.MathUtils.lerp(0.12, 0.22, crystalMix);
      const b = THREE.MathUtils.lerp(0.52, 0.92, crystalMix);
      colors.push(r, g, b);
    }
  }

  geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geom.computeVertexNormals();
  return geom;
}

/**
 * Merge BufferGeometries with color attributes
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
        colArr.push(0.65, 0.54, 0.98);
      }
    }
  }

  merged.setAttribute('position', new THREE.Float32BufferAttribute(posArr, 3));
  merged.setAttribute('normal', new THREE.Float32BufferAttribute(normArr, 3));
  merged.setAttribute('color', new THREE.Float32BufferAttribute(colArr, 3));
  return merged;
}

/**
 * Shared Crystal Heights materials
 */
export function createCrystalHeightsMaterials() {
  // Luminous faceted crystal material with vibrant emissive edge highlights
  const crystalMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.22,
    metalness: 0.65,
    emissive: 0x312e81,
    emissiveIntensity: 0.45,
    flatShading: true,
  });

  const celestialGroundMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.85,
    metalness: 0.25,
    flatShading: true,
  });

  const celestialArchStoneMaterial = new THREE.MeshStandardMaterial({
    color: 0x312e81,
    roughness: 0.70,
    metalness: 0.35,
    flatShading: true,
  });

  const energyCoreMaterial = new THREE.MeshStandardMaterial({
    color: 0x22d3ee,
    emissive: 0x06b6d4,
    emissiveIntensity: 0.95,
    roughness: 0.15,
    metalness: 0.90,
  });

  return {
    crystalMaterial,
    celestialGroundMaterial,
    celestialArchStoneMaterial,
    energyCoreMaterial,
  };
}
