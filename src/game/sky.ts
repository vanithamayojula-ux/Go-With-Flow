import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { LightingMode } from '../types';
import { WorldId, WORLD_ORDER } from './WorldConfig';

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

// Sky light comes almost entirely from the image-based environment baked from
// the same sky; the hemisphere light only adds a faint directional sky/ground
// tint (0.1-0.15). Stacking a strong hemisphere light on top of the IBL fills
// in every shadow and flattens the image.
const WORLD_ATMOSPHERES: Record<WorldId, WorldAtmosphere> = {
  // Clear high-altitude midday above a sea of cloud
  'sky-isles': {
    sunElevation: 52, sunAzimuth: 150, turbidity: 2.2, rayleigh: 1.0, mieCoefficient: 0.003, mieDirectionalG: 0.8,
    cloudCoverage: 0.35, cloudDensity: 0.45, exposure: 0.5,
    sunColor: '#fff3e2', sunIntensity: 3.0, hemiSky: '#bcd6ff', hemiGround: '#6f7a5c', hemiIntensity: 0.12,
    envIntensity: 1.0, fogColor: '#a9c1db', fogDensity: 0.0008,
  },
  // Humid forest morning, low warm sun through haze
  'verdant-wilds': {
    sunElevation: 22, sunAzimuth: 125, turbidity: 4.5, rayleigh: 1.5, mieCoefficient: 0.005, mieDirectionalG: 0.82,
    cloudCoverage: 0.45, cloudDensity: 0.5, exposure: 0.66,
    sunColor: '#ffdcae', sunIntensity: 2.9, hemiSky: '#a8c3d6', hemiGround: '#3c4a2a', hemiIntensity: 0.12,
    envIntensity: 0.95, fogColor: '#9fb2a2', fogDensity: 0.0022,
  },
  // Late-afternoon desert: sun off to the side so it rakes across the dunes
  // without flooding half the sky with forward-scattered glare
  'crimson-dunes': {
    sunElevation: 16, sunAzimuth: 60, turbidity: 4.0, rayleigh: 1.8, mieCoefficient: 0.004, mieDirectionalG: 0.8,
    cloudCoverage: 0.12, cloudDensity: 0.35, exposure: 0.52,
    sunColor: '#ffbf86', sunIntensity: 3.2, hemiSky: '#e6c39c', hemiGround: '#8a5a34', hemiIntensity: 0.12,
    envIntensity: 1.0, fogColor: '#d9bc9a', fogDensity: 0.0012,
  },
  // Cold, crisp alpine air
  'crystal-heights': {
    sunElevation: 34, sunAzimuth: 145, turbidity: 1.8, rayleigh: 0.8, mieCoefficient: 0.002, mieDirectionalG: 0.8,
    cloudCoverage: 0.25, cloudDensity: 0.4, exposure: 0.5,
    sunColor: '#fffaf2', sunIntensity: 3.4, hemiSky: '#cfe1ff', hemiGround: '#9aa7b6', hemiIntensity: 0.12,
    envIntensity: 1.05, fogColor: '#bcd0e6', fogDensity: 0.0009,
  },
  // Volcanic dusk: ash haze and a low orange sun. Kept moderate so the sky
  // light (and the IBL baked from it) is not flooded to white.
  'obsidian-core': {
    sunElevation: 9, sunAzimuth: 25, turbidity: 6.0, rayleigh: 2.4, mieCoefficient: 0.005, mieDirectionalG: 0.8,
    cloudCoverage: 0.6, cloudDensity: 0.7, exposure: 0.66,
    sunColor: '#ff8a55', sunIntensity: 3.0, hemiSky: '#6b4a48', hemiGround: '#24120c', hemiIntensity: 0.15,
    envIntensity: 0.55, fogColor: '#3a2622', fogDensity: 0.006,
  },
};

/** A world's atmosphere with every colour parsed once (no per-frame string parsing). */
interface ParsedAtmosphere {
  src: WorldAtmosphere;
  sunColor: THREE.Color;
  hemiSky: THREE.Color;
  hemiGround: THREE.Color;
  fogColor: THREE.Color;
}

const PARSED_ATMOSPHERES = {} as Record<WorldId, ParsedAtmosphere>;
for (const id of Object.keys(WORLD_ATMOSPHERES) as WorldId[]) {
  const a = WORLD_ATMOSPHERES[id];
  PARSED_ATMOSPHERES[id] = {
    src: a,
    sunColor: new THREE.Color(a.sunColor),
    hemiSky: new THREE.Color(a.hemiSky),
    hemiGround: new THREE.Color(a.hemiGround),
    fogColor: new THREE.Color(a.fogColor),
  };
}

function parsedAtmosphere(id: WorldId): ParsedAtmosphere {
  return PARSED_ATMOSPHERES[id] ?? PARSED_ATMOSPHERES['sky-isles'];
}

/**
 * Read-only look of a world's atmosphere: camera exposure plus its horizon
 * haze and sky-light colours (shared objects: never mutate them). Used by the
 * portal gateway (exposure match, static window tint on low tiers).
 */
export function getAtmosphereInfo(worldId: WorldId): { exposure: number; fogColor: THREE.Color; skyColor: THREE.Color } {
  const a = parsedAtmosphere(worldId);
  return { exposure: a.src.exposure, fogColor: a.fogColor, skyColor: a.hemiSky };
}

function nextWorldOf(id: WorldId): WorldId | null {
  const i = WORLD_ORDER.indexOf(id);
  return i >= 0 && i < WORLD_ORDER.length - 1 ? WORLD_ORDER[i + 1] : null;
}

const SKY_UNIFORMS_TO_BAKE = ['turbidity', 'rayleigh', 'mieCoefficient', 'mieDirectionalG', 'cloudCoverage', 'cloudDensity'] as const;

/** Everything applyAtmosphere() touches, so withAtmosphere() can restore it exactly. */
interface AtmosphereSnapshot {
  sunDir: THREE.Vector3;
  sunPosition: THREE.Vector3;
  sky: number[];
  dirColor: THREE.Color;
  dirIntensity: number;
  dirPosition: THREE.Vector3;
  hemiColor: THREE.Color;
  hemiGround: THREE.Color;
  hemiIntensity: number;
  fogColor: THREE.Color;
  fogDensity: number;
  environment: THREE.Texture | null;
  environmentIntensity: number;
  exposure: number;
  envWorld: WorldId | null;
}

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
  // One baked PMREM environment per world, baked once and reused. Only the
  // current world's and the next world's are kept (see pruneEnvironments).
  private envCache = new Map<WorldId, THREE.WebGLRenderTarget>();
  private envWorld: WorldId | null = null;

  // Last applied blend, so an unchanged frame is skipped entirely.
  private lastCurrent: WorldId | null = null;
  private lastNext: WorldId | null = null;
  private lastWeight = -1;

  private sunDir = new THREE.Vector3(0, 1, 0);
  private shadowTarget = new THREE.Vector3();
  private fog: THREE.FogExp2;
  private snapshot: AtmosphereSnapshot = {
    sunDir: new THREE.Vector3(),
    sunPosition: new THREE.Vector3(),
    sky: [0, 0, 0, 0, 0, 0],
    dirColor: new THREE.Color(),
    dirIntensity: 0,
    dirPosition: new THREE.Vector3(),
    hemiColor: new THREE.Color(),
    hemiGround: new THREE.Color(),
    hemiIntensity: 0,
    fogColor: new THREE.Color(),
    fogDensity: 0,
    environment: null,
    environmentIntensity: 1,
    exposure: 1,
    envWorld: null,
  };
  private snapshotDepth = 0;

  constructor(scene: THREE.Scene, renderer?: THREE.WebGLRenderer) {
    this.scene = scene;
    this.renderer = renderer ?? null;

    // 1. Preetham atmospheric sky with procedural clouds (renders at the far plane)
    this.skyMesh = new Sky();
    this.skyMesh.scale.setScalar(1000);
    this.skyMesh.frustumCulled = false;
    this.skyMaterial = this.skyMesh.material as THREE.ShaderMaterial;
    this.scene.add(this.skyMesh);

    // 2. Sky light (hemisphere) and the sun. These two are the only lights in
    // the scene for the whole session: a constant light count means lit
    // materials never have to recompile mid-run.
    this.hemiLight = new THREE.HemisphereLight(0xbcd6ff, 0x6f7a5c, 0.12);
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

    this.fog = new THREE.FogExp2(0xa9c1db, 0.0008);
    this.scene.fog = this.fog;

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

    this.applyAtmosphere('sky-isles');
  }

  /**
   * Kept for the settings UI: lighting now comes from each world's physical
   * atmosphere, so the stylised presets no longer change the scene.
   */
  applyLightingPreset(_mode: LightingMode) {}

  /** Snap the sky, sun, sky light, fog, exposure and environment to one world. */
  applyAtmosphere(worldId: WorldId) {
    this.applyWorldAtmosphere(worldId, worldId, 0);
  }

  /**
   * Temporarily apply another world's sky/fog/environment/lights, run `fn`
   * (e.g. render the next world's look inside the portal), then restore the
   * current state exactly. Nested calls are allowed. The world's environment
   * is baked on first use; call prebakeEnvironment() earlier to avoid that.
   */
  withAtmosphere<T>(worldId: WorldId, fn: () => T): T {
    const s = this.snapshot;
    const outer = this.snapshotDepth === 0;
    // Only the outermost call snapshots (nested calls restore to it at the end).
    if (outer) this.captureSnapshot(s);
    this.snapshotDepth++;
    const lc = this.lastCurrent;
    const ln = this.lastNext;
    const lw = this.lastWeight;
    try {
      this.applyBlend(parsedAtmosphere(worldId), parsedAtmosphere(worldId), 0);
      this.useEnvironment(worldId, false);
      return fn();
    } finally {
      this.snapshotDepth--;
      if (outer) this.restoreSnapshot(s);
      this.lastCurrent = lc;
      this.lastNext = ln;
      this.lastWeight = lw;
    }
  }

  /**
   * Bake (once) the reflection environment for a world without applying it,
   * so switching to it later is just a texture swap. Call while preloading.
   */
  prebakeEnvironment(worldId: WorldId) {
    if (this.envCache.has(worldId) || !this.pmrem) return;
    const a = parsedAtmosphere(worldId);
    const src = a.src;
    const dst = (this.envSky.material as THREE.ShaderMaterial).uniforms;
    for (const k of SKY_UNIFORMS_TO_BAKE) dst[k].value = src[k];
    const elev = THREE.MathUtils.degToRad(src.sunElevation);
    const azim = THREE.MathUtils.degToRad(src.sunAzimuth);
    dst.sunPosition.value.set(Math.sin(azim) * Math.cos(elev), Math.sin(elev), Math.cos(azim) * Math.cos(elev));
    // Ground radiance ~ sky-lit albedo: hemisphere ground colour at a fixed
    // scale (Preetham radiance is roughly 0.5-2 in these units).
    this.envGroundMat.color.copy(a.hemiGround).multiplyScalar(0.9);
    this.envCache.set(worldId, this.pmrem.fromScene(this.envScene, 0, 0.1, 100));
  }

  hasEnvironment(worldId: WorldId): boolean {
    return this.envCache.has(worldId) || !this.pmrem;
  }

  /**
   * Blend the atmosphere of `current` toward `next` by `t` (0..1) and apply it
   * to the sky, sun, sky light, fog and exposure. The engine itself only snaps
   * (applyAtmosphere): the next world is seen through the portal gateway's
   * window (withAtmosphere) and the switch happens as the rider crosses the
   * gateway. The reflection environment is never re-baked here: it is the
   * current world's cached bake, swapped in one go.
   */
  applyWorldAtmosphere(current: WorldId, next: WorldId, t: number) {
    const w = THREE.MathUtils.clamp(t, 0, 1);
    if (current === this.lastCurrent && next === this.lastNext && w === this.lastWeight) return;
    this.lastCurrent = current;
    this.lastNext = next;
    this.lastWeight = w;
    this.applyBlend(parsedAtmosphere(current), parsedAtmosphere(next), w);
    this.useEnvironment(current, true);
  }

  private applyBlend(pa: ParsedAtmosphere, pb: ParsedAtmosphere, w: number) {
    const a = pa.src;
    const b = pb.src;
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

    this.dirLight.color.copy(pa.sunColor).lerp(pb.sunColor, w);
    this.dirLight.intensity = mix(a.sunIntensity, b.sunIntensity);
    this.dirLight.position.copy(this.shadowTarget).addScaledVector(this.sunDir, 150);
    this.hemiLight.color.copy(pa.hemiSky).lerp(pb.hemiSky, w);
    this.hemiLight.groundColor.copy(pa.hemiGround).lerp(pb.hemiGround, w);
    this.hemiLight.intensity = mix(a.hemiIntensity, b.hemiIntensity);

    // The scene keeps one FogExp2 for its whole life (swapping the fog object
    // would flag every material for a program change).
    if (this.scene.fog !== this.fog) this.scene.fog = this.fog;
    this.fog.color.copy(pa.fogColor).lerp(pb.fogColor, w);
    this.fog.density = mix(a.fogDensity, b.fogDensity);

    this.scene.environmentIntensity = mix(a.envIntensity, b.envIntensity);
    if (this.renderer) this.renderer.toneMappingExposure = mix(a.exposure, b.exposure);
  }

  /** Point scene.environment at a world's cached bake (baking it if needed). */
  private useEnvironment(worldId: WorldId, prune: boolean) {
    if (!this.pmrem) return;
    if (this.envWorld === worldId && this.scene.environment) return;
    this.prebakeEnvironment(worldId);
    const target = this.envCache.get(worldId);
    if (!target) return;
    this.scene.environment = target.texture;
    this.envWorld = worldId;
    if (prune) this.pruneEnvironments(worldId);
  }

  /** Keep only the current world's and the next world's environment bakes. */
  private pruneEnvironments(current: WorldId) {
    const next = nextWorldOf(current);
    for (const [id, target] of this.envCache) {
      if (id === current || id === next) continue;
      if (this.scene.environment === target.texture) continue;
      target.dispose();
      this.envCache.delete(id);
    }
  }

  private captureSnapshot(s: AtmosphereSnapshot) {
    const u = this.skyMaterial.uniforms;
    s.sunDir.copy(this.sunDir);
    s.sunPosition.copy(u.sunPosition.value);
    for (let i = 0; i < SKY_UNIFORMS_TO_BAKE.length; i++) s.sky[i] = u[SKY_UNIFORMS_TO_BAKE[i]].value;
    s.dirColor.copy(this.dirLight.color);
    s.dirIntensity = this.dirLight.intensity;
    s.dirPosition.copy(this.dirLight.position);
    s.hemiColor.copy(this.hemiLight.color);
    s.hemiGround.copy(this.hemiLight.groundColor);
    s.hemiIntensity = this.hemiLight.intensity;
    s.fogColor.copy(this.fog.color);
    s.fogDensity = this.fog.density;
    s.environment = this.scene.environment;
    s.environmentIntensity = this.scene.environmentIntensity;
    s.exposure = this.renderer ? this.renderer.toneMappingExposure : 1;
    s.envWorld = this.envWorld;
  }

  private restoreSnapshot(s: AtmosphereSnapshot) {
    const u = this.skyMaterial.uniforms;
    this.sunDir.copy(s.sunDir);
    u.sunPosition.value.copy(s.sunPosition);
    for (let i = 0; i < SKY_UNIFORMS_TO_BAKE.length; i++) u[SKY_UNIFORMS_TO_BAKE[i]].value = s.sky[i];
    this.dirLight.color.copy(s.dirColor);
    this.dirLight.intensity = s.dirIntensity;
    this.dirLight.position.copy(s.dirPosition);
    this.hemiLight.color.copy(s.hemiColor);
    this.hemiLight.groundColor.copy(s.hemiGround);
    this.hemiLight.intensity = s.hemiIntensity;
    this.fog.color.copy(s.fogColor);
    this.fog.density = s.fogDensity;
    this.scene.environment = s.environment;
    this.scene.environmentIntensity = s.environmentIntensity;
    if (this.renderer) this.renderer.toneMappingExposure = s.exposure;
    this.envWorld = s.envWorld;
  }

  setShadowsEnabled(enabled: boolean) {
    this.dirLight.castShadow = enabled;
  }

  /** Shadow map resolution (2048 on the top tier, 1024 below). */
  setShadowMapSize(size: number) {
    const shadow = this.dirLight.shadow;
    if (shadow.mapSize.x === size && shadow.mapSize.y === size) return;
    shadow.mapSize.set(size, size);
    if (shadow.map) {
      shadow.map.dispose();
      (shadow as any).map = null;
    }
  }

  update(playerPos: THREE.Vector3, _playerVelocityZ: number, time: number, _playerSpeed = 20) {
    // Sky stays centred on the rider; clouds drift slowly
    this.skyMesh.position.copy(playerPos);
    this.skyMaterial.uniforms.time.value = time;

    // Sun shadow frustum follows the rider, cast along the sun direction
    this.shadowTarget.set(playerPos.x, playerPos.y, playerPos.z + 12);
    this.dirLight.target.position.copy(this.shadowTarget);
    this.dirLight.position.copy(this.shadowTarget).addScaledVector(this.sunDir, 150);
    this.dirLight.target.updateMatrixWorld();
  }

  dispose() {
    this.scene.remove(this.skyMesh);
    this.scene.remove(this.dirLight);
    this.scene.remove(this.dirLight.target);
    this.scene.remove(this.hemiLight);
    if (this.scene.fog === this.fog) this.scene.fog = null;
    for (const target of this.envCache.values()) {
      if (this.scene.environment === target.texture) this.scene.environment = null;
      target.dispose();
    }
    this.envCache.clear();
    this.skyMesh.geometry.dispose();
    this.skyMaterial.dispose();
    this.envSky.geometry.dispose();
    (this.envSky.material as THREE.Material).dispose();
    this.envGround.geometry.dispose();
    this.envGroundMat.dispose();
    this.pmrem?.dispose();
  }
}
