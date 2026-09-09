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
    skyTop: '#4B94E6',
    skyMid: '#7EC8FF',
    skyHorizon: '#FCD8B8',
    sunColor: '#F7D6A5',
    sunPosition: [80, 45, -120],
    ambientColor: '#8DB8E8',
    slopeWarm: '#F7D6A5',
    slopeCool: '#6FB07E',
    hazeDensity: 0.85,
  },
  'morning': {
    skyTop: '#5B8FE8',
    skyMid: '#86BFFF',
    skyHorizon: '#FFDEBD',
    sunColor: '#FFE0A3',
    sunPosition: [-90, 35, -100],
    ambientColor: '#9AC0ED',
    slopeWarm: '#FEE0B6',
    slopeCool: '#6EAD80',
    hazeDensity: 0.95,
  },
  'bright-day': {
    skyTop: '#3582EB',
    skyMid: '#5EB0FF',
    skyHorizon: '#BDE6FD',
    sunColor: '#FFF8E7',
    sunPosition: [30, 95, -80],
    ambientColor: '#A3D2F7',
    slopeWarm: '#FCE7C5',
    slopeCool: '#65A976',
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

  // Ghibli Bird Flock & Desert Sky Creature
  flockGroup: THREE.Group;
  birds: BirdData[] = [];
  desertCreatureGroup: THREE.Group;
  desertCreatureWings: { left: THREE.Mesh; right: THREE.Mesh };

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // 1. Layered Gradient Skybox Sphere
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

    // 2. Scene Lights
    this.dirLight = new THREE.DirectionalLight(0xf7d6a5, 1.4);
    this.dirLight.position.set(80, 45, -120);
    this.scene.add(this.dirLight);

    this.ambientLight = new THREE.AmbientLight(0x8db8e8, 0.75);
    this.scene.add(this.ambientLight);

    // 3. Parallax Pseudo-Volumetric Cloud Sprites & Towering Cumulonimbus
    this.cloudTexture = createPainterlyCloudTexture();
    this.toweringCloudTexture = createToweringCumulusTexture();
    this.cloudsGroup = new THREE.Group();
    this.scene.add(this.cloudsGroup);

    const cloudCount = 24;
    const spriteMat = new THREE.SpriteMaterial({
      map: this.cloudTexture,
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
    });

    for (let i = 0; i < cloudCount; i++) {
      const sprite = new THREE.Sprite(spriteMat);
      const angle = (i / cloudCount) * Math.PI * 2 + Math.random() * 0.2;
      const radius = 280 + Math.random() * 220;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const y = 75 + Math.random() * 65;
      const scale = 95 + Math.random() * 70;

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

    // Towering Ghibli Cumulonimbus clouds (Laputa / Howl's Moving Castle style from reference 1 & 3)
    const towerMat = new THREE.SpriteMaterial({
      map: this.toweringCloudTexture,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
    });

    const toweringPositions = [
      { angle: 0.35, dist: 450, height: 160, scale: 220 },
      { angle: 0.85, dist: 480, height: 180, scale: 260 },
      { angle: 2.1, dist: 420, height: 150, scale: 200 },
      { angle: 3.5, dist: 460, height: 170, scale: 240 },
      { angle: 5.2, dist: 440, height: 190, scale: 250 },
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

    // 4. Soaring Flock of Ghibli Birds in V-Formation (Reference 1 & 3)
    this.flockGroup = new THREE.Group();
    this.scene.add(this.flockGroup);

    const birdMat = new THREE.MeshBasicMaterial({ color: 0x223545, side: THREE.DoubleSide });
    const wingGeom = new THREE.BufferGeometry();
    const wingVerts = new Float32Array([
      0, 0, 0,
      1.2, 0.2, 0.4,
      0.3, 0, -0.6,
    ]);
    wingGeom.setAttribute('position', new THREE.BufferAttribute(wingVerts, 3));

    // Form an elegant 8-bird V-formation
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

    // 5. Majestic Soaring Desert Sky Creature / Sand Leviathan (Reference 2 & 4 near sun)
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

    // Parallax clouds move around player center with gentle natural drift + forward parallax
    this.cloudsGroup.position.x = playerPos.x * 0.2;
    this.cloudsGroup.position.z = playerPos.z * 0.3;

    for (let i = 0; i < this.cloudSprites.length; i++) {
      const c = this.cloudSprites[i];
      const drift = time * 0.8 + i * 2.0;
      c.sprite.position.x = c.baseX + Math.sin(drift * 0.08) * 15;
      c.sprite.position.y = c.baseY + Math.cos(drift * 0.05) * 4;
    }

    // 1. Update Ghibli Soaring Birds in Formation
    const flockFlightZ = (playerPos.z + (time * 16) % 800) - 200;
    const flockFlightX = playerPos.x + Math.sin(time * 0.15) * 60 - 30;
    const flockFlightY = playerPos.y + 75 + Math.cos(time * 0.1) * 8;

    this.flockGroup.position.set(flockFlightX, flockFlightY, flockFlightZ);
    this.flockGroup.rotation.y = Math.sin(time * 0.15) * 0.35; // gentle banking turn

    for (const b of this.birds) {
      b.mesh.position.set(b.offsetX, b.offsetY, b.offsetZ);
      const flap = Math.sin(time * 5.5 + b.phase) * 0.55;
      b.leftWing.rotation.z = flap;
      b.rightWing.rotation.z = -flap;
    }

    // 2. Update Soaring Desert Sky Creature (glides gracefully near the sun)
    const creatureAngle = time * 0.25;
    const creatureOrbitRadius = 140;
    const creatureX = playerPos.x + Math.cos(creatureAngle) * creatureOrbitRadius + 60;
    const creatureZ = playerPos.z + Math.sin(creatureAngle) * creatureOrbitRadius - 60;
    const creatureY = playerPos.y + 110 + Math.sin(time * 0.4) * 10;

    this.desertCreatureGroup.position.set(creatureX, creatureY, creatureZ);
    this.desertCreatureGroup.rotation.y = -creatureAngle + Math.PI / 2;
    this.desertCreatureGroup.rotation.z = 0.25; // banked glide
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
