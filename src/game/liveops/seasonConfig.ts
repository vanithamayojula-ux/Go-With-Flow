/**
 * GoWithFlow — Season Definitions & Lifecycle Configuration
 * Phase 18 Section 2-4: Five-season progression model, curated seasonal themes,
 * authoritative lifecycle states, and season boundary preservation.
 */

import { Season, SeasonStatus } from './liveOpsConfig';

// Standard 30-day season duration (in milliseconds)
export const SEASON_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

// Base benchmark anchor: Season 01 starts October 1st, 2026 00:00:00 UTC
const ANCHOR_OCT_2026_MS = 1790812800000; // ~Oct 2026

export const CURATED_SEASONS: Season[] = [
  {
    id: 'season_01_skybound',
    number: 1,
    name: 'Season 01 — Skybound',
    theme: {
      name: 'Skybound',
      tagline: 'Soar through the limitless azure and master the wind currents.',
      focusWorld: 'sky-isles',
      primaryColor: '#00D2E0',
      accentColor: '#38bdf8',
      icon: '☁️',
    },
    startsAt: ANCHOR_OCT_2026_MS,
    endsAt: ANCHOR_OCT_2026_MS + SEASON_DURATION_MS,
    status: 'active',
    leaderboardIds: ['lb_s01_score', 'lb_s01_distance', 'lb_s01_survival'],
    challengeIds: ['s01_cloud_runner', 's01_fast_flight', 's01_sky_champion'],
    rewardIds: ['badge:apex-sky-runner', 'player_master_pilot', 'trail_sky_breeze'],
  },
  {
    id: 'season_02_wild_bloom',
    number: 2,
    name: 'Season 02 — Wild Bloom',
    theme: {
      name: 'Wild Bloom',
      tagline: 'Glide through dense emerald canopies and dance with fireflies.',
      focusWorld: 'verdant-wilds',
      primaryColor: '#10b981',
      accentColor: '#4ade80',
      icon: '🌿',
    },
    startsAt: ANCHOR_OCT_2026_MS + SEASON_DURATION_MS,
    endsAt: ANCHOR_OCT_2026_MS + SEASON_DURATION_MS * 2,
    status: 'upcoming',
    leaderboardIds: ['lb_s02_score', 'lb_s02_distance', 'lb_s02_survival'],
    challengeIds: ['s02_canopy_weaver', 's02_firefly_swarm', 's02_bloom_master'],
    rewardIds: ['badge:bloom-overlord', 'trail_forest_canopy', 'theme_neon_cyber'],
  },
  {
    id: 'season_03_crimson_heat',
    number: 3,
    name: 'Season 03 — Crimson Heat',
    theme: {
      name: 'Crimson Heat',
      tagline: 'Endure blazing solar mirages and carve the sands under a bloody sun.',
      focusWorld: 'crimson-dunes',
      primaryColor: '#f97316',
      accentColor: '#ef4444',
      icon: '🏜️',
    },
    startsAt: ANCHOR_OCT_2026_MS + SEASON_DURATION_MS * 2,
    endsAt: ANCHOR_OCT_2026_MS + SEASON_DURATION_MS * 3,
    status: 'upcoming',
    leaderboardIds: ['lb_s03_score', 'lb_s03_distance', 'lb_s03_survival'],
    challengeIds: ['s03_dune_rider', 's03_mirage_escape', 's03_solar_inferno'],
    rewardIds: ['badge:desert-phantom', 'trail_crimson_heat', 'theme_golden_horizon'],
  },
  {
    id: 'season_04_crystal_eclipse',
    number: 4,
    name: 'Season 04 — Crystal Eclipse',
    theme: {
      name: 'Crystal Eclipse',
      tagline: 'Harness resonating quartz harmonics in the deep starlight void.',
      focusWorld: 'crystal-heights',
      primaryColor: '#a855f7',
      accentColor: '#ec4899',
      icon: '💎',
    },
    startsAt: ANCHOR_OCT_2026_MS + SEASON_DURATION_MS * 3,
    endsAt: ANCHOR_OCT_2026_MS + SEASON_DURATION_MS * 4,
    status: 'upcoming',
    leaderboardIds: ['lb_s04_score', 'lb_s04_distance', 'lb_s04_survival'],
    challengeIds: ['s04_prism_collector', 's04_harmonic_graze', 's04_eclipse_ascendant'],
    rewardIds: ['badge:crystal-seer', 'trail_plasma_rainbow', 'theme_violet_void'],
  },
  {
    id: 'season_05_corefall',
    number: 5,
    name: 'Season 05 — Corefall',
    theme: {
      name: 'Corefall',
      tagline: 'Dive into the planetary heart where basalt plates collapse into molten core.',
      focusWorld: 'obsidian-core',
      primaryColor: '#dc2626',
      accentColor: '#7f1d1d',
      icon: '🌋',
    },
    startsAt: ANCHOR_OCT_2026_MS + SEASON_DURATION_MS * 4,
    endsAt: ANCHOR_OCT_2026_MS + SEASON_DURATION_MS * 5,
    status: 'upcoming',
    leaderboardIds: ['lb_s05_score', 'lb_s05_distance', 'lb_s05_survival'],
    challengeIds: ['s05_magma_skimmer', 's05_tectonic_break', 's05_corefall_conqueror'],
    rewardIds: ['badge:corefall-titan', 'trail_obsidian_ember', 'player_cyber_phantom'],
  },
];

/**
 * Determine dynamic season lifecycle status based on authoritative server timestamp
 */
export function evaluateSeasonStatus(season: Season, currentServerTime: number): SeasonStatus {
  // If season is already archived, respect archived state
  if (season.status === 'archived') {
    return 'archived';
  }

  if (currentServerTime < season.startsAt) {
    return 'upcoming';
  }

  const remainingMs = season.endsAt - currentServerTime;
  if (remainingMs <= 0) {
    return 'ended';
  }

  // Final 48 hours is considered 'ending' (warning state)
  const ENDING_THRESHOLD_MS = 48 * 60 * 60 * 1000;
  if (remainingMs <= ENDING_THRESHOLD_MS) {
    return 'ending';
  }

  return 'active';
}

/**
 * Retrieve the active season for a given authoritative timestamp
 */
export function getActiveSeasonForTime(serverTime: number): Season {
  for (const s of CURATED_SEASONS) {
    const status = evaluateSeasonStatus(s, serverTime);
    if (status === 'active' || status === 'ending') {
      return { ...s, status };
    }
  }
  // Default fallback to Season 01
  return { ...CURATED_SEASONS[0], status: 'active' };
}
