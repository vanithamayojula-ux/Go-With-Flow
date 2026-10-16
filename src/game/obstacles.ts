import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { LaneIndex, PowerUpType } from '../types';
import { getTerrainHeight } from './terrain';
import { WORLD_LENGTH_DISTANCE, WORLD_ORDER, WORLDS } from './worlds';
import { laneToWorldX } from './trackConfig';
import { createBrushedMetalTexture, createStripeTexture } from '../graphics/hazardTextures';

// Open road kept on both sides of a world-boundary portal gateway (the
// gateway itself is engine-owned, see src/game/portal): no obstacle, rail,
// coin or power-up within this many metres of the boundary.
const GATEWAY_CLEARANCE = 25;

// Player body extents above the feet, used for the vertical collision test.
// The player position is the board (feet) height: terrain + a small hover.
const PLAYER_STAND_HEIGHT = 1.75;
const PLAYER_SLIDE_HEIGHT = 0.95;
const PLAYER_HOVER_OFFSET = 0.12;
// Effective top of solid blocks for collisions; above the ~2.8 m jump apex.
const SOLID_UNJUMPABLE_TOP = 3.4;
// Lateral distance between the player and the edge of an obstacle that still
// counts as a near miss. Lanes are 2.6 m apart, so passing an obstacle in the
// adjacent lane (about 1.6 m from its collision edge) qualifies.
const NEAR_MISS_LATERAL_REACH = 2.0;
// Riding speed (m/s) needed for a near miss to count.
const NEAR_MISS_MIN_SPEED = 12;

// GLB obstacles switch to their decimated LOD (~4.5k tris instead of ~57k)
// this far from the camera. Only the full-detail level casts shadows, so
// shadow casting is limited to obstacles near the rider for free.
const OBSTACLE_LOD_DISTANCE = 30;
// Coins are drawn as one instanced mesh; this many can be live at once.
const MAX_LIVE_COINS = 96;

// Boost gate gantry: the bar sits well above the chase camera (y ~2.6-2.9).
const BOOST_GATE_BAR_Y = 4.3;
const BOOST_GATE_POST_HEIGHT = 4.5;

let sharedObstacleLoader: GLTFLoader | null = null;

/**
 * GLTFLoader for the obstacle GLBs. They use EXT_meshopt_compression,
 * KHR_mesh_quantization and EXT_texture_webp, so the meshopt decoder is
 * required. Embedded textures go through the <img>-based TextureLoader (as in
 * heroRig.ts) instead of ImageBitmapLoader, which fetch()es blob: URLs and is
 * blocked by a Content-Security-Policy with connect-src 'self'.
 */
function getObstacleLoader(): GLTFLoader {
  if (sharedObstacleLoader) return sharedObstacleLoader;
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  if (typeof document !== 'undefined') {
    loader.register((parser: any) => {
      parser.textureLoader = new THREE.TextureLoader(parser.options.manager);
      if (parser.options.crossOrigin) parser.textureLoader.setCrossOrigin(parser.options.crossOrigin);
      return { name: 'GWF_obstacle_img_texture_loader' } as any;
    });
  }
  sharedObstacleLoader = loader;
  return loader;
}

/** A fresh seed for a run, so obstacle layouts differ between runs. */
function randomRunSeed(): number {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    return crypto.getRandomValues(new Uint32Array(1))[0];
  }
  return Math.floor(Math.random() * 0xffffffff) >>> 0;
}

export interface ObstacleModelDef {
  id: string;
  name: string;
  url: string;
  /** Decimated copy shown beyond OBSTACLE_LOD_DISTANCE (optional). */
  lodUrl?: string;
  targetHeight: number;
  yaw: number;
}

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

export type ObstacleCategory = 'solid' | 'hurdle' | 'overhead' | 'boost-gate' | 'grind-rail';

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
  nearMissed?: boolean;
  telegraphMesh?: THREE.Mesh;
  /** Road height under the obstacle, cached at spawn. */
  groundY?: number;
  /** Pool the mesh group returns to when the obstacle is despawned. */
  poolKey?: string;
}

export interface CoinItem {
  id: string;
  x: number;
  y: number;
  z: number;
  /** Road height under the coin's spawn point, cached at spawn. */
  groundY: number;
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
  /** Road height under the power-up, cached at spawn. */
  groundY?: number;
}

export interface CollisionResult {
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
  // Reused every frame by checkCollisions() (read synchronously by the engine).
  private _collision: CollisionResult = { collectedCoins: 0 };
  // Despawned obstacle groups, by kind, reused by the next spawn of that kind.
  private pools = new Map<string, THREE.Object3D[]>();
  // All coins are one instanced draw; matrices are rewritten from CoinItem.
  private coinMesh: THREE.InstancedMesh;
  private coinMatrix = new THREE.Matrix4();
  private coinQuat = new THREE.Quaternion();
  private coinPos = new THREE.Vector3();
  private coinScale = new THREE.Vector3(1, 1, 1);
  private coinAxis = new THREE.Vector3(0, 1, 0);
  private coinTime = 0;
  // Fixed seed (tests / replays) or null for a fresh layout every run.
  private fixedSeed: number | null;
  private lastPlayerSpeed = 22;
  private disposed = false;

  // Real-world road hardware: dark painted steel barriers, galvanised steel,
  // retro-reflective red/white barrier bands and yellow/black hazard chevrons.
  // The dark body keeps barriers readable against snow, sand and bright sky.
  private barrierMat = new THREE.MeshStandardMaterial({
    color: 0x2c3038, // dark charcoal paint
    metalness: 0.35,
    roughness: 0.6,
  });
  // Retro-reflective red/white bands wrapped round every side of a barrier.
  // A little emissive from the same stripe map stands in for the headlight
  // bounce real reflective sheeting gives, so the bands pop in any light.
  private barrierBandMat = (() => {
    const map = createStripeTexture('#f4f4f0', '#c8161d', 2);
    if (map) map.repeat.set(4, 0.5);
    return new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map,
      emissive: new THREE.Color(0xffffff),
      emissiveMap: map,
      emissiveIntensity: 0.35,
      metalness: 0.0,
      roughness: 0.35,
    });
  })();
  private steelMat = new THREE.MeshStandardMaterial({
    color: 0xaeb4ba,
    metalness: 0.85,
    roughness: 0.4,
  });
  private laserHazardMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: createStripeTexture('#f2f2ee', '#c4161c', 4),
    metalness: 0.0,
    roughness: 0.45,
  });
  private warningAmberMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: createStripeTexture('#1b1b1b', '#e8b400', 8),
    roughness: 0.6,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });
  // Power-up cores: glowing glass orbs (emissive, so they bloom without a light)
  private cyanNeonMat = new THREE.MeshStandardMaterial({
    color: 0x0b2a33,
    emissive: new THREE.Color(0x35d6ff),
    emissiveIntensity: 2.5,
    metalness: 0.0,
    roughness: 0.1,
  });
  private goldMat = new THREE.MeshStandardMaterial({ color: 0xffc04a, metalness: 1.0, roughness: 0.22 }); // Gold shards
  private telegraphMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: createStripeTexture('#1b1b1b', '#e8b400', 8),
    roughness: 0.6,
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });
  // Reusable Shared Geometries (Zero allocation on hot spawn path)
  private solidMainGeom = new THREE.BoxGeometry(2.45, 2.2, 0.8);
  private solidEdgeGeom = new THREE.BoxGeometry(2.52, 0.28, 0.86);
  private solidTelegraphGeom: THREE.PlaneGeometry;

  private hurdleBeamGeom = new THREE.BoxGeometry(2.45, 0.32, 0.35);
  private hurdlePostGeom = new THREE.BoxGeometry(0.18, 0.55, 0.35);
  private hurdleTelegraphGeom: THREE.PlaneGeometry;

  private overheadPostGeom = new THREE.BoxGeometry(0.2, 3.2, 0.2);
  private overheadBeamGeom = new THREE.BoxGeometry(2.45, 0.4, 0.2);
  private overheadTelegraphGeom: THREE.PlaneGeometry;

  // Grind Rail Geometries & Materials
  private railTubeGeom = new THREE.BoxGeometry(0.26, 0.22, 18.0);
  private railPostGeom = new THREE.CylinderGeometry(0.08, 0.08, 0.90, 8);
  // Grind rail: polished steel tube on galvanised posts
  private railMat = new THREE.MeshStandardMaterial({
    color: 0xd5d9de,
    metalness: 1.0,
    roughness: 0.18,
  });
  private railPostMat = new THREE.MeshStandardMaterial({
    color: 0x8f959b,
    metalness: 0.85,
    roughness: 0.45,
  });

  // Boost Gate Geometries & Materials
  private boostPillarGeom = new THREE.BoxGeometry(0.24, BOOST_GATE_POST_HEIGHT, 0.35);
  private boostTopGeom = new THREE.BoxGeometry(2.74, 0.35, 0.35);
  // Boost gate: a dark brushed-metal gantry (PBR) carrying thin LED strips
  // on its inner faces in the current world's energy colour. The frame
  // itself does not glow; only the strips do (emissive <= 0.8).
  private boostLedGeomPost = new THREE.BoxGeometry(0.03, BOOST_GATE_POST_HEIGHT - 0.7, 0.07);
  private boostLedGeomTop = new THREE.BoxGeometry(2.2, 0.03, 0.07);
  private boostBrushed = createBrushedMetalTexture();
  private boostMat = (() => {
    const map = this.boostBrushed;
    if (map) map.repeat.set(2, 1);
    return new THREE.MeshStandardMaterial({
      color: 0x464c53, // dark anodised steel
      metalness: 0.85,
      roughness: 0.42,
      map,
    });
  })();
  /** Posts: same metal with the brushing running up the post. */
  private boostPostMat = (() => {
    const map = this.boostBrushed ? this.boostBrushed.clone() : null;
    if (map) {
      map.rotation = Math.PI / 2;
      map.repeat.set(4, 1);
    }
    return new THREE.MeshStandardMaterial({ color: 0x464c53, metalness: 0.85, roughness: 0.42, map });
  })();
  /** One LED material per world (energy colour), same shader program. */
  private boostLedMats: THREE.MeshStandardMaterial[] = WORLD_ORDER.map(id =>
    new THREE.MeshStandardMaterial({
      color: 0x0c0d0e,
      emissive: new THREE.Color(WORLDS[id]?.palette.energy ?? '#3dff9a'),
      emissiveIntensity: 0.8,
      metalness: 0.0,
      roughness: 0.35,
    })
  );

  private coinGeom = new THREE.OctahedronGeometry(0.24);
  private powerUpGeom = new THREE.DodecahedronGeometry(0.35);

  // Cached 3D obstacle models, loaded once per page and shared by every
  // ObstacleManager (StrictMode double-mounts and Quit-to-Menu create new
  // managers; the templates must survive them, so instances never clear them).
  static cachedTemplates: Obstacle3DTemplate[] = [];
  // True from the moment a preload is scheduled until its batch settles, so
  // obstacles spawned in the meantime queue an upgrade to the GLB model.
  static isPreloading = false;
  // Templates are indexed by z, so only use them once a batch has settled;
  // otherwise a partially filled array collapses the cycle onto whichever
  // models happened to load first.
  static isPreloadComplete = false;
  static preloadPromise: Promise<void> | null = null;
  static pendingSpawnCallbacks: { owner: ObstacleManager; run: () => void }[] = [];
  private static preloadScheduled = false;

  // GLB obstacle models in public/. A model that fails to load is skipped and
  // the procedural barrier covers for it; failed models are retried on the
  // next preload call (next manager or run), successful ones are kept.
  // `lodUrl` is a decimated copy (gltf-transform simplify, ~8% of the
  // triangles) shown beyond OBSTACLE_LOD_DISTANCE.
  static readonly OBSTACLE_MODEL_DEFS: ReadonlyArray<ObstacleModelDef> = [
    { id: 'sentinel', name: 'Cyber Sentinel', url: 'obstacle01.glb', lodUrl: 'obstacle01_lod.glb', targetHeight: 2.2, yaw: -Math.PI / 2 },
    { id: 'frost-drake', name: 'Frost Drake', url: 'obstacle02.glb', lodUrl: 'obstacle02_lod.glb', targetHeight: 2.2, yaw: -Math.PI / 2 },
    { id: 'bio-predator', name: 'Bio Predator', url: 'obstacle03.glb', lodUrl: 'obstacle03_lod.glb', targetHeight: 2.2, yaw: -Math.PI / 2 },
    { id: 'xenobeast', name: 'Cyber Beast', url: 'obstacle04.glb', lodUrl: 'obstacle04_lod.glb', targetHeight: 2.1, yaw: -Math.PI / 2 },
  ];

  private static buildTemplate(def: ObstacleModelDef, gltf: any, lodGltf?: any): Obstacle3DTemplate {
    const rawScene: THREE.Object3D = gltf.scene;
    const rawBox = new THREE.Box3().setFromObject(rawScene);
    const rawSize = rawBox.getSize(new THREE.Vector3());
    const rawCenter = rawBox.getCenter(new THREE.Vector3());

    const scale = def.targetHeight / Math.max(rawSize.y, 0.001);
    rawScene.scale.set(scale, scale, scale);

    let sharedMaterial: THREE.Material | null = null;
    rawScene.traverse(child => {
      if ((child as THREE.Mesh).isMesh) {
        const m = child as THREE.Mesh;
        m.castShadow = true;
        m.receiveShadow = true;
        if (m.material) {
          const mat = m.material as THREE.MeshStandardMaterial;
          if (!sharedMaterial) sharedMaterial = mat;
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
    rawScene.position.set(-rawCenter.x * scale, -rawBox.min.y * scale, -rawCenter.z * scale);

    const lodScene: THREE.Object3D | null = lodGltf && lodGltf.scene ? lodGltf.scene : null;
    if (lodScene) {
      // Same placement as the full model; it reuses the full model's material
      // (its own low-res textures are dropped), so there is no extra shader
      // variant and no texture pop when the level switches.
      lodScene.scale.set(scale, scale, scale);
      lodScene.position.copy(rawScene.position);
      lodScene.traverse(child => {
        if ((child as THREE.Mesh).isMesh) {
          const m = child as THREE.Mesh;
          const own = m.material as THREE.Material | THREE.Material[];
          if (sharedMaterial) {
            m.material = sharedMaterial;
            const owned = Array.isArray(own) ? own : [own];
            for (const om of owned) {
              if (!om || om === sharedMaterial) continue;
              const anyMat = om as any;
              for (const key of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap']) {
                anyMat[key]?.dispose?.();
              }
              om.dispose();
            }
          }
          m.castShadow = false;
          m.receiveShadow = true;
        }
      });
      const lod = new THREE.LOD();
      lod.name = `Obstacle3DLOD_${def.id}`;
      lod.addLevel(rawScene, 0);
      lod.addLevel(lodScene, OBSTACLE_LOD_DISTANCE);
      pivot.add(lod);
    } else {
      pivot.add(rawScene);
    }
    pivot.rotation.y = def.yaw;

    return {
      id: def.id,
      name: def.name,
      url: def.url,
      targetHeight: def.targetHeight,
      yaw: def.yaw,
      pivot,
      width: rawSize.x * scale,
      height: def.targetHeight,
      depth: rawSize.z * scale,
    };
  }

  static preloadObstacleModels(): Promise<void> {
    if (ObstacleManager.preloadPromise) {
      return ObstacleManager.preloadPromise;
    }
    const defs = ObstacleManager.OBSTACLE_MODEL_DEFS;
    // Only fetch models that are not cached yet (first load, or a retry of
    // the ones that failed last time).
    const missing = defs.filter(def => !ObstacleManager.cachedTemplates.some(t => t.id === def.id));
    if (missing.length === 0) {
      ObstacleManager.isPreloading = false;
      ObstacleManager.isPreloadComplete = ObstacleManager.cachedTemplates.length > 0;
      ObstacleManager.drainPendingSpawnCallbacks();
      ObstacleManager.preloadPromise = Promise.resolve();
      return ObstacleManager.preloadPromise;
    }

    ObstacleManager.isPreloading = true;
    const loader = getObstacleLoader();

    ObstacleManager.preloadPromise = (async () => {
      // All models (and their LOD copies) download and decode in parallel. A
      // missing LOD only costs the decimated level, never the model.
      const lodResults = await Promise.all(
        missing.map(def => (def.lodUrl ? loader.loadAsync(def.lodUrl).catch(() => null) : Promise.resolve(null)))
      );
      const results = await Promise.allSettled(missing.map(def => loader.loadAsync(def.url)));

      let failures = 0;
      results.forEach((res, i) => {
        const def = missing[i];
        if (res.status === 'rejected') {
          failures++;
          console.warn(`[ObstacleManager] Failed to load 3D obstacle model ${def.url}:`, res.reason);
          return;
        }
        if (!res.value || !res.value.scene) {
          failures++;
          console.warn(`[ObstacleManager] 3D obstacle model ${def.url} has no scene; using the procedural barrier.`);
          return;
        }
        try {
          const template = ObstacleManager.buildTemplate(def, res.value, lodResults[i]);
          const existingIdx = ObstacleManager.cachedTemplates.findIndex(t => t.id === def.id);
          if (existingIdx !== -1) ObstacleManager.cachedTemplates[existingIdx] = template;
          else ObstacleManager.cachedTemplates.push(template);
        } catch (err) {
          failures++;
          console.warn(`[ObstacleManager] Failed to prepare 3D obstacle model ${def.url}:`, err);
        }
      });

      // Keep the template order stable (definition order) whatever finished first.
      const order = (id: string) => defs.findIndex(d => d.id === id);
      ObstacleManager.cachedTemplates.sort((a, b) => order(a.id) - order(b.id));

      ObstacleManager.isPreloading = false;
      ObstacleManager.isPreloadComplete = ObstacleManager.cachedTemplates.length > 0;
      // A later call retries only the models that failed.
      if (failures > 0) ObstacleManager.preloadPromise = null;
      ObstacleManager.drainPendingSpawnCallbacks();
    })();

    return ObstacleManager.preloadPromise;
  }

  private static drainPendingSpawnCallbacks(): void {
    const queue = ObstacleManager.pendingSpawnCallbacks;
    ObstacleManager.pendingSpawnCallbacks = [];
    for (const entry of queue) {
      if (entry.owner.disposed) continue;
      try {
        entry.run();
      } catch (err) {
        console.warn('[ObstacleManager] Failed to upgrade an obstacle to its 3D model:', err);
      }
    }
  }

  /**
   * Start loading the obstacle GLBs once the browser is idle, so they don't
   * compete with the first frame (and never under Node test runs).
   */
  private static schedulePreload(): void {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    if (ObstacleManager.isPreloadComplete && ObstacleManager.preloadPromise) return;
    if (ObstacleManager.preloadScheduled) return;
    ObstacleManager.preloadScheduled = true;
    // Obstacles spawned before the load starts still queue their GLB upgrade.
    ObstacleManager.isPreloading = true;
    const start = () => {
      ObstacleManager.preloadScheduled = false;
      ObstacleManager.preloadObstacleModels().catch(err => {
        console.warn('[ObstacleManager] Obstacle model preload failed:', err);
      });
    };
    const ric = (window as any).requestIdleCallback as ((cb: () => void, opts?: { timeout: number }) => number) | undefined;
    if (typeof ric === 'function') ric(start, { timeout: 1500 });
    else window.setTimeout(start, 200);
  }

  /**
   * @param seed Fixed obstacle seed for deterministic layouts (tests, replays).
   *             Omit it to get a fresh layout on every run.
   */
  constructor(scene: THREE.Scene, seed?: number) {
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

    this.coinMesh = new THREE.InstancedMesh(this.coinGeom, this.goldMat, MAX_LIVE_COINS);
    this.coinMesh.name = 'CoinInstances';
    this.coinMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.coinMesh.count = 0;
    // One draw call for every coin on the track; its instances move every
    // frame, so a cached bounding sphere would be stale (culling it saves nothing).
    this.coinMesh.frustumCulled = false;
    this.group.add(this.coinMesh);

    this.fixedSeed = seed ?? null;
    this.genState = new ObstacleGeneratorState(this.fixedSeed ?? randomRunSeed());
    ObstacleManager.schedulePreload();
    this.spawnInitialObstacles();
  }

  /** Pop a pooled group of this kind, or build one. */
  private acquire<T extends THREE.Object3D>(key: string, build: () => T): T {
    const pool = this.pools.get(key);
    const reused = pool && pool.length > 0 ? (pool.pop() as T) : null;
    return reused ?? build();
  }

  /** Detach an obstacle's group and keep it for reuse. */
  private releaseObstacleMesh(obs: ObstacleItem): void {
    this.group.remove(obs.mesh);
    if (!obs.poolKey) return;
    let pool = this.pools.get(obs.poolKey);
    if (!pool) {
      pool = [];
      this.pools.set(obs.poolKey, pool);
    }
    if (pool.length < 24) pool.push(obs.mesh);
  }

  /** Write every live coin into the instanced mesh (spin + position). */
  private syncCoinInstances(): void {
    const coins = this.coins;
    this.coinQuat.setFromAxisAngle(this.coinAxis, this.coinTime * 4.0);
    let n = 0;
    for (let i = 0; i < coins.length && n < MAX_LIVE_COINS; i++) {
      const c = coins[i];
      if (c.collected) continue;
      this.coinPos.set(c.x, c.y, c.z);
      this.coinMatrix.compose(this.coinPos, this.coinQuat, this.coinScale);
      this.coinMesh.setMatrixAt(n++, this.coinMatrix);
    }
    if (n !== this.coinMesh.count || n > 0) {
      this.coinMesh.count = n;
      this.coinMesh.instanceMatrix.needsUpdate = true;
    }
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

    // World-boundary gateway: keep the road clear on both sides of it. A row
    // whose rails (+-9 m) or power-up (half a gap ahead) would reach into the
    // clearance is skipped and spawning resumes past the gateway.
    const boundaryIndex = Math.floor(this.lastSpawnZ / WORLD_LENGTH_DISTANCE) + 1;
    if (boundaryIndex < WORLD_ORDER.length) {
      const boundaryZ = boundaryIndex * WORLD_LENGTH_DISTANCE;
      if (spawnZ + Math.max(9, rowGap * 0.5) > boundaryZ - GATEWAY_CLEARANCE) {
        this.lastSpawnZ = boundaryZ + GATEWAY_CLEARANCE;
        return;
      }
    }
    this.lastSpawnZ = spawnZ;

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
    const railTopY = groundH + 0.90;

    // Support Posts (every 5m along the rail length)
    const postCount = Math.max(2, Math.floor(length / 5));
    const poolKey = `rail-${postCount}`;
    const railGroup = this.acquire(poolKey, () => {
      const g = new THREE.Group();
      // Top Glowing Rail Tube
      g.add(new THREE.Mesh(this.railTubeGeom, this.railMat));
      for (let p = 0; p < postCount; p++) g.add(new THREE.Mesh(this.railPostGeom, this.railPostMat));
      return g;
    });
    railGroup.position.set(x, 0, z);
    railGroup.children[0].position.set(0, railTopY, 0);
    const startZ = -length * 0.5 + 2.0;
    const stepZ = (length - 4.0) / (postCount - 1);
    for (let p = 0; p < postCount; p++) {
      const pz = startZ + p * stepZ;
      const postGroundH = getTerrainHeight(x, z + pz);
      railGroup.children[p + 1].position.set(0, postGroundH + 0.45, pz);
    }

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
      groundY: groundH,
      poolKey,
    });
  }

  private createBoostGate(lane: LaneIndex, z: number): void {
    const x = getLaneX(lane);
    const groundH = getTerrainHeight(x, z);
    const gateGroup = this.acquire('boost-gate', () => {
      const g = new THREE.Group();
      // Left & Right Pillars (tall enough to carry the bar above the camera)
      const postL = new THREE.Mesh(this.boostPillarGeom, this.boostPostMat);
      postL.position.set(-1.25, BOOST_GATE_POST_HEIGHT / 2, 0);
      const postR = new THREE.Mesh(this.boostPillarGeom, this.boostPostMat);
      postR.position.set(1.25, BOOST_GATE_POST_HEIGHT / 2, 0);
      g.add(postL, postR);

      // Gantry bar at ~4.3 m: the chase camera rides at ~2.6-2.9 m, so a lower
      // bar sweeps through the lens and fills the screen.
      const topBar = new THREE.Mesh(this.boostTopGeom, this.boostMat);
      topBar.position.set(0, BOOST_GATE_BAR_Y, 0);
      g.add(topBar);

      // Thin LED strips set into the inner faces (posts at |x| 1.13, bar underside)
      const led = this.boostLedMats[0];
      const ledL = new THREE.Mesh(this.boostLedGeomPost, led);
      ledL.position.set(-1.125, BOOST_GATE_POST_HEIGHT / 2 - 0.05, 0);
      const ledR = new THREE.Mesh(this.boostLedGeomPost, led);
      ledR.position.set(1.125, BOOST_GATE_POST_HEIGHT / 2 - 0.05, 0);
      const ledTop = new THREE.Mesh(this.boostLedGeomTop, led);
      ledTop.position.set(0, BOOST_GATE_BAR_Y - 0.185, 0);
      g.add(ledL, ledR, ledTop);
      g.userData.leds = [ledL, ledR, ledTop];
      return g;
    });
    // LEDs take the energy colour of the world the gate stands in
    const wi = Math.max(0, Math.min(this.boostLedMats.length - 1, Math.floor(z / WORLD_LENGTH_DISTANCE)));
    const leds = gateGroup.userData.leds as THREE.Mesh[] | undefined;
    if (leds) for (let i = 0; i < leds.length; i++) leds[i].material = this.boostLedMats[wi];
    gateGroup.position.set(x, groundH, z);
    this.group.add(gateGroup);

    this.obstacles.push({
      id: `boost-${z}-${lane}`,
      type: 'boost-gate',
      category: 'boost-gate',
      lane,
      x,
      y: groundH + BOOST_GATE_POST_HEIGHT / 2,
      z,
      width: 2.6,
      height: BOOST_GATE_POST_HEIGHT,
      depth: 1.0,
      mesh: gateGroup,
      isBoostGate: true,
      groundY: groundH,
      poolKey: 'boost-gate',
    });
  }

  private createSolidBlock(lane: LaneIndex, z: number): void {
    const x = getLaneX(lane);
    const groundH = getTerrainHeight(x, z);

    // The model is chosen once, at spawn: the 3D model if the GLBs are ready
    // (they are preloaded behind the opening screen), else the procedural
    // barrier. Blocks already on the road are never swapped in bulk when a
    // load completes (that swap was a visible hitch).
    const templates = ObstacleManager.cachedTemplates;
    const useModel = ObstacleManager.isPreloadComplete && templates.length > 0;
    // Cycle deterministically across the 3D obstacle models based on Z
    const templateIdx = useModel ? Math.abs(Math.floor(z / 18)) % templates.length : -1;
    const poolKey = useModel ? `block-${templates[templateIdx].id}` : 'block-proc';
    const blockGroup = this.acquire(poolKey, () => {
      const g = new THREE.Group();
      // Ground Warning Telegraph Strip (projected on road ahead)
      const telegraph = new THREE.Mesh(this.solidTelegraphGeom, this.telegraphMat);
      telegraph.position.set(0, 0.05, -3.0);
      g.add(telegraph);

      const modelContainer = new THREE.Group();
      modelContainer.name = 'SolidObstacleBody';
      g.add(modelContainer);
      if (useModel) {
        const clonedPivot = templates[templateIdx].pivot.clone(true);
        clonedPivot.position.set(0, 0, 0);
        modelContainer.add(clonedPivot);
      } else {
        // Procedural barrier (while GLBs download, or if they fail): a dark
        // body wrapped in red/white reflective bands on every side.
        const mainMesh = new THREE.Mesh(this.solidMainGeom, this.barrierMat);
        mainMesh.position.set(0, 1.1, 0);
        modelContainer.add(mainMesh);

        for (const bandY of [0.3, 1.15, 1.98]) {
          const band = new THREE.Mesh(this.solidEdgeGeom, this.barrierBandMat);
          band.position.set(0, bandY, 0);
          modelContainer.add(band);
        }
      }
      return g;
    });
    blockGroup.position.set(x, groundH, z);
    const telegraphMesh = blockGroup.children[0] as THREE.Mesh;
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
      groundY: groundH,
      poolKey,
    });
  }

  private createLowHurdle(lane: LaneIndex, z: number): void {
    const x = getLaneX(lane);
    const groundH = getTerrainHeight(x, z);
    const hurdleGroup = this.acquire('hurdle', () => {
      const g = new THREE.Group();
      // Warning strip (first child: the telegraph)
      const telegraph = new THREE.Mesh(this.hurdleTelegraphGeom, this.telegraphMat);
      telegraph.position.set(0, 0.04, -2.5);
      g.add(telegraph);

      // Low neon hurdle beam
      const beam = new THREE.Mesh(this.hurdleBeamGeom, this.laserHazardMat);
      beam.position.set(0, 0.45, 0);
      g.add(beam);

      // Base anchors
      const postL = new THREE.Mesh(this.hurdlePostGeom, this.steelMat);
      postL.position.set(-1.18, 0.28, 0);
      const postR = new THREE.Mesh(this.hurdlePostGeom, this.steelMat);
      postR.position.set(1.18, 0.28, 0);
      g.add(postL, postR);
      return g;
    });
    hurdleGroup.position.set(x, groundH, z);
    const telegraphMesh = hurdleGroup.children[0] as THREE.Mesh;
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
      groundY: groundH,
      poolKey: 'hurdle',
    });
  }

  private createOverheadLaserBarrier(lane: LaneIndex, z: number): void {
    const x = getLaneX(lane);
    const groundH = getTerrainHeight(x, z);
    const barrierGroup = this.acquire('overhead', () => {
      const g = new THREE.Group();
      // Amber warning decal underneath (first child: the telegraph)
      const telegraph = new THREE.Mesh(this.overheadTelegraphGeom, this.warningAmberMat);
      telegraph.position.set(0, 0.04, -2.5);
      g.add(telegraph);

      // Tall support posts
      const leftPost = new THREE.Mesh(this.overheadPostGeom, this.steelMat);
      leftPost.position.set(-1.25, 1.6, 0);
      const rightPost = new THREE.Mesh(this.overheadPostGeom, this.steelMat);
      rightPost.position.set(1.25, 1.6, 0);
      g.add(leftPost, rightPost);

      // High laser beam allowing slide clearance underneath
      const beamMesh = new THREE.Mesh(this.overheadBeamGeom, this.laserHazardMat);
      beamMesh.position.set(0, 1.85, 0);
      g.add(beamMesh);
      return g;
    });
    barrierGroup.position.set(x, groundH, z);
    const telegraphMesh = barrierGroup.children[0] as THREE.Mesh;
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
      groundY: groundH,
      poolKey: 'overhead',
    });
  }

  private spawnCoin(x: number, yRel: number, z: number): void {
    const groundH = getTerrainHeight(x, z);
    // Drawn by the shared instanced mesh (syncCoinInstances).
    this.coins.push({
      id: `coin-${z}-${x}`,
      x,
      y: groundH + yRel,
      z,
      groundY: groundH,
      collected: false,
    });
  }

  private spawnPowerUp(x: number, z: number): void {
    const pTypes: PowerUpType[] = ['quantum-magnet', 'sonic-jetpack', 'holo-shield', 'overdrive-2x'];
    const pType = pTypes[Math.floor(this.genState.rng() * pTypes.length)];
    const groundH = getTerrainHeight(x, z);
    const pGroup = this.acquire('power-up', () => {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(this.powerUpGeom, this.cyanNeonMat));
      return g;
    });
    pGroup.position.set(x, groundH + 1.2, z);
    pGroup.visible = true;
    this.group.add(pGroup);

    this.powerUps.push({
      id: `pu-${z}`,
      type: pType,
      x,
      y: groundH + 1.2,
      z,
      mesh: pGroup,
      collected: false,
      groundY: groundH,
    });
  }

  private releasePowerUp(p: PowerUpItem): void {
    this.group.remove(p.mesh);
    let pool = this.pools.get('power-up');
    if (!pool) {
      pool = [];
      this.pools.set('power-up', pool);
    }
    if (pool.length < 8) pool.push(p.mesh);
  }

  update(playerZ: number, timeSeconds: number, playerSpeed = 22): void {
    this.lastPlayerSpeed = playerSpeed;

    // 1. Animate coins (instanced, synced below) & powerups rotation
    this.coinTime = timeSeconds;
    const puBob = Math.sin(timeSeconds * 4.0) * 0.15;
    for (const p of this.powerUps) {
      if (!p.collected) {
        p.mesh.rotation.y = timeSeconds * 3.0;
        const gH = p.groundY ?? getTerrainHeight(p.x, p.z);
        p.y = gH + 1.2 + puBob;
        p.mesh.position.y = p.y;
      }
    }

    // 2. Animate telegraph pulse on approaching obstacles & creature idle bob
    // (the telegraph materials are shared, so one write per frame is enough)
    const pulse = Math.sin(timeSeconds * 12.0) * 0.15 + 0.5;
    let pulsed = false;
    for (const obs of this.obstacles) {
      if (obs.telegraphMesh && !pulsed) {
        const dist = obs.z - playerZ;
        if (dist > 0 && dist < 50) {
          this.telegraphMat.opacity = pulse;
          this.warningAmberMat.opacity = pulse;
          pulsed = true;
        }
      }

      // Creature idle breathing/bob within active horizon
      if (obs.category === 'solid' && obs.mesh) {
        const dist = obs.z - playerZ;
        if (dist > -10 && dist < 120) {
          const idleBob = Math.sin(timeSeconds * 2.5 + obs.z * 0.4) * 0.035;
          const gH = obs.groundY ?? getTerrainHeight(obs.x, obs.z);
          obs.mesh.position.y = gH + idleBob;
        }
      }
    }

    // 3. Continuous Spawn-Ahead: SPAWN_AHEAD = max(240, playerSpeed * 6)
    const spawnAheadDist = Math.max(240, playerSpeed * 6);
    while (this.lastSpawnZ < playerZ + spawnAheadDist) {
      this.spawnNextRow(playerSpeed);
    }

    // 4. Distance culling behind the player. Arrays are compacted in place so
    // the per-frame path allocates nothing (the arrays keep their identity).
    const cullZ = playerZ - 30;
    const obstacles = this.obstacles;
    let w = 0;
    for (let r = 0; r < obstacles.length; r++) {
      const obs = obstacles[r];
      if (obs.z < cullZ) {
        this.releaseObstacleMesh(obs);
      } else {
        obstacles[w++] = obs;
      }
    }
    obstacles.length = w;

    const coins = this.coins;
    w = 0;
    for (let r = 0; r < coins.length; r++) {
      const c = coins[r];
      if (!(c.z < cullZ || c.collected)) coins[w++] = c;
    }
    coins.length = w;
    this.syncCoinInstances();

    const powerUps = this.powerUps;
    w = 0;
    for (let r = 0; r < powerUps.length; r++) {
      const p = powerUps[r];
      if (p.z < cullZ || p.collected) {
        this.releasePowerUp(p);
      } else {
        powerUps[w++] = p;
      }
    }
    powerUps.length = w;
  }

  attractCoinsToPlayer(playerPos: THREE.Vector3, magnetRadius: number, dt: number): void {
    let moved = false;
    for (const c of this.coins) {
      if (c.collected) continue;
      const dist = Math.hypot(playerPos.x - c.x, playerPos.z - c.z);
      if (dist < magnetRadius) {
        const pullFactor = Math.min(1.0, 16.0 * dt);
        c.x = THREE.MathUtils.lerp(c.x, playerPos.x, pullFactor);
        c.z = THREE.MathUtils.lerp(c.z, playerPos.z, pullFactor);
        c.y = THREE.MathUtils.lerp(c.y, playerPos.y + 0.5, pullFactor);
        // The coin moved: its road height is wherever it is now.
        c.groundY = getTerrainHeight(c.x, c.z);
        moved = true;
      }
    }
    if (moved) this.syncCoinInstances();
  }

  checkCollisions(playerPos: THREE.Vector3, isSliding: boolean): CollisionResult {
    // One result object reused every frame (the engine reads it at once).
    const result = this._collision;
    result.collectedCoins = 0;
    result.hitBoostGate = undefined;
    result.nearMiss = undefined;
    result.nearMissPos = undefined;
    result.isGrinding = undefined;
    result.collectedPowerUp = undefined;
    result.hasCrashed = undefined;
    result.hasStumbled = undefined;
    result.crashedObstacle = undefined;

    const px = playerPos.x;
    const py = playerPos.y;
    const pz = playerPos.z;
    const playerGroundH = getTerrainHeight(px, pz);
    const playerRelY = py - playerGroundH; // Height above track surface (0.55 grounded, ~2.2 jumping apex, ~0.1 sliding)

    // 1. Coins Collection
    for (const c of this.coins) {
      if (c.collected) continue;
      if (Math.abs(c.z - pz) < 1.8 && Math.abs(c.x - px) < 1.35 && Math.abs((c.y - c.groundY) - playerRelY) < 2.2) {
        c.collected = true;
        result.collectedCoins += 1;
      }
    }
    if (result.collectedCoins > 0) this.syncCoinInstances();

    // 2. PowerUps Collection
    for (const p of this.powerUps) {
      if (p.collected) continue;
      const puGroundH = p.groundY ?? getTerrainHeight(p.x, p.z);
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
      const collideHalfWidth = obsHalfWidth + 0.25;

      // Vertical extents relative to the road: the player's body runs from
      // the feet (board) up to head height, the obstacle from its base to top.
      const obsGroundH = obs.groundY ?? getTerrainHeight(obs.x, obs.z);
      const obsCenterRel = obs.y - obsGroundH;
      const obsBottomRel = obsCenterRel - obs.height * 0.5;
      // Solid blocks force a lane change: treat them as taller than any jump
      // apex (~2.8 m) so a well-timed jump can't skip over them.
      const obsTopRel = obs.category === 'solid'
        ? Math.max(obsCenterRel + obs.height * 0.5, SOLID_UNJUMPABLE_TOP)
        : obsCenterRel + obs.height * 0.5;
      const feetRel = playerRelY - PLAYER_HOVER_OFFSET;
      const headRel = feetRel + (isSliding ? PLAYER_SLIDE_HEIGHT : PLAYER_STAND_HEIGHT);
      // Small tolerance so skimming the very top of an obstacle doesn't count.
      const overlapsVertically = feetRel < obsTopRel - 0.08 && headRel > obsBottomRel;

      // Near miss: passing an obstacle in the adjacent lane at speed, just
      // outside its collision box (lanes are 2.6 m apart).
      if (
        !obs.nearMissed &&
        Math.abs(dz) < 1.6 &&
        dx >= collideHalfWidth &&
        dx <= collideHalfWidth + NEAR_MISS_LATERAL_REACH &&
        overlapsVertically &&
        this.lastPlayerSpeed >= NEAR_MISS_MIN_SPEED
      ) {
        obs.nearMissed = true;
        result.nearMiss = true;
        // Scratch vector: consumed by the engine before the next call.
        result.nearMissPos = this._nearMissPosScratch.set(obs.x, obs.y, obs.z);
      }

      // Physical Collision
      if (Math.abs(dz) < (obsHalfDepth + 0.45) && dx < collideHalfWidth) {
        // Feet above the obstacle top (jumped over it) or body below its base
        // (sliding under an overhead bar): no contact.
        if (!overlapsVertically) {
          continue;
        }
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
      this.releaseObstacleMesh(obstacle);
      this.obstacles.splice(idx, 1);
    }
  }

  clearAhead(playerZ: number, distance: number): void {
    const obstacles = this.obstacles;
    let w = 0;
    for (let r = 0; r < obstacles.length; r++) {
      const obs = obstacles[r];
      if (obs.z >= playerZ && obs.z <= playerZ + distance) {
        this.releaseObstacleMesh(obs);
      } else {
        obstacles[w++] = obs;
      }
    }
    obstacles.length = w;
  }

  /** Remove every spawned item and this manager's queued GLB upgrades. */
  private clearSpawned(): void {
    // Queued upgrades retain despawned groups; drop this manager's entries
    // (other managers' entries, e.g. during a StrictMode remount, are kept).
    ObstacleManager.pendingSpawnCallbacks = ObstacleManager.pendingSpawnCallbacks.filter(e => e.owner !== this);
    while (this.obstacles.length > 0) {
      const obs = this.obstacles.pop();
      if (obs) this.releaseObstacleMesh(obs);
    }
    this.coins.length = 0;
    this.coinMesh.count = 0;
    while (this.powerUps.length > 0) {
      const p = this.powerUps.pop();
      if (p) this.releasePowerUp(p);
    }
  }

  /**
   * Start a new run. Uses a fresh layout seed unless one is given (or the
   * manager was built with a fixed seed for deterministic tests).
   */
  reset(seed?: number): void {
    this.clearSpawned();
    this.lastSpawnZ = 35;
    this.lastPlayerSpeed = 22;
    this.genState = new ObstacleGeneratorState(seed ?? this.fixedSeed ?? randomRunSeed());
    // Retries any obstacle models that failed to load last time (no-op once
    // they're all cached).
    ObstacleManager.schedulePreload();
    this.spawnInitialObstacles();
  }

  /**
   * One small mesh per obstacle material, for the start-up shader warm-up:
   * obstacle types that are not on the road yet (rails, boost gates,
   * overhead beams, power-ups...) otherwise compiled their shader the moment
   * the first one spawned, a 100-1300 ms stall mid-run. The materials are
   * shared: only the returned group's geometry is the caller's to dispose.
   */
  buildWarmupGroup(): THREE.Group {
    const group = new THREE.Group();
    group.name = 'ObstacleWarmup';
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    for (const value of Object.values(this)) {
      if (!value || (value as THREE.Material).isMaterial !== true) continue;
      const mesh = new THREE.Mesh(geometry, value as THREE.Material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
    group.userData.warmupGeometry = geometry;
    return group;
  }

  dispose(): void {
    this.disposed = true;
    this.clearSpawned();
    this.pools.clear();
    this.group.remove(this.coinMesh);
    this.coinMesh.dispose();
    this.scene.remove(this.group);

    // The cached GLB templates are shared by every manager (and by the next
    // run after Quit-to-Menu or a StrictMode remount), so they are not
    // disposed here; they live for the page's lifetime.

    // Dispose this manager's geometries
    this.solidMainGeom.dispose();
    this.solidEdgeGeom.dispose();
    this.solidTelegraphGeom.dispose();
    this.hurdleBeamGeom.dispose();
    this.hurdlePostGeom.dispose();
    this.hurdleTelegraphGeom.dispose();
    this.overheadPostGeom.dispose();
    this.overheadBeamGeom.dispose();
    this.overheadTelegraphGeom.dispose();
    this.coinGeom.dispose();
    this.powerUpGeom.dispose();
    this.railTubeGeom.dispose();
    this.railPostGeom.dispose();
    this.boostPillarGeom.dispose();
    this.boostTopGeom.dispose();
    this.boostLedGeomPost.dispose();
    this.boostLedGeomTop.dispose();

    // Dispose materials
    this.barrierMat.dispose();
    this.barrierBandMat.map?.dispose();
    this.barrierBandMat.dispose();
    this.laserHazardMat.map?.dispose();
    this.laserHazardMat.dispose();
    this.warningAmberMat.map?.dispose();
    this.warningAmberMat.dispose();
    this.cyanNeonMat.dispose();
    this.goldMat.dispose();
    this.telegraphMat.map?.dispose();
    this.telegraphMat.dispose();
    this.railMat.dispose();
    this.railPostMat.dispose();
    this.boostMat.dispose();
    this.boostPostMat.map?.dispose();
    this.boostPostMat.dispose();
    this.boostBrushed?.dispose();
    for (const m of this.boostLedMats) m.dispose();
    this.steelMat.dispose();
  }
}
