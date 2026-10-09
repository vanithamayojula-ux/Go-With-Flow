import React, { useEffect, useRef, useState } from 'react';
import {
  Play,
  Volume2,
  VolumeX,
  Settings,
  Trophy,
  Lock,
  Unlock,
  Check,
  Zap,
  BatteryCharging,
  Magnet,
  Rocket,
  Gauge,
  Shield,
  Sparkles,
  ExternalLink,
  BookOpen,
  Cpu,
  ChevronRight,
  Activity,
  Layers,
} from 'lucide-react';
import { HeroDef } from '../game/heroes';
import {
  CosmeticsConfig,
  HeroId,
  PlayerUpgrades,
  SessionGoal,
  QualityPreset,
  GraphicsConfig,
  ShaderParams,
} from '../types';
import { GAME_VERSION } from '../version';

export interface OpeningScreenProps {
  heroes: HeroDef[];
  selectedHero: HeroId;
  boardId: string;
  trailId: string;
  bankedShards: number;
  highScore: number;
  bestDistance: number;
  upgrades: PlayerUpgrades;
  unlocked: string[];
  onSelectHero: (id: HeroId) => void;
  onUnlockHero: (id: HeroId, cost: number) => boolean | void;
  onSelectBoard: (id: string) => void;
  onSelectTrail: (id: string) => void;
  onUpgradeTech: (key: keyof PlayerUpgrades, cost: number) => void;
  onOpenShop: (tab?: 'heroes' | 'boards' | 'tech') => void;
  onPlay: () => void;
  onHowTo: () => void;
  onSettings: () => void;
  onOpenModes?: () => void;
  activeModeName?: string;
  onOpenCompetitive?: () => void;
  isMuted?: boolean;
  onToggleMute?: () => void;
  missions?: SessionGoal[];
  onClaimMission?: (id: string) => void;
  onOpenProgression?: () => void;
  playerLevel?: number;
  graphicsConfig?: GraphicsConfig;
  shaderParams?: ShaderParams;
}

const BOARDS = [
  {
    id: 'cyber-phantom',
    name: 'Cyber Phantom',
    deckColor: '#12151f',
    foilColor: '#00f0ff',
    cost: 0,
  },
  {
    id: 'laser-edge',
    name: 'Laser Edge',
    deckColor: '#1a0b16',
    foilColor: '#ff007f',
    cost: 75,
  },
  {
    id: 'grid-runner',
    name: 'Grid Runner',
    deckColor: '#081a10',
    foilColor: '#00ff66',
    cost: 150,
  },
  {
    id: 'tokyo-neon',
    name: 'Tokyo Neon',
    deckColor: '#201104',
    foilColor: '#ff8800',
    cost: 250,
  },
  {
    id: 'void-stalker',
    name: 'Void Stalker',
    deckColor: '#06060c',
    foilColor: '#9d00ff',
    cost: 400,
  },
];

const TRAILS = [
  {
    id: 'electric-cyan',
    name: 'Electric Cyan',
    gradient: 'from-cyan-400 to-blue-500',
    cost: 0,
  },
  {
    id: 'hot-magenta',
    name: 'Hot Magenta',
    gradient: 'from-pink-500 to-purple-600',
    cost: 60,
  },
  {
    id: 'acid-green',
    name: 'Acid Matrix',
    gradient: 'from-emerald-400 to-teal-300',
    cost: 120,
  },
  {
    id: 'plasma-rainbow',
    name: 'Plasma Overdrive',
    gradient: 'from-pink-500 via-cyan-400 to-yellow-300',
    cost: 250,
  },
];

const TECH_CONFIGS = [
  {
    key: 'magnetLevel' as const,
    title: 'Quantum Magnet',
    icon: Magnet,
    color: 'text-cyan-400',
    maxLevel: 5,
    costs: [0, 40, 90, 180, 350],
    getStatDesc: (lvl: number) => `${(10 + (lvl - 1) * 2.5).toFixed(1)}s · ${26 + lvl * 4}m pull`,
  },
  {
    key: 'jetpackLevel' as const,
    title: 'Sonic Jetpack',
    icon: Rocket,
    color: 'text-fuchsia-400',
    maxLevel: 5,
    costs: [0, 50, 110, 220, 400],
    getStatDesc: (lvl: number) => `${(7 + (lvl - 1) * 1.5).toFixed(1)}s flight`,
  },
  {
    key: 'overdriveLevel' as const,
    title: 'Overdrive Core',
    icon: Gauge,
    color: 'text-amber-400',
    maxLevel: 5,
    costs: [0, 60, 130, 260, 450],
    getStatDesc: (lvl: number) => `${12 + (lvl - 1) * 3}s 2X boost`,
  },
  {
    key: 'shieldCapacitorLevel' as const,
    title: 'Shield Capacitor',
    icon: Shield,
    color: 'text-emerald-400',
    maxLevel: 3,
    costs: [0, 120, 280, 500],
    getStatDesc: (lvl: number) => (lvl > 0 ? 'AUTO-DEPLOY' : 'LOCKED (LV 1)'),
  },
];

export const OpeningScreen: React.FC<OpeningScreenProps> = ({
  heroes,
  selectedHero,
  boardId,
  trailId,
  bankedShards,
  highScore,
  bestDistance,
  upgrades,
  unlocked,
  onSelectHero,
  onUnlockHero,
  onSelectBoard,
  onSelectTrail,
  onUpgradeTech,
  onOpenShop,
  onPlay,
  onHowTo,
  onSettings,
  onOpenModes,
  activeModeName,
  onOpenCompetitive,
  isMuted = false,
  onToggleMute,
  missions = [],
  onClaimMission,
  onOpenProgression,
  playerLevel = 1,
  graphicsConfig,
  shaderParams,
}) => {
  const playButtonRef = useRef<HTMLButtonElement | null>(null);
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  // Detect coarse pointer (mobile touch)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const match = window.matchMedia('(pointer: coarse)');
      setIsTouchDevice(match.matches);
      const listener = (e: MediaQueryListEvent) => setIsTouchDevice(e.matches);
      match.addEventListener('change', listener);
      return () => match.removeEventListener('change', listener);
    }
  }, []);

  // Autofocus the play button for immediate keyboard play
  useEffect(() => {
    playButtonRef.current?.focus();
  }, []);

  // Keyboard navigation for hero carousel & start
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is inside an input or modal
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'SELECT') {
        return;
      }

      const currentIndex = heroes.findIndex((h) => h.id === selectedHero);
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        const prevIndex = (currentIndex - 1 + heroes.length) % heroes.length;
        onSelectHero(heroes[prevIndex].id);
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        const nextIndex = (currentIndex + 1) % heroes.length;
        onSelectHero(heroes[nextIndex].id);
      } else if (e.key === 'Enter' || e.key === ' ') {
        // Space / Enter launches if play button or container is active
        if (
          document.activeElement === playButtonRef.current ||
          document.activeElement?.tagName === 'BODY' ||
          document.activeElement?.id === 'skyflow-app-container'
        ) {
          e.preventDefault();
          onPlay();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [heroes, selectedHero, onSelectHero, onPlay]);

  return (
    <div
      id="opening-screen-root"
      className="min-h-dvh flex flex-col bg-[#020512] text-cyan-100 overflow-x-hidden touch-manipulation select-none pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] font-mono"
    >
      {/* ------------------------------------------------------------------- */}
      {/* HEADER BAR */}
      {/* ------------------------------------------------------------------- */}
      <header className="h-12 px-4 flex items-center justify-between bg-black/60 backdrop-blur sticky top-0 z-30 border-b border-cyan-500/20">
        {/* Left: Brand & Biome Tag */}
        <div className="flex items-center space-x-2.5">
          <div className="flex items-center space-x-2">
            <div className="w-2.5 h-2.5 rounded-sm bg-cyan-400 animate-pulse shadow-[0_0_8px_rgba(0,240,255,0.8)]" />
            <span className="font-black text-sm tracking-widest text-cyan-300 drop-shadow-[0_0_10px_rgba(0,240,255,0.4)]">
              NEON // DRIFT
            </span>
          </div>

          <div className="hidden sm:flex items-center space-x-1.5 px-2 py-0.5 rounded bg-cyan-950/60 border border-cyan-500/30 text-[10px] font-bold text-cyan-300">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
            <span>WORLD 1 // NEON UNDERCITY</span>
          </div>
        </div>

        {/* Right: Wallet & Toolbar (Min 48px Touch Targets) */}
        <div className="flex items-center space-x-2">
          {/* Banked Shards */}
          <div
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-cyan-950/60 border border-cyan-400/50 text-cyan-300 font-mono shadow-sm"
            title="Total Banked Shards"
          >
            <span className="text-sm">💎</span>
            <span className="text-xs font-black text-white">{bankedShards.toLocaleString()}</span>
          </div>

          {/* Pilot Level / Progression Button */}
          {onOpenProgression && (
            <button
              onClick={onOpenProgression}
              className="min-h-[48px] px-3 flex items-center space-x-1.5 rounded-xl bg-gradient-to-r from-cyan-950/80 to-blue-950/80 hover:from-cyan-900/90 hover:to-blue-900/90 border border-cyan-400/50 text-cyan-300 hover:text-white transition-all cursor-pointer shadow-sm"
              title="View Pilot Progression & Daily Directives"
            >
              <Zap className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-xs font-black">LVL {playerLevel}</span>
            </button>
          )}

          {/* High Score */}
          <div
            className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl bg-amber-950/50 border border-amber-500/40 text-amber-300 font-mono shadow-sm"
            title="Personal Best Score"
          >
            <Trophy className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-xs font-black text-amber-100">{highScore.toLocaleString()}</span>
          </div>

          {/* Audio Mute Toggle */}
          {onToggleMute && (
            <button
              onClick={onToggleMute}
              className="min-h-[48px] min-w-[48px] flex items-center justify-center rounded-xl bg-white/5 hover:bg-cyan-950/40 border border-white/10 hover:border-cyan-500/40 text-white/70 hover:text-cyan-300 focus-visible:ring-2 focus-visible:ring-cyan-400 transition-all cursor-pointer"
              aria-label={isMuted ? 'Unmute Audio' : 'Mute Audio'}
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
            </button>
          )}

          {/* Settings Button */}
          <button
            onClick={onSettings}
            className="min-h-[48px] min-w-[48px] flex items-center justify-center rounded-xl bg-white/5 hover:bg-cyan-950/40 border border-white/10 hover:border-cyan-500/40 text-white/70 hover:text-cyan-300 focus-visible:ring-2 focus-visible:ring-cyan-400 transition-all cursor-pointer"
            aria-label="Open Game Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* ------------------------------------------------------------------- */}
      {/* MAIN CONTENT GRID */}
      {/* ------------------------------------------------------------------- */}
      <main className="w-full max-w-7xl mx-auto p-3 sm:p-4 grid gap-4 lg:grid-cols-[320px_1fr_300px] flex-1">
        {/* ================================================================= */}
        {/* A) HEROES PANEL (Left) */}
        {/* ================================================================= */}
        <section
          aria-label="Hero Characters"
          className="flex flex-col bg-black/60 border border-cyan-500/20 rounded-2xl p-3.5 sm:p-4 backdrop-blur-md shadow-lg shadow-cyan-950/30"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 rounded-full bg-cyan-400" />
              <h2 className="text-xs font-black tracking-widest uppercase text-cyan-300">HERO ROSTER</h2>
            </div>
            <span className="text-[10px] text-white/50">
              {heroes.filter((h) => h.cost === 0 || unlocked.includes(h.id)).length}/{heroes.length} UNLOCKED
            </span>
          </div>

          {/* Hero Cards: Vertical list on Desktop, Horizontal Snap Carousel on Mobile */}
          <div className="flex flex-row lg:flex-col snap-x snap-mandatory overflow-x-auto lg:overflow-y-auto gap-3 pb-2 lg:pb-0 custom-scrollbar flex-1 max-h-[580px]">
            {heroes.map((hero) => {
              const isSelected = selectedHero === hero.id;
              const isUnlocked = hero.cost === 0 || unlocked.includes(hero.id);
              const heroColorHex = `#${hero.color.toString(16).padStart(6, '0')}`;
              const heroTrailHex = `#${hero.trail.toString(16).padStart(6, '0')}`;
              const canAfford = bankedShards >= hero.cost;

              return (
                <div
                  key={hero.id}
                  className={`min-w-[158px] sm:min-w-[180px] lg:min-w-0 rounded-2xl border-2 bg-black/50 p-2.5 sm:p-3 flex flex-col justify-between transition-all relative snap-center ${
                    isSelected
                      ? 'shadow-[0_0_20px_rgba(0,240,255,0.35)] bg-cyan-950/40'
                      : 'border-white/10 hover:border-cyan-500/40 hover:bg-white/5'
                  }`}
                  style={{ borderColor: isSelected ? '#00f0ff' : `${heroColorHex}80` }}
                >
                  <div>
                    {/* Thumbnail Image */}
                    <div className="relative w-full aspect-square rounded-xl overflow-hidden bg-slate-950 border border-white/10 mb-2">
                      <img
                        src={hero.previewUrl}
                        alt={hero.name}
                        className="w-full h-full object-cover object-center transition-transform hover:scale-105 duration-300"
                        loading="lazy"
                      />

                      {/* Locked Overlay */}
                      {!isUnlocked && (
                        <div className="absolute inset-0 bg-black/75 backdrop-blur-[2px] flex flex-col items-center justify-center p-2 text-center">
                          <Lock className="w-5 h-5 text-amber-400 mb-1" />
                          <span className="text-[10px] font-black tracking-wider text-amber-300 uppercase">
                            🔒 {hero.cost} 💎
                          </span>
                        </div>
                      )}

                      {/* Ult / Archetype Pill */}
                      <div
                        className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider backdrop-blur-md border border-white/20"
                        style={{ backgroundColor: `${heroColorHex}50`, color: heroTrailHex }}
                      >
                        {hero.ult?.type || 'SPECIAL'}
                      </div>
                    </div>

                    {/* Name & Trail Accent Dots */}
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs sm:text-sm text-white truncate mr-1">{hero.name}</span>
                      <div className="flex items-center space-x-1 shrink-0">
                        <span
                          className="w-2.5 h-2.5 rounded-full border border-black/50"
                          style={{ backgroundColor: heroColorHex }}
                          title="Accent Color"
                        />
                        <span
                          className="w-2.5 h-2.5 rounded-full border border-black/50 shadow-sm"
                          style={{ backgroundColor: heroTrailHex }}
                          title="Trail Glow"
                        />
                      </div>
                    </div>

                    <p className="text-[10px] text-white/60 mt-0.5 line-clamp-2 leading-tight">{hero.blurb}</p>
                  </div>

                  {/* Footer Button */}
                  <div className="mt-2.5">
                    {isSelected ? (
                      <div className="w-full min-h-[40px] py-1.5 px-2 rounded-xl bg-cyan-500/20 border border-cyan-400 text-cyan-300 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1 shadow-[0_0_10px_rgba(0,240,255,0.3)]">
                        <Activity className="w-3 h-3 text-cyan-400 animate-pulse" />
                        SELECTED
                      </div>
                    ) : isUnlocked ? (
                      <button
                        type="button"
                        onClick={() => onSelectHero(hero.id)}
                        className="w-full min-h-[40px] py-1.5 px-2 rounded-xl bg-white/10 hover:bg-cyan-500/30 border border-white/20 hover:border-cyan-400 text-white hover:text-cyan-200 text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 flex items-center justify-center cursor-pointer focus-visible:ring-2 focus-visible:ring-cyan-400"
                      >
                        EQUIP HERO
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onUnlockHero(hero.id, hero.cost)}
                        disabled={!canAfford}
                        className={`w-full min-h-[40px] py-1.5 px-2 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1 transition-all active:scale-95 cursor-pointer focus-visible:ring-2 focus-visible:ring-amber-400 ${
                          canAfford
                            ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-black shadow-[0_0_10px_rgba(245,158,11,0.4)] hover:brightness-110'
                            : 'bg-white/5 border border-white/10 text-white/30 cursor-not-allowed'
                        }`}
                      >
                        <Unlock className="w-3 h-3" />
                        <span>UNLOCK ({hero.cost} 💎)</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ================================================================= */}
        {/* B) CENTER PLAY PANEL (Middle) */}
        {/* ================================================================= */}
        <section
          aria-label="Game Launcher"
          className="flex flex-col justify-between bg-black/60 border border-cyan-500/20 rounded-2xl p-4 sm:p-6 backdrop-blur-md shadow-lg shadow-cyan-950/30 text-center relative overflow-hidden"
        >
          {/* Subtle Ambient Backdrops */}
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-72 h-72 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 left-1/2 -translate-x-1/2 w-72 h-72 bg-fuchsia-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Top Title & Tagline */}
          <div className="relative z-10 pt-2 sm:pt-4">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-400/40 text-cyan-300 text-[10px] font-black uppercase tracking-widest mb-2 shadow-[0_0_10px_rgba(0,240,255,0.2)]">
              <Zap className="w-3 h-3 text-cyan-400" />
              <span>HIGH-VELOCITY CYBERPUNK SURFER</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-white to-pink-400 uppercase drop-shadow-[0_0_25px_rgba(0,240,255,0.5)]">
              NEON DRIFT
            </h1>
            <p className="text-xs sm:text-sm text-cyan-200/70 mt-1 max-w-md mx-auto">
              Surf the endless neon chasm, carve through quantum rails, and defy the void.
            </p>
          </div>

          {/* Live Telemetry Stats Row */}
          <div className="relative z-10 my-4 grid grid-cols-3 gap-2 sm:gap-3 max-w-lg mx-auto w-full">
            <div className="p-2.5 sm:p-3 rounded-xl bg-slate-950/80 border border-cyan-500/30 flex flex-col items-center">
              <span className="text-[9px] sm:text-[10px] uppercase font-bold text-cyan-400">BEST SCORE</span>
              <span className="text-base sm:text-xl font-black text-white font-mono">{highScore.toLocaleString()}</span>
            </div>

            <div className="p-2.5 sm:p-3 rounded-xl bg-slate-950/80 border border-pink-500/30 flex flex-col items-center">
              <span className="text-[9px] sm:text-[10px] uppercase font-bold text-pink-400">MAX DISTANCE</span>
              <span className="text-base sm:text-xl font-black text-pink-200 font-mono">{bestDistance}M</span>
            </div>

            <div className="p-2.5 sm:p-3 rounded-xl bg-slate-950/80 border border-amber-500/30 flex flex-col items-center">
              <span className="text-[9px] sm:text-[10px] uppercase font-bold text-amber-400">BANKED SHARDS</span>
              <span className="text-base sm:text-xl font-black text-amber-200 font-mono">💎 {bankedShards}</span>
            </div>
          </div>

          {/* Massive Action Section: PLAY BUTTON & MODES */}
          <div className="relative z-10 space-y-3 max-w-lg mx-auto w-full">
            {/* Game Mode Selector Button */}
            {onOpenModes && (
              <button
                onClick={onOpenModes}
                className="w-full py-2.5 px-3 rounded-xl bg-amber-950/50 hover:bg-amber-950/70 border border-amber-500/50 text-amber-300 text-xs font-black uppercase tracking-wider flex items-center justify-between transition-all cursor-pointer shadow-md shadow-amber-950/40 active:scale-95"
              >
                <div className="flex items-center space-x-2">
                  <span className="text-sm">🎯</span>
                  <span className="text-[10px] text-white/60">ACTIVE MODE:</span>
                  <span className="text-white font-black">{activeModeName || 'STANDARD RUN'}</span>
                </div>
                <div className="flex items-center space-x-1 text-[10px] text-amber-400 font-bold">
                  <span>CHANGE MODE / TRIALS</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </div>
              </button>
            )}

            <button
              ref={playButtonRef}
              onClick={onPlay}
              className="w-full min-h-[72px] sm:min-h-[80px] text-xl sm:text-2xl font-black uppercase tracking-widest bg-cyan-400 hover:bg-cyan-300 text-black rounded-2xl shadow-[0_0_35px_rgba(0,240,255,0.6)] active:scale-95 transition-all flex items-center justify-center space-x-3 cursor-pointer focus-visible:ring-4 focus-visible:ring-cyan-200"
              aria-label="Launch Neon Drift Run (Press Space or Enter)"
            >
              <Play className="w-7 h-7 fill-current" />
              <span>LAUNCH RUN</span>
            </button>

            {/* Secondary Action Row */}
            <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
              <button
                onClick={() => onOpenShop('tech')}
                className="min-h-[48px] px-2 py-2 rounded-xl bg-white/5 hover:bg-cyan-950/40 border border-white/10 hover:border-cyan-500/40 text-xs font-bold text-cyan-200 flex items-center justify-center space-x-1.5 transition-all active:scale-95 cursor-pointer focus-visible:ring-2 focus-visible:ring-cyan-400"
              >
                <Cpu className="w-4 h-4 text-cyan-400 shrink-0" />
                <span className="truncate hidden sm:inline">TECH BAY</span>
                <span className="truncate sm:hidden">TECH</span>
              </button>

              {onOpenCompetitive && (
                <button
                  onClick={onOpenCompetitive}
                  className="min-h-[48px] px-2 py-2 rounded-xl bg-amber-950/40 hover:bg-amber-950/60 border border-amber-500/40 hover:border-amber-400 text-xs font-bold text-amber-300 flex items-center justify-center space-x-1.5 transition-all active:scale-95 cursor-pointer focus-visible:ring-2 focus-visible:ring-amber-400"
                >
                  <Trophy className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="truncate hidden sm:inline">COMPETE</span>
                  <span className="truncate sm:hidden">RANKS</span>
                </button>
              )}

              <button
                onClick={onHowTo}
                className="min-h-[48px] px-2 py-2 rounded-xl bg-white/5 hover:bg-cyan-950/40 border border-white/10 hover:border-cyan-500/40 text-xs font-bold text-cyan-200 flex items-center justify-center space-x-1.5 transition-all active:scale-95 cursor-pointer focus-visible:ring-2 focus-visible:ring-cyan-400"
              >
                <BookOpen className="w-4 h-4 text-cyan-400 shrink-0" />
                <span className="truncate hidden sm:inline">GUIDE</span>
                <span className="truncate sm:hidden">GUIDE</span>
              </button>

              <a
                href={`hero-lab.html?hero=${selectedHero}&pose=run&view=three&time=1.0`}
                target="_blank"
                rel="noreferrer"
                className="min-h-[48px] px-2 py-2 rounded-xl bg-white/5 hover:bg-cyan-950/40 border border-white/10 hover:border-cyan-500/40 text-xs font-bold text-cyan-200 flex items-center justify-center space-x-1.5 transition-all active:scale-95 cursor-pointer focus-visible:ring-2 focus-visible:ring-cyan-400"
                title="Inspect 3D Hero in Lab View"
              >
                <Layers className="w-4 h-4 text-cyan-400 shrink-0" />
                <span className="truncate hidden sm:inline">LAB</span>
                <ExternalLink className="w-3 h-3 opacity-60 shrink-0" />
              </a>
            </div>
          </div>

          {/* Controls Hint Row (Responsive Phone vs Desktop) */}
          <div className="relative z-10 pt-3 border-t border-cyan-500/20 text-[11px] text-white/60">
            {isTouchDevice ? (
              <div className="flex items-center justify-center space-x-2 flex-wrap gap-y-1">
                <span className="text-cyan-400 font-bold">TOUCH CONTROLS:</span>
                <span>Swipe ◀▶ Lanes</span>
                <span>•</span>
                <span>Swipe ▲ Jump</span>
                <span>•</span>
                <span>Swipe ▼ Slide</span>
                <span>•</span>
                <span>Double-Tap Shield</span>
              </div>
            ) : (
              <div className="flex items-center justify-center space-x-2 flex-wrap gap-y-1">
                <span>
                  <kbd className="px-1.5 py-0.5 rounded bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 font-bold">A/D</kbd> Lanes
                </span>
                <span>•</span>
                <span>
                  <kbd className="px-1.5 py-0.5 rounded bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 font-bold">Space/W</kbd> Jump
                </span>
                <span>•</span>
                <span>
                  <kbd className="px-1.5 py-0.5 rounded bg-pink-950/80 border border-pink-500/40 text-pink-300 font-bold">S</kbd> Slide
                </span>
                <span>•</span>
                <span>
                  <kbd className="px-1.5 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 font-bold">2x Space</kbd> Shield
                </span>
                <span>•</span>
                <span>
                  <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white font-bold">J/K/L/I</kbd> Stunts
                </span>
              </div>
            )}
          </div>
        </section>

        {/* ================================================================= */}
        {/* C) LOADOUT & TECH PANEL (Right) */}
        {/* ================================================================= */}
        <section
          aria-label="Loadout & Augments"
          className="flex flex-col space-y-4 bg-black/60 border border-cyan-500/20 rounded-2xl p-3.5 sm:p-4 backdrop-blur-md shadow-lg shadow-cyan-950/30 overflow-y-auto max-h-[680px] custom-scrollbar"
        >
          {/* Section 1: Hoverboards Selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <Zap className="w-3.5 h-3.5 text-cyan-400" />
                <h3 className="text-xs font-black tracking-widest uppercase text-cyan-300">HOVERBOARDS</h3>
              </div>
              <button
                onClick={() => onOpenShop('boards')}
                className="text-[10px] text-cyan-400 hover:text-cyan-200 underline cursor-pointer"
              >
                ALL BOARDS
              </button>
            </div>

            <div className="grid grid-cols-1 gap-1.5">
              {BOARDS.map((board) => {
                const isSelected = boardId === board.id;
                const isUnlocked = board.cost === 0 || unlocked.includes(board.id);

                return (
                  <button
                    key={board.id}
                    onClick={() => {
                      if (isUnlocked) onSelectBoard(board.id);
                      else onOpenShop('boards');
                    }}
                    className={`p-2 rounded-xl border text-left transition-all flex items-center justify-between cursor-pointer min-h-[44px] ${
                      isSelected
                        ? 'bg-cyan-950/60 border-cyan-400 shadow-[0_0_10px_rgba(0,240,255,0.25)]'
                        : isUnlocked
                        ? 'bg-white/5 border-white/10 hover:bg-white/10'
                        : 'bg-black/60 border-white/5 opacity-70'
                    }`}
                  >
                    <div className="flex items-center space-x-2 truncate">
                      <div className="flex items-center space-x-1 shrink-0">
                        <span
                          className="w-3 h-3 rounded border border-black/40"
                          style={{ backgroundColor: board.deckColor }}
                        />
                        <span
                          className="w-3 h-3 rounded border border-black/40 shadow-sm"
                          style={{ backgroundColor: board.foilColor }}
                        />
                      </div>
                      <span className="text-xs font-bold text-white truncate">{board.name}</span>
                    </div>

                    <div className="shrink-0 ml-2">
                      {isSelected ? (
                        <span className="text-[9px] font-black text-cyan-400 uppercase">EQUIPPED</span>
                      ) : isUnlocked ? (
                        <span className="text-[9px] text-white/50">SELECT</span>
                      ) : (
                        <span className="text-[9px] text-amber-400 font-bold flex items-center gap-0.5">
                          <Lock className="w-2.5 h-2.5" /> {board.cost}💎
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 2: Energy Trail Ribbons */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-3.5 h-3.5 text-pink-400" />
                <h3 className="text-xs font-black tracking-widest uppercase text-pink-400">ENERGY TRAILS</h3>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              {TRAILS.map((trail) => {
                const isSelected = trailId === trail.id;
                const isUnlocked = trail.cost === 0 || unlocked.includes(trail.id);

                return (
                  <button
                    key={trail.id}
                    onClick={() => {
                      if (isUnlocked) onSelectTrail(trail.id);
                      else onOpenShop('boards');
                    }}
                    className={`p-2 rounded-xl border text-left transition-all flex flex-col justify-between cursor-pointer min-h-[50px] ${
                      isSelected
                        ? 'bg-pink-950/50 border-pink-400 shadow-[0_0_10px_rgba(255,0,127,0.25)]'
                        : isUnlocked
                        ? 'bg-white/5 border-white/10 hover:bg-white/10'
                        : 'bg-black/60 border-white/5 opacity-70'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-white truncate">{trail.name}</span>
                      {isSelected && <Check className="w-3 h-3 text-pink-400" />}
                    </div>
                    <div className={`w-full h-1.5 rounded-full bg-gradient-to-r ${trail.gradient} mt-1`} />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 3: Tech Augments Preview */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <BatteryCharging className="w-3.5 h-3.5 text-cyan-400" />
                <h3 className="text-xs font-black tracking-widest uppercase text-cyan-300">TECH AUGMENTS</h3>
              </div>
              <button
                onClick={() => onOpenShop('tech')}
                className="text-[10px] text-cyan-400 hover:text-cyan-200 underline cursor-pointer"
              >
                UPGRADE
              </button>
            </div>

            <div className="space-y-1.5">
              {TECH_CONFIGS.map((tech) => {
                const currentLevel = upgrades[tech.key] || (tech.key === 'shieldCapacitorLevel' ? 0 : 1);
                const isMax = currentLevel >= tech.maxLevel;
                const nextCost = !isMax ? tech.costs[currentLevel] || 100 : 0;
                const canAfford = bankedShards >= nextCost;
                const Icon = tech.icon;

                return (
                  <div
                    key={tech.key}
                    className="p-2.5 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between"
                  >
                    <div className="flex items-center space-x-2 truncate mr-2">
                      <div className={`p-1.5 rounded-lg bg-black/60 border border-white/10 ${tech.color}`}>
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <div className="truncate">
                        <div className="text-xs font-bold text-white truncate flex items-center gap-1.5">
                          <span>{tech.title}</span>
                          <span className="text-[9px] px-1 rounded bg-black/60 text-cyan-300 font-bold">
                            LV {currentLevel}/{tech.maxLevel}
                          </span>
                        </div>
                        <div className="flex items-center space-x-1 my-0.5">
                          {Array.from({ length: tech.maxLevel }).map((_, idx) => (
                            <span
                              key={idx}
                              className={`w-2 h-1.5 rounded-sm transition-all ${
                                idx < currentLevel
                                  ? 'bg-cyan-400 shadow-[0_0_5px_rgba(0,240,255,0.8)]'
                                  : 'bg-white/10'
                              }`}
                            />
                          ))}
                        </div>
                        <div className="text-[10px] text-white/50">{tech.getStatDesc(currentLevel)}</div>
                      </div>
                    </div>

                    <div className="shrink-0">
                      {isMax ? (
                        <span className="text-[9px] font-black text-emerald-400">MAX</span>
                      ) : (
                        <button
                          onClick={() => onUpgradeTech(tech.key, nextCost)}
                          disabled={!canAfford}
                          className={`min-h-[36px] px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer ${
                            canAfford
                              ? 'bg-cyan-400 hover:bg-cyan-300 text-black shadow-sm'
                              : 'bg-white/5 border border-white/10 text-white/30 cursor-not-allowed'
                          }`}
                        >
                          <span>+1</span>
                          <span>💎{nextCost}</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 4: Daily Missions Preview */}
          {missions.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <Trophy className="w-3.5 h-3.5 text-amber-400" />
                  <h3 className="text-xs font-black tracking-widest uppercase text-amber-400">PROTOCOL MISSIONS</h3>
                </div>
              </div>

              <div className="space-y-1.5">
                {missions.map((m) => {
                  const pct = Math.min(100, Math.round((m.current / m.target) * 100));
                  return (
                    <div
                      key={m.id}
                      className="p-2 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between text-left"
                    >
                      <div className="flex-1 pr-2 truncate">
                        <div className="text-xs font-bold text-white/90 truncate">{m.title}</div>
                        <div className="text-[9px] text-white/50 truncate">{m.desc}</div>
                        <div className="w-full bg-black/60 rounded-full h-1 mt-1 overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 ${
                              m.completed ? 'bg-emerald-400' : 'bg-cyan-400'
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>

                      <div className="shrink-0 flex flex-col items-end">
                        <span className="text-[9px] font-mono text-cyan-300">+{m.rewardShards} 💎</span>
                        {m.claimed ? (
                          <span className="text-[8px] text-emerald-400 font-bold">CLAIMED</span>
                        ) : m.completed ? (
                          <button
                            onClick={() => onClaimMission?.(m.id)}
                            className="mt-0.5 px-2 py-0.5 rounded bg-emerald-400 text-black text-[9px] font-black cursor-pointer"
                          >
                            CLAIM
                          </button>
                        ) : (
                          <span className="text-[8px] text-white/40 font-mono">
                            {m.current}/{m.target}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section 5: Engine & Settings Preview */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <Settings className="w-3.5 h-3.5 text-cyan-400" />
                <h3 className="text-xs font-black tracking-widest uppercase text-cyan-300">SYSTEM PREVIEW</h3>
              </div>
              <button
                onClick={onSettings}
                className="text-[10px] text-cyan-400 hover:text-cyan-200 underline cursor-pointer"
              >
                CONFIG
              </button>
            </div>

            <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-[10px] space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-white/60">GRAPHICS:</span>
                <span className="font-bold text-cyan-300 uppercase">
                  {graphicsConfig?.preset === 'desktop-full'
                    ? 'ULTRA (PC)'
                    : graphicsConfig?.preset === 'mobile-opt'
                    ? 'BALANCED'
                    : 'LOW / MIN'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/60">VFX (BLOOM/CA):</span>
                <span className="font-mono text-white/80">
                  {((shaderParams?.bloomStrength ?? shaderParams?.bloomIntensity) !== undefined)
                    ? `${(shaderParams?.bloomStrength ?? shaderParams?.bloomIntensity ?? 0).toFixed(1)}X`
                    : 'ON'} ·{' '}
                  {shaderParams?.chromaticAberration !== undefined ? `${shaderParams.chromaticAberration.toFixed(2)}` : '0.05'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/60">AUDIO:</span>
                <span className={`font-bold ${isMuted ? 'text-red-400' : 'text-emerald-400'}`}>
                  {isMuted ? 'MUTED' : 'ACTIVE'}
                </span>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ------------------------------------------------------------------- */}
      {/* FOOTER */}
      {/* ------------------------------------------------------------------- */}
      <footer className="text-[11px] opacity-70 text-center pb-20 lg:pb-6 pt-3 border-t border-white/5">
        <span>GOWITHFLOW v{GAME_VERSION} · Flowrider Cyber Engine (flowrider.vercel.app) · 60 FPS Target · React 19 + Three.js + Tailwind v4</span>
      </footer>
    </div>
  );
};
