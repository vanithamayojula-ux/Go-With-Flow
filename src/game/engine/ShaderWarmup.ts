import * as THREE from 'three';
import { NEXT_WORLD_LAYER } from './WorldStreamer';

// Mirrors WebGLShadowMap's side flip for shadow casters.
const SHADOW_SIDE: Record<number, THREE.Side> = {
  [THREE.FrontSide]: THREE.BackSide,
  [THREE.BackSide]: THREE.FrontSide,
  [THREE.DoubleSide]: THREE.DoubleSide,
};

type Drawable = THREE.Mesh | THREE.Points | THREE.Line | THREE.Sprite;

function isDrawable(o: THREE.Object3D): o is Drawable {
  return (o as THREE.Mesh).isMesh === true || (o as THREE.Points).isPoints === true || (o as THREE.Line).isLine === true || (o as THREE.Sprite).isSprite === true;
}

/**
 * Asynchronous shader warm-up.
 *
 * `renderer.compileAsync()` only covers the main pass. Shadow casters are
 * drawn in the shadow pass with an internal MeshDepthMaterial whose program
 * depends on the caster (instancing, instance colours, map / alphaMap /
 * alphaTest, displacement, side). Here each new caster configuration gets a
 * proxy mesh with an identically configured MeshDepthMaterial, compiled with
 * compileAsync; three shares programs by cache key, so the shadow pass then
 * finds them ready.
 *
 * Three rules keep this stall free on ANGLE/D3D11 (Chrome, Edge):
 *
 * 1. KHR_parallel_shader_compile links on worker threads, but ANY synchronous
 *    GL call made while a link is in flight (getProgramInfoLog on a program's
 *    first use, getError, an <img> texture upload...) waits for every pending
 *    link: measured 600-1100 ms. So `busy` is exposed and callers hold back
 *    first draws and texture uploads until it clears (`onIdle`).
 * 2. A program is destroyed when its last material is disposed, and a world
 *    or gateway built again later would link it again. `retain` keeps a
 *    never-drawn clone of every compiled material, so programs live for the
 *    session and rebuilding anything already seen costs no compile at all.
 * 3. Some programs only finish on their first real draw (D3D input-layout and
 *    point-sprite variants): `warmDraw` does that draw off screen, main pass
 *    and shadow pass, while nothing is compiling.
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
  // for the whole session (the shadow pass's own per-material depth clones
  // are disposed with their material).
  private depthKeepAlive: THREE.Material[] = [];
  // Never-drawn clones holding a reference on every main-pass program.
  private keepAlive: THREE.Material[] = [];
  private retained = new WeakSet<object>();
  private retainedMaterials = new WeakSet<THREE.Material>();
  private pending = 0;
  private idleQueue: (() => void)[] = [];
  /** Clones whose program did not match the original's (diagnostics). */
  public retainMisses = 0;
  public retainMissNames: string[] = [];

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
    // The next world lives on its own layer (seen only through its gateway):
    // the off-screen first draws must include it, main and shadow pass.
    this.warmCamera.layers.enable(NEXT_WORLD_LAYER);
  }

  /** Programs are linking in the background: synchronous GL calls would wait for them. */
  get busy(): boolean {
    return this.pending > 0;
  }

  /** Run `fn` at the start of the first frame with no link in flight. */
  onIdle(fn: () => void): void {
    this.idleQueue.push(fn);
  }

  /** Once per frame, before anything else draws or compiles. */
  tick(): void {
    if (this.pending > 0 || this.idleQueue.length === 0) return;
    // One job per frame: each may do first draws (synchronous on the GPU side).
    const fn = this.idleQueue.shift()!;
    try {
      fn();
    } catch (err) {
      console.warn('[ShaderWarmup] idle job failed:', err);
    }
  }

  /**
   * Compile main-pass and shadow-pass programs for these objects (they need
   * not be in the scene or visible). Resolves once every program is linked;
   * the programs are then kept for the whole session.
   */
  compile(roots: THREE.Object3D[]): Promise<void> {
    const r = this.renderer;
    const promises: Promise<unknown>[] = [];
    const prev = r.getRenderTarget();
    const programsBefore = r.info.programs ? r.info.programs.length : 0;
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
    // Nothing new to link: no need to hold anything back.
    const linking = !r.info.programs || r.info.programs.length !== programsBefore;
    if (linking) this.pending++;
    return Promise.all(promises)
      .then(
        () => this.retain(roots),
        () => undefined
      )
      .finally(() => {
        if (linking) this.pending--;
      });
  }

  /**
   * Keep every program these objects use alive for the session: one clone of
   * each material, on a stub object with the same program-relevant traits,
   * compiled against the same scene (finds the existing program, links nothing).
   */
  private retain(roots: THREE.Object3D[]): void {
    const r = this.renderer;
    const props = r.properties;
    const stubs = new THREE.Group();
    const pairs: { clone: THREE.Material; program: unknown; label: string }[] = [];
    for (const root of roots) {
      root.traverse(o => {
        if (!isDrawable(o)) return;
        if ((o as THREE.SkinnedMesh).isSkinnedMesh || (o as any).isBatchedMesh) return;
        const geometry = (o as THREE.Mesh).geometry;
        if (!geometry || Object.keys(geometry.morphAttributes).length > 0) return;
        if ((o as THREE.InstancedMesh).isInstancedMesh && (o as THREE.InstancedMesh).morphTexture) return;
        const mats = Array.isArray((o as THREE.Mesh).material) ? ((o as THREE.Mesh).material as THREE.Material[]) : [(o as THREE.Mesh).material as THREE.Material];
        for (const m of mats) {
          if (!m || this.retainedMaterials.has(m)) continue;
          const program = (props.get(m) as { currentProgram?: unknown }).currentProgram;
          if (!program || this.retained.has(program as object)) continue;
          const clone = cloneForProgram(m);
          if (!clone) continue;
          const stub = makeStub(o, clone);
          if (!stub) {
            clone.dispose();
            continue;
          }
          this.retained.add(program as object);
          this.retainedMaterials.add(m);
          stubs.add(stub);
          pairs.push({ clone, program, label: o.name + ':' + m.type + ':' + m.name });
        }
      });
    }
    if (pairs.length === 0) return;
    const prev = r.getRenderTarget();
    const before = r.info.programs ? r.info.programs.length : 0;
    let done: Promise<unknown> = Promise.resolve();
    r.setRenderTarget(this.getTarget());
    try {
      done = r.compileAsync(stubs, this.camera, this.scene);
    } catch (err) {
      console.warn('[ShaderWarmup] retain failed:', err);
    } finally {
      r.setRenderTarget(prev);
    }
    for (const p of pairs) {
      // A different program means the material changed since it was compiled
      // (e.g. scanned maps swapped in): the clone then holds the variant the
      // material will use from now on, which is just as worth keeping.
      if ((props.get(p.clone) as { currentProgram?: unknown }).currentProgram !== p.program) {
        this.retainMisses++;
        if (this.retainMissNames.length < 20) this.retainMissNames.push(p.label);
      }
      this.keepAlive.push(p.clone);
    }
    // New programs linking in the background: hold synchronous work back.
    if (r.info.programs && r.info.programs.length !== before) {
      this.pending++;
      done.finally(() => {
        this.pending--;
      });
    }
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
      if (!isDrawable(o)) return;
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

          // Stub geometry: only attribute presence matters to the program.
          const proxyGeometry = stubGeometry(mesh.geometry);
          let proxy: THREE.Mesh;
          if ((mesh as THREE.InstancedMesh).isInstancedMesh) {
            const im = new THREE.InstancedMesh(proxyGeometry, dm, 1);
            if ((mesh as THREE.InstancedMesh).instanceColor !== null) {
              im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(3), 3);
            }
            proxy = im;
          } else {
            proxy = new THREE.Mesh(proxyGeometry, dm);
          }
          if (!group) group = new THREE.Group();
          group.add(proxy);
        }
      });
    }
    return group;
  }

  /**
   * Draw these objects once into a tiny target of the scene target's format,
   * and into the shadow map (shadow pass), so every program they use - main
   * pass and depth - gets its first real draw here, off screen. Some programs
   * only finish compiling on that first draw (ANGLE's D3D11 point-sprite path
   * for THREE.Points, input-layout variants). Only the given objects are drawn
   * (frustum culling is forced off for them and the warm camera sees nothing
   * else); the shadow map is redrawn by the next real frame.
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
        if (!isDrawable(o)) {
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
    // Everything else in the scene (other worlds, the rider...) stays out of
    // the shadow pass too: hide the scene's other top-level drawables.
    const others: THREE.Object3D[] = [];
    if (roots.indexOf(this.scene) === -1) {
      for (const child of this.scene.children) {
        if (!child.visible || roots.indexOf(child) !== -1 || (child as THREE.Light).isLight) continue;
        if (roots.some(root => isAncestor(child, root))) continue;
        child.visible = false;
        others.push(child);
      }
    }
    const prevTarget = r.getRenderTarget();
    const prevAuto = r.shadowMap.autoUpdate;
    const prevNeeds = r.shadowMap.needsUpdate;
    // Shadow pass on: links the depth programs (and allocates the shadow map
    // before any lit draw samples it - without it the lit draws fail with a
    // texture format / sampler type mismatch and warm nothing).
    r.shadowMap.autoUpdate = false;
    r.shadowMap.needsUpdate = r.shadowMap.enabled;
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
      // The real frame redraws the shadow map over what was drawn here.
      r.shadowMap.needsUpdate = prevNeeds || r.shadowMap.enabled;
      for (const t of touched) {
        t.o.visible = t.visible;
        t.o.frustumCulled = t.culled;
        if (t.count !== undefined) (t.o as THREE.InstancedMesh).count = t.count;
      }
      for (const o of others) o.visible = true;
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
    for (const m of this.keepAlive) m.dispose();
    this.keepAlive.length = 0;
    this.depthSignatures.clear();
    this.idleQueue.length = 0;
  }
}

function isAncestor(a: THREE.Object3D, b: THREE.Object3D): boolean {
  for (let p: THREE.Object3D | null = b.parent; p; p = p.parent) if (p === a) return true;
  return false;
}

/** Tiny geometry with the same attribute names / sizes (all a program key sees). */
function stubGeometry(src: THREE.BufferGeometry): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  for (const name in src.attributes) {
    const a = src.attributes[name];
    g.setAttribute(name, new THREE.BufferAttribute(new Float32Array(a.itemSize), a.itemSize));
  }
  return g;
}

/** Same program-relevant traits as `o`, drawing `material`; never rendered. */
function makeStub(o: Drawable, material: THREE.Material): THREE.Object3D | null {
  if ((o as THREE.Sprite).isSprite) return new THREE.Sprite(material as THREE.SpriteMaterial);
  const geometry = stubGeometry((o as THREE.Mesh).geometry);
  if ((o as THREE.InstancedMesh).isInstancedMesh) {
    const im = new THREE.InstancedMesh(geometry, material, 1);
    if ((o as THREE.InstancedMesh).instanceColor !== null) im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(3), 3);
    return im;
  }
  if ((o as THREE.Points).isPoints) return new THREE.Points(geometry, material);
  if ((o as THREE.Line).isLine) {
    if ((o as THREE.LineSegments).isLineSegments) return new THREE.LineSegments(geometry, material);
    return new THREE.Line(geometry, material);
  }
  return new THREE.Mesh(geometry, material);
}

/** A clone that resolves to the same program as `m` (same defines and shader hooks). */
function cloneForProgram(m: THREE.Material): THREE.Material | null {
  const anyM = m as any;
  // Shader uniforms are shared by reference: the clone is never drawn, and
  // cloning would copy textures (and refuse render-target ones).
  const uniforms = anyM.uniforms;
  const userData = m.userData;
  let clone: THREE.Material;
  try {
    if (uniforms !== undefined) anyM.uniforms = {};
    m.userData = {};
    clone = m.clone();
  } catch {
    return null;
  } finally {
    if (uniforms !== undefined) anyM.uniforms = uniforms;
    m.userData = userData;
  }
  if (uniforms !== undefined) (clone as any).uniforms = uniforms;
  if (m.defines) clone.defines = { ...m.defines };
  clone.onBeforeCompile = m.onBeforeCompile;
  clone.customProgramCacheKey = m.customProgramCacheKey;
  return clone;
}
