import * as THREE from 'three';
import { getPlaceholderTextures, ScanTextureSet } from '../../../graphics/assetLibrary';
import { StreamFade, FadeBand, applyStreamFade } from './distanceFade';

/**
 * UV-mapped MeshStandardMaterial that starts with a procedural fallback and
 * later takes a scanned texture set (bark, stone) without recompiling: every
 * map slot is bound from the start (1x1 placeholders), so the upgrade only
 * swaps texture objects. Stream clip + distance fade are applied.
 */
export interface ScanStandardHandle {
  material: THREE.MeshStandardMaterial;
  apply(set: ScanTextureSet | null): void;
}

export interface ScanStandardOptions {
  /** Albedo before the scans arrive (multiplied by `fallbackMap`). */
  fallbackColor: THREE.ColorRepresentation;
  /** Optional procedural modulator (linear grey noise) for the fallback. */
  fallbackMap?: THREE.Texture | null;
  /** Albedo multiplier once the scan is applied. */
  scanTint?: THREE.ColorRepresentation;
  roughness?: number;
  normalScale?: number;
  side?: THREE.Side;
  vertexColors?: boolean;
  fade: StreamFade;
  band?: FadeBand;
}

export function createScanStandardMaterial(opts: ScanStandardOptions): ScanStandardHandle {
  const ph = getPlaceholderTextures();
  const material = new THREE.MeshStandardMaterial({
    color: opts.fallbackColor,
    roughness: opts.roughness ?? 0.92,
    metalness: 0,
    side: opts.side ?? THREE.FrontSide,
    vertexColors: !!opts.vertexColors,
    map: opts.fallbackMap ?? ph.white,
    normalMap: ph.flatNormal,
    roughnessMap: ph.arm,
    aoMap: ph.arm,
  });
  material.aoMapIntensity = 0.85;
  applyStreamFade(material, opts.fade, opts.band ?? 'near');
  const ns = opts.normalScale ?? 1;
  return {
    material,
    apply(set) {
      if (!set) {
        material.map = opts.fallbackMap ?? ph.white;
        material.normalMap = ph.flatNormal;
        material.roughnessMap = ph.arm;
        material.aoMap = ph.arm;
        material.color.set(opts.fallbackColor);
        material.roughness = opts.roughness ?? 0.92;
        return;
      }
      material.map = set.map;
      material.normalMap = set.normalMap;
      material.normalScale.set(ns, ns);
      material.roughnessMap = set.armMap;
      material.aoMap = set.armMap;
      material.color.set(opts.scanTint ?? 0xffffff);
      material.roughness = 1.0;
    },
  };
}
