import { WorldConfig } from '../../WorldConfig';

export const verdantWildsConfig: WorldConfig = {
  id: 'verdant-wilds',
  index: 1,
  name: 'Verdant Wilds',
  subtitle: 'The Living Forest',
  palette: {
    skyTop: '#1E3A2F',        // Deep forest emerald canopy top
    skyBottom: '#A7F3D0',     // Luminous moss mist horizon
    fog: '#153E35',           // Rich teal-green forest depth haze
    terrain: '#14291E',       // Deep nutrient-rich loam / ancient roots
    terrainAccent: '#34D399', // Radiant bioluminescent moss accent
    energy: '#10B981',        // Vibrant nature spirit / emerald mana
  },
  lighting: {
    ambient: 0.85,
    sun: 1.35,
    ambientColor: '#D1FAE5',  // Dappled leaf canopy ambient
    sunColor: '#FEF08A',      // Warm golden sun shafts filtering through leaves
    sunPosition: [35, 65, -110],
  },
  atmosphere: {
    particleType: 'fireflies',
    particleDensity: 1.0,
    fogDensity: 0.010,
  },
  decorations: {
    vegetation: 'forest',
    structures: 'ruins',
    density: 1.15,
  },
  compatibleBiomes: ['bioluminescent-jungle', 'cyber-forest', 'forest'],
};
