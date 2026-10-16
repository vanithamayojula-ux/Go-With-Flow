import * as THREE from 'three';
import { GraphicsConfig } from '../../../types';
import {
  VOLCANIC_ARCHETYPES,
  createProceduralVolcanicRockGeometry,
  createVolcanicHighwayChunkGeometry,
  createLavaRiverGeometry,
  getVolcanicLavaTexture,
  buildVolcanicLavaTextureGen,
  OBSIDIAN_LAVA_EMISSIVE,
  volcanicGroundHeight,
} from './ObsidianCoreTerrain';
import { ObsidianCoreAtmosphere } from './ObsidianCoreAtmosphere';
import { buildCitadelGeometries, buildBrazierGeometries, buildForgeArchGeometry, buildMagmaFallGeometries } from './ObsidianCoreDecorations';
import { obsidianCoreConfig } from './obsidianCoreConfig';
import { StreamedWorld, StreamChunk, WarmTask } from '../shared/streamedWorld';
import { InstancePool, trs } from '../shared/instancePool';
import { createTerrainMaterial, TerrainMaterialHandle } from '../shared/terrainMaterial';
import { applyStreamFade, getWorldFade } from '../shared/distanceFade';
import { ENV_MODEL_HEIGHT, RockPools, applyEnvModels, createRockMaterials, createRockPools, rockTint } from '../shared/envRocks';
import { EnvModelId, getLoadedTextureSet } from '../../../graphics/assetLibrary';

/**
 * Horizontal extent (m, unscaled) of each procedural archetype around its
 * origin (incl. column tilt). Used to keep rocks clear of the road (|x| < 6).
 */
const ROCK_EXTENT: Record<string, number> = {
  'obsidian-spire': 7.7,
  'basalt-cluster': 8.2,
};
const ROCK_MAX_SCALE = 1.2;
/** Minimum |x| for big rocks: 6 + 8.2 * 1.2 = 15.84 -> 16.5 with margin. */
const BIG_ROCK_MIN_X = 16.5;
const CHUNK = 60;
const ROCK_IDS: readonly EnvModelId[] = ['shard', 'block', 'boulder'];
/** Lava glow cap (HDR); enough to bloom without blowing the frame out. */
const LAVA_MAX = 2.5;

interface ObsidianKit {
  ground: THREE.BufferGeometry;
  lavaRiver: THREE.BufferGeometry;
  columns: THREE.BufferGeometry;
  spire: THREE.BufferGeometry;
  volcano: THREE.BufferGeometry;
  citadel: { basalt: THREE.BufferGeometry; obsidian: THREE.BufferGeometry; molten: THREE.BufferGeometry };
  brazier: { stone: THREE.BufferGeometry; coals: THREE.BufferGeometry };
  forgeArch: THREE.BufferGeometry;
  fall: { sheet: THREE.BufferGeometry; cliff: THREE.BufferGeometry };
  groundMat: TerrainMaterialHandle;
  basaltCols: TerrainMaterialHandle;
  basalt: TerrainMaterialHandle;
  volcanoMat: TerrainMaterialHandle;
  rockMats: Map<EnvModelId, TerrainMaterialHandle>;
  obsidianGlass: THREE.MeshPhysicalMaterial;
  lava: THREE.MeshStandardMaterial;
  coreLava: THREE.MeshStandardMaterial;
  coals: THREE.MeshStandardMaterial;
  fallLava: THREE.MeshStandardMaterial;
  lavaTex: THREE.Texture | null;
  coreTex: THREE.Texture | null;
  fallTex: THREE.Texture | null;
}
const K: Partial<ObsidianKit> = {};

const ASH = { tile: 6, tint: 0x8c827c, normalScale: 1.0, roughness: [0.82, 1.0] as [number, number], fallback: 0x45413d };
const BASALT = { tile: 7, tint: 0x8a8582, normalScale: 1.2, roughness: [0.55, 0.95] as [number, number], fallback: 0x302d2b };
const LAVA = { color: 0xff5a1a, intensity: 2.2 };

const KIT_STEPS: WarmTask[] = [
  buildVolcanicLavaTextureGen,
  () => {
    K.ground ??= createVolcanicHighwayChunkGeometry(140, CHUNK, 14, 24, 999);
    K.lavaRiver ??= createLavaRiverGeometry(CHUNK, 8);
  },
  () => {
    if (K.columns) return;
    const get = (id: string) => createProceduralVolcanicRockGeometry(VOLCANIC_ARCHETYPES.find((a) => a.id === id)!, 888);
    K.columns = get('basalt-cluster');
    K.spire = get('obsidian-spire');
    K.volcano = get('caldera-peak');
  },
  () => {
    K.citadel ??= buildCitadelGeometries();
    K.brazier ??= buildBrazierGeometries();
    K.forgeArch ??= buildForgeArchGeometry();
    K.fall ??= buildMagmaFallGeometries(17.0, 5.0);
  },
  () => {
    if (K.groundMat) return;
    const fade = getWorldFade('obsidian-core');
    K.groundMat = createTerrainMaterial({
      name: 'obsidian-ground',
      ground: ASH,
      rock: BASALT,
      slope: [0.8, 0.93],
      vertexColors: true,
      vcRef: 0x3a3633,
      vcRefRock: 0x343130,
      vcKeep: 0.5,
      lava: LAVA,
      fade,
    });
    K.basaltCols = createTerrainMaterial({ name: 'obsidian-basalt-columns', rock: BASALT, flatShading: true, lava: LAVA, macro: 0.12, fade });
    K.basalt = createTerrainMaterial({ name: 'obsidian-basalt', rock: { ...BASALT, tile: 5 }, lava: LAVA, macro: 0.12, fade });
    K.volcanoMat = createTerrainMaterial({
      name: 'obsidian-volcano',
      ground: { ...ASH, tile: 20 },
      rock: { ...BASALT, tile: 26 },
      slope: [0.55, 0.8],
      vertexColors: true,
      vcLuma: true,
      vcRef: 0x4a4744,
      vcRefRock: 0x2b2a2a,
      vcKeep: 0.5,
      band: 'far',
      fade,
    });
    K.rockMats = createRockMaterials('obsidian', ROCK_IDS, {
      ground: ASH,
      rock: { ...BASALT, tile: 4, normalScale: 0.7 },
      slope: [0.82, 0.95],
      lava: LAVA,
      fade,
    });
    // Volcanic glass: near-black body that reads through glossy reflections
    K.obsidianGlass = applyStreamFade(
      new THREE.MeshPhysicalMaterial({
        vertexColors: true,
        roughness: 0.14,
        metalness: 0,
        flatShading: true,
        clearcoat: 1,
        clearcoatRoughness: 0.05,
        ior: 1.49,
        envMapIntensity: 1.8,
      }),
      fade
    );
    const lavaTex = getVolcanicLavaTexture();
    K.lavaTex = lavaTex;
    K.coreTex = lavaTex ? lavaTex.clone() : null;
    if (K.coreTex) K.coreTex.repeat.set(0.5, 0.5);
    K.fallTex = lavaTex ? lavaTex.clone() : null;
    if (K.fallTex) K.fallTex.repeat.set(0.6, 1.4);
    const lavaMat = (tex: THREE.Texture | null, emissive: number, intensity: number, side: THREE.Side = THREE.FrontSide) =>
      applyStreamFade(
        new THREE.MeshStandardMaterial({
          color: 0x2a0a00,
          emissive,
          emissiveIntensity: Math.min(LAVA_MAX, tex ? intensity : 1.6),
          emissiveMap: tex,
          roughness: 0.6,
          metalness: 0,
          side,
        }),
        fade
      );
    K.lava = lavaMat(lavaTex, 0xff4a10, OBSIDIAN_LAVA_EMISSIVE);
    K.coreLava = lavaMat(K.coreTex, 0xff4a10, 2.2);
    K.coals = lavaMat(K.coreTex, 0xff7a20, 2.4);
    K.fallLava = lavaMat(K.fallTex, 0xff5a14, 2.2, THREE.DoubleSide);
  },
];

/**
 * ObsidianCoreWorld: scanned ash ground and dark basalt (triplanar) with lava
 * glowing in the crevices, molten channels either side of the road, basalt
 * column clusters, obsidian glass spires, scanned volcanic boulders, distant
 * ash volcanoes, a basalt citadel, fire bowls, lava falls and rare forge
 * arches. Repeated scenery is instanced and recycled.
 */
export class ObsidianCoreWorld extends StreamedWorld {
  public config = obsidianCoreConfig;
  public atmosphere: ObsidianCoreAtmosphere | null = null;
  protected readonly chunkLength = CHUNK;

  private groundPool: InstancePool | null = null;
  private lavaPool: InstancePool | null = null;
  private columnsNear: InstancePool | null = null;
  private columnsFar: InstancePool | null = null;
  private spirePool: InstancePool | null = null;
  private volcanoPool: InstancePool | null = null;
  private brazierStone: InstancePool | null = null;
  private brazierCoals: InstancePool | null = null;
  private rockPools: RockPools | null = null;
  // Citadels, forge arches and lava falls are instanced too, so every draw
  // configuration is compiled and warm-drawn before the world is shown.
  private citadelPools: InstancePool[] = [];
  private forgeArchPool: InstancePool | null = null;
  private fallPools: InstancePool[] = [];

  constructor(scene: THREE.Scene, graphicsConfig: GraphicsConfig) {
    super(scene, graphicsConfig, 'obsidian-core', 'ObsidianCoreWorldRootGroup');
  }

  protected warmTasks(): WarmTask[] {
    return [
      ...KIT_STEPS,
      () => {
        this.atmosphere = new ObsidianCoreAtmosphere(this.group, this.graphicsConfig);
        this.atmosphere.group.visible = false;
      },
    ];
  }

  protected onKitReady(): void {
    const k = K as ObsidianKit;
    this.groundPool = this.addPool(new InstancePool('obsidian-ground', k.ground, k.groundMat.material, 16));
    this.lavaPool = this.addPool(new InstancePool('obsidian-lava', k.lavaRiver, k.lava, 16));
    this.columnsNear = this.addPool(new InstancePool('obsidian-columns-near', k.columns, k.basaltCols.material, 48, { castShadow: true }));
    this.columnsFar = this.addPool(new InstancePool('obsidian-columns-far', k.columns, k.basaltCols.material, 48));
    this.spirePool = this.addPool(new InstancePool('obsidian-spires', k.spire, k.obsidianGlass, 32));
    this.volcanoPool = this.addPool(new InstancePool('obsidian-volcanoes', k.volcano, k.volcanoMat.material, 12));
    this.brazierStone = this.addPool(new InstancePool('obsidian-brazier', k.brazier.stone, k.basalt.material, 16, { castShadow: true }));
    this.brazierCoals = this.addPool(new InstancePool('obsidian-coals', k.brazier.coals, k.coals, 16));
    this.rockPools = createRockPools('obsidian', ROCK_IDS, k.rockMats, 48, 32);
    for (const p of this.rockPools.near.values()) this.addPool(p);
    for (const p of this.rockPools.far.values()) this.addPool(p);
    this.citadelPools = [
      this.addPool(new InstancePool('obsidian-citadel-basalt', k.citadel.basalt, k.basalt.material, 6, { castShadow: true })),
      this.addPool(new InstancePool('obsidian-citadel-glass', k.citadel.obsidian, k.obsidianGlass, 6, { castShadow: true })),
      this.addPool(new InstancePool('obsidian-citadel-molten', k.citadel.molten, k.coreLava, 6)),
    ];
    this.forgeArchPool = this.addPool(new InstancePool('obsidian-forge-arch', k.forgeArch, k.basalt.material, 4, { castShadow: true }));
    this.fallPools = [
      this.addPool(new InstancePool('obsidian-fall-sheet', k.fall.sheet, k.fallLava, 12)),
      this.addPool(new InstancePool('obsidian-fall-cliff', k.fall.cliff, k.basalt.material, 12, { castShadow: true })),
    ];
  }

  protected applyScannedAssets(): void {
    const k = K as ObsidianKit;
    const ground = getLoadedTextureSet('obsidian-core/ground');
    const rock = getLoadedTextureSet('obsidian-core/rock');
    for (const h of [k.groundMat, k.basaltCols, k.basalt, k.volcanoMat, ...k.rockMats.values()]) {
      h.setGround(ground);
      h.setRock(rock);
    }
    if (this.rockPools) applyEnvModels(this.rockPools, k.rockMats);
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

  protected spawnChunk(chunk: StreamChunk): void {
    const k = K as ObsidianKit;
    const centerZ = chunk.centerZ;
    const seed = Math.abs(centerZ) * 67 + 91;
    const rnd = (offset = 0) => {
      const x = Math.sin(seed + offset) * 10000;
      return x - Math.floor(x);
    };
    const preset = this.preset;

    // 1. Ground bed + lava channels (flat y = -0.06 under the road slab)
    this.place(chunk, this.groundPool, trs(0, 0, centerZ, 0, 1));
    this.place(chunk, this.lavaPool, trs(0, 0, centerZ, 0, 1));

    // 2. Basalt column clusters and obsidian spires: |x| in [16.5, 40]
    let rockDensity = 4;
    if (preset === 'mobile-opt') rockDensity = 3;
    if (preset === 'webgl-min') rockDensity = 2;
    for (let r = 0; r < rockDensity; r++) {
      const side = r % 2 === 0 ? -1 : 1;
      const posX = side * (BIG_ROCK_MIN_X + rnd(r * 4 + 1) * 23.5);
      const posZ = centerZ + (rnd(r * 4 + 2) - 0.5) * 50.0;
      const spire = rnd(r * 4 + 3) > 0.72;
      const archId = spire ? 'obsidian-spire' : 'basalt-cluster';
      const scale = 0.85 + rnd(r * 4 + 5) * (ROCK_MAX_SCALE - 0.85);
      const reach = (ROCK_EXTENT[archId] ?? 8.2) * scale * 0.6;
      if (!this.inRange(posZ, reach)) continue;
      // Obsidian shards stay well below the old 38 m needles; columns keep their own profile
      const sy = spire ? scale * (0.42 + rnd(r * 4 + 6) * 0.3) : scale * (0.85 + rnd(r * 4 + 6) * 0.3);
      const m = trs(posX, this.footprintBaseY(posX, posZ, reach) - 0.6, posZ, rnd(r * 4 + 4) * Math.PI * 2, scale, sy, scale);
      if (spire) this.place(chunk, this.spirePool, m);
      else this.place(chunk, Math.abs(posX) < 32 ? this.columnsNear : this.columnsFar, m);
    }

    // 2b. Scanned volcanic boulders: on the ash shoulder (|x| 7.5..9.5, small)
    //     and out on the ridges (large)
    if (this.rockPools) {
      const near = preset === 'webgl-min' ? 1 : preset === 'mobile-opt' ? 2 : 3;
      for (let d = 0; d < near; d++) {
        const id: EnvModelId = rnd(40 + d * 3) > 0.5 ? 'block' : 'shard';
        const side = rnd(41 + d * 3) > 0.5 ? 1 : -1;
        const s = 0.35 + rnd(42 + d * 3) * 0.45;
        const dx = side * (7.6 + s + rnd(43 + d * 3) * 1.2);
        const dz = centerZ + (rnd(44 + d * 7) - 0.5) * 56.0;
        if (!this.inRange(dz, s)) continue;
        this.place(
          chunk,
          this.rockPools.near.get(id) ?? null,
          trs(dx, this.footprintBaseY(dx, dz, s) - ENV_MODEL_HEIGHT[id] * s * 0.2, dz, rnd(45 + d) * 6.28, s, s, s, (rnd(46 + d) - 0.5) * 0.2),
          rockTint(rnd(47 + d))
        );
      }
      const far = preset === 'desktop-full' ? 3 : 1;
      for (let d = 0; d < far; d++) {
        const id = ROCK_IDS[Math.floor(rnd(50 + d) * ROCK_IDS.length) % ROCK_IDS.length];
        const side = rnd(51 + d) > 0.5 ? 1 : -1;
        const s = 2.5 + rnd(52 + d) * 5.5;
        const x = side * (22 + s + rnd(53 + d) * 40);
        const z = centerZ + (rnd(54 + d) - 0.5) * 56;
        if (!this.inRange(z, s)) continue;
        const pools = Math.abs(x) < 34 ? this.rockPools.near : this.rockPools.far;
        this.place(
          chunk,
          pools.get(id) ?? null,
          trs(x, this.footprintBaseY(x, z, s) - ENV_MODEL_HEIGHT[id] * s * 0.25, z, rnd(55 + d) * 6.28, s, s * (id === 'shard' ? 1.6 : 1), s),
          rockTint(rnd(56 + d), 0.1)
        );
      }
    }

    // 3. Distant ash volcano (|x| >= 130, far fade band)
    if (preset !== 'webgl-min' && rnd(10) > 0.5) {
      const vX = (rnd(11) > 0.5 ? 1 : -1) * (130.0 + rnd(12) * 60.0);
      const vZ = centerZ + 180.0 + rnd(13) * 100.0;
      if (this.inRange(vZ, 45 * 1.4)) this.place(chunk, this.volcanoPool, trs(vX, -6.0, vZ, rnd(23) * Math.PI * 2, 1.4));
    }

    // 4. Basalt citadel on the ridge (|x| in [32, 52], gate facing the road),
    //    else a rare forge arch over the road
    if (rnd(14) > 0.7 && this.inRange(centerZ + 16, 12)) {
      const cSide = rnd(21) > 0.5 ? 1 : -1;
      const cx = cSide * (32 + rnd(22) * 20);
      const cz = centerZ + 16;
      // A ruined fortress hunkered on the ridge (lower than a skyline of towers)
      this.placeParts(chunk, this.citadelPools, trs(cx, this.footprintBaseY(cx, cz, 10) - 1.0, cz, -cSide * Math.PI * 0.5, 1.0, 0.72, 1.0));
    } else if (rnd(15) > 0.85 && this.canSpanRoad(centerZ + 10)) {
      this.place(chunk, this.forgeArchPool, trs(0, 0, centerZ + 10, 0, 1));
    }

    // 5. Roadside fire bowls on the ash shoulder (|x| = 8.2, bowl radius 1.4)
    if (preset !== 'webgl-min' && rnd(16) > 0.35) {
      const bSide = rnd(17) > 0.5 ? 1 : -1;
      const bx = bSide * 8.2;
      const bz = centerZ + (rnd(18) - 0.5) * 15;
      if (this.inRange(bz, 2)) {
        const m = trs(bx, volcanicGroundHeight(bx, bz) - 0.1, bz, rnd(19) * 6.28, 1);
        this.place(chunk, this.brazierStone, m);
        this.place(chunk, this.brazierCoals, m);
      }
    }

    // 6. Lava falls pouring off a basalt cliff into the far side of the channel (|x| >= 17.3)
    if (preset === 'desktop-full' && rnd(19) > 0.5) {
      const fSide = rnd(20) > 0.5 ? 1 : -1;
      const fz = centerZ + (rnd(24) - 0.5) * 30;
      if (this.inRange(fz, 5)) {
        // Sheet front faces the road; the cliff shares the sheet's frame
        this.placeParts(chunk, this.fallPools, trs(fSide * 17.4, -1.5, fz, -fSide * Math.PI * 0.5, 1));
      }
    }
  }

  protected animate(playerZ: number, dt: number, time: number): void {
    const k = K as ObsidianKit;
    // Slow breathing heat on every lava surface (kept <= 2.5)
    const breath = 1 + Math.sin(time * 0.6) * 0.09 + Math.sin(time * 2.3) * 0.03;
    for (const h of [k.groundMat, k.basaltCols, k.basalt, k.volcanoMat]) {
      h.tick(dt);
      h.lavaPulse.value = breath;
    }
    for (const h of k.rockMats.values()) {
      h.tick(dt);
      h.lavaPulse.value = breath;
    }
    k.lava.emissiveIntensity = Math.min(LAVA_MAX, (k.lavaTex ? OBSIDIAN_LAVA_EMISSIVE : 1.6) * breath);
    k.coreLava.emissiveIntensity = Math.min(LAVA_MAX, 2.1 + Math.sin(time * 1.5) * 0.25);
    k.coals.emissiveIntensity = Math.min(LAVA_MAX, 2.2 + Math.sin(time * 9.0) * 0.18 + Math.sin(time * 13.7 + 1.3) * 0.1);
    if (k.lavaTex) k.lavaTex.offset.y = (time * 0.012) % 1;
    if (k.fallTex) k.fallTex.offset.y = (time * 0.35) % 1;
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
    this.lavaPool = null;
    this.columnsNear = null;
    this.columnsFar = null;
    this.spirePool = null;
    this.volcanoPool = null;
    this.brazierStone = null;
    this.brazierCoals = null;
    this.rockPools = null;
    this.citadelPools = [];
    this.forgeArchPool = null;
    this.fallPools = [];
  }
}
