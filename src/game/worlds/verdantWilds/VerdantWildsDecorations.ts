import * as THREE from 'three';

/**
 * VerdantWildsDecorations manages:
 * 1. Weathered, moss-covered stone ruin arches & broken columns
 * 2. Clusters of forest-floor mushrooms (natural browns, no glow)
 * 3. Understory fern clumps
 * 4. Shallow forest streams running along the roadside ditch
 *
 * Road clearance: nothing solid enters |x| < 6 below y = 8.
 * - Ruin arch pillars' inner faces sit at |x| = 6.4, lintel underside at y = 11.
 * - Mushroom clusters and ferns are built to extend only outward (+x in local
 *   space) and are mirrored with `scale.x = side * scale` when spawned.
 */
export class VerdantWildsDecorations {
  public group: THREE.Group;
  private scene: THREE.Scene;

  // Materials
  private mossyStoneMaterial: THREE.MeshStandardMaterial;
  private ancientCarvingMaterial: THREE.MeshStandardMaterial;
  private mossMaterial: THREE.MeshStandardMaterial;
  private mushroomCapMaterial: THREE.MeshStandardMaterial;
  private mushroomGillMaterial: THREE.MeshStandardMaterial;
  private mushroomStemMaterial: THREE.MeshStandardMaterial;
  private fernLeafMaterial: THREE.MeshStandardMaterial;
  private waterStreamMaterial: THREE.MeshPhysicalMaterial;

  // Reusable Templates
  private ruinArchTemplate: THREE.Group | null = null;
  private ruinPillarTemplate: THREE.Group | null = null;
  private mushroomClusterTemplate: THREE.Group | null = null;
  private fernClusterTemplate: THREE.Group | null = null;

  // Geometries owned by this class (disposed in dispose())
  private ownedGeometries: THREE.BufferGeometry[] = [];
  private streamGeometries: Map<string, THREE.BufferGeometry> = new Map();

  /**
   * @param noiseTexture optional shared greyscale noise used for albedo/roughness
   *                     break-up on stone (owned by the caller).
   */
  constructor(scene: THREE.Scene, noiseTexture: THREE.Texture | null = null) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'VerdantWildsDecorationsGroup';
    this.scene.add(this.group);

    // Weathered limestone / granite
    this.mossyStoneMaterial = new THREE.MeshStandardMaterial({
      color: 0x6e6a60,
      roughness: 0.92,
      metalness: 0.0,
      map: noiseTexture,
      roughnessMap: noiseTexture,
    });

    // Darker, lichen-stained carved keystone
    this.ancientCarvingMaterial = new THREE.MeshStandardMaterial({
      color: 0x58594a,
      roughness: 0.95,
      metalness: 0.0,
      map: noiseTexture,
    });

    // Cushion moss growing on stone
    this.mossMaterial = new THREE.MeshStandardMaterial({
      color: 0x4b5a28,
      roughness: 0.95,
      metalness: 0.0,
      map: noiseTexture,
    });

    // Natural brown mushroom caps (no emissive glow)
    this.mushroomCapMaterial = new THREE.MeshStandardMaterial({
      color: 0x7b5236,
      roughness: 0.7,
      metalness: 0.0,
    });

    this.mushroomGillMaterial = new THREE.MeshStandardMaterial({
      color: 0xb8a684,
      roughness: 0.9,
      metalness: 0.0,
    });

    // Cream fungal stem
    this.mushroomStemMaterial = new THREE.MeshStandardMaterial({
      color: 0xcfc3a6,
      roughness: 0.9,
      metalness: 0.0,
    });

    // Understory fern fronds
    this.fernLeafMaterial = new THREE.MeshStandardMaterial({
      color: 0x3f5a24,
      roughness: 0.85,
      metalness: 0.0,
      side: THREE.DoubleSide,
    });

    // Shallow, slightly tea-stained forest stream
    this.waterStreamMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x26332a,
      roughness: 0.06,
      metalness: 0.0,
      ior: 1.33,
      transparent: true,
      opacity: 0.88,
    });

    this.buildTemplates();
  }

  private own<T extends THREE.BufferGeometry>(g: T): T {
    this.ownedGeometries.push(g);
    return g;
  }

  private buildTemplates(): void {
    let s = 4242;
    const rnd = () => {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };

    // Shared smooth moss-cushion geometry
    const mossGeom = this.own(new THREE.IcosahedronGeometry(1, 2));

    // 1. Ancient mossy ruin arch spanning the road
    this.ruinArchTemplate = new THREE.Group();

    // Pillars: inner faces at |x| = 6.4, extend 1 m below ground for slopes
    const pGeom = this.own(new THREE.BoxGeometry(2.4, 12.0, 2.4));
    const pL = new THREE.Mesh(pGeom, this.mossyStoneMaterial);
    pL.position.set(-7.6, 5.0, 0);
    pL.rotation.y = 0.04;
    const pR = new THREE.Mesh(pGeom, this.mossyStoneMaterial);
    pR.position.set(7.6, 5.0, 0);
    pR.rotation.y = -0.03;

    // Lintel resting on the pillars (underside at y = 11)
    const lintelGeom = this.own(new THREE.BoxGeometry(18.4, 2.2, 2.8));
    const lintel = new THREE.Mesh(lintelGeom, this.mossyStoneMaterial);
    lintel.position.set(0, 12.1, 0);

    // Carved keystone inset on the lintel face
    const keyGeom = this.own(new THREE.BoxGeometry(1.6, 2.4, 0.3));
    const keystone = new THREE.Mesh(keyGeom, this.ancientCarvingMaterial);
    keystone.position.set(0, 12.1, 1.45);

    // Moss cushions on top of the lintel and pillar heads
    const mossA = new THREE.Mesh(mossGeom, this.mossMaterial);
    mossA.position.set(-2.8, 13.2, 0.2);
    mossA.scale.set(2.6, 0.45, 1.5);
    const mossB = new THREE.Mesh(mossGeom, this.mossMaterial);
    mossB.position.set(3.6, 13.2, -0.2);
    mossB.scale.set(3.2, 0.5, 1.4);
    const mossC = new THREE.Mesh(mossGeom, this.mossMaterial);
    mossC.position.set(-7.6, 13.25, 0);
    mossC.scale.set(1.3, 0.35, 1.4);

    this.ruinArchTemplate.add(pL, pR, lintel, keystone, mossA, mossB, mossC);

    // 2. Broken column
    this.ruinPillarTemplate = new THREE.Group();
    const colBase = new THREE.Mesh(
      this.own(new THREE.CylinderGeometry(1.4, 1.7, 1.8, 16)),
      this.mossyStoneMaterial
    );
    colBase.position.set(0, 0.5, 0);
    const colShaft = new THREE.Mesh(
      this.own(new THREE.CylinderGeometry(1.2, 1.4, 6.5, 16)),
      this.mossyStoneMaterial
    );
    colShaft.position.set(0, 4.6, 0);
    colShaft.rotation.z = 0.08; // weathered tilt
    const colMoss = new THREE.Mesh(mossGeom, this.mossMaterial);
    colMoss.position.set(-0.25, 7.85, 0);
    colMoss.scale.set(1.15, 0.3, 1.15);
    const baseMoss = new THREE.Mesh(mossGeom, this.mossMaterial);
    baseMoss.position.set(0.3, 1.35, 0.2);
    baseMoss.scale.set(1.6, 0.3, 1.6);
    this.ruinPillarTemplate.add(colBase, colShaft, colMoss, baseMoss);

    // 3. Mushroom cluster (all caps at local x >= 0 so mirroring keeps it off the road)
    this.mushroomClusterTemplate = new THREE.Group();
    const capGeom = this.own(
      new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.5)
    );
    const gillGeom = this.own(new THREE.CircleGeometry(0.97, 20));
    gillGeom.rotateX(Math.PI / 2); // face downward
    const stemGeom = this.own(new THREE.CylinderGeometry(0.11, 0.15, 1, 10));
    stemGeom.translate(0, 0.5, 0);

    const shroomSpecs = [
      { x: 0.55, z: 0.1, stemH: 0.55, capR: 0.45 },
      { x: 1.45, z: -0.5, stemH: 0.9, capR: 0.62 },
      { x: 2.45, z: 0.35, stemH: 1.25, capR: 0.85 },
      { x: 3.3, z: -0.25, stemH: 0.7, capR: 0.5 },
      { x: 1.9, z: 0.9, stemH: 0.4, capR: 0.32 },
    ];
    for (const spec of shroomSpecs) {
      const shroom = new THREE.Group();
      const stem = new THREE.Mesh(stemGeom, this.mushroomStemMaterial);
      stem.position.y = -0.3; // rooted into the soil
      stem.scale.set(spec.capR * 1.6, spec.stemH + 0.3, spec.capR * 1.6);
      const cap = new THREE.Mesh(capGeom, this.mushroomCapMaterial);
      cap.position.y = spec.stemH;
      cap.scale.set(spec.capR, spec.capR * 0.55, spec.capR);
      const gills = new THREE.Mesh(gillGeom, this.mushroomGillMaterial);
      gills.position.y = spec.stemH + 0.005;
      gills.scale.setScalar(spec.capR);
      shroom.add(stem, cap, gills);
      shroom.position.set(spec.x, 0, spec.z);
      shroom.rotation.z = (rnd() - 0.5) * 0.25;
      shroom.rotation.x = (rnd() - 0.5) * 0.2;
      shroom.traverse(o => {
        if (o instanceof THREE.Mesh) {
          o.castShadow = true;
          o.receiveShadow = true;
        }
      });
      this.mushroomClusterTemplate.add(shroom);
    }

    // 4. Understory fern clump (arching tapered fronds)
    this.fernClusterTemplate = new THREE.Group();
    const frondGeom = this.own(this.createFrondGeometry(2.2, 0.42));
    const frondCount = 10;
    for (let f = 0; f < frondCount; f++) {
      const frond = new THREE.Mesh(frondGeom, this.fernLeafMaterial);
      frond.rotation.y = (f / frondCount) * Math.PI * 2 + (rnd() - 0.5) * 0.4;
      const sc = 0.75 + rnd() * 0.4;
      frond.scale.set(sc, sc * (0.85 + rnd() * 0.3), sc);
      frond.receiveShadow = true;
      this.fernClusterTemplate.add(frond);
    }

    // Shadows for ruins
    for (const tpl of [this.ruinArchTemplate, this.ruinPillarTemplate]) {
      tpl.traverse(o => {
        if (o instanceof THREE.Mesh) {
          o.castShadow = true;
          o.receiveShadow = true;
        }
      });
    }
  }

  /** Tapered, arching, slightly folded fern frond rooted at the origin, growing along +x. */
  private createFrondGeometry(length: number, maxWidth: number): THREE.BufferGeometry {
    const rows = 10;
    const geom = new THREE.PlaneGeometry(1, 1, 2, rows);
    const pos = geom.attributes.position;

    // Precompute the arching spine
    const spineX: number[] = [0];
    const spineY: number[] = [0];
    const dt = 1 / rows;
    for (let r = 1; r <= rows; r++) {
      const t = (r - 0.5) * dt;
      const theta = 0.95 - 1.5 * t; // rises, then droops
      spineX.push(spineX[r - 1] + Math.cos(theta) * length * dt);
      spineY.push(spineY[r - 1] + Math.sin(theta) * length * dt);
    }

    for (let i = 0; i < pos.count; i++) {
      const u = pos.getX(i); // -0.5..0.5 across
      const t = pos.getY(i) + 0.5; // 0 base .. 1 tip
      const r = Math.round(t * rows);
      const w = maxWidth * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.05)), 0.8) * (1 - t * 0.35);
      pos.setXYZ(i, spineX[r], spineY[r] - Math.abs(u) * w * 0.35, u * w);
    }
    geom.computeVertexNormals();
    return geom;
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

  /**
   * The cluster extends toward local +x only; it is mirrored by the sign of
   * `position.x` so it always grows away from the road.
   */
  public spawnMushrooms(position: THREE.Vector3, scale = 1.0): THREE.Group {
    const cluster = this.mushroomClusterTemplate!.clone(true);
    const side = position.x < 0 ? -1 : 1;
    cluster.position.copy(position);
    cluster.scale.set(side * scale, scale, scale);
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

  /**
   * Gently meandering water ribbon. Geometry is cached per (length, width) and
   * shared between spawns.
   */
  public createStreamRibbon(startPos: THREE.Vector3, length: number, width: number): THREE.Mesh {
    const key = `${length}x${width}`;
    let geom = this.streamGeometries.get(key);
    if (!geom) {
      geom = new THREE.PlaneGeometry(width, length, 4, 24);
      geom.rotateX(-Math.PI / 2);
      const pos = geom.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const z = pos.getZ(i);
        pos.setX(i, pos.getX(i) + Math.sin(z * 0.12) * 0.6);
      }
      geom.computeVertexNormals();
      this.streamGeometries.set(key, geom);
    }

    const mesh = new THREE.Mesh(geom, this.waterStreamMaterial);
    mesh.position.copy(startPos);
    mesh.receiveShadow = true;
    this.group.add(mesh);
    return mesh;
  }

  public removeObject(obj: THREE.Object3D): void {
    this.group.remove(obj);
  }

  public update(_time: number): void {
    // Static, naturally lit props: nothing to animate per frame.
  }

  public dispose(): void {
    this.scene.remove(this.group);

    for (const g of this.ownedGeometries) g.dispose();
    this.ownedGeometries = [];
    for (const g of this.streamGeometries.values()) g.dispose();
    this.streamGeometries.clear();

    this.mossyStoneMaterial.dispose();
    this.ancientCarvingMaterial.dispose();
    this.mossMaterial.dispose();
    this.mushroomCapMaterial.dispose();
    this.mushroomGillMaterial.dispose();
    this.mushroomStemMaterial.dispose();
    this.fernLeafMaterial.dispose();
    this.waterStreamMaterial.dispose();
  }
}
