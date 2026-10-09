import { WorldConfig } from '../../WorldConfig';

export const obsidianCoreConfig: WorldConfig = {
  id: 'obsidian-core',
  index: 4,
  name: 'Obsidian Core',
  subtitle: 'The Final Challenge',
  palette: {
    skyTop: '#180303',        // Deep volcanic black/charcoal void
    skyBottom: '#7F1D1D',     // Burning molten crimson horizon
    fog: '#2A0606',           // Smoky volcanic ash & cinder haze
    terrain: '#09090B',       // Fractured obsidian star-rock substrate
    terrainAccent: '#EA580C', // Glowing molten magma crack accent
    energy: '#F97316',        // Intense volcanic flame energy
  },
  lighting: {
    ambient: 0.60,
    sun: 1.50,
    ambientColor: '#450A0A',  // Deep magma underglow
    sunColor: '#F97316',      // Blazing molten orange illumination
    sunPosition: [0, 65, -125],
  },
  atmosphere: {
    particleType: 'embers',
    particleDensity: 1.0,
    fogDensity: 0.012,
  },
  decorations: {
    vegetation: 'none',
    structures: 'volcanic-rock',
    density: 0.85,
  },
  compatibleBiomes: ['ember-core', 'volcanic-forge', 'derelict-station'],
};
