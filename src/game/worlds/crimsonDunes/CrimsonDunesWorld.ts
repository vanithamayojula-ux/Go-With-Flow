import * as THREE from 'three';
import { GraphicsConfig } from '../../../types';
import {
  DUNE_PROFILES,
  MESA_ARCHETYPES,
  createProceduralDuneGeometry,
  createProceduralMesaGeometry,
  createDesertHighwayChunkGeometry,
  createCrimsonDunesMaterials,
} from './CrimsonDunesTerrain';
import { CrimsonDunesAtmosphere } from './CrimsonDunesAtmosphere';
import { CrimsonDunesDecorations } from './CrimsonDunesDecorations';
import { crimsonDunesConfig } from './crimsonDunesConfig';

export interface ActiveDesertChunkItem {
  id: string;
  z: number;
  meshes: THREE.Mesh[];
  decorations: THREE.Object3D[];
}

/**
 * CrimsonDunesWorld coordinates:
 * - Rolling red sand barchan dunes & sandstone ridges
 * - Towering horizon red mesas and wind-carved buttes
 * - Ancient sandstone arches, obelisks, and ruins
 * - Drifting sand particle storms, horizon dust haze, and blazing desert sun
 * - Sparse desert cacti, dry shrubs, and solar relics
 * - Chunk-based streaming & Graphics quality presets
 */
export class CrimsonDunesWorld {
  public scene: THREE.Scene;
  public group: THREE.Group;
  public config = crimsonDunesConfig;

  // Subsystems
  public atmosphere: CrimsonDunesAtmosphere;
  public decorations: CrimsonDunesDecorations;

  // Geometries & Materials Cache
  private duneGeoms: Map<string, THREE.BufferGeometry> = new Map();
  private mesaGeoms: Map<string, THREE.BufferGeometry> = new Map();
  private highwayChunkGeom: THREE.BufferGeometry | null = null;
  private materials: ReturnType<typeof createCrimsonDunesMaterials>;

  // Streamed Chunks
  private activeChunks: ActiveDesertChunkItem[] = [];
  private lastChunkZ = -999;

  constructor(scene: THREE.Scene, graphicsConfig: GraphicsConfig) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'CrimsonDunesWorldRootGroup';
    this.scene.add(this.group);

    this.materials = createCrimsonDunesMaterials();
    this.initGeometries();

    this.atmosphere = new CrimsonDunesAtmosphere(this.scene, graphicsConfig);
    this.decorations = new CrimsonDunesDecorations(this.scene);
  }

  private initGeometries(): void {
    // 1. Dune Geometries
    for (const profile of DUNE_PROFILES) {
      const geom = createProceduralDuneGeometry(profile, 14, 16, 333);
      this.duneGeoms.set(profile.id, geom);
    }

    // 2. Mesa Geometries
    for (const mesa of MESA_ARCHETYPES) {
      const segs = mesa.tier === 'horizon-monolith' ? 14 : 10;
      const geom = createProceduralMesaGeometry(mesa, segs, 444);
      this.mesaGeoms.set(mesa.id, geom);
    }

    // 3. Central Paved Highway Chunk (60m length, 80m width)
    this.highwayChunkGeom = createDesertHighwayChunkGeometry(80, 60, 14, 16, 555);
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
    const seed = Math.abs(centerZ) * 43 + 61;
    const rnd = (offset = 0) => {
      const x = Math.sin(seed + offset) * 10000;
      return x - Math.floor(x);
    };

    const spawnedMeshes: THREE.Mesh[] = [];
    const spawnedDecs: THREE.Object3D[] = [];

    // 1. Central Highway Ground Bed
    if (this.highwayChunkGeom) {
      const ground = new THREE.Mesh(this.highwayChunkGeom, this.materials.duneMaterial);
      ground.position.set(0, 0, centerZ);
      ground.receiveShadow = graphicsConfig.enableShadows;
      this.group.add(ground);
      spawnedMeshes.push(ground);
    }

    // 2. Flanking Rolling Dunes (Positioned safely outside central runner road |X| >= 16)
    const sides: Array<'left' | 'right'> = rnd(1) > 0.4 ? ['left', 'right'] : (rnd(2) > 0.5 ? ['left'] : ['right']);
    for (const side of sides) {
      const sign = side === 'left' ? -1 : 1;
      const duneType = rnd(3) > 0.6 ? 'large-crescent' : (rnd(4) > 0.3 ? 'medium-dune' : 'long-ridge');
      const geom = this.duneGeoms.get(duneType);
      if (geom) {
        const duneMesh = new THREE.Mesh(geom, this.materials.duneMaterial);
        const posX = sign * (20.0 + rnd(5) * 25.0);
        const posY = -1.5 + rnd(6) * 3.0;
        const posZ = centerZ + (rnd(7) - 0.5) * 20.0;

        duneMesh.position.set(posX, posY, posZ);
        duneMesh.rotation.y = rnd(8) * Math.PI * 0.4;
        duneMesh.receiveShadow = graphicsConfig.enableShadows;
        duneMesh.castShadow = graphicsConfig.enableShadows && duneType === 'large-crescent';
        this.group.add(duneMesh);
        spawnedMeshes.push(duneMesh);
      }
    }

    // 3. Towering Horizon Mesa Landmark (Placed far on horizon to establish vast desert scale)
    if (graphicsConfig.preset !== 'webgl-min' && rnd(9) > 0.5) {
      const isMonolith = rnd(10) > 0.5 && graphicsConfig.preset === 'desktop-full';
      const mesaArchId = isMonolith ? 'horizon-monolith' : 'flank-butte';
      const mesaGeom = this.mesaGeoms.get(mesaArchId);

      if (mesaGeom) {
        const mesa = new THREE.Mesh(mesaGeom, this.materials.mesaRockMaterial);
        const sideSign = rnd(11) > 0.5 ? 1 : -1;
        const mesaDistX = sideSign * (isMonolith ? 140.0 + rnd(12) * 80.0 : 45.0 + rnd(12) * 30.0);
        const mesaDistZ = centerZ + (isMonolith ? 180.0 + rnd(13) * 100.0 : (rnd(13) - 0.5) * 35.0);

        mesa.position.set(mesaDistX, -4.0, mesaDistZ);
        mesa.scale.set(1.2, 1.2, 1.2);
        mesa.receiveShadow = graphicsConfig.enableShadows;
        this.group.add(mesa);
        spawnedMeshes.push(mesa);
      }
    }

    // 4. Ancient Desert Landmark: Monumental Arch or Sand-Buried Obelisk
    if (rnd(14) > 0.65) {
      // Spawn monumental arch bridging across the roadbed
      const arch = this.decorations.spawnDesertArch(new THREE.Vector3(0, 0, centerZ + 12), 1.0);
      spawnedDecs.push(arch);
    } else if (rnd(15) > 0.45) {
      // Spawn roadside buried obelisk or pillar colonnade
      const side = rnd(16) > 0.5 ? 1 : -1;
      const isObelisk = rnd(17) > 0.5;
      const ruin = isObelisk
        ? this.decorations.spawnObelisk(new THREE.Vector3(side * 8.8, 0, centerZ), 1.1)
        : this.decorations.spawnRuinPillars(new THREE.Vector3(side * 8.5, 0, centerZ - 6), 0.95);
      spawnedDecs.push(ruin);
    }

    // 5. Sparse Desert Vegetation: Cacti and Dry Shrubs
    if (graphicsConfig.preset !== 'webgl-min' && rnd(18) > 0.3) {
      const side = rnd(19) > 0.5 ? 1 : -1;
      const cactus = this.decorations.spawnCactus(
        new THREE.Vector3(side * 9.2, 0, centerZ + (rnd(20) - 0.5) * 20),
        0.95
      );
      spawnedDecs.push(cactus);

      if (rnd(21) > 0.5) {
        const shrub = this.decorations.spawnShrub(
          new THREE.Vector3(-side * 9.5, 0, centerZ + (rnd(22) - 0.5) * 15),
          1.0
        );
        spawnedDecs.push(shrub);
      }
    }

    this.activeChunks.push({
      id: `dunes-chunk-${centerZ}`,
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
    for (const geom of this.duneGeoms.values()) {
      geom.dispose();
    }
    this.duneGeoms.clear();

    for (const geom of this.mesaGeoms.values()) {
      geom.dispose();
    }
    this.mesaGeoms.clear();

    if (this.highwayChunkGeom) {
      this.highwayChunkGeom.dispose();
      this.highwayChunkGeom = null;
    }

    // Dispose materials
    this.materials.duneMaterial.dispose();
    this.materials.mesaRockMaterial.dispose();
    this.materials.ancientStoneMaterial.dispose();
    this.materials.solarRelicMaterial.dispose();

    this.atmosphere.dispose();
    this.decorations.dispose();
  }
}
