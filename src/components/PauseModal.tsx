import React from 'react';
import { Play, RotateCcw, Palette, Sliders, Volume2, VolumeX, Shield, Trophy, Cpu, Radio, Zap } from 'lucide-react';
import { PlayerStats, SessionGoal } from '../types';

interface PauseModalProps {
  isOpen: boolean;
  onResume: () => void;
  onRestart: () => void;
  onOpenCosmetics: () => void;
  onOpenGraphics: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  stats: PlayerStats;
  missions?: SessionGoal[];
  onClaimMission?: (id: string) => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  isOpen,
  onResume,
  onRestart,
  onOpenCosmetics,
  onOpenGraphics,
  isMuted,
  onToggleMute,
  stats,
  missions = [],
  onClaimMission,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl animate-fade-in font-mono">
      <div className="relative w-full max-w-lg p-6 sm:p-8 bg-black/95 border-2 border-cyan-500/50 rounded-2xl shadow-[0_0_50px_rgba(0,240,255,0.25)] text-center overflow-hidden max-h-[90vh] overflow-y-auto">
        {/* Neon Glow Accents */}
        <div className="absolute -top-20 -right-20 w-44 h-44 rounded-full bg-cyan-500/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-44 h-44 rounded-full bg-fuchsia-500/20 blur-3xl pointer-events-none" />

        {/* Tech Header Status Tag */}
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded border border-cyan-500/50 bg-cyan-950/40 text-cyan-300 text-xs font-black mb-3 tracking-widest animate-pulse">
          <Zap className="w-3.5 h-3.5 text-cyan-400" />
          <span>// NEURAL LINK ON STANDBY</span>
        </div>

        <h2 className="text-3xl sm:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-fuchsia-400 to-amber-300 tracking-tight mb-1 uppercase">
          GAME PAUSED
        </h2>
        <p className="text-xs text-white/60 mb-5">
          TIME-WARP DILATION ACTIVE // CURRENT TELEMETRY SNAPSHOT
        </p>

        {/* Current Run Snapshot Card */}
        <div className="grid grid-cols-3 gap-2.5 mb-4 bg-slate-950/80 border border-cyan-500/30 rounded-xl p-3.5 shadow-inner">
          <div className="flex flex-col items-center">
            <span className="text-[10px] uppercase font-bold text-cyan-400">SCORE</span>
            <span className="text-lg font-black text-white">{stats.score.toLocaleString()}</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-[10px] uppercase font-bold text-fuchsia-400">SHARDS</span>
            <span className="text-lg font-black text-cyan-200">💎 {stats.dataShardsCollected || 0}</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-[10px] uppercase font-bold text-amber-400">DISTANCE</span>
            <span className="text-lg font-black text-amber-200">{stats.distance}m</span>
          </div>
        </div>

        {/* Daily Missions Panel */}
        {missions.length > 0 && (
          <div className="mb-4 text-left bg-slate-950/90 border border-cyan-500/20 rounded-xl p-3 space-y-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 flex items-center justify-between">
              <span className="flex items-center space-x-1.5">
                <Trophy className="w-3.5 h-3.5 text-amber-400" />
                <span>DAILY PROTOCOL MISSIONS</span>
              </span>
              <span className="text-white/40">RESET 00:00 UTC</span>
            </div>
            <div className="space-y-2">
              {missions.map((m) => {
                const pct = Math.min(100, Math.round((m.current / m.target) * 100));
                return (
                  <div key={m.id} className="p-2 rounded-lg bg-white/5 border border-white/5 flex items-center justify-between">
                    <div className="flex-1 pr-2">
                      <div className="text-xs font-bold text-white/90">{m.title}</div>
                      <div className="text-[10px] text-white/50">{m.desc}</div>
                      <div className="w-full bg-black/60 rounded-full h-1.5 mt-1.5 overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${m.completed ? 'bg-emerald-400' : 'bg-cyan-400'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-[10px] font-mono text-cyan-300">+{m.rewardShards} 💎</span>
                      {m.claimed ? (
                        <span className="text-[10px] text-emerald-400 font-bold mt-1">CLAIMED</span>
                      ) : m.completed ? (
                        <button
                          onClick={() => onClaimMission?.(m.id)}
                          className="mt-1 px-2 py-0.5 rounded bg-emerald-500 hover:bg-emerald-400 text-black text-[10px] font-black tracking-wider transition-all"
                        >
                          CLAIM
                        </button>
                      ) : (
                        <span className="text-[10px] text-white/40 font-mono mt-1">{m.current}/{m.target}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Action Buttons Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
          {/* Resume Button */}
          <button
            onClick={onResume}
            className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 text-black font-black text-xs uppercase tracking-widest shadow-[0_0_20px_rgba(0,240,255,0.4)] hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center space-x-2 col-span-1 sm:col-span-2"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>RESUME RUN (ESC / SPACE)</span>
          </button>

          {/* Loadout Bay */}
          <button
            onClick={onOpenCosmetics}
            className="py-3 px-4 rounded-xl bg-black/60 border border-slate-700 hover:border-cyan-400 text-slate-300 hover:text-cyan-300 font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center space-x-2 active:scale-95"
          >
            <Palette className="w-4 h-4 text-cyan-400" />
            <span>LOADOUT BAY</span>
          </button>

          {/* Graphics Settings */}
          <button
            onClick={onOpenGraphics}
            className="py-3 px-4 rounded-xl bg-black/60 border border-slate-700 hover:border-cyan-400 text-slate-300 hover:text-cyan-300 font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center space-x-2 active:scale-95"
          >
            <Sliders className="w-4 h-4 text-cyan-400" />
            <span>GRAPHICS & SHADERS</span>
          </button>

          {/* Mute Toggle */}
          <button
            onClick={onToggleMute}
            className="py-3 px-4 rounded-xl bg-black/60 border border-slate-700 hover:border-cyan-400 text-slate-300 hover:text-cyan-300 font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center space-x-2 active:scale-95"
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
            <span>{isMuted ? 'UNMUTE AUDIO' : 'MUTE AUDIO'}</span>
          </button>

          {/* Restart Run */}
          <button
            onClick={onRestart}
            className="py-3 px-4 rounded-xl bg-red-950/40 border border-red-500/50 hover:border-red-400 text-red-300 hover:text-white font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center space-x-2 active:scale-95"
          >
            <RotateCcw className="w-4 h-4 text-red-400" />
            <span>RESTART RUN</span>
          </button>
        </div>

        {/* Quick Keybind Guide */}
        <div className="pt-3 border-t border-cyan-500/20 text-[11px] text-white/50 flex items-center justify-center space-x-3 flex-wrap gap-y-1">
          <span><kbd className="px-1 py-0.5 rounded bg-white/10 text-white font-bold">A/D</kbd> Lanes</span>
          <span><kbd className="px-1 py-0.5 rounded bg-white/10 text-white font-bold">W/Space</kbd> Jump</span>
          <span><kbd className="px-1 py-0.5 rounded bg-white/10 text-white font-bold">S/Down</kbd> Slide</span>
          <span><kbd className="px-1 py-0.5 rounded bg-white/10 text-white font-bold">2x Space</kbd> Shield</span>
          <span><kbd className="px-1 py-0.5 rounded bg-white/10 text-white font-bold">1-4</kbd> Stunt Tricks</span>
        </div>
      </div>
    </div>
  );
};
