/**
 * NOTE: everything in this folder runs in the player's browser and stores
 * data in localStorage. There is no backend. Names like "server",
 * "authoritative" or "auth" in identifiers are kept for API stability, but
 * these checks only catch bugs and accidental bad data; anyone can edit
 * localStorage. Real online leaderboards would need a server-side copy of
 * this validation.
 */
/**
 * GoWithFlow — Security & Competitive Integrity Module Barrel
 * Phase 17
 */

export * from './securityConfig';
export * from './authService';
export * from './authorizationGuard';
export * from './rateLimiter';
export * from './scoreValidationPipeline';
export * from './rewardIntegrityService';
export * from './currencyIntegrityService';
export * from './securityAuditLogger';
export * from './adminModerationService';
export * from './storageSanitizer';
export * from './accountLifecycleService';
export * from './SecurityManager';
