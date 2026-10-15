import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Crimson Dunes set dressing: template geometry builders, merged per material
 * so every prop type is a single instanced draw (or a couple of meshes for the
 * rare road-spanning arch):
 * 1. Monumental ancient sandstone arch spanning the road (opening clears |x| < 6.5)
 * 2. Sand-buried colonnade pillars & obelisks
 * 3. Sparse desert flora (ribbed saguaro cacti and dry scrub)
 * 4. Bronze solar relic emblem set into the arch keystone
 */

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
function mat(x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx): THREE.Matrix4 {
  return _m.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz));
}

function bake(g: THREE.BufferGeometry, m: THREE.Matrix4): THREE.BufferGeometry {
  const c = g.index ? g.toNonIndexed() : g.clone();
  c.applyMatrix4(m);
  return c;
}

function merge(parts: THREE.BufferGeometry[], groups = false): THREE.BufferGeometry {
  const m = mergeGeometries(parts, groups)!;
  for (const p of parts) p.dispose();
  m.computeBoundingSphere();
  return m;
}

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
 * Road-spanning arch: { stone, red (capitals / keystone), relic }. Pillars at
 * |x| = 8 (inner faces 6.5), semicircular vault springing at y = 11.
 */
export function buildDesertArchGeometries() {
  const baseGeom = new THREE.BoxGeometry(3.0, 5.0, 3.2);
  const midGeom = new THREE.BoxGeometry(2.5, 6.4, 2.5);
  const capitalGeom = new THREE.BoxGeometry(2.9, 0.6, 2.9);
  const stoneParts: THREE.BufferGeometry[] = [];
  const redParts: THREE.BufferGeometry[] = [];
  for (const sx of [-1, 1]) {
    stoneParts.push(bake(baseGeom, mat(sx * 8.0, 2.5, 0)));
    stoneParts.push(bake(midGeom, mat(sx * 8.0, 8.2, 0)));
    redParts.push(bake(capitalGeom, mat(sx * 8.0, 11.1, 0)));
  }
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
  stoneParts.push(bake(vaultGeom, mat(0, 11.0, 0)));
  redParts.push(bake(new THREE.BoxGeometry(1.8, 3.0, 2.8), mat(0, 19.0, 0)));
  const relicGeom = new THREE.CylinderGeometry(0.7, 0.7, 0.12, 32);
  relicGeom.rotateX(Math.PI / 2);
  const relic = merge([bake(relicGeom, mat(0, 19.0, -1.46)), bake(relicGeom, mat(0, 19.0, 1.46))]);
  baseGeom.dispose();
  midGeom.dispose();
  capitalGeom.dispose();
  vaultGeom.dispose();
  relicGeom.dispose();
  const stone = merge(stoneParts);
  const red = merge(redParts);
  stone.computeVertexNormals();
  return { stone, red, relic };
}

/** Sand-buried obelisk with groups [sandstone shaft, red tip]. */
export function buildObeliskGeometry(): THREE.BufferGeometry {
  const tilt = mat(0, 0, 0, 0, Math.PI / 4, 0.12);
  const tiltM = new THREE.Matrix4().copy(tilt);
  const shaft = new THREE.CylinderGeometry(0.8, 1.4, 9.0, 4);
  shaft.translate(0, 4.5, 0);
  const tip = new THREE.ConeGeometry(0.8, 1.2, 4);
  tip.translate(0, 9.6, 0);
  const a = bake(shaft, tiltM);
  const b = bake(tip, tiltM);
  shaft.dispose();
  tip.dispose();
  const g = merge([a, b], true);
  g.computeVertexNormals();
  return g;
}

/** Two sand-buried columns and a fallen drum, extending toward +x. */
export function buildRuinPillarsGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const tilts = [0.05, -0.04];
  for (let i = 0; i < 2; i++) {
    const h = 5.5 + i * 2.0;
    const col = new THREE.CylinderGeometry(1.1, 1.3, h, 16);
    parts.push(bake(col, mat(i * 3.5, h * 0.5, (i - 0.5) * 2.0, 0, 0, tilts[i])));
    col.dispose();
  }
  const drum = new THREE.CylinderGeometry(1.0, 1.0, 1.4, 16);
  parts.push(bake(drum, mat(5.6, 0.8, 1.2, Math.PI / 2, 0, 0.4)));
  drum.dispose();
  return merge(parts);
}

/** Saguaro: ribbed trunk with two rounded arms, one geometry. */
export function buildCactusGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const trunk = addCactusRibs(new THREE.CapsuleGeometry(0.45, 5.4, 6, 24));
  parts.push(bake(trunk, mat(0, 3.15, 0)));
  const armH = addCactusRibs(new THREE.CapsuleGeometry(0.3, 0.8, 4, 18));
  parts.push(bake(armH, mat(-0.8, 3.2, 0, 0, 0, Math.PI / 2)));
  parts.push(bake(armH, mat(0.8, 2.4, 0, 0, 0, Math.PI / 2)));
  const armLV = addCactusRibs(new THREE.CapsuleGeometry(0.3, 1.8, 4, 18));
  parts.push(bake(armLV, mat(-1.45, 4.2, 0)));
  const armRV = addCactusRibs(new THREE.CapsuleGeometry(0.3, 1.5, 4, 18));
  parts.push(bake(armRV, mat(1.45, 3.25, 0)));
  for (const g of [trunk, armH, armLV, armRV]) g.dispose();
  return merge(parts);
}

/** Dry scrub clump (three lumpy blobs), one geometry. */
export function buildShrubGeometry(): THREE.BufferGeometry {
  const blobs: Array<[number, number, number, number]> = [
    [0, 0.45, 0, 0.75],
    [0.6, 0.35, 0.25, 0.55],
    [-0.5, 0.3, -0.3, 0.5],
  ];
  const parts = blobs.map(([x, y, z, r], b) => bake(createScrubBlobGeometry(r, b * 1.7 + 0.4), mat(x, y, z)));
  const g = merge(parts);
  g.computeVertexNormals();
  return g;
}
