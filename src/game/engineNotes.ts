/**
 * Art Asset Deliverables & Engine-Specific Implementation Notes
 * Provides production-ready Unity URP Shader Graph / HLSL, Unreal Engine USF / WPO notes,
 * Lighting Presets, LUT tables, and Performance Budgets.
 */

export const ENGINE_DELIVERABLES = {
  overview: {
    title: 'Skyflow: Endless Planet Surf — Ghibli Nature & Graphics Specification',
    targetFPS: '60 FPS (mid-range mobile & desktop)',
    styleAesthetic: 'Hand-painted, layered nature, cinematic framing with nostalgic Ghibli warmth',
    paletteRanges: [
      { name: 'Sky Base Gradient', hex: '#7EC8FF → #5EB0FF', desc: 'Layered atmospheric depth' },
      { name: 'Midground Hills', hex: '#8DC99B → #6FB07E', desc: 'Soft pastel meadow turf' },
      { name: 'Accent Foliage', hex: '#3D8A3D → #7FE08A', desc: 'Stylized brush stroke tufts' },
      { name: 'Sunlight Highlight', hex: '#F7D6A5', desc: 'Golden-hour warm rim and sun wash' },
    ],
  },

  unityURP: {
    title: 'Unity 2022+ / 6 Universal Render Pipeline (URP)',
    techniques: [
      'Custom Shader Graph with Vertex Position input for procedural sine wind displacement',
      'GPU Instancing enabled on Material Property Block for zero CPU batch overhead',
      'Volume Profile with Bloom (Threshold 0.82, Soft Knee 0.45), Film Grain (Type: Thin, Intensity 0.035), Tonemapping (Neutral/ACES custom soft curve)',
      'Subsurface Scattering approximation in custom Lighting function (Translucency slider 0.35)',
    ],
    hlslCode: `// Unity URP HLSL SubShader snippet for Vertex Wind & Painterly Rim Light
void FoliageVertexWind_float(
    float3 PositionOS,
    float2 UV,
    float3 WorldPos,
    float WindStrength,
    float WindSpeed,
    float Time,
    out float3 OutPositionOS
) {
    // Foliage root pinned (UV.y = 0), top blades sway (UV.y = 1)
    float bendFactor = UV.y * UV.y;
    float wave = sin(Time * WindSpeed * 2.8 + WorldPos.x * 0.4 + WorldPos.z * 0.3)
               + 0.5 * sin(Time * WindSpeed * 4.2 + WorldPos.z * 0.7);
    
    float3 displacement = float3(wave * 0.45 * WindStrength, 0.0, wave * 0.25 * WindStrength) * bendFactor;
    OutPositionOS = PositionOS + displacement;
}

void PainterlyCelRim_float(
    float3 WorldNormal,
    float3 WorldView,
    float3 LightDir,
    float3 LightColor,
    float RimThreshold,
    float RimSharpness,
    out float3 OutRimColor
) {
    float rim = 1.0 - saturate(dot(WorldView, WorldNormal));
    rim = smoothstep(RimThreshold, RimThreshold + RimSharpness, rim);
    float lightMask = saturate(dot(WorldNormal, LightDir) + 0.2);
    OutRimColor = LightColor * (rim * lightMask);
}`,
  },

  unrealEngine: {
    title: 'Unreal Engine 5.x Material & ISM Setup',
    techniques: [
      'World Position Offset (WPO) node tree driven by SimpleGrassWind and custom sine phase math',
      'Hierarchical Instanced Static Mesh (HISM) with 3 LOD levels + Billboard cross-quad imposter',
      'Post Process Volume: Film Grain Intensity 0.03, Bloom Convolution/Standard, Color Grading Highlights Tint (#FFF3DC) & Shadows Tint (#D4E6F8)',
      'Shading Model: Two-Sided Foliage with Subsurface Color linked to golden-green tint',
    ],
    hlslCode: `// Unreal Engine 5 Custom HLSL / WPO Expression
// Inputs: WorldPos, WindSpeed, WindIntensity, HeightMask (0 at ground, 1 at tip)
float3 WindDir = normalize(float3(0.8, 0.0, 0.4));
float Wave = sin((Time * WindSpeed) + (WorldPos.x * 0.01) + (WorldPos.y * 0.01));
float MicroWave = sin((Time * WindSpeed * 2.2) + (WorldPos.z * 0.02));
float Combined = (Wave + MicroWave * 0.5) * WindIntensity * pow(HeightMask, 2.0);

return WindDir * Combined;`,
  },

  lightingPresets: [
    {
      id: 'golden-hour',
      name: 'Golden Hour (Sunset Warmth)',
      skyTop: '#4B94E6',
      skyHorizon: '#FCD8B8',
      sunColor: '#F7D6A5',
      ambientColor: '#8DB8E8',
      mood: 'Nostalgic, warm, long amber shadows, peaceful evening surfing',
      slopeTint: 'Sunlit faces warm apricot (#F7D6A5); shaded slopes soft sage (#6FB07E)',
    },
    {
      id: 'morning',
      name: 'Morning Meadow (Fresh Dawn)',
      skyTop: '#5B8FE8',
      skyHorizon: '#FFDEBD',
      sunColor: '#FFE0A3',
      ambientColor: '#9AC0ED',
      mood: 'Crisp morning dew, gentle lilac-gold horizon, high clarity',
      slopeTint: 'Sunlit faces soft cream (#FEE0B6); shaded slopes emerald teal (#6EAD80)',
    },
    {
      id: 'bright-day',
      name: 'Bright Day (Vibrant Azure)',
      skyTop: '#3582EB',
      skyHorizon: '#BDE6FD',
      sunColor: '#FFF8E7',
      ambientColor: '#A3D2F7',
      mood: 'Vibrant studio blue, crisp puffy white cumulus, high-contrast silhouettes',
      slopeTint: 'Sunlit faces sunny pale (#FCE7C5); shaded slopes cool pine-green (#65A976)',
    },
  ],

  performanceBudgets: {
    target60fps: {
      drawCalls: '< 800 draw calls per frame (actual: ~45 with GPU instancing)',
      vegetationInstances: 'Up to 2,000 instanced grass quads + 250 trees per active terrain radius',
      particleCount: '≤ 30 active jump/carve dust sprites, strictly pooled with zero garbage allocation',
      memoryProfile: '< 150 MB VRAM footprint with procedural texture atlases',
      lodStreaming: '3 LOD tiers (LOD0 dense cross-quad, LOD1 single quad, LOD2 billboard) + distance culling at 180m',
    },
  },
};
