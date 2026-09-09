import * as THREE from 'three';
import { TerrainShader } from '../graphics/shaders';
import { BiomeType, FloatingIslandData } from '../types';

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

  // Shared Cyber Billboard & Prop Geometries & Materials
  private buildingGeom = new THREE.BoxGeometry(14, 60, 22);
  private buildingMat = new THREE.MeshLambertMaterial({ color: 0x050811 });

  private billboardGeom = new THREE.PlaneGeometry(10, 6);
  private billboardMatCyan = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
  private billboardMatMagenta = new THREE.MeshBasicMaterial({ color: 0xff007f });
  private billboardMatAmber = new THREE.MeshBasicMaterial({ color: 0xffaa00 });

  private wireframeBoxGeom = new THREE.BoxGeometry(5, 5, 5);
  private wireframeOctaGeom = new THREE.OctahedronGeometry(4);
  private wireframeMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff, wireframe: true });

  private curbRailGeom = new THREE.BoxGeometry(0.5, 0.75, CHUNK_SIZE);
  private curbRailMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });

  constructor(scene: THREE.Scene) {
    this.scene = scene;

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
    leftCurb.position.set(-7.0, getTerrainHeight(-7.0, zCenter) + 0.35, zCenter);
    this.scene.add(leftCurb);
    decorations.push(leftCurb);

    const rightCurb = new THREE.Mesh(this.curbRailGeom, this.curbRailMat);
    rightCurb.position.set(7.0, getTerrainHeight(7.0, zCenter) + 0.35, zCenter);
    this.scene.add(rightCurb);
    decorations.push(rightCurb);

    // 3. Zone-Specific Cyber Architecture & Props
    if (biome === 'neon-undercity') {
      // Skyscraper Canyon flank towers
      [-19, 19].forEach((flankX, idx) => {
        const b = new THREE.Mesh(this.buildingGeom, this.buildingMat);
        const y = getTerrainHeight(flankX, zCenter) + 26;
        b.position.set(flankX, y, zCenter);
        this.scene.add(b);
        decorations.push(b);

        // Holographic Billboard Sign on building face
        const bMat = idx === 0 ? this.billboardMatCyan : this.billboardMatMagenta;
        const sign = new THREE.Mesh(this.billboardGeom, bMat);
        sign.position.set(flankX > 0 ? flankX - 7.1 : flankX + 7.1, y + 5, zCenter);
        sign.rotation.y = flankX > 0 ? -Math.PI / 2 : Math.PI / 2;
        this.scene.add(sign);
        decorations.push(sign);
      });

      // Steam Vents emitting upward light glow
      const vent = new THREE.Mesh(
        new THREE.CylinderGeometry(0.6, 0.8, 0.4, 8),
        new THREE.MeshBasicMaterial({ color: 0x00f0ff })
      );
      vent.position.set(-5.5, getTerrainHeight(-5.5, zCenter + 12) + 0.2, zCenter + 12);
      this.scene.add(vent);
      decorations.push(vent);
    } else if (biome === 'the-grid') {
      // Floating Tron Wireframe Polyhedra alongside highway
      [-14, 14].forEach(flankX => {
        const poly = new THREE.Mesh(Math.random() > 0.5 ? this.wireframeBoxGeom : this.wireframeOctaGeom, this.wireframeMat);
        poly.position.set(flankX, getTerrainHeight(flankX, zCenter) + 8 + Math.random() * 6, zCenter);
        poly.rotation.set(Math.random(), Math.random(), Math.random());
        this.scene.add(poly);
        decorations.push(poly);
      });
    } else if (biome === 'orbital-ring') {
      // Floating Space Truss Gantries
      const ringArch = new THREE.Mesh(
        new THREE.TorusGeometry(12, 0.4, 8, 24, Math.PI),
        new THREE.MeshBasicMaterial({ color: 0x00f0ff })
      );
      ringArch.position.set(0, getTerrainHeight(0, zCenter), zCenter);
      ringArch.rotation.set(0, Math.PI, 0);
      this.scene.add(ringArch);
      decorations.push(ringArch);
    } else if (biome === 'derelict-station') {
      // Industrial girders & amber hazard strobes
      [-12, 12].forEach(flankX => {
        const pylon = new THREE.Mesh(
          new THREE.CylinderGeometry(0.3, 0.3, 14, 6),
          new THREE.MeshBasicMaterial({ color: 0x334155 })
        );
        pylon.position.set(flankX, getTerrainHeight(flankX, zCenter) + 7, zCenter);
        this.scene.add(pylon);
        decorations.push(pylon);

        const strobe = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 8), this.billboardMatAmber);
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
    this.buildingGeom.dispose();
    this.buildingMat.dispose();
    this.billboardGeom.dispose();
    this.billboardMatCyan.dispose();
    this.billboardMatMagenta.dispose();
    this.billboardMatAmber.dispose();
    this.wireframeBoxGeom.dispose();
    this.wireframeOctaGeom.dispose();
    this.wireframeMat.dispose();
  }
}
