import React, { useEffect } from 'react';
import {
  X,
  Keyboard,
  Zap,
  Shield,
  RotateCcw,
  Sparkles,
  Flame,
  Radio,
  ArrowRight,
  Gauge,
  Cpu,
  Compass,
} from 'lucide-react';

interface HowToPlayModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HowToPlayModal: React.FC<HowToPlayModalProps> = ({ isOpen, onClose }) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      id="how-to-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-xl animate-in fade-in duration-200 font-mono"
      role="dialog"
      aria-modal="true"
      aria-labelledby="how-to-modal-title"
    >
      <div
        id="how-to-modal-dialog"
        className="w-full max-w-2xl bg-black/95 border-2 border-cyan-500/40 rounded-2xl p-5 sm:p-6 shadow-[0_0_50px_rgba(0,240,255,0.25)] text-white overflow-hidden max-h-[92vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-cyan-500/20">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-cyan-950/60 border border-cyan-400/50 text-cyan-300 shadow-[0_0_10px_rgba(0,240,255,0.3)]">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h2 id="how-to-modal-title" className="text-base sm:text-lg font-black tracking-wider text-cyan-300 uppercase">
                NEON DRIFT // PILOT MANUAL
              </h2>
              <p className="text-[11px] text-white/60">Flight controls, stunt mechanics, and survival guide</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="min-h-[48px] min-w-[48px] flex items-center justify-center rounded-xl bg-white/5 hover:bg-cyan-950/40 border border-white/10 hover:border-cyan-500/40 text-white/70 hover:text-cyan-300 focus-visible:ring-2 focus-visible:ring-cyan-400 transition-all cursor-pointer"
            aria-label="Close Pilot Manual"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto py-4 space-y-6 pr-1 custom-scrollbar">
          {/* Section 1: Basic Controls */}
          <div>
            <div className="flex items-center space-x-2 mb-3">
              <Keyboard className="w-4 h-4 text-cyan-400" />
              <h3 className="text-xs font-black tracking-widest uppercase text-cyan-300">CORE NAVIGATION CONTROLS</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-start space-x-3">
                <div className="flex flex-col gap-1 min-w-[64px]">
                  <kbd className="px-2 py-1 rounded bg-cyan-950/80 border border-cyan-400/50 text-cyan-300 text-xs font-bold text-center">A / D</kbd>
                  <span className="text-[9px] text-white/40 text-center">Swipe ◀ ▶</span>
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Lane Shift / Carve</div>
                  <p className="text-[11px] text-white/60 mt-0.5">Quickly swap between 3 lanes and lean into high-speed highway turns.</p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-start space-x-3">
                <div className="flex flex-col gap-1 min-w-[64px]">
                  <kbd className="px-2 py-1 rounded bg-cyan-950/80 border border-cyan-400/50 text-cyan-300 text-xs font-bold text-center">SPACE / W</kbd>
                  <span className="text-[9px] text-white/40 text-center">Swipe ▲</span>
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Jump & Leap</div>
                  <p className="text-[11px] text-white/60 mt-0.5">Clear low obstacles, hop onto maglev ramps, and catch aerial shards.</p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-start space-x-3">
                <div className="flex flex-col gap-1 min-w-[64px]">
                  <kbd className="px-2 py-1 rounded bg-pink-950/80 border border-pink-400/50 text-pink-300 text-xs font-bold text-center">S / DOWN</kbd>
                  <span className="text-[9px] text-white/40 text-center">Swipe ▼</span>
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Slide & Duck</div>
                  <p className="text-[11px] text-white/60 mt-0.5">Crouch low beneath overhead laser fences and conduit beams.</p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-start space-x-3">
                <div className="flex flex-col gap-1 min-w-[64px]">
                  <kbd className="px-2 py-1 rounded bg-emerald-950/80 border border-emerald-400/50 text-emerald-300 text-xs font-bold text-center">2x SPACE</kbd>
                  <span className="text-[9px] text-white/40 text-center">Shield Tap</span>
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Deploy Holo-Shield</div>
                  <p className="text-[11px] text-white/60 mt-0.5">Activate a protective bubble that absorbs 1 collision safely.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Stunt Tricks */}
          <div>
            <div className="flex items-center space-x-2 mb-3">
              <Zap className="w-4 h-4 text-fuchsia-400" />
              <h3 className="text-xs font-black tracking-widest uppercase text-fuchsia-400">AERIAL STUNTS & TRICK MULTIPLIERS</h3>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="p-2.5 rounded-xl bg-cyan-950/40 border border-cyan-500/30 text-center">
                <div className="text-cyan-300 font-bold text-xs">360° Spin</div>
                <kbd className="inline-block mt-1 px-1.5 py-0.5 rounded bg-black/60 border border-cyan-400 text-[10px] text-cyan-200">KEY: J / 1</kbd>
                <div className="text-[10px] text-white/60 mt-1">Corkscrew roll</div>
              </div>

              <div className="p-2.5 rounded-xl bg-pink-950/40 border border-pink-500/30 text-center">
                <div className="text-pink-300 font-bold text-xs">Laser Flip</div>
                <kbd className="inline-block mt-1 px-1.5 py-0.5 rounded bg-black/60 border border-pink-400 text-[10px] text-pink-200">KEY: K / 2</kbd>
                <div className="text-[10px] text-white/60 mt-1">Invert backflip</div>
              </div>

              <div className="p-2.5 rounded-xl bg-amber-950/40 border border-amber-500/30 text-center">
                <div className="text-amber-300 font-bold text-xs">Rail Grab</div>
                <kbd className="inline-block mt-1 px-1.5 py-0.5 rounded bg-black/60 border border-amber-400 text-[10px] text-amber-200">KEY: L / 3</kbd>
                <div className="text-[10px] text-white/60 mt-1">Nose air grab</div>
              </div>

              <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-center">
                <div className="text-emerald-300 font-bold text-xs">Sonic Glide</div>
                <kbd className="inline-block mt-1 px-1.5 py-0.5 rounded bg-black/60 border border-emerald-400 text-[10px] text-emerald-200">KEY: I / 4</kbd>
                <div className="text-[10px] text-white/60 mt-1">Aerodynamic pose</div>
              </div>
            </div>
            <p className="text-[11px] text-white/60 mt-2">
              Chain tricks while airborne or during slow-motion time dilation to build up massive combo score multipliers!
            </p>
          </div>

          {/* Section 3: Advanced Cyber Mechanics */}
          <div>
            <div className="flex items-center space-x-2 mb-3">
              <Gauge className="w-4 h-4 text-amber-400" />
              <h3 className="text-xs font-black tracking-widest uppercase text-amber-400">ADVANCED CYBER MECHANICS</h3>
            </div>

            <div className="space-y-2.5">
              <div className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-start space-x-3">
                <div className="p-2 rounded-lg bg-amber-950/60 border border-amber-500/40 text-amber-300 mt-0.5">
                  <Gauge className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Overdrive & Style Flow State</div>
                  <p className="text-[11px] text-white/60 mt-0.5">
                    Near-misses and stunt combos charge your Overdrive meter through 4 tiers: <span className="text-slate-300">Dormant</span> $\to$ <span className="text-cyan-300">Charged</span> $\to$ <span className="text-pink-300">Overdrive</span> $\to$ <span className="text-white font-bold">Max-Velocity</span>. Reaching Max-Velocity unlocks score cascades!
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-start space-x-3">
                <div className="p-2 rounded-lg bg-cyan-950/60 border border-cyan-500/40 text-cyan-300 mt-0.5">
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Maglev Rail Grinding</div>
                  <p className="text-[11px] text-white/60 mt-0.5">
                    Jump onto illuminated center and side grind rails to slide at double score multiplier while showering glowing sparks.
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-start space-x-3">
                <div className="p-2 rounded-lg bg-purple-950/60 border border-purple-500/40 text-purple-300 mt-0.5">
                  <Radio className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white">World Warp Portals</div>
                  <p className="text-[11px] text-white/60 mt-0.5">
                    Ride through colossal swirling vortex gates every 450m to seamlessly teleport across 15 distinct cyberpunk worlds.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-cyan-500/20 flex items-center justify-end">
          <button
            onClick={onClose}
            className="min-h-[48px] px-6 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-black font-black text-xs uppercase tracking-widest active:scale-95 transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-cyan-300"
          >
            GOT IT // RETURN
          </button>
        </div>
      </div>
    </div>
  );
};
