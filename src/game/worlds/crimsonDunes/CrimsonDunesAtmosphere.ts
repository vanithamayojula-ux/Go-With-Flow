import * as THREE from 'three';
import { GraphicsConfig } from '../../../types';

/**
 * CrimsonDunesAtmosphere manages:
 * 1. Warm red/orange desert horizon haze and dust planes
 * 2. Wind-blown drifting sand particles communicating strong desert breeze
 * 3. Intense golden sun disk and blazing sun glare
 */
export class CrimsonDunesAtmosphere {
  public group: THREE.Group;
  private scene: THREE.Scene;

  // Drifting Sand Dust Particles
  private dustPoints: THREE.Points | null = null;
  private dustGeom: THREE.BufferGeometry | null = null;
  private dustMaterial: THREE.PointsMaterial | null = null;
  private dustPositions: Float32Array | null = null;
  private dustVelocities: { vx: number; vy: number; vz: number }[] = [];

  // Wind streaks / Horizon Dust Haze Planes
  private hazePlanes: THREE.Mesh[] = [];
  private hazeMaterial: THREE.MeshBasicMaterial | null = null;

  // Distant Desert Sun Orb
  private sunDisk: THREE.Mesh | null = null;
  private sunMaterial: THREE.MeshBasicMaterial | null = null;

  constructor(scene: THREE.Scene, graphicsConfig: GraphicsConfig) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'CrimsonDunesAtmosphereGroup';
    this.scene.add(this.group);

    this.initDustParticles(graphicsConfig);
    this.initHazePlanes(graphicsConfig);
    this.initSunDisk();
  }

  private initDustParticles(graphicsConfig: GraphicsConfig): void {
    let count = 320;
    if (graphicsConfig.preset === 'mobile-opt') count = 160;
    if (graphicsConfig.preset === 'webgl-min') count = 70;

    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    const sandWarm = new THREE.Color(0xfdba74); // #FDBA74 warm sand
    const sandOrange = new THREE.Color(0xf97316); // #F97316 burnt orange
    const sandAmber = new THREE.Color(0xfbbf24); // #FBBF24 golden dust mote

    this.dustVelocities = [];

    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * 60;
      const y = 0.5 + Math.random() * 14;
      const z = (Math.random() - 0.5) * 320;

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      // Sand drifts fast with desert crosswind (strong X drift and negative Z motion)
      this.dustVelocities.push({
        vx: 4.5 + Math.random() * 6.5,
        vy: (Math.random() - 0.5) * 0.8,
        vz: -2.0 - Math.random() * 3.0,
      });

      const rndCol = Math.random();
      const col = rndCol > 0.6 ? sandWarm : (rndCol > 0.3 ? sandOrange : sandAmber);
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;
    }

    this.dustGeom = new THREE.BufferGeometry();
    this.dustGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.dustGeom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.dustPositions = positions;

    this.dustMaterial = new THREE.PointsMaterial({
      size: 1.6,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.dustPoints = new THREE.Points(this.dustGeom, this.dustMaterial);
    this.dustPoints.frustumCulled = false;
    this.group.add(this.dustPoints);
  }

  private initHazePlanes(graphicsConfig: GraphicsConfig): void {
    if (graphicsConfig.preset === 'webgl-min') return;

    this.hazeMaterial = new THREE.MeshBasicMaterial({
      color: 0xea580c, // Rich burnt orange dust haze
      transparent: true,
      opacity: 0.14,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    const hazeGeom = new THREE.PlaneGeometry(160, 80);
    hazeGeom.rotateX(-Math.PI / 2);

    const count = graphicsConfig.preset === 'desktop-full' ? 5 : 3;
    for (let i = 0; i < count; i++) {
      const plane = new THREE.Mesh(hazeGeom, this.hazeMaterial);
      plane.position.set((Math.random() - 0.5) * 50, 1.5 + i * 2.8, i * 75 - 40);
      this.hazePlanes.push(plane);
      this.group.add(plane);
    }
  }

  private initSunDisk(): void {
    // Blazing desert sun orb placed high in the sky
    const sunGeom = new THREE.CircleGeometry(24, 20);
    this.sunMaterial = new THREE.MeshBasicMaterial({
      color: 0xfff7ed, // #FFF7ED intense pure white/cream sun core
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    this.sunDisk = new THREE.Mesh(sunGeom, this.sunMaterial);
    this.sunDisk.position.set(70, 75, -280);
    this.group.add(this.sunDisk);
  }

  public update(dt: number, playerZ: number, time: number): void {
    // 1. Animate Drifting Sand Dust
    if (this.dustPoints && this.dustPositions && this.dustGeom) {
      const count = this.dustPositions.length / 3;
      const zWindow = 180;

      for (let i = 0; i < count; i++) {
        const vel = this.dustVelocities[i];
        const idx = i * 3;

        // Apply crosswind
        this.dustPositions[idx] += vel.vx * dt;
        this.dustPositions[idx + 1] += vel.vy * dt;
        this.dustPositions[idx + 2] += vel.vz * dt;

        // Wrap X if blown off-screen
        if (this.dustPositions[idx] > 36) {
          this.dustPositions[idx] = -36;
        }

        // Keep centered along player traversal track
        const currentZ = this.dustPositions[idx + 2];
        const relZ = currentZ - playerZ;

        if (relZ < -60) {
          this.dustPositions[idx + 2] = playerZ + zWindow + Math.random() * 50;
        } else if (relZ > zWindow + 60) {
          this.dustPositions[idx + 2] = playerZ - 40 - Math.random() * 20;
        }
      }

      this.dustGeom.attributes.position.needsUpdate = true;
    }

    // 2. Animate Horizon Haze Layers
    for (let i = 0; i < this.hazePlanes.length; i++) {
      const plane = this.hazePlanes[i];
      plane.rotation.z = Math.sin(time * 0.15 + i) * 0.04;
      if (plane.position.z < playerZ - 90) {
        plane.position.z += 280;
      }
    }

    // 3. Anchor distant desert sun orb relative to player
    if (this.sunDisk) {
      this.sunDisk.position.z = playerZ - 280;
    }
  }

  public dispose(): void {
    this.scene.remove(this.group);

    if (this.dustGeom) this.dustGeom.dispose();
    if (this.dustMaterial) this.dustMaterial.dispose();
    if (this.hazeMaterial) this.hazeMaterial.dispose();
    if (this.sunMaterial) this.sunMaterial.dispose();

    for (const plane of this.hazePlanes) {
      plane.geometry.dispose();
    }
    this.hazePlanes = [];

    if (this.sunDisk) {
      this.sunDisk.geometry.dispose();
      this.sunDisk = null;
    }
  }
}
