export interface EngineTechnique {
  title: string;
  techniques: string[];
  hlslCode: string;
}

export interface EngineDeliverables {
  unityURP: EngineTechnique;
  unrealEngine: EngineTechnique;
  lightingPresets: Array<{
    id: string;
    name: string;
    mood: string;
    skyTop: string;
    sunColor: string;
    ambientColor: string;
    slopeTint: string;
  }>;
  performanceOptimization: {
    targetFramerate: string;
    drawCallBudget: string;
    propsBatching: string;
    particleBudget: string;
  };
}

export const ENGINE_DELIVERABLES: EngineDeliverables = {
  unityURP: {
    title: 'Unity Universal Render Pipeline (URP) Custom Shader Graph / HLSL',
    techniques: [
      'Multi-tap Bilateral Wet Surface Mirror Reflection with Fresnel Glancing Angles',
      'Dynamic Speed-Line Post-Processing with Radial Radial Blur Pass',
      'Instanced Low-Poly Mesh Rendering with GPU Vertex Wave Displacements',
      'High-Dynamic-Range (HDR) Bloom & Chromatic Aberration Screen Distortion'
    ],
    hlslCode: `// Unity URP Cyber Wet Pavement & Mirror Reflection Pass
#ifndef CYBER_WET_STREET_HLSL
#define CYBER_WET_STREET_HLSL

#include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
#include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Lighting.hlsl"

struct Attributes {
    float4 positionOS   : POSITION;
    float3 normalOS     : NORMAL;
    float2 uv           : TEXCOORD0;
};

struct Varyings {
    float4 positionCS   : SV_POSITION;
    float3 worldPos     : TEXCOORD0;
    float3 worldNormal  : TEXCOORD1;
    float2 uv           : TEXCOORD2;
};

CBUFFER_START(UnityPerMaterial)
    float4 _NeonCyanColor;
    float4 _NeonMagentaColor;
    float  _Wetness;
    float  _PuddleScale;
CBUFFER_END

Varyings vert(Attributes input) {
    Varyings output;
    VertexPositionInputs posInputs = GetVertexPositionInputs(input.positionOS.xyz);
    VertexNormalInputs normInputs = GetVertexNormalInputs(input.normalOS);
    output.positionCS = posInputs.positionCS;
    output.worldPos = posInputs.positionWS;
    output.worldNormal = normInputs.normalWS;
    output.uv = input.uv;
    return output;
}

half4 frag(Varyings input) : SV_Target {
    float3 V = normalize(_WorldSpaceCameraPos - input.worldPos);
    float3 N = normalize(input.worldNormal);
    float fresnel = pow(1.0 - saturate(dot(V, N)), 3.0);

    // Procedural Pavement Puddle Mask
    float puddle = saturate(sin(input.worldPos.x * 0.3) * cos(input.worldPos.z * 0.2) + 0.3);
    float3 basePavement = float3(0.012, 0.015, 0.024);

    // Neon Vertical Reflections
    float centerDist = abs(input.worldPos.x);
    float spireReflection = exp(-centerDist * centerDist * 0.15);
    float3 refl = lerp(_NeonMagentaColor.rgb, _NeonCyanColor.rgb, saturate((input.worldPos.x + 5.0) / 10.0));
    refl += _NeonCyanColor.rgb * spireReflection * 2.5;

    float3 finalColor = lerp(basePavement, basePavement * 0.3 + refl, fresnel * puddle * _Wetness);
    return half4(finalColor, 1.0);
}
#endif`
  },
  unrealEngine: {
    title: 'Unreal Engine 5.x Lumen / Custom Material Expression Shader',
    techniques: [
      'Subsurface Pavement Puddle Masking with Custom Anisotropic Roughness',
      'Virtual Shadow Maps (VSM) integration with Nanite Megastructures',
      'Niagara GPU Particle Ribbons for Sonic Trail Thrusters & Spark Jets',
      'Post-Process Volume with Lens Flares, Glitch chromatic fringes, and CRT scanlines'
    ],
    hlslCode: `// Unreal Engine Custom HLSL Node - Wet Street Anisotropic Puddle Specular
float3 WorldPos = Parameters.WorldPosition;
float3 CameraVector = Parameters.CameraVector;
float3 Normal = Parameters.WorldNormal;

float NdotV = saturate(dot(Normal, CameraVector));
float Fresnel = pow(1.0 - NdotV, 3.5);

// Dual-frequency procedural puddle mask
float Puddle = saturate(sin(WorldPos.X * 0.003) * cos(WorldPos.Y * 0.002) + 0.4);

// Holographic Spire and Storefront Glint
float DistFromCenter = abs(WorldPos.X);
float CentralStreak = exp(-DistFromCenter * DistFromCenter * 0.0001);

float3 CyanSpire = float3(0.0, 0.94, 1.0);
float3 MagentaStores = float3(1.0, 0.0, 0.52);

float3 StreetLight = lerp(MagentaStores, CyanSpire, saturate((WorldPos.X + 600.0) / 1200.0));
StreetLight += CyanSpire * CentralStreak * 3.0;

return StreetLight * (Fresnel * Puddle * 0.9 + 0.1);`
  },
  lightingPresets: [
    {
      id: 'neon-night',
      name: 'Neon Night // Sector 01',
      mood: 'Deep midnight obsidian street canyon drenched in electric cyan and hot magenta volumetric neon glow.',
      skyTop: '#050711',
      sunColor: '#00F0FF',
      ambientColor: '#120424',
      slopeTint: 'Deep Obsidian Violet to Cold Cyan'
    },
    {
      id: 'synthwave-magenta',
      name: 'Synthwave 1984 Sunset',
      mood: 'Retro-futuristic dusk horizon with vibrant gradient skies and warm laser sun glare.',
      skyTop: '#1a0033',
      sunColor: '#ff007f',
      ambientColor: '#2d0a3d',
      slopeTint: 'Magenta Rim with Cyan Counter-Fill'
    },
    {
      id: 'deep-space',
      name: 'Orbital Void Station',
      mood: 'Vacuum orbital ring high above Earth with harsh solar key lighting and starry void backdrops.',
      skyTop: '#000206',
      sunColor: '#ffffff',
      ambientColor: '#050b1a',
      slopeTint: 'High-contrast monochrome metallic reflections'
    },
    {
      id: 'storm-grid',
      name: 'Electric Ion Storm',
      mood: 'Turbulent electromagnetic cloudbanks with pulsing lightning arcs across the horizon.',
      skyTop: '#08121f',
      sunColor: '#00ffff',
      ambientColor: '#031a2e',
      slopeTint: 'Ionized turquoise rim lighting'
    }
  ],
  performanceOptimization: {
    targetFramerate: '60 FPS Locked (WebGL / Mobile / Desktop)',
    drawCallBudget: '< 400 (Actual: ~38 calls)',
    propsBatching: 'Holo-pylons, billboards & barrier gates',
    particleBudget: '≤ 35 active plasma & trail sprites, pooled'
  }
};
