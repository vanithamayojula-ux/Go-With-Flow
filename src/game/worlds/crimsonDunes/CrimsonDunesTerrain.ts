import * as THREE from 'three';
import { GraphicsConfig } from '../../../types';

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
 * Creates procedural wind-swept rolling dune terrain geometry with embedded vertex colors:
 * - Windward gentle slope vs leeward steep slip-face (Barchan morphology)
 * - Crest ripple lines with bright sun-baked highlights (#F97316 / #FDBA74)
 * - Base and valleys with deep crimson shadows (#9F1239 / #C2410C)
 */
export function createProceduralDuneGeometry(
  profile: DuneProfile,
  segmentsX = 14,
  segmentsZ = 16,
  seed = 505
): THREE.BufferGeometry {
  const geom = new THREE.PlaneGeometry(profile.width, profile.length, segmentsX, segmentsZ);
  geom.rotateX(-Math.PI / 2);

  const pos = geom.attributes.position;
  const colors: number[] = [];

  let s = seed;
  const rnd = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);

    // Asymmetric barchan dune profile: peak offset towards trailing edge
    const nx = x / (profile.width * 0.5);
    const nz = z / (profile.length * 0.5);

    const distRadial = Math.sqrt(nx * nx + nz * nz);
    const envelope = Math.max(0, 1.0 - Math.min(1.0, distRadial));

    // Wind-carved ridge crest asymmetry
    const crestLine = Math.sin(nx * 1.8 + 0.3) * 0.35;
    const slipFaceFactor = nz > crestLine ? Math.pow(envelope, 1.4) : Math.pow(envelope, 0.85);

    const microRipples = Math.sin(x * 0.8 + z * 0.4) * 0.45;
    const y = envelope * profile.height * slipFaceFactor + microRipples;
    pos.setY(i, y);

    // Vertex Color Gradient:
    // Sand Base / Shadow: #C2410C (0.76, 0.25, 0.05) to #9F1239 (0.62, 0.07, 0.22)
    // Ridge Crest / Sunlit: #F97316 (0.98, 0.45, 0.09) to #FDBA74 (0.99, 0.73, 0.45)
    const heightNorm = Math.min(1.0, Math.max(0, y / profile.height));
    const r = THREE.MathUtils.lerp(0.76, 0.99, heightNorm);
    const g = THREE.MathUtils.lerp(0.25, 0.65, Math.pow(heightNorm, 1.2));
    const b = THREE.MathUtils.lerp(0.05, 0.38, Math.pow(heightNorm, 1.5));
    colors.push(r, g, b);
  }

  geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geom.computeVertexNormals();
  return geom;
}

/**
 * Creates layered flat-topped Sandstone Mesa geometry:
 * Features striated stepped sedimentary tiers, talus slope, and vertex coloring.
 */
export function createProceduralMesaGeometry(
  archetype: MesaArchetype,
  radialSegs = 12,
  seed = 707
): THREE.BufferGeometry {
  const geom = new THREE.CylinderGeometry(
    archetype.radiusTop,
    archetype.radiusBase,
    archetype.height,
    radialSegs,
    archetype.layerCount * 2,
    false
  );
  geom.translate(0, archetype.height * 0.5, 0);

  const pos = geom.attributes.position;
  const colors: number[] = [];

  let s = seed;
  const rnd = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };

  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const x = pos.getX(i);
    const z = pos.getZ(i);

    const normY = y / archetype.height;
    // Stratified step cliffs (cliff faces alternating with narrow terraces)
    const stepBands = Math.sin(normY * Math.PI * (archetype.layerCount + 1));
    const stepLedge = stepBands > 0.3 ? 1.08 : 0.96;

    // Organic wind weathering
    const weathering = 1.0 + (rnd() - 0.5) * 0.08;
    pos.setX(i, x * stepLedge * weathering);
    pos.setZ(i, z * stepLedge * weathering);

    // Color: Deep red/brown cliff base (#7C1D1D) transitioning to sun-baked orange rim (#EA580C)
    const r = THREE.MathUtils.lerp(0.55, 0.92, normY);
    const g = THREE.MathUtils.lerp(0.12, 0.38, normY);
    const b = THREE.MathUtils.lerp(0.10, 0.16, normY);
    colors.push(r, g, b);
  }

  geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geom.computeVertexNormals();
  return geom;
}

/**
 * Creates ancient paved stone route chunk with flanking wind-blown red sand margins:
 * Keeps the central 3-lane route (X in [-7.5, +7.5]) clean and readable.
 */
export function createDesertHighwayChunkGeometry(
  width: number,
  length: number,
  segmentsX = 14,
  segmentsZ = 16,
  seed = 808
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
      // Flanking undulating red dunes
      const flankDist = absX - 8.0;
      y = Math.sin(flankDist * 0.2 + seed) * 1.8 + Math.cos(z * 0.12) * 1.4 + flankDist * 0.22;
    } else {
      // Level paved sandstone path
      y = -0.12;
    }
    pos.setY(i, y);

    if (absX <= 7.0) {
      // Sun-bleached ancient sandstone pavers (#D6B48B / #E2D3B3)
      // Slight periodic block pattern
      const paverGrid = (Math.floor(absX * 0.8) + Math.floor(z * 0.5)) % 2 === 0 ? 0.04 : -0.04;
      colors.push(0.78 + paverGrid, 0.62 + paverGrid, 0.44 + paverGrid);
    } else {
      // Crimson sand flank (#C2410C to #F97316)
      const sandVariation = Math.sin(x * 0.35 + z * 0.2) * 0.5 + 0.5;
      const r = THREE.MathUtils.lerp(0.76, 0.95, sandVariation);
      const g = THREE.MathUtils.lerp(0.25, 0.48, sandVariation);
      const b = THREE.MathUtils.lerp(0.06, 0.16, sandVariation);
      colors.push(r, g, b);
    }
  }

  geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geom.computeVertexNormals();
  return geom;
}

/**
 * Shared Crimson Dunes materials
 */
export function createCrimsonDunesMaterials() {
  const duneMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.92,
    metalness: 0.02,
    flatShading: true,
  });

  const mesaRockMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.86,
    metalness: 0.06,
    flatShading: true,
  });

  const ancientStoneMaterial = new THREE.MeshStandardMaterial({
    color: 0xd6b48b, // Weathered desert sandstone
    roughness: 0.82,
    metalness: 0.10,
    flatShading: true,
  });

  const solarRelicMaterial = new THREE.MeshStandardMaterial({
    color: 0xfbbf24, // Radiant desert solar amber
    emissive: 0xd97706,
    emissiveIntensity: 0.85,
    roughness: 0.25,
    metalness: 0.85,
  });

  return {
    duneMaterial,
    mesaRockMaterial,
    ancientStoneMaterial,
    solarRelicMaterial,
  };
}
