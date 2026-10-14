/**
 * NOTE: everything in this folder runs in the player's browser and stores
 * data in localStorage. There is no backend. Names like "server",
 * "authoritative" or "auth" in identifiers are kept for API stability, but
 * these checks only catch bugs and accidental bad data; anyone can edit
 * localStorage. Real online leaderboards would need a server-side copy of
 * this validation.
 */
/**
 * GoWithFlow — Social Subsystem Barrel Export
 */

export * from './socialConfig';
export * from './playerProfile';
export * from './runSubmission';
export * from './leaderboardService';
export * from './challengeService';
export * from './SocialManager';
