import React, { useState } from 'react';
import { Volume2, VolumeX, Sliders, Eye, Palette, Smartphone, Monitor, Shield, Trophy, Zap, Radio, Terminal } from 'lucide-react';
import { BiomeType, LightingMode, PlayerStats } from '../types';

interface GameHUDProps {
  stats: PlayerStats;
  fps: number;
  drawCalls: number;
  instanceCount: number;
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
  notification: string | null;
}

export const GameHUD: React.FC<GameHUDProps> = ({
  stats,
  fps,
  drawCalls,
  instanceCount,
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
  notification,
}) => {
  const [showDevInspector, setShowDevInspector] = useState(false);

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
      case 'quantum-desert':
      case 'dunes':
        return { name: 'DUNE NOMAD // AMBER MESAS', tag: 'WORLD 2', color: 'border-amber-400 text-amber-300' };
      case 'aurora-frost':
      case 'crystal-glacier':
        return { name: 'AURORA FROST // GLACIER TUNDRA', tag: 'WORLD 3', color: 'border-cyan-300 text-cyan-200' };
      case 'bioluminescent-jungle':
      case 'cyber-forest':
      case 'forest':
        return { name: 'BIOLUMINESCENT JUNGLE', tag: 'WORLD 4', color: 'border-emerald-400 text-emerald-300' };
      case 'ember-core':
      case 'volcanic-forge':
        return { name: 'EMBER CORE // MAGMA OBSIDIAN', tag: 'WORLD 5', color: 'border-red-500 text-red-400' };
      case 'nebula-drift':
      case 'orbital-ring':
        return { name: 'NEBULA DRIFT // STELLAR VOID', tag: 'WORLD 6', color: 'border-purple-400 text-purple-300' };
      case 'sky-realm':
      case 'sky-islands':
        return { name: 'SKY REALM // GHIBLI NATURE', tag: 'WORLD 7', color: 'border-sky-300 text-sky-200' };
      default:
        return { name: 'NEON UNDERCITY // SECTOR-01', tag: 'WORLD 1', color: 'border-fuchsia-400 text-fuchsia-300' };
    }
  };

  const getNextThemeInfo = (current: BiomeType) => {
    const list: BiomeType[] = ['neon-undercity', 'dune-nomad', 'aurora-frost', 'bioluminescent-jungle', 'ember-core', 'nebula-drift', 'sky-realm'];
    const idx = list.indexOf(current);
    const nextId = idx === -1 ? 'dune-nomad' : list[(idx + 1) % list.length];
    const swatchColors: Record<string, string> = {
      'neon-undercity': 'bg-fuchsia-500',
      'dune-nomad': 'bg-amber-500',
      'aurora-frost': 'bg-cyan-400',
      'bioluminescent-jungle': 'bg-emerald-400',
      'ember-core': 'bg-red-500',
      'nebula-drift': 'bg-purple-500',
      'sky-realm': 'bg-sky-400',
    };
    const names: Record<string, string> = {
      'neon-undercity': 'Neon Undercity',
      'dune-nomad': 'Dune Nomad',
      'aurora-frost': 'Aurora Frost',
      'bioluminescent-jungle': 'Bio Jungle',
      'ember-core': 'Ember Core',
      'nebula-drift': 'Nebula Drift',
      'sky-realm': 'Sky Realm',
    };
    return { name: names[nextId] || 'Next World', swatch: swatchColors[nextId] || 'bg-cyan-400' };
  };

  const biomeBadge = getBiomeBadge(stats.currentBiome);
  const nextThemeInfo = getNextThemeInfo(stats.currentBiome);
  const overdrivePercent = Math.round(stats.overdriveMeter || stats.styleMeter || 0);

  return (
    <div id="game-hud-root" className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-between p-3 sm:p-5 select-none font-mono">
      {/* Top Telemetry & Cyber Status Bar */}
      <div className="flex items-start justify-between w-full">
        {/* Left: Cyberpunk In-World Telemetry */}
        <div className="flex flex-col space-y-2">
          {/* Logo & Zone Indicator */}
          <div className="flex items-center space-x-2 pointer-events-auto flex-wrap gap-y-1.5">
            <div className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-black/80 backdrop-blur-md border border-cyan-500/50 shadow-lg shadow-cyan-950/40">
              <div className="w-2.5 h-2.5 rounded-sm bg-cyan-400 animate-pulse shadow-md shadow-cyan-400" />
              <span className="font-black text-sm tracking-widest text-cyan-300">NEON // DRIFT</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-950/80 border border-cyan-500/40 text-cyan-400 font-bold">
                REV 2.0
              </span>
            </div>

            {/* Zone Tag */}
            <div className={`px-2.5 py-1.5 rounded-lg bg-black/75 backdrop-blur-md border text-xs font-bold flex items-center space-x-1.5 shadow-md ${biomeBadge.color}`}>
              <span className="text-[10px] bg-white/10 px-1 py-0.5 rounded font-black">{biomeBadge.tag}</span>
              <span>{biomeBadge.name}</span>
            </div>

            {/* Next World Preview Swatch */}
            <div className="px-2.5 py-1.5 rounded-lg bg-black/75 backdrop-blur-md border border-slate-700 text-xs font-bold flex items-center space-x-1.5 shadow-md">
              <span className="text-[9px] text-slate-400 font-bold uppercase">NEXT:</span>
              <div className={`w-2.5 h-2.5 rounded-full ${nextThemeInfo.swatch} animate-pulse`} />
              <span className="text-slate-200">{nextThemeInfo.name}</span>
            </div>

            {stats.isGrinding && (
              <div className="px-2.5 py-1 rounded-lg bg-fuchsia-600/90 border border-fuchsia-300 text-white text-xs font-black tracking-wider shadow-lg shadow-fuchsia-500/40 animate-pulse flex items-center space-x-1">
                <Zap className="w-3.5 h-3.5 text-yellow-300" />
                <span>RAIL GRIND ACTIVE</span>
              </div>
            )}
          </div>

          {/* Core Metrics: Speed, Score, Shards, Distance */}
          <div className="flex items-center space-x-2 pointer-events-auto flex-wrap gap-y-1.5">
            {/* Speedometer */}
            <div className="px-3 py-1.5 rounded-lg bg-black/80 backdrop-blur-md border border-cyan-500/40 text-cyan-300 flex items-center space-x-2 shadow-md">
              <span className="text-[9px] text-cyan-500 font-bold uppercase tracking-wider">SPEED</span>
              <span className="text-base font-black font-mono tracking-tight text-cyan-100">
                {stats.speed} <span className="text-[10px] text-cyan-400 font-normal">KM/H</span>
              </span>
            </div>

            {/* Score & Multiplier */}
            <div className="px-3 py-1.5 rounded-lg bg-black/80 backdrop-blur-md border border-fuchsia-500/40 text-fuchsia-300 flex items-center space-x-2 shadow-md">
              <span className="text-[9px] text-fuchsia-500 font-bold uppercase tracking-wider">SCORE</span>
              <span className="text-base font-black font-mono tracking-tight text-white">
                {stats.score.toLocaleString()}
              </span>
              {stats.scoreMultiplier > 1 && (
                <span className="px-1.5 py-0.2 rounded bg-fuchsia-500 text-white text-[10px] font-black animate-pulse">
                  x{stats.scoreMultiplier}
                </span>
              )}
            </div>

            {/* High Score Trophy */}
            <div className="px-2.5 py-1.5 rounded-lg bg-black/70 backdrop-blur-md border border-amber-500/30 text-amber-300 flex items-center space-x-1.5 shadow-sm">
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-xs font-bold text-amber-200">
                {stats.highScore > 0 ? stats.highScore.toLocaleString() : '0'}
              </span>
            </div>

            {/* Data Shards Collected */}
            <div className="px-2.5 py-1.5 rounded-lg bg-black/70 backdrop-blur-md border border-cyan-500/30 text-cyan-300 flex items-center space-x-1.5 shadow-sm">
              <span className="text-xs">💎</span>
              <span className="text-xs font-bold text-cyan-100">
                {stats.dataShardsCollected || stats.windOrbsCollected || 0}
              </span>
            </div>

            {/* Distance */}
            <div className="px-2.5 py-1.5 rounded-lg bg-black/70 backdrop-blur-md border border-slate-700 text-slate-300 flex items-center space-x-1 shadow-sm">
              <span className="text-[10px] text-slate-500 font-bold">DST</span>
              <span className="text-xs font-bold font-mono text-slate-200">{stats.distance}M</span>
            </div>
          </div>

          {/* Active Cyber Power-Ups Strip */}
          <div className="flex items-center space-x-1.5 pointer-events-auto">
            {stats.activePowerUps?.magnetTimer > 0 && (
              <div className="px-2 py-0.5 rounded bg-red-600/90 border border-red-400 text-white text-[10px] font-bold flex items-center space-x-1 shadow-md animate-pulse">
                <span>🧲 QUANTUM MAGNET</span>
                <span className="bg-black/60 px-1 rounded font-mono">{Math.ceil(stats.activePowerUps.magnetTimer)}s</span>
              </div>
            )}
            {stats.activePowerUps?.jetpackTimer > 0 && (
              <div className="px-2 py-0.5 rounded bg-cyan-600/90 border border-cyan-400 text-white text-[10px] font-bold flex items-center space-x-1 shadow-md animate-bounce">
                <span>🚀 SONIC JETPACK</span>
                <span className="bg-black/60 px-1 rounded font-mono">{Math.ceil(stats.activePowerUps.jetpackTimer)}s</span>
              </div>
            )}
            {stats.activePowerUps?.multiplierTimer > 0 && (
              <div className="px-2 py-0.5 rounded bg-amber-600/90 border border-amber-400 text-white text-[10px] font-bold flex items-center space-x-1 shadow-md">
                <span>✨ 2X OVERDRIVE</span>
                <span className="bg-black/60 px-1 rounded font-mono">{Math.ceil(stats.activePowerUps.multiplierTimer)}s</span>
              </div>
            )}
            {stats.activePowerUps?.hoverboardShield && (
              <div className="px-2 py-0.5 rounded bg-emerald-600/90 border border-emerald-400 text-white text-[10px] font-bold flex items-center space-x-1 shadow-md">
                <span>🛡️ HOLO-SHIELD</span>
              </div>
            )}
          </div>
        </div>

        {/* Center: Overdrive Gauge & Trick Banner */}
        <div className="flex flex-col items-center max-w-xs sm:max-w-sm w-full px-2">
          {/* Active Trick / Combo Banner */}
          {stats.activeTrickName && (
            <div className={`mb-2 px-3.5 py-1 rounded-full border text-xs font-black backdrop-blur-md flex items-center space-x-2 transition-all ${getComboBadgeColor(stats.combo)}`}>
              <Zap className="w-3.5 h-3.5 animate-spin" />
              <span>{stats.activeTrickName}</span>
              {stats.combo > 1 && (
                <span className="px-1.5 py-0.2 rounded bg-black text-cyan-300 font-black text-[10px]">
                  {stats.combo}X COMBO
                </span>
              )}
            </div>
          )}

          {/* Glitch Notification Toast */}
          {notification && !stats.activeTrickName && (
            <div className="mb-2 px-3.5 py-1 rounded-md bg-black/90 border border-cyan-500/60 text-cyan-300 text-xs font-bold backdrop-blur-md shadow-lg shadow-cyan-950/40 animate-pulse">
              {notification}
            </div>
          )}

          {/* OVERDRIVE Segmented Tech Meter */}
          <div className="w-full pointer-events-auto bg-black/85 backdrop-blur-md border border-cyan-500/40 rounded-xl p-2 shadow-lg shadow-cyan-950/30">
            <div className="flex items-center justify-between text-xs mb-1 px-1">
              <div className="flex items-center space-x-1.5">
                <span className="text-cyan-400 font-bold text-[10px] tracking-wider">OVERDRIVE</span>
                <span className={`text-[9px] px-1.5 py-0.2 rounded font-black uppercase border ${getOverdriveTierColor(stats.overdriveTier || 'Charged')}`}>
                  {stats.overdriveTier || 'Charged'}
                </span>
              </div>
              <div className="font-mono text-cyan-200 text-xs font-black">
                {overdrivePercent}%
              </div>
            </div>

            {/* Segmented Neon Bar */}
            <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden p-0.5 border border-cyan-500/30">
              <div
                className={`h-full rounded-full transition-all duration-200 ${getOverdriveTierColor(stats.overdriveTier || 'Charged')}`}
                style={{ width: `${Math.max(4, overdrivePercent)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Right: Quick Cyber Controls Toolbar */}
        <div className="flex items-center space-x-1.5 pointer-events-auto">
          {/* Holo-Shield Deploy Button */}
          <button
            onClick={onActivateShield}
            className={`p-2 rounded-lg border backdrop-blur-md transition-all active:scale-95 ${
              stats.activePowerUps?.hoverboardShield
                ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 shadow-md shadow-emerald-500/20'
                : 'bg-black/60 border-slate-700 text-slate-400 hover:text-white'
            }`}
            title="Deploy Holo-Shield (Double-Tap Space)"
          >
            <Shield className="w-4 h-4" />
          </button>

          {/* Lighting Mode Selector */}
          <div className="relative group">
            <button
              className="p-2 rounded-lg bg-black/60 border border-slate-700 text-slate-300 hover:text-white backdrop-blur-md active:scale-95"
              title="Change Cyberpunk Lighting Mood"
            >
              <Radio className="w-4 h-4 text-cyan-400" />
            </button>
            <div className="absolute right-0 top-full mt-1.5 hidden group-hover:flex flex-col space-y-1 p-1.5 rounded-lg bg-black/95 border border-cyan-500/40 shadow-xl shadow-cyan-950/40 z-30 min-w-[140px]">
              {(['midnight-cyan', 'synthwave-magenta', 'toxic-matrix', 'solar-amber'] as LightingMode[]).map(mode => (
                <button
                  key={mode}
                  onClick={() => onSelectLighting(mode)}
                  className={`px-2.5 py-1 text-left text-[11px] font-bold rounded transition-all ${
                    lightingMode === mode
                      ? 'bg-cyan-500/20 border border-cyan-400 text-cyan-200'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {mode.toUpperCase().replace('-', ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Camera View Mode */}
          <button
            onClick={onToggleCam}
            className={`p-2 rounded-lg border backdrop-blur-md transition-all active:scale-95 ${
              isCinematicCam
                ? 'bg-fuchsia-500/20 border-fuchsia-400 text-fuchsia-300'
                : 'bg-black/60 border-slate-700 text-slate-400 hover:text-white'
            }`}
            title="Toggle Cinematic Fly Camera"
          >
            <Eye className="w-4 h-4" />
          </button>

          {/* Upright / Widescreen Cam */}
          {onToggleUpright && (
            <button
              onClick={onToggleUpright}
              className={`p-2 rounded-lg border backdrop-blur-md transition-all active:scale-95 ${
                isUpright
                  ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                  : 'bg-black/60 border-slate-700 text-slate-400 hover:text-white'
              }`}
              title="Toggle Upright Portrait / Wide Chase Cam"
            >
              {isUpright ? <Smartphone className="w-4 h-4" /> : <Monitor className="w-4 h-4" />}
            </button>
          )}

          {/* Mute Audio */}
          <button
            onClick={onToggleMute}
            className={`p-2 rounded-lg border backdrop-blur-md transition-all active:scale-95 ${
              isMuted
                ? 'bg-red-500/20 border-red-500 text-red-400'
                : 'bg-black/60 border-slate-700 text-slate-400 hover:text-white'
            }`}
            title={isMuted ? 'Unmute Synthwave Score' : 'Mute Audio'}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {/* Cosmetics Bay */}
          <button
            onClick={onOpenCosmetics}
            className="p-2 rounded-lg bg-black/60 border border-slate-700 text-slate-300 hover:text-cyan-300 backdrop-blur-md active:scale-95"
            title="Cyberpunk Hoverboard & Armor Bay"
          >
            <Palette className="w-4 h-4" />
          </button>

          {/* Graphics Settings */}
          <button
            onClick={onOpenGraphicsDrawer}
            className="p-2 rounded-lg bg-black/60 border border-slate-700 text-slate-300 hover:text-cyan-300 backdrop-blur-md active:scale-95"
            title="Graphics & Shaders Inspector"
          >
            <Sliders className="w-4 h-4" />
          </button>

          {/* Dev Debug Overlay Toggle */}
          <button
            onClick={() => setShowDevInspector(prev => !prev)}
            className={`p-2 rounded-lg border backdrop-blur-md transition-all active:scale-95 ${
              showDevInspector
                ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                : 'bg-black/60 border-slate-700 text-slate-400 hover:text-white'
            }`}
            title="Telemetry Debugger"
          >
            <Terminal className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Dev Inspector Mini-HUD */}
      {showDevInspector && (
        <div className="pointer-events-auto absolute top-20 right-5 p-3 rounded-lg bg-black/90 border border-cyan-500/40 text-[11px] text-cyan-300 backdrop-blur-md shadow-xl z-30 flex flex-col space-y-1">
          <div className="text-white font-bold border-b border-cyan-500/30 pb-1 mb-1">
            [TELEMETRY DIAGNOSTICS]
          </div>
          <div>FPS: <span className="font-bold text-white">{fps}</span></div>
          <div>DRAW CALLS: <span className="font-bold text-white">{drawCalls}</span></div>
          <div>INSTANCES: <span className="font-bold text-white">{instanceCount}</span></div>
          <div>ZONE: <span className="font-bold text-white">{stats.currentBiome.toUpperCase()}</span></div>
          <div>LANE: <span className="font-bold text-white">{stats.currentLane}</span></div>
          <div>GRINDING: <span className="font-bold text-white">{stats.isGrinding ? 'YES' : 'NO'}</span></div>
          <div>BOOSTING: <span className="font-bold text-white">{stats.isBoosting ? 'YES' : 'NO'}</span></div>
        </div>
      )}
    </div>
  );
};
