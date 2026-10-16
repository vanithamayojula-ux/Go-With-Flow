import * as THREE from 'three';
import { GraphicsConfig } from '../../../types';
import { ISLAND_ARCHETYPES, createProceduralIslandGeometry, skyIslesCapHeight } from './SkyIslesTerrain';
import { SkyIslesAtmosphere } from './SkyIslesAtmosphere';
import {
  buildColonnadeGeometry,
  buildTempleGeometries,
  buildWaterfallGeometry,
  getWaterStreakTexture,
  WATERFALL_FOOT,
} from './SkyIslesDecorations';
import { BillboardCloudSet, createBillboardClouds } from './billboardClouds';
import { skyIslesConfig } from './skyIslesConfig';
import { TreeArchetype, createProceduralTreeGeometryGen, getLeafClusterTexture, getLeafMassTexture, buildLeafClusterTextureGen } from '../verdantWilds/VerdantWildsTerrain';
import { buildSpruceVariant } from '../crystalHeights/CrystalHeightsDecorations';
import { RAIL_X } from '../../trackConfig';
import { StreamedWorld, StreamChunk, WarmTask } from '../shared/streamedWorld';
import { InstancePool, PoolHandle, trs } from '../shared/instancePool';
import { createTerrainMaterial, TerrainMaterialHandle } from '../shared/terrainMaterial';
import { createScanStandardMaterial, ScanStandardHandle } from '../shared/scanMaterial';
import { applyStreamFade, getWorldFade } from '../shared/distanceFade';
import { getGreyNoiseTexture } from '../shared/noiseTextures';
import { ENV_MODEL_HEIGHT, RockPools, applyEnvModels, createRockMaterials, createRockPools, rockTint } from '../shared/envRocks';
import { EnvModelId, getLoadedTextureSet } from '../../../graphics/assetLibrary';

// Nearest X any scenery may reach: the guard rail plus a shoulder.
const ROAD_CLEARANCE_X = RAIL_X + 3.0;
const CHUNK = 60;
const ROCK_IDS: readonly EnvModelId[] = ['boulder', 'slab'];

/** Session-wide Sky Isles resources (built once in warmup slices, never disposed). */
interface SkyKit {
  islandGeoms: Map<string, THREE.BufferGeometry>;
  island: TerrainMaterialHandle;
  islandFar: TerrainMaterialHandle;
  stone: TerrainMaterialHandle;
  rockMats: Map<EnvModelId, TerrainMaterialHandle>;
  bark: ScanStandardHandle;
  crown: THREE.MeshStandardMaterial;
  leafCards: THREE.MeshStandardMaterial;
  needles: THREE.MeshStandardMaterial;
  broadleaf: THREE.BufferGeometry;
  conifer: THREE.BufferGeometry;
  colonnade: THREE.BufferGeometry;
  temple: { stone: THREE.BufferGeometry; roof: THREE.BufferGeometry; crystal: THREE.BufferGeometry };
  roof: THREE.MeshStandardMaterial;
  quartz: THREE.MeshPhysicalMaterial;
  water: THREE.MeshStandardMaterial;
  waterTex: THREE.CanvasTexture | null;
  waterfall: THREE.BufferGeometry;
}
const K: Partial<SkyKit> = {};

/** Island broadleaf: same generator as the Verdant forest, sized for the isles. */
const SKY_BROADLEAF: TreeArchetype = {
  id: 'sky-broadleaf',
  name: 'Sky Isles Broadleaf',
  tier: 'canopy',
  height: 8.5,
  trunkRadius: 0.5,
  crownRadius: 4.4,
  canopyClusters: 3,
};

const KIT_STEPS: WarmTask[] = [
  () => void getGreyNoiseTexture(1234, 0.72, 4),
  () => {
    if (K.islandGeoms) return;
    const m = new Map<string, THREE.BufferGeometry>();
    for (const arch of ISLAND_ARCHETYPES) {
      if (arch.id === 'traversal-highway') continue;
      const segs = arch.tier === 'distant' ? 12 : 20;
      const g = createProceduralIslandGeometry(arch.radiusTop, arch.depthRock, arch.heightGrass, segs, 0.35);
      g.clearGroups(); // one material (slope-blended turf / cliff) -> one draw
      m.set(arch.id, g);
    }
    K.islandGeoms = m;
  },
  () => {
    if (K.island) return;
    const fade = getWorldFade('sky-isles');
    const base = {
      ground: { tile: 5.5, tint: 0xd2dcb8, normalScale: 0.9, roughness: [0.7, 1.0] as [number, number], fallback: 0x5d7a38 },
      rock: { tile: 11, tint: 0xd8d0c4, normalScale: 1.1, roughness: [0.6, 0.98] as [number, number], fallback: 0x786e61 },
      slope: [0.42, 0.72] as [number, number],
      vertexColors: true,
      vcLuma: true,
      vcRef: 0x5d7a38,
      vcRefRock: 0x766c60,
      vcKeep: 0.55,
      fade,
    };
    K.island = createTerrainMaterial({ ...base, name: 'sky-island', band: 'near' });
    K.islandFar = createTerrainMaterial({ ...base, name: 'sky-island-far', band: 'far' });
    K.stone = createTerrainMaterial({
      name: 'sky-stone',
      rock: { tile: 6, tint: 0xe8e2d6, normalScale: 0.7, roughness: [0.65, 0.95], fallback: 0xa39b8e },
      macro: 0.1,
      fade,
    });
    K.rockMats = createRockMaterials('sky', ROCK_IDS, {
      ground: { tile: 5.5, tint: 0xd2dcb8, normalScale: 0.8, fallback: 0x5d7a38 },
      rock: { tile: 4, tint: 0xd8d0c4, normalScale: 0.6, fallback: 0x7d7468 },
      slope: [0.78, 0.95],
      fade,
    });
  },
  function* (): Generator<void, void> {
    if (K.broadleaf) return;
    K.broadleaf = yield* createProceduralTreeGeometryGen(SKY_BROADLEAF, 404, 3.2, 20);
  },
  () => {
    K.conifer ??= buildSpruceVariant(613, 7.6, 2.1, 0);
  },
  () => buildLeafClusterTextureGen(),
  () => {
    if (K.bark) return;
    const fade = getWorldFade('sky-isles');
    const noise = getGreyNoiseTexture(1234, 0.72, 4);
    K.bark = createScanStandardMaterial({ fallbackColor: 0x4a3a2a, fallbackMap: noise, scanTint: 0xb8a898, vertexColors: true, fade });
    K.crown = applyStreamFade(
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, map: getLeafMassTexture(), envMapIntensity: 0.1 }),
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
    K.needles = applyStreamFade(
      new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.9, metalness: 0, envMapIntensity: 0.5 }),
      fade
    );
    K.roof = applyStreamFade(new THREE.MeshStandardMaterial({ color: 0x5f8574, roughness: 0.75, metalness: 0.1, map: noise }), fade);
    // Clear quartz: opaque glossy dielectric, reflections do the work (no transmission pass)
    K.quartz = applyStreamFade(
      new THREE.MeshPhysicalMaterial({
        color: 0xdfeaf0,
        roughness: 0.08,
        metalness: 0,
        ior: 1.54,
        clearcoat: 1,
        clearcoatRoughness: 0.04,
        envMapIntensity: 1.4,
        flatShading: true,
      }),
      fade
    );
  },
  () => {
    if (K.colonnade) return;
    K.colonnade = buildColonnadeGeometry();
    K.temple = buildTempleGeometries();
    K.waterfall = buildWaterfallGeometry(34, 3.2);
    K.waterTex = getWaterStreakTexture();
    // Aerated falling water: white, fairly rough foam (not glass), vertex
    // alpha thins it into spray toward the foot
    K.water = applyStreamFade(
      new THREE.MeshStandardMaterial({
        color: 0xe8f0f2,
        roughness: 0.55,
        metalness: 0,
        // The texture is alpha data (G channel) only: no albedo map, so the
        // foam never picks up the R/B channels as a tint
        alphaMap: K.waterTex,
        vertexColors: true,
        transparent: true,
        opacity: K.waterTex ? 0.9 : 0.6,
        depthWrite: false,
        side: THREE.DoubleSide,
        emissive: 0x2c3438,
        envMapIntensity: 0.6,
      }),
      getWorldFade('sky-isles')
    );
  },
];

/** A temple's floating quartz: spun in place every frame (pool slot handle). */
interface SpinningCrystal {
  handle: PoolHandle;
  x: number;
  y: number;
  z: number;
  phase: number;
}

const TEMPLE_SCALE = 0.85;
const _tint = new THREE.Color();
const TEMPLE_CRYSTAL_Y = 4.5;

/**
 * SkyIslesWorld: floating turf-and-cliff islands (scanned turf / cliff
 * textures), trees, scanned boulders, a colonnade or temple on the largest
 * isles, waterfalls, and the cloud atmosphere. Islands, trees and rocks are
 * instanced pools recycled as 60 m chunks stream.
 */
export class SkyIslesWorld extends StreamedWorld {
  public config = skyIslesConfig;
  public atmosphere: SkyIslesAtmosphere | null = null;
  protected readonly chunkLength = CHUNK;

  private islandPools = new Map<string, InstancePool>();
  private treePools: { broadleaf: InstancePool | null; conifer: InstancePool | null } = { broadleaf: null, conifer: null };
  private rockPools: RockPools | null = null;
  // Landmarks and waterfalls are instanced too, so every draw configuration
  // is compiled and warm-drawn by the engine before the world is shown.
  private colonnadePool: InstancePool | null = null;
  private templePools: InstancePool[] = [];
  private templeCrystalPool: InstancePool | null = null;
  private waterfallPool: InstancePool | null = null;
  private crystals = new Map<PoolHandle, SpinningCrystal>();
  /** Spray puffs at waterfall feet (one camera-facing instanced draw). */
  private mist: BillboardCloudSet | null = null;
  private mistFree: number[] = [];
  private mistByHandle = new Map<PoolHandle, number>();
  /** Set once animate() has run (the world has been on screen). */
  private animated = false;

  constructor(scene: THREE.Scene, graphicsConfig: GraphicsConfig) {
    super(scene, graphicsConfig, 'sky-isles', 'SkyIslesWorldRootGroup');
  }

  protected warmTasks(): WarmTask[] {
    return [
      ...KIT_STEPS,
      () => {
        this.atmosphere = new SkyIslesAtmosphere(this.group, this.graphicsConfig);
      },
    ];
  }

  protected onKitReady(): void {
    const k = K as SkyKit;
    const islandCaps: Record<string, number> = {
      'large-sanctuary': 24,
      'medium-plateau': 24,
      'small-satellite': 24,
      'distant-monolith': 12,
    };
    for (const [id, cap] of Object.entries(islandCaps)) {
      const geo = k.islandGeoms.get(id);
      if (!geo) continue;
      const far = id === 'distant-monolith';
      const pool = new InstancePool(`sky-island-${id}`, geo, far ? k.islandFar.material : k.island.material, cap, {
        castShadow: id === 'large-sanctuary' || id === 'medium-plateau',
      });
      this.islandPools.set(id, this.addPool(pool));
    }
    this.treePools.broadleaf = this.addPool(
      new InstancePool('sky-broadleaf', k.broadleaf, [k.bark.material, k.crown, k.leafCards], 128, { castShadow: true, colors: true })
    );
    this.treePools.conifer = this.addPool(
      new InstancePool('sky-conifer', k.conifer, [k.bark.material, k.needles], 128, { castShadow: true, colors: true })
    );
    this.rockPools = createRockPools('sky', ROCK_IDS, k.rockMats, 48, 0);
    for (const p of this.rockPools.near.values()) this.addPool(p);
    this.colonnadePool = this.addPool(new InstancePool('sky-colonnade', k.colonnade, k.stone.material, 8, { castShadow: true }));
    this.templePools = [
      this.addPool(new InstancePool('sky-temple-stone', k.temple.stone, k.stone.material, 8, { castShadow: true })),
      this.addPool(new InstancePool('sky-temple-roof', k.temple.roof, k.roof, 8, { castShadow: true })),
    ];
    this.templeCrystalPool = this.addPool(new InstancePool('sky-temple-crystal', k.temple.crystal, k.quartz, 8));
    this.waterfallPool = this.addPool(new InstancePool('sky-waterfalls', k.waterfall, k.water, 16, { receiveShadow: false }));
    this.mist = createBillboardClouds(16, {
      litColor: 0xffffff,
      litIntensity: 3.0,
      shadowColor: 0xc4d0dc,
      shadowIntensity: 2.2,
      opacity: 0.6,
    });
    this.mist.mesh.name = 'sky-waterfall-mist';
    for (let i = 15; i >= 0; i--) {
      this.mist.setCloud(i, 0, -1e4, 0, 0, 0);
      this.mistFree.push(i);
    }
    this.mist.mesh.instanceMatrix.needsUpdate = true;
    this.group.add(this.mist.mesh);
  }

  protected applyScannedAssets(): void {
    const k = K as SkyKit;
    const turf = getLoadedTextureSet('sky-isles/turf');
    const cliff = getLoadedTextureSet('sky-isles/cliff');
    const bark = getLoadedTextureSet('shared/bark');
    for (const h of [k.island, k.islandFar]) {
      h.setGround(turf);
      h.setRock(cliff);
    }
    k.stone.setRock(cliff);
    for (const h of k.rockMats.values()) {
      h.setGround(turf);
      h.setRock(cliff);
    }
    if (bark) k.bark.apply(bark);
    if (this.rockPools) applyEnvModels(this.rockPools, k.rockMats);
    // Not drawn yet: show the scans from the first frame (no fallback fade-in)
    if (!this.animated) for (const h of [k.island, k.islandFar, k.stone, ...k.rockMats.values()]) h.snap();
  }

  protected spawnChunk(chunk: StreamChunk): void {
    const k = K as SkyKit;
    const centerZ = chunk.centerZ;
    const seed = Math.abs(centerZ) * 17 + 23;
    const rnd = (offset = 0) => {
      const x = Math.sin(seed + offset) * 10000;
      return x - Math.floor(x);
    };
    const preset = this.preset;

    const sides: Array<'left' | 'right'> = rnd(1) > 0.5 ? ['left', 'right'] : rnd(2) > 0.5 ? ['left'] : ['right'];
    for (const side of sides) {
      const salt = side === 'left' ? 0 : 50;
      const srnd = (offset: number) => rnd(offset + salt);
      const archId = srnd(3) > 0.6 ? 'large-sanctuary' : srnd(4) > 0.3 ? 'medium-plateau' : 'small-satellite';
      if (preset === 'webgl-min' && archId !== 'large-sanctuary' && side === 'right') continue;
      const arch = ISLAND_ARCHETYPES.find((a) => a.id === archId)!;
      const radius = arch.radiusTop;
      const heightGrass = arch.heightGrass;
      const sign = side === 'left' ? -1 : 1;
      // Keep the whole island (rim reaches ~1.12x radiusTop) clear of the road
      const posX = sign * (ROAD_CLEARANCE_X + radius * 1.25 + srnd(5) * 28.0);
      // Mostly below eye level so the turf tops (and their trees) read
      const posY = -7.0 + (srnd(6) - 0.5) * 10.0;
      const posZ = centerZ + (srnd(7) - 0.5) * 24.0;
      if (!this.inRange(posZ, radius * 1.15)) continue;
      const rotY = srnd(8) * Math.PI * 2;
      this.place(chunk, this.islandPools.get(archId) ?? null, trs(posX, posY, posZ, rotY, 1));

      // Waterfall off the road-facing rim of large islands
      if (archId === 'large-sanctuary' && preset !== 'webgl-min') {
        const fallRot = sign > 0 ? -Math.PI / 2 : Math.PI / 2;
        const fx = posX - sign * radius * 0.98;
        const fy = posY + heightGrass - 0.55;
        const fz = posZ + 2.0;
        if (this.place(chunk, this.waterfallPool, trs(fx, fy, fz, fallRot, 1))) {
          // Spray cloud where the fall dissolves (local +Z faces the road)
          const slot = this.mistFree.pop();
          if (slot !== undefined && this.mist) {
            this.mistByHandle.set(chunk.handles[chunk.handles.length - 1], slot);
            const mx = fx - sign * WATERFALL_FOOT.z;
            const w = 13 + srnd(30) * 6;
            this.mist.setCloud(slot, mx, fy + WATERFALL_FOOT.y, fz, w, w * 0.62);
            this.mist.mesh.instanceMatrix.needsUpdate = true;
          }
        }
      }

      // Landmark: stone colonnade or sky temple on the largest isles
      let hasLandmark = false;
      if (archId === 'large-sanctuary' && srnd(9) > 0.4) {
        hasLandmark = this.spawnLandmark(chunk, srnd(10) > 0.5 ? 'colonnade' : 'temple', posX, posY + heightGrass - 0.4, posZ, (srnd(13) - 0.5) * 0.6);
      }

      // Trees scattered over the turf
      if (preset !== 'webgl-min') {
        let treeCount =
          archId === 'large-sanctuary' ? 3 + Math.floor(srnd(11) * 3) :
          archId === 'medium-plateau' ? 1 + Math.floor(srnd(11) * 3) :
          srnd(11) > 0.5 ? 1 : 0;
        if (preset === 'mobile-opt') treeCount = Math.ceil(treeCount / 2);
        const minDist = hasLandmark ? radius * 0.5 : treeCount === 1 ? 0 : radius * 0.15;
        const maxDist = radius * 0.72;
        for (let t = 0; t < treeCount; t++) {
          const ang = srnd(20 + t * 3) * Math.PI * 2;
          const dist = minDist + srnd(21 + t * 3) * (maxDist - minDist);
          const tx = posX + Math.cos(ang) * dist;
          const tz = posZ + Math.sin(ang) * dist;
          const ty = posY + skyIslesCapHeight(heightGrass, radius, dist) - 0.15;
          const scale = 0.75 + srnd(22 + t * 3) * 0.5;
          const conifer = srnd(23 + t * 3) < 0.45;
          const sy = scale * (0.9 + srnd(24 + t * 3) * 0.25);
          const tk = 0.84 + srnd(26 + t * 3) * 0.26;
          const th = srnd(27 + t * 3) * 2 - 1;
          this.place(
            chunk,
            conifer ? this.treePools.conifer : this.treePools.broadleaf,
            trs(tx, ty, tz, srnd(25 + t * 3) * Math.PI * 2, scale, sy, scale),
            _tint.setRGB(tk * (1 + th * 0.06), tk, tk * (1 - th * 0.09))
          );
        }
      }

      // Scanned boulders bedded into the turf
      if (archId !== 'small-satellite' && this.rockPools) {
        const n = archId === 'large-sanctuary' ? 2 : 1;
        for (let b = 0; b < n; b++) {
          const id: EnvModelId = srnd(40 + b) > 0.55 ? 'slab' : 'boulder';
          const ang = srnd(41 + b * 2) * Math.PI * 2;
          const dist = radius * (0.35 + srnd(42 + b * 2) * 0.3);
          const bx = posX + Math.cos(ang) * dist;
          const bz = posZ + Math.sin(ang) * dist;
          const s = 0.9 + srnd(43 + b) * 1.1;
          const by = posY + skyIslesCapHeight(heightGrass, radius, dist) - ENV_MODEL_HEIGHT[id] * s * 0.25;
          this.place(chunk, this.rockPools.near.get(id) ?? null, trs(bx, by, bz, srnd(44 + b) * 6.28, s), rockTint(srnd(45 + b)));
        }
      }
    }

    // Distant horizon crag for atmospheric depth (far fade band)
    if (preset === 'desktop-full' && rnd(12) > 0.4) {
      const dX = (rnd(14) > 0.5 ? 1 : -1) * (80 + rnd(13) * 120);
      const dY = 10.0 + rnd(15) * 45.0;
      const dZ = centerZ + 180.0 + rnd(16) * 120.0;
      if (this.inRange(dZ, 16 * 1.5 * 1.15)) {
        this.place(chunk, this.islandPools.get('distant-monolith') ?? null, trs(dX, dY, dZ, rnd(17) * 6.28, 1.5));
      }
    }
  }

  private spawnLandmark(chunk: StreamChunk, type: 'colonnade' | 'temple', x: number, y: number, z: number, rotY: number): boolean {
    if (type === 'colonnade') return this.place(chunk, this.colonnadePool, trs(x, y, z, rotY, 1));
    if (!this.placeParts(chunk, this.templePools, trs(x, y, z, rotY, TEMPLE_SCALE))) return false;
    const cy = y + TEMPLE_CRYSTAL_Y * TEMPLE_SCALE;
    const pool = this.templeCrystalPool;
    const h = pool ? pool.add(trs(x, cy, z, rotY, TEMPLE_SCALE)) : null;
    if (h) {
      chunk.handles.push(h);
      this.crystals.set(h, { handle: h, x, y: cy, z, phase: rotY + this.crystals.size });
    }
    return true;
  }

  protected releaseChunk(chunk: StreamChunk): void {
    for (const h of chunk.handles) {
      this.crystals.delete(h);
      const slot = this.mistByHandle.get(h);
      if (slot !== undefined && this.mist) {
        this.mistByHandle.delete(h);
        this.mist.setCloud(slot, 0, -1e4, 0, 0, 0);
        this.mist.mesh.instanceMatrix.needsUpdate = true;
        this.mistFree.push(slot);
      }
    }
    super.releaseChunk(chunk);
  }

  protected animate(playerZ: number, dt: number, time: number): void {
    const k = K as SkyKit;
    this.animated = true;
    k.island.tick(dt);
    k.islandFar.tick(dt);
    k.stone.tick(dt);
    for (const h of k.rockMats.values()) h.tick(dt);
    if (this.atmosphere) {
      this.atmosphere.group.visible = this.playerInRange(playerZ);
      if (this.atmosphere.group.visible) this.atmosphere.update(dt, playerZ, time);
    }
    const spin = time * 0.3;
    const cp = this.templeCrystalPool;
    if (cp) for (const c of this.crystals.values()) cp.setMatrix(c.handle, trs(c.x, c.y, c.z, spin + c.phase, TEMPLE_SCALE));
    if (k.waterTex) k.waterTex.offset.y = (time * 1.1) % 1;
    if (this.mist) this.mist.mesh.visible = this.mistByHandle.size > 0;
  }

  protected disposeWorld(): void {
    this.crystals.clear();
    this.mist?.dispose();
    this.mist = null;
    this.mistFree = [];
    this.mistByHandle.clear();
    this.colonnadePool = null;
    this.templePools = [];
    this.templeCrystalPool = null;
    this.waterfallPool = null;
    this.atmosphere?.dispose();
    this.atmosphere = null;
    this.islandPools.clear();
    this.treePools = { broadleaf: null, conifer: null };
    this.rockPools = null;
  }
}
