import * as THREE from 'three';

/**
 * Soft volumetric-looking clouds drawn as camera-facing billboards in a single
 * instanced draw call. Each billboard samples one of four procedurally painted
 * cumulus cells: fBm-eroded soft edges, a flat darker base and light that falls
 * off with the amount of cloud above (self-shadowing), plus a silver-lined rim.
 */

const ATLAS_CELL = 256;

function hash2(x: number, y: number, seed: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453123;
  return s - Math.floor(s);
}

function valueNoise(x: number, y: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, seed);
  const b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed);
  const d = hash2(xi + 1, yi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function fbm(x: number, y: number, seed: number): number {
  let sum = 0;
  let amp = 0.5;
  let f = 1;
  for (let o = 0; o < 5; o++) {
    sum += valueNoise(x * f, y * f, seed + o * 13) * amp;
    f *= 2.03;
    amp *= 0.5;
  }
  return sum;
}

/**
 * 2x2 atlas. R = coverage (alpha), G = light (0 = shadowed base, 1 = sunlit top).
 * Stored in colour channels with opaque alpha so canvas premultiplication can't
 * destroy the light values in the thin edges.
 */
let sharedAtlas: THREE.CanvasTexture | null | undefined;

/** The atlas is painted once per session and shared by every cloud set (never disposed). */
function getCloudAtlas(): THREE.CanvasTexture | null {
  if (sharedAtlas === undefined) sharedAtlas = createCloudAtlas();
  return sharedAtlas;
}

function createCloudAtlas(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const size = ATLAS_CELL * 2;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const img = ctx.createImageData(size, size);
  const N = ATLAS_CELL;
  const density = new Float32Array(N * N);

  for (let cell = 0; cell < 4; cell++) {
    const ox = (cell % 2) * N;
    const oy = Math.floor(cell / 2) * N;
    const seed = 11 + cell * 7;
    let s = seed * 9973;
    const rnd = () => {
      s = (s * 16807) % 2147483647;
      return s / 2147483647;
    };

    // Cumulus massing: a row of overlapping domes on a flat base, the middle
    // ones tallest; coordinates in 0..1 of the cell (y down).
    const baseY = 0.7 + rnd() * 0.06;
    const blobs: [number, number, number][] = [];
    const count = 5 + Math.floor(rnd() * 3);
    for (let b = 0; b < count; b++) {
      const t = (b + 0.5) / count;
      const x = 0.16 + t * 0.68 + (rnd() - 0.5) * 0.06;
      const centre = 1 - Math.abs(t - 0.5) * 2; // 0 at the ends, 1 in the middle
      const r = 0.09 + centre * 0.1 + rnd() * 0.05;
      const y = baseY - r * (0.55 + centre * 0.5) - rnd() * 0.04;
      blobs.push([x, y, r]);
    }
    // A couple of turrets on top
    for (let b = 0; b < 2; b++) {
      const x = 0.35 + rnd() * 0.3;
      blobs.push([x, baseY - 0.3 - rnd() * 0.1, 0.07 + rnd() * 0.05]);
    }

    for (let py = 0; py < N; py++) {
      const y = py / N;
      for (let px = 0; px < N; px++) {
        const x = px / N;
        let d = 0;
        for (const [bx, by, br] of blobs) {
          const dx = (x - bx) / br;
          const dy = (y - by) / br;
          d += Math.exp(-(dx * dx + dy * dy) * 1.2);
        }
        // Flat-ish base with a soft underside
        d *= 1 - THREE.MathUtils.smoothstep(y, baseY - 0.02, baseY + 0.07);
        // Erode with fBm for wispy, non-geometric edges
        const n = fbm(x * 6 + seed, y * 6 - seed, seed);
        d = d * (0.55 + n * 0.9) - 0.12;
        // Fade to zero at the cell border so mipmaps never bleed between cells
        const edge = Math.min(x, 1 - x, y, 1 - y);
        d *= THREE.MathUtils.smoothstep(edge, 0.0, 0.06);
        density[py * N + px] = Math.max(0, d);
      }
    }

    // Light: march down each column accumulating optical depth from the top,
    // and add some forward-lit brightening toward the sun side (left).
    for (let px = 0; px < N; px++) {
      let acc = 0;
      for (let py = 0; py < N; py++) {
        const d = density[py * N + px];
        acc += d / N;
        const alpha = THREE.MathUtils.smoothstep(d, 0.02, 0.5);
        const x = px / N;
        let light = Math.exp(-acc * 9.0) * 0.85 + 0.15;
        light += (1 - alpha) * 0.12; // thin edges glow (silver lining)
        light += (0.5 - x) * 0.12;
        light *= 0.92 + fbm(px / N * 9 + 3, py / N * 9, seed + 99) * 0.16;
        const o = ((oy + py) * size + (ox + px)) * 4;
        img.data[o] = Math.round(alpha * 255);
        img.data[o + 1] = Math.round(THREE.MathUtils.clamp(light, 0, 1) * 255);
        img.data[o + 2] = 0;
        img.data[o + 3] = 255;
      }
    }
  }

  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  return tex;
}

export interface BillboardCloudOptions {
  litColor?: THREE.ColorRepresentation; // sunlit tops (linear HDR multiplier applied below)
  shadowColor?: THREE.ColorRepresentation; // shaded bases, lit by the blue sky
  litIntensity?: number;
  shadowIntensity?: number;
  opacity?: number;
}

const VERTEX = /* glsl */ `
attribute float aVariant;
attribute float aShade;
varying vec2 vUv;
varying float vShade;
#include <fog_pars_vertex>
void main() {
  vec4 centre = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  float sx = length(instanceMatrix[0].xyz);
  float sy = length(instanceMatrix[1].xyz);
  vec4 mvPosition = viewMatrix * centre;
  mvPosition.xy += position.xy * vec2(sx, sy);
  gl_Position = projectionMatrix * mvPosition;
  float flip = aShade < 0.0 ? -1.0 : 1.0;
  vec2 cuv = vec2(flip > 0.0 ? uv.x : 1.0 - uv.x, uv.y);
  vec2 cell = vec2(mod(aVariant, 2.0), floor(aVariant / 2.0));
  vUv = (cell + cuv) * 0.5;
  vShade = abs(aShade);
  #include <fog_vertex>
}
`;

const FRAGMENT = /* glsl */ `
uniform sampler2D uMap;
uniform vec3 uLit;
uniform vec3 uShadow;
uniform float uOpacity;
varying vec2 vUv;
varying float vShade;
#include <fog_pars_fragment>
void main() {
  vec4 t = texture2D(uMap, vUv);
  float a = t.r * uOpacity;
  if (a < 0.004) discard;
  vec3 col = mix(uShadow, uLit, t.g) * vShade;
  gl_FragColor = vec4(col, a);
  #include <fog_fragment>
}
`;

export interface BillboardCloudSet {
  mesh: THREE.InstancedMesh;
  material: THREE.ShaderMaterial;
  setCloud(index: number, x: number, y: number, z: number, width: number, height: number): void;
  dispose(): void;
}

/**
 * Create `count` billboard clouds. Call `setCloud` to place each one (width and
 * height in metres), then flag `mesh.instanceMatrix.needsUpdate`.
 */
export function createBillboardClouds(count: number, opts: BillboardCloudOptions = {}): BillboardCloudSet {
  const atlas = getCloudAtlas();
  const geom = new THREE.PlaneGeometry(1, 1);
  const variant = new Float32Array(count);
  const shade = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    variant[i] = i % 4;
    // sign = horizontal mirror, magnitude = brightness variation
    shade[i] = (i % 3 === 0 ? -1 : 1) * (0.9 + ((i * 37) % 11) / 11 * 0.15);
  }
  geom.setAttribute('aVariant', new THREE.InstancedBufferAttribute(variant, 1));
  geom.setAttribute('aShade', new THREE.InstancedBufferAttribute(shade, 1));

  const lit = new THREE.Color(opts.litColor ?? 0xfff6ea).multiplyScalar(opts.litIntensity ?? 2.6);
  const shadow = new THREE.Color(opts.shadowColor ?? 0x9fb2c8).multiplyScalar(opts.shadowIntensity ?? 1.3);

  const material = new THREE.ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uMap: { value: null },
        uLit: { value: lit },
        uShadow: { value: shadow },
        uOpacity: { value: opts.opacity ?? 0.95 },
      },
    ]),
    transparent: true,
    depthWrite: false,
    fog: true,
  });
  material.uniforms.uMap.value = atlas;
  if (!atlas) material.visible = false;

  const mesh = new THREE.InstancedMesh(geom, material, count);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1; // behind other transparent scenery

  const dummy = new THREE.Object3D();
  return {
    mesh,
    material,
    setCloud(index, x, y, z, width, height) {
      dummy.position.set(x, y, z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(width, height, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    },
    dispose() {
      geom.dispose();
      material.dispose();
      mesh.dispose();
    },
  };
}
