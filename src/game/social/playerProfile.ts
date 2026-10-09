/**
 * GoWithFlow — Player Profile & Identity Service
 * Phase 16 Section 3-5: Guest/Cloud identity, Display names, Profile stats & Privacy controls.
 */

import {
  PlayerProfile,
  PrivacySettings,
  SOCIAL_STORAGE_KEY_PROFILE,
  CURRENT_SEASON_ID,
} from './socialConfig';
import { ProgressionManager } from '../progression';
import { StorageSanitizer } from '../security/storageSanitizer';

const PROFANITY_BLOCKLIST = [
  'admin', 'administrator', 'moderator', 'sysadmin', 'system', 'root', 'bot', 'official',
  'gowithflow', 'developer', 'staff', 'support',
  'fuck', 'shit', 'bitch', 'asshole', 'cunt', 'nigger', 'faggot'
];

export function sanitizeUsername(raw: string): { isValid: boolean; sanitized: string; error?: string } {
  const trimmed = raw.trim();
  if (trimmed.length < 3) {
    return { isValid: false, sanitized: trimmed, error: 'Username must be at least 3 characters long.' };
  }
  if (trimmed.length > 16) {
    return { isValid: false, sanitized: trimmed, error: 'Username must not exceed 16 characters.' };
  }
  // Alphanumeric + underscore/hyphen only
  const validRegex = /^[a-zA-Z0-9_-]+$/;
  if (!validRegex.test(trimmed)) {
    return { isValid: false, sanitized: trimmed, error: 'Username can only contain letters, numbers, hyphens, and underscores.' };
  }

  const lower = trimmed.toLowerCase();
  // Leetspeak normalization to prevent evasion (e.g. 4dm1n, 5y5t3m)
  const leetNormalized = lower
    .replace(/0/g, 'o')
    .replace(/1/g, 'i')
    .replace(/3/g, 'e')
    .replace(/4/g, 'a')
    .replace(/5/g, 's')
    .replace(/7/g, 't')
    .replace(/@/g, 'a');

  for (const word of PROFANITY_BLOCKLIST) {
    if (lower.includes(word) || leetNormalized.includes(word)) {
      return { isValid: false, sanitized: trimmed, error: 'Username contains restricted words or reserved system identifiers.' };
    }
  }

  return { isValid: true, sanitized: trimmed };
}

function generateRandomGuestName(): string {
  const prefixes = ['Drift', 'Aero', 'Vector', 'Phantom', 'Flux', 'Nova', 'Cyber', 'Solar'];
  const num = Math.floor(1000 + Math.random() * 9000);
  const p = prefixes[Math.floor(Math.random() * prefixes.length)];
  return `${p}_${num}`;
}

function generatePlayerUuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'ply_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
}

export function createDefaultProfile(): PlayerProfile {
  return {
    id: generatePlayerUuid(),
    username: generateRandomGuestName(),
    accountType: 'guest',
    title: 'Sky Strider',
    avatarIcon: '⚡',
    level: 1,
    achievementsCount: 0,
    worldsDiscovered: 1,
    highestScore: 0,
    longestDistance: 0,
    bestTimeTrialSeconds: 0,
    longestSurvivalSeconds: 0,
    seasonId: CURRENT_SEASON_ID,
    privacy: {
      showOnLeaderboards: true,
      allowFriendChallenges: true,
      publicProfile: true,
    },
    createdAt: Date.now(),
    lastActiveAt: Date.now(),
    renameCooldownUntil: 0,
  };
}

export class ProfileService {
  private _profile: PlayerProfile;

  constructor() {
    this._profile = this.loadProfile();
  }

  private loadProfile(): PlayerProfile {
    const parsed = StorageSanitizer.safeGetItem<Partial<PlayerProfile> | null>(SOCIAL_STORAGE_KEY_PROFILE, null);
    if (parsed && typeof parsed === 'object' && parsed.id && parsed.username) {
      return {
        ...createDefaultProfile(),
        ...parsed,
        privacy: {
          ...createDefaultProfile().privacy,
          ...(parsed.privacy || {}),
        },
      };
    }
    const def = createDefaultProfile();
    this.saveProfile(def);
    return def;
  }

  public saveProfile(profile?: PlayerProfile): void {
    const target = profile || this._profile;
    target.lastActiveAt = Date.now();
    StorageSanitizer.safeSetItem(SOCIAL_STORAGE_KEY_PROFILE, target);
    this._profile = target;
  }

  public getProfile(): Readonly<PlayerProfile> {
    return this._profile;
  }

  public updateUsername(newUsername: string): { success: boolean; error?: string } {
    const now = Date.now();
    if (this._profile.renameCooldownUntil > now) {
      const remainingMinutes = Math.ceil((this._profile.renameCooldownUntil - now) / 60000);
      return { success: false, error: `Name change on cooldown. Please wait ${remainingMinutes} min.` };
    }

    const check = sanitizeUsername(newUsername);
    if (!check.isValid) {
      return { success: false, error: check.error };
    }

    this._profile.username = check.sanitized;
    // 5 minutes cooldown to prevent rapid spamming
    this._profile.renameCooldownUntil = now + 5 * 60 * 1000;
    this.saveProfile();
    return { success: true };
  }

  public updatePrivacy(privacy: Partial<PrivacySettings>): void {
    this._profile.privacy = {
      ...this._profile.privacy,
      ...privacy,
    };
    this.saveProfile();
  }

  public syncProgressionStats(progressionMgr: ProgressionManager): void {
    const data = progressionMgr.getData();
    this._profile.level = data.level;
    this._profile.achievementsCount = Object.keys(data.achievements || {}).filter(k => data.achievements[k]).length;
    this.saveProfile();
  }

  public recordRunRecords(score: number, distance: number, timeTrialSeconds?: number, survivalSeconds?: number): void {
    if (score > this._profile.highestScore) {
      this._profile.highestScore = score;
    }
    if (distance > this._profile.longestDistance) {
      this._profile.longestDistance = distance;
    }
    if (timeTrialSeconds && timeTrialSeconds > 0) {
      if (this._profile.bestTimeTrialSeconds === 0 || timeTrialSeconds < this._profile.bestTimeTrialSeconds) {
        this._profile.bestTimeTrialSeconds = timeTrialSeconds;
      }
    }
    if (survivalSeconds && survivalSeconds > this._profile.longestSurvivalSeconds) {
      this._profile.longestSurvivalSeconds = survivalSeconds;
    }
    this.saveProfile();
  }

  public linkCloudAccount(simulatedCloudId?: string): void {
    this._profile.accountType = 'cloud';
    if (simulatedCloudId) {
      this._profile.id = simulatedCloudId;
    }
    this.saveProfile();
  }
}
