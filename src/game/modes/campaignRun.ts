/**
 * GoWithFlow — Campaign Run Game Mode
 * 5-World Progressive Campaign: Sky Isles -> Verdant Wilds -> Crimson Dunes -> Crystal Heights -> Obsidian Core.
 */

import { PlayerStats } from '../../types';
import {
  GameMode,
  GameModeId,
  GameModeSummary,
  ChallengeModifier,
} from './gameModeTypes';
import { CampaignManager } from '../campaign/CampaignManager';
import {
  WORLD_CAMPAIGN_CONFIGS,
  CAMPAIGN_TOTAL_DISTANCE,
} from '../campaign/campaignConfig';

export class CampaignRunMode implements GameMode {
  public readonly id: GameModeId = 'campaign';
  public readonly name: string = 'Campaign Mode';
  public readonly description: string = 'Conquer all five sectors from Sky Isles to Obsidian Core.';
  public readonly modifiers: ChallengeModifier[] = [];
  public readonly allowsRevive: boolean = true;

  private durationSeconds: number = 0;
  private currentStats: PlayerStats | null = null;
  private obstaclesPassedCount: number = 0;
  private worldReachedName: string = 'Sky Isles';
  private campaignMgr: CampaignManager;
  private isVictorious: boolean = false;

  constructor(campaignMgr?: CampaignManager) {
    this.campaignMgr = campaignMgr || new CampaignManager();
  }

  public setCampaignManager(mgr: CampaignManager): void {
    this.campaignMgr = mgr;
  }

  public getCampaignManager(): CampaignManager {
    return this.campaignMgr;
  }

  public initialize(_initialModifiers?: ChallengeModifier[]): void {
    this.durationSeconds = 0;
    this.currentStats = null;
    this.obstaclesPassedCount = 0;
    this.worldReachedName = 'Sky Isles';
    this.isVictorious = false;
    this.campaignMgr.onRunStart();
  }

  public update(delta: number, currentStats: PlayerStats): void {
    this.durationSeconds += delta;
    this.currentStats = currentStats;
    this.campaignMgr.update(currentStats);

    if (currentStats.distance >= CAMPAIGN_TOTAL_DISTANCE) {
      this.isVictorious = true;
    }
  }

  public onCollect(_count: number, _currentStats: PlayerStats): void {
    // Collectibles tracked in stats
  }

  public onObstaclePassed(_obstacleType: string, _isNearMiss: boolean): void {
    this.obstaclesPassedCount++;
  }

  public onWorldChanged(worldId: string, _worldIndex: number): void {
    const worldNames: Record<string, string> = {
      'sky-isles': 'Sky Isles',
      'verdant-wilds': 'Verdant Wilds',
      'crimson-dunes': 'Crimson Dunes',
      'crystal-heights': 'Crystal Heights',
      'obsidian-core': 'Obsidian Core',
    };
    this.worldReachedName = worldNames[worldId] || worldId;
  }

  public onGameOver(finalStats: PlayerStats): void {
    this.currentStats = finalStats;
    this.campaignMgr.onGameOver(finalStats, this.durationSeconds);
  }

  public onRevive(): void {
    this.campaignMgr.onRevive();
  }

  public getScore(): number {
    return this.currentStats ? this.currentStats.score : 0;
  }

  public getHudMetrics(): {
    primaryLabel: string;
    primaryValue: string;
    secondaryLabel: string;
    secondaryValue: string;
    tertiaryLabel?: string;
    tertiaryValue?: string;
    statusBadge?: string;
  } {
    const dist = this.currentStats ? this.currentStats.distance : 0;
    const currentCfg = this.campaignMgr.getCurrentWorldConfig(dist);
    const targetDist = currentCfg.targetDistance;
    const remainingToSector = Math.max(0, targetDist - dist);
    const stars = this.campaignMgr.getTotalStarsEarned();

    return {
      primaryLabel: `SECTOR ${currentCfg.sectorIndex}/5`,
      primaryValue: currentCfg.name.toUpperCase(),
      secondaryLabel: 'NEXT GATE',
      secondaryValue: `${remainingToSector}m`,
      tertiaryLabel: 'STARS',
      tertiaryValue: `⭐ ${stars}/15`,
      statusBadge: `CAMPAIGN S${currentCfg.sectorIndex}`,
    };
  }

  public isObjectiveCompleted(): boolean {
    return this.isVictorious;
  }

  public getSummary(): GameModeSummary {
    const score = this.currentStats ? this.currentStats.score : 0;
    const dist = this.currentStats ? this.currentStats.distance : 0;
    const shards = this.currentStats ? (this.currentStats.dataShardsCollected || this.currentStats.windOrbsCollected || 0) : 0;
    const nearMisses = this.currentStats ? (this.currentStats.nearMissCount || 0) : 0;
    const completed = this.isVictorious || dist >= CAMPAIGN_TOTAL_DISTANCE;
    const stars = this.campaignMgr.getTotalStarsEarned();

    return {
      modeId: 'campaign',
      modeName: 'Campaign Mode',
      score,
      finalScore: score,
      distance: dist,
      durationSeconds: Math.round(this.durationSeconds),
      shardsCollected: shards,
      nearMisses,
      obstaclesPassed: this.obstaclesPassedCount,
      worldReached: this.worldReachedName,
      isCompleted: completed,
      isNewRecord: score >= this.campaignMgr.state.campaignHighScore,
      breakdown: [
        { label: 'Base Flight Score', value: score.toLocaleString() },
        { label: 'Distance Covered', value: `${dist.toLocaleString()}m` },
        { label: 'Sector Reached', value: this.worldReachedName },
        { label: 'Campaign Stars', value: `⭐ ${stars} / 15` },
        { label: 'Extraction Status', value: completed ? 'CORE CONQUERED (VICTORY)' : 'MISSION ABORTED' },
      ],
      xpAwarded: completed ? 2000 : Math.round(dist * 0.1),
      claimedReward: completed ? {
        xp: 2000,
        badgeId: 'badge:campaign-master',
      } : undefined,
    };
  }

  public dispose(): void {
    this.currentStats = null;
  }
}
