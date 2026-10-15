import * as THREE from 'three';
import { GraphicsConfig } from '../../../types';
import {
  TREE_ARCHETYPES,
  TreeArchetype,
  createProceduralTreeGeometry,
  createForestFloorEmbankmentGeometry,
  createVerdantWildsMaterials,
  sampleForestFloorHeight,
  FOREST_DITCH_Y,
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

const CHUNK_LENGTH = 60;
const GROUND_SEED = 77;

// Road clearance: nothing solid in |x| < ROAD_CLEAR_X below y = ROAD_CLEAR_Y
const ROAD_CLEAR_X = 6.0;
const ROAD_CLEAR_Y = 8.0;
const TREE_SCALE_MIN = 0.85;
const TREE_SCALE_MAX = 1.25;

/** Minimum |x| per tree type (floors; geometry-derived reach can raise them). */
const TREE_MIN_ABS_X: Record<string, number> = {
  'ancient-greatwood': 20.0,
  'canopy-broadleaf': 14.0,
  'slender-willow': 13.5, // also keeps trunks out of the 8.5..12.5 m ditch
  'ancient-snag': 14.0,
};
const TREE_X_SPREAD = 15.0;

/**
 * VerdantWildsWorld coordinates:
 * - Procedural forest floor (hidden road bed, verge, roadside ditch, rolling bank)
 * - Streamed broadleaf / ancient / slender trees with smooth leafy crowns
 * - Light atmosphere (sunlit pollen motes, soft sun shafts)
 * - Mossy stone ruins, natural mushrooms, ferns and ditch streams
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
  /** Minimum |x| for each archetype so trunks/roots stay clear of the road. */
  private treeMinAbsX: Map<string, number> = new Map();
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
    this.decorations = new VerdantWildsDecorations(this.scene, this.materials.noiseTexture);
  }

  private initGeometries(): void {
    for (const arch of TREE_ARCHETYPES) {
      const geom = createProceduralTreeGeometry(arch, 202);
      this.treeGeoms.set(arch.id, geom);
      this.treeMinAbsX.set(arch.id, this.computeTreeMinAbsX(arch, geom));
    }

    // Standard 60 m forest floor chunk (70 m wide)
    this.groundGeom = createForestFloorEmbankmentGeometry(70, CHUNK_LENGTH, 30, 24, GROUND_SEED);
  }

  /**
   * Horizontal reach of everything that can end up below y = 8 m at any tree
   * scale, turned into a minimum lateral offset from the road centre.
   */
  private computeTreeMinAbsX(arch: TreeArchetype, geom: THREE.BufferGeometry): number {
    const pos = geom.attributes.position;
    const lowLimit = ROAD_CLEAR_Y / TREE_SCALE_MIN;
    let reach = 0;
    for (let i = 0; i < pos.count; i++) {
      if (pos.getY(i) < lowLimit) {
        reach = Math.max(reach, Math.hypot(pos.getX(i), pos.getZ(i)));
      }
    }
    const derived = ROAD_CLEAR_X + reach * TREE_SCALE_MAX + 0.5;
    return Math.max(TREE_MIN_ABS_X[arch.id] ?? derived, derived);
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
    const activeZCoords = new Set(this.activeChunks.map(c => Math.round(c.z / CHUNK_LENGTH)));
    const base = Math.floor(playerZ / CHUNK_LENGTH);
    for (let b = 0; b <= 5; b++) { // include the band under the player (ground at portal entry)
      const band = base + b;
      if (!activeZCoords.has(band)) {
        this.spawnChunk(band * CHUNK_LENGTH, graphicsConfig);
      }
    }
  }

  /** Lowest ground height under a footprint, so props never float on slopes. */
  private groundUnder(x: number, zLocal: number, radius: number): number {
    let h = sampleForestFloorHeight(x, zLocal, CHUNK_LENGTH, GROUND_SEED);
    h = Math.min(h, sampleForestFloorHeight(x + radius, zLocal, CHUNK_LENGTH, GROUND_SEED));
    h = Math.min(h, sampleForestFloorHeight(x - radius, zLocal, CHUNK_LENGTH, GROUND_SEED));
    h = Math.min(h, sampleForestFloorHeight(x, zLocal + radius, CHUNK_LENGTH, GROUND_SEED));
    h = Math.min(h, sampleForestFloorHeight(x, zLocal - radius, CHUNK_LENGTH, GROUND_SEED));
    return h;
  }

  private spawnChunk(centerZ: number, graphicsConfig: GraphicsConfig): void {
    const seed = Math.abs(centerZ) * 31 + 47;
    const rnd = (offset = 0) => {
      const x = Math.sin(seed + offset) * 10000;
      return x - Math.floor(x);
    };
    const shadows = graphicsConfig.enableShadows;

    const spawnedMeshes: THREE.Mesh[] = [];
    const spawnedDecs: THREE.Object3D[] = [];

    // 1. Forest floor (bed at y = -0.08 under the road slab for |x| <= 5.5)
    if (this.groundGeom) {
      const ground = new THREE.Mesh(this.groundGeom, this.materials.forestFloorMaterial);
      ground.position.set(0, 0, centerZ);
      ground.receiveShadow = shadows;
      this.group.add(ground);
      spawnedMeshes.push(ground);
    }

    // 2. Trees along the flanks. Minimum |x| per type: ancient >= 20,
    //    broadleaf >= 14, slender >= 13.5 (raised further if the geometry's
    //    low reach demands it); spread +0..15 m outward.
    let treeDensity = 4;
    if (graphicsConfig.preset === 'mobile-opt') treeDensity = 2;
    if (graphicsConfig.preset === 'webgl-min') treeDensity = 1;

    for (let t = 0; t < treeDensity; t++) {
      const side = t % 2 === 0 ? -1 : 1;

      const pick = rnd(t * 3 + 3);
      let archId = 'canopy-broadleaf';
      if (pick > 0.7) archId = 'ancient-greatwood';
      else if (pick < 0.25) archId = 'slender-willow';

      const geom = this.treeGeoms.get(archId);
      if (!geom) continue;

      const minAbsX = this.treeMinAbsX.get(archId) ?? 20;
      const posX = side * (minAbsX + rnd(t * 3 + 1) * TREE_X_SPREAD);
      const zLocal = (rnd(t * 3 + 2) - 0.5) * 45.0;
      const scale = TREE_SCALE_MIN + rnd(t * 3 + 5) * (TREE_SCALE_MAX - TREE_SCALE_MIN);

      const tree = new THREE.Mesh(geom, [this.materials.treeMaterial, this.materials.leafCardMaterial]);
      tree.position.set(posX, this.groundUnder(posX, zLocal, 2.5 * scale) - 0.2, centerZ + zLocal);
      tree.rotation.y = rnd(t * 3 + 4) * Math.PI * 2;
      tree.scale.set(scale, scale, scale);
      tree.castShadow = shadows;
      tree.receiveShadow = shadows;
      this.group.add(tree);
      spawnedMeshes.push(tree);
    }

    // 3. Mossy ruins: arch over the road (pillars' inner faces at |x| = 6.4,
    //    lintel underside at y = 11) or a broken column at |x| = 9.
    if (rnd(10) > 0.65) {
      const arch = this.decorations.spawnRuinArch(new THREE.Vector3(0, 0, centerZ + 10), 1.0);
      spawnedDecs.push(arch);
    } else if (rnd(11) > 0.5) {
      const side = rnd(12) > 0.5 ? 1 : -1;
      const px = side * 9.0;
      const pillar = this.decorations.spawnRuinPillar(
        new THREE.Vector3(px, this.groundUnder(px, 5, 1.6), centerZ + 5),
        0.95
      );
      spawnedDecs.push(pillar);
    }

    // 4. Mushrooms (|x| 13..17, mirrored to grow outward) & ferns (|x| ~14)
    if (graphicsConfig.preset !== 'webgl-min') {
      const shroomSide = rnd(13) > 0.5 ? 1 : -1;
      const sx = shroomSide * 13.0;
      const shrooms = this.decorations.spawnMushrooms(
        new THREE.Vector3(sx, this.groundUnder(sx + shroomSide * 2, -12, 2) - 0.05, centerZ - 12),
        1.1
      );
      spawnedDecs.push(shrooms);

      if (rnd(14) > 0.4) {
        const fx = -shroomSide * 14.0;
        const ferns = this.decorations.spawnFerns(
          new THREE.Vector3(fx, this.groundUnder(fx, 15, 1.5) - 0.05, centerZ + 15),
          1.0
        );
        spawnedDecs.push(ferns);
      }
    }

    // 5. Stream in the flat-floored roadside ditch (|x| 8.7..12.3)
    if (graphicsConfig.preset === 'desktop-full' && rnd(15) > 0.55) {
      const streamSide = rnd(16) > 0.5 ? 1 : -1;
      const stream = this.decorations.createStreamRibbon(
        new THREE.Vector3(streamSide * 10.5, FOREST_DITCH_Y + 0.04, centerZ),
        55,
        2.4
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
    this.treeMinAbsX.clear();

    if (this.groundGeom) {
      this.groundGeom.dispose();
      this.groundGeom = null;
    }

    // Dispose materials & textures
    this.materials.forestFloorMaterial.dispose();
    this.materials.treeMaterial.dispose();
    this.materials.leafCardMaterial.dispose();
    this.materials.leafTexture?.dispose();
    this.materials.streamWaterMaterial.dispose();
    if (this.materials.noiseTexture) this.materials.noiseTexture.dispose();

    this.atmosphere.dispose();
    this.decorations.dispose();
  }
}
