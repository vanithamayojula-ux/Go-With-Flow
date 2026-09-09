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
    uniform float uHazeDensity;
    uniform float uGridMode; // 1.0 = Tron Wireframe Grid, 0.0 = Cyber Megacity
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

    void main() {
      vec3 dir = normalize(vWorldPosition);
      float elevation = dir.y;

      // Deep dark void background (~85% near-black/deep navy)
      vec3 baseVoid = mix(vec3(0.015, 0.02, 0.04), vec3(0.003, 0.005, 0.012), clamp(elevation * 2.0, 0.0, 1.0));

      // 1. Cosmic Starfield & Digital Dust
      float starGrid = hash(floor(dir.xz / (abs(elevation) + 0.08) * 180.0));
      float star = step(0.985, starGrid) * (sin(uTime * 4.0 + starGrid * 30.0) * 0.35 + 0.65);
      baseVoid += vec3(0.6, 0.85, 1.0) * star * smoothstep(0.05, 0.4, abs(elevation));

      // 2. Distant Cyber Megacity Skyline Silhouettes
      float angle = atan(dir.x, dir.z);
      float buildingIndex = floor(angle * 32.0);
      float buildingHeight = hash(vec2(buildingIndex, 42.0)) * 0.28 + 0.04;
      float isBuilding = step(elevation, buildingHeight) * step(-0.02, elevation);

      if (isBuilding > 0.5 && uGridMode < 0.5) {
        // Dark skyscraper silhouette
        vec3 buildingCol = vec3(0.01, 0.012, 0.025);

        // Cyber window grid lights (cyan & amber)
        vec2 windowUv = vec2(fract(angle * 32.0) * 8.0, elevation * 120.0);
        float windowLit = step(0.68, hash(floor(windowUv) + buildingIndex * 13.0));
        vec3 windowColor = mix(vec3(0.0, 0.94, 1.0), vec3(1.0, 0.45, 0.1), hash(vec2(buildingIndex, 7.0)));
        buildingCol += windowColor * windowLit * 0.65;

        // Aircraft warning blinker atop skyscrapers
        float topEdge = step(buildingHeight - 0.015, elevation);
        float blink = step(0.5, sin(uTime * 5.0 + buildingIndex * 2.0));
        buildingCol += vec3(1.0, 0.1, 0.2) * topEdge * blink * 1.5;

        baseVoid = buildingCol;
      }

      // 3. Tron Wireframe Grid Mode (for "The Grid" zone)
      if (uGridMode > 0.1) {
        float gridElevation = abs(elevation);
        float gridLineX = abs(fract(angle * 16.0) - 0.5);
        float gridLineY = abs(fract(gridElevation * 20.0) - 0.5);
        float grid = smoothstep(0.46, 0.49, max(1.0 - gridLineX * 2.0, 1.0 - gridLineY * 2.0));
        vec3 gridColor = mix(vec3(0.0, 0.95, 1.0), vec3(1.0, 0.0, 0.6), sin(angle * 4.0 + uTime) * 0.5 + 0.5);
        baseVoid += gridColor * grid * 0.65 * uGridMode;
      }

      // 4. Distant Horizon Neon Haze & Atmospheric Glow
      float horizonHaze = exp(-abs(elevation) * 8.0);
      vec3 hazeColor = mix(vec3(0.0, 0.8, 1.0), vec3(0.85, 0.0, 0.55), sin(uTime * 0.2) * 0.5 + 0.5);
      baseVoid += hazeColor * horizonHaze * 0.38;

      gl_FragColor = vec4(baseVoid, 1.0);
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

      // Deep dark asphalt base (~88% black)
      vec3 tarmacBase = vec3(0.02, 0.025, 0.035);

      // Procedural asphalt micro-roughness & wet sheen
      float noiseVal = hash21(floor(vWorldPosition.xz * 18.0));
      tarmacBase += vec3(noiseVal * 0.015);

      // --- 3-Lane Neon Highway Markings ---
      float roadX = vWorldPosition.x;
      float roadZ = vWorldPosition.z;

      // Outer highway boundary neon curb lines (-6.5 and +6.5)
      float curbLeft = smoothstep(0.25, 0.05, abs(roadX - (-6.4)));
      float curbRight = smoothstep(0.25, 0.05, abs(roadX - 6.4));
      float curbLines = curbLeft + curbRight;

      // Inner lane divider dash lines (lanes are centered at -4.2, 0, 4.2 -> dividers at -2.1 and +2.1)
      float divLeft = smoothstep(0.12, 0.03, abs(roadX - (-2.1)));
      float divRight = smoothstep(0.12, 0.03, abs(roadX - 2.1));
      float laneDashes = step(0.45, fract((roadZ - uTime * 32.0) * 0.12));
      float dividerLines = (divLeft + divRight) * laneDashes;

      // Road edge glow (Cyan & Hot Magenta)
      vec3 curbColor = vec3(0.0, 0.95, 1.0); // Electric Cyan
      vec3 dividerColor = vec3(1.0, 0.0, 0.55); // Hot Magenta

      vec3 emissiveLines = curbColor * curbLines * 2.2 + dividerColor * dividerLines * 1.8;

      // --- Blade Runner Wet-Street Reflection Trick ---
      // Vertical streaking specular reflections of passing billboards & neon signage
      float reflectionStreak = sin(roadX * 3.5 + uTime * 2.0) * cos(roadX * 1.8);
      reflectionStreak = pow(max(0.0, reflectionStreak), 4.0);
      vec3 neonReflection = mix(vec3(0.0, 0.8, 1.0), vec3(1.0, 0.1, 0.6), sin(roadZ * 0.05) * 0.5 + 0.5);
      float fresnel = pow(1.0 - max(dot(V, N), 0.0), 3.0);
      vec3 wetStreaks = neonReflection * reflectionStreak * (fresnel * 0.85 + 0.25);

      // --- Tron Grid Zone Override ---
      if (uGridMode > 0.05) {
        float gridX = abs(fract(roadX * 0.5) - 0.5);
        float gridZ = abs(fract(roadZ * 0.5 - uTime * 0.5) - 0.5);
        float tronGrid = smoothstep(0.42, 0.48, max(1.0 - gridX * 2.0, 1.0 - gridZ * 2.0));
        vec3 tronColor = mix(vec3(0.0, 1.0, 0.8), vec3(1.0, 0.0, 0.8), sin(roadZ * 0.02) * 0.5 + 0.5);
        tarmacBase = mix(vec3(0.005, 0.008, 0.015), tronColor * 1.8, tronGrid * uGridMode);
      }

      vec3 finalCol = tarmacBase + emissiveLines + wetStreaks;

      // High-contrast rim light from ambient neon environment
      float rim = pow(1.0 - max(dot(V, N), 0.0), 4.0);
      finalCol += vec3(0.0, 0.6, 1.0) * rim * 0.35;

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
      gl_FragColor = vec4(col * pulse * 1.4, 1.0);
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
      vec3 finalCol = mix(neonHue * 2.0, vec3(1.0, 1.0, 1.0) * 2.5, core);

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
    uniform vec2 uResolution;
    varying vec2 vUv;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
    }

    void main() {
      vec2 uv = vUv;

      // 1. Digital Glitch Horizontal Tear & Displacement
      if (uGlitch > 0.02) {
        float glitchSlice = floor(uv.y * 36.0);
        float glitchNoise = hash(vec2(glitchSlice, floor(uTime * 14.0)));
        if (glitchNoise > 0.86) {
          float offset = (hash(vec2(glitchSlice, uTime)) - 0.5) * 0.045 * uGlitch;
          uv.x += offset;
        }
      }

      // 2. High-Speed Radial Motion Blur during Boost
      vec3 sceneCol = vec3(0.0);
      if (uHighSpeedBlur > 0.02) {
        vec2 center = vec2(0.5, 0.45);
        vec2 toCenter = (center - uv) * clamp(uHighSpeedBlur, 0.0, 1.0) * 0.016;
        for (int i = 0; i < 5; i++) {
          sceneCol += texture2D(tDiffuse, uv + toCenter * float(i)).rgb;
        }
        sceneCol *= 0.2;
      } else {
        sceneCol = texture2D(tDiffuse, uv).rgb;
      }

      // 3. Chromatic Aberration (RGB Color Channel Split)
      float caAmount = max(uChromaticAberration, 0.003 + uHighSpeedBlur * 0.008);
      vec2 caOffset = (uv - 0.5) * caAmount;
      float rChannel = texture2D(tDiffuse, uv - caOffset).r;
      float bChannel = texture2D(tDiffuse, uv + caOffset).b;
      sceneCol.r = rChannel;
      sceneCol.b = bChannel;

      // 4. Radiant Multi-Tap Neon Bloom (Extract high emissive highlights)
      if (uBloom > 0.01) {
        vec3 bloomAccum = vec3(0.0);
        vec2 texel = 1.0 / uResolution;
        float bMul = uBloom * 3.5;
        float r1 = 2.5 * bMul;
        float r2 = 6.0 * bMul;
        float r3 = 11.0 * bMul;
        float threshold = 0.32; // Low threshold so neon signs and rails bloom richly!

        bloomAccum += max(texture2D(tDiffuse, uv + vec2(-r1, 0.0) * texel).rgb - threshold, vec3(0.0)) * 0.35;
        bloomAccum += max(texture2D(tDiffuse, uv + vec2(r1, 0.0) * texel).rgb - threshold, vec3(0.0)) * 0.35;
        bloomAccum += max(texture2D(tDiffuse, uv + vec2(0.0, -r1) * texel).rgb - threshold, vec3(0.0)) * 0.35;
        bloomAccum += max(texture2D(tDiffuse, uv + vec2(0.0, r1) * texel).rgb - threshold, vec3(0.0)) * 0.35;

        bloomAccum += max(texture2D(tDiffuse, uv + vec2(-r2, -r2) * texel).rgb - threshold, vec3(0.0)) * 0.25;
        bloomAccum += max(texture2D(tDiffuse, uv + vec2(r2, r2) * texel).rgb - threshold, vec3(0.0)) * 0.25;
        bloomAccum += max(texture2D(tDiffuse, uv + vec2(-r3, r3) * texel).rgb - threshold, vec3(0.0)) * 0.18;
        bloomAccum += max(texture2D(tDiffuse, uv + vec2(r3, -r3) * texel).rgb - threshold, vec3(0.0)) * 0.18;

        sceneCol += bloomAccum * (0.85 * uBloom);
      }

      // 5. Anime-Cyber Digital Speedlines
      if (uSpeedLines > 0.05) {
        vec2 center = vec2(0.5, 0.45);
        vec2 dir = uv - center;
        float dist = length(dir);
        float angle = atan(dir.y, dir.x);
        float linePattern = sin(angle * 64.0 + uTime * 24.0);
        linePattern = smoothstep(0.35, 0.95, linePattern);
        float mask = smoothstep(0.22, 0.85, dist) * uSpeedLines;
        vec3 speedLineColor = mix(vec3(0.0, 0.95, 1.0), vec3(1.0, 1.0, 1.0), 0.7);
        sceneCol += speedLineColor * linePattern * mask * 0.65;
      }

      // 6. CRT Scanline Overlay (Subtle cyber visor tech aesthetic)
      float scanline = sin(uv.y * uResolution.y * 0.8) * 0.5 + 0.5;
      float scanlineFactor = mix(1.0, 0.88 + 0.12 * scanline, clamp(uScanlines, 0.0, 1.0));
      sceneCol *= scanlineFactor;

      // 7. Cyberpunk High-Contrast Tone Mapping
      // Deep crush near-black, lift vibrant neon lights to pop
      sceneCol = pow(sceneCol, vec3(1.15)); // Deep contrast curve
      sceneCol = sceneCol * (2.8 * sceneCol + 0.1) / (sceneCol * (2.4 * sceneCol + 1.2) + 0.15);

      // Film grain noise
      float grain = (hash(uv * 1200.0 + fract(uTime * 0.2)) - 0.5) * 0.022;
      sceneCol += vec3(grain);

      gl_FragColor = vec4(clamp(sceneCol, 0.0, 1.0), 1.0);
    }
  `
};
