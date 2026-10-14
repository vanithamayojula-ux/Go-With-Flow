import * as THREE from 'three';
import { GraphicsConfig } from '../../../types';
import { createMagmaWaterfallGeometry } from './ObsidianCoreTerrain';

/**
 * ObsidianCoreDecorations manages:
 * 1. Monumental Obsidian Citadel Landmark (Key Final Destination from hero artwork)
 * 2. Magma Waterfalls pouring molten lava down basalt cliffs
 * 3. Ancient Magma Brazier Towers flanking the volcanic bridge
 * 4. Obsidian Spires & Basalt Monolith ruins
 */
export class ObsidianCoreDecorations {
  public group: THREE.Group;
  private scene: THREE.Scene;

  // Materials
  private obsidianDarkMaterial: THREE.MeshStandardMaterial;
  private moltenCoreMaterial: THREE.MeshStandardMaterial;
  private flameGlowMaterial: THREE.MeshBasicMaterial;
  private waterfallMaterial: THREE.MeshBasicMaterial;

  // Templates
  private citadelTemplate: THREE.Group | null = null;
  private brazierTemplate: THREE.Group | null = null;
  private archForgeTemplate: THREE.Group | null = null;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'ObsidianCoreDecorationsGroup';
    this.scene.add(this.group);

    // Dark fractured obsidian metal/rock (#09090B)
    this.obsidianDarkMaterial = new THREE.MeshStandardMaterial({
      color: 0x09090b,
      roughness: 0.60,
      metalness: 0.75,
      flatShading: true,
    });

    // Radiant molten orange magma (#EA580C)
    this.moltenCoreMaterial = new THREE.MeshStandardMaterial({
      color: 0xea580c,
      emissive: 0xc2410c,
      emissiveIntensity: 0.90,
      roughness: 0.20,
      metalness: 0.40,
    });

    // Intense fiery flame (#FEF08A / #F97316)
    this.flameGlowMaterial = new THREE.MeshBasicMaterial({
      color: 0xfef08a,
      transparent: true,
      opacity: 0.95,
    });

    // Flowing molten lava ribbon
    this.waterfallMaterial = new THREE.MeshBasicMaterial({
      color: 0xf97316,
      side: THREE.DoubleSide,
    });

    this.buildTemplates();
  }

  private buildTemplates(): void {
    // 1. Landmark: Monumental Obsidian Citadel Fortress Gateway
    // Spans over the highway with twin colossal bastion spires and high arched tunnel corridor
    this.citadelTemplate = new THREE.Group();

    // Twin Fortress Bastions (Left and Right, placed at |X| = 9.8 to clear road corridor)
    const bastionBaseGeom = new THREE.BoxGeometry(5.5, 14.0, 6.0);
    const bastionTowerGeom = new THREE.CylinderGeometry(2.2, 3.5, 26.0, 6);
    const magmaVeinGeom = new THREE.BoxGeometry(0.8, 18.0, 0.4);

    for (const sign of [-1, 1]) {
      const bBase = new THREE.Mesh(bastionBaseGeom, this.obsidianDarkMaterial);
      bBase.position.set(sign * 9.8, 7.0, 0);

      const bTower = new THREE.Mesh(bastionTowerGeom, this.obsidianDarkMaterial);
      bTower.position.set(sign * 9.8, 24.0, 0);

      // Glowing magma energy vein running down the inner bastion wall
      const vein = new THREE.Mesh(magmaVeinGeom, this.moltenCoreMaterial);
      vein.position.set(sign * 7.2, 9.0, 0);

      this.citadelTemplate.add(bBase, bTower, vein);
    }

    // Grand Fortress Vault Span (High clearance: Y=13.0 to 18.0, completely open beneath)
    const vaultGeom = new THREE.BoxGeometry(16.0, 3.5, 5.5);
    const vault = new THREE.Mesh(vaultGeom, this.obsidianDarkMaterial);
    vault.position.set(0, 14.5, 0);

    // Central Citadel Cathedral Spire rising high above the vault
    const centerTower = new THREE.Mesh(
      new THREE.CylinderGeometry(2.8, 4.8, 32.0, 6),
      this.obsidianDarkMaterial
    );
    centerTower.position.set(0, 31.0, 0);

    // Glowing Magma Crown atop Central Citadel
    const crown = new THREE.Mesh(
      new THREE.TorusGeometry(3.8, 1.1, 6, 16),
      this.moltenCoreMaterial
    );
    crown.position.set(0, 48.0, 0);
    crown.rotateX(Math.PI / 2);

    this.citadelTemplate.add(vault, centerTower, crown);

    // 2. Magma Brazier / Flame Beacon Pillar
    // Line the edges of the volcanic highway bridge (inspired by concept art)
    this.brazierTemplate = new THREE.Group();
    const pedestal = new THREE.Mesh(
      new THREE.CylinderGeometry(0.8, 1.1, 4.2, 6),
      this.obsidianDarkMaterial
    );
    pedestal.position.set(0, 2.1, 0);

    const bowl = new THREE.Mesh(
      new THREE.CylinderGeometry(1.4, 0.7, 1.2, 6),
      this.obsidianDarkMaterial
    );
    bowl.position.set(0, 4.5, 0);

    const flameOrb = new THREE.Mesh(
      new THREE.SphereGeometry(0.75, 6, 6),
      this.flameGlowMaterial
    );
    flameOrb.position.set(0, 5.2, 0);

    this.brazierTemplate.add(pedestal, bowl, flameOrb);

    // 3. Ancient Magma Forge Arch
    this.archForgeTemplate = new THREE.Group();
    const archPillarL = new THREE.Mesh(new THREE.BoxGeometry(2.4, 11.0, 2.4), this.obsidianDarkMaterial);
    archPillarL.position.set(-6.5, 5.5, 0);
    const archPillarR = new THREE.Mesh(new THREE.BoxGeometry(2.4, 11.0, 2.4), this.obsidianDarkMaterial);
    archPillarR.position.set(6.5, 5.5, 0);
    const archTop = new THREE.Mesh(new THREE.BoxGeometry(15.4, 2.2, 2.8), this.obsidianDarkMaterial);
    archTop.position.set(0, 11.5, 0);

    const archRune = new THREE.Mesh(
      new THREE.OctahedronGeometry(1.2, 0),
      this.moltenCoreMaterial
    );
    archRune.position.set(0, 11.5, 1.5);

    this.archForgeTemplate.add(archPillarL, archPillarR, archTop, archRune);
  }

  public spawnCitadel(position: THREE.Vector3, scale = 1.0): THREE.Group {
    const cit = this.citadelTemplate!.clone(true);
    cit.position.copy(position);
    cit.scale.set(scale, scale, scale);
    this.group.add(cit);
    return cit;
  }

  public spawnBrazier(position: THREE.Vector3, scale = 1.0): THREE.Group {
    const br = this.brazierTemplate!.clone(true);
    br.position.copy(position);
    br.scale.set(scale, scale, scale);
    this.group.add(br);
    return br;
  }

  public spawnForgeArch(position: THREE.Vector3, scale = 1.0): THREE.Group {
    const arch = this.archForgeTemplate!.clone(true);
    arch.position.copy(position);
    arch.scale.set(scale, scale, scale);
    this.group.add(arch);
    return arch;
  }

  public createMagmaFall(startPos: THREE.Vector3, height = 24.0, width = 4.0): THREE.Mesh {
    const geom = createMagmaWaterfallGeometry(width, height);
    const mesh = new THREE.Mesh(geom, this.waterfallMaterial);
    mesh.position.copy(startPos);
    this.group.add(mesh);
    return mesh;
  }

  public removeObject(obj: THREE.Object3D): void {
    this.group.remove(obj);
  }

  public update(time: number): void {
    // Molten heat breathing pulse
    const pulse = 0.85 + Math.sin(time * 3.0) * 0.20;
    this.moltenCoreMaterial.emissiveIntensity = pulse;
  }

  public dispose(): void {
    this.scene.remove(this.group);

    this.obsidianDarkMaterial.dispose();
    this.moltenCoreMaterial.dispose();
    this.flameGlowMaterial.dispose();
    this.waterfallMaterial.dispose();
  }
}
