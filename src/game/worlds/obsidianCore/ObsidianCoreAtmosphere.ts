import * as THREE from 'three';
import { GraphicsConfig } from '../../../types';

/** Soft round particle sprite (radial gradient). Null without a DOM. */
function createSoftSpriteTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0.0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.75)');
  g.addColorStop(0.6, 'rgba(255,255,255,0.18)');
  g.addColorStop(1.0, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

const EMBER_TOP_Y = 20.0;
const ASH_TOP_Y = 18.0;
const SMOKE_BASE_Y = 14.0;

/**
 * ObsidianCoreAtmosphere manages:
 * 1. Small warm embers rising from the lava channels (HDR, additive, soft sprites)
 * 2. Sparse grey ash drifting down
 * 3. High dark-grey smoke layers (y >= 14, well above rider and camera)
 * 4. A faint warm eruption glow low on the horizon ahead
 */
export class ObsidianCoreAtmosphere {
  public group: THREE.Group;
  private scene: THREE.Object3D;

  private spriteTexture: THREE.CanvasTexture | null = null;

  // Rising embers
  private emberPoints: THREE.Points | null = null;
  private emberGeom: THREE.BufferGeometry | null = null;
  private emberMaterial: THREE.PointsMaterial | null = null;
  private emberPositions: Float32Array | null = null;
  private emberVelocities: { vy: number; vx: number; phase: number }[] = [];

  // Falling ash
  private ashPoints: THREE.Points | null = null;
  private ashGeom: THREE.BufferGeometry | null = null;
  private ashMaterial: THREE.PointsMaterial | null = null;
  private ashPositions: Float32Array | null = null;
  private ashVelocities: Float32Array | null = null;

  // High smoke layers
  private smokePlanes: THREE.Mesh[] = [];
  private smokeMaterial: THREE.MeshBasicMaterial | null = null;

  // Distant eruption glow (kept under its original name)
  private magmaHalo: THREE.Mesh | null = null;
  private haloMaterial: THREE.MeshBasicMaterial | null = null;

  constructor(scene: THREE.Object3D, graphicsConfig: GraphicsConfig) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'ObsidianCoreAtmosphereGroup';
    this.scene.add(this.group);

    this.spriteTexture = createSoftSpriteTexture();

    this.initEmberParticles(graphicsConfig);
    this.initAshParticles(graphicsConfig);
    this.initSmokePlanes(graphicsConfig);
    this.initMagmaHalo();
  }

  private initEmberParticles(graphicsConfig: GraphicsConfig): void {
    let count = 350;
    if (graphicsConfig.preset === 'mobile-opt') count = 180;
    if (graphicsConfig.preset === 'webgl-min') count = 80;

    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    this.emberVelocities = [];

    for (let i = 0; i < count; i++) {
      // Most embers come off the lava channels (|x| 10.6..17.6), a few drift wider
      const side = Math.random() > 0.5 ? 1 : -1;
      const x = Math.random() < 0.75
        ? side * (10.6 + Math.random() * 7.0)
        : (Math.random() - 0.5) * 60;
      positions[i * 3] = x;
      positions[i * 3 + 1] = -1.3 + Math.random() * EMBER_TOP_Y;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 320;

      this.emberVelocities.push({
        vy: 0.9 + Math.random() * 1.8,
        vx: (Math.random() - 0.5) * 0.6,
        phase: Math.random() * Math.PI * 2,
      });

      // HDR warm orange (values > 1 bloom); some cooler dull-red cinders
      const heat = 0.35 + Math.random() * 0.65;
      colors[i * 3] = 3.2 * heat;
      colors[i * 3 + 1] = (0.55 + heat * 0.6) * heat;
      colors[i * 3 + 2] = 0.08 * heat;
    }

    this.emberGeom = new THREE.BufferGeometry();
    this.emberGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.emberGeom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.emberPositions = positions;

    this.emberMaterial = new THREE.PointsMaterial({
      size: this.spriteTexture ? 0.28 : 0.12,
      map: this.spriteTexture,
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });

    this.emberPoints = new THREE.Points(this.emberGeom, this.emberMaterial);
    this.emberPoints.frustumCulled = false;
    this.group.add(this.emberPoints);
  }

  private initAshParticles(graphicsConfig: GraphicsConfig): void {
    let count = 140;
    if (graphicsConfig.preset === 'mobile-opt') count = 70;
    if (graphicsConfig.preset === 'webgl-min') count = 30;

    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 2);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 60;
      positions[i * 3 + 1] = Math.random() * ASH_TOP_Y;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 320;
      velocities[i * 2] = -(0.25 + Math.random() * 0.5); // fall speed
      velocities[i * 2 + 1] = 0.4 + Math.random() * 0.8; // wind drift along +x
    }

    this.ashGeom = new THREE.BufferGeometry();
    this.ashGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.ashPositions = positions;
    this.ashVelocities = velocities;

    this.ashMaterial = new THREE.PointsMaterial({
      color: 0x6b6763,
      size: this.spriteTexture ? 0.16 : 0.07,
      map: this.spriteTexture,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
      sizeAttenuation: true,
    });

    this.ashPoints = new THREE.Points(this.ashGeom, this.ashMaterial);
    this.ashPoints.frustumCulled = false;
    this.group.add(this.ashPoints);
  }

  private initSmokePlanes(graphicsConfig: GraphicsConfig): void {
    if (graphicsConfig.preset === 'webgl-min') return;

    // Dark grey volcanic smoke, soft-edged, high above the road
    this.smokeMaterial = new THREE.MeshBasicMaterial({
      color: 0x3a3836,
      map: this.spriteTexture,
      transparent: true,
      opacity: this.spriteTexture ? 0.22 : 0.08,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    const smokeGeom = new THREE.PlaneGeometry(160, 85);
    smokeGeom.rotateX(-Math.PI / 2);

    const count = graphicsConfig.preset === 'desktop-full' ? 6 : 3;
    for (let i = 0; i < count; i++) {
      const plane = new THREE.Mesh(smokeGeom, this.smokeMaterial);
      plane.position.set((Math.random() - 0.5) * 45, SMOKE_BASE_Y + i * 2.5, i * 75 - 40);
      plane.renderOrder = 1;
      this.smokePlanes.push(plane);
      this.group.add(plane);
    }
  }

  private initMagmaHalo(): void {
    // Faint warm glow of distant eruptions reflecting off the ash cloud, low on the
    // horizon ahead. Soft-edged, additive, occluded by terrain.
    const glowGeom = new THREE.PlaneGeometry(320, 70);
    this.haloMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color(0xff5a1e).multiplyScalar(0.5),
      map: this.spriteTexture,
      transparent: true,
      opacity: this.spriteTexture ? 0.35 : 0.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
      side: THREE.DoubleSide,
    });

    this.magmaHalo = new THREE.Mesh(glowGeom, this.haloMaterial);
    this.magmaHalo.position.set(0, 8, 420);
    this.magmaHalo.visible = this.spriteTexture !== null;
    this.group.add(this.magmaHalo);
  }

  public update(dt: number, playerZ: number, time: number): void {
    // 1. Horizon glow stays ahead of the rider
    if (this.magmaHalo) {
      this.magmaHalo.position.z = playerZ + 420;
    }

    // 2. Rising embers
    if (this.emberPoints && this.emberPositions && this.emberGeom) {
      const pos = this.emberPositions;
      const count = pos.length / 3;
      const zWindow = 180;

      for (let i = 0; i < count; i++) {
        const vel = this.emberVelocities[i];
        const idx = i * 3;

        pos[idx + 1] += vel.vy * dt;
        pos[idx] += (vel.vx + Math.sin(time * 1.3 + vel.phase) * 0.5) * dt;

        if (pos[idx + 1] > EMBER_TOP_Y) {
          // Re-emit from a lava channel
          pos[idx + 1] = -1.3 + Math.random() * 1.5;
          pos[idx] = (Math.random() > 0.5 ? 1 : -1) * (10.6 + Math.random() * 7.0);
        }

        const relZ = pos[idx + 2] - playerZ;
        if (relZ < -60) {
          pos[idx + 2] = playerZ + zWindow + Math.random() * 45;
        } else if (relZ > zWindow + 50) {
          pos[idx + 2] = playerZ - 40 - Math.random() * 20;
        }
      }

      this.emberGeom.attributes.position.needsUpdate = true;
    }

    // 3. Falling ash
    if (this.ashPositions && this.ashVelocities && this.ashGeom) {
      const pos = this.ashPositions;
      const vel = this.ashVelocities;
      const count = pos.length / 3;
      for (let i = 0; i < count; i++) {
        const idx = i * 3;
        pos[idx + 1] += vel[i * 2] * dt;
        pos[idx] += (vel[i * 2 + 1] + Math.sin(time * 0.7 + i) * 0.3) * dt;

        if (pos[idx + 1] < -1.0) pos[idx + 1] = ASH_TOP_Y;
        if (pos[idx] > 30) pos[idx] -= 60;

        const relZ = pos[idx + 2] - playerZ;
        if (relZ < -60) {
          pos[idx + 2] = playerZ + 180 + Math.random() * 45;
        } else if (relZ > 230) {
          pos[idx + 2] = playerZ - 40 - Math.random() * 20;
        }
      }
      this.ashGeom.attributes.position.needsUpdate = true;
    }

    // 4. Smoke layers drift and recycle ahead
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
    if (this.ashGeom) this.ashGeom.dispose();
    if (this.ashMaterial) this.ashMaterial.dispose();
    if (this.smokeMaterial) this.smokeMaterial.dispose();
    if (this.haloMaterial) this.haloMaterial.dispose();
    if (this.spriteTexture) this.spriteTexture.dispose();
    this.spriteTexture = null;

    // All smoke planes share one geometry
    if (this.smokePlanes.length > 0) {
      this.smokePlanes[0].geometry.dispose();
    }
    this.smokePlanes = [];

    if (this.magmaHalo) {
      this.magmaHalo.geometry.dispose();
      this.magmaHalo = null;
    }

    this.emberPoints = null;
    this.ashPoints = null;
  }
}
