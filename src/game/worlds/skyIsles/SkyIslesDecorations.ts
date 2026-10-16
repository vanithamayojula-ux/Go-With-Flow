import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Sky Isles set dressing: template geometry builders (cached for the whole
 * session by SkyIslesWorld's kit) for
 * 1. Landmarks: a weathered stone colonnade (formerly the "portal arch": now a
 *    row of free-standing columns, nothing that reads as a gateway) and a sky
 *    temple / wind shrine with a small quartz crystal
 * 2. Waterfalls plunging off island rims
 * 3. Vegetation: broadleaf and conifer trees (one merged geometry each with
 *    [bark, foliage] groups, instanced by the world)
 */

/** Cheap deterministic 3D noise (sum of sines) used to roughen foliage clumps. */
function foliageNoise(x: number, y: number, z: number): number {
  return (
    Math.sin(x * 2.3 + 1.1) * Math.sin(y * 2.9 + 0.3) * Math.sin(z * 2.1 + 2.2) * 0.6 +
    Math.sin(x * 5.7 + 0.4) * Math.sin(y * 6.1 + 1.7) * Math.sin(z * 5.3 + 0.9) * 0.3
  );
}

/** Displaces a geometry radially from `center` by noise. */
function roughenClump(geom: THREE.BufferGeometry, center: THREE.Vector3, amount: number): void {
  const pos = geom.getAttribute('position') as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  const dir = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    dir.copy(v).sub(center);
    const len = dir.length();
    if (len < 1e-5) continue;
    dir.multiplyScalar(1 / len);
    v.addScaledVector(dir, foliageNoise(v.x, v.y, v.z) * amount);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  pos.needsUpdate = true;
}

/**
 * Recomputes vertex normals and averages them across vertices sharing a
 * position (UV seams, poles), so smooth-shaded displaced shapes show no seams.
 */
function smoothNormals(geom: THREE.BufferGeometry): void {
  geom.computeVertexNormals();
  const pos = geom.getAttribute('position') as THREE.BufferAttribute;
  const nor = geom.getAttribute('normal') as THREE.BufferAttribute;
  const acc = new Map<string, THREE.Vector3>();
  const keys: string[] = new Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    const key = `${Math.round(pos.getX(i) * 1000)},${Math.round(pos.getY(i) * 1000)},${Math.round(pos.getZ(i) * 1000)}`;
    keys[i] = key;
    let a = acc.get(key);
    if (!a) {
      a = new THREE.Vector3();
      acc.set(key, a);
    }
    a.x += nor.getX(i);
    a.y += nor.getY(i);
    a.z += nor.getZ(i);
  }
  for (let i = 0; i < pos.count; i++) {
    const a = acc.get(keys[i])!;
    const l = a.length() || 1;
    nor.setXYZ(i, a.x / l, a.y / l, a.z / l);
  }
  nor.needsUpdate = true;
}

/** Scales a cylinder's UVs so the bark texture tiles at ~`tile` metres. */
function barkUVs(g: THREE.BufferGeometry, circumference: number, height: number, tile = 1.4): void {
  const uv = g.getAttribute('uv') as THREE.BufferAttribute;
  const su = Math.max(1, Math.round(circumference / tile));
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * (height / tile));
}

/** Broadleaf tree: leaning trunk with two limbs + lumpy crown. Groups: [bark, foliage]. */
export function buildBroadleafGeometry(): THREE.BufferGeometry {
  const trunk = new THREE.CylinderGeometry(0.18, 0.38, 3.8, 12, 4);
  barkUVs(trunk, 2.0, 3.8);
  trunk.translate(0, 1.9, 0);
  const tp = trunk.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < tp.count; i++) {
    const y = tp.getY(i);
    tp.setX(i, tp.getX(i) + 0.18 * (y / 3.8) * (y / 3.8));
  }
  const limbA = new THREE.CylinderGeometry(0.07, 0.14, 1.8, 8);
  barkUVs(limbA, 0.7, 1.8);
  limbA.rotateZ(0.85);
  limbA.translate(-0.55, 3.0, 0.1);
  const limbB = new THREE.CylinderGeometry(0.06, 0.12, 1.6, 8);
  barkUVs(limbB, 0.6, 1.6);
  limbB.rotateX(-0.8);
  limbB.translate(0.15, 3.1, 0.55);
  const bark = mergeGeometries([trunk, limbA, limbB])!;
  bark.computeVertexNormals();
  trunk.dispose();
  limbA.dispose();
  limbB.dispose();

  const clumps: Array<[number, number, number, number]> = [
    [0.2, 4.7, 0.0, 1.75],
    [1.2, 4.1, 0.3, 1.3],
    [-1.1, 4.2, -0.3, 1.35],
    [0.3, 4.0, 1.2, 1.2],
    [-0.2, 4.0, -1.2, 1.15],
    [0.3, 5.8, 0.1, 1.15],
    [-0.9, 5.2, 0.7, 1.0],
  ];
  const parts: THREE.BufferGeometry[] = [];
  const c = new THREE.Vector3();
  for (const [x, y, z, r] of clumps) {
    const g = new THREE.SphereGeometry(r, 16, 12);
    g.scale(1, 0.82, 1);
    g.translate(x, y, z);
    c.set(x, y, z);
    roughenClump(g, c, r * 0.22);
    parts.push(g);
  }
  const foliage = mergeGeometries(parts)!;
  for (const p of parts) p.dispose();
  smoothNormals(foliage);

  const merged = mergeGeometries([bark, foliage], true)!;
  bark.dispose();
  foliage.dispose();
  merged.computeBoundingSphere();
  return merged;
}

/** Conifer: straight trunk + five roughened tiers. Groups: [bark, foliage]. */
export function buildConiferGeometry(): THREE.BufferGeometry {
  const trunk = new THREE.CylinderGeometry(0.12, 0.3, 6.6, 10, 2);
  barkUVs(trunk, 1.6, 6.6);
  trunk.translate(0, 3.3, 0);

  const tiers: Array<[number, number, number]> = [
    // radius, height, base y
    [2.0, 2.6, 1.6],
    [1.65, 2.4, 2.8],
    [1.3, 2.2, 3.9],
    [0.95, 2.0, 4.9],
    [0.6, 1.7, 5.9],
  ];
  const parts: THREE.BufferGeometry[] = [];
  const c = new THREE.Vector3();
  for (const [r, h, y] of tiers) {
    const g = new THREE.ConeGeometry(r, h, 16, 3);
    g.translate(0, y + h / 2, 0);
    c.set(0, y + h * 0.3, 0);
    roughenClump(g, c, r * 0.12);
    parts.push(g);
  }
  const foliage = mergeGeometries(parts)!;
  for (const p of parts) p.dispose();
  smoothNormals(foliage);

  const merged = mergeGeometries([trunk, foliage], true)!;
  trunk.dispose();
  foliage.dispose();
  merged.computeBoundingSphere();
  return merged;
}

function bake(g: THREE.BufferGeometry, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, s = 1): THREE.BufferGeometry {
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
    new THREE.Vector3(s, s, s)
  );
  return g.clone().applyMatrix4(m);
}

/**
 * Weathered stone colonnade: three free-standing columns of differing heights
 * on a low plinth with a fallen drum and one surviving architrave block.
 * Deliberately has no arch or ring so it never reads as a portal.
 */
export function buildColonnadeGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const plinth = new THREE.BoxGeometry(10.5, 0.9, 3.4);
  parts.push(bake(plinth, 0, 0.35, 0));
  const shaft = new THREE.CylinderGeometry(0.62, 0.72, 1, 20, 1);
  const base = new THREE.CylinderGeometry(0.95, 1.0, 0.5, 20, 1);
  const capital = new THREE.BoxGeometry(1.7, 0.45, 1.7);
  const heights = [6.8, 4.1, 6.4];
  for (let i = 0; i < 3; i++) {
    const x = (i - 1) * 3.6;
    const h = heights[i];
    parts.push(bake(base, x, 1.05, 0));
    const s = shaft.clone();
    s.scale(1, h, 1);
    parts.push(bake(s, x, 1.3 + h / 2, 0, 0, 0, i === 1 ? 0.04 : 0));
    s.dispose();
    if (i !== 1) parts.push(bake(capital, x, 1.3 + h + 0.22, 0));
  }
  // Architrave block still resting on the first column
  parts.push(bake(new THREE.BoxGeometry(2.6, 0.7, 1.5), -3.9, 1.3 + heights[0] + 0.8, 0, 0, 0.12, 0));
  // Fallen drum
  const drum = new THREE.CylinderGeometry(0.66, 0.66, 1.3, 18, 1);
  parts.push(bake(drum, 1.7, 0.95, 1.9, Math.PI / 2, 0.5, 0));
  const merged = mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)))!;
  for (const g of parts) g.dispose();
  plinth.dispose();
  shaft.dispose();
  base.dispose();
  capital.dispose();
  drum.dispose();
  merged.computeVertexNormals();
  merged.computeBoundingSphere();
  return merged;
}

/** Sky temple / wind shrine split by material: stone, verdigris roof, quartz. */
export function buildTempleGeometries(): { stone: THREE.BufferGeometry; roof: THREE.BufferGeometry; crystal: THREE.BufferGeometry } {
  const stoneParts: THREE.BufferGeometry[] = [];
  stoneParts.push(bake(new THREE.CylinderGeometry(4.2, 4.8, 2.0, 32), 0, 1.0, 0));
  const pillar = new THREE.CylinderGeometry(0.35, 0.45, 5.0, 14);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    stoneParts.push(bake(pillar, Math.cos(a) * 3.0, 4.5, Math.sin(a) * 3.0));
  }
  stoneParts.push(bake(new THREE.CylinderGeometry(3.7, 3.7, 0.6, 32), 0, 7.2, 0));
  const stone = mergeGeometries(stoneParts.map((g) => (g.index ? g.toNonIndexed() : g)))!;
  stone.computeVertexNormals();
  for (const g of stoneParts) g.dispose();
  pillar.dispose();

  const roof = new THREE.ConeGeometry(3.9, 3.0, 32, 2);
  roof.translate(0, 9.0, 0);

  const crystal = new THREE.OctahedronGeometry(0.7, 0);
  crystal.scale(1.0, 1.8, 1.0);
  return { stone, roof, crystal };
}

let waterTex: THREE.CanvasTexture | null | undefined;

/**
 * Falling-water texture (linear data; used as map + alphaMap, scrolled
 * downwards): fine vertical streaks broken into aerated foam clumps, with
 * soft, ragged side edges (alpha fades out across the last ~20% of the
 * width) so the sheet has no hard card outline. Session-cached; null
 * without a DOM.
 */
export function getWaterStreakTexture(): THREE.CanvasTexture | null {
  if (waterTex !== undefined) return waterTex;
  if (typeof document === 'undefined') return null;
  const w = 128;
  const h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  let s = 98765;
  const rnd = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
  // Tileable lattice noise, stretched vertically (foam is drawn out by the fall)
  const LX = 16;
  const LY = 8;
  const lat = new Float32Array(LX * LY);
  for (let k = 0; k < lat.length; k++) lat[k] = rnd();
  const lat2 = new Float32Array(LX * 2 * LY * 2);
  for (let k = 0; k < lat2.length; k++) lat2[k] = rnd();
  const sm = (t: number) => t * t * (3 - 2 * t);
  const noise = (u: number, v: number, nx: number, ny: number, L: Float32Array) => {
    const fx = u * nx;
    const fy = v * ny;
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const tx = sm(fx - x0);
    const ty = sm(fy - y0);
    const xa = x0 % nx;
    const xb = (x0 + 1) % nx;
    const ya = y0 % ny;
    const yb = (y0 + 1) % ny;
    const a = L[ya * nx + xa];
    const b = L[ya * nx + xb];
    const c = L[yb * nx + xa];
    const d = L[yb * nx + xb];
    return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
  };
  const colBase = new Float32Array(w);
  for (let x = 0; x < w; x++) colBase[x] = 0.5 + rnd() * 0.5;
  const col = new Float32Array(w);
  for (let x = 0; x < w; x++) {
    col[x] = (colBase[(x + w - 2) % w] + colBase[(x + w - 1) % w] * 2 + colBase[x] * 3 + colBase[(x + 1) % w] * 2 + colBase[(x + 2) % w]) / 9;
  }

  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    const v = y / h;
    for (let x = 0; x < w; x++) {
      const u = x / w;
      const foam = noise(u, v, LX, LY, lat) * 0.6 + noise(u, v, LX * 2, LY * 2, lat2) * 0.4;
      const streak = col[x];
      // Dense white water where foam and streaks coincide, thinner glassy water between
      let a = Math.min(1, Math.max(0, (streak * 0.55 + foam * 0.75 - 0.42) * 1.9));
      // Ragged soft sides
      const edge = Math.min(u, 1 - u);
      const rag = 0.1 + foam * 0.14;
      a *= sm(Math.min(1, Math.max(0, edge / rag)));
      const g = Math.round((0.86 + 0.14 * foam) * 255);
      const o = (y * w + x) * 4;
      img.data[o] = g;
      img.data[o + 1] = Math.round(a * 255); // alphaMap samples the green channel
      img.data[o + 2] = g;
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.NoColorSpace;
  tex.repeat.set(1, 3);
  tex.needsUpdate = true;
  waterTex = tex;
  return tex;
}

/** Local offset of a waterfall's foot (where it dissolves into mist), see buildWaterfallGeometry. */
export const WATERFALL_FOOT = { y: -30, z: 3.2 };

/**
 * Waterfall hanging from its top edge and arcing out along local +Z: a
 * curved sheet (convex toward the viewer, so it has depth and catches light
 * across its width) that widens as it falls and thins out into spray:
 * vertex alpha (RGBA colours) fades the lower part away so the fall
 * dissolves into the mist puff placed at its foot.
 */
export function buildWaterfallGeometry(height = 34.0, width = 3.2): THREE.BufferGeometry {
  const geom = new THREE.PlaneGeometry(width, height, 8, 20);
  geom.translate(0, -height / 2, 0);
  const p = geom.getAttribute('position') as THREE.BufferAttribute;
  const colors = new Float32Array(p.count * 4);
  for (let i = 0; i < p.count; i++) {
    const t = Math.min(1, Math.max(0, -p.getY(i) / height));
    const u = p.getX(i) / width; // -0.5 .. 0.5
    const spread = 1.0 + 0.9 * t;
    const bulge = (1 - 4 * u * u) * (0.35 + 0.9 * t);
    const wobble = Math.sin(t * 9.0 + u * 3.0) * 0.12 * t;
    p.setX(i, p.getX(i) * spread + wobble);
    p.setZ(i, 2.2 * Math.sqrt(t) + bulge);
    // Lip stays dense; the lower half breaks up into spray
    const a = 1 - Math.min(1, Math.max(0, (t - 0.45) / 0.55)) ** 1.5;
    colors[i * 4] = 1;
    colors[i * 4 + 1] = 1;
    colors[i * 4 + 2] = 1;
    colors[i * 4 + 3] = a;
  }
  geom.setAttribute('color', new THREE.BufferAttribute(colors, 4));
  geom.computeVertexNormals();
  return geom;
}
