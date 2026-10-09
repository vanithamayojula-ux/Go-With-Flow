import * as THREE from 'three';
import { GraphicsConfig } from '../../../types';

/**
 * ObsidianCoreAtmosphere manages:
 * 1. Rising volcanic ember particles (swirling, incandescent sparks)
 * 2. Deep volcanic smoke & cinder haze planes
 * 3. Giant horizon caldera magma glow ring
 */
export class ObsidianCoreAtmosphere {
  public group: THREE.Group;
  private scene: THREE.Scene;

  // Rising Glowing Embers Particle System
  private emberPoints: THREE.Points | null = null;
  private emberGeom: THREE.BufferGeometry | null = null;
  private emberMaterial: THREE.PointsMaterial | null = null;
  private emberPositions: Float32Array | null = null;
  private emberVelocities: { vy: number; vx: number; phase: number }[] = [];

  // Volcanic Smoke & Cinder Haze Planes
  private smokePlanes: THREE.Mesh[] = [];
  private smokeMaterial: THREE.MeshBasicMaterial | null = null;

  // Distant Horizon Magma Ring Halo (Caldera glow from hero concept art)
  private magmaHalo: THREE.Mesh | null = null;
  private haloMaterial: THREE.MeshBasicMaterial | null = null;

  constructor(scene: THREE.Scene, graphicsConfig: GraphicsConfig) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'ObsidianCoreAtmosphereGroup';
    this.scene.add(this.group);

    this.initEmberParticles(graphicsConfig);
    this.initSmokePlanes(graphicsConfig);
    this.initMagmaHalo();
  }

  private initEmberParticles(graphicsConfig: GraphicsConfig): void {
    let count = 350;
    if (graphicsConfig.preset === 'mobile-opt') count = 180;
    if (graphicsConfig.preset === 'webgl-min') count = 80;

    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    const flameYellow = new THREE.Color(0xfef08a); // #FEF08A incandescent bright spark
    const flameOrange = new THREE.Color(0xf97316); // #F97316 molten orange ember
    const flameCrimson = new THREE.Color(0xdc2626); // #DC2626 cooling red cinder

    this.emberVelocities = [];

    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * 55;
      const y = Math.random() * 22;
      const z = (Math.random() - 0.5) * 320;

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      this.emberVelocities.push({
        vy: 3.5 + Math.random() * 5.0,
        vx: (Math.random() - 0.5) * 1.5,
        phase: Math.random() * Math.PI * 2,
      });

      const rnd = Math.random();
      const col = rnd > 0.6 ? flameYellow : (rnd > 0.25 ? flameOrange : flameCrimson);
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;
    }

    this.emberGeom = new THREE.BufferGeometry();
    this.emberGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.emberGeom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.emberPositions = positions;

    this.emberMaterial = new THREE.PointsMaterial({
      size: 1.7,
      vertexColors: true,
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.emberPoints = new THREE.Points(this.emberGeom, this.emberMaterial);
    this.emberPoints.frustumCulled = false;
    this.group.add(this.emberPoints);
  }

  private initSmokePlanes(graphicsConfig: GraphicsConfig): void {
    if (graphicsConfig.preset === 'webgl-min') return;

    this.smokeMaterial = new THREE.MeshBasicMaterial({
      color: 0x450a0a, // Smoky charred maroon
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    const smokeGeom = new THREE.PlaneGeometry(160, 85);
    smokeGeom.rotateX(-Math.PI / 2);

    const count = graphicsConfig.preset === 'desktop-full' ? 6 : 3;
    for (let i = 0; i < count; i++) {
      const plane = new THREE.Mesh(smokeGeom, this.smokeMaterial);
      plane.position.set((Math.random() - 0.5) * 45, 1.8 + i * 3.0, i * 75 - 40);
      this.smokePlanes.push(plane);
      this.group.add(plane);
    }
  }

  private initMagmaHalo(): void {
    // Glowing caldera fire ring in the distant horizon (from hero concept art)
    const ringGeom = new THREE.RingGeometry(35, 48, 24);
    this.haloMaterial = new THREE.MeshBasicMaterial({
      color: 0xea580c, // Intense glowing lava orange
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    this.magmaHalo = new THREE.Mesh(ringGeom, this.haloMaterial);
    this.magmaHalo.position.set(0, 52, -280);
    this.group.add(this.magmaHalo);
  }

  public update(dt: number, playerZ: number, time: number): void {
    // 1. Follow player for Horizon Caldera Glow
    if (this.magmaHalo) {
      this.magmaHalo.position.z = playerZ - 280;
      this.magmaHalo.rotation.z = time * 0.1;
    }

    // 2. Animate Rising Volcanic Embers
    if (this.emberPoints && this.emberPositions && this.emberGeom) {
      const count = this.emberPositions.length / 3;
      const zWindow = 180;

      for (let i = 0; i < count; i++) {
        const vel = this.emberVelocities[i];
        const idx = i * 3;

        // Rise upward with thermal buoyancy
        this.emberPositions[idx + 1] += vel.vy * dt;
        this.emberPositions[idx] += Math.sin(time * 2.0 + vel.phase) * 0.05;

        // Reset if risen too high
        if (this.emberPositions[idx + 1] > 26.0) {
          this.emberPositions[idx + 1] = 0.5 + Math.random() * 2.0;
        }

        const currentZ = this.emberPositions[idx + 2];
        const relZ = currentZ - playerZ;

        if (relZ < -60) {
          this.emberPositions[idx + 2] = playerZ + zWindow + Math.random() * 45;
        } else if (relZ > zWindow + 50) {
          this.emberPositions[idx + 2] = playerZ - 40 - Math.random() * 20;
        }
      }

      this.emberGeom.attributes.position.needsUpdate = true;
    }

    // 3. Animate Smoke Haze Layers
    for (let i = 0; i < this.smokePlanes.length; i++) {
      const plane = this.smokePlanes[i];
      plane.rotation.z = Math.sin(time * 0.12 + i) * 0.04;
      if (plane.position.z < playerZ - 90) {
        plane.position.z += 280;
      }
    }
  }

  public dispose(): void {
    this.scene.remove(this.group);

    if (this.emberGeom) this.emberGeom.dispose();
    if (this.emberMaterial) this.emberMaterial.dispose();
    if (this.smokeMaterial) this.smokeMaterial.dispose();
    if (this.haloMaterial) this.haloMaterial.dispose();

    for (const plane of this.smokePlanes) {
      plane.geometry.dispose();
    }
    this.smokePlanes = [];

    if (this.magmaHalo) {
      this.magmaHalo.geometry.dispose();
      this.magmaHalo = null;
    }
  }
}
