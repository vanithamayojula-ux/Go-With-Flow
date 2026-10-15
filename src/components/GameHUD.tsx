import React, { useState } from 'react';
import { Volume2, VolumeX, Sliders, Eye, Palette, Smartphone, Monitor, Shield, Trophy, Zap, Radio, Terminal, Pause, Camera, MoreHorizontal } from 'lucide-react';
import { BiomeType, LightingMode, PlayerStats } from '../types';
import { WorldIntroBanner } from './WorldIntroBanner';
import { WORLDS, WORLD_ORDER, WorldId } from '../game/worlds';
import { useLiveStats } from '../state/liveStats';

// The banner only depends on the world id; skip it on the HUD's stats ticks.
const MemoWorldIntroBanner = React.memo(WorldIntroBanner);

const WORLD_SECTOR_INFO: Record<string, { sector: number; name: string; icon: string; border: string; text: string; bg: string; swatch: string }> = {
  'sky-isles': {
    sector: 1,
    name: 'SKY ISLES',
    icon: '☁️',
    border: 'border-cyan-400/60 shadow-cyan-950/30',
    text: 'text-cyan-300',
    bg: 'bg-cyan-950/40',
    swatch: 'bg-cyan-400',
  },
  'verdant-wilds': {
    sector: 2,
    name: 'VERDANT WILDS',
    icon: '🌿',
    border: 'border-emerald-400/60 shadow-emerald-950/30',
    text: 'text-emerald-300',
    bg: 'bg-emerald-950/40',
    swatch: 'bg-emerald-400',
  },
  'crimson-dunes': {
    sector: 3,
    name: 'CRIMSON DUNES',
    icon: '🏜️',
    border: 'border-amber-400/60 shadow-amber-950/30',
    text: 'text-amber-300',
    bg: 'bg-amber-950/40',
    swatch: 'bg-amber-400',
  },
  'crystal-heights': {
    sector: 4,
    name: 'CRYSTAL HEIGHTS',
    icon: '💎',
    border: 'border-purple-400/60 shadow-purple-950/30',
    text: 'text-purple-300',
    bg: 'bg-purple-950/40',
    swatch: 'bg-purple-400',
  },
  'obsidian-core': {
    sector: 5,
    name: 'OBSIDIAN CORE',
    icon: '🌋',
    border: 'border-rose-500/60 shadow-rose-950/30',
    text: 'text-rose-300',
    bg: 'bg-rose-950/40',
    swatch: 'bg-rose-500',
  },
};

interface GameHUDProps {
  /**
   * Live values come from the liveStats store (the HUD subscribes itself, so
   * the App shell doesn't re-render on every stats tick). Passing them still
   * works and overrides the store.
   */
  stats?: PlayerStats;
  bankedShards?: number;
  fps?: number;
  drawCalls?: number;
  instanceCount?: number;
  lightingMode: LightingMode;
  onSelectLighting: (mode: LightingMode) => void;
  isMuted: boolean;
  onToggleMute: () => void;
  isCinematicCam: boolean;
  onToggleCam: () => void;
  isUpright?: boolean;
  onToggleUpright?: () => void;
  onActivateShield?: () => void;
  onOpenGraphicsDrawer: () => void;
  onOpenDeliverables: () => void;
  onOpenCosmetics: () => void;
  onOpenProgression?: () => void;
  onOpenDatasetCapture?: () => void;
  onPause?: () => void;
  gameModeMgr?: import('../game/modes').GameModeManager;
  notification: string | null;
}

const GameHUDView: React.FC<GameHUDProps> = ({
  stats: statsProp,
  bankedShards = 0,
  fps: fpsProp,
  drawCalls: drawCallsProp,
  instanceCount: instanceCountProp,
  lightingMode,
  onSelectLighting,
  isMuted,
  onToggleMute,
  isCinematicCam,
  onToggleCam,
  isUpright = true,
  onToggleUpright,
  onActivateShield,
  onOpenGraphicsDrawer,
  onOpenDeliverables,
  onOpenCosmetics,
  onOpenProgression,
  onOpenDatasetCapture,
  onPause,
  gameModeMgr,
  notification,
}) => {
  const live = useLiveStats();
  const stats = statsProp ?? live.stats;
  const fps = fpsProp ?? live.fps;
  const drawCalls = drawCallsProp ?? live.drawCalls;
  const instanceCount = instanceCountProp ?? live.instances;
  const [showDevInspector, setShowDevInspector] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const getOverdriveTierColor = (tier: string) => {
    switch (tier) {
      case 'Max-Velocity':
        return 'bg-gradient-to-r from-cyan-400 via-fuchsia-400 to-white text-black border-white shadow-lg shadow-white/40 animate-pulse';
      case 'Overdrive':
        return 'bg-gradient-to-r from-fuchsia-500 to-pink-500 text-white border-pink-400 shadow-md shadow-pink-500/30';
      case 'Charged':
        return 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white border-cyan-400 shadow-md shadow-cyan-500/20';
      default:
        return 'bg-gradient-to-r from-slate-700 to-slate-800 text-slate-300 border-slate-600';
    }
  };

  const getComboBadgeColor = (combo: number) => {
    if (combo >= 5) return 'bg-white/90 text-black border-white shadow-xl shadow-white/50 animate-pulse';
    if (combo >= 3) return 'bg-fuchsia-500/90 text-white border-fuchsia-300 shadow-lg shadow-fuchsia-500/30';
    if (combo === 2) return 'bg-cyan-500/90 text-white border-cyan-300 shadow-md shadow-cyan-500/20';
    return 'bg-blue-600/80 text-blue-100 border-blue-400';
  };

  const getBiomeBadge = (biome: BiomeType) => {
    switch (biome) {
      case 'dune-nomad':
      case 'dunes':
        return { name: 'DUNE NOMAD // AMBER MESAS', tag: 'ZONE 2', color: 'border-amber-400 text-amber-300' };
      case 'aurora-frost':
        return { name: 'AURORA FROST // GLACIER TUNDRA', tag: 'ZONE 3', color: 'border-cyan-300 text-cyan-200' };
      case 'bioluminescent-jungle':
        return { name: 'BIOLUMINESCENT JUNGLE', tag: 'ZONE 4', color: 'border-emerald-400 text-emerald-300' };
      case 'ember-core':
        return { name: 'EMBER CORE // MAGMA OBSIDIAN', tag: 'ZONE 5', color: 'border-red-500 text-red-400' };
      case 'nebula-drift':
        return { name: 'NEBULA DRIFT // STELLAR VOID', tag: 'ZONE 6', color: 'border-purple-400 text-purple-300' };
      case 'sky-realm':
      case 'sky-islands':
        return { name: 'SKY REALM // CLOUD ISLES', tag: 'ZONE 7', color: 'border-sky-300 text-sky-200' };
      case 'quantum-desert':
        return { name: 'QUANTUM DESERT // SOLAR DUNES', tag: 'ZONE 8', color: 'border-amber-500 text-amber-400' };
      case 'cyber-forest':
      case 'forest':
        return { name: 'CYBER FOREST // BIOLUMINESCENT CANOPY', tag: 'ZONE 9', color: 'border-emerald-300 text-emerald-200' };
      case 'orbital-ring':
        return { name: 'ORBITAL RING // STRATOSPHERE', tag: 'ZONE 10', color: 'border-fuchsia-400 text-fuchsia-300' };
      case 'the-grid':
        return { name: 'THE GRID // VECTOR CYBERSPACE', tag: 'ZONE 11', color: 'border-green-400 text-green-300' };
      case 'volcanic-forge':
        return { name: 'VOLCANIC FORGE // MAGMA CORE', tag: 'ZONE 12', color: 'border-orange-500 text-orange-400' };
      case 'crystal-glacier':
        return { name: 'CRYSTAL GLACIER // FROST REALM', tag: 'ZONE 13', color: 'border-cyan-400 text-cyan-300' };
      case 'derelict-station':
        return { name: 'DERELICT STATION // HAZARD ZONE', tag: 'ZONE 14', color: 'border-yellow-500 text-yellow-400' };
      case 'meadow':
        return { name: 'NEON MEADOW // GREEN FIELDS', tag: 'ZONE 15', color: 'border-lime-400 text-lime-300' };
      case 'bleach-bypass-steel':
        return { name: 'BLEACH BYPASS // STEEL COMPLEX', tag: 'VARIANT', color: 'border-slate-300 text-slate-200' };
      default:
        return { name: 'SKY ISLES', tag: 'SECTOR 1', color: 'border-cyan-400 text-cyan-300' };
    }
  };

  // World behind the next portal; null in the final world (no portal after it).
  const getNextWorldInfo = (current: WorldId) => {
    const nextId = WORLD_ORDER[WORLD_ORDER.indexOf(current) + 1];
    return nextId ? { name: WORLDS[nextId].name, swatch: WORLD_SECTOR_INFO[nextId].swatch } : null;
  };

  const biomeBadge = getBiomeBadge(stats.currentBiome);
  const nextThemeInfo = getNextWorldInfo(stats.currentWorldId || 'sky-isles');
  const overdrivePercent = Math.round(stats.overdriveMeter || stats.styleMeter || 0);

  const closeMenuAnd = (action?: () => void) => () => {
    setIsMenuOpen(false);
    action?.();
  };

  const toolButton = 'min-h-[40px] min-w-[40px] p-2 flex items-center justify-center rounded-lg border transition-all active:scale-95 shadow-md';
  const menuItem = 'w-full min-h-[40px] px-2.5 py-2 flex items-center gap-2 rounded-lg text-left text-xs font-bold transition-all active:scale-[0.98]';

  return (
    <div
      id="game-hud-root"
      className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-between pt-[max(0.75rem,env(safe-area-inset-top))] pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] pb-3 sm:pt-[max(1.25rem,env(safe-area-inset-top))] sm:pl-[max(1.25rem,env(safe-area-inset-left))] sm:pr-[max(1.25rem,env(safe-area-inset-right))] select-none font-mono"
    >
      {/* Subtle Cinematic World Introduction Banner */}
      <MemoWorldIntroBanner worldId={stats.currentWorldId || 'sky-isles'} />

      {/*
        Top bar. Phones/tablets: the overdrive meter spans the first row, then
        stats on the left and a compact toolbar on the right. Desktop (lg+):
        stats | overdrive | toolbar in one row.
      */}
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2 w-full lg:grid lg:grid-cols-[minmax(0,1fr)_20rem_minmax(0,1fr)] xl:grid-cols-[minmax(0,1fr)_24rem_minmax(0,1fr)]">
        {/* Left: Run Telemetry */}
        <div className="order-2 lg:order-1 flex flex-col gap-2 min-w-0 flex-1">
          {/* Logo & Zone Indicator */}
          <div className="flex items-center gap-2 pointer-events-auto flex-wrap">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/80 border border-cyan-500/50 shadow-lg shadow-cyan-950/40">
              <div className="w-2.5 h-2.5 rounded-sm bg-cyan-400 animate-pulse shadow-md shadow-cyan-400" />
              <span className="font-black text-sm tracking-widest text-cyan-300 whitespace-nowrap">GO WITH FLOW</span>
            </div>

            {/* World Sector Indicator */}
            {stats.currentWorldId && WORLD_SECTOR_INFO[stats.currentWorldId] ? (
              <div
                className={`px-2.5 py-1.5 rounded-lg bg-black/80 border text-xs font-bold flex items-center gap-1.5 shadow-md whitespace-nowrap ${WORLD_SECTOR_INFO[stats.currentWorldId].border} ${WORLD_SECTOR_INFO[stats.currentWorldId].text}`}
              >
                <span className="text-[10px] bg-white/10 px-1 py-0.5 rounded font-black">
                  {WORLD_SECTOR_INFO[stats.currentWorldId].icon} {WORLD_SECTOR_INFO[stats.currentWorldId].sector}/5
                </span>
                <span>{WORLD_SECTOR_INFO[stats.currentWorldId].name}</span>
              </div>
            ) : (
              <div className={`px-2.5 py-1.5 rounded-lg bg-black/75 border text-xs font-bold flex items-center gap-1.5 shadow-md ${biomeBadge.color}`}>
                <span className="text-[10px] bg-white/10 px-1 py-0.5 rounded font-black">{biomeBadge.tag}</span>
                <span>{biomeBadge.name}</span>
              </div>
            )}

            {/* Next World Preview Swatch */}
            {nextThemeInfo && (
              <div className="hidden sm:flex px-2.5 py-1.5 rounded-lg bg-black/75 border border-slate-700 text-xs font-bold items-center gap-1.5 shadow-md whitespace-nowrap">
                <span className="text-[9px] text-slate-400 font-bold uppercase">NEXT:</span>
                <div className={`w-2.5 h-2.5 rounded-full ${nextThemeInfo.swatch} animate-pulse`} />
                <span className="text-slate-200">{nextThemeInfo.name}</span>
              </div>
            )}

            {/* Active Game Mode Badge */}
            {gameModeMgr && gameModeMgr.activeModeId !== 'standard-run' && (
              <div className="px-2.5 py-1.5 rounded-lg bg-amber-950/70 border border-amber-400 text-amber-300 text-xs font-bold flex items-center gap-1.5 shadow-md shadow-amber-950/40">
                <span className="text-[10px] bg-amber-400/20 px-1 py-0.5 rounded font-black text-amber-200 uppercase">
                  {gameModeMgr.activeMode.name}
                </span>
                {gameModeMgr.activeMode.getHudMetrics().statusBadge && (
                  <span className="text-[10px] text-amber-300 font-mono">
                    [{gameModeMgr.activeMode.getHudMetrics().statusBadge}]
                  </span>
                )}
              </div>
            )}

            {stats.isGrinding && (
              <div className="px-2.5 py-1 rounded-lg bg-fuchsia-600/90 border border-fuchsia-300 text-white text-xs font-black tracking-wider shadow-lg shadow-fuchsia-500/40 animate-pulse flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-yellow-300" />
                <span>RAIL GRIND</span>
              </div>
            )}
          </div>

          {/* Mode-Specific Telemetry Override (Phase 15 Section 18) */}
          {gameModeMgr && gameModeMgr.activeModeId !== 'standard-run' && (() => {
            const m = gameModeMgr.activeMode.getHudMetrics();
            return (
              <div className="flex items-center gap-2 pointer-events-auto flex-wrap">
                <div className="px-3 py-1.5 rounded-lg bg-slate-950/90 border border-amber-500/40 text-amber-300 flex items-center gap-2 shadow-sm">
                  <span className="text-[9px] text-amber-400 font-bold uppercase tracking-wider">{m.primaryLabel}</span>
                  <span className="text-base font-black font-mono tracking-tight text-white">{m.primaryValue}</span>
                </div>
                <div className="px-3 py-1.5 rounded-lg bg-slate-950/90 border border-cyan-500/40 text-cyan-300 flex items-center gap-2 shadow-sm">
                  <span className="text-[9px] text-cyan-400 font-bold uppercase tracking-wider">{m.secondaryLabel}</span>
                  <span className="text-sm font-bold font-mono tracking-tight text-white">{m.secondaryValue}</span>
                </div>
                {m.tertiaryLabel && m.tertiaryValue && (
                  <div className="px-2.5 py-1.5 rounded-lg bg-slate-950/90 border border-slate-700 text-slate-300 flex items-center gap-1 shadow-sm">
                    <span className="text-[10px] text-slate-400 font-bold uppercase">{m.tertiaryLabel}:</span>
                    <span className="text-xs font-bold font-mono text-white">{m.tertiaryValue}</span>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Core Metrics: Speed, Score, Shards, Distance */}
          <div className="flex items-center gap-1.5 sm:gap-2 pointer-events-auto flex-wrap">
            {/* Speedometer */}
            <div className="px-2.5 sm:px-3 py-1.5 rounded-lg bg-slate-950/90 border border-cyan-500/30 text-cyan-300 flex items-center gap-1.5 sm:gap-2 shadow-sm whitespace-nowrap">
              <span className="text-[9px] text-cyan-300 font-bold uppercase tracking-wider">SPEED</span>
              <span className="text-sm sm:text-base font-black font-mono tracking-tight text-white">
                {stats.speed} <span className="text-[10px] text-cyan-300 font-normal">KM/H</span>
              </span>
            </div>

            {/* Score & Multiplier */}
            <div className="px-2.5 sm:px-3 py-1.5 rounded-lg bg-slate-950/90 border border-fuchsia-500/30 text-fuchsia-300 flex items-center gap-1.5 sm:gap-2 shadow-sm whitespace-nowrap">
              <span className="text-[9px] text-fuchsia-300 font-bold uppercase tracking-wider">SCORE</span>
              <span className="text-sm sm:text-base font-black font-mono tracking-tight text-white">
                {Math.floor(stats.score).toLocaleString()}
              </span>
              {stats.scoreMultiplier > 1 && (
                <span className="px-1.5 py-0.5 rounded bg-fuchsia-600 text-white text-[10px] font-black">
                  x{stats.scoreMultiplier}
                </span>
              )}
            </div>

            {/* High Score Trophy */}
            <div className="hidden sm:flex px-2.5 py-1.5 rounded-lg bg-slate-950/90 border border-amber-500/30 text-amber-300 items-center gap-1.5 shadow-sm" title="Best score">
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-xs font-bold text-amber-200">
                {stats.highScore > 0 ? Math.floor(stats.highScore).toLocaleString() : '0'}
              </span>
            </div>

            {/* Data Shards Harvested this run */}
            <div className="px-2.5 py-1.5 rounded-lg bg-slate-950/90 border border-cyan-500/30 text-cyan-300 flex items-center gap-1.5 shadow-sm" title="Shards collected this run">
              <span className="text-xs">💎</span>
              <span className="text-xs font-bold text-cyan-100">
                +{stats.dataShardsCollected || stats.windOrbsCollected || 0}
              </span>
            </div>

            {/* Total Banked Shards Wallet (dark chip so the label stays readable over a bright sky) */}
            <div className="hidden sm:flex px-2.5 py-1.5 rounded-lg bg-slate-950/90 border border-cyan-500/40 items-center gap-1.5 shadow-sm" title="Banked Shards (spend in the Upgrades Bay)">
              <span className="text-[10px] text-cyan-200 font-bold uppercase tracking-wider">BANK</span>
              <span className="text-xs font-black font-mono text-white">
                {bankedShards.toLocaleString()}
              </span>
            </div>

            {/* Distance */}
            <div className="px-2.5 py-1.5 rounded-lg bg-slate-950/90 border border-slate-700 text-slate-300 flex items-center gap-1 shadow-sm whitespace-nowrap">
              <span className="text-[10px] text-slate-400 font-bold">DST</span>
              <span className="text-xs font-bold font-mono text-slate-100">{Math.floor(stats.distance)}M</span>
            </div>
          </div>

          {/* Active Power-Ups Strip with Live Countdown Gauges */}
          <div className="flex items-center gap-2 pointer-events-auto flex-wrap">
            {stats.activePowerUps?.magnetTimer > 0 && (() => {
              const maxDur = stats.activePowerUps.magnetMaxDuration || 10;
              const pct = Math.min(100, Math.max(0, (stats.activePowerUps.magnetTimer / maxDur) * 100));
              return (
                <div className="flex flex-col px-2.5 py-1 rounded-lg bg-black/85 border border-cyan-400 text-white text-[10px] shadow-lg shadow-cyan-950/40">
                  <div className="flex items-center gap-1.5 font-bold">
                    <span className="animate-pulse">🧲</span>
                    <span className="text-cyan-300">MAGNET</span>
                    <span className="font-mono text-white ml-auto">{stats.activePowerUps.magnetTimer.toFixed(1)}s</span>
                  </div>
                  <div className="w-full h-1 bg-slate-800 rounded-full mt-1 overflow-hidden">
                    <div className="h-full bg-cyan-400 transition-all duration-100" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })()}

            {stats.activePowerUps?.jetpackTimer > 0 && (() => {
              const maxDur = stats.activePowerUps.jetpackMaxDuration || 7;
              const pct = Math.min(100, Math.max(0, (stats.activePowerUps.jetpackTimer / maxDur) * 100));
              return (
                <div className="flex flex-col px-2.5 py-1 rounded-lg bg-black/85 border border-fuchsia-400 text-white text-[10px] shadow-lg shadow-fuchsia-950/40">
                  <div className="flex items-center gap-1.5 font-bold">
                    <span className="animate-bounce">🚀</span>
                    <span className="text-fuchsia-300">JETPACK</span>
                    <span className="font-mono text-white ml-auto">{stats.activePowerUps.jetpackTimer.toFixed(1)}s</span>
                  </div>
                  <div className="w-full h-1 bg-slate-800 rounded-full mt-1 overflow-hidden">
                    <div className="h-full bg-fuchsia-400 transition-all duration-100" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })()}

            {stats.activePowerUps?.multiplierTimer > 0 && (() => {
              const maxDur = stats.activePowerUps.multiplierMaxDuration || 12;
              const pct = Math.min(100, Math.max(0, (stats.activePowerUps.multiplierTimer / maxDur) * 100));
              return (
                <div className="flex flex-col px-2.5 py-1 rounded-lg bg-black/85 border border-amber-400 text-white text-[10px] shadow-lg shadow-amber-950/40">
                  <div className="flex items-center gap-1.5 font-bold">
                    <span className="animate-spin">⚡</span>
                    <span className="text-amber-300">2X BOOST</span>
                    <span className="font-mono text-white ml-auto">{stats.activePowerUps.multiplierTimer.toFixed(1)}s</span>
                  </div>
                  <div className="w-full h-1 bg-slate-800 rounded-full mt-1 overflow-hidden">
                    <div className="h-full bg-amber-400 transition-all duration-100" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })()}

            {stats.activePowerUps?.hoverboardShield && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-950/80 border border-emerald-400 text-white text-[10px] font-bold shadow-md shadow-emerald-950/40 animate-pulse">
                <span>🛡️</span>
                <span className="text-emerald-300 uppercase tracking-wide">SHIELD ON</span>
              </div>
            )}
          </div>
        </div>

        {/* Center: Overdrive Gauge & Trick Banner (full-width first row on small screens) */}
        <div className="order-1 lg:order-2 basis-full lg:basis-auto shrink-0 flex flex-col items-center">
          {/* Active Trick / Combo Banner */}
          {stats.activeTrickName && (
            <div className={`mb-2 px-3.5 py-1 rounded-full border text-xs font-black flex items-center gap-2 transition-all ${getComboBadgeColor(stats.combo)}`}>
              <Zap className="w-3.5 h-3.5 animate-spin" />
              <span>{stats.activeTrickName}</span>
              {stats.combo > 1 && (
                <span className="px-1.5 py-0.5 rounded bg-black text-cyan-300 font-black text-[10px]">
                  {stats.combo}X COMBO
                </span>
              )}
            </div>
          )}

          {/* Notification Toast */}
          {notification && !stats.activeTrickName && (
            <div className="mb-2 px-3.5 py-1 rounded-md bg-black/90 border border-cyan-500/60 text-cyan-300 text-xs font-bold shadow-lg shadow-cyan-950/40 animate-pulse">
              {notification}
            </div>
          )}

          {/* OVERDRIVE Segmented Meter */}
          <div className="w-full pointer-events-auto bg-black/85 border border-cyan-500/40 rounded-xl p-2 shadow-lg shadow-cyan-950/30">
            <div className="flex items-center justify-between text-xs mb-1 px-1">
              <div className="flex items-center gap-1.5">
                <span className="text-cyan-300 font-bold text-[10px] tracking-wider">OVERDRIVE</span>
                <span className={`text-[9px] px-1.5 py-0.5 rounded font-black uppercase border ${getOverdriveTierColor(stats.overdriveTier || 'Charged')}`}>
                  {stats.overdriveTier || 'Charged'}
                </span>
              </div>
              <div className="font-mono text-cyan-200 text-xs font-black">
                {overdrivePercent}%
              </div>
            </div>

            {/* Segmented Bar */}
            <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden p-0.5 border border-cyan-500/30">
              <div
                className={`h-full rounded-full transition-all duration-200 ${getOverdriveTierColor(stats.overdriveTier || 'Charged')}`}
                style={{ width: `${Math.max(4, overdrivePercent)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Right: compact toolbar (Pause, Shield, Mute) + menu with the rest */}
        <div className="order-3 shrink-0 relative flex items-start gap-1.5 pointer-events-auto lg:justify-self-end">
          {/* Pause / Standby Button */}
          {onPause && (
            <button
              onClick={onPause}
              className={`${toolButton} bg-black/70 border-slate-700 hover:border-cyan-400 text-slate-300 hover:text-cyan-300`}
              title="Pause Game (ESC / P)"
              aria-label="Pause game"
            >
              <Pause className="w-4 h-4 text-cyan-400" />
            </button>
          )}

          {/* Shield Deploy Button */}
          <button
            onClick={onActivateShield}
            className={`${toolButton} ${
              stats.activePowerUps?.hoverboardShield
                ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 shadow-emerald-500/20'
                : 'bg-black/70 border-slate-700 text-slate-300 hover:text-white'
            }`}
            title="Deploy Shield (Double-Tap Space)"
            aria-label="Deploy shield"
          >
            <Shield className="w-4 h-4" />
          </button>

          {/* Mute Audio */}
          <button
            onClick={onToggleMute}
            className={`${toolButton} ${
              isMuted
                ? 'bg-red-500/20 border-red-500 text-red-400'
                : 'bg-black/70 border-slate-700 text-slate-300 hover:text-white'
            }`}
            title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
            aria-label={isMuted ? 'Unmute audio' : 'Mute audio'}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {/* More: camera, lighting, bays and debug tools */}
          <button
            onClick={() => setIsMenuOpen(open => !open)}
            className={`${toolButton} ${
              isMenuOpen
                ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                : 'bg-black/70 border-slate-700 text-slate-300 hover:text-white'
            }`}
            title="More options"
            aria-label="More options"
            aria-haspopup="menu"
            aria-expanded={isMenuOpen}
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>

          {isMenuOpen && (
            <>
              {/* Tap outside to close */}
              <div className="fixed inset-0 z-30" onClick={() => setIsMenuOpen(false)} aria-hidden="true" />
              <div
                role="menu"
                className="absolute right-0 top-full mt-2 z-40 w-60 max-w-[calc(100vw-1.5rem)] max-h-[calc(100dvh-6rem)] overflow-y-auto p-2 rounded-xl bg-black/95 border border-cyan-500/40 shadow-xl shadow-cyan-950/40 flex flex-col gap-1"
              >
                <button
                  role="menuitem"
                  onClick={closeMenuAnd(onToggleCam)}
                  className={`${menuItem} ${isCinematicCam ? 'bg-fuchsia-500/20 text-fuchsia-200' : 'text-slate-200 hover:bg-white/10'}`}
                >
                  <Eye className="w-4 h-4 shrink-0" />
                  <span>Cinematic camera {isCinematicCam ? '(on)' : '(off)'}</span>
                </button>

                {onToggleUpright && (
                  <button
                    role="menuitem"
                    onClick={closeMenuAnd(onToggleUpright)}
                    className={`${menuItem} ${isUpright ? 'bg-cyan-500/15 text-cyan-200' : 'text-slate-200 hover:bg-white/10'}`}
                  >
                    {isUpright ? <Smartphone className="w-4 h-4 shrink-0" /> : <Monitor className="w-4 h-4 shrink-0" />}
                    <span>{isUpright ? 'Portrait camera' : 'Wide chase camera'}</span>
                  </button>
                )}

                <div className="px-2.5 pt-1.5 pb-1 text-[10px] font-black uppercase tracking-widest text-cyan-300 flex items-center gap-1.5">
                  <Radio className="w-3 h-3" />
                  <span>Lighting mood</span>
                </div>
                <div className="grid grid-cols-2 gap-1 px-1 pb-1">
                  {(['midnight-cyan', 'synthwave-magenta', 'toxic-matrix', 'solar-amber'] as LightingMode[]).map(mode => (
                    <button
                      key={mode}
                      role="menuitemradio"
                      aria-checked={lightingMode === mode}
                      onClick={() => onSelectLighting(mode)}
                      className={`min-h-[36px] px-2 py-1 text-[10px] font-bold rounded-md border transition-all ${
                        lightingMode === mode
                          ? 'bg-cyan-500/20 border-cyan-400 text-cyan-100'
                          : 'border-white/10 text-slate-300 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      {mode.toUpperCase().replace('-', ' ')}
                    </button>
                  ))}
                </div>

                <div className="h-px bg-white/10 my-1" />

                <button role="menuitem" onClick={closeMenuAnd(onOpenCosmetics)} className={`${menuItem} text-slate-200 hover:bg-white/10`}>
                  <Palette className="w-4 h-4 shrink-0 text-cyan-300" />
                  <span>Boards &amp; cosmetics</span>
                </button>

                {onOpenProgression && (
                  <button role="menuitem" onClick={closeMenuAnd(onOpenProgression)} className={`${menuItem} text-slate-200 hover:bg-white/10`}>
                    <Trophy className="w-4 h-4 shrink-0 text-amber-400" />
                    <span>Progression &amp; missions</span>
                  </button>
                )}

                <button role="menuitem" onClick={closeMenuAnd(onOpenGraphicsDrawer)} className={`${menuItem} text-slate-200 hover:bg-white/10`}>
                  <Sliders className="w-4 h-4 shrink-0 text-cyan-300" />
                  <span>Graphics settings</span>
                </button>

                {onOpenDatasetCapture && (
                  <button role="menuitem" onClick={closeMenuAnd(onOpenDatasetCapture)} className={`${menuItem} text-slate-200 hover:bg-white/10`}>
                    <Camera className="w-4 h-4 shrink-0 text-cyan-300" />
                    <span>Screenshot capture</span>
                  </button>
                )}

                <button
                  role="menuitemcheckbox"
                  aria-checked={showDevInspector}
                  onClick={closeMenuAnd(() => setShowDevInspector(prev => !prev))}
                  className={`${menuItem} ${showDevInspector ? 'bg-cyan-500/15 text-cyan-200' : 'text-slate-200 hover:bg-white/10'}`}
                >
                  <Terminal className="w-4 h-4 shrink-0" />
                  <span>Performance overlay {showDevInspector ? '(on)' : '(off)'}</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Dev Inspector Mini-HUD */}
      {showDevInspector && (
        <div className="pointer-events-auto absolute top-28 lg:top-20 right-[max(0.75rem,env(safe-area-inset-right))] sm:right-5 p-3 rounded-lg bg-black/90 border border-cyan-500/40 text-[11px] text-cyan-300 shadow-xl z-30 flex flex-col gap-1">
          <div className="text-white font-bold border-b border-cyan-500/30 pb-1 mb-1">
            [TELEMETRY DIAGNOSTICS]
          </div>
          <div>FPS: <span className="font-bold text-white">{fps}</span></div>
          <div>DRAW CALLS: <span className="font-bold text-white">{drawCalls}</span></div>
          <div>INSTANCES: <span className="font-bold text-white">{instanceCount}</span></div>
          <div>RES SCALE: <span className="font-bold text-white">{live.renderScale || '-'}</span></div>
          <div>ZONE: <span className="font-bold text-white">{stats.currentBiome.toUpperCase()}</span></div>
          <div>LANE: <span className="font-bold text-white">{stats.currentLane}</span></div>
          <div>GRINDING: <span className="font-bold text-white">{stats.isGrinding ? 'YES' : 'NO'}</span></div>
          <div>BOOSTING: <span className="font-bold text-white">{stats.isBoosting ? 'YES' : 'NO'}</span></div>
        </div>
      )}
    </div>
  );
};

export const GameHUD = React.memo(GameHUDView);
