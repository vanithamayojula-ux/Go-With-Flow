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

  // Hybrid Space System Materials (Clean, Non-Cluttered, Pure Cyan/Magenta/Obsidian)
  public readonly neonCyanMat: THREE.MeshBasicMaterial;
  public readonly neonMagentaMat: THREE.MeshBasicMaterial;
  public readonly spaceObsidianMat: THREE.MeshStandardMaterial;
  public readonly glowingPillarMat: THREE.MeshBasicMaterial;
  public readonly floatingFragmentMat: THREE.MeshBasicMaterial;
  public readonly curbRailMat: THREE.MeshBasicMaterial;

  private curbRailGeom = new THREE.BoxGeometry(0.35, 0.45, CHUNK_SIZE);
  private pillarGeom = new THREE.CylinderGeometry(0.16, 0.22, 16, 8);
  private pillarCrownGeom = new THREE.TorusGeometry(0.75, 0.07, 6, 16);
  private frameSpanGeom = new THREE.BoxGeometry(16, 0.35, 0.35);
  private framePostGeom = new THREE.BoxGeometry(0.35, 11, 0.35);
  private fragmentGeom = new THREE.OctahedronGeometry(1.0);

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // Strict Color Palette:
    // Cyan = Player, Highway Guide Rails, Speed Anchors
    // Magenta = Secondary hazard accents
    // Space Obsidian = Architectural dark matter
    this.neonCyanMat = new THREE.MeshBasicMaterial({ color: 0x00d2e0 });
    this.neonMagentaMat = new THREE.MeshBasicMaterial({ color: 0xe00070 });
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

  /**
   * Helper: Builds a sleek, futuristic geometric space archway over the highway
   */
  private createGeometricSpaceFrame(z: number, roadY: number): THREE.Group {
    const group = new THREE.Group();

    // Horizontal glowing overhead beam spanning road
    const topBeam = new THREE.Mesh(this.frameSpanGeom, this.neonCyanMat);
    topBeam.position.set(0, roadY + 8.5, z);
    group.add(topBeam);

    // Left and Right support posts
    const leftPost = new THREE.Mesh(this.framePostGeom, this.spaceObsidianMat);
    leftPost.position.set(-8.8, roadY + 4.5, z);
    const rightPost = new THREE.Mesh(this.framePostGeom, this.spaceObsidianMat);
    rightPost.position.set(8.8, roadY + 4.5, z);
    group.add(leftPost, rightPost);

    // Subtle cyan edge strips on posts
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

    // Step 8: Dynamic light pulse along guided neon rails and pillar beacons
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

    // Step 3 & 8: 3D Depth Parallax & Rotation on Floating Space Fragments
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

    // 2. Minimal Neon Side Guide Rails along the road edges (Speed Anchors)
    const leftCurb = new THREE.Mesh(this.curbRailGeom, this.curbRailMat);
    leftCurb.position.set(-7.25, getTerrainHeight(-7.25, zCenter) + 0.25, zCenter);
    this.scene.add(leftCurb);
    decorations.push(leftCurb);

    const rightCurb = new THREE.Mesh(this.curbRailGeom, this.curbRailMat);
    rightCurb.position.set(7.25, getTerrainHeight(7.25, zCenter) + 0.25, zCenter);
    this.scene.add(rightCurb);
    decorations.push(rightCurb);

    // 3. Thin Glowing Vertical Pillars at rhythmic intervals (Speed Reference & Parallax Anchors)
    const baseRoadY = getTerrainHeight(0, zCenter);
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

      // Cyan glowing light emitter crown
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

    // 4. Occasional Geometric Space Frames spanning overhead (every 2 chunks)
    if (Math.abs(cz) % 2 === 0) {
      const frameGroup = this.createGeometricSpaceFrame(zCenter, baseRoadY);
      frameGroup.userData = { baseZ: zCenter, layer: 1 };
      this.scene.add(frameGroup);
      decorations.push(frameGroup);
    }

    // 5. Floating Neon Space Fragments / Light Prisms (Mid-Layer Details & Parallax)
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
        grass: [],
        trees: [],
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
    this.glowingPillarMat.dispose();
    this.floatingFragmentMat.dispose();
  }
}
