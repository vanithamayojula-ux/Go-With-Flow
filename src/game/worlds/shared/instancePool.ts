import * as THREE from 'three';

/** Owner-side reference to one instance slot (slots move when others are removed). */
export class PoolHandle {
  slot = -1;
  constructor(public pool: InstancePool) {}
}

export interface InstancePoolOptions {
  castShadow?: boolean;
  receiveShadow?: boolean;
  /** Allocate per-instance colours (relative tint) up front. */
  colors?: boolean;
}

const _white = new THREE.Color(1, 1, 1);

/**
 * A fixed-capacity InstancedMesh used as a recyclable pool: streamed chunks add
 * instances and release them when culled, with no per-chunk geometry, material
 * or mesh allocation. Removal swaps the last live instance into the freed slot
 * so `count` always equals the number of live instances (tight bounding sphere,
 * no degenerate instances). Call `flush()` once per frame after changes.
 */
export class InstancePool {
  readonly mesh: THREE.InstancedMesh;
  readonly capacity: number;
  /** Cast shadows when the graphics preset enables them. */
  wantsShadow = false;
  private owners: (PoolHandle | null)[];
  private live = 0;
  private dirty = false;
  private colorDirty = false;
  private readonly tmp = new THREE.Matrix4();
  private readonly tmpColor = new THREE.Color();

  constructor(
    name: string,
    geometry: THREE.BufferGeometry,
    material: THREE.Material | THREE.Material[],
    capacity: number,
    opts: InstancePoolOptions = {}
  ) {
    this.capacity = capacity;
    this.mesh = new THREE.InstancedMesh(geometry, material, capacity);
    this.mesh.name = name;
    this.mesh.count = 0;
    this.mesh.visible = false;
    this.mesh.castShadow = !!opts.castShadow;
    this.wantsShadow = !!opts.castShadow;
    this.mesh.receiveShadow = opts.receiveShadow ?? true;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    if (opts.colors) {
      // Create the colour buffer now so the shader variant never changes later
      for (let i = 0; i < capacity; i++) this.mesh.setColorAt(i, _white);
      this.mesh.instanceColor!.setUsage(THREE.DynamicDrawUsage);
    }
    this.owners = new Array(capacity).fill(null);
  }

  get size(): number {
    return this.live;
  }

  /** Adds an instance; returns null when the pool is full. */
  add(matrix: THREE.Matrix4, color?: THREE.Color): PoolHandle | null {
    if (this.live >= this.capacity) return null;
    const h = new PoolHandle(this);
    const slot = this.live++;
    h.slot = slot;
    this.owners[slot] = h;
    this.mesh.setMatrixAt(slot, matrix);
    if (this.mesh.instanceColor) {
      this.mesh.setColorAt(slot, color ?? _white);
      this.colorDirty = true;
    }
    this.dirty = true;
    return h;
  }

  remove(h: PoolHandle | null): void {
    if (!h || h.pool !== this || h.slot < 0) return;
    const slot = h.slot;
    const last = --this.live;
    if (slot !== last) {
      const moved = this.owners[last]!;
      this.mesh.getMatrixAt(last, this.tmp);
      this.mesh.setMatrixAt(slot, this.tmp);
      if (this.mesh.instanceColor) {
        this.mesh.getColorAt(last, this.tmpColor);
        this.mesh.setColorAt(slot, this.tmpColor);
        this.colorDirty = true;
      }
      moved.slot = slot;
      this.owners[slot] = moved;
    }
    this.owners[last] = null;
    h.slot = -1;
    this.dirty = true;
  }

  setMatrix(h: PoolHandle, matrix: THREE.Matrix4): void {
    if (h.slot < 0) return;
    this.mesh.setMatrixAt(h.slot, matrix);
    this.dirty = true;
  }

  /** Swaps the geometry (e.g. procedural fallback -> scanned model); no recompile. */
  setGeometry(geometry: THREE.BufferGeometry): void {
    this.mesh.geometry = geometry;
    this.dirty = true;
  }

  flush(): void {
    if (!this.dirty) return;
    this.dirty = false;
    this.mesh.count = this.live;
    this.mesh.visible = this.live > 0;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.colorDirty && this.mesh.instanceColor) {
      this.mesh.instanceColor.needsUpdate = true;
      this.colorDirty = false;
    }
    if (this.live > 0) this.mesh.computeBoundingSphere();
  }

  clear(): void {
    for (let i = 0; i < this.live; i++) {
      const h = this.owners[i];
      if (h) h.slot = -1;
      this.owners[i] = null;
    }
    this.live = 0;
    this.dirty = true;
    this.flush();
  }

  /** Removes the mesh from its parent and frees the instance buffers (not geometry/material). */
  dispose(): void {
    this.clear();
    this.mesh.removeFromParent();
    this.mesh.dispose();
  }
}

const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _scl = new THREE.Vector3();
const _euler = new THREE.Euler();
const _m = new THREE.Matrix4();

/** Scratch TRS matrix helper (returns a shared matrix: use it immediately). */
export function trs(
  x: number,
  y: number,
  z: number,
  rotY: number,
  sx: number,
  sy = sx,
  sz = sx,
  rotX = 0,
  rotZ = 0
): THREE.Matrix4 {
  _pos.set(x, y, z);
  _euler.set(rotX, rotY, rotZ);
  _quat.setFromEuler(_euler);
  _scl.set(sx, sy, sz);
  return _m.compose(_pos, _quat, _scl);
}
