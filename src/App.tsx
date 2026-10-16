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
import { ToastStack, ToastItem, useCompactHud } from './components/ToastStack';
import { AudioManager } from './game/audio';
import { HEROES } from './game/heroes';
import { ProgressionManager } from './game/progression';
import { CosmeticManager } from './game/cosmetics';
import { GameModeManager } from './game/modes';
import { SocialManager } from './game/social';
import { liveStats, useLiveStats, useLiveStatsOnly } from './state/liveStats';
import { StorageSanitizer } from './game/security/storageSanitizer';
import { detectDeviceTier, graphicsConfigForTier } from './game/perf/deviceTier';
import { preloadGameAssets } from './game/perf/preload';
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

// Toasts: up to 2 on screen at once (1 on phones), extras wait their turn (bounded).
const MAX_VISIBLE_TOASTS = 2;
const MAX_VISIBLE_TOASTS_COMPACT = 1;
const MAX_TOASTS_TOTAL = 8;
const TOAST_DURATION_MS = 1800;
const MUTED_STORAGE_KEY = 'skyflow_muted';
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

// Missions track live run stats, but only need checking a couple of times a second.
const MISSION_CHECK_INTERVAL_MS = 500;

function persistMissions(list: SessionGoal[]): void {
  try {
    localStorage.setItem('skyflow_missions', JSON.stringify(list));
  } catch {}
}

/** Mission progress for the given stats; returns `prev` itself when nothing moved. */
function progressMissions(prev: SessionGoal[], s: PlayerStats): { list: SessionGoal[]; changed: boolean; completedFlip: boolean } {
  let changed = false;
  let completedFlip = false;
  const list = prev.map(m => {
    let newCurrent = m.current;
    if (m.id === 'near_miss_5') {
      newCurrent = Math.max(m.current, s.nearMissCount || 0);
    } else if (m.id === 'score_10k') {
      newCurrent = Math.max(m.current, s.score || 0);
    } else if (m.id === 'distance_2k') {
      newCurrent = Math.max(m.current, s.distance || 0);
    }
    const completed = newCurrent >= m.target;
    if (newCurrent !== m.current || completed !== m.completed) {
      changed = true;
      if (completed !== m.completed) completedFlip = true;
      return { ...m, current: newCurrent, completed };
    }
    return m;
  });
  return { list: changed ? list : prev, changed, completedFlip };
}

// Live-stat wrappers: only these subtrees re-render on stats ticks.
const LivePauseModal: React.FC<Omit<React.ComponentProps<typeof PauseModal>, 'stats'>> = props => {
  const stats = useLiveStatsOnly();
  return <PauseModal {...props} stats={stats} />;
};

const LiveGameOverModal: React.FC<Omit<React.ComponentProps<typeof GameOverModal>, 'stats'>> = props => {
  const stats = useLiveStatsOnly();
  return <GameOverModal {...props} stats={stats} />;
};

const LiveGraphicsDrawer: React.FC<Omit<React.ComponentProps<typeof GraphicsDrawer>, 'fps' | 'drawCalls'>> = props => {
  // Subscribed only while open, so a closed drawer never re-renders on ticks.
  return props.isOpen ? <OpenGraphicsDrawer {...props} /> : <GraphicsDrawer {...props} fps={0} drawCalls={0} />;
};

const OpenGraphicsDrawer: React.FC<Omit<React.ComponentProps<typeof GraphicsDrawer>, 'fps' | 'drawCalls'>> = props => {
  const live = useLiveStats();
  return <GraphicsDrawer {...props} fps={live.fps} drawCalls={live.drawCalls} />;
};

export default function App() {
  const [graphicsConfig, setGraphicsConfig] = useState<GraphicsConfig>(() => {
    try {
      // A preset the player chose (saved) always wins.
      const saved = localStorage.getItem('skyflow_graphics_config');
      if (saved) return { ...DEFAULT_GRAPHICS_CONFIG, ...JSON.parse(saved) };
      // First launch: pick a starting tier from the device. Phones/tablets
      // start on Balanced without shadows; integrated / mobile / software GPUs
      // (or <= 4 cores / <= 4 GB) on Balanced with 1024 px shadows; discrete
      // GPUs on Ultra. Adaptive resolution refines it during play.
      return graphicsConfigForTier(DEFAULT_GRAPHICS_CONFIG, detectDeviceTier().tier);
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
  const [isMuted, setIsMuted] = useState<boolean>(
    () => StorageSanitizer.safeGetItem<boolean>(MUTED_STORAGE_KEY, false) === true
  );
  // The HUD's "More options" menu: pauses the run like any modal.
  const [isHudMenuOpen, setIsHudMenuOpen] = useState(false);
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

  // Live run stats (score, speed, fps...) live in the liveStats store, pushed
  // by the engine; the HUD subscribes to it directly so this shell only
  // re-renders on discrete events (game over, pause, mission completed...).
  // The refs below run ahead of state and are flushed at those events.
  const highScoreRef = useRef(highScore);
  if (highScore > highScoreRef.current) highScoreRef.current = highScore;

  const bestDistanceRef = useRef(bestDistance);
  if (bestDistance > bestDistanceRef.current) bestDistanceRef.current = bestDistance;

  const missionsRef = useRef(missions);
  missionsRef.current = missions;
  // Mission progress computed mid-run but not yet committed to state/storage.
  const pendingMissionsRef = useRef<SessionGoal[] | null>(null);

  const audioManagerRef = useRef<AudioManager | null>(null);
  const toastIdRef = useRef(0);
  const toastTimersRef = useRef<Map<number, number>>(new Map());

  // True while the opening screen, pause/game-over screen, a modal or the HUD
  // menu is up (assigned below, once those flags are known). Toasts fired
  // during play are "run" toasts and wait while an overlay is up.
  const overlayUpRef = useRef(true);
  const isCompactHud = useCompactHud();
  const maxVisibleToasts = isCompactHud ? MAX_VISIBLE_TOASTS_COMPACT : MAX_VISIBLE_TOASTS;

  // Queue a toast. A repeat of a message already shown/queued bumps its
  // counter and restarts its timer instead of taking another slot.
  const triggerNotification = useCallback((msg: string, fromRun?: boolean) => {
    const run = fromRun ?? !overlayUpRef.current;
    setToasts(prev => {
      const existing = prev.find(t => t.msg === msg && t.run === run);
      if (existing) {
        const timer = toastTimersRef.current.get(existing.id);
        if (timer !== undefined) {
          clearTimeout(timer);
          toastTimersRef.current.delete(existing.id);
        }
        return prev.map(t => (t.id === existing.id ? { ...t, count: t.count + 1 } : t));
      }
      const next = [...prev, { id: ++toastIdRef.current, msg, count: 1, run }];
      // Drop the oldest *waiting* toast if the backlog grows too long.
      if (next.length > MAX_TOASTS_TOTAL) next.splice(MAX_VISIBLE_TOASTS, 1);
      return next;
    });
  }, []);

  // Engine messages are always gameplay ("run") toasts, and the engine can
  // still emit a few frames after the crash: none of those reach the
  // game-over screen.
  const isGameOverRef = useRef(false);
  const handleEngineNotification = useCallback(
    (msg: string) => {
      if (isGameOverRef.current) return;
      triggerNotification(msg, true);
    },
    [triggerNotification]
  );

  /** Drop toasts (all, or just the run ones) and their timers. */
  const clearToasts = useCallback((runOnly: boolean) => {
    const timers = toastTimersRef.current;
    setToasts(prev => {
      const keep = runOnly ? prev.filter(t => !t.run) : [];
      for (const t of prev) {
        if (keep.includes(t)) continue;
        const timer = timers.get(t.id);
        if (timer !== undefined) clearTimeout(timer);
        timers.delete(t.id);
      }
      return keep.length === prev.length ? prev : keep;
    });
  }, []);

  useEffect(() => {
    const timers = toastTimersRef.current;
    return () => {
      timers.forEach(id => clearTimeout(id));
      timers.clear();
    };
  }, []);

  /**
   * Commit everything tracked off-state during the run (mission progress,
   * best score / distance) to React state and storage. Called at run end,
   * pause, quit and when the tab is hidden.
   */
  const flushRunProgress = useCallback(() => {
    // Fold in the very latest stats (the 2 Hz check may be up to 0.5 s old,
    // e.g. the score at the moment of the crash).
    const s = liveStats.getLiveStats();
    if (s.score > highScoreRef.current) highScoreRef.current = s.score;
    if (s.distance > bestDistanceRef.current) bestDistanceRef.current = s.distance;
    const base = pendingMissionsRef.current ?? missionsRef.current;
    pendingMissionsRef.current = null;
    const { list, changed } = progressMissions(base, s);
    if (changed || base !== missionsRef.current) {
      missionsRef.current = list;
      setMissions(list);
      persistMissions(list);
    }
    const best = highScoreRef.current;
    setHighScore(prev => (best > prev ? best : prev));
    const dist = bestDistanceRef.current;
    setBestDistance(prev => (dist > prev ? dist : prev));
  }, []);

  // Watch live stats outside React: best score/distance every tick (cheap
  // refs), missions at 2 Hz, and state/storage only when a mission completes.
  useEffect(() => {
    liveStats.setHighScoreFloor(highScoreRef.current);
    let lastCheck = 0;
    const unsubscribe = liveStats.subscribe(() => {
      const s = liveStats.getSnapshot().stats;
      if (s.score > highScoreRef.current) {
        highScoreRef.current = s.score;
        liveStats.setHighScoreFloor(s.score);
      }
      if (s.distance > bestDistanceRef.current) bestDistanceRef.current = s.distance;

      const now = performance.now();
      if (now - lastCheck < MISSION_CHECK_INTERVAL_MS) return;
      lastCheck = now;
      const base = pendingMissionsRef.current ?? missionsRef.current;
      const { list, changed, completedFlip } = progressMissions(base, s);
      if (!changed) return;
      if (completedFlip) {
        pendingMissionsRef.current = null;
        missionsRef.current = list;
        setMissions(list);
        persistMissions(list);
      } else {
        pendingMissionsRef.current = list;
      }
    });
    const onHidden = () => {
      if (document.visibilityState === 'hidden') flushRunProgress();
    };
    document.addEventListener('visibilitychange', onHidden);
    return () => {
      unsubscribe();
      document.removeEventListener('visibilitychange', onHidden);
    };
  }, [flushRunProgress]);

  // Download/decode the hero + obstacle GLBs while the opening screen is up.
  useEffect(() => {
    preloadGameAssets(cosmeticsConfig.heroId || 'shadow');
  }, [cosmeticsConfig.heroId]);

  const handleClaimMission = useCallback((missionId: string) => {
    flushRunProgress();
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
  }, [triggerNotification, flushRunProgress]);

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



  const handleToggleMute = useCallback(() => {
    setIsMuted(prev => !prev);
  }, []);

  // Keep the AudioManager (GameCanvas also syncs it on creation) and the saved
  // preference in step with the toggle; the stored value is read on load.
  useEffect(() => {
    audioManagerRef.current?.setMuted(isMuted);
    StorageSanitizer.safeSetItem(MUTED_STORAGE_KEY, isMuted);
  }, [isMuted]);

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
    // The run summary takes over: drop the run's queued toasts (WIPEOUT,
    // level-ups from the final XP...) so none draws over it; anything fired
    // from here on is feedback for the game-over screen.
    overlayUpRef.current = true;
    isGameOverRef.current = true;
    clearToasts(false);
    const finalStats = liveStats.getLiveStats();
    flushRunProgress();
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
      // (No toast: the game-over screen shows the run's shards and the bank.)
    }

    // Submit to Social & Competitive Leaderboards
    if (socialMgrRef.current && gameModeMgrRef.current) {
      const lastSummary = gameModeMgrRef.current.getLastSummary();
      if (lastSummary) {
        socialMgrRef.current.submitRunSummary(lastSummary, progressionMgrRef.current || undefined);
      }
    }
    progressionMgrRef.current?.flushSave();
  }, [clearToasts, flushRunProgress]);

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
      // The engine's own stats object: the deduction reaches the running game.
      const live = liveStats.getLiveStats();
      const runShards = live.dataShardsCollected || 0;
      if (runShards >= 15) {
        const remaining = runShards - 15;
        live.dataShardsCollected = remaining;
        live.windOrbsCollected = remaining;
        liveStats.refresh();
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
    isCompetitiveOpen ||
    isHudMenuOpen;

  // The 3D run is frozen whenever the pause menu, any modal or the resume
  // countdown is up; GameCanvas receives this as its isPaused flag.
  const isRunFrozen = isPaused || isAnyModalOpen || resumeCountdown > 0;

  // Any full screen or menu over the run: run toasts wait, others show at the top edge.
  const isOverlayUp = !hasStarted || isGameOver || isPaused || isAnyModalOpen;
  overlayUpRef.current = isOverlayUp;
  isGameOverRef.current = isGameOver;
  const shownToasts = (isOverlayUp ? toasts.filter(t => !t.run) : toasts).slice(0, maxVisibleToasts);
  const shownToastKey = shownToasts.map(t => t.id + ':' + t.count).join(',');

  // Each toast's lifetime starts when it becomes visible; one that gets
  // hidden (a menu opened over the run) gets a fresh lifetime when it returns.
  useEffect(() => {
    const timers = toastTimersRef.current;
    const shownIds = new Set(shownToasts.map(t => t.id));
    for (const [id, timer] of timers) {
      if (!shownIds.has(id)) {
        clearTimeout(timer);
        timers.delete(id);
      }
    }
    for (const t of shownToasts) {
      if (timers.has(t.id)) continue;
      timers.set(
        t.id,
        window.setTimeout(() => {
          timers.delete(t.id);
          setToasts(prev => prev.filter(x => x.id !== t.id));
        }, TOAST_DURATION_MS)
      );
    }
    // shownToastKey captures every change to shownToasts that matters here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shownToastKey]);

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
    setIsHudMenuOpen(false);
    handleCloseProgression();
  }, [handleCloseProgression]);

  const pauseRun = useCallback(() => {
    setResumeCountdown(0);
    setIsPaused(true);
    flushRunProgress();
    progressionMgrRef.current?.flushSave();
  }, [flushRunProgress]);

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

  /** Bookkeeping for a brand-new run (start, restart; not a revive). */
  const beginNewRun = useCallback(() => {
    bankedThisRunRef.current = 0;
    progressionMgrRef.current?.markRunStart();
    clearToasts(true);
    setIsHudMenuOpen(false);
    setResumeCountdown(0);
    setRestartCount(c => c + 1);
  }, [clearToasts]);

  const handleStartGame = useCallback(() => {
    setHasStarted(true);
    setIsGameOver(false);
    setIsPaused(false);
    beginNewRun();
  }, [beginNewRun]);

  const handleQuitToMenu = useCallback(() => {
    flushRunProgress();
    progressionMgrRef.current?.flushSave();
    clearToasts(true);
    setIsHudMenuOpen(false);
    bankedThisRunRef.current = 0;
    setIsPaused(false);
    setResumeCountdown(0);
    setIsGameOver(false);
    setHasStarted(false);
    if (audioManagerRef.current) {
      audioManagerRef.current.dispose();
      audioManagerRef.current = null;
    }
  }, [flushRunProgress]);

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
            audioManagerRef={audioManagerRef}
            isCinematicCam={isCinematicCam}
            isUpright={isUprightMode}
            isPaused={isRunFrozen}
            isMuted={isMuted}
            onNotification={handleEngineNotification}
            onGameOver={handleGameOver}
            onRequestPause={pauseRun}
            restartTrigger={restartCount}
            reviveTrigger={reviveCount}
            shieldTrigger={shieldCount}
          />

          {/* Game HUD */}
          <GameHUD
            bankedShards={bankedShards}
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
            isMenuOpen={isHudMenuOpen}
            onMenuOpenChange={setIsHudMenuOpen}
          />

          {/* On-Screen Touch & Keybind Controls */}
          <ControlsOverlay
            onControlAction={handleControlAction}
            onTriggerTrick={setActiveMobileTrick}
          />
        </div>
      )}

      {/* Graphics & Shaders Settings Drawer */}
      <LiveGraphicsDrawer
        isOpen={isGraphicsDrawerOpen}
        onClose={() => setIsGraphicsDrawerOpen(false)}
        config={graphicsConfig}
        onUpdateConfig={handleUpdateConfig}
        lightingMode={lightingMode}
        onSelectLighting={setLightingMode}
        shaderParams={shaderParams}
        onUpdateShaderParams={handleUpdateShaderParams}
        onResetDefaults={handleResetDefaults}
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
        <LivePauseModal
          isOpen={isPaused}
          onResume={resumeRun}
          onRestart={() => {
            setIsPaused(false);
            beginNewRun();
          }}
          onOpenCosmetics={() => handleOpenShop('boards')}
          onOpenGraphics={() => setIsSettingsOpen(true)}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
          missions={missions}
          onClaimMission={handleClaimMission}
          onQuitToMenu={handleQuitToMenu}
        />
      )}

      {/* Game Over / Journey's Respite Modal (stays the active screen while a
          modal such as the shop is open over it, and returns when it closes) */}
      {isGameOver && !isAnyModalOpen && (
        <LiveGameOverModal
          bankedShards={bankedShards}
          missions={missions}
          progressionMgr={progressionMgrRef.current || undefined}
          gameModeMgr={gameModeMgrRef.current || undefined}
          socialMgr={socialMgrRef.current || undefined}
          onOpenProgression={() => setIsProgressionOpen(true)}
          onOpenCompetitive={() => setIsCompetitiveOpen(true)}
          onClaimMission={handleClaimMission}
          onRestart={() => {
            setIsGameOver(false);
            beginNewRun();
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
      <ToastStack toasts={shownToasts} placement={isOverlayUp ? 'overlay' : 'run'} />
    </div>
  );
}
