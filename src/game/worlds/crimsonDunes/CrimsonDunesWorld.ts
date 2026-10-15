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
  desertGroundHeight,
} from './CrimsonDunesTerrain';
import { CrimsonDunesAtmosphere } from './CrimsonDunesAtmosphere';
import {
  buildDesertArchGeometries,
  buildObeliskGeometry,
  buildRuinPillarsGeometry,
  buildCactusGeometry,
  buildShrubGeometry,
} from './CrimsonDunesDecorations';
import { crimsonDunesConfig } from './crimsonDunesConfig';
import { StreamedWorld, StreamChunk, WarmTask } from '../shared/streamedWorld';
import { InstancePool, trs } from '../shared/instancePool';
import { createTerrainMaterial, TerrainMaterialHandle } from '../shared/terrainMaterial';
import { applyStreamFade, getWorldFade } from '../shared/distanceFade';
import { getGreyNoiseTexture } from '../shared/noiseTextures';
import { ENV_MODEL_HEIGHT, RockPools, applyEnvModels, createRockMaterials, createRockPools, rockTint } from '../shared/envRocks';
import { EnvModelId, getLoadedTextureSet } from '../../../graphics/assetLibrary';

/** Nothing solid may come closer to the road centre-line than this (metres). */
const ROAD_CLEAR_X = 6.0;
/** Extra margin kept between dune footprints and the road clearance zone. */
const DUNE_MARGIN_X = 2.0;
const GROUND_WIDTH = 160;
const CHUNK_LENGTH = 60;
const ROCK_IDS: readonly EnvModelId[] = ['block', 'boulder', 'slab'];
const DUNE_IDS = ['large-crescent', 'medium-dune', 'long-ridge'];

/** Pulse range for the bronze relic's faint glow. */
const RELIC_EMISSIVE_BASE = 0.3;
const RELIC_EMISSIVE_PULSE = 0.12;

interface CrimsonKit {
  ground: THREE.BufferGeometry;
  dunes: Map<string, THREE.BufferGeometry>;
  duneProfiles: Map<string, DuneProfile>;
  mesas: Map<string, THREE.BufferGeometry>;
  mesaProfiles: Map<string, MesaArchetype>;
  sand: TerrainMaterialHandle;
  mesa: TerrainMaterialHandle;
  mesaFar: TerrainMaterialHandle;
  stone: TerrainMaterialHandle;
  stoneRed: TerrainMaterialHandle;
  rockMats: Map<EnvModelId, TerrainMaterialHandle>;
  cactusMat: THREE.MeshStandardMaterial;
  scrubMat: THREE.MeshStandardMaterial;
  relicMat: THREE.MeshStandardMaterial;
  arch: { stone: THREE.BufferGeometry; red: THREE.BufferGeometry; relic: THREE.BufferGeometry };
  obelisk: THREE.BufferGeometry;
  pillars: THREE.BufferGeometry;
  cactus: THREE.BufferGeometry;
  shrub: THREE.BufferGeometry;
}
const K: Partial<CrimsonKit> = {};

const SAND = { tile: 9, tint: 0xf2c79a, normalScale: 0.9, roughness: [0.82, 1.0] as [number, number], fallback: 0xcfa872 };
const SANDSTONE = { tile: 13, tint: 0xf0b48e, normalScale: 1.1, roughness: [0.7, 0.98] as [number, number], fallback: 0xa8704c };

const KIT_STEPS: WarmTask[] = [
  () => void getGreyNoiseTexture(4242, 0.78, 4),
  () => {
    K.ground ??= createDesertHighwayChunkGeometry(GROUND_WIDTH, CHUNK_LENGTH, 80, 24, 555);
  },
  () => {
    if (K.dunes) return;
    const dunes = new Map<string, THREE.BufferGeometry>();
    const profiles = new Map<string, DuneProfile>();
    for (const p of DUNE_PROFILES) {
      if (!DUNE_IDS.includes(p.id)) continue;
      dunes.set(p.id, createProceduralDuneGeometry(p, 40, 48, 333));
      profiles.set(p.id, p);
    }
    K.duneProfiles = profiles;
    K.dunes = dunes;
  },
  () => {
    if (K.mesas) return;
    const mesas = new Map<string, THREE.BufferGeometry>();
    const profiles = new Map<string, MesaArchetype>();
    for (const m of MESA_ARCHETYPES) {
      mesas.set(m.id, createProceduralMesaGeometry(m, m.tier === 'horizon-monolith' ? 48 : 40, 444));
      profiles.set(m.id, m);
    }
    K.mesaProfiles = profiles;
    K.mesas = mesas;
  },
  () => {
    if (K.sand) return;
    const fade = getWorldFade('crimson-dunes');
    K.sand = createTerrainMaterial({
      name: 'crimson-sand',
      ground: SAND,
      vertexColors: true,
      vcRef: 0xcfa872,
      vcKeep: 0.65,
      roughness: 0.96,
      macro: 0.12,
      fade,
    });
    const mesaOpts = {
      ground: SAND,
      rock: SANDSTONE,
      slope: [0.72, 0.9] as [number, number],
      vertexColors: true,
      vcLuma: true,
      vcRef: 0xcfa872,
      vcRefRock: 0xa06b49,
      vcKeep: 0.45,
      fade,
    };
    K.mesa = createTerrainMaterial({ ...mesaOpts, name: 'crimson-mesa' });
    K.mesaFar = createTerrainMaterial({ ...mesaOpts, name: 'crimson-mesa-far', band: 'far' });
    K.stone = createTerrainMaterial({
      name: 'crimson-ruin-stone',
      rock: { tile: 6, tint: 0xf4dcc4, normalScale: 0.7, roughness: [0.7, 0.95], fallback: 0xa8907a },
      macro: 0.1,
      fade,
    });
    K.stoneRed = createTerrainMaterial({
      name: 'crimson-ruin-red',
      rock: { tile: 6, tint: 0xd89a7a, normalScale: 0.7, roughness: [0.7, 0.95], fallback: 0x8f5c42 },
      macro: 0.1,
      fade,
    });
    K.rockMats = createRockMaterials('crimson', ROCK_IDS, {
      ground: SAND,
      rock: { ...SANDSTONE, tile: 6, normalScale: 0.6 },
      slope: [0.82, 0.95],
      fade,
    });
    const noise = getGreyNoiseTexture(4242, 0.78, 4);
    K.cactusMat = applyStreamFade(new THREE.MeshStandardMaterial({ color: 0x4f5d36, roughness: 0.82, metalness: 0, map: noise }), fade);
    K.scrubMat = applyStreamFade(new THREE.MeshStandardMaterial({ color: 0x6b5a3a, roughness: 1, metalness: 0, map: noise }), fade);
    K.relicMat = applyStreamFade(
      new THREE.MeshStandardMaterial({
        color: 0xb08d57,
        emissive: 0xd97706,
        emissiveIntensity: RELIC_EMISSIVE_BASE,
        roughness: 0.4,
        metalness: 0.85,
      }),
      fade
    );
  },
  () => {
    K.arch ??= buildDesertArchGeometries();
  },
  () => {
    K.obelisk ??= buildObeliskGeometry();
    K.pillars ??= buildRuinPillarsGeometry();
  },
  () => {
    K.cactus ??= buildCactusGeometry();
  },
  () => {
    K.shrub ??= buildShrubGeometry();
  },
];

/**
 * CrimsonDunesWorld: rippled scanned sand, rolling barchan dunes and ridges,
 * layered sandstone mesas / buttes (scanned canyon rock, triplanar), scanned
 * sandstone boulders, rare monumental arches, obelisks, colonnades, saguaros
 * and dry scrub. Everything repeated is an instanced pool.
 */
export class CrimsonDunesWorld extends StreamedWorld {
  public config = crimsonDunesConfig;
  public atmosphere: CrimsonDunesAtmosphere | null = null;
  protected readonly chunkLength = CHUNK_LENGTH;

  private groundPool: InstancePool | null = null;
  private dunePools = new Map<string, InstancePool>();
  private buttePool: InstancePool | null = null;
  private monolithPool: InstancePool | null = null;
  private obeliskPool: InstancePool | null = null;
  private pillarsPool: InstancePool | null = null;
  private cactusPool: InstancePool | null = null;
  private shrubPool: InstancePool | null = null;
  private rockPools: RockPools | null = null;

  constructor(scene: THREE.Scene, graphicsConfig: GraphicsConfig) {
    super(scene, graphicsConfig, 'crimson-dunes', 'CrimsonDunesWorldRootGroup');
  }

  protected warmTasks(): WarmTask[] {
    return [
      ...KIT_STEPS,
      () => {
        this.atmosphere = new CrimsonDunesAtmosphere(this.group, this.graphicsConfig);
        this.atmosphere.group.visible = false;
      },
    ];
  }

  protected onKitReady(): void {
    const k = K as CrimsonKit;
    this.groundPool = this.addPool(new InstancePool('crimson-ground', k.ground, k.sand.material, 16));
    for (const id of DUNE_IDS) {
      const g = k.dunes.get(id)!;
      this.dunePools.set(id, this.addPool(new InstancePool(`crimson-dune-${id}`, g, k.sand.material, 24, { castShadow: id === 'large-crescent' })));
    }
    this.buttePool = this.addPool(new InstancePool('crimson-butte', k.mesas.get('flank-butte')!, k.mesa.material, 12, { castShadow: true }));
    this.monolithPool = this.addPool(new InstancePool('crimson-mesa', k.mesas.get('horizon-monolith')!, k.mesaFar.material, 12));
    this.obeliskPool = this.addPool(new InstancePool('crimson-obelisk', k.obelisk, [k.stone.material, k.stoneRed.material], 12, { castShadow: true }));
    this.pillarsPool = this.addPool(new InstancePool('crimson-pillars', k.pillars, k.stone.material, 12, { castShadow: true }));
    this.cactusPool = this.addPool(new InstancePool('crimson-cactus', k.cactus, k.cactusMat, 40, { castShadow: true }));
    this.shrubPool = this.addPool(new InstancePool('crimson-scrub', k.shrub, k.scrubMat, 60, { castShadow: true }));
    this.rockPools = createRockPools('crimson', ROCK_IDS, k.rockMats, 32, 32);
    for (const p of this.rockPools.near.values()) this.addPool(p);
    for (const p of this.rockPools.far.values()) this.addPool(p);
  }

  protected applyScannedAssets(): void {
    const k = K as CrimsonKit;
    const sand = getLoadedTextureSet('crimson-dunes/sand');
    const rock = getLoadedTextureSet('crimson-dunes/rock');
    k.sand.setGround(sand);
    for (const h of [k.mesa, k.mesaFar, ...k.rockMats.values()]) {
      h.setGround(sand);
      h.setRock(rock);
    }
    k.stone.setRock(rock);
    k.stoneRed.setRock(rock);
    if (this.rockPools) applyEnvModels(this.rockPools, k.rockMats);
  }

  protected spawnChunk(chunk: StreamChunk): void {
    const k = K as CrimsonKit;
    const centerZ = chunk.centerZ;
    const seed = Math.abs(centerZ) * 43 + 61;
    const rnd = (offset = 0) => {
      const x = Math.sin(seed + offset) * 10000;
      return x - Math.floor(x);
    };
    const preset = this.preset;
    const gy = (x: number, z: number) => desertGroundHeight(x, z - centerZ, CHUNK_LENGTH, 555);

    // 1. Ground bed (flat at y = -0.15 under the road for |x| <= 6, rising beyond)
    this.place(chunk, this.groundPool, trs(0, 0, centerZ, 0, 1));

    // 2. Flanking dunes, kept >= 8 m from the road axis (rotated half-extent)
    const sides: number[] = rnd(1) > 0.4 ? [-1, 1] : rnd(2) > 0.5 ? [-1] : [1];
    for (const sign of sides) {
      const duneType = rnd(3 + sign) > 0.6 ? 'large-crescent' : rnd(4 + sign) > 0.3 ? 'medium-dune' : 'long-ridge';
      const profile = k.duneProfiles.get(duneType)!;
      // Half the dunes turn their slip face (sharp crest, steep shaded face) toward the camera
      const rotY = (rnd(8 + sign) - 0.5) * 0.5 + (rnd(9 + sign * 3) > 0.5 ? Math.PI : 0);
      const halfX = Math.abs(Math.cos(rotY)) * profile.width * 0.5 + Math.abs(Math.sin(rotY)) * profile.length * 0.5;
      const halfZ = Math.abs(Math.sin(rotY)) * profile.width * 0.5 + Math.abs(Math.cos(rotY)) * profile.length * 0.5;
      const posX = sign * (ROAD_CLEAR_X + DUNE_MARGIN_X + halfX + rnd(5 + sign) * 18.0);
      const posZ = centerZ + (rnd(7 + sign) - 0.5) * 20.0;
      if (!this.inRange(posZ, halfZ * 0.8)) continue;
      this.place(chunk, this.dunePools.get(duneType) ?? null, trs(posX, -1.2 + rnd(6 + sign) * 0.6, posZ, rotY, 1));
    }

    // 3. Mesas: a wind-carved butte on a flank, or a far horizon mesa
    if (preset !== 'webgl-min' && rnd(9) > 0.5) {
      const isMonolith = rnd(10) > 0.5 && preset === 'desktop-full';
      const arch = k.mesaProfiles.get(isMonolith ? 'horizon-monolith' : 'flank-butte')!;
      const s = 1.2;
      const maxRadius = arch.radiusBase * MESA_MAX_RADIUS_FACTOR * s;
      const sideSign = rnd(11) > 0.5 ? 1 : -1;
      const x = sideSign * (isMonolith ? 140.0 + rnd(12) * 80.0 : maxRadius + 12.0 + rnd(12) * 30.0);
      const z = centerZ + (isMonolith ? 180.0 + rnd(13) * 100.0 : (rnd(13) - 0.5) * 35.0);
      if (this.inRange(z, maxRadius)) {
        this.place(chunk, isMonolith ? this.monolithPool : this.buttePool, trs(x, -4.0, z, rnd(23) * Math.PI * 2, s));
      }
    }

    // 4. Rare monumental arch over the road, else a roadside obelisk / colonnade
    if (rnd(14) > 0.9 && this.canSpanRoad(centerZ + 12)) {
      this.addObject(chunk, this.makeArch(centerZ + 12));
    } else if (rnd(15) > 0.45) {
      const side = rnd(16) > 0.5 ? 1 : -1;
      if (rnd(17) > 0.5) {
        if (this.inRange(centerZ, 2)) this.place(chunk, this.obeliskPool, trs(side * 8.8, gy(side * 8.8, centerZ) - 0.3, centerZ, 0, 1.1));
      } else if (this.inRange(centerZ - 6, 4)) {
        // Template extends toward +x; a half turn mirrors it for the left side
        this.place(chunk, this.pillarsPool, trs(side * 8.5, gy(side * 9.5, centerZ - 6) - 0.4, centerZ - 6, side < 0 ? Math.PI : 0, 0.95));
      }
    }

    // 5. Sparse desert flora: saguaros and scrub
    if (preset !== 'webgl-min') {
      const n = preset === 'desktop-full' ? 3 : 2;
      for (let i = 0; i < n; i++) {
        if (rnd(18 + i * 7) < 0.3) continue;
        const side = rnd(19 + i * 7) > 0.5 ? 1 : -1;
        const x = side * (9.2 + rnd(20 + i * 7) * 22);
        const z = centerZ + (rnd(21 + i * 7) - 0.5) * 50;
        if (!this.inRange(z, 2)) continue;
        if (i === 0 || rnd(22 + i * 7) > 0.55) {
          this.place(chunk, this.cactusPool, trs(x, gy(x, z) - 0.25, z, rnd(24 + i * 7) * 6.28, 0.8 + rnd(25 + i * 7) * 0.35));
        }
        const sx = -side * (9.5 + rnd(26 + i * 7) * 25);
        this.place(chunk, this.shrubPool, trs(sx, gy(sx, z + 7) - 0.12, z + 7, rnd(27 + i * 7) * 6.28, 0.8 + rnd(28 + i * 7) * 0.6));
      }
    }

    // 6. Scanned sandstone boulders: near the road (shadows) and out on the flats
    if (this.rockPools) {
      const n = preset === 'webgl-min' ? 1 : 3;
      for (let b = 0; b < n; b++) {
        if (rnd(70 + b) < 0.3) continue;
        const id = ROCK_IDS[Math.floor(rnd(71 + b) * ROCK_IDS.length) % ROCK_IDS.length];
        const far = b === 2;
        const s = far ? 2.5 + rnd(72 + b) * 4 : 0.7 + rnd(72 + b) * 1.6;
        const side = rnd(73 + b) > 0.5 ? 1 : -1;
        const x = side * (far ? 45 + rnd(74 + b) * 60 : 9 + s + rnd(74 + b) * 16);
        const z = centerZ + (rnd(75 + b) - 0.5) * 54;
        if (!this.inRange(z, s)) continue;
        const y = Math.min(gy(x, z), gy(x + s * 0.7, z), gy(x - s * 0.7, z)) - ENV_MODEL_HEIGHT[id] * s * 0.22;
        const pools = far ? this.rockPools.far : this.rockPools.near;
        this.place(chunk, pools.get(id) ?? null, trs(x, y, z, rnd(76 + b) * 6.28, s, s, s, (rnd(77 + b) - 0.5) * 0.12), rockTint(rnd(78 + b)));
      }
    }
  }

  private makeArch(z: number): THREE.Group {
    const k = K as CrimsonKit;
    const g = new THREE.Group();
    g.position.set(0, 0, z);
    const add = (geo: THREE.BufferGeometry, mat: THREE.Material) => {
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = true;
      m.receiveShadow = true;
      g.add(m);
    };
    add(k.arch.stone, k.stone.material);
    add(k.arch.red, k.stoneRed.material);
    add(k.arch.relic, k.relicMat);
    return g;
  }

  protected animate(playerZ: number, dt: number, time: number): void {
    const k = K as CrimsonKit;
    k.sand.tick(dt);
    k.mesa.tick(dt);
    k.mesaFar.tick(dt);
    k.stone.tick(dt);
    k.stoneRed.tick(dt);
    for (const h of k.rockMats.values()) h.tick(dt);
    k.relicMat.emissiveIntensity = RELIC_EMISSIVE_BASE + Math.sin(time * 1.2) * RELIC_EMISSIVE_PULSE;
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
    this.dunePools.clear();
    this.buttePool = null;
    this.monolithPool = null;
    this.obeliskPool = null;
    this.pillarsPool = null;
    this.cactusPool = null;
    this.shrubPool = null;
    this.rockPools = null;
  }
}
