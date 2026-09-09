import React, { useState } from 'react';
import { Volume2, VolumeX, Sliders, Eye, FileCode2, Wind, Sparkles, Palette, Compass, Smartphone, Monitor, Code, Shield } from 'lucide-react';
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

  const getStyleTierColor = (tier: string) => {
    switch (tier) {
      case 'Transcendent':
        return 'bg-gradient-to-r from-amber-400 via-rose-400 to-pink-400 text-amber-950 border-amber-300 shadow-amber-300/40';
      case 'Flow':
        return 'bg-gradient-to-r from-amber-300 to-yellow-400 text-amber-950 border-amber-400/50 shadow-amber-400/30';
      case 'Breeze':
        return 'bg-gradient-to-r from-emerald-300 to-teal-400 text-emerald-950 border-emerald-400/50 shadow-emerald-400/30';
      default:
        return 'bg-gradient-to-r from-amber-100 to-orange-200 text-amber-900 border-amber-300/50 shadow-amber-300/20';
    }
  };

  const getBiomeBadge = (biome: BiomeType) => {
    switch (biome) {
      case 'dunes':
        return { name: 'Golden Sand Dunes', icon: '🌾' };
      case 'sky-islands':
        return { name: 'Ethereal Sky Islands', icon: '☁️' };
      case 'forest':
        return { name: 'Whisperwood Forest', icon: '🌲' };
      default:
        return { name: 'Verdant Meadow Plains', icon: '🍃' };
    }
  };

  const biomeBadge = getBiomeBadge(stats.currentBiome);

  return (
    <div id="game-hud-root" className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-between p-3.5 sm:p-5 select-none font-serif">
      {/* Top Navigation & Status Bar */}
      <div className="flex items-start justify-between w-full">
        {/* Left: Diegetic Parchment Branding & Journey Metrics */}
        <div className="flex flex-col space-y-2">
          {/* Title Stamp & Biome Tag */}
          <div className="flex items-center space-x-2 pointer-events-auto flex-wrap gap-y-1.5">
            <div className="flex items-center space-x-2.5 px-4 py-2 rounded-2xl bg-[#FFFDF5]/90 backdrop-blur-md border border-[#D97706]/35 text-[#78350F] shadow-lg shadow-amber-900/10">
              <div className="w-2.5 h-2.5 rounded-full bg-[#D97706] animate-pulse" />
              <div>
                <span className="font-bold tracking-wide text-base text-[#78350F]">Skyflow</span>
                <span className="text-xs text-[#B45309] ml-1.5 font-sans font-medium hidden sm:inline">Endless Surf</span>
              </div>
            </div>

            {/* Diegetic Biome Parchment Tag */}
            <div className="px-3.5 py-1.5 rounded-full bg-[#FFFDF5]/85 backdrop-blur-md border border-[#D97706]/30 text-[#92400E] text-xs font-semibold flex items-center space-x-1.5 shadow-md shadow-amber-950/5">
              <span>{biomeBadge.icon}</span>
              <span>{biomeBadge.name}</span>
            </div>

            {/* Floating Island Banner */}
            {stats.isOnFloatingIsland && (
              <div className="px-3 py-1 rounded-full bg-[#FEF3C7]/90 border border-[#F59E0B] text-[#78350F] text-xs font-bold shadow-md animate-bounce">
                ☁️ Floating Isle
              </div>
            )}
          </div>

          {/* Subway Surfers In-World Metrics Bar */}
          <div className="flex items-center space-x-2 pointer-events-auto flex-wrap gap-y-1.5">
            {/* Score & Multiplier Badge */}
            <div className="px-3.5 py-1.5 rounded-xl bg-[#FFFDF5]/95 backdrop-blur-md border border-[#D97706]/35 text-[#78350F] flex items-center space-x-2 shadow-md">
              <span className="text-[10px] text-[#B45309] uppercase font-sans font-bold">Score</span>
              <span className="text-lg font-black text-[#92400E] font-mono tracking-tight">
                {stats.score.toLocaleString()}
              </span>
              {stats.scoreMultiplier > 1 && (
                <span className="px-1.5 py-0.5 rounded-md bg-[#F59E0B] text-white text-[10px] font-black tracking-wider animate-pulse">
                  x{stats.scoreMultiplier}
                </span>
              )}
            </div>

            {/* High Score Trophy */}
            <div className="px-3 py-1.5 rounded-xl bg-[#FFFDF5]/90 backdrop-blur-md border border-[#D97706]/25 text-[#78350F] flex items-center space-x-1.5 shadow-sm">
              <Trophy className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-xs font-bold text-[#92400E] font-mono">
                {stats.highScore > 0 ? stats.highScore.toLocaleString() : '0'}
              </span>
            </div>

            {/* Wind Orbs / Coins Collected */}
            <div className="px-3 py-1.5 rounded-xl bg-[#FFFDF5]/90 backdrop-blur-md border border-[#D97706]/25 text-[#78350F] flex items-center space-x-1.5 shadow-sm">
              <Wind className="w-4 h-4 text-[#D97706]" />
              <span className="text-sm font-bold text-[#78350F] font-mono">
                {stats.windOrbsCollected}
              </span>
            </div>

            {/* Distance Badge */}
            <div className="px-3 py-1.5 rounded-xl bg-[#FFFDF5]/85 backdrop-blur-md border border-[#D97706]/20 text-[#78350F] flex items-center space-x-1.5 shadow-sm">
              <span className="text-xs">🧭</span>
              <span className="text-xs font-bold text-[#92400E] font-mono">
                {stats.distance}m
              </span>
            </div>
          </div>

          {/* Active Subway Surfers Power-Ups Strip */}
          <div className="flex items-center space-x-1.5 pointer-events-auto">
            {stats.activePowerUps.magnetTimer > 0 && (
              <div className="px-2.5 py-1 rounded-lg bg-red-500/90 text-white text-[11px] font-bold flex items-center space-x-1 shadow-md animate-pulse">
                <span>🧲 Magnet</span>
                <span className="font-mono text-[10px] bg-red-700/80 px-1 rounded">
                  {Math.ceil(stats.activePowerUps.magnetTimer)}s
                </span>
              </div>
            )}
            {stats.activePowerUps.jetpackTimer > 0 && (
              <div className="px-2.5 py-1 rounded-lg bg-cyan-500/90 text-white text-[11px] font-bold flex items-center space-x-1 shadow-md animate-bounce">
                <span>🚀 Jetpack</span>
                <span className="font-mono text-[10px] bg-cyan-700/80 px-1 rounded">
                  {Math.ceil(stats.activePowerUps.jetpackTimer)}s
                </span>
              </div>
            )}
            {stats.activePowerUps.multiplierTimer > 0 && (
              <div className="px-2.5 py-1 rounded-lg bg-amber-500/90 text-white text-[11px] font-bold flex items-center space-x-1 shadow-md">
                <span>✨ 2x Multiplier</span>
                <span className="font-mono text-[10px] bg-amber-700/80 px-1 rounded">
                  {Math.ceil(stats.activePowerUps.multiplierTimer)}s
                </span>
              </div>
            )}
            {stats.activePowerUps.hoverboardShield && (
              <div className="px-2.5 py-1 rounded-lg bg-emerald-500/90 text-white text-[11px] font-bold flex items-center space-x-1 shadow-md">
                <span>🛡️ Shield Active</span>
              </div>
            )}
          </div>
        </div>

        {/* Center: Style Flow Parchment Pill & Trick Banner */}
        <div className="flex flex-col items-center max-w-xs sm:max-w-md w-full px-2">
          {/* Active Trick Banner */}
          {stats.activeTrickName && (
            <div className="mb-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-[#F59E0B] to-[#D97706] text-white text-xs font-bold backdrop-blur-md border border-amber-200/50 shadow-lg shadow-amber-900/20 flex items-center space-x-2 animate-pulse">
              <Sparkles className="w-4 h-4 text-yellow-200" />
              <span>{stats.activeTrickName}</span>
              {stats.combo > 1 && (
                <span className="px-1.5 py-0.2 rounded bg-white text-[#78350F] font-black text-[10px]">
                  x{stats.combo}
                </span>
              )}
            </div>
          )}

          {/* Notification Toast */}
          {notification && !stats.activeTrickName && (
            <div className="mb-2 px-4 py-1.5 rounded-full bg-[#FFFDF5]/95 border border-[#D97706]/40 text-[#78350F] text-xs font-semibold backdrop-blur-md shadow-lg shadow-amber-900/10">
              {notification}
            </div>
          )}

          {/* Style Flow Parchment Bar */}
          <div className="w-full pointer-events-auto bg-[#FFFDF5]/90 backdrop-blur-md border border-[#D97706]/35 rounded-2xl p-2.5 shadow-lg shadow-amber-950/10">
            <div className="flex items-center justify-between text-xs mb-1.5 px-1">
              <div className="flex items-center space-x-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#D97706]" />
                <span className="text-[#92400E] font-semibold">Spirit Flow:</span>
                <span className={`font-bold uppercase tracking-wider text-[10px] px-2 py-0.5 rounded-md border ${getStyleTierColor(stats.styleTier)}`}>
                  {stats.styleTier}
                </span>
              </div>
              <div className="font-mono text-[#78350F] text-xs font-bold">
                {Math.round(stats.styleMeter)}%
              </div>
            </div>

            {/* Soft Warm Progress Bar */}
            <div className="w-full h-2.5 bg-[#FEF3C7] rounded-full overflow-hidden p-0.5 border border-[#F59E0B]/30">
              <div
                className={`h-full rounded-full transition-all duration-300 ${getStyleTierColor(stats.styleTier)}`}
                style={{ width: `${Math.max(4, stats.styleMeter)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Right: Soft Parchment Controls & Dev Inspector Toggle */}
        <div className="flex flex-col items-end space-y-2 pointer-events-auto">
          <div className="flex items-center space-x-2">
            {/* Audio Toggle */}
            <button
              id="btn-hud-audio"
              onClick={onToggleMute}
              className={`p-2.5 rounded-xl backdrop-blur-md border transition-all shadow-md ${
                isMuted
                  ? 'bg-rose-100/90 border-rose-300 text-rose-800 hover:bg-rose-200'
                  : 'bg-[#FFFDF5]/90 border-[#D97706]/35 text-[#78350F] hover:bg-[#FEF3C7]'
              }`}
              title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            {/* Upright (Portrait) / Wide Orientation Toggle */}
            {onToggleUpright && (
              <button
                id="btn-hud-orientation"
                onClick={onToggleUpright}
                className={`p-2.5 rounded-xl backdrop-blur-md border transition-all shadow-md flex items-center space-x-1.5 ${
                  isUpright
                    ? 'bg-[#FEF3C7] border-[#F59E0B] text-[#78350F]'
                    : 'bg-[#FFFDF5]/90 border-[#D97706]/35 text-[#92400E] hover:bg-[#FEF3C7]'
                }`}
                title={isUpright ? 'Switch to Widescreen View' : 'Switch to Upright (Portrait) View'}
              >
                {isUpright ? <Smartphone className="w-4 h-4" /> : <Monitor className="w-4 h-4" />}
                <span className="text-xs font-semibold hidden sm:inline">{isUpright ? 'Upright' : 'Wide'}</span>
              </button>
            )}

            {/* Cinematic Camera View Switcher */}
            <button
              id="btn-hud-cam"
              onClick={onToggleCam}
              className={`p-2.5 rounded-xl backdrop-blur-md border transition-all shadow-md ${
                isCinematicCam
                  ? 'bg-[#FEF3C7] border-[#F59E0B] text-[#78350F]'
                  : 'bg-[#FFFDF5]/90 border-[#D97706]/35 text-[#92400E] hover:bg-[#FEF3C7]'
              }`}
              title="Toggle Surfer / Cinematic Fly Cam"
            >
              <Eye className="w-4 h-4" />
            </button>

            {/* Hoverboard Shield Trigger (Subway Surfers double tap / shield) */}
            {onActivateShield && (
              <button
                id="btn-hud-shield"
                onClick={onActivateShield}
                className={`p-2.5 rounded-xl backdrop-blur-md border transition-all shadow-md flex items-center space-x-1 ${
                  stats.activePowerUps.hoverboardShield
                    ? 'bg-emerald-100 border-emerald-400 text-emerald-800 animate-pulse'
                    : 'bg-[#FFFDF5]/90 border-[#D97706]/35 text-[#78350F] hover:bg-[#FEF3C7]'
                }`}
                title="Activate Hoverboard Shield (Protects against 1 collision)"
              >
                <Shield className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-semibold hidden sm:inline">Shield</span>
              </button>
            )}

            {/* Equipment & Cosmetics Trigger */}
            <button
              id="btn-hud-cosmetics"
              onClick={onOpenCosmetics}
              className="px-3 py-2 rounded-xl bg-[#FFFDF5]/90 backdrop-blur-md border border-[#D97706]/35 text-[#78350F] hover:bg-[#FEF3C7] flex items-center space-x-1.5 shadow-md text-xs font-semibold"
              title="Open Voyager Equipment & Cosmetics"
            >
              <Palette className="w-4 h-4 text-[#D97706]" />
              <span className="hidden sm:inline">Boards & Gear</span>
            </button>

            {/* Graphics Settings Trigger */}
            <button
              id="btn-hud-graphics"
              onClick={onOpenGraphicsDrawer}
              className="px-3 py-2 rounded-xl bg-[#FFFDF5]/90 backdrop-blur-md border border-[#D97706]/35 text-[#78350F] hover:bg-[#FEF3C7] flex items-center space-x-1.5 shadow-md text-xs font-semibold"
              title="Open Graphics & Shaders Settings"
            >
              <Sliders className="w-4 h-4 text-[#D97706]" />
              <span className="hidden sm:inline">Graphics</span>
            </button>

            {/* Art Deliverables Trigger */}
            <button
              id="btn-hud-deliverables"
              onClick={onOpenDeliverables}
              className="px-3 py-2 rounded-xl bg-gradient-to-r from-[#F59E0B] to-[#D97706] text-white hover:brightness-105 flex items-center space-x-1.5 shadow-md text-xs font-semibold"
              title="Open Art Asset & Shader Deliverables"
            >
              <FileCode2 className="w-4 h-4 text-yellow-100" />
              <span className="hidden md:inline">Art Assets</span>
            </button>

            {/* Hidden Dev Inspector Toggle */}
            <button
              onClick={() => setShowDevInspector(!showDevInspector)}
              className={`p-2 rounded-xl backdrop-blur-md border transition-all text-xs ${
                showDevInspector
                  ? 'bg-slate-900 text-emerald-400 border-emerald-400/40'
                  : 'bg-[#FFFDF5]/60 border-[#D97706]/20 text-[#B45309] hover:bg-[#FEF3C7]'
              }`}
              title="Toggle Dev Inspector Readouts"
            >
              <Code className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Dev-Only Diagnostics Readout (Hidden by default!) */}
          {showDevInspector && (
            <div className="flex items-center space-x-2 px-2.5 py-1 rounded-lg bg-slate-950/90 backdrop-blur-md border border-emerald-400/40 text-[10px] font-mono text-white/80 shadow-xl">
              <span className={fps >= 55 ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                {fps} FPS
              </span>
              <span className="text-white/30">|</span>
              <span>{drawCalls} calls</span>
              <span className="text-white/30">|</span>
              <span>{instanceCount} foliage</span>
              <span className="text-white/30">|</span>
              <span>µ={stats.currentFriction.toFixed(2)}</span>
            </div>
          )}

          {/* Quick Lighting Presets */}
          <div className="hidden lg:flex items-center space-x-1 bg-[#FFFDF5]/90 backdrop-blur-md border border-[#D97706]/30 p-1 rounded-xl text-[11px]">
            {(['morning', 'golden-hour', 'bright-day'] as LightingMode[]).map(mode => (
              <button
                key={mode}
                onClick={() => onSelectLighting(mode)}
                className={`px-2.5 py-0.5 rounded-lg capitalize transition-all ${
                  lightingMode === mode
                    ? 'bg-[#F59E0B] text-white font-bold shadow-sm'
                    : 'text-[#78350F] hover:bg-[#FEF3C7]'
                }`}
              >
                {mode.replace('-', ' ')}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Spacer */}
      <div />
    </div>
  );
};
