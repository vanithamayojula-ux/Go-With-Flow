import React, { useEffect, useState, useRef } from 'react';

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

  // Placement: toasts (ToastStack) start at 22vh in the centre. On desktop
  // (lg+) the banner sits above them, between the overdrive meter and the
  // toasts; on phones/tablets the top-left stat chips fill that band, so it
  // drops just below the toast stack instead. Either way it is a single
  // compact row that clears the stunt bar (bottom / right edge).
  return (
    <div
      className={`fixed left-1/2 -translate-x-1/2 z-40 pointer-events-none transition-all duration-700 ease-out top-[calc(22vh+6.5rem)] lg:top-[calc(22vh-3.75rem)] w-max max-w-[calc(100vw-2rem)] ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
      }`}
      role="status"
      aria-live="polite"
    >
      <div
        className={`flex items-center gap-3 px-4 py-2 rounded-xl bg-black/80 backdrop-blur-xl border ${meta.borderColor} ${meta.glowColor}`}
      >
        <span className="text-2xl leading-none" aria-hidden="true">{meta.icon}</span>
        <div className="text-left min-w-0">
          <div className="text-[10px] font-mono font-bold tracking-widest uppercase text-white/75 whitespace-nowrap">
            Sector {meta.sector} of 5 · <span className="normal-case italic tracking-normal">{meta.subtitle}</span>
          </div>
          <h2
            className={`text-lg sm:text-xl font-black uppercase tracking-wider leading-tight text-transparent bg-clip-text bg-gradient-to-r ${meta.gradientText} drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)] whitespace-nowrap`}
          >
            {meta.name}
          </h2>
        </div>
      </div>
    </div>
  );
};
