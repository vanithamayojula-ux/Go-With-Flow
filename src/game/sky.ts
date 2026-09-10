import * as THREE from 'three';
import { SkyboxShader } from '../graphics/shaders';
import { LightingMode } from '../types';

export interface LightingPresetConfig {
  skyTop: string;
  skyMid: string;
  skyHorizon: string;
  sunColor: string;
  sunPosition: [number, number, number];
  ambientColor: string;
  slopeWarm: string;
  slopeCool: string;
  hazeDensity: number;
  fogColor: string;
}

export const LIGHTING_PRESETS: Record<string, LightingPresetConfig> = {
  'neon-night': {
    skyTop: '#01040a',
    skyMid: '#030c1c',
    skyHorizon: '#00f0ff',
    sunColor: '#00f0ff',
    sunPosition: [40, 80, -160],
    ambientColor: '#040b18',
    slopeWarm: '#00e5ff',
    slopeCool: '#02182b',
    hazeDensity: 0.9,
    fogColor: '#020714',
  },
  'deep-space': {
    skyTop: '#05010b',
    skyMid: '#12021e',
    skyHorizon: '#ff007f',
    sunColor: '#ff00aa',
    sunPosition: [-60, 75, -150],
    ambientColor: '#0c0218',
    slopeWarm: '#ff007f',
    slopeCool: '#1f0438',
    hazeDensity: 0.95,
    fogColor: '#0a0216',
  },
  'storm-grid': {
    skyTop: '#000603',
    skyMid: '#011409',
    skyHorizon: '#00ff66',
    sunColor: '#00ff77',
    sunPosition: [0, 90, -140],
    ambientColor: '#001006',
    slopeWarm: '#00ff66',
    slopeCool: '#00260f',
    hazeDensity: 0.85,
    fogColor: '#000c05',
  },
  'solar-amber': {
    skyTop: '#070200',
    skyMid: '#160700',
    skyHorizon: '#ff7700',
    sunColor: '#ff8800',
    sunPosition: [70, 60, -130],
    ambientColor: '#140701',
    slopeWarm: '#ff8800',
    slopeCool: '#2d1200',
    hazeDensity: 0.88,
    fogColor: '#0f0401',
  },
  'volcanic-red': {
    skyTop: '#1a0300',
    skyMid: '#330800',
    skyHorizon: '#ff2200',
    sunColor: '#ff4400',
    sunPosition: [20, 65, -140],
    ambientColor: '#1f0600',
    slopeWarm: '#ff3300',
    slopeCool: '#3d0c00',
    hazeDensity: 0.92,
    fogColor: '#140300',
  },
  'crystal-ice': {
    skyTop: '#010c1a',
    skyMid: '#05223d',
    skyHorizon: '#00f7ff',
    sunColor: '#88f4ff',
    sunPosition: [-40, 70, -150],
    ambientColor: '#041629',
    slopeWarm: '#00f7ff',
    slopeCool: '#08304d',
    hazeDensity: 0.88,
    fogColor: '#021021',
  },
  // Aliases for compatibility with biomes
  'neon-undercity': {
    skyTop: '#01040a',
    skyMid: '#030c1c',
    skyHorizon: '#00f0ff',
    sunColor: '#00f0ff',
    sunPosition: [40, 80, -160],
    ambientColor: '#040b18',
    slopeWarm: '#00e5ff',
    slopeCool: '#02182b',
    hazeDensity: 0.9,
    fogColor: '#020714',
  },
  'quantum-desert': {
    skyTop: '#070200',
    skyMid: '#160700',
    skyHorizon: '#ff7700',
    sunColor: '#ff8800',
    sunPosition: [70, 60, -130],
    ambientColor: '#140701',
    slopeWarm: '#ff8800',
    slopeCool: '#2d1200',
    hazeDensity: 0.88,
    fogColor: '#0f0401',
  },
  'cyber-forest': {
    skyTop: '#010d06',
    skyMid: '#032111',
    skyHorizon: '#00ff88',
    sunColor: '#00ffaa',
    sunPosition: [-30, 80, -140],
    ambientColor: '#03190e',
    slopeWarm: '#00ffaa',
    slopeCool: '#063820',
    hazeDensity: 0.86,
    fogColor: '#02120a',
  },
  'orbital-ring': {
    skyTop: '#05010b',
    skyMid: '#12021e',
    skyHorizon: '#ff007f',
    sunColor: '#ff00aa',
    sunPosition: [-60, 75, -150],
    ambientColor: '#0c0218',
    slopeWarm: '#ff007f',
    slopeCool: '#1f0438',
    hazeDensity: 0.95,
    fogColor: '#0a0216',
  },
  'the-grid': {
    skyTop: '#000603',
    skyMid: '#011409',
    skyHorizon: '#00ff66',
    sunColor: '#00ff77',
    sunPosition: [0, 90, -140],
    ambientColor: '#001006',
    slopeWarm: '#00ff66',
    slopeCool: '#00260f',
    hazeDensity: 0.85,
    fogColor: '#000c05',
  },
  'volcanic-forge': {
    skyTop: '#1a0300',
    skyMid: '#330800',
    skyHorizon: '#ff2200',
    sunColor: '#ff4400',
    sunPosition: [20, 65, -140],
    ambientColor: '#1f0600',
    slopeWarm: '#ff3300',
    slopeCool: '#3d0c00',
    hazeDensity: 0.92,
    fogColor: '#140300',
  },
  'crystal-glacier': {
    skyTop: '#010c1a',
    skyMid: '#05223d',
    skyHorizon: '#00f7ff',
    sunColor: '#88f4ff',
    sunPosition: [-40, 70, -150],
    ambientColor: '#041629',
    slopeWarm: '#00f7ff',
    slopeCool: '#08304d',
    hazeDensity: 0.88,
    fogColor: '#021021',
  },
  'derelict-station': {
    skyTop: '#0a0804',
    skyMid: '#1a1409',
    skyHorizon: '#ffaa00',
    sunColor: '#ffbb00',
    sunPosition: [30, 70, -140],
    ambientColor: '#120d06',
    slopeWarm: '#ffaa00',
    slopeCool: '#2e200c',
    hazeDensity: 0.9,
    fogColor: '#0f0a03',
  },
  'midnight-cyan': {
    skyTop: '#01040a',
    skyMid: '#030c1c',
    skyHorizon: '#00f0ff',
    sunColor: '#00f0ff',
    sunPosition: [40, 80, -160],
    ambientColor: '#040b18',
    slopeWarm: '#00e5ff',
    slopeCool: '#02182b',
    hazeDensity: 0.9,
    fogColor: '#020714',
  },
  'synthwave-magenta': {
    skyTop: '#05010b',
    skyMid: '#12021e',
    skyHorizon: '#ff007f',
    sunColor: '#ff00aa',
    sunPosition: [-60, 75, -150],
    ambientColor: '#0c0218',
    slopeWarm: '#ff007f',
    slopeCool: '#1f0438',
    hazeDensity: 0.95,
    fogColor: '#0a0216',
  },
  'toxic-matrix': {
    skyTop: '#000603',
    skyMid: '#011409',
    skyHorizon: '#00ff66',
    sunColor: '#00ff77',
    sunPosition: [0, 90, -140],
    ambientColor: '#001006',
    slopeWarm: '#00ff66',
    slopeCool: '#00260f',
    hazeDensity: 0.85,
    fogColor: '#000c05',
  },
  'golden-hour': {
    skyTop: '#070200',
    skyMid: '#160700',
    skyHorizon: '#ff7700',
    sunColor: '#ff8800',
    sunPosition: [70, 60, -130],
    ambientColor: '#140701',
    slopeWarm: '#ff8800',
    slopeCool: '#2d1200',
    hazeDensity: 0.88,
    fogColor: '#0f0401',
  },
  'morning': {
    skyTop: '#01040a',
    skyMid: '#030c1c',
    skyHorizon: '#00f0ff',
    sunColor: '#00f0ff',
    sunPosition: [40, 80, -160],
    ambientColor: '#040b18',
    slopeWarm: '#00e5ff',
    slopeCool: '#02182b',
    hazeDensity: 0.9,
    fogColor: '#020714',
  },
  'bright-day': {
    skyTop: '#000603',
    skyMid: '#011409',
    skyHorizon: '#00ff66',
    sunColor: '#00ff77',
    sunPosition: [0, 90, -140],
    ambientColor: '#001006',
    slopeWarm: '#00ff66',
    slopeCool: '#00260f',
    hazeDensity: 0.85,
    fogColor: '#000c05',
  },
  'meadow': {
    skyTop: '#01040a',
    skyMid: '#030c1c',
    skyHorizon: '#00f0ff',
    sunColor: '#00f0ff',
    sunPosition: [40, 80, -160],
    ambientColor: '#040b18',
    slopeWarm: '#00e5ff',
    slopeCool: '#02182b',
    hazeDensity: 0.9,
    fogColor: '#020714',
  },
  'dunes': {
    skyTop: '#070200',
    skyMid: '#160700',
    skyHorizon: '#ff7700',
    sunColor: '#ff8800',
    sunPosition: [70, 60, -130],
    ambientColor: '#140701',
    slopeWarm: '#ff8800',
    slopeCool: '#2d1200',
    hazeDensity: 0.88,
    fogColor: '#0f0401',
  },
  'sky-islands': {
    skyTop: '#05010b',
    skyMid: '#12021e',
    skyHorizon: '#ff007f',
    sunColor: '#ff00aa',
    sunPosition: [-60, 75, -150],
    ambientColor: '#0c0218',
    slopeWarm: '#ff007f',
    slopeCool: '#1f0438',
    hazeDensity: 0.95,
    fogColor: '#0a0216',
  },
  'forest': {
    skyTop: '#010d06',
    skyMid: '#032111',
    skyHorizon: '#00ff88',
    sunColor: '#00ffaa',
    sunPosition: [-30, 80, -140],
    ambientColor: '#03190e',
    slopeWarm: '#00ffaa',
    slopeCool: '#063820',
    hazeDensity: 0.86,
    fogColor: '#02120a',
  },
};

interface HoverTrafficData {
  mesh: THREE.Group;
  speed: number;
  baseY: number;
  laneX: number;
}

export class SkyManager {
  scene: THREE.Scene;
  skyMesh: THREE.Mesh;
  skyMaterial: THREE.ShaderMaterial;
  dirLight: THREE.DirectionalLight;
  ambientLight: THREE.AmbientLight;

  // Distant Cyber Aerial Traffic Group
  trafficGroup: THREE.Group;
  hoverVehicles: HoverTrafficData[] = [];

  // Giant Holographic Moon / Orbital Ring
  holoRingMesh: THREE.Mesh;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // 1. Cyber Skybox Dome
    const skyGeom = new THREE.SphereGeometry(900, 32, 24);
    this.skyMaterial = new THREE.ShaderMaterial({
      vertexShader: SkyboxShader.vertexShader,
      fragmentShader: SkyboxShader.fragmentShader,
      uniforms: {
        uSkyTop: { value: new THREE.Color(LIGHTING_PRESETS['midnight-cyan'].skyTop) },
        uSkyMid: { value: new THREE.Color(LIGHTING_PRESETS['midnight-cyan'].skyMid) },
        uSkyHorizon: { value: new THREE.Color(LIGHTING_PRESETS['midnight-cyan'].skyHorizon) },
        uSunPosition: { value: new THREE.Vector3(40, 80, -160) },
        uSunColor: { value: new THREE.Color(LIGHTING_PRESETS['midnight-cyan'].sunColor) },
        uTime: { value: 0 },
        uHazeDensity: { value: 0.9 },
        uGridMode: { value: 0.0 },
      },
      side: THREE.BackSide,
      depthWrite: false,
    });

    this.skyMesh = new THREE.Mesh(skyGeom, this.skyMaterial);
    this.scene.add(this.skyMesh);

    // 2. Cyber Lights (Low ambient, high saturated colored directional key)
    this.ambientLight = new THREE.AmbientLight(0x060c18, 0.6);
    this.scene.add(this.ambientLight);

    this.dirLight = new THREE.DirectionalLight(0x00f0ff, 1.4);
    this.dirLight.position.set(40, 80, -160);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.width = 1024;
    this.dirLight.shadow.mapSize.height = 1024;
    this.dirLight.shadow.camera.near = 10;
    this.dirLight.shadow.camera.far = 300;
    this.dirLight.shadow.camera.left = -35;
    this.dirLight.shadow.camera.right = 35;
    this.dirLight.shadow.camera.top = 35;
    this.dirLight.shadow.camera.bottom = -35;
    this.scene.add(this.dirLight);

    // 3. Colossal Holographic Orbital Ring in Upper Sky
    const ringGeom = new THREE.TorusGeometry(320, 4.5, 16, 64);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      wireframe: true,
      transparent: true,
      opacity: 0.35,
    });
    this.holoRingMesh = new THREE.Mesh(ringGeom, ringMat);
    this.holoRingMesh.position.set(0, 220, -380);
    this.holoRingMesh.rotation.set(0.65, 0.4, 0);
    this.scene.add(this.holoRingMesh);

    // 4. Distant Skyway Aerial Traffic (Speeder silhouettes with glowing headlights & taillights)
    this.trafficGroup = new THREE.Group();
    this.scene.add(this.trafficGroup);

    const vehicleGeom = new THREE.BoxGeometry(2.4, 0.6, 6.0);
    const vehicleMat = new THREE.MeshBasicMaterial({ color: 0x0a101d });
    const headLightMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    const tailLightMat = new THREE.MeshBasicMaterial({ color: 0xff0044 });

    for (let i = 0; i < 18; i++) {
      const vGroup = new THREE.Group();
      const body = new THREE.Mesh(vehicleGeom, vehicleMat);
      vGroup.add(body);

      // Cyan front lights
      const hLight = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.15, 0.2), headLightMat);
      hLight.position.set(0, 0, 3.0);
      vGroup.add(hLight);

      // Red tail lights
      const tLight = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.15, 0.2), tailLightMat);
      tLight.position.set(0, 0, -3.0);
      vGroup.add(tLight);

      const laneX = (Math.random() - 0.5) * 280;
      const baseY = 40 + Math.random() * 85;
      const baseZ = (Math.random() - 0.5) * 400;
      vGroup.position.set(laneX, baseY, baseZ);

      const speed = 25 + Math.random() * 45;
      this.hoverVehicles.push({ mesh: vGroup, speed, baseY, laneX });
      this.trafficGroup.add(vGroup);
    }
  }

  applyLightingPreset(mode: LightingMode) {
    const preset = LIGHTING_PRESETS[mode] || LIGHTING_PRESETS['midnight-cyan'];

    this.skyMaterial.uniforms.uSkyTop.value.set(preset.skyTop);
    this.skyMaterial.uniforms.uSkyMid.value.set(preset.skyMid);
    this.skyMaterial.uniforms.uSkyHorizon.value.set(preset.skyHorizon);
    this.skyMaterial.uniforms.uSunColor.value.set(preset.sunColor);
    this.skyMaterial.uniforms.uSunPosition.value.set(...preset.sunPosition);
    this.skyMaterial.uniforms.uHazeDensity.value = preset.hazeDensity;

    this.dirLight.color.set(preset.sunColor);
    this.dirLight.position.set(...preset.sunPosition);
    this.ambientLight.color.set(preset.ambientColor);

    (this.holoRingMesh.material as THREE.MeshBasicMaterial).color.set(preset.sunColor);

    // Real scene-level atmospheric cyberpunk fog (fades all meshes, props & character into darkness)
    this.scene.fog = new THREE.FogExp2(new THREE.Color(preset.fogColor), 0.0032);
  }

  setGridMode(gridMode: number) {
    if (this.skyMaterial.uniforms.uGridMode) {
      this.skyMaterial.uniforms.uGridMode.value = gridMode;
    }
  }

  update(playerPos: THREE.Vector3, playerVelocityZ: number, time: number) {
    // Skybox follows player camera
    this.skyMesh.position.copy(playerPos);
    this.holoRingMesh.position.set(playerPos.x, playerPos.y + 220, playerPos.z - 380);
    this.holoRingMesh.rotation.z = time * 0.05;

    this.skyMaterial.uniforms.uTime.value = time;

    // Update Aerial Cyber Traffic
    for (const v of this.hoverVehicles) {
      v.mesh.position.z += v.speed * 0.016;
      if (v.mesh.position.z > playerPos.z + 280) {
        v.mesh.position.z = playerPos.z - 280;
        v.mesh.position.x = playerPos.x + (Math.random() - 0.5) * 280;
      }
    }
  }

  dispose() {
    this.scene.remove(this.skyMesh);
    this.scene.remove(this.dirLight);
    this.scene.remove(this.ambientLight);
    this.scene.remove(this.holoRingMesh);
    this.scene.remove(this.trafficGroup);
    this.skyMaterial.dispose();
    this.skyMesh.geometry.dispose();
    this.holoRingMesh.geometry.dispose();
  }
}
