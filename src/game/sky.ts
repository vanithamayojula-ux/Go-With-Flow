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
    skyTop: '#010308',
    skyMid: '#020712',
    skyHorizon: '#007a8a',
    sunColor: '#00c8d8',
    sunPosition: [0, 85, 30], // Top-front directional lighting toward road and player
    ambientColor: '#02050c',
    slopeWarm: '#008a98',
    slopeCool: '#010d1a',
    hazeDensity: 0.94,
    fogColor: '#01040a',
  },
  'dune-nomad': {
    skyTop: '#3a1c00',
    skyMid: '#8a4b00',
    skyHorizon: '#ffaa33',
    sunColor: '#ffaa33',
    sunPosition: [70, 60, -130],
    ambientColor: '#553000',
    slopeWarm: '#ff8800',
    slopeCool: '#2d1200',
    hazeDensity: 0.88,
    fogColor: '#6a3800',
  },
  'aurora-frost': {
    skyTop: '#001a2e',
    skyMid: '#003d4d',
    skyHorizon: '#00ffcc',
    sunColor: '#00ffcc',
    sunPosition: [-40, 70, -150],
    ambientColor: '#003344',
    slopeWarm: '#00ffaa',
    slopeCool: '#08304d',
    hazeDensity: 0.88,
    fogColor: '#002b3d',
  },
  'bioluminescent-jungle': {
    skyTop: '#021a08',
    skyMid: '#053815',
    skyHorizon: '#39ff14',
    sunColor: '#39ff14',
    sunPosition: [-30, 80, -140],
    ambientColor: '#0a4018',
    slopeWarm: '#00ffaa',
    slopeCool: '#063820',
    hazeDensity: 0.86,
    fogColor: '#03260f',
  },
  'ember-core': {
    skyTop: '#200000',
    skyMid: '#4a0800',
    skyHorizon: '#ff3300',
    sunColor: '#ff5500',
    sunPosition: [20, 65, -140],
    ambientColor: '#400000',
    slopeWarm: '#ff3300',
    slopeCool: '#3d0c00',
    hazeDensity: 0.92,
    fogColor: '#380500',
  },
  'nebula-drift': {
    skyTop: '#0a001a',
    skyMid: '#240047',
    skyHorizon: '#d0a0ff',
    sunColor: '#d0a0ff',
    sunPosition: [-60, 75, -150],
    ambientColor: '#4a2a8a',
    slopeWarm: '#ff007f',
    slopeCool: '#1f0438',
    hazeDensity: 0.95,
    fogColor: '#1a0033',
  },
  'sky-realm': {
    skyTop: '#7dd3fc',
    skyMid: '#bae6fd',
    skyHorizon: '#fef08a',
    sunColor: '#fef08a',
    sunPosition: [40, 85, -140],
    ambientColor: '#fff6e0',
    slopeWarm: '#ffe9a8',
    slopeCool: '#93c5fd',
    hazeDensity: 0.75,
    fogColor: '#cfe8ff',
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
    skyTop: '#010308',
    skyMid: '#020712',
    skyHorizon: '#007a8a',
    sunColor: '#00c8d8',
    sunPosition: [0, 85, 30], // Top-front directional lighting
    ambientColor: '#02050c',
    slopeWarm: '#008a98',
    slopeCool: '#010d1a',
    hazeDensity: 0.94,
    fogColor: '#01040a',
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

  // Giant Deep-Space Celestial Orbital Ring (Infinite Depth Anchor)
  holoRingMesh: THREE.Mesh;

  // Distant Cosmic Horizon Beacon
  beaconLightMesh: THREE.Mesh;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // 1. Deep Space Skybox Dome
    const skyGeom = new THREE.SphereGeometry(900, 32, 24);
    this.skyMaterial = new THREE.ShaderMaterial({
      vertexShader: SkyboxShader.vertexShader,
      fragmentShader: SkyboxShader.fragmentShader,
      uniforms: {
        uSkyTop: { value: new THREE.Color('#010206') },
        uSkyMid: { value: new THREE.Color('#0a0418') },
        uSkyHorizon: { value: new THREE.Color('#02040c') },
        uSunPosition: { value: new THREE.Vector3(0, 90, 40) },
        uSunColor: { value: new THREE.Color('#00d2e0') },
        uTime: { value: 0 },
        uSpeed: { value: 20.0 },
        uHazeDensity: { value: 0.9 },
        uGridMode: { value: 0.0 },
      },
      side: THREE.BackSide,
      depthWrite: false,
    });

    this.skyMesh = new THREE.Mesh(skyGeom, this.skyMaterial);
    this.scene.add(this.skyMesh);

    // 2. Cosmic Directional & Ambient Lighting (30% Reduced brightness, strong contrast)
    this.ambientLight = new THREE.AmbientLight(0x02050e, 0.65);
    this.scene.add(this.ambientLight);

    // Directional lighting from top-front illuminating space highway and player cleanly
    this.dirLight = new THREE.DirectionalLight(0x00d2e0, 0.85);
    this.dirLight.position.set(0, 90, 40);
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

    // 3. Colossal Deep-Space Orbital Ring
    const ringGeom = new THREE.TorusGeometry(360, 3.5, 16, 64);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00d2e0,
      wireframe: true,
      transparent: true,
      opacity: 0.35,
    });
    this.holoRingMesh = new THREE.Mesh(ringGeom, ringMat);
    this.holoRingMesh.position.set(0, 240, -420);
    this.holoRingMesh.rotation.set(0.65, 0.35, 0);
    this.scene.add(this.holoRingMesh);

    // 4. Distant Horizon Cosmic Gateway Beacon (Vanishing Point Reference)
    const beaconGeom = new THREE.SphereGeometry(3.5, 12, 12);
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0x00d2e0 });
    this.beaconLightMesh = new THREE.Mesh(beaconGeom, beaconMat);
    this.beaconLightMesh.position.set(0, 45, 600);
    this.scene.add(this.beaconLightMesh);
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

    // Scene-level atmospheric cosmic depth fog (smooth exponential fade into deep galaxy void)
    this.scene.fog = new THREE.FogExp2(new THREE.Color(0x020512), 0.0035);
  }

  setGridMode(gridMode: number) {
    if (this.skyMaterial.uniforms.uGridMode) {
      this.skyMaterial.uniforms.uGridMode.value = gridMode;
    }
  }

  update(playerPos: THREE.Vector3, playerVelocityZ: number, time: number, playerSpeed = 20) {
    // Skybox follows player camera
    this.skyMesh.position.copy(playerPos);
    this.holoRingMesh.position.set(playerPos.x, playerPos.y + 240, playerPos.z - 420);
    this.holoRingMesh.rotation.z = time * 0.03; // Slow celestial parallax rotation

    // Anchor vanishing point cosmic gateway
    this.beaconLightMesh.position.set(0, 45, playerPos.z + 600);
    const beaconPulse = Math.sin(time * 4.0) * 0.2 + 0.8;
    (this.beaconLightMesh.material as THREE.MeshBasicMaterial).opacity = beaconPulse;

    // Direct lighting follows player frustum with directional top-front angle
    this.dirLight.position.set(playerPos.x, playerPos.y + 90, playerPos.z + 40);
    this.dirLight.target.position.copy(playerPos);
    this.dirLight.target.updateMatrixWorld();

    this.skyMaterial.uniforms.uTime.value = time;
    if (this.skyMaterial.uniforms.uSpeed) {
      this.skyMaterial.uniforms.uSpeed.value = playerSpeed;
    }
  }

  dispose() {
    this.scene.remove(this.skyMesh);
    this.scene.remove(this.dirLight);
    this.scene.remove(this.ambientLight);
    this.scene.remove(this.holoRingMesh);
    this.scene.remove(this.beaconLightMesh);
    this.skyMesh.geometry.dispose();
    this.skyMaterial.dispose();
    this.holoRingMesh.geometry.dispose();
  }
}
