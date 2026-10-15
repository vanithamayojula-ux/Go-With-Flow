import * as THREE from 'three';
import { GraphicsConfig } from '../../../types';
import {
  DUNE_PROFILES,
  MESA_ARCHETYPES,
  MESA_MAX_RADIUS_FACTOR,
  DuneProfile,
  MesaArchetype,
  createProceduralDuneGeometry,
  createProceduralMesaGeometry,
  createDesertHighwayChunkGeometry,
  createCrimsonDunesMaterials,
} from './CrimsonDunesTerrain';
import { CrimsonDunesAtmosphere } from './CrimsonDunesAtmosphere';
import { CrimsonDunesDecorations } from './CrimsonDunesDecorations';
import { crimsonDunesConfig } from './crimsonDunesConfig';

/** Nothing solid may come closer to the road centre-line than this (metres). */
const ROAD_CLEAR_X = 6.0;
/** Extra margin kept between dune footprints and the road clearance zone. */
const DUNE_MARGIN_X = 2.0;
/** Ground bed chunk dimensions. */
const GROUND_WIDTH = 160;
const CHUNK_LENGTH = 60;

export interface ActiveDesertChunkItem {
  id: string;
  z: number;
  meshes: THREE.Mesh[];
  decorations: THREE.Object3D[];
}

/**
 * CrimsonDunesWorld coordinates:
 * - Rolling sand barchan dunes & longitudinal sand ridges
 * - Towering layered sandstone mesas and wind-carved buttes
 * - Ancient sandstone arches, obelisks, and ruins
 * - Drifting wind-blown sand
 * - Sparse desert cacti, dry shrubs, and bronze solar relics
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
  private duneProfiles: Map<string, DuneProfile> = new Map();
  private mesaProfiles: Map<string, MesaArchetype> = new Map();
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
    // 1. Dune Geometries (dense enough for smooth shading)
    for (const profile of DUNE_PROFILES) {
      const geom = createProceduralDuneGeometry(profile, 40, 48, 333);
      this.duneGeoms.set(profile.id, geom);
      this.duneProfiles.set(profile.id, profile);
    }

    // 2. Mesa Geometries
    for (const mesa of MESA_ARCHETYPES) {
      const segs = mesa.tier === 'horizon-monolith' ? 36 : 28;
      const geom = createProceduralMesaGeometry(mesa, segs, 444);
      this.mesaGeoms.set(mesa.id, geom);
      this.mesaProfiles.set(mesa.id, mesa);
    }

    // 3. Ground bed chunk (60m long, 160m wide, 2m lateral resolution, flat for |x| <= 6)
    this.highwayChunkGeom = createDesertHighwayChunkGeometry(GROUND_WIDTH, CHUNK_LENGTH, 80, 24, 555);
  }

  public update(playerZ: number, dt: number, time: number, graphicsConfig: GraphicsConfig): void {
    const chunkZ = Math.floor(playerZ / CHUNK_LENGTH);

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

    // 2. Generate chunks around / ahead of the player (including the one underfoot)
    const baseBand = Math.floor(playerZ / CHUNK_LENGTH);
    for (let offset = -1; offset <= 6; offset++) {
      const band = baseBand + offset;
      const bandZ = band * CHUNK_LENGTH;
      if (bandZ < cullBehindZ) continue;
      let exists = false;
      for (let i = 0; i < this.activeChunks.length; i++) {
        if (Math.round(this.activeChunks[i].z / CHUNK_LENGTH) === band) {
          exists = true;
          break;
        }
      }
      if (!exists) {
        this.spawnChunk(bandZ, graphicsConfig);
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

    // 1. Ground bed (flat at y=-0.15 under the road for |x| <= 6, rising beyond)
    if (this.highwayChunkGeom) {
      const ground = new THREE.Mesh(this.highwayChunkGeom, this.materials.duneMaterial);
      ground.position.set(0, 0, centerZ);
      ground.receiveShadow = graphicsConfig.enableShadows;
      this.group.add(ground);
      spawnedMeshes.push(ground);
    }

    // 2. Flanking Rolling Dunes. Placement uses the rotated plane's true half-extent so no
    //    part of a dune comes closer than ROAD_CLEAR_X + DUNE_MARGIN_X (8 m) to the road axis.
    const sides: Array<'left' | 'right'> = rnd(1) > 0.4 ? ['left', 'right'] : (rnd(2) > 0.5 ? ['left'] : ['right']);
    for (const side of sides) {
      const sign = side === 'left' ? -1 : 1;
      const duneType = rnd(3) > 0.6 ? 'large-crescent' : (rnd(4) > 0.3 ? 'medium-dune' : 'long-ridge');
      const geom = this.duneGeoms.get(duneType);
      const profile = this.duneProfiles.get(duneType);
      if (geom && profile) {
        const duneMesh = new THREE.Mesh(geom, this.materials.duneMaterial);
        const rotY = (rnd(8) - 0.5) * 0.5; // +/- ~14 degrees
        const halfExtentX =
          Math.abs(Math.cos(rotY)) * profile.width * 0.5 + Math.abs(Math.sin(rotY)) * profile.length * 0.5;
        const posX = sign * (ROAD_CLEAR_X + DUNE_MARGIN_X + halfExtentX + rnd(5) * 18.0);
        const posY = -1.2 + rnd(6) * 0.6; // edges sit slightly buried in the ground bed
        const posZ = centerZ + (rnd(7) - 0.5) * 20.0;

        duneMesh.position.set(posX, posY, posZ);
        duneMesh.rotation.y = rotY;
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
      const archetype = this.mesaProfiles.get(mesaArchId);

      if (mesaGeom && archetype) {
        const mesa = new THREE.Mesh(mesaGeom, this.materials.mesaRockMaterial);
        const mesaScale = 1.2;
        const maxRadius = archetype.radiusBase * MESA_MAX_RADIUS_FACTOR * mesaScale;
        const sideSign = rnd(11) > 0.5 ? 1 : -1;
        // Butte footprint stays >= 12 m beyond the road axis even at its widest talus flare
        const mesaDistX = sideSign * (isMonolith ? 140.0 + rnd(12) * 80.0 : maxRadius + 12.0 + rnd(12) * 30.0);
        const mesaDistZ = centerZ + (isMonolith ? 180.0 + rnd(13) * 100.0 : (rnd(13) - 0.5) * 35.0);

        mesa.position.set(mesaDistX, -4.0, mesaDistZ);
        mesa.rotation.y = rnd(23) * Math.PI * 2;
        mesa.scale.set(mesaScale, mesaScale, mesaScale);
        mesa.receiveShadow = graphicsConfig.enableShadows;
        mesa.castShadow = graphicsConfig.enableShadows && !isMonolith;
        this.group.add(mesa);
        spawnedMeshes.push(mesa);
      }
    }

    // 4. Ancient Desert Landmark: Monumental Arch or Sand-Buried Obelisk
    if (rnd(14) > 0.65) {
      // Monumental arch spanning the road (inner pillar faces at |x| >= 6.5)
      const arch = this.decorations.spawnDesertArch(new THREE.Vector3(0, 0, centerZ + 12), 1.0);
      spawnedDecs.push(arch);
    } else if (rnd(15) > 0.45) {
      // Roadside buried obelisk or pillar colonnade (mirrored so it always extends away from the road)
      const side = rnd(16) > 0.5 ? 1 : -1;
      const isObelisk = rnd(17) > 0.5;
      const ruin = isObelisk
        ? this.decorations.spawnObelisk(new THREE.Vector3(side * 8.8, 0, centerZ), 1.1)
        : this.decorations.spawnRuinPillars(new THREE.Vector3(side * 8.5, 0, centerZ - 6), 0.95, side);
      spawnedDecs.push(ruin);
    }

    // 5. Sparse Desert Vegetation: Cacti and Dry Shrubs
    if (graphicsConfig.preset !== 'webgl-min' && rnd(18) > 0.3) {
      const side = rnd(19) > 0.5 ? 1 : -1;
      const cactus = this.decorations.spawnCactus(
        new THREE.Vector3(side * 9.2, 0, centerZ + (rnd(20) - 0.5) * 20),
        0.95
      );
      cactus.rotation.y = rnd(24) * Math.PI * 2;
      spawnedDecs.push(cactus);

      if (rnd(21) > 0.5) {
        const shrub = this.decorations.spawnShrub(
          new THREE.Vector3(-side * 9.5, 0, centerZ + (rnd(22) - 0.5) * 15),
          1.0
        );
        shrub.rotation.y = rnd(25) * Math.PI * 2;
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
    this.duneProfiles.clear();

    for (const geom of this.mesaGeoms.values()) {
      geom.dispose();
    }
    this.mesaGeoms.clear();
    this.mesaProfiles.clear();

    if (this.highwayChunkGeom) {
      this.highwayChunkGeom.dispose();
      this.highwayChunkGeom = null;
    }

    // Dispose materials & textures
    this.materials.duneMaterial.normalMap?.dispose();
    this.materials.duneMaterial.dispose();
    this.materials.mesaRockMaterial.dispose();
    this.materials.ancientStoneMaterial.dispose();
    this.materials.solarRelicMaterial.dispose();
    if (this.materials.noiseTexture) this.materials.noiseTexture.dispose();

    this.atmosphere.dispose();
    this.decorations.dispose();
  }
}
