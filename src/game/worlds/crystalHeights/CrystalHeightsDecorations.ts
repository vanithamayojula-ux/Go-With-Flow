import * as THREE from 'three';
import { createProceduralCrystalGeometry, CrystalClusterArchetype } from './CrystalHeightsTerrain';
import { createConiferCrownGeometry } from './conifer';

const QUARTZ_ARCHETYPE: CrystalClusterArchetype = {
  id: 'shrine-quartz',
  name: 'Clear Quartz Outcrop',
  tier: 'cluster',
  height: 5.0,
  radius: 0.7,
  facets: 6,
  shardCount: 5,
};

/**
 * CrystalHeightsDecorations (high-alpine glacier set dressing):
 * 1. Road-spanning granite rock arch with snow on top and hanging icicles
 *    (inner faces at |x| >= 6.4, everything below y = 8 stays outside |x| < 6)
 * 2. "Shrine": snow-dusted granite boulder carrying a clear quartz cluster
 * 3. "Crystal tree": snow-laden spruce near the tree line
 * 4. Granite slab fragment (template kept for compatibility)
 *
 * Only the icicles and the quartz cluster use transmissive MeshPhysicalMaterial.
 */
export class CrystalHeightsDecorations {
  public group: THREE.Group;
  private scene: THREE.Scene;

  // Materials
  private graniteMaterial: THREE.MeshStandardMaterial;
  private snowMaterial: THREE.MeshStandardMaterial;
  private iceMaterial: THREE.MeshPhysicalMaterial;
  private quartzMaterial: THREE.MeshPhysicalMaterial;
  private needleMaterial: THREE.MeshStandardMaterial;
  private treeBarkMaterial: THREE.MeshStandardMaterial;

  // Templates
  private celestialGateTemplate: THREE.Group | null = null;
  private crystalShrineTemplate: THREE.Group | null = null;
  private crystalTreeTemplates: THREE.Group[] = [];
  private floatingArchTemplate: THREE.Group | null = null;

  constructor(scene: THREE.Scene, noiseTexture: THREE.Texture | null = null) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'CrystalHeightsDecorationsGroup';
    this.scene.add(this.group);

    this.graniteMaterial = new THREE.MeshStandardMaterial({
      color: 0x7d8287,
      roughness: noiseTexture ? 0.95 : 0.85,
      metalness: 0.0,
      map: noiseTexture,
      roughnessMap: noiseTexture,
    });

    this.snowMaterial = new THREE.MeshStandardMaterial({
      color: 0xe9eef3,
      roughness: noiseTexture ? 1.0 : 0.9,
      metalness: 0.0,
      roughnessMap: noiseTexture,
    });

    // Glacial ice (water ice, IOR 1.31)
    this.iceMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xf2f8fc,
      roughness: 0.1,
      metalness: 0.0,
      transmission: 0.85,
      ior: 1.31,
      thickness: 0.4,
      attenuationColor: new THREE.Color(0xcde6f2),
      attenuationDistance: 2.0,
    });

    // Clear quartz (IOR 1.55), faceted
    this.quartzMaterial = new THREE.MeshPhysicalMaterial({
      vertexColors: true,
      color: 0xffffff,
      roughness: 0.06,
      metalness: 0.0,
      transmission: 0.8,
      ior: 1.55,
      thickness: 1.2,
      attenuationColor: new THREE.Color(0xe4eef3),
      attenuationDistance: 5.0,
      specularIntensity: 1.0,
      flatShading: true,
    });

    // Spruce crown: vertex colours carry the dark needles and the snow load
    this.needleMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      roughness: 0.9,
      metalness: 0.0,
    });

    this.treeBarkMaterial = new THREE.MeshStandardMaterial({
      color: 0x4a3c31,
      roughness: 0.92,
      metalness: 0.0,
    });

    this.buildTemplates();
  }

  private buildTemplates(): void {
    // 1. Road-spanning granite arch
    this.celestialGateTemplate = new THREE.Group();
    const pillarX = 7.7; // half-width 1.3 → inner faces at |x| = 6.4
    const archY = 12.0;
    const tube = 1.3;

    const pillarGeom = new THREE.BoxGeometry(2.6, archY, 2.6);
    const colL = new THREE.Mesh(pillarGeom, this.graniteMaterial);
    colL.position.set(-pillarX, archY * 0.5, 0);
    const colR = new THREE.Mesh(pillarGeom, this.graniteMaterial);
    colR.position.set(pillarX, archY * 0.5, 0);

    const capGeom = new THREE.BoxGeometry(2.9, 0.45, 2.9);
    const capL = new THREE.Mesh(capGeom, this.snowMaterial);
    capL.position.set(-pillarX, archY + 0.2, 0);
    const capR = new THREE.Mesh(capGeom, this.snowMaterial);
    capR.position.set(pillarX, archY + 0.2, 0);

    const vault = new THREE.Mesh(new THREE.TorusGeometry(pillarX, tube, 12, 32, Math.PI), this.graniteMaterial);
    vault.position.set(0, archY, 0);

    // Snow lying on the arch: same arc nudged upward so only its top shows
    const snowVault = new THREE.Mesh(new THREE.TorusGeometry(pillarX, tube * 1.02, 12, 32, Math.PI), this.snowMaterial);
    snowVault.position.set(0, archY + 0.3, 0);
    snowVault.castShadow = true;

    this.celestialGateTemplate.add(colL, colR, capL, capR, vault, snowVault);

    // Icicles hanging from the underside of the arch (all well above y = 8)
    const icicleGeom = new THREE.ConeGeometry(0.2, 1.8, 7);
    icicleGeom.rotateX(Math.PI); // point down
    const icicleAngles = [0.75, 1.05, 1.35, 1.6, 1.85, 2.15, 2.45];
    for (let i = 0; i < icicleAngles.length; i++) {
      const a = icicleAngles[i];
      const cx = Math.cos(a) * pillarX;
      const underside = archY + Math.sin(a) * pillarX - tube;
      const len = 0.7 + ((i * 37) % 10) / 10;
      const icicle = new THREE.Mesh(icicleGeom, this.iceMaterial);
      icicle.scale.set(1, len, 1);
      icicle.position.set(cx, underside + 0.15 - 0.9 * len, ((i * 13) % 5 - 2) * 0.35);
      icicle.castShadow = true;
      this.celestialGateTemplate.add(icicle);
    }

    this.celestialGateTemplate.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });

    // 2. Granite boulder with a clear quartz cluster
    this.crystalShrineTemplate = new THREE.Group();
    const boulderGeom = new THREE.DodecahedronGeometry(2.2, 1);
    const boulder = new THREE.Mesh(boulderGeom, this.graniteMaterial);
    boulder.scale.set(1.2, 0.6, 1.0);
    boulder.position.set(0, 0.5, 0);

    const boulderSnow = new THREE.Mesh(boulderGeom, this.snowMaterial);
    boulderSnow.scale.set(1.1, 0.42, 0.92);
    boulderSnow.position.set(0, 1.0, 0);

    const quartz = new THREE.Mesh(createProceduralCrystalGeometry(QUARTZ_ARCHETYPE, 4242), this.quartzMaterial);
    quartz.position.set(0.2, 1.3, -0.1);
    quartz.rotation.set(0.12, 0.6, -0.08);

    this.crystalShrineTemplate.add(boulder, boulderSnow, quartz);
    this.crystalShrineTemplate.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });

    // 3. Snow-laden spruce (max radius 2.4 m): three irregular crown variants
    const trunkGeom = new THREE.CylinderGeometry(0.14, 0.32, 8.4, 8);
    trunkGeom.translate(0, 4.2, 0);
    const variants: Array<{ h: number; r: number; snow: number }> = [
      { h: 9.2, r: 2.3, snow: 0.85 },
      { h: 10.4, r: 2.1, snow: 0.7 },
      { h: 8.4, r: 2.4, snow: 0.95 },
    ];
    variants.forEach((v, k) => {
      const tree = new THREE.Group();
      tree.add(new THREE.Mesh(trunkGeom, this.treeBarkMaterial));
      tree.add(new THREE.Mesh(createConiferCrownGeometry(101 + k * 37, { height: v.h, maxRadius: v.r, snow: v.snow }), this.needleMaterial));
      tree.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
        }
      });
      this.crystalTreeTemplates.push(tree);
    });

    // 4. Granite slab fragment
    this.floatingArchTemplate = new THREE.Group();
    const slab = new THREE.Mesh(new THREE.BoxGeometry(14.0, 1.8, 4.5), this.graniteMaterial);
    slab.position.set(0, 0.6, 0);
    slab.castShadow = true;
    slab.receiveShadow = true;
    this.floatingArchTemplate.add(slab);
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
    shrine.rotation.y = position.z * 0.37;
    shrine.scale.set(scale, scale, scale);
    this.group.add(shrine);
    return shrine;
  }

  public spawnCrystalTree(position: THREE.Vector3, scale = 1.0): THREE.Group {
    const pick = Math.abs(Math.floor(position.z * 0.37 + position.x * 0.11)) % this.crystalTreeTemplates.length;
    const tree = this.crystalTreeTemplates[pick].clone(true);
    tree.position.copy(position);
    tree.rotation.y = position.z * 0.53;
    tree.scale.set(scale, scale, scale);
    this.group.add(tree);
    return tree;
  }

  public removeObject(obj: THREE.Object3D): void {
    this.group.remove(obj);
  }

  public update(_time: number): void {
    // Static scenery: no emissive pulsing in the realistic glacier.
  }

  public dispose(): void {
    this.scene.remove(this.group);

    const geoms = new Set<THREE.BufferGeometry>();
    const collect = (root: THREE.Object3D | null) => {
      if (!root) return;
      root.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.isMesh && mesh.geometry) geoms.add(mesh.geometry);
      });
    };
    collect(this.celestialGateTemplate);
    collect(this.crystalShrineTemplate);
    for (const t of this.crystalTreeTemplates) collect(t);
    collect(this.floatingArchTemplate);
    for (const g of geoms) g.dispose();
    this.celestialGateTemplate = null;
    this.crystalShrineTemplate = null;
    this.crystalTreeTemplates = [];
    this.floatingArchTemplate = null;

    this.graniteMaterial.dispose();
    this.snowMaterial.dispose();
    this.iceMaterial.dispose();
    this.quartzMaterial.dispose();
    this.needleMaterial.dispose();
    this.treeBarkMaterial.dispose();
  }
}
