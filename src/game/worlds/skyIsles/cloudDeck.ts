import * as THREE from 'three';

/**
 * Sea-of-clouds deck far below the floating islands: one large horizontal
 * plane that follows the rider, shaded from layered, slowly drifting noise.
 *
 * Seen from above, a stratocumulus deck is a carpet of rounded cells: sunlit
 * tops, blue-grey shaded troughs between them and gaps where the deck thins.
 * The shader builds that from three octaves of tileable noise (broad cells,
 * mid-size billows, fine detail), lights each cell from its slope toward the
 * sun (a finite difference of the density) and darkens the thin, low parts.
 * Fog blends the far deck into the horizon haze. One draw call, no per-frame
 * allocation.
 */

function mulberry(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Tileable "billowy" noise: 1 - |2n - 1| folded value noise (rounded cells). */
function billowField(size: number, seed: number, baseCells: number, octaves: number): Float32Array {
  const rnd = mulberry(seed);
  const out = new Float32Array(size * size);
  let amp = 0.5;
  let cells = baseCells;
  let total = 0;
  for (let o = 0; o < octaves; o++) {
    const lat = new Float32Array(cells * cells);
    for (let i = 0; i < lat.length; i++) lat[i] = rnd();
    for (let py = 0; py < size; py++) {
      const fy = (py / size) * cells;
      const y0 = Math.floor(fy);
      let ty = fy - y0;
      ty = ty * ty * (3 - 2 * ty);
      const ya = y0 % cells;
      const yb = (y0 + 1) % cells;
      for (let px = 0; px < size; px++) {
        const fx = (px / size) * cells;
        const x0 = Math.floor(fx);
        let tx = fx - x0;
        tx = tx * tx * (3 - 2 * tx);
        const xa = x0 % cells;
        const xb = (x0 + 1) % cells;
        const top = lat[ya * cells + xa] + (lat[ya * cells + xb] - lat[ya * cells + xa]) * tx;
        const bot = lat[yb * cells + xa] + (lat[yb * cells + xb] - lat[yb * cells + xa]) * tx;
        const v = top + (bot - top) * ty;
        out[py * size + px] += (1 - Math.abs(v * 2 - 1)) * amp;
      }
    }
    total += amp;
    amp *= 0.5;
    cells *= 2;
  }
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < out.length; i++) {
    out[i] /= total;
    min = Math.min(min, out[i]);
    max = Math.max(max, out[i]);
  }
  const r = Math.max(1e-5, max - min);
  for (let i = 0; i < out.length; i++) out[i] = (out[i] - min) / r;
  return out;
}

let deckNoise: THREE.DataTexture | null | undefined;

/** 128^2 tileable deck noise: R = broad billows, G = fine billows (linear). */
function getDeckNoise(): THREE.DataTexture | null {
  if (deckNoise !== undefined) return deckNoise;
  if (typeof document === 'undefined') return (deckNoise = null);
  const size = 128;
  const a = billowField(size, 7177, 4, 5);
  const b = billowField(size, 2203, 8, 4);
  const data = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    data[i * 4] = Math.round(a[i] * 255);
    data[i * 4 + 1] = Math.round(b[i] * 255);
    data[i * 4 + 2] = 0;
    data[i * 4 + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.NoColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  deckNoise = tex;
  return tex;
}

const VERTEX = /* glsl */ `
uniform vec2 uCentre;
varying vec3 vWorld;
#include <fog_pars_vertex>
void main() {
  vec4 wp = modelMatrix * vec4( position, 1.0 );
  wp.xz += uCentre;
  vWorld = wp.xyz;
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;

const FRAGMENT = /* glsl */ `
uniform sampler2D uNoise;
uniform float uTime;
uniform vec3 uSun;
uniform vec3 uLit;
uniform vec3 uShade;
uniform vec3 uDeep;
uniform vec2 uCentre;
uniform float uRadius;
varying vec3 vWorld;
#include <fog_pars_fragment>

float deck( vec2 p ) {
  float a = texture2D( uNoise, p * 0.0011 + uTime * vec2( 0.0011, 0.0004 ) ).r;
  float b = texture2D( uNoise, p * 0.0036 + vec2( 0.31, 0.77 ) + uTime * vec2( -0.0007, 0.0012 ) ).r;
  float c = texture2D( uNoise, p * 0.011 + vec2( 0.53, 0.19 ) + uTime * vec2( 0.0018, -0.0009 ) ).g;
  return a * 0.5 + b * 0.32 + c * 0.18;
}

void main() {
  vec2 p = vWorld.xz;
  float d = deck( p );
  // Slope toward the sun: cells facing it are lit, the far sides fall into shade
  vec2 sdir = normalize( uSun.xz + vec2( 1e-4 ) );
  float ds = deck( p + sdir * 14.0 );
  float facing = clamp( 0.5 + ( d - ds ) * 11.0, 0.0, 1.0 );
  float height = smoothstep( 0.28, 0.82, d );
  float light = clamp( height * 0.5 + facing * 0.65 - 0.08, 0.0, 1.0 );
  light = light * light * ( 3.0 - 2.0 * light );
  vec3 col = mix( uShade, uLit, light );
  // Thin, low parts of the deck read darker and bluer (looking into its depth)
  col = mix( uDeep, col, smoothstep( 0.18, 0.5, d ) );
  float cover = smoothstep( 0.2, 0.42, d );
  float r = length( p - uCentre );
  float edge = 1.0 - smoothstep( uRadius * 0.62, uRadius, r );
  gl_FragColor = vec4( col, cover * edge );
  #include <fog_fragment>
}
`;

export interface CloudDeck {
  mesh: THREE.Mesh;
  update(cameraX: number, playerZ: number, time: number): void;
  dispose(): void;
}

export interface CloudDeckOptions {
  y: number;
  radius: number;
  /** Direction toward the sun (world). */
  sun: THREE.Vector3;
  lit: THREE.ColorRepresentation;
  litIntensity: number;
  shade: THREE.ColorRepresentation;
  shadeIntensity: number;
  deep: THREE.ColorRepresentation;
}

export function createCloudDeck(opts: CloudDeckOptions): CloudDeck {
  const noise = getDeckNoise();
  const geom = new THREE.CircleGeometry(opts.radius, 48);
  geom.rotateX(-Math.PI / 2);
  const centre = new THREE.Vector2();
  const material = new THREE.ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uNoise: { value: null },
        uTime: { value: 0 },
        uSun: { value: opts.sun.clone().normalize() },
        uLit: { value: new THREE.Color(opts.lit).multiplyScalar(opts.litIntensity) },
        uShade: { value: new THREE.Color(opts.shade).multiplyScalar(opts.shadeIntensity) },
        uDeep: { value: new THREE.Color(opts.deep).multiplyScalar(opts.shadeIntensity * 0.85) },
        uCentre: { value: centre },
        uRadius: { value: opts.radius },
      },
    ]),
    transparent: true,
    depthWrite: false,
    fog: true,
  });
  material.uniforms.uNoise.value = noise;
  material.uniforms.uCentre.value = centre;
  if (!noise) material.visible = false;
  const mesh = new THREE.Mesh(geom, material);
  mesh.name = 'SkyIslesCloudDeck';
  mesh.position.y = opts.y;
  mesh.frustumCulled = false;
  // Behind every other transparent (cloud puffs, waterfalls) in the sort
  mesh.renderOrder = -2;
  return {
    mesh,
    update(cameraX, playerZ, time) {
      // Snap to a coarse grid: the noise is in world space, so the deck itself never swims
      centre.set(Math.round(cameraX / 50) * 50, Math.round(playerZ / 50) * 50);
      material.uniforms.uTime.value = time;
    },
    dispose() {
      geom.dispose();
      material.dispose();
    },
  };
}
