import React from 'react';
import { X, Sliders, Sun, Wind, Sparkles, Monitor, RotateCcw } from 'lucide-react';
import { GraphicsConfig, LightingMode, QualityPreset, ShaderParams } from '../types';

interface GraphicsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  config: GraphicsConfig;
  onUpdateConfig: (newConfig: Partial<GraphicsConfig>) => void;
  lightingMode: LightingMode;
  onSelectLighting: (mode: LightingMode) => void;
  shaderParams: ShaderParams;
  onUpdateShaderParams: (newParams: Partial<ShaderParams>) => void;
  onResetDefaults: () => void;
  fps: number;
  drawCalls: number;
}

export const GraphicsDrawer: React.FC<GraphicsDrawerProps> = ({
  isOpen,
  onClose,
  config,
  onUpdateConfig,
  lightingMode,
  onSelectLighting,
  shaderParams,
  onUpdateShaderParams,
  onResetDefaults,
  fps,
  drawCalls,
}) => {
  if (!isOpen) return null;

  const presets: { id: QualityPreset; name: string; desc: string }[] = [
    { id: 'desktop-full', name: 'Desktop Full', desc: 'Full cel shaders, 2000+ foliage, bloom & subtle film grain' },
    { id: 'mobile-opt', name: 'Mobile Optimized', desc: 'Balanced density, optimized post-process, rock-solid 60fps' },
    { id: 'webgl-min', name: 'Minimal WebGL', desc: 'Maximum performance, simplified materials for low-end devices' },
  ];

  const lightingOptions: { id: LightingMode; name: string; time: string }[] = [
    { id: 'morning', name: 'Morning Meadow', time: '07:30 AM' },
    { id: 'golden-hour', name: 'Golden Hour', time: '06:15 PM' },
    { id: 'bright-day', name: 'Bright Day', time: '12:00 PM' },
  ];

  return (
    <div id="graphics-drawer-backdrop" className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm flex justify-end transition-opacity">
      <div
        id="graphics-drawer-panel"
        className="w-full max-w-md h-full bg-slate-900/95 border-l border-white/10 text-white flex flex-col shadow-2xl overflow-y-auto"
      >
        {/* Header */}
        <div className="p-5 border-b border-white/10 flex items-center justify-between sticky top-0 bg-slate-900/95 backdrop-blur-md z-10">
          <div className="flex items-center space-x-2">
            <Sliders className="w-5 h-5 text-sky-400" />
            <div>
              <h2 className="text-base font-bold text-white">Graphics & Shaders</h2>
              <p className="text-xs text-white/50">Ghibli visual & performance controls</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-all"
            aria-label="Close drawer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-6 flex-1">
          {/* Real-Time Telemetry Card */}
          <div className="p-4 rounded-2xl bg-black/40 border border-white/10 space-y-2">
            <div className="text-xs font-semibold text-white/60 flex items-center justify-between uppercase tracking-wider font-mono">
              <span>Telemetry & Performance</span>
              <span className="text-emerald-400 font-bold">Target 60 FPS</span>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="p-2.5 rounded-xl bg-white/5 border border-white/5">
                <div className="text-[11px] text-white/50 font-mono">Current FPS</div>
                <div className={`text-xl font-mono font-bold ${fps >= 55 ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {fps}
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-white/5 border border-white/5">
                <div className="text-[11px] text-white/50 font-mono">Draw Calls</div>
                <div className="text-xl font-mono font-bold text-sky-300">
                  {drawCalls} <span className="text-xs font-normal text-white/40">/ 800</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quality Presets */}
          <div className="space-y-2.5">
            <label className="text-xs font-semibold text-white/70 uppercase tracking-wider flex items-center space-x-1.5 font-mono">
              <Monitor className="w-4 h-4 text-sky-400" />
              <span>Engine Quality Presets</span>
            </label>
            <div className="grid grid-cols-1 gap-2">
              {presets.map(p => (
                <button
                  key={p.id}
                  onClick={() => onUpdateConfig({ preset: p.id })}
                  className={`text-left p-3 rounded-xl border transition-all ${
                    config.preset === p.id
                      ? 'bg-sky-950/70 border-sky-400 text-sky-100 shadow-md shadow-sky-900/30'
                      : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <div className="text-sm font-semibold">{p.name}</div>
                  <div className="text-xs text-white/50 mt-0.5">{p.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Lighting Presets */}
          <div className="space-y-2.5">
            <label className="text-xs font-semibold text-white/70 uppercase tracking-wider flex items-center space-x-1.5 font-mono">
              <Sun className="w-4 h-4 text-amber-400" />
              <span>Lighting & Atmospheric Tone</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {lightingOptions.map(l => (
                <button
                  key={l.id}
                  onClick={() => onSelectLighting(l.id)}
                  className={`p-2.5 rounded-xl border text-center transition-all ${
                    lightingMode === l.id
                      ? 'bg-amber-950/70 border-amber-400 text-amber-100 shadow-md shadow-amber-900/30'
                      : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <div className="text-xs font-semibold">{l.name}</div>
                  <div className="text-[10px] text-white/40 mt-0.5">{l.time}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Live Shader Adjustments */}
          <div className="space-y-4 pt-2 border-t border-white/10">
            <label className="text-xs font-semibold text-white/70 uppercase tracking-wider flex items-center space-x-1.5 font-mono">
              <Wind className="w-4 h-4 text-emerald-400" />
              <span>Vertex Wind & Cel Shaders</span>
            </label>

            {/* Wind Strength */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-white/70">Foliage Wind Strength</span>
                <span className="font-mono text-emerald-300">{shaderParams.windStrength.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="1.5"
                step="0.05"
                value={shaderParams.windStrength}
                onChange={e => onUpdateShaderParams({ windStrength: parseFloat(e.target.value) })}
                className="w-full accent-emerald-400 cursor-pointer"
              />
            </div>

            {/* Wind Speed */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-white/70">Wind Wave Frequency / Speed</span>
                <span className="font-mono text-emerald-300">{shaderParams.windSpeed.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.2"
                max="2.5"
                step="0.1"
                value={shaderParams.windSpeed}
                onChange={e => onUpdateShaderParams({ windSpeed: parseFloat(e.target.value) })}
                className="w-full accent-emerald-400 cursor-pointer"
              />
            </div>

            {/* Rim Light Intensity */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-white/70">Directional Rim Light (Silhouette Clarity)</span>
                <span className="font-mono text-amber-300">{shaderParams.rimLightIntensity.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.0"
                max="1.5"
                step="0.05"
                value={shaderParams.rimLightIntensity}
                onChange={e => onUpdateShaderParams({ rimLightIntensity: parseFloat(e.target.value) })}
                className="w-full accent-amber-400 cursor-pointer"
              />
            </div>

            {/* Cel Ramp Hardness */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-white/70">Subtle Cel AO Roll-off (Soft Tonal Separation)</span>
                <span className="font-mono text-sky-300">{shaderParams.celRampHardness.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.0"
                max="1.0"
                step="0.05"
                value={shaderParams.celRampHardness}
                onChange={e => onUpdateShaderParams({ celRampHardness: parseFloat(e.target.value) })}
                className="w-full accent-sky-400 cursor-pointer"
              />
            </div>
          </div>

          {/* Post-Processing Section */}
          <div className="space-y-4 pt-2 border-t border-white/10">
            <label className="text-xs font-semibold text-white/70 uppercase tracking-wider flex items-center space-x-1.5 font-mono">
              <Sparkles className="w-4 h-4 text-pink-400" />
              <span>Painterly Post-Processing</span>
            </label>

            {/* Film Grain */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-white/70">Painterly Film Grain (0.02 - 0.04 target)</span>
                <span className="font-mono text-pink-300">{shaderParams.filmGrainIntensity.toFixed(3)}</span>
              </div>
              <input
                type="range"
                min="0.0"
                max="0.08"
                step="0.005"
                value={shaderParams.filmGrainIntensity}
                onChange={e => onUpdateShaderParams({ filmGrainIntensity: parseFloat(e.target.value) })}
                className="w-full accent-pink-400 cursor-pointer"
              />
            </div>

            {/* Bloom Intensity */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-white/70">Soft Bloom Glow</span>
                <span className="font-mono text-pink-300">{shaderParams.bloomIntensity.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.0"
                max="1.2"
                step="0.05"
                value={shaderParams.bloomIntensity}
                onChange={e => onUpdateShaderParams({ bloomIntensity: parseFloat(e.target.value) })}
                className="w-full accent-pink-400 cursor-pointer"
              />
            </div>

            {/* High-Speed Radial Blur */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-white/70">High-Speed Streak & Motion Blur</span>
                <span className="font-mono text-purple-300">{shaderParams.highSpeedBlur.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.0"
                max="1.5"
                step="0.1"
                value={shaderParams.highSpeedBlur}
                onChange={e => onUpdateShaderParams({ highSpeedBlur: parseFloat(e.target.value) })}
                className="w-full accent-purple-400 cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 bg-slate-900/95 flex items-center justify-between sticky bottom-0">
          <button
            onClick={onResetDefaults}
            className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white flex items-center space-x-1.5 text-xs font-semibold transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Defaults</span>
          </button>

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-xs font-bold transition-all shadow-md shadow-sky-500/20"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
