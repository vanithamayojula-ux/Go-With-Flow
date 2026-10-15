import * as THREE from 'three';

/**
 * Procedural snow-laden spruce crown as one vertex-coloured mesh.
 *
 * Each branch whorl is a drooping skirt with a jagged rim (individual branch
 * tips), a snowy upper surface and a dark needled underside. Whorl spacing,
 * radius, droop and rotation are irregular, and the crown tapers to a thin
 * leader, so the silhouette reads as a real conifer rather than stacked cones.
 * Fits within `maxRadius` of the trunk axis.
 */
export interface ConiferOptions {
  height?: number; // total crown top height (m)
  maxRadius?: number; // widest branch tip radius (m)
  snow?: number; // 0..1 overall snow load
}

export function createConiferCrownGeometry(seed: number, opts: ConiferOptions = {}): THREE.BufferGeometry {
  const height = opts.height ?? 9.0;
  const maxRadius = opts.maxRadius ?? 2.4;
  const snowLoad = opts.snow ?? 0.8;

  let s = seed * 7919 + 13;
  const rnd = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };

  // Linear-space albedos
  const needleDark = new THREE.Color(0x16241b);
  const needleMid = new THREE.Color(0x24382a);
  const snowLit = new THREE.Color(0xe6ecf2);
  const snowBlue = new THREE.Color(0xc7d4e2); // snow in the crown's own shade
  const tmp = new THREE.Color();

  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];

  const SEG = 22;
  const crownBase = 1.6;
  // Dense, overlapping whorls: each one drops further than the gap to the next
  const tiers = 15 + Math.floor(rnd() * 4);

  for (let t = 0; t < tiers; t++) {
    const f = t / (tiers - 1); // 0 bottom .. 1 top
    // Irregular whorl heights, slightly denser near the top
    const yTop = crownBase + Math.pow(f, 0.9) * (height - crownBase - 0.9) + (rnd() - 0.5) * 0.25;
    // Narrow-crowned spruce profile: near-linear taper with a slight belly
    const profile = Math.pow(1 - f, 0.95) * (0.92 + 0.08 * Math.sin(f * Math.PI));
    const R = Math.max(0.25, maxRadius * profile * (0.85 + rnd() * 0.15));
    const droop = 0.3 + R * (0.5 + rnd() * 0.2);
    const thick = 0.22 + R * 0.14;
    const rot = rnd() * Math.PI * 2;
    const lobes = 5 + Math.floor(R * 2.2 + rnd() * 2);
    const tierSnow = snowLoad * (0.55 + rnd() * 0.45) * (0.7 + f * 0.3);

    const base = pos.length / 3;
    // Rings: 0 = collar at trunk (top), 1 = mid upper, 2 = rim, 3 = mid lower
    for (let i = 0; i < SEG; i++) {
      const a = rot + (i / SEG) * Math.PI * 2;
      // Branch tips: sharp lobes plus random length variation
      const lobe = Math.pow(Math.abs(Math.cos((a * lobes) / 2)), 0.55);
      const rr = R * (0.68 + 0.32 * lobe) * (0.9 + rnd() * 0.2);
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const yRim = yTop - droop * (0.85 + rnd() * 0.3);

      const collarR = 0.12;
      const midR = rr * 0.55;
      const midY = yTop - droop * 0.38 + 0.05;

      pos.push(ca * collarR, yTop, sa * collarR); // 0
      pos.push(ca * midR, midY, sa * midR); // 1
      pos.push(ca * rr, yRim, sa * rr); // 2
      pos.push(ca * midR * 0.9, midY - thick, sa * midR * 0.9); // 3

      // Snow lies on the upper mid-branch; patchy, thinning toward the tips
      const patch = rnd();
      const sMid = THREE.MathUtils.clamp(tierSnow * (0.75 + patch * 0.5), 0, 1);
      const sRim = THREE.MathUtils.clamp(tierSnow * (patch > 0.6 ? 0.35 : 0.04), 0, 1);
      const sCollar = THREE.MathUtils.clamp(tierSnow * 0.5, 0, 1);
      const shade = 0.85 + rnd() * 0.25;
      const needle = tmp.copy(needleMid).lerp(needleDark, rnd() * 0.6);
      const nr = needle.r * shade;
      const ng = needle.g * shade;
      const nb = needle.b * shade;

      const pushMix = (snowAmt: number, inShade: number) => {
        tmp.copy(snowLit).lerp(snowBlue, inShade);
        col.push(nr + (tmp.r - nr) * snowAmt, ng + (tmp.g - ng) * snowAmt, nb + (tmp.b - nb) * snowAmt);
      };
      pushMix(sCollar, 0.6);
      pushMix(sMid, 0.15);
      pushMix(sRim, 0.3);
      col.push(nr * 0.85, ng * 0.85, nb * 0.85); // underside: needles only
    }

    for (let i = 0; i < SEG; i++) {
      const j = (i + 1) % SEG;
      const v = (k: number, r: number) => base + k * 4 + r;
      // Upper surface: collar -> mid -> rim (normals up/out)
      idx.push(v(i, 0), v(j, 0), v(i, 1));
      idx.push(v(j, 0), v(j, 1), v(i, 1));
      idx.push(v(i, 1), v(j, 1), v(i, 2));
      idx.push(v(j, 1), v(j, 2), v(i, 2));
      // Lower surface: rim -> mid lower -> collar (normals down/out)
      idx.push(v(i, 2), v(j, 2), v(i, 3));
      idx.push(v(j, 2), v(j, 3), v(i, 3));
      idx.push(v(i, 3), v(j, 3), v(i, 0));
      idx.push(v(j, 3), v(j, 0), v(i, 0));
    }
  }

  // Leader: thin spire above the last whorl
  const leaderBase = pos.length / 3;
  const topY = height;
  const lb = height - 1.1;
  const LS = 7;
  for (let i = 0; i < LS; i++) {
    const a = (i / LS) * Math.PI * 2;
    pos.push(Math.cos(a) * 0.16, lb, Math.sin(a) * 0.16);
    col.push(needleMid.r, needleMid.g, needleMid.b);
  }
  pos.push(0, topY, 0);
  tmp.copy(needleMid).lerp(snowLit, snowLoad * 0.4);
  col.push(tmp.r, tmp.g, tmp.b);
  for (let i = 0; i < LS; i++) {
    idx.push(leaderBase + i, leaderBase + LS, leaderBase + ((i + 1) % LS));
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  // Winding check: the first whorl's upper mid vertex must face up
  const n = g.getAttribute('normal') as THREE.BufferAttribute;
  if (n.getY(1) < 0) {
    for (let i = 0; i < idx.length; i += 3) {
      const tmpI = idx[i + 1];
      idx[i + 1] = idx[i + 2];
      idx[i + 2] = tmpI;
    }
    g.setIndex(idx);
    g.computeVertexNormals();
  }
  g.computeBoundingSphere();
  return g;
}
