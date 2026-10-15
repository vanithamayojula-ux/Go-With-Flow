import { HeroId } from '../types';

export interface HeroDef {
  id: HeroId;
  name: string;
  color: number;
  trail: number;
  cost: number;
  blurb: string;
  modelUrl: string;
  previewUrl: string;
  // Yaw (radians) applied to the GLB so the rider faces down the track (+Z).
  yawOffset?: number;
  ult?: {
    type: string;
    duration?: number;
    speedMul?: number;
    radius?: number;
    timeMul?: number;
  };
}

export const HEROES: HeroDef[] = [
  {
    id: 'custom',
    name: 'Cyber Surfer',
    color: 0x00f0ff,
    trail: 0x70ffff,
    cost: 0,
    blurb: 'Authentic Cyber-Surfer 3D model with aerodynamic board & thrusters!',
    modelUrl: 'model.glb',
    previewUrl: 'hero-previews/custom.webp',
    yawOffset: 0, // Rides facing along its board; 0 puts her back to the chase camera.
    ult: { type: 'dash', duration: 2.5, speedMul: 2.0 },
  },
  {
    id: 'shadow',
    name: 'Shadow Blade',
    color: 0x9aa6c4,
    trail: 0xe8eeff,
    cost: 0,
    blurb: 'Teleport dash — phases forward through anything in the way.',
    modelUrl: 'model02.glb',
    previewUrl: 'hero-previews/shadow.webp',
    yawOffset: -Math.PI / 2, // Side-stance rider: turned so their back faces the chase camera.
    ult: { type: 'dash', duration: 2.2, speedMul: 2.0 },
  },
  {
    id: 'flame',
    name: 'Flame Emperor',
    color: 0xda752a,
    trail: 0xffc24a,
    cost: 150,
    blurb: 'Immolation — burns a path clean and ignores explosions.',
    modelUrl: 'model03.glb',
    previewUrl: 'hero-previews/flame.webp',
    yawOffset: -Math.PI / 2, // Side-stance rider: turned so their back faces the chase camera.
    ult: { type: 'burn', duration: 4.5, radius: 26 },
  },
  {
    id: 'thunder',
    name: 'Thunder Rider',
    color: 0x4663c2,
    trail: 0xdfe9ff,
    cost: 320,
    blurb: 'Overcharge — massive speed burst and chain lightning.',
    modelUrl: 'model04.glb',
    previewUrl: 'hero-previews/thunder.webp',
    yawOffset: -Math.PI / 2, // Side-stance rider: turned so their back faces the chase camera.
    ult: { type: 'overcharge', duration: 5, speedMul: 1.7 },
  },
  {
    id: 'frost',
    name: 'Frost Guardian',
    color: 0x4f86b8,
    trail: 0xdff2ff,
    cost: 500,
    blurb: 'Glacial halt — freezes the void, slowing everything but you.',
    modelUrl: 'model05.glb',
    previewUrl: 'hero-previews/frost.webp',
    yawOffset: -Math.PI / 2, // Side-stance rider: turned so their back faces the chase camera.
    ult: { type: 'freeze', duration: 5, timeMul: 0.5 },
  },
  {
    id: 'void',
    name: 'Void Walker',
    color: 0x6b5a9c,
    trail: 0xb98bff,
    cost: 800,
    blurb: 'Phase shift — becomes untouchable and drinks the abyss.',
    modelUrl: 'model06.glb',
    previewUrl: 'hero-previews/void.webp',
    yawOffset: -Math.PI / 2, // Side-stance rider: turned so their back faces the chase camera.
    ult: { type: 'phase', duration: 6 },
  },
];

export const heroById = (id?: string): HeroDef =>
  HEROES.find((h) => h.id === id) || HEROES[0];
