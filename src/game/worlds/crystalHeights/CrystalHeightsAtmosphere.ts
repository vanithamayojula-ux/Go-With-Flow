import * as THREE from 'three';
import { GraphicsConfig } from '../../../types';

/** Soft round sprite for the ice glints (null without a DOM). */
function createGlintSprite(): THREE.Texture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.75)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 32);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * CrystalHeightsAtmosphere (high-alpine glacier, clear cold daylight):
 * - Sparse "diamond dust": tiny white ice crystals drifting slowly downwind,
 *   catching the sun. No stars, nebula sheets or moon in daylight — depth comes
 *   from the scene's FogExp2 and the physically based sky.
 */
export class CrystalHeightsAtmosphere {
  public group: THREE.Group;
  private scene: THREE.Object3D;

  // Diamond dust / drifting snow glints
  private motePoints: THREE.Points | null = null;
  private moteGeom: THREE.BufferGeometry | null = null;
  private moteMaterial: THREE.PointsMaterial | null = null;
  private motePositions: Float32Array | null = null;
  private moteBaseData: { phase: number; speed: number; radius: number }[] = [];
  private moteSprite: THREE.Texture | null = null;

  constructor(scene: THREE.Object3D, graphicsConfig: GraphicsConfig) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'CrystalHeightsAtmosphereGroup';
    this.scene.add(this.group);

    this.initEnergyMotes(graphicsConfig);
  }

  private initEnergyMotes(graphicsConfig: GraphicsConfig): void {
    let count = 140;
    if (graphicsConfig.preset === 'mobile-opt') count = 70;
    if (graphicsConfig.preset === 'webgl-min') count = 30;

    const positions = new Float32Array(count * 3);
    this.moteBaseData = [];

    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 44;
      positions[i * 3 + 1] = 0.3 + Math.random() * 14;
      positions[i * 3 + 2] = -40 + Math.random() * 220;

      this.moteBaseData.push({
        phase: Math.random() * Math.PI * 2,
        speed: 0.25 + Math.random() * 0.35, // fall speed m/s
        radius: 0.3 + Math.random() * 0.5, // lateral flutter m/s
      });
    }

    this.moteGeom = new THREE.BufferGeometry();
    this.moteGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.motePositions = positions;

    this.moteSprite = createGlintSprite();
    this.moteMaterial = new THREE.PointsMaterial({
      color: 0xffffff,
      map: this.moteSprite,
      alphaTest: 0.02,
      size: 0.07,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });

    this.motePoints = new THREE.Points(this.moteGeom, this.moteMaterial);
    this.motePoints.frustumCulled = false;
    this.group.add(this.motePoints);
  }

  public update(dt: number, playerZ: number, time: number): void {
    if (!this.motePoints || !this.motePositions || !this.moteGeom) return;

    const step = Math.min(dt, 0.1);
    const pos = this.motePositions;
    const count = pos.length / 3;
    const windX = 0.35; // gentle cross-valley breeze

    for (let i = 0; i < count; i++) {
      const base = this.moteBaseData[i];
      const idx = i * 3;

      pos[idx] += (windX + Math.sin(time * 1.3 + base.phase) * base.radius) * step;
      pos[idx + 1] -= base.speed * step;
      pos[idx + 2] += Math.cos(time * 0.9 + base.phase) * base.radius * 0.5 * step;

      if (pos[idx + 1] < 0.1) pos[idx + 1] = 14.0;
      if (pos[idx] > 22) pos[idx] -= 44;
      else if (pos[idx] < -22) pos[idx] += 44;

      const relZ = pos[idx + 2] - playerZ;
      if (relZ < -40) {
        pos[idx + 2] = playerZ + 140 + Math.random() * 40;
      } else if (relZ > 220) {
        pos[idx + 2] = playerZ - 30 + Math.random() * 20;
      }
    }

    this.moteGeom.attributes.position.needsUpdate = true;
  }

  public dispose(): void {
    this.scene.remove(this.group);

    if (this.moteGeom) this.moteGeom.dispose();
    if (this.moteMaterial) this.moteMaterial.dispose();
    if (this.moteSprite) this.moteSprite.dispose();
    this.moteSprite = null;
    this.moteGeom = null;
    this.moteMaterial = null;
    this.motePoints = null;
    this.motePositions = null;
  }
}
