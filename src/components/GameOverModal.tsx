import React from 'react';
import { RotateCcw, Zap, Trophy, Cpu, ShieldAlert, Radio, ShoppingBag, Coins } from 'lucide-react';
import { PlayerStats, SessionGoal } from '../types';

interface GameOverModalProps {
  stats: PlayerStats;
  bankedShards?: number;
  missions?: SessionGoal[];
  onClaimMission?: (id: string) => void;
  onRestart: () => void;
  onRevive: () => void;
  onOpenShop?: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  stats,
  bankedShards = 0,
  missions = [],
  onClaimMission,
  onRestart,
  onRevive,
  onOpenShop,
}) => {
  const isNewHighScore = stats.score >= stats.highScore && stats.score > 0;
  const runShards = stats.dataShardsCollected || stats.windOrbsCollected || 0;
  const totalAvailableShards = Math.max(bankedShards, runShards);
  const canRevive = totalAvailableShards >= 15;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl animate-fade-in font-mono">
      <div className="relative w-full max-w-md p-6 sm:p-8 bg-black/95 border-2 border-cyan-500/50 rounded-2xl shadow-[0_0_50px_rgba(0,240,255,0.25)] text-center overflow-hidden max-h-[90vh] overflow-y-auto">
        {/* Neon Glow Accents */}
        <div className="absolute -top-20 -right-20 w-44 h-44 rounded-full bg-pink-500/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-44 h-44 rounded-full bg-cyan-500/20 blur-3xl pointer-events-none" />

        {/* Tech Header Status Tag */}
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded border border-red-500/50 bg-red-950/40 text-red-400 text-xs font-black mb-3 tracking-widest animate-pulse">
          <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
          <span>// NEURAL DESYNC DETECTED</span>
        </div>

        <h2 className="text-3xl sm:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-pink-400 to-amber-300 tracking-tight mb-1 uppercase">
          SYSTEM CRASH
        </h2>
        <p className="text-xs text-white/60 mb-5">
          PHYSICAL IMPACT COLLISION // TELEMETRY LINK SEVERED
        </p>

        {/* Score Showcase Terminal Card */}
        <div className="bg-slate-950/90 border border-cyan-500/30 rounded-xl p-4 sm:p-5 mb-4 shadow-inner">
          <div className="text-[10px] uppercase tracking-widest text-cyan-400 font-bold mb-1">
            SYNC DATA HARVESTED
          </div>
          <div className="text-4xl sm:text-5xl font-black text-white font-mono tracking-tight text-shadow-[0_0_15px_rgba(0,240,255,0.6)]">
            {stats.score.toLocaleString()}
          </div>

          {/* High Score Badge */}
          <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-center space-x-2">
            <Trophy className={`w-4 h-4 ${isNewHighScore ? 'text-amber-400 animate-bounce' : 'text-cyan-400'}`} />
            <span className="text-xs font-bold text-white/80">
              {isNewHighScore ? '⚡ NEW RECORD TELEMETRY!' : `BEST: ${stats.highScore.toLocaleString()}`}
            </span>
          </div>
        </div>

        {/* Detailed Run Stats Grid */}
        <div className="grid grid-cols-2 gap-2.5 mb-3">
          {/* Data Shards Harvested this run */}
          <div className="flex flex-col items-center justify-center p-3 rounded-xl bg-slate-950/80 border border-cyan-500/30">
            <div className="flex items-center space-x-1.5 text-cyan-400 mb-1">
              <Cpu className="w-3.5 h-3.5" />
              <span className="text-[10px] font-bold uppercase tracking-wider">RUN SHARDS</span>
            </div>
            <span className="text-xl font-black text-cyan-200">
              +{runShards}
            </span>
          </div>

          {/* Distance Traveled */}
          <div className="flex flex-col items-center justify-center p-3 rounded-xl bg-slate-950/80 border border-pink-500/30">
            <div className="flex items-center space-x-1.5 text-pink-400 mb-1">
              <Radio className="w-3.5 h-3.5" />
              <span className="text-[10px] font-bold uppercase tracking-wider">DISTANCE</span>
            </div>
            <span className="text-xl font-black text-pink-200">
              {stats.distance}m
            </span>
          </div>
        </div>

        {/* Daily Missions Panel */}
        {missions.length > 0 && (
          <div className="mb-3 text-left bg-slate-950/90 border border-cyan-500/20 rounded-xl p-3 space-y-2">
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

        {/* Banked Shards Wallet Status Banner */}
        <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-cyan-950/40 border border-cyan-400/40 text-cyan-300 text-xs font-bold mb-4">
          <div className="flex items-center space-x-2">
            <Coins className="w-4 h-4 text-cyan-300" />
            <span className="text-[11px] uppercase tracking-wider">TOTAL BANK WALLET:</span>
          </div>
          <span className="text-sm font-black text-white font-mono">
            {bankedShards.toLocaleString()} SHARDS
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col space-y-2.5">
          {/* Emergency Reboot */}
          {canRevive && (
            <button
              onClick={onRevive}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-black font-black text-xs uppercase tracking-widest shadow-[0_0_20px_rgba(0,255,102,0.4)] hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center space-x-2"
            >
              <Zap className="w-4 h-4 fill-current" />
              <span>EMERGENCY REBOOT (-15 SHARDS)</span>
            </button>
          )}

          {/* Reboot Run Button */}
          <button
            onClick={onRestart}
            className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-black font-black text-xs uppercase tracking-widest shadow-[0_0_20px_rgba(0,240,255,0.4)] hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center space-x-2"
          >
            <RotateCcw className="w-4 h-4" />
            <span>REBOOT NEURAL LINK (RELAUNCH)</span>
          </button>

          {/* Open Cyber Shop & Upgrades */}
          {onOpenShop && (
            <button
              onClick={onOpenShop}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-900/90 border border-cyan-500/40 text-cyan-300 hover:text-white hover:bg-cyan-950/50 font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center space-x-2"
            >
              <ShoppingBag className="w-4 h-4 text-cyan-400" />
              <span>UPGRADES & LOADOUT BAY</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
