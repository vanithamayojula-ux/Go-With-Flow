import { WorldConfig } from '../../WorldConfig';

export const crystalHeightsConfig: WorldConfig = {
  id: 'crystal-heights',
  index: 3,
  name: 'Crystal Heights',
  subtitle: 'The Celestial Realm',
  palette: {
    skyTop: '#3F74B5',        // Deep high-altitude blue
    skyBottom: '#C9DCEC',     // Pale cold horizon
    fog: '#BCD0E6',           // Crisp alpine air haze
    terrain: '#E9EEF3',       // Snowfield
    terrainAccent: '#7D8287', // Granite
    energy: '#7CC4E8',        // Glacial ice blue
  },
  lighting: {
    ambient: 0.75,
    sun: 1.5,
    ambientColor: '#DCE8F4',  // Cool sky bounce off snow
    sunColor: '#FFF6EA',      // Clean high-altitude sunlight
    sunPosition: [-35, 80, -140],
  },
  atmosphere: {
    particleType: 'crystals',
    particleDensity: 0.35,
    fogDensity: 0.004,
  },
  decorations: {
    vegetation: 'snow-laden spruce',
    structures: 'crystal-spires',
    density: 0.85,
  },
  compatibleBiomes: ['aurora-frost', 'crystal-glacier', 'nebula-drift', 'orbital-ring', 'the-grid'],
};
