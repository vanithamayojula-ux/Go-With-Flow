import * as THREE from 'three';
import { BiomeType, FloatingIslandData } from '../types';
import { createRoadTextures, RoadTextures } from '../graphics/roadTextures';
import {
  LANE_WIDTH,
  RAIL_X,
  DIVIDER_X,
} from './trackConfig';
import { WORLDS, WORLD_ORDER, WORLD_LENGTH_DISTANCE } from './worlds';

export const CHUNK_SIZE = 80;
export const CHUNK_SEGMENTS = 24;

/** Index into WORLD_ORDER of the campaign world covering distance z. */
export function getWorldIndexAt(z: number): number {
  const rawIndex = Math.floor(Math.max(0, z) / WORLD_LENGTH_DISTANCE);
  return Math.min(rawIndex, WORLD_ORDER.length - 1);
}

let activeBiomeOverride: BiomeType | null = null;
let biomeOverrideEndZ = -1;

export function resetBiomeState() {
  activeBiomeOverride = null;
  biomeOverrideEndZ = -1;
}

export function clearBiomeOverride() {
  activeBiomeOverride = null;
  biomeOverrideEndZ = -1;
}

export function getActiveBiomeOverride(): BiomeType | null {
  return activeBiomeOverride;
}

export function setActiveBiome(biome: BiomeType | null, currentZ?: number, durationDistance = 450) {
  if (biome === null) {
    clearBiomeOverride();
    return;
  }
  activeBiomeOverride = biome;
  if (typeof currentZ === 'number') {
    biomeOverrideEndZ = currentZ + durationDistance;
  } else {
    biomeOverrideEndZ = -1;
  }
}

export function getBiomeAt(z: number): BiomeType {
  if (activeBiomeOverride) {
    if (biomeOverrideEndZ > 0 && z >= biomeOverrideEndZ) {
      activeBiomeOverride = null;
      biomeOverrideEndZ = -1;
    } else {
      return activeBiomeOverride;
    }
  }
  // Legacy roadside biome follows the campaign world, so it changes only at
  // the world portals (one per WORLD_LENGTH_DISTANCE boundary).
  return WORLDS[WORLD_ORDER[getWorldIndexAt(z)]].compatibleBiomes[0];
}

export function getBiomeFriction(biome: BiomeType): number {
  switch (biome) {
    case 'neon-undercity':
      return 0.02; // Slick wet asphalt
    case 'dune-nomad':
    case 'quantum-desert':
    case 'dunes':
      return 0.025; // Golden sand resistance
    case 'bioluminescent-jungle':
    case 'cyber-forest':
    case 'forest':
      return 0.02; // Moss plane
    case 'nebula-drift':
    case 'orbital-ring':
      return 0.01; // Zero-g floaty
    case 'sky-realm':
    case 'sky-islands':
      return 0.005; // Extremely floaty nature breeze
    case 'the-grid':
      return 0.015; // Smooth digital vector plane
    case 'ember-core':
    case 'volcanic-forge':
      return 0.03; // Magma obsidian crust
    case 'aurora-frost':
    case 'crystal-glacier':
      return 0.008; // Ultra-slick crystal ice
    case 'derelict-station':
      return 0.035; // Gritty industrial metal plating
    default:
      return 0.02;
  }
}

export function getTerrainHeight(_x: number, _z: number): number {
  // The highway is level, like a real road deck. (It used to undulate +-2.5 m,
  // which sank it beneath the worlds' flat ground beds on every dip.)
  return 0;
}

const _terrainNormalScratch = new THREE.Vector3();

export function getTerrainNormal(x: number, z: number, target = _terrainNormalScratch): THREE.Vector3 {
  const eps = 0.5;
  const hL = getTerrainHeight(x - eps, z);
  const hR = getTerrainHeight(x + eps, z);
  const hD = getTerrainHeight(x, z - eps);
  const hU = getTerrainHeight(x, z + eps);

  return target.set(hL - hR, 2.0 * eps, hD - hU).normalize();
}

export interface UpdraftGeyser {
  id: string;
  x: number;
  y: number;
  z: number;
  radius: number;
  mesh: THREE.Group;
}

export interface CyberChunk {
  key: string;
  cx: number;
  cz: number;
  mesh: THREE.Mesh;
  decorations: THREE.Object3D[];
  foliageInstances: {
    orbs: { id: string; x: number; y: number; z: number; collected: boolean; mesh?: THREE.Mesh }[];
    floatingIslands: FloatingIslandData[];
    updrafts: UpdraftGeyser[];
    grass: { x: number; y: number; z: number; scale: number; rot: number }[];
    trees: { x: number; y: number; z: number; scale: number }[];
  };
}

// Road texture tile length (metres); CHUNK_SIZE must be a multiple of it so
// lane dashes line up across chunk seams.
const ROAD_TILE_LENGTH = 10;
const GUARD_POST_SPACING = 2.0;
const GUARD_RAIL_HEIGHT = 0.62;

/**
 * Streams a level asphalt highway: textured road deck on a concrete slab,
 * concrete curbs and galvanised steel W-beam guard rails on posts. Scenery
 * beyond the rails comes from the active campaign world.
 */
export class TerrainManager {
  scene: THREE.Scene;
  chunks: Map<string, CyberChunk> = new Map();
  /** Asphalt road surface shared by every chunk. */
  terrainMaterial: THREE.MeshStandardMaterial;

  private roadTextures: RoadTextures;
  private roadGeom: THREE.PlaneGeometry;
  private slabGeom: THREE.BoxGeometry;
  private curbGeom: THREE.BoxGeometry;
  private beamGeom: THREE.BoxGeometry;
  private postGeom: THREE.BoxGeometry;
  private concreteMat: THREE.MeshStandardMaterial;
  private steelMat: THREE.MeshStandardMaterial;
  private dummy = new THREE.Object3D();

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    const roadWidth = RAIL_X * 2.0;
    const tilesPerChunk = CHUNK_SIZE / ROAD_TILE_LENGTH;
    this.roadTextures = createRoadTextures({
      halfWidth: RAIL_X,
      tileLength: ROAD_TILE_LENGTH,
      dividerX: DIVIDER_X,
      edgeLineX: LANE_WIDTH * 1.5 + 0.05,
      laneCentersX: [-LANE_WIDTH, 0, LANE_WIDTH],
    });
    for (const t of Object.values(this.roadTextures)) t.repeat.set(1, tilesPerChunk);

    this.terrainMaterial = new THREE.MeshStandardMaterial({
      map: this.roadTextures.map,
      roughnessMap: this.roadTextures.roughnessMap,
      normalMap: this.roadTextures.normalMap,
      normalScale: new THREE.Vector2(0.8, 0.8),
      roughness: 1.0,
      metalness: 0.0,
    });

    this.concreteMat = new THREE.MeshStandardMaterial({ color: 0x9c9890, roughness: 0.92, metalness: 0.0 });
    this.steelMat = new THREE.MeshStandardMaterial({ color: 0xbfc4ca, roughness: 0.38, metalness: 0.9 });

    // Shared geometry (every chunk is identical; the road is level)
    this.roadGeom = new THREE.PlaneGeometry(roadWidth, CHUNK_SIZE, 1, 1);
    this.roadGeom.rotateX(-Math.PI / 2);
    this.slabGeom = new THREE.BoxGeometry(roadWidth + 1.2, 1.1, CHUNK_SIZE);
    this.curbGeom = new THREE.BoxGeometry(0.45, 0.18, CHUNK_SIZE);
    this.beamGeom = new THREE.BoxGeometry(0.07, 0.31, CHUNK_SIZE);
    this.postGeom = new THREE.BoxGeometry(0.1, GUARD_RAIL_HEIGHT + 0.12, 0.15);
  }

  rebuildAroundPlayer(playerZ: number, playerX: number, renderDistance = 3) {
    for (const chunk of this.chunks.values()) {
      this.disposeChunk(chunk);
    }
    this.chunks.clear();
    this.update(playerZ, playerX, renderDistance);
  }

  update(playerZ: number, _playerX: number, renderDistance = 3, _time = 0, _playerSpeed = 20) {
    const currentChunkZ = Math.floor(playerZ / CHUNK_SIZE);
    const neededKeys = new Set<string>();

    for (let dz = -1; dz <= renderDistance + 1; dz++) {
      const cz = currentChunkZ + dz;
      const key = `0_${cz}`;
      neededKeys.add(key);
      if (!this.chunks.has(key)) {
        this.spawnHighwayChunk(cz);
      }
    }

    for (const [key, chunk] of this.chunks.entries()) {
      if (!neededKeys.has(key)) {
        this.disposeChunk(chunk);
        this.chunks.delete(key);
      }
    }
  }

  private spawnHighwayChunk(cz: number) {
    const key = `0_${cz}`;
    const zCenter = (cz + 0.5) * CHUNK_SIZE;
    const roadY = getTerrainHeight(0, zCenter);
    const decorations: THREE.Object3D[] = [];
    const add = (o: THREE.Object3D) => {
      this.scene.add(o);
      decorations.push(o);
    };

    // 1. Asphalt deck
    const roadMesh = new THREE.Mesh(this.roadGeom, this.terrainMaterial);
    roadMesh.position.set(0, roadY, zCenter);
    roadMesh.receiveShadow = true;
    this.scene.add(roadMesh);

    // 2. Concrete slab under the deck (reads as a bridge deck over the Sky Isles void)
    const slab = new THREE.Mesh(this.slabGeom, this.concreteMat);
    slab.position.set(0, roadY - 0.56, zCenter);
    slab.receiveShadow = true;
    add(slab);

    for (const side of [-1, 1]) {
      // 3. Concrete curb along the deck edge
      const curb = new THREE.Mesh(this.curbGeom, this.concreteMat);
      curb.position.set(side * (RAIL_X + 0.1), roadY + 0.09, zCenter);
      curb.castShadow = true;
      curb.receiveShadow = true;
      add(curb);

      // 4. Galvanised W-beam guard rail on posts
      const beam = new THREE.Mesh(this.beamGeom, this.steelMat);
      beam.position.set(side * (RAIL_X + 0.05), roadY + GUARD_RAIL_HEIGHT, zCenter);
      beam.castShadow = true;
      add(beam);

      const postCount = Math.round(CHUNK_SIZE / GUARD_POST_SPACING);
      const posts = new THREE.InstancedMesh(this.postGeom, this.steelMat, postCount);
      for (let i = 0; i < postCount; i++) {
        const pz = zCenter - CHUNK_SIZE / 2 + (i + 0.5) * GUARD_POST_SPACING;
        this.dummy.position.set(side * (RAIL_X + 0.16), roadY + (GUARD_RAIL_HEIGHT + 0.12) / 2 + 0.12, pz);
        this.dummy.updateMatrix();
        posts.setMatrixAt(i, this.dummy.matrix);
      }
      posts.castShadow = true;
      add(posts);
    }

    this.chunks.set(key, {
      key,
      cx: 0,
      cz,
      mesh: roadMesh,
      decorations,
      foliageInstances: { orbs: [], floatingIslands: [], updrafts: [], grass: [], trees: [] },
    });
  }

  private disposeChunk(chunk: CyberChunk) {
    // Geometry and materials are shared by all chunks; only instance buffers are per-chunk.
    this.scene.remove(chunk.mesh);
    for (const d of chunk.decorations) {
      this.scene.remove(d);
      if ((d as THREE.InstancedMesh).isInstancedMesh) (d as THREE.InstancedMesh).dispose();
    }
  }

  dispose() {
    for (const chunk of this.chunks.values()) {
      this.disposeChunk(chunk);
    }
    this.chunks.clear();
    this.terrainMaterial.dispose();
    this.concreteMat.dispose();
    this.steelMat.dispose();
    for (const t of Object.values(this.roadTextures)) t.dispose();
    this.roadGeom.dispose();
    this.slabGeom.dispose();
    this.curbGeom.dispose();
    this.beamGeom.dispose();
    this.postGeom.dispose();
  }
}
