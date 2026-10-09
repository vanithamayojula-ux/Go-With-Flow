import * as THREE from 'three';
import { GraphicsConfig } from '../../../types';

/**
 * CrimsonDunesDecorations manages:
 * 1. Monumental Ancient Desert Sandstone Arch (Key Landmark from hero concept art)
 * 2. Sand-Buried Colonnade Pillars & Obelisks
 * 3. Weathered Sandstone Slabs & Dune Boulders
 * 4. Sparse Desert Flora (Saguaro-style Cacti, Desert Agave, and Dry Shrubs)
 * 5. Floating Ancient Solar Relic Crystals
 */
export class CrimsonDunesDecorations {
  public group: THREE.Group;
  private scene: THREE.Scene;

  // Materials
  private sandstoneMaterial: THREE.MeshStandardMaterial;
  private sandstoneRedMaterial: THREE.MeshStandardMaterial;
  private cactusGreenMaterial: THREE.MeshStandardMaterial;
  private dryBrushMaterial: THREE.MeshStandardMaterial;
  private solarCrystalMaterial: THREE.MeshStandardMaterial;

  // Templates
  private desertArchTemplate: THREE.Group | null = null;
  private obeliskTemplate: THREE.Group | null = null;
  private ruinPillarsTemplate: THREE.Group | null = null;
  private cactusTemplate: THREE.Group | null = null;
  private shrubTemplate: THREE.Group | null = null;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'CrimsonDunesDecorationsGroup';
    this.scene.add(this.group);

    // Weathered ancient desert sandstone (#D6B48B)
    this.sandstoneMaterial = new THREE.MeshStandardMaterial({
      color: 0xd6b48b,
      roughness: 0.88,
      metalness: 0.08,
      flatShading: true,
    });

    // Dark red wind-sculpted rock (#9F1239 / #C2410C)
    this.sandstoneRedMaterial = new THREE.MeshStandardMaterial({
      color: 0x9f1239,
      roughness: 0.82,
      metalness: 0.12,
      flatShading: true,
    });

    // Hardy desert cactus green (#4D7C0F / #65A30D)
    this.cactusGreenMaterial = new THREE.MeshStandardMaterial({
      color: 0x4d7c0f,
      roughness: 0.78,
      flatShading: true,
    });

    // Dry sun-bleached brush (#A16207)
    this.dryBrushMaterial = new THREE.MeshStandardMaterial({
      color: 0xa16207,
      roughness: 0.95,
      flatShading: true,
    });

    // Solar relic amber crystal (#FBBF24)
    this.solarCrystalMaterial = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      emissive: 0xd97706,
      emissiveIntensity: 0.85,
      roughness: 0.20,
      metalness: 0.80,
    });

    this.buildTemplates();
  }

  private buildTemplates(): void {
    // 1. Landmark: Monumental Ancient Desert Arch
    // Directly evokes the iconic hero stone portal in the visual reference artwork
    this.desertArchTemplate = new THREE.Group();

    // Arch Left Pillar (stepped sandstone blocks)
    const baseGeom = new THREE.BoxGeometry(3.0, 5.0, 3.0);
    const pL = new THREE.Mesh(baseGeom, this.sandstoneMaterial);
    pL.position.set(-6.2, 2.5, 0);

    const midGeom = new THREE.BoxGeometry(2.5, 7.0, 2.5);
    const pLMid = new THREE.Mesh(midGeom, this.sandstoneMaterial);
    pLMid.position.set(-6.2, 7.5, 0);

    // Arch Right Pillar
    const pR = new THREE.Mesh(baseGeom, this.sandstoneMaterial);
    pR.position.set(6.2, 2.5, 0);
    const pRMid = new THREE.Mesh(midGeom, this.sandstoneMaterial);
    pRMid.position.set(6.2, 7.5, 0);

    // Curved Top Vault / Keystone (Torus & Keystone block)
    const vaultGeom = new THREE.TorusGeometry(6.2, 1.35, 7, 14, Math.PI);
    const vault = new THREE.Mesh(vaultGeom, this.sandstoneMaterial);
    vault.position.set(0, 11.0, 0);

    const keystoneGeom = new THREE.BoxGeometry(2.6, 2.2, 3.2);
    const keystone = new THREE.Mesh(keystoneGeom, this.sandstoneRedMaterial);
    keystone.position.set(0, 16.5, 0);

    // Floating Solar Amber Relic in Arch Apex
    const relicGeom = new THREE.OctahedronGeometry(1.2, 0);
    const relic = new THREE.Mesh(relicGeom, this.solarCrystalMaterial);
    relic.position.set(0, 11.2, 0);

    this.desertArchTemplate.add(pL, pLMid, pR, pRMid, vault, keystone, relic);

    // 2. Sand-Buried Obelisk
    this.obeliskTemplate = new THREE.Group();
    const obeliskShaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.8, 1.4, 9.0, 4),
      this.sandstoneMaterial
    );
    obeliskShaft.position.set(0, 4.5, 0);
    obeliskShaft.rotation.y = Math.PI / 4;
    obeliskShaft.rotation.z = 0.12; // tilted in sand drift
    this.obeliskTemplate.add(obeliskShaft);

    // 3. Sand-Buried Ruin Pillars
    this.ruinPillarsTemplate = new THREE.Group();
    for (let i = 0; i < 2; i++) {
      const col = new THREE.Mesh(
        new THREE.CylinderGeometry(1.1, 1.3, 5.5 + i * 2.0, 6),
        this.sandstoneMaterial
      );
      col.position.set(i * 3.5, (5.5 + i * 2.0) * 0.5, (i - 0.5) * 2.0);
      col.rotation.z = (Math.random() - 0.5) * 0.15;
      this.ruinPillarsTemplate.add(col);
    }

    // 4. Stylized Desert Cactus (Saguaro with side arms)
    this.cactusTemplate = new THREE.Group();
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 0.55, 6.0, 7),
      this.cactusGreenMaterial
    );
    trunk.position.set(0, 3.0, 0);

    // Left Arm
    const armLHoriz = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.35, 1.4, 6),
      this.cactusGreenMaterial
    );
    armLHoriz.rotation.z = Math.PI / 2;
    armLHoriz.position.set(-0.85, 3.2, 0);

    const armLVert = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.32, 2.2, 6),
      this.cactusGreenMaterial
    );
    armLVert.position.set(-1.45, 4.1, 0);

    // Right Arm
    const armRHoriz = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.35, 1.4, 6),
      this.cactusGreenMaterial
    );
    armRHoriz.rotation.z = Math.PI / 2;
    armRHoriz.position.set(0.85, 2.4, 0);

    const armRVert = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.32, 2.0, 6),
      this.cactusGreenMaterial
    );
    armRVert.position.set(1.45, 3.2, 0);

    this.cactusTemplate.add(trunk, armLHoriz, armLVert, armRHoriz, armRVert);

    // 5. Desert Shrub / Dry Grass
    this.shrubTemplate = new THREE.Group();
    for (let b = 0; b < 5; b++) {
      const blade = new THREE.Mesh(
        new THREE.ConeGeometry(0.35, 1.8, 4),
        this.dryBrushMaterial
      );
      blade.rotation.x = (Math.random() - 0.5) * 0.6;
      blade.rotation.z = (b / 5) * Math.PI * 2;
      blade.position.set(0, 0.9, 0);
      this.shrubTemplate.add(blade);
    }
  }

  public spawnDesertArch(position: THREE.Vector3, scale = 1.0): THREE.Group {
    const arch = this.desertArchTemplate!.clone(true);
    arch.position.copy(position);
    arch.scale.set(scale, scale, scale);
    this.group.add(arch);
    return arch;
  }

  public spawnObelisk(position: THREE.Vector3, scale = 1.0): THREE.Group {
    const obelisk = this.obeliskTemplate!.clone(true);
    obelisk.position.copy(position);
    obelisk.scale.set(scale, scale, scale);
    this.group.add(obelisk);
    return obelisk;
  }

  public spawnRuinPillars(position: THREE.Vector3, scale = 1.0): THREE.Group {
    const pillars = this.ruinPillarsTemplate!.clone(true);
    pillars.position.copy(position);
    pillars.scale.set(scale, scale, scale);
    this.group.add(pillars);
    return pillars;
  }

  public spawnCactus(position: THREE.Vector3, scale = 1.0): THREE.Group {
    const cactus = this.cactusTemplate!.clone(true);
    cactus.position.copy(position);
    cactus.scale.set(scale, scale, scale);
    this.group.add(cactus);
    return cactus;
  }

  public spawnShrub(position: THREE.Vector3, scale = 1.0): THREE.Group {
    const shrub = this.shrubTemplate!.clone(true);
    shrub.position.copy(position);
    shrub.scale.set(scale, scale, scale);
    this.group.add(shrub);
    return shrub;
  }

  public removeObject(obj: THREE.Object3D): void {
    this.group.remove(obj);
  }

  public update(time: number): void {
    // Subtle pulse on solar relic crystals
    const pulse = 0.8 + Math.sin(time * 2.5) * 0.25;
    this.solarCrystalMaterial.emissiveIntensity = pulse;
  }

  public dispose(): void {
    this.scene.remove(this.group);

    this.sandstoneMaterial.dispose();
    this.sandstoneRedMaterial.dispose();
    this.cactusGreenMaterial.dispose();
    this.dryBrushMaterial.dispose();
    this.solarCrystalMaterial.dispose();
  }
}
