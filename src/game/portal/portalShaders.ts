/**
 * Shaders of the portal gateway: the membrane (a window into the next world)
 * and the soft light beam above the arch.
 */

export const MEMBRANE_VERTEX = /* glsl */ `
  varying vec2 vLocal;
  varying vec3 vWorldPos;
  varying vec3 vWorldNormal;
  void main() {
    vLocal = position.xy;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

/**
 * The opening shows the next world, rendered from the main camera into a
 * reduced-resolution target (see PortalWindow) and sampled in screen space:
 * local = (gl_FragCoord - rect.xy) / rect.zw maps this pixel into the
 * sub-rectangle that pass rendered, so the view lines up exactly. A faint
 * heat-haze ripple bends the view near the stone, and a thin energy glow
 * (destination colour) lines the rim and grazing angles. Without a live pass
 * (lowest tier) the opening shows a static gradient of the destination sky.
 * Distance fade: the same ordered dither as the far scenery band.
 */
export const MEMBRANE_FRAGMENT = /* glsl */ `
  uniform sampler2D tWindow;
  uniform vec4 uRect;
  uniform vec2 uWinScale;
  uniform vec2 uWinTexel;
  uniform float uLive;
  uniform float uExposure;
  uniform vec3 uTintTop;
  uniform vec3 uTintHorizon;
  uniform vec3 uEnergy;
  uniform float uTime;
  uniform float uHalfW;
  uniform float uSpringY;
  uniform vec2 uFadeFar;
  varying vec2 vLocal;
  varying vec3 vWorldPos;
  varying vec3 vWorldNormal;

  void main() {
    float vis = 1.0 - smoothstep(uFadeFar.x, uFadeFar.y, vWorldPos.z);
    if (vis < 0.999) {
      float ign = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
      if (vis <= ign) discard;
    }

    vec2 p = vLocal;
    // Distance (m) to the stone: the jambs below the springing, the arch above.
    float edgeDist = p.y <= uSpringY ? uHalfW - abs(p.x) : uHalfW - length(vec2(p.x, p.y - uSpringY));
    float rim = 1.0 - smoothstep(0.0, 1.6, edgeDist);
    float t = uTime;
    vec2 ripple = vec2(
      sin(p.y * 2.7 + t * 2.1) + 0.6 * sin(p.x * 4.3 - t * 3.3 + p.y * 1.3),
      sin(p.x * 2.3 - t * 1.8) + 0.6 * sin(p.y * 3.9 + t * 2.7)
    );

    vec3 col;
    if (uLive > 0.5) {
      vec2 local = (gl_FragCoord.xy - uRect.xy) / uRect.zw;
      local += ripple * (rim * rim * 0.0045 + 0.0004);
      vec2 uv = clamp(local, 0.0, 1.0) * uWinScale;
      uv = clamp(uv, uWinTexel * 0.5, uWinScale - uWinTexel * 0.5);
      col = texture2D(tWindow, uv).rgb * uExposure;
    } else {
      float h = clamp(p.y / (uSpringY + uHalfW), 0.0, 1.0);
      col = mix(uTintHorizon, uTintTop, smoothstep(0.0, 1.0, h));
      col *= 1.0 + 0.04 * (ripple.x * rim);
    }

    vec3 V = normalize(cameraPosition - vWorldPos);
    float fres = pow(1.0 - clamp(abs(dot(normalize(vWorldNormal), V)), 0.0, 1.0), 4.0);
    float shimmer = 0.8 + 0.2 * sin(t * 1.3 + p.x * 0.9 + p.y * 0.6);
    col += uEnergy * (rim * rim * rim * 0.55 * shimmer + fres * 0.2 + 0.015);

    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export const BEAM_VERTEX = /* glsl */ `
  varying vec3 vWorldPos;
  varying vec3 vWorldNormal;
  varying float vH;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vH = uv.y;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

/**
 * Soft additive shaft of light rising from the arch: brightest where the
 * cylinder faces the viewer (so its silhouette edges dissolve), fading in
 * from the arch and out with height. Unfogged, so it marks the gateway from
 * far away even in a hazy world; slow drifting variation keeps it from
 * looking like a solid tube.
 */
export const BEAM_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform float uIntensity;
  uniform float uTime;
  varying vec3 vWorldPos;
  varying vec3 vWorldNormal;
  varying float vH;
  void main() {
    vec3 V = normalize(cameraPosition - vWorldPos);
    float facing = abs(dot(normalize(vWorldNormal), V));
    float soft = facing * facing * facing;
    float vert = smoothstep(0.0, 0.05, vH) * pow(1.0 - vH, 1.8);
    float drift = 0.78 + 0.22 * sin(uTime * 0.55 + vWorldPos.y * 0.012 + vWorldPos.x * 0.25);
    gl_FragColor = vec4(uColor * (soft * vert * drift * uIntensity), 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;
