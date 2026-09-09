import React from 'react';
import { X, Sparkles, Wind, Palette, Shield, Compass } from 'lucide-react';
import { CosmeticsConfig } from '../types';

interface CosmeticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  cosmetics: CosmeticsConfig;
  onUpdateCosmetics: (config: CosmeticsConfig) => void;
}

export const CosmeticsModal: React.FC<CosmeticsModalProps> = ({
  isOpen,
  onClose,
  cosmetics,
  onUpdateCosmetics,
}) => {
  if (!isOpen) return null;

  const BOARDS = [
    {
      id: 'ivory-drift' as const,
      name: 'Ivory Drift',
      desc: 'Classic handcrafted cedarwood with emerald energy keel.',
      deckColor: '#faeed7',
      foilColor: '#6de4a2',
    },
    {
      id: 'sakura-foil' as const,
      name: 'Sakura Foil',
      desc: 'Blossom-white aerodynamic deck with glowing pink edge.',
      deckColor: '#FCE7F3',
      foilColor: '#F472B6',
    },
    {
      id: 'dune-glider' as const,
      name: 'Dune Glider',
      desc: 'Solar warm deck crafted for frictionless dune carve.',
      deckColor: '#FEF3C7',
      foilColor: '#F59E0B',
    },
    {
      id: 'celestia-blade' as const,
      name: 'Celestia Blade',
      desc: 'Crystalline sky-blue glider tuned for updraft surfing.',
      deckColor: '#E0F2FE',
      foilColor: '#38BDF8',
    },
    {
      id: 'forest-spirit' as const,
      name: 'Forest Spirit',
      desc: 'Moss-carved Whisperwood board with a glowing spore-green keel.',
      deckColor: '#D7E8C8',
      foilColor: '#8BC34A',
    },
  ];

  const TRAILS = [
    {
      id: 'verdant-breeze' as const,
      name: 'Verdant Breeze',
      desc: 'Emerald & fresh mint ribbon evoking summer meadows.',
      gradient: 'from-emerald-400 to-teal-300',
    },
    {
      id: 'solar-flare' as const,
      name: 'Solar Flare',
      desc: 'Radiant golden amber sunlight wake with warm rim.',
      gradient: 'from-amber-400 to-yellow-300',
    },
    {
      id: 'aurora' as const,
      name: 'Astral Aurora',
      desc: 'Cosmic twilight indigo shifting into soft turquoise.',
      gradient: 'from-indigo-400 to-teal-400',
    },
    {
      id: 'rainbow' as const,
      name: 'Prismatic Rainbow',
      desc: 'Transcendent dual-spectrum ribbon for peak flow.',
      gradient: 'from-pink-400 via-yellow-300 to-sky-400',
    },
  ];

  const CAPE_COLORS = [
    { name: 'Ghibli Rust', hex: '#c85a32' },
    { name: 'Verdant Teal', hex: '#3bb396' },
    { name: 'Sky Azure', hex: '#38bdf8' },
    { name: 'Sakura Bloom', hex: '#f472b6' },
    { name: 'Golden Sun', hex: '#fbbf24' },
    { name: 'Midnight Indigo', hex: '#4f46e5' },
  ];

  return (
    <div
      id="cosmetics-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div
        id="cosmetics-modal-dialog"
        className="w-full max-w-2xl bg-slate-900/95 border border-white/15 rounded-3xl p-6 shadow-2xl text-white overflow-hidden max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-br from-pink-500/30 to-amber-500/30 border border-pink-400/40 text-pink-200">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight text-white">Voyager Cosmetics & Boards</h2>
              <p className="text-xs text-white/60">Customize your hover surf equipment, ribbon trails, and cape</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white transition-all"
            aria-label="Close Cosmetics Dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Tabs */}
        <div className="flex-1 overflow-y-auto py-5 space-y-6 pr-1 custom-scrollbar">
          {/* Section 1: Hover Surfboard */}
          <div>
            <div className="flex items-center space-x-2 mb-3">
              <Shield className="w-4 h-4 text-amber-300" />
              <h3 className="text-sm font-semibold tracking-wide uppercase text-white/90">Hover Surfboards</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {BOARDS.map(board => {
                const isSelected = cosmetics.boardId === board.id;
                return (
                  <button
                    key={board.id}
                    onClick={() => onUpdateCosmetics({ ...cosmetics, boardId: board.id })}
                    className={`p-3.5 rounded-2xl border text-left transition-all relative flex flex-col justify-between ${
                      isSelected
                        ? 'bg-amber-500/15 border-amber-400/80 shadow-lg shadow-amber-500/10'
                        : 'bg-white/5 border-white/10 hover:bg-white/10'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-white">{board.name}</span>
                        <div className="flex items-center space-x-1.5">
                          <span
                            className="w-3.5 h-3.5 rounded-full border border-black/40"
                            style={{ backgroundColor: board.deckColor }}
                            title="Deck"
                          />
                          <span
                            className="w-3.5 h-3.5 rounded-full border border-black/40"
                            style={{ backgroundColor: board.foilColor }}
                            title="Keel Foil"
                          />
                        </div>
                      </div>
                      <p className="text-xs text-white/60 mt-1 leading-relaxed">{board.desc}</p>
                    </div>
                    {isSelected && (
                      <span className="mt-2.5 text-[10px] font-bold text-amber-300 uppercase tracking-widest">
                        Equipped
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 2: Flow Trail Ribbon */}
          <div>
            <div className="flex items-center space-x-2 mb-3">
              <Wind className="w-4 h-4 text-sky-300" />
              <h3 className="text-sm font-semibold tracking-wide uppercase text-white/90">Luminous Trail Ribbons</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {TRAILS.map(trail => {
                const isSelected = cosmetics.trailId === trail.id;
                return (
                  <button
                    key={trail.id}
                    onClick={() => onUpdateCosmetics({ ...cosmetics, trailId: trail.id })}
                    className={`p-3.5 rounded-2xl border text-left transition-all relative ${
                      isSelected
                        ? 'bg-sky-500/15 border-sky-400/80 shadow-lg shadow-sky-500/10'
                        : 'bg-white/5 border-white/10 hover:bg-white/10'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-white">{trail.name}</span>
                      <div className={`w-12 h-3.5 rounded-full bg-gradient-to-r ${trail.gradient} shadow-sm`} />
                    </div>
                    <p className="text-xs text-white/60 mt-1 leading-relaxed">{trail.desc}</p>
                    {isSelected && (
                      <span className="mt-2 text-[10px] font-bold text-sky-300 uppercase tracking-widest inline-block">
                        Active Ribbon
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 3: Character Headwear & Attire */}
          <div>
            <div className="flex items-center space-x-2 mb-3">
              <Compass className="w-4 h-4 text-emerald-300" />
              <h3 className="text-sm font-semibold tracking-wide uppercase text-white/90">Surfer Attire & Headwear</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={() => onUpdateCosmetics({ ...cosmetics, characterStyle: 'ghibli-voyager' })}
                className={`p-3.5 rounded-2xl border text-left transition-all relative ${
                  !cosmetics.characterStyle || cosmetics.characterStyle === 'ghibli-voyager'
                    ? 'bg-emerald-500/15 border-emerald-400/80 shadow-lg shadow-emerald-500/10'
                    : 'bg-white/5 border-white/10 hover:bg-white/10'
                }`}
              >
                <div className="font-bold text-sm text-white flex items-center justify-between">
                  <span>Ghibli Sky Voyager</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">Ref 1</span>
                </div>
                <p className="text-xs text-white/60 mt-1">Wide-brim straw hat with teal brim ribbon, red wind tunic, and high boots.</p>
              </button>

              <button
                onClick={() => onUpdateCosmetics({ ...cosmetics, characterStyle: 'desert-nomad' })}
                className={`p-3.5 rounded-2xl border text-left transition-all relative ${
                  cosmetics.characterStyle === 'desert-nomad'
                    ? 'bg-amber-500/15 border-amber-400/80 shadow-lg shadow-amber-500/10'
                    : 'bg-white/5 border-white/10 hover:bg-white/10'
                }`}
              >
                <div className="font-bold text-sm text-white flex items-center justify-between">
                  <span>Dune Nomad Cowl</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/30">Ref 4</span>
                </div>
                <p className="text-xs text-white/60 mt-1">Wrapped wanderer hood/cowl for intense sand and high winds with rust tunic.</p>
              </button>

              <button
                onClick={() => onUpdateCosmetics({ ...cosmetics, characterStyle: 'forest-wanderer' })}
                className={`p-3.5 rounded-2xl border text-left transition-all relative sm:col-span-2 ${
                  cosmetics.characterStyle === 'forest-wanderer'
                    ? 'bg-lime-500/15 border-lime-400/80 shadow-lg shadow-lime-500/10'
                    : 'bg-white/5 border-white/10 hover:bg-white/10'
                }`}
              >
                <div className="font-bold text-sm text-white flex items-center justify-between">
                  <span>Whisperwood Wanderer</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-lime-500/20 text-lime-300 border border-lime-400/30">New</span>
                </div>
                <p className="text-xs text-white/60 mt-1">Moss-green tunic with an acorn-leaf cap, plus a tiny soot sprite companion that floats along beside you.</p>
              </button>
            </div>
          </div>

          {/* Section 4: Voyager Cape Color */}
          <div>
            <div className="flex items-center space-x-2 mb-3">
              <Palette className="w-4 h-4 text-pink-300" />
              <h3 className="text-sm font-semibold tracking-wide uppercase text-white/90">Wind Scarf / Cape Palette</h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {CAPE_COLORS.map(color => {
                const isSelected = cosmetics.capeColor === color.hex;
                return (
                  <button
                    key={color.hex}
                    onClick={() => onUpdateCosmetics({ ...cosmetics, capeColor: color.hex })}
                    className={`flex items-center space-x-2.5 p-2.5 rounded-xl border transition-all ${
                      isSelected
                        ? 'bg-white/15 border-white/50 shadow-md'
                        : 'bg-white/5 border-white/10 hover:bg-white/10'
                    }`}
                  >
                    <span
                      className="w-5 h-5 rounded-full shadow-inner border border-white/30"
                      style={{ backgroundColor: color.hex }}
                    />
                    <span className="text-xs font-medium text-white">{color.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-white/10 flex items-center justify-between">
          <span className="text-xs text-white/50">Changes apply immediately in real time</span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs tracking-wide transition-all shadow-lg shadow-emerald-500/20"
          >
            Done Surfing
          </button>
        </div>
      </div>
    </div>
  );
};
