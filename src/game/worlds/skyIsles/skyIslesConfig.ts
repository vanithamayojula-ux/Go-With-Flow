import { WorldConfig } from '../../WorldConfig';

export const skyIslesConfig: WorldConfig = {
  id: 'sky-isles',
  index: 0,
  name: 'Sky Isles',
  subtitle: 'The Beginning',
  palette: {
    skyTop: '#7DD3FC',
    skyBottom: '#F0F9FF',
    fog: '#DFF6FF',
    terrain: '#E2E8F0',
    terrainAccent: '#86EFAC',
    energy: '#22D3EE',
  },
  lighting: {
    ambient: 0.85,
    sun: 1.4,
    ambientColor: '#E0F2FE',
    sunColor: '#FFFFFF',
    sunPosition: [30, 80, -120],
  },
  atmosphere: {
    particleType: 'clouds',
    particleDensity: 0.7,
    fogDensity: 0.008,
  },
  decorations: {
    vegetation: 'light vegetation',
    structures: 'islands',
    density: 0.85,
  },
  compatibleBiomes: ['sky-realm', 'sky-islands', 'meadow'],
};
