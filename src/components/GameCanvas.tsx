import React, { useEffect, useRef } from 'react';
import { GameEngine } from '../game/GameEngine';
import { AudioManager } from '../game/audio';
import { setActiveBiome, clearBiomeOverride } from '../game/terrain';
import { ProgressionManager } from '../game/progression';
import { CosmeticManager } from '../game/cosmetics';
import { GameModeManager } from '../game/modes';
import {
  BiomeType,
  CosmeticsConfig,
  GraphicsConfig,
  LightingMode,
  PlayerStats,
  PlayerUpgrades,
  ShaderParams,
  TrickType,
} from '../types';

interface GameCanvasProps {
  graphicsConfig: GraphicsConfig;
  lightingMode: LightingMode;
  shaderParams: ShaderParams;
  cosmeticsConfig: CosmeticsConfig;
  upgrades?: PlayerUpgrades;
  progressionMgr?: ProgressionManager;
  cosmeticMgr?: CosmeticManager;
  gameModeMgr?: GameModeManager;
  activeMobileTrick: TrickType | null;
  onClearMobileTrick: () => void;
  onStatsUpdate: (stats: PlayerStats, fps: number, drawCalls: number, instanceCount: number) => void;
  audioManagerRef: React.MutableRefObject<AudioManager | null>;
  isCinematicCam: boolean;
  isUpright?: boolean;
  isPaused?: boolean;
  onNotification: (msg: string) => void;
  onGameOver?: () => void;
  restartTrigger?: number;
  reviveTrigger?: number;
  shieldTrigger?: number;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
  graphicsConfig,
  lightingMode,
  shaderParams,
  cosmeticsConfig,
  upgrades,
  progressionMgr,
  cosmeticMgr,
  gameModeMgr,
  activeMobileTrick,
  onClearMobileTrick,
  onStatsUpdate,
  audioManagerRef,
  isCinematicCam,
  isUpright = true,
  isPaused = false,
  onNotification,
  onGameOver,
  restartTrigger,
  reviveTrigger,
  shieldTrigger,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);

  // Synchronized callback refs
  const onGameOverRef = useRef(onGameOver);
  onGameOverRef.current = onGameOver;

  const onStatsUpdateRef = useRef(onStatsUpdate);
  onStatsUpdateRef.current = onStatsUpdate;

  const onNotificationRef = useRef(onNotification);
  onNotificationRef.current = onNotification;

  // Initialize and run the GameEngine runtime
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (!audioManagerRef.current) {
      audioManagerRef.current = new AudioManager();
    }

    const engine = new GameEngine({
      container,
      graphicsConfig,
      lightingMode,
      shaderParams,
      cosmeticsConfig,
      upgrades,
      isUpright,
      audioManager: audioManagerRef.current,
      progressionMgr,
      cosmeticMgr,
      gameModeMgr,
      onStatsUpdate: (stats, fps, calls, instances) => {
        onStatsUpdateRef.current(stats, fps, calls, instances);
      },
      onNotification: msg => {
        onNotificationRef.current(msg);
      },
      onGameOver: () => {
        onGameOverRef.current?.();
      },
    });

    engineRef.current = engine;
    engine.start();

    // Dev and testing hooks
    if (typeof window !== 'undefined') {
      (window as any).__gameEngine = engine;
      (window as any).__playerManager = engine.playerMgr;
      (window as any).__setActiveBiome = (b: BiomeType | null) => {
        setActiveBiome(b);
        engine.terrainMgr.rebuildAroundPlayer(engine.playerMgr.stats.distance, 0, 4);
      };
      (window as any).__clearBiomeOverride = () => {
        clearBiomeOverride();
        engine.terrainMgr.rebuildAroundPlayer(engine.playerMgr.stats.distance, 0, 4);
      };
    }

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  // Synchronize dynamic parameters without restarting engine
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.isPaused = isPaused;
    }
  }, [isPaused]);

  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.isCinematicCam = isCinematicCam;
    }
  }, [isCinematicCam]);

  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.updateGraphicsConfig(graphicsConfig);
    }
  }, [graphicsConfig]);

  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.updateLightingMode(lightingMode);
    }
  }, [lightingMode]);

  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.updateShaderParams(shaderParams);
    }
  }, [shaderParams]);

  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.playerMgr.applyCosmetics(cosmeticsConfig);
    }
  }, [cosmeticsConfig]);

  useEffect(() => {
    if (engineRef.current && upgrades) {
      engineRef.current.playerMgr.applyUpgrades(upgrades);
    }
  }, [upgrades]);

  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.isUpright = isUpright;
      engineRef.current.playerMgr.setUpright(isUpright);
    }
  }, [isUpright]);

  // Handle Gameplay Triggers
  useEffect(() => {
    if (restartTrigger && engineRef.current) {
      engineRef.current.resetRun();
    }
  }, [restartTrigger]);

  useEffect(() => {
    if (reviveTrigger && engineRef.current) {
      engineRef.current.revivePlayer();
    }
  }, [reviveTrigger]);

  useEffect(() => {
    if (shieldTrigger && engineRef.current) {
      engineRef.current.deployShield();
    }
  }, [shieldTrigger]);

  useEffect(() => {
    if (activeMobileTrick && engineRef.current) {
      engineRef.current.triggerTrick(activeMobileTrick);
      onClearMobileTrick();
    }
  }, [activeMobileTrick, onClearMobileTrick]);

  return (
    <div
      ref={containerRef}
      id="game-canvas-container"
      className="relative w-full h-full overflow-hidden select-none touch-none bg-slate-900"
    />
  );
};
