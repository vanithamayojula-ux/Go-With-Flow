import * as THREE from 'three';
import { TerrainShader } from '../graphics/shaders';
import { BiomeType, FloatingIslandData } from '../types';
import { createCyberBuildingTexture, createCyberBillboardTexture } from '../graphics/textures';

export const CHUNK_SIZE = 80;
export const CHUNK_SEGMENTS = 24;

export function getBiomeAt(z: number): BiomeType {
  const normalizedZ = Math.max(0, z);
  const cycle = Math.floor(normalizedZ / 750) % 4;
  if (cycle === 0) return 'neon-undercity';
  if (cycle === 1) return 'orbital-ring';
  if (cycle === 2) return 'the-grid';
  return 'derelict-station';
}

export function getBiomeFriction(biome: BiomeType): number {
  switch (biome) {
    case 'neon-undercity':
      return 0.02; // Slick wet asphalt
    case 'orbital-ring':
      return 0.01; // Frictionless zero-g magnetic guide
    case 'the-grid':
      return 0.015; // Smooth digital vector plane
    case 'derelict-station':
      return 0.035; // Gritty industrial metal plating
    default:
      return 0.02;
  }
}

export function getTerrainHeight(x: number, z: number): number {
  const biome = getBiomeAt(z);

  // Smooth undulating highway elevation with gentle speed dips
  if (biome === 'orbital-ring') {
    // Grand rolling parabolic space ring dips
    return Math.sin(z * 0.015) * 4.5 + Math.cos(z * 0.008) * 3.0;
  } else if (biome === 'the-grid') {
    // Laser-flat Tron digital highway with stepped ramps
    return Math.floor(Math.sin(z * 0.02) * 2.0) * 1.5;
  } else if (biome === 'derelict-station') {
    // Gritty industrial elevation changes
    return Math.sin(z * 0.025) * 3.0 + Math.cos(z * 0.04) * 1.2;
  } else {
    // Neon Undercity: Gentle city canyon slope
    return Math.sin(z * 0.018) * 3.5;
  }
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

  // Procedural 4K Skyscraper Window & Holographic Billboard Textures & Materials
  private buildingTex: THREE.CanvasTexture;
  private buildingMat: THREE.MeshBasicMaterial;
  private rooftopMat: THREE.MeshLambertMaterial;
  private spireMat: THREE.MeshBasicMaterial;
  private beaconMat: THREE.MeshBasicMaterial;
  private neonCyanMat: THREE.MeshBasicMaterial;
  private neonMagentaMat: THREE.MeshBasicMaterial;
  private neonAmberMat: THREE.MeshBasicMaterial;

  private billboardMats: THREE.MeshBasicMaterial[] = [];
  private wireframeBoxGeom = new THREE.BoxGeometry(6, 6, 6);
  private wireframeOctaGeom = new THREE.OctahedronGeometry(5);
  private wireframeMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff, wireframe: true });

  private curbRailGeom = new THREE.BoxGeometry(0.5, 0.8, CHUNK_SIZE);
  private curbRailMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // 1. Procedural 4K Cyberpunk Skyscraper Window Grid Texture
    this.buildingTex = createCyberBuildingTexture();
    this.buildingMat = new THREE.MeshBasicMaterial({ map: this.buildingTex });
    this.rooftopMat = new THREE.MeshLambertMaterial({ color: 0x070b15 });
    this.spireMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    this.beaconMat = new THREE.MeshBasicMaterial({ color: 0xff0033 });
    this.neonCyanMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    this.neonMagentaMat = new THREE.MeshBasicMaterial({ color: 0xff007f });
    this.neonAmberMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });

    // 2. High-Tech Holographic Billboard Materials
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

    // 3. Terrain Road Shader
    this.terrainMaterial = new THREE.ShaderMaterial({
      vertexShader: TerrainShader.vertexShader,
      fragmentShader: TerrainShader.fragmentShader,
      uniforms: {
        uSunDirection: { value: new THREE.Vector3(0.3, 0.9, -0.4).normalize() },
        uSunColor: { value: new THREE.Color('#00f0ff') },
        uAmbientColor: { value: new THREE.Color('#060b18') },
        uCameraPos: { value: new THREE.Vector3() },
        uTime: { value: 0 },
        uGridMode: { value: 0.0 },
        uWetReflections: { value: 1.0 },
      },
    });
  }

  /**
   * Helper: Builds a 3D architectural cyberpunk skyscraper complete with
   * lit window matrices, rooftop mechanical penthouse, communications antenna,
   * flashing red aircraft beacon, vertical neon conduits, and optional holographic billboard.
   */
  private createSkyscraper(
    x: number,
    baseY: number,
    z: number,
    width: number,
    height: number,
    depth: number,
    side: 'left' | 'right',
    billboardIdx?: number
  ): THREE.Group {
    const group = new THREE.Group();

    // 1. Skyscraper Main Tower Body with illuminated window grid
    const towerGeom = new THREE.BoxGeometry(width, height, depth);
    const towerMesh = new THREE.Mesh(towerGeom, this.buildingMat);
    towerMesh.position.set(0, height / 2, 0);
    group.add(towerMesh);

    // 2. Rooftop Mechanical Penthouse / Stepped Crown
    const crownGeom = new THREE.BoxGeometry(width * 0.65, 7, depth * 0.65);
    const crownMesh = new THREE.Mesh(crownGeom, this.rooftopMat);
    crownMesh.position.set(0, height + 3.5, 0);
    group.add(crownMesh);

    // 3. Communications Antenna / Spire
    const spireGeom = new THREE.CylinderGeometry(0.15, 0.45, 16, 6);
    const spireMesh = new THREE.Mesh(spireGeom, this.spireMat);
    spireMesh.position.set(0, height + 7 + 8, 0);
    group.add(spireMesh);

    // 4. Rooftop Red Aircraft Warning Beacon
    const beaconGeom = new THREE.SphereGeometry(0.7, 8, 8);
    const beaconMesh = new THREE.Mesh(beaconGeom, this.beaconMat);
    beaconMesh.position.set(0, height + 7 + 16, 0);
    group.add(beaconMesh);

    // 5. Vertical Neon Corner Conduit
    const conduitGeom = new THREE.BoxGeometry(0.4, height, 0.4);
    const conduitMat = side === 'left' ? this.neonCyanMat : this.neonMagentaMat;
    const conduitMesh = new THREE.Mesh(conduitGeom, conduitMat);
    const cornerX = side === 'left' ? width / 2 : -width / 2;
    conduitMesh.position.set(cornerX, height / 2, depth / 2);
    group.add(conduitMesh);

    // 6. Holographic Billboard on inner facade facing the highway
    if (billboardIdx !== undefined && billboardIdx >= 0) {
      const bW = Math.min(width * 0.85, 14);
      const bH = bW * 0.5;
      const bGeom = new THREE.PlaneGeometry(bW, bH);
      const bMat = this.billboardMats[billboardIdx % this.billboardMats.length];
      const signMesh = new THREE.Mesh(bGeom, bMat);

      if (side === 'left') {
        signMesh.position.set(width / 2 + 0.15, height * 0.48, 0);
        signMesh.rotation.y = Math.PI / 2;
      } else {
        signMesh.position.set(-width / 2 - 0.15, height * 0.48, 0);
        signMesh.rotation.y = -Math.PI / 2;
      }
      group.add(signMesh);
    }

    group.position.set(x, baseY, z);
    return group;
  }

  /**
   * Helper: Builds an overhead Cyber Skybridge spanning across the highway
   */
  private createSkybridge(z: number, roadY: number): THREE.Group {
    const group = new THREE.Group();

    // Main bridge structural span
    const bridgeSpanGeom = new THREE.BoxGeometry(38, 3.5, 6);
    const bridgeSpan = new THREE.Mesh(bridgeSpanGeom, this.rooftopMat);
    bridgeSpan.position.set(0, roadY + 16, z);
    group.add(bridgeSpan);

    // Glowing underside laser rails
    const railGeom = new THREE.BoxGeometry(38, 0.35, 0.35);
    const railFront = new THREE.Mesh(railGeom, this.neonCyanMat);
    railFront.position.set(0, roadY + 14.1, z + 2.8);
    group.add(railFront);

    const railBack = new THREE.Mesh(railGeom, this.neonMagentaMat);
    railBack.position.set(0, roadY + 14.1, z - 2.8);
    group.add(railBack);

    // Center overhead holographic highway sign
    const signGeom = new THREE.PlaneGeometry(12, 3);
    const signMesh = new THREE.Mesh(signGeom, this.billboardMats[0]);
    signMesh.position.set(0, roadY + 16, z + 3.1);
    group.add(signMesh);

    return group;
  }

  update(playerZ: number, playerX: number, renderDistance = 3, time = 0) {
    this.terrainMaterial.uniforms.uTime.value = time;

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

    // 2. Glowing Neon Highway Guardrail Curbs
    const leftCurb = new THREE.Mesh(this.curbRailGeom, this.curbRailMat);
    leftCurb.position.set(-7.25, getTerrainHeight(-7.25, zCenter) + 0.35, zCenter);
    this.scene.add(leftCurb);
    decorations.push(leftCurb);

    const rightCurb = new THREE.Mesh(this.curbRailGeom, this.curbRailMat);
    rightCurb.position.set(7.25, getTerrainHeight(7.25, zCenter) + 0.35, zCenter);
    this.scene.add(rightCurb);
    decorations.push(rightCurb);

    // 3. Dense 4K Cyberpunk Skyscrapers on BOTH sides of the highway!
    const baseRoadY = getTerrainHeight(0, zCenter);

    // LEFT FLANK SKYSCRAPERS
    // Skyscraper L1 (Front canyon tower with holographic billboard)
    const hL1 = 65 + Math.abs(cz * 17) % 35;
    const bL1 = this.createSkyscraper(-20, baseRoadY, zCenter - 20, 16, hL1, 22, 'left', Math.abs(cz) % 4);
    this.scene.add(bL1);
    decorations.push(bL1);

    // Skyscraper L2 (Mid-distance massive megatower)
    const hL2 = 95 + Math.abs(cz * 23) % 45;
    const bL2 = this.createSkyscraper(-38, baseRoadY - 4, zCenter + 14, 22, hL2, 28, 'left');
    this.scene.add(bL2);
    decorations.push(bL2);

    // Skyscraper L3 (Background titan skyscraper)
    const hL3 = 135 + Math.abs(cz * 31) % 55;
    const bL3 = this.createSkyscraper(-62, baseRoadY - 8, zCenter - 5, 30, hL3, 34, 'left');
    this.scene.add(bL3);
    decorations.push(bL3);

    // RIGHT FLANK SKYSCRAPERS
    // Skyscraper R1 (Front canyon tower with holographic billboard)
    const hR1 = 70 + Math.abs(cz * 19) % 35;
    const bR1 = this.createSkyscraper(20, baseRoadY, zCenter + 18, 16, hR1, 22, 'right', (Math.abs(cz) + 2) % 4);
    this.scene.add(bR1);
    decorations.push(bR1);

    // Skyscraper R2 (Mid-distance massive megatower)
    const hR2 = 90 + Math.abs(cz * 29) % 50;
    const bR2 = this.createSkyscraper(38, baseRoadY - 4, zCenter - 16, 22, hR2, 28, 'right');
    this.scene.add(bR2);
    decorations.push(bR2);

    // Skyscraper R3 (Background titan skyscraper)
    const hR3 = 140 + Math.abs(cz * 37) % 55;
    const bR3 = this.createSkyscraper(62, baseRoadY - 8, zCenter + 8, 30, hR3, 34, 'right');
    this.scene.add(bR3);
    decorations.push(bR3);

    // 4. Overhead Cyber Skybridge spanning the highway every 2 chunks
    if (Math.abs(cz) % 2 === 0) {
      const skybridge = this.createSkybridge(zCenter, baseRoadY);
      this.scene.add(skybridge);
      decorations.push(skybridge);
    }

    // 5. Zone-Specific Props & Accents
    if (biome === 'the-grid') {
      [-13, 13].forEach(flankX => {
        const poly = new THREE.Mesh(Math.random() > 0.5 ? this.wireframeBoxGeom : this.wireframeOctaGeom, this.wireframeMat);
        poly.position.set(flankX, getTerrainHeight(flankX, zCenter) + 8 + Math.random() * 6, zCenter);
        poly.rotation.set(Math.random(), Math.random(), Math.random());
        this.scene.add(poly);
        decorations.push(poly);
      });
    } else if (biome === 'orbital-ring') {
      const ringArch = new THREE.Mesh(
        new THREE.TorusGeometry(12, 0.45, 8, 24, Math.PI),
        new THREE.MeshBasicMaterial({ color: 0x00f0ff })
      );
      ringArch.position.set(0, getTerrainHeight(0, zCenter), zCenter);
      ringArch.rotation.set(0, Math.PI, 0);
      this.scene.add(ringArch);
      decorations.push(ringArch);
    } else if (biome === 'derelict-station') {
      [-12, 12].forEach(flankX => {
        const pylon = new THREE.Mesh(
          new THREE.CylinderGeometry(0.3, 0.3, 14, 6),
          new THREE.MeshBasicMaterial({ color: 0x334155 })
        );
        pylon.position.set(flankX, getTerrainHeight(flankX, zCenter) + 7, zCenter);
        this.scene.add(pylon);
        decorations.push(pylon);

        const strobe = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 8), this.neonAmberMat);
        strobe.position.set(flankX, getTerrainHeight(flankX, zCenter) + 14, zCenter);
        this.scene.add(strobe);
        decorations.push(strobe);
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
    this.buildingTex.dispose();
    this.buildingMat.dispose();
    this.rooftopMat.dispose();
    this.spireMat.dispose();
    this.beaconMat.dispose();
    this.neonCyanMat.dispose();
    this.neonMagentaMat.dispose();
    this.neonAmberMat.dispose();
    this.billboardMats.forEach(m => m.dispose());
    this.wireframeBoxGeom.dispose();
    this.wireframeOctaGeom.dispose();
    this.wireframeMat.dispose();
  }
}
