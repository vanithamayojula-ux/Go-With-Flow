import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createMagmaWaterfallGeometry } from './ObsidianCoreTerrain';

/**
 * Obsidian Core set dressing: template geometry builders merged per material
 * (rare props become 2-3 meshes; repeated ones are instanced by the world):
 * 1. Basalt citadel landmark on the ridge (gate facing the road)
 * 2. Lava falls pouring off basalt cliffs into the side channels
 * 3. Stone fire bowls on the ash shoulder
 * 4. Basalt forge arches spanning the highway (inner faces at |x| = 6.4)
 */

function bakeNI(g: THREE.BufferGeometry, x: number, y: number, z: number): THREE.BufferGeometry {
  const c = g.index ? g.toNonIndexed() : g.clone();
  c.translate(x, y, z);
  return c;
}

function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const m = mergeGeometries(parts)!;
  for (const p of parts) p.dispose();
  m.computeBoundingSphere();
  return m;
}

/** Citadel: { basalt, obsidian (towers), molten (gate) }. Local +Z is the gate side. */
export function buildCitadelGeometries() {
  const basalt = merge([
    bakeNI(new THREE.BoxGeometry(28.0, 16.0, 18.0, 4, 3, 3), 0, 8.0, 0),
    bakeNI(new THREE.CylinderGeometry(3.5, 5.5, 38.0, 6), 0, 27.0, 0),
  ]);
  const tower = new THREE.CylinderGeometry(1.4, 3.8, 28.0, 5);
  const obsidian = merge([bakeNI(tower, -10.5, 22.0, 0), bakeNI(tower, 10.5, 22.0, 0)]);
  tower.dispose();
  const molten = bakeNI(new THREE.BoxGeometry(4.5, 6.0, 0.4), 0, 3.0, 8.95);
  return { basalt, obsidian, molten };
}

/** Fire bowl: { stone (pedestal + bowl), coals }. */
export function buildBrazierGeometries() {
  const stone = merge([
    bakeNI(new THREE.CylinderGeometry(0.8, 1.1, 4.2, 7), 0, 2.1, 0),
    bakeNI(new THREE.CylinderGeometry(1.4, 0.7, 1.2, 9), 0, 4.5, 0),
  ]);
  const coals = new THREE.SphereGeometry(1.25, 14, 6, 0, Math.PI * 2, 0, Math.PI * 0.5);
  coals.scale(1, 0.35, 1);
  coals.translate(0, 4.95, 0);
  return { stone, coals };
}

/** Basalt forge arch spanning the road: pillars x in [6.4, 8.8], lintel y >= 10.4. */
export function buildForgeArchGeometry(): THREE.BufferGeometry {
  const pillar = new THREE.BoxGeometry(2.4, 11.0, 2.4, 1, 3, 1);
  const g = merge([
    bakeNI(pillar, -7.6, 5.5, 0),
    bakeNI(pillar, 7.6, 5.5, 0),
    bakeNI(new THREE.BoxGeometry(18.0, 2.2, 2.8, 6, 1, 1), 0, 11.5, 0),
  ]);
  pillar.dispose();
  return g;
}

/**
 * Lava fall: sheet (foot at the origin, front facing local +Z) and the basalt
 * cliff behind it, both tilted back by the same angle.
 */
export function buildMagmaFallGeometries(height = 17.0, width = 5.0) {
  const tilt = Math.atan2(1.8, height);
  const sheet = createMagmaWaterfallGeometry(width, height, 4, 10, tilt);
  const cliffH = height + 2.5;
  const cliff = new THREE.BoxGeometry(width + 4.0, cliffH, 6.0, 2, 4, 1);
  cliff.translate(0, cliffH * 0.5 - 1.0, -3.05);
  cliff.rotateX(-tilt);
  return { sheet, cliff };
}
