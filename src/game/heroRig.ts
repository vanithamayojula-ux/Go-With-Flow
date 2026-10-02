import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { HeroId } from '../types';
import { heroById } from './heroes';

export const BONE_NAMES = {
  hips: 'hips',
  spine: 'spine',
  head: 'head',
  leftArm: 'upperArmL',
  leftForearm: 'foreArmL',
  rightArm: 'upperArmR',
  rightForearm: 'foreArmR',
  leftThigh: 'thighL',
  leftShin: 'shinL',
  rightThigh: 'thighR',
  rightShin: 'shinR',
} as const;

export const AXIS = { x: 1, y: 1, z: 1 };

export interface LoadedHeroData {
  gltf: any;
  skinned: THREE.SkinnedMesh[];
}

export interface HeroRig {
  root: THREE.Group;
  bodyGroup: THREE.Group;
  scene: THREE.Object3D;
  body: THREE.Object3D;
  head: THREE.Object3D;
  armL: THREE.Object3D;
  armR: THREE.Object3D;
  legL: THREE.Object3D;
  legR: THREE.Object3D;
  drivers: {
    hips: THREE.Object3D;
    spine: THREE.Object3D;
    chest: THREE.Object3D;
    neck: THREE.Object3D;
    head: THREE.Object3D;
    leftShoulder: THREE.Object3D;
    leftArm: THREE.Object3D;
    leftForearm: THREE.Object3D;
    rightShoulder: THREE.Object3D;
    rightArm: THREE.Object3D;
    rightForearm: THREE.Object3D;
    leftThigh: THREE.Object3D;
    leftShin: THREE.Object3D;
    leftFoot: THREE.Object3D;
    rightThigh: THREE.Object3D;
    rightShin: THREE.Object3D;
    rightFoot: THREE.Object3D;
  };
  syncBones: () => void;
  skinned: boolean;
  hipsRestY?: number;
}

const cache = new Map<HeroId, Promise<LoadedHeroData | null> | LoadedHeroData>();
const loader = new GLTFLoader();

export async function loadHeroModel(heroId: HeroId): Promise<LoadedHeroData | null> {
  const cached = cache.get(heroId);
  if (cached) {
    return cached instanceof Promise ? cached : Promise.resolve(cached);
  }

  const isBrowser = typeof window !== 'undefined';
  if (!isBrowser) {
    try {
      const fsMod = 'fs';
      const pathMod = 'path';
      const fs: any = await import(/* @vite-ignore */ fsMod);
      const path: any = await import(/* @vite-ignore */ pathMod);
      const proc = (globalThis as any).process;
      const cwd = proc && typeof proc.cwd === 'function' ? proc.cwd() : '.';
      const filePath = path.resolve(cwd, `public/models/${heroId}.glb`);
      const buf = fs.readFileSync(filePath);
      const arrayBuf = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
      const p = new Promise<LoadedHeroData | null>((resolve) => {
        loader.parse(
          arrayBuf,
          '',
          (gltf) => {
            const skinned: THREE.SkinnedMesh[] = [];
            gltf.scene.traverse((o: THREE.Object3D) => {
              if ((o as THREE.SkinnedMesh).isSkinnedMesh) {
                skinned.push(o as THREE.SkinnedMesh);
              }
            });
            const data: LoadedHeroData = { gltf, skinned };
            cache.set(heroId, data);
            resolve(data);
          },
          (err) => {
            console.error(`[HeroRig] Failed to parse model for ${heroId}`, err);
            resolve(null);
          }
        );
      });
      cache.set(heroId, p);
      return p;
    } catch (e) {
      console.warn('[HeroRig] Node loading fallback', e);
    }
  }

  const primaryPath = `/models/${heroId}.glb`;
  const fallbackPath = `models/${heroId}.glb`;

  const p = new Promise<LoadedHeroData | null>((resolve) => {
    loader.load(
      primaryPath,
      (gltf) => {
        const skinned: THREE.SkinnedMesh[] = [];
        gltf.scene.traverse((o: THREE.Object3D) => {
          if ((o as THREE.SkinnedMesh).isSkinnedMesh) {
            skinned.push(o as THREE.SkinnedMesh);
          }
        });
        if (skinned.length === 0) {
          console.warn(`[HeroRig] No SkinnedMesh found in ${primaryPath}`);
        }
        const data: LoadedHeroData = { gltf, skinned };
        cache.set(heroId, data);
        resolve(data);
      },
      undefined,
      (err) => {
        // Fallback check
        loader.load(
          fallbackPath,
          (gltf) => {
            const skinned: THREE.SkinnedMesh[] = [];
            gltf.scene.traverse((o: THREE.Object3D) => {
              if ((o as THREE.SkinnedMesh).isSkinnedMesh) {
                skinned.push(o as THREE.SkinnedMesh);
              }
            });
            const data: LoadedHeroData = { gltf, skinned };
            cache.set(heroId, data);
            resolve(data);
          },
          undefined,
          (err2) => {
            console.error(`[HeroRig] Failed to load model for ${heroId}`, err2);
            resolve(null);
          }
        );
      }
    );
  });

  cache.set(heroId, p);
  return p;
}

export function isHeroModelReady(heroId: HeroId): boolean {
  const v = cache.get(heroId);
  return !!v && !(v instanceof Promise);
}

export function buildHeroRig(heroId: HeroId): HeroRig | null {
  const entry = cache.get(heroId);
  if (!entry || entry instanceof Promise) return null;

  const root = new THREE.Group();
  root.name = `HeroRig_${heroId}`;
  // Stand directly on the hoverboard deck surface (<0.02m snapped)
  root.position.set(0, 0.092, 0);

  const bodyGroup = new THREE.Group();
  bodyGroup.name = 'HeroBodyGroup';
  root.add(bodyGroup);

  const scene = entry.gltf.scene;
  scene.position.set(0, 0, 0);
  const heroDef = heroById(heroId);
  scene.rotation.set(0, heroDef.yawOffset || 0, 0); // Faces forward (+Z) along track
  bodyGroup.add(scene);

  const byName = new Map<string, THREE.Object3D>();
  scene.traverse((o: THREE.Object3D) => {
    if (o.name) {
      byName.set(o.name, o);
    }
  });

  const heroColor = new THREE.Color(heroDef.color);
  const trailColor = new THREE.Color(heroDef.trail);

  // Traverse skinned meshes and apply albedo lift, specular highlight & rim emissive
  scene.traverse((o: THREE.Object3D) => {
    if ((o as THREE.Mesh).isMesh || (o as THREE.SkinnedMesh).isSkinnedMesh) {
      const mesh = o as THREE.Mesh;
      mesh.frustumCulled = false;
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) {
        if (!m) continue;
        if ((m as THREE.MeshStandardMaterial).isMeshStandardMaterial || (m as any).isMaterial) {
          const stdMat = m as THREE.MeshStandardMaterial;

          // Hero materials solid & opaque: transparent=false, opacity=1, depthWrite=true, side=FrontSide, blending=NormalBlending
          stdMat.transparent = false;
          stdMat.opacity = 1.0;
          stdMat.depthWrite = true;
          stdMat.depthTest = true;
          stdMat.side = THREE.FrontSide;
          stdMat.blending = THREE.NormalBlending;
          stdMat.fog = false;

          // 1. Color map sRGB color space & mipmaps
          if (stdMat.map) {
            stdMat.map.colorSpace = THREE.SRGBColorSpace;
            stdMat.map.generateMipmaps = true;
            stdMat.map.minFilter = THREE.LinearMipmapLinearFilter;
            stdMat.map.needsUpdate = true;
          }

          // 2. Normal map softening (spikes *0.35 to prevent noisy spongy appearance)
          if (stdMat.normalMap) {
            stdMat.normalScale.set(0.35, 0.35);
          }

          // 3. Roughness & metalness tuning: base #1a2438 metal 0.6 rough 0.5
          stdMat.roughness = 0.5;
          stdMat.metalness = 0.6;
          stdMat.envMapIntensity = 0.9;

          // 4. Remove transmission, clearcoat, sheen noise
          (stdMat as any).transmission = 0;
          (stdMat as any).clearcoat = 0;
          (stdMat as any).sheen = 0;

          // 5. Albedo lift for dark heroes (Shadow, Void) — #0a0f1d -> #1a2438 lift, never pure black albedo
          const hsl = { h: 0, s: 0, l: 0 };
          stdMat.color.getHSL(hsl);
          if (hsl.l < 0.18) {
            stdMat.color.setHex(0x1a2438);
          } else if (hsl.l < 0.40) {
            stdMat.color.setHSL(hsl.h, Math.min(1.0, hsl.s * 1.1), Math.max(0.35, hsl.l * 1.5));
          }

          // 6. Visor (*2.0), veins (*1.2) and chest (cap 0.4) emissive tuning
          const matName = (stdMat.name || '').toLowerCase();
          const meshName = (mesh.name || '').toLowerCase();
          const isVisor = matName.includes('visor') || matName.includes('eye') || matName.includes('glass') || meshName.includes('visor');
          const isChest = matName.includes('chest') || matName.includes('body') || matName.includes('torso') || meshName.includes('chest') || meshName.includes('body');

          if (isVisor) {
            stdMat.emissive = new THREE.Color(0x00f0ff);
            stdMat.emissiveIntensity = 2.0; // visor *2.0
          } else if (isChest) {
            if (stdMat.emissive) {
              stdMat.emissive.copy(heroColor).multiplyScalar(0.20);
              stdMat.emissiveIntensity = 0.4; // chest cap 0.4
            }
          } else if (stdMat.emissive) {
            if (heroId === 'void') {
              stdMat.emissive.setHex(0x00f0ff).multiplyScalar(0.50);
              stdMat.emissiveIntensity = 1.2; // veins *1.2
            } else {
              stdMat.emissive.copy(heroColor).multiplyScalar(0.40);
              stdMat.emissiveIntensity = 1.2; // veins *1.2
            }
          }

          stdMat.needsUpdate = true;
        }
      }
    }
  });

  interface BoneDriverEntry {
    bone: THREE.Object3D;
    driver: THREE.Object3D;
    restQuat: THREE.Quaternion;
    restPos: THREE.Vector3;
    order: THREE.EulerOrder;
  }

  const driverEntries: BoneDriverEntry[] = [];

  const createDriver = (boneName: string, driverName: string, order: THREE.EulerOrder = 'YXZ') => {
    const bone = byName.get(boneName);
    const driver = new THREE.Object3D();
    driver.name = driverName;
    driver.rotation.order = order;
    if (bone) {
      driverEntries.push({
        bone,
        driver,
        restQuat: bone.quaternion.clone(),
        restPos: bone.position.clone(),
        order,
      });
    }
    return driver;
  };

  // Explicit Euler orders: hips/spine YXZ, shoulders/arms ZYX, thighs/shins YXZ
  const hipsDriver = createDriver(BONE_NAMES.hips, 'driver_hips', 'YXZ');
  const spineDriver = createDriver(BONE_NAMES.spine, 'driver_spine', 'YXZ');
  const headDriver = createDriver(BONE_NAMES.head, 'driver_head', 'YXZ');
  const leftArmDriver = createDriver(BONE_NAMES.leftArm, 'driver_leftArm', 'ZYX');
  const leftForearmDriver = createDriver(BONE_NAMES.leftForearm, 'driver_leftForearm', 'ZYX');
  const rightArmDriver = createDriver(BONE_NAMES.rightArm, 'driver_rightArm', 'ZYX');
  const rightForearmDriver = createDriver(BONE_NAMES.rightForearm, 'driver_rightForearm', 'ZYX');
  const leftThighDriver = createDriver(BONE_NAMES.leftThigh, 'driver_leftThigh', 'YXZ');
  const leftShinDriver = createDriver(BONE_NAMES.leftShin, 'driver_leftShin', 'YXZ');
  const rightThighDriver = createDriver(BONE_NAMES.rightThigh, 'driver_rightThigh', 'YXZ');
  const rightShinDriver = createDriver(BONE_NAMES.rightShin, 'driver_rightShin', 'YXZ');

  // Dummy drivers for joints not directly in hero skeleton
  const chestDriver = new THREE.Object3D();
  chestDriver.rotation.order = 'YXZ';
  const neckDriver = new THREE.Object3D();
  neckDriver.rotation.order = 'YXZ';
  const leftShoulderDriver = new THREE.Object3D();
  leftShoulderDriver.rotation.order = 'ZYX';
  const rightShoulderDriver = new THREE.Object3D();
  rightShoulderDriver.rotation.order = 'ZYX';
  const leftFootDriver = new THREE.Object3D();
  leftFootDriver.rotation.order = 'YXZ';
  const rightFootDriver = new THREE.Object3D();
  rightFootDriver.rotation.order = 'YXZ';

  if (driverEntries.length < 8) {
    console.warn(`[HeroRig] Insufficient bone drivers found (${driverEntries.length}/11) for ${heroId}`);
    return null;
  }

  const hipsEntry = driverEntries.find((d) => d.driver === hipsDriver);
  if (hipsEntry) {
    hipsDriver.position.copy(hipsEntry.restPos);
  }

  const e = new THREE.Euler();
  const q = new THREE.Quaternion();

  const syncBones = () => {
    for (const d of driverEntries) {
      const r = d.driver.rotation;
      e.set(r.x * AXIS.x, r.y * AXIS.y, r.z * AXIS.z, d.order);
      q.setFromEuler(e);
      // bone.quaternion = restQuat * drivenQuat (local-space)
      d.bone.quaternion.copy(d.restQuat).multiply(q);
    }

    // Dynamic hips elevation relative to baseline rest pose
    if (hipsEntry) {
      const dy = hipsDriver.position.y - hipsEntry.restPos.y;
      hipsEntry.bone.position.y = hipsEntry.restPos.y + dy;
    }
  };

  return {
    root,
    bodyGroup,
    scene,
    body: hipsDriver,
    head: headDriver,
    armL: leftArmDriver,
    armR: rightArmDriver,
    legL: leftThighDriver,
    legR: rightThighDriver,
    drivers: {
      hips: hipsDriver,
      spine: spineDriver,
      chest: chestDriver,
      neck: neckDriver,
      head: headDriver,
      leftShoulder: leftShoulderDriver,
      leftArm: leftArmDriver,
      leftForearm: leftForearmDriver,
      rightShoulder: rightShoulderDriver,
      rightArm: rightArmDriver,
      rightForearm: rightForearmDriver,
      leftThigh: leftThighDriver,
      leftShin: leftShinDriver,
      leftFoot: leftFootDriver,
      rightThigh: rightThighDriver,
      rightShin: rightShinDriver,
      rightFoot: rightFootDriver,
    },
    syncBones,
    skinned: true,
    hipsRestY: hipsEntry?.restPos.y || 0.885,
  };
}

export function disposeHeroModel(heroId: HeroId) {
  const entry = cache.get(heroId);
  if (!entry || entry instanceof Promise) return;
  entry.gltf.scene.traverse((o: THREE.Object3D) => {
    if ((o as THREE.Mesh).isMesh || (o as THREE.SkinnedMesh).isSkinnedMesh) {
      const mesh = o as THREE.Mesh;
      mesh.geometry?.dispose();
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) {
        if (m) {
          const matAny = m as any;
          matAny.map?.dispose?.();
          matAny.normalMap?.dispose?.();
          m.dispose();
        }
      }
    }
  });
  cache.delete(heroId);
}
