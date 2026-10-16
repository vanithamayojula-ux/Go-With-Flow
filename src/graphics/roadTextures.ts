import * as THREE from 'three';
import { computeRoadPixels, RoadPixels, RoadTextureSpec } from './roadTexturePixels';

/**
 * Procedural PBR maps for a worn asphalt highway with painted lane markings.
 *
 * One texture tile spans the full road width (u: x = -halfWidth..+halfWidth)
 * and `tileLength` metres of road (v), so it repeats cleanly along the road.
 * Large-scale tonal variation that would otherwise repeat with the tile is
 * added in the road material from world position (see `applyRoadMacroVariation`).
 *
 * The pixels (roadTexturePixels.ts, ~1.5 s of JS) are generated in a worker
 * while the title screen is up (prepareRoadTextures); getRoadTextures() then
 * only wraps them. Without a worker (or if the run starts first) it falls
 * back to generating them synchronously, exactly as before.
 */
export type { RoadTextureSpec } from './roadTexturePixels';

export interface RoadTextures {
  map: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
  normalMap: THREE.CanvasTexture;
}

const roadTextureCache = new Map<string, RoadTextures>();
const roadTexturePending = new Map<string, Promise<void>>();

/**
 * Session-cached road maps: generating the 1024-wide canvases is expensive, so
 * they are built once per spec and shared (callers must not dispose them).
 */
export function getRoadTextures(spec: RoadTextureSpec): RoadTextures {
  const key = JSON.stringify(spec);
  let t = roadTextureCache.get(key);
  if (!t) {
    t = createRoadTextures(spec);
    roadTextureCache.set(key, t);
  }
  return t;
}

export function createRoadTextures(spec: RoadTextureSpec): RoadTextures {
  return texturesFromPixels(computeRoadPixels(spec));
}

function texturesFromPixels(px: RoadPixels): RoadTextures {
  const finish = (data: Uint8ClampedArray, srgb: boolean) => {
    const canvas = document.createElement('canvas');
    canvas.width = px.width;
    canvas.height = px.height;
    const ctx = canvas.getContext('2d')!;
    ctx.putImageData(new ImageData(data as Uint8ClampedArray<ArrayBuffer>, px.width, px.height), 0, 0);
    const t = new THREE.CanvasTexture(canvas);
    t.wrapS = THREE.ClampToEdgeWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    return t;
  };
  return {
    map: finish(px.albedo, true),
    roughnessMap: finish(px.roughness, false),
    normalMap: finish(px.normal, false),
  };
}

/**
 * Generate the maps for `spec` off the main thread and cache them, so the
 * next getRoadTextures(spec) is instant. Resolves when they are cached (or
 * at once if they already are, or if no worker is available: getRoadTextures
 * then builds them synchronously). Never rejects.
 */
export function prepareRoadTextures(spec: RoadTextureSpec): Promise<void> {
  const key = JSON.stringify(spec);
  if (roadTextureCache.has(key)) return Promise.resolve();
  const pending = roadTexturePending.get(key);
  if (pending) return pending;
  if (typeof Worker === 'undefined' || typeof document === 'undefined') return Promise.resolve();
  const p = new Promise<void>(resolve => {
    let worker: Worker;
    try {
      worker = new Worker(new URL('./roadTextures.worker.ts', import.meta.url), { type: 'module' });
    } catch {
      resolve();
      return;
    }
    const done = () => {
      worker.terminate();
      roadTexturePending.delete(key);
      resolve();
    };
    worker.onmessage = (ev: MessageEvent<RoadPixels | { error: string }>) => {
      const data = ev.data as RoadPixels;
      if (data && data.albedo && !roadTextureCache.has(key)) {
        try {
          roadTextureCache.set(key, texturesFromPixels(data));
        } catch (err) {
          console.warn('[roadTextures] worker result unusable:', err);
        }
      }
      done();
    };
    worker.onerror = () => done();
    worker.postMessage(spec);
  });
  roadTexturePending.set(key, p);
  return p;
}

/**
 * Break up texture repetition on the road with low-frequency, world-space
 * variation: broad tonal blotches (tens of metres), fresher/older resurfaced
 * stretches, and a matching roughness shift. Purely shader-side, so it never
 * repeats with the texture tile.
 */
export function applyRoadMacroVariation(material: THREE.MeshStandardMaterial) {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vRoadWorldPos;')
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
{
  vec4 roadP = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
  roadP = instanceMatrix * roadP;
  #endif
  vRoadWorldPos = (modelMatrix * roadP).xyz;
}`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vRoadWorldPos;
float roadHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
float roadNoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(roadHash(i), roadHash(i + vec2(1.0, 0.0)), u.x),
             mix(roadHash(i + vec2(0.0, 1.0)), roadHash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float roadMacro() {
  vec2 p = vRoadWorldPos.xz;
  // Stretched along the road: resurfacing runs and tonal drift
  float n = roadNoise(p * vec2(0.09, 0.018)) * 0.55
          + roadNoise(p * vec2(0.25, 0.06) + 17.0) * 0.3
          + roadNoise(p * vec2(0.8, 0.22) + 41.0) * 0.15;
  return n;
}`
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
float roadM = roadMacro();
diffuseColor.rgb *= mix(0.84, 1.12, roadM);`
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
roughnessFactor = clamp(roughnessFactor * mix(0.92, 1.04, roadM), 0.0, 1.0);`
      );
  };
  material.customProgramCacheKey = () => 'road-macro-v2';
}
