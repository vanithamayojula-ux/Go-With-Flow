import * as THREE from 'three';
import {
  PostProcessShader,
  SSAOShader,
  SSAOBlurShader,
  SSAOApplyShader,
  SSRShader,
  VolumetricLightShader,
  FXAAShader,
  TAAShader,
  DoFShader,
} from './shaders';
import { GraphicsConfig, ShaderParams } from '../types';

/**
 * Multi-pass deferred-ish post-processing pipeline.
 *
 * Order: scene -> SSAO -> volumetric -> SSR -> bloom/grade composite -> DoF -> AA.
 * Every pass is optional and driven by GraphicsConfig, so the mobile and
 * webgl-min presets fall back to a single composite with no extra targets.
 */
export class PostPipeline {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;

  // HDR scene target (linear, half-float where supported)
  sceneTarget!: THREE.WebGLRenderTarget;
  private aoTarget!: THREE.WebGLRenderTarget;
  private aoBlurTarget!: THREE.WebGLRenderTarget;
  // Two full-res scratch buffers. Passes ping-pong between them because a
  // shader cannot sample the render target it is currently writing to.
  private scratchA!: THREE.WebGLRenderTarget;
  private scratchB!: THREE.WebGLRenderTarget;
  private historyTargetA!: THREE.WebGLRenderTarget;
  private historyTargetB!: THREE.WebGLRenderTarget;

  private quadScene: THREE.Scene;
  private quadCamera: THREE.OrthographicCamera;
  private quadGeom: THREE.PlaneGeometry;
  private quadMesh: THREE.Mesh | null = null;

  // Exposed so the settings drawer can retune grade/bloom without a remount.
  readonly compositeMaterial: THREE.ShaderMaterial;
  private ssaoMaterial: THREE.ShaderMaterial;
  private ssaoBlurMaterial: THREE.ShaderMaterial;
  private ssaoApplyMaterial: THREE.ShaderMaterial;
  private ssrMaterial: THREE.ShaderMaterial;
  private volumeMaterial: THREE.ShaderMaterial;
  private dofMaterial: THREE.ShaderMaterial;
  private fxaaMaterial: THREE.ShaderMaterial;
  private taaMaterial: THREE.ShaderMaterial;
  private copyMaterial: THREE.ShaderMaterial | null = null;

  private width = 1;
  private height = 1;
  private dpr = 1;

  /** Halton sequence for the TAA sub-pixel jitter pattern. */
  private frameIndex = 0;
  private jittered = false;

  config: GraphicsConfig;
  shaderParams: ShaderParams;
  disposed = false;

  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    width: number,
    height: number,
    config: GraphicsConfig,
    shaderParams: ShaderParams
  ) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.config = config;
    this.shaderParams = shaderParams;

    this.quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, -1, 1);
    this.quadScene = new THREE.Scene();
    this.quadGeom = new THREE.PlaneGeometry(2, 2);

    this.compositeMaterial = new THREE.ShaderMaterial({
      vertexShader: PostProcessShader.vertexShader,
      fragmentShader: PostProcessShader.fragmentShader,
      uniforms: {
        tDiffuse: { value: null },
        uTime: { value: 0 },
        uBloom: { value: shaderParams.bloomIntensity ?? 0.35 },
        uChromaticAberration: { value: shaderParams.chromaticAberration ?? 0.0005 },
        uScanlines: { value: shaderParams.scanlineIntensity ?? 0 },
        uGlitch: { value: 0 },
        uSpeedLines: { value: 0 },
        uHighSpeedBlur: { value: 0 },
        uWarpIntensity: { value: 0 },
        uFilmGrain: { value: shaderParams.filmGrainIntensity ?? 0 },
        uHeatShimmer: { value: 0 },
        uColorLift: { value: shaderParams.colorLift ?? 0.2 },
        uRainIntensity: { value: 0 },
        uExposure: { value: 1.05 },
        uSharpen: { value: 0.6 },
        uResolution: { value: new THREE.Vector2(1, 1) },
      },
      depthWrite: false,
      depthTest: false,
    });

    this.ssaoMaterial = new THREE.ShaderMaterial({
      vertexShader: SSAOShader.vertexShader,
      fragmentShader: SSAOShader.fragmentShader,
      uniforms: {
        tDiffuse: { value: null },
        tDepth: { value: null },
        uProjection: { value: new THREE.Matrix4() },
        uInverseProjection: { value: new THREE.Matrix4() },
        uResolution: { value: new THREE.Vector2(1, 1) },
        uRadius: { value: 0.75 },
        uIntensity: { value: 1.0 },
        uBias: { value: 0.02 },
      },
      depthWrite: false,
      depthTest: false,
    });

    this.ssaoBlurMaterial = new THREE.ShaderMaterial({
      vertexShader: SSAOBlurShader.vertexShader,
      fragmentShader: SSAOBlurShader.fragmentShader,
      uniforms: {
        tDiffuse: { value: null },
        tAO: { value: null },
        uTexelSize: { value: new THREE.Vector2() },
      },
      depthWrite: false,
      depthTest: false,
    });

    this.ssaoApplyMaterial = new THREE.ShaderMaterial({
      vertexShader: SSAOApplyShader.vertexShader,
      fragmentShader: SSAOApplyShader.fragmentShader,
      uniforms: {
        tDiffuse: { value: null },
        tAO: { value: null },
        uStrength: { value: 0.85 },
      },
      depthWrite: false,
      depthTest: false,
    });

    this.ssrMaterial = new THREE.ShaderMaterial({
      vertexShader: SSRShader.vertexShader,
      fragmentShader: SSRShader.fragmentShader,
      uniforms: {
        tDiffuse: { value: null },
        tDepth: { value: null },
        uProjection: { value: new THREE.Matrix4() },
        uInverseProjection: { value: new THREE.Matrix4() },
        uResolution: { value: new THREE.Vector2(1, 1) },
        uMaxDistance: { value: 45.0 },
        uThickness: { value: 0.9 },
        uIntensity: { value: 0.7 },
        uReflectionTint: { value: new THREE.Color(0.85, 0.95, 1.0) },
      },
      depthWrite: false,
      depthTest: false,
    });

    this.volumeMaterial = new THREE.ShaderMaterial({
      vertexShader: VolumetricLightShader.vertexShader,
      fragmentShader: VolumetricLightShader.fragmentShader,
      uniforms: {
        tDiffuse: { value: null },
        tDepth: { value: null },
        uSunScreenPos: { value: new THREE.Vector2(0.5, 0.9) },
        uSunColor: { value: new THREE.Color(0x66d9ff) },
        uDensity: { value: 0.85 },
        uDecay: { value: 0.94 },
        uWeight: { value: 0.28 },
      },
      depthWrite: false,
      depthTest: false,
    });

    this.dofMaterial = new THREE.ShaderMaterial({
      vertexShader: DoFShader.vertexShader,
      fragmentShader: DoFShader.fragmentShader,
      uniforms: {
        tDiffuse: { value: null },
        tDepth: { value: null },
        uTexelSize: { value: new THREE.Vector2() },
        uFocusDistance: { value: 9.0 },
        uFocusRange: { value: 14.0 },
        uMaxBlur: { value: 3.0 },
      },
      depthWrite: false,
      depthTest: false,
    });

    this.fxaaMaterial = new THREE.ShaderMaterial({
      vertexShader: FXAAShader.vertexShader,
      fragmentShader: FXAAShader.fragmentShader,
      uniforms: {
        tDiffuse: { value: null },
        uResolution: { value: new THREE.Vector2(1, 1) },
      },
      depthWrite: false,
      depthTest: false,
    });

    this.taaMaterial = new THREE.ShaderMaterial({
      vertexShader: TAAShader.vertexShader,
      fragmentShader: TAAShader.fragmentShader,
      uniforms: {
        tDiffuse: { value: null },
        tHistory: { value: null },
        tDepth: { value: null },
        uTexelSize: { value: new THREE.Vector2() },
        uFeedback: { value: 0.90 },
      },
      depthWrite: false,
      depthTest: false,
    });

    this.setSize(width, height);
  }

  get isJittering(): boolean {
    return this.jittered;
  }

  setSize(width: number, height: number): void {
    const w = Math.max(1, Math.floor(width));
    const h = Math.max(1, Math.floor(height));
    if (w === this.width && h === this.height && this.sceneTarget) return;

    this.width = w;
    this.height = h;
    this.dpr = this.renderer.getPixelRatio();
    const pw = Math.floor(w * this.dpr);
    const ph = Math.floor(h * this.dpr);

    const caps = this.renderer.capabilities;
    // Half-float keeps neon HDR cores above 1.0 so the tonemap has headroom to
    // roll them off. MSAA on the HDR target is what actually smooths geometry
    // edges; FXAA/TAA alone cannot.
    const type = caps.isWebGL2 ? THREE.HalfFloatType : THREE.UnsignedByteType;
    const samples = caps.isWebGL2 ? 4 : 0;

    if (!this.sceneTarget) {
      this.sceneTarget = new THREE.WebGLRenderTarget(pw, ph, {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat,
        type,
        samples,
        depthBuffer: true,
        stencilBuffer: false,
      });
      // SSAO/SSR/DoF/TAA all reconstruct view position from depth, which needs
      // a *sampleable* depth attachment — a plain depthBuffer is write-only
      // from the shader's point of view.
      this.sceneTarget.depthTexture = new THREE.DepthTexture(pw, ph);
      this.sceneTarget.depthTexture.type = THREE.UnsignedIntType;
      this.sceneTarget.depthTexture.minFilter = THREE.NearestFilter;
      this.sceneTarget.depthTexture.magFilter = THREE.NearestFilter;
    } else {
      this.sceneTarget.setSize(pw, ph);
    }

    // Half-res auxiliary targets: AO and volumetric are low-frequency signals,
    // and SSR is heavily blurred, so full-res buys nothing but fill rate.
    const aw = Math.max(1, Math.floor(pw / 2));
    const ah = Math.max(1, Math.floor(ph / 2));

    const mkAux = (existing: THREE.WebGLRenderTarget | undefined, sw: number, sh: number, withDepth: boolean) => {
      if (existing) {
        existing.setSize(sw, sh);
        return existing;
      }
      return new THREE.WebGLRenderTarget(sw, sh, {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat,
        type: THREE.UnsignedByteType,
        depthBuffer: withDepth,
        stencilBuffer: false,
      });
    };

    this.aoTarget = mkAux(this.aoTarget, aw, ah, false);
    this.aoBlurTarget = mkAux(this.aoBlurTarget, aw, ah, false);
    this.scratchA = mkAux(this.scratchA, pw, ph, false);
    this.scratchB = mkAux(this.scratchB, pw, ph, false);
    this.historyTargetA = mkAux(this.historyTargetA, pw, ph, false);
    this.historyTargetB = mkAux(this.historyTargetB, pw, ph, false);

    this.compositeMaterial.uniforms.uResolution.value.set(pw, ph);
    this.ssaoMaterial.uniforms.uResolution.value.set(aw, ah);
    this.ssrMaterial.uniforms.uResolution.value.set(pw, ph);
    this.fxaaMaterial.uniforms.uResolution.value.set(pw, ph);
    this.ssaoBlurMaterial.uniforms.uTexelSize.value.set(1 / aw, 1 / ah);
    this.dofMaterial.uniforms.uTexelSize.value.set(1 / pw, 1 / ph);
    this.taaMaterial.uniforms.uTexelSize.value.set(1 / pw, 1 / ph);
  }

  updateConfig(config: GraphicsConfig, shaderParams: ShaderParams): void {
    this.config = config;
    this.shaderParams = shaderParams;
  }

  private blit(material: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget | null): void {
    if (!this.quadMesh) {
      this.quadMesh = new THREE.Mesh(this.quadGeom, material);
      this.quadMesh.frustumCulled = false;
      this.quadScene.add(this.quadMesh);
    } else {
      this.quadMesh.material = material;
    }
    this.renderer.setRenderTarget(target);
    this.renderer.clear(true, false, false);
    this.renderer.render(this.quadScene, this.quadCamera);
  }

  /** Halton(2,3) sub-pixel jitter projected through the current view matrix. */
  private updateJitter(enabled: boolean): void {
    if (!enabled) {
      if (this.jittered) {
        this.camera.projectionMatrix.elements[8] = 0;
        this.camera.projectionMatrix.elements[9] = 0;
        this.camera.updateProjectionMatrix();
        this.jittered = false;
      }
      return;
    }

    const halton = (index: number, base: number) => {
      let f = 1, r = 0, i = index;
      while (i > 0) {
        f /= base;
        r += f * (i % base);
        i = Math.floor(i / base);
      }
      return r;
    };

    this.frameIndex = (this.frameIndex + 1) % 8;
    const jx = (halton(this.frameIndex, 2) - 0.5) * 2;
    const jy = (halton(this.frameIndex, 3) - 0.5) * 2;
    this.camera.projectionMatrix.elements[8] = jx;
    this.camera.projectionMatrix.elements[9] = jy;
    this.jittered = true;
  }

  /**
   * Render one frame through the pipeline.
   * `compositeUniforms` carries per-frame gameplay-driven values that the
   * GameCanvas computes (speed lines, glitch, warp, etc).
   */
  render(compositeUniforms: Partial<{
    time: number;
    speedLines: number;
    glitch: number;
    warp: number;
    heatShimmer: number;
    chromaticAberration: number;
    sunWorldPos: THREE.Vector3;
    sunColor: THREE.Color;
    volumetricStrength: number;
    focusDistance: number;
    focusRange: number;
  }>): void {
    const cfg = this.config;
    const renderer = this.renderer;
    const camera = this.camera;

    const useSSAO = !!cfg.ssaoEnabled && cfg.enablePostProcess;
    const useSSR = !!cfg.ssrEnabled && cfg.enablePostProcess;
    const useVolumetric = !!cfg.volumetricLighting && cfg.enablePostProcess;
    const useDoF = !!cfg.dofEnabled && cfg.enablePostProcess && !!(compositeUniforms.focusDistance !== undefined);
    const aaQuality = cfg.aaQuality ?? 'off';
    const useTAA = aaQuality === 'taa' && cfg.enablePostProcess;
    const useFXAA = aaQuality === 'fxaa' && cfg.enablePostProcess;

    // TAA jitter must be applied before the scene render so motion vectors and
    // the depth buffer agree with the resolve.
    this.updateJitter(useTAA);

    // 1. Main scene -> HDR target
    renderer.setRenderTarget(this.sceneTarget);
    renderer.clear();
    renderer.render(this.scene, camera);

    const depthTexture = this.sceneTarget.depthTexture;
    if (!depthTexture) {
      // Depth texture is required by SSAO/SSR/DoF/TAA. Without it, degrade to
      // the plain composite rather than sampling an undefined depth buffer.
      this.compositeMaterial.uniforms.tDiffuse.value = this.sceneTarget.texture;
      this.applyCompositeUniforms(compositeUniforms);
      this.blit(this.compositeMaterial, null);
      return;
    }

    this.ssaoMaterial.uniforms.uProjection.value.copy(camera.projectionMatrix);
    this.ssaoMaterial.uniforms.uInverseProjection.value.copy(camera.projectionMatrixInverse);

    let currentTexture = this.sceneTarget.texture;

    // 2. SSAO -> blur -> apply to scene colour
    if (useSSAO) {
      this.ssaoMaterial.uniforms.tDiffuse.value = currentTexture;
      this.ssaoMaterial.uniforms.tDepth.value = depthTexture;
      this.blit(this.ssaoMaterial, this.aoTarget);

      this.ssaoBlurMaterial.uniforms.tAO.value = this.aoTarget.texture;
      this.ssaoBlurMaterial.uniforms.tDiffuse.value = currentTexture;
      this.blit(this.ssaoBlurMaterial, this.aoBlurTarget);

      this.ssaoApplyMaterial.uniforms.tDiffuse.value = currentTexture;
      this.ssaoApplyMaterial.uniforms.tAO.value = this.aoBlurTarget.texture;
      this.blit(this.ssaoApplyMaterial, this.scratchA);
      currentTexture = this.scratchA.texture;
    }

    // 3. SSR (wet road / metal reflections)
    if (useSSR) {
      this.ssrMaterial.uniforms.tDiffuse.value = currentTexture;
      this.ssrMaterial.uniforms.tDepth.value = depthTexture;
      this.ssrMaterial.uniforms.uProjection.value.copy(camera.projectionMatrix);
      this.ssrMaterial.uniforms.uInverseProjection.value.copy(camera.projectionMatrixInverse);
      this.blit(this.ssrMaterial, this.scratchB);
      currentTexture = this.scratchB.texture;
    }

    // 4. Volumetric light shafts (additive)
    if (useVolumetric && compositeUniforms.sunWorldPos) {
      const sunWorld = compositeUniforms.sunWorldPos;
      // Project the sun direction to screen space for the radial-blur origin.
      const proj = new THREE.Vector3(
        sunWorld.x - camera.position.x,
        sunWorld.y - camera.position.y,
        sunWorld.z - camera.position.z
      );
      proj.applyMatrix4(camera.matrixWorldInverse);
      const sunClip = proj.clone().applyMatrix4(camera.projectionMatrix);
      let sx = sunClip.x * 0.5 + 0.5;
      let sy = sunClip.y * 0.5 + 0.5;
      // Behind the camera: mirror the point so the shafts still stream backward.
      if (sunClip.z > 1) {
        sx = 1.0 - sx;
        sy = 1.0 - sy;
      }
      this.volumeMaterial.uniforms.tDiffuse.value = currentTexture;
      this.volumeMaterial.uniforms.tDepth.value = depthTexture;
      this.volumeMaterial.uniforms.uSunScreenPos.value.set(sx, sy);
      if (compositeUniforms.sunColor) {
        this.volumeMaterial.uniforms.uSunColor.value.copy(compositeUniforms.sunColor);
      }
      this.volumeMaterial.uniforms.uWeight.value = compositeUniforms.volumetricStrength ?? 0.28;
      // Additive blending means this pass must not clear its target first.
      const volumeTarget = currentTexture === this.scratchA.texture ? this.scratchB : this.scratchA;
      this.blitAdditive(this.volumeMaterial, volumeTarget, currentTexture);
      currentTexture = volumeTarget.texture;
    }

    // 5. Composite (bloom + grade + tonemap + FX)
    this.compositeMaterial.uniforms.tDiffuse.value = currentTexture;
    this.applyCompositeUniforms(compositeUniforms);

    const dofEnabled = useDoF;
    if (!dofEnabled && !useTAA && !useFXAA) {
      this.blit(this.compositeMaterial, null);
      renderer.setRenderTarget(null);
      return;
    }

    // Composite into scratchA so DoF/TAA have a source that is not the same
    // texture they are about to write into.
    this.blit(this.compositeMaterial, this.scratchA);

    // 6. Depth of field
    if (dofEnabled) {
      this.dofMaterial.uniforms.tDiffuse.value = this.scratchA.texture;
      this.dofMaterial.uniforms.tDepth.value = depthTexture;
      this.dofMaterial.uniforms.uFocusDistance.value = compositeUniforms.focusDistance ?? 9.0;
      this.dofMaterial.uniforms.uFocusRange.value = compositeUniforms.focusRange ?? 14.0;
      this.blit(this.dofMaterial, this.scratchB);
    } else {
      // Nothing to blur: hand the composite forward without a round trip.
      this.copyTexture(this.scratchA.texture, this.scratchB);
    }

    // 7. Anti-aliasing resolve
    if (useTAA) {
      // History holds the previous frame's resolve. Write this frame's result
      // into the *other* history buffer, show it, then swap — reading and
      // writing the same history texture would feed the resolve its own output.
      this.taaMaterial.uniforms.tDiffuse.value = this.scratchB.texture;
      this.taaMaterial.uniforms.tHistory.value = this.historyTargetA.texture;
      this.taaMaterial.uniforms.tDepth.value = depthTexture;
      this.blit(this.taaMaterial, this.historyTargetB);
      this.copyTexture(this.historyTargetB.texture, null);

      const swap = this.historyTargetA;
      this.historyTargetA = this.historyTargetB;
      this.historyTargetB = swap;
    } else if (useFXAA) {
      this.fxaaMaterial.uniforms.tDiffuse.value = this.scratchB.texture;
      this.blit(this.fxaaMaterial, null);
    } else {
      this.copyTexture(this.scratchB.texture, null);
    }

    renderer.setRenderTarget(null);
  }

  /** Straight texture copy, used to seed history/passthrough buffers. */
  private copyTexture(src: THREE.Texture, target: THREE.WebGLRenderTarget | null): void {
    if (!this.copyMaterial) {
      this.copyMaterial = new THREE.ShaderMaterial({
        vertexShader: FXAAShader.vertexShader,
        fragmentShader: `
          uniform sampler2D tDiffuse;
          varying vec2 vUv;
          void main() { gl_FragColor = vec4(texture2D(tDiffuse, vUv).rgb, 1.0); }
        `,
        uniforms: { tDiffuse: { value: null } },
        depthWrite: false,
        depthTest: false,
      });
    }
    this.copyMaterial.uniforms.tDiffuse.value = src;
    this.blit(this.copyMaterial, target);
  }

  /**
   * Additive full-screen pass. Copies the source in via a plain quad first so
   * the additive material has a valid base to accumulate onto.
   */
  private blitAdditive(
    material: THREE.ShaderMaterial,
    target: THREE.WebGLRenderTarget,
    source: THREE.Texture
  ): void {
    this.copyTexture(source, target);
    if (!this.quadMesh) {
      this.quadMesh = new THREE.Mesh(this.quadGeom, material);
      this.quadMesh.frustumCulled = false;
      this.quadScene.add(this.quadMesh);
    } else {
      this.quadMesh.material = material;
    }
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.quadScene, this.quadCamera);
  }

  private applyCompositeUniforms(u: Partial<{
    time: number;
    speedLines: number;
    glitch: number;
    warp: number;
    heatShimmer: number;
    chromaticAberration: number;
  }>): void {
    const un = this.compositeMaterial.uniforms;
    if (u.time !== undefined) un.uTime.value = u.time;
    if (u.speedLines !== undefined) un.uSpeedLines.value = u.speedLines;
    if (u.glitch !== undefined) un.uGlitch.value = u.glitch;
    if (u.warp !== undefined) un.uWarpIntensity.value = u.warp;
    if (u.heatShimmer !== undefined) un.uHeatShimmer.value = u.heatShimmer;
    if (u.chromaticAberration !== undefined) un.uChromaticAberration.value = u.chromaticAberration;
    un.uFilmGrain.value = this.shaderParams.filmGrainIntensity ?? 0;
    un.uBloom.value = this.shaderParams.bloomIntensity ?? 0.35;
    un.uColorLift.value = this.shaderParams.colorLift ?? 0.2;
    un.uScanlines.value = this.shaderParams.scanlineIntensity ?? 0;
    un.uRainIntensity.value = this.shaderParams.rainIntensity ?? 0;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.sceneTarget?.dispose();
    this.sceneTarget?.depthTexture?.dispose();
    this.aoTarget?.dispose();
    this.aoBlurTarget?.dispose();
    this.scratchA?.dispose();
    this.scratchB?.dispose();
    this.historyTargetA?.dispose();
    this.historyTargetB?.dispose();
    this.compositeMaterial.dispose();
    this.ssaoMaterial.dispose();
    this.ssaoBlurMaterial.dispose();
    this.ssaoApplyMaterial.dispose();
    this.ssrMaterial.dispose();
    this.volumeMaterial.dispose();
    this.dofMaterial.dispose();
    this.fxaaMaterial.dispose();
    this.taaMaterial.dispose();
    this.copyMaterial?.dispose();
    this.quadGeom.dispose();
  }
}
