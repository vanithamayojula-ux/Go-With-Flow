import * as THREE from 'three';
import { GraphicsConfig } from '../../../types';
import {
  VOLCANIC_ARCHETYPES,
  createProceduralVolcanicRockGeometry,
  createVolcanicHighwayChunkGeometry,
  createLavaRiverGeometry,
  createObsidianCoreMaterials,
  volcanicGroundHeight,
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
 * Horizontal extent (m, unscaled) of each rock archetype around its origin,
 * measured from the generated geometry (incl. column tilt). Used to keep rocks
 * clear of the road corridor (|x| < 6).
 */
const ROCK_EXTENT: Record<string, number> = {
  'obsidian-spire': 7.7,
  'basalt-cluster': 8.2,
  'jagged-rock': 3.6,
};
const ROCK_MAX_SCALE = 1.2;
/** Minimum |x| for big rocks: 6 + 8.2 * 1.2 = 15.84 -> 16.5 with margin. */
const BIG_ROCK_MIN_X = 16.5;

/**
 * ObsidianCoreWorld coordinates:
 * - Ash / basalt ground bed under the highway with lava channels either side
 * - Basalt column clusters, obsidian shards and crags beyond the channels
 * - Distant ash-covered volcanoes and a basalt citadel on the ridge
 * - Rising embers, falling ash, high smoke layers
 * - Roadside fire bowls, lava falls and stone forge arches over the road
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
  private lavaRiverGeom: THREE.BufferGeometry | null = null;
  private materials: ReturnType<typeof createObsidianCoreMaterials>;

  // Streamed Chunks
  private activeChunks: ActiveVolcanicChunkItem[] = [];
  private lastChunkZ = -999;
  private activeBands: Set<number> = new Set();

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

    // 2. Ground bed (60 m long, 140 m wide) and lava channel surfaces
    this.highwayChunkGeom = createVolcanicHighwayChunkGeometry(140, 60, 14, 24, 999);
    this.lavaRiverGeom = createLavaRiverGeometry(60, 8);
  }

  public update(playerZ: number, dt: number, time: number, graphicsConfig: GraphicsConfig): void {
    const chunkZ = Math.floor(playerZ / 60);

    if (chunkZ !== this.lastChunkZ) {
      this.lastChunkZ = chunkZ;
      this.streamChunks(playerZ, graphicsConfig);
    }

    // Slow lava flow + breathing heat
    const lava = this.materials.moltenLavaMaterial;
    const base = this.materials.lavaTexture ? 4.0 : 2.4;
    lava.emissiveIntensity = base + Math.sin(time * 0.6) * 0.35 + Math.sin(time * 2.3) * 0.12;
    if (this.materials.lavaTexture) {
      this.materials.lavaTexture.offset.y = (time * 0.012) % 1;
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
    this.activeBands.clear();
    for (const c of this.activeChunks) this.activeBands.add(Math.round(c.z / 60));
    const firstBand = Math.floor(playerZ / 60);
    for (let k = 1; k <= 6; k++) {
      const band = firstBand + k;
      if (!this.activeBands.has(band)) {
        this.spawnChunk(band * 60, graphicsConfig);
      }
    }
  }

  /** Lowest ground height across a footprint so rocks never float on slopes. */
  private footprintBaseY(x: number, z: number, radius: number): number {
    return Math.min(
      volcanicGroundHeight(x, z),
      volcanicGroundHeight(x - radius, z),
      volcanicGroundHeight(x + radius, z),
      volcanicGroundHeight(x, z - radius),
      volcanicGroundHeight(x, z + radius)
    );
  }

  private spawnChunk(centerZ: number, graphicsConfig: GraphicsConfig): void {
    const seed = Math.abs(centerZ) * 67 + 91;
    const rnd = (offset = 0) => {
      const x = Math.sin(seed + offset) * 10000;
      return x - Math.floor(x);
    };
    const shadows = graphicsConfig.enableShadows;

    const spawnedMeshes: THREE.Mesh[] = [];
    const spawnedDecs: THREE.Object3D[] = [];

    // 1. Ground bed (flat y = -0.06 under the road slab) + lava channels
    if (this.highwayChunkGeom) {
      const ground = new THREE.Mesh(this.highwayChunkGeom, this.materials.obsidianGroundMaterial);
      ground.position.set(0, 0, centerZ);
      ground.receiveShadow = shadows;
      this.group.add(ground);
      spawnedMeshes.push(ground);
    }
    if (this.lavaRiverGeom) {
      const lava = new THREE.Mesh(this.lavaRiverGeom, this.materials.moltenLavaMaterial);
      lava.position.set(0, 0, centerZ);
      lava.receiveShadow = shadows;
      this.group.add(lava);
      spawnedMeshes.push(lava);
    }

    // 2. Basalt clusters, obsidian shards and crags: |x| in [16.5, 40]
    //    (max extent 8.2 m * 1.2 scale => nearest surface |x| >= 6.66)
    let rockDensity = 5;
    if (graphicsConfig.preset === 'mobile-opt') rockDensity = 3;
    if (graphicsConfig.preset === 'webgl-min') rockDensity = 2;

    for (let r = 0; r < rockDensity; r++) {
      const side = r % 2 === 0 ? -1 : 1;
      const posX = side * (BIG_ROCK_MIN_X + rnd(r * 4 + 1) * 23.5);
      const posZ = centerZ + (rnd(r * 4 + 2) - 0.5) * 50.0;

      const pick = rnd(r * 4 + 3);
      let archId = 'basalt-cluster';
      if (pick > 0.7) archId = 'obsidian-spire';
      else if (pick < 0.3) archId = 'jagged-rock';

      const geom = this.rockGeoms.get(archId);
      if (geom) {
        const isObsidian = archId === 'obsidian-spire';
        const rockMesh = new THREE.Mesh(
          geom,
          isObsidian ? this.materials.obsidianGlassMaterial : this.materials.volcanicRockMaterial
        );
        const scale = 0.85 + rnd(r * 4 + 5) * (ROCK_MAX_SCALE - 0.85);
        const reach = (ROCK_EXTENT[archId] ?? 8.2) * scale * 0.6;
        rockMesh.position.set(posX, this.footprintBaseY(posX, posZ, reach) - 0.6, posZ);
        rockMesh.rotation.y = rnd(r * 4 + 4) * Math.PI * 2;
        rockMesh.scale.set(scale, scale, scale);
        rockMesh.castShadow = shadows && Math.abs(posX) < 32;
        rockMesh.receiveShadow = shadows;
        this.group.add(rockMesh);
        spawnedMeshes.push(rockMesh);
      }
    }

    // 2b. Small scoria boulders on the ash shoulder: |x| in [8.0, 9.8], scale <= 0.22
    //     (extent 3.6 * 0.22 * 1.3 = 1.03 m + <= 0.4 m tilt lean => nearest surface |x| >= 6.5)
    let debrisCount = 3;
    if (graphicsConfig.preset === 'mobile-opt') debrisCount = 1;
    if (graphicsConfig.preset === 'webgl-min') debrisCount = 0;
    const crag = this.rockGeoms.get('jagged-rock');
    if (crag) {
      for (let d = 0; d < debrisCount; d++) {
        const side = rnd(40 + d * 3) > 0.5 ? 1 : -1;
        const s = 0.12 + rnd(41 + d * 3) * 0.1;
        const dx = side * (8.0 + rnd(42 + d * 3) * 1.8);
        const dz = centerZ + (rnd(43 + d * 7) - 0.5) * 56.0;
        const boulder = new THREE.Mesh(crag, this.materials.volcanicRockMaterial);
        boulder.position.set(dx, this.footprintBaseY(dx, dz, 0.6) - 0.15, dz);
        boulder.rotation.set(rnd(44 + d) * 0.15, rnd(45 + d) * Math.PI * 2, rnd(46 + d) * 0.15);
        boulder.scale.set(s * 1.3, s, s * 1.1);
        boulder.castShadow = shadows;
        boulder.receiveShadow = shadows;
        this.group.add(boulder);
        spawnedMeshes.push(boulder);
      }
    }

    // 3. Towering Horizon Caldera Volcano (distant flank/horizon, |x| >= 130)
    if (graphicsConfig.preset !== 'webgl-min' && rnd(10) > 0.5) {
      const cGeom = this.rockGeoms.get('caldera-peak');
      if (cGeom) {
        const volcano = new THREE.Mesh(cGeom, this.materials.ashSlopeMaterial);
        const sideSign = rnd(11) > 0.5 ? 1 : -1;
        const vX = sideSign * (130.0 + rnd(12) * 60.0);
        const vZ = centerZ + 180.0 + rnd(13) * 100.0;
        volcano.position.set(vX, -6.0, vZ);
        volcano.rotation.y = rnd(23) * Math.PI * 2;
        volcano.scale.set(1.4, 1.4, 1.4);
        this.group.add(volcano);
        spawnedMeshes.push(volcano);
      }
    }

    // 4. Basalt citadel on the ridge, to one side: |x| in [32, 52], gate facing the road.
    //    Rotated footprint half-depth 9.9 m (18 * 1.1 / 2) => nearest wall |x| >= 22.1.
    if (rnd(14) > 0.68) {
      const cSide = rnd(21) > 0.5 ? 1 : -1;
      const cx = cSide * (32 + rnd(22) * 20);
      const cz = centerZ + 16;
      const citadel = this.decorations.spawnCitadel(
        new THREE.Vector3(cx, this.footprintBaseY(cx, cz, 10) - 1.0, cz),
        1.1
      );
      citadel.rotation.y = -cSide * Math.PI * 0.5;
      spawnedDecs.push(citadel);
    } else if (rnd(15) > 0.45) {
      // Stone forge arch spanning the highway: pillar inner faces at |x| = 6.4,
      // lintel underside at y = 10.4
      const arch = this.decorations.spawnForgeArch(
        new THREE.Vector3(0, 0, centerZ + 10),
        1.0
      );
      spawnedDecs.push(arch);
    }

    // 5. Roadside fire bowls on the ash shoulder (|x| = 8.2, bowl radius 1.4 => >= 6.8)
    if (graphicsConfig.preset !== 'webgl-min' && rnd(16) > 0.35) {
      const bSide = rnd(17) > 0.5 ? 1 : -1;
      const bx = bSide * 8.2;
      const bz = centerZ + (rnd(18) - 0.5) * 15;
      const brazier = this.decorations.spawnBrazier(
        new THREE.Vector3(bx, volcanicGroundHeight(bx, bz) - 0.1, bz),
        1.0
      );
      spawnedDecs.push(brazier);
    }

    // 6. Lava falls pouring off a basalt cliff into the far side of the channel (|x| >= 17.3)
    if (graphicsConfig.preset === 'desktop-full' && rnd(19) > 0.5) {
      const fSide = rnd(20) > 0.5 ? 1 : -1;
      const fall = this.decorations.createMagmaFall(
        new THREE.Vector3(fSide * 17.4, -1.5, centerZ + (rnd(24) - 0.5) * 30),
        17.0,
        5.0
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
    if (this.lavaRiverGeom) {
      this.lavaRiverGeom.dispose();
      this.lavaRiverGeom = null;
    }

    // Dispose materials & textures
    this.materials.obsidianGroundMaterial.dispose();
    this.materials.volcanicRockMaterial.dispose();
    this.materials.obsidianGlassMaterial.dispose();
    this.materials.ashSlopeMaterial.dispose();
    this.materials.moltenLavaMaterial.dispose();
    this.materials.citadelIronMaterial.dispose();
    if (this.materials.noiseTexture) this.materials.noiseTexture.dispose();
    if (this.materials.lavaTexture) this.materials.lavaTexture.dispose();

    this.atmosphere.dispose();
    this.decorations.dispose();
  }
}
