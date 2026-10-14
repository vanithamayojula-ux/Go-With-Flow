/**
 * GoWithFlow — Campaign Victory Modal
 * Celebrates 5-world campaign completion across Sky Isles, Verdant Wilds,
 * Crimson Dunes, Crystal Heights, and Obsidian Core.
 */

import React from 'react';
import { Trophy, Star, Sparkles, RotateCcw, ArrowRight, Home, Zap, ShieldCheck } from 'lucide-react';
import { PlayerStats } from '../types';
import { CampaignManager } from '../game/campaign/CampaignManager';
import { WORLD_CAMPAIGN_CONFIGS, CAMPAIGN_WORLD_ORDER } from '../game/campaign/campaignConfig';

interface CampaignVictoryModalProps {
  stats: PlayerStats;
  campaignMgr: CampaignManager;
  onReplayCampaign: () => void;
  onEnterEndless: () => void;
  onMainMenu: () => void;
}

export const CampaignVictoryModal: React.FC<CampaignVictoryModalProps> = ({
  stats,
  campaignMgr,
  onReplayCampaign,
  onEnterEndless,
  onMainMenu,
}) => {
  const totalStars = campaignMgr.getTotalStarsEarned();
  const shards = stats.dataShardsCollected || stats.windOrbsCollected || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-2xl animate-fade-in font-mono select-none">
      <div className="relative w-full max-w-lg bg-black/95 border-2 border-amber-400/70 rounded-3xl p-6 sm:p-8 shadow-[0_0_80px_rgba(251,191,36,0.35)] text-center overflow-hidden max-h-[92vh] overflow-y-auto">
        {/* Golden / Amber Glow Flares */}
        <div className="absolute -top-24 -left-24 w-52 h-52 rounded-full bg-amber-500/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-52 h-52 rounded-full bg-cyan-500/20 blur-3xl pointer-events-none" />

        {/* Crown / Trophy Badge */}
        <div className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-full border border-amber-400/50 bg-amber-950/60 text-amber-300 text-xs font-black tracking-widest uppercase mb-3 animate-pulse shadow-lg">
          <Sparkles className="w-4 h-4 text-amber-400 fill-amber-400" />
          <span>CAMPAIGN PROTOCOL ACCOMPLISHED</span>
          <Sparkles className="w-4 h-4 text-amber-400 fill-amber-400" />
        </div>

        <h1 className="text-3xl sm:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-100 to-cyan-300 uppercase tracking-tight mb-1">
          ALL 5 WORLDS CONQUERED
        </h1>
        <p className="text-xs text-white/60 mb-5">
          FULL FLIGHT ENVELOPE EXTRACTED // OBSIDIAN CORE HARVEST COMPLETE
        </p>

        {/* World Sector Recap Cards */}
        <div className="space-y-2 mb-5 text-left">
          {CAMPAIGN_WORLD_ORDER.map((wId) => {
            const cfg = WORLD_CAMPAIGN_CONFIGS[wId];
            const stars = campaignMgr.getSectorStars(wId);
            return (
              <div
                key={wId}
                className="p-2.5 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between hover:border-amber-400/40 transition-all"
              >
                <div className="flex items-center space-x-2.5">
                  <span className="w-6 h-6 rounded-lg bg-amber-950/80 border border-amber-400/40 text-amber-300 flex items-center justify-center text-xs font-black">
                    {cfg.sectorIndex}
                  </span>
                  <div>
                    <div className="text-xs font-black text-white">{cfg.name}</div>
                    <div className="text-[10px] text-white/50">{cfg.subtitle}</div>
                  </div>
                </div>

                {/* Star Rating */}
                <div className="flex items-center space-x-1">
                  {[1, 2, 3].map((starIdx) => (
                    <Star
                      key={starIdx}
                      className={`w-3.5 h-3.5 ${
                        starIdx <= stars
                          ? 'text-amber-400 fill-amber-400'
                          : 'text-white/20'
                      }`}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Campaign Stats Grid */}
        <div className="grid grid-cols-3 gap-2 mb-5">
          <div className="p-3 rounded-xl bg-slate-950/90 border border-amber-500/30 flex flex-col items-center justify-center">
            <span className="text-[10px] text-white/50 uppercase font-bold">TOTAL STARS</span>
            <span className="text-lg font-black text-amber-300">⭐ {totalStars} / 15</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/90 border border-cyan-500/30 flex flex-col items-center justify-center">
            <span className="text-[10px] text-white/50 uppercase font-bold">DISTANCE</span>
            <span className="text-lg font-black text-cyan-300">11,250m</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/90 border border-emerald-500/30 flex flex-col items-center justify-center">
            <span className="text-[10px] text-white/50 uppercase font-bold">BONUS SHARDS</span>
            <span className="text-lg font-black text-emerald-300">+500 💎</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2.5">
          {/* Enter Endless Mode */}
          <button
            onClick={onEnterEndless}
            className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-black font-black text-xs uppercase tracking-widest shadow-[0_0_30px_rgba(0,240,255,0.4)] hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center space-x-2 cursor-pointer"
          >
            <span>CONTINUE INTO ENDLESS MODE</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          {/* Replay Full Campaign */}
          <button
            onClick={onReplayCampaign}
            className="w-full py-3 px-4 rounded-xl bg-slate-900 border border-amber-500/40 text-amber-300 hover:text-white hover:bg-amber-950/40 font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center space-x-2 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>REPLAY CAMPAIGN (FROM SKY ISLES)</span>
          </button>

          {/* Return to Main Menu */}
          <button
            onClick={onMainMenu}
            className="w-full py-2.5 px-4 rounded-xl bg-white/5 border border-white/10 text-white/70 hover:text-white hover:bg-white/10 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center space-x-2"
          >
            <Home className="w-4 h-4" />
            <span>RETURN TO OPENING MENU</span>
          </button>
        </div>
      </div>
    </div>
  );
};
