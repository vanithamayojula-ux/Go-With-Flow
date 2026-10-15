import * as THREE from 'three';
import { GraphicsConfig } from '../../../types';
import {
  createMagmaWaterfallGeometry,
  getVolcanicLavaTexture,
  getVolcanicNoiseTexture,
} from './ObsidianCoreTerrain';

/**
 * ObsidianCoreDecorations manages:
 * 1. Basalt citadel landmark on the ridge (gate facing the road)
 * 2. Lava falls pouring off basalt cliffs into the side channels
 * 3. Stone fire bowls on the ash shoulder
 * 4. Basalt forge arches spanning the highway (inner faces at |x| = 6.4)
 */
export class ObsidianCoreDecorations {
  public group: THREE.Group;
  private scene: THREE.Scene;

  // Materials
  private obsidianDarkMaterial: THREE.MeshStandardMaterial;
  private basaltMaterial: THREE.MeshStandardMaterial;
  private moltenCoreMaterial: THREE.MeshStandardMaterial;
  private flameGlowMaterial: THREE.MeshStandardMaterial;
  private waterfallMaterial: THREE.MeshStandardMaterial;

  // Textures owned by this subsystem (clones sharing the lava image source)
  private coreLavaTexture: THREE.Texture | null = null;
  private fallLavaTexture: THREE.Texture | null = null;

  // Templates
  private citadelTemplate: THREE.Group | null = null;
  private brazierTemplate: THREE.Group | null = null;
  private archForgeTemplate: THREE.Group | null = null;

  // Cached lava-fall geometries (keyed by width x height)
  private fallGeoms: Map<string, { sheet: THREE.BufferGeometry; cliff: THREE.BufferGeometry }> = new Map();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'ObsidianCoreDecorationsGroup';
    this.scene.add(this.group);

    const noise = getVolcanicNoiseTexture();
    const lava = getVolcanicLavaTexture();
    if (lava) {
      this.coreLavaTexture = lava.clone();
      this.coreLavaTexture.repeat.set(0.5, 0.5);
      this.coreLavaTexture.needsUpdate = true;
      this.fallLavaTexture = lava.clone();
      this.fallLavaTexture.repeat.set(0.6, 1.4);
      this.fallLavaTexture.needsUpdate = true;
    }

    // Glassy obsidian: dark body, glossy reflective facets
    this.obsidianDarkMaterial = new THREE.MeshStandardMaterial({
      color: 0x1a1a1f,
      roughness: 0.15,
      metalness: 0.0,
      flatShading: true,
      envMapIntensity: 1.8,
    });

    // Rough basalt masonry / cliff rock
    this.basaltMaterial = new THREE.MeshStandardMaterial({
      color: 0x34312f,
      roughness: 0.9,
      metalness: 0.0,
      flatShading: true,
      map: noise,
      roughnessMap: noise,
    });

    // Molten lava (dark crust, HDR glow)
    this.moltenCoreMaterial = new THREE.MeshStandardMaterial({
      color: 0x2a0a00,
      emissive: 0xff4a10,
      emissiveIntensity: 2.0,
      emissiveMap: this.coreLavaTexture,
      roughness: 0.6,
      metalness: 0.0,
    });

    // Glowing coals in the fire bowls
    this.flameGlowMaterial = new THREE.MeshStandardMaterial({
      color: 0x2a0a00,
      emissive: 0xff7a20,
      emissiveIntensity: 2.5,
      emissiveMap: this.coreLavaTexture,
      roughness: 0.8,
      metalness: 0.0,
    });

    // Pouring lava sheet
    this.waterfallMaterial = new THREE.MeshStandardMaterial({
      color: 0x2a0a00,
      emissive: 0xff5a14,
      emissiveIntensity: this.fallLavaTexture ? 2.2 : 1.6,
      emissiveMap: this.fallLavaTexture,
      roughness: 0.5,
      metalness: 0.0,
      side: THREE.DoubleSide,
    });

    this.buildTemplates();
  }

  private static shadowed<T extends THREE.Mesh>(mesh: T): T {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  private buildTemplates(): void {
    const S = ObsidianCoreDecorations.shadowed;

    // 1. Landmark: basalt citadel. Local +Z is the gate side; the world rotates it
    //    to face the road and places it at |x| >= 32 on the ridge.
    this.citadelTemplate = new THREE.Group();

    const baseBlock = S(new THREE.Mesh(new THREE.BoxGeometry(28.0, 16.0, 18.0), this.basaltMaterial));
    baseBlock.position.set(0, 8.0, 0);

    const centerTower = S(new THREE.Mesh(
      new THREE.CylinderGeometry(3.5, 5.5, 38.0, 6),
      this.basaltMaterial
    ));
    centerTower.position.set(0, 27.0, 0);

    for (const sign of [-1, 1]) {
      const pTower = S(new THREE.Mesh(
        new THREE.CylinderGeometry(1.4, 3.8, 28.0, 5),
        this.obsidianDarkMaterial
      ));
      pTower.position.set(sign * 10.5, 22.0, 0);
      this.citadelTemplate.add(pTower);
    }

    // Forge gate: a recessed opening glowing with molten rock (no free-standing beam)
    const gate = new THREE.Mesh(new THREE.BoxGeometry(4.5, 6.0, 0.4), this.moltenCoreMaterial);
    gate.position.set(0, 3.0, 8.95);

    this.citadelTemplate.add(baseBlock, centerTower, gate);

    // 2. Stone fire bowl on the ash shoulder
    this.brazierTemplate = new THREE.Group();
    const pedestal = S(new THREE.Mesh(
      new THREE.CylinderGeometry(0.8, 1.1, 4.2, 7),
      this.basaltMaterial
    ));
    pedestal.position.set(0, 2.1, 0);

    const bowl = S(new THREE.Mesh(
      new THREE.CylinderGeometry(1.4, 0.7, 1.2, 9),
      this.basaltMaterial
    ));
    bowl.position.set(0, 4.5, 0);

    const coals = new THREE.Mesh(
      new THREE.SphereGeometry(1.25, 14, 6, 0, Math.PI * 2, 0, Math.PI * 0.5),
      this.flameGlowMaterial
    );
    coals.scale.set(1, 0.35, 1);
    coals.position.set(0, 4.95, 0);

    this.brazierTemplate.add(pedestal, bowl, coals);

    // 3. Basalt forge arch spanning the road: pillars x in [6.4, 8.8], lintel y >= 10.4
    this.archForgeTemplate = new THREE.Group();
    const archPillarL = S(new THREE.Mesh(new THREE.BoxGeometry(2.4, 11.0, 2.4), this.basaltMaterial));
    archPillarL.position.set(-7.6, 5.5, 0);
    const archPillarR = S(new THREE.Mesh(new THREE.BoxGeometry(2.4, 11.0, 2.4), this.basaltMaterial));
    archPillarR.position.set(7.6, 5.5, 0);
    const archTop = S(new THREE.Mesh(new THREE.BoxGeometry(18.0, 2.2, 2.8), this.basaltMaterial));
    archTop.position.set(0, 11.5, 0);

    this.archForgeTemplate.add(archPillarL, archPillarR, archTop);
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

  /**
   * Lava fall pouring down a basalt cliff. `startPos` is the foot of the fall
   * (at the lava channel); the sheet faces the road and the cliff sits behind it,
   * on the side of `startPos.x`.
   */
  public createMagmaFall(startPos: THREE.Vector3, height = 24.0, width = 4.0): THREE.Mesh {
    const key = `${width}x${height}`;
    let geoms = this.fallGeoms.get(key);
    if (!geoms) {
      const tilt = Math.atan2(1.8, height);
      const sheet = createMagmaWaterfallGeometry(width, height, 4, 10, tilt);
      const cliffH = height + 2.5;
      const cliff = new THREE.BoxGeometry(width + 4.0, cliffH, 6.0);
      cliff.translate(0, cliffH * 0.5 - 1.0, -3.05);
      cliff.rotateX(-tilt);
      geoms = { sheet, cliff };
      this.fallGeoms.set(key, geoms);
    }

    const side = startPos.x < 0 ? -1 : 1;
    const mesh = new THREE.Mesh(geoms.sheet, this.waterfallMaterial);
    mesh.position.copy(startPos);
    // Local +Z (sheet front) points towards the road
    mesh.rotation.y = -side * Math.PI * 0.5;

    const cliffMesh = new THREE.Mesh(geoms.cliff, this.basaltMaterial);
    cliffMesh.castShadow = true;
    cliffMesh.receiveShadow = true;
    mesh.add(cliffMesh);

    this.group.add(mesh);
    return mesh;
  }

  public removeObject(obj: THREE.Object3D): void {
    this.group.remove(obj);
  }

  public update(time: number): void {
    // Slow heat breathing on molten surfaces, quicker flicker on coals
    this.moltenCoreMaterial.emissiveIntensity = 3.5 + Math.sin(time * 1.5) * 0.4;
    this.flameGlowMaterial.emissiveIntensity =
      5.0 + Math.sin(time * 9.0) * 0.5 + Math.sin(time * 13.7 + 1.3) * 0.3;
    if (this.fallLavaTexture) {
      this.fallLavaTexture.offset.y = (time * 0.35) % 1;
    }
  }

  public dispose(): void {
    this.scene.remove(this.group);

    const disposeTemplate = (t: THREE.Group | null) => {
      if (!t) return;
      t.traverse(o => {
        if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).geometry.dispose();
      });
    };
    disposeTemplate(this.citadelTemplate);
    disposeTemplate(this.brazierTemplate);
    disposeTemplate(this.archForgeTemplate);
    this.citadelTemplate = null;
    this.brazierTemplate = null;
    this.archForgeTemplate = null;

    for (const g of this.fallGeoms.values()) {
      g.sheet.dispose();
      g.cliff.dispose();
    }
    this.fallGeoms.clear();

    this.obsidianDarkMaterial.dispose();
    this.basaltMaterial.dispose();
    this.moltenCoreMaterial.dispose();
    this.flameGlowMaterial.dispose();
    this.waterfallMaterial.dispose();

    if (this.coreLavaTexture) this.coreLavaTexture.dispose();
    if (this.fallLavaTexture) this.fallLavaTexture.dispose();
    this.coreLavaTexture = null;
    this.fallLavaTexture = null;
  }
}
