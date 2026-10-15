import * as THREE from 'three';
import { GraphicsConfig } from '../../../types';
import {
  ISLAND_ARCHETYPES,
  FloatingIslandArchetype,
  createProceduralIslandGeometry,
  createSkyIslesIslandMaterials,
  skyIslesCapHeight,
} from './SkyIslesTerrain';
import { SkyIslesAtmosphere } from './SkyIslesAtmosphere';
import { SkyIslesDecorations } from './SkyIslesDecorations';
import { skyIslesConfig } from './skyIslesConfig';
import { RAIL_X } from '../../trackConfig';

// Nearest X any scenery may reach: the guard rail plus a shoulder.
const ROAD_CLEARANCE_X = RAIL_X + 3.0;

export interface ActiveIslandItem {
  id: string;
  mesh: THREE.Mesh;
  decorations: THREE.Object3D[];
  z: number;
  lodTier: 'high' | 'medium' | 'low';
}

/**
 * SkyIslesWorld integrates:
 * - Traversal and decorative floating island procedural generation
 * - Atmospheric cloud layers and sea-of-clouds
 * - Ancient portal arches, temples, waterfalls, and vegetation
 * - Graphics preset scaling & distance-based streaming
 */
export class SkyIslesWorld {
  public scene: THREE.Scene;
  public group: THREE.Group;
  public config = skyIslesConfig;

  // Sub-systems
  public atmosphere: SkyIslesAtmosphere;
  public decorations: SkyIslesDecorations;

  // Island Geometries & Materials Cache
  private islandGeoms: Map<string, THREE.BufferGeometry> = new Map();
  private materials: ReturnType<typeof createSkyIslesIslandMaterials>;
  // [turf cap, rock underside] matching the island geometry groups
  private islandMaterials: THREE.Material[];

  // Active spawned islands
  private activeIslands: ActiveIslandItem[] = [];
  private lastChunkZ = -999;

  constructor(scene: THREE.Scene, graphicsConfig: GraphicsConfig) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'SkyIslesWorldRootGroup';
    this.scene.add(this.group);

    this.materials = createSkyIslesIslandMaterials();
    this.islandMaterials = [this.materials.islandMaterial, this.materials.islandRockMaterial];
    this.initGeometries();

    this.atmosphere = new SkyIslesAtmosphere(this.scene, graphicsConfig);
    this.decorations = new SkyIslesDecorations(this.scene, this.materials.detailTexture);
  }

  private initGeometries(): void {
    // Generate archetypal island geometries for reuse across the world
    for (const arch of ISLAND_ARCHETYPES) {
      const segs = arch.tier === 'distant' ? 12 : 20;
      const geom = createProceduralIslandGeometry(
        arch.radiusTop,
        arch.depthRock,
        arch.heightGrass,
        segs,
        0.35
      );
      this.islandGeoms.set(arch.id, geom);
    }
  }

  /**
   * Procedural streaming along player traversal Z
   */
  public update(playerZ: number, dt: number, time: number, graphicsConfig: GraphicsConfig): void {
    const chunkZ = Math.floor(playerZ / 80);

    // Stream islands if player entered a new chunk band
    if (chunkZ !== this.lastChunkZ) {
      this.lastChunkZ = chunkZ;
      this.streamIslands(playerZ, graphicsConfig);
    }

    // Update animated systems
    this.atmosphere.update(dt, playerZ, time);
    this.decorations.update(time);
  }

  private streamIslands(playerZ: number, graphicsConfig: GraphicsConfig): void {
    // 1. Cull islands far behind or too far ahead
    const cullBehindZ = playerZ - 120;
    const cullAheadZ = playerZ + 480;

    for (let i = this.activeIslands.length - 1; i >= 0; i--) {
      const item = this.activeIslands[i];
      if (item.z < cullBehindZ || item.z > cullAheadZ) {
        this.group.remove(item.mesh);
        for (const dec of item.decorations) {
          this.decorations.removeObject(dec);
        }
        this.activeIslands.splice(i, 1);
      }
    }

    // 2. Generate islands in forward bands (120m to 420m ahead)
    const activeZCoords = new Set(this.activeIslands.map(isl => Math.round(isl.z / 60)));
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
        this.spawnIslandBand(band * 60, graphicsConfig);
      }
    }
  }

  private spawnIslandBand(centerZ: number, graphicsConfig: GraphicsConfig): void {
    // Deterministic pseudo-random seed based on band coordinate
    const seed = Math.abs(centerZ) * 17 + 23;
    const rnd = (offset = 0) => {
      const x = Math.sin(seed + offset) * 10000;
      return x - Math.floor(x);
    };

    // Determine counts scaled by GraphicsConfig preset
    let islandCount = 3;
    if (graphicsConfig.preset === 'mobile-opt') islandCount = 2;
    if (graphicsConfig.preset === 'webgl-min') islandCount = 1;

    // Spawn 1 Flank Island on Left and/or Right flank of the highway
    const sides: Array<'left' | 'right'> = rnd(1) > 0.5 ? ['left', 'right'] : (rnd(2) > 0.5 ? ['left'] : ['right']);

    for (const side of sides) {
      // Salt the right flank so both sides of a band don't mirror each other
      const salt = side === 'left' ? 0 : 50;
      const srnd = (offset: number) => rnd(offset + salt);
      const archId = srnd(3) > 0.6 ? 'large-sanctuary' : (srnd(4) > 0.3 ? 'medium-plateau' : 'small-satellite');
      const geom = this.islandGeoms.get(archId);
      if (!geom) continue;

      const mesh = new THREE.Mesh(geom, this.islandMaterials);
      mesh.receiveShadow = graphicsConfig.enableShadows;
      mesh.castShadow = graphicsConfig.enableShadows && archId !== 'small-satellite';

      const sign = side === 'left' ? -1 : 1;
      // Keep the whole island (rim noise reaches ~1.2x radiusTop) clear of the
      // road: the large isles used to overhang the lanes at the old 22 m offset.
      const arch = ISLAND_ARCHETYPES.find(a => a.id === archId);
      const radius = arch?.radiusTop ?? 18.0;
      const heightGrass = arch?.heightGrass ?? 3.0;
      const posX = sign * (ROAD_CLEARANCE_X + radius * 1.25 + srnd(5) * 28.0);
      const posY = -4.0 + (srnd(6) - 0.5) * 14.0;
      const posZ = centerZ + (srnd(7) - 0.5) * 24.0;

      mesh.position.set(posX, posY, posZ);
      mesh.rotation.y = srnd(8) * Math.PI * 2;
      this.group.add(mesh);

      const attachedDecs: THREE.Object3D[] = [];

      // Waterfall plunging off the road-facing rim of large islands. The sheet
      // hangs tangent to the rim and arcs outward ~2 m (towards the road, which
      // is still >= 11 m away at the lip).
      if (archId === 'large-sanctuary' && graphicsConfig.preset !== 'webgl-min') {
        const fallEdgePos = new THREE.Vector3(
          posX - sign * radius * 0.98,
          posY + heightGrass - 0.55,
          posZ + 2.0
        );
        const fall = this.decorations.createWaterfall(
          fallEdgePos,
          34.0,
          3.2,
          sign > 0 ? -Math.PI / 2 : Math.PI / 2
        );
        attachedDecs.push(fall);
      }

      // Add Landmark: Ancient Portal Arch or Sky Temple
      let hasLandmark = false;
      if (archId === 'large-sanctuary' && srnd(9) > 0.4) {
        const isArch = srnd(10) > 0.5;
        const lm = this.decorations.spawnLandmark(
          isArch ? 'arch' : 'temple',
          new THREE.Vector3(posX, posY + heightGrass - 0.4, posZ),
          isArch ? 1.0 : 0.85
        );
        attachedDecs.push(lm);
        hasLandmark = true;
      }

      // Trees scattered over the turf (halved on mobile, none on webgl-min)
      if (graphicsConfig.preset !== 'webgl-min') {
        let treeCount =
          archId === 'large-sanctuary' ? 3 + Math.floor(srnd(11) * 3) :
          archId === 'medium-plateau' ? 1 + Math.floor(srnd(11) * 3) :
          (srnd(11) > 0.5 ? 1 : 0);
        if (graphicsConfig.preset === 'mobile-opt') treeCount = Math.ceil(treeCount / 2);

        const minDist = hasLandmark ? radius * 0.5 : (treeCount === 1 ? 0 : radius * 0.15);
        const maxDist = radius * 0.72;
        for (let t = 0; t < treeCount; t++) {
          const ang = srnd(20 + t * 3) * Math.PI * 2;
          const dist = minDist + srnd(21 + t * 3) * (maxDist - minDist);
          const tx = posX + Math.cos(ang) * dist;
          const tz = posZ + Math.sin(ang) * dist;
          const ty = posY + skyIslesCapHeight(heightGrass, radius, dist) - 0.15;
          const scale = 0.85 + srnd(22 + t * 3) * 0.5;
          const tree = this.decorations.spawnTree(new THREE.Vector3(tx, ty, tz), scale);
          attachedDecs.push(tree);
        }
      }

      this.activeIslands.push({
        id: `island-${centerZ}-${side}`,
        mesh,
        decorations: attachedDecs,
        z: posZ,
        lodTier: 'high',
      });
    }

    // Spawn 1 Distant Horizon Monolith for atmospheric depth (if desktop)
    if (graphicsConfig.preset === 'desktop-full' && rnd(12) > 0.4) {
      const dGeom = this.islandGeoms.get('distant-monolith');
      if (dGeom) {
        const dMesh = new THREE.Mesh(dGeom, this.islandMaterials);
        // Always well to one side; the old spread could land it over the road.
        const dX = (rnd(14) > 0.5 ? 1 : -1) * (80 + rnd(13) * 120);
        const dY = 10.0 + rnd(15) * 45.0;
        const dZ = centerZ + 180.0 + rnd(16) * 120.0;
        dMesh.position.set(dX, dY, dZ);
        dMesh.scale.set(1.5, 1.5, 1.5);
        this.group.add(dMesh);

        this.activeIslands.push({
          id: `island-dist-${centerZ}`,
          mesh: dMesh,
          decorations: [],
          z: dZ,
          lodTier: 'low',
        });
      }
    }
  }

  public dispose(): void {
    this.scene.remove(this.group);
    for (const item of this.activeIslands) {
      this.group.remove(item.mesh);
    }
    this.activeIslands = [];

    // Dispose cached geometries
    for (const geom of this.islandGeoms.values()) {
      geom.dispose();
    }
    this.islandGeoms.clear();

    // Dispose materials
    this.materials.islandMaterial.dispose();
    this.materials.islandRockMaterial.dispose();
    this.materials.waterfallMaterial.dispose();
    this.materials.ancientStoneMaterial.dispose();
    this.materials.crystalBeaconMaterial.dispose();
    this.materials.detailTexture?.dispose();

    this.atmosphere.dispose();
    this.decorations.dispose();
  }
}
