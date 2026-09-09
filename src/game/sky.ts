import * as THREE from 'three';
import { SkyboxShader } from '../graphics/shaders';
import { createPainterlyCloudTexture, createToweringCumulusTexture } from '../graphics/textures';
import { LightingMode } from '../types';

export interface LightingPresetConfig {
  skyTop: string;
  skyMid: string;
  skyHorizon: string;
  sunColor: string;
  sunPosition: [number, number, number];
  ambientColor: string;
  slopeWarm: string;
  slopeCool: string;
  hazeDensity: number;
}

export const LIGHTING_PRESETS: Record<LightingMode, LightingPresetConfig> = {
  'golden-hour': {
    skyTop: '#2B8BE3',
    skyMid: '#5CB3FF',
    skyHorizon: '#FFD1B3',
    sunColor: '#FFE0B2',
    sunPosition: [80, 45, -120],
    ambientColor: '#8BBBE8',
    slopeWarm: '#FFF0C7',
    slopeCool: '#5B9B82',
    hazeDensity: 0.85,
  },
  'morning': {
    skyTop: '#3A80E8',
    skyMid: '#78B9FF',
    skyHorizon: '#FFE3C7',
    sunColor: '#FFEBB5',
    sunPosition: [-90, 35, -100],
    ambientColor: '#8BB9F0',
    slopeWarm: '#FFF4D4',
    slopeCool: '#52997B',
    hazeDensity: 0.95,
  },
  'bright-day': {
    skyTop: '#1A6ED4',
    skyMid: '#4DA6FF',
    skyHorizon: '#BDE8FF',
    sunColor: '#FFF5DC',
    sunPosition: [30, 95, -80],
    ambientColor: '#8BC4F7',
    slopeWarm: '#FFF7E0',
    slopeCool: '#4A996E',
    hazeDensity: 0.6,
  },
};

interface BirdData {
  mesh: THREE.Group;
  leftWing: THREE.Mesh;
  rightWing: THREE.Mesh;
  offsetX: number;
  offsetY: number;
  offsetZ: number;
  phase: number;
}

export class SkyManager {
  scene: THREE.Scene;
  skyMesh: THREE.Mesh;
  skyMaterial: THREE.ShaderMaterial;
  dirLight: THREE.DirectionalLight;
  ambientLight: THREE.AmbientLight;

  cloudTexture: THREE.CanvasTexture;
  toweringCloudTexture: THREE.CanvasTexture;
  cloudsGroup: THREE.Group;
  cloudSprites: { sprite: THREE.Sprite; baseX: number; baseY: number; baseZ: number; speedOffset: number }[] = [];

  flockGroup: THREE.Group;
  birds: BirdData[] = [];
  desertCreatureGroup: THREE.Group;
  desertCreatureWings: { left: THREE.Mesh; right: THREE.Mesh };

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    const skyGeom = new THREE.SphereGeometry(900, 32, 24);
    this.skyMaterial = new THREE.ShaderMaterial({
      vertexShader: SkyboxShader.vertexShader,
      fragmentShader: SkyboxShader.fragmentShader,
      uniforms: {
        uSkyTop: { value: new THREE.Color(LIGHTING_PRESETS['golden-hour'].skyTop) },
        uSkyMid: { value: new THREE.Color(LIGHTING_PRESETS['golden-hour'].skyMid) },
        uSkyHorizon: { value: new THREE.Color(LIGHTING_PRESETS['golden-hour'].skyHorizon) },
        uSunPosition: { value: new THREE.Vector3(80, 45, -120) },
        uSunColor: { value: new THREE.Color(LIGHTING_PRESETS['golden-hour'].sunColor) },
        uTime: { value: 0 },
        uHazeDensity: { value: 0.8 },
      },
      side: THREE.BackSide,
      depthWrite: false,
    });

    this.skyMesh = new THREE.Mesh(skyGeom, this.skyMaterial);
    this.scene.add(this.skyMesh);

    this.dirLight = new THREE.DirectionalLight(0xffe0b2, 1.4);
    this.dirLight.position.set(80, 45, -120);
    this.scene.add(this.dirLight);

    this.ambientLight = new THREE.AmbientLight(0x8bbbe8, 0.80);
    this.scene.add(this.ambientLight);

    this.cloudTexture = createPainterlyCloudTexture();
    this.toweringCloudTexture = createToweringCumulusTexture();
    this.cloudsGroup = new THREE.Group();
    this.scene.add(this.cloudsGroup);

    const cloudCount = 26;
    const spriteMat = new THREE.SpriteMaterial({
      map: this.cloudTexture,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
    });

    for (let i = 0; i < cloudCount; i++) {
      const sprite = new THREE.Sprite(spriteMat);
      const angle = (i / cloudCount) * Math.PI * 2 + Math.random() * 0.2;
      const radius = 260 + Math.random() * 220;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const y = 70 + Math.random() * 65;
      const scale = 100 + Math.random() * 75;

      sprite.position.set(x, y, z);
      sprite.scale.set(scale, scale * 0.65, 1);
      this.cloudsGroup.add(sprite);

      this.cloudSprites.push({
        sprite,
        baseX: x,
        baseY: y,
        baseZ: z,
        speedOffset: 0.006 + Math.random() * 0.008,
      });
    }

    const towerMat = new THREE.SpriteMaterial({
      map: this.toweringCloudTexture,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
    });

    const toweringPositions = [
      { angle: 0.35, dist: 440, height: 160, scale: 230 },
      { angle: 0.85, dist: 470, height: 180, scale: 270 },
      { angle: 2.1, dist: 410, height: 150, scale: 210 },
      { angle: 3.5, dist: 450, height: 170, scale: 250 },
      { angle: 5.2, dist: 430, height: 190, scale: 260 },
    ];

    for (const t of toweringPositions) {
      const sprite = new THREE.Sprite(towerMat);
      const x = Math.cos(t.angle) * t.dist;
      const z = Math.sin(t.angle) * t.dist;
      sprite.position.set(x, t.height, z);
      sprite.scale.set(t.scale * 0.65, t.scale, 1);
      this.cloudsGroup.add(sprite);

      this.cloudSprites.push({
        sprite,
        baseX: x,
        baseY: t.height,
        baseZ: z,
        speedOffset: 0.003,
      });
    }

    this.flockGroup = new THREE.Group();
    this.scene.add(this.flockGroup);

    const birdMat = new THREE.MeshBasicMaterial({ color: 0x1f2e3d, side: THREE.DoubleSide });
    const wingGeom = new THREE.BufferGeometry();
    const wingVerts = new Float32Array([
      0, 0, 0,
      1.2, 0.2, 0.4,
      0.3, 0, -0.6,
    ]);
    wingGeom.setAttribute('position', new THREE.BufferAttribute(wingVerts, 3));

    const formationOffsets = [
      { x: 0, y: 0, z: 0 },
      { x: -5, y: -0.5, z: -6 },
      { x: 5, y: -0.3, z: -6 },
      { x: -10, y: -1.0, z: -12 },
      { x: 10, y: -0.8, z: -12 },
      { x: -15, y: -1.6, z: -18 },
      { x: 15, y: -1.3, z: -18 },
      { x: 20, y: -1.8, z: -24 },
    ];

    for (let i = 0; i < formationOffsets.length; i++) {
      const f = formationOffsets[i];
      const bird = new THREE.Group();
      bird.scale.setScalar(0.75);

      const leftWing = new THREE.Mesh(wingGeom, birdMat);
      const rightWing = new THREE.Mesh(wingGeom, birdMat);
      rightWing.scale.set(-1, 1, 1);

      bird.add(leftWing);
      bird.add(rightWing);

      this.flockGroup.add(bird);
      this.birds.push({
        mesh: bird,
        leftWing,
        rightWing,
        offsetX: f.x,
        offsetY: f.y,
        offsetZ: f.z,
        phase: i * 0.45,
      });
    }

    this.desertCreatureGroup = new THREE.Group();
    const creatureMat = new THREE.MeshBasicMaterial({ color: 0xa87d55, side: THREE.DoubleSide });

    const cBodyGeom = new THREE.ConeGeometry(1.2, 6, 5);
    cBodyGeom.rotateX(Math.PI / 2);
    const cBody = new THREE.Mesh(cBodyGeom, creatureMat);
    this.desertCreatureGroup.add(cBody);

    const cWingGeom = new THREE.BufferGeometry();
    const cWingVerts = new Float32Array([
      0, 0, 1.5,
      7.0, 0.4, -0.5,
      0, 0, -2.5,
    ]);
    cWingGeom.setAttribute('position', new THREE.BufferAttribute(cWingVerts, 3));

    const cLeftWing = new THREE.Mesh(cWingGeom, creatureMat);
    const cRightWing = new THREE.Mesh(cWingGeom, creatureMat);
    cRightWing.scale.set(-1, 1, 1);

    this.desertCreatureGroup.add(cLeftWing);
    this.desertCreatureGroup.add(cRightWing);
    this.desertCreatureWings = { left: cLeftWing, right: cRightWing };

    this.desertCreatureGroup.scale.setScalar(1.2);
    this.scene.add(this.desertCreatureGroup);
  }

  applyLightingPreset(presetName: LightingMode) {
    const config = LIGHTING_PRESETS[presetName];
    if (!config) return;

    this.skyMaterial.uniforms.uSkyTop.value.set(config.skyTop);
    this.skyMaterial.uniforms.uSkyMid.value.set(config.skyMid);
    this.skyMaterial.uniforms.uSkyHorizon.value.set(config.skyHorizon);
    this.skyMaterial.uniforms.uSunColor.value.set(config.sunColor);
    this.skyMaterial.uniforms.uSunPosition.value.set(...config.sunPosition);
    this.skyMaterial.uniforms.uHazeDensity.value = config.hazeDensity;

    this.dirLight.color.set(config.sunColor);
    this.dirLight.position.set(...config.sunPosition);
    this.ambientLight.color.set(config.ambientColor);
  }

  update(playerPos: THREE.Vector3, playerVelocityZ: number, time: number) {
    this.skyMesh.position.copy(playerPos);
    this.skyMaterial.uniforms.uTime.value = time;

    this.cloudsGroup.position.x = playerPos.x * 0.2;
    this.cloudsGroup.position.z = playerPos.z * 0.3;

    for (let i = 0; i < this.cloudSprites.length; i++) {
      const c = this.cloudSprites[i];
      const drift = time * 0.8 + i * 2.0;
      c.sprite.position.x = c.baseX + Math.sin(drift * 0.08) * 15;
      c.sprite.position.y = c.baseY + Math.cos(drift * 0.05) * 4;
    }

    const flockFlightZ = (playerPos.z + (time * 16) % 800) - 200;
    const flockFlightX = playerPos.x + Math.sin(time * 0.15) * 60 - 30;
    const flockFlightY = playerPos.y + 75 + Math.cos(time * 0.1) * 8;

    this.flockGroup.position.set(flockFlightX, flockFlightY, flockFlightZ);
    this.flockGroup.rotation.y = Math.sin(time * 0.15) * 0.35;

    // Living World Detail: Birds scatter as player surfs close by
    const distToFlock = Math.hypot(playerPos.x - flockFlightX, playerPos.z - flockFlightZ);
    const isScattering = distToFlock < 120;
    const flapSpeed = isScattering ? 10.5 : 5.5;

    for (const b of this.birds) {
      const scatterOffsetX = isScattering ? b.offsetX * 1.6 : b.offsetX;
      const scatterOffsetY = isScattering ? b.offsetY + Math.sin(time * 3.0 + b.phase) * 3.5 : b.offsetY;
      b.mesh.position.set(scatterOffsetX, scatterOffsetY, b.offsetZ);

      const flap = Math.sin(time * flapSpeed + b.phase) * 0.55;
      b.leftWing.rotation.z = flap;
      b.rightWing.rotation.z = -flap;
    }

    const creatureAngle = time * 0.25;
    const creatureOrbitRadius = 140;
    const creatureX = playerPos.x + Math.cos(creatureAngle) * creatureOrbitRadius + 60;
    const creatureZ = playerPos.z + Math.sin(creatureAngle) * creatureOrbitRadius - 60;
    const creatureY = playerPos.y + 110 + Math.sin(time * 0.4) * 10;

    this.desertCreatureGroup.position.set(creatureX, creatureY, creatureZ);
    this.desertCreatureGroup.rotation.y = -creatureAngle + Math.PI / 2;
    this.desertCreatureGroup.rotation.z = 0.25;
    const cFlap = Math.sin(time * 1.8) * 0.3;
    this.desertCreatureWings.left.rotation.z = cFlap;
    this.desertCreatureWings.right.rotation.z = -cFlap;
  }

  dispose() {
    this.scene.remove(this.skyMesh);
    this.scene.remove(this.cloudsGroup);
    this.scene.remove(this.flockGroup);
    this.scene.remove(this.desertCreatureGroup);
    this.skyMaterial.dispose();
    this.skyMesh.geometry.dispose();
    this.cloudTexture.dispose();
    this.toweringCloudTexture.dispose();
  }
}
