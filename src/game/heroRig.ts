import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { HeroId } from '../types';
import { heroById } from './heroes';

if (typeof globalThis !== 'undefined' && typeof (globalThis as any).self === 'undefined') {
  (globalThis as any).self = globalThis;
}

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
// Hero GLBs (the default hero is 'custom' / model.glb; the others are
// model02..06.glb) may use EXT_meshopt_compression, so the meshopt decoder is
// required; without it the hero fails to load and the procedural skater +
// board is shown instead. The decoder runs on WebAssembly, so a CSP must allow
// 'wasm-unsafe-eval' (none is set today). EXT_texture_webp textures decode
// through the <img>-based TextureLoader registered below.
const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);

// Load embedded GLB textures through <img> (TextureLoader) instead of
// ImageBitmapLoader. ImageBitmapLoader fetch()es the blob: URLs GLTFLoader
// creates for embedded images, and hosts with a strict Content-Security-Policy
// (connect-src 'self') refuse that, leaving the hero untextured or unloaded.
// This is the same path three.js already uses on Safari.
if (typeof document !== 'undefined') {
  loader.register((parser: any) => {
    parser.textureLoader = new THREE.TextureLoader(parser.options.manager);
    if (parser.options.crossOrigin) parser.textureLoader.setCrossOrigin(parser.options.crossOrigin);
    return { name: 'GWF_img_texture_loader' } as any;
  });
}

/**
 * Fetch a model as raw bytes. Plain .glb files are used as-is; a `.b64.txt`
 * file holds the same GLB as base64 text, for static hosts that only serve
 * text and media types. Only same-origin fetches are made, so no data: or
 * blob: requests are needed.
 */
async function fetchModelBytes(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} loading ${url}`);
  if (url.endsWith('.b64.txt')) {
    const bin = atob((await res.text()).trim());
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes.buffer;
  }
  return res.arrayBuffer();
}

async function loadGltfFromUrl(url: string): Promise<any> {
  const bytes = await fetchModelBytes(url);
  const resourcePath = url.includes('/') ? url.slice(0, url.lastIndexOf('/') + 1) : '';
  return loader.parseAsync(bytes, resourcePath);
}

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
      const heroDef = heroById(heroId);
      const modelRelPath = heroDef?.modelUrl || `models/${heroId}.glb`;
      const filePath = path.resolve(cwd, modelRelPath.startsWith('/') ? `public${modelRelPath}` : `public/${modelRelPath}`);
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

  const heroDef = heroById(heroId);
  const modelPath = heroDef?.modelUrl || `models/${heroId}.glb`;

  const p = (async (): Promise<LoadedHeroData | null> => {
    try {
      const gltf = await loadGltfFromUrl(modelPath);
      const skinned: THREE.SkinnedMesh[] = [];
      gltf.scene.traverse((o: THREE.Object3D) => {
        if ((o as THREE.SkinnedMesh).isSkinnedMesh) {
          skinned.push(o as THREE.SkinnedMesh);
        }
      });
      const data: LoadedHeroData = { gltf, skinned };
      cache.set(heroId, data);
      return data;
    } catch (err) {
      console.error(`[HeroRig] Failed to load model for ${heroId} from ${modelPath}`, err);
      cache.delete(heroId); // allow a retry on the next selection
      return null;
    }
  })();

  cache.set(heroId, p);
  return p;
}

export function isHeroModelReady(heroId: HeroId): boolean {
  const v = cache.get(heroId);
  return !!v && !(v instanceof Promise);
}

/**
 * Keep the hero's authored PBR look: base-colour/normal/roughness/metalness
 * maps and values exactly as exported, a white colour factor (so the texture
 * shows true), no added emissive and a neutral environment response. Only the
 * render state is normalised so the hero is always a solid, opaque mesh.
 */
function applyAuthoredHeroMaterial(m: THREE.Material) {
  const stdMat = m as THREE.MeshStandardMaterial;
  stdMat.transparent = false;
  stdMat.opacity = 1.0;
  stdMat.depthWrite = true;
  stdMat.depthTest = true;
  stdMat.side = THREE.FrontSide;
  stdMat.blending = THREE.NormalBlending;
  stdMat.fog = false;

  if (stdMat.map) {
    stdMat.map.colorSpace = THREE.SRGBColorSpace;
    stdMat.map.generateMipmaps = true;
    stdMat.map.minFilter = THREE.LinearMipmapLinearFilter;
    stdMat.map.magFilter = THREE.LinearFilter;
    stdMat.map.anisotropy = 4;
    stdMat.map.needsUpdate = true;
  }

  // Textured parts show the texture unmodified; untextured parts keep their
  // authored base colour (never recoloured to a flat dark blue).
  if (stdMat.map && stdMat.color) stdMat.color.setRGB(1, 1, 1);
  if ('envMapIntensity' in stdMat) stdMat.envMapIntensity = 1.0;
  if (stdMat.emissive) stdMat.emissive.setRGB(0, 0, 0);
  if ('emissiveIntensity' in stdMat) stdMat.emissiveIntensity = 0;
  stdMat.needsUpdate = true;
}

export function buildHeroRig(heroId: HeroId): HeroRig | null {
  const entry = cache.get(heroId);
  if (!entry || entry instanceof Promise) return null;

  const heroDef = heroById(heroId);
  // Rigid path for the unskinned Cyber Surfer (model.glb); skinned heroes use
  // their bone rigs. (This used to test modelUrl.includes('model'), which also
  // matched every 'models/*.glb' path and disabled the skinned rigs.)
  const isCustomGlb = heroId === 'custom' || entry.skinned.length === 0;

  const root = new THREE.Group();
  root.name = `HeroRig_${heroId}`;
  // Stand directly on the hoverboard deck surface (<0.02m snapped)
  root.position.set(0, 0.014, 0);

  const bodyGroup = new THREE.Group();
  bodyGroup.name = 'HeroBodyGroup';
  root.add(bodyGroup);

  // Clone gltf scene cleanly using SkeletonUtils so SkinnedMesh skeletons bind properly
  const scene = SkeletonUtils.clone(entry.gltf.scene) as THREE.Group;
  scene.position.set(0, 0, 0);
  scene.rotation.set(0, 0, 0);
  scene.scale.set(1, 1, 1);
  scene.updateMatrixWorld(true);

  if (isCustomGlb) {
    // 1. Calculate raw bounding box
    const bbox = new THREE.Box3().setFromObject(scene);
    const size = bbox.getSize(new THREE.Vector3());

    // 2. Lock hero scale: standard hero crouching height = 1.72m
    const targetHeight = 1.72;
    const scaleFactor = size.y > 0.05 ? targetHeight / size.y : 2.80;
    scene.scale.setScalar(scaleFactor);
    scene.updateMatrixWorld(true);

    // 3. Align bottom of the character/board exactly on ground plane (y = 0) and center on X/Z with pivot
    const scaledBox = new THREE.Box3().setFromObject(scene);
    const scaledCenter = scaledBox.getCenter(new THREE.Vector3());
    const modelPivot = new THREE.Group();
    modelPivot.name = 'ModelPivot';
    modelPivot.add(scene);
    scene.position.x = -scaledCenter.x;
    scene.position.z = -scaledCenter.z;
    scene.position.y = -scaledBox.min.y;
    modelPivot.rotation.set(0, heroDef.yawOffset || 0, 0); // Faces forward (+Z) along track
    bodyGroup.add(modelPivot);

    // 4. Preserve authentic PBR textures & materials (never overwrite color with dark #1a2438 or add blown-out emissive)
    scene.traverse((o: THREE.Object3D) => {
      if ((o as THREE.Mesh).isMesh) {
        const mesh = o as THREE.Mesh;
        mesh.frustumCulled = false;
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const m of mats) {
          if (m) applyAuthoredHeroMaterial(m);
        }
      }
    });

    // Dedicated bone drivers so animation calls never crash or cross-talk
    const createJoint = (order: THREE.EulerOrder = 'YXZ') => {
      const obj = new THREE.Object3D();
      obj.rotation.order = order;
      return obj;
    };
    const hipsDriver = createJoint('YXZ');
    const spineDriver = createJoint('YXZ');

    return {
      root,
      bodyGroup,
      scene,
      body: scene,
      head: createJoint('YXZ'),
      armL: createJoint('ZYX'),
      armR: createJoint('ZYX'),
      legL: createJoint('YXZ'),
      legR: createJoint('YXZ'),
      drivers: {
        hips: hipsDriver,
        spine: spineDriver,
        chest: createJoint('YXZ'),
        neck: createJoint('YXZ'),
        head: createJoint('YXZ'),
        leftShoulder: createJoint('ZYX'),
        leftArm: createJoint('ZYX'),
        leftForearm: createJoint('ZYX'),
        rightShoulder: createJoint('ZYX'),
        rightArm: createJoint('ZYX'),
        rightForearm: createJoint('ZYX'),
        leftThigh: createJoint('YXZ'),
        leftShin: createJoint('YXZ'),
        leftFoot: createJoint('YXZ'),
        rightThigh: createJoint('YXZ'),
        rightShin: createJoint('YXZ'),
        rightFoot: createJoint('YXZ'),
      },
      syncBones: () => {
        // Option B: Multi-layer whole-body kinematics for rigid/unskinned cyber rider
        // The drivers on this path are never written by animatePlayerCharacter, so
        // they sit at zero; read them directly rather than through `||` sentinels
        // that substituted a rest offset and drove the model into the track.
        // 1. Vertical dynamic weight-shift: rhythmic riding bob, jump airtime lift, slide tuck
        bodyGroup.position.y = hipsDriver.position.y;

        // 2. Lateral carving bank into lane-shifts & curves
        bodyGroup.rotation.z = spineDriver.rotation.z * 0.55;

        // 3. Longitudinal pitch lean & trick flips
        bodyGroup.rotation.x = spineDriver.rotation.x * 0.45 + hipsDriver.rotation.x;

        // 4. Aerial trick yaw spin (360° corkscrews)
        bodyGroup.rotation.y = spineDriver.rotation.y;
      },
      skinned: false,
      hipsRestY: 0,
    };
  }

  scene.position.set(0, 0, 0);
  scene.rotation.set(0, heroDef.yawOffset || 0, 0); // Faces forward (+Z) along track
  bodyGroup.add(scene);

  // Lock hero scale: hero 1.7m
  scene.updateMatrixWorld(true);
  const bbox = new THREE.Box3().setFromObject(scene);
  const size = new THREE.Vector3();
  bbox.getSize(size);
  if (size.y > 0.05) {
    const scaleFactor = 1.70 / size.y;
    scene.scale.setScalar(scaleFactor);
  }

  const byName = new Map<string, THREE.Object3D>();
  scene.traverse((o: THREE.Object3D) => {
    if (o.name) {
      byName.set(o.name, o);
    }
    // Remove any pitched vertical board or standalone box inside hero models
    const lname = (o.name || '').toLowerCase();
    if (lname.includes('surfboard') || lname.includes('hoverboard') || (lname.includes('board') && !lname.includes('root'))) {
      o.visible = false;
    }
  });

  // Skinned heroes: same authored-PBR treatment as the rigid hero above (no
  // forced metalness/roughness, no albedo recolour, no hero-tinted emissive).
  scene.traverse((o: THREE.Object3D) => {
    if ((o as THREE.Mesh).isMesh || (o as THREE.SkinnedMesh).isSkinnedMesh) {
      const mesh = o as THREE.Mesh;
      mesh.frustumCulled = false;
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) {
        if (m) applyAuthoredHeroMaterial(m);
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
    console.info(`[HeroRig] Auto-framing custom/unskinned 3D model for ${heroId} onto hoverboard.`);

    // Auto-fit to hoverboard deck
    const box = new THREE.Box3().setFromObject(scene);
    const size = box.getSize(new THREE.Vector3());

    if (size.y > 0.001) {
      // In model.glb: height is ~0.613m in crouch. All other characters in game are 1.75m tall.
      // An athletic crouch for a 1.75m hero is ~1.45m high:
      const targetCrouchHeight = 1.45;
      const scale = targetCrouchHeight / size.y; // ~2.365x scale
      scene.scale.setScalar(scale);

      const scaledBox = new THREE.Box3().setFromObject(scene);
      const scaledCenter = scaledBox.getCenter(new THREE.Vector3());
      scene.position.x -= scaledCenter.x;
      scene.position.y -= scaledBox.min.y;
      scene.position.z -= scaledCenter.z;
    }

    // No per-rider lights: the scene keeps a constant light count (sun + sky)
    // so swapping heroes never recompiles every lit material mid-run.

    const dummyJoint = new THREE.Object3D();
    return {
      root,
      bodyGroup,
      scene,
      body: scene,
      head: dummyJoint,
      armL: dummyJoint,
      armR: dummyJoint,
      legL: dummyJoint,
      legR: dummyJoint,
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
      syncBones: () => {
        bodyGroup.rotation.z = spineDriver.rotation.z * 0.35;
        bodyGroup.rotation.x = spineDriver.rotation.x * 0.25;
        bodyGroup.rotation.y = spineDriver.rotation.y;
      },
      skinned: false,
      hipsRestY: 0,
    };
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
