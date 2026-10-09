import * as THREE from 'three';
import { GraphicsConfig } from '../../../types';

/**
 * VerdantWildsAtmosphere manages:
 * 1. Deep forest green canopy mist / height fog layers
 * 2. Luminous golden and emerald firefly particle swarm
 * 3. Soft dappled god-ray light shafts filtering through the ancient canopy
 */
export class VerdantWildsAtmosphere {
  public group: THREE.Group;
  private scene: THREE.Scene;

  // Fireflies Particle Swarm
  private fireflies: THREE.Points | null = null;
  private fireflyGeom: THREE.BufferGeometry | null = null;
  private fireflyMaterial: THREE.PointsMaterial | null = null;
  private fireflyPositions: Float32Array | null = null;
  private fireflyBaseData: { initialY: number; phase: number; speed: number }[] = [];

  // Forest Mist Planes
  private mistPlanes: THREE.Mesh[] = [];
  private mistMaterial: THREE.MeshBasicMaterial | null = null;

  // Sun Light Shafts
  private sunRayGroup: THREE.Group | null = null;
  private sunRayMaterial: THREE.MeshBasicMaterial | null = null;

  constructor(scene: THREE.Scene, graphicsConfig: GraphicsConfig) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'VerdantWildsAtmosphereGroup';
    this.scene.add(this.group);

    this.initFireflies(graphicsConfig);
    this.initForestMist(graphicsConfig);
    this.initSunShafts(graphicsConfig);
  }

  private initFireflies(graphicsConfig: GraphicsConfig): void {
    let count = 280;
    if (graphicsConfig.preset === 'mobile-opt') count = 140;
    if (graphicsConfig.preset === 'webgl-min') count = 60;

    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    // Warm golden-green and bioluminescent emerald hues
    const yellow = new THREE.Color(0xfef08a); // #FEF08A warm yellow
    const green = new THREE.Color(0x34d399);  // #34D399 radiant emerald
    const cyan = new THREE.Color(0x6ee7b7);   // #6EE7B7 mint glow

    this.fireflyBaseData = [];

    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * 55;
      const y = 1.0 + Math.random() * 14;
      const z = (Math.random() - 0.5) * 320;

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      this.fireflyBaseData.push({
        initialY: y,
        phase: Math.random() * Math.PI * 2,
        speed: 0.6 + Math.random() * 0.9,
      });

      const rndColor = Math.random();
      const col = rndColor > 0.6 ? yellow : (rndColor > 0.25 ? green : cyan);
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;
    }

    this.fireflyGeom = new THREE.BufferGeometry();
    this.fireflyGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.fireflyGeom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.fireflyPositions = positions;

    this.fireflyMaterial = new THREE.PointsMaterial({
      size: 1.45,
      vertexColors: true,
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.fireflies = new THREE.Points(this.fireflyGeom, this.fireflyMaterial);
    this.fireflies.frustumCulled = false;
    this.group.add(this.fireflies);
  }

  private initForestMist(graphicsConfig: GraphicsConfig): void {
    if (graphicsConfig.preset === 'webgl-min') return;

    this.mistMaterial = new THREE.MeshBasicMaterial({
      color: 0x86efac, // Soft forest green mist
      transparent: true,
      opacity: 0.12,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    const mistGeom = new THREE.PlaneGeometry(120, 90);
    mistGeom.rotateX(-Math.PI / 2);

    const mistCount = graphicsConfig.preset === 'desktop-full' ? 6 : 3;
    for (let i = 0; i < mistCount; i++) {
      const plane = new THREE.Mesh(mistGeom, this.mistMaterial);
      plane.position.set((Math.random() - 0.5) * 40, 2.0 + i * 3.5, i * 70 - 60);
      this.mistPlanes.push(plane);
      this.group.add(plane);
    }
  }

  private initSunShafts(graphicsConfig: GraphicsConfig): void {
    if (graphicsConfig.preset !== 'desktop-full') return;

    this.sunRayGroup = new THREE.Group();
    this.sunRayMaterial = new THREE.MeshBasicMaterial({
      color: 0xfef9c3, // Soft sunbeam yellow-white
      transparent: true,
      opacity: 0.08,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    // Angled cylinder or elongated trapezoid planes representing sun rays
    const rayGeom = new THREE.CylinderGeometry(0.8, 4.5, 45, 6, 1, true);
    rayGeom.rotateZ(0.28);
    rayGeom.rotateX(0.18);

    for (let i = 0; i < 5; i++) {
      const ray = new THREE.Mesh(rayGeom, this.sunRayMaterial);
      const sign = i % 2 === 0 ? 1 : -1;
      ray.position.set(sign * (16.0 + i * 5.0), 22, i * 75 - 50);
      this.sunRayGroup.add(ray);
    }

    this.group.add(this.sunRayGroup);
  }

  public update(dt: number, playerZ: number, time: number): void {
    // 1. Animate Fireflies (hover, vertical bobbing, and cycle along player Z)
    if (this.fireflies && this.fireflyPositions && this.fireflyGeom) {
      const count = this.fireflyPositions.length / 3;
      const zWindow = 160;

      for (let i = 0; i < count; i++) {
        const base = this.fireflyBaseData[i];
        const idx = i * 3;

        // Subtle gentle bobbing
        this.fireflyPositions[idx + 1] = base.initialY + Math.sin(time * base.speed + base.phase) * 1.2;
        this.fireflyPositions[idx] += Math.cos(time * 0.7 + base.phase) * 0.03;

        // Keep centered along player traversal track
        const currentZ = this.fireflyPositions[idx + 2];
        const relZ = currentZ - playerZ;

        if (relZ < -60) {
          this.fireflyPositions[idx + 2] = playerZ + zWindow + Math.random() * 40;
        } else if (relZ > zWindow + 50) {
          this.fireflyPositions[idx + 2] = playerZ - 40 - Math.random() * 20;
        }
      }

      this.fireflyGeom.attributes.position.needsUpdate = true;
    }

    // 2. Animate mist layers
    for (let i = 0; i < this.mistPlanes.length; i++) {
      const plane = this.mistPlanes[i];
      plane.rotation.z = Math.sin(time * 0.2 + i) * 0.05;
      if (plane.position.z < playerZ - 90) {
        plane.position.z += 280;
      }
    }

    // 3. Keep sun shafts anchored ahead of player
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
    if (this.mistMaterial) this.mistMaterial.dispose();
    if (this.sunRayMaterial) this.sunRayMaterial.dispose();

    for (const plane of this.mistPlanes) {
      plane.geometry.dispose();
    }
    this.mistPlanes = [];

    if (this.sunRayGroup) {
      for (const child of this.sunRayGroup.children) {
        if (child instanceof THREE.Mesh) child.geometry.dispose();
      }
    }
  }
}
