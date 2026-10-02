import React, { useEffect } from 'react';
import {
  X,
  Sliders,
  Volume2,
  VolumeX,
  Monitor,
  Smartphone,
  Eye,
  Sparkles,
  Zap,
  RotateCcw,
  Check,
} from 'lucide-react';
import { GraphicsConfig, QualityPreset, ShaderParams } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: GraphicsConfig;
  onUpdateConfig: (newConfig: Partial<GraphicsConfig>) => void;
  shaderParams: ShaderParams;
  onUpdateShaderParams: (newParams: Partial<ShaderParams>) => void;
  isMuted: boolean;
  onToggleMute: () => void;
  onResetDefaults: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  config,
  onUpdateConfig,
  shaderParams,
  onUpdateShaderParams,
  isMuted,
  onToggleMute,
  onResetDefaults,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      id="settings-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-xl animate-in fade-in duration-200 font-mono"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
    >
      <div
        id="settings-modal-dialog"
        className="w-full max-w-xl bg-black/95 border-2 border-cyan-500/40 rounded-2xl p-5 sm:p-6 shadow-[0_0_50px_rgba(0,240,255,0.25)] text-white overflow-hidden max-h-[92vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-cyan-500/20">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-cyan-950/60 border border-cyan-400/50 text-cyan-300 shadow-[0_0_10px_rgba(0,240,255,0.3)]">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 id="settings-modal-title" className="text-base sm:text-lg font-black tracking-wider text-cyan-300 uppercase">
                SYSTEM // SETTINGS & ENGINE
              </h2>
              <p className="text-[11px] text-white/60">Graphics fidelity, visual effects, and audio configuration</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="min-h-[48px] min-w-[48px] flex items-center justify-center rounded-xl bg-white/5 hover:bg-cyan-950/40 border border-white/10 hover:border-cyan-500/40 text-white/70 hover:text-cyan-300 focus-visible:ring-2 focus-visible:ring-cyan-400 transition-all cursor-pointer"
            aria-label="Close Settings Dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto py-4 space-y-6 pr-1 custom-scrollbar">
          {/* Quality Presets */}
          <div>
            <label className="block text-xs font-black tracking-widest uppercase text-cyan-300 mb-2.5">
              GRAPHICS FIDELITY PRESET
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'desktop-full' as QualityPreset, label: 'ULTRA (PC)', desc: 'Full FX & Shadows' },
                { id: 'mobile-opt' as QualityPreset, label: 'BALANCED', desc: 'Optimized Mobile' },
                { id: 'webgl-min' as QualityPreset, label: 'LOW / MIN', desc: 'Max FPS Economy' },
              ].map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => onUpdateConfig({ preset: preset.id })}
                  className={`min-h-[56px] p-2.5 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center ${
                    config.preset === preset.id
                      ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200 shadow-[0_0_12px_rgba(0,240,255,0.3)]'
                      : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
                  }`}
                >
                  <span className="text-xs font-black">{preset.label}</span>
                  <span className="text-[9px] text-white/50">{preset.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Target Frame Rate */}
          <div>
            <label className="block text-xs font-black tracking-widest uppercase text-cyan-300 mb-2.5">
              TARGET FRAME RATE (FPS)
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[30, 60, 120].map((rate) => (
                <button
                  key={rate}
                  onClick={() => onUpdateConfig({ targetFPS: rate })}
                  className={`min-h-[48px] p-2 rounded-xl border text-center font-black text-xs transition-all cursor-pointer ${
                    config.targetFPS === rate
                      ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200 shadow-[0_0_10px_rgba(0,240,255,0.3)]'
                      : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
                  }`}
                >
                  {rate} FPS
                </button>
              ))}
            </div>
          </div>

          {/* Visual Effects & Shaders */}
          <div>
            <label className="block text-xs font-black tracking-widest uppercase text-cyan-300 mb-2.5">
              SHADERS & POST-PROCESSING
            </label>
            <div className="space-y-3 bg-white/5 border border-white/10 rounded-xl p-3.5">
              {/* Bloom Intensity */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-white">Neon Bloom Glow</div>
                  <div className="text-[10px] text-white/50">Intensity of cyber road and skyscraper neon</div>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={shaderParams.bloomIntensity ?? 0.35}
                    onChange={(e) => onUpdateShaderParams({ bloomIntensity: parseFloat(e.target.value) })}
                    className="w-24 accent-cyan-400 cursor-pointer"
                    aria-label="Neon Bloom Glow Intensity"
                  />
                  <span className="text-[11px] font-mono text-cyan-300 w-8 text-right">
                    {((shaderParams.bloomIntensity ?? 0.35) * 100).toFixed(0)}%
                  </span>
                </div>
              </div>

              {/* Chromatic Aberration */}
              <div className="flex items-center justify-between border-t border-white/10 pt-2.5">
                <div>
                  <div className="text-xs font-bold text-white">Chromatic Aberration</div>
                  <div className="text-[10px] text-white/50">Peripheral holographic prism dispersion</div>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="range"
                    min="0"
                    max="0.003"
                    step="0.0002"
                    value={shaderParams.chromaticAberration ?? 0.0005}
                    onChange={(e) => onUpdateShaderParams({ chromaticAberration: parseFloat(e.target.value) })}
                    className="w-24 accent-cyan-400 cursor-pointer"
                    aria-label="Chromatic Aberration Intensity"
                  />
                  <span className="text-[11px] font-mono text-cyan-300 w-8 text-right">
                    {((shaderParams.chromaticAberration ?? 0.0005) * 10000).toFixed(0)}
                  </span>
                </div>
              </div>

              {/* Dynamic Shadows */}
              <div className="flex items-center justify-between border-t border-white/10 pt-2.5">
                <div>
                  <div className="text-xs font-bold text-white">Realtime Dynamic Shadows</div>
                  <div className="text-[10px] text-white/50">Casts hero & hoverboard contact shadows</div>
                </div>
                <button
                  onClick={() => onUpdateConfig({ enableShadows: !config.enableShadows })}
                  className={`min-h-[40px] px-3 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                    config.enableShadows
                      ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                      : 'bg-black/60 border-white/10 text-white/40'
                  }`}
                >
                  {config.enableShadows ? 'ENABLED' : 'DISABLED'}
                </button>
              </div>

              {/* Reduced-Flash Accessibility */}
              <div className="flex items-center justify-between border-t border-white/10 pt-2.5">
                <div>
                  <div className="text-xs font-bold text-white">Reduced Flash & High Contrast</div>
                  <div className="text-[10px] text-white/50">Softens screen flashes on collisions/portals</div>
                </div>
                <button
                  onClick={() => onUpdateConfig({ reducedFlash: !config.reducedFlash })}
                  className={`min-h-[40px] px-3 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                    config.reducedFlash
                      ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                      : 'bg-black/60 border-white/10 text-white/40'
                  }`}
                >
                  {config.reducedFlash ? 'ACTIVE' : 'OFF'}
                </button>
              </div>
            </div>
          </div>

          {/* Audio Controls */}
          <div>
            <label className="block text-xs font-black tracking-widest uppercase text-cyan-300 mb-2.5">
              AUDIO & SYNTHWAVE MASTER
            </label>
            <button
              onClick={onToggleMute}
              className="w-full min-h-[48px] p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-between transition-all cursor-pointer"
            >
              <div className="flex items-center space-x-2.5">
                {isMuted ? <VolumeX className="w-5 h-5 text-red-400" /> : <Volume2 className="w-5 h-5 text-emerald-400" />}
                <span className="text-xs font-bold text-white">
                  {isMuted ? 'AUDIO CURRENTLY MUTED' : 'SYNTHWAVE SOUNDTRACK & SFX ACTIVE'}
                </span>
              </div>
              <span className={`text-[10px] font-black px-2 py-0.5 rounded ${isMuted ? 'bg-red-950 text-red-300 border border-red-500/40' : 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'}`}>
                {isMuted ? 'MUTED' : 'UNMUTED'}
              </span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-cyan-500/20 flex items-center justify-between">
          <button
            onClick={onResetDefaults}
            className="min-h-[48px] px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 text-xs font-bold flex items-center space-x-1.5 transition-all cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>RESET DEFAULTS</span>
          </button>

          <button
            onClick={onClose}
            className="min-h-[48px] px-6 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-black font-black text-xs uppercase tracking-widest active:scale-95 transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-cyan-300"
          >
            SAVE & RETURN
          </button>
        </div>
      </div>
    </div>
  );
};
