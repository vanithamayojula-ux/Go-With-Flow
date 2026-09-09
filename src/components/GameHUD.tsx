import React from 'react';
import { Volume2, VolumeX, Sliders, Eye, FileCode2, Wind, Sparkles, Palette, Compass, Zap, Smartphone, Monitor } from 'lucide-react';
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
  onOpenGraphicsDrawer,
  onOpenDeliverables,
  onOpenCosmetics,
  notification,
}) => {
  const getStyleTierColor = (tier: string) => {
    switch (tier) {
      case 'Transcendent':
        return 'from-pink-500 via-purple-400 to-rose-400 text-pink-200 border-pink-400/50 shadow-pink-500/30';
      case 'Flow':
        return 'from-amber-400 via-orange-400 to-yellow-300 text-amber-200 border-amber-400/50 shadow-amber-500/30';
      case 'Breeze':
        return 'from-emerald-400 via-teal-400 to-green-300 text-emerald-200 border-emerald-400/50 shadow-emerald-500/30';
      default:
        return 'from-cyan-400 via-sky-400 to-blue-400 text-cyan-200 border-cyan-400/50 shadow-cyan-500/30';
    }
  };

  const getBiomeBadge = (biome: BiomeType) => {
    switch (biome) {
      case 'dunes':
        return { name: 'Golden Dunes', color: 'text-amber-300 border-amber-400/40 bg-amber-500/20' };
      case 'sky-islands':
        return { name: 'Sky Islands', color: 'text-sky-300 border-sky-400/40 bg-sky-500/20' };
      case 'forest':
        return { name: 'Whisperwood Forest', color: 'text-lime-300 border-lime-400/40 bg-lime-500/20' };
      default:
        return { name: 'Meadow Plains', color: 'text-emerald-300 border-emerald-400/40 bg-emerald-500/20' };
    }
  };

  const biomeBadge = getBiomeBadge(stats.currentBiome);

  return (
    <div id="game-hud-root" className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-between p-3.5 sm:p-5 select-none">
      {/* Top Navigation & Status Bar */}
      <div className="flex items-start justify-between w-full">
        {/* Left: Branding, Biome & Core Stats */}
        <div className="flex flex-col space-y-2">
          {/* Title Badge & Current Biome */}
          <div className="flex items-center space-x-2 pointer-events-auto flex-wrap gap-y-1">
            <div className="flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-slate-900/80 backdrop-blur-md border border-white/15 text-white shadow-lg">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <div>
                <span className="font-bold tracking-tight text-sm text-sky-100">Skyflow</span>
                <span className="text-xs text-white/60 ml-1.5 hidden sm:inline">Endless Planet Surf</span>
              </div>
            </div>

            {/* Dynamic Biome Tag */}
            <div className={`px-2.5 py-1 rounded-full backdrop-blur-md border text-xs font-semibold flex items-center space-x-1.5 ${biomeBadge.color}`}>
              <Compass className="w-3.5 h-3.5" />
              <span>{biomeBadge.name}</span>
              <span className="text-[10px] opacity-75 font-mono">µ={stats.currentFriction.toFixed(2)}</span>
            </div>

            {/* Floating Island Tag */}
            {stats.isOnFloatingIsland && (
              <div className="px-2.5 py-1 rounded-full bg-sky-600/80 border border-sky-300/60 text-white text-[11px] font-bold shadow-md animate-pulse">
                ☁️ Floating Isle
              </div>
            )}
          </div>

          {/* Quick Metrics Bar */}
          <div className="flex items-center space-x-2 pointer-events-auto">
            {/* Speed */}
            <div className="px-3 py-1.5 rounded-xl bg-slate-900/70 backdrop-blur-md border border-white/10 text-white flex items-center space-x-2">
              <span className="text-[11px] text-white/50 uppercase font-mono">Speed</span>
              <span className="text-base font-black text-amber-300 font-mono">
                {Math.round(stats.speed * 3.6)}
              </span>
              <span className="text-[10px] text-white/40">km/h</span>
            </div>

            {/* Distance */}
            <div className="px-3 py-1.5 rounded-xl bg-slate-900/70 backdrop-blur-md border border-white/10 text-white flex items-center space-x-2">
              <span className="text-[11px] text-white/50 uppercase font-mono">Distance</span>
              <span className="text-base font-bold text-sky-200 font-mono">
                {stats.distance}m
              </span>
            </div>

            {/* Wind Orbs */}
            <div className="px-3 py-1.5 rounded-xl bg-slate-900/70 backdrop-blur-md border border-white/10 text-white flex items-center space-x-1.5">
              <Wind className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-sm font-bold text-emerald-300 font-mono">
                {stats.windOrbsCollected}
              </span>
            </div>
          </div>
        </div>

        {/* Center: Style Meter Bar, Trick Banner & Notification */}
        <div className="flex flex-col items-center max-w-xs sm:max-w-md w-full px-2">
          {/* Active Trick Banner & Combo */}
          {stats.activeTrickName && (
            <div className="mb-1.5 px-4 py-1 rounded-full bg-gradient-to-r from-sky-600/90 to-pink-600/90 text-white text-xs font-bold backdrop-blur-md border border-white/30 shadow-lg shadow-pink-500/25 flex items-center space-x-2 animate-pulse">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>{stats.activeTrickName}</span>
              {stats.combo > 1 && (
                <span className="px-1.5 py-0.2 rounded bg-amber-400 text-slate-950 font-black text-[10px]">
                  x{stats.combo}
                </span>
              )}
            </div>
          )}

          {/* Notification Toast */}
          {notification && !stats.activeTrickName && (
            <div className="mb-1.5 px-4 py-1 rounded-full bg-emerald-500/90 text-white text-xs font-semibold backdrop-blur-md shadow-lg shadow-emerald-500/20">
              {notification}
            </div>
          )}

          {/* Style Meter Pill */}
          <div className="w-full pointer-events-auto bg-slate-950/75 backdrop-blur-md border border-white/15 rounded-2xl p-2.5 shadow-xl">
            <div className="flex items-center justify-between text-xs mb-1 px-1">
              <div className="flex items-center space-x-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span className="text-white/70 font-medium">Style Flow:</span>
                <span className={`font-bold uppercase tracking-wider text-[11px] px-1.5 py-0.5 rounded border ${getStyleTierColor(stats.styleTier)}`}>
                  {stats.styleTier}
                </span>
              </div>
              <div className="font-mono text-white/90 text-xs font-bold">
                {Math.round(stats.styleMeter)}%
              </div>
            </div>

            {/* Animated Gradient Bar */}
            <div className="w-full h-2.5 bg-black/40 rounded-full overflow-hidden p-0.5 border border-white/10">
              <div
                className={`h-full rounded-full transition-all duration-300 bg-gradient-to-r ${getStyleTierColor(stats.styleTier)}`}
                style={{ width: `${Math.max(4, stats.styleMeter)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Right: Quick Action Controls & Inspector Triggers */}
        <div className="flex flex-col items-end space-y-2 pointer-events-auto">
          <div className="flex items-center space-x-2">
            {/* Audio Toggle */}
            <button
              id="btn-hud-audio"
              onClick={onToggleMute}
              className={`p-2.5 rounded-xl backdrop-blur-md border transition-all text-white shadow-md ${
                isMuted
                  ? 'bg-red-950/60 border-red-400/30 text-red-300 hover:bg-red-900/80'
                  : 'bg-slate-900/70 border-white/15 hover:bg-slate-800'
              }`}
              title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            {/* Upright (Portrait) / Widescreen Orientation Toggle */}
            {onToggleUpright && (
              <button
                id="btn-hud-orientation"
                onClick={onToggleUpright}
                className={`p-2.5 rounded-xl backdrop-blur-md border transition-all text-white shadow-md flex items-center space-x-1.5 ${
                  isUpright
                    ? 'bg-emerald-950/70 border-emerald-400/50 text-emerald-300'
                    : 'bg-slate-900/70 border-white/15 hover:bg-slate-800 text-sky-200'
                }`}
                title={isUpright ? 'Switch to Widescreen View' : 'Switch to Upright (Portrait) View'}
              >
                {isUpright ? <Smartphone className="w-4 h-4" /> : <Monitor className="w-4 h-4" />}
                <span className="text-xs font-semibold hidden sm:inline">{isUpright ? 'Upright' : 'Wide'}</span>
              </button>
            )}

            {/* Camera View Switcher */}
            <button
              id="btn-hud-cam"
              onClick={onToggleCam}
              className={`p-2.5 rounded-xl backdrop-blur-md border transition-all text-white shadow-md ${
                isCinematicCam
                  ? 'bg-amber-950/70 border-amber-400/40 text-amber-300'
                  : 'bg-slate-900/70 border-white/15 hover:bg-slate-800'
              }`}
              title="Toggle Surfer / Cinematic Fly Cam"
            >
              <Eye className="w-4 h-4" />
            </button>

            {/* Cosmetics Customizer Trigger */}
            <button
              id="btn-hud-cosmetics"
              onClick={onOpenCosmetics}
              className="px-3 py-2 rounded-xl bg-slate-900/75 backdrop-blur-md border border-white/15 text-white hover:bg-slate-800 flex items-center space-x-1.5 shadow-md text-xs font-semibold"
              title="Open Voyager Equipment & Cosmetics"
            >
              <Palette className="w-4 h-4 text-pink-300" />
              <span className="hidden sm:inline">Boards & Gear</span>
            </button>

            {/* Graphics Settings Drawer Trigger */}
            <button
              id="btn-hud-graphics"
              onClick={onOpenGraphicsDrawer}
              className="px-3 py-2 rounded-xl bg-slate-900/75 backdrop-blur-md border border-white/15 text-white hover:bg-slate-800 flex items-center space-x-1.5 shadow-md text-xs font-semibold"
              title="Open Graphics & Shaders Settings"
            >
              <Sliders className="w-4 h-4 text-sky-400" />
              <span className="hidden sm:inline">Graphics</span>
            </button>

            {/* Art Asset Deliverables Modal Trigger */}
            <button
              id="btn-hud-deliverables"
              onClick={onOpenDeliverables}
              className="px-3 py-2 rounded-xl bg-gradient-to-r from-emerald-600/80 to-teal-600/80 backdrop-blur-md border border-emerald-300/40 text-white hover:brightness-110 flex items-center space-x-1.5 shadow-md text-xs font-semibold"
              title="Open Art Asset & Shader Deliverables"
            >
              <FileCode2 className="w-4 h-4 text-emerald-200" />
              <span className="hidden md:inline">Art & Shaders</span>
            </button>
          </div>

          {/* Real-time Diagnostics Tag */}
          <div className="flex items-center space-x-2 px-2.5 py-1 rounded-lg bg-black/40 backdrop-blur-md border border-white/10 text-[10px] font-mono text-white/70">
            <span className={fps >= 55 ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
              {fps} FPS
            </span>
            <span className="text-white/25">|</span>
            <span>{drawCalls} calls</span>
            <span className="text-white/25">|</span>
            <span>{instanceCount} foliage</span>
          </div>

          {/* Quick Lighting Preset Buttons */}
          <div className="hidden lg:flex items-center space-x-1 bg-slate-950/70 backdrop-blur-md border border-white/10 p-1 rounded-xl text-[11px]">
            {(['morning', 'golden-hour', 'bright-day'] as LightingMode[]).map(mode => (
              <button
                key={mode}
                onClick={() => onSelectLighting(mode)}
                className={`px-2 py-0.5 rounded-lg capitalize transition-all ${
                  lightingMode === mode
                    ? 'bg-white/20 text-white font-bold border border-white/20'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                {mode.replace('-', ' ')}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom spacer for ControlsOverlay */}
      <div />
    </div>
  );
};

