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
let biomeOffsetIndex = 0;

export function setActiveBiome(biome: BiomeType | null) {
  activeBiomeOverride = biome;
  if (biome) {
    const idx = BIOME_ROTATION.indexOf(biome);
    if (idx !== -1) {
      biomeOffsetIndex = idx;
    }
  }
}

export function getBiomeAt(z: number): BiomeType {
  if (activeBiomeOverride) {
    return activeBiomeOverride;
  }
  const distancePerBiome = 450;
  const cycleIndex = Math.floor(Math.max(0, z) / distancePerBiome) + biomeOffsetIndex;
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
  // Using a single unified formula guarantees 100% exact alignment between
  // 3D road mesh vertices and player physics height in every biome and across portal warps.
  return Math.sin(z * 0.015) * 2.5;
}

export function getTerrainNormal(x: number, z: number): THREE.Vector3 {
  const eps = 0.5;
  const hL = getTerrainHeight(x - eps, z);
  const hR = getTerrainHeight(x + eps, z);
  const hD = getTerrainHeight(x, z - eps);
  const hU = getTerrainHeight(x, z + eps);

  const normal = new THREE.Vector3(hL - hR, 2.0 * eps, hD - hU).normalize();
  return normal;
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
  public readonly floatingFragmentMat: THREE.MeshBasicMaterial;
  public readonly curbRailMat: THREE.MeshBasicMaterial;
  public readonly wireframeMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff, wireframe: true });

  private themeBackdropMats: Record<string, THREE.MeshBasicMaterial> = {};
  private billboardMats: THREE.MeshBasicMaterial[] = [];
  private wireframeBoxGeom = new THREE.BoxGeometry(6, 6, 6);
  private wireframeOctaGeom = new THREE.OctahedronGeometry(5);

  private curbRailGeom = new THREE.BoxGeometry(0.35, 0.45, CHUNK_SIZE);
  private pillarGeom = new THREE.CylinderGeometry(0.16, 0.22, 16, 8);
  private pillarCrownGeom = new THREE.TorusGeometry(0.75, 0.07, 6, 16);
  private frameSpanGeom = new THREE.BoxGeometry(16, 0.35, 0.35);
  private framePostGeom = new THREE.BoxGeometry(0.35, 11, 0.35);
  private fragmentGeom = new THREE.OctahedronGeometry(1.0);

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
    this.floatingFragmentMat = new THREE.MeshBasicMaterial({
      color: 0x00d2e0,
      wireframe: true,
      transparent: true,
      opacity: 0.55,
    });
    this.spaceObsidianMat = new THREE.MeshStandardMaterial({
      color: 0x040814,
      metalness: 0.95,
      roughness: 0.15,
    });

    const duneTex = createDuneBackdropTexture();
    const glacierTex = createGlacierBackdropTexture();
    const jungleTex = createJungleBackdropTexture();
    const emberTex = createEmberBackdropTexture();
    const nebulaTex = createNebulaBackdropTexture();
    const skyRealmTex = createSkyRealmBackdropTexture();

    this.themeBackdropMats = {
      'neon-undercity': this.buildingMat,
      'dune-nomad': new THREE.MeshBasicMaterial({ map: duneTex, side: THREE.DoubleSide }),
      'aurora-frost': new THREE.MeshBasicMaterial({ map: glacierTex, side: THREE.DoubleSide }),
      'bioluminescent-jungle': new THREE.MeshBasicMaterial({ map: jungleTex, side: THREE.DoubleSide }),
      'ember-core': new THREE.MeshBasicMaterial({ map: emberTex, side: THREE.DoubleSide }),
      'nebula-drift': new THREE.MeshBasicMaterial({ map: nebulaTex, side: THREE.DoubleSide }),
      'sky-realm': new THREE.MeshBasicMaterial({ map: skyRealmTex, side: THREE.DoubleSide }),
      'quantum-desert': new THREE.MeshBasicMaterial({ map: duneTex, side: THREE.DoubleSide }),
      'cyber-forest': new THREE.MeshBasicMaterial({ map: jungleTex, side: THREE.DoubleSide }),
      'orbital-ring': new THREE.MeshBasicMaterial({ map: nebulaTex, side: THREE.DoubleSide }),
      'the-grid': this.wireframeMat,
      'volcanic-forge': new THREE.MeshBasicMaterial({ map: emberTex, side: THREE.DoubleSide }),
      'crystal-glacier': new THREE.MeshBasicMaterial({ map: glacierTex, side: THREE.DoubleSide }),
      'derelict-station': new THREE.MeshBasicMaterial({ map: nebulaTex, side: THREE.DoubleSide }),
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
      },
    });
  }

  private createBackdropPanel(
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

    if (biome === 'neon-undercity' || biome === 'the-grid' || biome === 'derelict-station') {
      // 3D Cyberpunk Skyscraper
      const bGeom = new THREE.BoxGeometry(width, height, depth);
      const mat = this.themeBackdropMats[biome] || this.buildingMat;
      const building = new THREE.Mesh(bGeom, mat);
      building.position.set(x, baseY + height / 2, z);
      group.add(building);

      // Rooftop trim & glowing spires
      const roof = new THREE.Mesh(new THREE.BoxGeometry(width * 1.02, 1.5, depth * 1.02), this.rooftopMat);
      roof.position.set(x, baseY + height + 0.75, z);
      group.add(roof);

      const spireGeom = new THREE.CylinderGeometry(0.1, 0.6, 12, 6);
      const spire = new THREE.Mesh(spireGeom, this.spireMat);
      spire.position.set(x, baseY + height + 6.5, z);
      group.add(spire);

      const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 8), this.beaconMat);
      beacon.position.set(x, baseY + height + 12.5, z);
      group.add(beacon);

      // Optional Hologram Billboard on Building Facade
      if (billboardIdx !== undefined && this.billboardMats[billboardIdx]) {
        const signW = Math.min(width * 0.9, 14);
        const signH = signW * 0.5;
        const signGeom = new THREE.PlaneGeometry(signW, signH);
        const signMesh = new THREE.Mesh(signGeom, this.billboardMats[billboardIdx]);
        const signX = side === 'left' ? x + width / 2 + 0.1 : x - width / 2 - 0.1;
        signMesh.position.set(signX, baseY + height * 0.65, z);
        signMesh.rotation.y = side === 'left' ? Math.PI / 2 : -Math.PI / 2;
        group.add(signMesh);
      }
    } else {
      // Biome-Themed Backdrop Card (Dunes, Glaciers, Jungle, Ember, Nebula, Sky Islands)
      const mat = this.themeBackdropMats[biome] || this.buildingMat;
      const cardGeom = new THREE.PlaneGeometry(width * 1.4, height);
      const card = new THREE.Mesh(cardGeom, mat);
      card.position.set(x, baseY + height / 2, z);
      card.rotation.y = side === 'left' ? Math.PI / 2 : -Math.PI / 2;
      group.add(card);
    }

    return group;
  }

  private createSkybridge(z: number, roadY: number): THREE.Group {
    const group = new THREE.Group();

    // Horizontal bridge span
    const bridgeGeom = new THREE.BoxGeometry(32, 2.5, 4.5);
    const bridge = new THREE.Mesh(bridgeGeom, this.spaceObsidianMat);
    bridge.position.set(0, roadY + 11.5, z);
    group.add(bridge);

    // Glowing cyan/magenta LED sign strip on front
    const signStrip = new THREE.Mesh(new THREE.BoxGeometry(22, 1.2, 0.2), this.neonCyanMat);
    signStrip.position.set(0, roadY + 11.5, z - 2.3);
    group.add(signStrip);

    return group;
  }

  private createGeometricSpaceFrame(z: number, roadY: number): THREE.Group {
    const group = new THREE.Group();

    const topBeam = new THREE.Mesh(this.frameSpanGeom, this.neonCyanMat);
    topBeam.position.set(0, roadY + 8.5, z);
    group.add(topBeam);

    const leftPost = new THREE.Mesh(this.framePostGeom, this.spaceObsidianMat);
    leftPost.position.set(-8.8, roadY + 4.5, z);
    const rightPost = new THREE.Mesh(this.framePostGeom, this.spaceObsidianMat);
    rightPost.position.set(8.8, roadY + 4.5, z);
    group.add(leftPost, rightPost);

    const stripGeom = new THREE.BoxGeometry(0.06, 11, 0.4);
    const leftStrip = new THREE.Mesh(stripGeom, this.neonCyanMat);
    leftStrip.position.set(-8.6, roadY + 4.5, z);
    const rightStrip = new THREE.Mesh(stripGeom, this.neonCyanMat);
    rightStrip.position.set(8.6, roadY + 4.5, z);
    group.add(leftStrip, rightStrip);

    return group;
  }

  rebuildAroundPlayer(playerZ: number, playerX: number, renderDistance = 3) {
    for (const chunk of this.chunks.values()) {
      this.scene.remove(chunk.mesh);
      chunk.mesh.geometry.dispose();
      chunk.decorations.forEach(obj => this.scene.remove(obj));
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

    // 3D Depth Parallax & Rotation on Floating Space Fragments
    for (const chunk of this.chunks.values()) {
      chunk.decorations.forEach(deco => {
        const baseZ = (deco as any).userData?.baseZ;
        const layer = (deco as any).userData?.layer;
        const rotSpeed = (deco as any).userData?.rotSpeed;
        if (rotSpeed !== undefined) {
          deco.rotation.x = time * rotSpeed;
          deco.rotation.y = time * (rotSpeed * 1.25);
        }
        if (baseZ !== undefined && layer !== undefined) {
          const parallaxFactor = layer === 1 ? 0.02 : 0.07;
          const relativeZ = baseZ - playerZ;
          deco.position.z = baseZ + relativeZ * parallaxFactor;
        }
      });
    }

    // Prune distant chunks
    for (const [key, chunk] of this.chunks.entries()) {
      if (!neededKeys.has(key)) {
        this.scene.remove(chunk.mesh);
        chunk.mesh.geometry.dispose();
        chunk.decorations.forEach(obj => {
          this.scene.remove(obj);
        });
        this.chunks.delete(key);
      }
    }
  }

  private spawnCyberHighwayChunk(cz: number) {
    const key = `0_${cz}`;
    const zCenter = (cz + 0.5) * CHUNK_SIZE;
    const biome = getBiomeAt(zCenter);

    // 1. Create 3-Lane Highway Plane Geometry
    const roadWidth = 14.5;
    const geom = new THREE.PlaneGeometry(roadWidth, CHUNK_SIZE, 8, CHUNK_SEGMENTS);
    geom.rotateX(-Math.PI / 2);

    const pos = geom.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const zLocal = pos.getZ(i);
      const zWorld = zCenter + zLocal;
      pos.setY(i, getTerrainHeight(x, zWorld));
    }
    geom.computeVertexNormals();

    const mesh = new THREE.Mesh(geom, this.terrainMaterial);
    mesh.position.set(0, 0, zCenter);
    mesh.receiveShadow = true;
    this.scene.add(mesh);

    const decorations: THREE.Object3D[] = [];

    // 2. Neon Highway Guardrail Curbs along Road Edges
    const leftCurb = new THREE.Mesh(this.curbRailGeom, this.curbRailMat);
    leftCurb.position.set(-7.25, getTerrainHeight(-7.25, zCenter) + 0.25, zCenter);
    this.scene.add(leftCurb);
    decorations.push(leftCurb);

    const rightCurb = new THREE.Mesh(this.curbRailGeom, this.curbRailMat);
    rightCurb.position.set(7.25, getTerrainHeight(7.25, zCenter) + 0.25, zCenter);
    this.scene.add(rightCurb);
    decorations.push(rightCurb);

    // 3. Side Scenery & Skyscraper Backdrop Panels flanking BOTH sides of the highway
    const baseRoadY = getTerrainHeight(0, zCenter);

    // Left Flank
    const hL1 = 65 + Math.abs(cz * 17) % 35;
    const bL1 = this.createBackdropPanel(-20, baseRoadY, zCenter - 20, 16, hL1, 22, 'left', biome, Math.abs(cz) % 4);
    this.scene.add(bL1);
    decorations.push(bL1);

    const hL2 = 95 + Math.abs(cz * 23) % 45;
    const bL2 = this.createBackdropPanel(-38, baseRoadY - 4, zCenter + 14, 22, hL2, 28, 'left', biome);
    this.scene.add(bL2);
    decorations.push(bL2);

    // Right Flank
    const hR1 = 70 + Math.abs(cz * 19) % 35;
    const bR1 = this.createBackdropPanel(20, baseRoadY, zCenter + 18, 16, hR1, 22, 'right', biome, (Math.abs(cz) + 2) % 4);
    this.scene.add(bR1);
    decorations.push(bR1);

    const hR2 = 90 + Math.abs(cz * 29) % 50;
    const bR2 = this.createBackdropPanel(38, baseRoadY - 4, zCenter - 16, 22, hR2, 28, 'right', biome);
    this.scene.add(bR2);
    decorations.push(bR2);

    // 4. Glowing Vertical Pillars at rhythmic intervals (Speed Reference & Parallax Anchors)
    for (let pStep = -CHUNK_SIZE / 2 + 10; pStep < CHUNK_SIZE / 2; pStep += 20) {
      const pZ = zCenter + pStep;
      const roadHLeft = getTerrainHeight(-9.5, pZ);
      const roadHRight = getTerrainHeight(9.5, pZ);

      // Left glowing vertical pylon
      const leftPillar = new THREE.Mesh(this.pillarGeom, this.spaceObsidianMat);
      leftPillar.position.set(-9.5, roadHLeft + 8.0, pZ);
      leftPillar.userData = { baseZ: pZ, layer: 1 };
      this.scene.add(leftPillar);
      decorations.push(leftPillar);

      const leftCrown = new THREE.Mesh(this.pillarCrownGeom, this.glowingPillarMat);
      leftCrown.rotation.x = Math.PI / 2;
      leftCrown.position.set(-9.5, roadHLeft + 16.0, pZ);
      leftCrown.userData = { baseZ: pZ, layer: 1 };
      this.scene.add(leftCrown);
      decorations.push(leftCrown);

      // Right glowing vertical pylon
      const rightPillar = new THREE.Mesh(this.pillarGeom, this.spaceObsidianMat);
      rightPillar.position.set(9.5, roadHRight + 8.0, pZ);
      rightPillar.userData = { baseZ: pZ, layer: 1 };
      this.scene.add(rightPillar);
      decorations.push(rightPillar);

      const rightCrown = new THREE.Mesh(this.pillarCrownGeom, this.glowingPillarMat);
      rightCrown.rotation.x = Math.PI / 2;
      rightCrown.position.set(9.5, roadHRight + 16.0, pZ);
      rightCrown.userData = { baseZ: pZ, layer: 1 };
      this.scene.add(rightCrown);
      decorations.push(rightCrown);
    }

    // 5. Overhead Skybridge & Space Frame Archways
    if ((biome === 'neon-undercity' || biome === 'the-grid' || biome === 'derelict-station') && Math.abs(cz) % 3 === 0) {
      const skybridge = this.createSkybridge(zCenter, baseRoadY);
      this.scene.add(skybridge);
      decorations.push(skybridge);
    } else if (Math.abs(cz) % 2 === 0) {
      const frameGroup = this.createGeometricSpaceFrame(zCenter, baseRoadY);
      frameGroup.userData = { baseZ: zCenter, layer: 1 };
      this.scene.add(frameGroup);
      decorations.push(frameGroup);
    }

    // 6. Floating Neon Space Fragments
    for (let f = 0; f < 3; f++) {
      const side = f % 2 === 0 ? -1 : 1;
      const fragDistX = side * (16 + (f * 7) % 22);
      const fragZ = zCenter - 25 + f * 24;
      const fragY = baseRoadY + 12 + (f * 5) % 15;

      const fragMesh = new THREE.Mesh(this.fragmentGeom, this.floatingFragmentMat);
      fragMesh.position.set(fragDistX, fragY, fragZ);
      fragMesh.userData = { baseZ: fragZ, layer: 2, rotSpeed: 0.8 + f * 0.4 };
      this.scene.add(fragMesh);
      decorations.push(fragMesh);
    }

    // 7. Foliage Instances (Lush neon grass and crystal trees for nature and futuristic biomes)
    const grassList: { x: number; y: number; z: number; scale: number; rot: number }[] = [];
    const treeList: { x: number; y: number; z: number; scale: number }[] = [];

    // Place grass and crystal trees along highway verges
    for (let i = 0; i < 35; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      const gx = side * (8.5 + (i % 7) * 0.8);
      const gz = zCenter - CHUNK_SIZE / 2 + (i / 35) * CHUNK_SIZE;
      const gy = getTerrainHeight(gx, gz);
      grassList.push({
        x: gx,
        y: gy,
        z: gz,
        scale: 0.85 + (i % 5) * 0.1,
        rot: ((i * 37) % 100) / 100 * Math.PI * 2,
      });
    }

    for (let i = 0; i < 10; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      const tx = side * (13.5 + (i % 4) * 2.0);
      const tz = zCenter - CHUNK_SIZE / 2 + (i / 10) * CHUNK_SIZE;
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
      mesh,
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
      this.scene.remove(chunk.mesh);
      chunk.mesh.geometry.dispose();
      chunk.decorations.forEach(d => this.scene.remove(d));
    }
    this.chunks.clear();
    this.terrainMaterial.dispose();
    this.curbRailGeom.dispose();
    this.curbRailMat.dispose();
    this.pillarGeom.dispose();
    this.pillarCrownGeom.dispose();
    this.frameSpanGeom.dispose();
    this.framePostGeom.dispose();
    this.fragmentGeom.dispose();
    this.neonCyanMat.dispose();
    this.neonMagentaMat.dispose();
    this.neonAmberMat.dispose();
    this.glowingPillarMat.dispose();
    this.floatingFragmentMat.dispose();
    this.buildingTex.dispose();
    this.buildingMat.dispose();
    this.rooftopMat.dispose();
    this.spireMat.dispose();
    this.beaconMat.dispose();
    this.billboardMats.forEach(m => m.dispose());
    this.wireframeBoxGeom.dispose();
    this.wireframeOctaGeom.dispose();
    this.wireframeMat.dispose();
  }
}
