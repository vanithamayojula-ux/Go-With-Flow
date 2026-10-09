/**
 * GoWithFlow — Limited-Time Events & Modifiers
 * Phase 18 Section 8-9: Event registry, additive modifiers (Double XP, Shard Rush, Score Multipliers),
 * and mid-run completion safety.
 */

import { LiveEvent, EventModifier } from './liveOpsConfig';

// Reference anchor time matching Season 01
const NOW = Date.now();
const ONE_DAY = 24 * 60 * 60 * 1000;

export const CURATED_EVENTS: LiveEvent[] = [
  {
    id: 'evt_double_xp_launch',
    name: 'Season Launch Boost',
    tagline: 'Earn 2× XP on all runs across every world!',
    description: 'Celebrate the opening of the competitive season with doubled progression rewards.',
    icon: '⚡',
    startsAt: NOW - ONE_DAY,
    endsAt: NOW + ONE_DAY * 6, // 1 week duration
    isActive: true,
    modifiers: [
      {
        type: 'DOUBLE_XP',
        multiplier: 2.0,
        description: '2× XP awarded across all game modes and worlds',
      },
    ],
    rewardBadge: 'badge:launch_boost_pilot',
  },
  {
    id: 'evt_crystal_eclipse',
    name: 'Crystal Eclipse Gathering',
    tagline: 'Resonant quartz surge in Crystal Heights!',
    description: 'Special harmonics amplify shard value and score output in Crystal Heights.',
    icon: '💎',
    startsAt: NOW + ONE_DAY * 10,
    endsAt: NOW + ONE_DAY * 24, // 14 days
    isActive: false,
    featuredCosmeticId: 'trail_plasma_rainbow',
    modifiers: [
      {
        type: 'SCORE_BOOST',
        multiplier: 1.25,
        targetWorld: 'crystal-heights',
        description: '+25% Score Multiplier while traveling in Crystal Heights',
      },
      {
        type: 'SHARD_RUSH',
        multiplier: 1.5,
        targetWorld: 'crystal-heights',
        description: '+50% Shards dropped in Crystal Heights',
      },
    ],
    rewardBadge: 'badge:eclipse_resonance',
  },
  {
    id: 'evt_archive_sky_breeze',
    name: 'Vault Archive: Sky Breeze',
    tagline: 'Returning legacy cosmetic vault for 7 days.',
    description: 'Missed out on earlier rewards? Unlock the Sky Isles Breeze trail without penalty.',
    icon: '🏛️',
    startsAt: NOW + ONE_DAY * 20,
    endsAt: NOW + ONE_DAY * 27,
    isActive: false,
    isArchiveEvent: true,
    featuredCosmeticId: 'trail_sky_breeze',
    modifiers: [],
    rewardBadge: 'badge:vault_raider',
  },
];

/**
 * Checks whether an event is active according to the given server timestamp
 */
export function isEventActive(event: LiveEvent, currentServerTime: number): boolean {
  return (
    event.isActive &&
    currentServerTime >= event.startsAt &&
    currentServerTime <= event.endsAt
  );
}

/**
 * Returns all currently active event modifiers
 */
export function getActiveModifiers(events: LiveEvent[], currentServerTime: number): EventModifier[] {
  const activeEvents = events.filter(e => isEventActive(e, currentServerTime));
  const modifiers: EventModifier[] = [];

  for (const event of activeEvents) {
    if (event.modifiers && event.modifiers.length > 0) {
      modifiers.push(...event.modifiers);
    }
  }

  return modifiers;
}

/**
 * Computes the aggregated XP multiplier from all active event modifiers
 */
export function calculateEffectiveXpMultiplier(modifiers: EventModifier[]): number {
  let multiplier = 1.0;
  for (const mod of modifiers) {
    if (mod.type === 'DOUBLE_XP') {
      multiplier *= mod.multiplier;
    }
  }
  return multiplier;
}

/**
 * Computes score multiplier considering world affinity
 */
export function calculateEffectiveScoreMultiplier(
  modifiers: EventModifier[],
  worldId?: string
): number {
  let multiplier = 1.0;
  for (const mod of modifiers) {
    if (mod.type === 'SCORE_BOOST') {
      if (!mod.targetWorld || mod.targetWorld === worldId) {
        multiplier *= mod.multiplier;
      }
    }
  }
  return multiplier;
}
