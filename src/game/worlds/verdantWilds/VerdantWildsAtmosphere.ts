import * as THREE from 'three';
import { GraphicsConfig } from '../../../types';

/**
 * VerdantWildsAtmosphere manages:
 * 1. Fine sunlit pollen / dust motes drifting through the forest air
 *    (the old glowing "firefly" swarm, toned down for a daylight scene)
 * 2. Very soft sun shafts filtering down through the canopy, well off the road
 *
 * Volumetric haze is left to the scene's FogExp2; the old low mist sheets that
 * cut through the rider and camera have been removed.
 */
export class VerdantWildsAtmosphere {
  public group: THREE.Group;
  private scene: THREE.Scene;

  // Pollen motes particle system
  private fireflies: THREE.Points | null = null;
  private fireflyGeom: THREE.BufferGeometry | null = null;
  private fireflyMaterial: THREE.PointsMaterial | null = null;
  private fireflyTexture: THREE.CanvasTexture | null = null;
  private fireflyPositions: Float32Array | null = null;
  private fireflyBaseData: { initialY: number; phase: number; speed: number }[] = [];

  // Sun Light Shafts
  private sunRayGroup: THREE.Group | null = null;
  private sunRayGeom: THREE.BufferGeometry | null = null;
  private sunRayMaterial: THREE.MeshBasicMaterial | null = null;

  constructor(scene: THREE.Scene, graphicsConfig: GraphicsConfig) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'VerdantWildsAtmosphereGroup';
    this.scene.add(this.group);

    this.initFireflies(graphicsConfig);
    this.initSunShafts(graphicsConfig);
  }

  /** Soft round sprite for the motes (null without a DOM). */
  private createMoteTexture(): THREE.CanvasTexture | null {
    if (typeof document === 'undefined') return null;
    const size = 32;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.4, 'rgba(255,255,255,0.6)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  private initFireflies(graphicsConfig: GraphicsConfig): void {
    let count = 280;
    if (graphicsConfig.preset === 'mobile-opt') count = 140;
    if (graphicsConfig.preset === 'webgl-min') count = 60;

    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    // Natural pale pollen / dust tones lit by warm morning sun
    const warm = new THREE.Color(0xe6dcb8);
    const pale = new THREE.Color(0xd4d0bf);
    const seedFluff = new THREE.Color(0xc9cdb0);

    this.fireflyBaseData = [];

    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * 55;
      const y = 0.8 + Math.random() * 12;
      const z = (Math.random() - 0.5) * 320;

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      this.fireflyBaseData.push({
        initialY: y,
        phase: Math.random() * Math.PI * 2,
        speed: 0.15 + Math.random() * 0.3,
      });

      const rndColor = Math.random();
      const col = rndColor > 0.55 ? warm : rndColor > 0.2 ? pale : seedFluff;
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;
    }

    this.fireflyGeom = new THREE.BufferGeometry();
    this.fireflyGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.fireflyGeom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.fireflyPositions = positions;

    this.fireflyTexture = this.createMoteTexture();
    this.fireflyMaterial = new THREE.PointsMaterial({
      size: this.fireflyTexture ? 0.14 : 0.07,
      map: this.fireflyTexture,
      vertexColors: true,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    });

    this.fireflies = new THREE.Points(this.fireflyGeom, this.fireflyMaterial);
    this.fireflies.frustumCulled = false;
    this.group.add(this.fireflies);
  }

  private initSunShafts(graphicsConfig: GraphicsConfig): void {
    if (graphicsConfig.preset !== 'desktop-full') return;

    this.sunRayGroup = new THREE.Group();
    this.sunRayMaterial = new THREE.MeshBasicMaterial({
      color: 0xfff1d6, // warm daylight
      vertexColors: true,
      transparent: true,
      opacity: 0.05,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    // Open cone, fading out toward the ground via RGBA vertex colours
    const height = 45;
    const rayGeom = new THREE.CylinderGeometry(0.8, 4.5, height, 12, 6, true);
    const rPos = rayGeom.attributes.position;
    const rCol = new Float32Array(rPos.count * 4);
    for (let i = 0; i < rPos.count; i++) {
      const t = rPos.getY(i) / height + 0.5; // 0 bottom .. 1 top
      const a = Math.pow(t, 1.4);
      rCol[i * 4] = 1;
      rCol[i * 4 + 1] = 1;
      rCol[i * 4 + 2] = 1;
      rCol[i * 4 + 3] = a;
    }
    rayGeom.setAttribute('color', new THREE.BufferAttribute(rCol, 4));
    rayGeom.rotateZ(0.28);
    rayGeom.rotateX(0.18);
    this.sunRayGeom = rayGeom;

    for (let i = 0; i < 5; i++) {
      const ray = new THREE.Mesh(rayGeom, this.sunRayMaterial);
      const sign = i % 2 === 0 ? 1 : -1;
      ray.position.set(sign * (18.0 + i * 5.0), 22, i * 75 - 50);
      this.sunRayGroup.add(ray);
    }

    this.group.add(this.sunRayGroup);
  }

  public update(dt: number, playerZ: number, time: number): void {
    // 1. Drift pollen motes (slow bob + lateral drift), recycle around the player
    if (this.fireflies && this.fireflyPositions && this.fireflyGeom) {
      const count = this.fireflyPositions.length / 3;
      const zWindow = 160;

      for (let i = 0; i < count; i++) {
        const base = this.fireflyBaseData[i];
        const idx = i * 3;

        this.fireflyPositions[idx + 1] =
          base.initialY + Math.sin(time * base.speed + base.phase) * 0.6;
        this.fireflyPositions[idx] += Math.cos(time * 0.3 + base.phase) * 0.25 * dt;

        const relZ = this.fireflyPositions[idx + 2] - playerZ;
        if (relZ < -60) {
          this.fireflyPositions[idx + 2] = playerZ + zWindow + Math.random() * 40;
        } else if (relZ > zWindow + 50) {
          this.fireflyPositions[idx + 2] = playerZ - 40 - Math.random() * 20;
        }
      }

      this.fireflyGeom.attributes.position.needsUpdate = true;
    }

    // 2. Keep sun shafts anchored ahead of player
    if (this.sunRayGroup) {
      for (const ray of this.sunRayGroup.children) {
        if (ray.position.z < playerZ - 60) {
          ray.position.z += 300;
        }
      }
    }
  }

  public dispose(): void {
    this.scene.remove(this.group);

    if (this.fireflyGeom) this.fireflyGeom.dispose();
    if (this.fireflyMaterial) this.fireflyMaterial.dispose();
    if (this.fireflyTexture) this.fireflyTexture.dispose();
    if (this.sunRayMaterial) this.sunRayMaterial.dispose();
    if (this.sunRayGeom) this.sunRayGeom.dispose();
    this.sunRayGroup = null;
  }
}
