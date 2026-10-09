import * as THREE from 'three';
import { GraphicsConfig } from '../../../types';
import {
  CRYSTAL_ARCHETYPES,
  createProceduralCrystalGeometry,
  createCelestialPlatformGeometry,
  createCelestialHighwayChunkGeometry,
  createCrystalHeightsMaterials,
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

/**
 * CrystalHeightsWorld coordinates:
 * - Procedural crystal spires, prismatic clusters, and floating geode monoliths
 * - Dark starry paved highway bed with radiant cyan circuit runes
 * - Floating celestial platforms & broken stone bridge fragments
 * - Deep cosmic starfield, lavender moon orb, nebula haze, and orbiting energy motes
 * - Celestial gateways, crystal shrines, and crystal bonsai trees
 * - Chunk-based streaming & Graphics quality presets
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
  private platformGeom: THREE.BufferGeometry | null = null;
  private highwayChunkGeom: THREE.BufferGeometry | null = null;
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

    this.atmosphere = new CrystalHeightsAtmosphere(this.scene, graphicsConfig);
    this.decorations = new CrystalHeightsDecorations(this.scene);
  }

  private initGeometries(): void {
    // 1. Crystal Formations
    for (const arch of CRYSTAL_ARCHETYPES) {
      const geom = createProceduralCrystalGeometry(arch, 111);
      this.crystalGeoms.set(arch.id, geom);
    }

    // 2. Floating Celestial Rock Platform
    this.platformGeom = createCelestialPlatformGeometry(26.0, 26.0, 8.0, 7);

    // 3. Central Celestial Highway Bed (60m length, 75m width)
    this.highwayChunkGeom = createCelestialHighwayChunkGeometry(75, 60, 14, 16, 222);
  }

  public update(playerZ: number, dt: number, time: number, graphicsConfig: GraphicsConfig): void {
    const chunkZ = Math.floor(playerZ / 60);

    if (chunkZ !== this.lastChunkZ) {
      this.lastChunkZ = chunkZ;
      this.streamChunks(playerZ, graphicsConfig);
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

    // 2. Generate chunks ahead
    const activeZCoords = new Set(this.activeChunks.map(c => Math.round(c.z / 60)));
    const targetBands = [
      Math.floor(playerZ / 60) + 1,
      Math.floor(playerZ / 60) + 2,
      Math.floor(playerZ / 60) + 3,
      Math.floor(playerZ / 60) + 4,
      Math.floor(playerZ / 60) + 5,
      Math.floor(playerZ / 60) + 6,
    ];

    for (const band of targetBands) {
      if (!activeZCoords.has(band)) {
        this.spawnChunk(band * 60, graphicsConfig);
      }
    }
  }

  private spawnChunk(centerZ: number, graphicsConfig: GraphicsConfig): void {
    const seed = Math.abs(centerZ) * 53 + 79;
    const rnd = (offset = 0) => {
      const x = Math.sin(seed + offset) * 10000;
      return x - Math.floor(x);
    };

    const spawnedMeshes: THREE.Mesh[] = [];
    const spawnedDecs: THREE.Object3D[] = [];

    // 1. Central Celestial Highway Bed
    if (this.highwayChunkGeom) {
      const ground = new THREE.Mesh(this.highwayChunkGeom, this.materials.celestialGroundMaterial);
      ground.position.set(0, 0, centerZ);
      ground.receiveShadow = graphicsConfig.enableShadows;
      this.group.add(ground);
      spawnedMeshes.push(ground);
    }

    // 2. Flanking Crystal Formations (strictly kept at |X| >= 10.5 for runner lane clarity)
    let crystalDensity = 3;
    if (graphicsConfig.preset === 'mobile-opt') crystalDensity = 2;
    if (graphicsConfig.preset === 'webgl-min') crystalDensity = 1;

    for (let c = 0; c < crystalDensity; c++) {
      const side = c % 2 === 0 ? -1 : 1;
      const posX = side * (12.0 + rnd(c * 4 + 1) * 18.0);
      const posZ = centerZ + (rnd(c * 4 + 2) - 0.5) * 45.0;

      const pick = rnd(c * 4 + 3);
      let archId = 'prismatic-cluster';
      if (pick > 0.65) archId = 'celestial-spire';
      else if (pick < 0.25) archId = 'ground-shard';

      const geom = this.crystalGeoms.get(archId);
      if (geom) {
        const crystalMesh = new THREE.Mesh(geom, this.materials.crystalMaterial);
        crystalMesh.position.set(posX, 0, posZ);
        crystalMesh.rotation.y = rnd(c * 4 + 4) * Math.PI * 2;
        const scale = 0.85 + rnd(c * 4 + 5) * 0.35;
        crystalMesh.scale.set(scale, scale, scale);
        crystalMesh.castShadow = graphicsConfig.enableShadows && archId === 'celestial-spire';
        crystalMesh.receiveShadow = graphicsConfig.enableShadows;
        this.group.add(crystalMesh);
        spawnedMeshes.push(crystalMesh);
      }
    }

    // 3. Floating Celestial Geode Island (flanking the void)
    if (graphicsConfig.preset !== 'webgl-min' && rnd(10) > 0.45) {
      if (this.platformGeom) {
        const platform = new THREE.Mesh(this.platformGeom, this.materials.celestialGroundMaterial);
        const pSide = rnd(11) > 0.5 ? 1 : -1;
        const pX = pSide * (32.0 + rnd(12) * 25.0);
        const pY = 2.0 + (rnd(13) - 0.5) * 12.0;
        const pZ = centerZ + (rnd(14) - 0.5) * 20.0;

        platform.position.set(pX, pY, pZ);
        platform.rotation.y = rnd(15) * Math.PI * 2;
        this.group.add(platform);
        spawnedMeshes.push(platform);

        // Put a crystal spire atop the floating platform
        const topGeom = this.crystalGeoms.get('celestial-spire');
        if (topGeom) {
          const topSpire = new THREE.Mesh(topGeom, this.materials.crystalMaterial);
          topSpire.position.set(pX, pY, pZ);
          topSpire.scale.set(0.7, 0.7, 0.7);
          this.group.add(topSpire);
          spawnedMeshes.push(topSpire);
        }
      }
    }

    // 4. Landmark: Monumental Celestial Gateway or Crystal Shrine
    if (rnd(16) > 0.65) {
      // Spawn celestial gateway spanning the roadbed
      const gate = this.decorations.spawnCelestialGate(new THREE.Vector3(0, 0, centerZ + 10), 1.0);
      spawnedDecs.push(gate);
    } else if (rnd(17) > 0.5) {
      // Spawn roadside crystal altar shrine
      const side = rnd(18) > 0.5 ? 1 : -1;
      const shrine = this.decorations.spawnCrystalShrine(
        new THREE.Vector3(side * 8.8, 0, centerZ - 8),
        0.95
      );
      spawnedDecs.push(shrine);
    }

    // 5. Crystal Bonsai Tree (celestial flora)
    if (graphicsConfig.preset !== 'webgl-min' && rnd(19) > 0.45) {
      const treeSide = rnd(20) > 0.5 ? 1 : -1;
      const tree = this.decorations.spawnCrystalTree(
        new THREE.Vector3(treeSide * 9.5, 0, centerZ + 14),
        1.0
      );
      spawnedDecs.push(tree);
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

    // Dispose cached geometries
    for (const geom of this.crystalGeoms.values()) {
      geom.dispose();
    }
    this.crystalGeoms.clear();

    if (this.platformGeom) {
      this.platformGeom.dispose();
      this.platformGeom = null;
    }

    if (this.highwayChunkGeom) {
      this.highwayChunkGeom.dispose();
      this.highwayChunkGeom = null;
    }

    // Dispose materials
    this.materials.crystalMaterial.dispose();
    this.materials.celestialGroundMaterial.dispose();
    this.materials.celestialArchStoneMaterial.dispose();
    this.materials.energyCoreMaterial.dispose();

    this.atmosphere.dispose();
    this.decorations.dispose();
  }
}
