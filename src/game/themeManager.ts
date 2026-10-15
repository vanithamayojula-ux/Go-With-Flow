import * as THREE from 'three';
import { BiomeType } from '../types';
import { SkyManager } from './sky';
import { TerrainManager } from './terrain';
import { ObstacleManager } from './obstacles';

export interface ThemeDefinition {
  id: BiomeType;
  name: string;
  color: string;
  secondaryColor: string;
  skyTopColor: number;
  skyHorizonColor: number;
  sunColor: number;
}

export const THEME_REGISTRY: Record<string, ThemeDefinition> = {
  'neon-undercity': {
    id: 'neon-undercity',
    name: 'Neon Undercity // Sector 01',
    color: '#00F0FF',
    secondaryColor: '#FF007F',
    skyTopColor: 0x010308,
    skyHorizonColor: 0x007a8a,
    sunColor: 0x00c8d8,
  },
  'dune-nomad': {
    id: 'dune-nomad',
    name: 'Dune Nomad // Amber Mesas',
    color: '#FFAA33',
    secondaryColor: '#FF6600',
    skyTopColor: 0x3a1c00,
    skyHorizonColor: 0xffaa33,
    sunColor: 0xffaa33,
  },
  'aurora-frost': {
    id: 'aurora-frost',
    name: 'Aurora Frost // Glacier Tundra',
    color: '#00FFCC',
    secondaryColor: '#0088FF',
    skyTopColor: 0x001a2e,
    skyHorizonColor: 0x00ffcc,
    sunColor: 0x00ffcc,
  },
  'bioluminescent-jungle': {
    id: 'bioluminescent-jungle',
    name: 'Bioluminescent Jungle // Canopy',
    color: '#39FF14',
    secondaryColor: '#00F0FF',
    skyTopColor: 0x021a08,
    skyHorizonColor: 0x39ff14,
    sunColor: 0x39ff14,
  },
  'jungle': {
    id: 'bioluminescent-jungle',
    name: 'Bioluminescent Jungle // Canopy',
    color: '#39FF14',
    secondaryColor: '#00F0FF',
    skyTopColor: 0x021a08,
    skyHorizonColor: 0x39ff14,
    sunColor: 0x39ff14,
  },
  'ember-core': {
    id: 'ember-core',
    name: 'Ember Core // Magma Obsidian',
    color: '#FF3300',
    secondaryColor: '#FF8800',
    skyTopColor: 0x200000,
    skyHorizonColor: 0xff3300,
    sunColor: 0xff5500,
  },
  'nebula-drift': {
    id: 'nebula-drift',
    name: 'Nebula Drift // Stellar Void',
    color: '#D0A0FF',
    secondaryColor: '#FF007F',
    skyTopColor: 0x0a001a,
    skyHorizonColor: 0xd0a0ff,
    sunColor: 0xd0a0ff,
  },
  'sky-realm': {
    id: 'sky-realm',
    name: 'Sky Realm // Cloud Isles',
    color: '#FEF08A',
    secondaryColor: '#7DD3FC',
    skyTopColor: 0x7dd3fc,
    skyHorizonColor: 0xfef08a,
    sunColor: 0xfef08a,
  },
  'quantum-desert': {
    id: 'quantum-desert',
    name: 'Quantum Desert // Amber Mesas',
    color: '#FFAA00',
    secondaryColor: '#FF3300',
    skyTopColor: 0x160804,
    skyHorizonColor: 0x3d1708,
    sunColor: 0xffaa00,
  },
  'cyber-forest': {
    id: 'cyber-forest',
    name: 'Cyber Forest // Bioluminescent Canopy',
    color: '#00FF66',
    secondaryColor: '#00F0FF',
    skyTopColor: 0x021208,
    skyHorizonColor: 0x062814,
    sunColor: 0x00ff88,
  },
  'orbital-ring': {
    id: 'orbital-ring',
    name: 'Orbital Ring // Stellar Void',
    color: '#FFFFFF',
    secondaryColor: '#9D00FF',
    skyTopColor: 0x000206,
    skyHorizonColor: 0x080f24,
    sunColor: 0xffffff,
  },
  'the-grid': {
    id: 'the-grid',
    name: 'The Grid // Vector Cyberspace',
    color: '#00FFFF',
    secondaryColor: '#0088FF',
    skyTopColor: 0x02040a,
    skyHorizonColor: 0x04182b,
    sunColor: 0x00e5ff,
  },
  'volcanic-forge': {
    id: 'volcanic-forge',
    name: 'Volcanic Forge // Magma Core',
    color: '#FF3300',
    secondaryColor: '#FF9900',
    skyTopColor: 0x180303,
    skyHorizonColor: 0x380905,
    sunColor: 0xff4400,
  },
  'crystal-glacier': {
    id: 'crystal-glacier',
    name: 'Crystal Glacier // Frost Realm',
    color: '#99EEFF',
    secondaryColor: '#0066FF',
    skyTopColor: 0x030d1a,
    skyHorizonColor: 0x0a2647,
    sunColor: 0x88ddff,
  },
  'derelict-station': {
    id: 'derelict-station',
    name: 'Derelict Station // Hazard Zone',
    color: '#FFCC00',
    secondaryColor: '#FF2200',
    skyTopColor: 0x0a0902,
    skyHorizonColor: 0x241d06,
    sunColor: 0xffbb00,
  },
  // Biomes reachable via ?biome= and handled in terrain/sky, but previously
  // absent here, so they silently fell back to neon-undercity.
  'bleach-bypass-steel': {
    id: 'bleach-bypass-steel',
    name: 'Bleach Bypass // Steel Complex',
    color: '#E8F4FF',
    secondaryColor: '#7A9CB5',
    skyTopColor: 0x1a2430,
    skyHorizonColor: 0x5c7a8f,
    sunColor: 0xdceaff,
  },
  'meadow': {
    id: 'meadow',
    name: 'Neon Meadow // Green Fields',
    color: '#B6FF3D',
    secondaryColor: '#39FF14',
    skyTopColor: 0x0a1f05,
    skyHorizonColor: 0x7ec82a,
    sunColor: 0xd4ff6b,
  },
  'dunes': {
    id: 'dunes',
    name: 'Sunlit Dunes // Open Desert',
    color: '#FFD48A',
    secondaryColor: '#CC7722',
    skyTopColor: 0x4a2c0a,
    skyHorizonColor: 0xffcc77,
    sunColor: 0xffdd99,
  },
  'sky-islands': {
    id: 'sky-islands',
    name: 'Sky Islands // Floating Archipelago',
    color: '#9BE8FF',
    secondaryColor: '#FFFFFF',
    skyTopColor: 0x1d4a7a,
    skyHorizonColor: 0xaee6ff,
    sunColor: 0xfff4cc,
  },
  'forest': {
    id: 'forest',
    name: 'Verdant Forest // Deep Canopy',
    color: '#5CE07A',
    secondaryColor: '#1E7A3C',
    skyTopColor: 0x061a0e,
    skyHorizonColor: 0x2f7d46,
    sunColor: 0xa8f0b8,
  },
};

// Legacy biome ids that still exist in BiomeType and are used by terrain/sky
// code. Without entries here ThemeManager fell back to Neon Undercity for them.
const LEGACY_THEME_ALIASES: Partial<Record<BiomeType, BiomeType>> = {
  'sky-islands': 'sky-realm',
  'meadow': 'sky-realm',
  'dunes': 'dune-nomad',
  'forest': 'cyber-forest',
  'bleach-bypass-steel': 'derelict-station',
};
for (const [legacyId, targetId] of Object.entries(LEGACY_THEME_ALIASES)) {
  const target = THEME_REGISTRY[targetId as string];
  if (target && !THEME_REGISTRY[legacyId]) {
    THEME_REGISTRY[legacyId] = { ...target, id: legacyId as BiomeType };
  }
}

// Portal crossing FX: one ring of light expanding through the gateway plane
// and a few short light streaks rushing past the rider, in the destination
// world's energy colour. Kept brief and faint (realistic lens/air effect,
// not a neon tunnel).
const WARP_DURATION = 0.7;
const STREAK_COUNT = 40;

export class ThemeManager {
  scene: THREE.Scene;
  currentTheme: ThemeDefinition;

  // Warp Portal FX Group
  private warpGroup: THREE.Group;
  private ring: THREE.Mesh;
  private ringMat: THREE.MeshBasicMaterial;
  private streaks: THREE.InstancedMesh;
  private streakMat: THREE.MeshBasicMaterial;
  private streakParams = new Float32Array(STREAK_COUNT * 4); // angle, radius, length, z offset
  private isWarping = false;
  private warpTimer = 0;
  private warpZ = 0;
  private color = new THREE.Color();
  private dummy = new THREE.Object3D();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.currentTheme = THEME_REGISTRY['neon-undercity'];

    this.warpGroup = new THREE.Group();
    this.warpGroup.name = 'PortalWarpFX';
    this.warpGroup.visible = false;
    this.scene.add(this.warpGroup);

    const fxMat = () =>
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
      });
    this.ringMat = fxMat();
    this.ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.0055, 6, 128), this.ringMat);
    this.ring.frustumCulled = false;
    this.warpGroup.add(this.ring);

    this.streakMat = fxMat();
    this.streaks = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), this.streakMat, STREAK_COUNT);
    this.streaks.frustumCulled = false;
    this.warpGroup.add(this.streaks);
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    for (let i = 0; i < STREAK_COUNT; i++) {
      this.streakParams[i * 4] = (i / STREAK_COUNT) * Math.PI * 2 + rnd() * 0.3;
      this.streakParams[i * 4 + 1] = 2.2 + rnd() * 6.5;
      this.streakParams[i * 4 + 2] = 2.5 + rnd() * 6;
      this.streakParams[i * 4 + 3] = 4 + rnd() * 34;
    }
    this.layoutStreaks(0, 0, 1.5, 0);
  }

  /**
   * Crossing a portal gateway: a ring of light expands through the gateway
   * plane and light streaks rush past, tinted with the destination world's
   * energy colour.
   */
  triggerPortalWarp(color: THREE.ColorRepresentation, playerPos: THREE.Vector3): void {
    this.color.set(color).lerp(new THREE.Color(1, 1, 1), 0.4).multiplyScalar(2.2);
    this.ringMat.color.copy(this.color);
    this.streakMat.color.copy(this.color);
    this.isWarping = true;
    this.warpTimer = WARP_DURATION;
    this.warpZ = playerPos.z;
    this.warpGroup.position.set(0, 0, 0);
    this.warpGroup.visible = true;
  }

  private layoutStreaks(px: number, py: number, cy: number, travel: number): void {
    const d = this.dummy;
    for (let i = 0; i < STREAK_COUNT; i++) {
      const a = this.streakParams[i * 4];
      const r = this.streakParams[i * 4 + 1];
      const len = this.streakParams[i * 4 + 2];
      const zo = this.streakParams[i * 4 + 3];
      d.position.set(px * 0.5 + Math.cos(a) * r, py + cy + Math.sin(a) * r * 0.75, this.warpZ + zo - travel);
      d.scale.set(0.022, 0.022, len);
      d.rotation.set(0, 0, 0);
      d.updateMatrix();
      this.streaks.setMatrixAt(i, d.matrix);
    }
    this.streaks.instanceMatrix.needsUpdate = true;
  }

  update(
    dt: number,
    _skyMgr: SkyManager,
    _terrainMgr: TerrainManager,
    _obstacleMgr: ObstacleManager,
    playerPos: THREE.Vector3,
    _timeSeconds: number
  ): void {
    if (!this.isWarping) return;
    this.warpTimer -= dt;
    if (this.warpTimer <= 0) {
      this.isWarping = false;
      this.warpGroup.visible = false;
      this.ringMat.opacity = 0;
      this.streakMat.opacity = 0;
      return;
    }
    const e = 1 - this.warpTimer / WARP_DURATION; // 0 -> 1
    // Ring: born at the gateway plane around the rider, expanding outward.
    const radius = 1.5 + 13 * (1 - (1 - e) * (1 - e));
    this.ring.position.set(playerPos.x * 0.5, playerPos.y + 1.5, this.warpZ + 0.5);
    this.ring.scale.set(radius, radius * 0.8, radius);
    this.ringMat.opacity = 0.55 * (1 - e) * Math.min(1, e * 8);
    // Streaks rush backwards past the rider (relative speed ~70 m/s).
    this.layoutStreaks(playerPos.x, playerPos.y, 1.5, e * WARP_DURATION * 70 - (playerPos.z - this.warpZ));
    this.streakMat.opacity = 0.45 * Math.sin(Math.PI * Math.min(1, e * 1.15));
  }

  dispose(): void {
    this.scene.remove(this.warpGroup);
    this.ring.geometry.dispose();
    this.ringMat.dispose();
    this.streaks.geometry.dispose();
    this.streaks.dispose();
    this.streakMat.dispose();
  }
}
