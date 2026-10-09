import * as THREE from 'three';
import { TerrainShader } from '../graphics/shaders';
import { BiomeType, FloatingIslandData } from '../types';
import {
  createCyberBuildingTexture,
  createCyberBillboardTexture,
  createDuneBackdropTexture,
  createGlacierBackdropTexture,
  createJungleBackdropTexture,
  createEmberBackdropTexture,
  createNebulaBackdropTexture,
  createSkyRealmBackdropTexture,
} from '../graphics/textures';
import {
  LANE_WIDTH,
  ROAD_HALF,
  ROAD_MARGIN,
  RAIL_X,
  DIVIDER_X,
} from './trackConfig';

export const CHUNK_SIZE = 80;
export const CHUNK_SEGMENTS = 24;

const BIOME_ROTATION: BiomeType[] = [
  'neon-undercity',
  'dune-nomad',
  'aurora-frost',
  'bioluminescent-jungle',
  'ember-core',
  'nebula-drift',
  'sky-realm',
  'quantum-desert',
  'cyber-forest',
  'orbital-ring',
  'the-grid',
  'volcanic-forge',
  'crystal-glacier',
  'derelict-station',
];

let activeBiomeOverride: BiomeType | null = null;
let biomeOverrideEndZ = -1;

export function resetBiomeState() {
  activeBiomeOverride = null;
  biomeOverrideEndZ = -1;
}

export function clearBiomeOverride() {
  activeBiomeOverride = null;
  biomeOverrideEndZ = -1;
}

export function getActiveBiomeOverride(): BiomeType | null {
  return activeBiomeOverride;
}

export function setActiveBiome(biome: BiomeType | null, currentZ?: number, durationDistance = 450) {
  if (biome === null) {
    clearBiomeOverride();
    return;
  }
  activeBiomeOverride = biome;
  if (typeof currentZ === 'number') {
    biomeOverrideEndZ = currentZ + durationDistance;
  } else {
    biomeOverrideEndZ = -1;
  }
}

export function getBiomeAt(z: number): BiomeType {
  if (activeBiomeOverride) {
    if (biomeOverrideEndZ > 0 && z >= biomeOverrideEndZ) {
      activeBiomeOverride = null;
      biomeOverrideEndZ = -1;
    } else {
      return activeBiomeOverride;
    }
  }
  const distancePerBiome = 450;
  const cycleIndex = Math.floor(Math.max(0, z) / distancePerBiome);
  return BIOME_ROTATION[cycleIndex % BIOME_ROTATION.length];
}

export function getBiomeFriction(biome: BiomeType): number {
  switch (biome) {
    case 'neon-undercity':
      return 0.02; // Slick wet asphalt
    case 'dune-nomad':
    case 'quantum-desert':
    case 'dunes':
      return 0.025; // Golden sand resistance
    case 'bioluminescent-jungle':
    case 'cyber-forest':
    case 'forest':
      return 0.02; // Moss plane
    case 'nebula-drift':
    case 'orbital-ring':
      return 0.01; // Zero-g floaty
    case 'sky-realm':
    case 'sky-islands':
      return 0.005; // Extremely floaty nature breeze
    case 'the-grid':
      return 0.015; // Smooth digital vector plane
    case 'ember-core':
    case 'volcanic-forge':
      return 0.03; // Magma obsidian crust
    case 'aurora-frost':
    case 'crystal-glacier':
      return 0.008; // Ultra-slick crystal ice
    case 'derelict-station':
      return 0.035; // Gritty industrial metal plating
    default:
      return 0.02;
  }
}

export function getTerrainHeight(x: number, z: number): number {
  // Smooth, continuous highway surface elevation curve.
  return Math.sin(z * 0.015) * 2.5;
}

const _terrainNormalScratch = new THREE.Vector3();

export function getTerrainNormal(x: number, z: number, target = _terrainNormalScratch): THREE.Vector3 {
  const eps = 0.5;
  const hL = getTerrainHeight(x - eps, z);
  const hR = getTerrainHeight(x + eps, z);
  const hD = getTerrainHeight(x, z - eps);
  const hU = getTerrainHeight(x, z + eps);

  return target.set(hL - hR, 2.0 * eps, hD - hU).normalize();
}

export interface UpdraftGeyser {
  id: string;
  x: number;
  y: number;
  z: number;
  radius: number;
  mesh: THREE.Group;
}

export interface CyberChunk {
  key: string;
  cx: number;
  cz: number;
  mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  decorations: THREE.Object3D[];
  foliageInstances: {
    orbs: { id: string; x: number; y: number; z: number; collected: boolean; mesh?: THREE.Mesh }[];
    floatingIslands: FloatingIslandData[];
    updrafts: UpdraftGeyser[];
    grass: { x: number; y: number; z: number; scale: number; rot: number }[];
    trees: { x: number; y: number; z: number; scale: number }[];
  };
}

export class TerrainManager {
  scene: THREE.Scene;
  chunks: Map<string, CyberChunk> = new Map();
  terrainMaterial: THREE.ShaderMaterial;
  sideGroundMaterial: THREE.MeshStandardMaterial;

  updraftsList: UpdraftGeyser[] = [];
  floatingIslandsList: { x: number; y: number; z: number; radius: number }[] = [];

  // Procedural 4K Cyberpunk Skyscraper Window Grid Texture & Theme Backdrops
  public readonly buildingTex: THREE.CanvasTexture;
  public readonly buildingMat: THREE.MeshBasicMaterial;
  public readonly rooftopMat: THREE.MeshLambertMaterial;
  public readonly spireMat: THREE.MeshBasicMaterial;
  public readonly beaconMat: THREE.MeshBasicMaterial;
  public readonly neonCyanMat: THREE.MeshBasicMaterial;
  public readonly neonMagentaMat: THREE.MeshBasicMaterial;
  public readonly neonAmberMat: THREE.MeshBasicMaterial;

  public readonly spaceObsidianMat: THREE.MeshStandardMaterial;
  public readonly glowingPillarMat: THREE.MeshBasicMaterial;
  public readonly curbRailMat: THREE.MeshBasicMaterial;
  public readonly wireframeMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff, wireframe: true });

  // Dedicated Themed Biome Materials
  public readonly sandstoneMat: THREE.MeshStandardMaterial;
  public readonly iceCrystalMat: THREE.MeshStandardMaterial;
  public readonly jungleWoodMat: THREE.MeshStandardMaterial;
  public readonly jungleCanopyMat: THREE.MeshStandardMaterial;
  public readonly volcanicMat: THREE.MeshStandardMaterial;
  public readonly magmaVeinMat: THREE.MeshBasicMaterial;
  public readonly celestialMat: THREE.MeshStandardMaterial;
  public readonly skyMarbleMat: THREE.MeshStandardMaterial;
  public readonly beaconGoldMat: THREE.MeshBasicMaterial;

  private themeBackdropMats: Record<string, THREE.Material> = {};
  private billboardMats: THREE.MeshBasicMaterial[] = [];

  private curbRailGeom = new THREE.BoxGeometry(0.30, 0.40, CHUNK_SIZE);
  private pillarGeom = new THREE.CylinderGeometry(0.18, 0.24, 14, 8);
  private pillarCrownGeom = new THREE.TorusGeometry(0.65, 0.06, 6, 16);
  private frameSpanGeom = new THREE.BoxGeometry((RAIL_X + 0.8) * 2, 0.35, 0.35);
  private framePostGeom = new THREE.BoxGeometry(0.35, 10, 0.35);

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // Materials
    this.buildingTex = createCyberBuildingTexture();
    this.buildingMat = new THREE.MeshBasicMaterial({ map: this.buildingTex });
    this.rooftopMat = new THREE.MeshLambertMaterial({ color: 0x070b15 });
    this.spireMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    this.beaconMat = new THREE.MeshBasicMaterial({ color: 0xff0033 });
    this.neonCyanMat = new THREE.MeshBasicMaterial({ color: 0x00d2e0 });
    this.neonMagentaMat = new THREE.MeshBasicMaterial({ color: 0xe00070 });
    this.neonAmberMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
    this.curbRailMat = new THREE.MeshBasicMaterial({ color: 0x00d2e0 });
    this.glowingPillarMat = new THREE.MeshBasicMaterial({ color: 0x00d2e0 });
    this.spaceObsidianMat = new THREE.MeshStandardMaterial({
      color: 0x040814,
      metalness: 0.95,
      roughness: 0.15,
    });

    // Dark continuous side ground material (no void!)
    this.sideGroundMaterial = new THREE.MeshStandardMaterial({
      color: 0x03060f,
      roughness: 0.85,
      metalness: 0.15,
    });

    const duneTex = createDuneBackdropTexture();
    const glacierTex = createGlacierBackdropTexture();
    const jungleTex = createJungleBackdropTexture();
    const emberTex = createEmberBackdropTexture();
    const nebulaTex = createNebulaBackdropTexture();
    const skyRealmTex = createSkyRealmBackdropTexture();

    this.sandstoneMat = new THREE.MeshStandardMaterial({
      color: 0xd48b46,
      roughness: 0.85,
      metalness: 0.15,
      map: duneTex,
    });
    this.iceCrystalMat = new THREE.MeshStandardMaterial({
      color: 0x9be5ff,
      roughness: 0.25,
      metalness: 0.45,
      emissive: new THREE.Color(0x00e5ff),
      emissiveIntensity: 0.25,
      map: glacierTex,
    });
    this.jungleWoodMat = new THREE.MeshStandardMaterial({
      color: 0x16382b,
      roughness: 0.85,
      metalness: 0.10,
      map: jungleTex,
    });
    this.jungleCanopyMat = new THREE.MeshStandardMaterial({
      color: 0x059669,
      roughness: 0.55,
      metalness: 0.20,
      emissive: new THREE.Color(0x10b981),
      emissiveIntensity: 0.35,
    });
    this.volcanicMat = new THREE.MeshStandardMaterial({
      color: 0x181416,
      roughness: 0.85,
      metalness: 0.30,
      emissive: new THREE.Color(0xd946ef),
      emissiveIntensity: 0.15,
      map: emberTex,
    });
    this.magmaVeinMat = new THREE.MeshBasicMaterial({ color: 0xff5500 });
    this.celestialMat = new THREE.MeshStandardMaterial({
      color: 0x1e1b4b,
      roughness: 0.45,
      metalness: 0.65,
      emissive: new THREE.Color(0x8b5cf6),
      emissiveIntensity: 0.25,
      map: nebulaTex,
    });
    this.skyMarbleMat = new THREE.MeshStandardMaterial({
      color: 0xe0f2fe,
      roughness: 0.35,
      metalness: 0.25,
      map: skyRealmTex,
    });
    this.beaconGoldMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });

    this.themeBackdropMats = {
      'neon-undercity': this.buildingMat,
      'dune-nomad': this.sandstoneMat,
      'aurora-frost': this.iceCrystalMat,
      'bioluminescent-jungle': this.jungleCanopyMat,
      'ember-core': this.volcanicMat,
      'nebula-drift': this.celestialMat,
      'sky-realm': this.skyMarbleMat,
      'quantum-desert': this.sandstoneMat,
      'cyber-forest': this.jungleCanopyMat,
      'orbital-ring': this.celestialMat,
      'the-grid': this.wireframeMat,
      'volcanic-forge': this.volcanicMat,
      'crystal-glacier': this.iceCrystalMat,
      'derelict-station': this.celestialMat,
    };

    // Holographic Billboards
    const bTex1 = createCyberBillboardTexture('NEON DRIFT', '高速レーサー // 2077', '#00f0ff', '#ff007f');
    const bTex2 = createCyberBillboardTexture('NIGHT CITY', 'メガシティ // SECTOR 07', '#ff007f', '#00f0ff');
    const bTex3 = createCyberBillboardTexture('ARASAKA', 'サイバネティクス // CORP NET', '#ff0044', '#ffaa00');
    const bTex4 = createCyberBillboardTexture('OVERDRIVE', '超加速 // MAXIMUM SPEED', '#00ffcc', '#ff007f');
    this.billboardMats = [
      new THREE.MeshBasicMaterial({ map: bTex1, side: THREE.DoubleSide }),
      new THREE.MeshBasicMaterial({ map: bTex2, side: THREE.DoubleSide }),
      new THREE.MeshBasicMaterial({ map: bTex3, side: THREE.DoubleSide }),
      new THREE.MeshBasicMaterial({ map: bTex4, side: THREE.DoubleSide }),
    ];

    // Space Highway Road Material
    this.terrainMaterial = new THREE.ShaderMaterial({
      vertexShader: TerrainShader.vertexShader,
      fragmentShader: TerrainShader.fragmentShader,
      uniforms: {
        uSunDirection: { value: new THREE.Vector3(0.0, 1.0, 0.3).normalize() },
        uSunColor: { value: new THREE.Color('#00d2e0') },
        uAmbientColor: { value: new THREE.Color('#02040c') },
        uCameraPos: { value: new THREE.Vector3() },
        uTime: { value: 0 },
        uSpeed: { value: 20.0 },
        uGridMode: { value: 0.0 },
        uWetReflections: { value: 1.0 },
        uLaneWidth: { value: LANE_WIDTH },
        uRailX: { value: RAIL_X },
        uDividerX: { value: DIVIDER_X },
        uFogColor: { value: new THREE.Color('#00040e') },
        uRimLightIntensity: { value: 0.14 },
        uCelRampHardness: { value: 0.2 },
      },
    });
  }

  private createGroundedStructure(
    x: number,
    baseY: number,
    z: number,
    width: number,
    height: number,
    depth: number,
    side: 'left' | 'right',
    biome: BiomeType,
    billboardIdx?: number
  ): THREE.Group {
    const group = new THREE.Group();

    // Grounded base: Extend 8 units BELOW ground level so no gaps ever show
    const totalHeight = height + 8.0;
    const centerPosY = (baseY - 8.0) + totalHeight / 2;
    const roofTopY = baseY + height;

    if (biome === 'neon-undercity' || biome === 'the-grid' || biome === 'derelict-station') {
      // 1. 3D Cyberpunk Skyscraper
      const bGeom = new THREE.BoxGeometry(width, totalHeight, depth);
      const mat = this.themeBackdropMats[biome] || this.buildingMat;
      const building = new THREE.Mesh(bGeom, mat);
      building.position.set(x, centerPosY, z);
      group.add(building);

      // Lit podium base strip at ground level
      const podiumGeom = new THREE.BoxGeometry(width * 1.04, 2.5, depth * 1.04);
      const podium = new THREE.Mesh(podiumGeom, this.spaceObsidianMat);
      podium.position.set(x, baseY + 1.25, z);
      group.add(podium);

      const podiumGlow = new THREE.Mesh(new THREE.BoxGeometry(width * 1.06, 0.4, depth * 1.06), this.neonCyanMat);
      podiumGlow.position.set(x, baseY + 0.2, z);
      group.add(podiumGlow);

      // Rooftop trim & glowing spires
      const roof = new THREE.Mesh(new THREE.BoxGeometry(width * 1.02, 1.5, depth * 1.02), this.rooftopMat);
      roof.position.set(x, roofTopY + 0.75, z);
      group.add(roof);

      const spireGeom = new THREE.CylinderGeometry(0.1, 0.5, 12, 6);
      const spire = new THREE.Mesh(spireGeom, this.spireMat);
      spire.position.set(x, roofTopY + 6.5, z);
      group.add(spire);

      const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 8), this.beaconMat);
      beacon.position.set(x, roofTopY + 12.5, z);
      group.add(beacon);

      // Hologram Billboard mounted FLUSH on building facade
      if (billboardIdx !== undefined && this.billboardMats[billboardIdx]) {
        const signW = Math.min(width * 0.85, 14);
        const signH = signW * 0.5;
        const signGeom = new THREE.PlaneGeometry(signW, signH);
        const signMesh = new THREE.Mesh(signGeom, this.billboardMats[billboardIdx]);
        const signX = side === 'left' ? x + width / 2 + 0.08 : x - width / 2 - 0.08;
        signMesh.position.set(signX, baseY + height * 0.55, z);
        signMesh.rotation.y = side === 'left' ? Math.PI / 2 : -Math.PI / 2;
        group.add(signMesh);
      }
    } else if (biome === 'dune-nomad' || biome === 'quantum-desert' || biome === 'dunes') {
      // 2. 3D Stepped Sandstone Mesa & Nomad Monolith
      const lowerHeight = totalHeight * 0.65;
      const lowerY = (baseY - 8.0) + lowerHeight / 2;
      const lowerMesa = new THREE.Mesh(
        new THREE.BoxGeometry(width * 1.15, lowerHeight, depth * 1.15),
        this.sandstoneMat
      );
      lowerMesa.position.set(x, lowerY, z);
      group.add(lowerMesa);

      const upperHeight = totalHeight * 0.45;
      const upperY = (baseY - 8.0) + lowerHeight + upperHeight / 2 - 1.0;
      const upperMesa = new THREE.Mesh(
        new THREE.BoxGeometry(width * 0.85, upperHeight, depth * 0.85),
        this.sandstoneMat
      );
      upperMesa.position.set(x, upperY, z);
      group.add(upperMesa);

      // Grounded stone podium base
      const podium = new THREE.Mesh(
        new THREE.BoxGeometry(width * 1.22, 2.5, depth * 1.22),
        this.spaceObsidianMat
      );
      podium.position.set(x, baseY + 1.25, z);
      group.add(podium);

      const baseGlow = new THREE.Mesh(
        new THREE.BoxGeometry(width * 1.24, 0.4, depth * 1.24),
        this.neonAmberMat
      );
      baseGlow.position.set(x, baseY + 0.2, z);
      group.add(baseGlow);

      // Nomad Antenna Mast & Solar Collector Fins
      const mastGeom = new THREE.CylinderGeometry(0.15, 0.5, 14, 6);
      const mast = new THREE.Mesh(mastGeom, this.spaceObsidianMat);
      mast.position.set(x, roofTopY + 7.0, z);
      group.add(mast);

      const finX = new THREE.Mesh(new THREE.BoxGeometry(width * 0.35, 0.35, 0.35), this.neonAmberMat);
      finX.position.set(x, roofTopY + 6.0, z);
      const finZ = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, width * 0.35), this.neonAmberMat);
      finZ.position.set(x, roofTopY + 6.0, z);
      group.add(finX, finZ);

      const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 8), this.neonAmberMat);
      beacon.position.set(x, roofTopY + 14.0, z);
      group.add(beacon);

      // Flush nomad solar rune banner if billboardIdx
      if (billboardIdx !== undefined && this.billboardMats[billboardIdx]) {
        const signW = Math.min(width * 0.75, 12);
        const signH = signW * 0.55;
        const signMesh = new THREE.Mesh(new THREE.PlaneGeometry(signW, signH), this.billboardMats[billboardIdx]);
        const signX = side === 'left' ? x + (width * 0.85) / 2 + 0.08 : x - (width * 0.85) / 2 - 0.08;
        signMesh.position.set(signX, baseY + height * 0.65, z);
        signMesh.rotation.y = side === 'left' ? Math.PI / 2 : -Math.PI / 2;
        group.add(signMesh);
      }
    } else if (biome === 'aurora-frost' || biome === 'crystal-glacier') {
      // 3. 3D Glacial Crystal Tower & Ice Spire
      const crystalTower = new THREE.Mesh(
        new THREE.CylinderGeometry(width * 0.42, width * 0.58, totalHeight, 6),
        this.iceCrystalMat
      );
      crystalTower.position.set(x, centerPosY, z);
      group.add(crystalTower);

      // Sharp ice pinnacle
      const pinnacle = new THREE.Mesh(
        new THREE.ConeGeometry(width * 0.45, 16, 6),
        this.iceCrystalMat
      );
      pinnacle.position.set(x, roofTopY + 8.0, z);
      group.add(pinnacle);

      // Flanking Ice Shards
      const flank1 = new THREE.Mesh(new THREE.ConeGeometry(width * 0.22, 16, 5), this.iceCrystalMat);
      flank1.position.set(x - width * 0.3, baseY + height * 0.35, z + depth * 0.2);
      flank1.rotation.z = 0.2;
      const flank2 = new THREE.Mesh(new THREE.ConeGeometry(width * 0.22, 16, 5), this.iceCrystalMat);
      flank2.position.set(x + width * 0.3, baseY + height * 0.35, z - depth * 0.2);
      flank2.rotation.z = -0.2;
      group.add(flank1, flank2);

      // Grounded ice podium
      const podium = new THREE.Mesh(
        new THREE.CylinderGeometry(width * 0.64, width * 0.68, 2.5, 6),
        this.spaceObsidianMat
      );
      podium.position.set(x, baseY + 1.25, z);
      group.add(podium);

      const baseGlow = new THREE.Mesh(
        new THREE.CylinderGeometry(width * 0.66, width * 0.70, 0.4, 6),
        this.neonCyanMat
      );
      baseGlow.position.set(x, baseY + 0.2, z);
      group.add(baseGlow);

      // Crystal Octahedron Beacon at summit
      const beacon = new THREE.Mesh(new THREE.OctahedronGeometry(0.75, 0), this.spireMat);
      beacon.position.set(x, roofTopY + 16.5, z);
      group.add(beacon);
    } else if (biome === 'bioluminescent-jungle' || biome === 'cyber-forest' || biome === 'forest') {
      // 4. 3D Giant Bio-Tree Column & Volumetric Canopy Domes
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(width * 0.35, width * 0.52, totalHeight, 8),
        this.jungleWoodMat
      );
      trunk.position.set(x, centerPosY, z);
      group.add(trunk);

      // Multi-tiered glowing canopy spheres / dodecahedrons
      const lowerCanopy = new THREE.Mesh(new THREE.DodecahedronGeometry(width * 0.65, 0), this.jungleCanopyMat);
      lowerCanopy.position.set(x, roofTopY - 2.0, z);
      const upperCanopy = new THREE.Mesh(new THREE.DodecahedronGeometry(width * 0.8, 0), this.jungleCanopyMat);
      upperCanopy.position.set(x, roofTopY + 8.0, z);
      const topCanopy = new THREE.Mesh(new THREE.DodecahedronGeometry(width * 0.5, 0), this.jungleCanopyMat);
      topCanopy.position.set(x, roofTopY + 16.0, z);
      group.add(lowerCanopy, upperCanopy, topCanopy);

      // Hanging bio-spore light beads
      const spore1 = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 8), this.neonCyanMat);
      spore1.position.set(x + width * 0.4, roofTopY + 4.0, z + depth * 0.2);
      const spore2 = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 8), this.neonCyanMat);
      spore2.position.set(x - width * 0.4, roofTopY + 4.0, z - depth * 0.2);
      group.add(spore1, spore2);

      // Grounded root base
      const podium = new THREE.Mesh(
        new THREE.CylinderGeometry(width * 0.58, width * 0.65, 2.5, 8),
        this.spaceObsidianMat
      );
      podium.position.set(x, baseY + 1.25, z);
      group.add(podium);

      const baseGlow = new THREE.Mesh(
        new THREE.CylinderGeometry(width * 0.60, width * 0.67, 0.4, 8),
        this.neonCyanMat
      );
      baseGlow.position.set(x, baseY + 0.2, z);
      group.add(baseGlow);
    } else if (biome === 'ember-core' || biome === 'volcanic-forge') {
      // 5. 3D Basalt Obsidian Column with Glowing Magma Fissure
      const basaltCol = new THREE.Mesh(
        new THREE.CylinderGeometry(width * 0.42, width * 0.55, totalHeight, 6),
        this.volcanicMat
      );
      basaltCol.position.set(x, centerPosY, z);
      group.add(basaltCol);

      // Magma fissure vein
      const magmaVein = new THREE.Mesh(
        new THREE.BoxGeometry(width * 0.16, totalHeight * 0.85, depth * 1.02),
        this.magmaVeinMat
      );
      magmaVein.position.set(x, centerPosY, z);
      group.add(magmaVein);

      // Furnace crown & beacon
      const crown = new THREE.Mesh(
        new THREE.CylinderGeometry(width * 0.5, width * 0.38, 4.0, 6),
        this.spaceObsidianMat
      );
      crown.position.set(x, roofTopY + 2.0, z);
      group.add(crown);

      const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.65, 8, 8), this.neonAmberMat);
      beacon.position.set(x, roofTopY + 5.0, z);
      group.add(beacon);

      // Grounded obsidian podium base
      const podium = new THREE.Mesh(
        new THREE.CylinderGeometry(width * 0.6, width * 0.65, 2.5, 6),
        this.spaceObsidianMat
      );
      podium.position.set(x, baseY + 1.25, z);
      group.add(podium);

      const baseGlow = new THREE.Mesh(
        new THREE.CylinderGeometry(width * 0.62, width * 0.67, 0.4, 6),
        this.neonAmberMat
      );
      baseGlow.position.set(x, baseY + 0.2, z);
      group.add(baseGlow);
    } else if (biome === 'nebula-drift' || biome === 'orbital-ring') {
      // 6. 3D Orbital Relay Megastructure & Gyro Rings
      const pylon = new THREE.Mesh(
        new THREE.CylinderGeometry(width * 0.36, width * 0.50, totalHeight, 6),
        this.celestialMat
      );
      pylon.position.set(x, centerPosY, z);
      group.add(pylon);

      // Floating gyro energy ring
      const ring = new THREE.Mesh(new THREE.TorusGeometry(width * 0.55, 0.4, 6, 16), this.neonCyanMat);
      ring.position.set(x, roofTopY + 1.0, z);
      ring.rotation.x = Math.PI / 2;
      group.add(ring);

      const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.45, 14, 6), this.spireMat);
      spire.position.set(x, roofTopY + 8.0, z);
      group.add(spire);

      const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 8), this.neonMagentaMat);
      beacon.position.set(x, roofTopY + 15.5, z);
      group.add(beacon);

      // Grounded base
      const podium = new THREE.Mesh(
        new THREE.CylinderGeometry(width * 0.55, width * 0.60, 2.5, 6),
        this.spaceObsidianMat
      );
      podium.position.set(x, baseY + 1.25, z);
      group.add(podium);

      const baseGlow = new THREE.Mesh(
        new THREE.CylinderGeometry(width * 0.57, width * 0.62, 0.4, 6),
        this.neonMagentaMat
      );
      baseGlow.position.set(x, baseY + 0.2, z);
      group.add(baseGlow);
    } else {
      // 7. Sky Realm / Meadow / General 3D Celestial Pillar
      const col = new THREE.Mesh(
        new THREE.CylinderGeometry(width * 0.4, width * 0.52, totalHeight, 8),
        this.skyMarbleMat
      );
      col.position.set(x, centerPosY, z);
      group.add(col);

      const capital = new THREE.Mesh(
        new THREE.CylinderGeometry(width * 0.55, width * 0.42, 3.0, 8),
        this.spaceObsidianMat
      );
      capital.position.set(x, roofTopY + 1.5, z);
      group.add(capital);

      const spire = new THREE.Mesh(new THREE.ConeGeometry(width * 0.28, 12, 6), this.beaconGoldMat);
      spire.position.set(x, roofTopY + 8.0, z);
      group.add(spire);

      const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 8), this.neonCyanMat);
      beacon.position.set(x, roofTopY + 14.5, z);
      group.add(beacon);

      const podium = new THREE.Mesh(
        new THREE.CylinderGeometry(width * 0.58, width * 0.62, 2.5, 8),
        this.spaceObsidianMat
      );
      podium.position.set(x, baseY + 1.25, z);
      group.add(podium);

      const baseGlow = new THREE.Mesh(
        new THREE.CylinderGeometry(width * 0.60, width * 0.64, 0.4, 8),
        this.neonCyanMat
      );
      baseGlow.position.set(x, baseY + 0.2, z);
      group.add(baseGlow);
    }

    return group;
  }

  private createSkybridge(z: number, roadY: number): THREE.Group {
    const group = new THREE.Group();

    // Horizontal bridge span across road
    const bridgeGeom = new THREE.BoxGeometry((RAIL_X + 1.2) * 2, 2.2, 3.8);
    const bridge = new THREE.Mesh(bridgeGeom, this.spaceObsidianMat);
    bridge.position.set(0, roadY + 9.5, z);
    group.add(bridge);

    // Glowing cyan LED sign strip on front
    const signStrip = new THREE.Mesh(new THREE.BoxGeometry((RAIL_X + 0.8) * 2, 1.0, 0.2), this.neonCyanMat);
    signStrip.position.set(0, roadY + 9.5, z - 1.95);
    group.add(signStrip);

    return group;
  }

  private createGeometricSpaceFrame(z: number, roadY: number): THREE.Group {
    const group = new THREE.Group();

    const topBeam = new THREE.Mesh(this.frameSpanGeom, this.neonCyanMat);
    topBeam.position.set(0, roadY + 7.8, z);
    group.add(topBeam);

    const postX = RAIL_X + 0.6;
    const leftPost = new THREE.Mesh(this.framePostGeom, this.spaceObsidianMat);
    leftPost.position.set(-postX, roadY + 3.8, z);
    const rightPost = new THREE.Mesh(this.framePostGeom, this.spaceObsidianMat);
    rightPost.position.set(postX, roadY + 3.8, z);
    group.add(leftPost, rightPost);

    return group;
  }

  private isSharedGeometry(geom: THREE.BufferGeometry): boolean {
    return (
      geom === this.curbRailGeom ||
      geom === this.pillarGeom ||
      geom === this.pillarCrownGeom ||
      geom === this.frameSpanGeom ||
      geom === this.framePostGeom
    );
  }

  private disposeChunk(chunk: CyberChunk) {
    this.scene.remove(chunk.mesh);
    chunk.mesh.geometry.dispose();

    chunk.decorations.forEach(obj => {
      this.scene.remove(obj);
      obj.traverse(child => {
        const mesh = child as THREE.Mesh;
        if (mesh.isMesh && mesh.geometry && !this.isSharedGeometry(mesh.geometry)) {
          mesh.geometry.dispose();
        }
      });
    });
  }

  rebuildAroundPlayer(playerZ: number, playerX: number, renderDistance = 3) {
    for (const chunk of this.chunks.values()) {
      this.disposeChunk(chunk);
    }
    this.chunks.clear();
    this.update(playerZ, playerX, renderDistance);
  }

  update(playerZ: number, playerX: number, renderDistance = 3, time = 0, playerSpeed = 20) {
    this.terrainMaterial.uniforms.uTime.value = time;
    if (this.terrainMaterial.uniforms.uSpeed) {
      this.terrainMaterial.uniforms.uSpeed.value = playerSpeed;
    }

    // Dynamic light pulse along guided neon rails and pillar beacons
    const pulseRate = 8.0 + playerSpeed * 0.2;
    const railPulse = Math.sin(time * pulseRate) * 0.15 + 0.85;
    this.neonCyanMat.color.setRGB(0.0, 0.82 * railPulse, 0.95 * railPulse);
    this.glowingPillarMat.color.setRGB(0.0, 0.90 * railPulse, 1.0 * railPulse);

    const currentBiome = getBiomeAt(playerZ);
    this.terrainMaterial.uniforms.uGridMode.value = currentBiome === 'the-grid' ? 1.0 : 0.0;

    const currentChunkZ = Math.floor(playerZ / CHUNK_SIZE);
    const neededKeys = new Set<string>();

    for (let dz = -1; dz <= renderDistance + 1; dz++) {
      const cz = currentChunkZ + dz;
      const key = `0_${cz}`;
      neededKeys.add(key);

      if (!this.chunks.has(key)) {
        this.spawnCyberHighwayChunk(cz);
      }
    }

    // Prune distant chunks
    for (const [key, chunk] of this.chunks.entries()) {
      if (!neededKeys.has(key)) {
        this.disposeChunk(chunk);
        this.chunks.delete(key);
      }
    }
  }

  private spawnCyberHighwayChunk(cz: number) {
    const key = `0_${cz}`;
    const zCenter = (cz + 0.5) * CHUNK_SIZE;
    const biome = getBiomeAt(zCenter);
    const decorations: THREE.Object3D[] = [];

    // 1. Create EXACT 3-Lane Highway Plane Geometry (Width = 2 * RAIL_X = 9.0)
    const roadWidth = RAIL_X * 2.0; // 9.0 units
    const roadGeom = new THREE.PlaneGeometry(roadWidth, CHUNK_SIZE, 6, CHUNK_SEGMENTS);
    roadGeom.rotateX(-Math.PI / 2);

    const rPos = roadGeom.attributes.position;
    for (let i = 0; i < rPos.count; i++) {
      const x = rPos.getX(i);
      const zLocal = rPos.getZ(i);
      const zWorld = zCenter + zLocal;
      rPos.setY(i, getTerrainHeight(x, zWorld));
    }
    roadGeom.computeVertexNormals();

    const roadMesh = new THREE.Mesh(roadGeom, this.terrainMaterial);
    roadMesh.position.set(0, 0, zCenter);
    roadMesh.receiveShadow = true;
    this.scene.add(roadMesh);

    // 2. Continuous Side Ground / Embankment on BOTH flanks (No void!)
    const sideGroundWidth = 110.0; // Spans out to x = +-114.5
    
    // Left side ground
    const leftGroundGeom = new THREE.PlaneGeometry(sideGroundWidth, CHUNK_SIZE, 8, CHUNK_SEGMENTS);
    leftGroundGeom.rotateX(-Math.PI / 2);
    const lgPos = leftGroundGeom.attributes.position;
    const lgCenterX = -(RAIL_X + sideGroundWidth / 2);
    for (let i = 0; i < lgPos.count; i++) {
      const xWorld = lgCenterX + lgPos.getX(i);
      const zWorld = zCenter + lgPos.getZ(i);
      lgPos.setY(i, getTerrainHeight(xWorld, zWorld) - 0.08);
    }
    leftGroundGeom.computeVertexNormals();
    const leftGroundMesh = new THREE.Mesh(leftGroundGeom, this.sideGroundMaterial);
    leftGroundMesh.position.set(lgCenterX, 0, zCenter);
    leftGroundMesh.receiveShadow = true;
    this.scene.add(leftGroundMesh);
    decorations.push(leftGroundMesh);

    // Right side ground
    const rightGroundGeom = new THREE.PlaneGeometry(sideGroundWidth, CHUNK_SIZE, 8, CHUNK_SEGMENTS);
    rightGroundGeom.rotateX(-Math.PI / 2);
    const rgPos = rightGroundGeom.attributes.position;
    const rgCenterX = (RAIL_X + sideGroundWidth / 2);
    for (let i = 0; i < rgPos.count; i++) {
      const xWorld = rgCenterX + rgPos.getX(i);
      const zWorld = zCenter + rgPos.getZ(i);
      rgPos.setY(i, getTerrainHeight(xWorld, zWorld) - 0.08);
    }
    rightGroundGeom.computeVertexNormals();
    const rightGroundMesh = new THREE.Mesh(rightGroundGeom, this.sideGroundMaterial);
    rightGroundMesh.position.set(rgCenterX, 0, zCenter);
    rightGroundMesh.receiveShadow = true;
    this.scene.add(rightGroundMesh);
    decorations.push(rightGroundMesh);

    // 3. Neon Highway Guardrail Curbs along Road Edges (+-RAIL_X)
    const leftCurb = new THREE.Mesh(this.curbRailGeom, this.curbRailMat);
    leftCurb.position.set(-RAIL_X, getTerrainHeight(-RAIL_X, zCenter) + 0.20, zCenter);
    this.scene.add(leftCurb);
    decorations.push(leftCurb);

    const rightCurb = new THREE.Mesh(this.curbRailGeom, this.curbRailMat);
    rightCurb.position.set(RAIL_X, getTerrainHeight(RAIL_X, zCenter) + 0.20, zCenter);
    this.scene.add(rightCurb);
    decorations.push(rightCurb);

    // 4. Grounded Canyon Structure Depth Bands (Volumetric across all biomes)
    const baseRoadY = getTerrainHeight(0, zCenter);

    // Near Band (x = +-11..16, height 45..75) - clear 6+ unit gap from rail (4.5)
    const hL_near = 48 + Math.abs(cz * 13) % 28;
    const bL_near = this.createGroundedStructure(-12.5, baseRoadY, zCenter - 18, 14, hL_near, 20, 'left', biome, Math.abs(cz) % 4);
    this.scene.add(bL_near);
    decorations.push(bL_near);

    const hR_near = 52 + Math.abs(cz * 17) % 26;
    const bR_near = this.createGroundedStructure(12.5, baseRoadY, zCenter + 16, 14, hR_near, 20, 'right', biome, (Math.abs(cz) + 2) % 4);
    this.scene.add(bR_near);
    decorations.push(bR_near);

    // Mid Band (x = +-28..38, height 75..120)
    const hL_mid = 82 + Math.abs(cz * 23) % 38;
    const bL_mid = this.createGroundedStructure(-30, baseRoadY, zCenter + 14, 20, hL_mid, 26, 'left', biome);
    this.scene.add(bL_mid);
    decorations.push(bL_mid);

    const hR_mid = 86 + Math.abs(cz * 29) % 36;
    const bR_mid = this.createGroundedStructure(30, baseRoadY, zCenter - 14, 20, hR_mid, 26, 'right', biome);
    this.scene.add(bR_mid);
    decorations.push(bR_mid);

    // Far Band (x = +-60..85, height 120..190)
    const hL_far = 135 + Math.abs(cz * 37) % 55;
    const bL_far = this.createGroundedStructure(-65, baseRoadY, zCenter - 4, 32, hL_far, 40, 'left', biome);
    this.scene.add(bL_far);
    decorations.push(bL_far);

    const hR_far = 140 + Math.abs(cz * 41) % 50;
    const bR_far = this.createGroundedStructure(65, baseRoadY, zCenter + 6, 32, hR_far, 40, 'right', biome);
    this.scene.add(bR_far);
    decorations.push(bR_far);

    // 5. Glowing Vertical Pillars at rhythmic intervals
    const pillarDistX = RAIL_X + 1.2;
    for (let pStep = -CHUNK_SIZE / 2 + 12; pStep < CHUNK_SIZE / 2; pStep += 24) {
      const pZ = zCenter + pStep;
      const roadHLeft = getTerrainHeight(-pillarDistX, pZ);
      const roadHRight = getTerrainHeight(pillarDistX, pZ);

      // Left glowing pylon
      const leftPillar = new THREE.Mesh(this.pillarGeom, this.spaceObsidianMat);
      leftPillar.position.set(-pillarDistX, roadHLeft + 7.0, pZ);
      this.scene.add(leftPillar);
      decorations.push(leftPillar);

      const leftCrown = new THREE.Mesh(this.pillarCrownGeom, this.glowingPillarMat);
      leftCrown.rotation.x = Math.PI / 2;
      leftCrown.position.set(-pillarDistX, roadHLeft + 14.0, pZ);
      this.scene.add(leftCrown);
      decorations.push(leftCrown);

      // Right glowing pylon
      const rightPillar = new THREE.Mesh(this.pillarGeom, this.spaceObsidianMat);
      rightPillar.position.set(pillarDistX, roadHRight + 7.0, pZ);
      this.scene.add(rightPillar);
      decorations.push(rightPillar);

      const rightCrown = new THREE.Mesh(this.pillarCrownGeom, this.glowingPillarMat);
      rightCrown.rotation.x = Math.PI / 2;
      rightCrown.position.set(pillarDistX, roadHRight + 14.0, pZ);
      this.scene.add(rightCrown);
      decorations.push(rightCrown);
    }

    // 6. Overhead Skybridge & Space Frame Archways
    if ((biome === 'neon-undercity' || biome === 'the-grid' || biome === 'derelict-station') && Math.abs(cz) % 3 === 0) {
      const skybridge = this.createSkybridge(zCenter, baseRoadY);
      this.scene.add(skybridge);
      decorations.push(skybridge);
    } else if (Math.abs(cz) % 2 === 0) {
      const frameGroup = this.createGeometricSpaceFrame(zCenter, baseRoadY);
      this.scene.add(frameGroup);
      decorations.push(frameGroup);
    }

    // 7. Foliage Instances (Lush neon grass and crystal trees for nature and futuristic biomes)
    const grassList: { x: number; y: number; z: number; scale: number; rot: number }[] = [];
    const treeList: { x: number; y: number; z: number; scale: number }[] = [];

    // Place grass and crystal trees along highway verges outside the rails
    for (let i = 0; i < 30; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      const gx = side * (RAIL_X + 1.8 + (i % 5) * 0.8);
      const gz = zCenter - CHUNK_SIZE / 2 + (i / 30) * CHUNK_SIZE;
      const gy = getTerrainHeight(gx, gz);
      grassList.push({
        x: gx,
        y: gy,
        z: gz,
        scale: 0.85 + (i % 5) * 0.1,
        rot: ((i * 37) % 100) / 100 * Math.PI * 2,
      });
    }

    for (let i = 0; i < 8; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      const tx = side * (RAIL_X + 4.5 + (i % 3) * 1.8);
      const tz = zCenter - CHUNK_SIZE / 2 + (i / 8) * CHUNK_SIZE;
      const ty = getTerrainHeight(tx, tz);
      treeList.push({
        x: tx,
        y: ty,
        z: tz,
        scale: 0.9 + (i % 3) * 0.25,
      });
    }

    this.chunks.set(key, {
      key,
      cx: 0,
      cz,
      mesh: roadMesh,
      decorations,
      foliageInstances: {
        orbs: [],
        floatingIslands: [],
        updrafts: [],
        grass: grassList,
        trees: treeList,
      },
    });
  }

  dispose() {
    for (const chunk of this.chunks.values()) {
      this.disposeChunk(chunk);
    }
    this.chunks.clear();
    this.terrainMaterial.dispose();
    this.sideGroundMaterial.dispose();
    this.curbRailGeom.dispose();
    this.curbRailMat.dispose();
    this.pillarGeom.dispose();
    this.pillarCrownGeom.dispose();
    this.frameSpanGeom.dispose();
    this.framePostGeom.dispose();

    this.buildingTex.dispose();
    this.buildingMat.dispose();
    this.rooftopMat.dispose();
    this.spireMat.dispose();
    this.beaconMat.dispose();
    this.neonCyanMat.dispose();
    this.neonMagentaMat.dispose();
    this.neonAmberMat.dispose();
    this.spaceObsidianMat.dispose();
    this.glowingPillarMat.dispose();
    this.wireframeMat.dispose();

    for (const bm of this.billboardMats) {
      bm.map?.dispose();
      bm.dispose();
    }

    // Dispose themed materials
    this.sandstoneMat.map?.dispose();
    this.sandstoneMat.dispose();
    this.iceCrystalMat.map?.dispose();
    this.iceCrystalMat.dispose();
    this.jungleWoodMat.map?.dispose();
    this.jungleWoodMat.dispose();
    this.jungleCanopyMat.dispose();
    this.volcanicMat.map?.dispose();
    this.volcanicMat.dispose();
    this.magmaVeinMat.dispose();
    this.celestialMat.map?.dispose();
    this.celestialMat.dispose();
    this.skyMarbleMat.map?.dispose();
    this.skyMarbleMat.dispose();
    this.beaconGoldMat.dispose();
  }
}
