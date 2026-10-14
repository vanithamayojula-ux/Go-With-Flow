import * as THREE from 'three';
import { GraphicsConfig } from '../../../types';
import {
  ISLAND_ARCHETYPES,
  FloatingIslandArchetype,
  createProceduralIslandGeometry,
  createSkyIslesIslandMaterials,
} from './SkyIslesTerrain';
import { SkyIslesAtmosphere } from './SkyIslesAtmosphere';
import { SkyIslesDecorations } from './SkyIslesDecorations';
import { skyIslesConfig } from './skyIslesConfig';

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

  // Active spawned islands
  private activeIslands: ActiveIslandItem[] = [];
  private lastChunkZ = -999;

  constructor(scene: THREE.Scene, graphicsConfig: GraphicsConfig) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'SkyIslesWorldRootGroup';
    this.scene.add(this.group);

    this.materials = createSkyIslesIslandMaterials();
    this.initGeometries();

    this.atmosphere = new SkyIslesAtmosphere(this.scene, graphicsConfig);
    this.decorations = new SkyIslesDecorations(this.scene);
  }

  private initGeometries(): void {
    // Generate archetypal island geometries for reuse across the world
    for (const arch of ISLAND_ARCHETYPES) {
      const segs = arch.tier === 'distant' ? 10 : 16;
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

    // 1. Landmark: Grand Monumental Highway Sky Arch spanning over the road
    if (Math.abs(Math.round(centerZ / 60)) % 2 === 0) {
      const arch = this.decorations.spawnLandmark('arch', new THREE.Vector3(0, 0, centerZ + 12), 1.0);
      this.activeIslands.push({
        id: `sky-arch-${centerZ}`,
        mesh: new THREE.Mesh(), // dummy mesh reference for group
        decorations: [arch],
        z: centerZ + 12,
        lodTier: 'high',
      });
    }

    // 2. Spawn Floating Islands on Flanks of the Highway
    const sides: Array<'left' | 'right'> = ['left', 'right'];

    for (const side of sides) {
      const archId = rnd(3) > 0.5 ? 'large-sanctuary' : (rnd(4) > 0.3 ? 'medium-plateau' : 'small-satellite');
      const geom = this.islandGeoms.get(archId);
      if (!geom) continue;

      const mesh = new THREE.Mesh(geom, this.materials.islandMaterial);
      mesh.receiveShadow = graphicsConfig.enableShadows;
      mesh.castShadow = graphicsConfig.enableShadows && archId !== 'small-satellite';

      const sign = side === 'left' ? -1 : 1;
      const posX = sign * (18.0 + rnd(5) * 22.0);
      const posY = -2.0 + (rnd(6) - 0.5) * 8.0;
      const posZ = centerZ + (rnd(7) - 0.5) * 24.0;

      mesh.position.set(posX, posY, posZ);
      mesh.rotation.y = rnd(8) * Math.PI * 2;
      this.group.add(mesh);

      const attachedDecs: THREE.Object3D[] = [];

      // Add cascading waterfalls pouring off large sanctuary islands down into the cloud sea
      if (archId === 'large-sanctuary' && graphicsConfig.preset !== 'webgl-min') {
        const fallEdgePos = new THREE.Vector3(posX - sign * 6.5, posY + 2.0, posZ + 1.0);
        const fall = this.decorations.createWaterfall(fallEdgePos, 32.0, 3.8);
        attachedDecs.push(fall);
      }

      // Add Sky Temple Shrines on sanctuary islands
      if (archId === 'large-sanctuary' && rnd(9) > 0.35) {
        const temple = this.decorations.spawnLandmark(
          'temple',
          new THREE.Vector3(posX, posY + 3.2, posZ),
          1.0
        );
        attachedDecs.push(temple);
      } else if (rnd(11) > 0.4 && graphicsConfig.preset !== 'webgl-min') {
        // Add stylized cloud bonsai tree
        const tree = this.decorations.spawnTree(new THREE.Vector3(posX, posY + 2.6, posZ), 1.2);
        attachedDecs.push(tree);
      }

      this.activeIslands.push({
        id: `island-${centerZ}-${side}`,
        mesh,
        decorations: attachedDecs,
        z: posZ,
        lodTier: 'high',
      });
    }

    // 3. Spawn Monumental Distant Horizon Sky Island (Layered distant silhouette)
    if (graphicsConfig.preset !== 'webgl-min' && rnd(12) > 0.3) {
      const dGeom = this.islandGeoms.get('distant-monolith');
      if (dGeom) {
        const dMesh = new THREE.Mesh(dGeom, this.materials.islandMaterial);
        const dSign = rnd(14) > 0.5 ? 1 : -1;
        const dX = dSign * (70.0 + rnd(13) * 70.0);
        const dY = 12.0 + rnd(15) * 35.0;
        const dZ = centerZ + 180.0 + rnd(16) * 110.0;
        dMesh.position.set(dX, dY, dZ);
        const dScale = 2.4 + rnd(17) * 1.2;
        dMesh.scale.set(dScale, dScale, dScale);
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
    this.materials.waterfallMaterial.dispose();
    this.materials.ancientStoneMaterial.dispose();
    this.materials.crystalBeaconMaterial.dispose();

    this.atmosphere.dispose();
    this.decorations.dispose();
  }
}
