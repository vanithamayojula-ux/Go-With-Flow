import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Cheap deterministic 3D noise (sum of sines) used to roughen foliage clumps. */
function foliageNoise(x: number, y: number, z: number): number {
  return (
    Math.sin(x * 2.3 + 1.1) * Math.sin(y * 2.9 + 0.3) * Math.sin(z * 2.1 + 2.2) * 0.6 +
    Math.sin(x * 5.7 + 0.4) * Math.sin(y * 6.1 + 1.7) * Math.sin(z * 5.3 + 0.9) * 0.3
  );
}

/** Displaces a geometry radially from `center` by noise, then recomputes normals. */
function roughenClump(geom: THREE.BufferGeometry, center: THREE.Vector3, amount: number): void {
  const pos = geom.getAttribute('position') as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const dir = v.clone().sub(center);
    const len = dir.length();
    if (len < 1e-5) continue;
    dir.multiplyScalar(1 / len);
    const d = foliageNoise(v.x, v.y, v.z) * amount;
    v.addScaledVector(dir, d);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  pos.needsUpdate = true;
}

/**
 * Recomputes vertex normals and averages them across vertices sharing a
 * position (UV seams, poles), so smooth-shaded displaced shapes show no seams.
 */
function smoothNormals(geom: THREE.BufferGeometry): void {
  geom.computeVertexNormals();
  const pos = geom.getAttribute('position') as THREE.BufferAttribute;
  const nor = geom.getAttribute('normal') as THREE.BufferAttribute;
  const acc = new Map<string, THREE.Vector3>();
  const keys: string[] = new Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    const key = `${Math.round(pos.getX(i) * 1000)},${Math.round(pos.getY(i) * 1000)},${Math.round(pos.getZ(i) * 1000)}`;
    keys[i] = key;
    let a = acc.get(key);
    if (!a) {
      a = new THREE.Vector3();
      acc.set(key, a);
    }
    a.x += nor.getX(i);
    a.y += nor.getY(i);
    a.z += nor.getZ(i);
  }
  for (let i = 0; i < pos.count; i++) {
    const a = acc.get(keys[i])!;
    const l = a.length() || 1;
    nor.setXYZ(i, a.x / l, a.y / l, a.z / l);
  }
  nor.needsUpdate = true;
}

/**
 * Vertical streak texture for falling water (linear data, used as map + alphaMap
 * and scrolled downwards). Returns null without a DOM.
 */
function createWaterStreakTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const w = 64;
  const h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  let s = 98765;
  const rnd = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };

  const colBase = new Float32Array(w);
  for (let x = 0; x < w; x++) colBase[x] = 0.55 + rnd() * 0.45;
  // Soften neighbouring columns (wrapping) so streaks are a few px wide
  const col = new Float32Array(w);
  for (let x = 0; x < w; x++) {
    col[x] = (colBase[(x + w - 1) % w] + colBase[x] * 2 + colBase[(x + 1) % w]) / 4;
  }

  const img = ctx.createImageData(w, h);
  const phase = new Float32Array(w);
  for (let x = 0; x < w; x++) phase[x] = rnd() * Math.PI * 2;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // Periodic in y (integer frequencies) so the texture tiles vertically
      const t = (y / h) * Math.PI * 2;
      const pulse = 0.75 + 0.25 * Math.sin(t * 3 + phase[x]) * Math.sin(t * 7 + phase[(x * 7) % w]);
      const v = Math.min(1, Math.max(0, col[x] * pulse));
      const g = Math.round((0.8 + 0.2 * v) * 255);
      const a = Math.round(v * 255);
      const o = (y * w + x) * 4;
      img.data[o] = g;
      img.data[o + 1] = a; // alphaMap samples the green channel
      img.data[o + 2] = g;
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.NoColorSpace;
  tex.repeat.set(1, 4);
  tex.needsUpdate = true;
  return tex;
}

/**
 * SkyIslesDecorations manages:
 * 1. Environmental landmarks: weathered stone portal arch & sky temple shrines
 * 2. Waterfalls plunging off island rims
 * 3. Vegetation: broadleaf and conifer trees (single merged mesh each)
 */
export class SkyIslesDecorations {
  public group: THREE.Group;
  private scene: THREE.Scene;

  private stoneMaterial: THREE.MeshStandardMaterial;
  private goldAccentMaterial: THREE.MeshStandardMaterial;
  private roofMaterial: THREE.MeshStandardMaterial;
  private crystalMaterial: THREE.MeshPhysicalMaterial;
  private foliageGreenMaterial: THREE.MeshStandardMaterial;
  private coniferMaterial: THREE.MeshStandardMaterial;
  private woodBarkMaterial: THREE.MeshStandardMaterial;
  private waterfallMaterial: THREE.MeshPhysicalMaterial;

  private stoneTexture: THREE.Texture | null = null;
  private barkTexture: THREE.Texture | null = null;
  private waterTexture: THREE.CanvasTexture | null = null;

  // Reusable templates / shared geometries
  private portalArchTemplate: THREE.Group | null = null;
  private skyTempleTemplate: THREE.Group | null = null;
  private treeTemplate: THREE.Group | null = null;
  private broadleafGeom: THREE.BufferGeometry | null = null;
  private coniferGeom: THREE.BufferGeometry | null = null;
  private broadleafMats: THREE.Material[] = [];
  private coniferMats: THREE.Material[] = [];
  private ownedGeometries: THREE.BufferGeometry[] = [];

  private activeLandmarks: THREE.Object3D[] = [];
  // Floating crystals (slow spin) and the landmark each belongs to
  private activeCrystals: THREE.Object3D[] = [];
  private crystalOwners: THREE.Object3D[] = [];

  constructor(scene: THREE.Scene, detailTexture: THREE.Texture | null = null) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'SkyIslesDecorationsGroup';
    this.scene.add(this.group);

    if (detailTexture) {
      // Clones share the image source (one GPU upload) but tile independently
      this.stoneTexture = detailTexture.clone();
      this.stoneTexture.repeat.set(2, 2);
      this.barkTexture = detailTexture.clone();
      this.barkTexture.repeat.set(1, 4);
    }
    this.waterTexture = createWaterStreakTexture();

    // Weathered limestone
    this.stoneMaterial = new THREE.MeshStandardMaterial({
      color: 0xa39b8e,
      roughness: 0.9,
      metalness: 0.0,
      map: this.stoneTexture,
      bumpMap: this.stoneTexture,
      bumpScale: 0.8,
    });

    // Aged bronze trim (real metal, reflects the sky environment)
    this.goldAccentMaterial = new THREE.MeshStandardMaterial({
      color: 0x9c7a4a,
      roughness: 0.5,
      metalness: 0.85,
    });

    // Verdigris copper roof patina (non-metallic oxide layer)
    this.roofMaterial = new THREE.MeshStandardMaterial({
      color: 0x5f8574,
      roughness: 0.75,
      metalness: 0.1,
      map: this.stoneTexture,
    });

    // Clear quartz crystal, no emissive glow
    this.crystalMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xeef5f7,
      roughness: 0.06,
      metalness: 0.0,
      ior: 1.54,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      transparent: true,
      opacity: 0.55,
    });

    // Broadleaf canopy
    this.foliageGreenMaterial = new THREE.MeshStandardMaterial({
      color: 0x3f5a28,
      roughness: 0.9,
      metalness: 0.0,
      map: this.stoneTexture,
    });

    // Conifer needles
    this.coniferMaterial = new THREE.MeshStandardMaterial({
      color: 0x2b4024,
      roughness: 0.92,
      metalness: 0.0,
      map: this.stoneTexture,
    });

    // Bark
    this.woodBarkMaterial = new THREE.MeshStandardMaterial({
      color: 0x4a3a2a,
      roughness: 0.95,
      metalness: 0.0,
      map: this.barkTexture,
      bumpMap: this.barkTexture,
      bumpScale: 1.2,
    });

    // Falling aerated water
    this.waterfallMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xe4eef0,
      roughness: 0.18,
      metalness: 0.0,
      ior: 1.333,
      map: this.waterTexture,
      alphaMap: this.waterTexture,
      transparent: true,
      opacity: this.waterTexture ? 0.85 : 0.65,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    this.broadleafMats = [this.woodBarkMaterial, this.foliageGreenMaterial];
    this.coniferMats = [this.woodBarkMaterial, this.coniferMaterial];

    this.buildTemplates();
  }

  private own<T extends THREE.BufferGeometry>(g: T): T {
    this.ownedGeometries.push(g);
    return g;
  }

  private shadowed(mesh: THREE.Mesh): THREE.Mesh {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  private buildTemplates(): void {
    // 1. Landmark: weathered stone portal arch
    this.portalArchTemplate = new THREE.Group();

    const pedGeom = this.own(new THREE.BoxGeometry(2.2, 4.0, 2.2));
    const pedL = this.shadowed(new THREE.Mesh(pedGeom, this.stoneMaterial));
    pedL.position.set(-3.5, 2.0, 0);
    const pedR = this.shadowed(new THREE.Mesh(pedGeom, this.stoneMaterial));
    pedR.position.set(3.5, 2.0, 0);

    const colGeom = this.own(new THREE.CylinderGeometry(0.8, 1.0, 7.0, 20));
    const colL = this.shadowed(new THREE.Mesh(colGeom, this.stoneMaterial));
    colL.position.set(-3.5, 7.5, 0);
    const colR = this.shadowed(new THREE.Mesh(colGeom, this.stoneMaterial));
    colR.position.set(3.5, 7.5, 0);

    const archTop = this.shadowed(
      new THREE.Mesh(this.own(new THREE.TorusGeometry(3.5, 0.9, 14, 40, Math.PI)), this.stoneMaterial)
    );
    archTop.position.set(0, 11.0, 0);

    const crystalGeom = this.own(new THREE.OctahedronGeometry(1.2, 0));
    const crystal = this.shadowed(new THREE.Mesh(crystalGeom, this.crystalMaterial));
    crystal.position.set(0, 9.5, 0);
    crystal.scale.set(1.0, 1.8, 1.0);
    crystal.name = 'skyIslesCrystal';

    const goldHalo = this.shadowed(
      new THREE.Mesh(this.own(new THREE.TorusGeometry(2.6, 0.12, 10, 48)), this.goldAccentMaterial)
    );
    goldHalo.position.set(0, 9.5, 0);

    this.portalArchTemplate.add(pedL, pedR, colL, colR, archTop, crystal, goldHalo);

    // 2. Landmark: sky temple / wind shrine
    this.skyTempleTemplate = new THREE.Group();
    const templeBase = this.shadowed(
      new THREE.Mesh(this.own(new THREE.CylinderGeometry(4.2, 4.8, 2.0, 32)), this.stoneMaterial)
    );
    templeBase.position.set(0, 1.0, 0);

    const pillarGeom = this.own(new THREE.CylinderGeometry(0.35, 0.45, 5.0, 14));
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      const p = this.shadowed(new THREE.Mesh(pillarGeom, this.stoneMaterial));
      p.position.set(Math.cos(angle) * 3.0, 4.5, Math.sin(angle) * 3.0);
      this.skyTempleTemplate.add(p);
    }

    const lintel = this.shadowed(
      new THREE.Mesh(this.own(new THREE.CylinderGeometry(3.7, 3.7, 0.6, 32)), this.stoneMaterial)
    );
    lintel.position.set(0, 7.2, 0);

    const dome = this.shadowed(
      new THREE.Mesh(this.own(new THREE.ConeGeometry(3.9, 3.0, 32, 2)), this.roofMaterial)
    );
    dome.position.set(0, 9.0, 0);

    const shrineBeacon = this.shadowed(
      new THREE.Mesh(this.own(new THREE.OctahedronGeometry(0.7)), this.crystalMaterial)
    );
    shrineBeacon.position.set(0, 4.5, 0);
    shrineBeacon.scale.set(1.0, 1.8, 1.0);
    shrineBeacon.name = 'skyIslesCrystal';

    this.skyTempleTemplate.add(templeBase, lintel, dome, shrineBeacon);

    // 3. Trees: each variant is one merged geometry with [bark, foliage] groups
    this.broadleafGeom = this.own(this.buildBroadleafGeometry());
    this.coniferGeom = this.own(this.buildConiferGeometry());

    // Kept for compatibility: a broadleaf tree template group
    this.treeTemplate = new THREE.Group();
    this.treeTemplate.add(this.shadowed(new THREE.Mesh(this.broadleafGeom, this.broadleafMats)));
  }

  private buildBroadleafGeometry(): THREE.BufferGeometry {
    // Slightly leaning trunk with two limbs
    const trunk = new THREE.CylinderGeometry(0.18, 0.38, 3.8, 12, 4);
    trunk.translate(0, 1.9, 0);
    const tp = trunk.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < tp.count; i++) {
      const y = tp.getY(i);
      tp.setX(i, tp.getX(i) + 0.18 * (y / 3.8) * (y / 3.8));
    }
    const limbA = new THREE.CylinderGeometry(0.07, 0.14, 1.8, 8);
    limbA.rotateZ(0.85);
    limbA.translate(-0.55, 3.0, 0.1);
    const limbB = new THREE.CylinderGeometry(0.06, 0.12, 1.6, 8);
    limbB.rotateX(-0.8);
    limbB.translate(0.15, 3.1, 0.55);
    const bark = mergeGeometries([trunk, limbA, limbB])!;
    bark.computeVertexNormals();
    trunk.dispose();
    limbA.dispose();
    limbB.dispose();

    const clumps: Array<[number, number, number, number]> = [
      [0.2, 4.7, 0.0, 1.75],
      [1.2, 4.1, 0.3, 1.3],
      [-1.1, 4.2, -0.3, 1.35],
      [0.3, 4.0, 1.2, 1.2],
      [-0.2, 4.0, -1.2, 1.15],
      [0.3, 5.8, 0.1, 1.15],
      [-0.9, 5.2, 0.7, 1.0],
    ];
    const parts: THREE.BufferGeometry[] = [];
    const c = new THREE.Vector3();
    for (const [x, y, z, r] of clumps) {
      const g = new THREE.SphereGeometry(r, 16, 12);
      g.scale(1, 0.82, 1);
      g.translate(x, y, z);
      c.set(x, y, z);
      roughenClump(g, c, r * 0.22);
      parts.push(g);
    }
    const foliage = mergeGeometries(parts)!;
    for (const p of parts) p.dispose();
    smoothNormals(foliage);

    const merged = mergeGeometries([bark, foliage], true)!;
    bark.dispose();
    foliage.dispose();
    merged.computeBoundingSphere();
    return merged;
  }

  private buildConiferGeometry(): THREE.BufferGeometry {
    const trunk = new THREE.CylinderGeometry(0.12, 0.3, 6.6, 10, 2);
    trunk.translate(0, 3.3, 0);

    const tiers: Array<[number, number, number]> = [
      // radius, height, base y
      [2.0, 2.6, 1.6],
      [1.65, 2.4, 2.8],
      [1.3, 2.2, 3.9],
      [0.95, 2.0, 4.9],
      [0.6, 1.7, 5.9],
    ];
    const parts: THREE.BufferGeometry[] = [];
    const c = new THREE.Vector3();
    for (const [r, h, y] of tiers) {
      const g = new THREE.ConeGeometry(r, h, 16, 3);
      g.translate(0, y + h / 2, 0);
      c.set(0, y + h * 0.3, 0);
      roughenClump(g, c, r * 0.12);
      parts.push(g);
    }
    const foliage = mergeGeometries(parts)!;
    for (const p of parts) p.dispose();
    smoothNormals(foliage);

    const merged = mergeGeometries([trunk, foliage], true)!;
    trunk.dispose();
    foliage.dispose();
    merged.computeBoundingSphere();
    return merged;
  }

  private registerCrystals(landmark: THREE.Object3D): void {
    for (const child of landmark.children) {
      if (child.name === 'skyIslesCrystal') {
        this.activeCrystals.push(child);
        this.crystalOwners.push(landmark);
      }
    }
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
    this.registerCrystals(landmark);
    return landmark;
  }

  /**
   * Spawns a tree (broadleaf or conifer) as a single shadow-casting mesh
   */
  public spawnTree(pos: THREE.Vector3, scale = 1.0): THREE.Group {
    if (!this.broadleafGeom || !this.coniferGeom) return new THREE.Group();
    const conifer = Math.random() < 0.45;
    const mesh = this.shadowed(
      new THREE.Mesh(conifer ? this.coniferGeom : this.broadleafGeom, conifer ? this.coniferMats : this.broadleafMats)
    );
    const tree = new THREE.Group();
    tree.add(mesh);
    tree.position.copy(pos);
    const sy = scale * (0.9 + Math.random() * 0.25);
    tree.scale.set(scale, sy, scale);
    tree.rotation.y = Math.random() * Math.PI * 2;
    this.group.add(tree);
    this.activeLandmarks.push(tree);
    return tree;
  }

  /**
   * Creates a waterfall sheet plunging from `startPos` (its top edge).
   * The sheet arcs out along its local +Z; `facingAngle` rotates it about Y.
   */
  public createWaterfall(startPos: THREE.Vector3, height = 24.0, width = 2.4, facingAngle = 0): THREE.Mesh {
    const geom = new THREE.PlaneGeometry(width, height, 4, 16);
    geom.translate(0, -height / 2, 0);
    const p = geom.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const t = Math.min(1, Math.max(0, -p.getY(i) / height));
      // Arc outward off the lip, spreading wider as it falls
      p.setX(i, p.getX(i) * (1.0 + 0.7 * t));
      p.setZ(i, 2.2 * Math.sqrt(t));
    }
    geom.computeVertexNormals();
    const fall = new THREE.Mesh(geom, this.waterfallMaterial);
    fall.position.copy(startPos);
    fall.rotation.y = facingAngle;
    this.group.add(fall);
    return fall;
  }

  public removeObject(obj: THREE.Object3D): void {
    this.group.remove(obj);
    const idx = this.activeLandmarks.indexOf(obj);
    if (idx !== -1) this.activeLandmarks.splice(idx, 1);
    for (let i = this.crystalOwners.length - 1; i >= 0; i--) {
      if (this.crystalOwners[i] === obj) {
        this.crystalOwners.splice(i, 1);
        this.activeCrystals.splice(i, 1);
      }
    }
    // Waterfall meshes own their (unique) geometry
    const mesh = obj as THREE.Mesh;
    if (mesh.isMesh && mesh.material === this.waterfallMaterial) {
      mesh.geometry.dispose();
    }
  }

  public update(time: number): void {
    // Slow spin of the floating crystals
    const spin = time * 0.3;
    for (let i = 0; i < this.activeCrystals.length; i++) {
      this.activeCrystals[i].rotation.y = spin + i;
    }
    // Water streaks flow downward
    if (this.waterTexture) {
      this.waterTexture.offset.y = (time * 0.9) % 1;
    }
  }

  public dispose(): void {
    this.scene.remove(this.group);
    for (const child of this.group.children) {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh && mesh.material === this.waterfallMaterial) {
        mesh.geometry.dispose();
      }
    }
    for (const lm of this.activeLandmarks) {
      this.group.remove(lm);
    }
    this.group.clear();
    this.activeLandmarks = [];
    this.activeCrystals = [];
    this.crystalOwners = [];

    for (const g of this.ownedGeometries) g.dispose();
    this.ownedGeometries = [];

    this.stoneMaterial.dispose();
    this.goldAccentMaterial.dispose();
    this.roofMaterial.dispose();
    this.crystalMaterial.dispose();
    this.foliageGreenMaterial.dispose();
    this.coniferMaterial.dispose();
    this.woodBarkMaterial.dispose();
    this.waterfallMaterial.dispose();

    this.stoneTexture?.dispose();
    this.barkTexture?.dispose();
    this.waterTexture?.dispose();
  }
}
