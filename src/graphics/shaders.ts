import * as THREE from 'three';

/**
 * Studio Ghibli Shaders
 * Soft 3-band cel toon ramps, painterly tri-planar ground blending, vertex wind sway,
 * warm-side/cool-shadow color splitting, golden rim lighting, soft ribbon trails,
 * and nostalgic painterly post-processing with film grain.
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
    uniform float uHazeDensity;
    varying vec3 vWorldPosition;
    varying vec2 vUv;

    float noise(vec2 st) {
      return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
    }

    void main() {
      vec3 dir = normalize(vWorldPosition);
      float elevation = max(dir.y, 0.0);

      // Painterly soft 3-band gradient sky
      float band1 = smoothstep(0.0, 0.32, elevation);
      float band2 = smoothstep(0.22, 0.88, elevation);

      vec3 skyColor = mix(uSkyHorizon, uSkyMid, band1);
      skyColor = mix(skyColor, uSkyTop, band2);

      // Warm golden sun halo & atmospheric glow
      float sunDot = max(dot(dir, normalize(uSunPosition)), 0.0);
      float sunGlow = pow(sunDot, 12.0) * 0.45 + pow(sunDot, 56.0) * 0.70;
      skyColor += uSunColor * sunGlow;

      // Soft volumetric haze near horizon
      float haze = exp(-elevation * (10.0 - uHazeDensity * 5.0));
      vec3 hazeColor = mix(uSkyHorizon, uSunColor, 0.40);
      skyColor = mix(skyColor, hazeColor, haze * 0.65);

      // Subtle painterly atmospheric grain
      float n = (noise(vUv * 400.0 + uTime * 0.02) - 0.5) * 0.015;
      skyColor += vec3(n);

      gl_FragColor = vec4(skyColor, 1.0);
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
    uniform sampler2D uGroundTexture;
    uniform vec3 uSunDirection;
    uniform vec3 uSunColor;
    uniform vec3 uAmbientColor;
    uniform vec3 uSlopeWarmColor; // Sunlit slope tint multiplier (#FFF4D4)
    uniform vec3 uSlopeCoolColor; // Shaded slope tint multiplier (#5B9B82)
    uniform float uCelRampHardness;
    uniform float uRimLightIntensity;
    uniform vec3 uCameraPos;

    varying vec3 vWorldPosition;
    varying vec3 vNormal;
    varying vec2 vUv;

    void main() {
      vec3 N = normalize(vNormal);
      vec3 L = normalize(uSunDirection);
      vec3 V = normalize(uCameraPos - vWorldPosition);

      // Tri-planar texture sampling at crisp 0.10 UV scale for sharp grass & flower detail
      vec3 blending = abs(N);
      blending = normalize(max(blending, 0.00001));
      float bSum = blending.x + blending.y + blending.z;
      blending /= bSum;

      vec2 coord1 = vWorldPosition.yz * 0.10;
      vec2 coord2 = vWorldPosition.zx * 0.10;
      vec2 coord3 = vWorldPosition.xy * 0.10;

      vec4 col1 = texture2D(uGroundTexture, coord1);
      vec4 col2 = texture2D(uGroundTexture, coord2);
      vec4 col3 = texture2D(uGroundTexture, coord3);
      vec3 texColor = (col1 * blending.x + col2 * blending.y + col3 * blending.z).rgb;

      // Soft 3-Band Ghibli Cel Ramp Lighting
      float NdotL = dot(N, L);
      float shadowToMid = smoothstep(-0.25, 0.15 + 0.1 * uCelRampHardness, NdotL);
      float midToSun = smoothstep(0.15 + 0.1 * uCelRampHardness, 0.65, NdotL);
      float celFactor = shadowToMid * 0.5 + midToSun * 0.5;

      // Multiplicative color splitting (preserves 100% of painterly grass/flower detail!)
      vec3 sunlitTex = texColor * uSlopeWarmColor * 1.35;
      vec3 shadedTex = texColor * uSlopeCoolColor * 0.88;
      vec3 baseLit = mix(shadedTex, sunlitTex, celFactor);

      // Golden rim light on sunlit terrain crests
      float rim = 1.0 - max(dot(V, N), 0.0);
      rim = smoothstep(0.48, 0.92, rim) * max(dot(N, L), 0.1);
      vec3 rimColor = uSunColor * (rim * uRimLightIntensity * 0.60);

      vec3 finalColor = baseLit * (uAmbientColor + uSunColor * celFactor) + rimColor;

      gl_FragColor = vec4(finalColor, 1.0);
    }
  `
};

export const FoliageShader = {
  vertexShader: `
    uniform float uTime;
    uniform float uWindSpeed;
    uniform float uWindStrength;
    uniform float uPlayerSpeedFactor;

    attribute vec3 aInstancePosition;
    attribute float aInstanceScale;
    attribute float aInstanceRot;

    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vWorldPosition;
    varying float vHeightFactor;

    void main() {
      vUv = uv;
      vHeightFactor = uv.y;

      float s = aInstanceScale;
      float c = cos(aInstanceRot);
      float sn = sin(aInstanceRot);

      vec3 localPos = position;

      float totalWind = uWindStrength * (1.0 + uPlayerSpeedFactor * 0.5);
      float wave = sin(uTime * uWindSpeed * 2.5 + aInstancePosition.x * 0.3 + aInstancePosition.z * 0.25)
                 + 0.5 * sin(uTime * uWindSpeed * 4.0 + aInstancePosition.z * 0.6);

      float bend = uv.y * uv.y * wave * 0.45 * totalWind;
      localPos.x += bend * 0.8;
      localPos.z += bend * 0.4;

      vec3 transformed = vec3(
        (localPos.x * c - localPos.z * sn) * s,
        localPos.y * s,
        (localPos.x * sn + localPos.z * c) * s
      );

      vec3 worldPos = transformed + aInstancePosition;
      vWorldPosition = worldPos;
      vNormal = normalize(normalMatrix * normal);

      gl_Position = projectionMatrix * viewMatrix * vec4(worldPos, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D uTexture;
    uniform vec3 uSunDirection;
    uniform vec3 uSunColor;
    uniform vec3 uAmbientColor;
    uniform float uRimLightIntensity;
    uniform vec3 uCameraPos;

    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vWorldPosition;
    varying float vHeightFactor;

    void main() {
      vec4 texColor = texture2D(uTexture, vUv);
      if (texColor.a < 0.2) discard;

      vec3 N = normalize(vNormal);
      vec3 L = normalize(uSunDirection);
      vec3 V = normalize(uCameraPos - vWorldPosition);

      float NdotL = max(dot(N, L), 0.15);
      float backLight = max(dot(-N, L), 0.0) * 0.42;

      float celLight = smoothstep(0.1, 0.7, NdotL + backLight);

      vec3 sunlitAlbedo = mix(texColor.rgb * 0.80, texColor.rgb * 1.35, vHeightFactor);

      float rim = 1.0 - max(dot(V, N), 0.0);
      rim = smoothstep(0.55, 0.92, rim) * uRimLightIntensity;
      vec3 rimCol = uSunColor * (rim * 0.55);

      vec3 finalCol = sunlitAlbedo * (uAmbientColor + uSunColor * celLight) + rimCol;

      gl_FragColor = vec4(finalCol, texColor.a);
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
    uniform vec3 uColorA;
    uniform vec3 uColorB;
    uniform float uOpacity;
    varying float vProgress;
    varying vec2 vUv;

    void main() {
      float edgeAlpha = smoothstep(0.0, 0.45, 0.5 - abs(vUv.y - 0.5));
      float lengthAlpha = smoothstep(0.0, 0.35, vProgress);

      vec3 color = mix(uColorA, uColorB, vProgress);
      color += vec3(0.25, 0.35, 0.18) * pow(edgeAlpha, 2.5);

      gl_FragColor = vec4(color, edgeAlpha * lengthAlpha * uOpacity);
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
    uniform float uFilmGrain;
    uniform float uBloom;
    uniform float uColorLift;
    uniform float uHighSpeedBlur;
    uniform vec2 uResolution;
    varying vec2 vUv;

    float rand(vec2 co) {
      return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
    }

    void main() {
      vec2 uv = vUv;

      vec3 sceneCol = vec3(0.0);
      if (uHighSpeedBlur > 0.05) {
        vec2 center = vec2(0.5, 0.45);
        vec2 toCenter = (center - uv) * uHighSpeedBlur * 0.04;
        for (int i = 0; i < 5; i++) {
          sceneCol += texture2D(tDiffuse, uv + toCenter * float(i)).rgb;
        }
        sceneCol *= 0.2;
      } else {
        sceneCol = texture2D(tDiffuse, uv).rgb;
      }

      if (uBloom > 0.01) {
        vec3 bloomAccum = vec3(0.0);
        vec2 texel = 1.0 / uResolution;
        float r = 2.5 * uBloom;
        bloomAccum += max(texture2D(tDiffuse, uv + vec2(-r, 0.0) * texel).rgb - 0.62, 0.0);
        bloomAccum += max(texture2D(tDiffuse, uv + vec2(r, 0.0) * texel).rgb - 0.62, 0.0);
        bloomAccum += max(texture2D(tDiffuse, uv + vec2(0.0, -r) * texel).rgb - 0.62, 0.0);
        bloomAccum += max(texture2D(tDiffuse, uv + vec2(0.0, r) * texel).rgb - 0.62, 0.0);
        sceneCol += bloomAccum * (0.38 * uBloom);
      }

      // Nostalgic Ghibli color grading: lifted golden highlights, rich emerald greens, cool shadow depth
      vec3 mapped = sceneCol * (2.4 * sceneCol + 0.12) / (sceneCol * (2.2 * sceneCol + 1.5) + 0.18);

      mapped.r = pow(mapped.r, 0.92);
      mapped.g = pow(mapped.g, 0.94);
      mapped.b = pow(mapped.b, 1.02);
      mapped += vec3(0.05, 0.04, 0.02) * uColorLift;

      float grain = (rand(uv * 1000.0 + fract(uTime * 0.1)) - 0.5) * uFilmGrain;
      mapped += grain;

      gl_FragColor = vec4(clamp(mapped, 0.0, 1.0), 1.0);
    }
  `
};
