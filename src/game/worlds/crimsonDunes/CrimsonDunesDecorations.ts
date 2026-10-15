import * as THREE from 'three';
import { createCrimsonDunesNoiseTexture } from './CrimsonDunesTerrain';

/** Pulse range for the bronze relic's faint glow (kept well below "neon" levels). */
const RELIC_EMISSIVE_BASE = 0.3;
const RELIC_EMISSIVE_PULSE = 0.12;

/** Adds vertical ribs to a (vertical, Y-axis) cactus geometry, like a saguaro's pleats. */
function addCactusRibs(geom: THREE.BufferGeometry, ribs = 12, depth = 0.07): THREE.BufferGeometry {
  const pos = geom.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const theta = Math.atan2(x, z);
    const k = 1 + depth * Math.cos(theta * ribs);
    pos.setX(i, x * k);
    pos.setZ(i, z * k);
  }
  pos.needsUpdate = true;
  geom.computeVertexNormals();
  return geom;
}

/** Lumpy, slightly flattened blob used for dry desert scrub clumps. */
function createScrubBlobGeometry(radius: number, seed: number): THREE.BufferGeometry {
  const geom = new THREE.IcosahedronGeometry(radius, 2);
  const pos = geom.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    // Deterministic position-based displacement keeps duplicated vertices welded
    const n =
      1 +
      0.18 * Math.sin(x * 5.1 + seed) * Math.cos(z * 4.3 + seed * 0.7) +
      0.1 * Math.sin(y * 7.7 + x * 3.1 + seed * 1.3);
    pos.setXYZ(i, x * n, Math.max(-0.05, y * n * 0.7), z * n);
  }
  pos.needsUpdate = true;
  geom.computeVertexNormals();
  return geom;
}

/**
 * CrimsonDunesDecorations manages:
 * 1. Monumental Ancient Sandstone Arch spanning the road (opening clears |x| < 6.5)
 * 2. Sand-Buried Colonnade Pillars & Obelisks
 * 3. Sparse Desert Flora (ribbed saguaro cacti and dry scrub)
 * 4. Bronze Solar Relic emblem set into the arch keystone
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
  private noiseTexture: THREE.CanvasTexture | null;

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

    // Shared procedural stone grain (null in non-DOM environments)
    this.noiseTexture = createCrimsonDunesNoiseTexture(4242, 0.0);

    // Weathered ancient stone (#A8907A)
    this.sandstoneMaterial = new THREE.MeshStandardMaterial({
      color: 0xa8907a,
      roughness: 0.92,
      metalness: 0.0,
      map: this.noiseTexture,
      roughnessMap: this.noiseTexture,
      bumpMap: this.noiseTexture,
      bumpScale: 1.0,
    });

    // Darker iron-stained sandstone for keystones / accents
    this.sandstoneRedMaterial = new THREE.MeshStandardMaterial({
      color: 0x8f5c42,
      roughness: 0.9,
      metalness: 0.0,
      map: this.noiseTexture,
      bumpMap: this.noiseTexture,
      bumpScale: 1.0,
    });

    // Dusty saguaro green (#4A5E32)
    this.cactusGreenMaterial = new THREE.MeshStandardMaterial({
      color: 0x4a5e32,
      roughness: 0.85,
      metalness: 0.0,
    });

    // Dry desert scrub (#6B5A3A)
    this.dryBrushMaterial = new THREE.MeshStandardMaterial({
      color: 0x6b5a3a,
      roughness: 1.0,
      metalness: 0.0,
      map: this.noiseTexture,
      bumpMap: this.noiseTexture,
      bumpScale: 2.0,
    });

    // Aged bronze solar relic with a faint warm glow (small part only)
    this.solarCrystalMaterial = new THREE.MeshStandardMaterial({
      color: 0xb08d57,
      emissive: 0xd97706,
      emissiveIntensity: RELIC_EMISSIVE_BASE,
      roughness: 0.4,
      metalness: 0.85,
    });

    this.buildTemplates();
  }

  private setShadowFlags(root: THREE.Object3D, cast: boolean): void {
    root.traverse(obj => {
      if ((obj as THREE.Mesh).isMesh) {
        obj.castShadow = cast;
        obj.receiveShadow = true;
      }
    });
  }

  private buildTemplates(): void {
    // 1. Landmark: Monumental Ancient Desert Arch spanning the road.
    //    Pillars stand at |x| = 8; inner faces at |x| = 6.5 (base) / 6.75 (shaft); the
    //    semicircular ring springs at y = 11 with inner radius 6.75.
    this.desertArchTemplate = new THREE.Group();

    const baseGeom = new THREE.BoxGeometry(3.0, 5.0, 3.2);
    const midGeom = new THREE.BoxGeometry(2.5, 6.4, 2.5);
    const capitalGeom = new THREE.BoxGeometry(2.9, 0.6, 2.9);

    for (const sx of [-1, 1]) {
      const base = new THREE.Mesh(baseGeom, this.sandstoneMaterial);
      base.position.set(sx * 8.0, 2.5, 0);
      const shaft = new THREE.Mesh(midGeom, this.sandstoneMaterial);
      shaft.position.set(sx * 8.0, 5.0 + 3.2, 0);
      const capital = new THREE.Mesh(capitalGeom, this.sandstoneRedMaterial);
      capital.position.set(sx * 8.0, 11.1, 0); // spans y 10.8..11.4, inner face |x| = 6.55
      this.desertArchTemplate.add(base, shaft, capital);
    }

    // Semicircular voussoir ring with a rectangular cross-section
    const ringOuter = 9.25;
    const ringInner = 6.75;
    const ringShape = new THREE.Shape();
    ringShape.moveTo(ringOuter, 0);
    ringShape.absarc(0, 0, ringOuter, 0, Math.PI, false);
    ringShape.lineTo(-ringInner, 0);
    ringShape.absarc(0, 0, ringInner, Math.PI, 0, true);
    ringShape.lineTo(ringOuter, 0);
    const vaultGeom = new THREE.ExtrudeGeometry(ringShape, {
      depth: 2.4,
      curveSegments: 40,
      bevelEnabled: true,
      bevelThickness: 0.08,
      bevelSize: 0.08,
      bevelSegments: 1,
    });
    vaultGeom.translate(0, 0, -1.2);
    // Extrude UVs are in metres; scale so the stone grain matches the ~3 m block faces
    const vaultUV = vaultGeom.attributes.uv;
    for (let i = 0; i < vaultUV.count; i++) {
      vaultUV.setXY(i, vaultUV.getX(i) / 3, vaultUV.getY(i) / 3);
    }
    const vault = new THREE.Mesh(vaultGeom, this.sandstoneMaterial);
    vault.position.set(0, 11.0, 0);

    const keystoneGeom = new THREE.BoxGeometry(1.8, 3.0, 2.8);
    const keystone = new THREE.Mesh(keystoneGeom, this.sandstoneRedMaterial);
    keystone.position.set(0, 11.0 + 8.0, 0);

    // Bronze sun-disc emblem on both keystone faces
    const relicGeom = new THREE.CylinderGeometry(0.7, 0.7, 0.12, 32);
    relicGeom.rotateX(Math.PI / 2);
    const relicFront = new THREE.Mesh(relicGeom, this.solarCrystalMaterial);
    relicFront.position.set(0, 19.0, -1.46);
    const relicBack = new THREE.Mesh(relicGeom, this.solarCrystalMaterial);
    relicBack.position.set(0, 19.0, 1.46);

    this.desertArchTemplate.add(vault, keystone, relicFront, relicBack);
    this.setShadowFlags(this.desertArchTemplate, true);

    // 2. Sand-Buried Obelisk
    this.obeliskTemplate = new THREE.Group();
    const obeliskShaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.8, 1.4, 9.0, 4),
      this.sandstoneMaterial
    );
    obeliskShaft.position.set(0, 4.5, 0);
    obeliskShaft.rotation.y = Math.PI / 4;
    obeliskShaft.rotation.z = 0.12; // tilted in sand drift
    const obeliskTip = new THREE.Mesh(new THREE.ConeGeometry(0.8, 1.2, 4), this.sandstoneRedMaterial);
    obeliskTip.position.set(0, 4.5 + 0.6, 0);
    obeliskShaft.add(obeliskTip);
    this.obeliskTemplate.add(obeliskShaft);
    this.setShadowFlags(this.obeliskTemplate, true);

    // 3. Sand-Buried Ruin Pillars. Template extends towards +x (away from the road for a
    //    right-side spawn); spawnRuinPillars mirrors it for the left side.
    this.ruinPillarsTemplate = new THREE.Group();
    const tilts = [0.05, -0.04];
    for (let i = 0; i < 2; i++) {
      const h = 5.5 + i * 2.0;
      const col = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.3, h, 16), this.sandstoneMaterial);
      col.position.set(i * 3.5, h * 0.5, (i - 0.5) * 2.0);
      col.rotation.z = tilts[i];
      this.ruinPillarsTemplate.add(col);
    }
    const fallenDrum = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 1.4, 16), this.sandstoneMaterial);
    fallenDrum.rotation.set(Math.PI / 2, 0, 0.4);
    fallenDrum.position.set(5.6, 0.8, 1.2);
    this.ruinPillarsTemplate.add(fallenDrum);
    this.setShadowFlags(this.ruinPillarsTemplate, true);

    // 4. Saguaro Cactus (ribbed trunk with two rounded arms)
    this.cactusTemplate = new THREE.Group();
    const trunk = new THREE.Mesh(
      addCactusRibs(new THREE.CapsuleGeometry(0.45, 5.4, 6, 24)),
      this.cactusGreenMaterial
    );
    trunk.position.set(0, 0.45 + 2.7, 0);

    const armHorizGeom = addCactusRibs(new THREE.CapsuleGeometry(0.3, 0.8, 4, 18));
    const armLHoriz = new THREE.Mesh(armHorizGeom, this.cactusGreenMaterial);
    armLHoriz.rotation.z = Math.PI / 2;
    armLHoriz.position.set(-0.8, 3.2, 0);

    const armLVert = new THREE.Mesh(
      addCactusRibs(new THREE.CapsuleGeometry(0.3, 1.8, 4, 18)),
      this.cactusGreenMaterial
    );
    armLVert.position.set(-1.45, 4.2, 0);

    const armRHoriz = new THREE.Mesh(armHorizGeom, this.cactusGreenMaterial);
    armRHoriz.rotation.z = Math.PI / 2;
    armRHoriz.position.set(0.8, 2.4, 0);

    const armRVert = new THREE.Mesh(
      addCactusRibs(new THREE.CapsuleGeometry(0.3, 1.5, 4, 18)),
      this.cactusGreenMaterial
    );
    armRVert.position.set(1.45, 3.25, 0);

    this.cactusTemplate.add(trunk, armLHoriz, armLVert, armRHoriz, armRVert);
    this.setShadowFlags(this.cactusTemplate, true);

    // 5. Dry desert scrub clump
    this.shrubTemplate = new THREE.Group();
    const blobs: Array<[number, number, number, number]> = [
      [0, 0.45, 0, 0.75],
      [0.6, 0.35, 0.25, 0.55],
      [-0.5, 0.3, -0.3, 0.5],
    ];
    for (let b = 0; b < blobs.length; b++) {
      const [bx, by, bz, br] = blobs[b];
      const blob = new THREE.Mesh(createScrubBlobGeometry(br, b * 1.7 + 0.4), this.dryBrushMaterial);
      blob.position.set(bx, by, bz);
      this.shrubTemplate.add(blob);
    }
    this.setShadowFlags(this.shrubTemplate, true);
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

  /**
   * @param side +1 for the right of the road, -1 for the left. The colonnade is mirrored so
   *             it always extends away from the road.
   */
  public spawnRuinPillars(position: THREE.Vector3, scale = 1.0, side = Math.sign(position.x) || 1): THREE.Group {
    const pillars = this.ruinPillarsTemplate!.clone(true);
    pillars.position.copy(position);
    pillars.scale.set(scale, scale, scale);
    // Mirror by rotating half a turn (keeps positive determinant / correct winding)
    pillars.rotation.y = side < 0 ? Math.PI : 0;
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
    // Very subtle warm shimmer on the bronze relic (max 0.42)
    this.solarCrystalMaterial.emissiveIntensity =
      RELIC_EMISSIVE_BASE + Math.sin(time * 1.2) * RELIC_EMISSIVE_PULSE;
  }

  public dispose(): void {
    this.scene.remove(this.group);

    // Template geometries are shared by every clone; free them once here
    const disposed = new Set<THREE.BufferGeometry>();
    const templates = [
      this.desertArchTemplate,
      this.obeliskTemplate,
      this.ruinPillarsTemplate,
      this.cactusTemplate,
      this.shrubTemplate,
    ];
    for (const tpl of templates) {
      if (!tpl) continue;
      tpl.traverse(obj => {
        const mesh = obj as THREE.Mesh;
        if (mesh.isMesh && !disposed.has(mesh.geometry)) {
          disposed.add(mesh.geometry);
          mesh.geometry.dispose();
        }
      });
    }
    this.desertArchTemplate = null;
    this.obeliskTemplate = null;
    this.ruinPillarsTemplate = null;
    this.cactusTemplate = null;
    this.shrubTemplate = null;

    this.sandstoneMaterial.dispose();
    this.sandstoneRedMaterial.dispose();
    this.cactusGreenMaterial.dispose();
    this.dryBrushMaterial.dispose();
    this.solarCrystalMaterial.dispose();
    if (this.noiseTexture) {
      this.noiseTexture.dispose();
      this.noiseTexture = null;
    }
  }
}
