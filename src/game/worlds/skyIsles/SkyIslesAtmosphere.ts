import * as THREE from 'three';
import { GraphicsConfig } from '../../../types';
import { createBillboardClouds, BillboardCloudSet } from './billboardClouds';
import { createCloudDeck, CloudDeck } from './cloudDeck';
import { skyIslesConfig } from './skyIslesConfig';

interface CloudCard {
  cluster: number;
  ox: number;
  y: number;
  oz: number;
  width: number;
  height: number;
}

// Nearest any cloud card edge may come to the road centre line (m). Cards are
// camera-facing, so their half-width is subtracted from the cluster offset.
const CLOUD_ROAD_CLEARANCE = 14;

/**
 * SkyIslesAtmosphere manages:
 * 1. Upper drifting cumulus (soft billboard clouds, one instanced draw)
 * 2. Lower sea of clouds far beneath the floating islands: a shaded cloud
 *    deck (one plane, layered noise) with a few cumulus heads rising out of it
 * 3. Faint sunlit dust motes
 */
export class SkyIslesAtmosphere {
  public group: THREE.Group;
  private scene: THREE.Object3D;

  private clouds: BillboardCloudSet | null = null;
  private cloudSea: BillboardCloudSet | null = null;
  private deck: CloudDeck | null = null;

  // Dust motes
  private particles: THREE.Points | null = null;
  private particleMaterial: THREE.PointsMaterial | null = null;
  private particleGeom: THREE.BufferGeometry | null = null;
  private particlePositions: Float32Array | null = null;

  private cards: CloudCard[] = [];
  private clusterX: Float32Array = new Float32Array(0);
  private clusterZ: Float32Array = new Float32Array(0);
  private clusterSpeed: Float32Array = new Float32Array(0);
  private cloudSeaPositions: { x: number; y: number; z: number; w: number; h: number }[] = [];

  constructor(scene: THREE.Object3D, graphicsConfig: GraphicsConfig) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'SkyIslesAtmosphereGroup';
    this.scene.add(this.group);

    this.initClouds(graphicsConfig);
    this.initParticles(graphicsConfig);
  }

  private initClouds(graphicsConfig: GraphicsConfig): void {
    let cloudCount = 34;
    let cardsPerCluster = 3;
    if (graphicsConfig.preset === 'mobile-opt') {
      cloudCount = 24;
      cardsPerCluster = 2;
    }
    if (graphicsConfig.preset === 'webgl-min') {
      cloudCount = 14;
      cardsPerCluster = 1;
    }

    this.clusterX = new Float32Array(cloudCount);
    this.clusterZ = new Float32Array(cloudCount);
    this.clusterSpeed = new Float32Array(cloudCount);

    for (let c = 0; c < cloudCount; c++) {
      const width = 34 + Math.random() * 30;
      // Whole cluster (card half-widths + 6 m spread + 3.5 m drift) stays
      // CLOUD_ROAD_CLEARANCE metres clear of the road centre line.
      const minX = CLOUD_ROAD_CLEARANCE + width * 0.6 + 6 + 3.5;
      const cx = (Math.random() > 0.5 ? 1 : -1) * (minX + Math.random() * 100);
      const cy = -6.0 + Math.random() * 30.0;
      const cz = (c / cloudCount) * 600 - 100;
      this.clusterX[c] = cx;
      this.clusterZ[c] = cz;
      this.clusterSpeed[c] = 0.5 + Math.random() * 0.8;

      for (let p = 0; p < cardsPerCluster; p++) {
        const w = p === 0 ? width : width * (0.5 + Math.random() * 0.3);
        this.cards.push({
          cluster: c,
          ox: p === 0 ? 0 : (Math.random() - 0.5) * 12,
          y: cy + (p === 0 ? 0 : -2 + Math.random() * 3),
          oz: p === 0 ? 0 : (Math.random() - 0.5) * 16,
          width: w,
          height: w * (0.85 + Math.random() * 0.25),
        });
      }
    }

    this.clouds = createBillboardClouds(this.cards.length, {
      litColor: 0xfff5e8,
      litIntensity: 4.2,
      shadowColor: 0xa3b4c9,
      shadowIntensity: 1.9,
      opacity: 0.96,
    });
    this.group.add(this.clouds.mesh);

    // --- Lower Cloud Ocean Layer ---
    // A continuous deck around Y = -64 so the islands read as floating very
    // high up, with a few cumulus heads (sunlit tops, grey bases) poking out.
    const sp = skyIslesConfig.lighting.sunPosition ?? [30, 80, -120];
    this.deck = createCloudDeck({
      y: -64,
      radius: 1300,
      sun: new THREE.Vector3(sp[0], sp[1], sp[2]),
      lit: 0xfff8ee,
      litIntensity: 3.4,
      shade: 0x93a4bb,
      shadeIntensity: 1.9,
      deep: 0x7f92ad,
    });
    this.group.add(this.deck.mesh);

    let seaCount = 22;
    if (graphicsConfig.preset === 'mobile-opt') seaCount = 14;
    if (graphicsConfig.preset === 'webgl-min') seaCount = 8;
    for (let i = 0; i < seaCount; i++) {
      const w = 60 + Math.random() * 50;
      const side = i % 2 === 0 ? -1 : 1;
      this.cloudSeaPositions.push({
        x: side * (60 + Math.random() * 220),
        y: -62.0 + Math.random() * 5.0,
        z: (i / seaCount) * 800 - 150,
        w,
        h: w * 0.42,
      });
    }
    this.cloudSea = createBillboardClouds(seaCount, {
      litColor: 0xfff8ee,
      litIntensity: 3.4,
      shadowColor: 0x9eadc1,
      shadowIntensity: 1.8,
      opacity: 0.95,
    });
    this.group.add(this.cloudSea.mesh);

    this.update(0, 0, 0);
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
    if (this.clouds) {
      const clusters = this.clusterZ.length;
      for (let c = 0; c < clusters; c++) {
        // Wrap whole clusters so their cards stay together
        const relZ = this.clusterZ[c] - playerZ;
        if (relZ < -120) this.clusterZ[c] += 600;
        else if (relZ > 480) this.clusterZ[c] -= 600;
      }
      for (let i = 0; i < this.cards.length; i++) {
        const cp = this.cards[i];
        const c = cp.cluster;
        const sp = this.clusterSpeed[c];
        // Gentle lateral drift of the whole cluster
        const x = this.clusterX[c] + cp.ox + Math.sin(time * 0.25 * sp + c) * 3.5;
        const y = cp.y + Math.cos(time * 0.35 * sp + c) * 1.0;
        this.clouds.setCloud(i, x, y, this.clusterZ[c] + cp.oz, cp.width, cp.height);
      }
      this.clouds.mesh.instanceMatrix.needsUpdate = true;
    }

    // 2. Stream lower cloud sea
    this.deck?.update(0, playerZ, time);
    if (this.cloudSea) {
      for (let i = 0; i < this.cloudSeaPositions.length; i++) {
        const sp = this.cloudSeaPositions[i];
        const relZ = sp.z - playerZ;
        if (relZ < -200) sp.z += 800;
        if (relZ > 600) sp.z -= 800;
        this.cloudSea.setCloud(i, sp.x, sp.y + Math.sin(time * 0.15 + i) * 1.5, sp.z, sp.w, sp.h);
      }
      this.cloudSea.mesh.instanceMatrix.needsUpdate = true;
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
    this.clouds?.dispose();
    this.cloudSea?.dispose();
    this.deck?.dispose();
    if (this.particles) {
      this.particleGeom?.dispose();
      this.particleMaterial?.dispose();
    }
  }
}
