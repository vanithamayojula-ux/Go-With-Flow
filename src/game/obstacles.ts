import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { BiomeType, LaneIndex, PowerUpType } from '../types';
import { getTerrainHeight, getBiomeAt } from './terrain';
import { LANE_WIDTH, laneToWorldX } from './trackConfig';

export interface Obstacle3DTemplate {
  id: string;
  name: string;
  url: string;
  targetHeight: number;
  yaw: number;
  pivot: THREE.Group;
  width: number;
  height: number;
  depth: number;
}

export function getLaneX(lane: LaneIndex): number {
  return laneToWorldX(lane);
}

export function laneIndexFromNumber(n: number): LaneIndex {
  if (n <= -1) return -1;
  if (n >= 1) return 1;
  return 0;
}

export type CellAction = 'free' | 'block' | 'jump' | 'duck' | 'rail' | 'boost';
export type PatternRow = [CellAction, CellAction, CellAction];

export function createMulberry32(seed: number) {
  let a = seed >>> 0;
  return function next(): number {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface PatternDef {
  id: string;
  rows: PatternRow[];
  unlockDifficulty: number;
  weight: number;
  mirrorId?: string;
  isAsymmetric?: boolean;
  leftHeavy?: boolean;
}

export const PATTERN_LIBRARY: PatternDef[] = [
  // 1. Center Wall
  {
    id: 'CENTER_WALL',
    rows: [['free', 'block', 'free']],
    unlockDifficulty: 0.0,
    weight: 2.5,
  },
  // 2. Side Walls
  {
    id: 'SIDE_WALLS',
    rows: [['block', 'free', 'block']],
    unlockDifficulty: 0.0,
    weight: 2.2,
  },
  // 3. Left Wall / Right Wall (Mirror pair)
  {
    id: 'LEFT_WALL',
    rows: [['block', 'free', 'free']],
    unlockDifficulty: 0.05,
    weight: 2.2,
    mirrorId: 'RIGHT_WALL',
    isAsymmetric: true,
    leftHeavy: true,
  },
  {
    id: 'RIGHT_WALL',
    rows: [['free', 'free', 'block']],
    unlockDifficulty: 0.05,
    weight: 2.2,
    mirrorId: 'LEFT_WALL',
    isAsymmetric: true,
    leftHeavy: false,
  },
  // 4. Left Pair / Right Pair (Mirror pair)
  {
    id: 'LEFT_PAIR',
    rows: [['block', 'block', 'free']],
    unlockDifficulty: 0.20,
    weight: 1.8,
    mirrorId: 'RIGHT_PAIR',
    isAsymmetric: true,
    leftHeavy: true,
  },
  {
    id: 'RIGHT_PAIR',
    rows: [['free', 'block', 'block']],
    unlockDifficulty: 0.20,
    weight: 1.8,
    mirrorId: 'LEFT_PAIR',
    isAsymmetric: true,
    leftHeavy: false,
  },
  // 5. Full Hurdle (Jump across lanes)
  {
    id: 'FULL_HURDLE',
    rows: [['jump', 'jump', 'jump']],
    unlockDifficulty: 0.15,
    weight: 2.0,
  },
  // 6. Full Overhead (Duck across lanes)
  {
    id: 'FULL_OVERHEAD',
    rows: [['duck', 'duck', 'duck']],
    unlockDifficulty: 0.25,
    weight: 1.8,
  },
  // 7. Split Action A / B (Mirror pair)
  {
    id: 'SPLIT_ACTION_A',
    rows: [['jump', 'free', 'duck']],
    unlockDifficulty: 0.40,
    weight: 1.6,
    mirrorId: 'SPLIT_ACTION_B',
    isAsymmetric: true,
    leftHeavy: true,
  },
  {
    id: 'SPLIT_ACTION_B',
    rows: [['duck', 'free', 'jump']],
    unlockDifficulty: 0.40,
    weight: 1.6,
    mirrorId: 'SPLIT_ACTION_A',
    isAsymmetric: true,
    leftHeavy: false,
  },
  // 8. Slalom Left / Slalom Right (3-Row Sequences with dynamic reaction gaps)
  {
    id: 'SLALOM_LEFT',
    rows: [
      ['block', 'free', 'free'],
      ['free', 'block', 'free'],
      ['free', 'free', 'block'],
    ],
    unlockDifficulty: 0.35,
    weight: 1.6,
    mirrorId: 'SLALOM_RIGHT',
    isAsymmetric: true,
    leftHeavy: true,
  },
  {
    id: 'SLALOM_RIGHT',
    rows: [
      ['free', 'free', 'block'],
      ['free', 'block', 'free'],
      ['block', 'free', 'free'],
    ],
    unlockDifficulty: 0.35,
    weight: 1.6,
    mirrorId: 'SLALOM_LEFT',
    isAsymmetric: true,
    leftHeavy: false,
  },
  // 9. Cyber Grind Rails (Center, Left, Right)
  {
    id: 'GRIND_RAIL_CENTER',
    rows: [['block', 'rail', 'block']],
    unlockDifficulty: 0.08,
    weight: 1.9,
  },
  {
    id: 'GRIND_RAIL_LEFT',
    rows: [['rail', 'free', 'block']],
    unlockDifficulty: 0.12,
    weight: 1.5,
    mirrorId: 'GRIND_RAIL_RIGHT',
    isAsymmetric: true,
    leftHeavy: true,
  },
  {
    id: 'GRIND_RAIL_RIGHT',
    rows: [['block', 'free', 'rail']],
    unlockDifficulty: 0.12,
    weight: 1.5,
    mirrorId: 'GRIND_RAIL_LEFT',
    isAsymmetric: true,
    leftHeavy: false,
  },
  // 10. Sonic Boost Gates (Center, Left, Right)
  {
    id: 'BOOST_GATE_CENTER',
    rows: [['block', 'boost', 'block']],
    unlockDifficulty: 0.06,
    weight: 1.8,
  },
  {
    id: 'BOOST_GATE_LEFT',
    rows: [['boost', 'free', 'block']],
    unlockDifficulty: 0.14,
    weight: 1.3,
    mirrorId: 'BOOST_GATE_RIGHT',
    isAsymmetric: true,
    leftHeavy: true,
  },
  {
    id: 'BOOST_GATE_RIGHT',
    rows: [['block', 'free', 'boost']],
    unlockDifficulty: 0.14,
    weight: 1.3,
    mirrorId: 'BOOST_GATE_LEFT',
    isAsymmetric: true,
    leftHeavy: false,
  },
];

export type ObstacleCategory = 'solid' | 'hurdle' | 'overhead' | 'boost-gate' | 'grind-rail' | 'portal';

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
  telegraphMesh?: THREE.Mesh;
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

/**
 * Pure generator state for algorithmic testing & simulation
 */
export class ObstacleGeneratorState {
  rng: () => number;
  laneLoad = { [-1]: 0, 0: 0, 1: 0 };
  currentReach: Set<LaneIndex> = new Set([0]);
  lastRowActions: PatternRow = ['free', 'free', 'free'];
  lastActionZ = { [-1]: -999, 0: -999, 1: -999 };
  lastActionType: Record<number, 'jump' | 'duck' | 'rail' | 'boost' | null> = { [-1]: null, 0: null, 1: null };
  lastWasMultiBlock = false;
  private pendingRows: PatternRow[] = [];

  constructor(seed = 1337) {
    this.rng = createMulberry32(seed);
  }

  nextRow(difficulty: number, speed: number, spawnZ: number): PatternRow {
    const tSwitch = 0.18;
    const reaction = 0.55;
    const minGap = speed * (reaction + tSwitch);
    const rowGap = Math.max(minGap, (1 - difficulty) * 40 + difficulty * 20);
    const gapTime = rowGap / speed;

    // 1. If we have queued rows from a multi-row sequence (like Slalom), process next row
    if (this.pendingRows.length > 0) {
      const queuedRow = this.pendingRows.shift()!;
      this.updateStateForChosenRow(queuedRow, spawnZ, tSwitch, gapTime);
      return queuedRow;
    }

    const imbalance = this.laneLoad[-1] - this.laneLoad[1];

    // Available patterns unlocked at current difficulty
    const available = PATTERN_LIBRARY.filter(p => difficulty >= p.unlockDifficulty);

    let chosenPattern: PatternDef | null = null;
    let chosenRow: PatternRow = ['free', 'free', 'free'];

    // Up to 12 resample attempts to guarantee solvability
    for (let attempt = 0; attempt < 12; attempt++) {
      // Weighted random selection
      const totalWeight = available.reduce((acc, p) => acc + p.weight, 0);
      let rand = this.rng() * totalWeight;
      let selectedPattern = available[0];
      for (const p of available) {
        if (rand < p.weight) {
          selectedPattern = p;
          break;
        }
        rand -= p.weight;
      }

      // If pattern is asymmetric mirror, apply long-run symmetry balancing
      if (selectedPattern.isAsymmetric && selectedPattern.mirrorId) {
        if (imbalance > 0.05 && selectedPattern.leftHeavy) {
          const mirror = PATTERN_LIBRARY.find(p => p.id === selectedPattern.mirrorId);
          if (mirror) selectedPattern = mirror;
        } else if (imbalance < -0.05 && !selectedPattern.leftHeavy) {
          const mirror = PATTERN_LIBRARY.find(p => p.id === selectedPattern.mirrorId);
          if (mirror) selectedPattern = mirror;
        }
      }

      const rowCandidate = selectedPattern.rows[0];

      // Rule A: Never place two 2+ block rows back to back without a buffer row
      const blockCount = rowCandidate.filter(c => c === 'block').length;
      if (this.lastWasMultiBlock && blockCount >= 2) {
        continue;
      }

      // Rule B: Action safety — reject jump directly followed by duck (or vice versa) within recovery gap (0.6 * speed)
      const recoveryGap = 0.6 * speed;
      let actionConflict = false;
      for (let i = 0; i < 3; i++) {
        const lane = (i - 1) as LaneIndex;
        const action = rowCandidate[i];
        if (action === 'jump' || action === 'duck') {
          const prevAction = this.lastActionType[lane];
          const distSince = spawnZ - this.lastActionZ[lane];
          if (prevAction && ((prevAction === 'jump' && action === 'duck') || (prevAction === 'duck' && action === 'jump')) && distSince < recoveryGap) {
            actionConflict = true;
            break;
          }
        }
      }
      if (actionConflict) continue;

      // Special Check for FULL_HURDLE & FULL_OVERHEAD across all lanes
      const isFullHurdle = rowCandidate.every(c => c === 'jump');
      const isFullOverhead = rowCandidate.every(c => c === 'duck');
      if (isFullHurdle && this.lastRowActions.every(c => c === 'duck')) {
        continue;
      }
      if (isFullOverhead && this.lastRowActions.every(c => c === 'jump')) {
        continue;
      }

      // Rule C: Guaranteed Reachability Check
      const nextReach = new Set<LaneIndex>();
      for (let i = 0; i < 3; i++) {
        const targetLane = (i - 1) as LaneIndex;
        const cell = rowCandidate[i];
        if (cell === 'block') continue;

        // Check if targetLane is reachable from any lane in currentReach
        for (const fromLane of this.currentReach) {
          const timeNeeded = Math.abs(fromLane - targetLane) * tSwitch;
          if (timeNeeded <= gapTime - 0.10) {
            nextReach.add(targetLane);
            break;
          }
        }
      }

      if (nextReach.size > 0) {
        chosenPattern = selectedPattern;
        chosenRow = rowCandidate;
        this.currentReach = nextReach;
        this.lastWasMultiBlock = blockCount >= 2;
        break;
      }
    }

    if (!chosenPattern) {
      // Solvability fallback: Clear row maintaining open reach
      chosenRow = ['free', 'free', 'free'];
      this.currentReach = new Set([-1, 0, 1]);
      this.lastWasMultiBlock = false;
    } else if (chosenPattern.rows.length > 1) {
      // Queue remaining rows of multi-row pattern (e.g. Slalom rows 1 and 2)
      for (let r = 1; r < chosenPattern.rows.length; r++) {
        this.pendingRows.push(chosenPattern.rows[r]);
      }
    }

    this.updateStateForChosenRow(chosenRow, spawnZ, tSwitch, gapTime);
    return chosenRow;
  }

  private updateStateForChosenRow(row: PatternRow, spawnZ: number, tSwitch: number, gapTime: number) {
    const nextReach = new Set<LaneIndex>();
    for (let i = 0; i < 3; i++) {
      const targetLane = (i - 1) as LaneIndex;
      const cell = row[i];
      if (cell === 'block') continue;
      for (const fromLane of this.currentReach) {
        const timeNeeded = Math.abs(fromLane - targetLane) * tSwitch;
        if (timeNeeded <= gapTime - 0.08) {
          nextReach.add(targetLane);
          break;
        }
      }
    }
    if (nextReach.size > 0) {
      this.currentReach = nextReach;
    } else {
      this.currentReach = new Set([-1, 0, 1]);
    }

    this.laneLoad[-1] = this.laneLoad[-1] * 0.9 + (row[0] !== 'free' ? 1 : 0);
    this.laneLoad[0] = this.laneLoad[0] * 0.9 + (row[1] !== 'free' ? 1 : 0);
    this.laneLoad[1] = this.laneLoad[1] * 0.9 + (row[2] !== 'free' ? 1 : 0);

    for (let i = 0; i < 3; i++) {
      const lane = (i - 1) as LaneIndex;
      const act = row[i];
      if (act === 'jump' || act === 'duck' || act === 'rail' || act === 'boost') {
        this.lastActionZ[lane] = spawnZ;
        this.lastActionType[lane] = act;
      }
    }

    this.lastRowActions = row;
  }
}

export class ObstacleManager {
  scene: THREE.Scene;
  group: THREE.Group;

  obstacles: ObstacleItem[] = [];
  coins: CoinItem[] = [];
  powerUps: PowerUpItem[] = [];

  private lastSpawnZ = 35;
  private genState: ObstacleGeneratorState;
  private _nearMissPosScratch = new THREE.Vector3();

  // Strict High-Contrast Materials
  private barrierMat = new THREE.MeshStandardMaterial({
    color: 0x0a0f1d,
    metalness: 0.9,
    roughness: 0.2,
  });
  private laserHazardMat = new THREE.MeshBasicMaterial({ color: 0xff0055 }); // High-visibility Magenta Hazard
  private warningAmberMat = new THREE.MeshBasicMaterial({
    color: 0xffaa00,
    transparent: true,
    opacity: 0.55,
  });
  private cyanNeonMat = new THREE.MeshBasicMaterial({ color: 0x00d2e0 }); // Player / Reward / Boost
  private goldMat = new THREE.MeshBasicMaterial({ color: 0xffd700 }); // Collectible Shards
  private telegraphMat = new THREE.MeshBasicMaterial({
    color: 0xff0055,
    transparent: true,
    opacity: 0.45,
    side: THREE.DoubleSide,
  });
  private portalDiscMat = new THREE.MeshBasicMaterial({
    color: 0x00f0ff,
    transparent: true,
    opacity: 0.45,
    side: THREE.DoubleSide,
  });

  // Reusable Shared Geometries (Zero allocation on hot spawn path)
  private solidMainGeom = new THREE.BoxGeometry(2.45, 2.2, 0.8);
  private solidEdgeGeom = new THREE.BoxGeometry(2.52, 0.18, 0.85);
  private solidTelegraphGeom: THREE.PlaneGeometry;

  private hurdleBeamGeom = new THREE.BoxGeometry(2.45, 0.32, 0.35);
  private hurdlePostGeom = new THREE.BoxGeometry(0.18, 0.55, 0.35);
  private hurdleTelegraphGeom: THREE.PlaneGeometry;

  private overheadPostGeom = new THREE.BoxGeometry(0.2, 3.2, 0.2);
  private overheadBeamGeom = new THREE.BoxGeometry(2.45, 0.4, 0.2);
  private overheadTelegraphGeom: THREE.PlaneGeometry;

  private portalRingGeom = new THREE.TorusGeometry(3.6, 0.24, 12, 32);
  private portalDiscGeom = new THREE.CircleGeometry(3.4, 32);

  // Grind Rail Geometries & Materials
  private railTubeGeom = new THREE.BoxGeometry(0.26, 0.22, 18.0);
  private railPostGeom = new THREE.CylinderGeometry(0.08, 0.08, 0.90, 8);
  private railMat = new THREE.MeshStandardMaterial({
    color: 0x00f0ff,
    emissive: new THREE.Color(0x00d2e0),
    emissiveIntensity: 0.85,
    metalness: 0.9,
    roughness: 0.15,
  });
  private railPostMat = new THREE.MeshStandardMaterial({
    color: 0x111927,
    metalness: 0.85,
    roughness: 0.4,
  });

  // Boost Gate Geometries & Materials
  private boostPillarGeom = new THREE.BoxGeometry(0.24, 3.2, 0.35);
  private boostTopGeom = new THREE.BoxGeometry(2.6, 0.35, 0.35);
  private boostMat = new THREE.MeshStandardMaterial({
    color: 0x00ffaa,
    emissive: new THREE.Color(0x00ffaa),
    emissiveIntensity: 1.2,
    metalness: 0.5,
    roughness: 0.15,
  });

  private coinGeom = new THREE.OctahedronGeometry(0.24);
  private powerUpGeom = new THREE.DodecahedronGeometry(0.35);

  // 3D Creature Obstacle Base & Platform
  private basePlateGeom = new THREE.CylinderGeometry(1.25, 1.3, 0.08, 16);
  private basePlateMat = new THREE.MeshStandardMaterial({
    color: 0x0a0f1d,
    metalness: 0.85,
    roughness: 0.25,
  });
  private baseRingGeom: THREE.RingGeometry;

  // Cached 3D obstacle models (Preloaded once and cloned on spawn)
  static cachedTemplates: Obstacle3DTemplate[] = [];
  static isPreloading = false;
  static preloadPromise: Promise<void> | null = null;
  static pendingSpawnCallbacks: (() => void)[] = [];

  static preloadObstacleModels(): Promise<void> {
    if (ObstacleManager.preloadPromise) {
      return ObstacleManager.preloadPromise;
    }
    ObstacleManager.isPreloading = true;

    const defs = [
      { id: 'sentinel', name: 'Cyber Sentinel', url: '/obstacle01.glb', targetHeight: 2.2, yaw: -Math.PI / 2 },
      { id: 'frost-drake', name: 'Frost Drake', url: '/0bstacle02.glb', targetHeight: 2.2, yaw: -Math.PI / 2 },
      { id: 'bio-predator', name: 'Bio Predator', url: '/obstacle03.glb', targetHeight: 2.2, yaw: -Math.PI / 2 },
      { id: 'xenobeast', name: 'Cyber Beast', url: '/obstacle04.glb', targetHeight: 2.1, yaw: -Math.PI / 2 },
    ];

    const loader = new GLTFLoader();

    ObstacleManager.preloadPromise = (async () => {
      for (const def of defs) {
        try {
          let gltf;
          try {
            gltf = await loader.loadAsync(def.url);
          } catch (loadErr) {
            if (def.fallbackUrl) {
              gltf = await loader.loadAsync(def.fallbackUrl);
            } else {
              throw loadErr;
            }
          }

          const rawScene = gltf.scene;
          const rawBox = new THREE.Box3().setFromObject(rawScene);
          const rawSize = rawBox.getSize(new THREE.Vector3());
          const rawCenter = rawBox.getCenter(new THREE.Vector3());

          const scale = def.targetHeight / Math.max(rawSize.y, 0.001);
          rawScene.scale.set(scale, scale, scale);

          rawScene.traverse(child => {
            if ((child as THREE.Mesh).isMesh) {
              const m = child as THREE.Mesh;
              m.castShadow = true;
              m.receiveShadow = true;
              if (m.material) {
                const mat = m.material as THREE.MeshStandardMaterial;
                if (mat.roughness !== undefined) {
                  mat.roughness = Math.max(0.2, Math.min(0.85, mat.roughness));
                }
                if (mat.metalness !== undefined) {
                  mat.metalness = Math.max(0.1, Math.min(0.9, mat.metalness));
                }
              }
            }
          });

          const pivot = new THREE.Group();
          pivot.name = `Obstacle3D_${def.id}`;
          rawScene.position.set(
            -rawCenter.x * scale,
            -rawBox.min.y * scale,
            -rawCenter.z * scale
          );
          pivot.add(rawScene);
          pivot.rotation.y = def.yaw;

          const scaledW = rawSize.x * scale;
          const scaledH = def.targetHeight;
          const scaledD = rawSize.z * scale;

          ObstacleManager.cachedTemplates.push({
            id: def.id,
            name: def.name,
            url: def.url,
            targetHeight: def.targetHeight,
            yaw: def.yaw,
            pivot,
            width: scaledW,
            height: scaledH,
            depth: scaledD,
          });
        } catch (err) {
          console.warn(`[ObstacleManager] Failed to load 3D obstacle model ${def.url}:`, err);
        }
      }

      // Notify and upgrade any waiting obstacles
      while (ObstacleManager.pendingSpawnCallbacks.length > 0) {
        const cb = ObstacleManager.pendingSpawnCallbacks.shift();
        if (cb) {
          try { cb(); } catch {}
        }
      }
    })();

    return ObstacleManager.preloadPromise;
  }

  constructor(scene: THREE.Scene, seed = 1337) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'ObstaclesRootGroup';
    this.scene.add(this.group);

    const stGeom = new THREE.PlaneGeometry(2.35, 4.0);
    stGeom.rotateX(-Math.PI / 2);
    this.solidTelegraphGeom = stGeom;

    const htGeom = new THREE.PlaneGeometry(2.35, 3.0);
    htGeom.rotateX(-Math.PI / 2);
    this.hurdleTelegraphGeom = htGeom;

    const otGeom = new THREE.PlaneGeometry(2.35, 3.0);
    otGeom.rotateX(-Math.PI / 2);
    this.overheadTelegraphGeom = otGeom;

    const brGeom = new THREE.RingGeometry(1.05, 1.25, 24);
    brGeom.rotateX(-Math.PI / 2);
    this.baseRingGeom = brGeom;

    this.genState = new ObstacleGeneratorState(seed);
    ObstacleManager.preloadObstacleModels();
    this.spawnInitialObstacles();
  }

  private spawnInitialObstacles(): void {
    const initialSpeed = 22;
    while (this.lastSpawnZ < 380) {
      this.spawnNextRow(initialSpeed);
    }
  }

  private spawnNextRow(playerSpeed = 22): void {
    // Difficulty ramp over first 500m
    const difficulty = THREE.MathUtils.clamp(this.lastSpawnZ / 500.0, 0.0, 1.0);
    const tSwitch = 0.18;
    const reaction = 0.55;
    const minGap = playerSpeed * (reaction + tSwitch);
    const rowGap = Math.max(minGap, (1 - difficulty) * 40 + difficulty * 20);

    const spawnZ = this.lastSpawnZ + rowGap;
    this.lastSpawnZ = spawnZ;

    // Check for biome transition portal (every 450m)
    const biomeAtZ = getBiomeAt(spawnZ);
    const biomeBeforeZ = getBiomeAt(spawnZ - rowGap);
    if (biomeAtZ !== biomeBeforeZ) {
      this.createPortalArch(spawnZ, biomeAtZ);
      return;
    }

    const row = this.genState.nextRow(difficulty, playerSpeed, spawnZ);

    // Place obstacle items for row
    for (let i = 0; i < 3; i++) {
      const lane = (i - 1) as LaneIndex;
      const action = row[i];

      if (action === 'block') {
        this.createSolidBlock(lane, spawnZ);
      } else if (action === 'jump') {
        this.createLowHurdle(lane, spawnZ);
      } else if (action === 'duck') {
        this.createOverheadLaserBarrier(lane, spawnZ);
      } else if (action === 'rail') {
        this.createGrindRail(lane, spawnZ, 18.0);
      } else if (action === 'boost') {
        this.createBoostGate(lane, spawnZ);
      }
    }

    // Place reward data shards along reachable safe paths
    const reachableLanes = Array.from(this.genState.currentReach);
    if (reachableLanes.length > 0) {
      const coinLane = reachableLanes[Math.floor(this.genState.rng() * reachableLanes.length)];
      const coinX = getLaneX(coinLane);
      this.spawnCoin(coinX, 0.9, spawnZ);

      // Occasional PowerUp along safe lane
      if (this.genState.rng() < 0.12) {
        this.spawnPowerUp(coinX, spawnZ + rowGap * 0.5);
      }
    }
  }

  private createGrindRail(lane: LaneIndex, z: number, length = 18.0): void {
    const x = getLaneX(lane);
    const groundH = getTerrainHeight(x, z);
    const railGroup = new THREE.Group();
    const railTopY = groundH + 0.90;
    railGroup.position.set(x, 0, z);

    // Top Glowing Rail Tube
    const tubeMesh = new THREE.Mesh(this.railTubeGeom, this.railMat);
    tubeMesh.position.set(0, railTopY, 0);
    railGroup.add(tubeMesh);

    // Support Posts (every 5m along the rail length)
    const postCount = Math.max(2, Math.floor(length / 5));
    const startZ = -length * 0.5 + 2.0;
    const stepZ = (length - 4.0) / (postCount - 1);
    for (let p = 0; p < postCount; p++) {
      const pz = startZ + p * stepZ;
      const postGroundH = getTerrainHeight(x, z + pz);
      const postMesh = new THREE.Mesh(this.railPostGeom, this.railPostMat);
      postMesh.position.set(0, postGroundH + 0.45, pz);
      railGroup.add(postMesh);
    }

    railGroup.frustumCulled = false;
    this.group.add(railGroup);

    this.obstacles.push({
      id: `rail-${z}-${lane}`,
      type: 'grind-rail',
      category: 'grind-rail',
      lane,
      x,
      y: railTopY,
      z,
      width: 0.8,
      height: 0.95,
      depth: length,
      mesh: railGroup,
      isGrindRail: true,
      canJump: true,
    });
  }

  private createBoostGate(lane: LaneIndex, z: number): void {
    const x = getLaneX(lane);
    const groundH = getTerrainHeight(x, z);
    const gateGroup = new THREE.Group();
    gateGroup.position.set(x, groundH, z);

    // Left & Right Pillars
    const postL = new THREE.Mesh(this.boostPillarGeom, this.boostMat);
    postL.position.set(-1.25, 1.6, 0);
    const postR = new THREE.Mesh(this.boostPillarGeom, this.boostMat);
    postR.position.set(1.25, 1.6, 0);
    gateGroup.add(postL, postR);

    // Arch Top
    const topBar = new THREE.Mesh(this.boostTopGeom, this.boostMat);
    topBar.position.set(0, 3.1, 0);
    gateGroup.add(topBar);

    gateGroup.frustumCulled = false;
    this.group.add(gateGroup);

    this.obstacles.push({
      id: `boost-${z}-${lane}`,
      type: 'boost-gate',
      category: 'boost-gate',
      lane,
      x,
      y: groundH + 1.6,
      z,
      width: 2.6,
      height: 3.2,
      depth: 1.0,
      mesh: gateGroup,
      isBoostGate: true,
    });
  }

  private createSolidBlock(lane: LaneIndex, z: number): void {
    const x = getLaneX(lane);
    const groundH = getTerrainHeight(x, z);
    const blockGroup = new THREE.Group();
    blockGroup.position.set(x, groundH, z);

    // Ground Warning Telegraph Strip (projected on road ahead)
    const telegraphMesh = new THREE.Mesh(this.solidTelegraphGeom, this.telegraphMat);
    telegraphMesh.position.set(0, 0.05, -3.0);
    blockGroup.add(telegraphMesh);

    // High-tech holographic hazard base plate & neon perimeter
    const basePlate = new THREE.Mesh(this.basePlateGeom, this.basePlateMat);
    basePlate.position.set(0, 0.04, 0);
    blockGroup.add(basePlate);

    const baseRing = new THREE.Mesh(this.baseRingGeom, this.laserHazardMat);
    baseRing.position.set(0, 0.09, 0);
    blockGroup.add(baseRing);

    const modelContainer = new THREE.Group();
    modelContainer.name = `SolidObstacleBody_${z}_${lane}`;
    blockGroup.add(modelContainer);

    const applyModel = () => {
      // Clear previous children in container
      while (modelContainer.children.length > 0) {
        modelContainer.remove(modelContainer.children[0]);
      }

      if (ObstacleManager.cachedTemplates.length > 0) {
        // Cycle deterministically across the 4 3D obstacle models based on Z
        const templateIdx = Math.abs(Math.floor(z / 18)) % ObstacleManager.cachedTemplates.length;
        const template = ObstacleManager.cachedTemplates[templateIdx];
        const clonedPivot = template.pivot.clone(true);
        clonedPivot.position.set(0, 0, 0);
        modelContainer.add(clonedPivot);
      } else {
        // Fallback procedural barrier while GLBs are downloading
        const mainMesh = new THREE.Mesh(this.solidMainGeom, this.barrierMat);
        mainMesh.position.set(0, 1.1, 0);
        modelContainer.add(mainMesh);

        const edgeMesh = new THREE.Mesh(this.solidEdgeGeom, this.laserHazardMat);
        edgeMesh.position.set(0, 2.15, 0);
        modelContainer.add(edgeMesh);

        const edgeMesh2 = new THREE.Mesh(this.solidEdgeGeom, this.laserHazardMat);
        edgeMesh2.position.set(0, 0.15, 0);
        modelContainer.add(edgeMesh2);

        // Queue callback to upgrade to 3D model once loaded
        ObstacleManager.pendingSpawnCallbacks.push(() => {
          if (blockGroup.parent) {
            applyModel();
          }
        });
      }
    };

    applyModel();

    blockGroup.frustumCulled = false;
    this.group.add(blockGroup);

    this.obstacles.push({
      id: `block-${z}-${lane}`,
      type: 'solid-block',
      category: 'solid',
      lane,
      x,
      y: groundH + 1.1,
      z,
      width: 2.45,
      height: 2.2,
      depth: 1.2,
      mesh: blockGroup,
      canDuck: false,
      canJump: false,
      telegraphMesh,
    });
  }

  private createLowHurdle(lane: LaneIndex, z: number): void {
    const x = getLaneX(lane);
    const groundH = getTerrainHeight(x, z);
    const hurdleGroup = new THREE.Group();
    hurdleGroup.position.set(x, groundH, z);

    // Low neon hurdle beam
    const beam = new THREE.Mesh(this.hurdleBeamGeom, this.laserHazardMat);
    beam.position.set(0, 0.45, 0);
    hurdleGroup.add(beam);

    // Base anchors
    const postL = new THREE.Mesh(this.hurdlePostGeom, this.barrierMat);
    postL.position.set(-1.18, 0.28, 0);
    const postR = new THREE.Mesh(this.hurdlePostGeom, this.barrierMat);
    postR.position.set(1.18, 0.28, 0);
    hurdleGroup.add(postL, postR);

    // Warning strip
    const telegraphMesh = new THREE.Mesh(this.hurdleTelegraphGeom, this.telegraphMat);
    telegraphMesh.position.set(0, 0.04, -2.5);
    hurdleGroup.add(telegraphMesh);

    hurdleGroup.frustumCulled = false;
    this.group.add(hurdleGroup);

    this.obstacles.push({
      id: `hurdle-${z}-${lane}`,
      type: 'low-hurdle',
      category: 'hurdle',
      lane,
      x,
      y: groundH + 0.45,
      z,
      width: 2.45,
      height: 0.9,
      depth: 0.8,
      mesh: hurdleGroup,
      canJump: true,
      canDuck: false,
      telegraphMesh,
    });
  }

  private createOverheadLaserBarrier(lane: LaneIndex, z: number): void {
    const x = getLaneX(lane);
    const groundH = getTerrainHeight(x, z);
    const barrierGroup = new THREE.Group();
    barrierGroup.position.set(x, groundH, z);

    // Tall support posts
    const leftPost = new THREE.Mesh(this.overheadPostGeom, this.barrierMat);
    leftPost.position.set(-1.25, 1.6, 0);
    const rightPost = new THREE.Mesh(this.overheadPostGeom, this.barrierMat);
    rightPost.position.set(1.25, 1.6, 0);
    barrierGroup.add(leftPost, rightPost);

    // High laser beam allowing slide clearance underneath
    const beamMesh = new THREE.Mesh(this.overheadBeamGeom, this.laserHazardMat);
    beamMesh.position.set(0, 1.85, 0);
    barrierGroup.add(beamMesh);

    // Amber warning decal underneath
    const telegraphMesh = new THREE.Mesh(this.overheadTelegraphGeom, this.warningAmberMat);
    telegraphMesh.position.set(0, 0.04, -2.5);
    barrierGroup.add(telegraphMesh);

    barrierGroup.frustumCulled = false;
    this.group.add(barrierGroup);

    this.obstacles.push({
      id: `overhead-${z}-${lane}`,
      type: 'overhead-barrier',
      category: 'overhead',
      lane,
      x,
      y: groundH + 1.85,
      z,
      width: 2.45,
      height: 1.4,
      depth: 0.6,
      mesh: barrierGroup,
      canDuck: true,
      canJump: false,
      telegraphMesh,
    });
  }

  private createPortalArch(z: number, targetBiome: BiomeType): void {
    const groundH = getTerrainHeight(0, z);
    const portalGroup = new THREE.Group();
    portalGroup.position.set(0, groundH + 2.4, z);

    // Dimensional rift ring
    const ringMesh = new THREE.Mesh(this.portalRingGeom, this.cyanNeonMat);
    portalGroup.add(ringMesh);

    // Translucent membrane
    const discMesh = new THREE.Mesh(this.portalDiscGeom, this.portalDiscMat);
    portalGroup.add(discMesh);

    portalGroup.frustumCulled = false;
    this.group.add(portalGroup);

    this.obstacles.push({
      id: `portal-${z}`,
      type: 'portal-arch',
      category: 'portal',
      lane: 0,
      x: 0,
      y: groundH + 2.4,
      z,
      width: 6.8,
      height: 6.8,
      depth: 2.0,
      mesh: portalGroup,
      isPortal: true,
      targetBiome,
    });
  }

  private spawnCoin(x: number, yRel: number, z: number): void {
    const groundH = getTerrainHeight(x, z);
    const coinMesh = new THREE.Mesh(this.coinGeom, this.goldMat);
    coinMesh.position.set(x, groundH + yRel, z);
    coinMesh.frustumCulled = false;
    this.group.add(coinMesh);

    this.coins.push({
      id: `coin-${z}-${x}`,
      x,
      y: groundH + yRel,
      z,
      mesh: coinMesh,
      collected: false,
    });
  }

  private spawnPowerUp(x: number, z: number): void {
    const pTypes: PowerUpType[] = ['quantum-magnet', 'sonic-jetpack', 'holo-shield', 'overdrive-2x'];
    const pType = pTypes[Math.floor(this.genState.rng() * pTypes.length)];
    const groundH = getTerrainHeight(x, z);
    const pGroup = new THREE.Group();
    pGroup.position.set(x, groundH + 1.2, z);
    const pCore = new THREE.Mesh(this.powerUpGeom, this.cyanNeonMat);
    pGroup.add(pCore);
    const pGlow = new THREE.PointLight(0x00d2e0, 1.5, 4.0);
    pGroup.add(pGlow);
    pGroup.frustumCulled = false;
    this.group.add(pGroup);

    this.powerUps.push({
      id: `pu-${z}`,
      type: pType,
      x,
      y: groundH + 1.2,
      z,
      mesh: pGroup,
      collected: false,
    });
  }

  update(playerZ: number, timeSeconds: number, playerSpeed = 22): void {
    // 1. Animate coins & powerups rotation
    for (const c of this.coins) {
      if (!c.collected) {
        c.mesh.rotation.y = timeSeconds * 4.0;
      }
    }
    for (const p of this.powerUps) {
      if (!p.collected) {
        p.mesh.rotation.y = timeSeconds * 3.0;
        const gH = getTerrainHeight(p.x, p.z);
        p.y = gH + 1.2 + Math.sin(timeSeconds * 4.0) * 0.15;
        p.mesh.position.y = p.y;
      }
    }

    // 2. Animate telegraph pulse on approaching obstacles & creature idle bob
    for (const obs of this.obstacles) {
      if (obs.telegraphMesh) {
        const dist = obs.z - playerZ;
        if (dist > 0 && dist < 50) {
          const pulse = Math.sin(timeSeconds * 12.0) * 0.15 + 0.5;
          (obs.telegraphMesh.material as THREE.MeshBasicMaterial).opacity = pulse;
        }
      }

      // Creature idle breathing/bob within active horizon
      if (obs.category === 'solid' && obs.mesh) {
        const dist = obs.z - playerZ;
        if (dist > -10 && dist < 120) {
          const idleBob = Math.sin(timeSeconds * 2.5 + obs.z * 0.4) * 0.035;
          const gH = getTerrainHeight(obs.x, obs.z);
          obs.mesh.position.y = gH + idleBob;
        }
      }
    }

    // 3. Continuous Spawn-Ahead: SPAWN_AHEAD = max(240, playerSpeed * 6)
    const spawnAheadDist = Math.max(240, playerSpeed * 6);
    while (this.lastSpawnZ < playerZ + spawnAheadDist) {
      this.spawnNextRow(playerSpeed);
    }

    // 4. Object Pool & Distance Culling behind player
    const cullZ = playerZ - 30;
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
    const playerGroundH = getTerrainHeight(px, pz);
    const playerRelY = py - playerGroundH; // Height above track surface (0.55 grounded, ~2.2 jumping apex, ~0.1 sliding)

    // 1. Coins Collection
    for (const c of this.coins) {
      if (c.collected) continue;
      const coinGroundH = getTerrainHeight(c.x, c.z);
      if (Math.abs(c.z - pz) < 1.8 && Math.abs(c.x - px) < 1.35 && Math.abs((c.y - coinGroundH) - playerRelY) < 2.2) {
        c.collected = true;
        c.mesh.visible = false;
        result.collectedCoins += 1;
      }
    }

    // 2. PowerUps Collection
    for (const p of this.powerUps) {
      if (p.collected) continue;
      const puGroundH = getTerrainHeight(p.x, p.z);
      if (Math.abs(p.z - pz) < 2.0 && Math.abs(p.x - px) < 1.4 && Math.abs((p.y - puGroundH) - playerRelY) < 2.4) {
        p.collected = true;
        p.mesh.visible = false;
        result.collectedPowerUp = p.type;
      }
    }

    // 3. Obstacles Check
    for (const obs of this.obstacles) {
      if (obs.cleared) continue;

      const dz = obs.z - pz;
      const dx = Math.abs(obs.x - px);

      // Portal pass-through
      if (obs.isPortal) {
        if (Math.abs(dz) < 2.5 && dx < 3.0) {
          obs.cleared = true;
          result.hitPortal = { targetBiome: obs.targetBiome || 'dune-nomad' };
        }
        continue;
      }

      // Boost Gate pass-through activation
      if (obs.isBoostGate) {
        if (Math.abs(dz) < 1.8 && dx < 1.35) {
          obs.cleared = true;
          result.hitBoostGate = true;
        }
        continue;
      }

      // Grind Rail detection
      if (obs.isGrindRail) {
        const halfW = (obs.width ?? 0.8) * 0.5 + 0.45;
        const halfD = (obs.depth ?? 18.0) * 0.5;
        if (dx <= halfW && Math.abs(dz) <= halfD) {
          // If player is atop or sliding along the rail (near top surface)
          if (py >= obs.y - 0.35 && py <= obs.y + 1.25) {
            result.isGrinding = true;
          }
        }
        continue;
      }

      const obsHalfWidth = (obs.width ?? 2.0) * 0.40;
      const obsHalfDepth = Math.max(0.45, (obs.depth ?? 0.8) * 0.40);

      // Near-Miss detection (Grazing within 0.35m-1.25m of obstacle boundary)
      if (!obs.nearMissed && Math.abs(dz) < 1.6 && dx >= (obsHalfWidth + 0.20) && dx <= (obsHalfWidth + 1.25)) {
        obs.nearMissed = true;
        result.nearMiss = true;
        result.nearMissPos = this._nearMissPosScratch.set(obs.x, obs.y, obs.z);
      }

      // Physical Collision
      if (Math.abs(dz) < (obsHalfDepth + 0.45) && dx < (obsHalfWidth + 0.25)) {
        // High barrier duck clearance (slide crouches below beam)
        if (obs.canDuck && isSliding) {
          continue;
        }
        // Low hurdle jump clearance (airborne jumping above hurdle)
        if (obs.canJump && playerRelY > 1.1) {
          continue;
        }

        // Collision!
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

  getObstacleSurfaceHeight(x: number, z: number, _playerY: number): number {
    for (const obs of this.obstacles) {
      if (obs.isGrindRail && !obs.cleared) {
        const halfW = (obs.width ?? 0.8) * 0.5 + 0.45;
        const halfD = (obs.depth ?? 18.0) * 0.5;
        if (Math.abs(x - obs.x) <= halfW && Math.abs(z - obs.z) <= halfD) {
          return obs.y;
        }
      }
    }
    return 0;
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
    this.lastSpawnZ = 35;
    this.genState = new ObstacleGeneratorState(1337);
    this.spawnInitialObstacles();
  }

  dispose(): void {
    this.reset();
    this.scene.remove(this.group);

    // Dispose shared geometries
    this.solidMainGeom.dispose();
    this.solidEdgeGeom.dispose();
    this.solidTelegraphGeom.dispose();
    this.hurdleBeamGeom.dispose();
    this.hurdlePostGeom.dispose();
    this.hurdleTelegraphGeom.dispose();
    this.overheadPostGeom.dispose();
    this.overheadBeamGeom.dispose();
    this.overheadTelegraphGeom.dispose();
    this.portalRingGeom.dispose();
    this.portalDiscGeom.dispose();
    this.coinGeom.dispose();
    this.powerUpGeom.dispose();
    this.railTubeGeom.dispose();
    this.railPostGeom.dispose();
    this.boostPillarGeom.dispose();
    this.boostTopGeom.dispose();
    this.basePlateGeom.dispose();
    this.baseRingGeom.dispose();

    // Dispose materials
    this.barrierMat.dispose();
    this.laserHazardMat.dispose();
    this.warningAmberMat.dispose();
    this.cyanNeonMat.dispose();
    this.goldMat.dispose();
    this.telegraphMat.dispose();
    this.portalDiscMat.dispose();
    this.railMat.dispose();
    this.railPostMat.dispose();
    this.boostMat.dispose();
    this.basePlateMat.dispose();
  }
}

// Background preload 3D obstacle models on module import
ObstacleManager.preloadObstacleModels().catch(err => {
  console.warn('[ObstacleManager] Background preload warning:', err);
});
