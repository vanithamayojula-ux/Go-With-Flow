import * as THREE from 'three';
import { GraphicsConfig } from '../../../types';

/**
 * SkyIslesAtmosphere manages:
 * 1. Upper drifting cloud clusters (overlapping low-poly puffs)
 * 2. Lower sea-of-clouds ocean bed beneath the floating islands
 * 3. Restrained drifting light motes / golden sun dust particles
 */
export class SkyIslesAtmosphere {
  public group: THREE.Group;
  private scene: THREE.Scene;

  // Cloud meshes (instanced low-poly spheres)
  private cloudMesh: THREE.InstancedMesh | null = null;
  private cloudSeaMesh: THREE.InstancedMesh | null = null;
  private cloudMaterial: THREE.MeshLambertMaterial;
  private cloudSeaMaterial: THREE.MeshLambertMaterial;

  // Light Motes / Sun Dust Particles
  private particles: THREE.Points | null = null;
  private particleMaterial: THREE.PointsMaterial | null = null;
  private particleGeom: THREE.BufferGeometry | null = null;
  private particlePositions: Float32Array | null = null;

  private dummy = new THREE.Object3D();
  private cloudPositions: { x: number; y: number; z: number; scale: number; speed: number }[] = [];
  private cloudSeaPositions: { x: number; y: number; z: number; scale: number }[] = [];

  constructor(scene: THREE.Scene, graphicsConfig: GraphicsConfig) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'SkyIslesAtmosphereGroup';
    this.scene.add(this.group);

    // Soft cloud white (#F8FAFC) with gentle shadow tint (#CBD5E1)
    this.cloudMaterial = new THREE.MeshLambertMaterial({
      color: 0xf8fafc,
      transparent: true,
      opacity: 0.90,
      flatShading: true,
    });

    // Lower vast cloud ocean bed (#E0F2FE)
    this.cloudSeaMaterial = new THREE.MeshLambertMaterial({
      color: 0xbae6fd,
      transparent: true,
      opacity: 0.85,
      flatShading: true,
    });

    this.initClouds(graphicsConfig);
    this.initParticles(graphicsConfig);
  }

  private initClouds(graphicsConfig: GraphicsConfig): void {
    // Shared low-poly puff sphere geometry
    const puffGeom = new THREE.DodecahedronGeometry(6.0, 1);

    let cloudCount = 45;
    if (graphicsConfig.preset === 'mobile-opt') cloudCount = 28;
    if (graphicsConfig.preset === 'webgl-min') cloudCount = 14;

    this.cloudMesh = new THREE.InstancedMesh(puffGeom, this.cloudMaterial, cloudCount * 4);
    this.cloudMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.group.add(this.cloudMesh);

    // Generate procedural cloud cluster positions across sky around traversal track
    let idx = 0;
    for (let c = 0; c < cloudCount; c++) {
      const cx = (Math.random() - 0.5) * 240 + (Math.random() > 0.5 ? 40 : -40);
      const cy = -8.0 + Math.random() * 32.0;
      const cz = (c / cloudCount) * 600 - 100;
      const baseScale = 1.2 + Math.random() * 2.2;
      const speed = 0.5 + Math.random() * 0.8;

      // 3–4 puffs per cluster
      for (let p = 0; p < 3; p++) {
        const ox = (Math.random() - 0.5) * 12.0;
        const oy = (Math.random() - 0.5) * 4.0;
        const oz = (Math.random() - 0.5) * 12.0;
        const scale = baseScale * (0.8 + Math.random() * 0.5);

        this.cloudPositions.push({
          x: cx + ox,
          y: cy + oy,
          z: cz + oz,
          scale,
          speed,
        });

        this.dummy.position.set(cx + ox, cy + oy, cz + oz);
        this.dummy.scale.set(scale, scale * 0.65, scale);
        this.dummy.rotation.set(0, Math.random() * Math.PI, 0);
        this.dummy.updateMatrix();
        this.cloudMesh.setMatrixAt(idx++, this.dummy.matrix);
      }
    }
    this.cloudMesh.count = idx;
    this.cloudMesh.instanceMatrix.needsUpdate = true;

    // --- Lower Cloud Ocean Layer ---
    // Sits at Y = -45 to -60 to communicate grand vertical height above the world
    const seaPuffGeom = new THREE.DodecahedronGeometry(22.0, 1);
    let seaCount = 36;
    if (graphicsConfig.preset === 'mobile-opt') seaCount = 20;
    if (graphicsConfig.preset === 'webgl-min') seaCount = 10;

    this.cloudSeaMesh = new THREE.InstancedMesh(seaPuffGeom, this.cloudSeaMaterial, seaCount);
    this.group.add(this.cloudSeaMesh);

    for (let i = 0; i < seaCount; i++) {
      const sx = (Math.random() - 0.5) * 360;
      const sy = -52.0 + (Math.random() - 0.5) * 8.0;
      const sz = (i / seaCount) * 800 - 150;
      const sScale = 1.5 + Math.random() * 1.5;

      this.cloudSeaPositions.push({ x: sx, y: sy, z: sz, scale: sScale });

      this.dummy.position.set(sx, sy, sz);
      this.dummy.scale.set(sScale * 1.4, sScale * 0.45, sScale * 1.4);
      this.dummy.rotation.set(0, Math.random() * Math.PI, 0);
      this.dummy.updateMatrix();
      this.cloudSeaMesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.cloudSeaMesh.count = seaCount;
    this.cloudSeaMesh.instanceMatrix.needsUpdate = true;
  }

  private initParticles(graphicsConfig: GraphicsConfig): void {
    let particleCount = 120;
    if (graphicsConfig.preset === 'mobile-opt') particleCount = 60;
    if (graphicsConfig.preset === 'webgl-min') particleCount = 0;

    if (particleCount === 0) return;

    this.particlePositions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      this.particlePositions[i * 3 + 0] = (Math.random() - 0.5) * 45;
      this.particlePositions[i * 3 + 1] = Math.random() * 18 + 0.5;
      this.particlePositions[i * 3 + 2] = Math.random() * 160 - 20;
    }

    this.particleGeom = new THREE.BufferGeometry();
    this.particleGeom.setAttribute('position', new THREE.BufferAttribute(this.particlePositions, 3));

    // Luminous sunlight motes & energy spores (#22D3EE and warm yellow)
    this.particleMaterial = new THREE.PointsMaterial({
      color: 0x67e8f9,
      size: 0.35,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.particles = new THREE.Points(this.particleGeom, this.particleMaterial);
    this.group.add(this.particles);
  }

  public update(dt: number, playerZ: number, time: number): void {
    // 1. Stream upper cloud puffs along player traversal Z
    if (this.cloudMesh) {
      let idx = 0;
      const total = this.cloudPositions.length;
      for (let i = 0; i < total; i++) {
        const cp = this.cloudPositions[i];
        let relZ = cp.z - playerZ;

        // Wrap clouds ahead if they fall behind player
        if (relZ < -120) {
          cp.z += 600;
          relZ = cp.z - playerZ;
        } else if (relZ > 480) {
          cp.z -= 600;
          relZ = cp.z - playerZ;
        }

        // Gentle lateral drift
        const driftX = cp.x + Math.sin(time * 0.25 * cp.speed + i) * 3.5;
        const driftY = cp.y + Math.cos(time * 0.35 * cp.speed + i) * 1.5;

        this.dummy.position.set(driftX, driftY, cp.z);
        this.dummy.scale.set(cp.scale, cp.scale * 0.65, cp.scale);
        this.dummy.rotation.set(0, (i * 0.4) + time * 0.05 * cp.speed, 0);
        this.dummy.updateMatrix();

        this.cloudMesh.setMatrixAt(idx++, this.dummy.matrix);
      }
      this.cloudMesh.instanceMatrix.needsUpdate = true;
    }

    // 2. Stream lower cloud sea
    if (this.cloudSeaMesh) {
      const seaTotal = this.cloudSeaPositions.length;
      for (let i = 0; i < seaTotal; i++) {
        const sp = this.cloudSeaPositions[i];
        let relZ = sp.z - playerZ;
        if (relZ < -200) sp.z += 800;
        if (relZ > 600) sp.z -= 800;

        const bobY = sp.y + Math.sin(time * 0.4 + i) * 2.0;
        this.dummy.position.set(sp.x, bobY, sp.z);
        this.dummy.scale.set(sp.scale * 1.4, sp.scale * 0.45, sp.scale * 1.4);
        this.dummy.updateMatrix();
        this.cloudSeaMesh.setMatrixAt(i, this.dummy.matrix);
      }
      this.cloudSeaMesh.instanceMatrix.needsUpdate = true;
    }

    // 3. Update light motes drifting gently in the breeze
    if (this.particles && this.particlePositions && this.particleGeom) {
      const count = this.particlePositions.length / 3;
      for (let i = 0; i < count; i++) {
        let pz = this.particlePositions[i * 3 + 2];
        if (pz < playerZ - 20) {
          pz = playerZ + 140 + Math.random() * 20;
          this.particlePositions[i * 3 + 0] = (Math.random() - 0.5) * 40;
          this.particlePositions[i * 3 + 1] = Math.random() * 16 + 1.0;
        }
        // Drift forward slightly and bob
        this.particlePositions[i * 3 + 1] += Math.sin(time * 2.0 + i) * 0.02;
        this.particlePositions[i * 3 + 2] = pz;
      }
      this.particleGeom.attributes.position.needsUpdate = true;
    }
  }

  public dispose(): void {
    this.scene.remove(this.group);
    if (this.cloudMesh) {
      this.cloudMesh.geometry.dispose();
      this.cloudMaterial.dispose();
    }
    if (this.cloudSeaMesh) {
      this.cloudSeaMesh.geometry.dispose();
      this.cloudSeaMaterial.dispose();
    }
    if (this.particles) {
      this.particleGeom?.dispose();
      this.particleMaterial?.dispose();
    }
  }
}
