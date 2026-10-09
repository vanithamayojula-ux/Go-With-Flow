import * as THREE from 'three';
import { getBiomeAt, getBiomeFriction, getTerrainHeight, getTerrainNormal, TerrainManager } from './terrain';
import { createPlayerCharacter, animatePlayerCharacter, PlayerCharacter } from './characterModel';
import { BoardTrailShader } from '../graphics/shaders';
import { AudioManager } from './audio';
import {
  ActivePowerUps,
  BiomeType,
  ComboTier,
  CosmeticsConfig,
  GameState,
  HeroId,
  LaneIndex,
  OverdriveTier,
  PlayerStats,
  PlayerUpgrades,
  PowerUpType,
  TrickType,
} from '../types';
import { getLaneX } from './obstacles';
import { heroById } from './heroes';

const CAM_OFFSET_UPRIGHT = new THREE.Vector3(0, 2.6, -5.2);
const CAM_OFFSET_WIDE = new THREE.Vector3(0, 2.85, -5.8);

export class PlayerManager {
  scene: THREE.Scene;
  group: THREE.Group;

  // Character Model
  playerCharacter: PlayerCharacter;

  // Meshes
  characterMesh: THREE.Group;
  torsoMesh?: THREE.Mesh;
  headMesh?: THREE.Mesh;
  visorMesh?: THREE.Mesh;
  capeMesh?: THREE.Mesh;
  leftArmMesh?: THREE.Group;
  rightArmMesh?: THREE.Group;

  // Cyber Hoverboard & Real-Time Neon Underglow
  boardMesh: THREE.Group;
  boardDeckMesh?: THREE.Mesh;
  boardFoilMesh?: THREE.Mesh;
  underglowMesh?: THREE.Mesh;
  underglowLight?: THREE.PointLight;

  stumbleTimer = 0;

  // Mid-Air Trick & Slow-Motion Window
  activeTrick: TrickType | null = null;
  trickTimer = 0;
  slowMoTimer = 0;

  // Camera State & Cinematic Biome Establishing Pull-Back
  cameraPos = new THREE.Vector3();
  cameraLookAt = new THREE.Vector3();
  cameraTilt = 0;
  landingImpulseY = 0;
  biomeTransitionTimer = 0;

  triggerBiomePullBack() {
    this.biomeTransitionTimer = 2.5;
  }

  // Cosmetics
  currentCosmetics: CosmeticsConfig = {
    heroId: 'shadow',
    boardId: 'cyber-phantom',
    trailId: 'electric-cyan',
    capeColor: '#00f0ff',
    poseId: 'standard',
    armorVariant: 'carbon-fiber',
    visorColor: '#00f0ff',
    underglowColor: '#00f0ff',
  };

  // 3-Lane Navigation: -2 (Left), 0 (Center), +2 (Right)
  currentLane: LaneIndex = 0;
  targetLaneX = 0;
  laneStartX = 0;
  laneTimer = 0.2;
  laneDuration = 0.18; // 180ms smooth responsive lane change
  lastLaneSwitchTime = 0;
  isSliding = false;
  slideTimer = 0;

  // Overdrive, Boost & Rail Grinding
  overdriveMeter = 25.0; // 0 to 100
  boostTimer = 0;
  isGrinding = false;
  grindSparkTimer = 0;

  // Power-Ups & Multipliers
  upgrades: PlayerUpgrades = {
    magnetLevel: 1,
    jetpackLevel: 1,
    overdriveLevel: 1,
    shieldCapacitorLevel: 0,
  };

  activePowerUps: ActivePowerUps = {
    magnetTimer: 0,
    magnetMaxDuration: 10,
    jetpackTimer: 0,
    jetpackMaxDuration: 7,
    hoverboardShield: false,
    multiplierTimer: 0,
    multiplierMaxDuration: 12,
  };
  scoreMultiplier = 1;
  highScore = 0;
  gameState: GameState = 'playing';

  applyUpgrades(upgrades: PlayerUpgrades) {
    this.upgrades = { ...upgrades };
    if (this.upgrades.shieldCapacitorLevel > 0 && !this.activePowerUps.hoverboardShield) {
      this.activateHoverboardShield();
    }
  }

  // Shield Visual Bubble
  shieldMesh!: THREE.Mesh;

  // Stats
  stats: PlayerStats = {
    speed: 22,
    maxSpeed: 150,
    distance: 0,
    score: 0,
    highScore: 0,
    styleMeter: 25,
    styleTier: 'Chill',
    overdriveMeter: 25,
    overdriveTier: 'Charged',
    comboTier: 'blue',
    airTime: 0,
    isGrounded: true,
    combo: 0,
    windOrbsCollected: 0,
    dataShardsCollected: 0,
    currentBiome: 'sky-realm',
    currentWorldId: 'sky-isles',
    currentFriction: 0.005,
    activeTrickName: null,
    slowMoActive: false,
    isOnFloatingIsland: false,
    currentLane: 0,
    isSliding: false,
    slideTimer: 0,
    isGrinding: false,
    isBoosting: false,
    boostEnergy: 100,
    activePowerUps: {
      magnetTimer: 0,
      jetpackTimer: 0,
      hoverboardShield: false,
      multiplierTimer: 0,
    },
    scoreMultiplier: 1,
    gameState: 'playing',
  };

  // Physics State
  position = new THREE.Vector3();
  velocity = new THREE.Vector3(0, 0, 6.0);
  warpTimer = 0;
  jumpVelocity = 0;
  hoverHeight = 0.12;
  normal = new THREE.Vector3(0, 1, 0);
  targetNormal = new THREE.Vector3(0, 1, 0);
  carveAngle = 0;
  pitchAngle = 0;
  spinAngle = 0;
  flipAngle = 0;
  grabPoseWeight = 0;
  isGrounded = true;
  isUpright = true;

  // Trail Geometry & Particles
  trailGeometry!: THREE.BufferGeometry;
  trailMaterial!: THREE.ShaderMaterial;
  trailMesh!: THREE.Mesh;
  maxTrailPoints = 85;
  trailHistory: { left: THREE.Vector3; right: THREE.Vector3 }[] = [];
  trailHistoryCount = 0;
  private trailBoardWorld = new THREE.Vector3();
  private trailRightDir = new THREE.Vector3();
  private trailAxisZ = new THREE.Vector3(0, 0, 1);

  dustParticles: { mesh: THREE.Sprite; vel: THREE.Vector3; life: number; maxLife: number }[] = [];
  petalParticles: { mesh: THREE.Sprite; vel: THREE.Vector3; life: number; maxLife: number; rotSpeed: number }[] = [];
  dustTexture!: THREE.Texture;
  petalTexture!: THREE.Texture;

  constructor(scene: THREE.Scene, initialCosmetics?: CosmeticsConfig) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.scene.add(this.group);

    if (initialCosmetics) {
      this.currentCosmetics = { ...this.currentCosmetics, ...initialCosmetics };
    }

    const h = getTerrainHeight(0, 0);
    this.position.set(0, h + this.hoverHeight, 0);
    this.group.position.copy(this.position);

    // Build 3D Hero / Cyberpunk Skater Character & Hoverboard
    this.playerCharacter = createPlayerCharacter(this.currentCosmetics.heroId);
    this.characterMesh = this.playerCharacter.group;
    this.boardMesh = this.playerCharacter.board;

    this.group.add(this.playerCharacter.group);

    // Dedicated top-back key light illuminating the player character's silhouette cleanly: key 3.2 (0, 3.5, -4.5)
    const playerKeyLight = new THREE.DirectionalLight(0xffffff, 3.2);
    playerKeyLight.position.set(0, 3.5, -4.5);
    playerKeyLight.target.position.set(0, 1.0, 0);
    this.group.add(playerKeyLight);
    this.group.add(playerKeyLight.target);

    // Rim Directional magenta 1.5 from back-left (-3, 2, 4)
    const playerRimLight = new THREE.DirectionalLight(0xff00aa, 1.5);
    playerRimLight.position.set(-3, 2, 4);
    playerRimLight.target.position.set(0, 1.0, 0);
    this.group.add(playerRimLight);
    this.group.add(playerRimLight.target);

    // Fill Hemisphere light (sky 0x88ccff 0.6 / ground 0x080810 0.4)
    const playerHemiLight = new THREE.HemisphereLight(0x88ccff, 0x080810, 0.6);
    playerHemiLight.position.set(0, 5, 0);
    this.group.add(playerHemiLight);

    // Spot light 3.0
    const playerSpot = new THREE.SpotLight(0x00d2e0, 3.0, 24, Math.PI / 6, 0.35, 1.1);
    playerSpot.position.set(0, 4.0, -3.0);
    playerSpot.target.position.set(0, 0.8, 0);
    this.group.add(playerSpot);
    this.group.add(playerSpot.target);

    // Underglow 0.65
    const playerUnderglow = new THREE.PointLight(0x00d2e0, 0.65, 3.5);
    playerUnderglow.position.set(0, -0.05, 0);
    this.group.add(playerUnderglow);

    // 3. Thin Fresnel-Rim Holo-Shield Bubble (Crystal clear sightline, zero forward occlusion)
    const shieldGeom = new THREE.SphereGeometry(1.65, 32, 24);
    const shieldMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color(0x00ffaa) },
        uRimColor: { value: new THREE.Color(0x50ffc8) },
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vWorldPosition;
        varying vec3 vViewDirection;

        void main() {
          vNormal = normalize(normalMatrix * normal);
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPos.xyz;
          vViewDirection = normalize(cameraPosition - worldPos.xyz);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uColor;
        uniform vec3 uRimColor;
        varying vec3 vNormal;
        varying vec3 vWorldPosition;
        varying vec3 vViewDirection;

        void main() {
          // View-dependent Fresnel rim: 0 looking straight on, 1 at glancing silhouette edges
          float NdotV = max(0.0, dot(vNormal, vViewDirection));
          float fresnel = pow(1.0 - NdotV, 2.6);

          // Subtle harmonic energy wave across shell
          float pulse = 0.85 + 0.15 * sin(uTime * 4.0 + vWorldPosition.y * 3.0);

          // Center opacity is near-transparent (0.025), rim peaks smoothly at ~0.42
          float alpha = (0.025 + fresnel * 0.42) * pulse;

          // Forward-wedge clearance: suppress center faces pointing directly toward camera
          // so the road ahead and oncoming obstacles are 100% visible and uncluttered
          float forwardClearance = smoothstep(0.85, 0.25, NdotV);
          alpha *= (0.12 + 0.88 * forwardClearance);

          vec3 col = mix(uColor, uRimColor, fresnel);
          gl_FragColor = vec4(col, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    this.shieldMesh = new THREE.Mesh(shieldGeom, shieldMat);
    this.shieldMesh.position.set(0, 0.85, 0);
    this.shieldMesh.visible = false;

    // Protective energy ground ring at board level
    const shieldRingGeom = new THREE.RingGeometry(0.75, 0.88, 32);
    shieldRingGeom.rotateX(-Math.PI / 2);
    const shieldRingMat = new THREE.MeshBasicMaterial({
      color: 0x00ffaa,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const shieldRing = new THREE.Mesh(shieldRingGeom, shieldRingMat);
    shieldRing.position.set(0, -0.78, 0);
    this.shieldMesh.add(shieldRing);

    this.group.add(this.shieldMesh);

    // 5. High-Voltage Laser Trail Ribbon
    this.initTrailRibbon();
    this.initParticleSystems();
  }

  private initTrailRibbon() {
    this.trailGeometry = new THREE.BufferGeometry();
    const maxVertices = this.maxTrailPoints * 2;
    const positions = new Float32Array(maxVertices * 3);
    const uvs = new Float32Array(maxVertices * 2);
    const progresses = new Float32Array(maxVertices);
    const indices: number[] = [];

    for (let i = 0; i < this.maxTrailPoints - 1; i++) {
      const v0 = i * 2;
      const v1 = i * 2 + 1;
      const v2 = (i + 1) * 2;
      const v3 = (i + 1) * 2 + 1;
      indices.push(v0, v1, v2);
      indices.push(v2, v1, v3);
    }

    this.trailGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.trailGeometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    this.trailGeometry.setAttribute('aProgress', new THREE.BufferAttribute(progresses, 1));
    this.trailGeometry.setIndex(indices);

    this.trailMaterial = new THREE.ShaderMaterial({
      vertexShader: BoardTrailShader.vertexShader,
      fragmentShader: BoardTrailShader.fragmentShader,
      uniforms: {
        uColorA: { value: new THREE.Color('#00D2E0') }, // Primary Cyan
        uColorB: { value: new THREE.Color('#FF00FF') }, // Secondary Magenta Speed Swirl
        uOpacity: { value: 0.60 },
        uTime: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });

    this.trailMesh = new THREE.Mesh(this.trailGeometry, this.trailMaterial);
    this.trailMesh.frustumCulled = false;
    this.scene.add(this.trailMesh);

    this.trailHistory = [];
    for (let i = 0; i < this.maxTrailPoints; i++) {
      this.trailHistory.push({ left: new THREE.Vector3(), right: new THREE.Vector3() });
    }
    this.trailHistoryCount = 0;
  }

  private initParticleSystems() {
    this.dustTexture = createDustParticleTexture();
    this.petalTexture = createPetalParticleTexture();

    const dustMat = new THREE.SpriteMaterial({
      map: this.dustTexture,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    for (let i = 0; i < 24; i++) {
      const s = new THREE.Sprite(dustMat.clone());
      s.visible = false;
      this.scene.add(s);
      this.dustParticles.push({ mesh: s, vel: new THREE.Vector3(), life: 0, maxLife: 1 });
    }

    const sparkMat = new THREE.SpriteMaterial({
      map: this.petalTexture,
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    for (let i = 0; i < 20; i++) {
      const s = new THREE.Sprite(sparkMat.clone());
      s.visible = false;
      this.scene.add(s);
      this.petalParticles.push({ mesh: s, vel: new THREE.Vector3(), life: 0, maxLife: 1, rotSpeed: 5 });
    }
  }

  async switchHero(heroId?: HeroId) {
    if (!this.playerCharacter) return;
    await this.playerCharacter.setHero?.(heroId);
    const hero = heroById(heroId);
    if (hero && this.trailMaterial && this.trailMaterial.uniforms) {
      const heroColorHex = `#${hero.trail.toString(16).padStart(6, '0')}`;
      this.trailMaterial.uniforms.uColorA.value.set(heroColorHex);
    }
  }

  applyCosmetics(config: CosmeticsConfig) {
    const prevHeroId = this.currentCosmetics.heroId;
    const nextHeroId = config.heroId || 'shadow';
    this.currentCosmetics = { ...config, heroId: nextHeroId };

    this.switchHero(nextHeroId);

    const pc = this.playerCharacter;
    if (!pc) return;

    // 1. Board Model Selection
    const bId = config.boardId || 'cyber-phantom';
    const boards = pc.boards;
    if (boards) {
      const isCustomHero = pc.heroRig && !pc.heroRig.skinned;
      Object.keys(boards).forEach(key => {
        if (boards[key]) boards[key].visible = !isCustomHero && (key === bId);
      });
    }

    // 2. Helmet / Style Selection
    const hId = config.characterStyle || 'cyber-runner';
    const helmets = pc.helmets;
    if (helmets) {
      Object.keys(helmets).forEach(key => {
        if (helmets[key]) helmets[key].visible = (key === hId);
      });
    }

    // 4. Armor Variant Selection
    const aId = config.armorVariant || 'carbon-fiber';
    const armors = pc.armors;
    if (armors) {
      Object.keys(armors).forEach(key => {
        if (armors[key]) armors[key].visible = (key === aId);
      });
    }

    // 5. Visor, Underglow, Footlights & Cape Colors
    const boardDefaultGlow: Record<string, string> = {
      'cyber-phantom': '#00F0FF',
      'laser-edge': '#FF2200',
      'grid-runner': '#00FF66',
      'tokyo-neon': '#FF007F',
      'void-stalker': '#9900FF',
    };
    const boardGlow = boardDefaultGlow[bId] || '#00F0FF';

    const glowColor =
      config.visorColor ||
      (config.trailId === 'hot-magenta'
        ? '#FF007F'
        : config.trailId === 'acid-green'
        ? '#00FF66'
        : config.trailId === 'plasma-rainbow'
        ? '#FF00AA'
        : '#00F0FF');

    const uColor = config.underglowColor || boardGlow || glowColor;

    if (pc.visorMesh && pc.visorMesh.material) {
      (pc.visorMesh.material as THREE.MeshPhysicalMaterial).color.set(glowColor);
      (pc.visorMesh.material as THREE.MeshPhysicalMaterial).emissive.set(glowColor);
    }

    if (pc.underglowMesh && pc.underglowMesh.material) {
      (pc.underglowMesh.material as THREE.MeshBasicMaterial).color.set(uColor);
    }
    if (pc.underglowLight) {
      pc.underglowLight.color.set(uColor);
    }
    if (pc.footLightLeft) {
      pc.footLightLeft.color.set(uColor);
    }
    if (pc.footLightRight) {
      pc.footLightRight.color.set(uColor);
    }

    if (pc.capeMesh && pc.capeMesh.material) {
      const cColor = config.capeColor || glowColor;
      (pc.capeMesh.material as THREE.MeshStandardMaterial).color.set(cColor);
      (pc.capeMesh.material as THREE.MeshStandardMaterial).emissive.set(cColor);
    }

    if (pc.applyGltfCosmetics) {
      pc.applyGltfCosmetics(config);
    }

    this.updateTrailColors();
  }

  updateTrailColors() {
    if (!this.trailMaterial || !this.trailMaterial.uniforms) return;
    const config = this.currentCosmetics;
    const trailColors: Record<string, { a: string; b: string }> = {
      'electric-cyan': { a: '#00D2E0', b: '#0066FF' },
      'hot-magenta': { a: '#FF007F', b: '#FF0033' },
      'acid-green': { a: '#00FF66', b: '#39FF14' },
      'plasma-rainbow': { a: '#FF00AA', b: '#00F0FF' },
      // Phase 14 Five-World Trails
      'trail_basic_cyan': { a: '#00D2E0', b: '#0066FF' },
      'trail_sky_breeze': { a: '#e0f2fe', b: '#38bdf8' },
      'trail_forest_canopy': { a: '#10b981', b: '#34d399' },
      'trail_crimson_ember': { a: '#f59e0b', b: '#ef4444' },
      'trail_crystal_aurora': { a: '#c084fc', b: '#38bdf8' },
      'trail_obsidian_magma': { a: '#ff2200', b: '#ff6600' },
      'trail_plasma_rainbow': { a: '#ec4899', b: '#06b6d4' },
    };
    const hero = heroById(config.heroId);
    let colorA = '#00D2E0';
    let colorB = '#FF00FF';
    if (config.trailId && trailColors[config.trailId]) {
      colorA = trailColors[config.trailId].a;
      colorB = trailColors[config.trailId].b;
    } else if (hero) {
      colorA = `#${hero.trail.toString(16).padStart(6, '0')}`;
      colorB = '#FF00FF';
    }
    this.trailMaterial.uniforms.uColorA.value.set(colorA);
    this.trailMaterial.uniforms.uColorB.value.set(colorB);
  }

  setUpright(upright: boolean) {
    this.isUpright = upright;
  }

  // --- Cyber Controls & Subway Surfers Actions ---

  switchLane(direction: -1 | 1, audioManager?: AudioManager | null) {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (now - this.lastLaneSwitchTime < 80) {
      return; // Prevent accidental double-trigger in a single frame/cooldown
    }
    const nextLane = Math.max(-1, Math.min(1, this.currentLane + direction)) as LaneIndex;
    if (nextLane !== this.currentLane) {
      this.lastLaneSwitchTime = now;
      this.currentLane = nextLane;
      this.laneStartX = this.position.x;
      this.targetLaneX = getLaneX(this.currentLane);
      this.laneTimer = 0;
      this.laneDuration = 0.18; // 180ms smooth responsive lane change (0.15-0.25s)
      this.cameraTilt = (this.targetLaneX - this.position.x) * 0.035; // Snappy dynamic camera roll tilt
      this.emitLaneShiftParticles(direction);
      if (audioManager) audioManager.playCarveWhoosh();
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try { navigator.vibrate(12); } catch {}
      }
    }
  }

  emitLaneShiftParticles(direction: -1 | 1) {
    const sidePos = this.position.clone();
    sidePos.x += (this.targetLaneX - this.position.x) >= 0 ? 0.35 : -0.35;
    sidePos.y += 0.2;
    this.emitSparks(sidePos, 5, 0x00d2e0);
  }

  emitNearMissSparks(pos: THREE.Vector3) {
    this.emitSparks(pos, 8, 0xffd700);
    this.emitSparks(pos, 4, 0x00d2e0);
  }

  triggerSlide(audioManager?: AudioManager | null) {
    if (!this.isGrounded && this.jumpVelocity > -10) {
      this.jumpVelocity = -24.0; // Cyber fast-fall dive
    }
    this.isSliding = true;
    this.slideTimer = 0.65;
    this.emitJumpDust(this.position, 6);
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate(15); } catch {}
    }
  }

  activateHoverboardShield(audioManager?: AudioManager | null) {
    this.activePowerUps.hoverboardShield = true;
    this.stats.activePowerUps.hoverboardShield = true;
    if (this.shieldMesh) this.shieldMesh.visible = true;
    if (audioManager) audioManager.playGoalCompleteSound();
  }

  absorbShieldHit() {
    this.activePowerUps.hoverboardShield = false;
    this.stats.activePowerUps.hoverboardShield = false;
    if (this.shieldMesh) this.shieldMesh.visible = false;
    this.emitJumpDust(this.position, 14);
  }

  applyBoostGateHit(audioManager?: AudioManager | null) {
    this.boostTimer = 1.6;
    this.stats.isBoosting = true;
    this.velocity.z = Math.min(this.velocity.z + 18.0, 56.0);
    this.overdriveMeter = Math.min(100, this.overdriveMeter + 35.0);
    this.stats.boostEnergy = Math.min(100, (this.stats.boostEnergy || 0) + 50.0);
    if (audioManager) audioManager.playBoostGate();
    this.emitJumpDust(this.position, 10);
    this.emitSparks(this.position, 12, 0x00ffaa);
  }

  setGrinding(grinding: boolean, audioManager?: AudioManager | null) {
    if (grinding !== this.isGrinding) {
      this.isGrinding = grinding;
      this.stats.isGrinding = grinding;
      if (audioManager) {
        if (grinding) audioManager.startGrindSound();
        else audioManager.stopGrindSound();
      }
    }
  }

  applyPowerUp(type: PowerUpType, audioManager?: AudioManager | null) {
    if (type === 'quantum-magnet' || type === 'magnet') {
      const duration = 10.0 + (this.upgrades.magnetLevel - 1) * 2.5;
      this.activePowerUps.magnetTimer = duration;
      this.activePowerUps.magnetMaxDuration = duration;
    } else if (type === 'sonic-jetpack' || type === 'jetpack') {
      const duration = 7.0 + (this.upgrades.jetpackLevel - 1) * 1.5;
      this.activePowerUps.jetpackTimer = duration;
      this.activePowerUps.jetpackMaxDuration = duration;
      this.jumpVelocity = 15.0;
      this.isGrounded = false;
    } else if (type === 'overdrive-2x' || type === 'multiplier2x') {
      const duration = 12.0 + (this.upgrades.overdriveLevel - 1) * 3.0;
      this.activePowerUps.multiplierTimer = duration;
      this.activePowerUps.multiplierMaxDuration = duration;
    } else if (type === 'holo-shield' || type === 'hoverboard-shield') {
      this.activateHoverboardShield(audioManager);
    }
    if (audioManager) audioManager.playOrbChime();
  }

  triggerPortalWarp(targetBiome: BiomeType, audioManager?: AudioManager | null) {
    this.warpTimer = 1.4;
    this.stats.warpTimer = 1.4;
    this.stats.currentBiome = targetBiome;
    this.stats.score += 1500;
    this.overdriveMeter = Math.min(100, this.overdriveMeter + 30);
    this.velocity.z = Math.min(this.velocity.z + 10.0, 65.0);
    this.triggerBiomePullBack();
    if (audioManager) {
      audioManager.playBoostGate();
    }
  }

  resetRun() {
    const h = getTerrainHeight(0, 0);
    this.currentLane = 0;
    this.targetLaneX = 0;
    this.position.set(0, h + this.hoverHeight, 0);
    this.velocity.set(0, 0, 6.0);
    this.jumpVelocity = 0;
    this.isGrounded = true;
    this.isSliding = false;
    this.slideTimer = 0;
    this.boostTimer = 0;
    this.warpTimer = 0;
    this.isGrinding = false;
    this.overdriveMeter = 25.0;
    this.activePowerUps = {
      magnetTimer: 0,
      magnetMaxDuration: 10 + (this.upgrades.magnetLevel - 1) * 2.5,
      jetpackTimer: 0,
      jetpackMaxDuration: 7 + (this.upgrades.jetpackLevel - 1) * 1.5,
      hoverboardShield: false,
      multiplierTimer: 0,
      multiplierMaxDuration: 12 + (this.upgrades.overdriveLevel - 1) * 3.0,
    };
    if (this.shieldMesh) this.shieldMesh.visible = false;
    // Auto-deploy pre-charged shield if capacitor upgraded
    if (this.upgrades.shieldCapacitorLevel > 0) {
      this.activateHoverboardShield();
    }
    this.stats.score = 0;
    this.stats.distance = 0;
    this.stats.windOrbsCollected = 0;
    this.stats.dataShardsCollected = 0;
    this.stats.currentBiome = 'sky-realm';
    this.stats.currentWorldId = 'sky-isles';
    this.stats.gameState = 'playing';
    this.stats.combo = 0;
    this.trailHistoryCount = 0;
    this.group.position.copy(this.position);
  }

  stumble(audioManager?: AudioManager | null) {
    if (this.stumbleTimer > 0) return;
    this.stumbleTimer = 0.75;
    this.stats.stumbleTimer = 0.75;
    this.velocity.z = Math.max(16.0, this.velocity.z - 9.0);
    this.overdriveMeter = Math.max(0, this.overdriveMeter - 20.0);
    this.emitJumpDust(this.position, 10);
    if (audioManager) audioManager.playCrashSound();
  }

  crash() {
    this.gameState = 'game-over';
    this.stats.gameState = 'game-over';
    this.velocity.set(0, 0, 0);
    this.jumpVelocity = 0;
    this.setGrinding(false);
  }

  revive(audioManager?: AudioManager | null) {
    this.gameState = 'playing';
    this.stats.gameState = 'playing';
    this.velocity.set(0, 0, 26);
    this.jumpVelocity = 0;
    this.isGrounded = true;
    this.isSliding = false;
    this.slideTimer = 0;
    this.activateHoverboardShield(audioManager);
    this.emitSparks(this.position, 16, 0x00ffaa);
    if (audioManager && typeof audioManager.playReviveSound === 'function') {
      audioManager.playReviveSound();
    }
  }

  addCoins(amount: number) {
    this.stats.dataShardsCollected += amount;
    this.stats.windOrbsCollected = this.stats.dataShardsCollected;
    this.stats.score += amount * 120 * this.scoreMultiplier;
    const odMultiplier = 1.0 + (this.upgrades.overdriveLevel - 1) * 0.2;
    this.overdriveMeter = Math.min(100, this.overdriveMeter + amount * 3.5 * odMultiplier);
    this.stats.highScore = Math.max(this.stats.highScore, this.stats.score);
    this.emitSparks(this.position, 4, 0x00f0ff);
  }

  triggerTrick(trick: TrickType, audioManager?: AudioManager | null): boolean {
    if (this.isGrounded && this.jumpVelocity === 0) {
      this.jumpVelocity = 13.5;
      this.isGrounded = false;
      this.stats.airTime = 0.01;
    }

    this.activeTrick = trick;
    this.trickTimer = 0.5;
    this.slowMoTimer = 0.4;
    this.stats.slowMoActive = true;

    const trickNames: Record<TrickType, string> = {
      spin: 'Board Spin 360°',
      flip: 'One-Leg Balance',
      grab: 'Side Kick Pose',
      pose: 'Sonic Air Glide',
    };

    this.stats.activeTrickName = trickNames[trick];
    this.stats.combo = Math.min(8, this.stats.combo + 1);
    this.stats.score += 350 * this.stats.combo;
    this.overdriveMeter = Math.min(100, this.overdriveMeter + 16);

    if (audioManager) {
      audioManager.playTrickSound(this.stats.activeTrickName, this.stats.combo);
    }

    this.emitJumpDust(this.position, 6);
    this.emitSparks(this.position, 8, trick === 'flip' ? 0xff007f : trick === 'spin' ? 0x00f0ff : 0x00ffaa);
    return true;
  }

  update(
    dt: number,
    input: {
      left: boolean;
      right: boolean;
      forward: boolean;
      jump: boolean;
      drift: boolean;
      slide?: boolean;
      laneLeft?: boolean;
      laneRight?: boolean;
      trickSpin?: boolean;
      trickFlip?: boolean;
      trickGrab?: boolean;
      trickPose?: boolean;
    },
    time: number,
    terrainManager?: TerrainManager,
    audioManager?: AudioManager | null,
    obstacleManager?: any
  ) {
    const currentBiome = getBiomeAt(this.position.z);
    const friction = getBiomeFriction(currentBiome);
    this.stats.currentBiome = currentBiome;
    this.stats.currentFriction = friction;

    const effectiveDt = Math.min(dt, 0.05) * (this.stats.slowMoActive ? 0.7 : 1.0);

    if (this.slowMoTimer > 0) {
      this.slowMoTimer -= dt;
      this.stats.slowMoActive = true;
    } else {
      this.stats.slowMoActive = false;
    }

    // Boost & Grind Timers
    if (this.boostTimer > 0) {
      this.boostTimer -= effectiveDt;
      this.stats.isBoosting = true;
    } else {
      this.stats.isBoosting = false;
    }

    if (this.isGrinding) {
      this.overdriveMeter = Math.min(100, this.overdriveMeter + 28 * effectiveDt);
      this.grindSparkTimer += effectiveDt;
      if (this.grindSparkTimer > 0.06) {
        this.grindSparkTimer = 0;
        this.emitJumpDust(this.position, 2);
        this.emitSparks(this.position, 3, Math.random() > 0.5 ? 0xff007f : 0x00f0ff);
      }
    }

    // Discrete Lane switching & Slide Controls
    if (input.laneLeft) {
      this.switchLane(-1, audioManager);
      input.laneLeft = false;
    } else if (input.laneRight) {
      this.switchLane(1, audioManager);
      input.laneRight = false;
    }

    if (input.slide) this.triggerSlide(audioManager);

    if (this.slideTimer > 0) {
      this.slideTimer -= effectiveDt;
      if (this.slideTimer <= 0) this.isSliding = false;
    }

    // Power-Up Timers
    if (this.activePowerUps.magnetTimer > 0) {
      this.activePowerUps.magnetTimer -= effectiveDt;
    }
    if (this.activePowerUps.multiplierTimer > 0) {
      this.activePowerUps.multiplierTimer -= effectiveDt;
      this.scoreMultiplier = 2;
    } else {
      this.scoreMultiplier = 1;
    }

    // Shield spinning
    if (this.shieldMesh && this.shieldMesh.visible) {
      this.shieldMesh.rotation.y += effectiveDt * 3.0;
      this.shieldMesh.rotation.x += effectiveDt * 1.5;
    }

    // Tricks
    if (input.trickSpin) this.triggerTrick('spin', audioManager);
    else if (input.trickFlip) this.triggerTrick('flip', audioManager);
    else if (input.trickGrab) this.triggerTrick('grab', audioManager);
    else if (input.trickPose) this.triggerTrick('pose', audioManager);

    if (this.trickTimer > 0) {
      this.trickTimer -= effectiveDt;
      if (this.trickTimer <= 0) this.activeTrick = null;
    } else if (this.isGrounded) {
      this.stats.activeTrickName = null;
    }

    // Responsive Smoothstep Lane Interpolation (0.18s crisp duration with smooth easing)
    this.targetLaneX = getLaneX(this.currentLane);
    this.laneTimer += effectiveDt;
    const laneProgress = Math.min(1.0, this.laneTimer / this.laneDuration);
    const smoothT = laneProgress * laneProgress * (3.0 - 2.0 * laneProgress); // Smoothstep cubic easing
    this.position.x = this.laneStartX + (this.targetLaneX - this.laneStartX) * smoothT;
    if (laneProgress >= 1.0) {
      this.position.x = this.targetLaneX;
    }

    // Dynamic Board Carve & Camera Tilt response
    this.carveAngle = THREE.MathUtils.lerp(this.carveAngle, (this.targetLaneX - this.position.x) * 0.22, 22.0 * effectiveDt);
    this.cameraTilt = THREE.MathUtils.lerp(this.cameraTilt, (this.targetLaneX - this.position.x) * 0.045, 14.0 * effectiveDt);

    // Warp timer countdown
    if (this.warpTimer > 0) {
      this.warpTimer -= effectiveDt;
      this.stats.warpTimer = this.warpTimer;
    }

    // Dynamic distance-based speed scaling: starting slow at ~6.0, ramping up smoothly as distance increases (Subway Surfers style)
    const distanceSpeedBonus = Math.min(28.0, (this.stats.distance / 120.0) * 2.0);
    let targetSpeed = 6.0 + distanceSpeedBonus;

    if (input.forward) targetSpeed += 12.0;
    if (this.stats.isBoosting) targetSpeed += 18.0;
    if (this.isGrinding) targetSpeed += 8.0;

    const overdriveBonus = (this.overdriveMeter / 100) * 10.0;
    targetSpeed += overdriveBonus;

    this.velocity.z = THREE.MathUtils.lerp(this.velocity.z, targetSpeed, 3.5 * effectiveDt);

    // Forward translation FIRST so terrain height is computed at updated position
    this.position.z += this.velocity.z * effectiveDt;

    // Solid ground physics: evaluate surface height (terrain + train roofs/ramps) at exact updated (x, z)
    const groundH = getTerrainHeight(this.position.x, this.position.z);
    let obstacleSurfaceH = 0;
    if (this.gameState === 'playing' && obstacleManager && typeof obstacleManager.getObstacleSurfaceHeight === 'function') {
      obstacleSurfaceH = obstacleManager.getObstacleSurfaceHeight(this.position.x, this.position.z, this.position.y);
    }

    const activeSurfaceH = Math.max(groundH, obstacleSurfaceH);
    const minY = activeSurfaceH + this.hoverHeight;
    const maxY = activeSurfaceH + 6.5; // Strict vertical ceiling clamp

    // Automatic Edge-Fall Detection: If player was grounded but platform underneath ended (stepping off train roof into thin air)
    if (this.isGrounded && this.position.y > minY + 0.18) {
      this.isGrounded = false;
      this.jumpVelocity = Math.min(this.jumpVelocity, 0); // Immediately start falling under gravity!
    }

    const gravityRate = this.stats.slowMoActive ? 22.0 : 30.0;

    if (input.jump && this.isGrounded) {
      this.jumpVelocity = 15.5;
      this.isGrounded = false;
      this.stats.airTime = 0.01;
      this.emitJumpDust(this.position, 6);
    }

    if (!this.isGrounded) {
      this.jumpVelocity = THREE.MathUtils.clamp(this.jumpVelocity - gravityRate * effectiveDt, -18.0, 16.0);
      this.position.y += this.jumpVelocity * effectiveDt;
      this.stats.airTime += effectiveDt;

      // Vertical clamp so player cannot fly infinitely upward
      if (this.position.y > maxY) {
        this.position.y = maxY;
        this.jumpVelocity = Math.min(0, this.jumpVelocity);
      }

      if (this.activeTrick === 'spin') this.spinAngle += effectiveDt * 14.0;
      else if (this.activeTrick === 'flip') this.flipAngle += effectiveDt * 12.0;
      else if (this.activeTrick === 'grab') this.grabPoseWeight = Math.min(1.0, this.grabPoseWeight + effectiveDt * 6);
      else if (this.activeTrick === 'pose') this.grabPoseWeight = Math.min(1.0, this.grabPoseWeight + effectiveDt * 4);
    }

    // Ground & platform solid snap check at updated (x, z) position
    if (this.position.y <= minY) {
      const wereAirborne = !this.isGrounded;
      this.position.y = minY;
      if (wereAirborne && this.jumpVelocity < -2.0) {
        if (audioManager) audioManager.playLanding();
        this.emitJumpDust(this.position, 5);
        this.landingImpulseY = -0.16;
      }
      this.jumpVelocity = 0;
      this.isGrounded = true;
      this.stats.airTime = 0;
      this.spinAngle = THREE.MathUtils.lerp(this.spinAngle, 0, 10 * effectiveDt);
      this.flipAngle = THREE.MathUtils.lerp(this.flipAngle, 0, 10 * effectiveDt);
      this.grabPoseWeight = THREE.MathUtils.lerp(this.grabPoseWeight, 0, 12 * effectiveDt);
    }

    // Rotations & Locked Relative Board Positioning
    getTerrainNormal(this.position.x, this.position.z, this.targetNormal);
    this.normal.lerp(this.targetNormal, 14 * effectiveDt);

    this.group.position.copy(this.position);

    // Drive Procedural 3D Skater & Board Animations
    const speedFactor = Math.min(1.8, Math.max(0.5, this.velocity.z / 25));

    let nearestObsDist = 999;
    if (obstacleManager && Array.isArray(obstacleManager.obstacles)) {
      for (const obs of obstacleManager.obstacles) {
        if (!obs.cleared && obs.z > this.position.z) {
          const d = obs.z - this.position.z;
          if (d < nearestObsDist) nearestObsDist = d;
        }
      }
    }

    animatePlayerCharacter(this.playerCharacter, time, speedFactor, {
      isGrounded: this.isGrounded,
      isSliding: this.isSliding,
      isGrinding: this.isGrinding,
      isBoosting: this.stats.isBoosting,
      stumbleTimer: this.stumbleTimer,
      activeTrickName: this.stats.activeTrickName,
      activeTrick: this.activeTrick,
      turnVelocity: this.carveAngle * 10,
      nearestObstacleDist: nearestObsDist,
      dt: effectiveDt,
    });

    // Continuous Carve Roll & Unified Bank Tilt (Syncing surfboard and character roll)
    const carveFreq = 2.0 + speedFactor * 0.8;
    const carvePhase = time * carveFreq;
    const isSpecialAction = this.isSliding || this.isGrinding || !this.isGrounded;
    const carveBlend = isSpecialAction ? 0.20 : 1.0;

    const continuousCarveRoll = Math.sin(carvePhase) * 0.04 * carveBlend;
    const laneCarveTilt = -this.carveAngle * 1.1;
    const unifiedCarveTilt = continuousCarveRoll + laneCarveTilt;

    this.boardMesh.rotation.z = unifiedCarveTilt;
    this.boardMesh.rotation.x = this.isGrounded ? 0 : (this.activeTrick === 'flip' ? this.flipAngle : 0.42 * Math.sin(Math.min(1.0, (this.stats.airTime || 0) * 2.5) * Math.PI));
    this.boardMesh.rotation.y = this.isGrounded ? 0 : this.spinAngle;

    // Animate Holo-Shield Shell
    if (this.shieldMesh && this.shieldMesh.visible) {
      const shieldMat = this.shieldMesh.material as THREE.ShaderMaterial;
      if (shieldMat.uniforms && shieldMat.uniforms.uTime) {
        shieldMat.uniforms.uTime.value = time;
      }
      this.shieldMesh.rotation.y = time * 0.4;
    }

    // Underglow & Foot Lights Dynamic Intensities
    const speedRatio = Math.min(1.0, Math.max(0.0, this.stats.speed / 60));
    const pulseFreq = 4.0 + speedRatio * 16.0;
    const pulseMag = 0.15 + speedRatio * 0.35;
    const dynamicPulse = Math.sin(time * pulseFreq) * pulseMag + (1.0 - pulseMag * 0.5);

    if (this.underglowMesh) {
      (this.underglowMesh.material as THREE.MeshBasicMaterial).opacity = 0.45 * dynamicPulse;
    }
    if (this.playerCharacter.forwardSpotLight) {
      this.playerCharacter.forwardSpotLight.intensity = 2.0 + speedRatio * 1.8 + Math.sin(time * pulseFreq) * 0.4;
    }
    if (this.playerCharacter.footLightLeft && this.playerCharacter.footLightRight) {
      const footInt = (this.isSliding ? 2.6 : 0.9) * dynamicPulse;
      this.playerCharacter.footLightLeft.intensity = footInt;
      this.playerCharacter.footLightRight.intensity = footInt;
    }

    // Slide Contact Sparks & Rail Grind Friction Sparks
    if (this.isSliding) {
      this.emitSparks(this.position, 2, 0x00f0ff);
    }
    if (this.isGrinding) {
      this.emitSparks(this.position, 3, 0xffd700);
      this.overdriveMeter = Math.min(100, this.overdriveMeter + 14.0 * effectiveDt);
      this.stats.boostEnergy = Math.min(100, (this.stats.boostEnergy || 0) + 20.0 * effectiveDt);
    } else if (this.stats.isBoosting) {
      this.stats.boostEnergy = Math.max(0, (this.stats.boostEnergy || 0) - 25.0 * effectiveDt);
    } else {
      this.stats.boostEnergy = Math.max(0, (this.stats.boostEnergy || 0) - 10.0 * effectiveDt);
    }

    // Stumble recoil
    if (this.stumbleTimer > 0) {
      this.stumbleTimer -= effectiveDt;
      this.stats.stumbleTimer = this.stumbleTimer;
    }

    // Character root remains stable with zero double-tilt
    this.characterMesh.rotation.z = 0;
    this.characterMesh.rotation.x = 0;
    this.characterMesh.rotation.y = 0;
    this.characterMesh.position.y = 0;

    // Overdrive & Combo Tiers calculation
    let odTier: OverdriveTier = 'Dormant';
    if (this.overdriveMeter >= 99.0) {
      odTier = 'Max-Velocity';
      if (Math.random() < 0.3) {
        this.emitSparks(this.position, 1, 0x00f0ff);
      }
    } else if (this.overdriveMeter >= 70.0) {
      odTier = 'Overdrive';
    } else if (this.overdriveMeter >= 25.0) {
      odTier = 'Charged';
    }

    let cTier: ComboTier = 'blue';
    if (this.stats.combo >= 5) cTier = 'white-hot';
    else if (this.stats.combo >= 3) cTier = 'magenta';
    else if (this.stats.combo === 2) cTier = 'cyan';

    // Style Tier Derivation (Chill -> Breeze -> Flow -> Transcendent)
    let sTier: 'Chill' | 'Breeze' | 'Flow' | 'Transcendent' = 'Chill';
    if (this.overdriveMeter >= 85 || this.stats.combo >= 6 || this.stats.scoreMultiplier >= 4) {
      sTier = 'Transcendent';
    } else if (this.overdriveMeter >= 55 || this.stats.combo >= 4 || this.stats.scoreMultiplier >= 2) {
      sTier = 'Flow';
    } else if (this.overdriveMeter >= 25 || this.stats.combo >= 2) {
      sTier = 'Breeze';
    }

    this.stats.overdriveMeter = this.overdriveMeter;
    this.stats.overdriveTier = odTier;
    this.stats.comboTier = cTier;
    this.stats.styleTier = sTier;
    this.stats.styleMeter = this.overdriveMeter;
    this.stats.isGrinding = this.isGrinding;
    this.stats.speed = Math.round(this.velocity.z * 3.6); // km/h
    this.stats.distance = Math.round(this.position.z);
    const grindScoreBonus = this.isGrinding ? 2.0 : 1.0;
    this.stats.score += Math.round(this.velocity.z * effectiveDt * 4.0 * this.scoreMultiplier * grindScoreBonus);
    this.stats.highScore = Math.max(this.stats.highScore, this.stats.score);
    this.stats.currentLane = this.currentLane;
    this.stats.isSliding = this.isSliding;
    this.stats.slideTimer = this.slideTimer;
    this.stats.activePowerUps.magnetTimer = this.activePowerUps.magnetTimer;
    this.stats.activePowerUps.magnetMaxDuration = this.activePowerUps.magnetMaxDuration;
    this.stats.activePowerUps.jetpackTimer = this.activePowerUps.jetpackTimer;
    this.stats.activePowerUps.jetpackMaxDuration = this.activePowerUps.jetpackMaxDuration;
    this.stats.activePowerUps.hoverboardShield = this.activePowerUps.hoverboardShield;
    this.stats.activePowerUps.multiplierTimer = this.activePowerUps.multiplierTimer;
    this.stats.activePowerUps.multiplierMaxDuration = this.activePowerUps.multiplierMaxDuration;
    this.stats.scoreMultiplier = this.scoreMultiplier;
    this.stats.gameState = this.gameState;

    this.updateTrailRibbon(effectiveDt);
    this.updateParticles(effectiveDt);

    // Dynamic landing camera impulse decay
    this.landingImpulseY = THREE.MathUtils.lerp(this.landingImpulseY, 0, 16.0 * effectiveDt);

    // Subtle speed sensation: slightly back and elevated at high speeds
    const speedCamBack = Math.min(1.0, this.velocity.z / 35.0) * 0.45;
    const speedCamUp = Math.min(1.0, this.velocity.z / 35.0) * 0.15;

    // Camera ONE preset: pos x*0.58 y+2.6 z-5.2 look y+1.6 FOV 62
    this.cameraPos.set(
      this.position.x * 0.58,
      this.position.y + 2.6 + speedCamUp + this.landingImpulseY,
      this.position.z - 5.2 - speedCamBack
    );
    this.cameraLookAt.set(
      this.position.x * 0.58,
      this.position.y + 1.6 + this.landingImpulseY * 0.5,
      this.position.z + 12.0
    );
  }

  private updateTrailRibbon(effectiveDt: number) {
    this.boardMesh.getWorldPosition(this.trailBoardWorld);

    const ribbonHalfWidth = 0.15; // 0.30m full ribbon width
    this.trailRightDir.set(1, 0, 0)
      .applyAxisAngle(this.trailAxisZ, -this.carveAngle)
      .multiplyScalar(ribbonHalfWidth);

    // Shift preallocated history ring buffer back by 1 step
    if (this.trailHistoryCount < this.maxTrailPoints) {
      this.trailHistoryCount++;
    }
    for (let i = this.trailHistoryCount - 1; i > 0; i--) {
      this.trailHistory[i].left.copy(this.trailHistory[i - 1].left);
      this.trailHistory[i].right.copy(this.trailHistory[i - 1].right);
    }

    if (this.trailHistory.length > 0) {
      this.trailHistory[0].left.set(
        this.trailBoardWorld.x - this.trailRightDir.x,
        this.trailBoardWorld.y - this.trailRightDir.y - 0.05,
        this.trailBoardWorld.z - this.trailRightDir.z - 0.85
      );
      this.trailHistory[0].right.set(
        this.trailBoardWorld.x + this.trailRightDir.x,
        this.trailBoardWorld.y + this.trailRightDir.y - 0.05,
        this.trailBoardWorld.z + this.trailRightDir.z - 0.85
      );
    }

    const posAttr = this.trailGeometry.attributes.position as THREE.BufferAttribute;
    const uvAttr = this.trailGeometry.attributes.uv as THREE.BufferAttribute;
    const progAttr = this.trailGeometry.attributes.aProgress as THREE.BufferAttribute;

    const count = this.trailHistoryCount || 1;
    for (let i = 0; i < this.maxTrailPoints; i++) {
      const idx = Math.min(i, count - 1);
      const pair = this.trailHistory[idx] || this.trailHistory[0];
      const progress = 1.0 - i / this.maxTrailPoints;

      posAttr.setXYZ(i * 2, pair.left.x, pair.left.y, pair.left.z);
      uvAttr.setXY(i * 2, 0.0, progress);
      progAttr.setX(i * 2, progress);

      posAttr.setXYZ(i * 2 + 1, pair.right.x, pair.right.y, pair.right.z);
      uvAttr.setXY(i * 2 + 1, 1.0, progress);
      progAttr.setX(i * 2 + 1, progress);
    }

    posAttr.needsUpdate = true;
    uvAttr.needsUpdate = true;
    progAttr.needsUpdate = true;
  }

  private emitJumpDust(pos: THREE.Vector3, count = 4) {
    let spawned = 0;
    for (const p of this.dustParticles) {
      if (spawned >= count) break;
      if (p.life <= 0) {
        p.life = 0.45;
        p.maxLife = 0.45;
        p.mesh.position.set(
          pos.x + (Math.random() - 0.5) * 1.5,
          pos.y + 0.1,
          pos.z + (Math.random() - 0.5) * 1.5
        );
        p.mesh.visible = true;
        p.vel.set((Math.random() - 0.5) * 3, Math.random() * 2, -Math.random() * 3);
        spawned++;
      }
    }
  }

  public emitSparks(pos: THREE.Vector3, count = 4, hexColor = 0x00f0ff) {
    let spawned = 0;
    for (const p of this.petalParticles) {
      if (spawned >= count) break;
      if (p.life <= 0) {
        p.life = 0.35 + Math.random() * 0.2;
        p.maxLife = p.life;
        p.mesh.position.set(
          pos.x + (Math.random() - 0.5) * 0.6,
          pos.y + (Math.random() - 0.5) * 0.3,
          pos.z + (Math.random() - 0.5) * 0.6
        );
        (p.mesh.material as THREE.SpriteMaterial).color.setHex(hexColor);
        p.mesh.visible = true;
        p.vel.set(
          (Math.random() - 0.5) * 6.0,
          Math.random() * 4.0 + 1.0,
          -this.velocity.z * 0.4 - Math.random() * 4.0
        );
        p.rotSpeed = (Math.random() - 0.5) * 16.0;
        spawned++;
      }
    }
  }

  private updateParticles(effectiveDt: number) {
    // 1. Dust / Jump Impact Particles
    for (const p of this.dustParticles) {
      if (p.life > 0) {
        p.life -= effectiveDt;
        if (p.life <= 0) {
          p.mesh.visible = false;
        } else {
          p.vel.y -= 9.8 * effectiveDt; // Gravity on dust
          p.mesh.position.addScaledVector(p.vel, effectiveDt);
          const lifeFrac = Math.max(0, p.life / p.maxLife);
          (p.mesh.material as THREE.SpriteMaterial).opacity = lifeFrac * 0.8;
          const scale = (1.0 - lifeFrac * 0.3) * 0.8;
          p.mesh.scale.set(scale, scale, 1);
        }
      }
    }

    // 2. Neon Sparks / Rail Grind / Boost Flare Particles
    for (const p of this.petalParticles) {
      if (p.life > 0) {
        p.life -= effectiveDt;
        if (p.life <= 0) {
          p.mesh.visible = false;
        } else {
          p.vel.y -= 4.0 * effectiveDt; // Gentle gravity on sparks
          p.mesh.position.addScaledVector(p.vel, effectiveDt);
          p.mesh.material.rotation += (p.rotSpeed || 5) * effectiveDt;
          const lifeFrac = Math.max(0, p.life / p.maxLife);
          (p.mesh.material as THREE.SpriteMaterial).opacity = lifeFrac * 0.95;
          const scale = lifeFrac * 0.65;
          p.mesh.scale.set(scale, scale, 1);
        }
      }
    }
  }

  checkOrbCollection(orbs: { id: string; x: number; y: number; z: number; collected: boolean; mesh?: THREE.Mesh }[]): number {
    let collectedCount = 0;
    for (const orb of orbs) {
      if (!orb.collected) {
        const dist = Math.hypot(this.position.x - orb.x, this.position.y - orb.y, this.position.z - orb.z);
        if (dist < 2.5) {
          orb.collected = true;
          if (orb.mesh) orb.mesh.visible = false;
          this.stats.dataShardsCollected += 1;
          this.stats.windOrbsCollected = this.stats.dataShardsCollected;
          this.stats.score += 200;
          this.overdriveMeter = Math.min(100, this.overdriveMeter + 10);
          this.emitJumpDust(new THREE.Vector3(orb.x, orb.y, orb.z), 5);
          collectedCount++;
        }
      }
    }
    return collectedCount;
  }

  dispose() {
    this.scene.remove(this.group);
    this.scene.remove(this.trailMesh);
    if (this.shieldMesh) {
      this.shieldMesh.geometry.dispose();
      if (Array.isArray(this.shieldMesh.material)) {
        this.shieldMesh.material.forEach(m => m.dispose());
      } else {
        this.shieldMesh.material.dispose();
      }
    }
    this.dustParticles.forEach(p => {
      this.scene.remove(p.mesh);
      (p.mesh.material as THREE.Material).dispose();
    });
    this.petalParticles.forEach(p => {
      this.scene.remove(p.mesh);
      (p.mesh.material as THREE.Material).dispose();
    });
    this.trailGeometry.dispose();
    this.trailMaterial.dispose();
    this.dustTexture.dispose();
    this.petalTexture.dispose();
  }
}

function sinPulse(x: number): number {
  return Math.sin(x) * 0.5 + 0.5;
}

function createDustParticleTexture(): THREE.Texture {
  if (typeof document === 'undefined') {
    return new THREE.Texture();
  }
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  grad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
  grad.addColorStop(0.3, 'rgba(0, 240, 255, 0.8)');
  grad.addColorStop(0.7, 'rgba(0, 240, 255, 0.2)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);

  return new THREE.CanvasTexture(canvas);
}

function createPetalParticleTexture(): THREE.Texture {
  if (typeof document === 'undefined') {
    return new THREE.Texture();
  }
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;

  ctx.save();
  ctx.translate(32, 32);
  ctx.rotate(-Math.PI / 4);

  const grad = ctx.createRadialGradient(0, 0, 2, 0, 0, 24);
  grad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
  grad.addColorStop(0.4, 'rgba(255, 0, 127, 0.9)');
  grad.addColorStop(0.8, 'rgba(255, 0, 127, 0.3)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(0, 0, 10, 22, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  return new THREE.CanvasTexture(canvas);
}
