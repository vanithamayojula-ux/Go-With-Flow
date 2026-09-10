import * as THREE from 'three';
import { WorldTheme, WORLD_THEMES, getNextTheme } from './worldThemes';
import { SkyManager } from './sky';
import { TerrainManager } from './terrain';
import { ObstacleManager } from './obstacles';

export class ThemeManager {
  scene: THREE.Scene;
  currentTheme: WorldTheme;
  targetTheme: WorldTheme | null = null;
  transitionTimer: number = 0;
  transitionDuration: number = 1.25;

  // Lerp targets & animated states
  skyTopColor: THREE.Color;
  skyBottomColor: THREE.Color;
  fogColor: THREE.Color;
  fogDensity: number;
  ambientLightColor: THREE.Color;
  ambientLightIntensity: number;
  directionalLightColor: THREE.Color;
  directionalLightIntensity: number;
  groundColor: THREE.Color;
  trackColor: THREE.Color;
  laneLineColor: THREE.Color;
  buildingColors: THREE.Color[];
  accentGlowColor: THREE.Color;
  portalColor: THREE.Color;

  // Particle System
  activeParticlePoints: THREE.Points | null = null;
  activeParticleType: string = 'none';
  particleVelocities: THREE.Vector3[] = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.currentTheme = WORLD_THEMES[0];

    this.skyTopColor = new THREE.Color(this.currentTheme.skyColorTop);
    this.skyBottomColor = new THREE.Color(this.currentTheme.skyColorBottom);
    this.fogColor = new THREE.Color(this.currentTheme.fogColor);
    this.fogDensity = this.currentTheme.fogDensity;
    this.ambientLightColor = new THREE.Color(this.currentTheme.ambientLightColor);
    this.ambientLightIntensity = this.currentTheme.ambientLightIntensity;
    this.directionalLightColor = new THREE.Color(this.currentTheme.directionalLightColor);
    this.directionalLightIntensity = this.currentTheme.directionalLightIntensity;
    this.groundColor = new THREE.Color(this.currentTheme.groundColor);
    this.trackColor = new THREE.Color(this.currentTheme.trackColor);
    this.laneLineColor = new THREE.Color(this.currentTheme.laneLineColor);
    this.buildingColors = this.currentTheme.buildingColors.map((c) => new THREE.Color(c));
    this.accentGlowColor = new THREE.Color(this.currentTheme.accentGlowColor);
    this.portalColor = new THREE.Color(this.currentTheme.portalColor);

    this.setupParticles(this.currentTheme, new THREE.Vector3(0, 0, 0));
  }

  setupParticles(theme: WorldTheme, playerPos: THREE.Vector3) {
    // Safely dispose old particle system before spawning new one
    if (this.activeParticlePoints) {
      this.scene.remove(this.activeParticlePoints);
      this.activeParticlePoints.geometry.dispose();
      if (Array.isArray(this.activeParticlePoints.material)) {
        this.activeParticlePoints.material.forEach((m) => m.dispose());
      } else {
        this.activeParticlePoints.material.dispose();
      }
      this.activeParticlePoints = null;
      this.particleVelocities = [];
    }

    this.activeParticleType = theme.particleType;
    if (theme.particleType === 'none') return;

    const baseCount = 360;
    const count = Math.floor(baseCount * theme.particleDensity);
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    this.particleVelocities = [];

    const rangeX = 70;
    const rangeY = 35;
    const rangeZ = 100;

    for (let i = 0; i < count; i++) {
      const px = playerPos.x + (Math.random() - 0.5) * rangeX;
      const py = playerPos.y + Math.random() * rangeY;
      const pz = playerPos.z + (Math.random() - 0.5) * rangeZ;

      positions[i * 3] = px;
      positions[i * 3 + 1] = py;
      positions[i * 3 + 2] = pz;

      let vx = 0, vy = 0, vz = 0;

      switch (theme.particleType) {
        case 'rain':
          vx = (Math.random() - 0.5) * 0.4;
          vy = -38.0 - Math.random() * 15.0;
          vz = (Math.random() - 0.5) * 0.4;
          break;
        case 'snow':
          vx = (Math.random() - 0.5) * 1.6;
          vy = -2.2 - Math.random() * 2.0;
          vz = (Math.random() - 0.5) * 1.6;
          break;
        case 'sand':
          vx = 14.0 + Math.random() * 12.0;
          vy = -1.5 - Math.random() * 2.0;
          vz = 4.0 + Math.random() * 8.0;
          break;
        case 'embers':
          vx = (Math.random() - 0.5) * 2.2;
          vy = 3.5 + Math.random() * 4.5;
          vz = (Math.random() - 0.5) * 2.2;
          break;
        case 'fireflies':
          vx = (Math.random() - 0.5) * 1.4;
          vy = (Math.random() - 0.5) * 1.4;
          vz = (Math.random() - 0.5) * 1.4;
          break;
        case 'stars':
          vx = 0; vy = 0; vz = 0;
          break;
      }
      this.particleVelocities.push(new THREE.Vector3(vx, vy, vz));
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    let particleSize = 1.4;
    if (theme.particleType === 'rain') particleSize = 0.9;
    if (theme.particleType === 'snow') particleSize = 1.9;
    if (theme.particleType === 'fireflies') particleSize = 2.6;
    if (theme.particleType === 'embers') particleSize = 2.2;
    if (theme.particleType === 'stars') particleSize = 1.2;

    const material = new THREE.PointsMaterial({
      color: theme.particleColor,
      size: particleSize,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.activeParticlePoints = new THREE.Points(geometry, material);
    this.scene.add(this.activeParticlePoints);
  }

  updateParticles(dt: number, playerPos: THREE.Vector3, timeSeconds: number) {
    if (!this.activeParticlePoints) return;
    const posAttr = this.activeParticlePoints.geometry.attributes.position as THREE.BufferAttribute;
    const positions = posAttr.array as Float32Array;
    const count = positions.length / 3;

    const rangeX = 70;
    const rangeY = 35;
    const rangeZ = 100;

    for (let i = 0; i < count; i++) {
      let x = positions[i * 3];
      let y = positions[i * 3 + 1];
      let z = positions[i * 3 + 2];
      const vel = this.particleVelocities[i] || new THREE.Vector3();

      if (this.activeParticleType === 'fireflies') {
        x += Math.sin(timeSeconds * 2.2 + i) * 0.04 + vel.x * dt;
        y += Math.cos(timeSeconds * 1.9 + i) * 0.04 + vel.y * dt;
        z += Math.sin(timeSeconds * 1.6 + i * 2) * 0.04 + vel.z * dt;
      } else if (this.activeParticleType === 'stars') {
        // Subtle ambient float
        x += Math.sin(timeSeconds * 0.5 + i) * 0.01;
        y += Math.cos(timeSeconds * 0.5 + i) * 0.01;
      } else {
        x += vel.x * dt;
        y += vel.y * dt;
        z += vel.z * dt;
      }

      // Recycle particles relative to player space
      if (y < playerPos.y - 4.0 && (this.activeParticleType === 'rain' || this.activeParticleType === 'snow' || this.activeParticleType === 'sand')) {
        y = playerPos.y + rangeY;
        x = playerPos.x + (Math.random() - 0.5) * rangeX;
        z = playerPos.z + (Math.random() - 0.5) * rangeZ;
      } else if (y > playerPos.y + rangeY && this.activeParticleType === 'embers') {
        y = playerPos.y;
        x = playerPos.x + (Math.random() - 0.5) * rangeX;
        z = playerPos.z + (Math.random() - 0.5) * rangeZ;
      }

      if (Math.abs(x - playerPos.x) > rangeX * 0.6) {
        x = playerPos.x + (Math.random() - 0.5) * rangeX;
      }
      if (z < playerPos.z - rangeZ * 0.5 || z > playerPos.z + rangeZ * 0.5) {
        z = playerPos.z + (Math.random() - 0.5) * rangeZ;
      }

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
    }

    posAttr.needsUpdate = true;
  }

  triggerPortalWarp(targetThemeId?: string, playerPos?: THREE.Vector3) {
    const nextTheme = getNextTheme(this.currentTheme.id);
    let target = nextTheme;
    if (targetThemeId) {
      const match = WORLD_THEMES.find((t) => t.id === targetThemeId);
      if (match) target = match;
    }

    this.targetTheme = target;
    this.transitionTimer = 0;

    if (playerPos) {
      this.setupParticles(target, playerPos);
    }
  }

  update(
    dt: number,
    skyMgr: SkyManager | null,
    terrainMgr: TerrainManager | null,
    obstacleMgr: ObstacleManager | null,
    playerPos: THREE.Vector3,
    timeSeconds: number
  ) {
    // Smooth Color & Lighting Lerp
    if (this.targetTheme) {
      this.transitionTimer += dt / this.transitionDuration;
      const t = Math.min(1.0, Math.max(0.0, this.transitionTimer));

      const startTop = new THREE.Color(this.currentTheme.skyColorTop);
      const targetTop = new THREE.Color(this.targetTheme.skyColorTop);
      this.skyTopColor.lerpColors(startTop, targetTop, t);

      const startBottom = new THREE.Color(this.currentTheme.skyColorBottom);
      const targetBottom = new THREE.Color(this.targetTheme.skyColorBottom);
      this.skyBottomColor.lerpColors(startBottom, targetBottom, t);

      const startFog = new THREE.Color(this.currentTheme.fogColor);
      const targetFog = new THREE.Color(this.targetTheme.fogColor);
      this.fogColor.lerpColors(startFog, targetFog, t);

      this.fogDensity = THREE.MathUtils.lerp(this.currentTheme.fogDensity, this.targetTheme.fogDensity, t);

      const startAmb = new THREE.Color(this.currentTheme.ambientLightColor);
      const targetAmb = new THREE.Color(this.targetTheme.ambientLightColor);
      this.ambientLightColor.lerpColors(startAmb, targetAmb, t);
      this.ambientLightIntensity = THREE.MathUtils.lerp(this.currentTheme.ambientLightIntensity, this.targetTheme.ambientLightIntensity, t);

      const startDir = new THREE.Color(this.currentTheme.directionalLightColor);
      const targetDir = new THREE.Color(this.targetTheme.directionalLightColor);
      this.directionalLightColor.lerpColors(startDir, targetDir, t);
      this.directionalLightIntensity = THREE.MathUtils.lerp(this.currentTheme.directionalLightIntensity, this.targetTheme.directionalLightIntensity, t);

      const startGround = new THREE.Color(this.currentTheme.groundColor);
      const targetGround = new THREE.Color(this.targetTheme.groundColor);
      this.groundColor.lerpColors(startGround, targetGround, t);

      const startTrack = new THREE.Color(this.currentTheme.trackColor);
      const targetTrack = new THREE.Color(this.targetTheme.trackColor);
      this.trackColor.lerpColors(startTrack, targetTrack, t);

      const startLane = new THREE.Color(this.currentTheme.laneLineColor);
      const targetLane = new THREE.Color(this.targetTheme.laneLineColor);
      this.laneLineColor.lerpColors(startLane, targetLane, t);

      const startAccent = new THREE.Color(this.currentTheme.accentGlowColor);
      const targetAccent = new THREE.Color(this.targetTheme.accentGlowColor);
      this.accentGlowColor.lerpColors(startAccent, targetAccent, t);

      const startPortal = new THREE.Color(this.currentTheme.portalColor);
      const targetPortal = new THREE.Color(this.targetTheme.portalColor);
      this.portalColor.lerpColors(startPortal, targetPortal, t);

      if (t >= 1.0) {
        this.currentTheme = this.targetTheme;
        this.targetTheme = null;
      }
    }

    // Apply values to Sky & Lights
    if (skyMgr) {
      if (skyMgr.skyMaterial && skyMgr.skyMaterial.uniforms) {
        if (skyMgr.skyMaterial.uniforms.uSkyTop) skyMgr.skyMaterial.uniforms.uSkyTop.value.copy(this.skyTopColor);
        if (skyMgr.skyMaterial.uniforms.uSkyMid) skyMgr.skyMaterial.uniforms.uSkyMid.value.copy(this.skyBottomColor);
        if (skyMgr.skyMaterial.uniforms.uSkyHorizon) skyMgr.skyMaterial.uniforms.uSkyHorizon.value.copy(this.accentGlowColor);
      }
      if (skyMgr.ambientLight) {
        skyMgr.ambientLight.color.copy(this.ambientLightColor);
        skyMgr.ambientLight.intensity = this.ambientLightIntensity;
      }
      if (skyMgr.dirLight) {
        skyMgr.dirLight.color.copy(this.directionalLightColor);
        skyMgr.dirLight.intensity = this.directionalLightIntensity;
      }
      if (skyMgr.holoRingMesh && skyMgr.holoRingMesh.material instanceof THREE.MeshBasicMaterial) {
        skyMgr.holoRingMesh.material.color.copy(this.accentGlowColor);
      }
    }

    // Apply Fog to Scene
    if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.color.copy(this.fogColor);
      this.scene.fog.density = this.fogDensity;
    } else {
      this.scene.fog = new THREE.FogExp2(this.fogColor.getHex(), this.fogDensity);
    }

    // Apply colors to Terrain & Materials
    if (terrainMgr) {
      if (terrainMgr.curbRailMat) terrainMgr.curbRailMat.color.copy(this.laneLineColor);
      if (terrainMgr.wireframeMat) terrainMgr.wireframeMat.color.copy(this.accentGlowColor);
      if (terrainMgr.neonCyanMat) terrainMgr.neonCyanMat.color.copy(this.accentGlowColor);

      if (terrainMgr.terrainMaterial && terrainMgr.terrainMaterial.uniforms) {
        if (terrainMgr.terrainMaterial.uniforms.uSunColor) {
          terrainMgr.terrainMaterial.uniforms.uSunColor.value.copy(this.directionalLightColor);
        }
        if (terrainMgr.terrainMaterial.uniforms.uAmbientColor) {
          terrainMgr.terrainMaterial.uniforms.uAmbientColor.value.copy(this.ambientLightColor);
        }
      }
    }

    // Update Portals to hint next theme color
    if (obstacleMgr) {
      const nextTheme = getNextTheme(this.currentTheme.id);
      const nextPortalColor = new THREE.Color(nextTheme.portalColor);
      for (const obs of obstacleMgr.obstacles) {
        if (obs.isPortal || obs.type === 'world-portal') {
          obs.mesh.traverse((child) => {
            if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshBasicMaterial) {
              child.material.color.copy(nextPortalColor);
            }
          });
        }
      }
    }

    // Update Particle Drift & Recycling
    this.updateParticles(dt, playerPos, timeSeconds);
  }

  dispose() {
    if (this.activeParticlePoints) {
      this.scene.remove(this.activeParticlePoints);
      this.activeParticlePoints.geometry.dispose();
      if (Array.isArray(this.activeParticlePoints.material)) {
        this.activeParticlePoints.material.forEach((m) => m.dispose());
      } else {
        this.activeParticlePoints.material.dispose();
      }
      this.activeParticlePoints = null;
    }
  }
}
