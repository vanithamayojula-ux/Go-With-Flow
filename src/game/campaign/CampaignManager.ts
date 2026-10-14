/**
 * GoWithFlow — Campaign Manager
 * Orchestrates offline 5-world campaign persistence, objective evaluation,
 * star grading, rewards attribution, and final ending triggers.
 */

import {
  CampaignWorldId,
  CampaignSaveData,
  WorldCampaignConfig,
  SectorCompletionResult,
} from './campaignTypes';
import {
  CAMPAIGN_STORAGE_KEY,
  CAMPAIGN_VERSION,
  CAMPAIGN_TOTAL_DISTANCE,
  WORLD_CAMPAIGN_CONFIGS,
  CAMPAIGN_WORLD_ORDER,
  createDefaultCampaignSaveData,
} from './campaignConfig';
import { PlayerStats } from '../../types';
import { ProgressionManager } from '../progression';

export class CampaignManager {
  private _state: CampaignSaveData;
  private _selectedStartingWorld: CampaignWorldId = 'sky-isles';
  private _revivesUsedInRun: number = 0;
  private _runHasStarted: boolean = false;
  private _maxOverdriveReached: boolean = false;
  private _notifiedCompletedSectors: Set<string> = new Set();

  constructor() {
    this._state = this.loadState();
  }

  // --- Persistence ---

  public loadState(): CampaignSaveData {
    if (typeof localStorage === 'undefined') {
      return createDefaultCampaignSaveData();
    }

    try {
      const raw = localStorage.getItem(CAMPAIGN_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          return {
            version: CAMPAIGN_VERSION,
            highestSectorUnlocked: typeof parsed.highestSectorUnlocked === 'number'
              ? Math.min(5, Math.max(1, parsed.highestSectorUnlocked))
              : 1,
            completedSectors: parsed.completedSectors && typeof parsed.completedSectors === 'object'
              ? parsed.completedSectors
              : {},
            sectorStars: parsed.sectorStars && typeof parsed.sectorStars === 'object'
              ? {
                  'sky-isles': Number(parsed.sectorStars['sky-isles']) || 0,
                  'verdant-wilds': Number(parsed.sectorStars['verdant-wilds']) || 0,
                  'crimson-dunes': Number(parsed.sectorStars['crimson-dunes']) || 0,
                  'crystal-heights': Number(parsed.sectorStars['crystal-heights']) || 0,
                  'obsidian-core': Number(parsed.sectorStars['obsidian-core']) || 0,
                }
              : createDefaultCampaignSaveData().sectorStars,
            objectivesCompleted: parsed.objectivesCompleted && typeof parsed.objectivesCompleted === 'object'
              ? parsed.objectivesCompleted
              : {},
            campaignCompleted: Boolean(parsed.campaignCompleted),
            campaignHighScore: typeof parsed.campaignHighScore === 'number' ? parsed.campaignHighScore : 0,
            campaignBestTimeSeconds: typeof parsed.campaignBestTimeSeconds === 'number' ? parsed.campaignBestTimeSeconds : 0,
            campaignRunCount: typeof parsed.campaignRunCount === 'number' ? parsed.campaignRunCount : 0,
            lastPlayedTimestamp: Date.now(),
          };
        }
      }
    } catch (err) {
      console.warn('[CampaignManager] Failed to load campaign save data, falling back to default', err);
    }

    return createDefaultCampaignSaveData();
  }

  public saveState(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      this._state.lastPlayedTimestamp = Date.now();
      localStorage.setItem(CAMPAIGN_STORAGE_KEY, JSON.stringify(this._state));
    } catch (err) {
      console.error('[CampaignManager] Failed to persist campaign state to localStorage', err);
    }
  }

  // --- Getters & Queries ---

  public get state(): CampaignSaveData {
    return this._state;
  }

  public get highestSectorUnlocked(): number {
    return this._state.highestSectorUnlocked;
  }

  public isWorldUnlocked(worldId: CampaignWorldId): boolean {
    const cfg = WORLD_CAMPAIGN_CONFIGS[worldId];
    if (!cfg) return false;
    return cfg.sectorIndex <= this._state.highestSectorUnlocked;
  }

  public isCampaignCompleted(): boolean {
    return this._state.campaignCompleted;
  }

  public getSectorStars(worldId: CampaignWorldId): number {
    return this._state.sectorStars[worldId] || 0;
  }

  public getTotalStarsEarned(): number {
    return Object.values(this._state.sectorStars).reduce((sum, s) => sum + s, 0);
  }

  public getSelectedStartingWorld(): CampaignWorldId {
    return this._selectedStartingWorld;
  }

  public setSelectedStartingWorld(worldId: CampaignWorldId): boolean {
    if (this.isWorldUnlocked(worldId)) {
      this._selectedStartingWorld = worldId;
      return true;
    }
    return false;
  }

  public getStartingDistance(): number {
    const cfg = WORLD_CAMPAIGN_CONFIGS[this._selectedStartingWorld];
    return cfg ? cfg.startDistance : 0;
  }

  public getCurrentWorldConfig(distance: number): WorldCampaignConfig {
    for (let i = CAMPAIGN_WORLD_ORDER.length - 1; i >= 0; i--) {
      const wId = CAMPAIGN_WORLD_ORDER[i];
      const cfg = WORLD_CAMPAIGN_CONFIGS[wId];
      if (distance >= cfg.startDistance) {
        return cfg;
      }
    }
    return WORLD_CAMPAIGN_CONFIGS['sky-isles'];
  }

  // --- Run Lifecycle ---

  public onRunStart(): void {
    this._runHasStarted = true;
    this._revivesUsedInRun = 0;
    this._maxOverdriveReached = false;
    this._notifiedCompletedSectors.clear();
    this._state.campaignRunCount++;
    this.saveState();
  }

  public onRevive(): void {
    this._revivesUsedInRun++;
  }

  public update(stats: PlayerStats): void {
    if (!this._runHasStarted) return;
    if (stats.overdriveTier === 'Max-Velocity' || stats.overdriveMeter >= 100) {
      this._maxOverdriveReached = true;
    }
  }

  /**
   * Check if the current distance triggers a sector completion.
   * Returns completion result if a sector boundary was just achieved.
   */
  public evaluateSectorProgress(
    stats: PlayerStats,
    progressionMgr?: ProgressionManager
  ): SectorCompletionResult | null {
    if (!this._runHasStarted) return null;

    const currentDist = stats.distance;

    let latestResult: SectorCompletionResult | null = null;

    for (const wId of CAMPAIGN_WORLD_ORDER) {
      const cfg = WORLD_CAMPAIGN_CONFIGS[wId];
      // Has reached or surpassed target distance for this sector
      if (currentDist >= cfg.targetDistance && !this._notifiedCompletedSectors.has(wId)) {
        this._notifiedCompletedSectors.add(wId);

        // Mark sector completed
        this._state.completedSectors[wId] = true;

        // Unlock next sector if applicable
        let isNewUnlock = false;
        const nextSectorIdx = cfg.sectorIndex + 1;
        if (nextSectorIdx <= 5 && nextSectorIdx > this._state.highestSectorUnlocked) {
          this._state.highestSectorUnlocked = nextSectorIdx;
          isNewUnlock = true;
        }

        // Evaluate Objectives
        const objectivesAchieved: string[] = [];

        // 1. Primary: Distance reached
        objectivesAchieved.push(cfg.primaryObjective.id);
        this._state.objectivesCompleted[cfg.primaryObjective.id] = true;

        // 2. Secondary
        if (this.checkObjectiveCondition(cfg.secondaryObjective, stats)) {
          objectivesAchieved.push(cfg.secondaryObjective.id);
          this._state.objectivesCompleted[cfg.secondaryObjective.id] = true;
        }

        // 3. Bonus
        if (this.checkObjectiveCondition(cfg.bonusObjective, stats)) {
          objectivesAchieved.push(cfg.bonusObjective.id);
          this._state.objectivesCompleted[cfg.bonusObjective.id] = true;
        }

        const starsEarned = objectivesAchieved.length;
        const prevStars = this._state.sectorStars[wId] || 0;
        if (starsEarned > prevStars) {
          this._state.sectorStars[wId] = starsEarned;
        }

        // Check overall campaign completion
        const isCampaignComplete = cfg.sectorIndex === 5 && currentDist >= CAMPAIGN_TOTAL_DISTANCE;
        if (isCampaignComplete) {
          this._state.campaignCompleted = true;
        }

        // Shards & XP rewards
        let totalRewardShards = cfg.completionBonusShards;
        for (const objId of objectivesAchieved) {
          const obj = [cfg.primaryObjective, cfg.secondaryObjective, cfg.bonusObjective].find(o => o.id === objId);
          if (obj) totalRewardShards += obj.rewardShards;
        }

        if (progressionMgr) {
          progressionMgr.addXp(cfg.completionBonusXp, `campaign_sector_${cfg.sectorIndex}`);
        }

        if (typeof localStorage !== 'undefined' && totalRewardShards > 0) {
          try {
            const raw = localStorage.getItem('skyflow_banked_shards');
            const currentBanked = raw ? parseInt(raw, 10) || 0 : 0;
            localStorage.setItem('skyflow_banked_shards', String(currentBanked + totalRewardShards));
          } catch (e) {
            console.warn('[CampaignManager] Failed to credit banked shards', e);
          }
        }

        latestResult = {
          worldId: wId,
          sectorIndex: cfg.sectorIndex,
          isNewUnlock,
          starsEarned,
          shardsAwarded: totalRewardShards,
          xpAwarded: cfg.completionBonusXp,
          isCampaignComplete,
          objectivesAchieved,
        };
      }
    }

    if (latestResult) {
      this.saveState();
    }

    return latestResult;
  }

  private checkObjectiveCondition(obj: WorldCampaignConfig['secondaryObjective'], stats: PlayerStats): boolean {
    const runShards = stats.dataShardsCollected || stats.windOrbsCollected || 0;
    switch (obj.type) {
      case 'distance':
        return stats.distance >= obj.target;
      case 'shards':
        return runShards >= obj.target;
      case 'near-misses':
        return (stats.nearMissCount || 0) >= obj.target;
      case 'combo':
        return (stats.combo || 0) >= obj.target;
      case 'overdrive':
        return this._maxOverdriveReached || (stats.overdriveMeter || 0) >= obj.target;
      case 'no-revive':
        return this._revivesUsedInRun === 0;
      default:
        return false;
    }
  }

  public onGameOver(finalStats: PlayerStats, durationSeconds: number): void {
    this._runHasStarted = false;

    if (finalStats.score > this._state.campaignHighScore) {
      this._state.campaignHighScore = finalStats.score;
    }

    if (this._state.campaignCompleted) {
      if (this._state.campaignBestTimeSeconds === 0 || durationSeconds < this._state.campaignBestTimeSeconds) {
        this._state.campaignBestTimeSeconds = Math.round(durationSeconds);
      }
    }

    this.saveState();
  }

  /**
   * Reset campaign progress (for clean replay or testing)
   */
  public resetCampaignProgress(): void {
    this._state = createDefaultCampaignSaveData();
    this._selectedStartingWorld = 'sky-isles';
    this.saveState();
  }
}
