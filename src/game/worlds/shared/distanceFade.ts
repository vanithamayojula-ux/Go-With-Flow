import * as THREE from 'three';
import { WORLD_LENGTH_DISTANCE, WORLD_ORDER, WorldId } from '../../WorldConfig';

/**
 * Stream clipping + distance fade shared by every world's scenery materials.
 *
 * - Clip: fragments whose world z lies outside the world's stream range
 *   [uStreamMin, uStreamMax) are discarded, so a world's last ground chunk (or
 *   anything else) never shows past the gateway into the next world, and the
 *   next world starts exactly at it.
 * - Fade: scenery approaching from the far stream edge first blends into the
 *   fog colour (aerial perspective, applied after the fog: see the
 *   fog_fragment extension below), and only once it is (nearly) fog coloured
 *   does an ordered dither dissolve the rest. With thin fog a plain dither
 *   showed as a visible checkerboard hatch over whole mesas and ridges; this
 *   way the dithered pixels differ only slightly from the haze behind them.
 *   Still no transparency (no sorting), and the shadow pass is untouched
 *   (the shadow camera only covers the area around the rider).
 *
 * Two fade bands: 'near' for regular scenery (stream edge ~450 m) and 'far'
 * for horizon landmarks (volcanoes, monoliths, peaks) that stream further out.
 */

export interface StreamFadeUniforms {
  uStreamMin: { value: number };
  uStreamMax: { value: number };
  /** (start, end) world z of the near fade: fully visible before start, gone at end. */
  uFadeNear: { value: THREE.Vector2 };
  uFadeFar: { value: THREE.Vector2 };
}

export type FadeBand = 'near' | 'far' | 'none';

/** Scenery fades over [playerZ + NEAR_FADE_START, playerZ + NEAR_FADE_END]. */
export const NEAR_FADE_START = 330;
export const NEAR_FADE_END = 430;
export const FAR_FADE_START = 640;
export const FAR_FADE_END = 760;

const BIG = 1e9;

/**
 * Over the first part of a fade band the colour blends into the fog colour;
 * the dithered dissolve only covers the last part, where the object is
 * already (almost) fog coloured. Fractions of the band length.
 */
const FOG_BLEND_END = 0.62;
const DITHER_START = 0.55;

// Every material compiled with a fade band (GWF_FADE_BAND) gets its colour
// pulled toward the fog colour after the regular fog: extending the shared
// chunk covers the built-in materials (applyStreamFade) and the custom world
// shaders (terrain/rock materials) alike, with no per-material hook.
{
  const chunk = THREE.ShaderChunk as unknown as Record<string, string>;
  const MARK = '/* gwf-fog-fade */';
  if (typeof chunk.fog_fragment === 'string' && chunk.fog_fragment.indexOf(MARK) === -1) {
    chunk.fog_fragment += `
${MARK}
#if defined( GWF_FADE_BAND ) && defined( USE_FOG )
  gl_FragColor.rgb = mix( fogColor, gl_FragColor.rgb, gwfFogKeep );
#endif
`;
  }
}
const clampInf = (v: number) => (v === Infinity ? BIG : v === -Infinity ? -BIG : v);

export class StreamFade {
  readonly uniforms: StreamFadeUniforms = {
    uStreamMin: { value: -BIG },
    uStreamMax: { value: BIG },
    uFadeNear: { value: new THREE.Vector2(NEAR_FADE_START, NEAR_FADE_END) },
    uFadeFar: { value: new THREE.Vector2(FAR_FADE_START, FAR_FADE_END) },
  };

  setRange(minZ: number, maxZ: number): void {
    this.uniforms.uStreamMin.value = clampInf(minZ);
    this.uniforms.uStreamMax.value = clampInf(maxZ);
  }

  /** Moves the fade bands with the rider. */
  follow(playerZ: number): void {
    this.uniforms.uFadeNear.value.set(playerZ + NEAR_FADE_START, playerZ + NEAR_FADE_END);
    this.uniforms.uFadeFar.value.set(playerZ + FAR_FADE_START, playerZ + FAR_FADE_END);
  }
}

const worldFades = new Map<WorldId, StreamFade>();

/**
 * One StreamFade per world id for the whole session (the world's materials are
 * cached at module level too, so they keep pointing at the same uniforms).
 */
export function getWorldFade(worldId: WorldId): StreamFade {
  let f = worldFades.get(worldId);
  if (!f) {
    f = new StreamFade();
    const [a, b] = defaultWorldSpan(worldId);
    f.setRange(a, b);
    worldFades.set(worldId, f);
  }
  return f;
}

/** The world's own campaign span [k * L, (k + 1) * L) (the last world never ends). */
export function defaultWorldSpan(worldId: WorldId): [number, number] {
  const k = WORLD_ORDER.indexOf(worldId);
  const start = k * WORLD_LENGTH_DISTANCE;
  const end = k === WORLD_ORDER.length - 1 ? Infinity : (k + 1) * WORLD_LENGTH_DISTANCE;
  return [start, end];
}

/** True if z is within `margin` metres of any world boundary (k * WORLD_LENGTH_DISTANCE, k >= 1). */
export function nearWorldBoundary(z: number, margin: number): boolean {
  const L = WORLD_LENGTH_DISTANCE;
  for (let k = 1; k < WORLD_ORDER.length; k++) {
    if (Math.abs(z - k * L) < margin) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// GLSL
// ---------------------------------------------------------------------------

export const GWF_WORLDPOS_VERTEX_HEAD = /* glsl */ `
varying vec3 vGwfWPos;
`;

/** Inserted after #include <project_vertex>: world position incl. instancing. */
export const GWF_WORLDPOS_VERTEX_BODY = /* glsl */ `
{
  vec4 gwfW = vec4( transformed, 1.0 );
  #ifdef USE_INSTANCING
  gwfW = instanceMatrix * gwfW;
  #endif
  gwfW = modelMatrix * gwfW;
  vGwfWPos = gwfW.xyz;
}
`;

export const GWF_FADE_FRAGMENT_HEAD = /* glsl */ `
varying vec3 vGwfWPos;
float gwfFogKeep = 1.0;
uniform float uStreamMin;
uniform float uStreamMax;
uniform vec2 uFadeNear;
uniform vec2 uFadeFar;
`;

/** Inserted after #include <clipping_planes_fragment> (start of main). */
export const GWF_FADE_FRAGMENT_BODY = /* glsl */ `
#ifdef GWF_CLIP
  if ( vGwfWPos.z < uStreamMin || vGwfWPos.z >= uStreamMax ) discard;
#endif
#ifdef GWF_FADE_BAND
  {
    vec2 gwfBand = GWF_FADE_BAND;
    float gwfT = clamp( ( vGwfWPos.z - gwfBand.x ) / max( gwfBand.y - gwfBand.x, 1e-3 ), 0.0, 1.0 );
    #ifdef USE_FOG
      // Blend into the fog first, dissolve (dither) only the last stretch.
      gwfFogKeep = 1.0 - smoothstep( 0.0, ${FOG_BLEND_END.toFixed(3)}, gwfT );
      float gwfVis = 1.0 - smoothstep( ${DITHER_START.toFixed(3)}, 1.0, gwfT );
    #else
      float gwfVis = 1.0 - smoothstep( 0.0, 1.0, gwfT );
    #endif
    if ( gwfVis < 0.999 ) {
      float gwfIgn = fract( 52.9829189 * fract( dot( gl_FragCoord.xy, vec2( 0.06711056, 0.00583715 ) ) ) );
      if ( gwfVis <= gwfIgn ) discard;
    }
  }
#endif
`;

export function fadeDefines(band: FadeBand, clip = true): Record<string, string> {
  const d: Record<string, string> = {};
  if (clip) d.GWF_CLIP = '';
  if (band === 'near') d.GWF_FADE_BAND = 'uFadeNear';
  else if (band === 'far') d.GWF_FADE_BAND = 'uFadeFar';
  return d;
}

export function bindFadeUniforms(target: Record<string, THREE.IUniform>, fade: StreamFade): void {
  target.uStreamMin = fade.uniforms.uStreamMin;
  target.uStreamMax = fade.uniforms.uStreamMax;
  target.uFadeNear = fade.uniforms.uFadeNear;
  target.uFadeFar = fade.uniforms.uFadeFar;
}

/**
 * Adds stream clipping and the dithered distance fade to any built-in lit or
 * unlit material (MeshStandard/Physical/Lambert/Basic...). Chains a previous
 * onBeforeCompile and extends the program cache key. Returns the material.
 */
export function applyStreamFade<T extends THREE.Material>(material: T, fade: StreamFade, band: FadeBand = 'near', clip = true): T {
  const prev = material.onBeforeCompile;
  const prevKey = material.customProgramCacheKey.bind(material);
  material.defines = { ...(material.defines ?? {}), ...fadeDefines(band, clip) };
  material.onBeforeCompile = (shader, renderer) => {
    prev.call(material, shader, renderer);
    bindFadeUniforms(shader.uniforms, fade);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\n' + GWF_WORLDPOS_VERTEX_HEAD)
      .replace('#include <project_vertex>', '#include <project_vertex>\n' + GWF_WORLDPOS_VERTEX_BODY);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + GWF_FADE_FRAGMENT_HEAD)
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n' + GWF_FADE_FRAGMENT_BODY);
  };
  material.customProgramCacheKey = () => prevKey() + '|gwf-fade-v1';
  return material;
}
