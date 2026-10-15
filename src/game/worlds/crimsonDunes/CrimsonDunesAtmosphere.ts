import * as THREE from 'three';
import { GraphicsConfig } from '../../../types';

/** Vertical band the wind-blown sand stays within (metres above the road). */
const DUST_MIN_Y = 0.15;
const DUST_MAX_Y = 6.0;
/** Lateral wrap band for the crosswind. */
const DUST_HALF_X = 36;

/** Soft round sprite (radial falloff) so dust reads as hazy grains, not hard squares. */
function createSoftDustSprite(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * CrimsonDunesAtmosphere manages wind-blown drifting sand grains near the ground.
 * Distance haze comes from the engine's FogExp2 and the sun from the physical sky,
 * so this module no longer draws fake haze sheets or a flat sun disk.
 */
export class CrimsonDunesAtmosphere {
  public group: THREE.Group;
  private scene: THREE.Scene;

  // Drifting Sand Dust Particles
  private dustPoints: THREE.Points | null = null;
  private dustGeom: THREE.BufferGeometry | null = null;
  private dustMaterial: THREE.PointsMaterial | null = null;
  private dustSprite: THREE.CanvasTexture | null = null;
  private dustPositions: Float32Array | null = null;
  private dustVelocities: Float32Array | null = null;

  constructor(scene: THREE.Scene, graphicsConfig: GraphicsConfig) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'CrimsonDunesAtmosphereGroup';
    this.scene.add(this.group);

    this.initDustParticles(graphicsConfig);
  }

  private initDustParticles(graphicsConfig: GraphicsConfig): void {
    let count = 320;
    if (graphicsConfig.preset === 'mobile-opt') count = 160;
    if (graphicsConfig.preset === 'webgl-min') count = 70;

    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);

    // Natural sand tones (converted to linear by THREE.Color)
    const sandLight = new THREE.Color(0xd8b27a);
    const sandMid = new THREE.Color(0xc9a26b);
    const sandPale = new THREE.Color(0xe0c9a0);

    for (let i = 0; i < count; i++) {
      const idx = i * 3;
      positions[idx] = (Math.random() - 0.5) * DUST_HALF_X * 2;
      // Bias towards the ground where blown sand is densest
      const h = Math.random();
      positions[idx + 1] = DUST_MIN_Y + h * h * (DUST_MAX_Y - DUST_MIN_Y);
      positions[idx + 2] = (Math.random() - 0.5) * 320;

      // Crosswind drift along +X with a slight backward Z component
      velocities[idx] = 3.0 + Math.random() * 5.0;
      velocities[idx + 1] = (Math.random() - 0.5) * 0.4;
      velocities[idx + 2] = -1.0 - Math.random() * 2.0;

      const rndCol = Math.random();
      const col = rndCol > 0.6 ? sandLight : (rndCol > 0.25 ? sandMid : sandPale);
      colors[idx] = col.r;
      colors[idx + 1] = col.g;
      colors[idx + 2] = col.b;
    }

    this.dustGeom = new THREE.BufferGeometry();
    this.dustGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.dustGeom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.dustPositions = positions;
    this.dustVelocities = velocities;

    this.dustSprite = createSoftDustSprite();
    this.dustMaterial = new THREE.PointsMaterial({
      size: 0.22,
      sizeAttenuation: true,
      map: this.dustSprite,
      vertexColors: true,
      transparent: true,
      opacity: 0.4,
      blending: THREE.NormalBlending,
      depthWrite: false,
    });

    this.dustPoints = new THREE.Points(this.dustGeom, this.dustMaterial);
    this.dustPoints.frustumCulled = false;
    this.group.add(this.dustPoints);
  }

  public update(dt: number, playerZ: number, _time: number): void {
    if (!this.dustPoints || !this.dustPositions || !this.dustGeom || !this.dustVelocities) return;

    const pos = this.dustPositions;
    const vel = this.dustVelocities;
    const count = pos.length / 3;
    const zWindow = 180;
    const bandY = DUST_MAX_Y - DUST_MIN_Y;

    for (let i = 0; i < count; i++) {
      const idx = i * 3;

      pos[idx] += vel[idx] * dt;
      pos[idx + 1] += vel[idx + 1] * dt;
      pos[idx + 2] += vel[idx + 2] * dt;

      // Wrap X if blown off to either side
      if (pos[idx] > DUST_HALF_X) pos[idx] -= DUST_HALF_X * 2;
      else if (pos[idx] < -DUST_HALF_X) pos[idx] += DUST_HALF_X * 2;

      // Keep grains inside their vertical band (wrap rather than drift away forever)
      if (pos[idx + 1] > DUST_MAX_Y) pos[idx + 1] -= bandY;
      else if (pos[idx + 1] < DUST_MIN_Y) pos[idx + 1] += bandY;

      // Keep centred along the player's track
      const relZ = pos[idx + 2] - playerZ;
      if (relZ < -60) {
        pos[idx + 2] = playerZ + zWindow + Math.random() * 50;
      } else if (relZ > zWindow + 60) {
        pos[idx + 2] = playerZ - 40 - Math.random() * 20;
      }
    }

    this.dustGeom.attributes.position.needsUpdate = true;
  }

  public dispose(): void {
    this.scene.remove(this.group);

    if (this.dustGeom) this.dustGeom.dispose();
    if (this.dustMaterial) this.dustMaterial.dispose();
    if (this.dustSprite) this.dustSprite.dispose();
    this.dustGeom = null;
    this.dustMaterial = null;
    this.dustSprite = null;
    this.dustPoints = null;
    this.dustPositions = null;
    this.dustVelocities = null;
  }
}
