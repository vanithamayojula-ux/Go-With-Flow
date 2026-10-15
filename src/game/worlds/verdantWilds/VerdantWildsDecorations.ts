import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Verdant Wilds set dressing: template geometry builders, merged per material
 * so each prop is one or two draws (or one instanced draw for all copies):
 * 1. Weathered, moss-covered stone ruin arch & broken column
 * 2. Clusters of forest-floor mushrooms (one vertex-coloured geometry)
 * 3. Understory fern clumps (one geometry)
 * 4. Shallow forest stream ribbon along the roadside ditch
 *
 * Road clearance: nothing solid enters |x| < 6 below y = 8.
 * - Ruin arch pillars' inner faces sit at |x| = 6.4, lintel underside at y = 11.
 * - Mushroom clusters and ferns extend only outward (+x in local space) and are
 *   mirrored (rotated half a turn) for the left side.
 */

function bake(g: THREE.BufferGeometry, m: THREE.Matrix4): THREE.BufferGeometry {
  const c = g.index ? g.toNonIndexed() : g.clone();
  c.applyMatrix4(m);
  return c;
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
function mat(x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx): THREE.Matrix4 {
  return _m.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz));
}

function colorize(g: THREE.BufferGeometry, hex: number): THREE.BufferGeometry {
  const c = new THREE.Color(hex);
  const n = g.getAttribute('position').count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    arr[i * 3] = c.r;
    arr[i * 3 + 1] = c.g;
    arr[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}

function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const m = mergeGeometries(parts)!;
  for (const p of parts) p.dispose();
  m.computeBoundingSphere();
  return m;
}

/** Road-spanning ruin arch: { stone, carving (keystone), moss }. */
export function buildRuinArchGeometries() {
  const pillar = new THREE.BoxGeometry(2.4, 12.0, 2.4);
  const lintel = new THREE.BoxGeometry(18.4, 2.2, 2.8);
  const stone = merge([
    bake(pillar, mat(-7.6, 5.0, 0, 0, 0.04)),
    bake(pillar, mat(7.6, 5.0, 0, 0, -0.03)),
    bake(lintel, mat(0, 12.1, 0)),
  ]);
  const carving = bake(new THREE.BoxGeometry(1.6, 2.4, 0.3), mat(0, 12.1, 1.45));
  const moss = new THREE.IcosahedronGeometry(1, 2);
  const mossMerged = merge([
    bake(moss, mat(-2.8, 13.2, 0.2, 0, 0, 0, 2.6, 0.45, 1.5)),
    bake(moss, mat(3.6, 13.2, -0.2, 0, 0, 0, 3.2, 0.5, 1.4)),
    bake(moss, mat(-7.6, 13.25, 0, 0, 0, 0, 1.3, 0.35, 1.4)),
  ]);
  pillar.dispose();
  lintel.dispose();
  moss.dispose();
  return { stone, carving, moss: mossMerged };
}

/** Broken column: { stone, moss }. */
export function buildRuinPillarGeometries() {
  const stone = merge([
    bake(new THREE.CylinderGeometry(1.4, 1.7, 1.8, 16), mat(0, 0.5, 0)),
    bake(new THREE.CylinderGeometry(1.2, 1.4, 6.5, 16), mat(0, 4.6, 0, 0, 0, 0.08)),
  ]);
  const moss = new THREE.IcosahedronGeometry(1, 2);
  const mossMerged = merge([
    bake(moss, mat(-0.25, 7.85, 0, 0, 0, 0, 1.15, 0.3, 1.15)),
    bake(moss, mat(0.3, 1.35, 0.2, 0, 0, 0, 1.6, 0.3, 1.6)),
  ]);
  moss.dispose();
  return { stone, moss: mossMerged };
}

/**
 * Mushroom cluster as one vertex-coloured geometry (stems, caps, gills).
 * All caps at local x >= 0 so a half-turn keeps it off the road.
 */
export function buildMushroomClusterGeometry(): THREE.BufferGeometry {
  let s = 4242;
  const rnd = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  const capGeom = new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.5);
  const gillGeom = new THREE.CircleGeometry(0.97, 20);
  gillGeom.rotateX(Math.PI / 2); // face downward
  const stemGeom = new THREE.CylinderGeometry(0.11, 0.15, 1, 10);
  stemGeom.translate(0, 0.5, 0);
  const specs = [
    { x: 0.55, z: 0.1, stemH: 0.55, capR: 0.45 },
    { x: 1.45, z: -0.5, stemH: 0.9, capR: 0.62 },
    { x: 2.45, z: 0.35, stemH: 1.25, capR: 0.85 },
    { x: 3.3, z: -0.25, stemH: 0.7, capR: 0.5 },
    { x: 1.9, z: 0.9, stemH: 0.4, capR: 0.32 },
  ];
  const parts: THREE.BufferGeometry[] = [];
  const shroom = new THREE.Matrix4();
  const local = new THREE.Matrix4();
  for (const sp of specs) {
    shroom.copy(mat(sp.x, 0, sp.z, (rnd() - 0.5) * 0.2, 0, (rnd() - 0.5) * 0.25));
    local.copy(mat(0, -0.3, 0, 0, 0, 0, sp.capR * 1.6, sp.stemH + 0.3, sp.capR * 1.6));
    parts.push(colorize(bake(stemGeom, new THREE.Matrix4().multiplyMatrices(shroom, local)), 0xcfc3a6));
    local.copy(mat(0, sp.stemH, 0, 0, 0, 0, sp.capR, sp.capR * 0.55, sp.capR));
    parts.push(colorize(bake(capGeom, new THREE.Matrix4().multiplyMatrices(shroom, local)), 0x7b5236));
    local.copy(mat(0, sp.stemH + 0.005, 0, 0, 0, 0, sp.capR));
    parts.push(colorize(bake(gillGeom, new THREE.Matrix4().multiplyMatrices(shroom, local)), 0xb8a684));
  }
  capGeom.dispose();
  gillGeom.dispose();
  stemGeom.dispose();
  for (const p of parts) p.deleteAttribute('uv');
  const merged = merge(parts);
  merged.computeVertexNormals();
  return merged;
}

/** Tapered, arching, slightly folded fern frond rooted at the origin, growing along +x. */
function createFrondGeometry(length: number, maxWidth: number): THREE.BufferGeometry {
  const rows = 10;
  const geom = new THREE.PlaneGeometry(1, 1, 2, rows);
  const pos = geom.attributes.position;
  const spineX: number[] = [0];
  const spineY: number[] = [0];
  const dt = 1 / rows;
  for (let r = 1; r <= rows; r++) {
    const t = (r - 0.5) * dt;
    const theta = 0.95 - 1.5 * t; // rises, then droops
    spineX.push(spineX[r - 1] + Math.cos(theta) * length * dt);
    spineY.push(spineY[r - 1] + Math.sin(theta) * length * dt);
  }
  for (let i = 0; i < pos.count; i++) {
    const u = pos.getX(i);
    const t = pos.getY(i) + 0.5;
    const r = Math.round(t * rows);
    const w = maxWidth * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.05)), 0.8) * (1 - t * 0.35);
    pos.setXYZ(i, spineX[r], spineY[r] - Math.abs(u) * w * 0.35, u * w);
  }
  geom.computeVertexNormals();
  return geom;
}

/** Understory fern clump (ten arching fronds) as one geometry. */
export function buildFernClumpGeometry(): THREE.BufferGeometry {
  let s = 777;
  const rnd = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  const frond = createFrondGeometry(2.2, 0.42);
  const parts: THREE.BufferGeometry[] = [];
  const n = 10;
  for (let f = 0; f < n; f++) {
    const sc = 0.75 + rnd() * 0.4;
    parts.push(bake(frond, mat(0, 0, 0, 0, (f / n) * Math.PI * 2 + (rnd() - 0.5) * 0.4, 0, sc, sc * (0.85 + rnd() * 0.3), sc)));
  }
  frond.dispose();
  const merged = merge(parts);
  merged.computeVertexNormals();
  return merged;
}

/** Gently meandering water ribbon lying in the ditch (centred on the origin). */
export function buildStreamRibbonGeometry(length: number, width: number): THREE.BufferGeometry {
  const geom = new THREE.PlaneGeometry(width, length, 4, 24);
  geom.rotateX(-Math.PI / 2);
  const pos = geom.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const z = pos.getZ(i);
    pos.setX(i, pos.getX(i) + Math.sin(z * 0.12) * 0.6);
  }
  geom.computeVertexNormals();
  return geom;
}
