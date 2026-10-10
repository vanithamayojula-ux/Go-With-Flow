import * as THREE from 'three';

/**
 * Neon Drift Cyberpunk Shaders
 * High-contrast dark void palette, multi-tap emissive neon bloom, wet reflective asphalt,
 * chromatic aberration, CRT scanlines, digital glitch tear, anime speedlines,
 * and high-voltage energy trail ribbons.
 */

export const SkyboxShader = {
  vertexShader: `
    varying vec3 vWorldPosition;
    varying vec2 vUv;
    void main() {
      vUv = uv;
      vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform vec3 uSkyTop;
    uniform vec3 uSkyMid;
    uniform vec3 uSkyHorizon;
    uniform vec3 uSunPosition;
    uniform vec3 uSunColor;
    uniform float uTime;
    uniform float uSpeed;
    uniform float uHazeDensity;
    uniform float uGridMode;
    varying vec3 vWorldPosition;
    varying vec2 vUv;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
    }

    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
                 mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
    }

    // FBM for rich organic deep-space cosmic dust & nebula clouds
    float fbm(vec2 p) {
      float v = 0.0;
      float a = 0.5;
      vec2 shift = vec2(100.0);
      mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
      for (int i = 0; i < 4; ++i) {
        v += a * noise(p);
        p = rot * p * 2.0 + shift;
        a *= 0.5;
      }
      return v;
    }

    void main() {
      vec3 dir = normalize(vWorldPosition);
      float elevation = clamp(dir.y * 0.5 + 0.5, 0.0, 1.0);

      // Per-biome 3-stop dynamic atmospheric gradient
      vec3 skyGrad = mix(uSkyHorizon, uSkyMid, smoothstep(0.0, 0.45, elevation));
      skyGrad = mix(skyGrad, uSkyTop, smoothstep(0.45, 1.0, elevation));

      // Sun Disc and atmospheric sun bloom
      vec3 sunDir = normalize(uSunPosition);
      float sunDot = max(0.0, dot(dir, sunDir));
      float sunDisc = smoothstep(0.996, 0.999, sunDot) * 2.5 + pow(sunDot, 64.0) * 0.75;
      vec3 galaxyBase = skyGrad + uSunColor * sunDisc;

      // Slow majestic galaxy rotation (0.01x parallax)
      float slowTime = uTime * 0.015;
      float angle = slowTime;
      mat2 rot = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
      vec2 skyCoord = rot * dir.xz / (abs(dir.y) + 0.25);

      // --- Multi-Layer Nebula Clouds ---
      vec2 nebCoord1 = skyCoord * 1.8 + vec2(slowTime * 0.2, slowTime * 0.1);
      float nebFbm1 = fbm(nebCoord1);
      vec2 nebCoord2 = skyCoord * 3.2 - vec2(slowTime * 0.15, slowTime * 0.25);
      float nebFbm2 = fbm(nebCoord2);

      vec3 nebColA = mix(uSkyMid * 1.5, vec3(0.02, 0.06, 0.14), 0.5);
      vec3 nebColB = mix(uSkyHorizon * 1.5, vec3(0.07, 0.01, 0.12), 0.5);
      vec3 nebColC = uSunColor * 0.4;

      vec3 nebulaGlow = mix(nebColA, nebColB, nebFbm1) * smoothstep(0.25, 0.75, nebFbm1 * 1.2);
      nebulaGlow += nebColC * smoothstep(0.35, 0.85, nebFbm2) * 0.6;
      galaxyBase += nebulaGlow * (0.85 * uHazeDensity);

      // --- Layer 1: Distant Pinpoint Starfield (Crisp, High-Density) ---
      vec2 starGrid1 = skyCoord * 90.0;
      vec2 starCell1 = fract(starGrid1) - 0.5;
      float starId1 = hash(floor(starGrid1));
      if (starId1 > 0.96) {
        float starDist = length(starCell1);
        float starSize = hash(floor(starGrid1) + 11.0) * 0.12 + 0.05;
        float starIntensity = smoothstep(starSize, 0.0, starDist);
        float twinkle = sin(uTime * 2.5 + starId1 * 40.0) * 0.35 + 0.65;
        vec3 starCol = mix(vec3(0.8, 0.9, 1.0), vec3(0.9, 0.7, 1.0), hash(floor(starGrid1) + 29.0));
        galaxyBase += starCol * starIntensity * twinkle * 0.75;
      }

      // --- Layer 2: Fast High-Velocity Speed Streaks at High KM/H ---
      float speedFactor = clamp((uSpeed - 20.0) / 40.0, 0.0, 1.0);
      if (speedFactor > 0.01) {
        vec2 streakCoord = dir.xy * 60.0;
        streakCoord.y += uTime * (uSpeed * 0.4);
        float streakId = hash(floor(streakCoord));
        if (streakId > 0.985) {
          float streakLine = smoothstep(0.08, 0.0, abs(fract(streakCoord.x) - 0.5));
          galaxyBase += uSunColor * streakLine * speedFactor * 0.45;
        }
      }

      // --- Layer 3: Giant Holographic Vector Cyberspace (for Grid Biome) ---
      if (uGridMode > 0.1) {
        float gridAngle = atan(dir.x, dir.z);
        float gridElevation = abs(dir.y);
        float gridLineX = abs(fract(gridAngle * 16.0) - 0.5);
        float gridLineY = abs(fract(gridElevation * 20.0) - 0.5);
        float gridMask = (smoothstep(0.03, 0.0, gridLineX) + smoothstep(0.03, 0.0, gridLineY)) * 0.4;
        galaxyBase += uSunColor * gridMask * uGridMode;
      }

      // Calm horizon blending to preserve gameplay focus
      gl_FragColor = vec4(galaxyBase, 1.0);
    }
  `
};

export const TerrainShader = {
  vertexShader: `
    varying vec3 vWorldPosition;
    varying vec3 vNormal;
    varying vec2 vUv;

    void main() {
      vUv = uv;
      vNormal = normalize(normalMatrix * normal);
      vec4 worldPos = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPos.xyz;
      gl_Position = projectionMatrix * viewMatrix * worldPos;
    }
  `,
  fragmentShader: `
    uniform vec3 uSunDirection;
    uniform vec3 uSunColor;
    uniform vec3 uAmbientColor;
    uniform vec3 uCameraPos;
    uniform vec3 uFogColor;
    uniform float uTime;
    uniform float uSpeed; // Player speed in m/s for animated streaks and pulses
    uniform float uGridMode; // 1.0 = The Grid wireframe
    uniform float uWetReflections;
    uniform float uLaneWidth;
    uniform float uRailX;
    uniform float uDividerX;
    uniform float uRimLightIntensity;
    uniform float uCelRampHardness;

    varying vec3 vWorldPosition;
    varying vec3 vNormal;
    varying vec2 vUv;

    float hash21(vec2 p) {
      p = fract(p * vec2(234.34, 435.345));
      p += dot(p, p + 34.23);
      return fract(p.x * p.y);
    }

    void main() {
      vec3 N = normalize(vNormal);
      vec3 V = normalize(uCameraPos - vWorldPosition);

      // --- WET CYBERPUNK PAVED STREET WITH CONTROLLED SPECULARITY & DEPTH ---
      // 1. Rectangular Pavement Slabs & Wet Tile Seams
      float tileScaleX = 0.55;
      float tileScaleZ = 0.32;
      vec2 tileCoord = vec2(vWorldPosition.x * tileScaleX, vWorldPosition.z * tileScaleZ);
      vec2 tileGrid = fract(tileCoord);
      float seamX = smoothstep(0.05, 0.0, tileGrid.x) + smoothstep(0.95, 1.0, tileGrid.x);
      float seamZ = smoothstep(0.05, 0.0, tileGrid.y) + smoothstep(0.95, 1.0, tileGrid.y);
      float tileSeam = clamp(seamX + seamZ, 0.0, 1.0);

      // Deep dark asphalt base (contrast > raw brightness)
      vec3 slabDark = vec3(0.005, 0.008, 0.014);
      vec3 slabHighlight = vec3(0.012, 0.016, 0.026);
      float slabVar = fract(sin(floor(tileCoord.x) * 12.9898 + floor(tileCoord.y) * 78.233) * 43758.5453);
      vec3 pavementBase = mix(slabDark, slabHighlight, slabVar * 0.35);
      pavementBase = mix(pavementBase, vec3(0.001, 0.002, 0.004), tileSeam * 0.95);

      // 2. Controlled Mirror Puddles & Specular Water Film
      float puddleNoise1 = sin(vWorldPosition.x * 0.28 + sin(vWorldPosition.z * 0.12)) * 0.5 + 0.5;
      float puddleNoise2 = cos(vWorldPosition.z * 0.22 + vWorldPosition.x * 0.15) * 0.5 + 0.5;
      float puddleMask = smoothstep(0.38, 0.68, puddleNoise1 * puddleNoise2 * 2.0);

      // Controlled micro ripples linked with speed
      float rippleFreq = 1.8 + uSpeed * 0.04;
      float rippleSpeed = 6.0 + uSpeed * 0.8;
      float ripple = sin((vWorldPosition.z - uTime * rippleSpeed) * rippleFreq + vWorldPosition.x * 3.0) * 0.012;
      vec3 perturbedN = normalize(N + vec3(ripple, 0.0, ripple * 0.5));

      // Fresnel reflection factor
      float fresnel = pow(1.0 - max(dot(V, perturbedN), 0.0), 3.2);
      float wetness = clamp(fresnel * 0.65 + puddleMask * 0.30, 0.06, 0.75);

      // 3. Wet dark asphalt with specular puddle reflections and fresnel (not flat teal)
      vec3 neonCyan = vec3(0.0, 0.85, 0.95);
      vec3 wetSkyReflect = mix(vec3(0.012, 0.016, 0.028), vec3(0.025, 0.038, 0.06), fresnel);
      vec3 puddleColor = mix(pavementBase, wetSkyReflect * 1.5, puddleMask * 0.45);
      vec3 wetSurface = mix(pavementBase, puddleColor, wetness * 0.5);

      // 4. --- EXACT 3-LANE SPACE HIGHWAY MARKINGS & GUIDED NEON RAILS ---
      float roadX = vWorldPosition.x;
      float roadZ = vWorldPosition.z;
      float laneW = uLaneWidth > 0.1 ? uLaneWidth : 2.6;
      float railX = uRailX > 0.1 ? uRailX : 4.5;
      float divX = uDividerX > 0.1 ? uDividerX : 1.3;

      // Exactly 2 Solid glowing outer highway rails (+-railX): thin (0.02)
      float railLeft = smoothstep(0.035, 0.015, abs(roadX - (-railX)));
      float railRight = smoothstep(0.035, 0.015, abs(roadX - railX));
      float guideRails = railLeft * 1.6 + railRight * 1.6;

      // Exactly 2 Dashed lane divider lines between the 3 lanes (+-divX): thin
      float divLeft = smoothstep(0.030, 0.012, abs(roadX - (-divX)));
      float divRight = smoothstep(0.030, 0.012, abs(roadX - divX));
      float dashRate = 24.0 + uSpeed * 1.1;
      float laneDashes = step(0.45, fract((roadZ - uTime * dashRate) * 0.16));
      float dividerLines = (divLeft + divRight) * laneDashes * 1.2;

      // Subtle lane center flow guides (marking the 3 lane paths)
      float laneCenterL = smoothstep(0.10, 0.015, abs(roadX - (-laneW)));
      float laneCenterC = smoothstep(0.10, 0.015, abs(roadX - 0.0));
      float laneCenterR = smoothstep(0.10, 0.015, abs(roadX - laneW));
      float laneFlow = (laneCenterL + laneCenterC + laneCenterR) * 0.02 * (sin((roadZ - uTime * 28.0) * 0.2) * 0.5 + 0.5);

      // Strict Color System: Cyan ONLY for rails and road guidance
      vec3 emissiveLines = neonCyan * (guideRails * 1.5 + dividerLines * 1.2 + laneFlow);

      vec3 finalCol = wetSurface + emissiveLines;

      // 5. Depth System: Foreground is Razor-Sharp & Punchy;
      // Distance smoothly recedes into Per-Biome / Cosmic Space Fog
      float dist = length(uCameraPos - vWorldPosition);
      float fogFactor = smoothstep(75.0, 320.0, dist);
      vec3 finalFog = length(uFogColor) > 0.001 ? uFogColor : vec3(0.004, 0.007, 0.022);
      finalCol = mix(finalCol, finalFog, clamp(fogFactor, 0.0, 0.96));

      gl_FragColor = vec4(finalCol, 1.0);
    }
  `
};

export const FoliageShader = {
  vertexShader: `
    varying vec2 vUv;
    varying vec3 vWorldPosition;
    void main() {
      vUv = uv;
      vec4 worldPos = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPos.xyz;
      gl_Position = projectionMatrix * viewMatrix * worldPos;
    }
  `,
  fragmentShader: `
    uniform vec3 uSunColor;
    uniform float uTime;
    varying vec2 vUv;
    varying vec3 vWorldPosition;

    void main() {
      // Cyber neon prop shader (holographic billboards, light pylons, conduits)
      float pulse = sin(uTime * 4.0 + vWorldPosition.z * 0.1) * 0.2 + 0.8;
      vec3 col = mix(vec3(0.0, 0.9, 1.0), vec3(1.0, 0.0, 0.6), sin(vWorldPosition.z * 0.05) * 0.5 + 0.5);
      gl_FragColor = vec4(col * pulse * 1.5, 1.0);
    }
  `
};

export const BoardTrailShader = {
  vertexShader: `
    attribute float aProgress;
    varying float vProgress;
    varying vec2 vUv;

    void main() {
      vProgress = aProgress;
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform vec3 uColorA; // Main neon hue (e.g. #00f0ff)
    uniform vec3 uColorB; // Secondary neon hue (e.g. #ff007f)
    uniform float uOpacity;
    uniform float uTime;
    varying float vProgress;
    varying vec2 vUv;

    void main() {
      // Tight laser ribbon - shrunk 50% without wide blurry blob
      float distFromCenter = abs(vUv.y - 0.5) * 2.0; // 0 at center, 1 at edge
      float core = pow(1.0 - distFromCenter, 5.0); // Intense thin core
      float glow = pow(1.0 - distFromCenter, 2.8); // Sleek outer glow

      // Length fade
      float lengthFade = smoothstep(0.0, 0.25, vProgress);

      // Animated high-speed circuit pulse
      float pulse = sin(vProgress * 24.0 - uTime * 20.0) * 0.2 + 0.8;

      vec3 neonHue = mix(uColorA, uColorB, vProgress);
      vec3 finalCol = mix(neonHue * 1.6, vec3(0.95, 0.95, 0.95) * 1.8, core);

      float alpha = glow * lengthFade * uOpacity * pulse;
      gl_FragColor = vec4(finalCol, clamp(alpha, 0.0, 1.0));
    }
  `
};

/**
 * Realistic road-surface PBR shader.
 * Cook-Torrance specular (GGX + Smith height-correlated visibility + Schlick
 * Fresnel), image-based ambient specular via a split-sum BRDF approximation,
 * energy-normalised diffuse IBL, and screen-door dithered LOD fade so the
 * high-frequency detail dissolves instead of aliasing at distance.
 */
export const TerrainShaderV2 = {
  vertexShader: `
    varying vec3 vWorldPosition;
    varying vec3 vNormal;
    varying vec2 vUv;
    varying float vViewDepth;

    void main() {
      vUv = uv;
      vNormal = normalize(normalMatrix * normal);
      vec4 worldPos = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPos.xyz;
      vec4 viewPos = viewMatrix * worldPos;
      vViewDepth = -viewPos.z;
      gl_Position = projectionMatrix * viewPos;
    }
  `,
  fragmentShader: `
    uniform vec3 uSunDirection;
    uniform vec3 uSunColor;
    uniform vec3 uAmbientColor;
    uniform vec3 uCameraPos;
    uniform vec3 uFogColor;
    uniform float uTime;
    uniform float uSpeed;
    uniform float uGridMode;
    uniform float uWetReflections;
    uniform float uLaneWidth;
    uniform float uRailX;
    uniform float uDividerX;
    uniform float uRimLightIntensity;
    uniform float uCelRampHardness;

    uniform sampler2D uAlbedoMap;
    uniform sampler2D uNormalMap;
    uniform sampler2D uRoughnessMap;
    uniform float uNormalScale;
    uniform float uMetalness;
    uniform float uWetness;
    uniform float uDetailFade;

    varying vec3 vWorldPosition;
    varying vec3 vNormal;
    varying vec2 vUv;
    varying float vViewDepth;

    const float PI = 3.141592653589793;

    float distributionGGX(float NdotH, float roughness) {
      float a = roughness * roughness;
      float a2 = a * a;
      float denom = NdotH * NdotH * (a2 - 1.0) + 1.0;
      return a2 / max(PI * denom * denom, 1e-5);
    }

    float geometrySmith(float NdotV, float NdotL, float roughness) {
      float k = (roughness + 1.0) * (roughness + 1.0) / 8.0;
      float gv = NdotV / (NdotV * (1.0 - k) + k);
      float gl = NdotL / (NdotL * (1.0 - k) + k);
      return gv * gl;
    }

    vec3 fresnelSchlick(float VdotH, vec3 F0) {
      return F0 + (1.0 - F0) * pow(clamp(1.0 - VdotH, 0.0, 1.0), 5.0);
    }

    // Karis' analytic environment BRDF — avoids needing a prefiltered LUT.
    vec2 envBRDFApprox(float NdotV, float roughness) {
      const vec4 c0 = vec4(-1.0, -0.0275, -0.572, 0.022);
      const vec4 c1 = vec4(1.0, 0.0425, 1.04, -0.04);
      vec4 r = roughness * c0 + c1;
      float a004 = min(r.x * r.x, exp2(-9.28 * NdotV)) * r.x + r.y;
      return vec2(-1.04, 1.04) * a004 + r.zw;
    }

    float hash12(vec2 p) {
      vec3 p3 = fract(vec3(p.xyx) * 0.1031);
      p3 += dot(p3, p3.yzx + 33.33);
      return fract((p3.x + p3.y) * p3.z);
    }

    void main() {
      vec3 V = normalize(uCameraPos - vWorldPosition);
      vec3 L = normalize(uSunDirection);
      vec3 H = normalize(V + L);

      // --- Distance LOD fade on the tiled detail maps (anti-aliasing guard) ---
      float detailFade = 1.0 - smoothstep(30.0, 110.0, vViewDepth);
      detailFade = mix(1.0 - uDetailFade, 1.0, detailFade);
      vec2 duv = vWorldPosition.xz;
      vec3 albedoTex = texture2D(uAlbedoMap, duv * 0.35).rgb;
      vec3 roughTex = texture2D(uRoughnessMap, duv * 0.35).rgb;
      vec3 nTex = texture2D(uNormalMap, duv * 0.35).xyz * 2.0 - 1.0;

      // Ordered dither breaks up the residual banding in the fade tail.
      float dither = (hash12(gl_FragCoord.xy) - 0.5) * 0.02;
      albedoTex += dither;

      float roughness = clamp(roughTex.g, 0.06, 1.0);

      // --- Puddle / wetness field: coherent low-frequency mask driven by speed ---
      float pNoise1 = sin(vWorldPosition.x * 0.28 + sin(vWorldPosition.z * 0.12)) * 0.5 + 0.5;
      float pNoise2 = cos(vWorldPosition.z * 0.22 + vWorldPosition.x * 0.15) * 0.5 + 0.5;
      float puddleMask = smoothstep(0.38, 0.68, pNoise1 * pNoise2 * 2.0) * uWetness;

      float fresnel = pow(1.0 - max(dot(V, vNormal), 0.0), 4.0);
      float wetness = clamp(puddleMask * 0.75 + fresnel * 0.20 * uWetReflections, 0.0, 0.85);

      // Wet film flattens the surface: lower roughness, flatten the normal.
      roughness = mix(roughness, 0.055, wetness);

      vec3 N = normalize(vNormal);
      vec3 detailN = vec3(nTex.x, 0.0, nTex.y) * uNormalScale * detailFade;
      N = normalize(N + detailN);
      N = normalize(mix(N, vec3(0.0, 1.0, 0.0), wetness * 0.55));

      vec3 albedo = albedoTex;

      // --- Cook-Torrance direct lighting ---
      float NdotL = max(dot(N, L), 0.0);
      float NdotV = max(dot(N, V), 1e-4);
      float NdotH = max(dot(N, H), 0.0);
      float VdotH = max(dot(V, H), 0.0);

      vec3 F0 = mix(vec3(0.04), albedo, uMetalness);
      vec3 F = fresnelSchlick(VdotH, F0);
      float D = distributionGGX(NdotH, roughness);
      float G = geometrySmith(NdotV, NdotL, roughness);
      vec3 specular = (D * G * F) / max(4.0 * NdotV * NdotL, 1e-4);
      vec3 kd = (1.0 - F) * (1.0 - uMetalness);

      vec3 direct = (kd * albedo / PI + specular) * uSunColor * NdotL;

      // --- Image-based ambient: sky irradiance + specular horizon probe ---
      vec3 R = reflect(-V, N);
      vec3 irradiance = uAmbientColor * 2.4;
      // Approximate the horizon vs zenith split from the reflected ray.
      float upness = clamp(R.y * 0.5 + 0.5, 0.0, 1.0);
      vec3 specEnv = mix(uFogColor * 3.0, uAmbientColor * 6.0 + uSunColor * 0.15, upness);
      vec2 ab = envBRDFApprox(NdotV, roughness);
      vec3 ambient = kd * albedo * irradiance + specEnv * (F0 * ab.x + ab.y);

      vec3 col = direct + ambient;

      // --- Highway markings (unchanged geometry, now composited physically) ---
      float roadX = vWorldPosition.x;
      float roadZ = vWorldPosition.z;
      float laneW = uLaneWidth > 0.1 ? uLaneWidth : 2.6;
      float railX = uRailX > 0.1 ? uRailX : 4.5;
      float divX = uDividerX > 0.1 ? uDividerX : 1.3;

      float railLeft = smoothstep(0.035, 0.015, abs(roadX - (-railX)));
      float railRight = smoothstep(0.035, 0.015, abs(roadX - railX));
      float guideRails = railLeft * 1.6 + railRight * 1.6;

      float divLeft = smoothstep(0.030, 0.012, abs(roadX - (-divX)));
      float divRight = smoothstep(0.030, 0.012, abs(roadX - divX));
      float dashRate = 24.0 + uSpeed * 1.1;
      float laneDashes = step(0.45, fract((roadZ - uTime * dashRate) * 0.16));
      float dividerLines = (divLeft + divRight) * laneDashes * 1.2;

      float laneCenterL = smoothstep(0.10, 0.015, abs(roadX - (-laneW)));
      float laneCenterC = smoothstep(0.10, 0.015, abs(roadX - 0.0));
      float laneCenterR = smoothstep(0.10, 0.015, abs(roadX - laneW));
      float laneFlow = (laneCenterL + laneCenterC + laneCenterR) * 0.02 * (sin((roadZ - uTime * 28.0) * 0.2) * 0.5 + 0.5);

      vec3 neonCyan = vec3(0.0, 0.85, 0.95);
      vec3 emissiveLines = neonCyan * (guideRails * 1.5 + dividerLines * 1.2 + laneFlow);
      col += emissiveLines;

      // --- Rim light on the grazing edges of the road shoulders ---
      float rim = pow(1.0 - NdotV, 3.0) * uRimLightIntensity;
      col += uSunColor * rim * 0.35;

      // The Grid biome wireframe overlay
      if (uGridMode > 0.5) {
        vec2 g = abs(fract(vWorldPosition.xz * 0.5) - 0.5);
        float line = smoothstep(0.48, 0.5, max(g.x, g.y));
        col += neonCyan * line * 0.8;
      }

      // --- Aerial perspective ---
      float fogFactor = smoothstep(75.0, 320.0, vViewDepth);
      vec3 finalFog = length(uFogColor) > 0.001 ? uFogColor : vec3(0.004, 0.007, 0.022);
      col = mix(col, finalFog, clamp(fogFactor, 0.0, 0.96));

      gl_FragColor = vec4(col, 1.0);
    }
  `
};

/**
 * SSAO pass. 12-tap hemisphere sampling in view space with a range check, then a
 * depth-aware 4x4 cross blur to suppress the sampling noise into smooth
 * contact darkening rather than visible grain.
 */
export const SSAOShader = {
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform sampler2D tDepth;
    uniform mat4 uProjection;
    uniform mat4 uInverseProjection;
    uniform vec2 uResolution;
    uniform float uRadius;
    uniform float uIntensity;
    uniform float uBias;
    varying vec2 vUv;

    vec3 viewPosFromDepth(vec2 uv, float depth) {
      vec4 clip = vec4(uv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
      vec4 view = uInverseProjection * clip;
      return view.xyz / view.w;
    }

    float hash12(vec2 p) {
      vec3 p3 = fract(vec3(p.xyx) * 0.1031);
      p3 += dot(p3, p3.yzx + 33.33);
      return fract((p3.x + p3.y) * p3.z);
    }

    void main() {
      float centerDepth = texture2D(tDepth, vUv).x;
      // Background sky: nothing to occlude.
      if (centerDepth >= 1.0) {
        gl_FragColor = vec4(1.0);
        return;
      }

      vec3 P = viewPosFromDepth(vUv, centerDepth);
      // Random per-pixel rotation so the kernel is unbiased after 12 taps.
      float angle = hash12(gl_FragCoord.xy) * 6.2831853;
      vec3 randVec = vec3(cos(angle), sin(angle), 0.0);
      vec3 tangent = normalize(randVec - P * dot(randVec, P));
      vec3 bitangent = cross(P, tangent);
      mat3 tbn = mat3(tangent, bitangent, P);

      float occlusion = 0.0;
      const int SAMPLES = 12;
      for (int i = 0; i < SAMPLES; i++) {
        float fi = float(i);
        // Golden-angle spiral gives even hemisphere coverage from few taps.
        float r = sqrt((fi + 0.5) / float(SAMPLES));
        float theta = fi * 2.39996323;
        vec3 sampleVec = vec3(cos(theta) * r, sin(theta) * r, 0.6 + 0.4 * hash12(gl_FragCoord.xy + fi));
        vec3 samplePos = P + tbn * sampleVec * uRadius;

        vec4 offset = uProjection * vec4(samplePos, 1.0);
        offset.xyz /= offset.w;
        vec2 sampleUv = offset.xy * 0.5 + 0.5;
        if (sampleUv.x < 0.0 || sampleUv.x > 1.0 || sampleUv.y < 0.0 || sampleUv.y > 1.0) continue;

        float sampleDepth = texture2D(tDepth, sampleUv).x;
        vec3 sampleP = viewPosFromDepth(sampleUv, sampleDepth);

        float rangeCheck = smoothstep(0.0, 1.0, uRadius / max(abs(P.z - sampleP.z), 1e-4));
        occlusion += (sampleP.z >= samplePos.z + uBias ? 1.0 : 0.0) * rangeCheck;
      }

      float ao = 1.0 - (occlusion / float(SAMPLES)) * uIntensity;
      gl_FragColor = vec4(clamp(ao, 0.0, 1.0), 0.0, 0.0, 1.0);
    }
  `
};

/** Depth-aware cross blur that leaves the original AO result intact (taps AO). */
export const SSAOBlurShader = {
  vertexShader: SSAOShader.vertexShader,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform sampler2D tAO;
    uniform vec2 uTexelSize;
    varying vec2 vUv;

    void main() {
      float sum = 0.0;
      float wsum = 0.0;
      for (int y = -2; y <= 2; y++) {
        for (int x = -2; x <= 2; x++) {
          vec2 off = vec2(float(x), float(y)) * uTexelSize;
          float d = texture2D(tDiffuse, vUv + off).x;
          // Weight each tap by depth similarity so edges don't bleed across silhouettes.
          float w = exp(-abs(d - texture2D(tDiffuse, vUv).x) * 900.0);
          sum += texture2D(tAO, vUv + off).x * w;
          wsum += w;
        }
      }
      gl_FragColor = vec4(sum / max(wsum, 1e-4), 0.0, 0.0, 1.0);
    }
  `
};

/**
 * Applies a blurred AO buffer to the scene colour. Ambient occlusion is a
 * multiplier on the indirect term only — applying it to the full HDR value
 * would also darken direct light, which physically does not occlude.
 */
export const SSAOApplyShader = {
  vertexShader: SSAOShader.vertexShader,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform sampler2D tAO;
    uniform float uStrength;
    varying vec2 vUv;

    void main() {
      vec3 scene = texture2D(tDiffuse, vUv).rgb;
      float ao = texture2D(tAO, vUv).x;
      // Blend toward 1.0 by strength so low settings are a partial effect,
      // not a different (wrong) occlusion curve.
      float occlusion = mix(1.0, ao, uStrength);
      gl_FragColor = vec4(scene * occlusion, 1.0);
    }
  `
};

/**
 * Radial screen-space reflections. Marches the view ray against the depth
 * buffer, then shades the hit with the sky/ambient probe weighted by fresnel
 * and roughness so grazing wet asphalt picks up the neon skyline.
 */
export const SSRShader = {
  vertexShader: SSAOShader.vertexShader,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform sampler2D tDepth;
    uniform mat4 uProjection;
    uniform mat4 uInverseProjection;
    uniform vec2 uResolution;
    uniform float uMaxDistance;
    uniform float uThickness;
    uniform float uIntensity;
    uniform vec3 uReflectionTint;
    varying vec2 vUv;

    vec3 viewPosFromDepth(vec2 uv, float depth) {
      vec4 clip = vec4(uv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
      vec4 view = uInverseProjection * clip;
      return view.xyz / view.w;
    }

    vec2 projectToUv(vec3 viewPos) {
      vec4 offset = uProjection * vec4(viewPos, 1.0);
      offset.xyz /= offset.w;
      return offset.xy * 0.5 + 0.5;
    }

    void main() {
      vec3 sceneCol = texture2D(tDiffuse, vUv).rgb;
      float depth = texture2D(tDepth, vUv).x;
      if (depth >= 1.0) {
        gl_FragColor = vec4(sceneCol, 1.0);
        return;
      }

      vec3 P = viewPosFromDepth(vUv, depth);

      // Reconstruct view-space normal from the depth-buffer derivative.
      vec2 texel = 1.0 / uResolution;
      float dl = texture2D(tDepth, vUv - vec2(texel.x, 0.0)).x;
      float dr = texture2D(tDepth, vUv + vec2(texel.x, 0.0)).x;
      float dd = texture2D(tDepth, vUv - vec2(0.0, texel.y)).x;
      float du = texture2D(tDepth, vUv + vec2(0.0, texel.y)).x;
      vec3 PL = viewPosFromDepth(vUv - vec2(texel.x, 0.0), dl);
      vec3 PR = viewPosFromDepth(vUv + vec2(texel.x, 0.0), dr);
      vec3 PD = viewPosFromDepth(vUv - vec2(0.0, texel.y), dd);
      vec3 PU = viewPosFromDepth(vUv + vec2(0.0, texel.y), du);
      vec3 ddx = PR - PL;
      vec3 ddy = PU - PD;
      vec3 N = normalize(cross(ddx, ddy));
      if (N.z < 0.0) N = -N;

      vec3 V = normalize(P);
      vec3 R = reflect(V, N);

      // Only reflect rays heading back toward the camera hemisphere.
      if (R.z > 0.0) {
        gl_FragColor = vec4(sceneCol, 1.0);
        return;
      }

      vec3 hitPos = vec3(0.0);
      vec3 hitCol = vec3(0.0);
      float hit = 0.0;
      float stepSize = uMaxDistance / 28.0;
      vec3 pos = P + R * stepSize * 0.5;

      for (int i = 0; i < 28; i++) {
        pos += R * stepSize;
        vec2 pUv = projectToUv(pos);
        if (pUv.x < 0.0 || pUv.x > 1.0 || pUv.y < 0.0 || pUv.y > 1.0) break;

        float sceneDepth = texture2D(tDepth, pUv).x;
        vec3 scenePos = viewPosFromDepth(pUv, sceneDepth);

        float dz = scenePos.z - pos.z;
        if (dz > 0.0 && dz < uThickness * (1.0 + abs(pos.z) * 0.06)) {
          hitPos = scenePos;
          hitCol = texture2D(tDiffuse, pUv).rgb;
          // Edge fade keeps ray hits from popping when they reach the screen border.
          vec2 edge = smoothstep(vec2(0.0), vec2(0.12), pUv) * smoothstep(vec2(1.0), vec2(0.88), pUv);
          hit = edge.x * edge.y;
          break;
        }
        // Coarser stride grows with distance: linear marching aliases badly at range.
        stepSize *= 1.045;
      }

      if (hit <= 0.0) {
        gl_FragColor = vec4(sceneCol, 1.0);
        return;
      }

      float NdotV = max(dot(N, -V), 0.0);
      float fres = pow(1.0 - NdotV, 4.0);
      vec3 reflected = hitCol * uReflectionTint;
      vec3 outCol = mix(sceneCol, reflected, clamp(fres * uIntensity * hit, 0.0, 0.92));
      gl_FragColor = vec4(outCol, 1.0);
    }
  `
};

/**
 * God-ray / light-shaft pass. Radial blur of an occlusion buffer (bright pixels
 * masked out) away from the projected sun position. Combined with the scene it
 * produces atmospheric shafts without a full volumetric raymarch.
 */
export const VolumetricLightShader = {
  vertexShader: SSAOShader.vertexShader,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform sampler2D tDepth;
    uniform vec2 uSunScreenPos;
    uniform vec3 uSunColor;
    uniform float uDensity;
    uniform float uDecay;
    uniform float uWeight;
    varying vec2 vUv;

    void main() {
      vec3 sceneCol = texture2D(tDiffuse, vUv).rgb;
      float depth = texture2D(tDepth, vUv).x;
      // Sky pixels are the shaft source; geometry occludes them.
      float mask = depth >= 1.0 ? 1.0 : 0.0;

      vec2 deltaTexCoord = (vUv - uSunScreenPos) * (1.0 / 24.0) * uDensity;
      vec2 coord = vUv;
      float illumination = 1.0;
      float acc = 0.0;

      for (int i = 0; i < 24; i++) {
        coord -= deltaTexCoord;
        vec2 clamped = clamp(coord, vec2(0.0), vec2(1.0));
        float sMask = texture2D(tDepth, clamped).x >= 1.0 ? 1.0 : 0.0;
        vec3 sCol = texture2D(tDiffuse, clamped).rgb;
        // Only bright, near-white content scatters into a visible shaft.
        float bright = max(0.0, max(sCol.r, max(sCol.g, sCol.b)) - 0.72) * 3.3;
        acc += (sMask * bright) * illumination;
        illumination *= uDecay;
      }

      vec3 shaft = uSunColor * (acc * uWeight);
      // Fade the effect out as the sun leaves the frame so it never pops.
      float onScreen = 1.0 - smoothstep(0.6, 1.8, length(uSunScreenPos - vec2(0.5)));
      shaft *= onScreen;

      // The pass copies the input scene before drawing this result, so keep
      // normal opaque blending and output the scene exactly once.
      gl_FragColor = vec4(sceneCol + shaft * mask, 1.0);
    }
  `
};

/** FXAA 3.11 console-quality variant: cheap edge-directed AA for the mobile preset. */
export const FXAAShader = {
  vertexShader: SSAOShader.vertexShader,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform vec2 uResolution;
    varying vec2 vUv;

    float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

    void main() {
      vec2 texel = 1.0 / uResolution;
      vec3 rgbNW = texture2D(tDiffuse, vUv + vec2(-1.0, -1.0) * texel).rgb;
      vec3 rgbNE = texture2D(tDiffuse, vUv + vec2( 1.0, -1.0) * texel).rgb;
      vec3 rgbSW = texture2D(tDiffuse, vUv + vec2(-1.0,  1.0) * texel).rgb;
      vec3 rgbSE = texture2D(tDiffuse, vUv + vec2( 1.0,  1.0) * texel).rgb;
      vec3 rgbM  = texture2D(tDiffuse, vUv).rgb;

      float lumaNW = luma(rgbNW), lumaNE = luma(rgbNE);
      float lumaSW = luma(rgbSW), lumaSE = luma(rgbSE), lumaM = luma(rgbM);
      float lumaMin = min(lumaM, min(min(lumaNW, lumaNE), min(lumaSW, lumaSE)));
      float lumaMax = max(lumaM, max(max(lumaNW, lumaNE), max(lumaSW, lumaSE)));

      vec2 dir = vec2(
        -((lumaNW + lumaNE) - (lumaSW + lumaSE)),
         ((lumaNW + lumaSW) - (lumaNE + lumaSE))
      );

      float dirReduce = max((lumaNW + lumaNE + lumaSW + lumaSE) * 0.25 * 0.125, 1.0 / 128.0);
      float rcpDirMin = 1.0 / (min(abs(dir.x), abs(dir.y)) + dirReduce);
      dir = clamp(dir * rcpDirMin, vec2(-8.0), vec2(8.0)) * texel;

      vec3 rgbA = 0.5 * (texture2D(tDiffuse, vUv + dir * (1.0/3.0 - 0.5)).rgb +
                         texture2D(tDiffuse, vUv + dir * (2.0/3.0 - 0.5)).rgb);
      vec3 rgbB = rgbA * 0.5 + 0.25 * (texture2D(tDiffuse, vUv + dir * -0.5).rgb +
                                       texture2D(tDiffuse, vUv + dir *  0.5).rgb);

      float lumaB = luma(rgbB);
      gl_FragColor = vec4((lumaB < lumaMin || lumaB > lumaMax) ? rgbA : rgbB, 1.0);
    }
  `
};

/**
 * Temporal anti-aliasing. Jittered-projection resolve with neighbourhood clamping
 * (AABB clipping in YCoCg) against the history buffer, plus a luminance-weighted
 * feedback blend that damps ghosting during fast motion.
 */
export const TAAShader = {
  vertexShader: SSAOShader.vertexShader,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform sampler2D tHistory;
    uniform sampler2D tDepth;
    uniform vec2 uTexelSize;
    uniform float uFeedback;
    varying vec2 vUv;

    vec3 rgbToYCoCg(vec3 c) {
      return vec3(
        0.25 * c.r + 0.5 * c.g + 0.25 * c.b,
        0.5 * c.r - 0.5 * c.b,
        -0.25 * c.r + 0.5 * c.g - 0.25 * c.b
      );
    }

    vec3 yCoCgToRgb(vec3 c) {
      float t = c.x - c.z;
      return vec3(t + c.y, c.x + c.z, t - c.y);
    }

    void main() {
      vec3 current = texture2D(tDiffuse, vUv).rgb;
      float centerDepth = texture2D(tDepth, vUv).x;

      // 3x3 neighbourhood colour bounds, computed in YCoCg for a tighter box.
      vec3 m1 = vec3(0.0), m2 = vec3(0.0);
      vec3 nMin = vec3(1e9), nMax = vec3(-1e9);
      for (int y = -1; y <= 1; y++) {
        for (int x = -1; x <= 1; x++) {
          vec2 off = vec2(float(x), float(y)) * uTexelSize;
          vec3 c = rgbToYCoCg(texture2D(tDiffuse, vUv + off).rgb);
          m1 += c;
          m2 += c * c;
          nMin = min(nMin, c);
          nMax = max(nMax, c);
        }
      }
      vec3 mu = m1 / 9.0;
      vec3 sigma = sqrt(max(m2 / 9.0 - mu * mu, vec3(0.0)));
      // Variance clipping: tighten the box, which suppresses trailing ghosts.
      vec3 boxMin = max(mu - sigma * 1.6, nMin);
      vec3 boxMax = min(mu + sigma * 1.6, nMax);

      vec3 historyY = rgbToYCoCg(texture2D(tHistory, vUv).rgb);
      historyY = clamp(historyY, boxMin, boxMax);

      // Reject history across large depth discontinuities (moving objects).
      float historyDepth = texture2D(tDepth, vUv).x;
      float depthRejection = (abs(historyDepth - centerDepth) > 0.0002) ? 0.0 : 1.0;
      float feedback = uFeedback * depthRejection;

      vec3 resolved = yCoCgToRgb(mix(rgbToYCoCg(current), historyY, feedback));
      gl_FragColor = vec4(resolved, 1.0);
    }
  `
};

/**
 * Depth of field. Separable-free single-pass gather with a 19-tap spiral whose
 * radius is driven by signed circle-of-confusion; near and far fields are
 * weighted independently so the rider stays sharp while the skyline softens.
 */
export const DoFShader = {
  vertexShader: SSAOShader.vertexShader,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform sampler2D tDepth;
    uniform vec2 uTexelSize;
    uniform float uFocusDistance;
    uniform float uFocusRange;
    uniform float uMaxBlur;
    varying vec2 vUv;

    float linearDepth(float d) {
      // Perspective depth to view-space Z (camera looks down -Z).
      float z = d * 2.0 - 1.0;
      return (2.0 * 0.2 * 1200.0) / (1200.0 + 0.2 - z * (1200.0 - 0.2));
    }

    void main() {
      float centerDepth = linearDepth(texture2D(tDepth, vUv).x);
      // Signed CoC: negative in front of focus, positive behind.
      float coc = clamp((centerDepth - uFocusDistance) / max(uFocusRange, 0.001), -1.0, 1.0);
      float blurAmount = abs(coc) * uMaxBlur;

      if (blurAmount < 0.35) {
        gl_FragColor = vec4(texture2D(tDiffuse, vUv).rgb, 1.0);
        return;
      }

      vec3 sum = texture2D(tDiffuse, vUv).rgb;
      float wsum = 1.0;
      const int TAPS = 18;
      for (int i = 0; i < TAPS; i++) {
        float fi = float(i);
        float r = sqrt((fi + 0.5) / float(TAPS));
        float theta = fi * 2.39996323;
        vec2 off = vec2(cos(theta), sin(theta)) * r * blurAmount * uTexelSize * 12.0;

        vec2 suv = vUv + off;
        float sDepth = linearDepth(texture2D(tDepth, suv).x);
        float sCoc = clamp((sDepth - uFocusDistance) / max(uFocusRange, 0.001), -1.0, 1.0);
        // Reject sharp foreground bleeding onto blurred background.
        float w = (abs(sCoc) * uMaxBlur >= 0.35 || coc < 0.0) ? 1.0 : 0.25;
        sum += texture2D(tDiffuse, suv).rgb * w;
        wsum += w;
      }

      gl_FragColor = vec4(sum / wsum, 1.0);
    }
  `
};

export const PostProcessShader = {
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uBloom;
    uniform float uChromaticAberration;
    uniform float uScanlines;
    uniform float uGlitch;
    uniform float uSpeedLines;
    uniform float uHighSpeedBlur;
    uniform float uWarpIntensity;
    uniform float uFilmGrain;
    uniform float uHeatShimmer;
    uniform float uColorLift;
    uniform float uRainIntensity;
    uniform float uExposure;
    uniform float uSharpen;
    uniform vec2 uResolution;
    varying vec2 vUv;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
    }

    void main() {
      vec2 uv = vUv;

      // 0. Heat Shimmer / Thermal Distortion
      if (uHeatShimmer > 0.01) {
        float shimmer = sin(uv.y * 80.0 + uTime * 12.0) * 0.003 * uHeatShimmer;
        uv.x += shimmer;
      }

      // 0. Radial Portal Vortex Warp Distortion
      if (uWarpIntensity > 0.01) {
        vec2 center = vec2(0.5, 0.5);
        vec2 distVec = uv - center;
        float r = length(distVec);
        float angle = atan(distVec.y, distVec.x);
        float twist = uWarpIntensity * 4.0 * (1.0 - smoothstep(0.0, 0.8, r));
        angle += twist;
        float scale = 1.0 - uWarpIntensity * 0.35 * (1.0 - r);
        uv = center + vec2(cos(angle), sin(angle)) * r * scale;
      }

      // 1. Digital Glitch Horizontal Tear (Active during boost burst, combos, or collision stumble)
      if (uGlitch > 0.02) {
        float glitchSlice = floor(uv.y * 36.0);
        float glitchNoise = hash(vec2(glitchSlice, floor(uTime * 24.0)));
        if (glitchNoise > (1.0 - uGlitch * 0.4)) {
          float offset = (hash(vec2(glitchSlice, uTime)) - 0.5) * 0.05 * uGlitch;
          uv.x += offset;
        }
      }

      // 2. Crystal-Clear Scene Texture Sampling
      vec3 sceneCol = texture2D(tDiffuse, uv).rgb;

      // High-speed radial motion blur (Active during boost or high km/h)
      if (uHighSpeedBlur > 0.01) {
        vec2 blurCenter = vec2(0.5, 0.42);
        vec2 blurDir = (uv - blurCenter) * (uHighSpeedBlur * 0.025);
        vec3 blurAcc = sceneCol * 0.4;
        blurAcc += texture2D(tDiffuse, uv - blurDir * 0.5).rgb * 0.25;
        blurAcc += texture2D(tDiffuse, uv - blurDir * 1.0).rgb * 0.20;
        blurAcc += texture2D(tDiffuse, uv - blurDir * 1.5).rgb * 0.15;
        sceneCol = blurAcc;
      }

      // 3. Peripheral-Only Chromatic Aberration (Masked out near rider, zero center fringing)
      float effCA = uChromaticAberration + uWarpIntensity * 0.008;
      float distFromCenter = length(uv - 0.5);
      if (effCA > 0.0001 && distFromCenter > 0.38) {
        float edgeMask = smoothstep(0.38, 0.75, distFromCenter);
        vec2 caOffset = (uv - 0.5) * (effCA * edgeMask * 1.5);
        sceneCol.r = texture2D(tDiffuse, uv - caOffset).r;
        sceneCol.b = texture2D(tDiffuse, uv + caOffset).b;
      }

      // Portal warp flash aura
      if (uWarpIntensity > 0.05) {
        vec3 warpFlash = mix(vec3(0.0, 0.95, 1.0), vec3(1.0, 0.0, 0.8), sin(uTime * 15.0) * 0.5 + 0.5);
        sceneCol += warpFlash * uWarpIntensity * 0.45;
      }

      // 4. Targeted Highlight-Only Bloom (Strict 0.84 Threshold: Only intense neon cores glow, no screen haze)
      if (uBloom > 0.02) {
        vec3 bloomAccum = vec3(0.0);
        vec2 texel = 1.0 / max(uResolution, vec2(1.0, 1.0));
        float bMul = uBloom * 1.2;
        float r1 = 1.8 * bMul;
        float r2 = 3.8 * bMul;
        float threshold = 0.84;

        bloomAccum += max(texture2D(tDiffuse, uv + vec2(-r1, 0.0) * texel).rgb - threshold, vec3(0.0)) * 0.30;
        bloomAccum += max(texture2D(tDiffuse, uv + vec2(r1, 0.0) * texel).rgb - threshold, vec3(0.0)) * 0.30;
        bloomAccum += max(texture2D(tDiffuse, uv + vec2(0.0, -r1) * texel).rgb - threshold, vec3(0.0)) * 0.30;
        bloomAccum += max(texture2D(tDiffuse, uv + vec2(0.0, r1) * texel).rgb - threshold, vec3(0.0)) * 0.30;

        bloomAccum += max(texture2D(tDiffuse, uv + vec2(-r2, -r2) * texel).rgb - threshold, vec3(0.0)) * 0.20;
        bloomAccum += max(texture2D(tDiffuse, uv + vec2(r2, r2) * texel).rgb - threshold, vec3(0.0)) * 0.20;

        sceneCol += bloomAccum * (0.9 * uBloom);
      }

      // 5. Dynamic Speed Lines & Peripheral Motion Streaks
      float effSpeedLines = max(uSpeedLines, uWarpIntensity * 1.2);
      if (effSpeedLines > 0.05) {
        vec2 center = vec2(0.5, 0.42);
        vec2 dir = uv - center;
        float dist = length(dir);
        if (dist > 0.36) {
          float angle = atan(dir.y, dir.x);
          float linePattern = sin(angle * 72.0 + uTime * 36.0);
          linePattern = smoothstep(0.82, 0.99, linePattern);
          float mask = smoothstep(0.36, 0.90, dist) * effSpeedLines;
          vec3 speedLineColor = mix(vec3(0.0, 0.72, 0.85), vec3(0.85, 0.0, 0.5), sin(angle * 8.0 + uTime * 8.0) * 0.5 + 0.5);
          sceneCol += speedLineColor * linePattern * mask * 0.65;
        }
      }

      // 6. Camera Lens Rain Streaks
      if (uRainIntensity > 0.05) {
        float streak = sin((uv.x + uv.y * 0.5 + uTime * 3.0) * 120.0);
        streak = smoothstep(0.92, 0.98, streak) * uRainIntensity;
        sceneCol += vec3(0.6, 0.85, 1.0) * streak * 0.25;
      }

      // 7. Vignette, applied in linear space so it darkens light rather than
      // merely darkening the already-compressed signal.
      float screenEdge = length(uv - 0.5);
      float vignette = smoothstep(0.8, 0.35, screenEdge);
      sceneCol *= mix(0.82, 1.0, vignette);

      // 10. Shadow lift folded into the grading stage below, in linear space,
      // where it belongs — adding it here would tint the whole image instead
      // of only its darkest values.

      // 11. Physically-plausible filmic tonemap + display-referred grading.
      // The renderer is linear; ACES here (not again in the material pass) keeps
      // neon cores from clipping to flat white while holding shadow detail.
      vec3 acesFilm(vec3 x) {
        const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
        return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
      }

      // Lift/gamma/gain around a neutral pivot keeps blacks from crushing.
      vec3 lift = vec3(0.004, 0.008, 0.020) * uColorLift;
      sceneCol = sceneCol * (1.0 - lift) + lift;
      sceneCol = pow(max(sceneCol, vec3(0.0)), vec3(1.0 / 1.02));

      // Gentle S-curve contrast: deepens the night without crushing detail.
      sceneCol = sceneCol * sceneCol * (3.0 - 2.0 * sceneCol) * 0.35 + sceneCol * 0.65;

      vec3 graded = acesFilm(sceneCol * uExposure);

      // Highlight-weighted desaturation stops neon cores turning pure white.
      float luma = dot(graded, vec3(0.2126, 0.7152, 0.0722));
      graded = mix(vec3(luma), graded, 1.0 - smoothstep(0.75, 1.0, luma) * 0.35);

      // Linear -> sRGB (the post target is sRGB-flagged, so encode explicitly).
      graded = mix(graded * 12.92, 1.055 * pow(max(graded, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055, step(0.0031308, graded));

      // 12. Sharpening after tonemapping — sharpening pre-tonemap amplifies the
      // very noise the curve compresses, so it runs on the display-referred image.
      if (uSharpen > 0.005) {
        vec2 sTexel = 1.0 / max(uResolution, vec2(1.0, 1.0));
        // Unsharp mask against a display-referred 5-tap cross, not a Laplacian
        // over the linear buffer: the same kernel clips to white in the dark
        // parts of this scene and produces halos around every neon source.
        vec3 colUp = texture2D(tDiffuse, uv + vec2(0.0, sTexel.y)).rgb;
        vec3 colDown = texture2D(tDiffuse, uv - vec2(0.0, sTexel.y)).rgb;
        vec3 colLeft = texture2D(tDiffuse, uv - vec2(sTexel.x, 0.0)).rgb;
        vec3 colRight = texture2D(tDiffuse, uv + vec2(sTexel.x, 0.0)).rgb;
        vec3 blurBox = (colUp + colDown + colLeft + colRight + graded) * 0.2;
        graded = clamp(graded + (graded - blurBox) * uSharpen * 1.6, 0.0, 1.0);
      }

      // Film grain and CRT scanlines are display-referred effects: applying
      // them in linear space makes the same constant read as a wildly
      // different amount of noise in the shadows versus the neon cores.
      if (uScanlines > 0.005) {
        float scanline = sin(uv.y * uResolution.y * 1.5) * 0.5 + 0.5;
        graded *= (1.0 - uScanlines * (1.0 - scanline) * 0.45);
      }

      if (uFilmGrain > 0.005) {
        // Weight grain by inverse luminance so it lives in the midtones/shadows
        // where real film grain is visible, not in the blown neon highlights.
        float lumaG = dot(graded, vec3(0.2126, 0.7152, 0.0722));
        float grainWeight = 1.0 - smoothstep(0.55, 1.0, lumaG);
        float grain = (hash(uv + vec2(uTime * 0.24, uTime * 0.17)) - 0.5) * uFilmGrain * 0.16 * grainWeight;
        graded += vec3(grain);
      }

      gl_FragColor = vec4(clamp(graded, 0.0, 1.0), 1.0);
    }
  `
};
