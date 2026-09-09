import * as THREE from 'three';
import { fractalNoise } from './noise';
import { TerrainShader } from '../graphics/shaders';
import { createPainterlyGroundTexture } from '../graphics/textures';
import { BiomeType, FloatingIslandData } from '../types';

export const CHUNK_SIZE = 80;
export const CHUNK_SEGMENTS = 28; // balanced for 60fps on mid-range devices

export function getBiomeAt(z: number): BiomeType {
  const normalizedZ = Math.max(0, z);
  const cycle = Math.floor(normalizedZ / 1000) % 4;
  if (cycle === 0) return 'meadow';
  if (cycle === 1) return 'dunes';
  if (cycle === 2) return 'sky-islands';
  return 'forest';
}

export function getBiomeFriction(biome: BiomeType): number {
  switch (biome) {
    case 'dunes':
      return 0.02;
    case 'meadow':
      return 0.08;
    case 'sky-islands':
      return 0.04;
    case 'forest':
      return 0.06;
  }
}

export function getTerrainHeight(x: number, z: number): number {
  const biome = getBiomeAt(z);

  if (biome === 'dunes') {
    const broadDunes = fractalNoise(x * 0.005, z * 0.005, 2, 2.0, 0.4) * 18.0;
    const sandRidges = Math.sin(x * 0.04 + z * 0.02) * 6.5 + Math.cos(z * 0.03) * 3.5;
    const windRipples = Math.sin(x * 0.12 - z * 0.08) * 0.6;
    return broadDunes + sandRidges + windRipples - 2.0;
  } else if (biome === 'sky-islands') {
    const broadFloor = fractalNoise(x * 0.006, z * 0.006, 2, 2.0, 0.45) * 14.0;
    const basin = Math.sin(x * 0.02) * Math.cos(z * 0.02) * 5.0;
    return broadFloor + basin - 12.0;
  } else if (biome === 'forest') {
    const broadFloor = fractalNoise(x * 0.006, z * 0.006, 3, 2.0, 0.5) * 12.0;
    const roots = Math.sin(x * 0.05 + z * 0.03) * 1.4 + Math.cos(z * 0.06) * 1.1;
    return broadFloor + roots - 4.0;
  } else {
    // Broad rolling Ghibli meadow hills & grassy plates
    const broad = fractalNoise(x * 0.007, z * 0.007, 2, 2.0, 0.45) * 22.0;
    const dunes = Math.sin(x * 0.035 + z * 0.015) * Math.cos(z * 0.025) * 5.5;
    const ripples = Math.sin(z * 0.08 + x * 0.04) * 1.5;
    return broad + dunes + ripples;
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

export interface Chunk {
  key: string;
  cx: number;
  cz: number;
  mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  foliageInstances: {
    grass: { x: number; y: number; z: number; scale: number; rot: number }[];
    trees: { x: number; y: number; z: number; scale: number }[];
    orbs: { id: string; x: number; y: number; z: number; collected: boolean; mesh?: THREE.Mesh }[];
    floatingIslands: FloatingIslandData[];
    updrafts: UpdraftGeyser[];
    decorations: THREE.Object3D[];
  };
}

export class TerrainManager {
  scene: THREE.Scene;
  chunks: Map<string, Chunk> = new Map();
  terrainMaterial: THREE.ShaderMaterial;
  groundTexture: THREE.CanvasTexture;
  orbGeometry: THREE.SphereGeometry;
  orbMaterial: THREE.MeshBasicMaterial;

  floatingIslandsList: { x: number; y: number; z: number; radius: number }[] = [];
  updraftsList: UpdraftGeyser[] = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.groundTexture = createPainterlyGroundTexture();

    this.terrainMaterial = new THREE.ShaderMaterial({
      vertexShader: TerrainShader.vertexShader,
      fragmentShader: TerrainShader.fragmentShader,
      uniforms: {
        uGroundTexture: { value: this.groundTexture },
        uSunDirection: { value: new THREE.Vector3(0.5, 0.8, -0.3).normalize() },
        uSunColor: { value: new THREE.Color('#FFF1D0') },
        uAmbientColor: { value: new THREE.Color('#94BCE8') },
        uSlopeWarmColor: { value: new THREE.Color('#F9E4B7') },
        uSlopeCoolColor: { value: new THREE.Color('#4E8B69') },
        uCelRampHardness: { value: 0.35 },
        uRimLightIntensity: { value: 0.6 },
        uCameraPos: { value: new THREE.Vector3() },
      },
    });

    this.orbGeometry = new THREE.SphereGeometry(0.7, 12, 12);
    this.orbMaterial = new THREE.MeshBasicMaterial({
      color: 0xffe97d,
      transparent: true,
      opacity: 0.9,
    });
  }

  getSurfaceHeight(x: number, z: number, playerY: number): { height: number; isOnIsland: boolean } {
    const baseHeight = getTerrainHeight(x, z);

    for (const isl of this.floatingIslandsList) {
      const dx = x - isl.x;
      const dz = z - isl.z;
      const distSq = dx * dx + dz * dz;
      if (distSq < isl.radius * isl.radius) {
        const islandTop = isl.y;
        if (playerY >= islandTop - 2.5 && playerY <= islandTop + 6.0) {
          const dome = (1 - distSq / (isl.radius * isl.radius)) * 1.2;
          return { height: islandTop + dome, isOnIsland: true };
        }
      }
    }

    return { height: baseHeight, isOnIsland: false };
  }

  update(playerZ: number, playerX: number, viewDistance = 3, time = 0) {
    const currentChunkZ = Math.floor(playerZ / CHUNK_SIZE);
    const currentChunkX = Math.floor(playerX / CHUNK_SIZE);

    const neededKeys = new Set<string>();

    for (let dz = -1; dz <= viewDistance + 1; dz++) {
      for (let dx = -2; dx <= 2; dx++) {
        const cx = currentChunkX + dx;
        const cz = currentChunkZ + dz;
        const key = `${cx},${cz}`;
        neededKeys.add(key);

        if (!this.chunks.has(key)) {
          this.createChunk(cx, cz, key);
        }
      }
    }

    for (const [key, chunk] of this.chunks.entries()) {
      if (!neededKeys.has(key)) {
        this.scene.remove(chunk.mesh);
        chunk.mesh.geometry.dispose();

        chunk.foliageInstances.orbs.forEach(orb => {
          if (orb.mesh) this.scene.remove(orb.mesh);
        });

        chunk.foliageInstances.floatingIslands.forEach(isl => {
          if (isl.mesh) this.scene.remove(isl.mesh as THREE.Object3D);
        });

        chunk.foliageInstances.updrafts.forEach(up => {
          this.scene.remove(up.mesh);
        });

        chunk.foliageInstances.decorations.forEach(dec => {
          this.scene.remove(dec);
        });

        this.chunks.delete(key);
      }
    }

    this.floatingIslandsList = [];
    this.updraftsList = [];
    for (const chunk of this.chunks.values()) {
      for (const isl of chunk.foliageInstances.floatingIslands) {
        this.floatingIslandsList.push({ x: isl.x, y: isl.y, z: isl.z, radius: isl.radius });
      }
      for (const up of chunk.foliageInstances.updrafts) {
        this.updraftsList.push(up);
      }
    }

    // Dynamic Biome Palette Adjustment on Shader
    const currentBiome = getBiomeAt(playerZ);
    if (currentBiome === 'dunes') {
      this.terrainMaterial.uniforms.uSlopeWarmColor.value.set('#FFF0C4');
      this.terrainMaterial.uniforms.uSlopeCoolColor.value.set('#C99F5B');
    } else if (currentBiome === 'sky-islands') {
      this.terrainMaterial.uniforms.uSlopeWarmColor.value.set('#FFE4D4');
      this.terrainMaterial.uniforms.uSlopeCoolColor.value.set('#6E93A6');
    } else if (currentBiome === 'forest') {
      this.terrainMaterial.uniforms.uSlopeWarmColor.value.set('#E8D98A');
      this.terrainMaterial.uniforms.uSlopeCoolColor.value.set('#2E5C3E');
    } else {
      this.terrainMaterial.uniforms.uSlopeWarmColor.value.set('#F9E4B7');
      this.terrainMaterial.uniforms.uSlopeCoolColor.value.set('#4E8B69');
    }

    // Gently bob & twinkle active Whisperwood firefly swarms
    for (const chunk of this.chunks.values()) {
      for (const dec of chunk.foliageInstances.decorations) {
        if (dec.userData.isFireflySwarm) {
          const motes = dec.userData.motes as { mesh: THREE.Mesh; phase: number; radius: number; baseY: number }[];
          for (const m of motes) {
            const t = time * 1.2 + m.phase;
            m.mesh.position.x = Math.cos(t * 0.6) * m.radius;
            m.mesh.position.z = Math.sin(t * 0.6) * m.radius;
            m.mesh.position.y = m.baseY + Math.sin(t * 1.8) * 0.35;
            const mat = m.mesh.material as THREE.MeshBasicMaterial;
            mat.opacity = 0.55 + Math.sin(t * 3.0) * 0.4;
          }
        }
      }
    }
  }

  private createChunk(cx: number, cz: number, key: string) {
    const geom = new THREE.PlaneGeometry(
      CHUNK_SIZE,
      CHUNK_SIZE,
      CHUNK_SEGMENTS,
      CHUNK_SEGMENTS
    );
    geom.rotateX(-Math.PI / 2);

    const posAttr = geom.attributes.position;
    const worldOffsetX = cx * CHUNK_SIZE;
    const worldOffsetZ = cz * CHUNK_SIZE;

    for (let i = 0; i < posAttr.count; i++) {
      const lx = posAttr.getX(i);
      const lz = posAttr.getZ(i);
      const wx = worldOffsetX + lx;
      const wz = worldOffsetZ + lz;
      const h = getTerrainHeight(wx, wz);
      posAttr.setY(i, h);
    }
    geom.computeVertexNormals();

    const mesh = new THREE.Mesh(geom, this.terrainMaterial);
    mesh.position.set(worldOffsetX, 0, worldOffsetZ);
    mesh.receiveShadow = true;
    this.scene.add(mesh);

    const biome = getBiomeAt(worldOffsetZ);

    const grass: { x: number; y: number; z: number; scale: number; rot: number }[] = [];
    const trees: { x: number; y: number; z: number; scale: number }[] = [];
    const orbs: { id: string; x: number; y: number; z: number; collected: boolean; mesh?: THREE.Mesh }[] = [];
    const floatingIslands: FloatingIslandData[] = [];
    const updrafts: UpdraftGeyser[] = [];
    const decorations: THREE.Object3D[] = [];

    // 1. Grass clusters
    const grassCount = biome === 'dunes' ? 18 : biome === 'forest' ? 55 : 45;
    for (let g = 0; g < grassCount; g++) {
      const rx = (Math.random() - 0.5) * CHUNK_SIZE * 0.95;
      const rz = (Math.random() - 0.5) * CHUNK_SIZE * 0.95;
      const wx = worldOffsetX + rx;
      const wz = worldOffsetZ + rz;
      const wy = getTerrainHeight(wx, wz);
      grass.push({
        x: wx,
        y: wy,
        z: wz,
        scale: 0.8 + Math.random() * 0.8,
        rot: Math.random() * Math.PI * 2,
      });
    }

    // 2. Ghibli puff trees
    if ((biome === 'meadow' || biome === 'forest') && Math.random() > (biome === 'forest' ? 0.15 : 0.4)) {
      const treeCount = biome === 'forest' ? 3 + Math.floor(Math.random() * 4) : 1 + Math.floor(Math.random() * 3);
      for (let t = 0; t < treeCount; t++) {
        const rx = (Math.random() - 0.5) * CHUNK_SIZE * 0.8;
        const rz = (Math.random() - 0.5) * CHUNK_SIZE * 0.8;
        const wx = worldOffsetX + rx;
        const wz = worldOffsetZ + rz;
        const wy = getTerrainHeight(wx, wz);
        trees.push({
          x: wx,
          y: wy,
          z: wz,
          scale: biome === 'forest' ? 1.8 + Math.random() * 2.2 : 1.5 + Math.random() * 1.5,
        });
      }
    }

    // 3. Floating Islands
    const shouldSpawnIsland = biome === 'sky-islands' ? Math.random() > 0.25 : Math.random() > 0.82;
    if (shouldSpawnIsland) {
      const islandX = worldOffsetX + (Math.random() - 0.5) * CHUNK_SIZE * 0.6;
      const islandZ = worldOffsetZ + (Math.random() - 0.5) * CHUNK_SIZE * 0.6;
      const islandY = getTerrainHeight(islandX, islandZ) + 14 + Math.random() * 12;
      const islandRadius = 12 + Math.random() * 8;

      const islandGroup = new THREE.Group();
      islandGroup.position.set(islandX, islandY, islandZ);

      const topPlateGeom = new THREE.CylinderGeometry(islandRadius, islandRadius * 0.9, 1.8, 12);
      const topPlateMat = new THREE.MeshStandardMaterial({
        color: biome === 'dunes' ? 0xe2c488 : 0x7eb08a,
        roughness: 0.7,
      });
      const topPlate = new THREE.Mesh(topPlateGeom, topPlateMat);
      islandGroup.add(topPlate);

      const rockConeGeom = new THREE.ConeGeometry(islandRadius * 0.9, islandRadius * 0.8, 8);
      rockConeGeom.rotateX(Math.PI);
      rockConeGeom.translate(0, -islandRadius * 0.4 - 0.8, 0);
      const rockMat = new THREE.MeshStandardMaterial({
        color: 0x5a6872,
        roughness: 0.9,
      });
      const rockCone = new THREE.Mesh(rockConeGeom, rockMat);
      islandGroup.add(rockCone);

      this.scene.add(islandGroup);

      floatingIslands.push({
        id: `${key}-island`,
        x: islandX,
        y: islandY + 0.9,
        z: islandZ,
        radius: islandRadius,
        mesh: islandGroup,
      });

      // 4. Updraft Thermal Geyser
      const updraftX = islandX - 8 + Math.random() * 16;
      const updraftZ = islandZ - 18 - Math.random() * 10;
      const updraftY = getTerrainHeight(updraftX, updraftZ);

      const updraftGroup = new THREE.Group();
      updraftGroup.position.set(updraftX, updraftY, updraftZ);

      const ringGeom = new THREE.RingGeometry(1.2, 2.5, 16);
      ringGeom.rotateX(-Math.PI / 2);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x64e8ff,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.75,
      });
      const ring = new THREE.Mesh(ringGeom, ringMat);
      updraftGroup.add(ring);

      const colGeom = new THREE.CylinderGeometry(1.6, 2.4, 20, 8, 1, true);
      colGeom.translate(0, 10, 0);
      const colMat = new THREE.MeshBasicMaterial({
        color: 0x8ef0ff,
        transparent: true,
        opacity: 0.25,
        wireframe: true,
      });
      const col = new THREE.Mesh(colGeom, colMat);
      updraftGroup.add(col);

      this.scene.add(updraftGroup);

      updrafts.push({
        id: `${key}-updraft`,
        x: updraftX,
        y: updraftY,
        z: updraftZ,
        radius: 4.5,
        mesh: updraftGroup,
      });
    }

    // 5. Floating Wind Orbs (Collectibles)
    if (Math.random() > 0.35) {
      const rx = (Math.random() - 0.5) * CHUNK_SIZE * 0.7;
      const rz = (Math.random() - 0.5) * CHUNK_SIZE * 0.7;
      const wx = worldOffsetX + rx;
      const wz = worldOffsetZ + rz;
      const wy = getTerrainHeight(wx, wz) + 1.8 + Math.random() * 2.0;

      const orbMesh = new THREE.Mesh(this.orbGeometry, this.orbMaterial);
      orbMesh.position.set(wx, wy, wz);
      this.scene.add(orbMesh);

      orbs.push({
        id: `${key}-orb`,
        x: wx,
        y: wy,
        z: wz,
        collected: false,
        mesh: orbMesh,
      });
    }

    // 6. Ghibli Props & Environment World Building
    if (biome === 'dunes') {
      if (Math.random() < 0.34) {
        const rx = (Math.random() - 0.5) * CHUNK_SIZE * 0.65;
        const rz = (Math.random() - 0.5) * CHUNK_SIZE * 0.65;
        const wx = worldOffsetX + rx;
        const wz = worldOffsetZ + rz;
        const wy = getTerrainHeight(wx, wz);
        const ribArch = this.createAncientRibArch(wx, wy, wz);
        this.scene.add(ribArch);
        decorations.push(ribArch);
      }

      if (Math.random() < 0.42) {
        const rx = (Math.random() - 0.5) * CHUNK_SIZE * 0.7;
        const rz = (Math.random() - 0.5) * CHUNK_SIZE * 0.7;
        const wx = worldOffsetX + rx;
        const wz = worldOffsetZ + rz;
        const wy = getTerrainHeight(wx, wz);
        const obelisk = this.createStoneObelisk(wx, wy, wz);
        this.scene.add(obelisk);
        decorations.push(obelisk);
      }

      if (Math.random() < 0.35) {
        const rx = (Math.random() - 0.5) * CHUNK_SIZE * 0.75;
        const rz = (Math.random() - 0.5) * CHUNK_SIZE * 0.75;
        const wx = worldOffsetX + rx;
        const wz = worldOffsetZ + rz;
        const wy = getTerrainHeight(wx, wz);
        const acacia = this.createDesertAcacia(wx, wy, wz);
        this.scene.add(acacia);
        decorations.push(acacia);
      }
    } else if (biome === 'meadow') {
      if (Math.random() < 0.38) {
        const rx = (Math.random() - 0.5) * CHUNK_SIZE * 0.7;
        const rz = (Math.random() - 0.5) * CHUNK_SIZE * 0.7;
        const wx = worldOffsetX + rx;
        const wz = worldOffsetZ + rz;
        const wy = getTerrainHeight(wx, wz);
        const lantern = this.createGhibliStoneLantern(wx, wy, wz);
        this.scene.add(lantern);
        decorations.push(lantern);
      }

      if (Math.random() < 0.5) {
        const rx = (Math.random() - 0.5) * CHUNK_SIZE * 0.75;
        const rz = (Math.random() - 0.5) * CHUNK_SIZE * 0.75;
        const wx = worldOffsetX + rx;
        const wz = worldOffsetZ + rz;
        const wy = getTerrainHeight(wx, wz);
        const boulders = this.createMossyBoulders(wx, wy, wz);
        this.scene.add(boulders);
        decorations.push(boulders);
      }

      if (Math.random() < 0.22) {
        const rx = (Math.random() - 0.5) * CHUNK_SIZE * 0.65;
        const rz = (Math.random() - 0.5) * CHUNK_SIZE * 0.65;
        const wx = worldOffsetX + rx;
        const wz = worldOffsetZ + rz;
        const wy = getTerrainHeight(wx, wz);
        const cottage = this.createMountainCottage(wx, wy, wz);
        this.scene.add(cottage);
        decorations.push(cottage);
      }
    } else if (biome === 'forest') {
      if (Math.random() < 0.3) {
        const rx = (Math.random() - 0.5) * CHUNK_SIZE * 0.6;
        const rz = (Math.random() - 0.5) * CHUNK_SIZE * 0.6;
        const wx = worldOffsetX + rx;
        const wz = worldOffsetZ + rz;
        const wy = getTerrainHeight(wx, wz);
        const guardianTree = this.createGuardianCamphorTree(wx, wy, wz);
        this.scene.add(guardianTree);
        decorations.push(guardianTree);
      }

      if (Math.random() < 0.28) {
        const rx = (Math.random() - 0.5) * CHUNK_SIZE * 0.65;
        const rz = (Math.random() - 0.5) * CHUNK_SIZE * 0.65;
        const wx = worldOffsetX + rx;
        const wz = worldOffsetZ + rz;
        const wy = getTerrainHeight(wx, wz);
        const gate = this.createForestShrineGate(wx, wy, wz);
        this.scene.add(gate);
        decorations.push(gate);
      }

      if (Math.random() < 0.4) {
        const rx = (Math.random() - 0.5) * CHUNK_SIZE * 0.7;
        const rz = (Math.random() - 0.5) * CHUNK_SIZE * 0.7;
        const wx = worldOffsetX + rx;
        const wz = worldOffsetZ + rz;
        const wy = getTerrainHeight(wx, wz);
        const boulders = this.createMossyBoulders(wx, wy, wz);
        this.scene.add(boulders);
        decorations.push(boulders);
      }

      if (Math.random() < 0.5) {
        const rx = (Math.random() - 0.5) * CHUNK_SIZE * 0.7;
        const rz = (Math.random() - 0.5) * CHUNK_SIZE * 0.7;
        const wx = worldOffsetX + rx;
        const wz = worldOffsetZ + rz;
        const wy = getTerrainHeight(wx, wz);
        const fireflies = this.createFireflySwarm(wx, wy, wz);
        this.scene.add(fireflies);
        decorations.push(fireflies);
      }
    }

    this.chunks.set(key, {
      key,
      cx,
      cz,
      mesh,
      foliageInstances: { grass, trees, orbs, floatingIslands, updrafts, decorations },
    });
  }

  // --- Procedural Reference Graphics Builders ---

  private createAncientRibArch(x: number, y: number, z: number): THREE.Group {
    const group = new THREE.Group();
    group.position.set(x, y - 0.5, z);
    const angle = Math.random() * Math.PI * 2;
    group.rotation.y = angle;

    const boneMat = new THREE.MeshStandardMaterial({
      color: 0xede0c8,
      roughness: 0.85,
    });

    const ribCount = 5 + Math.floor(Math.random() * 2);
    for (let i = 0; i < ribCount; i++) {
      const ribRadius = 4.6 + Math.sin((i / ribCount) * Math.PI) * 1.5;
      const ribGeom = new THREE.TorusGeometry(ribRadius, 0.32, 6, 16, Math.PI * 0.85);
      ribGeom.rotateX(Math.PI / 2);
      ribGeom.rotateZ(-Math.PI * 0.42);

      const rib = new THREE.Mesh(ribGeom, boneMat);
      rib.position.set(0, 0, (i - ribCount / 2) * 2.5);
      rib.rotation.y = (Math.random() - 0.5) * 0.15;
      group.add(rib);
    }

    const spineGeom = new THREE.CylinderGeometry(0.35, 0.45, ribCount * 2.6, 6);
    spineGeom.rotateX(Math.PI / 2);
    const spine = new THREE.Mesh(spineGeom, boneMat);
    spine.position.set(0, 4.8, 0);
    group.add(spine);

    const skullGeom = new THREE.BoxGeometry(2.2, 1.8, 3.4);
    skullGeom.translate(0, 0.5, ribCount * 1.4);
    const skull = new THREE.Mesh(skullGeom, boneMat);
    skull.rotation.x = -0.3;
    group.add(skull);

    return group;
  }

  private createStoneObelisk(x: number, y: number, z: number): THREE.Group {
    const group = new THREE.Group();
    group.position.set(x, y - 0.8, z);
    group.rotation.y = Math.random() * Math.PI;

    const stoneMat = new THREE.MeshStandardMaterial({
      color: 0xc89e6e,
      roughness: 0.8,
    });

    const height = 10 + Math.random() * 8;
    const pillarGeom = new THREE.CylinderGeometry(0.7, 1.3, height, 4);
    pillarGeom.translate(0, height / 2, 0);
    const pillar = new THREE.Mesh(pillarGeom, stoneMat);
    pillar.rotation.y = Math.PI / 4;
    pillar.rotation.z = (Math.random() - 0.5) * 0.08;
    group.add(pillar);

    for (let b = 0; b < 2; b++) {
      const blockGeom = new THREE.BoxGeometry(1.2 + Math.random() * 0.8, 0.9, 1.4);
      const block = new THREE.Mesh(blockGeom, stoneMat);
      block.position.set((Math.random() - 0.5) * 4.5, 0.4, (Math.random() - 0.5) * 4.5);
      block.rotation.set(Math.random() * 0.3, Math.random() * Math.PI, (Math.random() - 0.5) * 0.2);
      group.add(block);
    }

    return group;
  }

  private createDesertAcacia(x: number, y: number, z: number): THREE.Group {
    const group = new THREE.Group();
    group.position.set(x, y - 0.2, z);

    const woodMat = new THREE.MeshLambertMaterial({ color: 0x5a4835 });
    const leafMat = new THREE.MeshLambertMaterial({ color: 0x7c7352 });

    const trunkGeom = new THREE.CylinderGeometry(0.25, 0.4, 7.5, 5);
    trunkGeom.translate(0, 3.75, 0);
    const trunk = new THREE.Mesh(trunkGeom, woodMat);
    trunk.rotation.z = 0.15 + Math.random() * 0.15;
    group.add(trunk);

    const topDiscGeom = new THREE.CylinderGeometry(4.2, 3.6, 0.6, 7);
    const topDisc = new THREE.Mesh(topDiscGeom, leafMat);
    topDisc.position.set(1.2, 7.2, 0);
    group.add(topDisc);

    const subDiscGeom = new THREE.CylinderGeometry(2.8, 2.2, 0.5, 6);
    const subDisc = new THREE.Mesh(subDiscGeom, leafMat);
    subDisc.position.set(-0.5, 6.4, 0.8);
    group.add(subDisc);

    return group;
  }

  private createGhibliStoneLantern(x: number, y: number, z: number): THREE.Group {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.scale.setScalar(0.95 + Math.random() * 0.2);

    const stoneMat = new THREE.MeshStandardMaterial({
      color: 0x8a928d,
      roughness: 0.9,
    });
    const glowMat = new THREE.MeshBasicMaterial({ color: 0xffd374 });

    const baseGeom = new THREE.BoxGeometry(1.3, 0.5, 1.3);
    const base = new THREE.Mesh(baseGeom, stoneMat);
    base.position.y = 0.25;
    group.add(base);

    const pillarGeom = new THREE.CylinderGeometry(0.35, 0.45, 1.4, 6);
    const pillar = new THREE.Mesh(pillarGeom, stoneMat);
    pillar.position.y = 1.15;
    group.add(pillar);

    const midGeom = new THREE.CylinderGeometry(0.9, 0.7, 0.35, 6);
    const mid = new THREE.Mesh(midGeom, stoneMat);
    mid.position.y = 1.95;
    group.add(mid);

    const chamberGeom = new THREE.BoxGeometry(0.65, 0.75, 0.65);
    const chamber = new THREE.Mesh(chamberGeom, glowMat);
    chamber.position.y = 2.45;
    group.add(chamber);

    const roofGeom = new THREE.ConeGeometry(1.5, 0.6, 6);
    const roof = new THREE.Mesh(roofGeom, stoneMat);
    roof.position.y = 3.05;
    group.add(roof);

    const capGeom = new THREE.SphereGeometry(0.22, 6, 6);
    const cap = new THREE.Mesh(capGeom, stoneMat);
    cap.position.y = 3.45;
    group.add(cap);

    return group;
  }

  private createMossyBoulders(x: number, y: number, z: number): THREE.Group {
    const group = new THREE.Group();
    group.position.set(x, y - 0.2, z);

    const rockMat = new THREE.MeshStandardMaterial({
      color: 0x6e7870,
      roughness: 0.92,
    });

    const count = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
      const rockGeom = new THREE.DodecahedronGeometry(0.8 + Math.random() * 0.8, 0);
      const rock = new THREE.Mesh(rockGeom, rockMat);
      rock.position.set(
        (Math.random() - 0.5) * 2.8,
        0.5 + Math.random() * 0.4,
        (Math.random() - 0.5) * 2.8
      );
      rock.scale.set(1 + Math.random() * 0.4, 0.75 + Math.random() * 0.5, 1 + Math.random() * 0.4);
      rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
      group.add(rock);
    }

    return group;
  }

  private createMountainCottage(x: number, y: number, z: number): THREE.Group {
    const group = new THREE.Group();
    group.position.set(x, y - 0.2, z);
    group.scale.setScalar(1.2);

    const woodMat = new THREE.MeshLambertMaterial({ color: 0x6d523e });
    const roofMat = new THREE.MeshLambertMaterial({ color: 0xa84234 });
    const windowMat = new THREE.MeshBasicMaterial({ color: 0xffebad });

    const bodyGeom = new THREE.BoxGeometry(4.2, 2.8, 4.2);
    bodyGeom.translate(0, 1.4, 0);
    const body = new THREE.Mesh(bodyGeom, woodMat);
    group.add(body);

    const roofGeom = new THREE.ConeGeometry(3.6, 2.0, 4);
    roofGeom.rotateY(Math.PI / 4);
    roofGeom.translate(0, 3.6, 0);
    const roof = new THREE.Mesh(roofGeom, roofMat);
    group.add(roof);

    const winGeom = new THREE.PlaneGeometry(0.8, 0.8);
    const win1 = new THREE.Mesh(winGeom, windowMat);
    win1.position.set(0, 1.5, 2.12);
    group.add(win1);

    const win2 = new THREE.Mesh(winGeom, windowMat);
    win2.position.set(2.12, 1.5, 0);
    win2.rotation.y = Math.PI / 2;
    group.add(win2);

    return group;
  }

  private createGuardianCamphorTree(x: number, y: number, z: number): THREE.Group {
    const group = new THREE.Group();
    group.position.set(x, y - 0.3, z);
    group.scale.setScalar(1.6 + Math.random() * 0.9);
    group.rotation.y = Math.random() * Math.PI * 2;

    const barkMat = new THREE.MeshStandardMaterial({ color: 0x5c4632, roughness: 0.95 });
    const canopyMat = new THREE.MeshLambertMaterial({ color: 0x3f7a45 });
    const canopyMat2 = new THREE.MeshLambertMaterial({ color: 0x549b57 });
    const hollowMat = new THREE.MeshBasicMaterial({ color: 0x1a140d });

    const trunkGeom = new THREE.CylinderGeometry(1.1, 2.1, 9.5, 8);
    trunkGeom.translate(0, 4.75, 0);
    const trunk = new THREE.Mesh(trunkGeom, barkMat);
    group.add(trunk);

    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2;
      const rootGeom = new THREE.ConeGeometry(0.6, 3.2, 5);
      const root = new THREE.Mesh(rootGeom, barkMat);
      root.position.set(Math.cos(angle) * 1.7, 1.4, Math.sin(angle) * 1.7);
      root.rotation.z = Math.cos(angle) * 0.5;
      root.rotation.x = -Math.sin(angle) * 0.5;
      group.add(root);
    }

    const hollowGeom = new THREE.SphereGeometry(0.55, 8, 8, 0, Math.PI * 2, 0, Math.PI * 0.6);
    const hollow = new THREE.Mesh(hollowGeom, hollowMat);
    hollow.position.set(0, 1.1, 1.85);
    hollow.rotation.x = Math.PI * 0.15;
    group.add(hollow);

    const canopyTiers = [
      { y: 10.5, r: 4.6, mat: canopyMat },
      { y: 9.2, r: 3.6, mat: canopyMat2 },
      { y: 12.2, r: 3.2, mat: canopyMat2 },
      { y: 13.4, r: 2.2, mat: canopyMat },
    ];
    canopyTiers.forEach(t => {
      const cGeom = new THREE.IcosahedronGeometry(t.r, 1);
      const c = new THREE.Mesh(cGeom, t.mat);
      c.position.set((Math.random() - 0.5) * 1.5, t.y, (Math.random() - 0.5) * 1.5);
      c.scale.y = 0.75;
      group.add(c);
    });

    return group;
  }

  private createForestShrineGate(x: number, y: number, z: number): THREE.Group {
    const group = new THREE.Group();
    group.position.set(x, y - 0.3, z);
    group.rotation.y = Math.random() * Math.PI;

    const woodMat = new THREE.MeshStandardMaterial({ color: 0x7a3b32, roughness: 0.85 });
    const mossMat = new THREE.MeshLambertMaterial({ color: 0x4f7a4a });

    const pillarGeom = new THREE.CylinderGeometry(0.28, 0.32, 5.2, 8);
    const leftPillar = new THREE.Mesh(pillarGeom, woodMat);
    leftPillar.position.set(-2.1, 2.6, 0);
    group.add(leftPillar);
    const rightPillar = new THREE.Mesh(pillarGeom, woodMat);
    rightPillar.position.set(2.1, 2.6, 0);
    group.add(rightPillar);

    const topBeamGeom = new THREE.CylinderGeometry(0.32, 0.32, 5.6, 8);
    topBeamGeom.rotateZ(Math.PI / 2);
    const topBeam = new THREE.Mesh(topBeamGeom, woodMat);
    topBeam.position.set(0, 5.3, 0);
    group.add(topBeam);

    const tieBeamGeom = new THREE.CylinderGeometry(0.18, 0.18, 4.3, 6);
    tieBeamGeom.rotateZ(Math.PI / 2);
    const tieBeam = new THREE.Mesh(tieBeamGeom, woodMat);
    tieBeam.position.set(0, 4.3, 0);
    group.add(tieBeam);

    for (let i = 0; i < 4; i++) {
      const mossGeom = new THREE.SphereGeometry(0.35 + Math.random() * 0.2, 6, 6);
      const moss = new THREE.Mesh(mossGeom, mossMat);
      moss.position.set((i % 2 === 0 ? -2.1 : 2.1) + (Math.random() - 0.5) * 0.3, 4.6 + Math.random() * 0.6, (Math.random() - 0.5) * 0.4);
      moss.scale.set(1, 0.6, 1);
      group.add(moss);
    }

    return group;
  }

  private createFireflySwarm(x: number, y: number, z: number): THREE.Group {
    const group = new THREE.Group();
    group.position.set(x, y + 0.8, z);

    const fireflyMat = new THREE.MeshBasicMaterial({ color: 0xcdf28a, transparent: true, opacity: 0.9 });
    const count = 4 + Math.floor(Math.random() * 5);
    const motes: { mesh: THREE.Mesh; phase: number; radius: number; baseY: number }[] = [];

    for (let i = 0; i < count; i++) {
      const geom = new THREE.SphereGeometry(0.09 + Math.random() * 0.06, 6, 6);
      const mote = new THREE.Mesh(geom, fireflyMat);
      const angle = Math.random() * Math.PI * 2;
      const radius = 0.6 + Math.random() * 1.8;
      mote.position.set(Math.cos(angle) * radius, Math.random() * 1.6, Math.sin(angle) * radius);
      group.add(mote);
      motes.push({ mesh: mote, phase: Math.random() * Math.PI * 2, radius, baseY: mote.position.y });
    }

    group.userData.isFireflySwarm = true;
    group.userData.motes = motes;
    return group;
  }

  dispose() {
    this.chunks.forEach(chunk => {
      this.scene.remove(chunk.mesh);
      chunk.mesh.geometry.dispose();
      chunk.foliageInstances.orbs.forEach(o => {
        if (o.mesh) this.scene.remove(o.mesh);
      });
      chunk.foliageInstances.floatingIslands.forEach(isl => {
        if (isl.mesh) this.scene.remove(isl.mesh as THREE.Object3D);
      });
      chunk.foliageInstances.updrafts.forEach(up => {
        this.scene.remove(up.mesh);
      });
      chunk.foliageInstances.decorations.forEach(dec => {
        this.scene.remove(dec);
      });
    });
    this.chunks.clear();
    this.terrainMaterial.dispose();
    this.groundTexture.dispose();
    this.orbGeometry.dispose();
    this.orbMaterial.dispose();
  }
}
