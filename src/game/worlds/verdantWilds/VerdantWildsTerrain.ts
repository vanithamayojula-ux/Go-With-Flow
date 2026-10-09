import * as THREE from 'three';
import { GraphicsConfig } from '../../../types';

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
 * Procedurally generates a composite tree geometry (trunk + layered foliage clusters)
 * with embedded vertex colors:
 * - Bark: Rich dark timber (#3D2817 to #543D2B)
 * - Foliage: Gradient from lush forest canopy (#15803D) to vibrant moss highlights (#86EFAC)
 */
export function createProceduralTreeGeometry(
  archetype: TreeArchetype,
  seed = 101
): THREE.BufferGeometry {
  const geometries: THREE.BufferGeometry[] = [];

  let s = seed;
  const rnd = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };

  // 1. Trunk & Buttress Roots
  const radialSegments = archetype.tier === 'ancient' ? 10 : 8;
  const trunkHeight = archetype.height * (archetype.tier === 'dead' ? 1.0 : 0.65);
  const trunkGeom = new THREE.CylinderGeometry(
    archetype.trunkRadius * 0.6,
    archetype.trunkRadius * 1.35,
    trunkHeight,
    radialSegments,
    4
  );
  trunkGeom.translate(0, trunkHeight * 0.5, 0);

  // Deform trunk vertices for gnarled organic look & assign bark vertex colors
  const pos = trunkGeom.attributes.position;
  const colors: number[] = [];
  const barkR = 0.28, barkG = 0.18, barkB = 0.11;
  const mossBarkR = 0.32, mossBarkG = 0.36, mossBarkB = 0.14;

  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const x = pos.getX(i);
    const z = pos.getZ(i);

    // Buttress flare near base
    const flare = y < 4.0 ? (1.0 + (4.0 - y) * 0.35) : 1.0;
    const gnarl = Math.sin(y * 0.4 + seed) * 0.6;
    pos.setX(i, x * flare + gnarl);
    pos.setZ(i, z * flare + (rnd() - 0.5) * 0.3);

    // Color gradient: Base has damp moss tint, upper has dark bark
    const mossBlend = Math.max(0, 1.0 - y / 8.0);
    colors.push(
      THREE.MathUtils.lerp(barkR, mossBarkR, mossBlend),
      THREE.MathUtils.lerp(barkG, mossBarkG, mossBlend),
      THREE.MathUtils.lerp(barkB, mossBarkB, mossBlend)
    );
  }
  trunkGeom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  trunkGeom.computeVertexNormals();
  geometries.push(trunkGeom);

  // 2. Foliage Canopy Clusters (Dodecahedrons with varying scales and foliage hues)
  if (archetype.canopyClusters > 0) {
    const crownCenterY = archetype.height * 0.8;
    for (let c = 0; c < archetype.canopyClusters; c++) {
      const radius = archetype.crownRadius * (0.45 + rnd() * 0.55);
      const clusterGeom = new THREE.DodecahedronGeometry(radius, 1);

      // Offset cluster around trunk top
      const angle = (c / archetype.canopyClusters) * Math.PI * 2 + (rnd() - 0.5) * 0.8;
      const dist = archetype.crownRadius * 0.35 * (0.6 + rnd() * 0.6);
      const cx = Math.cos(angle) * dist;
      const cy = crownCenterY + (rnd() - 0.5) * (archetype.height * 0.25);
      const cz = Math.sin(angle) * dist;

      clusterGeom.translate(cx, cy, cz);

      // Canopy vertex colors: emerald green (#16A34A) with sunlit tips (#4ADE80 / #A7F3D0)
      const cPos = clusterGeom.attributes.position;
      const cColors: number[] = [];
      for (let j = 0; j < cPos.count; j++) {
        const py = cPos.getY(j);
        const heightFactor = Math.min(1.0, Math.max(0, (py - crownCenterY) / (radius * 1.5)));
        const r = THREE.MathUtils.lerp(0.08, 0.25, heightFactor);
        const g = THREE.MathUtils.lerp(0.55, 0.88, heightFactor);
        const b = THREE.MathUtils.lerp(0.22, 0.45, heightFactor);
        cColors.push(r, g, b);
      }
      clusterGeom.setAttribute('color', new THREE.Float32BufferAttribute(cColors, 3));
      clusterGeom.computeVertexNormals();
      geometries.push(clusterGeom);
    }
  }

  // Merge into single buffer geometry using standard three buffer utility
  return mergeBufferGeometriesCustom(geometries);
}

/**
 * Creates forest floor ground embankment geometry:
 * Features mossy undulations, road trench borders, and root swellings.
 */
export function createForestFloorEmbankmentGeometry(
  width: number,
  length: number,
  segmentsX = 16,
  segmentsZ = 20,
  seed = 42
): THREE.BufferGeometry {
  const geom = new THREE.PlaneGeometry(width, length, segmentsX, segmentsZ);
  geom.rotateX(-Math.PI / 2);

  const pos = geom.attributes.position;
  const colors: number[] = [];

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);

    // Keep gameplay corridor (-8 to +8) flatter for traversal clarity, elevate outer flanks
    const absX = Math.abs(x);
    let y = 0;
    if (absX > 8.0) {
      const flankDist = absX - 8.0;
      y = Math.sin(flankDist * 0.25 + seed) * 1.5 + Math.cos(z * 0.15) * 1.2 + flankDist * 0.18;
    } else {
      // Gentle subtle path roadbed
      y = -0.15;
    }
    pos.setY(i, y);

    // Colors: Loam / stone on path, deep emerald and bright moss on flanks
    if (absX <= 7.0) {
      // Ancient paved moss road (#2E4034)
      colors.push(0.18, 0.25, 0.20);
    } else {
      // Verdant moss and forest loam
      const mossShade = Math.sin(x * 0.4 + z * 0.3) * 0.5 + 0.5;
      const r = THREE.MathUtils.lerp(0.08, 0.22, mossShade);
      const g = THREE.MathUtils.lerp(0.35, 0.65, mossShade);
      const b = THREE.MathUtils.lerp(0.12, 0.28, mossShade);
      colors.push(r, g, b);
    }
  }

  geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geom.computeVertexNormals();
  return geom;
}

/**
 * Helper to combine BufferGeometries with color attributes without external dependency
 */
function mergeBufferGeometriesCustom(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry {
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
        colArr.push(0.5, 0.5, 0.5);
      }
    }
  }

  merged.setAttribute('position', new THREE.Float32BufferAttribute(posArr, 3));
  merged.setAttribute('normal', new THREE.Float32BufferAttribute(normArr, 3));
  merged.setAttribute('color', new THREE.Float32BufferAttribute(colArr, 3));
  return merged;
}

/**
 * Shared Verdant Wilds terrain materials
 */
export function createVerdantWildsMaterials() {
  const forestFloorMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.90,
    metalness: 0.05,
    flatShading: true,
  });

  const treeMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.85,
    metalness: 0.08,
    flatShading: true,
  });

  const streamWaterMaterial = new THREE.MeshStandardMaterial({
    color: 0x2dd4bf, // Luminous forest stream turquoise
    roughness: 0.12,
    metalness: 0.85,
    transparent: true,
    opacity: 0.82,
    side: THREE.DoubleSide,
  });

  return {
    forestFloorMaterial,
    treeMaterial,
    streamWaterMaterial,
  };
}
