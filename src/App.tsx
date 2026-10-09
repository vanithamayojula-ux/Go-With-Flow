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
      return saved ? { ...DEFAULT_GRAPHICS_CONFIG, ...JSON.parse(saved) } : DEFAULT_GRAPHICS_CONFIG;
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
  const [notification, setNotification] = useState<string | null>(null);
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
  const notifTimeoutRef = useRef<number | null>(null);

  const triggerNotification = useCallback((msg: string) => {
    setNotification(msg);
    if (notifTimeoutRef.current) clearTimeout(notifTimeoutRef.current);
    notifTimeoutRef.current = window.setTimeout(() => {
      setNotification(null);
    }, 2400);
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

  // Keyboard shortcut listener for Escape and P to pause/resume
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Escape' || e.code === 'KeyP') {
        if (
          hasStarted &&
          !isGameOver &&
          !isHowToOpen &&
          !isSettingsOpen &&
          !isCosmeticsOpen &&
          !isGraphicsDrawerOpen &&
          !isDeliverablesOpen &&
          !isDatasetOpen
        ) {
          setIsPaused(prev => !prev);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    hasStarted,
    isGameOver,
    isHowToOpen,
    isSettingsOpen,
    isCosmeticsOpen,
    isGraphicsDrawerOpen,
    isDeliverablesOpen,
    isDatasetOpen,
  ]);

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
    setRestartCount((c) => c + 1);
  }, []);

  const handleQuitToMenu = useCallback(() => {
    bankedThisRunRef.current = 0;
    setIsPaused(false);
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
    <div id="skyflow-app-container" className="relative w-screen h-screen overflow-hidden bg-slate-950">
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
            isPaused={isPaused}
            onNotification={triggerNotification}
            onGameOver={handleGameOver}
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
            onPause={() => setIsPaused(prev => !prev)}
            gameModeMgr={gameModeMgrRef.current || undefined}
            notification={notification}
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

      {/* Game Paused Modal */}
      {isPaused && !isGameOver && (
        <PauseModal
          isOpen={isPaused}
          onResume={() => setIsPaused(false)}
          onRestart={() => {
            bankedThisRunRef.current = 0;
            setIsPaused(false);
            setRestartCount(c => c + 1);
          }}
          onOpenCosmetics={() => {
            setIsPaused(false);
            handleOpenShop('boards');
          }}
          onOpenGraphics={() => {
            setIsPaused(false);
            setIsSettingsOpen(true);
          }}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
          stats={stats}
          missions={missions}
          onClaimMission={handleClaimMission}
          onQuitToMenu={handleQuitToMenu}
        />
      )}

      {/* Game Over / Journey's Respite Modal */}
      {isGameOver && (
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
          onOpenShop={() => {
            setIsGameOver(false);
            handleOpenShop('boards');
          }}
          onMainMenu={handleQuitToMenu}
        />
      )}

      {/* Pilot Progression Modal */}
      {isProgressionOpen && progressionMgrRef.current && (
        <ProgressionModal
          progressionMgr={progressionMgrRef.current}
          onClose={() => {
            setIsProgressionOpen(false);
            if (progressionMgrRef.current) {
              setPlayerLevel(progressionMgrRef.current.getLevel());
            }
          }}
          onClaimChallenge={(id) => {
            if (progressionMgrRef.current) {
              setPlayerLevel(progressionMgrRef.current.getLevel());
              const totalShards = progressionMgrRef.current.getData().walletShards;
              setBankedShards(totalShards);
            }
          }}
          onClaimAchievement={(id) => {
            if (progressionMgrRef.current) {
              setPlayerLevel(progressionMgrRef.current.getLevel());
              const totalShards = progressionMgrRef.current.getData().walletShards;
              setBankedShards(totalShards);
            }
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
    </div>
  );
}
