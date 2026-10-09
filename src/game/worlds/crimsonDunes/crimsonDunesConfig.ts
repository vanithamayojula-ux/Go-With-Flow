import { WorldConfig } from '../../WorldConfig';

export const crimsonDunesConfig: WorldConfig = {
  id: 'crimson-dunes',
  index: 2,
  name: 'Crimson Dunes',
  subtitle: 'The Endless Desert',
  palette: {
    skyTop: '#9F1239',        // Deep sunset crimson / burnt red sky
    skyBottom: '#FDBA74',     // Warm glowing amber/sand horizon
    fog: '#EA580C',           // Warm burnt orange dust haze
    terrain: '#C2410C',       // Rich terracotta crimson dunes
    terrainAccent: '#F97316', // Sun-baked ridge crest highlights
    energy: '#FBBF24',        // Radiant golden desert solar relic energy
  },
  lighting: {
    ambient: 0.85,
    sun: 1.6,
    ambientColor: '#FFEDD5',  // Warm sun-baked sandstone bounce
    sunColor: '#FFF7ED',      // Intense blazing desert sunlight
    sunPosition: [55, 60, -135],
  },
  atmosphere: {
    particleType: 'dust',
    particleDensity: 0.85,
    fogDensity: 0.011,
  },
  decorations: {
    vegetation: 'sparse desert',
    structures: 'mesas',
    density: 0.75,
  },
  compatibleBiomes: ['dune-nomad', 'quantum-desert', 'dunes'],
};
