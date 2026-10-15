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

// Final full-screen pass. The scene is rendered into a linear HDR (half-float)
// target; this pass applies camera-style effects in linear light, then the
// renderer's filmic tone mapping and sRGB output encoding.
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
    uniform float uSpeedLines;
    uniform float uHighSpeedBlur;
    uniform float uWarpIntensity;
    uniform float uFilmGrain;
    uniform float uHeatShimmer;
    uniform float uRainIntensity;
    uniform vec2 uResolution;
    // Kept for API compatibility with GameEngine; no longer drawn.
    uniform float uScanlines;
    uniform float uGlitch;
    uniform float uColorLift;
    varying vec2 vUv;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
    }

    // Highlights above ~1.0 in linear HDR (sun glints, emissive parts).
    vec3 brightPass(vec2 uv) {
      vec3 c = texture2D(tDiffuse, uv).rgb;
      float l = max(c.r, max(c.g, c.b));
      return c * smoothstep(1.0, 2.5, l);
    }

    void main() {
      vec2 uv = vUv;

      // Heat haze over hot ground
      if (uHeatShimmer > 0.01) {
        uv.x += sin(uv.y * 80.0 + uTime * 12.0) * 0.0015 * uHeatShimmer;
      }

      // Portal transit: radial lens twist
      if (uWarpIntensity > 0.01) {
        vec2 d = uv - 0.5;
        float r = length(d);
        float a = atan(d.y, d.x) + uWarpIntensity * 3.0 * (1.0 - smoothstep(0.0, 0.8, r));
        uv = 0.5 + vec2(cos(a), sin(a)) * r * (1.0 - uWarpIntensity * 0.3 * (1.0 - r));
      }

      vec3 col = texture2D(tDiffuse, uv).rgb;

      // Speed: radial motion blur toward the screen edges (no stylised streaks)
      float blur = max(uHighSpeedBlur, uSpeedLines * 0.6) + uWarpIntensity;
      if (blur > 0.02) {
        vec2 center = vec2(0.5, 0.45);
        vec2 dir = (uv - center) * blur * 0.012 * smoothstep(0.15, 0.6, length(uv - center));
        vec3 acc = col;
        for (int i = 1; i <= 5; i++) {
          acc += texture2D(tDiffuse, uv - dir * float(i)).rgb;
        }
        col = acc / 6.0;
      }

      // Subtle lateral chromatic aberration at the lens edge only
      float ca = uChromaticAberration;
      float edge = length(uv - 0.5);
      if (ca > 0.0001 && edge > 0.3) {
        vec2 off = (uv - 0.5) * ca * smoothstep(0.3, 0.75, edge);
        col.r = texture2D(tDiffuse, uv - off).r;
        col.b = texture2D(tDiffuse, uv + off).b;
      }

      // Soft bloom from true highlights (13-tap disc)
      if (uBloom > 0.02) {
        vec2 texel = 1.0 / max(uResolution, vec2(1.0));
        vec3 b = brightPass(uv) * 0.2;
        for (int i = 0; i < 12; i++) {
          float ang = float(i) * 0.5236;
          float rad = (i < 6 ? 4.0 : 10.0);
          b += brightPass(uv + vec2(cos(ang), sin(ang)) * rad * texel) * (i < 6 ? 0.09 : 0.045);
        }
        col += b * uBloom;
      }

      // Portal transit flash (white, like over-exposure)
      if (uWarpIntensity > 0.05) {
        col += vec3(1.0) * uWarpIntensity * 0.6;
      }

      // Raindrops on the lens
      if (uRainIntensity > 0.05) {
        float streak = smoothstep(0.92, 0.98, sin((uv.x + uv.y * 0.5 + uTime * 3.0) * 120.0)) * uRainIntensity;
        col += vec3(0.6, 0.7, 0.8) * streak * 0.15;
      }

      // Natural lens vignette
      col *= mix(0.78, 1.0, smoothstep(0.85, 0.3, length(vUv - 0.5)));

      // Fine film grain
      if (uFilmGrain > 0.005) {
        col += (hash(vUv + fract(uTime * 0.37)) - 0.5) * uFilmGrain * 0.04;
      }

      gl_FragColor = vec4(max(col, vec3(0.0)), 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }
  `
};
