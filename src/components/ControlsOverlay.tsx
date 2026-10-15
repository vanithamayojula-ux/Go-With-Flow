import React from 'react';
import { ArrowLeft, ArrowRight, ArrowUp, ArrowDown, Zap, RefreshCw, RotateCcw, Crosshair, Radio } from 'lucide-react';
import { TrickType } from '../types';

interface ControlsOverlayProps {
  onControlAction: (action: 'left' | 'right' | 'jump' | 'forward' | 'drift' | 'slide' | 'shield', pressed: boolean) => void;
  onTriggerTrick: (trick: TrickType) => void;
  isAirborne: boolean;
  slowMoActive: boolean;
}

const TRICKS: {
  trick: TrickType;
  label: string;
  shortLabel: string;
  key: string;
  title: string;
  Icon: React.ComponentType<{ className?: string }>;
  iconClass: string;
  active: string;
  idle: string;
  kbdClass: string;
}[] = [
  {
    trick: 'spin',
    label: '360° Spin',
    shortLabel: 'Spin',
    key: 'J',
    title: '360° Spin (Key: J or 1)',
    Icon: RefreshCw,
    iconClass: 'text-cyan-400',
    active: 'bg-cyan-500/30 border-cyan-400 text-cyan-200 shadow-[0_0_12px_rgba(0,240,255,0.5)]',
    idle: 'bg-white/5 border-white/10 text-white/80 hover:bg-cyan-950/40 hover:border-cyan-500/40',
    kbdClass: 'border-cyan-500/40 text-cyan-300',
  },
  {
    trick: 'flip',
    label: 'Flip',
    shortLabel: 'Flip',
    key: 'K',
    title: 'Flip (Key: K or 2)',
    Icon: RotateCcw,
    iconClass: 'text-pink-400',
    active: 'bg-pink-500/30 border-pink-400 text-pink-200 shadow-[0_0_12px_rgba(255,0,127,0.5)]',
    idle: 'bg-white/5 border-white/10 text-white/80 hover:bg-pink-950/40 hover:border-pink-500/40',
    kbdClass: 'border-pink-500/40 text-pink-300',
  },
  {
    trick: 'grab',
    label: 'Rail Grab',
    shortLabel: 'Grab',
    key: 'L',
    title: 'Rail Grab (Key: L or 3)',
    Icon: Crosshair,
    iconClass: 'text-amber-400',
    active: 'bg-amber-500/30 border-amber-400 text-amber-200 shadow-[0_0_12px_rgba(255,136,0,0.5)]',
    idle: 'bg-white/5 border-white/10 text-white/80 hover:bg-amber-950/40 hover:border-amber-500/40',
    kbdClass: 'border-amber-500/40 text-amber-300',
  },
  {
    trick: 'pose',
    label: 'Air Glide',
    shortLabel: 'Glide',
    key: 'I',
    title: 'Air Glide (Key: I or 4)',
    Icon: Radio,
    iconClass: 'text-emerald-400',
    active: 'bg-emerald-500/30 border-emerald-400 text-emerald-200 shadow-[0_0_12px_rgba(0,255,102,0.5)]',
    idle: 'bg-white/5 border-white/10 text-white/80 hover:bg-emerald-950/40 hover:border-emerald-500/40',
    kbdClass: 'border-emerald-500/40 text-emerald-300',
  },
];

export const ControlsOverlay: React.FC<ControlsOverlayProps> = ({
  onControlAction,
  onTriggerTrick,
  isAirborne,
  slowMoActive,
}) => {
  const highlighted = isAirborne || slowMoActive;

  return (
    <div id="controls-overlay" className="pointer-events-none absolute inset-0 select-none z-10 font-mono">
      {/*
        Stunt bar. Phones/tablets: a compact row just above the touch buttons,
        clear of the top HUD. Desktop (lg+): a vertical panel on the right edge,
        clear of the stat chips, overdrive meter and world banner.
      */}
      <div
        className="fixed left-1/2 -translate-x-1/2 bottom-[calc(max(0.5rem,env(safe-area-inset-bottom))+4.25rem)] sm:bottom-[calc(max(0.5rem,env(safe-area-inset-bottom))+4.75rem)] w-[min(24rem,calc(100vw-1rem))]
                   lg:left-auto lg:translate-x-0 lg:bottom-auto lg:w-auto lg:right-[max(1.25rem,env(safe-area-inset-right))] lg:top-1/2 lg:-translate-y-1/2"
      >
        <div className="pointer-events-auto grid grid-cols-4 gap-1.5 p-1.5 rounded-xl bg-black/80 backdrop-blur-xl border border-cyan-500/30 shadow-[0_0_20px_rgba(0,240,255,0.15)] lg:flex lg:flex-col lg:gap-2 lg:p-2">
          <span className="hidden lg:flex items-center justify-center gap-1 px-1 pt-0.5 text-[10px] font-black text-cyan-300 uppercase tracking-widest">
            <Zap className="w-3 h-3 text-cyan-400 animate-pulse" />
            {slowMoActive ? 'OVERDRIVE' : isAirborne ? 'AIR TRICKS' : 'STUNTS'}
          </span>
          {TRICKS.map(({ trick, label, shortLabel, key, title, Icon, iconClass, active, idle, kbdClass }) => (
            <button
              key={trick}
              onClick={() => onTriggerTrick(trick)}
              className={`min-h-[44px] px-1.5 py-1 lg:px-3 lg:py-1.5 rounded-lg border font-black flex flex-col lg:flex-row items-center justify-center lg:justify-start gap-0.5 lg:gap-1.5 transition-all active:scale-95 ${
                highlighted ? active : idle
              }`}
              title={title}
              aria-label={title}
            >
              <Icon className={`w-4 h-4 lg:w-3.5 lg:h-3.5 shrink-0 ${iconClass}`} />
              <span className="text-[10px] leading-none lg:hidden">{shortLabel}</span>
              <span className="hidden lg:inline text-xs whitespace-nowrap">{label}</span>
              <kbd className={`hidden lg:inline ml-auto text-[9px] px-1 py-0.5 rounded bg-black/60 border font-mono ${kbdClass}`}>{key}</kbd>
            </button>
          ))}
        </div>
      </div>

      {/* Bottom control bar, inset from notches and the home indicator */}
      <div className="fixed bottom-0 inset-x-0 pl-[max(0.5rem,env(safe-area-inset-left))] pr-[max(0.5rem,env(safe-area-inset-right))] pb-[max(0.5rem,env(safe-area-inset-bottom))] flex items-end justify-between gap-2 text-[11px] md:text-sm pointer-events-none">
        {/* Left Side: Steering Paddles */}
        <div className="flex items-center gap-1.5 sm:gap-2 pointer-events-auto shrink-0">
          <button
            id="btn-carve-left"
            className="min-h-[48px] min-w-[48px] w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-black/80 backdrop-blur-xl border border-cyan-500/40 text-cyan-300 flex items-center justify-center active:scale-95 active:bg-cyan-500/80 active:text-black transition-all shadow-[0_0_15px_rgba(0,240,255,0.2)]"
            onPointerDown={() => onControlAction('left', true)}
            onPointerUp={() => onControlAction('left', false)}
            onPointerLeave={() => onControlAction('left', false)}
            aria-label="Shift Lane Left"
          >
            <ArrowLeft className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>

          <button
            id="btn-carve-right"
            className="min-h-[48px] min-w-[48px] w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-black/80 backdrop-blur-xl border border-cyan-500/40 text-cyan-300 flex items-center justify-center active:scale-95 active:bg-cyan-500/80 active:text-black transition-all shadow-[0_0_15px_rgba(0,240,255,0.2)]"
            onPointerDown={() => onControlAction('right', true)}
            onPointerUp={() => onControlAction('right', false)}
            onPointerLeave={() => onControlAction('right', false)}
            aria-label="Shift Lane Right"
          >
            <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>

        {/* Center: keyboard hints. Hidden on touch screens and narrow windows,
            where they would push the touch buttons off-screen. */}
        <div className="hidden md:flex pointer-coarse:hidden min-w-0 items-center gap-2 px-3 py-2 rounded-lg bg-black/85 backdrop-blur-xl border border-cyan-500/30 text-[11px] lg:text-sm text-white/90 font-mono tracking-wide shadow-lg whitespace-nowrap overflow-hidden">
          <span className="inline-flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-cyan-950/60 border border-cyan-500/40 text-cyan-300 font-bold text-[10px] lg:text-xs">A</kbd>
            <kbd className="px-1.5 py-0.5 rounded bg-cyan-950/60 border border-cyan-500/40 text-cyan-300 font-bold text-[10px] lg:text-xs">D</kbd>
            <span className="text-slate-300">LANE</span>
          </span>
          <span className="text-cyan-500/40">•</span>
          <span className="inline-flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-cyan-950/60 border border-cyan-500/40 text-cyan-300 font-bold text-[10px] lg:text-xs">SPACE/W</kbd>
            <span className="text-cyan-200 font-bold">JUMP</span>
          </span>
          <span className="text-pink-500/40">•</span>
          <span className="inline-flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-pink-950/60 border border-pink-500/40 text-pink-300 font-bold text-[10px] lg:text-xs">S/DOWN</kbd>
            <span className="text-pink-200 font-bold">SLIDE</span>
          </span>
          <span className="hidden lg:inline text-emerald-500/40">•</span>
          <span className="hidden lg:inline-flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 font-bold text-[10px] lg:text-xs">2xSPACE</kbd>
            <span className="text-emerald-200 font-bold">SHIELD</span>
          </span>
        </div>

        {/* Right Side: Action Buttons (Slide, Jump) */}
        <div className="flex items-center gap-1.5 sm:gap-2 pointer-events-auto shrink-0">
          {/* Slide / Duck Button */}
          <button
            id="btn-action-slide"
            className="min-h-[48px] min-w-[48px] w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-pink-950/80 backdrop-blur-xl border border-pink-500/60 text-pink-200 flex flex-col items-center justify-center active:scale-95 active:bg-pink-500 active:text-black transition-all shadow-[0_0_15px_rgba(255,0,127,0.3)]"
            onPointerDown={() => onControlAction('slide', true)}
            onPointerUp={() => onControlAction('slide', false)}
            onPointerLeave={() => onControlAction('slide', false)}
            aria-label="Slide Under Barriers"
          >
            <ArrowDown className="w-5 h-5 text-pink-300" />
            <span className="text-[9px] sm:text-[10px] uppercase font-black tracking-widest mt-0.5">Slide</span>
          </button>

          {/* Jump Button */}
          <button
            id="btn-action-jump"
            className="min-h-[48px] min-w-[48px] w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-cyan-950/80 backdrop-blur-xl border border-cyan-400/70 text-cyan-100 flex flex-col items-center justify-center active:scale-95 active:bg-cyan-400 active:text-black transition-all shadow-[0_0_20px_rgba(0,240,255,0.4)]"
            onPointerDown={() => onControlAction('jump', true)}
            onPointerUp={() => onControlAction('jump', false)}
            onPointerLeave={() => onControlAction('jump', false)}
            aria-label="Jump"
          >
            <ArrowUp className="w-5 h-5 sm:w-6 sm:h-6 text-cyan-200" />
            <span className="text-[9px] sm:text-[10px] uppercase font-black tracking-widest mt-0.5">Jump</span>
          </button>
        </div>
      </div>
    </div>
  );
};
