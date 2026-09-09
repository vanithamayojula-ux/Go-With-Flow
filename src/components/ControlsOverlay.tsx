import React from 'react';
import { ArrowLeft, ArrowRight, ArrowUp, ArrowDown, Zap, Sparkles, RefreshCw, RotateCcw, Crosshair, Radio } from 'lucide-react';
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
    <div id="controls-overlay" className="pointer-events-none absolute inset-0 flex flex-col justify-between p-3 sm:p-6 select-none z-10 font-mono">
      {/* Mid-screen Tricks Action Bar (highlighted when airborne or in slow-mo) */}
      <div className="flex items-center justify-center w-full pt-16 sm:pt-20">
        <div className="pointer-events-auto flex items-center space-x-1.5 sm:space-x-2.5 px-3 py-1.5 rounded-lg bg-black/85 backdrop-blur-xl border border-cyan-500/30 shadow-[0_0_20px_rgba(0,240,255,0.15)] transition-all">
          <span className="text-[10px] font-black text-cyan-400/70 uppercase tracking-widest mr-1 hidden sm:inline flex items-center gap-1">
            <Zap className="w-3 h-3 text-cyan-400 animate-pulse" />
            {slowMoActive ? 'OVERDRIVE TIME' : isAirborne ? 'AIR TRICKS' : 'STUNT RIG'}
          </span>

          {/* Spin Trick */}
          <button
            onClick={() => onTriggerTrick('spin')}
            className={`px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-md border text-xs font-black flex items-center space-x-1.5 transition-all active:scale-95 ${
              isAirborne || slowMoActive
                ? 'bg-cyan-500/30 border-cyan-400 text-cyan-200 shadow-[0_0_12px_rgba(0,240,255,0.5)]'
                : 'bg-white/5 border-white/10 text-white/80 hover:bg-cyan-950/40 hover:border-cyan-500/40'
            }`}
            title="Cyber Corkscrew 360° (Key: J or 1)"
          >
            <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
            <span>360° Spin</span>
            <kbd className="hidden md:inline text-[9px] px-1 py-0.5 rounded bg-black/60 border border-cyan-500/40 text-cyan-300 font-mono">J</kbd>
          </button>

          {/* Laser Flip */}
          <button
            onClick={() => onTriggerTrick('flip')}
            className={`px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-md border text-xs font-black flex items-center space-x-1.5 transition-all active:scale-95 ${
              isAirborne || slowMoActive
                ? 'bg-pink-500/30 border-pink-400 text-pink-200 shadow-[0_0_12px_rgba(255,0,127,0.5)]'
                : 'bg-white/5 border-white/10 text-white/80 hover:bg-pink-950/40 hover:border-pink-500/40'
            }`}
            title="Laser Invert Flip (Key: K or 2)"
          >
            <RotateCcw className="w-3.5 h-3.5 text-pink-400" />
            <span>Laser Flip</span>
            <kbd className="hidden md:inline text-[9px] px-1 py-0.5 rounded bg-black/60 border border-pink-500/40 text-pink-300 font-mono">K</kbd>
          </button>

          {/* Rail Grab */}
          <button
            onClick={() => onTriggerTrick('grab')}
            className={`px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-md border text-xs font-black flex items-center space-x-1.5 transition-all active:scale-95 ${
              isAirborne || slowMoActive
                ? 'bg-amber-500/30 border-amber-400 text-amber-200 shadow-[0_0_12px_rgba(255,136,0,0.5)]'
                : 'bg-white/5 border-white/10 text-white/80 hover:bg-amber-950/40 hover:border-amber-500/40'
            }`}
            title="Neon Rail Grab (Key: L or 3)"
          >
            <Crosshair className="w-3.5 h-3.5 text-amber-400" />
            <span>Rail Grab</span>
            <kbd className="hidden md:inline text-[9px] px-1 py-0.5 rounded bg-black/60 border border-amber-500/40 text-amber-300 font-mono">L</kbd>
          </button>

          {/* Sonic Glide */}
          <button
            onClick={() => onTriggerTrick('pose')}
            className={`px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-md border text-xs font-black flex items-center space-x-1.5 transition-all active:scale-95 ${
              isAirborne || slowMoActive
                ? 'bg-emerald-500/30 border-emerald-400 text-emerald-200 shadow-[0_0_12px_rgba(0,255,102,0.5)]'
                : 'bg-white/5 border-white/10 text-white/80 hover:bg-emerald-950/40 hover:border-emerald-500/40'
            }`}
            title="Sonic Glide Pose (Key: I or 4)"
          >
            <Radio className="w-3.5 h-3.5 text-emerald-400" />
            <span>Sonic Glide</span>
            <kbd className="hidden md:inline text-[9px] px-1 py-0.5 rounded bg-black/60 border border-emerald-500/40 text-emerald-300 font-mono">I</kbd>
          </button>
        </div>
      </div>

      {/* Bottom control clusters */}
      <div className="flex items-end justify-between w-full">
        {/* Left Side: Steering Paddles */}
        <div className="flex items-center space-x-3 pointer-events-auto">
          <button
            id="btn-carve-left"
            className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-black/80 backdrop-blur-xl border border-cyan-500/40 text-cyan-300 flex items-center justify-center active:scale-95 active:bg-cyan-500/80 active:text-black transition-all shadow-[0_0_15px_rgba(0,240,255,0.2)]"
            onPointerDown={() => onControlAction('left', true)}
            onPointerUp={() => onControlAction('left', false)}
            onPointerLeave={() => onControlAction('left', false)}
            aria-label="Shift Lane Left"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>

          <button
            id="btn-carve-right"
            className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-black/80 backdrop-blur-xl border border-cyan-500/40 text-cyan-300 flex items-center justify-center active:scale-95 active:bg-cyan-500/80 active:text-black transition-all shadow-[0_0_15px_rgba(0,240,255,0.2)]"
            onPointerDown={() => onControlAction('right', true)}
            onPointerUp={() => onControlAction('right', false)}
            onPointerLeave={() => onControlAction('right', false)}
            aria-label="Shift Lane Right"
          >
            <ArrowRight className="w-6 h-6" />
          </button>
        </div>

        {/* Center: Minimal Cyber Keybind Hints */}
        <div className="hidden md:flex items-center space-x-2 px-4 py-2 rounded-lg bg-black/80 backdrop-blur-xl border border-cyan-500/30 text-xs text-white/80 font-mono tracking-wide shadow-lg">
          <span><kbd className="px-1.5 py-0.5 rounded bg-cyan-950/60 border border-cyan-500/40 text-cyan-300 font-bold">A</kbd> <kbd className="px-1.5 py-0.5 rounded bg-cyan-950/60 border border-cyan-500/40 text-cyan-300 font-bold">D</kbd> SHIFT LANE</span>
          <span className="text-cyan-500/40">•</span>
          <span><kbd className="px-2 py-0.5 rounded bg-cyan-950/60 border border-cyan-500/40 text-cyan-300 font-bold">SPACE / W</kbd> JUMP</span>
          <span className="text-cyan-500/40">•</span>
          <span><kbd className="px-1.5 py-0.5 rounded bg-pink-950/60 border border-pink-500/40 text-pink-300 font-bold">S / DOWN</kbd> SLIDE</span>
          <span className="text-cyan-500/40">•</span>
          <span><kbd className="px-1.5 py-0.5 rounded bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 font-bold">2x SPACE</kbd> SHIELD</span>
        </div>

        {/* Right Side: Action Buttons (Slide, Jump) */}
        <div className="flex items-center space-x-3 pointer-events-auto">
          {/* Slide / Duck Button */}
          <button
            id="btn-action-slide"
            className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-pink-950/80 backdrop-blur-xl border border-pink-500/60 text-pink-200 flex flex-col items-center justify-center active:scale-95 active:bg-pink-500 active:text-black transition-all shadow-[0_0_15px_rgba(255,0,127,0.3)]"
            onPointerDown={() => onControlAction('slide', true)}
            onPointerUp={() => onControlAction('slide', false)}
            onPointerLeave={() => onControlAction('slide', false)}
            aria-label="Slide Under Laser Barriers"
          >
            <ArrowDown className="w-5 h-5 text-pink-300" />
            <span className="text-[10px] uppercase font-black tracking-widest mt-0.5">Slide</span>
          </button>

          {/* Jump Button */}
          <button
            id="btn-action-jump"
            className="w-16 h-16 sm:w-18 sm:h-18 rounded-xl bg-cyan-950/80 backdrop-blur-xl border border-cyan-400/70 text-cyan-100 flex flex-col items-center justify-center active:scale-95 active:bg-cyan-400 active:text-black transition-all shadow-[0_0_20px_rgba(0,240,255,0.4)]"
            onPointerDown={() => onControlAction('jump', true)}
            onPointerUp={() => onControlAction('jump', false)}
            onPointerLeave={() => onControlAction('jump', false)}
            aria-label="Jump & Leap"
          >
            <ArrowUp className="w-6 h-6 text-cyan-200" />
            <span className="text-[10px] uppercase font-black tracking-widest mt-0.5">Jump</span>
          </button>
        </div>
      </div>
    </div>
  );
};

