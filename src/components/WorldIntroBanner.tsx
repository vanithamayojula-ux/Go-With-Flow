import React, { useEffect, useState, useRef } from 'react';
import { Sparkles, Compass } from 'lucide-react';

interface WorldIntroBannerProps {
  worldId?: string;
}

interface WorldMetadata {
  name: string;
  subtitle: string;
  sector: number;
  icon: string;
  gradientText: string;
  borderColor: string;
  glowColor: string;
}

const WORLD_DATA: Record<string, WorldMetadata> = {
  'sky-isles': {
    name: 'SKY ISLES',
    subtitle: 'The Beginning',
    sector: 1,
    icon: '☁️',
    gradientText: 'from-cyan-300 via-sky-200 to-white',
    borderColor: 'border-cyan-400/50',
    glowColor: 'shadow-[0_0_35px_rgba(34,211,238,0.35)]',
  },
  'verdant-wilds': {
    name: 'VERDANT WILDS',
    subtitle: 'The Living Forest',
    sector: 2,
    icon: '🌿',
    gradientText: 'from-emerald-300 via-teal-200 to-white',
    borderColor: 'border-emerald-400/50',
    glowColor: 'shadow-[0_0_35px_rgba(52,211,153,0.35)]',
  },
  'crimson-dunes': {
    name: 'CRIMSON DUNES',
    subtitle: 'The Endless Desert',
    sector: 3,
    icon: '🏜️',
    gradientText: 'from-amber-400 via-orange-300 to-white',
    borderColor: 'border-amber-400/50',
    glowColor: 'shadow-[0_0_35px_rgba(249,115,22,0.35)]',
  },
  'crystal-heights': {
    name: 'CRYSTAL HEIGHTS',
    subtitle: 'The Celestial Realm',
    sector: 4,
    icon: '💎',
    gradientText: 'from-purple-300 via-indigo-200 to-cyan-200',
    borderColor: 'border-purple-400/50',
    glowColor: 'shadow-[0_0_35px_rgba(168,85,247,0.35)]',
  },
  'obsidian-core': {
    name: 'OBSIDIAN CORE',
    subtitle: 'The Final Challenge',
    sector: 5,
    icon: '🌋',
    gradientText: 'from-rose-400 via-red-300 to-amber-200',
    borderColor: 'border-rose-500/60',
    glowColor: 'shadow-[0_0_40px_rgba(239,68,68,0.45)]',
  },
};

export const WorldIntroBanner: React.FC<WorldIntroBannerProps> = ({ worldId = 'sky-isles' }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [activeWorld, setActiveWorld] = useState(worldId);
  const lastWorldRef = useRef(worldId);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (worldId && (worldId !== lastWorldRef.current || !lastWorldRef.current)) {
      lastWorldRef.current = worldId;
      setActiveWorld(worldId);
      setIsVisible(true);

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        setIsVisible(false);
      }, 3400);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [worldId]);

  useEffect(() => {
    // Initial display on game start
    setIsVisible(true);
    timerRef.current = window.setTimeout(() => {
      setIsVisible(false);
    }, 3400);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const meta = WORLD_DATA[activeWorld] || WORLD_DATA['sky-isles'];

  return (
    <div
      className={`fixed top-20 left-1/2 -translate-x-1/2 z-40 pointer-events-none transition-all duration-700 ease-out transform ${
        isVisible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 -translate-y-4'
      }`}
    >
      <div
        className={`flex flex-col items-center justify-center px-8 py-3.5 rounded-2xl bg-black/85 backdrop-blur-xl border ${meta.borderColor} ${meta.glowColor} text-center min-w-[280px] max-w-md`}
      >
        {/* Sector Tag */}
        <div className="flex items-center space-x-1.5 text-[10px] font-mono font-bold tracking-widest uppercase text-white/70 mb-0.5">
          <span>{meta.icon}</span>
          <span>SECTOR {meta.sector} OF 5</span>
          <span className="text-white/40">//</span>
          <Compass className="w-3 h-3 text-white/50" />
        </div>

        {/* World Name Title */}
        <h1
          className={`text-2xl sm:text-3xl font-black uppercase tracking-wider text-transparent bg-clip-text bg-gradient-to-r ${meta.gradientText} drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]`}
        >
          {meta.name}
        </h1>

        {/* Luminous Divider */}
        <div className="w-24 h-0.5 bg-gradient-to-r from-transparent via-white/60 to-transparent my-1" />

        {/* Subtitle */}
        <p className="text-xs sm:text-sm font-medium tracking-wide text-white/90 italic">
          {meta.subtitle}
        </p>
      </div>
    </div>
  );
};
