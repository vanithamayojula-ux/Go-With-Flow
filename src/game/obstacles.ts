import * as THREE from 'three';
import { BiomeType, LaneIndex, PowerUpType } from '../types';

export function getLaneX(lane: LaneIndex): number {
  if (lane === -1) return -2.0; // Left lane
  if (lane === 1) return 2.0;  // Right lane
  return 0.0;                 // Center lane
}

export type ObstacleCategory = 'wave' | 'laser-gate' | 'split-path' | 'boost-gate' | 'grind-rail';

export interface ObstacleItem {
  id: string;
  type: string;
  category: ObstacleCategory;
  lane: LaneIndex;
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  depth: number;
  mesh: THREE.Object3D;
  cleared?: boolean;
  canDuck?: boolean;
  canJump?: boolean;
  isGrindRail?: boolean;
  isBoostGate?: boolean;
  isPortal?: boolean;
  targetBiome?: BiomeType;
  nearMissed?: boolean;

  // Wave obstacle dynamic properties
  isWave?: boolean;
  waveBaseLane?: number;
  waveAmplitude?: number; // In lane units or meters
  waveFrequency?: number;
  wavePhase?: number;

  // Laser Gate dynamic properties
  isLaserGate?: boolean;
  gatePattern?: 'slow-blink' | 'fast-blink' | 'alternating';
  gatePeriod?: number;
  gatePhase?: number;
  gateActive?: boolean;
  warningDuration?: number;
  beamMesh?: THREE.Mesh;
  warningMesh?: THREE.Mesh;
  emitterPillars?: THREE.Mesh[];

  // Split Path properties
  isSplitPath?: boolean;
  splitRoute?: 'safe' | 'risky';
  splitLength?: number;
  riskRewardIndicator?: THREE.Group;
}

export interface CoinItem {
  id: string;
  x: number;
  y: number;
  z: number;
  mesh: THREE.Mesh;
  collected: boolean;
}

export interface PowerUpItem {
  id: string;
  type: PowerUpType;
  x: number;
  y: number;
  z: number;
  mesh: THREE.Group;
  collected: boolean;
}

export interface CollisionResult {
  hitPortal?: { targetBiome: BiomeType };
  hitBoostGate?: boolean;
  nearMiss?: boolean;
  nearMissPos?: THREE.Vector3;
  isGrinding?: boolean;
  collectedCoins: number;
  collectedPowerUp?: PowerUpType;
  hasCrashed?: boolean;
  hasStumbled?: boolean;
  crashedObstacle?: ObstacleItem;
}

export class ObstacleManager {
  scene: THREE.Scene;
  group: THREE.Group;

  obstacles: ObstacleItem[] = [];
  coins: CoinItem[] = [];
  powerUps: PowerUpItem[] = [];

  private lastSpawnZ = 30;
  private spawnInterval = 34;

  // Rhythmic Pattern System state (Structured musical cadence)
  private patternSequenceIndex = 0;
  // Sequence grammar: rhythm-slalom -> wave -> laser-alternating -> jump-duck-tempo -> gap-recovery -> split-choice -> wave-dual
  private readonly patternSequences = [
    'rhythm-slalom',
    'wave-intro',
    'laser-alternating',
    'jump-duck-tempo',
    'gap-recovery',
    'split-intro',
    'wave-dual',
    'rhythm-slalom',
    'laser-fast',
  ];

  // Strict Color System:
  // Player = Cyan
  // Obstacles & Hazards = Secondary Magenta / Pink (#e00070 / #ff0055)
  // Warnings = Vivid Amber (#ffaa00)
  // Rewards/Safe = Neon Cyan / Gold
  private barrierMat = new THREE.MeshStandardMaterial({
    color: 0x0a0f1d,
    metalness: 0.9,
    roughness: 0.2,
  });
  private laserHazardMat = new THREE.MeshBasicMaterial({ color: 0xe00050 }); // Active Magenta Hazard
  private warningAmberMat = new THREE.MeshBasicMaterial({
    color: 0xffaa00,
    transparent: true,
    opacity: 0.45,
  });
  private cyanNeonMat = new THREE.MeshBasicMaterial({ color: 0x00d2e0 }); // Player / Reward / Boost
  private goldMat = new THREE.MeshBasicMaterial({ color: 0xffd700 }); // Collectible Shards
  private safeHoloMat = new THREE.MeshBasicMaterial({
    color: 0x00d2e0,
    transparent: true,
    opacity: 0.35,
    wireframe: true,
  });
  private riskyHoloMat = new THREE.MeshBasicMaterial({
    color: 0xe00050,
    transparent: true,
    opacity: 0.4,
    wireframe: true,
  });

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.scene.add(this.group);

    this.spawnInitialObstacles();
  }

  private spawnInitialObstacles(): void {
    for (let z = 50; z < 450; z += this.spawnInterval) {
      this.spawnNextPatternAtZ(z);
      this.lastSpawnZ = z;
    }
  }

  /**
   * Pattern Sequencer:
   * Chooses structured pattern sequences rather than uncontrolled randomness.
   * Ensures high readability (0.5 - 1.0s preview) and rhythm.
   */
  private spawnNextPatternAtZ(z: number, playerSpeed = 22): void {
    const patternType = this.patternSequences[this.patternSequenceIndex % this.patternSequences.length];
    this.patternSequenceIndex++;

    // Calculate normalized difficulty (0.0 to 1.0) based on distance z
    const difficulty = Math.min(1.0, z / 2000.0);

    switch (patternType) {
      case 'rhythm-slalom':
        this.spawnRhythmSlalom(z, difficulty);
        break;
      case 'wave-intro':
        this.spawnWaveObstacle(z, difficulty, false);
        break;
      case 'laser-alternating':
        this.spawnLaserGate(z, 'alternating', difficulty);
        break;
      case 'jump-duck-tempo':
        this.spawnJumpDuckTempo(z, difficulty);
        break;
      case 'gap-recovery':
        this.spawnRecoveryGap(z);
        break;
      case 'split-intro':
        this.spawnSplitPath(z, difficulty, false);
        break;
      case 'wave-dual':
        this.spawnWaveObstacle(z, difficulty, true);
        break;
      case 'laser-fast':
        this.spawnLaserGate(z, 'fast-blink', difficulty);
        break;
      default:
        this.spawnRhythmSlalom(z, difficulty);
    }
  }

  // =========================================================================
  // 0. RHYTHM SLALOM PATTERN (Structured 3-Beat Lane Weave)
  // - Left -> Right -> Center rhythmic cadence with guide shards
  // =========================================================================
  private spawnRhythmSlalom(z: number, difficulty: number): void {
    // Beat 1: Left lane block (Lane -1), guide shard on Lane 0
    this.createLowHurdle(-1, z);
    this.spawnCoin(getLaneX(0), 0.9, z + 2);

    // Beat 2: Right lane block (Lane 1), guide shard on Lane -1
    this.createLowHurdle(1, z + 14);
    this.spawnCoin(getLaneX(-1), 0.9, z + 16);

    // Beat 3: Center lane block (Lane 0), guide shard on Lane 1
    this.createLowHurdle(0, z + 28);
    this.spawnCoin(getLaneX(1), 0.9, z + 30);

    // Resolve Beat: Boost gate on target lane to reward perfect flow!
    this.createBoostArch(1, z + 40);
  }

  // =========================================================================
  // JUMP & DUCK TEMPO PATTERN (Action Cadence)
  // - Jump -> Duck -> Grind flow sequence
  // =========================================================================
  private spawnJumpDuckTempo(z: number, difficulty: number): void {
    // Beat 1: Jump over low hurdle on Lane -1
    this.createLowHurdle(-1, z);
    this.spawnCoin(getLaneX(-1), 1.8, z); // High coin rewarding jump

    // Beat 2: Overhead neon barrier on Lane 0 (Slide duck under!)
    this.createHighLaserBarrier(0, z + 15);
    this.spawnCoin(getLaneX(0), 0.45, z + 15); // Low coin rewarding slide

    // Beat 3: Elevated grind rail on Lane 1
    this.createGrindRail(1, z + 30, 20);
    this.spawnCoin(getLaneX(1), 2.2, z + 30);
  }

  private createHighLaserBarrier(lane: LaneIndex, z: number): void {
    const x = getLaneX(lane);
    const barrierGroup = new THREE.Group();
    barrierGroup.position.set(x, 0, z);

    // Tall support posts
    const postGeom = new THREE.BoxGeometry(0.2, 3.2, 0.2);
    const leftPost = new THREE.Mesh(postGeom, this.barrierMat);
    leftPost.position.set(-1.1, 1.6, 0);
    const rightPost = new THREE.Mesh(postGeom, this.barrierMat);
    rightPost.position.set(1.1, 1.6, 0);
    barrierGroup.add(leftPost, rightPost);

    // High horizontal laser beam requiring crouch/slide
    const beamGeom = new THREE.BoxGeometry(2.1, 0.4, 0.2);
    const beamMesh = new THREE.Mesh(beamGeom, this.laserHazardMat);
    beamMesh.position.set(0, 1.8, 0); // High position - slide clears!
    barrierGroup.add(beamMesh);

    this.group.add(barrierGroup);

    this.obstacles.push({
      id: `high-barrier-${z}-${lane}`,
      type: 'high-barrier',
      category: 'laser-gate',
      lane,
      x,
      y: 1.8,
      z,
      width: 2.1,
      height: 1.4,
      depth: 0.6,
      mesh: barrierGroup,
      canDuck: true,
      canJump: false,
    });
  }

  // =========================================================================
  // 1. WAVE OBSTACLES (Primary System)
  // - Moves smoothly in predictable sine-wave across lanes
  // - Player moves in sync with wave rhythm
  // - Never blocks all lanes simultaneously; rhythmically readable
  // =========================================================================
  private spawnWaveObstacle(z: number, difficulty: number, isDual = false, tempoMultiplier = 1.0): void {
    const waveGroup = new THREE.Group();

    // Magenta Drone / Energy Orb with hover thruster
    const coreGeom = new THREE.SphereGeometry(0.75, 16, 16);
    const coreMesh = new THREE.Mesh(coreGeom, this.laserHazardMat);
    waveGroup.add(coreMesh);

    // Hazard ring indicator
    const ringGeom = new THREE.TorusGeometry(1.05, 0.08, 8, 20);
    const ringMesh = new THREE.Mesh(ringGeom, this.laserHazardMat);
    ringMesh.rotation.x = Math.PI / 2;
    waveGroup.add(ringMesh);

    // Downward laser scanner cone showing lane footprint on pavement
    const scanGeom = new THREE.ConeGeometry(0.9, 1.4, 8, 1, true);
    scanGeom.rotateX(Math.PI);
    const scanMat = new THREE.MeshBasicMaterial({
      color: 0xe00050,
      transparent: true,
      opacity: 0.25,
      side: THREE.DoubleSide,
    });
    const scanMesh = new THREE.Mesh(scanGeom, scanMat);
    scanMesh.position.set(0, -0.7, 0);
    waveGroup.add(scanMesh);

    const baseLane = isDual ? -0.8 : 0.0;
    const waveAmp = isDual ? 1.6 : 2.4; // Max sweep: spans from -2.4 to +2.4
    const waveFreq = (1.2 + difficulty * 0.8) * tempoMultiplier;
    const wavePhase = (z * 0.05) % (Math.PI * 2);

    waveGroup.position.set(baseLane, 1.4, z);
    this.group.add(waveGroup);

    this.obstacles.push({
      id: `wave-${z}-1`,
      type: 'wave-drone',
      category: 'wave',
      lane: 0,
      x: baseLane,
      y: 1.4,
      z,
      width: 1.8,
      height: 1.8,
      depth: 1.2,
      mesh: waveGroup,
      isWave: true,
      waveBaseLane: baseLane,
      waveAmplitude: waveAmp,
      waveFrequency: waveFreq,
      wavePhase,
    });

    // Dual offset wave creates alternating weave pattern (lane 1 open, then lane -1 open)
    if (isDual) {
      const waveGroup2 = new THREE.Group();
      const core2 = new THREE.Mesh(coreGeom, this.laserHazardMat);
      waveGroup2.add(core2);
      const ring2 = new THREE.Mesh(ringGeom, this.laserHazardMat);
      ring2.rotation.x = Math.PI / 2;
      waveGroup2.add(ring2);

      const baseLane2 = 0.8;
      const wavePhase2 = wavePhase + Math.PI; // Inverted phase guarantees passable corridor
      waveGroup2.position.set(baseLane2, 1.4, z + 8);
      this.group.add(waveGroup2);

      this.obstacles.push({
        id: `wave-${z}-2`,
        type: 'wave-drone',
        category: 'wave',
        lane: 0,
        x: baseLane2,
        y: 1.4,
        z: z + 8,
        width: 1.8,
        height: 1.8,
        depth: 1.2,
        mesh: waveGroup2,
        isWave: true,
        waveBaseLane: baseLane2,
        waveAmplitude: waveAmp,
        waveFrequency: waveFreq,
        wavePhase: wavePhase2,
      });
    }

    // Guide coins showing the rhythmic flow line through the wave
    for (let i = 0; i < 4; i++) {
      const cz = z + 12 + i * 4;
      const progress = (i / 4) * Math.PI * 2;
      const coinLaneX = Math.sin(progress) * 2.2;
      this.spawnCoin(coinLaneX, 0.9, cz);
    }
  }

  // =========================================================================
  // 2. LASER GATES (Timing System)
  // - Laser barriers cycle ON/OFF in readable patterns
  // - Advance visual warning (amber pulse) before beam activates
  // - Consistent timing: slow blink, fast blink, alternating lanes
  // =========================================================================
  private spawnLaserGate(z: number, pattern: 'slow-blink' | 'fast-blink' | 'alternating', difficulty: number): void {
    const lanes: LaneIndex[] = [-1, 0, 1];

    if (pattern === 'alternating') {
      // Lane -1 and Lane 1 alternate with Center Lane 0
      this.createSingleLaserGate(lanes[0], z, pattern, 0.0, difficulty);
      this.createSingleLaserGate(lanes[2], z, pattern, 0.0, difficulty);
      this.createSingleLaserGate(lanes[1], z, pattern, Math.PI, difficulty);
    } else {
      // Pick 2 lanes to have blinking laser gates, leaving 1 always safe escape route
      const safeLane = lanes[Math.floor(Math.random() * lanes.length)];
      for (const lane of lanes) {
        if (lane !== safeLane) {
          this.createSingleLaserGate(lane, z, pattern, 0.0, difficulty);
        }
      }
    }

    // Place reward coin on the timing opening
    const safeLaneX = 0;
    this.spawnCoin(safeLaneX, 0.9, z + 6);
  }

  private createSingleLaserGate(
    lane: LaneIndex,
    z: number,
    pattern: 'slow-blink' | 'fast-blink' | 'alternating',
    phaseOffset: number,
    difficulty: number
  ): void {
    const x = getLaneX(lane);
    const gateGroup = new THREE.Group();
    gateGroup.position.set(x, 0, z);

    // Emitter pillars (Left & Right posts)
    const pillarGeom = new THREE.BoxGeometry(0.24, 2.8, 0.35);
    const leftPillar = new THREE.Mesh(pillarGeom, this.barrierMat);
    leftPillar.position.set(-1.1, 1.4, 0);
    const rightPillar = new THREE.Mesh(pillarGeom, this.barrierMat);
    rightPillar.position.set(1.1, 1.4, 0);
    gateGroup.add(leftPillar, rightPillar);

    // Active Laser Beam Mesh (Secondary Magenta)
    const beamGeom = new THREE.BoxGeometry(2.1, 0.22, 0.18);
    const beamMesh = new THREE.Mesh(beamGeom, this.laserHazardMat);
    beamMesh.position.set(0, 1.4, 0);
    gateGroup.add(beamMesh);

    // Amber Pre-fire Warning Filament (Visible when charging)
    const warnGeom = new THREE.BoxGeometry(2.1, 0.06, 0.06);
    const warningMesh = new THREE.Mesh(warnGeom, this.warningAmberMat);
    warningMesh.position.set(0, 1.4, 0);
    warningMesh.visible = false;
    gateGroup.add(warningMesh);

    this.group.add(gateGroup);

    // Period scaling based on difficulty & pattern:
    // slow-blink: 2.2s period (1.1s ON, 1.1s OFF)
    // fast-blink: 1.4s period (0.7s ON, 0.7s OFF)
    // alternating: 1.8s period
    const basePeriod = pattern === 'slow-blink' ? 2.4 - difficulty * 0.4 : pattern === 'fast-blink' ? 1.4 : 1.8;

    this.obstacles.push({
      id: `laser-${z}-${lane}`,
      type: 'laser-gate',
      category: 'laser-gate',
      lane,
      x,
      y: 1.4,
      z,
      width: 2.2,
      height: 2.2,
      depth: 0.6,
      mesh: gateGroup,
      isLaserGate: true,
      gatePattern: pattern,
      gatePeriod: basePeriod,
      gatePhase: phaseOffset,
      gateActive: true,
      warningDuration: 0.45,
      beamMesh,
      warningMesh,
      emitterPillars: [leftPillar, rightPillar],
      canDuck: false,
      canJump: false,
    });
  }

  // =========================================================================
  // 3. SPLIT PATH (Decision System)
  // - Road branches into Safe Route (clear, low reward) vs Risky Route (hazards, dense shards)
  // - Clear visual cues: Cyan/Safe signage vs Magenta/Hazard signage
  // - Seamless merge back after split length (36m)
  // =========================================================================
  private spawnSplitPath(z: number, difficulty: number, isDense = false): void {
    const splitLength = 36;
    const safeLane: LaneIndex = -1;
    const riskyLane: LaneIndex = 1;

    // Decision Arch at entry to split (Z = z)
    const archGroup = new THREE.Group();
    archGroup.position.set(0, 0, z);

    // Safe route holographic archway (Left Lane -1)
    const safeSignGeom = new THREE.RingGeometry(0.8, 1.0, 16);
    const safeSign = new THREE.Mesh(safeSignGeom, this.safeHoloMat);
    safeSign.position.set(getLaneX(safeLane), 2.2, 0);
    archGroup.add(safeSign);

    // Risky route holographic hazard archway (Right Lane 1)
    const riskSignGeom = new THREE.RingGeometry(0.8, 1.0, 16);
    const riskSign = new THREE.Mesh(riskSignGeom, this.riskyHoloMat);
    riskSign.position.set(getLaneX(riskyLane), 2.2, 0);
    archGroup.add(riskSign);

    // Center divider pylon splitting lanes
    const dividerPylon = new THREE.Mesh(new THREE.BoxGeometry(0.4, 3.0, splitLength), this.barrierMat);
    dividerPylon.position.set(0, 1.5, splitLength / 2);
    archGroup.add(dividerPylon);

    this.group.add(archGroup);

    // Populate SAFE ROUTE:
    // Single occasional jumpable low hurdle or clear path, modest single coin line
    const safeX = getLaneX(safeLane);
    this.spawnCoin(safeX, 0.9, z + 10);
    this.spawnCoin(safeX, 0.9, z + 22);

    // Low obstacle on safe route only at higher difficulties
    if (difficulty > 0.4) {
      this.createLowHurdle(safeLane, z + 16);
    }

    // Populate RISKY ROUTE:
    // Dense data shard clusters (high reward: 6-8 coins + powerup), but guarded by laser gates
    const riskyX = getLaneX(riskyLane);
    for (let c = 0; c < (isDense ? 8 : 5); c++) {
      this.spawnCoin(riskyX, 0.9, z + 6 + c * 3.5);
    }

    // Hazard on risky route: Precision timing laser gate or hurdle
    this.createSingleLaserGate(riskyLane, z + 14, 'fast-blink', 0, difficulty);
    if (isDense) {
      this.createLowHurdle(riskyLane, z + 26);
    }

    // High Value PowerUp at end of risky route
    this.spawnPowerUp(riskyX, z + 30);
  }

  // =========================================================================
  // Recovery Gap & Flow Restorers
  // =========================================================================
  private spawnRecoveryGap(z: number): void {
    // A clean rhythm gap with a grind rail or boost gate that rewards flow
    const rand = Math.random();
    if (rand < 0.5) {
      // Grind rail down center lane
      this.createGrindRail(0, z, 26);
      for (let i = 0; i < 4; i++) {
        this.spawnCoin(0, 1.6, z + 4 + i * 5);
      }
    } else {
      // Boost archway giving speed surge
      this.createBoostArch(0, z);
      this.spawnCoin(0, 0.9, z + 8);
      this.spawnCoin(0, 0.9, z + 14);
    }
  }

  private createLowHurdle(lane: LaneIndex, z: number): void {
    const x = getLaneX(lane);
    const hurdleGroup = new THREE.Group();
    hurdleGroup.position.set(x, 0.45, z);

    const beam = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.22, 0.3), this.laserHazardMat);
    hurdleGroup.add(beam);

    this.group.add(hurdleGroup);
    this.obstacles.push({
      id: `hurdle-${z}-${lane}`,
      type: 'low-hurdle',
      category: 'wave',
      lane,
      x,
      y: 0.45,
      z,
      width: 2.1,
      height: 0.9,
      depth: 0.8,
      mesh: hurdleGroup,
      canJump: true,
    });
  }

  private createGrindRail(lane: LaneIndex, z: number, length: number): void {
    const x = getLaneX(lane);
    const railGroup = new THREE.Group();
    railGroup.position.set(x, 1.2, z);

    const railGeom = new THREE.CylinderGeometry(0.12, 0.12, length, 8);
    railGeom.rotateX(Math.PI / 2);
    const railMesh = new THREE.Mesh(railGeom, this.cyanNeonMat);
    railGroup.add(railMesh);

    // Support posts
    for (let p = -length / 2; p <= length / 2; p += 8) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.2, 0.15), this.barrierMat);
      post.position.set(0, -0.6, p);
      railGroup.add(post);
    }

    this.group.add(railGroup);
    this.obstacles.push({
      id: `rail-${z}`,
      type: 'grind-rail',
      category: 'grind-rail',
      lane,
      x,
      y: 1.2,
      z,
      width: 1.2,
      height: 1.2,
      depth: length,
      mesh: railGroup,
      isGrindRail: true,
    });
  }

  private createBoostArch(lane: LaneIndex, z: number): void {
    const x = getLaneX(lane);
    const archGroup = new THREE.Group();
    archGroup.position.set(x, 1.8, z);

    const ringGeom = new THREE.TorusGeometry(1.6, 0.12, 8, 24);
    const ringMesh = new THREE.Mesh(ringGeom, this.cyanNeonMat);
    archGroup.add(ringMesh);

    this.group.add(archGroup);
    this.obstacles.push({
      id: `boost-${z}`,
      type: 'boost-gate',
      category: 'boost-gate',
      lane,
      x,
      y: 1.8,
      z,
      width: 3.2,
      height: 3.2,
      depth: 1.5,
      mesh: archGroup,
      isBoostGate: true,
    });
  }

  private spawnCoin(x: number, y: number, z: number): void {
    const coinMesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.24), this.goldMat);
    coinMesh.position.set(x, y, z);
    this.group.add(coinMesh);
    this.coins.push({
      id: `coin-${z}-${x}`,
      x,
      y,
      z,
      mesh: coinMesh,
      collected: false,
    });
  }

  private spawnPowerUp(x: number, z: number): void {
    const pTypes: PowerUpType[] = ['quantum-magnet', 'sonic-jetpack', 'holo-shield', 'overdrive-2x'];
    const pType = pTypes[Math.floor(Math.random() * pTypes.length)];
    const pGroup = new THREE.Group();
    pGroup.position.set(x, 1.2, z);
    const pCore = new THREE.Mesh(new THREE.DodecahedronGeometry(0.35), this.cyanNeonMat);
    pGroup.add(pCore);
    const pGlow = new THREE.PointLight(0x00d2e0, 1.5, 4.0);
    pGroup.add(pGlow);
    this.group.add(pGroup);

    this.powerUps.push({
      id: `pu-${z}`,
      type: pType,
      x,
      y: 1.2,
      z,
      mesh: pGroup,
      collected: false,
    });
  }

  // =========================================================================
  // UPDATE LOOP: Real-time Behavior, Wave Trajectories & Laser Timing
  // =========================================================================
  update(playerZ: number, timeSeconds: number, playerSpeed = 20): void {
    // 1. Animate Wave Obstacles (Smooth Sine-Wave Movement)
    for (const obs of this.obstacles) {
      if (obs.isWave && !obs.cleared) {
        const freq = obs.waveFrequency ?? 1.2;
        const amp = obs.waveAmplitude ?? 2.4;
        const phase = obs.wavePhase ?? 0;
        const base = obs.waveBaseLane ?? 0;

        // X = base + amp * sin(time * freq + phase)
        const targetX = base + Math.sin(timeSeconds * freq + phase) * amp;
        obs.x = targetX;
        obs.mesh.position.x = targetX;

        // Subtle banking roll into the curve
        const bankAngle = -Math.cos(timeSeconds * freq + phase) * 0.25;
        obs.mesh.rotation.z = bankAngle;
      }

      // 2. Animate Laser Gates (Timing Cycle & Pre-fire Warning)
      if (obs.isLaserGate && !obs.cleared) {
        const period = obs.gatePeriod ?? 2.0;
        const phase = obs.gatePhase ?? 0;
        const cycleProgress = ((timeSeconds + phase) % period) / period; // 0.0 to 1.0

        // Timing definition:
        // 0.0 to 0.45: Laser ACTIVE (Hazard)
        // 0.45 to 0.80: Laser OFF (Safe to pass)
        // 0.80 to 1.00: Warning Charging (Amber blinking filament warning player)
        if (cycleProgress < 0.45) {
          // ACTIVE BEAM
          obs.gateActive = true;
          if (obs.beamMesh) obs.beamMesh.visible = true;
          if (obs.warningMesh) obs.warningMesh.visible = false;
        } else if (cycleProgress < 0.80) {
          // INACTIVE / OPEN WINDOW
          obs.gateActive = false;
          if (obs.beamMesh) obs.beamMesh.visible = false;
          if (obs.warningMesh) obs.warningMesh.visible = false;
        } else {
          // CHARGE WARNING
          obs.gateActive = false;
          if (obs.beamMesh) obs.beamMesh.visible = false;
          if (obs.warningMesh) {
            obs.warningMesh.visible = true;
            // Rapid strobe as activation nears
            const warnPulse = Math.sin(timeSeconds * 24.0) > 0;
            obs.warningMesh.visible = warnPulse;
          }
        }
      }
    }

    // 3. Animate coins & powerups rotation
    for (const c of this.coins) {
      if (!c.collected) {
        c.mesh.rotation.y = timeSeconds * 4.0;
      }
    }
    for (const p of this.powerUps) {
      if (!p.collected) {
        p.mesh.rotation.y = timeSeconds * 3.0;
        p.mesh.position.y = 1.2 + Math.sin(timeSeconds * 4.0) * 0.15;
      }
    }

    // 4. Progressive Spawn Ahead (Dynamic speed synchronization = ~0.9-1.1s reaction window)
    const reactionTimeSec = 1.0;
    const dynamicSpacing = THREE.MathUtils.clamp((playerSpeed / 3.6) * reactionTimeSec * 2.2, 32, 58);

    while (this.lastSpawnZ < playerZ + 420) {
      this.lastSpawnZ += dynamicSpacing;
      this.spawnNextPatternAtZ(this.lastSpawnZ, playerSpeed);
    }

    // 5. Cull behind player
    const cullZ = playerZ - 60;
    this.obstacles = this.obstacles.filter(obs => {
      if (obs.z < cullZ) {
        this.group.remove(obs.mesh);
        return false;
      }
      return true;
    });

    this.coins = this.coins.filter(c => {
      if (c.z < cullZ || c.collected) {
        this.group.remove(c.mesh);
        return false;
      }
      return true;
    });

    this.powerUps = this.powerUps.filter(p => {
      if (p.z < cullZ || p.collected) {
        this.group.remove(p.mesh);
        return false;
      }
      return true;
    });
  }

  attractCoinsToPlayer(playerPos: THREE.Vector3, magnetRadius: number, dt: number): void {
    for (const c of this.coins) {
      if (c.collected) continue;
      const dist = Math.hypot(playerPos.x - c.x, playerPos.z - c.z);
      if (dist < magnetRadius) {
        const pullFactor = Math.min(1.0, 16.0 * dt);
        c.x = THREE.MathUtils.lerp(c.x, playerPos.x, pullFactor);
        c.z = THREE.MathUtils.lerp(c.z, playerPos.z, pullFactor);
        c.y = THREE.MathUtils.lerp(c.y, playerPos.y + 0.5, pullFactor);
        c.mesh.position.set(c.x, c.y, c.z);
      }
    }
  }

  checkCollisions(playerPos: THREE.Vector3, isSliding: boolean): CollisionResult {
    const result: CollisionResult = {
      collectedCoins: 0,
    };

    const px = playerPos.x;
    const py = playerPos.y;
    const pz = playerPos.z;

    // 1. Coins Check (Generous pickup radius for smooth reward flow)
    for (const c of this.coins) {
      if (c.collected) continue;
      if (Math.abs(c.z - pz) < 1.5 && Math.abs(c.x - px) < 1.25 && Math.abs(c.y - py) < 2.2) {
        c.collected = true;
        c.mesh.visible = false;
        result.collectedCoins += 1;
      }
    }

    // 2. PowerUps Check
    for (const p of this.powerUps) {
      if (p.collected) continue;
      if (Math.abs(p.z - pz) < 1.7 && Math.abs(p.x - px) < 1.35 && Math.abs(p.y - py) < 2.4) {
        p.collected = true;
        p.mesh.visible = false;
        result.collectedPowerUp = p.type;
      }
    }

    // 3. Obstacles Check (Tight, fair, and rhythm-calibrated bounds)
    for (const obs of this.obstacles) {
      if (obs.cleared) continue;

      const dz = obs.z - pz;
      const dx = Math.abs(obs.x - px);

      // Boost Arch pass-through
      if (obs.isBoostGate) {
        if (Math.abs(dz) < 1.6 && dx < 1.8) {
          obs.cleared = true;
          result.hitBoostGate = true;
        }
        continue;
      }

      // Grind Rail
      if (obs.isGrindRail) {
        const halfDepth = obs.depth / 2;
        if (pz >= obs.z - halfDepth && pz <= obs.z + halfDepth && dx < 0.85) {
          result.isGrinding = true;
        }
        continue;
      }

      // Inactive laser gates are safe to skate through
      if (obs.isLaserGate && !obs.gateActive) {
        continue;
      }

      // Tight hitbox calculation (Prevents unfair edge collisions)
      const obsHalfWidth = (obs.width ?? 2.0) * 0.38;
      const obsHalfDepth = Math.max(0.45, (obs.depth ?? 1.0) * 0.38);

      // Near-Miss detection (Skillful grazing: within 0.35m-1.15m of obstacle boundary)
      if (!obs.nearMissed && Math.abs(dz) < 1.4 && dx >= (obsHalfWidth + 0.22) && dx <= (obsHalfWidth + 1.15)) {
        obs.nearMissed = true;
        result.nearMiss = true;
        result.nearMissPos = new THREE.Vector3(obs.x, obs.y, obs.z);
      }

      // Physical Collision
      if (Math.abs(dz) < (obsHalfDepth + 0.45) && dx < (obsHalfWidth + 0.24)) {
        // High barrier / laser duck clearance
        if (obs.canDuck && isSliding) {
          continue;
        }
        // Low hurdle jump clearance
        if (obs.canJump && py > 1.25) {
          continue;
        }

        // Stumble or Crash
        obs.cleared = true;
        result.crashedObstacle = obs;
        if (obs.type === 'low-hurdle') {
          result.hasStumbled = true;
        } else {
          result.hasCrashed = true;
        }
      }
    }

    return result;
  }

  removeObstacle(obstacle: ObstacleItem): void {
    const idx = this.obstacles.indexOf(obstacle);
    if (idx !== -1) {
      this.group.remove(obstacle.mesh);
      this.obstacles.splice(idx, 1);
    }
  }

  clearAhead(playerZ: number, distance: number): void {
    this.obstacles = this.obstacles.filter(obs => {
      if (obs.z >= playerZ && obs.z <= playerZ + distance) {
        this.group.remove(obs.mesh);
        return false;
      }
      return true;
    });
  }

  reset(): void {
    while (this.obstacles.length > 0) {
      const obs = this.obstacles.pop();
      if (obs) this.group.remove(obs.mesh);
    }
    while (this.coins.length > 0) {
      const c = this.coins.pop();
      if (c) this.group.remove(c.mesh);
    }
    while (this.powerUps.length > 0) {
      const p = this.powerUps.pop();
      if (p) this.group.remove(p.mesh);
    }
    this.lastSpawnZ = 30;
    this.patternSequenceIndex = 0;
    this.spawnInitialObstacles();
  }

  dispose(): void {
    this.reset();
    this.scene.remove(this.group);
  }
}

