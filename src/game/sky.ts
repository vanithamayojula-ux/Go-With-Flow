import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { LightingMode } from '../types';
import { WorldId } from './WorldConfig';

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

/**
 * Physically based look for one campaign world: Preetham sky + sun, sky light,
 * aerial-perspective fog and camera exposure. Values are real-world-ish
 * (sun elevation in degrees, Preetham turbidity/rayleigh/mie terms).
 */
interface WorldAtmosphere {
  sunElevation: number; // degrees above the horizon
  sunAzimuth: number; // degrees; 0 = straight down the track (+Z), 90 = +X
  turbidity: number;
  rayleigh: number;
  mieCoefficient: number;
  mieDirectionalG: number;
  cloudCoverage: number;
  cloudDensity: number;
  exposure: number;
  sunColor: string;
  sunIntensity: number;
  hemiSky: string;
  hemiGround: string;
  hemiIntensity: number;
  envIntensity: number;
  fogColor: string;
  fogDensity: number;
}

const WORLD_ATMOSPHERES: Record<WorldId, WorldAtmosphere> = {
  // Clear high-altitude midday above a sea of cloud
  'sky-isles': {
    sunElevation: 52, sunAzimuth: 150, turbidity: 2.2, rayleigh: 1.0, mieCoefficient: 0.003, mieDirectionalG: 0.8,
    cloudCoverage: 0.35, cloudDensity: 0.45, exposure: 0.45,
    sunColor: '#fff3e2', sunIntensity: 2.8, hemiSky: '#bcd6ff', hemiGround: '#6f7a5c', hemiIntensity: 0.6,
    envIntensity: 1.0, fogColor: '#a9c1db', fogDensity: 0.0008,
  },
  // Humid forest morning, low warm sun through haze
  'verdant-wilds': {
    sunElevation: 18, sunAzimuth: 125, turbidity: 5.0, rayleigh: 1.6, mieCoefficient: 0.006, mieDirectionalG: 0.85,
    cloudCoverage: 0.5, cloudDensity: 0.5, exposure: 0.62,
    sunColor: '#ffd8a6', sunIntensity: 2.6, hemiSky: '#a8c3d6', hemiGround: '#3c4a2a', hemiIntensity: 0.55,
    envIntensity: 0.9, fogColor: '#9fb2a2', fogDensity: 0.0022,
  },
  // Late-afternoon desert, sun low ahead of the rider
  'crimson-dunes': {
    sunElevation: 10, sunAzimuth: 30, turbidity: 8.0, rayleigh: 2.2, mieCoefficient: 0.007, mieDirectionalG: 0.88,
    cloudCoverage: 0.12, cloudDensity: 0.35, exposure: 0.5,
    sunColor: '#ffb274', sunIntensity: 3.0, hemiSky: '#e6c39c', hemiGround: '#8a5a34', hemiIntensity: 0.6,
    envIntensity: 1.0, fogColor: '#d4ae88', fogDensity: 0.0012,
  },
  // Cold, crisp alpine air
  'crystal-heights': {
    sunElevation: 38, sunAzimuth: 160, turbidity: 1.6, rayleigh: 0.7, mieCoefficient: 0.002, mieDirectionalG: 0.8,
    cloudCoverage: 0.25, cloudDensity: 0.4, exposure: 0.5,
    sunColor: '#ffffff', sunIntensity: 3.4, hemiSky: '#cfe1ff', hemiGround: '#9aa7b6', hemiIntensity: 0.7,
    envIntensity: 1.1, fogColor: '#bcd0e6', fogDensity: 0.0009,
  },
  // Volcanic dusk: ash-laden air, sun on the horizon
  'obsidian-core': {
    sunElevation: 2.5, sunAzimuth: 10, turbidity: 16.0, rayleigh: 3.0, mieCoefficient: 0.02, mieDirectionalG: 0.95,
    cloudCoverage: 0.7, cloudDensity: 0.8, exposure: 0.6,
    sunColor: '#ff6a3a', sunIntensity: 2.0, hemiSky: '#6b4a48', hemiGround: '#1a0d0a', hemiIntensity: 0.45,
    envIntensity: 0.7, fogColor: '#4a2c28', fogDensity: 0.003,
  },
};

// Re-bake the reflection environment after the blend moves this far.
const ENV_REBAKE_STEP = 0.1;
const SKY_UNIFORMS_TO_BAKE = ['turbidity', 'rayleigh', 'mieCoefficient', 'mieDirectionalG', 'cloudCoverage', 'cloudDensity'];

export class SkyManager {
  scene: THREE.Scene;
  skyMesh: Sky;
  skyMaterial: THREE.ShaderMaterial;
  dirLight: THREE.DirectionalLight;
  hemiLight: THREE.HemisphereLight;

  private renderer: THREE.WebGLRenderer | null;
  private pmrem: THREE.PMREMGenerator | null = null;
  private envScene = new THREE.Scene();
  private envSky = new Sky();
  private envGroundMat = new THREE.MeshBasicMaterial({ color: 0x6f7a5c, side: THREE.DoubleSide });
  private envGround = new THREE.Mesh(new THREE.CircleGeometry(60, 48), this.envGroundMat);
  private envTarget: THREE.WebGLRenderTarget | null = null;
  private envKey = '';
  private envWeight = -1;

  private sunDir = new THREE.Vector3(0, 1, 0);
  private tmpColA = new THREE.Color();
  private tmpColB = new THREE.Color();

  constructor(scene: THREE.Scene, renderer?: THREE.WebGLRenderer) {
    this.scene = scene;
    this.renderer = renderer ?? null;

    // 1. Preetham atmospheric sky with procedural clouds (renders at the far plane)
    this.skyMesh = new Sky();
    this.skyMesh.scale.setScalar(1000);
    this.skyMesh.frustumCulled = false;
    this.skyMaterial = this.skyMesh.material as THREE.ShaderMaterial;
    this.scene.add(this.skyMesh);

    // 2. Sky light (hemisphere) and the sun
    this.hemiLight = new THREE.HemisphereLight(0xbcd6ff, 0x6f7a5c, 0.6);
    this.scene.add(this.hemiLight);

    this.dirLight = new THREE.DirectionalLight(0xffffff, 3.0);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.set(2048, 2048);
    this.dirLight.shadow.camera.near = 1;
    this.dirLight.shadow.camera.far = 320;
    this.dirLight.shadow.camera.left = -28;
    this.dirLight.shadow.camera.right = 28;
    this.dirLight.shadow.camera.top = 28;
    this.dirLight.shadow.camera.bottom = -28;
    this.dirLight.shadow.bias = -0.0004;
    this.dirLight.shadow.normalBias = 0.03;
    this.scene.add(this.dirLight);
    this.scene.add(this.dirLight.target);

    // 3. Image-based lighting baked from the same sky (no sun disc, to avoid hot spots)
    this.envSky.scale.setScalar(10);
    (this.envSky.material as THREE.ShaderMaterial).uniforms.showSunDisc.value = 0;
    this.envScene.add(this.envSky);
    // The Preetham model is meaningless below the horizon (green/pink nadir),
    // and metal reflects it; bake a ground disc so the lower hemisphere is earth.
    this.envGround.rotation.x = -Math.PI / 2;
    this.envGround.position.y = -0.5;
    this.envScene.add(this.envGround);
    if (this.renderer) this.pmrem = new THREE.PMREMGenerator(this.renderer);

    this.applyWorldAtmosphere('sky-isles', 'sky-isles', 0);
  }

  /**
   * Kept for the settings UI: lighting now comes from each world's physical
   * atmosphere, so the stylised presets no longer change the scene.
   */
  applyLightingPreset(_mode: LightingMode) {}

  /**
   * Blend the atmosphere of `current` toward `next` by `t` (0..1) and apply it
   * to the sky, sun, sky light, fog, exposure and reflection environment.
   */
  applyWorldAtmosphere(current: WorldId, next: WorldId, t: number) {
    const a = WORLD_ATMOSPHERES[current] ?? WORLD_ATMOSPHERES['sky-isles'];
    const b = WORLD_ATMOSPHERES[next] ?? a;
    const w = THREE.MathUtils.clamp(t, 0, 1);
    const mix = (x: number, y: number) => x + (y - x) * w;

    const elev = THREE.MathUtils.degToRad(mix(a.sunElevation, b.sunElevation));
    const azim = THREE.MathUtils.degToRad(mix(a.sunAzimuth, b.sunAzimuth));
    this.sunDir.set(Math.sin(azim) * Math.cos(elev), Math.sin(elev), Math.cos(azim) * Math.cos(elev));

    const u = this.skyMaterial.uniforms;
    u.sunPosition.value.copy(this.sunDir);
    u.turbidity.value = mix(a.turbidity, b.turbidity);
    u.rayleigh.value = mix(a.rayleigh, b.rayleigh);
    u.mieCoefficient.value = mix(a.mieCoefficient, b.mieCoefficient);
    u.mieDirectionalG.value = mix(a.mieDirectionalG, b.mieDirectionalG);
    u.cloudCoverage.value = mix(a.cloudCoverage, b.cloudCoverage);
    u.cloudDensity.value = mix(a.cloudDensity, b.cloudDensity);

    this.dirLight.color.copy(this.tmpColA.set(a.sunColor).lerp(this.tmpColB.set(b.sunColor), w));
    this.dirLight.intensity = mix(a.sunIntensity, b.sunIntensity);
    this.hemiLight.color.copy(this.tmpColA.set(a.hemiSky).lerp(this.tmpColB.set(b.hemiSky), w));
    this.hemiLight.groundColor.copy(this.tmpColA.set(a.hemiGround).lerp(this.tmpColB.set(b.hemiGround), w));
    this.hemiLight.intensity = mix(a.hemiIntensity, b.hemiIntensity);

    const fogColor = this.tmpColA.set(a.fogColor).lerp(this.tmpColB.set(b.fogColor), w);
    const fogDensity = mix(a.fogDensity, b.fogDensity);
    if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.color.copy(fogColor);
      this.scene.fog.density = fogDensity;
    } else {
      this.scene.fog = new THREE.FogExp2(fogColor.clone(), fogDensity);
    }

    this.scene.environmentIntensity = mix(a.envIntensity, b.envIntensity);
    if (this.renderer) this.renderer.toneMappingExposure = mix(a.exposure, b.exposure);

    const key = `${current}>${next}`;
    if (key !== this.envKey || Math.abs(w - this.envWeight) >= ENV_REBAKE_STEP) {
      this.envKey = key;
      this.envWeight = w;
      this.bakeEnvironment();
    }
  }

  private bakeEnvironment() {
    if (!this.pmrem) return;
    const src = this.skyMaterial.uniforms;
    const dst = (this.envSky.material as THREE.ShaderMaterial).uniforms;
    for (const k of SKY_UNIFORMS_TO_BAKE) dst[k].value = src[k].value;
    dst.sunPosition.value.copy(src.sunPosition.value);
    // Ground radiance ~ sky-lit albedo: hemisphere ground colour, scaled to the
    // sky's brightness (Preetham radiance is roughly 0.5-2 in these units).
    this.envGroundMat.color.copy(this.hemiLight.groundColor).multiplyScalar(this.hemiLight.intensity * 1.5);

    const target = this.pmrem.fromScene(this.envScene, 0, 0.1, 100);
    this.envTarget?.dispose();
    this.envTarget = target;
    this.scene.environment = target.texture;
  }

  setShadowsEnabled(enabled: boolean) {
    this.dirLight.castShadow = enabled;
  }

  update(playerPos: THREE.Vector3, _playerVelocityZ: number, time: number, _playerSpeed = 20) {
    // Sky stays centred on the rider; clouds drift slowly
    this.skyMesh.position.copy(playerPos);
    this.skyMaterial.uniforms.time.value = time;

    // Sun shadow frustum follows the rider, cast along the sun direction
    this.dirLight.target.position.set(playerPos.x, playerPos.y, playerPos.z + 12);
    this.dirLight.position.copy(this.dirLight.target.position).addScaledVector(this.sunDir, 150);
    this.dirLight.target.updateMatrixWorld();
  }

  dispose() {
    this.scene.remove(this.skyMesh);
    this.scene.remove(this.dirLight);
    this.scene.remove(this.dirLight.target);
    this.scene.remove(this.hemiLight);
    if (this.envTarget && this.scene.environment === this.envTarget.texture) this.scene.environment = null;
    this.skyMesh.geometry.dispose();
    this.skyMaterial.dispose();
    this.envSky.geometry.dispose();
    (this.envSky.material as THREE.Material).dispose();
    this.envGround.geometry.dispose();
    this.envGroundMat.dispose();
    this.envTarget?.dispose();
    this.pmrem?.dispose();
  }
}
