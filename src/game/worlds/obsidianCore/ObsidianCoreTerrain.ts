import * as THREE from 'three';
import { GraphicsConfig } from '../../../types';

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

/**
 * Creates volcanic rock formation geometry (faceted basalt spires and jagged obsidian crags)
 * with embedded vertex colors:
 * - Base: Molten magma orange/crimson reflection (#EA580C to #7F1D1D)
 * - Shaft and Peak: Pure fractured obsidian black and charcoal (#09090B to #18181B)
 */
export function createProceduralVolcanicRockGeometry(
  archetype: VolcanicArchetype,
  seed = 404
): THREE.BufferGeometry {
  if (archetype.tier === 'caldera-peak') {
    // Caldera Volcano cone with crater top
    const geom = new THREE.CylinderGeometry(
      archetype.radius * 0.28,
      archetype.radius,
      archetype.height,
      archetype.facets,
      6
    );
    geom.translate(0, archetype.height * 0.5, 0);

    const pos = geom.attributes.position;
    const colors: number[] = [];

    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const normY = y / archetype.height;
      if (normY > 0.85) {
        // Glowing caldera crater rim / lava ring (#F97316)
        colors.push(0.98, 0.45, 0.09);
      } else {
        // Volcanic ash slope (#18181B to #27272A)
        const blend = Math.pow(normY, 1.5);
        colors.push(0.10 + blend * 0.08, 0.08 + blend * 0.04, 0.08 + blend * 0.04);
      }
    }
    geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geom.computeVertexNormals();
    return geom;
  }

  // Basalt / Spire cluster
  const geometries: THREE.BufferGeometry[] = [];
  const columnCount = archetype.tier === 'basalt-cluster' ? 5 : 3;

  let s = seed;
  const rnd = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };

  for (let c = 0; c < columnCount; c++) {
    const angle = (c / columnCount) * Math.PI * 2;
    const dist = c === 0 ? 0 : archetype.radius * (0.5 + rnd() * 0.5);
    const colHeight = c === 0 ? archetype.height : archetype.height * (0.45 + rnd() * 0.45);
    const colRadius = archetype.radius * (0.35 + rnd() * 0.25);

    const prism = new THREE.CylinderGeometry(
      colRadius * 0.65,
      colRadius,
      colHeight,
      archetype.facets,
      4
    );
    prism.translate(0, colHeight * 0.5, 0);

    // Vertex color: Deep obsidian charcoal with lava heat bounce near base
    const pos = prism.attributes.position;
    const colors: number[] = [];

    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const heatFactor = Math.max(0, 1.0 - y / 8.0);
      // Base heat: #EA580C (0.92, 0.35, 0.05), Obsidian top: #09090B (0.04, 0.04, 0.05)
      const r = THREE.MathUtils.lerp(0.06, 0.92, heatFactor * 0.85);
      const g = THREE.MathUtils.lerp(0.06, 0.35, heatFactor * 0.85);
      const b = THREE.MathUtils.lerp(0.08, 0.05, heatFactor * 0.85);
      colors.push(r, g, b);
    }
    prism.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    // Slight organic tilt
    const tilt = 0.08 + rnd() * 0.12;
    prism.rotateZ(Math.cos(angle) * tilt);
    prism.rotateX(Math.sin(angle) * tilt);
    prism.translate(Math.cos(angle) * dist, 0, Math.sin(angle) * dist);

    geometries.push(prism);
  }

  return mergeBufferGeometriesCustom(geometries);
}

/**
 * Creates procedural volcanic highway chunk:
 * - Level central fractured obsidian bridge route (|X| <= 7.0) with glowing magma cracks
 * - Flanking glowing lava river channels and jagged obsidian crag shores
 */
export function createVolcanicHighwayChunkGeometry(
  width: number,
  length: number,
  segmentsX = 14,
  segmentsZ = 16,
  seed = 666
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
      // Lava drop trench and outer basalt crag walls
      const flankDist = absX - 8.0;
      if (flankDist < 7.0) {
        // Sunken lava channel (-2.2m below highway bridge)
        y = -2.2 + Math.sin(z * 0.15) * 0.3;
      } else {
        // Jagged basalt ridge
        y = (flankDist - 7.0) * 0.65 + Math.sin(flankDist * 0.4 + seed) * 1.5;
      }
    } else {
      // Level highway bridge surface
      y = -0.10;
    }
    pos.setY(i, y);

    if (absX <= 7.0) {
      // Fractured obsidian roadbed: Charcoal stone with glowing web of magma cracks
      // Magma cracks defined by high-frequency trigonometric network
      const crackField = Math.abs(Math.sin(x * 0.9 + Math.cos(z * 0.6) * 1.5)) * Math.abs(Math.cos(z * 0.8 + Math.sin(x * 0.5)));
      const isCrack = crackField < 0.18;

      if (isCrack) {
        // Molten lava crack: Radiant orange-yellow (#F97316 / #FEF08A)
        colors.push(0.98, 0.48, 0.08);
      } else {
        // Fractured obsidian paver (#09090B to #18181B)
        const blockVariation = (Math.floor(absX * 0.6) + Math.floor(z * 0.4)) % 2 === 0 ? 0.03 : 0.0;
        colors.push(0.08 + blockVariation, 0.08 + blockVariation, 0.09 + blockVariation);
      }
    } else if (absX <= 15.0) {
      // Molten lava river surface: Deep lava red to bright amber (#EA580C to #FBBF24)
      const flowMix = Math.sin(z * 0.25) * 0.5 + 0.5;
      const r = THREE.MathUtils.lerp(0.92, 0.98, flowMix);
      const g = THREE.MathUtils.lerp(0.32, 0.72, flowMix);
      const b = THREE.MathUtils.lerp(0.05, 0.14, flowMix);
      colors.push(r, g, b);
    } else {
      // Dark volcanic wall (#18181B)
      colors.push(0.12, 0.10, 0.10);
    }
  }

  geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geom.computeVertexNormals();
  return geom;
}

/**
 * Creates cascading Magma Waterfall geometry:
 * Vertical/steep plane representing molten lava pouring off cliff edges
 */
export function createMagmaWaterfallGeometry(
  width: number,
  height: number,
  segmentsX = 4,
  segmentsY = 8
): THREE.BufferGeometry {
  const geom = new THREE.PlaneGeometry(width, height, segmentsX, segmentsY);
  const pos = geom.attributes.position;
  const colors: number[] = [];

  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    // Molten bright white-yellow at crest, glowing orange-crimson at plunge
    const norm = (y + height * 0.5) / height;
    const r = 0.98;
    const g = THREE.MathUtils.lerp(0.28, 0.82, norm);
    const b = THREE.MathUtils.lerp(0.04, 0.22, norm);
    colors.push(r, g, b);
  }

  geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geom.computeVertexNormals();
  return geom;
}

/**
 * Merge geometries helper
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
        colArr.push(0.1, 0.1, 0.1);
      }
    }
  }

  merged.setAttribute('position', new THREE.Float32BufferAttribute(posArr, 3));
  merged.setAttribute('normal', new THREE.Float32BufferAttribute(normArr, 3));
  merged.setAttribute('color', new THREE.Float32BufferAttribute(colArr, 3));
  return merged;
}

/**
 * Shared Obsidian Core materials
 */
export function createObsidianCoreMaterials() {
  // Fractured obsidian ground material with glowing vertex magma cracks
  const obsidianGroundMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.65,
    metalness: 0.45,
    flatShading: true,
  });

  // Volcanic rock / basalt spires material
  const volcanicRockMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.85,
    metalness: 0.20,
    flatShading: true,
  });

  // Molten animated lava material
  const moltenLavaMaterial = new THREE.MeshStandardMaterial({
    color: 0xf97316,
    emissive: 0xea580c,
    emissiveIntensity: 0.95,
    roughness: 0.20,
    metalness: 0.30,
    flatShading: true,
  });

  // Ancient black iron citadel metal
  const citadelIronMaterial = new THREE.MeshStandardMaterial({
    color: 0x18181b,
    roughness: 0.55,
    metalness: 0.80,
    flatShading: true,
  });

  return {
    obsidianGroundMaterial,
    volcanicRockMaterial,
    moltenLavaMaterial,
    citadelIronMaterial,
  };
}
