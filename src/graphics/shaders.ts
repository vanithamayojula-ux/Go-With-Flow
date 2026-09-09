import * as THREE from 'three';

/**
 * Ghibli Nature & Graphics Shaders
 * Provides painterly cel ramps, vertex-driven wind, slope-dependent warmth/cool tint,
 * rim-lighting, layered skybox, and painterly post-processing.
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

    void main() {
      vec3 dir = normalize(vWorldPosition);
      float elevation = max(dir.y, 0.0);

      // 3-layer gradient sky
      vec3 skyColor = mix(uSkyHorizon, uSkyMid, smoothstep(0.0, 0.25, elevation));
      skyColor = mix(skyColor, uSkyTop, smoothstep(0.2, 0.85, elevation));

      // Sun halo & warm chromatic horizon wash
      float sunDot = max(dot(dir, normalize(uSunPosition)), 0.0);
      float sunGlow = pow(sunDot, 12.0) * 0.45 + pow(sunDot, 64.0) * 0.6;
      skyColor += uSunColor * sunGlow;

      // Soft volumetric haze layer near horizon
      float haze = exp(-elevation * (12.0 - uHazeDensity * 6.0));
      vec3 hazeColor = mix(uSkyHorizon, uSunColor, 0.35);
      skyColor = mix(skyColor, hazeColor, haze * 0.7);

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
    uniform vec3 uSlopeWarmColor; // #F7D6A5
    uniform vec3 uSlopeCoolColor; // #6FB07E / cooler shade
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

      // Tri-planar blending coordinates for organic non-repetitive coverage
      vec3 blending = abs(N);
      blending = normalize(max(blending, 0.00001));
      float bSum = blending.x + blending.y + blending.z;
      blending /= bSum;

      vec2 coord1 = vWorldPosition.yz * 0.04;
      vec2 coord2 = vWorldPosition.zx * 0.04;
      vec2 coord3 = vWorldPosition.xy * 0.04;

      vec4 col1 = texture2D(uGroundTexture, coord1);
      vec4 col2 = texture2D(uGroundTexture, coord2);
      vec4 col3 = texture2D(uGroundTexture, coord3);
      vec3 texColor = (col1 * blending.x + col2 * blending.y + col3 * blending.z).rgb;

      // Lighting calculation
      float NdotL = dot(N, L);

      // Soft Cel Ramp for Ambient Occlusion roll-off (painterly tonal separation)
      float lightFactor = smoothstep(
        -0.2 * (1.0 - uCelRampHardness), 
        0.5 + 0.1 * uCelRampHardness, 
        NdotL
      );

      // Slope-dependent tinting: sun-facing slopes warm, shaded slopes cool
      vec3 warmSunSlope = mix(texColor, uSlopeWarmColor, 0.28);
      vec3 coolShadeSlope = mix(texColor, uSlopeCoolColor, 0.35);
      vec3 baseLit = mix(coolShadeSlope, warmSunSlope, lightFactor);

      // Directional Rim Light for silhouette clarity against vast skies
      float rim = 1.0 - max(dot(V, N), 0.0);
      rim = smoothstep(0.5, 0.95, rim) * max(dot(N, L), 0.1);
      vec3 rimColor = uSunColor * (rim * uRimLightIntensity * 0.7);

      vec3 finalColor = baseLit * (uAmbientColor + uSunColor * lightFactor) + rimColor;

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

      // Reconstruct instance matrix
      float s = aInstanceScale;
      float c = cos(aInstanceRot);
      float sn = sin(aInstanceRot);

      vec3 localPos = position;

      // Vertex-driven wind: higher vertices sway with sine wave + macro wave
      float totalWind = uWindStrength * (1.0 + uPlayerSpeedFactor * 0.5);
      float wave = sin(uTime * uWindSpeed * 2.5 + aInstancePosition.x * 0.3 + aInstancePosition.z * 0.25)
                 + 0.5 * sin(uTime * uWindSpeed * 4.0 + aInstancePosition.z * 0.6);
      
      // Sway in X/Z proportional to height squared
      float bend = uv.y * uv.y * wave * 0.45 * totalWind;
      localPos.x += bend * 0.8;
      localPos.z += bend * 0.4;

      // Apply rotation & scale
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

      // Two-sided soft cel lighting with translucent foliage look
      float NdotL = max(dot(N, L), 0.2);
      float backLight = max(dot(-N, L), 0.0) * 0.35; // Subsurface scattering approximation for thin leaves
      float light = NdotL + backLight;

      // Sunlight gradient along blade height
      vec3 sunlitAlbedo = mix(texColor.rgb * 0.8, texColor.rgb * 1.25, vHeightFactor);

      // Rim light for painterly crisp silhouette
      float rim = 1.0 - max(dot(V, N), 0.0);
      rim = smoothstep(0.6, 0.95, rim) * uRimLightIntensity;
      vec3 rimCol = uSunColor * (rim * 0.5);

      vec3 finalCol = sunlitAlbedo * (uAmbientColor + uSunColor * light) + rimCol;

      gl_FragColor = vec4(finalCol, texColor.a);
    }
  `
};

export const BoardTrailShader = {
  vertexShader: `
    attribute float aProgress; // 0 at tail, 1 at board
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
      // Soft fading edge across ribbon width
      float edgeAlpha = smoothstep(0.0, 0.4, 0.5 - abs(vUv.y - 0.5));
      // Lengthwise fade
      float lengthAlpha = smoothstep(0.0, 0.3, vProgress);

      vec3 color = mix(uColorA, uColorB, vProgress);
      // Bright painterly core
      color += vec3(0.3, 0.4, 0.2) * pow(edgeAlpha, 3.0);

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

    // Pseudo-random generator for painterly film grain
    float rand(vec2 co) {
      return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
    }

    void main() {
      vec2 uv = vUv;
      
      // Radial motion blur when surfing at high speeds
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

      // Soft bloom threshold & bleed
      if (uBloom > 0.01) {
        vec3 bloomAccum = vec3(0.0);
        vec2 texel = 1.0 / uResolution;
        float r = 2.5 * uBloom;
        bloomAccum += max(texture2D(tDiffuse, uv + vec2(-r, 0.0) * texel).rgb - 0.7, 0.0);
        bloomAccum += max(texture2D(tDiffuse, uv + vec2(r, 0.0) * texel).rgb - 0.7, 0.0);
        bloomAccum += max(texture2D(tDiffuse, uv + vec2(0.0, -r) * texel).rgb - 0.7, 0.0);
        bloomAccum += max(texture2D(tDiffuse, uv + vec2(0.0, r) * texel).rgb - 0.7, 0.0);
        sceneCol += bloomAccum * (0.35 * uBloom);
      }

      // Color Grading: Gentle lift in highlights, warm midtones, soft desaturated shadows
      // Softened ACES tone mapping for gentle nostalgic pastel look
      vec3 mapped = sceneCol * (2.4 * sceneCol + 0.12) / (sceneCol * (2.2 * sceneCol + 1.5) + 0.18);

      // Warm midtones & highlight lift
      mapped.r = pow(mapped.r, 0.94);
      mapped.g = pow(mapped.g, 0.96);
      mapped.b = pow(mapped.b, 1.02); // slight cool depth in shadows
      mapped += vec3(0.04, 0.03, 0.01) * uColorLift;

      // Subtle painterly film grain (0.02 - 0.04)
      float grain = (rand(uv * 1000.0 + fract(uTime * 0.1)) - 0.5) * uFilmGrain;
      mapped += grain;

      gl_FragColor = vec4(clamp(mapped, 0.0, 1.0), 1.0);
    }
  `
};
