import * as THREE from 'three';
import { GraphicsConfig } from '../../../types';
import {
  VOLCANIC_ARCHETYPES,
  createProceduralVolcanicRockGeometry,
  createVolcanicHighwayChunkGeometry,
  createObsidianCoreMaterials,
} from './ObsidianCoreTerrain';
import { ObsidianCoreAtmosphere } from './ObsidianCoreAtmosphere';
import { ObsidianCoreDecorations } from './ObsidianCoreDecorations';
import { obsidianCoreConfig } from './obsidianCoreConfig';

export interface ActiveVolcanicChunkItem {
  id: string;
  z: number;
  meshes: THREE.Mesh[];
  decorations: THREE.Object3D[];
}

/**
 * ObsidianCoreWorld coordinates:
 * - Fractured obsidian highway bed with glowing magma cracks
 * - Flanking glowing lava rivers, basalt column clusters, and jagged spires
 * - Towering horizon caldera volcanoes and the Monumental Obsidian Citadel landmark
 * - Rising volcanic ember particles, charred maroon smoke haze, and caldera fire ring
 * - Roadside fire braziers, magma waterfalls, and forge arches
 * - Chunk-based streaming & Graphics quality presets
 */
export class ObsidianCoreWorld {
  public scene: THREE.Scene;
  public group: THREE.Group;
  public config = obsidianCoreConfig;

  // Subsystems
  public atmosphere: ObsidianCoreAtmosphere;
  public decorations: ObsidianCoreDecorations;

  // Geometries & Materials Cache
  private rockGeoms: Map<string, THREE.BufferGeometry> = new Map();
  private highwayChunkGeom: THREE.BufferGeometry | null = null;
  private materials: ReturnType<typeof createObsidianCoreMaterials>;

  // Streamed Chunks
  private activeChunks: ActiveVolcanicChunkItem[] = [];
  private lastChunkZ = -999;

  constructor(scene: THREE.Scene, graphicsConfig: GraphicsConfig) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'ObsidianCoreWorldRootGroup';
    this.scene.add(this.group);

    this.materials = createObsidianCoreMaterials();
    this.initGeometries();

    this.atmosphere = new ObsidianCoreAtmosphere(this.scene, graphicsConfig);
    this.decorations = new ObsidianCoreDecorations(this.scene);
  }

  private initGeometries(): void {
    // 1. Volcanic Rock Archetypes
    for (const arch of VOLCANIC_ARCHETYPES) {
      const geom = createProceduralVolcanicRockGeometry(arch, 888);
      this.rockGeoms.set(arch.id, geom);
    }

    // 2. Volcanic Highway Roadbed (60m length, 80m width)
    this.highwayChunkGeom = createVolcanicHighwayChunkGeometry(80, 60, 14, 16, 999);
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
    const seed = Math.abs(centerZ) * 67 + 91;
    const rnd = (offset = 0) => {
      const x = Math.sin(seed + offset) * 10000;
      return x - Math.floor(x);
    };

    const spawnedMeshes: THREE.Mesh[] = [];
    const spawnedDecs: THREE.Object3D[] = [];

    // 1. Central Fractured Obsidian Highway Bed
    if (this.highwayChunkGeom) {
      const ground = new THREE.Mesh(this.highwayChunkGeom, this.materials.obsidianGroundMaterial);
      ground.position.set(0, 0, centerZ);
      ground.receiveShadow = graphicsConfig.enableShadows;
      this.group.add(ground);
      spawnedMeshes.push(ground);
    }

    // 2. Flanking Basalt Spires and Jagged Obsidian Crags (|X| >= 11.5 for clear corridor)
    let rockDensity = 3;
    if (graphicsConfig.preset === 'mobile-opt') rockDensity = 2;
    if (graphicsConfig.preset === 'webgl-min') rockDensity = 1;

    for (let r = 0; r < rockDensity; r++) {
      const side = r % 2 === 0 ? -1 : 1;
      const posX = side * (12.5 + rnd(r * 4 + 1) * 18.0);
      const posZ = centerZ + (rnd(r * 4 + 2) - 0.5) * 45.0;

      const pick = rnd(r * 4 + 3);
      let archId = 'basalt-cluster';
      if (pick > 0.65) archId = 'obsidian-spire';
      else if (pick < 0.25) archId = 'jagged-rock';

      const geom = this.rockGeoms.get(archId);
      if (geom) {
        const rockMesh = new THREE.Mesh(geom, this.materials.volcanicRockMaterial);
        rockMesh.position.set(posX, 0, posZ);
        rockMesh.rotation.y = rnd(r * 4 + 4) * Math.PI * 2;
        const scale = 0.85 + rnd(r * 4 + 5) * 0.35;
        rockMesh.scale.set(scale, scale, scale);
        rockMesh.castShadow = graphicsConfig.enableShadows && archId === 'obsidian-spire';
        rockMesh.receiveShadow = graphicsConfig.enableShadows;
        this.group.add(rockMesh);
        spawnedMeshes.push(rockMesh);
      }
    }

    // 3. Towering Horizon Caldera Volcano (Placed distant on the flank/horizon)
    if (graphicsConfig.preset !== 'webgl-min' && rnd(10) > 0.5) {
      const cGeom = this.rockGeoms.get('caldera-peak');
      if (cGeom) {
        const volcano = new THREE.Mesh(cGeom, this.materials.volcanicRockMaterial);
        const sideSign = rnd(11) > 0.5 ? 1 : -1;
        const vX = sideSign * (130.0 + rnd(12) * 60.0);
        const vZ = centerZ + 180.0 + rnd(13) * 100.0;
        volcano.position.set(vX, -6.0, vZ);
        volcano.scale.set(1.4, 1.4, 1.4);
        this.group.add(volcano);
        spawnedMeshes.push(volcano);
      }
    }

    // 4. Final Destination Landmark: Monumental Obsidian Citadel
    // Spawns periodically ahead as the player advances towards the volcanic core
    if (rnd(14) > 0.68) {
      const citadel = this.decorations.spawnCitadel(
        new THREE.Vector3(0, 0, centerZ + 16),
        1.1
      );
      spawnedDecs.push(citadel);
    } else if (rnd(15) > 0.45) {
      // Spawn Ancient Magma Forge Arch over the highway
      const arch = this.decorations.spawnForgeArch(
        new THREE.Vector3(0, 0, centerZ + 10),
        1.0
      );
      spawnedDecs.push(arch);
    }

    // 5. Roadside Magma Braziers
    if (graphicsConfig.preset !== 'webgl-min' && rnd(16) > 0.35) {
      const bSide = rnd(17) > 0.5 ? 1 : -1;
      const brazier = this.decorations.spawnBrazier(
        new THREE.Vector3(bSide * 8.2, 0, centerZ + (rnd(18) - 0.5) * 15),
        1.0
      );
      spawnedDecs.push(brazier);
    }

    // 6. Magma Falls pouring off flank cliffs
    if (graphicsConfig.preset === 'desktop-full' && rnd(19) > 0.5) {
      const fSide = rnd(20) > 0.5 ? 1 : -1;
      const fall = this.decorations.createMagmaFall(
        new THREE.Vector3(fSide * 16.5, -1.0, centerZ),
        26.0,
        4.5
      );
      spawnedDecs.push(fall);
    }

    this.activeChunks.push({
      id: `obsidian-chunk-${centerZ}`,
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
    for (const geom of this.rockGeoms.values()) {
      geom.dispose();
    }
    this.rockGeoms.clear();

    if (this.highwayChunkGeom) {
      this.highwayChunkGeom.dispose();
      this.highwayChunkGeom = null;
    }

    // Dispose materials
    this.materials.obsidianGroundMaterial.dispose();
    this.materials.volcanicRockMaterial.dispose();
    this.materials.moltenLavaMaterial.dispose();
    this.materials.citadelIronMaterial.dispose();

    this.atmosphere.dispose();
    this.decorations.dispose();
  }
}
