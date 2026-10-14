import * as THREE from 'three';
import { GraphicsConfig } from '../../../types';

/**
 * VerdantWildsDecorations manages:
 * 1. Ancient mossy stone ruin arches & broken stone monolith columns
 * 2. Bioluminescent giant mushrooms with soft glowing caps
 * 3. Dense understory ferns and mossy rock clusters
 * 4. Small forest stream cascades and water channels alongside the road
 */
export class VerdantWildsDecorations {
  public group: THREE.Group;
  private scene: THREE.Scene;

  // Materials
  private mossyStoneMaterial: THREE.MeshStandardMaterial;
  private ancientCarvingMaterial: THREE.MeshStandardMaterial;
  private mushroomCapMaterial: THREE.MeshStandardMaterial;
  private mushroomStemMaterial: THREE.MeshStandardMaterial;
  private fernLeafMaterial: THREE.MeshStandardMaterial;
  private waterStreamMaterial: THREE.MeshStandardMaterial;

  // Reusable Templates
  private ruinArchTemplate: THREE.Group | null = null;
  private ruinPillarTemplate: THREE.Group | null = null;
  private mushroomClusterTemplate: THREE.Group | null = null;
  private fernClusterTemplate: THREE.Group | null = null;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'VerdantWildsDecorationsGroup';
    this.scene.add(this.group);

    // Weathered ancient grey stone overgrown with moss
    this.mossyStoneMaterial = new THREE.MeshStandardMaterial({
      color: 0x475569, // Weathered slate stone
      roughness: 0.88,
      metalness: 0.12,
      flatShading: true,
    });

    // Emerald lichen runes
    this.ancientCarvingMaterial = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x059669,
      emissiveIntensity: 0.35,
      roughness: 0.5,
    });

    // Bioluminescent teal/cyan mushroom caps
    this.mushroomCapMaterial = new THREE.MeshStandardMaterial({
      color: 0x34d399,
      emissive: 0x059669,
      emissiveIntensity: 0.75,
      roughness: 0.35,
    });

    // Pale fungal stem
    this.mushroomStemMaterial = new THREE.MeshStandardMaterial({
      color: 0xf1f5f9,
      roughness: 0.9,
    });

    // Lush understory fern greenery
    this.fernLeafMaterial = new THREE.MeshStandardMaterial({
      color: 0x16a34a,
      roughness: 0.75,
      side: THREE.DoubleSide,
      flatShading: true,
    });

    // Crystal forest stream
    this.waterStreamMaterial = new THREE.MeshStandardMaterial({
      color: 0x2dd4bf,
      roughness: 0.15,
      metalness: 0.8,
      transparent: true,
      opacity: 0.78,
      side: THREE.DoubleSide,
    });

    this.buildTemplates();
  }

  private buildTemplates(): void {
    // 1. Ancient Mossy Ruin Arch
    // Monumental stone portal with stepped columns, hanging foliage vines, and druidic runes
    this.ruinArchTemplate = new THREE.Group();

    // Pillar left and right (stepped plinth, main column, carved capital)
    const basePillarGeom = new THREE.BoxGeometry(2.8, 3.0, 2.8);
    const shaftGeom = new THREE.CylinderGeometry(1.2, 1.4, 8.5, 8);
    const capGeom = new THREE.BoxGeometry(2.6, 1.5, 2.6);

    for (const sign of [-1, 1]) {
      const pBase = new THREE.Mesh(basePillarGeom, this.mossyStoneMaterial);
      pBase.position.set(sign * 6.8, 1.5, 0);

      const pShaft = new THREE.Mesh(shaftGeom, this.mossyStoneMaterial);
      pShaft.position.set(sign * 6.8, 7.0, 0);

      const pCap = new THREE.Mesh(capGeom, this.mossyStoneMaterial);
      pCap.position.set(sign * 6.8, 11.5, 0);

      // Hanging moss/vine tendrils alongside pillars (outside road corridor |X| >= 5.5)
      const vineGeom = new THREE.CylinderGeometry(0.15, 0.05, 5.5, 5);
      const vine = new THREE.Mesh(vineGeom, this.fernLeafMaterial);
      vine.position.set(sign * 5.6, 8.5, 0.4);
      vine.rotation.z = sign * -0.08;

      this.ruinArchTemplate.add(pBase, pShaft, pCap, vine);
    }

    // Curved Arch Vault / Lintel (High clearance: Y=11.5 to 15.0, cleanly above player)
    const vaultGeom = new THREE.TorusGeometry(6.8, 1.35, 7, 16, Math.PI);
    const vault = new THREE.Mesh(vaultGeom, this.mossyStoneMaterial);
    vault.position.set(0, 11.5, 0);

    // Overgrown Foliage clusters on arch crown
    const mossTuftGeom = new THREE.DodecahedronGeometry(1.8, 1);
    const mossTuft1 = new THREE.Mesh(mossTuftGeom, this.fernLeafMaterial);
    mossTuft1.position.set(-2.8, 18.0, 0.3);
    const mossTuft2 = new THREE.Mesh(mossTuftGeom, this.fernLeafMaterial);
    mossTuft2.position.set(3.0, 17.8, -0.2);
    const mossTuft3 = new THREE.Mesh(mossTuftGeom, this.fernLeafMaterial);
    mossTuft3.position.set(0, 18.6, 0.1);

    // Glowing ancient druidic rune keystone in arch apex
    const runeGeom = new THREE.OctahedronGeometry(1.3, 0);
    const rune = new THREE.Mesh(runeGeom, this.ancientCarvingMaterial);
    rune.position.set(0, 17.0, 0);

    this.ruinArchTemplate.add(vault, mossTuft1, mossTuft2, mossTuft3, rune);

    // 2. Ruin Broken Column / Monolith
    this.ruinPillarTemplate = new THREE.Group();
    const colBase = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.9, 2.0, 8), this.mossyStoneMaterial);
    colBase.position.set(0, 1.0, 0);
    const colShaft = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.4, 7.5, 8), this.mossyStoneMaterial);
    colShaft.position.set(0, 5.5, 0);
    colShaft.rotation.z = 0.08; // weathered tilt

    // Moss crown atop broken column
    const colMoss = new THREE.Mesh(new THREE.DodecahedronGeometry(1.2, 1), this.fernLeafMaterial);
    colMoss.position.set(0.3, 9.5, 0);
    this.ruinPillarTemplate.add(colBase, colShaft, colMoss);

    // 3. Bioluminescent Mushroom Cluster
    this.mushroomClusterTemplate = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const stemH = 1.4 + i * 0.7;
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.32, stemH, 6), this.mushroomStemMaterial);
      const capRadius = 0.85 + i * 0.4;
      const cap = new THREE.Mesh(
        new THREE.SphereGeometry(capRadius, 7, 5, 0, Math.PI * 2, 0, Math.PI * 0.55),
        this.mushroomCapMaterial
      );
      cap.position.y = stemH * 0.5;

      const singleShroom = new THREE.Group();
      singleShroom.add(stem, cap);
      singleShroom.position.set((i - 2.0) * 1.1, 0, (Math.random() - 0.5) * 1.6);
      singleShroom.rotation.z = (Math.random() - 0.5) * 0.35;
      this.mushroomClusterTemplate.add(singleShroom);
    }

    // 4. Understory Fern Cluster
    this.fernClusterTemplate = new THREE.Group();
    const frondGeom = new THREE.ConeGeometry(0.85, 3.4, 4);
    frondGeom.rotateX(Math.PI / 3);
    for (let f = 0; f < 8; f++) {
      const frond = new THREE.Mesh(frondGeom, this.fernLeafMaterial);
      frond.rotation.y = (f / 8) * Math.PI * 2;
      frond.scale.set(0.85, 1.15, 0.85);
      this.fernClusterTemplate.add(frond);
    }
  }

  public spawnRuinArch(position: THREE.Vector3, scale = 1.0): THREE.Group {
    const arch = this.ruinArchTemplate!.clone(true);
    arch.position.copy(position);
    arch.scale.set(scale, scale, scale);
    this.group.add(arch);
    return arch;
  }

  public spawnRuinPillar(position: THREE.Vector3, scale = 1.0): THREE.Group {
    const pillar = this.ruinPillarTemplate!.clone(true);
    pillar.position.copy(position);
    pillar.scale.set(scale, scale, scale);
    this.group.add(pillar);
    return pillar;
  }

  public spawnMushrooms(position: THREE.Vector3, scale = 1.0): THREE.Group {
    const cluster = this.mushroomClusterTemplate!.clone(true);
    cluster.position.copy(position);
    cluster.scale.set(scale, scale, scale);
    this.group.add(cluster);
    return cluster;
  }

  public spawnFerns(position: THREE.Vector3, scale = 1.0): THREE.Group {
    const ferns = this.fernClusterTemplate!.clone(true);
    ferns.position.copy(position);
    ferns.scale.set(scale, scale, scale);
    this.group.add(ferns);
    return ferns;
  }

  public createStreamRibbon(startPos: THREE.Vector3, length: number, width: number): THREE.Mesh {
    const geom = new THREE.PlaneGeometry(width, length, 4, 12);
    geom.rotateX(-Math.PI / 2);

    // Add gentle meander to stream
    const pos = geom.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const z = pos.getZ(i);
      const meander = Math.sin(z * 0.12) * 1.5;
      pos.setX(i, pos.getX(i) + meander);
    }
    geom.computeVertexNormals();

    const mesh = new THREE.Mesh(geom, this.waterStreamMaterial);
    mesh.position.copy(startPos);
    this.group.add(mesh);
    return mesh;
  }

  public removeObject(obj: THREE.Object3D): void {
    this.group.remove(obj);
  }

  public update(time: number): void {
    // Subtle breathing pulse on bioluminescent mushroom cap glow
    const pulse = 0.65 + Math.sin(time * 2.2) * 0.25;
    this.mushroomCapMaterial.emissiveIntensity = pulse;
  }

  public dispose(): void {
    this.scene.remove(this.group);

    this.mossyStoneMaterial.dispose();
    this.ancientCarvingMaterial.dispose();
    this.mushroomCapMaterial.dispose();
    this.mushroomStemMaterial.dispose();
    this.fernLeafMaterial.dispose();
    this.waterStreamMaterial.dispose();
  }
}
