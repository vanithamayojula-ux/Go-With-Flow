import React from 'react';
import { ArrowLeft, ArrowRight, ArrowUp, ArrowDown, Zap, Sparkles, RefreshCw, RotateCcw, Hand, Smile, Shield } from 'lucide-react';
import { TrickType } from '../types';

interface ControlsOverlayProps {
  onControlAction: (action: 'left' | 'right' | 'jump' | 'forward' | 'drift' | 'slide' | 'shield', pressed: boolean) => void;
  onTriggerTrick: (trick: TrickType) => void;
  isAirborne: boolean;
  slowMoActive: boolean;
}

export const ControlsOverlay: React.FC<ControlsOverlayProps> = ({
  onControlAction,
  onTriggerTrick,
  isAirborne,
  slowMoActive,
}) => {
  return (
    <div id="controls-overlay" className="pointer-events-none absolute inset-0 flex flex-col justify-between p-3 sm:p-6 select-none z-10">
      {/* Mid-screen Tricks Action Bar (highlighted when airborne or in slow-mo) */}
      <div className="flex items-center justify-center w-full pt-16 sm:pt-20">
        <div className="pointer-events-auto flex items-center space-x-1.5 sm:space-x-2.5 px-3 py-1.5 rounded-2xl bg-slate-950/70 backdrop-blur-md border border-white/15 shadow-xl transition-all">
          <span className="text-[10px] font-bold text-white/50 uppercase tracking-widest mr-1 hidden sm:inline">
            {slowMoActive ? '✨ SLOW-MO WINDOW' : isAirborne ? 'AIR TRICKS' : 'TRICKS'}
          </span>

          {/* Spin Trick */}
          <button
            onClick={() => onTriggerTrick('spin')}
            className={`px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-xl border text-xs font-bold flex items-center space-x-1.5 transition-all active:scale-95 ${
              isAirborne || slowMoActive
                ? 'bg-sky-500/30 border-sky-400 text-sky-200 shadow-md shadow-sky-500/20'
                : 'bg-white/5 border-white/10 text-white/80 hover:bg-white/15'
            }`}
            title="360 Corkscrew Spin (Key: J or 1)"
          >
            <RefreshCw className="w-3.5 h-3.5 text-sky-300 animate-spin-slow" />
            <span>360° Spin</span>
            <kbd className="hidden md:inline text-[9px] px-1 py-0.5 rounded bg-white/20 text-white font-mono">J</kbd>
          </button>

          {/* Backflip Trick */}
          <button
            onClick={() => onTriggerTrick('flip')}
            className={`px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-xl border text-xs font-bold flex items-center space-x-1.5 transition-all active:scale-95 ${
              isAirborne || slowMoActive
                ? 'bg-pink-500/30 border-pink-400 text-pink-200 shadow-md shadow-pink-500/20'
                : 'bg-white/5 border-white/10 text-white/80 hover:bg-white/15'
            }`}
            title="Skyward Backflip (Key: K or 2)"
          >
            <RotateCcw className="w-3.5 h-3.5 text-pink-300" />
            <span>Backflip</span>
            <kbd className="hidden md:inline text-[9px] px-1 py-0.5 rounded bg-white/20 text-white font-mono">K</kbd>
          </button>

          {/* Rail Grab Trick */}
          <button
            onClick={() => onTriggerTrick('grab')}
            className={`px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-xl border text-xs font-bold flex items-center space-x-1.5 transition-all active:scale-95 ${
              isAirborne || slowMoActive
                ? 'bg-amber-500/30 border-amber-400 text-amber-200 shadow-md shadow-amber-500/20'
                : 'bg-white/5 border-white/10 text-white/80 hover:bg-white/15'
            }`}
            title="Zephyr Rail Grab (Key: L or 3)"
          >
            <Hand className="w-3.5 h-3.5 text-amber-300" />
            <span>Rail Grab</span>
            <kbd className="hidden md:inline text-[9px] px-1 py-0.5 rounded bg-white/20 text-white font-mono">L</kbd>
          </button>

          {/* Zen Pose Trick */}
          <button
            onClick={() => onTriggerTrick('pose')}
            className={`px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-xl border text-xs font-bold flex items-center space-x-1.5 transition-all active:scale-95 ${
              isAirborne || slowMoActive
                ? 'bg-emerald-500/30 border-emerald-400 text-emerald-200 shadow-md shadow-emerald-500/20'
                : 'bg-white/5 border-white/10 text-white/80 hover:bg-white/15'
            }`}
            title="Zen Cloud Glide (Key: I or 4)"
          >
            <Smile className="w-3.5 h-3.5 text-emerald-300" />
            <span>Zen Glide</span>
            <kbd className="hidden md:inline text-[9px] px-1 py-0.5 rounded bg-white/20 text-white font-mono">I</kbd>
          </button>
        </div>
      </div>

      {/* Bottom control clusters */}
      <div className="flex items-end justify-between w-full">
        {/* Left Side: Steering Paddles */}
        <div className="flex items-center space-x-3 pointer-events-auto">
          <button
            id="btn-carve-left"
            className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-slate-900/60 backdrop-blur-md border border-white/20 text-white flex items-center justify-center active:scale-95 active:bg-amber-500/80 transition-all shadow-lg shadow-black/20"
            onPointerDown={() => onControlAction('left', true)}
            onPointerUp={() => onControlAction('left', false)}
            onPointerLeave={() => onControlAction('left', false)}
            aria-label="Carve Left"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>

          <button
            id="btn-carve-right"
            className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-slate-900/60 backdrop-blur-md border border-white/20 text-white flex items-center justify-center active:scale-95 active:bg-amber-500/80 transition-all shadow-lg shadow-black/20"
            onPointerDown={() => onControlAction('right', true)}
            onPointerUp={() => onControlAction('right', false)}
            onPointerLeave={() => onControlAction('right', false)}
            aria-label="Carve Right"
          >
            <ArrowRight className="w-6 h-6" />
          </button>
        </div>

        {/* Center: Minimal Keyboard Hints (hidden on small mobile touch) */}
        <div className="hidden md:flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-xs text-white/80 font-mono tracking-wide">
          <span><kbd className="px-1.5 py-0.5 rounded bg-white/20 text-white font-bold">A</kbd> <kbd className="px-1.5 py-0.5 rounded bg-white/20 text-white font-bold">D</kbd> Switch Lane</span>
          <span className="text-white/30">•</span>
          <span><kbd className="px-2 py-0.5 rounded bg-white/20 text-white font-bold">SPACE / W</kbd> Jump</span>
          <span className="text-white/30">•</span>
          <span><kbd className="px-1.5 py-0.5 rounded bg-white/20 text-white font-bold">S / DOWN</kbd> Slide</span>
          <span className="text-white/30">•</span>
          <span><kbd className="px-1.5 py-0.5 rounded bg-white/20 text-white font-bold">DOUBLE SPACE</kbd> Shield</span>
        </div>

        {/* Right Side: Action Buttons (Slide, Jump, Boost) */}
        <div className="flex items-center space-x-3 pointer-events-auto">
          {/* Slide / Roll Button */}
          <button
            id="btn-action-slide"
            className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-amber-900/70 backdrop-blur-md border border-amber-400/50 text-white flex flex-col items-center justify-center active:scale-95 active:bg-amber-500 transition-all shadow-lg shadow-amber-900/30"
            onPointerDown={() => onControlAction('slide', true)}
            onPointerUp={() => onControlAction('slide', false)}
            onPointerLeave={() => onControlAction('slide', false)}
            aria-label="Slide and Duck Under Barriers"
          >
            <ArrowDown className="w-5 h-5 text-amber-200" />
            <span className="text-[10px] uppercase font-bold tracking-widest mt-0.5">Slide</span>
          </button>

          {/* Jump Button */}
          <button
            id="btn-action-jump"
            className="w-16 h-16 sm:w-18 sm:h-18 rounded-full bg-sky-900/70 backdrop-blur-md border border-sky-300/50 text-white flex flex-col items-center justify-center active:scale-95 active:bg-sky-500 transition-all shadow-lg shadow-sky-900/30"
            onPointerDown={() => onControlAction('jump', true)}
            onPointerUp={() => onControlAction('jump', false)}
            onPointerLeave={() => onControlAction('jump', false)}
            aria-label="Jump and Launch"
          >
            <ArrowUp className="w-6 h-6" />
            <span className="text-[10px] uppercase font-bold tracking-widest mt-0.5">Jump</span>
          </button>
        </div>
      </div>
    </div>
  );
};

