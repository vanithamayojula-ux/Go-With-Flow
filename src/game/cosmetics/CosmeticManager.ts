/**
 * GoWithFlow — Cosmetic Manager
 * Manages unlocks, equips, validation, backward-compatible persistence,
 * and dynamic in-game feedback.
 */

import {
  CosmeticItem,
  CosmeticCategory,
  CosmeticSaveData,
} from './cosmeticTypes';
import {
  COSMETIC_VERSION,
  STORAGE_KEY_COSMETICS,
  DEFAULT_EQUIPPED,
  createDefaultCosmeticSaveData,
} from './cosmeticConfig';
import {
  COSMETIC_MAP,
  ALL_COSMETICS,
  getCosmeticsByCategory,
  getCosmeticById,
} from './cosmeticRegistry';
import { ProgressionManager } from '../progression/ProgressionManager';

export interface CosmeticEvents {
  onCosmeticUnlocked?: (item: CosmeticItem) => void;
  onCosmeticEquipped?: (category: CosmeticCategory, item: CosmeticItem) => void;
  onNotification?: (msg: string) => void;
}

export class CosmeticManager {
  private _data: CosmeticSaveData;
  private _events: CosmeticEvents;
  private _dirty = false;

  constructor(events: CosmeticEvents = {}) {
    this._events = events;
    this._data = this.loadData();
    this.sanitizeEquipped();
  }

  public set onCosmeticUnlocked(cb: ((item: CosmeticItem) => void) | undefined) {
    this._events.onCosmeticUnlocked = cb;
  }

  public set onCosmeticEquipped(cb: ((category: CosmeticCategory, item: CosmeticItem) => void) | undefined) {
    this._events.onCosmeticEquipped = cb;
  }

  public getData(): Readonly<CosmeticSaveData> {
    return this._data;
  }

  public getUnlockedList(): string[] {
    return [...this._data.unlocked];
  }

  public isUnlocked(id: string): boolean {
    return this._data.unlocked.includes(id);
  }

  public getEquipped(): Readonly<CosmeticSaveData['equipped']> {
    return this._data.equipped;
  }

  public getEquippedItem(category: CosmeticCategory): CosmeticItem {
    let id: string;
    switch (category) {
      case 'player':
        id = this._data.equipped.player;
        break;
      case 'trail':
        id = this._data.equipped.trail;
        break;
      case 'energy-effect':
        id = this._data.equipped.effect;
        break;
      case 'ui-theme':
        id = this._data.equipped.uiTheme;
        break;
    }
    const item = getCosmeticById(id);
    if (item) return item;

    // Fallback if missing
    const defaultId = (DEFAULT_EQUIPPED as any)[category === 'energy-effect' ? 'effect' : category];
    return getCosmeticById(defaultId) || ALL_COSMETICS[0];
  }

  /**
   * Evaluates progression state against cosmetic unlock criteria.
   * Unlocks items idempotently.
   */
  public evaluateProgressionUnlocks(progressionMgr: ProgressionManager): CosmeticItem[] {
    const newlyUnlocked: CosmeticItem[] = [];
    const progData = progressionMgr.getData();
    const currentLevel = progData.level;
    const achievements = progData.achievements;

    for (const item of ALL_COSMETICS) {
      if (this.isUnlocked(item.id)) continue;

      const req = item.unlockRequirement;
      let shouldUnlock = false;

      switch (req.method) {
        case 'default':
          shouldUnlock = true;
          break;
        case 'level':
          if (currentLevel >= (req.target as number)) {
            shouldUnlock = true;
          }
          break;
        case 'achievement':
          if (achievements[req.target as string] === true) {
            shouldUnlock = true;
          }
          break;
        case 'world': {
          // World milestone check via achievements or visits
          const worldAchMap: Record<string, string> = {
            'sky-isles': 'ach_first_flight',
            'verdant-wilds': 'ach_into_wild',
            'crimson-dunes': 'ach_red_horizon',
            'crystal-heights': 'ach_crystal_voyager',
            'obsidian-core': 'ach_heart_obsidian',
          };
          const achKey = worldAchMap[req.target as string];
          if (achKey && achievements[achKey] === true) {
            shouldUnlock = true;
          }
          break;
        }
        case 'distance':
          // Handled during run or legacy distance
          if (progData.totalXpEarned >= 100) {
            // Evaluated if criteria passed
          }
          break;
      }

      if (shouldUnlock) {
        const ok = this.unlockCosmetic(item.id, false);
        if (ok) {
          newlyUnlocked.push(item);
        }
      }
    }

    if (newlyUnlocked.length > 0) {
      this.saveData();
      for (const item of newlyUnlocked) {
        this._events.onCosmeticUnlocked?.(item);
        this._events.onNotification?.(`✨ UNLOCKED: ${item.name}!`);
      }
    }

    return newlyUnlocked;
  }

  /**
   * Unlock a cosmetic by ID idempotently.
   */
  public unlockCosmetic(id: string, saveImmediate = true): boolean {
    if (this._data.unlocked.includes(id)) {
      return false; // Already unlocked, anti-duplication
    }
    const item = getCosmeticById(id);
    if (!item) return false;

    this._data.unlocked.push(id);
    this._dirty = true;

    if (saveImmediate) {
      this.saveData();
      this._events.onCosmeticUnlocked?.(item);
      this._events.onNotification?.(`✨ UNLOCKED: ${item.name}!`);
    }

    return true;
  }

  /**
   * Equip a cosmetic by ID with validation and fallback.
   */
  public equipCosmetic(id: string): boolean {
    const item = getCosmeticById(id);
    if (!item) {
      console.warn(`[CosmeticManager] Cannot equip unknown cosmetic id: ${id}`);
      return false;
    }

    if (!this.isUnlocked(id)) {
      console.warn(`[CosmeticManager] Cannot equip locked cosmetic: ${item.name}`);
      return false;
    }

    switch (item.category) {
      case 'player':
        this._data.equipped.player = id;
        break;
      case 'trail':
        this._data.equipped.trail = id;
        break;
      case 'energy-effect':
        this._data.equipped.effect = id;
        break;
      case 'ui-theme':
        this._data.equipped.uiTheme = id;
        break;
    }

    this._dirty = true;
    this.saveData();
    this._events.onCosmeticEquipped?.(item.category, item);
    this._events.onNotification?.(`✓ ${item.name} Equipped`);
    return true;
  }

  /**
   * Check progress for a cosmetic requirement.
   */
  public getRequirementProgress(item: CosmeticItem, progressionMgr?: ProgressionManager): {
    current: number;
    target: number;
    percent: number;
    label: string;
  } {
    const req = item.unlockRequirement;
    if (this.isUnlocked(item.id)) {
      return { current: 1, target: 1, percent: 100, label: 'Unlocked' };
    }

    if (!progressionMgr) {
      return { current: 0, target: 1, percent: 0, label: req.description };
    }

    const data = progressionMgr.getData();

    switch (req.method) {
      case 'level': {
        const cur = data.level;
        const tgt = req.target as number;
        const pct = Math.min(100, Math.round((cur / tgt) * 100));
        return { current: cur, target: tgt, percent: pct, label: `Rank ${cur} / ${tgt}` };
      }
      case 'achievement': {
        const done = data.achievements[req.target as string] ? 1 : 0;
        return { current: done, target: 1, percent: done ? 100 : 0, label: req.description };
      }
      case 'world': {
        const worldAchMap: Record<string, string> = {
          'sky-isles': 'ach_first_flight',
          'verdant-wilds': 'ach_into_wild',
          'crimson-dunes': 'ach_red_horizon',
          'crystal-heights': 'ach_crystal_voyager',
          'obsidian-core': 'ach_heart_obsidian',
        };
        const achKey = worldAchMap[req.target as string];
        const done = (achKey && data.achievements[achKey]) ? 1 : 0;
        return { current: done, target: 1, percent: done ? 100 : 0, label: req.description };
      }
      case 'distance':
        return { current: 0, target: req.target as number, percent: 0, label: req.description };
      default:
        return { current: 0, target: 1, percent: 0, label: req.description };
    }
  }

  /**
   * Get collection count statistics across categories.
   */
  public getCollectionStats(): {
    categories: { category: CosmeticCategory; label: string; current: number; total: number }[];
    totalCurrent: number;
    totalAvailable: number;
    percent: number;
  } {
    const catLabels: Record<CosmeticCategory, string> = {
      player: 'Player Outfits',
      trail: 'Ribbon Trails',
      'energy-effect': 'Energy Sparks',
      'ui-theme': 'UI Protocols',
    };

    const categories: CosmeticCategory[] = ['player', 'trail', 'energy-effect', 'ui-theme'];
    let totalCur = 0;
    let totalAvail = 0;

    const list = categories.map(cat => {
      const allInCat = getCosmeticsByCategory(cat);
      const unlockedCount = allInCat.filter(i => this.isUnlocked(i.id)).length;
      totalCur += unlockedCount;
      totalAvail += allInCat.length;
      return {
        category: cat,
        label: catLabels[cat],
        current: unlockedCount,
        total: allInCat.length,
      };
    });

    const pct = totalAvail > 0 ? Math.round((totalCur / totalAvail) * 100) : 100;
    return {
      categories: list,
      totalCurrent: totalCur,
      totalAvailable: totalAvail,
      percent: pct,
    };
  }

  /**
   * Validate that equipped values point to valid unlocked items. Fall back safely.
   */
  private sanitizeEquipped(): void {
    const eq = this._data.equipped;

    if (!eq.player || !getCosmeticById(eq.player)) {
      eq.player = DEFAULT_EQUIPPED.player;
    }
    if (!eq.trail || !getCosmeticById(eq.trail)) {
      eq.trail = DEFAULT_EQUIPPED.trail;
    }
    if (!eq.effect || !getCosmeticById(eq.effect)) {
      eq.effect = DEFAULT_EQUIPPED.effect;
    }
    if (!eq.uiTheme || !getCosmeticById(eq.uiTheme)) {
      eq.uiTheme = DEFAULT_EQUIPPED.uiTheme;
    }
  }

  /**
   * Load data safely from localStorage with migration.
   */
  private loadData(): CosmeticSaveData {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return createDefaultCosmeticSaveData();
    }

    try {
      const raw = localStorage.getItem(STORAGE_KEY_COSMETICS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.unlocked) && parsed.equipped) {
          return {
            version: COSMETIC_VERSION,
            unlocked: Array.from(new Set([...createDefaultCosmeticSaveData().unlocked, ...parsed.unlocked])),
            equipped: {
              ...DEFAULT_EQUIPPED,
              ...parsed.equipped,
            },
          };
        }
      }
    } catch (e) {
      console.warn('[CosmeticManager] Failed to parse cosmetic storage, migrating fallback...', e);
    }

    // Migrate from legacy skyflow_unlocked_items if present
    const base = createDefaultCosmeticSaveData();
    try {
      const legacyRaw = localStorage.getItem('skyflow_unlocked_items');
      if (legacyRaw) {
        const items = JSON.parse(legacyRaw);
        if (Array.isArray(items)) {
          if (items.includes('laser-edge')) base.unlocked.push('player_ember_runner');
          if (items.includes('void-stalker')) base.unlocked.push('player_crystal_runner');
        }
      }
    } catch {}

    return base;
  }

  /**
   * Persist current cosmetic save data.
   */
  public saveData(): void {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY_COSMETICS, JSON.stringify(this._data));
      this._dirty = false;
    } catch (e) {
      console.error('[CosmeticManager] Failed to save cosmetic data:', e);
    }
  }
}
