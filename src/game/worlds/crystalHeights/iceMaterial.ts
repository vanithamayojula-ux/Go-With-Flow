import * as THREE from 'three';
import { getMacroNoiseTexture } from '../shared/noiseTextures';

/**
 * Glacial ice / quartz shading on top of a MeshPhysicalMaterial that already
 * carries the stream fade (applyStreamFade declares the world-position
 * varying vGwfWPos used here).
 *
 * Real ice is never a uniform bright prism: bubbles, fractures and varying
 * thickness give it patchy colour (deep blue where it is thick and clear,
 * milky white where it is fractured or frosted) and a surface whose gloss
 * changes from wet-polished to frosted. Both come from world-space noise, so
 * every instance differs without textures or UVs. No emission is added; the
 * look comes from the environment reflection, clearcoat and diffuse.
 */
export interface IceShadingOptions {
  /** Linear colour of thick, clear ice (multiplies the albedo). */
  deep: THREE.ColorRepresentation;
  /** Roughness range [polished, frosted]. */
  roughness: [number, number];
  /** World-space noise frequency (1 / metres). */
  scale?: number;
}

const ICE_HEAD = /* glsl */ `
uniform sampler2D uIceNoise;
uniform vec3 uIceDeep;
uniform vec3 uIceRough;
float gwfIceV;
float gwfIceF;
`;

// After #include <color_fragment>
const ICE_COLOR = /* glsl */ `
{
  vec3 ip = vGwfWPos * uIceRough.z;
  float n1 = texture2D( uIceNoise, ip.xz + vec2( ip.y * 0.61, ip.y * 0.37 ) ).r;
  float n2 = texture2D( uIceNoise, vec2( ip.x + ip.z, ip.y ) * 2.7 + 0.31 ).g;
  gwfIceV = clamp( n1 * 0.65 + n2 * 0.35, 0.0, 1.0 );
  // Fracture / bubble planes: thin milky bands
  gwfIceF = smoothstep( 0.035, 0.0, abs( n2 - 0.5 ) ) * 0.6;
  vec3 tone = mix( uIceDeep, vec3( 1.0 ), smoothstep( 0.3, 0.78, gwfIceV ) );
  diffuseColor.rgb *= mix( tone, vec3( 1.0 ), gwfIceF );
}
`;

// After #include <roughnessmap_fragment>
const ICE_ROUGH = /* glsl */ `
roughnessFactor = mix( uIceRough.x, uIceRough.y, clamp( smoothstep( 0.35, 0.8, gwfIceV ) * 0.75 + gwfIceF, 0.0, 1.0 ) );
`;

export function applyIceShading<T extends THREE.MeshPhysicalMaterial>(material: T, opts: IceShadingOptions): T {
  const prev = material.onBeforeCompile;
  const prevKey = material.customProgramCacheKey.bind(material);
  const deep = new THREE.Color(opts.deep);
  const uniforms = {
    uIceNoise: { value: getMacroNoiseTexture() },
    uIceDeep: { value: new THREE.Vector3(deep.r, deep.g, deep.b) },
    uIceRough: { value: new THREE.Vector3(opts.roughness[0], opts.roughness[1], opts.scale ?? 0.045) },
  };
  material.onBeforeCompile = (shader, renderer) => {
    prev.call(material, shader, renderer);
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + ICE_HEAD)
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + ICE_COLOR)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n' + ICE_ROUGH);
  };
  material.customProgramCacheKey = () => prevKey() + '|gwf-ice-v1';
  if (!uniforms.uIceNoise.value) material.onBeforeCompile = prev;
  return material;
}
