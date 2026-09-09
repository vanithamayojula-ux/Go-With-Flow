import * as THREE from 'three';
import { FoliageShader } from '../graphics/shaders';
import { createFoliageTexture, createTreeFoliageTexture } from '../graphics/textures';
import { Chunk } from './terrain';

export class FoliageManager {
  scene: THREE.Scene;
  foliageTexture: THREE.CanvasTexture;
  treeTexture: THREE.CanvasTexture;

  grassMaterial: THREE.ShaderMaterial;
  treeMaterial: THREE.ShaderMaterial;
  trunkMaterial: THREE.MeshLambertMaterial;

  grassMesh: THREE.InstancedMesh;
  treeMesh: THREE.InstancedMesh;
  trunkMesh: THREE.InstancedMesh;

  maxGrassInstances = 2000;
  maxTreeInstances = 250;

  private dummy = new THREE.Object3D();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.foliageTexture = createFoliageTexture();
    this.treeTexture = createTreeFoliageTexture();

    // Custom Vertex-Wind Foliage Shader Material
    this.grassMaterial = new THREE.ShaderMaterial({
      vertexShader: FoliageShader.vertexShader,
      fragmentShader: FoliageShader.fragmentShader,
      uniforms: {
        uTexture: { value: this.foliageTexture },
        uTime: { value: 0 },
        uWindSpeed: { value: 1.0 },
        uWindStrength: { value: 0.6 },
        uPlayerSpeedFactor: { value: 0 },
        uSunDirection: { value: new THREE.Vector3(0.5, 0.8, -0.3).normalize() },
        uSunColor: { value: new THREE.Color('#FFF1D0') },
        uAmbientColor: { value: new THREE.Color('#94BCE8') },
        uRimLightIntensity: { value: 0.5 },
        uCameraPos: { value: new THREE.Vector3() },
        uPlayerPos: { value: new THREE.Vector3() },
      },
      side: THREE.DoubleSide,
      transparent: true,
      depthWrite: true,
    });

    // Cross-quad foliage geometry for brush grass clumps
    const geom1 = new THREE.PlaneGeometry(1.4, 1.4, 2, 4);
    geom1.translate(0, 0.7, 0);
    const geom2 = geom1.clone();
    geom2.rotateY(Math.PI / 2);

    const grassGeom = new THREE.BufferGeometry();
    const pos1 = geom1.attributes.position.array;
    const pos2 = geom2.attributes.position.array;
    const uv1 = geom1.attributes.uv.array;
    const uv2 = geom2.attributes.uv.array;
    const norm1 = geom1.attributes.normal.array;
    const norm2 = geom2.attributes.normal.array;

    const mergedPos = new Float32Array(pos1.length + pos2.length);
    mergedPos.set(pos1, 0);
    mergedPos.set(pos2, pos1.length);

    const mergedUv = new Float32Array(uv1.length + uv2.length);
    mergedUv.set(uv1, 0);
    mergedUv.set(uv2, uv1.length);

    const mergedNorm = new Float32Array(norm1.length + norm2.length);
    mergedNorm.set(norm1, 0);
    mergedNorm.set(norm2, norm1.length);

    grassGeom.setAttribute('position', new THREE.BufferAttribute(mergedPos, 3));
    grassGeom.setAttribute('uv', new THREE.BufferAttribute(mergedUv, 2));
    grassGeom.setAttribute('normal', new THREE.BufferAttribute(mergedNorm, 3));

    // Custom per-instance attributes for vertex wind shader
    const aInstancePosition = new Float32Array(this.maxGrassInstances * 3);
    const aInstanceScale = new Float32Array(this.maxGrassInstances);
    const aInstanceRot = new Float32Array(this.maxGrassInstances);

    grassGeom.setAttribute('aInstancePosition', new THREE.InstancedBufferAttribute(aInstancePosition, 3));
    grassGeom.setAttribute('aInstanceScale', new THREE.InstancedBufferAttribute(aInstanceScale, 1));
    grassGeom.setAttribute('aInstanceRot', new THREE.InstancedBufferAttribute(aInstanceRot, 1));

    this.grassMesh = new THREE.InstancedMesh(grassGeom, this.grassMaterial, this.maxGrassInstances);
    this.grassMesh.count = 0;
    this.grassMesh.frustumCulled = false;
    this.scene.add(this.grassMesh);

    // Tree Foliage Mesh (Puff Spherical Cluster with painterly albedo)
    const treeFoliageGeom = new THREE.IcosahedronGeometry(2.2, 1);
    this.treeMaterial = new THREE.ShaderMaterial({
      vertexShader: FoliageShader.vertexShader,
      fragmentShader: FoliageShader.fragmentShader,
      uniforms: {
        uTexture: { value: this.treeTexture },
        uTime: { value: 0 },
        uWindSpeed: { value: 0.6 },
        uWindStrength: { value: 0.3 },
        uPlayerSpeedFactor: { value: 0 },
        uSunDirection: { value: new THREE.Vector3(0.5, 0.8, -0.3).normalize() },
        uSunColor: { value: new THREE.Color('#FFF1D0') },
        uAmbientColor: { value: new THREE.Color('#94BCE8') },
        uRimLightIntensity: { value: 0.45 },
        uCameraPos: { value: new THREE.Vector3() },
        uPlayerPos: { value: new THREE.Vector3() },
      },
      transparent: true,
      side: THREE.DoubleSide,
    });

    const aTreeInstancePos = new Float32Array(this.maxTreeInstances * 3);
    const aTreeInstanceScale = new Float32Array(this.maxTreeInstances);
    const aTreeInstanceRot = new Float32Array(this.maxTreeInstances);

    treeFoliageGeom.setAttribute('aInstancePosition', new THREE.InstancedBufferAttribute(aTreeInstancePos, 3));
    treeFoliageGeom.setAttribute('aInstanceScale', new THREE.InstancedBufferAttribute(aTreeInstanceScale, 1));
    treeFoliageGeom.setAttribute('aInstanceRot', new THREE.InstancedBufferAttribute(aTreeInstanceRot, 1));

    this.treeMesh = new THREE.InstancedMesh(treeFoliageGeom, this.treeMaterial, this.maxTreeInstances);
    this.treeMesh.count = 0;
    this.treeMesh.frustumCulled = false;
    this.scene.add(this.treeMesh);

    // Tree Trunk Mesh
    const trunkGeom = new THREE.CylinderGeometry(0.2, 0.35, 3.2, 6);
    trunkGeom.translate(0, 1.6, 0);
    this.trunkMaterial = new THREE.MeshLambertMaterial({ color: 0x5a4332 });
    this.trunkMesh = new THREE.InstancedMesh(trunkGeom, this.trunkMaterial, this.maxTreeInstances);
    this.trunkMesh.count = 0;
    this.trunkMesh.frustumCulled = false;
    this.scene.add(this.trunkMesh);
  }

  updateFoliage(chunks: Map<string, Chunk>, playerZ: number, playerX: number, densityMultiplier = 1.0) {
    let grassIdx = 0;
    let treeIdx = 0;

    const posAttr = this.grassMesh.geometry.getAttribute('aInstancePosition') as THREE.InstancedBufferAttribute;
    const scaleAttr = this.grassMesh.geometry.getAttribute('aInstanceScale') as THREE.InstancedBufferAttribute;
    const rotAttr = this.grassMesh.geometry.getAttribute('aInstanceRot') as THREE.InstancedBufferAttribute;

    const treePosAttr = this.treeMesh.geometry.getAttribute('aInstancePosition') as THREE.InstancedBufferAttribute;
    const treeScaleAttr = this.treeMesh.geometry.getAttribute('aInstanceScale') as THREE.InstancedBufferAttribute;
    const treeRotAttr = this.treeMesh.geometry.getAttribute('aInstanceRot') as THREE.InstancedBufferAttribute;

    // Collect all active foliage near player
    for (const chunk of chunks.values()) {
      if (!chunk.foliageInstances) continue;
      const grassList = chunk.foliageInstances.grass || [];
      const treeList = chunk.foliageInstances.trees || [];

      const dist = Math.hypot(chunk.cx * 80 - playerX, chunk.cz * 80 - playerZ);
      if (dist > 180) continue; // Distance cull

      // Grass
      for (let i = 0; i < grassList.length; i++) {
        if (Math.random() > densityMultiplier && densityMultiplier < 0.99) continue;
        if (grassIdx >= this.maxGrassInstances) break;

        const g = grassList[i];
        posAttr.setXYZ(grassIdx, g.x, g.y, g.z);
        scaleAttr.setX(grassIdx, g.scale);
        rotAttr.setX(grassIdx, g.rot);

        this.dummy.position.set(g.x, g.y, g.z);
        this.dummy.scale.set(g.scale, g.scale, g.scale);
        this.dummy.rotation.set(0, g.rot, 0);
        this.dummy.updateMatrix();
        this.grassMesh.setMatrixAt(grassIdx, this.dummy.matrix);

        grassIdx++;
      }

      // Trees
      for (let i = 0; i < treeList.length; i++) {
        if (treeIdx >= this.maxTreeInstances) break;
        const t = treeList[i];

        // Tree foliage crown
        treePosAttr.setXYZ(treeIdx, t.x, t.y + 2.8 * t.scale, t.z);
        treeScaleAttr.setX(treeIdx, t.scale);
        treeRotAttr.setX(treeIdx, 0);

        this.dummy.position.set(t.x, t.y + 2.8 * t.scale, t.z);
        this.dummy.scale.set(t.scale, t.scale, t.scale);
        this.dummy.rotation.set(0, 0, 0);
        this.dummy.updateMatrix();
        this.treeMesh.setMatrixAt(treeIdx, this.dummy.matrix);

        // Trunk
        this.dummy.position.set(t.x, t.y, t.z);
        this.dummy.scale.set(t.scale, t.scale, t.scale);
        this.dummy.updateMatrix();
        this.trunkMesh.setMatrixAt(treeIdx, this.dummy.matrix);

        treeIdx++;
      }
    }

    this.grassMesh.count = grassIdx;
    posAttr.needsUpdate = true;
    scaleAttr.needsUpdate = true;
    rotAttr.needsUpdate = true;
    this.grassMesh.instanceMatrix.needsUpdate = true;

    this.treeMesh.count = treeIdx;
    treePosAttr.needsUpdate = true;
    treeScaleAttr.needsUpdate = true;
    treeRotAttr.needsUpdate = true;
    this.treeMesh.instanceMatrix.needsUpdate = true;

    this.trunkMesh.count = treeIdx;
    this.trunkMesh.instanceMatrix.needsUpdate = true;
  }

  updateShaderTime(time: number, playerSpeedNormalized: number, cameraPos: THREE.Vector3) {
    this.grassMaterial.uniforms.uTime.value = time;
    this.grassMaterial.uniforms.uPlayerSpeedFactor.value = playerSpeedNormalized;
    this.grassMaterial.uniforms.uCameraPos.value.copy(cameraPos);

    this.treeMaterial.uniforms.uTime.value = time;
    this.treeMaterial.uniforms.uPlayerSpeedFactor.value = playerSpeedNormalized;
    this.treeMaterial.uniforms.uCameraPos.value.copy(cameraPos);
  }

  dispose() {
    this.scene.remove(this.grassMesh);
    this.scene.remove(this.treeMesh);
    this.scene.remove(this.trunkMesh);
    this.foliageTexture.dispose();
    this.treeTexture.dispose();
    this.grassMaterial.dispose();
    this.treeMaterial.dispose();
    this.trunkMaterial.dispose();
  }
}
