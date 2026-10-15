import * as THREE from 'three';
import { GraphicsConfig } from '../../../types';

interface CloudPuff {
  cluster: number;
  ox: number;
  y: number;
  oz: number;
  scale: number;
  sy: number;
  rot: number;
  speed: number;
}

/**
 * Smooth, gently lumpy puff geometry. Vertices are pushed radially by a
 * position-based noise (identical for shared corners, so no cracks) while the
 * normals stay radial, which keeps the shading soft like scattered light.
 */
function createPuffGeometry(radius: number, detail: number, lumpiness: number): THREE.BufferGeometry {
  const geom = new THREE.IcosahedronGeometry(radius, detail);
  const pos = geom.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) / radius;
    const y = pos.getY(i) / radius;
    const z = pos.getZ(i) / radius;
    const n =
      Math.sin(x * 3.1 + 0.7) * Math.sin(y * 2.7 + 1.9) * Math.sin(z * 3.3 + 0.2) * 0.7 +
      Math.sin(x * 7.3 + 2.1) * Math.sin(y * 6.9 + 0.5) * Math.sin(z * 7.7 + 1.3) * 0.3;
    const k = 1 + n * lumpiness;
    pos.setXYZ(i, pos.getX(i) * k, pos.getY(i) * k, pos.getZ(i) * k);
  }
  pos.needsUpdate = true;
  geom.computeBoundingSphere();
  return geom;
}

/**
 * SkyIslesAtmosphere manages:
 * 1. Upper drifting cumulus clusters (instanced soft puffs)
 * 2. Lower sea-of-clouds bed far beneath the floating islands
 * 3. Faint sunlit dust motes
 */
export class SkyIslesAtmosphere {
  public group: THREE.Group;
  private scene: THREE.Scene;

  // Cloud meshes (instanced puffs)
  private cloudMesh: THREE.InstancedMesh | null = null;
  private cloudSeaMesh: THREE.InstancedMesh | null = null;
  private cloudMaterial: THREE.MeshStandardMaterial;
  private cloudSeaMaterial: THREE.MeshStandardMaterial;

  // Dust motes
  private particles: THREE.Points | null = null;
  private particleMaterial: THREE.PointsMaterial | null = null;
  private particleGeom: THREE.BufferGeometry | null = null;
  private particlePositions: Float32Array | null = null;

  private dummy = new THREE.Object3D();
  private cloudPositions: CloudPuff[] = [];
  private clusterX: Float32Array = new Float32Array(0);
  private clusterZ: Float32Array = new Float32Array(0);
  private clusterSpeed: Float32Array = new Float32Array(0);
  private cloudSeaPositions: { x: number; y: number; z: number; scale: number; rot: number }[] = [];

  constructor(scene: THREE.Scene, graphicsConfig: GraphicsConfig) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'SkyIslesAtmosphereGroup';
    this.scene.add(this.group);

    // Cumulus: matte white, lit by sun + sky IBL, softly translucent
    this.cloudMaterial = new THREE.MeshStandardMaterial({
      color: 0xf6f7f8,
      roughness: 1.0,
      metalness: 0.0,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });

    // Sea of clouds far below: slightly greyer (in the islands' shade / haze)
    this.cloudSeaMaterial = new THREE.MeshStandardMaterial({
      color: 0xe9edf1,
      roughness: 1.0,
      metalness: 0.0,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
    });

    this.initClouds(graphicsConfig);
    this.initParticles(graphicsConfig);
  }

  private initClouds(graphicsConfig: GraphicsConfig): void {
    const desktop = graphicsConfig.preset === 'desktop-full';
    const puffGeom = createPuffGeometry(6.0, desktop ? 3 : 2, 0.07);

    let cloudCount = 40;
    let puffsPerCluster = 7;
    if (graphicsConfig.preset === 'mobile-opt') {
      cloudCount = 26;
      puffsPerCluster = 5;
    }
    if (graphicsConfig.preset === 'webgl-min') {
      cloudCount = 14;
      puffsPerCluster = 4;
    }

    this.cloudMesh = new THREE.InstancedMesh(puffGeom, this.cloudMaterial, cloudCount * puffsPerCluster);
    this.cloudMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.cloudMesh.frustumCulled = false; // instances span the whole corridor
    this.group.add(this.cloudMesh);

    this.clusterX = new Float32Array(cloudCount);
    this.clusterZ = new Float32Array(cloudCount);
    this.clusterSpeed = new Float32Array(cloudCount);

    let idx = 0;
    for (let c = 0; c < cloudCount; c++) {
      // Puffs reach ~26 m (6 m geometry x up to ~4.4 scale) plus 6 m cluster
      // spread and 3.5 m drift, so centres stay >= 45 m off the road centre line.
      // The old spread could put a cluster right across the lanes.
      const cx = (Math.random() > 0.5 ? 1 : -1) * (45 + Math.random() * 110);
      const cy = -8.0 + Math.random() * 32.0;
      const cz = (c / cloudCount) * 600 - 100;
      const baseScale = 1.2 + Math.random() * 2.2;
      const speed = 0.5 + Math.random() * 0.8;
      this.clusterX[c] = cx;
      this.clusterZ[c] = cz;
      this.clusterSpeed[c] = speed;

      // Cumulus build-up: one big core, a ring of smaller flank puffs and a
      // couple of rising turrets; flat-ish bases. Offsets stay within +/-6 m and
      // scales within 1.3x baseScale to respect the clearance envelope above.
      for (let p = 0; p < puffsPerCluster; p++) {
        let ox = 0;
        let oy = 0;
        let oz = 0;
        let scale = baseScale * (1.1 + Math.random() * 0.2);
        let sy = 0.62;
        if (p > 0) {
          const ang = (p / (puffsPerCluster - 1)) * Math.PI * 2 + Math.random() * 0.6;
          const rad = 3.0 + Math.random() * 3.0;
          ox = Math.cos(ang) * rad;
          oz = Math.sin(ang) * rad;
          const turret = p % 3 === 0;
          oy = turret ? 1.5 + Math.random() * 2.0 : -1.0 + Math.random() * 1.5;
          scale = baseScale * (turret ? 0.5 + Math.random() * 0.25 : 0.6 + Math.random() * 0.35);
          sy = turret ? 0.8 : 0.58;
        }

        const puff: CloudPuff = {
          cluster: c,
          ox,
          y: cy + oy,
          oz,
          scale,
          sy,
          rot: Math.random() * Math.PI,
          speed,
        };
        this.cloudPositions.push(puff);

        this.dummy.position.set(cx + ox, puff.y, cz + oz);
        this.dummy.scale.set(scale, scale * sy, scale);
        this.dummy.rotation.set(0, puff.rot, 0);
        this.dummy.updateMatrix();
        this.cloudMesh.setMatrixAt(idx++, this.dummy.matrix);
      }
    }
    this.cloudMesh.count = idx;
    this.cloudMesh.instanceMatrix.needsUpdate = true;

    // --- Lower Cloud Ocean Layer ---
    // Sits around Y = -52 so the islands read as floating very high up.
    const seaPuffGeom = createPuffGeometry(22.0, desktop ? 3 : 2, 0.06);
    let seaCount = 64;
    if (graphicsConfig.preset === 'mobile-opt') seaCount = 32;
    if (graphicsConfig.preset === 'webgl-min') seaCount = 14;

    this.cloudSeaMesh = new THREE.InstancedMesh(seaPuffGeom, this.cloudSeaMaterial, seaCount);
    this.cloudSeaMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.cloudSeaMesh.frustumCulled = false;
    this.group.add(this.cloudSeaMesh);

    for (let i = 0; i < seaCount; i++) {
      const sx = (Math.random() - 0.5) * 420;
      const sy = -52.0 + (Math.random() - 0.5) * 8.0;
      const sz = (i / seaCount) * 800 - 150;
      const sScale = 1.5 + Math.random() * 1.5;
      const rot = Math.random() * Math.PI;

      this.cloudSeaPositions.push({ x: sx, y: sy, z: sz, scale: sScale, rot });

      this.dummy.position.set(sx, sy, sz);
      this.dummy.scale.set(sScale * 1.4, sScale * 0.45, sScale * 1.4);
      this.dummy.rotation.set(0, rot, 0);
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

    // Faint sunlit dust / pollen: tiny, warm white, normal blending (no neon)
    this.particleMaterial = new THREE.PointsMaterial({
      color: 0xfff4e0,
      size: 0.06,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    });

    this.particles = new THREE.Points(this.particleGeom, this.particleMaterial);
    this.group.add(this.particles);
  }

  public update(dt: number, playerZ: number, time: number): void {
    // 1. Stream upper cloud clusters along player traversal Z
    if (this.cloudMesh) {
      const clusters = this.clusterZ.length;
      for (let c = 0; c < clusters; c++) {
        // Wrap whole clusters so their puffs stay together
        const relZ = this.clusterZ[c] - playerZ;
        if (relZ < -120) this.clusterZ[c] += 600;
        else if (relZ > 480) this.clusterZ[c] -= 600;
      }

      const total = this.cloudPositions.length;
      for (let i = 0; i < total; i++) {
        const cp = this.cloudPositions[i];
        const c = cp.cluster;
        const sp = this.clusterSpeed[c];

        // Gentle lateral drift of the whole cluster
        const driftX = this.clusterX[c] + cp.ox + Math.sin(time * 0.25 * sp + c) * 3.5;
        const driftY = cp.y + Math.cos(time * 0.35 * sp + c) * 1.5;

        this.dummy.position.set(driftX, driftY, this.clusterZ[c] + cp.oz);
        this.dummy.scale.set(cp.scale, cp.scale * cp.sy, cp.scale);
        this.dummy.rotation.set(0, cp.rot + time * 0.02 * cp.speed, 0);
        this.dummy.updateMatrix();

        this.cloudMesh.setMatrixAt(i, this.dummy.matrix);
      }
      this.cloudMesh.instanceMatrix.needsUpdate = true;
    }

    // 2. Stream lower cloud sea
    if (this.cloudSeaMesh) {
      const seaTotal = this.cloudSeaPositions.length;
      for (let i = 0; i < seaTotal; i++) {
        const sp = this.cloudSeaPositions[i];
        const relZ = sp.z - playerZ;
        if (relZ < -200) sp.z += 800;
        if (relZ > 600) sp.z -= 800;

        const bobY = sp.y + Math.sin(time * 0.15 + i) * 1.5;
        this.dummy.position.set(sp.x, bobY, sp.z);
        this.dummy.scale.set(sp.scale * 1.4, sp.scale * 0.45, sp.scale * 1.4);
        this.dummy.rotation.set(0, sp.rot, 0);
        this.dummy.updateMatrix();
        this.cloudSeaMesh.setMatrixAt(i, this.dummy.matrix);
      }
      this.cloudSeaMesh.instanceMatrix.needsUpdate = true;
    }

    // 3. Dust motes drifting gently in the breeze
    if (this.particles && this.particlePositions && this.particleGeom) {
      const count = this.particlePositions.length / 3;
      for (let i = 0; i < count; i++) {
        let pz = this.particlePositions[i * 3 + 2];
        if (pz < playerZ - 20) {
          pz = playerZ + 140 + Math.random() * 20;
          this.particlePositions[i * 3 + 0] = (Math.random() - 0.5) * 40;
          this.particlePositions[i * 3 + 1] = Math.random() * 16 + 1.0;
        }
        this.particlePositions[i * 3 + 1] += Math.sin(time * 1.2 + i) * 0.01;
        this.particlePositions[i * 3 + 2] = pz;
      }
      this.particleGeom.attributes.position.needsUpdate = true;
    }
  }

  public dispose(): void {
    this.scene.remove(this.group);
    if (this.cloudMesh) {
      this.cloudMesh.geometry.dispose();
      this.cloudMesh.dispose();
    }
    this.cloudMaterial.dispose();
    if (this.cloudSeaMesh) {
      this.cloudSeaMesh.geometry.dispose();
      this.cloudSeaMesh.dispose();
    }
    this.cloudSeaMaterial.dispose();
    if (this.particles) {
      this.particleGeom?.dispose();
      this.particleMaterial?.dispose();
    }
  }
}
