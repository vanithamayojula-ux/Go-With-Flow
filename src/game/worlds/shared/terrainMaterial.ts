import * as THREE from 'three';
import { getPlaceholderTextures, ScanTextureSet, EnvModel } from '../../../graphics/assetLibrary';
import {
  StreamFade,
  FadeBand,
  fadeDefines,
  bindFadeUniforms,
  GWF_WORLDPOS_VERTEX_HEAD,
  GWF_FADE_FRAGMENT_HEAD,
  GWF_FADE_FRAGMENT_BODY,
} from './distanceFade';
import { getMacroNoiseTexture } from './noiseTextures';

/**
 * World-space PBR surface material for terrain, cliffs and scanned rocks.
 *
 * - Ground layer: planar XZ projection of a scanned set (albedo / normal / ARM),
 *   blended with a rotated, larger second sample to hide tiling.
 * - Rock layer: triplanar projection of a second scanned set on steep faces
 *   (slope blend by world normal, broken up with macro noise).
 * - Macro variation: low-frequency world-space tint and roughness drift.
 * - Optional vertex colours act as a relative tint (vColor / vcRef), keeping a
 *   geometry's hand-authored patches (moss, strata, dirty shoulders) without
 *   double-colouring the scans.
 * - Optional scanned-model mode: the model's own UV normal / AO maps are used
 *   (material.normalMap / aoMap) with the world's triplanar albedo.
 * - Optional emissive lava in cracks (Obsidian Core).
 * - Stream clip + distance fade (see distanceFade.ts).
 *
 * Until `setGround` / `setRock` receive the scanned sets, the material renders
 * the procedural fallback (vertex colours or flat tint x noise). Texture swaps
 * only change uniform values, so the shader program never recompiles; the
 * transition to the scans cross-fades via `uScanMix`.
 */

export interface TerrainLayerOptions {
  /** Metres covered by one texture repeat. */
  tile: number;
  /** Multiplies the scanned albedo (sRGB hex). */
  tint?: THREE.ColorRepresentation;
  normalScale?: number;
  /** Scanned roughness is remapped to mix(min, max, arm.g). */
  roughness?: [number, number];
  /** Albedo of the procedural fallback when there are no vertex colours. */
  fallback?: THREE.ColorRepresentation;
  /** Extra linear multiplier on the tint (> 1 brightens very dark scans). */
  gain?: number;
}

export interface TerrainMaterialOptions {
  name: string;
  /** Planar XZ layer for flat ground. */
  ground?: TerrainLayerOptions;
  /** Triplanar layer for steep faces (or every face when there is no ground layer). */
  rock?: TerrainLayerOptions;
  /** normal.y thresholds: fully rock below [0], fully ground above [1]. */
  slope?: [number, number];
  vertexColors?: boolean;
  /** Average vertex colour (sRGB hex); scans are tinted by vColor / vcRef. */
  vcRef?: THREE.ColorRepresentation;
  /** Reference for the rock layer (defaults to vcRef). */
  vcRefRock?: THREE.ColorRepresentation;
  /** Compare vertex colours by luminance only (keeps light/dark patches, drops hue). */
  vcLuma?: boolean;
  /** How much of the relative vertex tint survives once scans are in (0..1). */
  vcKeep?: number;
  /** Macro albedo variation amplitude (default 0.16). */
  macro?: number;
  /** Fallback roughness before the scans arrive. */
  roughness?: number;
  fade: StreamFade;
  band?: FadeBand;
  clip?: boolean;
  /** Scanned-model mode: per-model UV normal / AO maps (placeholders until loaded). */
  modelMaps?: boolean;
  /**
   * Snow look on the ground layer: soft blue-white fill light (stands in for
   * subsurface scattering and the blue skylight in shadows) and a raised
   * roughness floor so the snow never sparkles.
   */
  snow?: boolean;
  /** Emissive lava glowing in the crevices (AO-driven), HDR intensity. */
  lava?: { color: THREE.ColorRepresentation; intensity: number };
  side?: THREE.Side;
  /** Use MeshPhysicalMaterial (clearcoat) instead of MeshStandardMaterial. */
  physical?: Partial<THREE.MeshPhysicalMaterialParameters>;
  envMapIntensity?: number;
  /** Faceted shading (basalt columns, crystals); triplanar follows the facets. */
  flatShading?: boolean;
  /**
   * Ground beds: within `length` metres of either stream-range end the
   * terrain beyond |x| = innerX sinks by up to `depth` metres, so a world's
   * ground ends in a soft swale that feathers into the road shoulder instead
   * of a hard clipped edge.
   */
  skirt?: { length: number; depth: number; innerX: number };
  /**
   * World-height band [y0, y1]: below y0 the surface is pure ground layer
   * (sand / scree banked against the base, no vertex tint), fading to the
   * normal slope blend by y1. Blends cliffs and mesas into the ground bed.
   */
  baseBlend?: [number, number];
  /**
   * GLSL source defining `float gwfGroundY( vec2 xz )` (world ground height).
   * With baseBlend, the band is then measured as height above that ground,
   * so a cliff blends into the bed exactly where it meets it.
   */
  groundHeightGlsl?: string;
  /** Lava: 0 = glow only in macro patches (default), 1 = in every crevice. */
  lavaCover?: number;
  /** Lava: crevice AO thresholds [core, halo] (defaults 0.24 / 0.46). */
  lavaAo?: [number, number];
}

export interface TerrainMaterialHandle {
  material: THREE.MeshStandardMaterial;
  options: TerrainMaterialOptions;
  setGround(set: ScanTextureSet | null): void;
  setRock(set: ScanTextureSet | null): void;
  /** Scanned-model maps (normal / AO from the GLB). */
  setModel(model: EnvModel | null): void;
  /** 0 = procedural fallback, 1 = scans. */
  scanMix: { value: number };
  lavaPulse: { value: number };
  /** Advance the fallback -> scan cross-fade. */
  tick(dt: number): void;
  /** Jump straight to the current target (no cross-fade), e.g. before the world is first shown. */
  snap(): void;
}

const _c = new THREE.Color();
const toLinearVec3 = (c: THREE.ColorRepresentation | undefined, dflt: number, gain = 1) => {
  _c.set(c ?? dflt);
  return new THREE.Vector3(_c.r * gain, _c.g * gain, _c.b * gain);
};

const SKIRT_VERTEX_HEAD = /* glsl */ `
#ifdef GWF_SKIRT
uniform float uStreamMin;
uniform float uStreamMax;
uniform vec3 uSkirt;
#endif
`;

// After #include <begin_vertex>: sink the ground near the stream-range ends
// (world-space distance; ground beds are never scaled vertically).
const SKIRT_VERTEX_BODY = /* glsl */ `
#ifdef GWF_SKIRT
{
  vec4 gwfSw = vec4( transformed, 1.0 );
  #ifdef USE_INSTANCING
  gwfSw = instanceMatrix * gwfSw;
  #endif
  gwfSw = modelMatrix * gwfSw;
  float gwfSd = min( gwfSw.z - uStreamMin, uStreamMax - gwfSw.z );
  float gwfSk = 1.0 - smoothstep( 0.0, uSkirt.x, gwfSd );
  float gwfSx = smoothstep( uSkirt.z, uSkirt.z + 5.0, abs( gwfSw.x ) );
  transformed.y -= gwfSk * gwfSk * gwfSx * uSkirt.y;
}
#endif
`;

const VERTEX_BODY = /* glsl */ `
{
  vec4 gwfW = vec4( transformed, 1.0 );
  #ifdef USE_INSTANCING
  gwfW = instanceMatrix * gwfW;
  #endif
  gwfW = modelMatrix * gwfW;
  vGwfWPos = gwfW.xyz;
  vec3 gwfN = objectNormal;
  #ifdef USE_INSTANCING
  gwfN = mat3( instanceMatrix ) * gwfN;
  #endif
  vGwfWNrm = normalize( mat3( modelMatrix ) * gwfN );
}
`;

const FRAGMENT_HEAD = /* glsl */ `
varying vec3 vGwfWNrm;
uniform sampler2D uGAlb;
uniform sampler2D uGNor;
uniform sampler2D uGArm;
uniform sampler2D uRAlb;
uniform sampler2D uRNor;
uniform sampler2D uRArm;
uniform sampler2D uMacroTex;
uniform float uGTile;
uniform float uRTile;
uniform float uGNs;
uniform float uRNs;
uniform vec2 uGRough;
uniform vec2 uRRough;
uniform vec3 uGTint;
uniform vec3 uRTint;
uniform vec3 uGFall;
uniform vec3 uRFall;
uniform vec2 uSlope;
uniform float uScanMix;
uniform vec3 uVcRef;
uniform vec3 uVcRefRock;
uniform float uVcKeep;
uniform float uMacroAmt;
uniform float uFallRough;
uniform vec3 uLavaColor;
uniform float uLavaPulse;
uniform vec4 uLavaCfg;
uniform vec2 uBaseBlend;

vec3 gwfTriW( vec3 n ) {
  vec3 w = abs( n );
  w = w * w; w = w * w;
  return w / ( w.x + w.y + w.z + 1e-5 );
}
`;

// Replaces #include <map_fragment> and <color_fragment>.
const ALBEDO_BODY = /* glsl */ `
#ifdef FLAT_SHADED
vec3 gwfN = normalize( cross( dFdx( vGwfWPos ), dFdy( vGwfWPos ) ) );
#else
vec3 gwfN = normalize( vGwfWNrm );
#endif
vec2 gwfXZ = vGwfWPos.xz;
float gwfMacroA = texture2D( uMacroTex, gwfXZ * 0.0067 ).r;
float gwfMacroB = texture2D( uMacroTex, gwfXZ * 0.029 + vec2( 0.37, 0.71 ) ).g;
float gwfRockW = 0.0;
#if defined( GWF_ROCK ) && defined( GWF_GROUND )
  gwfRockW = 1.0 - smoothstep( uSlope.x, uSlope.y, gwfN.y + ( gwfMacroB - 0.5 ) * 0.22 );
#elif defined( GWF_ROCK )
  gwfRockW = 1.0;
#endif
float gwfBase = 0.0;
#ifdef GWF_BASE_BLEND
  #ifdef GWF_GROUND_FN
  float gwfAboveY = vGwfWPos.y - gwfGroundY( vGwfWPos.xz );
  #else
  float gwfAboveY = vGwfWPos.y;
  #endif
  gwfBase = 1.0 - smoothstep( uBaseBlend.x, uBaseBlend.y, gwfAboveY + ( gwfMacroB - 0.5 ) * ( uBaseBlend.y - uBaseBlend.x ) );
  gwfRockW *= 1.0 - gwfBase;
#endif
vec3 gwfAlb = vec3( 0.0 );
vec3 gwfArm = vec3( 0.0 );
vec3 gwfWN = vec3( 0.0 );
float gwfRough = 0.0;
#ifdef GWF_GROUND
if ( gwfRockW < 0.999 ) {
  vec2 uvA = gwfXZ / uGTile;
  vec2 uvB = vec2( uvA.y, -uvA.x ) * 0.43 + vec2( 0.21, 0.57 );
  vec3 a1 = texture2D( uGAlb, uvA ).rgb;
  vec3 a2 = texture2D( uGAlb, uvB ).rgb;
  float bl = smoothstep( 0.25, 0.75, gwfMacroB ) * 0.6;
  vec3 ga = mix( a1, a2, bl );
  vec3 garm = mix( texture2D( uGArm, uvA ).rgb, texture2D( uGArm, uvB ).rgb, bl );
  vec3 tn = texture2D( uGNor, uvA ).xyz * 2.0 - 1.0;
  tn.xy *= uGNs;
  vec3 gn = vec3( tn.x + gwfN.x * tn.z, gwfN.y * tn.z, tn.y + gwfN.z * tn.z );
  // Slopes: blend in side projections so the planar map never stretches
  vec3 gtw = gwfTriW( gwfN );
  if ( gtw.y < 0.97 ) {
    vec3 gp = vGwfWPos / uGTile;
    ga *= gtw.y; garm *= gtw.y; gn *= gtw.y;
    if ( gtw.x > 0.01 ) {
      vec2 uv = gp.zy;
      ga += texture2D( uGAlb, uv ).rgb * gtw.x;
      garm += texture2D( uGArm, uv ).rgb * gtw.x;
      vec3 t = texture2D( uGNor, uv ).xyz * 2.0 - 1.0; t.xy *= uGNs;
      gn += vec3( gwfN.x * t.z, t.y + gwfN.y * t.z, t.x + gwfN.z * t.z ) * gtw.x;
    }
    if ( gtw.z > 0.01 ) {
      vec2 uv = gp.xy;
      ga += texture2D( uGAlb, uv ).rgb * gtw.z;
      garm += texture2D( uGArm, uv ).rgb * gtw.z;
      vec3 t = texture2D( uGNor, uv ).xyz * 2.0 - 1.0; t.xy *= uGNs;
      gn += vec3( t.x + gwfN.x * t.z, t.y + gwfN.y * t.z, gwfN.z * t.z ) * gtw.z;
    }
  }
  ga *= uGTint;
  float gw = 1.0 - gwfRockW;
  gwfAlb += ga * gw;
  gwfArm += garm * gw;
  gwfWN += gn * gw;
  gwfRough += mix( uGRough.x, uGRough.y, garm.g ) * gw;
}
#endif
#ifdef GWF_ROCK
if ( gwfRockW > 0.001 ) {
  vec3 p = vGwfWPos / uRTile;
  vec3 w = gwfTriW( gwfN );
  vec3 ra = vec3( 0.0 );
  vec3 rarm = vec3( 0.0 );
  vec3 rn = vec3( 0.0 );
  if ( w.x > 0.01 ) {
    vec2 uv = p.zy;
    ra += texture2D( uRAlb, uv ).rgb * w.x;
    rarm += texture2D( uRArm, uv ).rgb * w.x;
    vec3 t = texture2D( uRNor, uv ).xyz * 2.0 - 1.0; t.xy *= uRNs;
    rn += vec3( gwfN.x * t.z, t.y + gwfN.y * t.z, t.x + gwfN.z * t.z ) * w.x;
  }
  if ( w.y > 0.01 ) {
    vec2 uv = p.xz;
    ra += texture2D( uRAlb, uv ).rgb * w.y;
    rarm += texture2D( uRArm, uv ).rgb * w.y;
    vec3 t = texture2D( uRNor, uv ).xyz * 2.0 - 1.0; t.xy *= uRNs;
    rn += vec3( t.x + gwfN.x * t.z, gwfN.y * t.z, t.y + gwfN.z * t.z ) * w.y;
  }
  if ( w.z > 0.01 ) {
    vec2 uv = p.xy;
    ra += texture2D( uRAlb, uv ).rgb * w.z;
    rarm += texture2D( uRArm, uv ).rgb * w.z;
    vec3 t = texture2D( uRNor, uv ).xyz * 2.0 - 1.0; t.xy *= uRNs;
    rn += vec3( t.x + gwfN.x * t.z, t.y + gwfN.y * t.z, gwfN.z * t.z ) * w.z;
  }
  gwfAlb += ra * uRTint * gwfRockW;
  gwfArm += rarm * gwfRockW;
  gwfWN += rn * gwfRockW;
  gwfRough += mix( uRRough.x, uRRough.y, rarm.g ) * gwfRockW;
}
#endif
gwfWN = normalize( gwfWN + gwfN * 1e-3 );
// Macro tint: broad tonal drift that never repeats with the texture tile
float gwfMacro = gwfMacroA * 0.65 + gwfMacroB * 0.35;
gwfAlb *= 1.0 + ( gwfMacro - 0.5 ) * 2.0 * uMacroAmt;
gwfAlb *= mix( 1.0, gwfArm.r, 0.55 );
vec3 gwfFall = mix( uGFall, uRFall, gwfRockW );
#ifdef USE_COLOR
  vec3 gwfVcRefM = mix( uVcRef, uVcRefRock, gwfRockW );
  #ifdef GWF_VC_LUMA
  vec3 gwfVcRel = vec3( dot( vColor.rgb, vec3( 0.2126, 0.7152, 0.0722 ) ) / max( 1e-4, dot( gwfVcRefM, vec3( 0.2126, 0.7152, 0.0722 ) ) ) );
  #else
  vec3 gwfVcRel = vColor.rgb / max( gwfVcRefM, vec3( 1e-4 ) );
  #endif
  gwfVcRel = clamp( gwfVcRel, vec3( 0.45 ), vec3( 1.7 ) );
  gwfVcRel = mix( gwfVcRel, vec3( 1.0 ), gwfBase );
  #ifdef GWF_VC_ALBEDO
  gwfFall = vColor.rgb;
  #else
  gwfFall *= gwfVcRel;
  #endif
  gwfAlb *= mix( vec3( 1.0 ), gwfVcRel, uVcKeep );
#endif
gwfFall *= 0.84 + 0.32 * gwfMacroB * ( 0.6 + 0.4 * gwfMacroA );
diffuseColor.rgb *= mix( gwfFall, gwfAlb, uScanMix );
`;

const ROUGHNESS_BODY = /* glsl */ `
roughnessFactor = mix( uFallRough, clamp( gwfRough * ( 0.92 + 0.16 * gwfMacroA ), 0.04, 1.0 ), uScanMix );
#ifdef GWF_SNOW
roughnessFactor = max( roughnessFactor, mix( 0.55, 0.78, 1.0 - gwfRockW ) );
#endif
`;

const NORMAL_BODY = /* glsl */ `
#ifndef GWF_MODEL_MAPS
{
  vec3 gwfViewN = normalize( ( viewMatrix * vec4( gwfWN, 0.0 ) ).xyz );
  normal = normalize( mix( normal, gwfViewN, uScanMix ) );
}
#endif
`;

const LAVA_BODY = /* glsl */ `
#ifdef GWF_LAVA
{
  // Lava follows the rock's own cracks: the scanned AO marks crevices. A thin
  // white-hot / orange core in the deepest part, a broader deep-red heat glow
  // falling off around it, both patchy at macro scale (never a flat sheet).
  float ao = gwfArm.r;
  float core = smoothstep( uLavaCfg.y, uLavaCfg.y * 0.3, ao );
  float halo = smoothstep( uLavaCfg.z, uLavaCfg.z * 0.35, ao );
  float patchy = smoothstep( 0.55, 0.85, gwfMacroB ) * smoothstep( 0.3, 0.7, gwfMacroA );
  patchy = mix( patchy, 0.55 + 0.45 * gwfMacroA, uLavaCfg.x );
  float low = 1.0 - smoothstep( 0.5, 8.0, vGwfWPos.y );
  float m = patchy * ( 0.25 + 0.75 * low ) * uScanMix * uLavaPulse;
  vec3 hot = uLavaColor * vec3( 1.0, 1.45, 2.2 );
  vec3 ember = uLavaColor * vec3( 0.55, 0.22, 0.12 );
  totalEmissiveRadiance += ( hot * core * core + ember * halo * halo * 0.6 ) * m;
  // Heated crust around the cracks is scorched darker
  diffuseColor.rgb *= 1.0 - 0.45 * halo * m;
}
#endif
#ifdef GWF_SNOW
{
  // Light scattered inside the snowpack: a faint cool glow that keeps shaded
  // snow blue-white instead of grey, strongest on fresh (non-rock) snow.
  float snowW = 1.0 - gwfRockW;
  totalEmissiveRadiance += diffuseColor.rgb * vec3( 0.045, 0.07, 0.11 ) * snowW;
}
#endif
`;

/** Creates a world-space terrain / rock material (see file comment). */
export function createTerrainMaterial(opts: TerrainMaterialOptions): TerrainMaterialHandle {
  const ph = getPlaceholderTextures();
  const params: THREE.MeshStandardMaterialParameters = {
    color: 0xffffff,
    roughness: opts.roughness ?? 0.92,
    metalness: 0.0,
    vertexColors: !!opts.vertexColors,
    side: opts.side ?? THREE.FrontSide,
    flatShading: !!opts.flatShading,
  };
  const material: THREE.MeshStandardMaterial = opts.physical
    ? new THREE.MeshPhysicalMaterial({ ...params, ...opts.physical })
    : new THREE.MeshStandardMaterial(params);
  material.name = opts.name;
  // Rough natural surfaces: keep grazing-angle sky reflections in check
  material.envMapIntensity = opts.envMapIntensity ?? 0.75;
  if (opts.modelMaps) {
    material.normalMap = ph.flatNormal;
    // glTF normal maps (flipY = false) with derivative tangents need y flipped
    material.normalScale.set(1, -1);
    material.aoMap = ph.arm;
    material.aoMapIntensity = 0.9;
  }

  const g = opts.ground;
  const r = opts.rock;
  const scanMix = { value: 0 };
  const lavaPulse = { value: 1 };
  let scanTarget = 0;
  const uniforms: Record<string, THREE.IUniform> = {
    uGAlb: { value: ph.white },
    uGNor: { value: ph.flatNormal },
    uGArm: { value: ph.arm },
    uRAlb: { value: ph.white },
    uRNor: { value: ph.flatNormal },
    uRArm: { value: ph.arm },
    uMacroTex: { value: getMacroNoiseTexture() ?? ph.white },
    uGTile: { value: g?.tile ?? 4 },
    uRTile: { value: r?.tile ?? 6 },
    uGNs: { value: g?.normalScale ?? 1 },
    uRNs: { value: r?.normalScale ?? 1 },
    uGRough: { value: new THREE.Vector2(...(g?.roughness ?? [0.6, 1.0])) },
    uRRough: { value: new THREE.Vector2(...(r?.roughness ?? [0.55, 0.98])) },
    uGTint: { value: toLinearVec3(g?.tint, 0xffffff, g?.gain ?? 1) },
    uRTint: { value: toLinearVec3(r?.tint, 0xffffff, r?.gain ?? 1) },
    uGFall: { value: toLinearVec3(g?.fallback, 0x8a8a80) },
    uRFall: { value: toLinearVec3(r?.fallback, 0x6f6a63) },
    uSlope: { value: new THREE.Vector2(...(opts.slope ?? [0.55, 0.8])) },
    uScanMix: scanMix,
    uVcRef: { value: toLinearVec3(opts.vcRef, 0xffffff) },
    uVcRefRock: { value: toLinearVec3(opts.vcRefRock ?? opts.vcRef, 0xffffff) },
    uVcKeep: { value: opts.vcKeep ?? 0.5 },
    uMacroAmt: { value: opts.macro ?? 0.16 },
    uFallRough: { value: opts.roughness ?? 0.92 },
    uLavaColor: { value: toLinearVec3(opts.lava?.color, 0xff5a1a).multiplyScalar(opts.lava?.intensity ?? 0) },
    uLavaPulse: lavaPulse,
    uLavaCfg: { value: new THREE.Vector4(opts.lavaCover ?? 0, opts.lavaAo?.[0] ?? 0.24, opts.lavaAo?.[1] ?? 0.46, 0) },
    uBaseBlend: { value: new THREE.Vector2(...(opts.baseBlend ?? [-1e4, -1e4 + 1])) },
    uSkirt: { value: new THREE.Vector3(opts.skirt?.length ?? 1, opts.skirt?.depth ?? 0, opts.skirt?.innerX ?? 0) },
  };

  // Exposed (as on a ShaderMaterial) so preloaders such as the engine's
  // WorldStreamer can find and pre-upload the scanned textures. Built-in
  // materials ignore `material.uniforms`; the shader binds these objects in
  // onBeforeCompile below.
  (material as unknown as { uniforms: Record<string, THREE.IUniform> }).uniforms = uniforms;

  const defines: Record<string, string> = { ...fadeDefines(opts.band ?? 'near', opts.clip ?? true) };
  if (g) defines.GWF_GROUND = '';
  if (r) defines.GWF_ROCK = '';
  if (opts.modelMaps) defines.GWF_MODEL_MAPS = '';
  if (opts.lava) defines.GWF_LAVA = '';
  if (opts.snow) defines.GWF_SNOW = '';
  if (opts.vertexColors) defines.GWF_VC_ALBEDO = '';
  if (opts.vcLuma) defines.GWF_VC_LUMA = '';
  if (opts.skirt) defines.GWF_SKIRT = '';
  if (opts.baseBlend && g && r) defines.GWF_BASE_BLEND = '';
  if (opts.baseBlend && g && r && opts.groundHeightGlsl) defines.GWF_GROUND_FN = '';
  material.defines = { ...(material.defines ?? {}), ...defines };

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    bindFadeUniforms(shader.uniforms, opts.fade);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\n' + GWF_WORLDPOS_VERTEX_HEAD + 'varying vec3 vGwfWNrm;\n' + SKIRT_VERTEX_HEAD)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + SKIRT_VERTEX_BODY)
      .replace('#include <project_vertex>', '#include <project_vertex>\n' + VERTEX_BODY);
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\n' + GWF_FADE_FRAGMENT_HEAD + FRAGMENT_HEAD + (defines.GWF_GROUND_FN !== undefined ? opts.groundHeightGlsl + '\n' : '')
      )
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n' + GWF_FADE_FRAGMENT_BODY)
      .replace('#include <map_fragment>', ALBEDO_BODY)
      .replace('#include <color_fragment>', '')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n' + ROUGHNESS_BODY)
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + NORMAL_BODY)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' + LAVA_BODY);
  };
  material.customProgramCacheKey = () => 'gwf-terrain-v1';

  const updateTarget = () => {
    const needG = !!g;
    const needR = !!r;
    const okG = !needG || uniforms.uGAlb.value !== ph.white;
    const okR = !needR || uniforms.uRAlb.value !== ph.white;
    scanTarget = okG && okR ? 1 : 0;
  };

  return {
    material,
    options: opts,
    scanMix,
    lavaPulse,
    setGround(set) {
      uniforms.uGAlb.value = set?.map ?? ph.white;
      uniforms.uGNor.value = set?.normalMap ?? ph.flatNormal;
      uniforms.uGArm.value = set?.armMap ?? ph.arm;
      updateTarget();
    },
    setRock(set) {
      uniforms.uRAlb.value = set?.map ?? ph.white;
      uniforms.uRNor.value = set?.normalMap ?? ph.flatNormal;
      uniforms.uRArm.value = set?.armMap ?? ph.arm;
      updateTarget();
    },
    setModel(model) {
      if (!opts.modelMaps) return;
      material.normalMap = model?.normalMap ?? ph.flatNormal;
      material.aoMap = model?.armMap ?? ph.arm;
    },
    snap() {
      scanMix.value = scanTarget;
    },
    tick(dt: number) {
      if (scanMix.value !== scanTarget) {
        const step = dt / 0.6;
        scanMix.value = scanTarget > scanMix.value
          ? Math.min(scanTarget, scanMix.value + step)
          : Math.max(scanTarget, scanMix.value - step);
      }
    },
  };
}
