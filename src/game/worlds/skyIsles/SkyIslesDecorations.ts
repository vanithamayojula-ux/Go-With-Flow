import * as THREE from 'three';
import { GraphicsConfig } from '../../../types';

/**
 * SkyIslesDecorations manages:
 * 1. Environmental landmarks: Ancient Floating Portal Arch & Sky Temple shrines
 * 2. Cascading waterfalls flowing off island ledges with splash mist
 * 3. Sparse stylized vegetation: bonsai-style cloud trees, grass tufts, and floating energy crystals
 */
export class SkyIslesDecorations {
  public group: THREE.Group;
  private scene: THREE.Scene;

  private stoneMaterial: THREE.MeshStandardMaterial;
  private goldAccentMaterial: THREE.MeshStandardMaterial;
  private energyCyanMaterial: THREE.MeshBasicMaterial;
  private foliageGreenMaterial: THREE.MeshStandardMaterial;
  private woodBarkMaterial: THREE.MeshStandardMaterial;
  private waterfallMaterial: THREE.MeshBasicMaterial;

  // Reusable landmark templates
  private portalArchTemplate: THREE.Group | null = null;
  private skyTempleTemplate: THREE.Group | null = null;
  private treeTemplate: THREE.Group | null = null;

  private activeLandmarks: THREE.Group[] = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'SkyIslesDecorationsGroup';
    this.scene.add(this.group);

    // Pale weathered sandstone (#E2E8F0)
    this.stoneMaterial = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.70,
      metalness: 0.15,
      flatShading: true,
    });

    // Sunlit gilded trim (#F59E0B)
    this.goldAccentMaterial = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      roughness: 0.35,
      metalness: 0.75,
    });

    // Radiant celestial energy (#22D3EE)
    this.energyCyanMaterial = new THREE.MeshBasicMaterial({
      color: 0x22d3ee,
      transparent: true,
      opacity: 0.90,
    });

    // Stylized clean canopy green (#22C55E)
    this.foliageGreenMaterial = new THREE.MeshStandardMaterial({
      color: 0x22c55e,
      roughness: 0.85,
      flatShading: true,
    });

    // Warm trunk bark (#78350F)
    this.woodBarkMaterial = new THREE.MeshStandardMaterial({
      color: 0x78350f,
      roughness: 0.9,
    });

    // Flowing blue water ribbon (#38BDF8)
    this.waterfallMaterial = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.75,
      side: THREE.DoubleSide,
    });

    this.buildTemplates();
  }

  private buildTemplates(): void {
    // 1. Landmark: Ancient Floating Portal Arch
    // Inspired directly by the visual reference hero image center archway
    this.portalArchTemplate = new THREE.Group();

    // Arch base pedestals
    const pedL = new THREE.Mesh(new THREE.BoxGeometry(2.2, 4.0, 2.2), this.stoneMaterial);
    pedL.position.set(-3.5, 2.0, 0);
    const pedR = new THREE.Mesh(new THREE.BoxGeometry(2.2, 4.0, 2.2), this.stoneMaterial);
    pedR.position.set(3.5, 2.0, 0);

    // Arch columns
    const colL = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.0, 7.0, 8), this.stoneMaterial);
    colL.position.set(-3.5, 7.5, 0);
    const colR = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.0, 7.0, 8), this.stoneMaterial);
    colR.position.set(3.5, 7.5, 0);

    // Arch curved lintel / torus top
    const archTop = new THREE.Mesh(new THREE.TorusGeometry(3.5, 0.9, 8, 16, Math.PI), this.stoneMaterial);
    archTop.position.set(0, 11.0, 0);

    // Floating central power crystal
    const crystalGeom = new THREE.OctahedronGeometry(1.2, 0);
    const crystal = new THREE.Mesh(crystalGeom, this.energyCyanMaterial);
    crystal.position.set(0, 9.5, 0);
    crystal.scale.set(1.0, 1.8, 1.0);

    // Golden halo ring around portal
    const goldHalo = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.12, 6, 24), this.goldAccentMaterial);
    goldHalo.position.set(0, 9.5, 0);

    this.portalArchTemplate.add(pedL, pedR, colL, colR, archTop, crystal, goldHalo);

    // 2. Landmark: Sky Temple / Wind Shrine
    this.skyTempleTemplate = new THREE.Group();
    const templeBase = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.8, 2.0, 8), this.stoneMaterial);
    templeBase.position.set(0, 1.0, 0);

    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 5.0, 6), this.stoneMaterial);
      p.position.set(Math.cos(angle) * 3.0, 4.5, Math.sin(angle) * 3.0);
      this.skyTempleTemplate.add(p);
    }

    const dome = new THREE.Mesh(new THREE.ConeGeometry(3.6, 3.2, 8), this.goldAccentMaterial);
    dome.position.set(0, 8.5, 0);

    const shrineBeacon = new THREE.Mesh(new THREE.OctahedronGeometry(0.7), this.energyCyanMaterial);
    shrineBeacon.position.set(0, 4.5, 0);

    this.skyTempleTemplate.add(templeBase, dome, shrineBeacon);

    // 3. Stylized Cloud Bonsai Tree
    this.treeTemplate = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.55, 3.8, 6), this.woodBarkMaterial);
    trunk.position.set(0, 1.9, 0);
    trunk.rotation.z = 0.08;

    const foliage1 = new THREE.Mesh(new THREE.DodecahedronGeometry(1.8, 1), this.foliageGreenMaterial);
    foliage1.position.set(0.2, 4.0, 0);

    const foliage2 = new THREE.Mesh(new THREE.DodecahedronGeometry(1.3, 1), this.foliageGreenMaterial);
    foliage2.position.set(-0.9, 3.5, 0.3);

    const foliage3 = new THREE.Mesh(new THREE.DodecahedronGeometry(1.1, 1), this.foliageGreenMaterial);
    foliage3.position.set(0.8, 3.2, -0.4);

    this.treeTemplate.add(trunk, foliage1, foliage2, foliage3);
  }

  /**
   * Spawns an environmental landmark on a given island
   */
  public spawnLandmark(type: 'arch' | 'temple', pos: THREE.Vector3, scale = 1.0): THREE.Group {
    const template = type === 'arch' ? this.portalArchTemplate : this.skyTempleTemplate;
    if (!template) return new THREE.Group();

    const landmark = template.clone();
    landmark.position.copy(pos);
    landmark.scale.set(scale, scale, scale);
    landmark.rotation.y = (Math.random() - 0.5) * 0.4;

    this.group.add(landmark);
    this.activeLandmarks.push(landmark);
    return landmark;
  }

  /**
   * Spawns a stylized bonsai cloud tree
   */
  public spawnTree(pos: THREE.Vector3, scale = 1.0): THREE.Group {
    if (!this.treeTemplate) return new THREE.Group();
    const tree = this.treeTemplate.clone();
    tree.position.copy(pos);
    tree.scale.set(scale, scale, scale);
    tree.rotation.y = Math.random() * Math.PI * 2;
    this.group.add(tree);
    this.activeLandmarks.push(tree);
    return tree;
  }

  /**
   * Creates a cascading waterfall flowing down the rock underside of an island
   */
  public createWaterfall(startPos: THREE.Vector3, height = 24.0, width = 2.4): THREE.Mesh {
    const geom = new THREE.PlaneGeometry(width, height, 2, 8);
    geom.translate(0, -height / 2, 0);
    const fall = new THREE.Mesh(geom, this.waterfallMaterial);
    fall.position.copy(startPos);
    this.group.add(fall);
    return fall;
  }

  public removeObject(obj: THREE.Object3D): void {
    this.group.remove(obj);
    const idx = this.activeLandmarks.indexOf(obj as THREE.Group);
    if (idx !== -1) this.activeLandmarks.splice(idx, 1);
  }

  public update(time: number): void {
    // Subtle breathing pulse on luminous crystals
    const pulse = Math.sin(time * 3.0) * 0.15 + 1.0;
    for (const lm of this.activeLandmarks) {
      lm.traverse(child => {
        const mesh = child as THREE.Mesh;
        if (mesh.isMesh && mesh.material === this.energyCyanMaterial) {
          mesh.rotation.y = time * 0.8;
          mesh.scale.set(pulse, pulse * 1.8, pulse);
        }
      });
    }
  }

  public dispose(): void {
    this.scene.remove(this.group);
    for (const lm of this.activeLandmarks) {
      this.group.remove(lm);
    }
    this.activeLandmarks = [];

    this.stoneMaterial.dispose();
    this.goldAccentMaterial.dispose();
    this.energyCyanMaterial.dispose();
    this.foliageGreenMaterial.dispose();
    this.woodBarkMaterial.dispose();
    this.waterfallMaterial.dispose();
  }
}
