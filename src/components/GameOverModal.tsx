import React from 'react';
import { RotateCcw, Sparkles, Trophy, Wind, HeartHandshake } from 'lucide-react';
import { PlayerStats } from '../types';

interface GameOverModalProps {
  stats: PlayerStats;
  onRestart: () => void;
  onRevive: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  stats,
  onRestart,
  onRevive,
}) => {
  const isNewHighScore = stats.score >= stats.highScore && stats.score > 0;
  const canRevive = stats.windOrbsCollected >= 15;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-md animate-fade-in font-serif">
      <div className="relative w-full max-w-md p-6 sm:p-8 bg-[#FFFDF5] border-2 border-[#D97706]/40 rounded-3xl shadow-2xl shadow-amber-950/40 text-center overflow-hidden">
        {/* Soft Ghibli Parchment Texture Background Accents */}
        <div className="absolute -top-16 -right-16 w-36 h-36 rounded-full bg-[#F59E0B]/15 blur-2xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-36 h-36 rounded-full bg-[#10B981]/15 blur-2xl pointer-events-none" />

        {/* Header Ribbon */}
        <div className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-amber-100 to-amber-200 border border-amber-300/60 text-[#78350F] text-xs font-semibold mb-3 shadow-sm">
          <Sparkles className="w-3.5 h-3.5 text-[#D97706]" />
          <span>Journey's Respite</span>
        </div>

        <h2 className="text-3xl sm:text-4xl font-extrabold text-[#78350F] tracking-tight mb-1">
          Wipeout!
        </h2>
        <p className="text-sm text-[#92400E]/80 font-sans mb-6">
          The wind gently carries your spirit back to the sanctuary.
        </p>

        {/* Score Showcase Card */}
        <div className="bg-gradient-to-b from-[#FFFBEB] to-[#FEF3C7] border border-[#F59E0B]/30 rounded-2xl p-4 sm:p-5 mb-5 shadow-inner">
          <div className="text-xs uppercase font-sans tracking-wider text-[#B45309] font-bold mb-1">
            Final Score
          </div>
          <div className="text-4xl sm:text-5xl font-extrabold text-[#92400E] font-mono tracking-tight">
            {stats.score.toLocaleString()}
          </div>

          {/* High Score Badge */}
          <div className="mt-3 pt-3 border-t border-[#D97706]/20 flex items-center justify-center space-x-2">
            <Trophy className={`w-4 h-4 ${isNewHighScore ? 'text-amber-500 animate-bounce' : 'text-amber-600'}`} />
            <span className="text-xs font-sans font-semibold text-[#78350F]">
              {isNewHighScore ? '✨ New High Score Record!' : `Best: ${stats.highScore.toLocaleString()}`}
            </span>
          </div>
        </div>

        {/* Detailed Run Stats Grid */}
        <div className="grid grid-cols-2 gap-3 mb-6 font-sans">
          {/* Orbs Collected */}
          <div className="flex flex-col items-center justify-center p-3 rounded-xl bg-[#FFFDF5] border border-[#D97706]/20 shadow-sm">
            <div className="flex items-center space-x-1.5 text-[#D97706] mb-1">
              <Wind className="w-4 h-4" />
              <span className="text-xs font-semibold uppercase">Wind Orbs</span>
            </div>
            <span className="text-xl font-bold text-[#78350F] font-mono">
              +{stats.windOrbsCollected}
            </span>
          </div>

          {/* Distance Traveled */}
          <div className="flex flex-col items-center justify-center p-3 rounded-xl bg-[#FFFDF5] border border-[#D97706]/20 shadow-sm">
            <div className="flex items-center space-x-1.5 text-[#D97706] mb-1">
              <span className="text-sm">🧭</span>
              <span className="text-xs font-semibold uppercase">Distance</span>
            </div>
            <span className="text-xl font-bold text-[#78350F] font-mono">
              {stats.distance}m
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col space-y-2.5 font-sans">
          {/* Revive Button (Subway Surfers second wind!) */}
          {canRevive && (
            <button
              onClick={onRevive}
              className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold text-sm shadow-lg shadow-emerald-600/30 hover:brightness-105 active:scale-[0.98] transition-all flex items-center justify-center space-x-2"
            >
              <HeartHandshake className="w-4 h-4" />
              <span>Revive with 15 Wind Orbs</span>
            </button>
          )}

          {/* Surf Again Button */}
          <button
            onClick={onRestart}
            className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-[#F59E0B] to-[#D97706] text-white font-bold text-sm shadow-lg shadow-amber-900/25 hover:brightness-105 active:scale-[0.98] transition-all flex items-center justify-center space-x-2"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Surf Again</span>
          </button>
        </div>
      </div>
    </div>
  );
};
