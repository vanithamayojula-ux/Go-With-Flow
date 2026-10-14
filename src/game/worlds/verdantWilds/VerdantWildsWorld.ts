import * as THREE from 'three';
import { GraphicsConfig } from '../../../types';
import {
  TREE_ARCHETYPES,
  TreeArchetype,
  createProceduralTreeGeometry,
  createForestFloorEmbankmentGeometry,
  createVerdantWildsMaterials,
} from './VerdantWildsTerrain';
import { VerdantWildsAtmosphere } from './VerdantWildsAtmosphere';
import { VerdantWildsDecorations } from './VerdantWildsDecorations';
import { verdantWildsConfig } from './verdantWildsConfig';

export interface ActiveForestChunkItem {
  id: string;
  z: number;
  meshes: THREE.Mesh[];
  decorations: THREE.Object3D[];
}

/**
 * VerdantWildsWorld coordinates:
 * - Procedural forest floor embankments and road paths
 * - Instanced and streamed tree canopies (Ancient Greatwoods, Broadleafs, Willows)
 * - Atmospheric firefly swarms, canopy mist, and sun shafts
 * - Ancient mossy ruin arches, broken pillars, bioluminescent mushrooms, and water streams
 * - Chunk-based streaming & Graphics quality presets
 */
export class VerdantWildsWorld {
  public scene: THREE.Scene;
  public group: THREE.Group;
  public config = verdantWildsConfig;

  // Subsystems
  public atmosphere: VerdantWildsAtmosphere;
  public decorations: VerdantWildsDecorations;

  // Shared Geometries & Materials
  private treeGeoms: Map<string, THREE.BufferGeometry> = new Map();
  private groundGeom: THREE.BufferGeometry | null = null;
  private materials: ReturnType<typeof createVerdantWildsMaterials>;

  // Active streamed chunks
  private activeChunks: ActiveForestChunkItem[] = [];
  private lastChunkZ = -999;

  constructor(scene: THREE.Scene, graphicsConfig: GraphicsConfig) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'VerdantWildsWorldRootGroup';
    this.scene.add(this.group);

    this.materials = createVerdantWildsMaterials();
    this.initGeometries();

    this.atmosphere = new VerdantWildsAtmosphere(this.scene, graphicsConfig);
    this.decorations = new VerdantWildsDecorations(this.scene);
  }

  private initGeometries(): void {
    // Generate tree archetypes for instanced/reusable placement
    for (const arch of TREE_ARCHETYPES) {
      const geom = createProceduralTreeGeometry(arch, 202);
      this.treeGeoms.set(arch.id, geom);
    }

    // Standard 60m ground embankment chunk, widened to 140m for panoramic forest coverage
    this.groundGeom = createForestFloorEmbankmentGeometry(140, 60, 20, 16, 77);
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
    const cullAheadZ = playerZ + 420;

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
    ];

    for (const band of targetBands) {
      if (!activeZCoords.has(band)) {
        this.spawnChunk(band * 60, graphicsConfig);
      }
    }
  }

  private spawnChunk(centerZ: number, graphicsConfig: GraphicsConfig): void {
    const seed = Math.abs(centerZ) * 31 + 47;
    const rnd = (offset = 0) => {
      const x = Math.sin(seed + offset) * 10000;
      return x - Math.floor(x);
    };

    const spawnedMeshes: THREE.Mesh[] = [];
    const spawnedDecs: THREE.Object3D[] = [];

    // 1. Forest Floor Ground Embankment
    if (this.groundGeom) {
      const ground = new THREE.Mesh(this.groundGeom, this.materials.forestFloorMaterial);
      ground.position.set(0, 0, centerZ);
      ground.receiveShadow = graphicsConfig.enableShadows;
      this.group.add(ground);
      spawnedMeshes.push(ground);
    }

    // 2. Forest Trees along flanks (Midground & Distant Layers, outside |X| >= 11.5)
    let treeDensity = 6;
    if (graphicsConfig.preset === 'mobile-opt') treeDensity = 4;
    if (graphicsConfig.preset === 'webgl-min') treeDensity = 2;

    for (let t = 0; t < treeDensity; t++) {
      const side = t % 2 === 0 ? -1 : 1;
      const isDistant = t >= 4;
      
      const posX = isDistant
        ? side * (45.0 + rnd(t * 3 + 1) * 65.0)
        : side * (12.5 + rnd(t * 3 + 1) * 16.0);
      const posZ = isDistant
        ? centerZ + 60.0 + rnd(t * 3 + 2) * 120.0
        : centerZ + (rnd(t * 3 + 2) - 0.5) * 48.0;

      // Select archetype
      const pick = rnd(t * 3 + 3);
      let archId = 'canopy-broadleaf';
      if (pick > 0.55 || isDistant) archId = 'ancient-greatwood';
      else if (pick < 0.25) archId = 'slender-willow';

      const geom = this.treeGeoms.get(archId);
      if (geom) {
        const tree = new THREE.Mesh(geom, this.materials.treeMaterial);
        tree.position.set(posX, 0, posZ);
        tree.rotation.y = rnd(t * 3 + 4) * Math.PI * 2;
        const scale = isDistant
          ? 1.8 + rnd(t * 3 + 5) * 1.2
          : 0.95 + rnd(t * 3 + 5) * 0.45;
        tree.scale.set(scale, scale, scale);
        tree.castShadow = graphicsConfig.enableShadows && !isDistant;
        tree.receiveShadow = graphicsConfig.enableShadows;
        this.group.add(tree);
        spawnedMeshes.push(tree);
      }
    }

    // 3. Ancient Mossy Ruins Landmarks
    // Guarantee grand arch bridging across the highway every ~120m (even chunks)
    const chunkIdx = Math.abs(Math.round(centerZ / 60));
    if (chunkIdx % 2 === 0) {
      // Grand Ancient Mossy Arch spanning the highway
      const arch = this.decorations.spawnRuinArch(new THREE.Vector3(0, 0, centerZ + 10), 1.05);
      spawnedDecs.push(arch);
    } else {
      // Flanking broken pillars on alternate chunks
      const side = rnd(12) > 0.5 ? 1 : -1;
      const pillar = this.decorations.spawnRuinPillar(
        new THREE.Vector3(side * 8.2, 0, centerZ + (rnd(13) - 0.5) * 20),
        1.1
      );
      spawnedDecs.push(pillar);
    }

    // 4. Bioluminescent Mushrooms & Ferns along roadside shoulders (Foreground Layer)
    if (graphicsConfig.preset !== 'webgl-min') {
      const shroomSide = rnd(14) > 0.5 ? 1 : -1;
      const shrooms = this.decorations.spawnMushrooms(
        new THREE.Vector3(shroomSide * 7.2, 0, centerZ - 8),
        1.2
      );
      spawnedDecs.push(shrooms);

      const ferns1 = this.decorations.spawnFerns(
        new THREE.Vector3(-shroomSide * 7.5, 0, centerZ + 12),
        1.1
      );
      spawnedDecs.push(ferns1);

      if (graphicsConfig.preset === 'desktop-full') {
        const ferns2 = this.decorations.spawnFerns(
          new THREE.Vector3(shroomSide * 8.5, 0, centerZ + 22),
          0.9
        );
        spawnedDecs.push(ferns2);
      }
    }

    // 5. Roadside Forest Stream Channel
    if (graphicsConfig.preset === 'desktop-full' && rnd(15) > 0.45) {
      const streamSide = rnd(16) > 0.5 ? 1 : -1;
      const stream = this.decorations.createStreamRibbon(
        new THREE.Vector3(streamSide * 9.8, 0.05, centerZ),
        55,
        2.8
      );
      spawnedDecs.push(stream);
    }

    this.activeChunks.push({
      id: `forest-chunk-${centerZ}`,
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

    // Dispose geometries
    for (const geom of this.treeGeoms.values()) {
      geom.dispose();
    }
    this.treeGeoms.clear();

    if (this.groundGeom) {
      this.groundGeom.dispose();
      this.groundGeom = null;
    }

    // Dispose materials
    this.materials.forestFloorMaterial.dispose();
    this.materials.treeMaterial.dispose();
    this.materials.streamWaterMaterial.dispose();

    this.atmosphere.dispose();
    this.decorations.dispose();
  }
}
