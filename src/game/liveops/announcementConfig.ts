/**
 * GoWithFlow — In-Game Announcement System
 * Phase 18 Section 20-21: Lightweight news, season launch broadcasts, event notices,
 * and dismissal state management.
 */

import { Announcement, LIVEOPS_STORAGE_KEY_ANNOUNCEMENTS } from './liveOpsConfig';
import { StorageSanitizer } from '../security/storageSanitizer';

const NOW = Date.now();
const ONE_DAY = 24 * 60 * 60 * 1000;

export const CURATED_ANNOUNCEMENTS: Announcement[] = [
  {
    id: 'ann_s01_welcome',
    title: 'SEASON 01 // SKYBOUND IS LIVE',
    body: 'Master the wind currents in Sky Isles and climb the competitive leaderboards! Seasonal cosmetic rewards await the top flyers.',
    priority: 'high',
    icon: '☁️',
    startsAt: NOW - ONE_DAY,
    expiresAt: NOW + ONE_DAY * 30,
  },
  {
    id: 'ann_double_xp_active',
    title: 'LAUNCH CELEBRATION BOOST',
    body: 'Double XP modifier is currently active on all flights. Level up your pilot profile and unlock new trails faster!',
    priority: 'normal',
    icon: '⚡',
    startsAt: NOW - ONE_DAY,
    expiresAt: NOW + ONE_DAY * 6,
  },
];

export class AnnouncementService {
  private _dismissedIds: Set<string> = new Set();

  constructor() {
    this.loadDismissed();
  }

  private loadDismissed(): void {
    const parsed = StorageSanitizer.safeGetItem<string[] | null>(LIVEOPS_STORAGE_KEY_ANNOUNCEMENTS, null);
    if (parsed && Array.isArray(parsed)) {
      parsed.forEach(id => this._dismissedIds.add(id));
    }
  }

  private saveDismissed(): void {
    StorageSanitizer.safeSetItem(LIVEOPS_STORAGE_KEY_ANNOUNCEMENTS, Array.from(this._dismissedIds));
  }

  /**
   * Filter and return active announcements that have not been dismissed by the player
   */
  public getActiveAnnouncements(announcements: Announcement[], serverTime: number): Announcement[] {
    return announcements
      .filter(a => serverTime >= a.startsAt && serverTime <= a.expiresAt)
      .map(a => ({
        ...a,
        isDismissed: this._dismissedIds.has(a.id),
      }))
      .filter(a => !a.isDismissed)
      .sort((a, b) => {
        const priorityScore: Record<string, number> = { urgent: 4, high: 3, normal: 2, low: 1 };
        return (priorityScore[b.priority] || 0) - (priorityScore[a.priority] || 0);
      });
  }

  /**
   * Mark an announcement as dismissed
   */
  public dismissAnnouncement(id: string): void {
    this._dismissedIds.add(id);
    this.saveDismissed();
  }

  /**
   * Reset dismissals (useful for test isolation)
   */
  public resetDismissals(): void {
    this._dismissedIds.clear();
    this.saveDismissed();
  }
}
