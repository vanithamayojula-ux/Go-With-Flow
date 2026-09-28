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

export const AXIS = { x: -1, y: 1, z: 1 };

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
}

const cache = new Map<HeroId, Promise<LoadedHeroData | null> | LoadedHeroData>();
const loader = new GLTFLoader();

export function loadHeroModel(heroId: HeroId): Promise<LoadedHeroData | null> {
  const cached = cache.get(heroId);
  if (cached) {
    return cached instanceof Promise ? cached : Promise.resolve(cached);
  }

  const modelPath = `/models/${heroId}.glb`;
  const p = new Promise<LoadedHeroData | null>((resolve) => {
    loader.load(
      modelPath,
      (gltf) => {
        const skinned: THREE.SkinnedMesh[] = [];
        gltf.scene.traverse((o: THREE.Object3D) => {
          if ((o as THREE.SkinnedMesh).isSkinnedMesh) {
            skinned.push(o as THREE.SkinnedMesh);
          }
        });
        if (skinned.length === 0) {
          console.warn(`[HeroRig] No SkinnedMesh found in ${modelPath}`);
        }
        const data: LoadedHeroData = { gltf, skinned };
        cache.set(heroId, data);
        resolve(data);
      },
      undefined,
      (err) => {
        console.error(`[HeroRig] Failed to load model at ${modelPath}`, err);
        // Fallback check: try relative path if absolute path fails in some environments
        loader.load(
          `models/${heroId}.glb`,
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
            console.error(`[HeroRig] Relative path also failed for ${heroId}`, err2);
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
  // Stand directly on the hoverboard surface
  root.position.set(0, 0.12, 0);

  const bodyGroup = new THREE.Group();
  bodyGroup.name = 'HeroBodyGroup';
  root.add(bodyGroup);

  const scene = entry.gltf.scene;
  scene.position.set(0, 0, 0);
  // Blender characters face along +Z, track runs toward -Z -> rotate 180 degrees
  scene.rotation.set(0, Math.PI, 0);
  bodyGroup.add(scene);

  const byName = new Map<string, THREE.Object3D>();
  scene.traverse((o: THREE.Object3D) => {
    if (o.name) {
      byName.set(o.name, o);
    }
  });

  const heroDef = heroById(heroId);
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

          // 1. Color map sRGB color space & mipmaps
          if (stdMat.map) {
            stdMat.map.colorSpace = THREE.SRGBColorSpace;
            stdMat.map.generateMipmaps = true;
            stdMat.map.minFilter = THREE.LinearMipmapLinearFilter;
            stdMat.map.needsUpdate = true;
          }

          // 2. Normal map softening (clamp normalScale to 0.45 to prevent noisy spongy appearance)
          if (stdMat.normalMap) {
            stdMat.normalScale.set(0.45, 0.45);
          }

          // 3. Roughness floor & metalness ceiling for solid matte cyber finish
          stdMat.roughness = Math.max(0.45, Math.min(stdMat.roughness || 0.5, 0.75));
          stdMat.metalness = Math.min(stdMat.metalness || 0.3, 0.65);
          stdMat.envMapIntensity = 0.8;

          // 4. Remove transmission, clearcoat, sheen noise
          (stdMat as any).transmission = 0;
          (stdMat as any).clearcoat = 0;
          (stdMat as any).sheen = 0;

          // 5. Albedo lift for dark heroes (Shadow, Void)
          const hsl = { h: 0, s: 0, l: 0 };
          stdMat.color.getHSL(hsl);
          if (hsl.l < 0.35) {
            stdMat.color.setHSL(hsl.h, Math.min(1.0, hsl.s * 1.2), Math.max(0.38, hsl.l * 1.9));
          }

          // 6. Hero accent rim emissive
          if (stdMat.emissive) {
            stdMat.emissive.copy(heroColor).multiplyScalar(0.28);
          }

          stdMat.needsUpdate = true;
        }
      }
    }
  });

  // Dedicated dynamic back rim light (behind and above hero, illuminating contours toward camera)
  const rimLight = new THREE.PointLight(heroDef.trail || heroDef.color, 3.4, 6.5);
  rimLight.position.set(0, 1.7, -0.65);
  root.add(rimLight);

  // Front fill light
  const frontFill = new THREE.PointLight(heroDef.color, 2.0, 5.5);
  frontFill.position.set(0, 1.4, 0.9);
  root.add(frontFill);

  interface BoneDriverEntry {
    bone: THREE.Object3D;
    driver: THREE.Object3D;
    restQuat: THREE.Quaternion;
    restPos: THREE.Vector3;
  }

  const driverEntries: BoneDriverEntry[] = [];

  const createDriver = (boneName: string, driverName: string) => {
    const bone = byName.get(boneName);
    const driver = new THREE.Object3D();
    driver.name = driverName;
    if (bone) {
      driverEntries.push({
        bone,
        driver,
        restQuat: bone.quaternion.clone(),
        restPos: bone.position.clone(),
      });
    }
    return driver;
  };

  const hipsDriver = createDriver(BONE_NAMES.hips, 'driver_hips');
  const spineDriver = createDriver(BONE_NAMES.spine, 'driver_spine');
  const headDriver = createDriver(BONE_NAMES.head, 'driver_head');
  const leftArmDriver = createDriver(BONE_NAMES.leftArm, 'driver_leftArm');
  const leftForearmDriver = createDriver(BONE_NAMES.leftForearm, 'driver_leftForearm');
  const rightArmDriver = createDriver(BONE_NAMES.rightArm, 'driver_rightArm');
  const rightForearmDriver = createDriver(BONE_NAMES.rightForearm, 'driver_rightForearm');
  const leftThighDriver = createDriver(BONE_NAMES.leftThigh, 'driver_leftThigh');
  const leftShinDriver = createDriver(BONE_NAMES.leftShin, 'driver_leftShin');
  const rightThighDriver = createDriver(BONE_NAMES.rightThigh, 'driver_rightThigh');
  const rightShinDriver = createDriver(BONE_NAMES.rightShin, 'driver_rightShin');

  // Dummy drivers for joints not directly in hero skeleton
  const chestDriver = new THREE.Object3D();
  const neckDriver = new THREE.Object3D();
  const leftShoulderDriver = new THREE.Object3D();
  const rightShoulderDriver = new THREE.Object3D();
  const leftFootDriver = new THREE.Object3D();
  const rightFootDriver = new THREE.Object3D();

  if (driverEntries.length < 8) {
    console.warn(`[HeroRig] Insufficient bone drivers found (${driverEntries.length}/11) for ${heroId}`);
    return null;
  }

  const hipsEntry = driverEntries.find((d) => d.driver === hipsDriver);

  const e = new THREE.Euler();
  const q = new THREE.Quaternion();

  const syncBones = () => {
    for (const d of driverEntries) {
      const r = d.driver.rotation;
      e.set(r.x * AXIS.x, r.y * AXIS.y, r.z * AXIS.z, 'XYZ');
      q.setFromEuler(e);
      d.bone.quaternion.copy(d.restQuat).multiply(q);
    }

    // Dynamic hips elevation (bobbing, sliding crouch, jumping rise)
    if (hipsEntry) {
      const dy = hipsDriver.position.y - 0.72;
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
