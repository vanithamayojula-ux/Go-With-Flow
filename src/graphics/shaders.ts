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

      // Deep Galaxy Void: Dark Blue (#02040c) into Deep Cosmic Purple (#0a0418) to Midnight (#010206)
      vec3 deepVoid = vec3(0.008, 0.015, 0.045);    // Dark Navy Base
      vec3 nebulaPurple = vec3(0.045, 0.012, 0.095); // Deep Cosmic Violet
      vec3 zenithVoid = vec3(0.002, 0.004, 0.012);   // Pure Obsidian Black
      
      vec3 galaxyBase = mix(deepVoid, nebulaPurple, smoothstep(0.1, 0.65, elevation));
      galaxyBase = mix(galaxyBase, zenithVoid, smoothstep(0.6, 1.0, elevation));

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

      vec3 nebColA = vec3(0.02, 0.06, 0.14); // Deep Indigo
      vec3 nebColB = vec3(0.07, 0.01, 0.12); // Royal Violet / Purple
      vec3 nebColC = vec3(0.00, 0.05, 0.08); // Cyan Filament Tint

      vec3 nebulaGlow = mix(nebColA, nebColB, nebFbm1) * smoothstep(0.25, 0.75, nebFbm1 * 1.2);
      nebulaGlow += nebColC * smoothstep(0.35, 0.85, nebFbm2) * 0.6;
      galaxyBase += nebulaGlow * 0.85;

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
      // When player accelerates, stars along periphery stretch into relativistic warp lines
      float speedFactor = clamp((uSpeed - 20.0) / 40.0, 0.0, 1.0);
      if (speedFactor > 0.01) {
        vec2 streakCoord = dir.xy * 60.0;
        streakCoord.y += uTime * (uSpeed * 0.4);
        float streakId = hash(floor(streakCoord));
        if (streakId > 0.985) {
          float streakLine = smoothstep(0.08, 0.0, abs(fract(streakCoord.x) - 0.5));
          galaxyBase += vec3(0.0, 0.85, 1.0) * streakLine * speedFactor * 0.45;
        }
      }

      // --- Layer 3: Giant Holographic Vector Cyberspace (for Grid Biome) ---
      if (uGridMode > 0.1) {
        float gridAngle = atan(dir.x, dir.z);
        float gridElevation = abs(dir.y);
        float gridLineX = abs(fract(gridAngle * 16.0) - 0.5);
        float gridLineY = abs(fract(gridElevation * 20.0) - 0.5);
        float gridMask = (smoothstep(0.03, 0.0, gridLineX) + smoothstep(0.03, 0.0, gridLineY)) * 0.4;
        galaxyBase += vec3(0.0, 0.9, 0.95) * gridMask * uGridMode;
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
    uniform float uTime;
    uniform float uSpeed; // Player speed in m/s for animated streaks and pulses
    uniform float uGridMode; // 1.0 = The Grid wireframe
    uniform float uWetReflections;

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

      // 3. Strict Color System:
      // Primary: Pure Neon Cyan (Player & Highway Rails ONLY)
      // Secondary: Deep Cosmic Navy/Obsidian
      vec3 neonCyan = vec3(0.0, 0.85, 0.95);
      vec3 deepSpaceObsidian = vec3(0.003, 0.005, 0.012);

      // Center corridor subtle ambient starlight reflection
      float centerDist = abs(vWorldPosition.x);
      float centerStreak = exp(-centerDist * centerDist * 0.22);
      vec3 spaceReflection = neonCyan * centerStreak * 0.35;

      // Clean, dark space highway surface
      vec3 wetSurface = mix(pavementBase, pavementBase * 0.15 + spaceReflection, wetness * 0.55);

      // 4. --- Futuristic Space Highway Markings & Guided Neon Rails ---
      float roadX = vWorldPosition.x;
      float roadZ = vWorldPosition.z;

      // Motion blur streak along outer road boundaries (widens dynamically with speed)
      float edgeDist = abs(roadX);
      float roadEdgeBlur = smoothstep(5.0, 7.2, edgeDist);
      float edgeStreakRate = 26.0 + uSpeed * 1.5;
      float speedStreak = sin((roadZ - uTime * edgeStreakRate) * 0.5) * 0.5 + 0.5;

      // Outer highway guided neon rail lines (-6.8 and +6.8) - Pure Cyan
      float railLeft = smoothstep(0.30, 0.02, abs(roadX - (-6.8)));
      float railRight = smoothstep(0.30, 0.02, abs(roadX - 6.8));
      float guideRails = railLeft + railRight;

      // Inner lane divider light pulses (-2.3 and +2.3) - Speed-pulsed Cyan dashes
      float divLeft = smoothstep(0.12, 0.02, abs(roadX - (-2.3)));
      float divRight = smoothstep(0.12, 0.02, abs(roadX - 2.3));
      float dashRate = 24.0 + uSpeed * 1.1;
      float laneDashes = step(0.52, fract((roadZ - uTime * dashRate) * 0.14));
      float dividerLines = (divLeft + divRight) * laneDashes;

      // Strict Color System: Cyan ONLY for rails and road guidance
      vec3 emissiveLines = neonCyan * (guideRails * 1.6 + dividerLines * 0.95);

      // Edge motion blur light streaks
      vec3 gutterStreak = neonCyan * roadEdgeBlur * speedStreak * (0.3 + uSpeed * 0.01);

      vec3 finalCol = wetSurface + emissiveLines + gutterStreak;

      // Subtle atmospheric rim lighting
      float rim = pow(1.0 - max(dot(V, N), 0.0), 4.2);
      finalCol += neonCyan * rim * 0.14;

      // 5. Depth System: Foreground is Razor-Sharp & Punchy;
      // Distance smoothly recedes into Deep Cosmic Indigo / Purple Space Void
      float dist = length(uCameraPos - vWorldPosition);
      float fogFactor = smoothstep(75.0, 320.0, dist);
      vec3 cosmicVoidFog = vec3(0.004, 0.007, 0.022); // Deep Galaxy Indigo
      finalCol = mix(finalCol, cosmicVoidFog, clamp(fogFactor, 0.0, 0.96));

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
      // High-energy laser ribbon with intense white core
      float distFromCenter = abs(vUv.y - 0.5) * 2.0; // 0 at center, 1 at edge
      float core = pow(1.0 - distFromCenter, 4.0); // Pure white blinding core
      float glow = pow(1.0 - distFromCenter, 1.5); // Saturated neon outer glow

      // Length fade
      float lengthFade = smoothstep(0.0, 0.25, vProgress);

      // Animated high-speed circuit pulse
      float pulse = sin(vProgress * 24.0 - uTime * 20.0) * 0.2 + 0.8;

      vec3 neonHue = mix(uColorA, uColorB, vProgress);
      vec3 finalCol = mix(neonHue * 2.2, vec3(1.0, 1.0, 1.0) * 2.8, core);

      float alpha = glow * lengthFade * uOpacity * pulse;
      gl_FragColor = vec4(finalCol, clamp(alpha, 0.0, 1.0));
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
    uniform float uColorLift;
    uniform float uRainIntensity;
    uniform vec2 uResolution;
    varying vec2 vUv;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
    }

    void main() {
      vec2 uv = vUv;

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

      // 3. Chromatic Aberration (RGB Channel Fringing)
      float effCA = uChromaticAberration + uWarpIntensity * 0.012;
      if (effCA > 0.0001) {
        float dist = length(uv - 0.5);
        vec2 caOffset = (uv - 0.5) * (effCA * (dist * 1.8 + 0.2));
        sceneCol.r = texture2D(tDiffuse, uv - caOffset).r;
        sceneCol.b = texture2D(tDiffuse, uv + caOffset).b;
      }

      // Portal warp flash aura
      if (uWarpIntensity > 0.05) {
        vec3 warpFlash = mix(vec3(0.0, 0.95, 1.0), vec3(1.0, 0.0, 0.8), sin(uTime * 15.0) * 0.5 + 0.5);
        sceneCol += warpFlash * uWarpIntensity * 0.45;
      }

      // 4. Targeted Highlight-Only Bloom (Strict Threshold: Only intense neon cores glow, no screen haze)
      if (uBloom > 0.02) {
        vec3 bloomAccum = vec3(0.0);
        vec2 texel = 1.0 / max(uResolution, vec2(1.0, 1.0));
        float bMul = uBloom * 1.8;
        float r1 = 2.0 * bMul;
        float r2 = 5.0 * bMul;
        float r3 = 10.0 * bMul;
        // High threshold ensures only true highlights (neon signs, thrusters, coins) trigger bloom
        float threshold = 0.72;

        bloomAccum += max(texture2D(tDiffuse, uv + vec2(-r1, 0.0) * texel).rgb - threshold, vec3(0.0)) * 0.25;
        bloomAccum += max(texture2D(tDiffuse, uv + vec2(r1, 0.0) * texel).rgb - threshold, vec3(0.0)) * 0.25;
        bloomAccum += max(texture2D(tDiffuse, uv + vec2(0.0, -r1) * texel).rgb - threshold, vec3(0.0)) * 0.25;
        bloomAccum += max(texture2D(tDiffuse, uv + vec2(0.0, r1) * texel).rgb - threshold, vec3(0.0)) * 0.25;

        bloomAccum += max(texture2D(tDiffuse, uv + vec2(-r2, -r2) * texel).rgb - threshold, vec3(0.0)) * 0.18;
        bloomAccum += max(texture2D(tDiffuse, uv + vec2(r2, r2) * texel).rgb - threshold, vec3(0.0)) * 0.18;
        bloomAccum += max(texture2D(tDiffuse, uv + vec2(-r2, r2) * texel).rgb - threshold, vec3(0.0)) * 0.18;
        bloomAccum += max(texture2D(tDiffuse, uv + vec2(r2, -r2) * texel).rgb - threshold, vec3(0.0)) * 0.18;

        bloomAccum += max(texture2D(tDiffuse, uv + vec2(-r3, 0.0) * texel).rgb - threshold, vec3(0.0)) * 0.12;
        bloomAccum += max(texture2D(tDiffuse, uv + vec2(r3, 0.0) * texel).rgb - threshold, vec3(0.0)) * 0.12;

        sceneCol += bloomAccum * (1.1 * uBloom);
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

      // 7. Depth Vignette & Film Fidelity
      float screenEdge = length(uv - 0.5);
      float vignette = smoothstep(0.8, 0.35, screenEdge);
      sceneCol *= mix(0.78, 1.0, vignette);

      // 8. Color Lift & Crisp Contrast (Deep obsidian contrast > raw brightness)
      if (uColorLift > 0.01) {
        sceneCol = mix(sceneCol, sceneCol + vec3(0.01, 0.02, 0.04), uColorLift * 0.3);
      }
      if (uScanlines > 0.05) {
        float scanline = sin(uv.y * uResolution.y * 0.5) * 0.5 + 0.5;
        sceneCol *= mix(1.0, 0.95 + 0.05 * scanline, uScanlines);
      }

      // 9. Cyberpunk Contrast & Clean Output
      gl_FragColor = vec4(clamp(sceneCol, 0.0, 1.0), 1.0);
    }
  `
};
