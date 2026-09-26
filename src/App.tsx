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
import { AudioManager } from './game/audio';
import {
  CosmeticsConfig,
  GraphicsConfig,
  LightingMode,
  PlayerStats,
  PlayerUpgrades,
  QualityPreset,
  ShaderParams,
  TrickType,
} from './types';

const DEFAULT_COSMETICS_CONFIG: CosmeticsConfig = {
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

export default function App() {
  const [graphicsConfig, setGraphicsConfig] = useState<GraphicsConfig>(DEFAULT_GRAPHICS_CONFIG);
  const [lightingMode, setLightingMode] = useState<LightingMode>('midnight-cyan');
  const [shaderParams, setShaderParams] = useState<ShaderParams>(DEFAULT_SHADER_PARAMS);
  const [cosmeticsConfig, setCosmeticsConfig] = useState<CosmeticsConfig>(() => {
    try {
      const saved = localStorage.getItem('skyflow_cosmetics');
      return saved ? { ...DEFAULT_COSMETICS_CONFIG, ...JSON.parse(saved) } : DEFAULT_COSMETICS_CONFIG;
    } catch {
      return DEFAULT_COSMETICS_CONFIG;
    }
  });
  const [isCinematicCam, setIsCinematicCam] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isGraphicsDrawerOpen, setIsGraphicsDrawerOpen] = useState(false);
  const [isDeliverablesOpen, setIsDeliverablesOpen] = useState(false);
  const [isCosmeticsOpen, setIsCosmeticsOpen] = useState(false);
  const [isDatasetOpen, setIsDatasetOpen] = useState(false);
  const [activeMobileTrick, setActiveMobileTrick] = useState<TrickType | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [isUprightMode, setIsUprightMode] = useState<boolean>(true);

  // Persistent Currency & Cyber Bay Upgrades
  const [bankedShards, setBankedShards] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('skyflow_banked_shards');
      return saved ? parseInt(saved, 10) || 0 : 0;
    } catch {
      return 0;
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
      return saved ? JSON.parse(saved) : ['cyber-phantom', 'electric-cyan', 'carbon-fiber'];
    } catch {
      return ['cyber-phantom', 'electric-cyan', 'carbon-fiber'];
    }
  });

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

  const [fps, setFps] = useState(60);
  const [drawCalls, setDrawCalls] = useState(45);
  const [instanceCount, setInstanceCount] = useState(850);

  const audioManagerRef = useRef<AudioManager | null>(null);
  const notifTimeoutRef = useRef<number | null>(null);

  const handleStatsUpdate = useCallback((newStats: PlayerStats, currentFps: number, calls: number, instances: number) => {
    // Dynamically modulate the speedLineIntensity property based on current player speed stats
    // As speed exceeds 40, linearly interpolate from 0 to 0.8 to visualize high-velocity movement
    const currentSpeed = newStats.speed;
    const dynamicIntensity = currentSpeed > 40
      ? Math.min(0.8, ((currentSpeed - 40) / 50.0) * 0.8)
      : 0.0;

    setShaderParams(prev => {
      if (Math.abs((prev.speedLineIntensity ?? 0) - dynamicIntensity) > 0.015) {
        return { ...prev, speedLineIntensity: dynamicIntensity };
      }
      return prev;
    });

    if (newStats.score > highScore) {
      setHighScore(newStats.score);
      try {
        localStorage.setItem('skyflow_high_score', String(newStats.score));
      } catch {}
    }
    newStats.highScore = Math.max(newStats.highScore, highScore, newStats.score);
    setStats({ ...newStats });
    setFps(currentFps);
    setDrawCalls(calls);
    setInstanceCount(instances);
  }, [highScore]);

  const triggerNotification = useCallback((msg: string) => {
    setNotification(msg);
    if (notifTimeoutRef.current) clearTimeout(notifTimeoutRef.current);
    notifTimeoutRef.current = window.setTimeout(() => {
      setNotification(null);
    }, 2400);
  }, []);

  const handleToggleMute = useCallback(() => {
    if (audioManagerRef.current) {
      const muted = audioManagerRef.current.toggleMute();
      setIsMuted(muted);
    }
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
      return updated;
    });
  }, []);

  const handleUpdateShaderParams = useCallback((newParams: Partial<ShaderParams>) => {
    setShaderParams(prev => ({ ...prev, ...newParams }));
  }, []);

  const handleResetDefaults = useCallback(() => {
    setGraphicsConfig(DEFAULT_GRAPHICS_CONFIG);
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

  // Unlock Hoverboard or Trail Handler
  const handleUnlockItem = useCallback((itemId: string, cost: number) => {
    if (bankedShards < cost) {
      triggerNotification('⚠️ Insufficient Data Shards to unlock item');
      return;
    }
    const newBank = bankedShards - cost;
    setBankedShards(newBank);
    try {
      localStorage.setItem('skyflow_banked_shards', String(newBank));
    } catch {}

    setUnlockedItems(prev => {
      if (prev.includes(itemId)) return prev;
      const updated = [...prev, itemId];
      try {
        localStorage.setItem('skyflow_unlocked_items', JSON.stringify(updated));
      } catch {}
      return updated;
    });
    triggerNotification('✨ Equipment Unlocked! Ready to equip in bay!');
  }, [bankedShards, triggerNotification]);

  // System Crash / Game Over Handler: Bank run harvest into persistent wallet
  const handleGameOver = useCallback(() => {
    setIsGameOver(true);
    const runShards = stats.dataShardsCollected || stats.windOrbsCollected || 0;
    if (runShards > 0) {
      setBankedShards(prev => {
        const next = prev + runShards;
        try {
          localStorage.setItem('skyflow_banked_shards', String(next));
        } catch {}
        return next;
      });
      triggerNotification(`💾 +${runShards} Data Shards Banked!`);
    }
  }, [stats.dataShardsCollected, stats.windOrbsCollected, triggerNotification]);

  // Emergency Revive Handler
  const handleRevive = useCallback(() => {
    if (bankedShards >= 15) {
      const nextBank = bankedShards - 15;
      setBankedShards(nextBank);
      try {
        localStorage.setItem('skyflow_banked_shards', String(nextBank));
      } catch {}
      setIsGameOver(false);
      setReviveCount(c => c + 1);
    } else if ((stats.dataShardsCollected || stats.windOrbsCollected || 0) >= 15) {
      setStats(prev => ({
        ...prev,
        dataShardsCollected: Math.max(0, (prev.dataShardsCollected || 0) - 15),
        windOrbsCollected: Math.max(0, (prev.windOrbsCollected || 0) - 15),
      }));
      setIsGameOver(false);
      setReviveCount(c => c + 1);
    }
  }, [bankedShards, stats.dataShardsCollected, stats.windOrbsCollected]);

  // Keyboard shortcut listener for Escape and P to pause/resume
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Escape' || e.code === 'KeyP') {
        if (!isGameOver) {
          setIsPaused(prev => !prev);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isGameOver]);

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

  return (
    <div id="skyflow-app-container" className="relative w-screen h-screen overflow-hidden bg-slate-950">
      {/* Main Game Stage */}
      <div className="relative w-full h-full overflow-hidden">
        {/* 3D WebGL Canvas */}
        <GameCanvas
          graphicsConfig={graphicsConfig}
          lightingMode={lightingMode}
          shaderParams={shaderParams}
          cosmeticsConfig={cosmeticsConfig}
          upgrades={playerUpgrades}
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
          fps={fps}
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
          onOpenCosmetics={() => setIsCosmeticsOpen(true)}
          onOpenDatasetCapture={() => setIsDatasetOpen(true)}
          onPause={() => setIsPaused(prev => !prev)}
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
        fps={fps}
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
      />

      {/* Game Paused Modal */}
      {isPaused && !isGameOver && (
        <PauseModal
          isOpen={isPaused}
          onResume={() => setIsPaused(false)}
          onRestart={() => {
            setIsPaused(false);
            setRestartCount(c => c + 1);
          }}
          onOpenCosmetics={() => {
            setIsPaused(false);
            setIsCosmeticsOpen(true);
          }}
          onOpenGraphics={() => {
            setIsPaused(false);
            setIsGraphicsDrawerOpen(true);
          }}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
          stats={stats}
        />
      )}

      {/* Game Over / Journey's Respite Modal */}
      {isGameOver && (
        <GameOverModal
          stats={stats}
          bankedShards={bankedShards}
          onRestart={() => {
            setIsGameOver(false);
            setRestartCount(c => c + 1);
          }}
          onRevive={handleRevive}
          onOpenShop={() => {
            setIsGameOver(false);
            setIsCosmeticsOpen(true);
          }}
        />
      )}
    </div>
  );
}
