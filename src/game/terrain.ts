import * as THREE from 'three';
import { BiomeType, FloatingIslandData } from '../types';
import { createRoadTextures, RoadTextures, applyRoadMacroVariation } from '../graphics/roadTextures';
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
const ROAD_TILE_LENGTH = 20;
const GUARD_POST_SPACING = 2.0;
const GUARD_RAIL_HEIGHT = 0.62;
// W-beam cross-section: 312 mm tall, 83 mm deep, two ridges facing the road
const W_BEAM_HEIGHT = 0.312;
const W_BEAM_DEPTH = 0.083;
// Ridge crests sit this far from the road centre line
const W_BEAM_X = RAIL_X + 0.06;

/**
 * Galvanised W-beam guard rail as a thin sheet-metal ribbon swept along the
 * chunk. Local +x points toward the road; the ridges bulge to +x. Smooth
 * normals across the profile give the rolled-steel highlight a real rail has.
 */
function createWBeamGeometry(length: number): THREE.BufferGeometry {
  const profile: [number, number][] = [];
  const steps = 28;
  for (let k = 0; k <= steps; k++) {
    const t = (k / steps) * 2 - 1; // -1..1 bottom..top
    const y = t * (W_BEAM_HEIGHT / 2);
    // Two crests at t = +-0.5, a valley at 0, flanges at the edges
    const bulge = W_BEAM_DEPTH * (0.5 - 0.5 * Math.cos(2 * Math.PI * t));
    profile.push([bulge - W_BEAM_DEPTH, y]);
  }
  // Rolled lips at the top and bottom edges
  profile.unshift([-W_BEAM_DEPTH - 0.012, -W_BEAM_HEIGHT / 2 - 0.004]);
  profile.push([-W_BEAM_DEPTH - 0.012, W_BEAM_HEIGHT / 2 + 0.004]);

  const arcs: number[] = [0];
  for (let k = 1; k < profile.length; k++) {
    arcs.push(arcs[k - 1] + Math.hypot(profile[k][0] - profile[k - 1][0], profile[k][1] - profile[k - 1][1]));
  }
  const total = arcs[arcs.length - 1];
  const n = profile.length;
  const pos: number[] = [];
  const uv: number[] = [];
  for (const end of [0, 1]) {
    const z = (end - 0.5) * length;
    for (let k = 0; k < n; k++) {
      pos.push(profile[k][0], profile[k][1], z);
      uv.push(end * (length / 4), arcs[k] / total);
    }
  }
  const idx: number[] = [];
  for (let k = 0; k < n - 1; k++) {
    const a = k;
    const b = k + 1;
    const c = k + n;
    const d = c + 1;
    // Wound so the front (+x, road-facing) side is the front face
    idx.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  const nrm = g.getAttribute('normal') as THREE.BufferAttribute;
  if (nrm.getX(Math.round(n / 4)) < 0) {
    for (let i = 0; i < idx.length; i += 3) {
      const tmp = idx[i + 1];
      idx[i + 1] = idx[i + 2];
      idx[i + 2] = tmp;
    }
    g.setIndex(idx);
    g.computeVertexNormals();
  }
  return g;
}

/** Spangled hot-dip galvanising: subtle mottled tone plus roughness variation. */
function createGalvanisedTextures(): { map: THREE.CanvasTexture; roughnessMap: THREE.CanvasTexture } | null {
  if (typeof document === 'undefined') return null;
  const w = 256;
  const h = 64;
  const mk = () => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  };
  const colC = mk();
  const rouC = mk();
  const cctx = colC.getContext('2d')!;
  const rctx = rouC.getContext('2d')!;
  const ci = cctx.createImageData(w, h);
  const ri = rctx.createImageData(w, h);
  let seed = 4242;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  // Voronoi-like zinc spangle cells
  const cells: [number, number, number][] = [];
  for (let k = 0; k < 90; k++) cells.push([rnd() * w, rnd() * h, rnd()]);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let best = 1e9;
      let tone = 0.5;
      for (const [cx, cy, t] of cells) {
        let dx = Math.abs(x - cx);
        dx = Math.min(dx, w - dx);
        let dy = Math.abs(y - cy);
        dy = Math.min(dy, h - dy);
        const d = dx * dx + dy * dy;
        if (d < best) {
          best = d;
          tone = t;
        }
      }
      const grain = rnd();
      // Weathering streaks toward the lower edge
      const streak = Math.sin(x * 0.21 + Math.sin(x * 0.05) * 3) * 0.5 + 0.5;
      const v = 168 + (tone - 0.5) * 22 + (grain - 0.5) * 8 - streak * 10 * (1 - y / h);
      const o = (y * w + x) * 4;
      ci.data[o] = v;
      ci.data[o + 1] = v + 2;
      ci.data[o + 2] = v + 5;
      ci.data[o + 3] = 255;
      const r = 0.52 + (tone - 0.5) * 0.16 + (grain - 0.5) * 0.06 + streak * 0.08 * (1 - y / h);
      const rv = Math.max(0, Math.min(1, r)) * 255;
      ri.data[o] = rv;
      ri.data[o + 1] = rv;
      ri.data[o + 2] = rv;
      ri.data[o + 3] = 255;
    }
  }
  cctx.putImageData(ci, 0, 0);
  rctx.putImageData(ri, 0, 0);
  const fin = (c: HTMLCanvasElement, srgb: boolean) => {
    const t = new THREE.CanvasTexture(c);
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 4;
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    return t;
  };
  return { map: fin(colC, true), roughnessMap: fin(rouC, false) };
}

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
  private beamGeom: THREE.BufferGeometry;
  private postGeom: THREE.BoxGeometry;
  private blockGeom: THREE.BoxGeometry;
  private galvTextures: { map: THREE.CanvasTexture; roughnessMap: THREE.CanvasTexture } | null;
  private beamMat: THREE.MeshStandardMaterial;
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
      dashPeriod: 10,
      dashLength: 3,
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
    applyRoadMacroVariation(this.terrainMaterial);

    this.concreteMat = new THREE.MeshStandardMaterial({ color: 0x9c9890, roughness: 0.92, metalness: 0.0 });
    // Hot-dip galvanised steel: fully metallic with a satin (not mirror) finish
    this.steelMat = new THREE.MeshStandardMaterial({ color: 0x9a9fa4, roughness: 0.55, metalness: 1.0 });
    this.galvTextures = createGalvanisedTextures();
    this.beamMat = new THREE.MeshStandardMaterial({
      color: this.galvTextures ? 0xffffff : 0xa7abaf,
      map: this.galvTextures?.map ?? null,
      roughnessMap: this.galvTextures?.roughnessMap ?? null,
      roughness: this.galvTextures ? 1.0 : 0.5,
      metalness: 1.0,
      side: THREE.DoubleSide,
    });

    // Shared geometry (every chunk is identical; the road is level)
    this.roadGeom = new THREE.PlaneGeometry(roadWidth, CHUNK_SIZE, 1, 1);
    this.roadGeom.rotateX(-Math.PI / 2);
    this.slabGeom = new THREE.BoxGeometry(roadWidth + 1.2, 1.1, CHUNK_SIZE);
    this.curbGeom = new THREE.BoxGeometry(0.45, 0.18, CHUNK_SIZE);
    this.beamGeom = createWBeamGeometry(CHUNK_SIZE);
    this.postGeom = new THREE.BoxGeometry(0.1, GUARD_RAIL_HEIGHT + 0.12, 0.15);
    this.blockGeom = new THREE.BoxGeometry(0.14, 0.2, 0.1); // spacer block between post and beam
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
      // The beam's local +x faces the road, so the +x rail is turned 180 degrees.
      const beam = new THREE.Mesh(this.beamGeom, this.beamMat);
      beam.position.set(side * W_BEAM_X, roadY + GUARD_RAIL_HEIGHT, zCenter);
      if (side > 0) beam.rotation.y = Math.PI;
      beam.castShadow = true;
      beam.receiveShadow = true;
      add(beam);

      const postCount = Math.round(CHUNK_SIZE / GUARD_POST_SPACING);
      const posts = new THREE.InstancedMesh(this.postGeom, this.steelMat, postCount);
      const blocks = new THREE.InstancedMesh(this.blockGeom, this.steelMat, postCount);
      const backX = W_BEAM_X + W_BEAM_DEPTH; // beam back plane
      for (let i = 0; i < postCount; i++) {
        const pz = zCenter - CHUNK_SIZE / 2 + (i + 0.5) * GUARD_POST_SPACING;
        this.dummy.position.set(side * (backX + 0.19), roadY + (GUARD_RAIL_HEIGHT + 0.12) / 2 + 0.12, pz);
        this.dummy.updateMatrix();
        posts.setMatrixAt(i, this.dummy.matrix);
        this.dummy.position.set(side * (backX + 0.07), roadY + GUARD_RAIL_HEIGHT, pz);
        this.dummy.updateMatrix();
        blocks.setMatrixAt(i, this.dummy.matrix);
      }
      posts.castShadow = true;
      posts.receiveShadow = true;
      blocks.castShadow = true;
      add(posts);
      add(blocks);
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
    this.beamMat.dispose();
    this.galvTextures?.map.dispose();
    this.galvTextures?.roughnessMap.dispose();
    for (const t of Object.values(this.roadTextures)) t.dispose();
    this.roadGeom.dispose();
    this.slabGeom.dispose();
    this.curbGeom.dispose();
    this.beamGeom.dispose();
    this.postGeom.dispose();
    this.blockGeom.dispose();
  }
}
