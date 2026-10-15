import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createProceduralCrystalGeometry, CrystalClusterArchetype } from './CrystalHeightsTerrain';
import { createConiferCrownGeometry } from './conifer';

/**
 * Crystal Heights set dressing: template geometry builders (merged per
 * material; instanced or rare meshes in CrystalHeightsWorld):
 * 1. Road-spanning granite arch with snow on top and hanging icicles
 *    (inner faces at |x| >= 6.4, everything below y = 8 stays outside |x| < 6).
 *    The snow cover comes from the slope-blended snow/granite material.
 * 2. Clear quartz cluster (sits on a scanned granite boulder)
 * 3. Snow-laden spruces: trunk + crown merged with groups [bark, needles]
 *
 * Nothing here uses transmission (it forced an extra full scene render each
 * frame); ice and quartz are opaque clearcoated dielectrics.
 */

export const QUARTZ_ARCHETYPE: CrystalClusterArchetype = {
  id: 'shrine-quartz',
  name: 'Clear Quartz Outcrop',
  tier: 'cluster',
  height: 5.0,
  radius: 0.7,
  facets: 6,
  shardCount: 5,
};

function nonIndexed(g: THREE.BufferGeometry): THREE.BufferGeometry {
  return g.index ? g.toNonIndexed() : g;
}

/** Granite arch (one geometry, snow from the material) + icicles. */
export function buildGateGeometries(): { stone: THREE.BufferGeometry; ice: THREE.BufferGeometry } {
  const pillarX = 7.7; // half-width 1.3 -> inner faces at |x| = 6.4
  const archY = 12.0;
  const tube = 1.3;
  const parts: THREE.BufferGeometry[] = [];
  const pillar = new THREE.BoxGeometry(2.6, archY, 2.6, 1, 4, 1);
  for (const sx of [-1, 1]) {
    const p = nonIndexed(pillar.clone());
    p.translate(sx * pillarX, archY * 0.5, 0);
    parts.push(p);
    const cap = nonIndexed(new THREE.BoxGeometry(2.9, 0.45, 2.9));
    cap.translate(sx * pillarX, archY + 0.2, 0);
    parts.push(cap);
  }
  const vault = nonIndexed(new THREE.TorusGeometry(pillarX, tube, 16, 40, Math.PI));
  vault.translate(0, archY, 0);
  parts.push(vault);
  const stone = mergeGeometries(parts)!;
  for (const p of parts) p.dispose();
  pillar.dispose();
  stone.computeVertexNormals();

  const icicleGeom = new THREE.ConeGeometry(0.2, 1.8, 7);
  icicleGeom.rotateX(Math.PI); // point down
  const angles = [0.75, 1.05, 1.35, 1.6, 1.85, 2.15, 2.45];
  const ice: THREE.BufferGeometry[] = [];
  for (let i = 0; i < angles.length; i++) {
    const a = angles[i];
    const cx = Math.cos(a) * pillarX;
    const underside = archY + Math.sin(a) * pillarX - tube;
    const len = 0.7 + ((i * 37) % 10) / 10;
    const g = nonIndexed(icicleGeom.clone());
    g.scale(1, len, 1);
    g.translate(cx, underside + 0.15 - 0.9 * len, (((i * 13) % 5) - 2) * 0.35);
    ice.push(g);
  }
  icicleGeom.dispose();
  const iceMerged = mergeGeometries(ice)!;
  for (const g of ice) g.dispose();
  iceMerged.computeVertexNormals();
  return { stone, ice: iceMerged };
}

export function buildQuartzGeometry(): THREE.BufferGeometry {
  return createProceduralCrystalGeometry(QUARTZ_ARCHETYPE, 4242);
}

/**
 * Snow-laden spruce variants (max radius 2.4 m): trunk + irregular crown in
 * one geometry with groups [bark, needles]. Bark UVs tile ~1.2 m.
 */
export function buildSpruceGeometries(only?: number): THREE.BufferGeometry[] {
  const variants: Array<{ h: number; r: number; snow: number }> = [
    { h: 9.2, r: 2.3, snow: 0.85 },
    { h: 10.4, r: 2.1, snow: 0.7 },
    { h: 8.4, r: 2.4, snow: 0.95 },
  ];
  return variants.flatMap((v, k) => {
    if (only !== undefined && only !== k) return [];
    const trunk = new THREE.CylinderGeometry(0.14, 0.32, 8.4, 8);
    const uv = trunk.getAttribute('uv') as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 2, uv.getY(i) * 7);
    trunk.translate(0, 4.2, 0);
    const t = nonIndexed(trunk);
    const white = new Float32Array(t.getAttribute('position').count * 3).fill(1);
    t.setAttribute('color', new THREE.BufferAttribute(white, 3));
    const crown = nonIndexed(createConiferCrownGeometry(101 + k * 37, { height: v.h, maxRadius: v.r, snow: v.snow }));
    crown.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(crown.getAttribute('position').count * 2), 2));
    const merged = mergeGeometries([t, crown], true)!;
    t.dispose();
    crown.dispose();
    trunk.dispose();
    merged.computeBoundingSphere();
    return [merged];
  });
}
