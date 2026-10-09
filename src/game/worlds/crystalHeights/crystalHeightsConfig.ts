import { WorldConfig } from '../../WorldConfig';

export const crystalHeightsConfig: WorldConfig = {
  id: 'crystal-heights',
  index: 3,
  name: 'Crystal Heights',
  subtitle: 'The Celestial Realm',
  palette: {
    skyTop: '#1E1B4B',        // Deep cosmic indigo-violet void
    skyBottom: '#4338CA',     // Radiant twilight purple-magenta nebula horizon
    fog: '#312E81',           // Luminous celestial depth haze
    terrain: '#0F172A',       // Dark crystalline star-rock substrate
    terrainAccent: '#8B5CF6', // Luminous crystalline violet vein accents
    energy: '#22D3EE',        // Radiant celestial cyan mana & crystal glow
  },
  lighting: {
    ambient: 0.70,
    sun: 1.45,
    ambientColor: '#4338CA',  // Ethereal purple/indigo bounce
    sunColor: '#A78BFA',      // Soft lavender/cyan celestial radiance
    sunPosition: [-35, 80, -140],
  },
  atmosphere: {
    particleType: 'crystals',
    particleDensity: 0.90,
    fogDensity: 0.009,
  },
  decorations: {
    vegetation: 'crystal flora',
    structures: 'crystal-spires',
    density: 0.85,
  },
  compatibleBiomes: ['aurora-frost', 'crystal-glacier', 'nebula-drift', 'orbital-ring', 'the-grid'],
};
