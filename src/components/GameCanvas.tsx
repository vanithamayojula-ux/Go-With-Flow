import React, { useEffect, useRef } from 'react';
import { GameEngine } from '../game/GameEngine';
import { AudioManager } from '../game/audio';
import { setActiveBiome, clearBiomeOverride } from '../game/terrain';
import { ProgressionManager } from '../game/progression';
import { CosmeticManager } from '../game/cosmetics';
import { GameModeManager } from '../game/modes';
import { whenRoadTexturesReady } from '../game/perf/preload';
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
  /** Optional: live stats are published to the liveStats store (src/state/liveStats.ts). */
  onStatsUpdate?: (stats: PlayerStats, fps: number, drawCalls: number, instanceCount: number) => void;
  audioManagerRef: React.MutableRefObject<AudioManager | null>;
  isCinematicCam: boolean;
  isUpright?: boolean;
  isPaused?: boolean;
  isMuted?: boolean;
  onNotification: (msg: string) => void;
  onGameOver?: () => void;
  /** Engine auto-pause (tab hidden / window blur): the UI should show the pause menu. */
  onRequestPause?: () => void;
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
  isMuted = false,
  onNotification,
  onGameOver,
  onRequestPause,
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

  const onRequestPauseRef = useRef(onRequestPause);
  onRequestPauseRef.current = onRequestPause;

  const isMutedRef = useRef(isMuted);
  isMutedRef.current = isMuted;

  const isPausedRef = useRef(isPaused);
  isPausedRef.current = isPaused;

  // Latest props for the (deferred) engine construction below.
  const initRef = useRef({ graphicsConfig, lightingMode, shaderParams, cosmeticsConfig, upgrades, isUpright, isCinematicCam });
  initRef.current = { graphicsConfig, lightingMode, shaderParams, cosmeticsConfig, upgrades, isUpright, isCinematicCam };

  // Initialize and run the GameEngine runtime
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Quit to Menu disposes the AudioManager; the new one must start with the
    // player's current mute setting or the mute button and audio desync.
    if (!audioManagerRef.current) {
      audioManagerRef.current = new AudioManager(isMutedRef.current);
    } else {
      audioManagerRef.current.setMuted(isMutedRef.current);
    }

    // Paint the loading overlay first, construct the engine after the browser
    // has presented it (next frame + a task): building the renderer, road and
    // managers is heavy, and done inside this effect it froze the click/Enter
    // that launched the run with no visible feedback.
    const overlay = GameEngine.createLoadingOverlay(container);
    let engine: GameEngine | null = null;
    let cancelled = false;
    let timer = 0;
    const raf = requestAnimationFrame(() => {
      timer = window.setTimeout(() => {
        if (cancelled) return;
        whenRoadTexturesReady().then(() => {
          if (!cancelled) construct();
        });
      }, 0);
    });

    // Dev and testing hooks: only in dev builds or with ?debug in the URL.
    const exposeDebugHooks =
      typeof window !== 'undefined' &&
      (import.meta.env.DEV || new URLSearchParams(window.location.search).has('debug'));

    const construct = () => {
      const init = initRef.current;
      engine = new GameEngine({
        container,
        graphicsConfig: init.graphicsConfig,
        lightingMode: init.lightingMode,
        shaderParams: init.shaderParams,
        cosmeticsConfig: init.cosmeticsConfig,
        upgrades: init.upgrades,
        isUpright: init.isUpright,
        audioManager: audioManagerRef.current!,
        progressionMgr,
        cosmeticMgr,
        gameModeMgr,
        loadingOverlay: overlay,
        onStatsUpdate: (stats, fps, calls, instances) => {
          onStatsUpdateRef.current?.(stats, fps, calls, instances);
        },
        onNotification: msg => {
          onNotificationRef.current(msg);
        },
        onGameOver: () => {
          onGameOverRef.current?.();
        },
        onRequestPause: () => {
          onRequestPauseRef.current?.();
        },
      });

      const e = engine;
      engineRef.current = e;
      // Mount already paused if the UI is (e.g. a modal is open over the stage).
      e.isPaused = isPausedRef.current;
      e.isCinematicCam = init.isCinematicCam;
      e.start();

      if (exposeDebugHooks) {
        (window as any).__gameEngine = e;
        (window as any).__playerManager = e.playerMgr;
        (window as any).__setActiveBiome = (b: BiomeType | null) => {
          setActiveBiome(b);
          e.terrainMgr.rebuildAroundPlayer(e.playerMgr.stats.distance, 0, 4);
        };
        (window as any).__clearBiomeOverride = () => {
          clearBiomeOverride();
          e.terrainMgr.rebuildAroundPlayer(e.playerMgr.stats.distance, 0, 4);
        };
      }
    };

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
      if (engine) engine.dispose();
      else overlay?.remove();
      engineRef.current = null;
      // Drop the dev hooks so they don't keep the disposed engine alive.
      if (exposeDebugHooks) {
        (window as any).__gameEngine = undefined;
        (window as any).__playerManager = undefined;
        (window as any).__setActiveBiome = undefined;
        (window as any).__clearBiomeOverride = undefined;
      }
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
    audioManagerRef.current?.setMuted(isMuted);
  }, [isMuted]);

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
