export interface WorldTheme {
  id: string;
  name: string;
  // Sky / fog
  skyColorTop: number;
  skyColorBottom: number;
  fogColor: number;
  fogDensity: number;
  // Lighting
  ambientLightColor: number;
  ambientLightIntensity: number;
  directionalLightColor: number;
  directionalLightIntensity: number;
  // Environment palette
  groundColor: number;
  trackColor: number;
  laneLineColor: number;
  buildingColors: number[]; // used for skyline / obstacles
  accentGlowColor: number;  // emissives / rails / player trim
  // Particles
  particleType: 'snow' | 'sand' | 'embers' | 'fireflies' | 'stars' | 'rain' | 'none';
  particleColor: number;
  particleDensity: number;  // multiplier on particle count
  // Portal
  portalColor: number;      // color of next portal to hint destination
}

export const WORLD_THEMES: WorldTheme[] = [
  {
    id: 'neon-undercity',
    name: 'Neon Undercity',
    skyColorTop: 0x080014,
    skyColorBottom: 0x1a0033,
    fogColor: 0x140028,
    fogDensity: 0.008,
    ambientLightColor: 0x220044,
    ambientLightIntensity: 0.6,
    directionalLightColor: 0xff0055,
    directionalLightIntensity: 0.8,
    groundColor: 0x05000a,
    trackColor: 0x0f001e,
    laneLineColor: 0x00f0ff,
    buildingColors: [0x120024, 0x1a0033, 0x0a0018],
    accentGlowColor: 0x00f0ff,
    particleType: 'rain',
    particleColor: 0x00f0ff,
    particleDensity: 1.0,
    portalColor: 0xff0055,
  },
  {
    id: 'dune-nomad',
    name: 'Dune Nomad',
    skyColorTop: 0x3a1c00,
    skyColorBottom: 0x8a4b00,
    fogColor: 0x6a3800,
    fogDensity: 0.01,
    ambientLightColor: 0x553000,
    ambientLightIntensity: 0.7,
    directionalLightColor: 0xffaa33,
    directionalLightIntensity: 1.0,
    groundColor: 0x2a1400,
    trackColor: 0x402000,
    laneLineColor: 0xffcc00,
    buildingColors: [0x301800, 0x482400, 0x201000],
    accentGlowColor: 0xff8800,
    particleType: 'sand',
    particleColor: 0xffbb55,
    particleDensity: 1.5,
    portalColor: 0x00ffe1,
  },
  {
    id: 'aurora-frost',
    name: 'Aurora Frost',
    skyColorTop: 0x001a2e,
    skyColorBottom: 0x003d4d,
    fogColor: 0x002b3d,
    fogDensity: 0.007,
    ambientLightColor: 0x003344,
    ambientLightIntensity: 0.5,
    directionalLightColor: 0x00ffcc,
    directionalLightIntensity: 0.9,
    groundColor: 0x00101d,
    trackColor: 0x002030,
    laneLineColor: 0x80ffff,
    buildingColors: [0x002838, 0x00384d, 0x001824],
    accentGlowColor: 0x00ffaa,
    particleType: 'snow',
    particleColor: 0xe0ffff,
    particleDensity: 1.2,
    portalColor: 0xff00aa,
  },
  {
    id: 'bioluminescent-jungle',
    name: 'Bioluminescent Jungle',
    skyColorTop: 0x021a08,
    skyColorBottom: 0x053815,
    fogColor: 0x03260f,
    fogDensity: 0.009,
    ambientLightColor: 0x0a4018,
    ambientLightIntensity: 0.6,
    directionalLightColor: 0x39ff14,
    directionalLightIntensity: 0.85,
    groundColor: 0x011205,
    trackColor: 0x04240c,
    laneLineColor: 0x39ff14,
    buildingColors: [0x063010, 0x0a4418, 0x03200a],
    accentGlowColor: 0x00ff66,
    particleType: 'fireflies',
    particleColor: 0x76ff03,
    particleDensity: 0.8,
    portalColor: 0xbf00ff,
  },
  {
    id: 'ember-core',
    name: 'Ember Core',
    skyColorTop: 0x200000,
    skyColorBottom: 0x4a0800,
    fogColor: 0x380500,
    fogDensity: 0.011,
    ambientLightColor: 0x400000,
    ambientLightIntensity: 0.65,
    directionalLightColor: 0xff3300,
    directionalLightIntensity: 1.1,
    groundColor: 0x150000,
    trackColor: 0x2d0400,
    laneLineColor: 0xff5500,
    buildingColors: [0x380600, 0x500a00, 0x220200],
    accentGlowColor: 0xff2200,
    particleType: 'embers',
    particleColor: 0xff6600,
    particleDensity: 1.4,
    portalColor: 0x00ff88,
  },
  {
    id: 'nebula-drift',
    name: 'Nebula Drift',
    skyColorTop: 0x0a001a,
    skyColorBottom: 0x240047,
    fogColor: 0x1a0033,
    fogDensity: 0.006,
    ambientLightColor: 0x4a2a8a,
    ambientLightIntensity: 0.5,
    directionalLightColor: 0xd0a0ff,
    directionalLightIntensity: 0.7,
    groundColor: 0x0d0a1a,
    trackColor: 0x120d24,
    laneLineColor: 0xd0a0ff,
    buildingColors: [0x1a1030, 0x120d24, 0x0d0a1a],
    accentGlowColor: 0xd0a0ff,
    particleType: 'stars',
    particleColor: 0xffffff,
    particleDensity: 1.8,
    portalColor: 0x00e5ff,
  },
];

/** Returns the theme after `currentId` in the cycle, wrapping around. */
export function getNextTheme(currentId: string): WorldTheme {
  const idx = WORLD_THEMES.findIndex((t) => t.id === currentId);
  const nextIdx = idx === -1 ? 0 : (idx + 1) % WORLD_THEMES.length;
  return WORLD_THEMES[nextIdx];
}
