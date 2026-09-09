import React, { useState, useRef, useCallback } from 'react';
import { GameCanvas } from './components/GameCanvas';
import { GameHUD } from './components/GameHUD';
import { ControlsOverlay } from './components/ControlsOverlay';
import { GraphicsDrawer } from './components/GraphicsDrawer';
import { AssetDeliverablesModal } from './components/AssetDeliverablesModal';
import { CosmeticsModal } from './components/CosmeticsModal';
import { AudioManager } from './game/audio';
import {
  CosmeticsConfig,
  GraphicsConfig,
  LightingMode,
  PlayerStats,
  QualityPreset,
  ShaderParams,
  TrickType,
} from './types';

const DEFAULT_COSMETICS_CONFIG: CosmeticsConfig = {
  boardId: 'ivory-drift',
  trailId: 'verdant-breeze',
  capeColor: '#c85a32', // Warm Ghibli terracotta rust
  poseId: 'standard',
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
  rimLightIntensity: 0.6,
  celRampHardness: 0.35,
  slopeWarmth: 0.3,
  filmGrainIntensity: 0.032, // Subtle 0.02 - 0.04 target
  bloomIntensity: 0.45,
  colorLift: 0.4,
  highSpeedBlur: 0.6,
};

export default function App() {
  const [graphicsConfig, setGraphicsConfig] = useState<GraphicsConfig>(DEFAULT_GRAPHICS_CONFIG);
  const [lightingMode, setLightingMode] = useState<LightingMode>('golden-hour');
  const [shaderParams, setShaderParams] = useState<ShaderParams>(DEFAULT_SHADER_PARAMS);
  const [cosmeticsConfig, setCosmeticsConfig] = useState<CosmeticsConfig>(DEFAULT_COSMETICS_CONFIG);
  const [isCinematicCam, setIsCinematicCam] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isGraphicsDrawerOpen, setIsGraphicsDrawerOpen] = useState(false);
  const [isDeliverablesOpen, setIsDeliverablesOpen] = useState(false);
  const [isCosmeticsOpen, setIsCosmeticsOpen] = useState(false);
  const [activeMobileTrick, setActiveMobileTrick] = useState<TrickType | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [isUprightMode, setIsUprightMode] = useState<boolean>(true);

  const [stats, setStats] = useState<PlayerStats>({
    speed: 18,
    maxSpeed: 42,
    distance: 0,
    score: 0,
    styleMeter: 15,
    styleTier: 'Chill',
    airTime: 0,
    isGrounded: true,
    combo: 0,
    windOrbsCollected: 0,
    currentBiome: 'meadow',
    currentFriction: 0.08,
    activeTrickName: null,
    slowMoActive: false,
    isOnFloatingIsland: false,
  });

  const [fps, setFps] = useState(60);
  const [drawCalls, setDrawCalls] = useState(45);
  const [instanceCount, setInstanceCount] = useState(850);

  const audioManagerRef = useRef<AudioManager | null>(null);
  const notifTimeoutRef = useRef<number | null>(null);

  const handleStatsUpdate = useCallback((newStats: PlayerStats, currentFps: number, calls: number, instances: number) => {
    setStats({ ...newStats });
    setFps(currentFps);
    setDrawCalls(calls);
    setInstanceCount(instances);
  }, []);

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
    setLightingMode('golden-hour');
    triggerNotification('Settings reset to defaults');
  }, [triggerNotification]);

  // Bridge touch overlay buttons to synthetic keyboard events
  const handleControlAction = useCallback((action: 'left' | 'right' | 'jump' | 'forward' | 'drift', pressed: boolean) => {
    const keyMap = {
      left: 'KeyA',
      right: 'KeyD',
      forward: 'KeyW',
      jump: 'Space',
      drift: 'ShiftLeft',
    };
    const code = keyMap[action];
    const eventType = pressed ? 'keydown' : 'keyup';
    window.dispatchEvent(new KeyboardEvent(eventType, { code, bubbles: true }));
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
          activeMobileTrick={activeMobileTrick}
          onClearMobileTrick={() => setActiveMobileTrick(null)}
          onStatsUpdate={handleStatsUpdate}
          audioManagerRef={audioManagerRef}
          isCinematicCam={isCinematicCam}
          isUpright={isUprightMode}
          onNotification={triggerNotification}
        />

        {/* Game HUD */}
        <GameHUD
          stats={stats}
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
          onOpenGraphicsDrawer={() => setIsGraphicsDrawerOpen(true)}
          onOpenDeliverables={() => setIsDeliverablesOpen(true)}
          onOpenCosmetics={() => setIsCosmeticsOpen(true)}
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

      {/* Voyager Cosmetics & Equipment Modal */}
      <CosmeticsModal
        isOpen={isCosmeticsOpen}
        onClose={() => setIsCosmeticsOpen(false)}
        cosmetics={cosmeticsConfig}
        onUpdateCosmetics={setCosmeticsConfig}
      />
    </div>
  );
}
