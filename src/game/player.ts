import * as THREE from 'three';
import { getBiomeAt, getBiomeFriction, getTerrainHeight, getTerrainNormal, TerrainManager } from './terrain';
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

  // Meshes
  characterMesh: THREE.Group;
  torsoMesh: THREE.Mesh;
  headMesh: THREE.Mesh;
  visorMesh: THREE.Mesh;
  capeMesh: THREE.Mesh;
  leftArmMesh: THREE.Group;
  rightArmMesh: THREE.Group;

  // Cyber Hoverboard & Real-Time Neon Underglow
  boardMesh: THREE.Group;
  boardDeckMesh: THREE.Mesh;
  boardFoilMesh: THREE.Mesh;
  underglowMesh: THREE.Mesh;
  underglowLight!: THREE.PointLight;

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
    speed: 24,
    maxSpeed: 52,
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
  velocity = new THREE.Vector3(0, 0, 24);
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

    // 1. Build Cyberpunk Stealth Hoverboard
    this.boardMesh = new THREE.Group();

    // Dark matte carbon-fiber deck
    const boardGeom = new THREE.CylinderGeometry(0.36, 0.44, 2.9, 12);
    boardGeom.rotateZ(Math.PI / 2);
    boardGeom.scale(1.0, 0.12, 1.0);
    const boardMat = new THREE.MeshStandardMaterial({
      color: 0x090e18,
      roughness: 0.22,
      metalness: 0.85,
    });
    this.boardDeckMesh = new THREE.Mesh(boardGeom, boardMat);
    this.boardMesh.add(this.boardDeckMesh);

    // Glowing Laser-Edge Perimeter Trim
    const foilGeom = new THREE.BoxGeometry(0.08, 0.22, 2.4);
    foilGeom.translate(0, -0.1, 0);
    const foilMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    this.boardFoilMesh = new THREE.Mesh(foilGeom, foilMat);
    this.boardMesh.add(this.boardFoilMesh);

    // Sharp Angular Hoverboard Nose
    const noseGeom = new THREE.ConeGeometry(0.36, 0.75, 6);
    noseGeom.rotateX(Math.PI / 2);
    noseGeom.scale(1.0, 0.14, 1.0);
    const nose = new THREE.Mesh(noseGeom, boardMat);
    nose.position.set(0, 0, 1.65);
    this.boardMesh.add(nose);

    // Real-Time Neon Underglow (Down-facing glowing disc casting light onto wet road)
    const underglowGeom = new THREE.PlaneGeometry(1.4, 3.2);
    underglowGeom.rotateX(-Math.PI / 2);
    const underglowMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
    });
    this.underglowMesh = new THREE.Mesh(underglowGeom, underglowMat);
    this.underglowMesh.position.set(0, -0.16, 0);
    this.boardMesh.add(this.underglowMesh);

    // Real-Time Underglow Point Light (Genuinely illuminates road and obstacles beneath the hoverboard)
    this.underglowLight = new THREE.PointLight(0x00f0ff, 2.0, 7.5, 1.8);
    this.underglowLight.position.set(0, -0.22, 0);
    this.boardMesh.add(this.underglowLight);

    this.group.add(this.boardMesh);

    // 2. Build Sleek Cybernetic Character Rig (Athletic Carving Stance)
    this.characterMesh = new THREE.Group();

    // Armored Torso with angled chest carapace
    const torsoGeom = new THREE.CapsuleGeometry(0.28, 0.55, 4, 8);
    const armorMat = new THREE.MeshStandardMaterial({
      color: 0x0c1220,
      roughness: 0.22,
      metalness: 0.85,
    });
    this.torsoMesh = new THREE.Mesh(torsoGeom, armorMat);
    this.torsoMesh.position.set(0, 0.82, 0);
    this.torsoMesh.castShadow = true;
    this.characterMesh.add(this.torsoMesh);

    // Glowing Chest Circuit Inlay
    const circuitMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    const chestPlate = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.22, 0.08), circuitMat);
    chestPlate.position.set(0, 0.92, 0.24);
    this.characterMesh.add(chestPlate);

    // Athletic Surfer Arms (Counterbalance Carve Stance)
    this.leftArmMesh = new THREE.Group();
    this.leftArmMesh.position.set(-0.32, 1.02, -0.05);
    const leftUpper = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.065, 0.42, 6), armorMat);
    leftUpper.position.set(-0.16, -0.14, -0.15);
    leftUpper.rotation.set(-0.55, 0, 0.45);
    this.leftArmMesh.add(leftUpper);
    const leftForearm = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.055, 0.38, 6), armorMat);
    leftForearm.position.set(-0.28, -0.26, -0.32);
    leftForearm.rotation.set(-0.65, 0, 0.3);
    this.leftArmMesh.add(leftForearm);
    const leftBracer = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.12, 6), circuitMat);
    leftBracer.position.set(-0.31, -0.3, -0.38);
    this.leftArmMesh.add(leftBracer);
    this.characterMesh.add(this.leftArmMesh);

    this.rightArmMesh = new THREE.Group();
    this.rightArmMesh.position.set(0.32, 1.02, 0.05);
    const rightUpper = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.065, 0.42, 6), armorMat);
    rightUpper.position.set(0.16, -0.14, 0.15);
    rightUpper.rotation.set(0.55, 0, -0.45);
    this.rightArmMesh.add(rightUpper);
    const rightForearm = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.055, 0.38, 6), armorMat);
    rightForearm.position.set(0.28, -0.26, 0.32);
    rightForearm.rotation.set(0.5, 0, -0.3);
    this.rightArmMesh.add(rightForearm);
    const rightBracer = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.12, 6), circuitMat);
    rightBracer.position.set(0.31, -0.3, 0.38);
    this.rightArmMesh.add(rightBracer);
    this.characterMesh.add(this.rightArmMesh);

    // Deep Carving Surf Stance Legs (Bent knees, angled feet)
    const leftLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.075, 0.62, 6), armorMat);
    leftLeg.position.set(-0.18, 0.32, -0.22);
    leftLeg.rotation.set(-0.25, 0, 0.18);
    this.characterMesh.add(leftLeg);

    const rightLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.075, 0.62, 6), armorMat);
    rightLeg.position.set(0.16, 0.32, 0.22);
    rightLeg.rotation.set(0.28, 0, -0.18);
    this.characterMesh.add(rightLeg);

    // Aerodynamic Cyber Helmet
    const helmGeom = new THREE.SphereGeometry(0.24, 12, 12);
    this.headMesh = new THREE.Mesh(helmGeom, armorMat);
    this.headMesh.position.set(0, 1.35, 0.04);
    this.characterMesh.add(this.headMesh);

    // Thin Glowing Laser Visor Line
    const visorGeom = new THREE.BoxGeometry(0.38, 0.045, 0.22);
    const visorMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    this.visorMesh = new THREE.Mesh(visorGeom, visorMat);
    this.visorMesh.position.set(0, 1.38, 0.18);
    this.characterMesh.add(this.visorMesh);

    // Short Glowing Energy-Trail Cape / Scarf
    const capeGeom = new THREE.PlaneGeometry(0.42, 0.95, 2, 4);
    capeGeom.translate(0, -0.48, 0);
    const capeMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.88,
    });
    this.capeMesh = new THREE.Mesh(capeGeom, capeMat);
    this.capeMesh.position.set(0, 1.15, -0.22);
    this.characterMesh.add(this.capeMesh);

    this.group.add(this.characterMesh);

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

    // Armor Variant
    if (this.torsoMesh && this.headMesh) {
      const armorColor =
        config.armorVariant === 'titanium-white'
          ? '#d4d8e8'
          : config.armorVariant === 'onyx-stealth'
          ? '#05070c'
          : config.armorVariant === 'crimson-cyborg'
          ? '#2a0a14'
          : '#0c1220';
      (this.torsoMesh.material as THREE.MeshStandardMaterial).color.set(armorColor);
      (this.headMesh.material as THREE.MeshStandardMaterial).color.set(armorColor);
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

  resetRun() {
    const h = getTerrainHeight(0, 0);
    this.currentLane = 0;
    this.targetLaneX = 0;
    this.position.set(0, h + this.hoverHeight, 0);
    this.velocity.set(0, 0, 24);
    this.jumpVelocity = 0;
    this.isGrounded = true;
    this.isSliding = false;
    this.slideTimer = 0;
    this.boostTimer = 0;
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
    audioManager?: AudioManager | null
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

    // Lane switching & Slide Controls (Strict 3-lane snapping, zero continuous drift)
    if (input.laneLeft || input.left) {
      this.switchLane(-1, audioManager);
    } else if (input.laneRight || input.right) {
      this.switchLane(1, audioManager);
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

    // Step 1: Fix Lane System - Snap X position strictly to target lane values with zero drift
    this.targetLaneX = getLaneX(this.currentLane);
    this.position.x = THREE.MathUtils.lerp(this.position.x, this.targetLaneX, 24.0 * effectiveDt);
    if (Math.abs(this.position.x - this.targetLaneX) < 0.02) {
      this.position.x = this.targetLaneX;
    }
    this.carveAngle = THREE.MathUtils.lerp(this.carveAngle, (this.targetLaneX - this.position.x) * 0.16, 20.0 * effectiveDt);

    // Target Velocity calculation
    let targetSpeed = 26.0;
    if (input.forward) targetSpeed = 38.0;
    if (this.stats.isBoosting) targetSpeed = 48.0;
    if (this.isGrinding) targetSpeed = 36.0;

    const overdriveBonus = (this.overdriveMeter / 100) * 8.0;
    targetSpeed += overdriveBonus;

    this.velocity.z = THREE.MathUtils.lerp(this.velocity.z, targetSpeed, 4.0 * effectiveDt);

    // Step 4: Anti-Gravity Physics (Minimal change: clamp vertical position within bounds)
    if (input.jump && this.isGrounded) {
      this.jumpVelocity = 15.5;
      this.isGrounded = false;
      this.stats.airTime = 0.01;
      this.emitJumpDust(this.position, 6);
    }

    const groundH = getTerrainHeight(this.position.x, this.position.z);
    const minY = groundH + this.hoverHeight;
    const maxY = groundH + 6.5; // Strict vertical ceiling clamp

    const gravityRate = this.stats.slowMoActive ? 22.0 : 30.0;
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
    } else {
      this.position.y = minY;
      this.spinAngle = THREE.MathUtils.lerp(this.spinAngle, 0, 10 * effectiveDt);
      this.flipAngle = THREE.MathUtils.lerp(this.flipAngle, 0, 10 * effectiveDt);
      this.grabPoseWeight = THREE.MathUtils.lerp(this.grabPoseWeight, 0, 12 * effectiveDt);
    }

    // Forward translation
    this.position.z += this.velocity.z * effectiveDt;

    // Ground snap clamp check
    if (this.position.y < minY) {
      this.position.y = minY;
      if (!this.isGrounded && this.jumpVelocity < -2.0) {
        if (audioManager) audioManager.playLanding();
        this.emitJumpDust(this.position, 5);
      }
      this.jumpVelocity = 0;
      this.isGrounded = true;
      this.stats.airTime = 0;
    }

    // Rotations & Locked Relative Board Positioning
    const groundNormal = getTerrainNormal(this.position.x, this.position.z);
    this.targetNormal.copy(groundNormal);
    this.normal.lerp(this.targetNormal, 14 * effectiveDt);

    this.group.position.copy(this.position);

    // Step 6: Visual Hover Effect (Visual only, does not affect physics or collision)
    const visualHoverY = Math.sin(time * 3.5) * 0.06;

    this.boardMesh.position.set(0, visualHoverY, 0);
    this.boardMesh.rotation.z = -this.carveAngle * 1.5;
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
    const slideCrouchY = (this.isSliding ? -0.55 : (-this.grabPoseWeight * 0.25 + stumbleOffset)) + visualHoverY;
    const slidePitch = this.isSliding ? 0.65 : (this.flipAngle - this.grabPoseWeight * 0.5 + (this.stumbleTimer > 0 ? 0.18 : 0));

    this.characterMesh.rotation.z = -this.carveAngle * 0.9;
    this.characterMesh.rotation.x = slidePitch;
    this.characterMesh.rotation.y = -this.carveAngle * 0.4 + (this.isGrounded ? 0.35 : this.spinAngle);
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
