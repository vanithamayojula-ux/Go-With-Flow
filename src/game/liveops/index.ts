/**
 * NOTE: everything in this folder runs in the player's browser and stores
 * data in localStorage. There is no backend. Names like "server",
 * "authoritative" or "auth" in identifiers are kept for API stability, but
 * these checks only catch bugs and accidental bad data; anyone can edit
 * localStorage. Real online leaderboards would need a server-side copy of
 * this validation.
 */
/**
 * GoWithFlow — Live Operations Subsystem Barrel
 * Phase 18: Seasons, Events, Rotations, Announcements, and Manager
 */

export * from './liveOpsConfig';
export * from './seasonConfig';
export * from './eventConfig';
export * from './challengeRotation';
export * from './announcementConfig';
export * from './rewardRotation';
export * from './liveOpsServer';
export * from './LiveOpsManager';
