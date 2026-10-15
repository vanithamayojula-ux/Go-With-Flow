import * as THREE from 'three';
import { GraphicsConfig } from '../../../types';
import {
  CRYSTAL_ARCHETYPES,
  CRYSTAL_HEIGHTS_CHUNK_LENGTH,
  createProceduralCrystalGeometry,
  createCelestialPlatformGeometry,
  createCelestialHighwayChunkGeometry,
  createAlpinePeakGeometry,
  createCrystalHeightsMaterials,
  crystalHeightsGroundHeight,
  getGeometryHorizontalRadius,
} from './CrystalHeightsTerrain';
import { CrystalHeightsAtmosphere } from './CrystalHeightsAtmosphere';
import { CrystalHeightsDecorations } from './CrystalHeightsDecorations';
import { crystalHeightsConfig } from './crystalHeightsConfig';

export interface ActiveCrystalChunkItem {
  id: string;
  z: number;
  meshes: THREE.Mesh[];
  decorations: THREE.Object3D[];
}

/** Nothing solid may enter |x| < ROAD_CLEAR_X below y = 8. */
const ROAD_CLEAR_X = 6.0;
const CLEAR_MARGIN = 0.5;
const GROUND_SEED = 222;
const CHUNK = CRYSTAL_HEIGHTS_CHUNK_LENGTH;

// Distant snow-capped range: recycled pool along both flanks
const PEAKS_PER_SIDE = 5;
const PEAK_SPACING = 110;
const PEAK_VARIANTS = 3;

/**
 * CrystalHeightsWorld — high-alpine glacier:
 * - Snowfield chunks flanking the road (flat under the road, rising to foothills)
 * - Glacial ice seracs, clear quartz clusters and ice shards beside the road
 * - Granite outcrops / boulders, snow-laden spruces, a road-spanning granite arch
 * - A recycled ring of snow-capped granite peaks on both flanks
 * - Sparse diamond-dust glints (atmosphere)
 */
export class CrystalHeightsWorld {
  public scene: THREE.Scene;
  public group: THREE.Group;
  public config = crystalHeightsConfig;

  // Subsystems
  public atmosphere: CrystalHeightsAtmosphere;
  public decorations: CrystalHeightsDecorations;

  // Geometries & Materials Cache
  private crystalGeoms: Map<string, THREE.BufferGeometry> = new Map();
  private crystalRadii: Map<string, number> = new Map();
  private platformGeom: THREE.BufferGeometry | null = null;
  private platformRadius = 0;
  private highwayChunkGeom: THREE.BufferGeometry | null = null;
  private peakGeoms: THREE.BufferGeometry[] = [];
  private peakMeshes: THREE.Mesh[] = [];
  private materials: ReturnType<typeof createCrystalHeightsMaterials>;

  // Streamed Chunks
  private activeChunks: ActiveCrystalChunkItem[] = [];
  private lastChunkZ = -999;

  constructor(scene: THREE.Scene, graphicsConfig: GraphicsConfig) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'CrystalHeightsWorldRootGroup';
    this.scene.add(this.group);

    this.materials = createCrystalHeightsMaterials();
    this.initGeometries();
    this.initPeaks();

    this.atmosphere = new CrystalHeightsAtmosphere(this.scene, graphicsConfig);
    this.decorations = new CrystalHeightsDecorations(this.scene, this.materials.noiseTexture);
  }

  private initGeometries(): void {
    // 1. Ice / quartz formations (+ their horizontal reach for road clearance)
    for (const arch of CRYSTAL_ARCHETYPES) {
      const geom = createProceduralCrystalGeometry(arch, 111);
      this.crystalGeoms.set(arch.id, geom);
      this.crystalRadii.set(arch.id, getGeometryHorizontalRadius(geom));
    }

    // 2. Granite outcrop / boulder
    this.platformGeom = createCelestialPlatformGeometry(26.0, 22.0, 8.0, 9);
    this.platformRadius = getGeometryHorizontalRadius(this.platformGeom);

    // 3. Snowfield chunk (200 m wide, 60 m long)
    this.highwayChunkGeom = createCelestialHighwayChunkGeometry(200, CHUNK, 36, 24, GROUND_SEED);

    // 4. Mountain peak variants
    for (let v = 0; v < PEAK_VARIANTS; v++) {
      this.peakGeoms.push(createAlpinePeakGeometry(70, 95 + v * 12, v * 3 + 1));
    }
  }

  private initPeaks(): void {
    for (let side = -1; side <= 1; side += 2) {
      for (let i = 0; i < PEAKS_PER_SIDE; i++) {
        const slot = i * 2 + (side > 0 ? 1 : 0);
        const geom = this.peakGeoms[slot % PEAK_VARIANTS];
        const peak = new THREE.Mesh(geom, this.materials.celestialGroundMaterial);
        const r = Math.abs(Math.sin(slot * 12.9898) * 43758.5453) % 1;
        const s = 0.75 + r * 0.5;
        peak.scale.set(s, s * (0.85 + ((slot * 7) % 5) * 0.08), s);
        peak.rotation.y = r * Math.PI * 2;
        peak.position.set(side * (170 + r * 80), -2, -150 + i * PEAK_SPACING + (side > 0 ? PEAK_SPACING * 0.5 : 0));
        peak.castShadow = false;
        peak.receiveShadow = false;
        this.peakMeshes.push(peak);
        this.group.add(peak);
      }
    }
  }

  public update(playerZ: number, dt: number, time: number, graphicsConfig: GraphicsConfig): void {
    const chunkZ = Math.floor(playerZ / CHUNK);

    if (chunkZ !== this.lastChunkZ) {
      this.lastChunkZ = chunkZ;
      this.streamChunks(playerZ, graphicsConfig);
    }

    // Recycle distant peaks that fell behind (no allocation)
    const cycle = PEAKS_PER_SIDE * PEAK_SPACING;
    const behind = playerZ - 160;
    for (let i = 0; i < this.peakMeshes.length; i++) {
      const p = this.peakMeshes[i].position;
      if (p.z < behind) {
        p.z += Math.ceil((behind - p.z) / cycle) * cycle;
      }
    }

    this.atmosphere.update(dt, playerZ, time);
    this.decorations.update(time);
  }

  private streamChunks(playerZ: number, graphicsConfig: GraphicsConfig): void {
    const cullBehindZ = playerZ - 100;
    const cullAheadZ = playerZ + 460;

    // 1. Cull old chunks
    for (let i = this.activeChunks.length - 1; i >= 0; i--) {
      const item = this.activeChunks[i];
      if (item.z < cullBehindZ || item.z > cullAheadZ) {
        for (const m of item.meshes) {
          this.group.remove(m);
        }
        for (const d of item.decorations) {
          this.decorations.removeObject(d);
        }
        this.activeChunks.splice(i, 1);
      }
    }

    // 2. Generate chunks: the current band (so there is ground under the rider) + 6 ahead
    const activeZCoords = new Set(this.activeChunks.map(c => Math.round(c.z / CHUNK)));
    const currentBand = Math.floor(playerZ / CHUNK);
    for (let b = 0; b <= 6; b++) {
      const band = currentBand + b;
      if (!activeZCoords.has(band)) {
        this.spawnChunk(band * CHUNK, graphicsConfig);
      }
    }
  }

  /** Minimum |x| for an object of horizontal reach `reach` (m) to stay clear of the road. */
  private clearX(reach: number): number {
    return ROAD_CLEAR_X + reach + CLEAR_MARGIN;
  }

  private spawnChunk(centerZ: number, graphicsConfig: GraphicsConfig): void {
    const seed = Math.abs(centerZ) * 53 + 79;
    const rnd = (offset = 0) => {
      const x = Math.sin(seed + offset) * 10000;
      return x - Math.floor(x);
    };
    const shadows = graphicsConfig.enableShadows;

    const spawnedMeshes: THREE.Mesh[] = [];
    const spawnedDecs: THREE.Object3D[] = [];

    // 1. Snowfield
    if (this.highwayChunkGeom) {
      const ground = new THREE.Mesh(this.highwayChunkGeom, this.materials.celestialGroundMaterial);
      ground.position.set(0, 0, centerZ);
      ground.receiveShadow = shadows;
      this.group.add(ground);
      spawnedMeshes.push(ground);
    }

    // 2. Ice seracs / quartz clusters / ice shards. Placement uses each geometry's
    //    measured horizontal reach so a randomly rotated formation never enters |x| < 6:
    //    spires |x| in [max(20, clear) , +15], clusters [max(12.5, clear), +15], shards [max(8, clear), +10]
    let crystalDensity = 3;
    if (graphicsConfig.preset === 'mobile-opt') crystalDensity = 2;
    if (graphicsConfig.preset === 'webgl-min') crystalDensity = 1;

    for (let c = 0; c < crystalDensity; c++) {
      const side = c % 2 === 0 ? -1 : 1;
      const pick = rnd(c * 4 + 3);
      let archId = 'prismatic-cluster';
      let minX = 12.5;
      let range = 15.0;
      if (pick > 0.65) {
        archId = 'celestial-spire';
        minX = 20.0;
        range = 15.0;
      } else if (pick < 0.25) {
        archId = 'ground-shard';
        minX = 8.0;
        range = 10.0;
      }

      const geom = this.crystalGeoms.get(archId);
      if (!geom) continue;

      const scale = 0.85 + rnd(c * 4 + 5) * 0.35;
      const reach = (this.crystalRadii.get(archId) ?? 0) * scale;
      const baseX = Math.max(minX, this.clearX(reach));
      const posX = side * (baseX + rnd(c * 4 + 1) * range);
      const posZ = centerZ + (rnd(c * 4 + 2) - 0.5) * 45.0;

      // Small shards close to the road are the transmissive "hero" ice
      const hero = archId === 'ground-shard' && Math.abs(posX) < 16;
      const crystalMesh = new THREE.Mesh(geom, hero ? this.materials.energyCoreMaterial : this.materials.crystalMaterial);
      crystalMesh.position.set(posX, crystalHeightsGroundHeight(posX, posZ, GROUND_SEED) - 0.15, posZ);
      crystalMesh.rotation.y = rnd(c * 4 + 4) * Math.PI * 2;
      crystalMesh.scale.set(scale, scale, scale);
      crystalMesh.castShadow = shadows && Math.abs(posX) < 45;
      crystalMesh.receiveShadow = shadows;
      this.group.add(crystalMesh);
      spawnedMeshes.push(crystalMesh);
    }

    if (this.platformGeom) {
      // 3a. Large granite outcrop on the snowfield
      if (graphicsConfig.preset !== 'webgl-min' && rnd(10) > 0.45) {
        const s = 0.6 + rnd(13) * 0.4;
        const pSide = rnd(11) > 0.5 ? 1 : -1;
        const pX = pSide * (Math.max(32.0, this.clearX(this.platformRadius * s)) + rnd(12) * 25.0);
        const pZ = centerZ + (rnd(14) - 0.5) * 20.0;
        const outcrop = new THREE.Mesh(this.platformGeom, this.materials.celestialGroundMaterial);
        outcrop.position.set(pX, crystalHeightsGroundHeight(pX, pZ, GROUND_SEED) - 0.6 * s, pZ);
        outcrop.rotation.y = rnd(15) * Math.PI * 2;
        outcrop.scale.set(s, s, s);
        outcrop.castShadow = shadows;
        outcrop.receiveShadow = shadows;
        this.group.add(outcrop);
        spawnedMeshes.push(outcrop);
      }

      // 3b. Roadside boulder (2.5–4 m)
      if (rnd(21) > 0.3) {
        const s = 0.1 + rnd(22) * 0.06;
        const bSide = rnd(23) > 0.5 ? 1 : -1;
        const bX = bSide * (Math.max(8.5, this.clearX(this.platformRadius * s)) + rnd(24) * 6.0);
        const bZ = centerZ + (rnd(25) - 0.5) * 50.0;
        const boulder = new THREE.Mesh(this.platformGeom, this.materials.celestialGroundMaterial);
        boulder.position.set(bX, crystalHeightsGroundHeight(bX, bZ, GROUND_SEED) - 0.3 * s * 8, bZ);
        boulder.rotation.y = rnd(26) * Math.PI * 2;
        boulder.scale.set(s, s * 1.1, s);
        boulder.castShadow = shadows;
        boulder.receiveShadow = shadows;
        this.group.add(boulder);
        spawnedMeshes.push(boulder);
      }
    }

    // 4. Landmark: road-spanning granite arch (inner faces |x| = 6.4) or quartz boulder
    if (rnd(16) > 0.8) {
      const gate = this.decorations.spawnCelestialGate(new THREE.Vector3(0, 0, centerZ + 10), 1.0);
      spawnedDecs.push(gate);
    } else if (rnd(17) > 0.5) {
      // Boulder reach 2.64 m, quartz reach ~2.9 m (x0.95) → inner edge ≥ 7.7
      const side = rnd(18) > 0.5 ? 1 : -1;
      const sx = side * (10.5 + rnd(27) * 4.0);
      const sz = centerZ - 8;
      const shrine = this.decorations.spawnCrystalShrine(
        new THREE.Vector3(sx, crystalHeightsGroundHeight(sx, sz, GROUND_SEED) - 0.25, sz),
        0.95
      );
      spawnedDecs.push(shrine);
    }

    // 5. Snow-laden spruces (radius 2.4 m → inner edge ≥ 8.6)
    if (graphicsConfig.preset !== 'webgl-min' && rnd(19) > 0.35) {
      const treeCount = graphicsConfig.preset === 'desktop-full' ? 2 : 1;
      for (let t = 0; t < treeCount; t++) {
        const treeSide = (rnd(20 + t * 5) > 0.5 ? 1 : -1);
        const tx = treeSide * (11.0 + rnd(28 + t * 5) * 6.0);
        const tz = centerZ + 14 - t * 23 + (rnd(29 + t * 5) - 0.5) * 6.0;
        const s = 0.85 + rnd(30 + t * 5) * 0.4;
        const tree = this.decorations.spawnCrystalTree(
          new THREE.Vector3(tx, crystalHeightsGroundHeight(tx, tz, GROUND_SEED) - 0.1, tz),
          s
        );
        spawnedDecs.push(tree);
      }
    }

    this.activeChunks.push({
      id: `crystal-chunk-${centerZ}`,
      z: centerZ,
      meshes: spawnedMeshes,
      decorations: spawnedDecs,
    });
  }

  public dispose(): void {
    this.scene.remove(this.group);

    for (const chunk of this.activeChunks) {
      for (const m of chunk.meshes) {
        this.group.remove(m);
      }
      for (const d of chunk.decorations) {
        this.decorations.removeObject(d);
      }
    }
    this.activeChunks = [];

    for (const p of this.peakMeshes) {
      this.group.remove(p);
    }
    this.peakMeshes = [];

    // Dispose cached geometries
    for (const geom of this.crystalGeoms.values()) {
      geom.dispose();
    }
    this.crystalGeoms.clear();
    this.crystalRadii.clear();

    for (const g of this.peakGeoms) g.dispose();
    this.peakGeoms = [];

    if (this.platformGeom) {
      this.platformGeom.dispose();
      this.platformGeom = null;
    }

    if (this.highwayChunkGeom) {
      this.highwayChunkGeom.dispose();
      this.highwayChunkGeom = null;
    }

    // Dispose materials & textures
    this.materials.crystalMaterial.dispose();
    this.materials.celestialGroundMaterial.normalMap?.dispose();
    this.materials.celestialGroundMaterial.dispose();
    this.materials.celestialArchStoneMaterial.dispose();
    this.materials.energyCoreMaterial.dispose();
    if (this.materials.noiseTexture) this.materials.noiseTexture.dispose();

    this.atmosphere.dispose();
    this.decorations.dispose();
  }
}
