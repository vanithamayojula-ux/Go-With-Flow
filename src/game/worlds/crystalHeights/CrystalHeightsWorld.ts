import * as THREE from 'three';
import { GraphicsConfig } from '../../../types';
import {
  CRYSTAL_ARCHETYPES,
  CRYSTAL_HEIGHTS_CHUNK_LENGTH,
  createProceduralCrystalGeometry,
  createCelestialHighwayChunkGeometry,
  createAlpinePeakGeometry,
  crystalHeightsGroundHeight,
  getGeometryHorizontalRadius,
} from './CrystalHeightsTerrain';
import { CrystalHeightsAtmosphere } from './CrystalHeightsAtmosphere';
import { buildGateGeometries, buildQuartzGeometry, buildSpruceGeometries } from './CrystalHeightsDecorations';
import { crystalHeightsConfig } from './crystalHeightsConfig';
import { StreamedWorld, StreamChunk, WarmTask } from '../shared/streamedWorld';
import { InstancePool, trs } from '../shared/instancePool';
import { createTerrainMaterial, TerrainMaterialHandle } from '../shared/terrainMaterial';
import { createScanStandardMaterial, ScanStandardHandle } from '../shared/scanMaterial';
import { applyStreamFade, getWorldFade } from '../shared/distanceFade';
import { getGreyNoiseTexture } from '../shared/noiseTextures';
import { applyIceShading } from './iceMaterial';
import { ENV_MODEL_HEIGHT, RockPools, applyEnvModels, createRockMaterials, createRockPools, rockTint } from '../shared/envRocks';
import { EnvModelId, getLoadedTextureSet } from '../../../graphics/assetLibrary';

/** Nothing solid may enter |x| < ROAD_CLEAR_X below y = 8. */
const ROAD_CLEAR_X = 6.0;
const CLEAR_MARGIN = 0.5;
const GROUND_SEED = 222;
const CHUNK = CRYSTAL_HEIGHTS_CHUNK_LENGTH;
const ROCK_IDS: readonly EnvModelId[] = ['boulder', 'block', 'slab'];

// Distant snow-capped range: recycled along both flanks. The cycle is long
// enough that a recycled peak re-enters inside the far fade band.
const PEAKS_PER_SIDE = 8;
const PEAK_SPACING = 110;
const PEAK_VARIANTS = 3;

interface CrystalKit {
  ground: THREE.BufferGeometry;
  crystals: Map<string, THREE.BufferGeometry>;
  crystalRadii: Map<string, number>;
  peaks: THREE.BufferGeometry[];
  quartz: THREE.BufferGeometry;
  gate: { stone: THREE.BufferGeometry; ice: THREE.BufferGeometry };
  spruces: THREE.BufferGeometry[];
  snow: TerrainMaterialHandle;
  peakMat: TerrainMaterialHandle;
  gateMat: TerrainMaterialHandle;
  rockMats: Map<EnvModelId, TerrainMaterialHandle>;
  ice: THREE.MeshPhysicalMaterial;
  quartzMat: THREE.MeshPhysicalMaterial;
  bark: ScanStandardHandle;
  needles: THREE.MeshStandardMaterial;
}
const K: Partial<CrystalKit> = {};

// Snow tinted faintly blue; granite cool grey (scans are warm-ish)
const SNOW = { tile: 7, tint: 0xf2f6ff, normalScale: 0.8, roughness: [0.55, 0.92] as [number, number], fallback: 0xe9eef3 };
const GRANITE = { tile: 9, tint: 0xc4cad4, normalScale: 1.15, roughness: [0.6, 0.95] as [number, number], fallback: 0x7d8287 };

const KIT_STEPS: WarmTask[] = [
  () => void getGreyNoiseTexture(1337, 0.8, 4),
  () => {
    K.ground ??= createCelestialHighwayChunkGeometry(200, CHUNK, 36, 24, GROUND_SEED);
  },
  () => {
    if (K.crystals) return;
    const m = new Map<string, THREE.BufferGeometry>();
    const r = new Map<string, number>();
    for (const arch of CRYSTAL_ARCHETYPES) {
      const g = createProceduralCrystalGeometry(arch, 111);
      m.set(arch.id, g);
      r.set(arch.id, getGeometryHorizontalRadius(g));
    }
    K.crystalRadii = r;
    K.crystals = m;
    K.quartz = buildQuartzGeometry();
  },
  () => {
    if (K.peaks) return;
    const peaks: THREE.BufferGeometry[] = [];
    for (let v = 0; v < PEAK_VARIANTS; v++) peaks.push(createAlpinePeakGeometry(70, 95 + v * 12, v * 3 + 1));
    K.peaks = peaks;
  },
  () => {
    K.gate ??= buildGateGeometries();
  },
  () => {
    K.spruces ??= buildSpruceGeometries(0);
  },
  () => {
    if (K.spruces && !K.spruces[1]) K.spruces[1] = buildSpruceGeometries(1)[0];
  },
  () => {
    if (K.spruces && !K.spruces[2]) K.spruces[2] = buildSpruceGeometries(2)[0];
  },
  () => {
    if (K.snow) return;
    const fade = getWorldFade('crystal-heights');
    K.snow = createTerrainMaterial({
      name: 'crystal-snowfield',
      snow: true,
      ground: SNOW,
      rock: GRANITE,
      slope: [0.7, 0.86],
      vertexColors: true,
      vcRef: 0xe3e9ef,
      vcRefRock: 0x7d8287,
      vcKeep: 0.45,
      roughness: 0.92,
      skirt: { length: 20, depth: 3, innerX: 8 },
      fade,
    });
    K.peakMat = createTerrainMaterial({
      name: 'crystal-peaks',
      snow: true,
      ground: { ...SNOW, tile: 24 },
      rock: { ...GRANITE, tile: 30 },
      slope: [0.5, 0.72],
      vertexColors: true,
      vcLuma: true,
      vcRef: 0xe3e9ef,
      vcRefRock: 0x7d8287,
      vcKeep: 0.35,
      macro: 0.1,
      band: 'far',
      fade,
    });
    K.gateMat = createTerrainMaterial({
      name: 'crystal-gate',
      snow: true,
      ground: { ...SNOW, tile: 4 },
      rock: { ...GRANITE, tile: 5 },
      slope: [0.55, 0.75],
      fade,
    });
    K.rockMats = createRockMaterials('crystal', ROCK_IDS, {
      ground: { ...SNOW, tile: 5 },
      rock: { ...GRANITE, tile: 5, normalScale: 0.6 },
      // Snow settles on anything flatter than ~45 deg, so outcrops read as
      // snow-capped rock rather than dark blocks
      slope: [0.5, 0.72],
      snow: true,
      fade,
    });
    // Glacial ice / quartz: opaque glossy dielectrics lit by the sky reflection
    // (MeshPhysical clearcoat + IOR). No transmission: it forced an extra full
    // scene render every frame. Albedo stays well below white (ice scatters
    // light into its depth instead of reflecting it diffusely), with patchy
    // thickness colour and polished-to-frosted gloss from world-space noise.
    K.ice = applyIceShading(
      applyStreamFade(
        new THREE.MeshPhysicalMaterial({
          vertexColors: true,
          color: 0xb9d3e0,
          roughness: 0.18,
          metalness: 0,
          ior: 1.31,
          clearcoat: 0.6,
          clearcoatRoughness: 0.14,
          sheen: 0,
          envMapIntensity: 0.8,
          flatShading: true,
        }),
        fade
      ),
      { deep: 0x5f9dbd, roughness: [0.07, 0.42], scale: 0.05 }
    );
    K.quartzMat = applyIceShading(
      applyStreamFade(
        new THREE.MeshPhysicalMaterial({
          vertexColors: true,
          color: 0xc9d6dc,
          roughness: 0.12,
          metalness: 0,
          ior: 1.55,
          clearcoat: 0.8,
          clearcoatRoughness: 0.08,
          envMapIntensity: 0.9,
          flatShading: true,
        }),
        fade
      ),
      { deep: 0x9fb4bf, roughness: [0.05, 0.3], scale: 0.11 }
    );
    const noise = getGreyNoiseTexture(1337, 0.8, 4);
    K.bark = createScanStandardMaterial({ fallbackColor: 0x4a3c31, fallbackMap: noise, scanTint: 0x9a8d82, roughness: 0.92, fade });
    K.needles = applyStreamFade(new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.9, metalness: 0 }), fade);
  },
];

interface Peak {
  variant: number;
  x: number;
  z: number;
  s: number;
  sy: number;
  rot: number;
}

/**
 * CrystalHeightsWorld — high-alpine glacier: scanned snow over scanned granite
 * (slope-blended, faintly blue shadows), glacial ice seracs and quartz
 * clusters (opaque clearcoat, no transmission pass), scanned granite boulders
 * and outcrops with snow settled on top, snow-laden spruces with scanned
 * bark, a rare granite arch, and a recycled snow-capped range on both flanks.
 */
export class CrystalHeightsWorld extends StreamedWorld {
  public config = crystalHeightsConfig;
  public atmosphere: CrystalHeightsAtmosphere | null = null;
  protected readonly chunkLength = CHUNK;

  private groundPool: InstancePool | null = null;
  private crystalPools = new Map<string, InstancePool>();
  private quartzPool: InstancePool | null = null;
  private sprucePools: InstancePool[] = [];
  private peakPools: InstancePool[] = [];
  private rockPools: RockPools | null = null;
  private peaks: Peak[] = [];
  /** Granite arch parts (instanced so they are compiled before the world shows). */
  private gatePools: InstancePool[] = [];
  private peaksDirty = true;

  constructor(scene: THREE.Scene, graphicsConfig: GraphicsConfig) {
    super(scene, graphicsConfig, 'crystal-heights', 'CrystalHeightsWorldRootGroup');
  }

  protected warmTasks(): WarmTask[] {
    return [
      ...KIT_STEPS,
      () => {
        this.atmosphere = new CrystalHeightsAtmosphere(this.group, this.graphicsConfig);
        this.atmosphere.group.visible = false;
      },
    ];
  }

  protected onKitReady(): void {
    const k = K as CrystalKit;
    this.groundPool = this.addPool(new InstancePool('crystal-ground', k.ground, k.snow.material, 16));
    for (const arch of CRYSTAL_ARCHETYPES) {
      if (arch.id === 'floating-monolith') continue;
      this.crystalPools.set(
        arch.id,
        this.addPool(new InstancePool(`crystal-${arch.id}`, k.crystals.get(arch.id)!, k.ice, 32, { castShadow: arch.id !== 'celestial-spire' }))
      );
    }
    this.quartzPool = this.addPool(new InstancePool('crystal-quartz', k.quartz, k.quartzMat, 16, { castShadow: true }));
    this.sprucePools = k.spruces.map((g, i) =>
      this.addPool(new InstancePool(`crystal-spruce-${i}`, g, [k.bark.material, k.needles], 24, { castShadow: true }))
    );
    this.peakPools = k.peaks.map((g, i) => this.addPool(new InstancePool(`crystal-peak-${i}`, g, k.peakMat.material, PEAKS_PER_SIDE)));
    this.rockPools = createRockPools('crystal', ROCK_IDS, k.rockMats, 32, 24);
    for (const p of this.rockPools.near.values()) this.addPool(p);
    for (const p of this.rockPools.far.values()) this.addPool(p);
    this.gatePools = [
      this.addPool(new InstancePool('crystal-gate-stone', k.gate.stone, k.gateMat.material, 4, { castShadow: true })),
      this.addPool(new InstancePool('crystal-gate-ice', k.gate.ice, k.ice, 4, { castShadow: true })),
    ];

    // Distant range: deterministic layout, recycled forward as the rider passes
    for (let side = -1; side <= 1; side += 2) {
      for (let i = 0; i < PEAKS_PER_SIDE; i++) {
        const slot = i * 2 + (side > 0 ? 1 : 0);
        const r = Math.abs(Math.sin(slot * 12.9898) * 43758.5453) % 1;
        const s = 0.75 + r * 0.5;
        this.peaks.push({
          variant: slot % PEAK_VARIANTS,
          x: side * (175 + r * 80),
          z: this.origin - 150 + i * PEAK_SPACING + (side > 0 ? PEAK_SPACING * 0.5 : 0),
          s,
          sy: s * (0.85 + ((slot * 7) % 5) * 0.08),
          rot: r * Math.PI * 2,
        });
      }
    }
  }

  protected applyScannedAssets(): void {
    const k = K as CrystalKit;
    const snow = getLoadedTextureSet('crystal-heights/snow');
    const rock = getLoadedTextureSet('crystal-heights/rock');
    const bark = getLoadedTextureSet('shared/bark');
    for (const h of [k.snow, k.peakMat, k.gateMat, ...k.rockMats.values()]) {
      h.setGround(snow);
      h.setRock(rock);
      // Not drawn yet: show the scans from the first frame (no fallback fade-in)
      if (!this.animated) h.snap();
    }
    if (bark) k.bark.apply(bark);
    if (this.rockPools) applyEnvModels(this.rockPools, k.rockMats);
  }

  /** Set once animate() has run (the world has been on screen). */
  private animated = false;

  public setStreamRange(minZ: number, maxZ: number): void {
    super.setStreamRange(minZ, maxZ);
    this.peaksDirty = true;
  }

  /** Minimum |x| for an object of horizontal reach `reach` (m) to stay clear of the road. */
  private clearX(reach: number): number {
    return ROAD_CLEAR_X + reach + CLEAR_MARGIN;
  }

  protected spawnChunk(chunk: StreamChunk): void {
    const k = K as CrystalKit;
    const centerZ = chunk.centerZ;
    const seed = Math.abs(centerZ) * 53 + 79;
    const rnd = (offset = 0) => {
      const x = Math.sin(seed + offset) * 10000;
      return x - Math.floor(x);
    };
    const preset = this.preset;
    const ground = (x: number, z: number) => crystalHeightsGroundHeight(x, z, GROUND_SEED);

    // 1. Snowfield
    this.place(chunk, this.groundPool, trs(0, 0, centerZ, 0, 1));

    // 2. Ice seracs / quartz clusters / ice shards (measured reach keeps |x| >= 6)
    let crystalDensity = 2;
    if (preset === 'mobile-opt') crystalDensity = 2;
    if (preset === 'webgl-min') crystalDensity = 1;
    for (let c = 0; c < crystalDensity; c++) {
      const side = c % 2 === 0 ? -1 : 1;
      const pick = rnd(c * 4 + 3);
      let archId = 'prismatic-cluster';
      let minX = 17.0;
      let range = 18.0;
      let scale = 0.6 + rnd(c * 4 + 5) * 0.3;
      if (pick > 0.7) {
        // Seracs stand well back on the glacier, never towering over the road
        archId = 'celestial-spire';
        minX = 32.0;
        range = 30.0;
        scale = 0.5 + rnd(c * 4 + 5) * 0.3;
      } else if (pick < 0.3) {
        archId = 'ground-shard';
        minX = 11.0;
        range = 12.0;
        scale = 0.55 + rnd(c * 4 + 5) * 0.3;
      }
      const reach = (k.crystalRadii.get(archId) ?? 0) * scale;
      const posX = side * (Math.max(minX, this.clearX(reach)) + rnd(c * 4 + 1) * range);
      const posZ = centerZ + (rnd(c * 4 + 2) - 0.5) * 45.0;
      if (!this.inRange(posZ, reach)) continue;
      this.place(
        chunk,
        this.crystalPools.get(archId) ?? null,
        trs(posX, ground(posX, posZ) - 0.15, posZ, rnd(c * 4 + 4) * Math.PI * 2, scale)
      );
    }

    // 3. Scanned granite: a large outcrop out on the snowfield + roadside boulders
    if (this.rockPools) {
      if (preset !== 'webgl-min' && rnd(10) > 0.4) {
        // Snow-mantled outcrop: low, partly buried (a full-height scan at this
        // size read as a dark wall standing on the snow)
        // (the 'block' scan has a sawn-flat top: at this size it reads as a slab)
        const id: EnvModelId = 'boulder';
        const s = 4.5 + rnd(13) * 4.5;
        const sy = s * (0.55 + rnd(32) * 0.3);
        const side = rnd(11) > 0.5 ? 1 : -1;
        const x = side * (this.clearX(s) + 18 + rnd(12) * 30);
        const z = centerZ + (rnd(14) - 0.5) * 20.0;
        if (this.inRange(z, s)) {
          const gy = Math.min(ground(x, z), ground(x - s * 0.7, z), ground(x + s * 0.7, z));
          this.place(chunk, this.rockPools.far.get(id) ?? null, trs(x, gy - ENV_MODEL_HEIGHT[id] * sy * 0.38, z, rnd(15) * 6.28, s, sy, s, (rnd(33) - 0.5) * 0.4, (rnd(34) - 0.5) * 0.4), rockTint(rnd(31)));
        }
      }
      if (rnd(21) > 0.25) {
        const id: EnvModelId = rnd(32) > 0.5 ? 'boulder' : 'block';
        const s = 1.2 + rnd(22) * 1.3;
        const side = rnd(23) > 0.5 ? 1 : -1;
        const x = side * (Math.max(8.5, this.clearX(s)) + rnd(24) * 8.0);
        const z = centerZ + (rnd(25) - 0.5) * 50.0;
        if (this.inRange(z, s)) {
          this.place(chunk, this.rockPools.near.get(id) ?? null, trs(x, ground(x, z) - ENV_MODEL_HEIGHT[id] * s * 0.25, z, rnd(26) * 6.28, s), rockTint(rnd(33)));
        }
      }
    }

    // 4. Rare road-spanning granite arch, else a granite boulder carrying quartz
    if (rnd(16) > 0.92 && this.canSpanRoad(centerZ + 10)) {
      this.placeParts(chunk, this.gatePools, trs(0, 0, centerZ + 10, 0, 1));
    } else if (rnd(17) > 0.5 && this.rockPools) {
      const side = rnd(18) > 0.5 ? 1 : -1;
      const sx = side * (10.5 + rnd(27) * 4.0);
      const sz = centerZ - 8;
      if (this.inRange(sz, 3)) {
        const gy = ground(sx, sz);
        this.place(chunk, this.rockPools.near.get('boulder') ?? null, trs(sx, gy - 0.6, sz, sz * 0.37, 2.4, 1.6, 2.0), rockTint(rnd(34)));
        this.place(chunk, this.quartzPool, trs(sx + 0.2, gy + 0.7, sz - 0.1, 0.6 + sz * 0.37, 0.95, 0.95, 0.95, 0.12, -0.08));
      }
    }

    // 5. Snow-laden spruces (radius 2.4 m -> inner edge >= 8.6), with a thicker stand further out
    if (preset !== 'webgl-min' && this.sprucePools.length) {
      const treeCount = preset === 'desktop-full' ? 4 : 2;
      for (let t = 0; t < treeCount; t++) {
        if (rnd(19 + t * 5) < 0.3) continue;
        const treeSide = rnd(20 + t * 5) > 0.5 ? 1 : -1;
        const tx = treeSide * (t < 2 ? 11.0 + rnd(28 + t * 5) * 6.0 : 24 + rnd(28 + t * 5) * 30);
        const tz = centerZ + 14 - (t % 2) * 23 + (rnd(29 + t * 5) - 0.5) * 10.0;
        if (!this.inRange(tz, 2.5)) continue;
        const s = 0.85 + rnd(30 + t * 5) * 0.4;
        const pool = this.sprucePools[Math.floor(rnd(35 + t) * this.sprucePools.length) % this.sprucePools.length];
        this.place(chunk, pool, trs(tx, ground(tx, tz) - 0.1, tz, tz * 0.53, s));
      }
    }
  }

  private updatePeaks(playerZ: number): void {
    const cycle = PEAKS_PER_SIDE * PEAK_SPACING;
    const behind = playerZ - 160;
    for (const p of this.peaks) {
      if (p.z < behind) {
        p.z += Math.ceil((behind - p.z) / cycle) * cycle;
        this.peaksDirty = true;
      }
    }
    if (!this.peaksDirty) return;
    this.peaksDirty = false;
    for (const pool of this.peakPools) pool.clear();
    for (const p of this.peaks) {
      // Peaks are ~70 m in radius: only those fully inside the range
      if (!this.inRange(p.z, 70 * p.s)) continue;
      this.peakPools[p.variant]?.add(trs(p.x, -2, p.z, p.rot, p.s, p.sy, p.s));
    }
  }

  protected animate(playerZ: number, dt: number, time: number): void {
    const k = K as CrystalKit;
    this.animated = true;
    k.snow.tick(dt);
    k.peakMat.tick(dt);
    k.gateMat.tick(dt);
    for (const h of k.rockMats.values()) h.tick(dt);
    this.updatePeaks(playerZ);
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
    this.crystalPools.clear();
    this.quartzPool = null;
    this.sprucePools = [];
    this.peakPools = [];
    this.rockPools = null;
    this.peaks = [];
    this.gatePools = [];
  }
}
