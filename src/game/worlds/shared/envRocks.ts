import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { EnvModelId, getLoadedEnvModel } from '../../../graphics/assetLibrary';
import { createTerrainMaterial, TerrainMaterialHandle, TerrainMaterialOptions } from './terrainMaterial';
import { InstancePool } from './instancePool';

/**
 * Instanced scanned rocks. Each model id gets one material (sharing a single
 * shader program with the other rock materials of the world) and a near pool
 * (casts shadows) plus a far pool (no shadows). Until the GLB arrives the
 * pools draw a smooth procedural stand-in normalised the same way as the
 * scanned geometry (footprint radius 1, base at y = 0), so placements stay
 * valid when the geometry is swapped.
 */

/** Approximate height (radius = 1) of each normalised scan, used for placement. */
export const ENV_MODEL_HEIGHT: Record<EnvModelId, number> = {
  boulder: 0.95,
  block: 0.95,
  slab: 1.0,
  shard: 0.6,
};

const fallbackCache = new Map<EnvModelId, THREE.BufferGeometry>();

/** Smooth noise-displaced stand-in rock (shared, never disposed). */
export function getFallbackRockGeometry(id: EnvModelId): THREE.BufferGeometry {
  const cached = fallbackCache.get(id);
  if (cached) return cached;
  const seed = { boulder: 1.3, block: 2.7, slab: 4.1, shard: 5.9 }[id];
  let g: THREE.BufferGeometry = new THREE.IcosahedronGeometry(1, 3);
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  g = mergeVertices(g);
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  const flatTop = id === 'block' || id === 'slab' ? 0.45 : 0.75;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const n =
      1 +
      Math.sin(x * 3.1 + y * 1.7 + seed) * 0.11 +
      Math.sin(z * 4.3 - x * 2.2 + seed * 1.7) * 0.07 +
      Math.sin(y * 6.7 + z * 5.1 + seed * 0.3) * 0.035;
    let yy = y > flatTop ? flatTop + (y - flatTop) * 0.45 : y;
    yy = yy < -0.3 ? -0.3 + (yy + 0.3) * 0.3 : yy;
    pos.setXYZ(i, x * n, yy * n, z * n * (id === 'slab' ? 0.55 : 1));
  }
  // Normalise: base at 0, footprint radius 1, height ENV_MODEL_HEIGHT
  g.computeBoundingBox();
  const bb = g.boundingBox!;
  g.translate(0, -bb.min.y, 0);
  let r = 0;
  for (let i = 0; i < pos.count; i++) r = Math.max(r, Math.hypot(pos.getX(i), pos.getZ(i)));
  g.scale(1 / r, 1, 1 / r);
  g.computeBoundingBox();
  const h = g.boundingBox!.max.y;
  g.scale(1, ENV_MODEL_HEIGHT[id] / Math.max(1e-4, h), 1);
  g.computeVertexNormals();
  // Simple cylindrical UVs (only used by the flat placeholder normal map)
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = Math.atan2(pos.getZ(i), pos.getX(i)) / (Math.PI * 2) + 0.5;
    uv[i * 2 + 1] = pos.getY(i);
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.computeBoundingSphere();
  fallbackCache.set(id, g);
  return g;
}

export type RockMaterialBase = Omit<TerrainMaterialOptions, 'name' | 'modelMaps' | 'vertexColors'>;

/** One terrain material per model id (same program for all of them). */
export function createRockMaterials(
  worldName: string,
  ids: readonly EnvModelId[],
  base: RockMaterialBase
): Map<EnvModelId, TerrainMaterialHandle> {
  const out = new Map<EnvModelId, TerrainMaterialHandle>();
  for (const id of ids) {
    out.set(id, createTerrainMaterial({ ...base, name: `${worldName}-rock-${id}`, modelMaps: true }));
  }
  return out;
}

export interface RockPools {
  near: Map<EnvModelId, InstancePool>;
  far: Map<EnvModelId, InstancePool>;
}

export function createRockPools(
  worldName: string,
  ids: readonly EnvModelId[],
  materials: Map<EnvModelId, TerrainMaterialHandle>,
  nearCapacity: number,
  farCapacity: number
): RockPools {
  const near = new Map<EnvModelId, InstancePool>();
  const far = new Map<EnvModelId, InstancePool>();
  for (const id of ids) {
    const geo = getLoadedEnvModel(id)?.geometry ?? getFallbackRockGeometry(id);
    const mat = materials.get(id)!.material;
    if (nearCapacity > 0) {
      const p = new InstancePool(`${worldName}-rock-${id}-near`, geo, mat, nearCapacity, { castShadow: true, colors: true });
      p.wantsShadow = true;
      near.set(id, p);
    }
    if (farCapacity > 0) {
      far.set(id, new InstancePool(`${worldName}-rock-${id}-far`, geo, mat, farCapacity, { colors: true }));
    }
  }
  return { near, far };
}

/** Swap loaded scanned geometry / maps into rock pools and materials. */
export function applyEnvModels(pools: RockPools, materials: Map<EnvModelId, TerrainMaterialHandle>): void {
  for (const [id, handle] of materials) {
    const model = getLoadedEnvModel(id);
    if (!model) continue;
    handle.setModel(model);
    pools.near.get(id)?.setGeometry(model.geometry);
    pools.far.get(id)?.setGeometry(model.geometry);
  }
}

const _tint = new THREE.Color();
/** Slight per-instance albedo variation (relative tint around 1). */
export function rockTint(r: number, amount = 0.14): THREE.Color {
  const k = 1 - amount + r * amount * 2;
  return _tint.setRGB(k, k * (0.985 + r * 0.03), k * (0.97 + r * 0.05));
}
