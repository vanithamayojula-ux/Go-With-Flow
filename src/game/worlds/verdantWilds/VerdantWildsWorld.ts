import * as THREE from 'three';
import { GraphicsConfig } from '../../../types';
import {
  TREE_ARCHETYPES,
  TreeArchetype,
  createProceduralTreeGeometryGen,
  createForestFloorEmbankmentGeometry,
  sampleForestFloorHeight,
  getLeafClusterTexture,
  FOREST_DITCH_Y,
} from './VerdantWildsTerrain';
import { VerdantWildsAtmosphere } from './VerdantWildsAtmosphere';
import {
  buildRuinArchGeometries,
  buildRuinPillarGeometries,
  buildMushroomClusterGeometry,
  buildFernClumpGeometry,
  buildStreamRibbonGeometry,
} from './VerdantWildsDecorations';
import { verdantWildsConfig } from './verdantWildsConfig';
import { StreamedWorld, StreamChunk, WarmTask } from '../shared/streamedWorld';
import { InstancePool, trs } from '../shared/instancePool';
import { createTerrainMaterial, TerrainMaterialHandle } from '../shared/terrainMaterial';
import { createScanStandardMaterial, ScanStandardHandle } from '../shared/scanMaterial';
import { applyStreamFade, getWorldFade } from '../shared/distanceFade';
import { getGreyNoiseTexture } from '../shared/noiseTextures';
import { ENV_MODEL_HEIGHT, RockPools, applyEnvModels, createRockMaterials, createRockPools, rockTint } from '../shared/envRocks';
import { EnvModelId, getLoadedTextureSet } from '../../../graphics/assetLibrary';

const CHUNK_LENGTH = 60;
const GROUND_SEED = 77;
const GROUND_WIDTH = 140;
const ROCK_IDS: readonly EnvModelId[] = ['boulder', 'block', 'slab'];

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
const TREE_X_SPREAD = 20.0;

const _treeTint = new THREE.Color();
/** Per-tree tint: brightness and a slight yellow-green / blue-green drift. */
function treeTint(a: number, b: number): THREE.Color {
  const k = 0.84 + a * 0.26;
  const h = b * 2 - 1;
  return _treeTint.setRGB(k * (1 + h * 0.06), k, k * (1 - h * 0.09));
}

interface VerdantKit {
  treeGeoms: Map<string, THREE.BufferGeometry>;
  treeMinAbsX: Map<string, number>;
  ground: THREE.BufferGeometry;
  groundMat: TerrainMaterialHandle;
  stoneMat: TerrainMaterialHandle;
  rockMats: Map<EnvModelId, TerrainMaterialHandle>;
  bark: ScanStandardHandle;
  crown: THREE.MeshStandardMaterial;
  leafCards: THREE.MeshStandardMaterial;
  moss: THREE.MeshStandardMaterial;
  carving: THREE.MeshStandardMaterial;
  shroomMat: THREE.MeshStandardMaterial;
  fernMat: THREE.MeshStandardMaterial;
  water: THREE.MeshPhysicalMaterial;
  arch: { stone: THREE.BufferGeometry; carving: THREE.BufferGeometry; moss: THREE.BufferGeometry };
  pillar: { stone: THREE.BufferGeometry; moss: THREE.BufferGeometry };
  shrooms: THREE.BufferGeometry;
  ferns: THREE.BufferGeometry;
  stream: THREE.BufferGeometry;
}
const K: Partial<VerdantKit> = {};

/**
 * Horizontal reach of everything that can end up below y = 8 m at any tree
 * scale, turned into a minimum lateral offset from the road centre.
 */
function computeTreeMinAbsX(arch: TreeArchetype, geom: THREE.BufferGeometry): number {
  const pos = geom.attributes.position;
  const lowLimit = ROAD_CLEAR_Y / TREE_SCALE_MIN;
  let reach = 0;
  for (let i = 0; i < pos.count; i++) {
    if (pos.getY(i) < lowLimit) reach = Math.max(reach, Math.hypot(pos.getX(i), pos.getZ(i)));
  }
  const derived = ROAD_CLEAR_X + reach * TREE_SCALE_MAX + 0.5;
  return Math.max(TREE_MIN_ABS_X[arch.id] ?? derived, derived);
}

const KIT_STEPS: WarmTask[] = [
  // One resumable task per tree archetype (yields after every crown clump)
  ...TREE_ARCHETYPES.map((arch) => function* (): Generator<void, void> {
    K.treeGeoms ??= new Map();
    K.treeMinAbsX ??= new Map();
    if (K.treeGeoms.has(arch.id)) return;
    const g = yield* createProceduralTreeGeometryGen(arch, 202);
    K.treeGeoms.set(arch.id, g);
    K.treeMinAbsX.set(arch.id, computeTreeMinAbsX(arch, g));
  }),
  () => void getGreyNoiseTexture(1337, 0.66, 4),
  () => void getLeafClusterTexture(),
  () => {
    K.ground ??= createForestFloorEmbankmentGeometry(GROUND_WIDTH, CHUNK_LENGTH, 48, 24, GROUND_SEED);
  },
  () => {
    if (K.groundMat) return;
    const fade = getWorldFade('verdant-wilds');
    K.groundMat = createTerrainMaterial({
      name: 'verdant-floor',
      ground: { tile: 4.5, tint: 0xa6b67e, normalScale: 1.0, roughness: [0.88, 1.0] },
      rock: { tile: 7, tint: 0xc4c6b4, normalScale: 1.1, roughness: [0.75, 1.0] },
      slope: [0.9, 0.97],
      vertexColors: true,
      vcLuma: true,
      vcRef: 0x4a5129,
      vcRefRock: 0x4a5129,
      vcKeep: 0.55,
      roughness: 0.95,
      fade,
    });
    K.stoneMat = createTerrainMaterial({
      name: 'verdant-ruin-stone',
      ground: { tile: 4.5, tint: 0xb9b49a, fallback: 0x6e6a60 },
      rock: { tile: 5, tint: 0xd2d0c6, normalScale: 0.9, fallback: 0x6e6a60 },
      slope: [0.75, 0.92],
      macro: 0.12,
      fade,
    });
    K.rockMats = createRockMaterials('verdant', ROCK_IDS, {
      ground: { tile: 4.5, tint: 0xb9b49a, normalScale: 0.8, fallback: 0x55572f },
      rock: { tile: 4, tint: 0xd2d0c6, normalScale: 0.6, fallback: 0x6a6a5c },
      slope: [0.7, 0.9],
      fade,
    });
  },
  () => {
    if (K.bark) return;
    const fade = getWorldFade('verdant-wilds');
    const noise = getGreyNoiseTexture(1337, 0.66, 4);
    K.bark = createScanStandardMaterial({
      fallbackColor: 0x4f3e2d,
      fallbackMap: noise,
      scanTint: 0xa89c8e,
      vertexColors: true,
      roughness: 0.9,
      fade,
    });
    K.crown = applyStreamFade(
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, map: noise, envMapIntensity: 0.35 }),
      fade
    );
    const leafTex = getLeafClusterTexture();
    K.leafCards = applyStreamFade(
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        vertexColors: true,
        map: leafTex,
        // Low cut-off: mipmapped alpha thins out with distance, so a high
        // threshold would strip distant crowns down to their cores
        alphaTest: 0.3,
        roughness: 0.82,
        metalness: 0,
        envMapIntensity: 0.55,
        visible: !!leafTex,
      }),
      fade
    );
    K.moss = applyStreamFade(new THREE.MeshStandardMaterial({ color: 0x4b5a28, roughness: 0.95, metalness: 0, map: noise }), fade);
    K.carving = applyStreamFade(new THREE.MeshStandardMaterial({ color: 0x58594a, roughness: 0.95, metalness: 0, map: noise }), fade);
    K.shroomMat = applyStreamFade(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0 }), fade);
    K.fernMat = applyStreamFade(
      new THREE.MeshStandardMaterial({ color: 0x3f5a24, roughness: 0.85, metalness: 0, side: THREE.DoubleSide }),
      fade
    );
    // Shallow, slightly tea-stained forest stream
    K.water = applyStreamFade(
      // Dark, tannin-tinted water: mostly the forest and a dim sky reflected
      new THREE.MeshPhysicalMaterial({
        color: 0x141b12,
        roughness: 0.3,
        metalness: 0,
        ior: 1.33,
        transparent: true,
        opacity: 0.94,
        envMapIntensity: 0.22,
      }),
      fade
    );
  },
  () => {
    K.arch ??= buildRuinArchGeometries();
    K.pillar ??= buildRuinPillarGeometries();
  },
  () => {
    K.shrooms ??= buildMushroomClusterGeometry();
  },
  () => {
    K.ferns ??= buildFernClumpGeometry();
    K.stream ??= buildStreamRibbonGeometry(55, 2.4);
  },
];

/**
 * VerdantWildsWorld: scanned forest floor (leaf litter / soil) on a rolling
 * embankment, instanced broadleaf / ancient / slender trees with scanned bark,
 * scanned mossy boulders, mossy ruins, mushrooms, ferns and ditch streams.
 */
export class VerdantWildsWorld extends StreamedWorld {
  public config = verdantWildsConfig;
  public atmosphere: VerdantWildsAtmosphere | null = null;
  protected readonly chunkLength = CHUNK_LENGTH;

  private groundPool: InstancePool | null = null;
  private treePools = new Map<string, InstancePool>();
  /** Background stand (no shadows) further from the road. */
  private farTreePools = new Map<string, InstancePool>();
  private shroomPool: InstancePool | null = null;
  private fernPool: InstancePool | null = null;
  private rockPools: RockPools | null = null;
  // Ruins and streams are instanced too: every draw configuration exists (and
  // is compiled + warm-drawn by the engine) before the world is shown, so
  // nothing a chunk spawns later can hit a first-use shader compile.
  private archPools: InstancePool[] = [];
  private pillarPools: InstancePool[] = [];
  private streamPool: InstancePool | null = null;

  constructor(scene: THREE.Scene, graphicsConfig: GraphicsConfig) {
    super(scene, graphicsConfig, 'verdant-wilds', 'VerdantWildsWorldRootGroup');
  }

  protected warmTasks(): WarmTask[] {
    return [
      ...KIT_STEPS,
      () => {
        this.atmosphere = new VerdantWildsAtmosphere(this.group, this.graphicsConfig);
        this.atmosphere.group.visible = false;
      },
    ];
  }

  protected onKitReady(): void {
    const k = K as VerdantKit;
    this.groundPool = this.addPool(new InstancePool('verdant-ground', k.ground, k.groundMat.material, 16, { receiveShadow: true }));
    for (const arch of TREE_ARCHETYPES) {
      const g = k.treeGeoms.get(arch.id)!;
      this.treePools.set(
        arch.id,
        this.addPool(new InstancePool(`verdant-tree-${arch.id}`, g, [k.bark.material, k.crown, k.leafCards], 48, { castShadow: true, colors: true }))
      );
      this.farTreePools.set(
        arch.id,
        this.addPool(new InstancePool(`verdant-tree-far-${arch.id}`, g, [k.bark.material, k.crown, k.leafCards], 40, { colors: true }))
      );
    }
    this.shroomPool = this.addPool(new InstancePool('verdant-mushrooms', k.shrooms, k.shroomMat, 20, { castShadow: true }));
    this.fernPool = this.addPool(new InstancePool('verdant-ferns', k.ferns, k.fernMat, 20));
    this.rockPools = createRockPools('verdant', ROCK_IDS, k.rockMats, 40, 0);
    for (const p of this.rockPools.near.values()) this.addPool(p);
    const part = (name: string, g: THREE.BufferGeometry, m: THREE.Material, cap: number) =>
      this.addPool(new InstancePool(name, g, m, cap, { castShadow: true }));
    this.archPools = [
      part('verdant-arch-stone', k.arch.stone, k.stoneMat.material, 4),
      part('verdant-arch-carving', k.arch.carving, k.carving, 4),
      part('verdant-arch-moss', k.arch.moss, k.moss, 4),
    ];
    this.pillarPools = [
      part('verdant-pillar-stone', k.pillar.stone, k.stoneMat.material, 16),
      part('verdant-pillar-moss', k.pillar.moss, k.moss, 16),
    ];
    this.streamPool = this.addPool(new InstancePool('verdant-streams', k.stream, k.water, 12, { receiveShadow: true }));
  }

  protected applyScannedAssets(): void {
    const k = K as VerdantKit;
    const floor = getLoadedTextureSet('verdant-wilds/floor');
    const rock = getLoadedTextureSet('verdant-wilds/rock');
    const bark = getLoadedTextureSet('shared/bark');
    k.groundMat.setGround(floor);
    k.groundMat.setRock(rock);
    k.stoneMat.setGround(floor);
    k.stoneMat.setRock(rock);
    for (const h of k.rockMats.values()) {
      h.setGround(floor);
      h.setRock(rock);
    }
    if (bark) k.bark.apply(bark);
    if (this.rockPools) applyEnvModels(this.rockPools, k.rockMats);
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

  protected spawnChunk(chunk: StreamChunk): void {
    const k = K as VerdantKit;
    const centerZ = chunk.centerZ;
    const seed = Math.abs(centerZ) * 31 + 47;
    const rnd = (offset = 0) => {
      const x = Math.sin(seed + offset) * 10000;
      return x - Math.floor(x);
    };
    const preset = this.preset;

    // 1. Forest floor (bed at y = -0.08 under the road slab for |x| <= 5.5)
    this.place(chunk, this.groundPool, trs(0, 0, centerZ, 0, 1));

    // 2. Trees along the flanks
    let treeDensity = 4;
    if (preset === 'mobile-opt') treeDensity = 2;
    if (preset === 'webgl-min') treeDensity = 1;
    for (let t = 0; t < treeDensity; t++) {
      const side = t % 2 === 0 ? -1 : 1;
      const pick = rnd(t * 3 + 3);
      let archId = 'canopy-broadleaf';
      if (pick > 0.7) archId = 'ancient-greatwood';
      else if (pick < 0.25) archId = 'slender-willow';
      else if (pick < 0.3) archId = 'ancient-snag';
      const minAbsX = k.treeMinAbsX.get(archId) ?? 20;
      const posX = side * (minAbsX + rnd(t * 3 + 1) * TREE_X_SPREAD);
      const zLocal = (rnd(t * 3 + 2) - 0.5) * 45.0;
      if (!this.inRange(centerZ + zLocal, 4)) continue;
      const scale = TREE_SCALE_MIN + rnd(t * 3 + 5) * (TREE_SCALE_MAX - TREE_SCALE_MIN);
      // Taller-or-equal only (never lowers the crown toward the road corridor)
      const sy = scale * (1 + rnd(t * 3 + 40) * 0.14);
      this.place(
        chunk,
        this.treePools.get(archId) ?? null,
        trs(posX, this.groundUnder(posX, zLocal, 2.5 * scale) - 0.2, centerZ + zLocal, rnd(t * 3 + 4) * Math.PI * 2, scale, sy, scale),
        treeTint(rnd(t * 3 + 41), rnd(t * 3 + 42))
      );
    }

    // 2b. Background stand beyond the near trees (|x| 38..62), no shadows
    const farTrees = preset === 'desktop-full' ? 3 : preset === 'mobile-opt' ? 1 : 0;
    for (let t = 0; t < farTrees; t++) {
      const side = rnd(80 + t) > 0.5 ? 1 : -1;
      const pick = rnd(81 + t);
      const archId = pick > 0.6 ? 'ancient-greatwood' : pick > 0.2 ? 'canopy-broadleaf' : 'slender-willow';
      const posX = side * (38 + rnd(82 + t) * 24);
      const zLocal = (rnd(83 + t) - 0.5) * 56;
      if (!this.inRange(centerZ + zLocal, 4)) continue;
      const scale = 0.9 + rnd(84 + t) * 0.45;
      const sy = scale * (1 + rnd(86 + t) * 0.18);
      this.place(
        chunk,
        this.farTreePools.get(archId) ?? null,
        trs(posX, this.groundUnder(posX, zLocal, 2.5 * scale) - 0.3, centerZ + zLocal, rnd(85 + t) * Math.PI * 2, scale, sy, scale),
        treeTint(rnd(87 + t), rnd(88 + t))
      );
    }

    // 3. Mossy ruins: a rare arch over the road, or a broken column at |x| = 9
    if (rnd(10) > 0.9 && this.canSpanRoad(centerZ + 10)) {
      this.placeParts(chunk, this.archPools, trs(0, 0, centerZ + 10, 0, 1));
    } else if (rnd(11) > 0.55) {
      const side = rnd(12) > 0.5 ? 1 : -1;
      const px = side * 9.0;
      if (this.inRange(centerZ + 5, 2)) {
        this.placeParts(chunk, this.pillarPools, trs(px, this.groundUnder(px, 5, 1.6), centerZ + 5, rnd(26) * 6.28, 0.95));
      }
    }

    // 4. Mushrooms (|x| 13..17, growing outward) & ferns (|x| ~14)
    if (preset !== 'webgl-min') {
      const side = rnd(13) > 0.5 ? 1 : -1;
      const sx = side * 13.0;
      if (this.inRange(centerZ - 12, 4)) {
        const y = this.groundUnder(sx + side * 2, -12, 2) - 0.05;
        // Template grows toward +x; a half turn makes it grow toward -x
        this.place(chunk, this.shroomPool, trs(sx, y, centerZ - 12, side > 0 ? 0 : Math.PI, 1.1));
      }
      if (rnd(14) > 0.4 && this.inRange(centerZ + 15, 3)) {
        const fx = -side * 14.0;
        this.place(chunk, this.fernPool, trs(fx, this.groundUnder(fx, 15, 1.5) - 0.05, centerZ + 15, rnd(27) * 6.28, 1.0));
      }
    }

    // 5. Scanned mossy boulders on the banks (|x| 14..34)
    if (this.rockPools) {
      const n = preset === 'webgl-min' ? 1 : preset === 'mobile-opt' ? 2 : 3;
      for (let b = 0; b < n; b++) {
        if (rnd(60 + b) < 0.25) continue;
        const id = ROCK_IDS[Math.floor(rnd(61 + b) * ROCK_IDS.length) % ROCK_IDS.length];
        const s = 0.8 + rnd(62 + b) * (id === 'slab' ? 1.2 : 1.8);
        const side = rnd(63 + b) > 0.5 ? 1 : -1;
        const bx = side * (14 + s + rnd(64 + b) * 18);
        const zl = (rnd(65 + b) - 0.5) * 54;
        if (!this.inRange(centerZ + zl, s)) continue;
        const by = this.groundUnder(bx, zl, s * 0.8) - ENV_MODEL_HEIGHT[id] * s * 0.22;
        this.place(chunk, this.rockPools.near.get(id) ?? null, trs(bx, by, centerZ + zl, rnd(66 + b) * 6.28, s, s, s, (rnd(67 + b) - 0.5) * 0.15), rockTint(rnd(68 + b)));
      }
    }

    // 6. Stream in the flat-floored roadside ditch (|x| 8.7..12.3)
    if (preset === 'desktop-full' && rnd(15) > 0.55 && this.inRange(centerZ, 27.5)) {
      const streamSide = rnd(16) > 0.5 ? 1 : -1;
      this.place(chunk, this.streamPool, trs(streamSide * 10.5, FOREST_DITCH_Y + 0.04, centerZ, 0, 1));
    }
  }

  protected animate(playerZ: number, dt: number, time: number): void {
    const k = K as VerdantKit;
    k.groundMat.tick(dt);
    k.stoneMat.tick(dt);
    for (const h of k.rockMats.values()) h.tick(dt);
    if (this.atmosphere) {
      const on = this.playerInRange(playerZ);
      this.atmosphere.group.visible = on;
      if (on) this.atmosphere.update(dt, playerZ, time);
    }
  }

  protected disposeWorld(): void {
    this.atmosphere?.dispose();
    this.atmosphere = null;
    this.groundPool = null;
    this.treePools.clear();
    this.farTreePools.clear();
    this.shroomPool = null;
    this.fernPool = null;
    this.rockPools = null;
    this.archPools = [];
    this.pillarPools = [];
    this.streamPool = null;
  }
}
