import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import type { WorldId } from '../game/WorldConfig';

/**
 * Lazy, cached loaders for the CC0 scanned environment assets (Poly Haven,
 * see public/textures/CREDITS.md).
 *
 * Layout (relative to the Vite base, so the build works from any path):
 *   textures/<world>/<name>_diff.webp   albedo (sRGB)
 *   textures/<world>/<name>_nor.webp    tangent-space normal, OpenGL (+Y) convention
 *   textures/<world>/<name>_arm.webp    R = ambient occlusion, G = roughness, B = metalness
 *   textures/shared/bark_*.webp         used by several worlds
 *   models/env/<id>.glb                 meshopt + webp scanned rocks
 *
 * Everything degrades gracefully: a failed or missing file only logs a warning
 * and the worlds keep their procedural fallbacks. Nothing here touches the DOM
 * at import time, so the module is safe to import under Node (tests).
 */

export interface ScanTextureSet {
  /** Albedo (sRGB). */
  map: THREE.Texture;
  /** Tangent-space normal map (linear, OpenGL convention). */
  normalMap: THREE.Texture;
  /** Packed AO / roughness / metalness (linear). */
  armMap: THREE.Texture;
}

export type EnvModelId = 'boulder' | 'block' | 'slab' | 'shard';

export interface EnvModel {
  id: EnvModelId;
  /**
   * Geometry normalised so its footprint radius (max horizontal distance of any
   * vertex from the Y axis) is 1 and its lowest point is y = 0. Attributes:
   * position, normal, uv (all float32). Shared: never dispose it per instance.
   */
  geometry: THREE.BufferGeometry;
  /** Height of the normalised geometry (radius = 1). */
  height: number;
  normalMap: THREE.Texture | null;
  /** Packed AO/roughness/metalness from the scan (R = AO, G = roughness). */
  armMap: THREE.Texture | null;
  map: THREE.Texture | null;
}

/** Texture sets (path stems below textures/) each world fetches. */
export const WORLD_TEXTURE_SETS: Record<WorldId, readonly string[]> = {
  'sky-isles': ['sky-isles/turf', 'sky-isles/cliff', 'shared/bark'],
  'verdant-wilds': ['verdant-wilds/floor', 'verdant-wilds/rock', 'shared/bark'],
  'crimson-dunes': ['crimson-dunes/sand', 'crimson-dunes/rock'],
  'crystal-heights': ['crystal-heights/snow', 'crystal-heights/rock', 'shared/bark'],
  'obsidian-core': ['obsidian-core/ground', 'obsidian-core/rock'],
};

/** Scanned rock models each world instances. */
export const WORLD_ENV_MODELS: Record<WorldId, readonly EnvModelId[]> = {
  'sky-isles': ['boulder', 'slab'],
  'verdant-wilds': ['boulder', 'block', 'slab'],
  'crimson-dunes': ['block', 'boulder', 'slab'],
  'crystal-heights': ['boulder', 'block', 'slab'],
  'obsidian-core': ['shard', 'block', 'boulder'],
};

// ---------------------------------------------------------------------------
// URLs
// ---------------------------------------------------------------------------

function baseUrl(): string {
  // Vite injects import.meta.env (BASE_URL is './' in builds, '/' in dev).
  // Under Node (tsx tests) import.meta.env is undefined.
  const env = (import.meta as unknown as { env?: { BASE_URL?: string } }).env;
  const b = env && typeof env.BASE_URL === 'string' ? env.BASE_URL : './';
  return b.endsWith('/') ? b : b + '/';
}

export function assetUrl(relative: string): string {
  return baseUrl() + relative.replace(/^\/+/, '');
}

const canLoad = (): boolean => typeof document !== 'undefined' && typeof Image !== 'undefined';

// ---------------------------------------------------------------------------
// Textures
// ---------------------------------------------------------------------------

let anisotropy = 8; // clamped to the GPU maximum by three.js
export function setAssetAnisotropy(value: number): void {
  anisotropy = Math.max(1, value);
  for (const t of loadedTextures.values()) t.anisotropy = anisotropy;
}

const texturePromises = new Map<string, Promise<THREE.Texture>>();
const loadedTextures = new Map<string, THREE.Texture>();
let textureLoader: THREE.TextureLoader | null = null;

/**
 * Loads one texture through <img> (THREE.TextureLoader), which keeps working
 * under a strict Content-Security-Policy (no fetch()/blob: needed). Cached by
 * URL for the whole session.
 */
export function loadTexture(relative: string, srgb: boolean): Promise<THREE.Texture> {
  const url = assetUrl(relative);
  const cached = texturePromises.get(url);
  if (cached) return cached;
  const p = new Promise<THREE.Texture>((resolve, reject) => {
    if (!canLoad()) {
      reject(new Error('no DOM'));
      return;
    }
    textureLoader ??= new THREE.TextureLoader();
    textureLoader.load(
      url,
      (tex) => {
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
        tex.anisotropy = anisotropy;
        tex.generateMipmaps = true;
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.name = relative;
        tex.needsUpdate = true;
        loadedTextures.set(url, tex);
        resolve(tex);
      },
      undefined,
      () => reject(new Error(`failed to load ${url}`))
    );
  });
  texturePromises.set(url, p);
  // A failed load may be retried later (e.g. offline blip)
  p.catch(() => texturePromises.delete(url));
  return p;
}

const setPromises = new Map<string, Promise<ScanTextureSet>>();
const loadedSets = new Map<string, ScanTextureSet>();

/**
 * Loads `<stem>_diff.webp`, `<stem>_nor.webp` and `<stem>_arm.webp` below
 * textures/. `stem` is e.g. 'crimson-dunes/sand'.
 */
export function loadTextureSet(stem: string): Promise<ScanTextureSet> {
  const cached = setPromises.get(stem);
  if (cached) return cached;
  const p = Promise.all([
    loadTexture(`textures/${stem}_diff.webp`, true),
    loadTexture(`textures/${stem}_nor.webp`, false),
    loadTexture(`textures/${stem}_arm.webp`, false),
  ]).then(([map, normalMap, armMap]) => {
    const set = { map, normalMap, armMap };
    loadedSets.set(stem, set);
    return set;
  });
  setPromises.set(stem, p);
  p.catch(() => setPromises.delete(stem));
  return p;
}

/** The texture set if it has finished loading, else null (never triggers a load). */
export function getLoadedTextureSet(stem: string): ScanTextureSet | null {
  return loadedSets.get(stem) ?? null;
}

// ---------------------------------------------------------------------------
// Models
// ---------------------------------------------------------------------------

let gltfLoader: GLTFLoader | null = null;
function getGltfLoader(): GLTFLoader {
  if (gltfLoader) return gltfLoader;
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  // Embedded textures decode through <img> (TextureLoader) instead of
  // ImageBitmapLoader, which fetch()es blob: URLs and is refused by a strict
  // Content-Security-Policy (same approach as heroRig.ts / obstacles.ts).
  loader.register((parser: any) => {
    parser.textureLoader = new THREE.TextureLoader(parser.options.manager);
    if (parser.options.crossOrigin) parser.textureLoader.setCrossOrigin(parser.options.crossOrigin);
    return { name: 'GWF_env_img_texture_loader' } as any;
  });
  gltfLoader = loader;
  return loader;
}

function toFloatAttribute(attr: THREE.BufferAttribute | THREE.InterleavedBufferAttribute, itemSize: number) {
  const out = new Float32Array(attr.count * itemSize);
  for (let i = 0; i < attr.count; i++) {
    out[i * itemSize] = attr.getX(i);
    if (itemSize > 1) out[i * itemSize + 1] = attr.getY(i);
    if (itemSize > 2) out[i * itemSize + 2] = attr.getZ(i);
  }
  return new THREE.BufferAttribute(out, itemSize);
}

/**
 * Bakes the mesh transform into a plain float32 geometry, then normalises it:
 * centred on the Y axis, base at y = 0, footprint radius 1.
 */
function normaliseEnvGeometry(mesh: THREE.Mesh): { geometry: THREE.BufferGeometry; height: number } {
  const src = mesh.geometry as THREE.BufferGeometry;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', toFloatAttribute(src.getAttribute('position'), 3));
  const nrm = src.getAttribute('normal');
  if (nrm) g.setAttribute('normal', toFloatAttribute(nrm, 3));
  const uv = src.getAttribute('uv');
  if (uv) g.setAttribute('uv', toFloatAttribute(uv, 2));
  if (src.index) g.setIndex(Array.from(src.index.array as ArrayLike<number>));

  mesh.updateWorldMatrix(true, false);
  g.applyMatrix4(mesh.matrixWorld);
  if (!nrm) g.computeVertexNormals();

  g.computeBoundingBox();
  const bb = g.boundingBox!;
  const cx = (bb.min.x + bb.max.x) * 0.5;
  const cz = (bb.min.z + bb.max.z) * 0.5;
  g.translate(-cx, -bb.min.y, -cz);
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  let r = 0;
  let h = 0;
  for (let i = 0; i < pos.count; i++) {
    r = Math.max(r, Math.hypot(pos.getX(i), pos.getZ(i)));
    h = Math.max(h, pos.getY(i));
  }
  const s = r > 1e-6 ? 1 / r : 1;
  g.scale(s, s, s);
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return { geometry: g, height: h * s };
}

const modelPromises = new Map<EnvModelId, Promise<EnvModel>>();
const loadedModels = new Map<EnvModelId, EnvModel>();

/** Loads `models/env/<id>.glb` (meshopt + webp) and normalises it (see EnvModel). */
export function loadEnvModel(id: EnvModelId): Promise<EnvModel> {
  const cached = modelPromises.get(id);
  if (cached) return cached;
  const url = assetUrl(`models/env/${id}.glb`);
  const p = new Promise<EnvModel>((resolve, reject) => {
    if (!canLoad()) {
      reject(new Error('no DOM'));
      return;
    }
    getGltfLoader().load(
      url,
      (gltf) => {
        let mesh: THREE.Mesh | null = null;
        gltf.scene.traverse((o) => {
          if (!mesh && (o as THREE.Mesh).isMesh) mesh = o as THREE.Mesh;
        });
        if (!mesh) {
          reject(new Error(`no mesh in ${url}`));
          return;
        }
        const m = mesh as THREE.Mesh;
        const { geometry, height } = normaliseEnvGeometry(m);
        const mat = (Array.isArray(m.material) ? m.material[0] : m.material) as THREE.MeshStandardMaterial;
        const prepTex = (t: THREE.Texture | null | undefined) => {
          if (!t) return null;
          t.anisotropy = anisotropy;
          return t;
        };
        const model: EnvModel = {
          id,
          geometry,
          height,
          normalMap: prepTex(mat?.normalMap),
          armMap: prepTex(mat?.roughnessMap ?? mat?.aoMap),
          map: prepTex(mat?.map),
        };
        // The source geometry is no longer needed (we baked a float copy)
        (m.geometry as THREE.BufferGeometry).dispose();
        loadedModels.set(id, model);
        resolve(model);
      },
      undefined,
      () => reject(new Error(`failed to load ${url}`))
    );
  });
  modelPromises.set(id, p);
  p.catch(() => modelPromises.delete(id));
  return p;
}

export function getLoadedEnvModel(id: EnvModelId): EnvModel | null {
  return loadedModels.get(id) ?? null;
}

// ---------------------------------------------------------------------------
// Per-world preloading / release
// ---------------------------------------------------------------------------

const worldPreloads = new Map<WorldId, Promise<void>>();

/**
 * Fetches every texture set and model the world uses. Never rejects: missing
 * assets are logged and the world keeps its procedural fallbacks.
 */
export function preloadWorldAssets(worldId: WorldId): Promise<void> {
  const cached = worldPreloads.get(worldId);
  if (cached) return cached;
  if (!canLoad()) return Promise.resolve();
  const jobs: Promise<unknown>[] = [];
  for (const stem of WORLD_TEXTURE_SETS[worldId]) jobs.push(loadTextureSet(stem));
  for (const id of WORLD_ENV_MODELS[worldId]) jobs.push(loadEnvModel(id));
  const p = Promise.allSettled(jobs).then((results) => {
    let failed = 0;
    for (const r of results) {
      if (r.status === 'rejected') {
        failed++;
        console.warn('[assetLibrary]', worldId, (r.reason as Error)?.message ?? r.reason);
      }
    }
    if (failed) worldPreloads.delete(worldId); // allow a retry next time
  });
  worldPreloads.set(worldId, p);
  return p;
}

/**
 * Frees the GPU copies of a world's scanned textures. The decoded images stay
 * cached, so three.js re-uploads them transparently if the world returns.
 * Textures shared with `keepWorld` (e.g. the bark set) are kept.
 */
export function releaseWorldTextures(worldId: WorldId, keepWorld?: WorldId | null): void {
  const keep = new Set(keepWorld ? WORLD_TEXTURE_SETS[keepWorld] : []);
  for (const stem of WORLD_TEXTURE_SETS[worldId]) {
    if (keep.has(stem) || stem.startsWith('shared/')) continue;
    const set = loadedSets.get(stem);
    if (!set) continue;
    set.map.dispose();
    set.normalMap.dispose();
    set.armMap.dispose();
  }
}

// ---------------------------------------------------------------------------
// 1x1 placeholders (no DOM needed). Materials are created with these bound so
// that swapping in the scanned maps later never changes the shader program.
// ---------------------------------------------------------------------------

function makePixel(r: number, g: number, b: number, srgb: boolean): THREE.DataTexture {
  const t = new THREE.DataTexture(new Uint8Array([r, g, b, 255]), 1, 1, THREE.RGBAFormat);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.needsUpdate = true;
  return t;
}

let placeholders: { white: THREE.DataTexture; flatNormal: THREE.DataTexture; arm: THREE.DataTexture } | null = null;

/** Shared 1x1 placeholders: white albedo, flat normal, ARM = (AO 1, rough 1, metal 0). */
export function getPlaceholderTextures() {
  placeholders ??= {
    white: makePixel(255, 255, 255, true),
    flatNormal: makePixel(128, 128, 255, false),
    arm: makePixel(255, 255, 0, false),
  };
  return placeholders;
}
