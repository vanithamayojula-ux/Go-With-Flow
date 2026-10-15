import { GraphicsConfig } from '../../types';

export type DeviceTier = 'high' | 'mid' | 'low';

export interface DeviceTierInfo {
  tier: DeviceTier;
  /** Unmasked GPU renderer string when the browser exposes it. */
  gpu: string;
  reason: string;
}

// Integrated / mobile / software GPUs. ("Apple GPU" on a Mac is an M-series
// part and fast; iPhones/iPads are caught by the coarse-pointer check.)
const WEAK_GPU = /intel|uhd|iris|mali|adreno|powervr|videocore|swiftshader|llvmpipe|softpipe|software|microsoft basic render/i;

function readGpuRenderer(): string {
  if (typeof document === 'undefined') return '';
  try {
    const canvas = document.createElement('canvas');
    const gl = (canvas.getContext('webgl2') || canvas.getContext('webgl')) as WebGLRenderingContext | null;
    if (!gl) return '';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const name = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return name;
  } catch {
    return '';
  }
}

/**
 * Pick a starting quality tier for a first launch (no saved preset):
 * touch devices -> low, integrated/mobile/software GPUs or <= 4 cores or
 * <= 4 GB -> mid, discrete GPUs -> high. Adaptive resolution refines it live.
 */
export function detectDeviceTier(): DeviceTierInfo {
  if (typeof window === 'undefined') return { tier: 'high', gpu: '', reason: 'no-window' };
  const coarse = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
  if (coarse) return { tier: 'low', gpu: '', reason: 'coarse-pointer' };

  const gpu = readGpuRenderer();
  const nav = navigator as Navigator & { deviceMemory?: number };
  const cores = nav.hardwareConcurrency || 8;
  const memory = nav.deviceMemory ?? 8;
  if (gpu && WEAK_GPU.test(gpu)) return { tier: 'mid', gpu, reason: 'integrated-gpu' };
  if (cores <= 4) return { tier: 'mid', gpu, reason: 'few-cores' };
  if (memory <= 4) return { tier: 'mid', gpu, reason: 'low-memory' };
  return { tier: 'high', gpu, reason: 'discrete-gpu' };
}

/**
 * Graphics defaults for a tier. "mid" is Balanced (mobile-opt: 1.2x DPR cap,
 * no MSAA, no lens fringing) but keeps sun shadows, at 1024 px.
 */
export function graphicsConfigForTier(base: GraphicsConfig, tier: DeviceTier): GraphicsConfig {
  if (tier === 'low') return { ...base, preset: 'mobile-opt', vegetationDensity: 0.65, enableShadows: false };
  if (tier === 'mid') return { ...base, preset: 'mobile-opt', vegetationDensity: 0.65, enableShadows: true };
  return base;
}
