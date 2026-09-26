import * as THREE from 'three';
import { CyberChunk } from './terrain';
import { FoliageShader } from '../graphics/shaders';

export class FoliageManager {
  scene: THREE.Scene;
  group: THREE.Group;

  grassMesh: THREE.InstancedMesh | null = null;
  treeMesh: THREE.InstancedMesh | null = null;

  grassMaterial: THREE.ShaderMaterial;
  treeMaterial: THREE.ShaderMaterial;

  private dummy = new THREE.Object3D();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.scene.add(this.group);

    // Custom Neon Grass / Energy Reed Shader Material
    this.grassMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uWindSpeed: { value: 2.0 },
        uWindStrength: { value: 0.5 },
        uRimLightIntensity: { value: 0.6 },
        uPlayerPos: { value: new THREE.Vector3() },
        uCameraPos: { value: new THREE.Vector3() },
        uSunColor: { value: new THREE.Color(0x00f0ff) },
      },
      vertexShader: `
        uniform float uTime;
        uniform float uWindSpeed;
        uniform float uWindStrength;
        uniform vec3 uPlayerPos;
        varying vec2 vUv;
        varying vec3 vWorldPosition;

        void main() {
          vUv = uv;
          vec4 worldPos = instanceMatrix * vec4(position, 1.0);
          
          // Wind sway on upper vertices
          float sway = sin(uTime * uWindSpeed * 3.0 + worldPos.x * 0.5 + worldPos.z * 0.5) * uWindStrength * uv.y * 0.25;
          worldPos.x += sway;
          worldPos.z += sway * 0.5;

          // Player proximity bend
          float pDist = distance(worldPos.xz, uPlayerPos.xz);
          if (pDist < 2.5) {
            vec2 push = normalize(worldPos.xz - uPlayerPos.xz) * (2.5 - pDist) * 0.3 * uv.y;
            worldPos.x += push.x;
            worldPos.z += push.y;
          }

          vWorldPosition = worldPos.xyz;
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: `
        uniform vec3 uSunColor;
        uniform float uRimLightIntensity;
        uniform float uTime;
        varying vec2 vUv;
        varying vec3 vWorldPosition;

        void main() {
          vec3 baseCol = mix(vec3(0.0, 0.4, 0.5), vec3(0.0, 0.95, 1.0), vUv.y);
          // Neon glow tips
          float glow = pow(vUv.y, 2.0) * (sin(uTime * 4.0 + vWorldPosition.x) * 0.2 + 0.8);
          vec3 finalCol = baseCol + vec3(0.0, 0.9, 1.0) * glow * 1.5;
          gl_FragColor = vec4(finalCol, 1.0);
        }
      `,
      side: THREE.DoubleSide,
    });

    // Custom Neon Tree / Cyber Crystal Spire Shader Material
    this.treeMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uWindSpeed: { value: 1.5 },
        uWindStrength: { value: 0.3 },
        uRimLightIntensity: { value: 0.8 },
        uCameraPos: { value: new THREE.Vector3() },
        uSunColor: { value: new THREE.Color(0xff007f) },
      },
      vertexShader: `
        uniform float uTime;
        uniform float uWindSpeed;
        uniform float uWindStrength;
        varying vec2 vUv;
        varying vec3 vWorldPosition;

        void main() {
          vUv = uv;
          vec4 worldPos = instanceMatrix * vec4(position, 1.0);
          float sway = sin(uTime * uWindSpeed * 2.0 + worldPos.z * 0.3) * uWindStrength * (position.y / 8.0) * 0.15;
          worldPos.x += sway;
          vWorldPosition = worldPos.xyz;
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        varying vec2 vUv;
        varying vec3 vWorldPosition;

        void main() {
          vec3 col = mix(vec3(0.05, 0.08, 0.18), vec3(1.0, 0.0, 0.5), vUv.y);
          float pulse = sin(uTime * 3.0 + vWorldPosition.y * 0.5) * 0.3 + 0.7;
          gl_FragColor = vec4(col * pulse, 1.0);
        }
      `,
    });

    // Initialize Instanced Meshes
    const grassGeom = new THREE.ConeGeometry(0.12, 1.2, 4);
    grassGeom.translate(0, 0.6, 0);
    this.grassMesh = new THREE.InstancedMesh(grassGeom, this.grassMaterial, 1200);
    this.grassMesh.count = 0;
    this.grassMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.group.add(this.grassMesh);

    const treeGeom = new THREE.CylinderGeometry(0.05, 0.45, 6.0, 5);
    treeGeom.translate(0, 3.0, 0);
    this.treeMesh = new THREE.InstancedMesh(treeGeom, this.treeMaterial, 300);
    this.treeMesh.count = 0;
    this.treeMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.group.add(this.treeMesh);
  }

  updateFoliage(
    chunks: Map<string, CyberChunk>,
    playerZ: number,
    playerX: number,
    density: number
  ): void {
    const grassMesh = this.grassMesh;
    const treeMesh = this.treeMesh;
    if (!grassMesh || !treeMesh) return;

    let grassIdx = 0;
    let treeIdx = 0;
    const maxGrass = grassMesh.instanceMatrix.array.length / 16;
    const maxTrees = treeMesh.instanceMatrix.array.length / 16;

    chunks.forEach(chunk => {
      // Grass instances
      if (chunk.foliageInstances?.grass) {
        for (const g of chunk.foliageInstances.grass) {
          if (grassIdx >= maxGrass) break;
          // Distance cull
          if (Math.abs(g.z - playerZ) > 180) continue;

          this.dummy.position.set(g.x, g.y, g.z);
          this.dummy.scale.set(g.scale, g.scale * (0.8 + density * 0.4), g.scale);
          this.dummy.rotation.set(0, g.rot, 0);
          this.dummy.updateMatrix();

          grassMesh.setMatrixAt(grassIdx++, this.dummy.matrix);
        }
      }

      // Trees / Spire instances
      if (chunk.foliageInstances?.trees) {
        for (const t of chunk.foliageInstances.trees) {
          if (treeIdx >= maxTrees) break;
          if (Math.abs(t.z - playerZ) > 220) continue;

          this.dummy.position.set(t.x, t.y, t.z);
          this.dummy.scale.set(t.scale, t.scale, t.scale);
          this.dummy.rotation.set(0, (t.x * 12.3) % 6.28, 0);
          this.dummy.updateMatrix();

          treeMesh.setMatrixAt(treeIdx++, this.dummy.matrix);
        }
      }
    });

    grassMesh.count = grassIdx;
    grassMesh.instanceMatrix.needsUpdate = true;

    treeMesh.count = treeIdx;
    treeMesh.instanceMatrix.needsUpdate = true;
  }

  updateShaderTime(timeSeconds: number, speedNorm: number, cameraPos: THREE.Vector3): void {
    if (this.grassMaterial.uniforms.uTime) {
      this.grassMaterial.uniforms.uTime.value = timeSeconds;
    }
    if (this.grassMaterial.uniforms.uCameraPos) {
      this.grassMaterial.uniforms.uCameraPos.value.copy(cameraPos);
    }
    if (this.treeMaterial.uniforms.uTime) {
      this.treeMaterial.uniforms.uTime.value = timeSeconds;
    }
    if (this.treeMaterial.uniforms.uCameraPos) {
      this.treeMaterial.uniforms.uCameraPos.value.copy(cameraPos);
    }
  }

  dispose(): void {
    this.scene.remove(this.group);
    this.grassMaterial.dispose();
    this.treeMaterial.dispose();
    this.grassMesh?.geometry.dispose();
    this.treeMesh?.geometry.dispose();
  }
}
