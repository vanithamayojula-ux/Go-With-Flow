import * as THREE from 'three';
import { GraphicsConfig } from '../../../types';

/**
 * CrystalHeightsAtmosphere manages:
 * 1. Deep cosmic starfield (batched points with subtle twinkling)
 * 2. Ethereal purple/cyan nebula haze layers
 * 3. Radiant floating crystal dust & energy motes orbiting along the path
 * 4. Giant celestial moon orb on the distant cosmic horizon
 */
export class CrystalHeightsAtmosphere {
  public group: THREE.Group;
  private scene: THREE.Scene;

  // Star Field (batched Points)
  private starPoints: THREE.Points | null = null;
  private starGeom: THREE.BufferGeometry | null = null;
  private starMaterial: THREE.PointsMaterial | null = null;

  // Crystalline Energy Motes
  private motePoints: THREE.Points | null = null;
  private moteGeom: THREE.BufferGeometry | null = null;
  private moteMaterial: THREE.PointsMaterial | null = null;
  private motePositions: Float32Array | null = null;
  private moteBaseData: { phase: number; speed: number; radius: number }[] = [];

  // Nebula Glow Haze Planes
  private nebulaPlanes: THREE.Mesh[] = [];
  private nebulaMaterial: THREE.MeshBasicMaterial | null = null;

  // Distant Celestial Moon Orb
  private celestialMoon: THREE.Mesh | null = null;
  private moonMaterial: THREE.MeshBasicMaterial | null = null;

  constructor(scene: THREE.Scene, graphicsConfig: GraphicsConfig) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'CrystalHeightsAtmosphereGroup';
    this.scene.add(this.group);

    this.initStarField(graphicsConfig);
    this.initEnergyMotes(graphicsConfig);
    this.initNebulaHaze(graphicsConfig);
    this.initCelestialMoon();
  }

  private initStarField(graphicsConfig: GraphicsConfig): void {
    let count = 450;
    if (graphicsConfig.preset === 'mobile-opt') count = 220;
    if (graphicsConfig.preset === 'webgl-min') count = 90;

    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    const white = new THREE.Color(0xffffff);
    const cyan = new THREE.Color(0xa5f3fc);
    const lavender = new THREE.Color(0xe9d5ff);

    for (let i = 0; i < count; i++) {
      // Dome spread above horizon
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(0.2 + Math.random() * 0.8);
      const r = 260.0 + Math.random() * 80.0;

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi) + 15.0;
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);

      const rnd = Math.random();
      const col = rnd > 0.6 ? white : (rnd > 0.3 ? cyan : lavender);
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;
    }

    this.starGeom = new THREE.BufferGeometry();
    this.starGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.starGeom.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    this.starMaterial = new THREE.PointsMaterial({
      size: 1.8,
      vertexColors: true,
      transparent: true,
      opacity: 0.90,
      depthWrite: false,
    });

    this.starPoints = new THREE.Points(this.starGeom, this.starMaterial);
    this.starPoints.frustumCulled = false;
    this.group.add(this.starPoints);
  }

  private initEnergyMotes(graphicsConfig: GraphicsConfig): void {
    let count = 260;
    if (graphicsConfig.preset === 'mobile-opt') count = 130;
    if (graphicsConfig.preset === 'webgl-min') count = 50;

    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    const cyanMote = new THREE.Color(0x22d3ee); // #22D3EE
    const purpleMote = new THREE.Color(0xa855f7); // #A855F7
    const pinkMote = new THREE.Color(0xf472b6); // #F472B6

    this.moteBaseData = [];

    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * 50;
      const y = 1.0 + Math.random() * 16;
      const z = (Math.random() - 0.5) * 320;

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      this.moteBaseData.push({
        phase: Math.random() * Math.PI * 2,
        speed: 0.8 + Math.random() * 1.2,
        radius: 0.8 + Math.random() * 1.8,
      });

      const rnd = Math.random();
      const col = rnd > 0.5 ? cyanMote : (rnd > 0.25 ? purpleMote : pinkMote);
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;
    }

    this.moteGeom = new THREE.BufferGeometry();
    this.moteGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.moteGeom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.motePositions = positions;

    this.moteMaterial = new THREE.PointsMaterial({
      size: 1.5,
      vertexColors: true,
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.motePoints = new THREE.Points(this.moteGeom, this.moteMaterial);
    this.motePoints.frustumCulled = false;
    this.group.add(this.motePoints);
  }

  private initNebulaHaze(graphicsConfig: GraphicsConfig): void {
    if (graphicsConfig.preset === 'webgl-min') return;

    this.nebulaMaterial = new THREE.MeshBasicMaterial({
      color: 0x4338ca, // Ethereal twilight indigo-purple
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    const hazeGeom = new THREE.PlaneGeometry(160, 90);
    hazeGeom.rotateX(-Math.PI / 2);

    const count = graphicsConfig.preset === 'desktop-full' ? 5 : 3;
    for (let i = 0; i < count; i++) {
      const plane = new THREE.Mesh(hazeGeom, this.nebulaMaterial);
      plane.position.set((Math.random() - 0.5) * 40, 2.0 + i * 3.2, i * 75 - 40);
      this.nebulaPlanes.push(plane);
      this.group.add(plane);
    }
  }

  private initCelestialMoon(): void {
    // Large luminous celestial moon orb in the cosmic sky (inspired by concept art)
    const moonGeom = new THREE.CircleGeometry(32, 24);
    this.moonMaterial = new THREE.MeshBasicMaterial({
      color: 0xc4b5fd, // Soft radiant lavender moon
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    this.celestialMoon = new THREE.Mesh(moonGeom, this.moonMaterial);
    this.celestialMoon.position.set(-85, 75, -290);
    this.group.add(this.celestialMoon);
  }

  public update(dt: number, playerZ: number, time: number): void {
    // 1. Follow player for Starfield & Celestial Moon
    if (this.starPoints) {
      this.starPoints.position.z = playerZ;
    }
    if (this.celestialMoon) {
      this.celestialMoon.position.z = playerZ - 290;
    }

    // 2. Animate Crystalline Energy Motes (orbiting swirl and cycle along player Z)
    if (this.motePoints && this.motePositions && this.moteGeom) {
      const count = this.motePositions.length / 3;
      const zWindow = 180;

      for (let i = 0; i < count; i++) {
        const base = this.moteBaseData[i];
        const idx = i * 3;

        // Swirl in X and Y
        this.motePositions[idx] += Math.sin(time * base.speed + base.phase) * 0.04;
        this.motePositions[idx + 1] += Math.cos(time * base.speed * 0.8 + base.phase) * 0.03;

        const currentZ = this.motePositions[idx + 2];
        const relZ = currentZ - playerZ;

        if (relZ < -60) {
          this.motePositions[idx + 2] = playerZ + zWindow + Math.random() * 45;
        } else if (relZ > zWindow + 50) {
          this.motePositions[idx + 2] = playerZ - 40 - Math.random() * 20;
        }
      }

      this.moteGeom.attributes.position.needsUpdate = true;
    }

    // 3. Animate Nebula Planes
    for (let i = 0; i < this.nebulaPlanes.length; i++) {
      const plane = this.nebulaPlanes[i];
      plane.rotation.z = Math.sin(time * 0.18 + i) * 0.03;
      if (plane.position.z < playerZ - 90) {
        plane.position.z += 280;
      }
    }
  }

  public dispose(): void {
    this.scene.remove(this.group);

    if (this.starGeom) this.starGeom.dispose();
    if (this.starMaterial) this.starMaterial.dispose();
    if (this.moteGeom) this.moteGeom.dispose();
    if (this.moteMaterial) this.moteMaterial.dispose();
    if (this.nebulaMaterial) this.nebulaMaterial.dispose();
    if (this.moonMaterial) this.moonMaterial.dispose();

    for (const plane of this.nebulaPlanes) {
      plane.geometry.dispose();
    }
    this.nebulaPlanes = [];

    if (this.celestialMoon) {
      this.celestialMoon.geometry.dispose();
      this.celestialMoon = null;
    }
  }
}
