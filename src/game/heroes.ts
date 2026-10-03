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
    name: 'Cyber 3D Model',
    color: 0x00f0ff,
    trail: 0x70ffff,
    cost: 0,
    blurb: 'Custom 3D model loaded from public/model.glb directly onto your hoverboard!',
    modelUrl: '/model.glb',
    previewUrl: '/player_sprite.jpg',
    yawOffset: Math.PI,
    ult: { type: 'dash', duration: 2.5, speedMul: 2.0 },
  },
  {
    id: 'shadow',
    name: 'Shadow Blade',
    color: 0x9aa6c4,
    trail: 0xe8eeff,
    cost: 0,
    blurb: 'Teleport dash — phases forward through anything in the way.',
    modelUrl: '/models/shadow.glb',
    previewUrl: '/hero-previews/shadow.jpg',
    yawOffset: 0, // Base orientation +Z along track
    ult: { type: 'dash', duration: 2.2, speedMul: 2.0 },
  },
  {
    id: 'flame',
    name: 'Flame Emperor',
    color: 0xda752a,
    trail: 0xffc24a,
    cost: 150,
    blurb: 'Immolation — burns a path clean and ignores explosions.',
    modelUrl: '/models/flame.glb',
    previewUrl: '/hero-previews/flame.jpg',
    yawOffset: 0,
    ult: { type: 'burn', duration: 4.5, radius: 26 },
  },
  {
    id: 'thunder',
    name: 'Thunder Rider',
    color: 0x4663c2,
    trail: 0xdfe9ff,
    cost: 320,
    blurb: 'Overcharge — massive speed burst and chain lightning.',
    modelUrl: '/models/thunder.glb',
    previewUrl: '/hero-previews/thunder.jpg',
    yawOffset: 0,
    ult: { type: 'overcharge', duration: 5, speedMul: 1.7 },
  },
  {
    id: 'frost',
    name: 'Frost Guardian',
    color: 0x4f86b8,
    trail: 0xdff2ff,
    cost: 500,
    blurb: 'Glacial halt — freezes the void, slowing everything but you.',
    modelUrl: '/models/frost.glb',
    previewUrl: '/hero-previews/frost.jpg',
    yawOffset: 0,
    ult: { type: 'freeze', duration: 5, timeMul: 0.5 },
  },
  {
    id: 'void',
    name: 'Void Walker',
    color: 0x6b5a9c,
    trail: 0xb98bff,
    cost: 800,
    blurb: 'Phase shift — becomes untouchable and drinks the abyss.',
    modelUrl: '/models/void.glb',
    previewUrl: '/hero-previews/void.jpg',
    yawOffset: 0,
    ult: { type: 'phase', duration: 6 },
  },
];

export const heroById = (id?: string): HeroDef =>
  HEROES.find((h) => h.id === id) || HEROES[0];
