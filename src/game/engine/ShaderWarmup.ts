import * as THREE from 'three';

// Mirrors WebGLShadowMap's side flip for shadow casters.
const SHADOW_SIDE: Record<number, THREE.Side> = {
  [THREE.FrontSide]: THREE.BackSide,
  [THREE.BackSide]: THREE.FrontSide,
  [THREE.DoubleSide]: THREE.DoubleSide,
};

/**
 * Asynchronous shader warm-up.
 *
 * `renderer.compileAsync()` only covers the main pass. Shadow casters are
 * drawn in the shadow pass with an internal MeshDepthMaterial whose program
 * depends on the caster (instancing, instance colours, map / alphaMap /
 * alphaTest, displacement, side). Those programs used to compile on the first
 * frame a caster entered the shadow camera, a synchronous stall of up to
 * ~300 ms per program on ANGLE/D3D11. Here each new caster configuration gets
 * a proxy mesh with an identically configured MeshDepthMaterial, compiled
 * with compileAsync; three shares programs by cache key, so the shadow pass
 * then finds them ready.
 */
export class ShaderWarmup {
  private renderer: THREE.WebGLRenderer;
  private camera: THREE.Camera;
  private scene: THREE.Scene;
  private getTarget: () => THREE.WebGLRenderTarget | null;
  private depthSignatures = new Set<string>();
  private warmTarget: THREE.WebGLRenderTarget | null = null;
  private warmCamera = new THREE.PerspectiveCamera(1, 1, 0.01, 0.02);
  // Proxy depth materials stay alive so their programs stay in the cache
  // until the real shadow pass has taken a reference.
  private depthKeepAlive: THREE.Material[] = [];

  constructor(
    renderer: THREE.WebGLRenderer,
    camera: THREE.Camera,
    scene: THREE.Scene,
    getTarget: () => THREE.WebGLRenderTarget | null
  ) {
    this.renderer = renderer;
    this.camera = camera;
    this.scene = scene;
    this.getTarget = getTarget;
  }

  /**
   * Compile main-pass and shadow-pass programs for these objects (they need
   * not be in the scene or visible). Resolves once every program is linked.
   */
  compile(roots: THREE.Object3D[]): Promise<void> {
    const r = this.renderer;
    const promises: Promise<unknown>[] = [];
    const prev = r.getRenderTarget();
    // Program keys depend on the output target (tone mapping / colour space).
    r.setRenderTarget(this.getTarget());
    try {
      for (const root of roots) promises.push(r.compileAsync(root, this.camera, this.scene));
      if (r.shadowMap.enabled) {
        const proxies = this.buildDepthProxies(roots);
        if (proxies) {
          // The shadow pass draws casters without the scene's fog (it renders
          // with no scene): compile the proxies the same way so the keys match.
          const fog = this.scene.fog;
          this.scene.fog = null;
          try {
            promises.push(r.compileAsync(proxies, this.camera, this.scene));
          } finally {
            this.scene.fog = fog;
          }
        }
      }
    } catch (err) {
      console.warn('[ShaderWarmup] compile failed:', err);
    } finally {
      r.setRenderTarget(prev);
    }
    return Promise.all(promises).then(
      () => undefined,
      () => undefined
    );
  }

  /**
   * True if drawing this object now could compile a shader on the spot: one
   * of its materials has never been compiled, or it casts a shadow with a
   * depth configuration not compiled yet.
   */
  needsCompile(object: THREE.Object3D): boolean {
    const props = this.renderer.properties;
    const shadows = this.renderer.shadowMap.enabled;
    let needed = false;
    object.traverse(o => {
      if (needed) return;
      const mesh = o as THREE.Mesh;
      if (!(mesh.isMesh || (o as THREE.Points).isPoints || (o as THREE.Line).isLine || (o as THREE.Sprite).isSprite)) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) {
        if (m && (props.get(m) as { currentProgram?: unknown }).currentProgram === undefined) {
          needed = true;
          return;
        }
      }
      if (shadows && mesh.isMesh && mesh.castShadow) {
        for (const m of mats) {
          if (!m) continue;
          const sig = this.depthSignature(mesh, m);
          if (sig !== null && !this.depthSignatures.has(sig)) {
            needed = true;
            return;
          }
        }
      }
    });
    return needed;
  }

  /** Identifies the shadow-pass depth program a caster/material pair needs. */
  private depthSignature(o: THREE.Mesh, m: THREE.Material): string | null {
    if ((o as unknown as THREE.SkinnedMesh).isSkinnedMesh || (o as any).isBatchedMesh) return null;
    const geometry = o.geometry;
    if (!geometry || geometry.morphAttributes.position !== undefined || geometry.morphAttributes.normal !== undefined) return null;
    const inst = (o as THREE.InstancedMesh).isInstancedMesh === true;
    const instColor = inst && (o as THREE.InstancedMesh).instanceColor !== null;
    const sm = m as THREE.MeshStandardMaterial;
    const side = m.shadowSide !== null && m.shadowSide !== undefined ? m.shadowSide : SHADOW_SIDE[m.side];
    const alphaTest = m.alphaToCoverage === true ? 0.5 : m.alphaTest;
    return (
      (inst ? 'i' : 'm') + (instColor ? 'c' : '') + '|' + side + '|' +
      (sm.map ? 'map' + sm.map.channel : '') + '|' + (sm.alphaMap ? 'am' + sm.alphaMap.channel : '') + '|' +
      (alphaTest > 0 ? 'at' : '') + '|' + (sm.displacementMap && sm.displacementScale !== 0 ? 'd' : '') + '|' +
      ((m as any).wireframe ? 'w' : '') + '|' + (geometry.attributes.uv1 ? 'uv1' : '') + (geometry.attributes.uv2 ? 'uv2' : '')
    );
  }

  private buildDepthProxies(roots: THREE.Object3D[]): THREE.Group | null {
    let group: THREE.Group | null = null;
    for (const root of roots) {
      root.traverse(o => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh || !mesh.castShadow) return;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const m of mats) {
          if (!m) continue;
          const sig = this.depthSignature(mesh, m);
          if (sig === null || this.depthSignatures.has(sig)) continue;
          this.depthSignatures.add(sig);

          const sm = m as THREE.MeshStandardMaterial;
          const dm = new THREE.MeshDepthMaterial();
          dm.side = m.shadowSide !== null && m.shadowSide !== undefined ? m.shadowSide : SHADOW_SIDE[m.side];
          dm.map = sm.map ?? null;
          dm.alphaMap = sm.alphaMap ?? null;
          dm.alphaTest = m.alphaToCoverage === true ? 0.5 : m.alphaTest;
          dm.displacementMap = sm.displacementMap ?? null;
          dm.displacementScale = sm.displacementScale ?? 1;
          dm.displacementBias = sm.displacementBias ?? 0;
          dm.wireframe = !!(m as any).wireframe;
          this.depthKeepAlive.push(dm);

          let proxy: THREE.Mesh;
          if ((mesh as THREE.InstancedMesh).isInstancedMesh) {
            const im = new THREE.InstancedMesh(mesh.geometry, dm, 1);
            if ((mesh as THREE.InstancedMesh).instanceColor !== null) {
              im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(3), 3);
            }
            proxy = im;
          } else {
            proxy = new THREE.Mesh(mesh.geometry, dm);
          }
          if (!group) group = new THREE.Group();
          group.add(proxy);
        }
      });
    }
    return group;
  }

  /**
   * Draw these objects once into a tiny target of the scene target's format.
   * Some programs only finish compiling on their first real draw (ANGLE's
   * D3D11 point-sprite path for THREE.Points, input-layout variants); doing
   * that draw here, off screen and ahead of time, keeps it out of a gameplay
   * frame later. Only the given objects are drawn (frustum culling is forced
   * off for them and the warm camera sees nothing else); no shadow pass.
   */
  warmDraw(roots: THREE.Object3D[], filter: (o: THREE.Object3D) => boolean): number {
    const r = this.renderer;
    const ref = this.getTarget();
    // Same format and MSAA sample count as the real scene target: pipeline
    // variants can depend on both.
    const samples = ref ? ref.samples : 0;
    if (this.warmTarget && this.warmTarget.samples !== samples) {
      this.warmTarget.dispose();
      this.warmTarget = null;
    }
    if (!this.warmTarget) {
      this.warmTarget = new THREE.WebGLRenderTarget(4, 4, {
        type: ref ? ref.texture.type : THREE.HalfFloatType,
        format: THREE.RGBAFormat,
        depthBuffer: true,
        samples,
      });
    }
    const touched: { o: THREE.Object3D; culled: boolean; visible: boolean; count?: number }[] = [];
    const rootVis: boolean[] = [];
    // Detached roots (e.g. GLB templates) join the scene for this one draw.
    const attached: THREE.Object3D[] = [];
    for (const root of roots) {
      if (root !== this.scene && !root.parent) {
        this.scene.add(root);
        attached.push(root);
      }
    }
    for (const root of roots) {
      rootVis.push(root.visible);
      root.visible = true;
      root.traverse(o => {
        if (o === root) return;
        const isDrawable = (o as THREE.Mesh).isMesh || (o as THREE.Points).isPoints || (o as THREE.Line).isLine || (o as THREE.Sprite).isSprite;
        if (!isDrawable) {
          // Ancestors of drawn objects must be visible.
          if (!o.visible) {
            touched.push({ o, culled: o.frustumCulled, visible: o.visible });
            o.visible = true;
          }
          return;
        }
        const want = filter(o);
        const entry: { o: THREE.Object3D; culled: boolean; visible: boolean; count?: number } = { o, culled: o.frustumCulled, visible: o.visible };
        if ((o as THREE.InstancedMesh).isInstancedMesh) entry.count = (o as THREE.InstancedMesh).count;
        touched.push(entry);
        if (want) {
          o.visible = true;
          o.frustumCulled = false;
          if (entry.count !== undefined && entry.count < 1) (o as THREE.InstancedMesh).count = 1;
        } else {
          o.visible = false;
        }
      });
    }
    const prevTarget = r.getRenderTarget();
    const prevAuto = r.shadowMap.autoUpdate;
    const prevNeeds = r.shadowMap.needsUpdate;
    r.shadowMap.autoUpdate = false;
    r.shadowMap.needsUpdate = false;
    // Look straight down from far above: the near/far range sees nothing else.
    this.warmCamera.position.set(0, 1e5, 0);
    this.warmCamera.lookAt(0, 0, 0);
    this.warmCamera.updateMatrixWorld();
    const t0 = performance.now();
    try {
      r.setRenderTarget(this.warmTarget);
      r.render(this.scene, this.warmCamera);
    } catch (err) {
      console.warn('[ShaderWarmup] warm draw failed:', err);
    } finally {
      r.setRenderTarget(prevTarget);
      r.shadowMap.autoUpdate = prevAuto;
      r.shadowMap.needsUpdate = prevNeeds;
      for (const t of touched) {
        t.o.visible = t.visible;
        t.o.frustumCulled = t.culled;
        if (t.count !== undefined) (t.o as THREE.InstancedMesh).count = t.count;
      }
      roots.forEach((root, i) => (root.visible = rootVis[i]));
      for (const root of attached) this.scene.remove(root);
    }
    return performance.now() - t0;
  }

  dispose(): void {
    this.warmTarget?.dispose();
    this.warmTarget = null;
    for (const m of this.depthKeepAlive) m.dispose();
    this.depthKeepAlive.length = 0;
    this.depthSignatures.clear();
  }
}
