import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { WorldId } from '../WorldConfig';
import { getWorldConfig } from '../worlds';
import { getPlaceholderTextures, loadTextureSet, ScanTextureSet } from '../../graphics/assetLibrary';
import { StreamFade, applyStreamFade } from '../worlds/shared/distanceFade';
import { GATEWAY, GATEWAY_CROWN_Y, GATEWAY_STYLES, GatewayStyle } from './gatewayStyles';
import { BEAM_FRAGMENT, BEAM_VERTEX, MEMBRANE_FRAGMENT, MEMBRANE_VERTEX } from './portalShaders';

/** Uniforms shared by every membrane (owned by PortalWindow / PortalSystem). */
export interface MembraneSharedUniforms {
  tWindow: THREE.IUniform<THREE.Texture | null>;
  uRect: THREE.IUniform<THREE.Vector4>;
  uWinScale: THREE.IUniform<THREE.Vector2>;
  uWinTexel: THREE.IUniform<THREE.Vector2>;
  uLive: THREE.IUniform<number>;
  uExposure: THREE.IUniform<number>;
  uTime: THREE.IUniform<number>;
}

export interface GatewayShared {
  fade: StreamFade;
  membrane: MembraneSharedUniforms;
}

const BEAM_HEIGHT = 900;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function roundedRect(w: number, h: number, r: number): THREE.Shape {
  const x0 = -w / 2;
  const y0 = -h / 2;
  const x1 = w / 2;
  const y1 = h / 2;
  const s = new THREE.Shape();
  s.moveTo(x0 + r, y0);
  s.lineTo(x1 - r, y0);
  s.quadraticCurveTo(x1, y0, x1, y0 + r);
  s.lineTo(x1, y1 - r);
  s.quadraticCurveTo(x1, y1, x1 - r, y1);
  s.lineTo(x0 + r, y1);
  s.quadraticCurveTo(x0, y1, x0, y1 - r);
  s.lineTo(x0, y0 + r);
  s.quadraticCurveTo(x0, y0, x0 + r, y0);
  return s;
}

/** Extrude a shape along Z, centred on z = 0, with chamfered cap edges. */
function extrude(shape: THREE.Shape, depth: number, bevel: number, curveSegments = 2): THREE.BufferGeometry {
  const core = Math.max(0.01, depth - 2 * bevel);
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: core,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 1,
    curveSegments,
  });
  g.translate(0, 0, -core / 2);
  g.clearGroups();
  return g;
}

/** A dressed stone block w x h x d centred on the origin. */
function stoneBlock(w: number, h: number, d: number, bevel = 0.07): THREE.BufferGeometry {
  return extrude(roundedRect(Math.max(0.05, w - 2 * bevel), Math.max(0.05, h - 2 * bevel), 0.05), d, bevel);
}

/** Annular sector (arch stone) between radii r0..r1 and angles a0..a1, centred on z = 0. */
function sectorStone(r0: number, r1: number, a0: number, a1: number, depth: number, bevel = 0.07): THREE.BufferGeometry {
  const ri = r0 + bevel;
  const ro = r1 - bevel;
  const da0 = a0 + bevel / ri;
  const da1 = a1 - bevel / ri;
  const s = new THREE.Shape();
  s.moveTo(Math.cos(da0) * ri, Math.sin(da0) * ri);
  s.lineTo(Math.cos(da0) * ro, Math.sin(da0) * ro);
  s.absarc(0, 0, ro, da0, da1, false);
  s.lineTo(Math.cos(da1) * ri, Math.sin(da1) * ri);
  s.absarc(0, 0, ri, da1, da0, true);
  return extrude(s, depth, bevel, 4);
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3(1, 1, 1);

function place(g: THREE.BufferGeometry, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0): THREE.BufferGeometry {
  _q.setFromEuler(_e.set(rx, ry, rz));
  _m.compose(_p.set(x, y, z), _q, _s);
  g.applyMatrix4(_m);
  return g;
}

function scaleUv(g: THREE.BufferGeometry, su: number, sv = su): void {
  const uv = g.getAttribute('uv') as THREE.BufferAttribute | undefined;
  if (!uv) return;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
}

/** Drop everything but position/normal/uv so parts from different builders merge. */
function normalizeAttributes(g: THREE.BufferGeometry): THREE.BufferGeometry {
  let out = g.index ? g.toNonIndexed() : g;
  if (out !== g) g.dispose();
  for (const name of Object.keys(out.attributes)) {
    if (name !== 'position' && name !== 'normal' && name !== 'uv') out.deleteAttribute(name);
  }
  out.clearGroups();
  return out;
}

/** Per-vertex albedo multiplier: block jitter x cast, then moss on up-facing / low surfaces. */
function paintStone(g: THREE.BufferGeometry, style: GatewayStyle, rnd: () => number): void {
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  const nrm = g.getAttribute('normal') as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const j = 1 - style.jitter * rnd();
  const cast = style.cast ?? [1, 1, 1];
  const blockMoss = style.moss ? style.moss.amount * (0.25 + 0.75 * rnd()) : 0;
  for (let i = 0; i < pos.count; i++) {
    let r = j * cast[0];
    let gr = j * cast[1];
    let b = j * cast[2];
    if (style.moss) {
      const up = Math.max(0, nrm.getY(i));
      const y = pos.getY(i);
      const low = y < 3 ? (3 - Math.max(0, y)) / 3 : 0;
      const m = Math.min(1, blockMoss * (up * up * 0.9 + low * 0.45 + 0.12));
      r = r * (1 - m) + style.moss.color[0] * m;
      gr = gr * (1 - m) + style.moss.color[1] * m;
      b = b * (1 - m) + style.moss.color[2] * m;
    }
    colors[i * 3] = r;
    colors[i * 3 + 1] = gr;
    colors[i * 3 + 2] = b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

/** Path along the opening's outline (left jamb, arch, right jamb) at depth z. */
class OpeningCurve extends THREE.Curve<THREE.Vector3> {
  constructor(private halfW: number, private springY: number, private bottom: number, private z: number) {
    super();
  }
  getPoint(t: number, target = new THREE.Vector3()): THREE.Vector3 {
    const l1 = this.springY - this.bottom;
    const l2 = Math.PI * this.halfW;
    let d = t * (2 * l1 + l2);
    if (d < l1) return target.set(-this.halfW, this.bottom + d, this.z);
    d -= l1;
    if (d < l2) {
      const a = Math.PI - d / this.halfW;
      return target.set(Math.cos(a) * this.halfW, this.springY + Math.sin(a) * this.halfW, this.z);
    }
    d -= l2;
    return target.set(this.halfW, this.springY - d, this.z);
  }
}

let lavaTexture: THREE.CanvasTexture | null | undefined;

/**
 * Seamless map of branching cracks (white on black), used as the emissive
 * map of the basalt: lava glows only along the veins. Session cached.
 */
function getLavaVeinTexture(): THREE.CanvasTexture | null {
  if (lavaTexture !== undefined) return lavaTexture;
  lavaTexture = null;
  if (typeof document === 'undefined') return null;
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, size, size);
  const rnd = mulberry32(90210);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const crack = (x: number, y: number, ang: number, len: number, width: number, depth: number) => {
    const pts: [number, number][] = [[x, y]];
    let a = ang;
    for (let s = 0; s < len; s++) {
      a += (rnd() - 0.5) * 0.9;
      x += Math.cos(a) * 9;
      y += Math.sin(a) * 9;
      pts.push([x, y]);
      if (depth < 2 && rnd() < 0.07) crack(x, y, a + (rnd() < 0.5 ? 1 : -1) * (0.6 + rnd() * 0.6), Math.floor(len * 0.45), width * 0.6, depth + 1);
    }
    // Draw 9 times offset by the tile size so the map wraps seamlessly.
    for (let ox = -size; ox <= size; ox += size) {
      for (let oy = -size; oy <= size; oy += size) {
        for (const [lw, col] of [[width * 4.5, 'rgba(255,90,20,0.18)'], [width * 2, 'rgba(255,140,40,0.55)'], [width, 'rgba(255,230,160,1)']] as [number, string][]) {
          ctx.strokeStyle = col;
          ctx.lineWidth = lw;
          ctx.beginPath();
          ctx.moveTo(pts[0][0] + ox, pts[0][1] + oy);
          for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k][0] + ox, pts[k][1] + oy);
          ctx.stroke();
        }
      }
    }
  };
  for (let i = 0; i < 7; i++) crack(rnd() * size, rnd() * size, rnd() * Math.PI * 2, 30 + Math.floor(rnd() * 30), 1.6 + rnd() * 1.6, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.repeat.set(0.4, 0.4);
  tex.anisotropy = 4;
  tex.name = 'gateway-lava-veins';
  lavaTexture = tex;
  return tex;
}

/** A scanned-texture material slot that is upgraded when its set arrives. */
interface ScanSlot {
  material: THREE.MeshStandardMaterial;
  stem: string;
  normalScale: number;
}

/**
 * One portal gateway: a monumental masonry arch spanning the road at a world
 * boundary, built from the DESTINATION world's scanned stone (mossy ruin,
 * sandstone, granite with ice, basalt with lava veins), with a thin rim of
 * light in that world's energy colour, a soft beam of light rising from it
 * and a membrane filling the opening that shows the next world.
 *
 * Built in slices (build() is a generator) well before it can be seen; the
 * owner compiles it, uploads its textures and only then shows it. It fades in
 * with the far scenery dither, so it never pops.
 */
export class PortalGateway {
  readonly worldId: WorldId;
  readonly boundaryZ: number;
  readonly group = new THREE.Group();
  membrane: THREE.Mesh | null = null;
  beam: THREE.Mesh | null = null;
  readonly beamUniforms = {
    uColor: { value: new THREE.Color() },
    uIntensity: { value: 0 },
    uTime: { value: 0 },
  };
  /** Linear energy colour of the destination world. */
  readonly energy = new THREE.Color();

  private style: GatewayStyle;
  private shared: GatewayShared;
  private geometries: THREE.BufferGeometry[] = [];
  private materials: THREE.Material[] = [];
  private scanSlots: ScanSlot[] = [];
  private pendingSets = 0;
  private disposed = false;
  private membraneUniforms: Record<string, THREE.IUniform> | null = null;

  constructor(worldId: WorldId, boundaryZ: number, shared: GatewayShared) {
    this.worldId = worldId;
    this.boundaryZ = boundaryZ;
    this.shared = shared;
    this.style = GATEWAY_STYLES[worldId] ?? GATEWAY_STYLES['verdant-wilds'];
    this.energy.set(getWorldConfig(worldId).palette.energy);
    this.group.name = `PortalGateway:${worldId}`;
    this.group.position.set(0, 0, boundaryZ);
  }

  /** All scanned texture sets have arrived (or failed: fallbacks stay). */
  get texturesSettled(): boolean {
    return this.pendingSets === 0;
  }

  /** Membrane uniforms that are per gateway (static tint). */
  setStaticTint(top: THREE.Color, horizon: THREE.Color): void {
    if (!this.membraneUniforms) return;
    (this.membraneUniforms.uTintTop.value as THREE.Color).copy(top);
    (this.membraneUniforms.uTintHorizon.value as THREE.Color).copy(horizon);
  }

  /** Every texture this gateway draws with (for ahead-of-time GPU upload). */
  collectTextures(out: THREE.Texture[]): void {
    for (const m of this.materials) {
      const sm = m as THREE.MeshStandardMaterial;
      for (const t of [sm.map, sm.normalMap, sm.roughnessMap, sm.aoMap, sm.emissiveMap]) {
        if (t && out.indexOf(t) === -1) out.push(t);
      }
    }
  }

  private scanMaterial(stem: string, color: THREE.ColorRepresentation, normalScale: number, vertexColors: boolean): THREE.MeshStandardMaterial {
    const ph = getPlaceholderTextures();
    const m = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.95,
      metalness: 0,
      vertexColors,
      map: ph.white,
      normalMap: ph.flatNormal,
      roughnessMap: ph.arm,
      aoMap: ph.arm,
    });
    m.aoMapIntensity = 0.9;
    m.normalScale.set(normalScale, normalScale);
    applyStreamFade(m, this.shared.fade, 'far', false);
    this.materials.push(m);
    this.scanSlots.push({ material: m, stem, normalScale });
    return m;
  }

  private loadScans(): void {
    const stems = new Set(this.scanSlots.map(s => s.stem));
    this.pendingSets = stems.size;
    for (const stem of stems) {
      loadTextureSet(stem)
        .then(
          set => this.applySet(stem, set),
          err => console.warn('[PortalGateway] texture set failed:', stem, err?.message ?? err)
        )
        .finally(() => {
          this.pendingSets = Math.max(0, this.pendingSets - 1);
        });
    }
  }

  private applySet(stem: string, set: ScanTextureSet): void {
    if (this.disposed) return;
    // Same slots as the placeholders: the shader program does not change.
    for (const s of this.scanSlots) {
      if (s.stem !== stem) continue;
      s.material.map = set.map;
      s.material.normalMap = set.normalMap;
      s.material.roughnessMap = set.armMap;
      s.material.aoMap = set.armMap;
      s.material.roughness = 1.0;
    }
  }

  private track<T extends THREE.BufferGeometry>(g: T): T {
    this.geometries.push(g);
    return g;
  }

  /** Builds the gateway in slices; yields between parts (~1-3 ms each). */
  *build(): Generator<void, void, unknown> {
    const st = this.style;
    const W = GATEWAY.OPEN_HALF_W;
    const S = GATEWAY.SPRING_Y;
    const rnd = mulberry32(0x9e3779b1 ^ Math.floor(this.boundaryZ));
    const tile = 1 / GATEWAY.STONE_TILE;

    // 1. Materials + texture loads
    const stoneMat = this.scanMaterial(st.stone, st.stoneTint, st.normalScale, true);
    if (st.lava) {
      const veins = getLavaVeinTexture();
      if (veins) {
        stoneMat.emissiveMap = veins;
        stoneMat.emissive.set(st.lava.color);
        stoneMat.emissiveIntensity = st.lava.intensity;
      }
    }
    const sandMat = st.sand ? this.scanMaterial(st.sand, 0xffffff, 1.0, false) : null;
    const snowMat = st.snow ? this.scanMaterial(st.snow, 0xffffff, 0.8, false) : null;
    let iceMat: THREE.MeshStandardMaterial | null = null;
    if (st.ice) {
      iceMat = new THREE.MeshStandardMaterial({ color: 0xcfe8f6, roughness: 0.08, metalness: 0.0, envMapIntensity: 1.4 });
      applyStreamFade(iceMat, this.shared.fade, 'far', false);
      this.materials.push(iceMat);
    }
    this.loadScans();
    yield;

    // 2. Pillars: foundation pier, plinth, moulding, shaft courses, impost
    const stones: THREE.BufferGeometry[] = [];
    const addStone = (g: THREE.BufferGeometry) => {
      scaleUv(g, tile);
      const n = normalizeAttributes(g);
      paintStone(n, st, rnd);
      stones.push(n);
    };
    const shaftBottom = GATEWAY.PLINTH_TOP + 0.35;
    const shaftTop = S - 0.9;
    const courses = 4;
    const courseH = (shaftTop - shaftBottom) / courses;
    for (const side of [-1, 1]) {
      const cx = side * (W + GATEWAY.PILLAR_W / 2);
      const fh = -0.6 - GATEWAY.FOUNDATION_BOTTOM;
      addStone(place(stoneBlock(GATEWAY.PLINTH_W - 0.3, fh, GATEWAY.PLINTH_D - 0.3, 0.05), cx, GATEWAY.FOUNDATION_BOTTOM + fh / 2, 0));
      addStone(place(stoneBlock(GATEWAY.PLINTH_W, GATEWAY.PLINTH_TOP + 0.6, GATEWAY.PLINTH_D, 0.09), cx, (GATEWAY.PLINTH_TOP - 0.6) / 2, 0));
      addStone(place(stoneBlock(GATEWAY.PLINTH_W - 0.45, 0.35, GATEWAY.PLINTH_D - 0.45, 0.06), cx, GATEWAY.PLINTH_TOP + 0.175, 0));
      for (let c = 0; c < courses; c++) {
        const y = shaftBottom + (c + 0.5) * courseH;
        const jx = (rnd() - 0.5) * 0.06;
        addStone(place(stoneBlock(GATEWAY.PILLAR_W + (c % 2) * 0.08, courseH - 0.04, GATEWAY.PILLAR_D, 0.07), cx + jx, y, 0));
      }
      addStone(place(stoneBlock(GATEWAY.PILLAR_W + 0.7, 0.9, GATEWAY.PILLAR_D + 0.5, 0.08), cx, S - 0.45, 0));
    }
    yield;

    // 3. Arch ring: 13 voussoirs with a proud keystone
    const N = 13;
    const gap = 0.035 / W;
    for (let i = 0; i < N; i++) {
      const a0 = (i / N) * Math.PI + gap * 0.5;
      const a1 = ((i + 1) / N) * Math.PI - gap * 0.5;
      const key = i === (N - 1) / 2;
      const r1 = W + GATEWAY.RING + (key ? 0.45 : (rnd() - 0.5) * 0.08);
      const depth = GATEWAY.DEPTH + (key ? 0.3 : (rnd() - 0.5) * 0.06);
      addStone(place(sectorStone(W, r1, a0, a1, depth, 0.07), 0, S, 0));
    }
    // Fallen blocks at the foot of the pillars
    if (st.rubble) {
      for (let i = 0; i < 6; i++) {
        const side = i % 2 === 0 ? -1 : 1;
        const w = 0.8 + rnd() * 0.9;
        const h = 0.5 + rnd() * 0.5;
        const d = 0.7 + rnd() * 0.8;
        const x = side * (10.4 + rnd() * 2.6);
        const z = (rnd() - 0.5) * 9;
        addStone(place(stoneBlock(w, h, d, 0.06), x, h / 2 - 0.12, z, (rnd() - 0.5) * 0.3, rnd() * Math.PI, (rnd() - 0.5) * 0.3));
      }
    }
    yield;

    const stoneGeom = this.track(mergeGeometries(stones, false)!);
    for (const g of stones) g.dispose();
    stoneGeom.computeBoundingSphere();
    const stoneMesh = new THREE.Mesh(stoneGeom, stoneMat);
    stoneMesh.name = 'GatewayStone';
    stoneMesh.castShadow = true;
    stoneMesh.receiveShadow = true;
    this.group.add(stoneMesh);
    yield;

    // 4. Destination dressing: sand drifts, snow caps, ice
    const drift = (sx: number, sy: number, sz: number, x: number, y: number, z: number, ry: number) => {
      const g = new THREE.SphereGeometry(1, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2);
      g.scale(sx, sy, sz);
      scaleUv(g, sx * 1.4, sy * 1.2);
      return normalizeAttributes(place(g, x, y, z, 0, ry, 0));
    };
    if (sandMat || snowMat) {
      const parts: THREE.BufferGeometry[] = [];
      for (const side of [-1, 1]) {
        const cx = side * (W + GATEWAY.PILLAR_W / 2);
        parts.push(drift(2.6, 0.9, 2.2, cx + side * 1.6, -0.25, -2.3, 0.3 * side));
        parts.push(drift(2.2, 0.7, 2.0, cx + side * 1.9, -0.25, 2.5, -0.2 * side));
        parts.push(drift(1.6, 0.55, 1.5, cx + side * 0.2, -0.2, -3.0, 0.5));
      }
      if (snowMat) {
        // Caps on the ledges and along the top of the arch
        for (const side of [-1, 1]) {
          const cx = side * (W + GATEWAY.PILLAR_W / 2);
          parts.push(normalizeAttributes(place(stoneBlock(GATEWAY.PILLAR_W + 0.78, 0.2, GATEWAY.PILLAR_D + 0.58, 0.08), cx, S + 0.07, 0)));
          parts.push(normalizeAttributes(place(stoneBlock(GATEWAY.PLINTH_W - 0.35, 0.18, GATEWAY.PLINTH_D - 0.35, 0.07), cx, GATEWAY.PLINTH_TOP + 0.4, 0)));
        }
        const snowArch = sectorStone(W + GATEWAY.RING - 0.04, W + GATEWAY.RING + 0.24, 0.62, Math.PI - 0.62, GATEWAY.DEPTH + 0.08, 0.08);
        parts.push(normalizeAttributes(place(snowArch, 0, S, 0)));
      }
      for (const g of parts) scaleUv(g, 0.6);
      const geom = this.track(mergeGeometries(parts, false)!);
      for (const g of parts) g.dispose();
      const mesh = new THREE.Mesh(geom, (snowMat ?? sandMat)!);
      mesh.name = snowMat ? 'GatewaySnow' : 'GatewaySand';
      mesh.receiveShadow = true;
      this.group.add(mesh);
    }
    if (iceMat) {
      const parts: THREE.BufferGeometry[] = [];
      // Icicles hanging from the arch's underside
      for (let i = 0; i < 30; i++) {
        const a = 0.25 + (i / 29) * (Math.PI - 0.5) + (rnd() - 0.5) * 0.05;
        const len = 0.35 + rnd() * rnd() * 1.6;
        const r = 0.06 + rnd() * 0.12;
        const g = new THREE.ConeGeometry(r, len, 6, 1);
        g.rotateX(Math.PI); // tip down
        const rr = W - 0.02;
        parts.push(normalizeAttributes(place(g, Math.cos(a) * rr, S + Math.sin(a) * rr - len / 2, (rnd() - 0.5) * 2.6)));
      }
      // Ice crystal clusters at the plinths
      for (const side of [-1, 1]) {
        const cx = side * (W + GATEWAY.PILLAR_W / 2);
        for (let i = 0; i < 7; i++) {
          const h = 0.7 + rnd() * 1.6;
          const r = 0.12 + rnd() * 0.2;
          const g = new THREE.CylinderGeometry(r * 0.35, r, h, 6, 1);
          parts.push(
            normalizeAttributes(
              place(g, cx + side * (1.9 + rnd() * 1.0), h * 0.4 - 0.15, (rnd() - 0.5) * 4.4, (rnd() - 0.5) * 0.7, rnd() * Math.PI, side * (0.15 + rnd() * 0.5))
            )
          );
        }
      }
      const geom = this.track(mergeGeometries(parts, false)!);
      for (const g of parts) g.dispose();
      const mesh = new THREE.Mesh(geom, iceMat);
      mesh.name = 'GatewayIce';
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.group.add(mesh);
    }
    yield;

    // 5. Rim of light along the opening, membrane, beam
    const rimColor = this.energy.clone().multiplyScalar(4.5);
    const rimMat = new THREE.MeshBasicMaterial({ color: rimColor });
    applyStreamFade(rimMat, this.shared.fade, 'far', false);
    this.materials.push(rimMat);
    const rimGeom = this.track(new THREE.TubeGeometry(new OpeningCurve(W - 0.05, S, 0.02, 0), 220, 0.045, 6, false));
    const rim = new THREE.Mesh(rimGeom, rimMat);
    rim.name = 'GatewayRim';
    this.group.add(rim);

    const shape = new THREE.Shape();
    shape.moveTo(-W, GATEWAY.MEMBRANE_BOTTOM);
    shape.lineTo(-W, S);
    shape.absarc(0, S, W, Math.PI, 0, true);
    shape.lineTo(W, GATEWAY.MEMBRANE_BOTTOM);
    shape.closePath();
    const memGeom = this.track(new THREE.ShapeGeometry(shape, 48));
    memGeom.rotateY(Math.PI); // faces the approaching rider (-Z)
    const sm = this.shared.membrane;
    this.membraneUniforms = {
      tWindow: sm.tWindow,
      uRect: sm.uRect,
      uWinScale: sm.uWinScale,
      uWinTexel: sm.uWinTexel,
      uLive: sm.uLive,
      uExposure: sm.uExposure,
      uTime: sm.uTime,
      uTintTop: { value: new THREE.Color(0.6, 0.7, 0.85) },
      uTintHorizon: { value: new THREE.Color(0.8, 0.82, 0.85) },
      uEnergy: { value: this.energy.clone() },
      uHalfW: { value: W },
      uSpringY: { value: S },
      uFadeFar: this.shared.fade.uniforms.uFadeFar,
    };
    const memMat = new THREE.ShaderMaterial({
      name: 'PortalMembrane',
      uniforms: this.membraneUniforms,
      vertexShader: MEMBRANE_VERTEX,
      fragmentShader: MEMBRANE_FRAGMENT,
    });
    this.materials.push(memMat);
    const membrane = new THREE.Mesh(memGeom, memMat);
    membrane.name = 'GatewayMembrane';
    // Drawn first among opaques: everything behind it in the opening is
    // rejected by the depth test instead of shaded and overdrawn.
    membrane.renderOrder = -1;
    this.group.add(membrane);
    this.membrane = membrane;

    const beamGeom = this.track(new THREE.CylinderGeometry(10, 3.6, BEAM_HEIGHT, 32, 1, true));
    beamGeom.translate(0, BEAM_HEIGHT / 2, 0);
    this.beamUniforms.uColor.value.copy(this.energy).lerp(new THREE.Color(1, 1, 1), 0.35);
    const beamMat = new THREE.ShaderMaterial({
      name: 'PortalBeam',
      uniforms: this.beamUniforms,
      vertexShader: BEAM_VERTEX,
      fragmentShader: BEAM_FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    this.materials.push(beamMat);
    const beam = new THREE.Mesh(beamGeom, beamMat);
    beam.name = 'GatewayBeam';
    beam.position.y = GATEWAY_CROWN_Y - 1.5;
    beam.frustumCulled = false;
    this.group.add(beam);
    this.beam = beam;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.group.removeFromParent();
    for (const g of this.geometries) g.dispose();
    // Scanned textures are shared (asset library) and the vein map is session
    // cached: only the materials go.
    for (const m of this.materials) m.dispose();
    this.geometries.length = 0;
    this.materials.length = 0;
    this.scanSlots.length = 0;
  }
}
