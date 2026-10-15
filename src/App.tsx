import React, { useState, useRef, useCallback, useEffect } from 'react';
import { GameCanvas } from './components/GameCanvas';
import { GameHUD } from './components/GameHUD';
import { ControlsOverlay } from './components/ControlsOverlay';
import { GraphicsDrawer } from './components/GraphicsDrawer';
import { AssetDeliverablesModal } from './components/AssetDeliverablesModal';
import { CosmeticsModal } from './components/CosmeticsModal';
import { VisualDatasetModal } from './components/VisualDatasetModal';
import { GameOverModal } from './components/GameOverModal';
import { PauseModal } from './components/PauseModal';
import { OpeningScreen } from './components/OpeningScreen';
import { HowToPlayModal } from './components/HowToPlayModal';
import { SettingsModal } from './components/SettingsModal';
import { ProgressionModal } from './components/ProgressionModal';
import { GameModesModal } from './components/GameModesModal';
import { CompetitiveModal } from './components/CompetitiveModal';
import { ToastStack, ToastItem } from './components/ToastStack';
import { AudioManager } from './game/audio';
import { HEROES } from './game/heroes';
import { ProgressionManager } from './game/progression';
import { CosmeticManager } from './game/cosmetics';
import { GameModeManager } from './game/modes';
import { SocialManager } from './game/social';
import {
  CosmeticsConfig,
  GraphicsConfig,
  LightingMode,
  PlayerStats,
  PlayerUpgrades,
  SessionGoal,
  ShaderParams,
  TrickType,
} from './types';

const DEFAULT_COSMETICS_CONFIG: CosmeticsConfig = {
  heroId: 'custom',
  boardId: 'cyber-phantom',
  trailId: 'electric-cyan',
  capeColor: '#00f0ff',
  poseId: 'standard',
  armorVariant: 'carbon-fiber',
  visorColor: '#00f0ff',
  underglowColor: '#00f0ff',
  characterStyle: 'cyber-runner',
};

const DEFAULT_GRAPHICS_CONFIG: GraphicsConfig = {
  preset: 'desktop-full',
  targetFPS: 60,
  vegetationDensity: 1.0,
  drawCallBudget: 800,
  particleBudget: 30,
  enablePostProcess: true,
  enableShadows: true,
  lodDistance: 180,
  reducedFlash: false,
};

const DEFAULT_SHADER_PARAMS: ShaderParams = {
  windSpeed: 1.0,
  windStrength: 0.65,
  rimLightIntensity: 0.8,
  celRampHardness: 0.45,
  slopeWarmth: 0.2,
  filmGrainIntensity: 0.0, // No noisy film grain
  bloomIntensity: 0.35, // Crisp targeted neon glow without hazy fog
  colorLift: 0.2,
  highSpeedBlur: 0.0, // Razor-sharp clarity, no smearing
  speedLineIntensity: 0.0, // Clean view of highway and skyline
  chromaticAberration: 0.0005, // Pin-sharp pixel alignment
  scanlineIntensity: 0.0, // Pure 4K display fidelity
  glitchIntensity: 0.0,
};

// Toasts: up to 3 on screen at once, extras wait their turn (bounded).
const MAX_VISIBLE_TOASTS = 3;
const MAX_TOASTS_TOTAL = 8;
const TOAST_DURATION_MS = 2400;
// Resume countdown shown after closing a modal that was opened mid-run.
const RESUME_COUNTDOWN_FROM = 3;
const RESUME_COUNTDOWN_STEP_MS = 650;

const DEFAULT_MISSIONS: SessionGoal[] = [
  {
    id: 'near_miss_5',
    title: 'Near-Miss Phantom',
    desc: 'Perform 5 near-misses with cyber obstacles',
    target: 5,
    current: 0,
    completed: false,
    claimed: false,
    rewardShards: 50,
    reward: '50 Shards',
  },
  {
    id: 'score_10k',
    title: 'Score Synchronizer',
    desc: 'Reach 10,000 score in a single cyber run',
    target: 10000,
    current: 0,
    completed: false,
    claimed: false,
    rewardShards: 100,
    reward: '100 Shards',
  },
  {
    id: 'distance_2k',
    title: 'Sector Drifter',
    desc: 'Travel 2,000m on the neon highway',
    target: 2000,
    current: 0,
    completed: false,
    claimed: false,
    rewardShards: 150,
    reward: '150 Shards',
  },
];

export default function App() {
  const [graphicsConfig, setGraphicsConfig] = useState<GraphicsConfig>(() => {
    try {
      const saved = localStorage.getItem('skyflow_graphics_config');
      if (saved) return { ...DEFAULT_GRAPHICS_CONFIG, ...JSON.parse(saved) };
      // First launch on a phone/tablet: start on Balanced instead of Ultra
      // (no shadows, 1.2x DPR cap). Players can still switch in Settings.
      const isTouchDevice =
        typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(pointer: coarse)').matches;
      if (isTouchDevice) {
        return { ...DEFAULT_GRAPHICS_CONFIG, preset: 'mobile-opt', vegetationDensity: 0.65, enableShadows: false };
      }
      return DEFAULT_GRAPHICS_CONFIG;
    } catch {
      return DEFAULT_GRAPHICS_CONFIG;
    }
  });
  const bankedThisRunRef = useRef<number>(0);
  const [lightingMode, setLightingMode] = useState<LightingMode>('midnight-cyan');
  const [shaderParams, setShaderParams] = useState<ShaderParams>(DEFAULT_SHADER_PARAMS);
  const [cosmeticsConfig, setCosmeticsConfig] = useState<CosmeticsConfig>(() => {
    try {
      const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
      const urlHero = params?.get('hero') as any;
      const saved = localStorage.getItem('skyflow_cosmetics');
      const base = saved ? { ...DEFAULT_COSMETICS_CONFIG, ...JSON.parse(saved) } : DEFAULT_COSMETICS_CONFIG;
      if (urlHero) {
        return { ...base, heroId: urlHero };
      }
      return base;
    } catch {
      return DEFAULT_COSMETICS_CONFIG;
    }
  });

  // Persistent Currency & Cyber Bay Upgrades
  const [bankedShards, setBankedShards] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('skyflow_banked_shards');
      return saved ? parseInt(saved, 10) || 0 : 0;
    } catch {
      return 0;
    }
  });

  const [missions, setMissions] = useState<SessionGoal[]>(() => {
    try {
      const saved = localStorage.getItem('skyflow_missions');
      if (saved) {
        const parsed = JSON.parse(saved);
        return DEFAULT_MISSIONS.map(def => {
          const match = parsed.find((p: any) => p.id === def.id);
          return match ? { ...def, ...match } : def;
        });
      }
      return DEFAULT_MISSIONS;
    } catch {
      return DEFAULT_MISSIONS;
    }
  });

  const [playerUpgrades, setPlayerUpgrades] = useState<PlayerUpgrades>(() => {
    try {
      const saved = localStorage.getItem('skyflow_upgrades');
      return saved
        ? { magnetLevel: 1, jetpackLevel: 1, overdriveLevel: 1, shieldCapacitorLevel: 0, ...JSON.parse(saved) }
        : { magnetLevel: 1, jetpackLevel: 1, overdriveLevel: 1, shieldCapacitorLevel: 0 };
    } catch {
      return { magnetLevel: 1, jetpackLevel: 1, overdriveLevel: 1, shieldCapacitorLevel: 0 };
    }
  });

  const [unlockedItems, setUnlockedItems] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('skyflow_unlocked_items');
      return saved ? JSON.parse(saved) : ['shadow', 'cyber-phantom', 'electric-cyan', 'carbon-fiber'];
    } catch {
      return ['shadow', 'cyber-phantom', 'electric-cyan', 'carbon-fiber'];
    }
  });

  // Heroes with a price must be unlocked before use. A saved selection or a
  // ?hero= link can point at a locked hero; fall back to the default.
  // (Dev builds keep ?hero= working for the hero-lab capture scripts.)
  useEffect(() => {
    if (import.meta.env.DEV) return;
    const hero = HEROES.find(h => h.id === cosmeticsConfig.heroId);
    const locked = !hero || (hero.cost > 0 && !unlockedItems.includes(hero.id));
    if (locked && cosmeticsConfig.heroId !== 'custom') {
      setCosmeticsConfig(prev => ({ ...prev, heroId: 'custom' }));
    }
  }, [cosmeticsConfig.heroId, unlockedItems]);

  const [hasStarted, setHasStarted] = useState<boolean>(() => {
    try {
      const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
      return params?.get('autoplay') === 'true';
    } catch {
      return false;
    }
  });
  const [isCinematicCam, setIsCinematicCam] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isGraphicsDrawerOpen, setIsGraphicsDrawerOpen] = useState(false);
  const [isDeliverablesOpen, setIsDeliverablesOpen] = useState(false);
  const [isCosmeticsOpen, setIsCosmeticsOpen] = useState(false);
  const [isProgressionOpen, setIsProgressionOpen] = useState(false);
  const [cosmeticsInitialTab, setCosmeticsInitialTab] = useState<'upgrades' | 'loadout'>('upgrades');
  const [isHowToOpen, setIsHowToOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDatasetOpen, setIsDatasetOpen] = useState(false);
  const [activeMobileTrick, setActiveMobileTrick] = useState<TrickType | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [resumeCountdown, setResumeCountdown] = useState(0);
  const [isUprightMode, setIsUprightMode] = useState<boolean>(true);

  // Phase 13 Progression System Instance
  const progressionMgrRef = useRef<ProgressionManager | null>(null);
  if (!progressionMgrRef.current) {
    progressionMgrRef.current = new ProgressionManager();
  }
  const [playerLevel, setPlayerLevel] = useState<number>(() => progressionMgrRef.current?.getLevel() || 1);

  // Phase 14 Cosmetic System Instance
  const cosmeticMgrRef = useRef<CosmeticManager | null>(null);
  if (!cosmeticMgrRef.current) {
    cosmeticMgrRef.current = new CosmeticManager();
  }

  // Phase 15 Game Mode System Instance
  const gameModeMgrRef = useRef<GameModeManager | null>(null);
  if (!gameModeMgrRef.current) {
    gameModeMgrRef.current = new GameModeManager();
  }
  const [isModesOpen, setIsModesOpen] = useState(false);
  const [activeModeName, setActiveModeName] = useState<string>(() => gameModeMgrRef.current?.activeMode.name || 'Standard Run');

  // Phase 16 Social & Competitive System Instance
  const socialMgrRef = useRef<SocialManager | null>(null);
  if (!socialMgrRef.current) {
    socialMgrRef.current = new SocialManager();
  }
  const [isCompetitiveOpen, setIsCompetitiveOpen] = useState(false);

  // Cyber Navigation State
  const [isGameOver, setIsGameOver] = useState(false);
  const [restartCount, setRestartCount] = useState(0);
  const [reviveCount, setReviveCount] = useState(0);
  const [shieldCount, setShieldCount] = useState(0);
  const [highScore, setHighScore] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('skyflow_high_score');
      return saved ? parseInt(saved, 10) || 0 : 0;
    } catch {
      return 0;
    }
  });

  const [bestDistance, setBestDistance] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('skyflow_best_distance');
      return saved ? parseInt(saved, 10) || 0 : 0;
    } catch {
      return 0;
    }
  });

  const [stats, setStats] = useState<PlayerStats>({
    speed: 24,
    maxSpeed: 52,
    distance: 0,
    score: 0,
    highScore: 0,
    styleMeter: 25,
    styleTier: 'Chill',
    overdriveMeter: 25,
    overdriveTier: 'Charged',
    comboTier: 'blue',
    airTime: 0,
    isGrounded: true,
    combo: 0,
    windOrbsCollected: 0,
    dataShardsCollected: 0,
    currentBiome: 'neon-undercity',
    currentFriction: 0.02,
    activeTrickName: null,
    slowMoActive: false,
    isOnFloatingIsland: false,
    currentLane: 0,
    isSliding: false,
    slideTimer: 0,
    isGrinding: false,
    isBoosting: false,
    boostEnergy: 100,
    activePowerUps: {
      magnetTimer: 0,
      jetpackTimer: 0,
      hoverboardShield: false,
      multiplierTimer: 0,
    },
    scoreMultiplier: 1,
    gameState: 'playing',
  });

  const statsRef = useRef<PlayerStats>(stats);
  statsRef.current = stats;

  const highScoreRef = useRef(highScore);
  highScoreRef.current = highScore;

  const bestDistanceRef = useRef(bestDistance);
  bestDistanceRef.current = bestDistance;

  const fps = 60;
  const [currentFpsDisplay, setCurrentFpsDisplay] = useState(60);
  const [drawCalls, setDrawCalls] = useState(45);
  const [instanceCount, setInstanceCount] = useState(850);

  const audioManagerRef = useRef<AudioManager | null>(null);
  const toastIdRef = useRef(0);
  const toastTimersRef = useRef<Map<number, number>>(new Map());

  // Queue a toast. A repeat of a message already shown/queued bumps its
  // counter and restarts its timer instead of taking another slot.
  const triggerNotification = useCallback((msg: string) => {
    setToasts(prev => {
      const existing = prev.find(t => t.msg === msg);
      if (existing) {
        const timer = toastTimersRef.current.get(existing.id);
        if (timer !== undefined) {
          clearTimeout(timer);
          toastTimersRef.current.delete(existing.id);
        }
        return prev.map(t => (t.id === existing.id ? { ...t, count: t.count + 1 } : t));
      }
      const next = [...prev, { id: ++toastIdRef.current, msg, count: 1 }];
      // Drop the oldest *waiting* toast if the backlog grows too long.
      if (next.length > MAX_TOASTS_TOTAL) next.splice(MAX_VISIBLE_TOASTS, 1);
      return next;
    });
  }, []);

  // Each toast's lifetime starts when it becomes visible.
  useEffect(() => {
    const timers = toastTimersRef.current;
    for (const t of toasts.slice(0, MAX_VISIBLE_TOASTS)) {
      if (timers.has(t.id)) continue;
      timers.set(
        t.id,
        window.setTimeout(() => {
          timers.delete(t.id);
          setToasts(prev => prev.filter(x => x.id !== t.id));
        }, TOAST_DURATION_MS)
      );
    }
  }, [toasts]);

  useEffect(() => {
    const timers = toastTimersRef.current;
    return () => {
      timers.forEach(id => clearTimeout(id));
      timers.clear();
    };
  }, []);

  const handleClaimMission = useCallback((missionId: string) => {
    let rewardToGrant = 0;
    let nextMissions: SessionGoal[] | null = null;

    setMissions(prev => {
      const match = prev.find(m => m.id === missionId && m.completed && !m.claimed);
      if (!match) return prev;
      rewardToGrant = match.rewardShards;
      const updated = prev.map(m => m.id === missionId ? { ...m, claimed: true } : m);
      nextMissions = updated;
      return updated;
    });

    if (nextMissions) {
      try {
        localStorage.setItem('skyflow_missions', JSON.stringify(nextMissions));
      } catch {}
    }

    if (rewardToGrant > 0) {
      setBankedShards(prev => {
        const next = prev + rewardToGrant;
        try {
          localStorage.setItem('skyflow_banked_shards', String(next));
        } catch {}
        return next;
      });
      triggerNotification(`🎉 +${rewardToGrant} Shards Mission Reward Claimed!`);
    }
  }, [triggerNotification]);

  // Adds shards to the persistent bank (used by challenge/achievement claims).
  const creditShards = useCallback((amount: number, source: string) => {
    if (!Number.isFinite(amount) || amount <= 0) return;
    setBankedShards(prev => {
      const next = (Number.isFinite(prev) ? prev : 0) + amount;
      try {
        localStorage.setItem('skyflow_banked_shards', String(next));
      } catch {}
      return next;
    });
    triggerNotification(`🎉 +${amount} Shards ${source} Reward Claimed!`);
  }, [triggerNotification]);

  const handleStatsUpdate = useCallback((newStats: PlayerStats, currentFps: number, calls: number, instances: number) => {
    statsRef.current = newStats;

    if (newStats.score > highScoreRef.current) {
      highScoreRef.current = newStats.score;
      setHighScore(newStats.score);
    }
    if (newStats.distance > bestDistanceRef.current) {
      bestDistanceRef.current = newStats.distance;
      setBestDistance(newStats.distance);
    }
    newStats.highScore = Math.max(newStats.highScore, highScoreRef.current, newStats.score);
    setStats({ ...newStats });
    setCurrentFpsDisplay(currentFps);
    setDrawCalls(calls);
    setInstanceCount(instances);

    setMissions(prev => {
      let changed = false;
      const updated = prev.map(m => {
        let newCurrent = m.current;
        if (m.id === 'near_miss_5') {
          newCurrent = Math.max(m.current, newStats.nearMissCount || 0);
        } else if (m.id === 'score_10k') {
          newCurrent = Math.max(m.current, newStats.score || 0);
        } else if (m.id === 'distance_2k') {
          newCurrent = Math.max(m.current, newStats.distance || 0);
        }
        const completed = newCurrent >= m.target;
        if (newCurrent !== m.current || completed !== m.completed) {
          changed = true;
          return { ...m, current: newCurrent, completed };
        }
        return m;
      });
      if (changed) {
        try {
          localStorage.setItem('skyflow_missions', JSON.stringify(updated));
        } catch {}
        return updated;
      }
      return prev;
    });
  }, []);


  const handleToggleMute = useCallback(() => {
    setIsMuted(prev => {
      const next = !prev;
      if (audioManagerRef.current) {
        audioManagerRef.current.setMuted(next);
      }
      return next;
    });
  }, []);

  const handleUpdateConfig = useCallback((newConfig: Partial<GraphicsConfig>) => {
    setGraphicsConfig(prev => {
      const updated = { ...prev, ...newConfig };
      if (newConfig.preset) {
        if (newConfig.preset === 'desktop-full') {
          updated.vegetationDensity = 1.0;
          updated.enablePostProcess = true;
          updated.enableShadows = true;
        } else if (newConfig.preset === 'mobile-opt') {
          updated.vegetationDensity = 0.65;
          updated.enablePostProcess = true;
          updated.enableShadows = false;
        } else if (newConfig.preset === 'webgl-min') {
          updated.vegetationDensity = 0.4;
          updated.enablePostProcess = false;
          updated.enableShadows = false;
        }
      }
      try {
        localStorage.setItem('skyflow_graphics_config', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  }, []);

  const handleUpdateShaderParams = useCallback((newParams: Partial<ShaderParams>) => {
    setShaderParams(prev => ({ ...prev, ...newParams }));
  }, []);

  const handleResetDefaults = useCallback(() => {
    setGraphicsConfig(DEFAULT_GRAPHICS_CONFIG);
    try {
      localStorage.removeItem('skyflow_graphics_config');
    } catch {}
    setShaderParams(DEFAULT_SHADER_PARAMS);
    setLightingMode('midnight-cyan');
    triggerNotification('Settings reset to defaults');
  }, [triggerNotification]);

  const handleUpdateCosmetics = useCallback((newCosmetics: CosmeticsConfig) => {
    setCosmeticsConfig(newCosmetics);
    try {
      localStorage.setItem('skyflow_cosmetics', JSON.stringify(newCosmetics));
    } catch {}
  }, []);

  // Cyber Augment Upgrade Handler
  const handleUpgrade = useCallback((upgradeKey: keyof PlayerUpgrades, cost: number) => {
    if (bankedShards < cost) {
      triggerNotification('⚠️ Insufficient Data Shards for upgrade');
      return;
    }
    const newBank = bankedShards - cost;
    setBankedShards(newBank);
    try {
      localStorage.setItem('skyflow_banked_shards', String(newBank));
    } catch {}

    setPlayerUpgrades(prev => {
      const updated = { ...prev, [upgradeKey]: prev[upgradeKey] + 1 };
      try {
        localStorage.setItem('skyflow_upgrades', JSON.stringify(updated));
      } catch {}
      return updated;
    });
    triggerNotification('⚡ Tech Upgrade Installed! Power Augmented!');
  }, [bankedShards, triggerNotification]);

  // Unlock Item Handler (Heroes, Boards, Trails)
  const handleUnlockItem = useCallback(
    (itemId: string, cost: number): boolean => {
      let currentBanked = bankedShards;
      try {
        const saved = localStorage.getItem('skyflow_banked_shards');
        if (saved !== null) currentBanked = parseInt(saved, 10) || 0;
      } catch {}

      if (currentBanked >= cost) {
        const nextBanked = currentBanked - cost;
        setBankedShards(nextBanked);
        try {
          localStorage.setItem('skyflow_banked_shards', String(nextBanked));
        } catch {}

        setUnlockedItems((prev) => {
          const next = prev.includes(itemId) ? prev : [...prev, itemId];
          try {
            localStorage.setItem('skyflow_unlocked_items', JSON.stringify(next));
          } catch {}
          return next;
        });

        triggerNotification(`✨ Unlocked ${itemId.toUpperCase()}!`);
        return true;
      } else {
        triggerNotification(`⚠️ Need ${cost - currentBanked} more shards!`);
        return false;
      }
    },
    [bankedShards, triggerNotification]
  );

  // System Crash / Game Over Handler: Bank run harvest into persistent wallet
  const handleGameOver = useCallback(() => {
    setIsGameOver(true);
    setResumeCountdown(0);
    const finalStats = statsRef.current;
    const runShards = finalStats.dataShardsCollected || 0;
    const unbankedShards = Math.max(0, runShards - bankedThisRunRef.current);

    // Persist run end checkpoints to localStorage
    try {
      if (finalStats.score > 0) {
        localStorage.setItem('skyflow_high_score', String(Math.max(highScoreRef.current, finalStats.score)));
      }
      if (finalStats.distance > 0) {
        localStorage.setItem('skyflow_best_distance', String(Math.max(bestDistanceRef.current, finalStats.distance)));
      }
    } catch {}

    if (unbankedShards > 0) {
      bankedThisRunRef.current = runShards;
      setBankedShards(prev => {
        const next = prev + unbankedShards;
        try {
          localStorage.setItem('skyflow_banked_shards', String(next));
        } catch {}
        return next;
      });
      triggerNotification(`💾 +${unbankedShards} Data Shards Banked!`);
    }

    // Submit to Social & Competitive Leaderboards
    if (socialMgrRef.current && gameModeMgrRef.current) {
      const lastSummary = gameModeMgrRef.current.getLastSummary();
      if (lastSummary) {
        socialMgrRef.current.submitRunSummary(lastSummary, progressionMgrRef.current || undefined);
      }
    }
  }, [triggerNotification]);

  // Emergency Revive Handler: Deducts exactly 15 units of persistent currency
  const handleRevive = useCallback(() => {
    let currentBanked = 0;
    try {
      const saved = localStorage.getItem('skyflow_banked_shards');
      currentBanked = saved !== null ? parseInt(saved, 10) || 0 : 0;
    } catch {}

    if (currentBanked >= 15) {
      const nextBank = currentBanked - 15;
      setBankedShards(nextBank);
      try {
        localStorage.setItem('skyflow_banked_shards', String(nextBank));
      } catch {}
      setIsGameOver(false);
      setReviveCount(c => c + 1);
      triggerNotification('🌸 Emergency Revive! -15 Banked Shards');
    } else {
      const runShards = statsRef.current.dataShardsCollected || 0;
      if (runShards >= 15) {
        const remaining = runShards - 15;
        statsRef.current.dataShardsCollected = remaining;
        statsRef.current.windOrbsCollected = remaining;
        setStats(prev => ({
          ...prev,
          dataShardsCollected: remaining,
          windOrbsCollected: remaining,
        }));
        setIsGameOver(false);
        setReviveCount(c => c + 1);
        triggerNotification('🌸 Emergency Revive! -15 Run Shards');
      } else {
        triggerNotification('⚠️ Need 15 Data Shards to revive!');
      }
    }
  }, [triggerNotification]);

  const isAnyModalOpen =
    isGraphicsDrawerOpen ||
    isDeliverablesOpen ||
    isCosmeticsOpen ||
    isProgressionOpen ||
    isHowToOpen ||
    isSettingsOpen ||
    isDatasetOpen ||
    isModesOpen ||
    isCompetitiveOpen;

  // The 3D run is frozen whenever the pause menu, any modal or the resume
  // countdown is up; GameCanvas receives this as its isPaused flag.
  const isRunFrozen = isPaused || isAnyModalOpen || resumeCountdown > 0;

  const handleCloseProgression = useCallback(() => {
    setIsProgressionOpen(false);
    if (progressionMgrRef.current) {
      setPlayerLevel(progressionMgrRef.current.getLevel());
    }
  }, []);

  const closeAllModals = useCallback(() => {
    setIsGraphicsDrawerOpen(false);
    setIsDeliverablesOpen(false);
    setIsCosmeticsOpen(false);
    setIsHowToOpen(false);
    setIsSettingsOpen(false);
    setIsDatasetOpen(false);
    setIsModesOpen(false);
    setIsCompetitiveOpen(false);
    handleCloseProgression();
  }, [handleCloseProgression]);

  const pauseRun = useCallback(() => {
    setResumeCountdown(0);
    setIsPaused(true);
  }, []);

  const resumeRun = useCallback(() => {
    setIsPaused(false);
  }, []);

  // A modal opened mid-run (not from the pause menu) resumes with a short
  // 3-2-1 countdown when it closes; one opened from the pause menu just
  // returns to the pause menu because isPaused is still set.
  const prevModalOpenRef = useRef(isAnyModalOpen);
  useEffect(() => {
    const wasOpen = prevModalOpenRef.current;
    prevModalOpenRef.current = isAnyModalOpen;
    if (wasOpen && !isAnyModalOpen && hasStarted && !isPaused && !isGameOver) {
      setResumeCountdown(RESUME_COUNTDOWN_FROM);
    }
  }, [isAnyModalOpen, hasStarted, isPaused, isGameOver]);

  useEffect(() => {
    if (resumeCountdown <= 0 || isAnyModalOpen || isPaused) return;
    const t = window.setTimeout(() => setResumeCountdown(c => Math.max(0, c - 1)), RESUME_COUNTDOWN_STEP_MS);
    return () => clearTimeout(t);
  }, [resumeCountdown, isAnyModalOpen, isPaused]);

  // Keyboard: Escape closes an open modal first (never opens pause behind it);
  // Escape / P toggle pause; Space resumes from the pause menu.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Escape' && isAnyModalOpen) {
        e.preventDefault();
        closeAllModals();
        return;
      }
      if (e.code === 'Escape' || e.code === 'KeyP') {
        if (hasStarted && !isGameOver && !isAnyModalOpen) {
          if (isPaused) resumeRun();
          else pauseRun();
        }
        return;
      }
      if (e.code === 'Space' && !e.repeat && isPaused && hasStarted && !isGameOver && !isAnyModalOpen) {
        // The engine is still paused for this keydown, so it can't also jump.
        e.preventDefault();
        resumeRun();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasStarted, isGameOver, isPaused, isAnyModalOpen, closeAllModals, pauseRun, resumeRun]);

  // Bridge touch overlay buttons to synthetic keyboard events
  const handleControlAction = useCallback((action: 'left' | 'right' | 'jump' | 'forward' | 'drift' | 'slide' | 'shield', pressed: boolean) => {
    if (action === 'shield') {
      if (pressed) setShieldCount(c => c + 1);
      return;
    }
    const keyMap: Record<string, string> = {
      left: 'KeyA',
      right: 'KeyD',
      forward: 'KeyW',
      jump: 'Space',
      drift: 'ShiftLeft',
      slide: 'KeyS',
    };
    const code = keyMap[action];
    if (code) {
      const eventType = pressed ? 'keydown' : 'keyup';
      window.dispatchEvent(new KeyboardEvent(eventType, { code, bubbles: true }));
    }
  }, []);

  const handleStartGame = useCallback(() => {
    bankedThisRunRef.current = 0;
    setHasStarted(true);
    setIsGameOver(false);
    setIsPaused(false);
    setResumeCountdown(0);
    setRestartCount((c) => c + 1);
  }, []);

  const handleQuitToMenu = useCallback(() => {
    bankedThisRunRef.current = 0;
    setIsPaused(false);
    setResumeCountdown(0);
    setIsGameOver(false);
    setHasStarted(false);
    if (audioManagerRef.current) {
      audioManagerRef.current.dispose();
      audioManagerRef.current = null;
    }
  }, []);

  const handleOpenShop = useCallback((tab?: 'heroes' | 'boards' | 'tech') => {
    if (tab === 'tech') {
      setCosmeticsInitialTab('upgrades');
    } else {
      setCosmeticsInitialTab('loadout');
    }
    setIsCosmeticsOpen(true);
  }, []);

  return (
    <div id="skyflow-app-container" className="relative w-screen h-dvh overflow-hidden bg-slate-950">
      {/* 1. Opening Screen / Landing Interface */}
      {!hasStarted && !isGameOver && !isPaused ? (
        <OpeningScreen
          heroes={HEROES}
          selectedHero={cosmeticsConfig.heroId || 'shadow'}
          boardId={cosmeticsConfig.boardId || 'cyber-phantom'}
          trailId={cosmeticsConfig.trailId || 'electric-cyan'}
          bankedShards={bankedShards}
          highScore={highScore}
          bestDistance={bestDistance}
          upgrades={playerUpgrades}
          unlocked={unlockedItems}
          onSelectHero={(id) => handleUpdateCosmetics({ ...cosmeticsConfig, heroId: id })}
          onUnlockHero={(id, cost) => {
            const ok = handleUnlockItem(id, cost);
            if (ok !== false) {
              handleUpdateCosmetics({ ...cosmeticsConfig, heroId: id });
            }
          }}
          onSelectBoard={(id) => handleUpdateCosmetics({ ...cosmeticsConfig, boardId: id as any })}
          onSelectTrail={(id) => handleUpdateCosmetics({ ...cosmeticsConfig, trailId: id as any })}
          onUpgradeTech={handleUpgrade}
          onOpenShop={handleOpenShop}
          onPlay={handleStartGame}
          onHowTo={() => setIsHowToOpen(true)}
          onSettings={() => setIsSettingsOpen(true)}
          onOpenModes={() => setIsModesOpen(true)}
          activeModeName={activeModeName}
          onOpenCompetitive={() => setIsCompetitiveOpen(true)}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
          missions={missions}
          onClaimMission={handleClaimMission}
          onOpenProgression={() => setIsProgressionOpen(true)}
          playerLevel={playerLevel}
          graphicsConfig={graphicsConfig}
          shaderParams={shaderParams}
        />
      ) : (
        /* 2. Active 3D Game Stage */
        <div className="relative w-full h-full overflow-hidden">
          {/* 3D WebGL Canvas */}
          <GameCanvas
            graphicsConfig={graphicsConfig}
            lightingMode={lightingMode}
            shaderParams={shaderParams}
            cosmeticsConfig={cosmeticsConfig}
            upgrades={playerUpgrades}
            progressionMgr={progressionMgrRef.current || undefined}
            cosmeticMgr={cosmeticMgrRef.current || undefined}
            gameModeMgr={gameModeMgrRef.current || undefined}
            activeMobileTrick={activeMobileTrick}
            onClearMobileTrick={() => setActiveMobileTrick(null)}
            onStatsUpdate={handleStatsUpdate}
            audioManagerRef={audioManagerRef}
            isCinematicCam={isCinematicCam}
            isUpright={isUprightMode}
            isPaused={isRunFrozen}
            isMuted={isMuted}
            onNotification={triggerNotification}
            onGameOver={handleGameOver}
            onRequestPause={pauseRun}
            restartTrigger={restartCount}
            reviveTrigger={reviveCount}
            shieldTrigger={shieldCount}
          />

          {/* Game HUD */}
          <GameHUD
            stats={stats}
            bankedShards={bankedShards}
            fps={currentFpsDisplay}
            drawCalls={drawCalls}
            instanceCount={instanceCount}
            lightingMode={lightingMode}
            onSelectLighting={setLightingMode}
            isMuted={isMuted}
            onToggleMute={handleToggleMute}
            isCinematicCam={isCinematicCam}
            onToggleCam={() => setIsCinematicCam(prev => !prev)}
            isUpright={isUprightMode}
            onToggleUpright={() => {
              setIsUprightMode(prev => {
                const next = !prev;
                triggerNotification(next ? 'Upright Portrait Cam Active' : 'Widescreen Chase Cam Active');
                return next;
              });
            }}
            onActivateShield={() => setShieldCount(c => c + 1)}
            onOpenGraphicsDrawer={() => setIsGraphicsDrawerOpen(true)}
            onOpenDeliverables={() => setIsDeliverablesOpen(true)}
            onOpenCosmetics={() => handleOpenShop('boards')}
            onOpenProgression={() => setIsProgressionOpen(true)}
            onOpenDatasetCapture={() => setIsDatasetOpen(true)}
            onPause={() => (isPaused ? resumeRun() : pauseRun())}
            gameModeMgr={gameModeMgrRef.current || undefined}
            notification={null /* toasts render in <ToastStack> */}
          />

          {/* On-Screen Touch & Keybind Controls */}
          <ControlsOverlay
            onControlAction={handleControlAction}
            onTriggerTrick={trick => setActiveMobileTrick(trick)}
            isAirborne={!stats.isGrounded}
            slowMoActive={stats.slowMoActive}
          />
        </div>
      )}

      {/* Graphics & Shaders Settings Drawer */}
      <GraphicsDrawer
        isOpen={isGraphicsDrawerOpen}
        onClose={() => setIsGraphicsDrawerOpen(false)}
        config={graphicsConfig}
        onUpdateConfig={handleUpdateConfig}
        lightingMode={lightingMode}
        onSelectLighting={setLightingMode}
        shaderParams={shaderParams}
        onUpdateShaderParams={handleUpdateShaderParams}
        onResetDefaults={handleResetDefaults}
        fps={currentFpsDisplay}
        drawCalls={drawCalls}
      />

      {/* Art Asset Deliverables & Engine Export Modal */}
      <AssetDeliverablesModal
        isOpen={isDeliverablesOpen}
        onClose={() => setIsDeliverablesOpen(false)}
      />

      {/* Visual Dataset Capture & Prompt Engineering Modal */}
      <VisualDatasetModal
        isOpen={isDatasetOpen}
        onClose={() => setIsDatasetOpen(false)}
      />

      {/* Pilot Manual / How To Play Modal */}
      <HowToPlayModal
        isOpen={isHowToOpen}
        onClose={() => setIsHowToOpen(false)}
      />

      {/* System Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        config={graphicsConfig}
        onUpdateConfig={handleUpdateConfig}
        shaderParams={shaderParams}
        onUpdateShaderParams={handleUpdateShaderParams}
        isMuted={isMuted}
        onToggleMute={handleToggleMute}
        onResetDefaults={handleResetDefaults}
      />

      {/* Voyager Cosmetics & Equipment Modal */}
      <CosmeticsModal
        isOpen={isCosmeticsOpen}
        onClose={() => setIsCosmeticsOpen(false)}
        cosmetics={cosmeticsConfig}
        onUpdateCosmetics={handleUpdateCosmetics}
        bankedShards={bankedShards}
        upgrades={playerUpgrades}
        onUpgrade={handleUpgrade}
        unlockedItems={unlockedItems}
        onUnlockItem={handleUnlockItem}
        initialTab={cosmeticsInitialTab}
        cosmeticMgr={cosmeticMgrRef.current || undefined}
        progressionMgr={progressionMgrRef.current || undefined}
      />

      {/* Game Paused Modal (hidden while a modal opened from it is on top;
          the run stays paused and the menu returns when that modal closes) */}
      {isPaused && !isGameOver && !isAnyModalOpen && (
        <PauseModal
          isOpen={isPaused}
          onResume={resumeRun}
          onRestart={() => {
            bankedThisRunRef.current = 0;
            setIsPaused(false);
            setResumeCountdown(0);
            setRestartCount(c => c + 1);
          }}
          onOpenCosmetics={() => handleOpenShop('boards')}
          onOpenGraphics={() => setIsSettingsOpen(true)}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
          stats={stats}
          missions={missions}
          onClaimMission={handleClaimMission}
          onQuitToMenu={handleQuitToMenu}
        />
      )}

      {/* Game Over / Journey's Respite Modal (stays the active screen while a
          modal such as the shop is open over it, and returns when it closes) */}
      {isGameOver && !isAnyModalOpen && (
        <GameOverModal
          stats={stats}
          bankedShards={bankedShards}
          missions={missions}
          progressionMgr={progressionMgrRef.current || undefined}
          gameModeMgr={gameModeMgrRef.current || undefined}
          socialMgr={socialMgrRef.current || undefined}
          onOpenProgression={() => setIsProgressionOpen(true)}
          onOpenCompetitive={() => setIsCompetitiveOpen(true)}
          onClaimMission={handleClaimMission}
          onRestart={() => {
            bankedThisRunRef.current = 0;
            setIsGameOver(false);
            setRestartCount(c => c + 1);
          }}
          onRevive={handleRevive}
          onOpenShop={() => handleOpenShop('boards')}
          onMainMenu={handleQuitToMenu}
        />
      )}

      {/* Pilot Progression Modal */}
      {isProgressionOpen && progressionMgrRef.current && (
        <ProgressionModal
          progressionMgr={progressionMgrRef.current}
          onClose={handleCloseProgression}
          onClaimChallenge={(_id, shards) => {
            if (progressionMgrRef.current) {
              setPlayerLevel(progressionMgrRef.current.getLevel());
            }
            creditShards(shards, 'Challenge');
          }}
          onClaimAchievement={(_id, shards) => {
            if (progressionMgrRef.current) {
              setPlayerLevel(progressionMgrRef.current.getLevel());
            }
            creditShards(shards, 'Achievement');
          }}
        />
      )}

      {/* Flight Operations & Game Modes Modal (Phase 15) */}
      {isModesOpen && gameModeMgrRef.current && (
        <GameModesModal
          gameModeMgr={gameModeMgrRef.current}
          onClose={() => setIsModesOpen(false)}
          onSelectAndPlay={(modeId, challengeId) => {
            if (gameModeMgrRef.current) {
              gameModeMgrRef.current.setMode(modeId, challengeId);
              setActiveModeName(gameModeMgrRef.current.activeMode.name);
              triggerNotification(`Engaged Mode: ${gameModeMgrRef.current.activeMode.name}`);
            }
            setIsModesOpen(false);
          }}
        />
      )}

      {/* Social, Leaderboards & Competitive Replay Modal (Phase 16) */}
      {isCompetitiveOpen && socialMgrRef.current && (
        <CompetitiveModal
          socialMgr={socialMgrRef.current}
          progressionMgr={progressionMgrRef.current || undefined}
          onCreditShards={creditShards}
          onClose={() => setIsCompetitiveOpen(false)}
          onLaunchFriendChallenge={(chalId) => {
            if (gameModeMgrRef.current) {
              gameModeMgrRef.current.setMode('score-attack');
              setActiveModeName('Score Attack');
              triggerNotification('Accepted Friend Challenge: Score Attack');
            }
            setIsCompetitiveOpen(false);
          }}
        />
      )}

      {/* Resume countdown after closing a modal opened mid-run */}
      {resumeCountdown > 0 && hasStarted && !isPaused && !isGameOver && !isAnyModalOpen && (
        <div className="fixed inset-0 z-[55] flex flex-col items-center justify-center pointer-events-none font-mono">
          <span
            key={resumeCountdown}
            className="text-7xl sm:text-8xl font-black text-cyan-300 drop-shadow-[0_0_24px_rgba(0,240,255,0.7)]"
          >
            {resumeCountdown}
          </span>
          <span className="mt-2 text-xs font-bold tracking-widest text-white/70">GET READY</span>
        </div>
      )}

      {/* Stacked notification toasts */}
      <ToastStack toasts={toasts.slice(0, MAX_VISIBLE_TOASTS)} />
    </div>
  );
}
