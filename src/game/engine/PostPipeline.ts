import * as THREE from 'three';
import { BloomBlurShader, BloomBrightPassShader, PostProcessShader } from '../../graphics/shaders';

/**
 * Gaussian weights/offsets for a 9-fetch separable blur covering +-8 texels:
 * adjacent texel pairs are merged into one bilinear fetch (linear sampling).
 */
function gaussianLinearKernel(sigma: number, weights: number[], offsets: number[]): void {
  const g: number[] = [];
  let sum = 0;
  for (let k = 0; k <= 8; k++) {
    const v = Math.exp(-(k * k) / (2 * sigma * sigma));
    g.push(v);
    sum += k === 0 ? v : 2 * v;
  }
  for (let k = 0; k <= 8; k++) g[k] /= sum;
  weights[0] = g[0];
  offsets[0] = 0;
  for (let i = 1; i <= 4; i++) {
    const a = 2 * i - 1;
    const b = 2 * i;
    const w = g[a] + g[b];
    weights[i] = w;
    offsets[i] = w > 0 ? (a * g[a] + b * g[b]) / w : a;
  }
}

function makeHdrTarget(w: number, h: number, depth: boolean, samples = 0): THREE.WebGLRenderTarget {
  return new THREE.WebGLRenderTarget(Math.max(1, w), Math.max(1, h), {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format: THREE.RGBAFormat,
    type: THREE.HalfFloatType,
    depthBuffer: depth,
    // The scene target keeps a stencil: the road marks its pixels so a portal
    // window never covers it (the main pass draws the road through the opening).
    stencilBuffer: depth,
    samples,
  });
}

/**
 * Scene -> linear HDR target -> (quarter-res bloom) -> final post pass.
 *
 * The bloom is a bright pass downsampled straight to 1/4 resolution, then a
 * separable 9-fetch gaussian there (two passes on 1/16 of the pixels), and a
 * single bilinear fetch in the final pass. The old shader read ~45 full-res
 * taps per pixel for the same look.
 */
export class PostPipeline {
  public sceneTarget: THREE.WebGLRenderTarget;
  public postMaterial: THREE.ShaderMaterial;

  private renderer: THREE.WebGLRenderer;
  private bloomA: THREE.WebGLRenderTarget;
  private bloomB: THREE.WebGLRenderTarget;
  private brightMaterial: THREE.ShaderMaterial;
  private blurMaterial: THREE.ShaderMaterial;
  private quadScene = new THREE.Scene();
  private quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, -1, 1);
  private quadGeom = new THREE.PlaneGeometry(2, 2);
  private quad: THREE.Mesh;
  private width = 1;
  private height = 1;
  private samples: number;
  private blankBloom: THREE.DataTexture;

  constructor(renderer: THREE.WebGLRenderer, width: number, height: number, samples: number, uniforms: Record<string, THREE.IUniform>) {
    this.renderer = renderer;
    this.samples = samples;
    this.width = Math.max(1, Math.round(width));
    this.height = Math.max(1, Math.round(height));
    this.sceneTarget = makeHdrTarget(this.width, this.height, true, samples);
    const qw = Math.max(1, Math.round(this.width / 4));
    const qh = Math.max(1, Math.round(this.height / 4));
    this.bloomA = makeHdrTarget(qw, qh, false);
    this.bloomB = makeHdrTarget(qw, qh, false);

    this.blankBloom = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
    this.blankBloom.needsUpdate = true;

    this.postMaterial = new THREE.ShaderMaterial({
      vertexShader: PostProcessShader.vertexShader,
      fragmentShader: PostProcessShader.fragmentShader,
      uniforms: {
        ...uniforms,
        tDiffuse: { value: this.sceneTarget.texture },
        tBloom: { value: this.bloomA.texture },
        uMotionBlur: { value: 1 },
        uBlurThreshold: { value: 0.3 },
      },
      depthWrite: false,
      depthTest: false,
    });

    this.brightMaterial = new THREE.ShaderMaterial({
      vertexShader: BloomBrightPassShader.vertexShader,
      fragmentShader: BloomBrightPassShader.fragmentShader,
      uniforms: {
        tDiffuse: { value: this.sceneTarget.texture },
        uTexel: { value: new THREE.Vector2(1 / this.width, 1 / this.height) },
        uExposure: { value: 1 },
      },
      depthWrite: false,
      depthTest: false,
      toneMapped: false,
    });

    this.blurMaterial = new THREE.ShaderMaterial({
      vertexShader: BloomBlurShader.vertexShader,
      fragmentShader: BloomBlurShader.fragmentShader,
      uniforms: {
        tInput: { value: null },
        uDir: { value: new THREE.Vector2() },
        uWeights: { value: [0, 0, 0, 0, 0] },
        uOffsets: { value: [0, 0, 0, 0, 0] },
      },
      depthWrite: false,
      depthTest: false,
      toneMapped: false,
    });

    this.quad = new THREE.Mesh(this.quadGeom, this.postMaterial);
    this.quad.frustumCulled = false;
    this.quadScene.add(this.quad);
    this.updateBloomKernel();
  }

  get msaaSamples(): number {
    return this.samples;
  }

  /** Resize every target (drawing-buffer pixels). */
  setSize(width: number, height: number): void {
    const w = Math.max(1, Math.round(width));
    const h = Math.max(1, Math.round(height));
    if (w === this.width && h === this.height) return;
    this.width = w;
    this.height = h;
    this.sceneTarget.setSize(w, h);
    const qw = Math.max(1, Math.round(w / 4));
    const qh = Math.max(1, Math.round(h / 4));
    this.bloomA.setSize(qw, qh);
    this.bloomB.setSize(qw, qh);
    (this.brightMaterial.uniforms.uTexel.value as THREE.Vector2).set(1 / w, 1 / h);
    const res = this.postMaterial.uniforms.uResolution;
    if (res && res.value) (res.value as THREE.Vector2).set(w, h);
    this.updateBloomKernel();
  }

  /** MSAA sample count of the scene target; rebuilds it when it changes. */
  setSamples(samples: number): void {
    if (samples === this.samples) return;
    this.samples = samples;
    this.sceneTarget.dispose();
    this.sceneTarget = makeHdrTarget(this.width, this.height, true, samples);
    this.postMaterial.uniforms.tDiffuse.value = this.sceneTarget.texture;
    this.brightMaterial.uniforms.tDiffuse.value = this.sceneTarget.texture;
  }

  // Same look as the old 40 px (at 1080p) golden-angle disc: sigma ~16 px
  // at 1080p, i.e. ~4 quarter-res texels, scaled with the output height.
  private updateBloomKernel(): void {
    const sigmaQuarter = THREE.MathUtils.clamp((4 * this.height) / 1080, 1.25, 4.5);
    gaussianLinearKernel(sigmaQuarter, this.blurMaterial.uniforms.uWeights.value, this.blurMaterial.uniforms.uOffsets.value);
  }

  private drawQuad(material: THREE.Material, target: THREE.WebGLRenderTarget | null): number {
    this.quad.material = material;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.quadScene, this.quadCamera);
    return this.renderer.info.render.calls;
  }

  /** Renders the frame; returns the total draw calls issued. */
  render(scene: THREE.Scene, camera: THREE.Camera): number {
    const r = this.renderer;
    r.setRenderTarget(this.sceneTarget);
    r.render(scene, camera);
    let calls = r.info.render.calls;

    const u = this.postMaterial.uniforms;
    if ((u.uBloom.value as number) > 0.02) {
      // The bright-pass threshold applies to exposed colour (see BloomBrightPassShader).
      this.brightMaterial.uniforms.uExposure.value = r.toneMappingExposure;
      calls += this.drawQuad(this.brightMaterial, this.bloomA);
      const bu = this.blurMaterial.uniforms;
      bu.tInput.value = this.bloomA.texture;
      (bu.uDir.value as THREE.Vector2).set(1 / this.bloomA.width, 0);
      calls += this.drawQuad(this.blurMaterial, this.bloomB);
      bu.tInput.value = this.bloomB.texture;
      (bu.uDir.value as THREE.Vector2).set(0, 1 / this.bloomA.height);
      calls += this.drawQuad(this.blurMaterial, this.bloomA);
      u.tBloom.value = this.bloomA.texture;
    } else {
      u.tBloom.value = this.blankBloom;
    }

    calls += this.drawQuad(this.postMaterial, null);
    return calls;
  }

  /** Compile the post/bloom programs up front (avoids a first-frame stall). */
  compile(): void {
    // Program keys depend on the output target (tone mapping / colour space
    // only apply on screen), so compile each pass against its real target.
    const prev = this.renderer.getRenderTarget();
    const passes: [THREE.Material, THREE.WebGLRenderTarget | null][] = [
      [this.postMaterial, null],
      [this.brightMaterial, this.bloomA],
      [this.blurMaterial, this.bloomB],
    ];
    for (const [m, target] of passes) {
      this.quad.material = m;
      this.renderer.setRenderTarget(target);
      this.renderer.compile(this.quadScene, this.quadCamera);
    }
    this.renderer.setRenderTarget(prev);
    this.quad.material = this.postMaterial;
  }

  /** Same as compile(), linking in the background; resolves once every pass is ready. */
  compileAsync(): Promise<void> {
    const prev = this.renderer.getRenderTarget();
    const passes: [THREE.Material, THREE.WebGLRenderTarget | null][] = [
      [this.postMaterial, null],
      [this.brightMaterial, this.bloomA],
      [this.blurMaterial, this.bloomB],
    ];
    const jobs: Promise<unknown>[] = [];
    try {
      for (const [m, target] of passes) {
        this.quad.material = m;
        this.renderer.setRenderTarget(target);
        // The program is created right here; the promise only waits for the link.
        jobs.push(this.renderer.compileAsync(this.quadScene, this.quadCamera));
      }
    } finally {
      this.renderer.setRenderTarget(prev);
      this.quad.material = this.postMaterial;
    }
    return Promise.all(jobs).then(
      () => undefined,
      () => undefined
    );
  }

  dispose(): void {
    this.sceneTarget.dispose();
    this.bloomA.dispose();
    this.bloomB.dispose();
    this.blankBloom.dispose();
    this.postMaterial.dispose();
    this.brightMaterial.dispose();
    this.blurMaterial.dispose();
    this.quadGeom.dispose();
  }
}
