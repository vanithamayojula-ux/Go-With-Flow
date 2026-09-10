import * as THREE from 'three';
import { getBiomeAt, getBiomeFriction, getTerrainHeight, getTerrainNormal, TerrainManager } from './terrain';
import { createPlayerCharacter, animatePlayerCharacter, PlayerCharacter } from './characterModel';
import { BoardTrailShader } from '../graphics/shaders';
import { createDustParticleTexture, createPetalParticleTexture } from '../graphics/textures';
import { AudioManager } from './audio';
import {
  ActivePowerUps,
  BiomeType,
  ComboTier,
  CosmeticsConfig,
  GameState,
  LaneIndex,
  OverdriveTier,
  PlayerStats,
  PowerUpType,
  TrickType,
} from '../types';
import { getLaneX } from './obstacles';

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

  // Cyber Recon Drone Companion
  cyberDroneMesh: THREE.Group;
  droneEyeMesh?: THREE.Mesh;
  droneRingMesh?: THREE.Mesh;
  cyberDroneTime = Math.random() * Math.PI * 2;
  stumbleTimer = 0;

  // Mid-Air Trick & Slow-Motion Window
  activeTrick: TrickType | null = null;
  trickTimer = 0;
  slowMoTimer = 0;

  // Camera State & Cinematic Biome Establishing Pull-Back
  cameraPos = new THREE.Vector3();
  cameraLookAt = new THREE.Vector3();
  cameraTilt = 0;
  biomeTransitionTimer = 0;

  triggerBiomePullBack() {
    this.biomeTransitionTimer = 2.5;
  }

  // Cosmetics
  currentCosmetics: CosmeticsConfig = {
    boardId: 'cyber-phantom',
    trailId: 'electric-cyan',
    capeColor: '#00f0ff',
    poseId: 'standard',
    armorVariant: 'carbon-fiber',
    visorColor: '#00f0ff',
    underglowColor: '#00f0ff',
  };

  // 3-Lane Navigation & Slide
  currentLane: LaneIndex = 0;
  targetLaneX = 0;
  isSliding = false;
  slideTimer = 0;

  // Overdrive, Boost & Rail Grinding
  overdriveMeter = 25.0; // 0 to 100
  boostTimer = 0;
  isGrinding = false;
  grindSparkTimer = 0;

  // Power-Ups & Multipliers
  activePowerUps: ActivePowerUps = {
    magnetTimer: 0,
    jetpackTimer: 0,
    hoverboardShield: false,
    multiplierTimer: 0,
  };
  scoreMultiplier = 1;
  highScore = 0;
  gameState: GameState = 'playing';

  // Shield Visual Bubble
  shieldMesh!: THREE.Mesh;

  // Stats
  stats: PlayerStats = {
    speed: 50,
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
    currentBiome: 'neon-undercity',
    currentFriction: 0.02,
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
  velocity = new THREE.Vector3(0, 0, 14);
  warpTimer = 0;
  jumpVelocity = 0;
  hoverHeight = 0.55;
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

  dustParticles: { mesh: THREE.Sprite; vel: THREE.Vector3; life: number; maxLife: number }[] = [];
  petalParticles: { mesh: THREE.Sprite; vel: THREE.Vector3; life: number; maxLife: number; rotSpeed: number }[] = [];
  dustTexture!: THREE.CanvasTexture;
  petalTexture!: THREE.CanvasTexture;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.scene.add(this.group);

    const h = getTerrainHeight(0, 0);
    this.position.set(0, h + this.hoverHeight, 0);
    this.group.position.copy(this.position);

    // Build Procedural Low-Poly 3D Cyberpunk Skater Character & Hoverboard
    this.playerCharacter = createPlayerCharacter();
    this.characterMesh = this.playerCharacter.group;
    this.boardMesh = this.playerCharacter.board;

    this.group.add(this.playerCharacter.group);

    // 3. Autonomous Cyber Drone Companion (Stable Hovering Recon Drone)
    this.cyberDroneMesh = new THREE.Group();
    const droneBodyMat = new THREE.MeshStandardMaterial({ color: 0x080e1a, metalness: 0.9, roughness: 0.2 });
    const droneBody = new THREE.Mesh(new THREE.OctahedronGeometry(0.22), droneBodyMat);
    this.cyberDroneMesh.add(droneBody);

    // Glowing Optical Scanner Lens Eye
    const droneEyeMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    this.droneEyeMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.06, 8), droneEyeMat);
    this.droneEyeMesh.rotateX(Math.PI / 2);
    this.droneEyeMesh.position.set(0, 0, 0.16);
    this.cyberDroneMesh.add(this.droneEyeMesh);

    // Magnetic Stabilization Ring
    this.droneRingMesh = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.02, 6, 16), droneEyeMat);
    this.cyberDroneMesh.add(this.droneRingMesh);

    this.cyberDroneMesh.position.set(1.25, 1.75, -0.5);
    this.group.add(this.cyberDroneMesh);

    // 4. Holo-Shield Bubble
    const shieldGeom = new THREE.SphereGeometry(1.55, 16, 16);
    const shieldMat = new THREE.MeshBasicMaterial({
      color: 0x00ffaa,
      transparent: true,
      opacity: 0.42,
      wireframe: true,
    });
    this.shieldMesh = new THREE.Mesh(shieldGeom, shieldMat);
    this.shieldMesh.position.set(0, 0.9, 0);
    this.shieldMesh.visible = false;
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
        uColorA: { value: new THREE.Color('#00F0FF') }, // Electric Cyan
        uColorB: { value: new THREE.Color('#FF007F') }, // Hot Magenta
        uOpacity: { value: 0.9 },
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

  applyCosmetics(config: CosmeticsConfig) {
    this.currentCosmetics = { ...config };

    // Update Visor & Underglow Neon Palette
    if (this.visorMesh && this.underglowMesh && this.boardFoilMesh) {
      const glowColor =
        config.trailId === 'hot-magenta'
          ? '#FF007F'
          : config.trailId === 'acid-green'
          ? '#00FF66'
          : config.trailId === 'plasma-rainbow'
          ? '#FF00AA'
          : '#00F0FF';

      (this.visorMesh.material as THREE.MeshBasicMaterial).color.set(config.visorColor || glowColor);
      (this.underglowMesh.material as THREE.MeshBasicMaterial).color.set(config.underglowColor || glowColor);
      (this.boardFoilMesh.material as THREE.MeshBasicMaterial).color.set(glowColor);
      (this.capeMesh.material as THREE.MeshBasicMaterial).color.set(glowColor);

      if (this.underglowLight) {
        this.underglowLight.color.set(config.underglowColor || glowColor);
      }
    }

    // Board Deck Material
    if (this.boardDeckMesh) {
      const deckColor =
        config.boardId === 'laser-edge'
          ? '#1a0b16'
          : config.boardId === 'grid-runner'
          ? '#081a10'
          : config.boardId === 'tokyo-neon'
          ? '#201104'
          : config.boardId === 'void-stalker'
          ? '#06060c'
          : '#090e18';
      (this.boardDeckMesh.material as THREE.MeshStandardMaterial).color.set(deckColor);
    }

    // Armor / Outfit Variant
    if (this.torsoMesh) {
      const hoodieColor =
        config.armorVariant === 'titanium-white'
          ? '#d4d8e8'
          : config.armorVariant === 'onyx-stealth'
          ? '#141a24'
          : config.armorVariant === 'crimson-cyborg'
          ? '#3a1220'
          : '#0d121c'; // Default Black Hoodie
      (this.torsoMesh.material as THREE.MeshStandardMaterial).color.set(hoodieColor);
    }

    // Optional Companion Drone per Outfit (Fixes hardcoded-visible bug)
    if (this.cyberDroneMesh) {
      this.cyberDroneMesh.visible = config.companionEnabled !== false;
      const glowColor =
        config.visorColor ||
        (config.trailId === 'hot-magenta'
          ? '#FF007F'
          : config.trailId === 'acid-green'
          ? '#00FF66'
          : config.trailId === 'plasma-rainbow'
          ? '#FF00AA'
          : '#00F0FF');
      if (this.droneEyeMesh) (this.droneEyeMesh.material as THREE.MeshBasicMaterial).color.set(glowColor);
      if (this.droneRingMesh) (this.droneRingMesh.material as THREE.MeshBasicMaterial).color.set(glowColor);
    }

    this.updateTrailColors();
  }

  setUpright(upright: boolean) {
    this.isUpright = upright;
  }

  // --- Cyber Controls & Subway Surfers Actions ---

  switchLane(direction: -1 | 1, audioManager?: AudioManager | null) {
    const nextLane = (this.currentLane + direction) as LaneIndex;
    if (nextLane >= -1 && nextLane <= 1) {
      this.currentLane = nextLane;
      this.targetLaneX = getLaneX(this.currentLane);
      if (audioManager) audioManager.playCarveWhoosh();
    }
  }

  triggerSlide(audioManager?: AudioManager | null) {
    if (!this.isGrounded && this.jumpVelocity > -10) {
      this.jumpVelocity = -24.0; // Cyber fast-fall dive
    }
    this.isSliding = true;
    this.slideTimer = 0.65;
    this.emitJumpDust(this.position, 6);
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
    this.boostTimer = 1.4;
    this.stats.isBoosting = true;
    this.velocity.z = Math.min(this.velocity.z + 16.0, 52.0);
    this.overdriveMeter = Math.min(100, this.overdriveMeter + 35.0);
    if (audioManager) audioManager.playBoostGate();
    this.emitJumpDust(this.position, 10);
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
      this.activePowerUps.magnetTimer = 12.0;
    } else if (type === 'sonic-jetpack' || type === 'jetpack') {
      this.activePowerUps.jetpackTimer = 8.5;
      this.jumpVelocity = 15.0;
      this.isGrounded = false;
    } else if (type === 'overdrive-2x' || type === 'multiplier2x') {
      this.activePowerUps.multiplierTimer = 15.0;
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
    this.velocity.set(0, 0, 14);
    this.jumpVelocity = 0;
    this.isGrounded = true;
    this.isSliding = false;
    this.slideTimer = 0;
    this.boostTimer = 0;
    this.warpTimer = 0;
    this.isGrinding = false;
    this.overdriveMeter = 25.0;
    this.activePowerUps = { magnetTimer: 0, jetpackTimer: 0, hoverboardShield: false, multiplierTimer: 0 };
    if (this.shieldMesh) this.shieldMesh.visible = false;
    this.stats.score = 0;
    this.stats.distance = 0;
    this.stats.windOrbsCollected = 0;
    this.stats.dataShardsCollected = 0;
    this.stats.gameState = 'playing';
    this.stats.combo = 0;
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
    this.gameState = 'gameover';
    this.stats.gameState = 'gameover';
    this.velocity.set(0, 0, 0);
    this.jumpVelocity = 0;
    this.setGrinding(false);
  }

  revive() {
    this.gameState = 'playing';
    this.stats.gameState = 'playing';
    this.velocity.set(0, 0, 26);
    this.jumpVelocity = 0;
    this.isGrounded = true;
    this.isSliding = false;
    this.slideTimer = 0;
    this.activateHoverboardShield();
  }

  addCoins(amount: number) {
    this.stats.dataShardsCollected += amount;
    this.stats.windOrbsCollected += amount;
    this.stats.score += amount * 120 * this.scoreMultiplier;
    this.overdriveMeter = Math.min(100, this.overdriveMeter + amount * 3.5);
    this.stats.highScore = Math.max(this.stats.highScore, this.stats.score);
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
      spin: 'Cyber Corkscrew 360°',
      flip: 'Laser Invert Backflip',
      grab: 'Neon Rail Grab',
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
      if (this.grindSparkTimer > 0.08) {
        this.grindSparkTimer = 0;
        this.emitJumpDust(this.position, 3);
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

    // Snap X position strictly to target lane values with zero drift
    this.targetLaneX = getLaneX(this.currentLane);
    this.position.x = THREE.MathUtils.lerp(this.position.x, this.targetLaneX, 24.0 * effectiveDt);
    if (Math.abs(this.position.x - this.targetLaneX) < 0.02) {
      this.position.x = this.targetLaneX;
    }
    this.carveAngle = THREE.MathUtils.lerp(this.carveAngle, (this.targetLaneX - this.position.x) * 0.16, 20.0 * effectiveDt);

    // Warp timer countdown
    if (this.warpTimer > 0) {
      this.warpTimer -= effectiveDt;
      this.stats.warpTimer = this.warpTimer;
    }

    // Dynamic distance-based speed scaling: starting at ~14.0, ramping up smoothly as distance increases (Subway Surfers style)
    const distanceKm = this.stats.distance / 600;
    const distanceSpeedBonus = Math.min(32.0, distanceKm * 8.0);
    let targetSpeed = 14.0 + distanceSpeedBonus;

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
    const obstacleSurfaceH = obstacleManager && typeof obstacleManager.getObstacleSurfaceHeight === 'function'
      ? obstacleManager.getObstacleSurfaceHeight(this.position.x, this.position.z, this.position.y)
      : 0;

    const activeSurfaceH = Math.max(groundH, obstacleSurfaceH);
    const minY = activeSurfaceH + this.hoverHeight;
    const maxY = activeSurfaceH + 6.5; // Strict vertical ceiling clamp

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
      }
      this.jumpVelocity = 0;
      this.isGrounded = true;
      this.stats.airTime = 0;
      this.spinAngle = THREE.MathUtils.lerp(this.spinAngle, 0, 10 * effectiveDt);
      this.flipAngle = THREE.MathUtils.lerp(this.flipAngle, 0, 10 * effectiveDt);
      this.grabPoseWeight = THREE.MathUtils.lerp(this.grabPoseWeight, 0, 12 * effectiveDt);
    }

    // Rotations & Locked Relative Board Positioning
    const groundNormal = getTerrainNormal(this.position.x, this.position.z);
    this.targetNormal.copy(groundNormal);
    this.normal.lerp(this.targetNormal, 14 * effectiveDt);

    this.group.position.copy(this.position);

    // Drive Procedural 3D Skater & Board Animations
    const speedFactor = Math.min(1.8, Math.max(0.5, this.velocity.z / 25));
    animatePlayerCharacter(this.playerCharacter, time, speedFactor);

    // Unified lean angle so character feet and board lean together without clipping
    const unifiedCarveTilt = -this.carveAngle * 1.1;
    this.boardMesh.rotation.z = unifiedCarveTilt;
    this.boardMesh.rotation.x = this.pitchAngle + (this.activeTrick === 'flip' ? this.flipAngle : 0);
    this.boardMesh.rotation.y = this.spinAngle;

    // Underglow real-time breathing light
    if (this.underglowMesh) {
      const underglowPulse = sinPulse(time * 6.0) * 0.15 + 0.85;
      (this.underglowMesh.material as THREE.MeshBasicMaterial).opacity = underglowPulse;
    }

    // Cyber Crouch / Duck under barriers pose & stumble recoil
    if (this.stumbleTimer > 0) {
      this.stumbleTimer -= effectiveDt;
      this.stats.stumbleTimer = this.stumbleTimer;
    }
    const stumbleOffset = this.stumbleTimer > 0 ? Math.sin(this.stumbleTimer * 28.0) * 0.12 : 0;
    const visualHoverY = Math.sin(time * 3.5) * 0.06;
    const slideCrouchY = (this.isSliding ? -0.55 : (-this.grabPoseWeight * 0.25 + stumbleOffset)) + visualHoverY;
    const slidePitch = this.isSliding ? 0.65 : (this.flipAngle - this.grabPoseWeight * 0.5 + (this.stumbleTimer > 0 ? 0.18 : 0));

    this.characterMesh.rotation.z = unifiedCarveTilt;
    this.characterMesh.rotation.x = slidePitch;
    this.characterMesh.rotation.y = Math.PI / 2.2 + (this.isGrounded ? 0 : this.spinAngle);
    this.characterMesh.position.y = slideCrouchY;

    // Cyber Recon Drone Companion stable hover/bob beside player shoulder (No yaw-spin-away bug)
    this.cyberDroneTime += effectiveDt;
    const dtT = this.cyberDroneTime;
    this.cyberDroneMesh.position.set(
      1.25,
      1.75 + Math.sin(dtT * 3.0) * 0.12,
      -0.45 + Math.cos(dtT * 1.5) * 0.08
    );
    this.cyberDroneMesh.rotation.set(0, 0, 0); // Stays facing forward, stable observation angle!

    // Overdrive & Combo Tiers calculation
    let odTier: OverdriveTier = 'Dormant';
    if (this.overdriveMeter >= 99.0) odTier = 'Max-Velocity';
    else if (this.overdriveMeter >= 70.0) odTier = 'Overdrive';
    else if (this.overdriveMeter >= 25.0) odTier = 'Charged';

    let cTier: ComboTier = 'blue';
    if (this.stats.combo >= 5) cTier = 'white-hot';
    else if (this.stats.combo >= 3) cTier = 'magenta';
    else if (this.stats.combo === 2) cTier = 'cyan';

    this.stats.overdriveMeter = this.overdriveMeter;
    this.stats.overdriveTier = odTier;
    this.stats.comboTier = cTier;
    this.stats.styleMeter = this.overdriveMeter;
    this.stats.speed = Math.round(this.velocity.z * 3.6); // km/h
    this.stats.distance += Math.round(this.velocity.z * effectiveDt * 1.5);
    this.stats.score += Math.round(this.velocity.z * effectiveDt * 4.0 * this.scoreMultiplier);
    this.stats.highScore = Math.max(this.stats.highScore, this.stats.score);
    this.stats.currentLane = this.currentLane;
    this.stats.isSliding = this.isSliding;
    this.stats.slideTimer = this.slideTimer;
    this.stats.activePowerUps = { ...this.activePowerUps };
    this.stats.scoreMultiplier = this.scoreMultiplier;
    this.stats.gameState = this.gameState;

    this.updateTrailRibbon(effectiveDt);

    // Camera follow
    const camOffset = this.isUpright ? new THREE.Vector3(0, 3.2, -6.0) : new THREE.Vector3(0, 3.8, -7.5);
    this.cameraPos.copy(this.position).add(camOffset);
    this.cameraLookAt.copy(this.position).add(new THREE.Vector3(0, 1.4, 8.0));
  }

  private updateTrailRibbon(effectiveDt: number) {
    const boardWorld = new THREE.Vector3();
    this.boardMesh.getWorldPosition(boardWorld);

    const ribbonWidth = 0.6;
    const rightDir = new THREE.Vector3(1, 0, 0)
      .applyAxisAngle(new THREE.Vector3(0, 0, 1), -this.carveAngle)
      .multiplyScalar(ribbonWidth * 0.5);

    const ptLeft = boardWorld.clone().sub(rightDir).add(new THREE.Vector3(0, -0.05, -0.8));
    const ptRight = boardWorld.clone().add(rightDir).add(new THREE.Vector3(0, -0.05, -0.8));

    this.trailHistory.unshift({ left: ptLeft, right: ptRight });
    if (this.trailHistory.length > this.maxTrailPoints) {
      this.trailHistory.pop();
    }

    const posAttr = this.trailGeometry.attributes.position as THREE.BufferAttribute;
    const uvAttr = this.trailGeometry.attributes.uv as THREE.BufferAttribute;
    const progAttr = this.trailGeometry.attributes.aProgress as THREE.BufferAttribute;

    const count = this.trailHistory.length;
    for (let i = 0; i < this.maxTrailPoints; i++) {
      const idx = Math.min(i, count - 1);
      const pair = this.trailHistory[idx] || { left: boardWorld, right: boardWorld };
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

  private updateTrailColors() {
    const custom = this.currentCosmetics.trailId;

    if (custom === 'hot-magenta') {
      this.trailMaterial.uniforms.uColorA.value.set('#FF007F');
      this.trailMaterial.uniforms.uColorB.value.set('#7928CA');
    } else if (custom === 'acid-green') {
      this.trailMaterial.uniforms.uColorA.value.set('#00FF66');
      this.trailMaterial.uniforms.uColorB.value.set('#00F0FF');
    } else if (custom === 'plasma-rainbow') {
      this.trailMaterial.uniforms.uColorA.value.set('#FF00AA');
      this.trailMaterial.uniforms.uColorB.value.set('#00FFFF');
    } else {
      this.trailMaterial.uniforms.uColorA.value.set('#00F0FF'); // Electric Cyan
      this.trailMaterial.uniforms.uColorB.value.set('#FF007F');
    }
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

  checkOrbCollection(orbs: { id: string; x: number; y: number; z: number; collected: boolean; mesh?: THREE.Mesh }[]): number {
    let collectedCount = 0;
    for (const orb of orbs) {
      if (!orb.collected) {
        const dist = Math.hypot(this.position.x - orb.x, this.position.y - orb.y, this.position.z - orb.z);
        if (dist < 2.5) {
          orb.collected = true;
          if (orb.mesh) orb.mesh.visible = false;
          this.stats.dataShardsCollected += 1;
          this.stats.windOrbsCollected += 1;
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
    this.dustParticles.forEach(p => this.scene.remove(p.mesh));
    this.petalParticles.forEach(p => this.scene.remove(p.mesh));
    this.trailGeometry.dispose();
    this.trailMaterial.dispose();
    this.dustTexture.dispose();
    this.petalTexture.dispose();
  }
}

function sinPulse(x: number): number {
  return Math.sin(x) * 0.5 + 0.5;
}
