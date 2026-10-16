import type { WorldId } from '../WorldConfig';

/**
 * Gateway dimensions (metres). The gateway's origin is the road centre at the
 * world boundary (z = B, y = road surface); +Z points into the next world.
 */
export const GATEWAY = {
  /** Half width of the opening (pillar inner faces). Rails sit at +-4.5. */
  OPEN_HALF_W: 7.2,
  /** Height where the round arch springs from the pillars. */
  SPRING_Y: 9.0,
  /** Radial depth of the arch stones (voussoirs). */
  RING: 2.0,
  /** Thickness of the arch ring and pillars along the road. */
  DEPTH: 3.4,
  PILLAR_W: 3.2,
  PILLAR_D: 3.6,
  PLINTH_W: 4.6,
  PLINTH_D: 4.8,
  PLINTH_TOP: 1.6,
  /** Foundations run this far down (Sky Isles has no ground beside the road). */
  FOUNDATION_BOTTOM: -60,
  /** Membrane bottom: the underside of the road slab. */
  MEMBRANE_BOTTOM: -1.1,
  /** World-space metres covered by one repeat of the scanned stone textures. */
  STONE_TILE: 3.0,
} as const;

/** Top of the arch ring (crown of the extrados). */
export const GATEWAY_CROWN_Y = GATEWAY.SPRING_Y + GATEWAY.OPEN_HALF_W + GATEWAY.RING;

export interface GatewayStyle {
  /** Texture set stem below textures/ for the masonry. */
  stone: string;
  /** Albedo multiplier of the scanned stone. */
  stoneTint: number;
  normalScale: number;
  /** Per-block brightness jitter (0..1). */
  jitter: number;
  /** Vertex-colour multiplier on upward faces / low courses (moss, damp). */
  moss?: { color: [number, number, number]; amount: number };
  /** Warm or cool per-block cast (multiplier). */
  cast?: [number, number, number];
  /** Sand drifts banked against the plinths. */
  sand?: string;
  /** Snow caps on the ledges + icicles under the arch. */
  snow?: string;
  ice?: boolean;
  /** Glowing lava veins in the stone (emissive). */
  lava?: { color: number; intensity: number };
  /** Fallen blocks at the foot of the pillars. */
  rubble?: boolean;
}

/** Themed by the DESTINATION world (the gateway leads into it). */
export const GATEWAY_STYLES: Record<WorldId, GatewayStyle> = {
  // Never a destination (first world); kept for completeness.
  'sky-isles': { stone: 'sky-isles/cliff', stoneTint: 0xffffff, normalScale: 1, jitter: 0.12 },
  // Mossy stone ruin
  'verdant-wilds': {
    stone: 'verdant-wilds/rock',
    stoneTint: 0xf2f2ea,
    normalScale: 1.2,
    jitter: 0.16,
    moss: { color: [0.42, 0.56, 0.24], amount: 0.85 },
    rubble: true,
  },
  // Carved sandstone
  'crimson-dunes': {
    stone: 'crimson-dunes/rock',
    stoneTint: 0xffffff,
    normalScale: 1.1,
    jitter: 0.12,
    cast: [1.0, 0.94, 0.88],
    sand: 'crimson-dunes/sand',
    rubble: true,
  },
  // Granite with ice
  'crystal-heights': {
    stone: 'crystal-heights/rock',
    stoneTint: 0xffffff,
    normalScale: 1.1,
    jitter: 0.1,
    cast: [0.94, 0.97, 1.0],
    snow: 'crystal-heights/snow',
    ice: true,
  },
  // Basalt with glowing lava veins
  'obsidian-core': {
    stone: 'obsidian-core/rock',
    stoneTint: 0xb4aca6,
    normalScale: 1.3,
    jitter: 0.1,
    lava: { color: 0xff5a14, intensity: 3.2 },
    rubble: true,
  },
};
