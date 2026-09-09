import React from 'react';
import { X, Zap, Cpu, Palette, Shield, Sparkles, Activity, Bot } from 'lucide-react';
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
      id: 'cyber-phantom' as const,
      name: 'Cyber Phantom',
      desc: 'Matte carbon stealth hoverboard with high-frequency cyan plasma perimeter.',
      deckColor: '#12151f',
      foilColor: '#00f0ff',
    },
    {
      id: 'laser-edge' as const,
      name: 'Laser Edge',
      desc: 'Razor-sharp neon magenta blade engineered for ultra-fast rail grinds.',
      deckColor: '#1a0b16',
      foilColor: '#ff007f',
    },
    {
      id: 'grid-runner' as const,
      name: 'Grid Runner',
      desc: 'Tron vector wireframe chassis with acid-green quantum keel.',
      deckColor: '#081a10',
      foilColor: '#00ff66',
    },
    {
      id: 'tokyo-neon' as const,
      name: 'Tokyo Neon',
      desc: 'Akira-inspired amber street racing deck with deep violet underglow.',
      deckColor: '#201104',
      foilColor: '#ff8800',
    },
    {
      id: 'void-stalker' as const,
      name: 'Void Stalker',
      desc: 'Pure obsidian cosmic deck with pulsing ultraviolet edge.',
      deckColor: '#06060c',
      foilColor: '#9d00ff',
    },
  ];

  const TRAILS = [
    {
      id: 'electric-cyan' as const,
      name: 'Electric Cyan Laser',
      desc: 'Blinding 50,000V cyan beam with white-hot core.',
      gradient: 'from-cyan-400 to-blue-500',
    },
    {
      id: 'hot-magenta' as const,
      name: 'Hot Magenta Wake',
      desc: 'Synthwave hyper-violet and neon pink afterglow.',
      gradient: 'from-pink-500 to-purple-600',
    },
    {
      id: 'acid-green' as const,
      name: 'Acid Matrix Stream',
      desc: 'High-speed encrypted digital phosphor ribbon.',
      gradient: 'from-emerald-400 to-teal-300',
    },
    {
      id: 'plasma-rainbow' as const,
      name: 'Plasma Overdrive',
      desc: 'Prismatic dual-phase frequency light trail.',
      gradient: 'from-pink-500 via-cyan-400 to-yellow-300',
    },
  ];

  const ARMOR_VARIANTS = [
    {
      id: 'carbon-fiber' as const,
      name: 'Carbon Stealth Rig',
      desc: 'Black carbon-composite runner armor with integrated servo-joints.',
    },
    {
      id: 'titanium-white' as const,
      name: 'Orbital Titanium',
      desc: 'Reflective pearl-white exoskeleton for high-altitude speed.',
    },
    {
      id: 'onyx-stealth' as const,
      name: 'Onyx Spec-Ops',
      desc: 'Radar-absorbent matte black nanoweave flight suit.',
    },
    {
      id: 'crimson-cyborg' as const,
      name: 'Akira Crimson',
      desc: 'High-voltage neo-Tokyo combat red racing armor.',
    },
  ];

  const VISOR_COLORS = [
    { name: 'Cyan Pulse', hex: '#00f0ff' },
    { name: 'Neon Magenta', hex: '#ff007f' },
    { name: 'Matrix Green', hex: '#00ff66' },
    { name: 'Solar Amber', hex: '#ff8800' },
    { name: 'Blinding White', hex: '#ffffff' },
    { name: 'Deep Violet', hex: '#7928ca' },
  ];

  const COMPANION_MODELS = [
    {
      id: 'recon-orb' as const,
      name: 'Reconnaissance Orb',
      desc: 'Spherical optic sensor pod with pulse ring and laser telemetry scanner.',
    },
    {
      id: 'stealth-hex' as const,
      name: 'Hex-Wing Stealth UAV',
      desc: 'Angular stealth chassis coated in radar-absorbent obsidian nanoweave.',
    },
    {
      id: 'neon-wasp' as const,
      name: 'Neon Wasp Interceptor',
      desc: 'Agile high-mobility twin-thruster drone built for high-speed drafting.',
    },
  ];

  return (
    <div
      id="cosmetics-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl animate-in fade-in duration-200 font-mono"
    >
      <div
        id="cosmetics-modal-dialog"
        className="w-full max-w-2xl bg-black/95 border-2 border-cyan-500/40 rounded-2xl p-6 shadow-[0_0_50px_rgba(0,240,255,0.25)] text-white overflow-hidden max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-cyan-500/20">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-cyan-950/60 border border-cyan-400/50 text-cyan-300 shadow-[0_0_10px_rgba(0,240,255,0.3)]">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-wider text-cyan-300 uppercase">LOADOUT & EQUIPMENT BAY</h2>
              <p className="text-xs text-white/60">Customize your cyber hoverboard, energy trail ribbons, and armor rig</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-white/5 hover:bg-cyan-950/40 border border-white/10 hover:border-cyan-500/40 text-white/70 hover:text-cyan-300 transition-all"
            aria-label="Close Cosmetics Dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Tabs */}
        <div className="flex-1 overflow-y-auto py-5 space-y-6 pr-1 custom-scrollbar">
          {/* Section 1: Hoverboards */}
          <div>
            <div className="flex items-center space-x-2 mb-3">
              <Zap className="w-4 h-4 text-cyan-400" />
              <h3 className="text-xs font-black tracking-widest uppercase text-cyan-300">CYBER HOVERBOARDS</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {BOARDS.map(board => {
                const isSelected = cosmetics.boardId === board.id;
                return (
                  <button
                    key={board.id}
                    onClick={() => onUpdateCosmetics({ ...cosmetics, boardId: board.id })}
                    className={`p-3.5 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
                      isSelected
                        ? 'bg-cyan-950/40 border-cyan-400 shadow-[0_0_15px_rgba(0,240,255,0.25)]'
                        : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-cyan-500/30'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-white">{board.name}</span>
                        <div className="flex items-center space-x-1.5">
                          <span
                            className="w-3.5 h-3.5 rounded border border-black/40"
                            style={{ backgroundColor: board.deckColor }}
                            title="Deck"
                          />
                          <span
                            className="w-3.5 h-3.5 rounded border border-black/40 shadow-sm"
                            style={{ backgroundColor: board.foilColor }}
                            title="Keel Light"
                          />
                        </div>
                      </div>
                      <p className="text-xs text-white/60 mt-1 leading-relaxed">{board.desc}</p>
                    </div>
                    {isSelected && (
                      <span className="mt-2.5 text-[10px] font-black text-cyan-400 uppercase tracking-widest flex items-center gap-1">
                        <Activity className="w-3 h-3 text-cyan-400 animate-pulse" />
                        EQUIPPED
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 2: Energy Trail Ribbons */}
          <div>
            <div className="flex items-center space-x-2 mb-3">
              <Sparkles className="w-4 h-4 text-pink-400" />
              <h3 className="text-xs font-black tracking-widest uppercase text-pink-400">ENERGY TRAIL WAKE</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {TRAILS.map(trail => {
                const isSelected = cosmetics.trailId === trail.id;
                return (
                  <button
                    key={trail.id}
                    onClick={() => onUpdateCosmetics({ ...cosmetics, trailId: trail.id })}
                    className={`p-3.5 rounded-xl border text-left transition-all relative ${
                      isSelected
                        ? 'bg-pink-950/40 border-pink-400 shadow-[0_0_15px_rgba(255,0,127,0.25)]'
                        : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-pink-500/30'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-white">{trail.name}</span>
                      <div className={`w-12 h-3.5 rounded bg-gradient-to-r ${trail.gradient} shadow-sm`} />
                    </div>
                    <p className="text-xs text-white/60 mt-1 leading-relaxed">{trail.desc}</p>
                    {isSelected && (
                      <span className="mt-2 text-[10px] font-black text-pink-400 uppercase tracking-widest inline-block">
                        ACTIVE STREAM
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 3: Cyber Armor Variant */}
          <div>
            <div className="flex items-center space-x-2 mb-3">
              <Shield className="w-4 h-4 text-amber-400" />
              <h3 className="text-xs font-black tracking-widest uppercase text-amber-400">CYBER RUNNER EXOSUIT</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {ARMOR_VARIANTS.map(armor => {
                const isSelected = cosmetics.armorVariant === armor.id || (!cosmetics.armorVariant && armor.id === 'carbon-fiber');
                return (
                  <button
                    key={armor.id}
                    onClick={() => onUpdateCosmetics({ ...cosmetics, armorVariant: armor.id })}
                    className={`p-3.5 rounded-xl border text-left transition-all relative ${
                      isSelected
                        ? 'bg-amber-950/40 border-amber-400 shadow-[0_0_15px_rgba(255,136,0,0.25)]'
                        : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-amber-500/30'
                    }`}
                  >
                    <div className="font-bold text-sm text-white flex items-center justify-between">
                      <span>{armor.name}</span>
                      {isSelected && <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-400/40">ACTIVE</span>}
                    </div>
                    <p className="text-xs text-white/60 mt-1">{armor.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 4: HUD Visor & Underglow Color */}
          <div>
            <div className="flex items-center space-x-2 mb-3">
              <Palette className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs font-black tracking-widest uppercase text-emerald-400">HUD VISOR & UNDERGLOW FREQUENCY</h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {VISOR_COLORS.map(color => {
                const isSelected = cosmetics.visorColor === color.hex || (!cosmetics.visorColor && color.hex === '#00f0ff');
                return (
                  <button
                    key={color.hex}
                    onClick={() => onUpdateCosmetics({ ...cosmetics, visorColor: color.hex, underglowColor: color.hex })}
                    className={`flex items-center space-x-2.5 p-2.5 rounded-xl border transition-all ${
                      isSelected
                        ? 'bg-cyan-950/50 border-cyan-400 shadow-[0_0_10px_rgba(0,240,255,0.3)]'
                        : 'bg-white/5 border-white/10 hover:bg-white/10'
                    }`}
                  >
                    <span
                      className="w-5 h-5 rounded shadow-inner border border-white/30"
                      style={{ backgroundColor: color.hex }}
                    />
                    <span className="text-xs font-bold text-white">{color.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 5: Autonomous Recon Drone Companion */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <Bot className="w-4 h-4 text-cyan-400" />
                <h3 className="text-xs font-black tracking-widest uppercase text-cyan-400">AUTONOMOUS RECON DRONE</h3>
              </div>
              <button
                type="button"
                onClick={() =>
                  onUpdateCosmetics({
                    ...cosmetics,
                    companionEnabled: cosmetics.companionEnabled === false ? true : false,
                  })
                }
                className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider transition-all border ${
                  cosmetics.companionEnabled !== false
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400 shadow-[0_0_10px_rgba(0,240,255,0.3)]'
                    : 'bg-white/5 text-white/40 border-white/10'
                }`}
              >
                {cosmetics.companionEnabled !== false ? '● ACTIVE RECON' : '○ DECOMMISSIONED'}
              </button>
            </div>

            {cosmetics.companionEnabled !== false && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 animate-in fade-in duration-150">
                {COMPANION_MODELS.map(model => {
                  const isSelected =
                    cosmetics.companionStyle === model.id || (!cosmetics.companionStyle && model.id === 'recon-orb');
                  return (
                    <button
                      key={model.id}
                      onClick={() => onUpdateCosmetics({ ...cosmetics, companionStyle: model.id })}
                      className={`p-3 rounded-xl border text-left transition-all relative ${
                        isSelected
                          ? 'bg-cyan-950/40 border-cyan-400 shadow-[0_0_15px_rgba(0,240,255,0.25)]'
                          : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-cyan-500/30'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-white">{model.name}</span>
                        {isSelected && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 font-mono">
                            SYNCED
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-white/60 mt-1 leading-relaxed">{model.desc}</p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-cyan-500/20 flex items-center justify-between">
          <span className="text-xs text-white/40">// TELEMETRY SYNC REAL-TIME</span>
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 text-black font-black text-xs uppercase tracking-widest shadow-[0_0_15px_rgba(0,240,255,0.4)] hover:brightness-110 active:scale-95 transition-all"
          >
            CONFIRM LOADOUT
          </button>
        </div>
      </div>
    </div>
  );
};
