import * as THREE from 'three';
import { GraphicsConfig } from '../../../types';

/**
 * CrystalHeightsDecorations manages:
 * 1. Monumental Celestial Crystal Gateway (Key Landmark from hero concept art)
 * 2. Floating Crystal Arch & Celestial Temple Shrine
 * 3. Luminous Crystal Bonsai Trees (Cyan/Lavender crystalline foliage)
 * 4. Resonant Crystal Monoliths & Floating Sky Bridge fragments
 * 5. Floating Celestial Energy Cores
 */
export class CrystalHeightsDecorations {
  public group: THREE.Group;
  private scene: THREE.Scene;

  // Materials
  private celestialStoneMaterial: THREE.MeshStandardMaterial;
  private crystalPurpleMaterial: THREE.MeshStandardMaterial;
  private crystalCyanMaterial: THREE.MeshStandardMaterial;
  private foliageCyanMaterial: THREE.MeshStandardMaterial;
  private treeBarkMaterial: THREE.MeshStandardMaterial;

  // Templates
  private celestialGateTemplate: THREE.Group | null = null;
  private crystalShrineTemplate: THREE.Group | null = null;
  private crystalTreeTemplate: THREE.Group | null = null;
  private floatingArchTemplate: THREE.Group | null = null;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'CrystalHeightsDecorationsGroup';
    this.scene.add(this.group);

    // Weathered celestial dark-stone with purple sheen (#312E81)
    this.celestialStoneMaterial = new THREE.MeshStandardMaterial({
      color: 0x312e81,
      roughness: 0.70,
      metalness: 0.35,
      flatShading: true,
    });

    // Glowing crystalline purple (#8B5CF6 / #A855F7)
    this.crystalPurpleMaterial = new THREE.MeshStandardMaterial({
      color: 0x8b5cf6,
      emissive: 0x6d28d9,
      emissiveIntensity: 0.75,
      roughness: 0.25,
      metalness: 0.75,
      flatShading: true,
    });

    // Radiant celestial cyan (#22D3EE / #67E8F9)
    this.crystalCyanMaterial = new THREE.MeshStandardMaterial({
      color: 0x22d3ee,
      emissive: 0x0891b2,
      emissiveIntensity: 0.85,
      roughness: 0.18,
      metalness: 0.85,
      flatShading: true,
    });

    // Stylized celestial tree crystal leaves (#67E8F9)
    this.foliageCyanMaterial = new THREE.MeshStandardMaterial({
      color: 0x67e8f9,
      emissive: 0x06b6d4,
      emissiveIntensity: 0.45,
      roughness: 0.35,
      flatShading: true,
    });

    // Crystalline bark (#1E1B4B)
    this.treeBarkMaterial = new THREE.MeshStandardMaterial({
      color: 0x1e1b4b,
      roughness: 0.85,
    });

    this.buildTemplates();
  }

  private buildTemplates(): void {
    // 1. Landmark: Monumental Celestial Crystal Gateway
    // Directly evokes the grand hero portal with floating center diamond crystal in the artwork
    this.celestialGateTemplate = new THREE.Group();

    // Portal Side Towers (stepped celestial stone columns with glowing crystal caps)
    const baseColGeom = new THREE.BoxGeometry(2.6, 12.0, 2.6);
    const colL = new THREE.Mesh(baseColGeom, this.celestialStoneMaterial);
    colL.position.set(-6.8, 6.0, 0);

    const colR = new THREE.Mesh(baseColGeom, this.celestialStoneMaterial);
    colR.position.set(6.8, 6.0, 0);

    // Tower Crystal Finials
    const finialGeom = new THREE.ConeGeometry(1.2, 4.5, 6);
    const finialL = new THREE.Mesh(finialGeom, this.crystalCyanMaterial);
    finialL.position.set(-6.8, 14.0, 0);
    const finialR = new THREE.Mesh(finialGeom, this.crystalCyanMaterial);
    finialR.position.set(6.8, 14.0, 0);

    // Arch Curved Torus Vault
    const vaultGeom = new THREE.TorusGeometry(6.8, 1.35, 7, 16, Math.PI);
    const vault = new THREE.Mesh(vaultGeom, this.celestialStoneMaterial);
    vault.position.set(0, 11.5, 0);

    // Floating Giant Octahedron Crystal Core in Portal Center
    const coreGeom = new THREE.OctahedronGeometry(2.2, 0);
    const core = new THREE.Mesh(coreGeom, this.crystalPurpleMaterial);
    core.position.set(0, 12.0, 0);
    core.scale.set(1.0, 1.6, 1.0);

    this.celestialGateTemplate.add(colL, colR, finialL, finialR, vault, core);

    // 2. Crystal Shrine / Spire Altar
    this.crystalShrineTemplate = new THREE.Group();
    const altarBase = new THREE.Mesh(
      new THREE.CylinderGeometry(2.5, 3.2, 2.0, 6),
      this.celestialStoneMaterial
    );
    altarBase.position.set(0, 1.0, 0);

    const spireCenter = new THREE.Mesh(
      new THREE.ConeGeometry(1.4, 9.0, 6),
      this.crystalCyanMaterial
    );
    spireCenter.position.set(0, 6.5, 0);
    this.crystalShrineTemplate.add(altarBase, spireCenter);

    // 3. Celestial Crystal Bonsai Tree
    this.crystalTreeTemplate = new THREE.Group();
    const tTrunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 0.9, 7.0, 7),
      this.treeBarkMaterial
    );
    tTrunk.position.set(0, 3.5, 0);

    // Crystal Leaf Clusters (Dodecahedrons with cyan emissive glow)
    for (let c = 0; c < 3; c++) {
      const cLeaf = new THREE.Mesh(
        new THREE.DodecahedronGeometry(1.8 - c * 0.3, 1),
        this.foliageCyanMaterial
      );
      const angle = (c / 3) * Math.PI * 2;
      cLeaf.position.set(Math.cos(angle) * 1.5, 6.8 + c * 0.8, Math.sin(angle) * 1.5);
      this.crystalTreeTemplate.add(cLeaf);
    }
    this.crystalTreeTemplate.add(tTrunk);

    // 4. Floating Celestial Bridge / Arch Fragment
    this.floatingArchTemplate = new THREE.Group();
    const bridgeGeom = new THREE.BoxGeometry(14.0, 1.8, 4.5);
    const bridge = new THREE.Mesh(bridgeGeom, this.celestialStoneMaterial);
    bridge.position.set(0, 5.0, 0);
    this.floatingArchTemplate.add(bridge);
  }

  public spawnCelestialGate(position: THREE.Vector3, scale = 1.0): THREE.Group {
    const gate = this.celestialGateTemplate!.clone(true);
    gate.position.copy(position);
    gate.scale.set(scale, scale, scale);
    this.group.add(gate);
    return gate;
  }

  public spawnCrystalShrine(position: THREE.Vector3, scale = 1.0): THREE.Group {
    const shrine = this.crystalShrineTemplate!.clone(true);
    shrine.position.copy(position);
    shrine.scale.set(scale, scale, scale);
    this.group.add(shrine);
    return shrine;
  }

  public spawnCrystalTree(position: THREE.Vector3, scale = 1.0): THREE.Group {
    const tree = this.crystalTreeTemplate!.clone(true);
    tree.position.copy(position);
    tree.scale.set(scale, scale, scale);
    this.group.add(tree);
    return tree;
  }

  public removeObject(obj: THREE.Object3D): void {
    this.group.remove(obj);
  }

  public update(time: number): void {
    // Ethereal breathing pulse on glowing crystals
    const pulsePurple = 0.70 + Math.sin(time * 2.4) * 0.25;
    this.crystalPurpleMaterial.emissiveIntensity = pulsePurple;

    const pulseCyan = 0.80 + Math.cos(time * 2.8) * 0.25;
    this.crystalCyanMaterial.emissiveIntensity = pulseCyan;
  }

  public dispose(): void {
    this.scene.remove(this.group);

    this.celestialStoneMaterial.dispose();
    this.crystalPurpleMaterial.dispose();
    this.crystalCyanMaterial.dispose();
    this.foliageCyanMaterial.dispose();
    this.treeBarkMaterial.dispose();
  }
}
