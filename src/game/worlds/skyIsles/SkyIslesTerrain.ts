import * as THREE from 'three';
import { GraphicsConfig } from '../../../types';

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

/**
 * Creates a procedural floating island mesh:
 * - Top grassy lush surface (displaced dome/plateau)
 * - Layered rock underside tapering down to an irregular crag peak
 * - Vertex-colored: green grass rim transitioning to stratified pale sandstone rock
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
  const normals: number[] = [];
  const uvs: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  // Deterministic pseudo-random noise generator
  let s = seed;
  const rnd = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };

  const rings = 7;
  const slices = segments;

  // Vertex ring 0 (Top Center of grass plateau)
  positions.push(0, heightGrass, 0);
  normals.push(0, 1, 0);
  uvs.push(0.5, 0.5);
  // Grass Color (#86EFAC) = (0.525, 0.937, 0.674)
  colors.push(0.525, 0.937, 0.674);

  // Generate upper grass plateau rings (rings 1 to 2)
  for (let r = 1; r <= 2; r++) {
    const ringRadius = (r / 2) * radiusTop;
    const ringY = heightGrass - (r === 2 ? 0.35 : 0.05);

    for (let i = 0; i < slices; i++) {
      const theta = (i / slices) * Math.PI * 2;
      const noiseR = ringRadius * (1.0 + (rnd() - 0.5) * roughness * 0.4);
      const x = Math.cos(theta) * noiseR;
      const z = Math.sin(theta) * noiseR;
      const y = ringY + (rnd() - 0.5) * 0.25;

      positions.push(x, y, z);
      normals.push(0, 1, 0);
      uvs.push((x / (radiusTop * 2)) + 0.5, (z / (radiusTop * 2)) + 0.5);
      colors.push(0.525, 0.937, 0.674);
    }
  }

  // Generate middle cliff rim (ring 3)
  for (let i = 0; i < slices; i++) {
    const theta = (i / slices) * Math.PI * 2;
    const noiseR = radiusTop * (1.05 + (rnd() - 0.5) * roughness * 0.5);
    const x = Math.cos(theta) * noiseR;
    const z = Math.sin(theta) * noiseR;
    const y = -0.5 - rnd() * 0.8;

    positions.push(x, y, z);
    normals.push(Math.cos(theta), 0.2, Math.sin(theta));
    uvs.push(i / slices, 0.4);
    // Transition tint: pale stone with green moss rim (#A7F3D0 -> #E2E8F0)
    colors.push(0.655, 0.853, 0.760);
  }

  // Generate tapering rock underside rings (rings 4 to 6)
  for (let r = 4; r <= 6; r++) {
    const progress = (r - 3) / 4; // 0.25 to 0.75
    const ringRadius = radiusTop * (1.0 - progress * 0.82) * (1.0 + (rnd() - 0.5) * roughness * 0.7);
    const ringY = -progress * depthRock;

    for (let i = 0; i < slices; i++) {
      const theta = (i / slices) * Math.PI * 2;
      const x = Math.cos(theta) * ringRadius;
      const z = Math.sin(theta) * ringRadius;
      const y = ringY + (rnd() - 0.5) * 0.8;

      positions.push(x, y, z);
      const n = new THREE.Vector3(x, 0.6, z).normalize();
      normals.push(n.x, n.y, n.z);
      uvs.push(i / slices, 0.4 + progress * 0.6);
      // Pale stone underside (#E2E8F0 -> #94A3B8 rock shadow)
      const shade = 1.0 - progress * 0.35;
      colors.push(0.886 * shade, 0.910 * shade, 0.941 * shade);
    }
  }

  // Bottom Tip Vertex (Peak of the inverted rock mountain)
  const tipIndex = 1 + slices * (rings - 1);
  positions.push((rnd() - 0.5) * 1.5, -depthRock, (rnd() - 0.5) * 1.5);
  normals.push(0, -1, 0);
  uvs.push(0.5, 1.0);
  // Darker rock bottom shadow (#64748B) = (0.392, 0.455, 0.545)
  colors.push(0.392, 0.455, 0.545);

  // --- Generate Triangles / Indices ---
  // Center Fan (ring 0 to ring 1)
  for (let i = 0; i < slices; i++) {
    const next = (i + 1) % slices;
    indices.push(0, 1 + i, 1 + next);
  }

  // Ring strips (rings 1 to 6)
  for (let r = 0; r < rings - 2; r++) {
    const rStart = 1 + r * slices;
    const nextRStart = 1 + (r + 1) * slices;
    for (let i = 0; i < slices; i++) {
      const next = (i + 1) % slices;
      const a = rStart + i;
      const b = nextRStart + i;
      const c = nextRStart + next;
      const d = rStart + next;
      indices.push(a, b, d);
      indices.push(b, c, d);
    }
  }

  // Bottom cone fan to tip
  const lastRingStart = 1 + (rings - 2) * slices;
  for (let i = 0; i < slices; i++) {
    const next = (i + 1) % slices;
    indices.push(lastRingStart + i, tipIndex, lastRingStart + next);
  }

  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();

  return geom;
}

/**
 * Creates shared stylized procedural materials for Sky Isles floating islands.
 */
export function createSkyIslesIslandMaterials(): {
  islandMaterial: THREE.MeshStandardMaterial;
  waterfallMaterial: THREE.MeshBasicMaterial;
  ancientStoneMaterial: THREE.MeshStandardMaterial;
  crystalBeaconMaterial: THREE.MeshBasicMaterial;
} {
  // Island terrain: Vertex colored with subtle roughness and warm sunlight response
  const islandMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.78,
    metalness: 0.12,
    flatShading: true,
  });

  // Flowing waterfall streams cascading off floating island edges
  const waterfallMaterial = new THREE.MeshBasicMaterial({
    color: 0x67e8f9,
    transparent: true,
    opacity: 0.72,
    side: THREE.DoubleSide,
  });

  // Ancient mossy stone for arches, sky temples, and shrines (#E2E8F0)
  const ancientStoneMaterial = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.65,
    metalness: 0.20,
    flatShading: true,
  });

  // Luminous cyan power crystal (#22D3EE)
  const crystalBeaconMaterial = new THREE.MeshBasicMaterial({
    color: 0x22d3ee,
    transparent: true,
    opacity: 0.95,
  });

  return {
    islandMaterial,
    waterfallMaterial,
    ancientStoneMaterial,
    crystalBeaconMaterial,
  };
}
