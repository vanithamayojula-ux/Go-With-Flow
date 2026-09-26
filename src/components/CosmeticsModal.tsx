import React, { useState } from 'react';
import { X, Zap, Cpu, Palette, Shield, Sparkles, Activity, Lock, Check, ArrowUpRight, BatteryCharging, Magnet, Rocket, Gauge } from 'lucide-react';
import { CosmeticsConfig, PlayerUpgrades } from '../types';

interface CosmeticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  cosmetics: CosmeticsConfig;
  onUpdateCosmetics: (config: CosmeticsConfig) => void;
  bankedShards?: number;
  upgrades?: PlayerUpgrades;
  onUpgrade?: (upgradeKey: keyof PlayerUpgrades, cost: number) => void;
  unlockedItems?: string[];
  onUnlockItem?: (itemId: string, cost: number) => void;
}

export const CosmeticsModal: React.FC<CosmeticsModalProps> = ({
  isOpen,
  onClose,
  cosmetics,
  onUpdateCosmetics,
  bankedShards = 0,
  upgrades = { magnetLevel: 1, jetpackLevel: 1, overdriveLevel: 1, shieldCapacitorLevel: 0 },
  onUpgrade,
  unlockedItems = ['cyber-phantom', 'electric-cyan', 'carbon-fiber'],
  onUnlockItem,
}) => {
  const [activeTab, setActiveTab] = useState<'upgrades' | 'loadout'>('upgrades');

  if (!isOpen) return null;

  const BOARDS = [
    {
      id: 'cyber-phantom' as const,
      name: 'Cyber Phantom',
      desc: 'Matte carbon stealth hoverboard with high-frequency cyan plasma perimeter.',
      deckColor: '#12151f',
      foilColor: '#00f0ff',
      cost: 0,
    },
    {
      id: 'laser-edge' as const,
      name: 'Laser Edge',
      desc: 'Razor-sharp neon magenta blade engineered for ultra-fast rail grinds.',
      deckColor: '#1a0b16',
      foilColor: '#ff007f',
      cost: 75,
    },
    {
      id: 'grid-runner' as const,
      name: 'Grid Runner',
      desc: 'Tron vector wireframe chassis with acid-green quantum keel.',
      deckColor: '#081a10',
      foilColor: '#00ff66',
      cost: 150,
    },
    {
      id: 'tokyo-neon' as const,
      name: 'Tokyo Neon',
      desc: 'Akira-inspired amber street racing deck with deep violet underglow.',
      deckColor: '#201104',
      foilColor: '#ff8800',
      cost: 250,
    },
    {
      id: 'void-stalker' as const,
      name: 'Void Stalker',
      desc: 'Pure obsidian cosmic deck with pulsing ultraviolet edge.',
      deckColor: '#06060c',
      foilColor: '#9d00ff',
      cost: 400,
    },
  ];

  const TRAILS = [
    {
      id: 'electric-cyan' as const,
      name: 'Electric Cyan Laser',
      desc: 'Blinding 50,000V cyan beam with white-hot core.',
      gradient: 'from-cyan-400 to-blue-500',
      cost: 0,
    },
    {
      id: 'hot-magenta' as const,
      name: 'Hot Magenta Wake',
      desc: 'Synthwave hyper-violet and neon pink afterglow.',
      gradient: 'from-pink-500 to-purple-600',
      cost: 60,
    },
    {
      id: 'acid-green' as const,
      name: 'Acid Matrix Stream',
      desc: 'High-speed encrypted digital phosphor ribbon.',
      gradient: 'from-emerald-400 to-teal-300',
      cost: 120,
    },
    {
      id: 'plasma-rainbow' as const,
      name: 'Plasma Overdrive',
      desc: 'Prismatic dual-phase frequency light trail.',
      gradient: 'from-pink-500 via-cyan-400 to-yellow-300',
      cost: 250,
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

  // Upgrades Configuration
  const UPGRADE_CONFIGS = [
    {
      key: 'magnetLevel' as const,
      title: 'Quantum Shard Magnet',
      icon: Magnet,
      color: 'text-cyan-400',
      bgColor: 'bg-cyan-950/40 border-cyan-400/40',
      barColor: 'bg-cyan-400',
      maxLevel: 5,
      currentLevel: upgrades.magnetLevel,
      costs: [0, 40, 90, 180, 350],
      getStatDesc: (lvl: number) => `Duration: ${(10 + (lvl - 1) * 2.5).toFixed(1)}s | Pull Radius: ${26 + lvl * 4}m`,
      desc: 'Increases quantum shard pull radius and duration across all 3 track lanes.',
    },
    {
      key: 'jetpackLevel' as const,
      title: 'Sonic Jetpack Booster',
      icon: Rocket,
      color: 'text-fuchsia-400',
      bgColor: 'bg-fuchsia-950/40 border-fuchsia-400/40',
      barColor: 'bg-fuchsia-400',
      maxLevel: 5,
      currentLevel: upgrades.jetpackLevel,
      costs: [0, 50, 110, 220, 400],
      getStatDesc: (lvl: number) => `Flight Duration: ${(7 + (lvl - 1) * 1.5).toFixed(1)}s`,
      desc: 'Extends sub-orbital hyperdrive flight, bypassing ground hazards and reaping aerial shards.',
    },
    {
      key: 'overdriveLevel' as const,
      title: 'Overdrive Core Reactor',
      icon: Gauge,
      color: 'text-amber-400',
      bgColor: 'bg-amber-950/40 border-amber-400/40',
      barColor: 'bg-amber-400',
      maxLevel: 5,
      currentLevel: upgrades.overdriveLevel,
      costs: [0, 60, 130, 260, 450],
      getStatDesc: (lvl: number) => `Meter Charge +${(lvl - 1) * 20}% | 2X Duration: ${12 + (lvl - 1) * 3}s`,
      desc: 'Accelerates style and trick overdrive generation and prolongs 2X score multipliers.',
    },
    {
      key: 'shieldCapacitorLevel' as const,
      title: 'Shield Pre-Capacitor',
      icon: Shield,
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-950/40 border-emerald-400/40',
      barColor: 'bg-emerald-400',
      maxLevel: 3,
      currentLevel: upgrades.shieldCapacitorLevel,
      costs: [0, 120, 280, 500],
      getStatDesc: (lvl: number) => lvl > 0 ? 'AUTO-DEPLOY SHIELD AT RUN START: ACTIVE' : 'LOCKED (REQUIRES TIER 1)',
      desc: 'Pre-charges a protective Holo-Shield automatically when launching any run.',
    },
  ];

  return (
    <div
      id="cosmetics-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-xl animate-in fade-in duration-200 font-mono"
    >
      <div
        id="cosmetics-modal-dialog"
        className="w-full max-w-2xl bg-black/95 border-2 border-cyan-500/40 rounded-2xl p-5 sm:p-6 shadow-[0_0_50px_rgba(0,240,255,0.25)] text-white overflow-hidden max-h-[92vh] flex flex-col"
      >
        {/* Header with Balance */}
        <div className="flex items-center justify-between pb-4 border-b border-cyan-500/20">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-cyan-950/60 border border-cyan-400/50 text-cyan-300 shadow-[0_0_10px_rgba(0,240,255,0.3)]">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-wider text-cyan-300 uppercase">CYBER BAY & TECH STATION</h2>
              <p className="text-[11px] text-white/60">Upgrade power-up augments and customize hoverboards</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {/* Wallet Counter */}
            <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-cyan-950/60 border border-cyan-400/50 text-cyan-300 font-mono shadow-sm">
              <span className="text-sm">💎</span>
              <span className="text-xs font-black text-white">{bankedShards.toLocaleString()}</span>
              <span className="text-[9px] text-cyan-400 uppercase font-bold hidden sm:inline">SHARDS</span>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-white/5 hover:bg-cyan-950/40 border border-white/10 hover:border-cyan-500/40 text-white/70 hover:text-cyan-300 transition-all"
              aria-label="Close Dialog"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="grid grid-cols-2 gap-2 mt-4 pb-2 border-b border-white/10">
          <button
            onClick={() => setActiveTab('upgrades')}
            className={`py-2 px-3 rounded-lg text-xs font-black uppercase tracking-wider flex items-center justify-center space-x-2 transition-all ${
              activeTab === 'upgrades'
                ? 'bg-cyan-500 text-black shadow-[0_0_15px_rgba(0,240,255,0.3)]'
                : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'
            }`}
          >
            <BatteryCharging className="w-4 h-4" />
            <span>AUGMENTS & UPGRADES</span>
          </button>
          <button
            onClick={() => setActiveTab('loadout')}
            className={`py-2 px-3 rounded-lg text-xs font-black uppercase tracking-wider flex items-center justify-center space-x-2 transition-all ${
              activeTab === 'loadout'
                ? 'bg-cyan-500 text-black shadow-[0_0_15px_rgba(0,240,255,0.3)]'
                : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'
            }`}
          >
            <Zap className="w-4 h-4" />
            <span>BOARDS & LOADOUT</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto py-4 space-y-6 pr-1 custom-scrollbar">
          {activeTab === 'upgrades' ? (
            /* Tab 1: Augments & Upgrades */
            <div className="space-y-4">
              <div className="text-xs text-cyan-400 font-bold uppercase tracking-wider flex items-center justify-between">
                <span>PERMANENT POWER-UP UPGRADES</span>
                <span className="text-[10px] text-white/50">APPLIED TO ALL RUNS</span>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {UPGRADE_CONFIGS.map(item => {
                  const isMax = item.currentLevel >= item.maxLevel;
                  const nextCost = !isMax ? item.costs[item.currentLevel] || 100 : 0;
                  const canAfford = bankedShards >= nextCost;
                  const Icon = item.icon;

                  return (
                    <div
                      key={item.key}
                      className={`p-4 rounded-xl border ${item.bgColor} flex flex-col justify-between space-y-3 transition-all`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-3">
                          <div className={`p-2.5 rounded-lg bg-black/60 border border-white/10 ${item.color}`}>
                            <Icon className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="flex items-center space-x-2">
                              <h4 className="font-bold text-sm text-white">{item.title}</h4>
                              <span className="text-[10px] px-2 py-0.5 rounded font-black bg-black/60 border border-white/10 text-cyan-300">
                                LVL {item.currentLevel} / {item.maxLevel}
                              </span>
                            </div>
                            <p className="text-xs text-white/60 mt-0.5">{item.desc}</p>
                          </div>
                        </div>

                        {/* Upgrade Button */}
                        <div>
                          {isMax ? (
                            <span className="px-3 py-1.5 rounded-lg bg-white/10 border border-white/20 text-emerald-400 text-xs font-black uppercase tracking-wider flex items-center space-x-1">
                              <Check className="w-3.5 h-3.5" />
                              <span>MAXED</span>
                            </span>
                          ) : (
                            <button
                              onClick={() => onUpgrade && onUpgrade(item.key, nextCost)}
                              disabled={!canAfford}
                              className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider flex items-center space-x-1.5 transition-all ${
                                canAfford
                                  ? 'bg-gradient-to-r from-cyan-400 to-blue-500 text-black hover:brightness-110 shadow-[0_0_12px_rgba(0,240,255,0.4)] active:scale-95'
                                  : 'bg-white/5 border border-white/10 text-white/40 cursor-not-allowed'
                              }`}
                            >
                              <span>UPGRADE</span>
                              <span className="px-1.5 py-0.5 rounded bg-black/40 text-[10px] font-mono text-cyan-200">
                                💎 {nextCost}
                              </span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Stat summary and Level pips */}
                      <div className="pt-2 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <span className="text-[11px] font-mono text-cyan-200">
                          {item.getStatDesc(item.currentLevel)}
                        </span>

                        {/* Level Indicator Pips */}
                        <div className="flex items-center space-x-1">
                          {Array.from({ length: item.maxLevel }).map((_, idx) => (
                            <div
                              key={idx}
                              className={`w-4 h-2 rounded-sm ${
                                idx < item.currentLevel ? item.barColor : 'bg-white/10'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Tab 2: Boards & Loadout */
            <div className="space-y-6">
              {/* Section 1: Hoverboards */}
              <div>
                <div className="flex items-center space-x-2 mb-3">
                  <Zap className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-xs font-black tracking-widest uppercase text-cyan-300">CYBER HOVERBOARDS</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {BOARDS.map(board => {
                    const isUnlocked = board.cost === 0 || unlockedItems.includes(board.id);
                    const isSelected = cosmetics.boardId === board.id;
                    const canAfford = bankedShards >= board.cost;

                    return (
                      <div
                        key={board.id}
                        className={`p-3.5 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
                          isSelected
                            ? 'bg-cyan-950/40 border-cyan-400 shadow-[0_0_15px_rgba(0,240,255,0.25)]'
                            : isUnlocked
                            ? 'bg-white/5 border-white/10 hover:border-cyan-500/30'
                            : 'bg-black/60 border-white/5 opacity-80'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-sm text-white flex items-center space-x-1.5">
                              <span>{board.name}</span>
                              {!isUnlocked && <Lock className="w-3.5 h-3.5 text-white/50" />}
                            </span>
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

                        <div className="mt-3 pt-2 border-t border-white/10 flex items-center justify-between">
                          {isUnlocked ? (
                            isSelected ? (
                              <span className="text-[10px] font-black text-cyan-400 uppercase tracking-widest flex items-center gap-1">
                                <Activity className="w-3 h-3 text-cyan-400 animate-pulse" />
                                EQUIPPED
                              </span>
                            ) : (
                              <button
                                onClick={() => onUpdateCosmetics({ ...cosmetics, boardId: board.id })}
                                className="px-2.5 py-1 rounded bg-cyan-950/60 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-300 text-[10px] font-black uppercase tracking-wider transition-all"
                              >
                                EQUIP
                              </button>
                            )
                          ) : (
                            <button
                              onClick={() => onUnlockItem && onUnlockItem(board.id, board.cost)}
                              disabled={!canAfford}
                              className={`px-3 py-1 rounded text-[10px] font-black uppercase tracking-wider flex items-center space-x-1 transition-all ${
                                canAfford
                                  ? 'bg-amber-500 text-black hover:brightness-110 shadow-sm'
                                  : 'bg-white/5 text-white/30 border border-white/10 cursor-not-allowed'
                              }`}
                            >
                              <span>UNLOCK</span>
                              <span className="font-mono">💎 {board.cost}</span>
                            </button>
                          )}
                        </div>
                      </div>
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
                    const isUnlocked = trail.cost === 0 || unlockedItems.includes(trail.id);
                    const isSelected = cosmetics.trailId === trail.id;
                    const canAfford = bankedShards >= trail.cost;

                    return (
                      <div
                        key={trail.id}
                        className={`p-3.5 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
                          isSelected
                            ? 'bg-pink-950/40 border-pink-400 shadow-[0_0_15px_rgba(255,0,127,0.25)]'
                            : isUnlocked
                            ? 'bg-white/5 border-white/10 hover:border-pink-500/30'
                            : 'bg-black/60 border-white/5 opacity-80'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-sm text-white flex items-center space-x-1.5">
                              <span>{trail.name}</span>
                              {!isUnlocked && <Lock className="w-3.5 h-3.5 text-white/50" />}
                            </span>
                            <div className={`w-12 h-3.5 rounded bg-gradient-to-r ${trail.gradient} shadow-sm`} />
                          </div>
                          <p className="text-xs text-white/60 mt-1 leading-relaxed">{trail.desc}</p>
                        </div>

                        <div className="mt-3 pt-2 border-t border-white/10 flex items-center justify-between">
                          {isUnlocked ? (
                            isSelected ? (
                              <span className="text-[10px] font-black text-pink-400 uppercase tracking-widest inline-block">
                                ACTIVE STREAM
                              </span>
                            ) : (
                              <button
                                onClick={() => onUpdateCosmetics({ ...cosmetics, trailId: trail.id })}
                                className="px-2.5 py-1 rounded bg-pink-950/60 hover:bg-pink-900 border border-pink-500/40 text-pink-300 text-[10px] font-black uppercase tracking-wider transition-all"
                              >
                                EQUIP
                              </button>
                            )
                          ) : (
                            <button
                              onClick={() => onUnlockItem && onUnlockItem(trail.id, trail.cost)}
                              disabled={!canAfford}
                              className={`px-3 py-1 rounded text-[10px] font-black uppercase tracking-wider flex items-center space-x-1 transition-all ${
                                canAfford
                                  ? 'bg-pink-500 text-white hover:brightness-110 shadow-sm'
                                  : 'bg-white/5 text-white/30 border border-white/10 cursor-not-allowed'
                              }`}
                            >
                              <span>UNLOCK</span>
                              <span className="font-mono">💎 {trail.cost}</span>
                            </button>
                          )}
                        </div>
                      </div>
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
                          {isSelected && <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-400/40">EQUIPPED</span>}
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
