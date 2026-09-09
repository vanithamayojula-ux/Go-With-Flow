import * as THREE from 'three';
import { getTerrainHeight } from './terrain';
import { LaneIndex, ObstacleType, PowerUpType } from '../types';

export const LANE_WIDTH = 4.2;

export function getLaneX(lane: LaneIndex): number {
  return lane * LANE_WIDTH;
}

export interface ObstacleInstance {
  id: string;
  type: ObstacleType;
  lane: LaneIndex;
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  depth: number;
  mesh: THREE.Group;
  hasRamp?: boolean;
  rampStartZ?: number;
  cleared: boolean;
}

export interface PowerUpPickup {
  id: string;
  type: PowerUpType;
  lane: LaneIndex;
  x: number;
  y: number;
  z: number;
  mesh: THREE.Group;
  collected: boolean;
}

export interface LaneCoin {
  id: string;
  x: number;
  y: number;
  z: number;
  lane: LaneIndex;
  mesh: THREE.Mesh;
  collected: boolean;
}

export class ObstacleManager {
  scene: THREE.Scene;
  obstacles: ObstacleInstance[] = [];
  powerUps: PowerUpPickup[] = [];
  coins: LaneCoin[] = [];

  lastSpawnZ = 30;
  spawnInterval = 28;
  nextObstacleId = 0;

  // Shared Geometries & Materials
  private hurdleGeom = new THREE.BoxGeometry(3.6, 1.1, 0.6);
  private hurdleMat = new THREE.MeshLambertMaterial({ color: 0x8b6544 });
  private hurdleAccentMat = new THREE.MeshLambertMaterial({ color: 0xd97706 });

  private archBeamGeom = new THREE.BoxGeometry(4.2, 0.5, 0.6);
  private archPillarGeom = new THREE.CylinderGeometry(0.18, 0.22, 3.4, 6);
  private archMat = new THREE.MeshLambertMaterial({ color: 0xc94a29 }); // Ghibli vermilion red

  private coinGeom = new THREE.CylinderGeometry(0.38, 0.38, 0.08, 12);
  private coinMat = new THREE.MeshBasicMaterial({ color: 0xffd54f });

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.coinGeom.rotateZ(Math.PI / 2);
  }

  update(playerZ: number, time: number) {
    // 1. Procedurally spawn obstacle sections ahead
    while (this.lastSpawnZ < playerZ + 220) {
      this.spawnSection(this.lastSpawnZ);
      this.lastSpawnZ += this.spawnInterval + Math.random() * 12;
    }

    // 2. Rotate Coins & Power-up pickups
    for (const coin of this.coins) {
      if (!coin.collected) {
        coin.mesh.rotation.y = time * 3.5;
      }
    }
    for (const p of this.powerUps) {
      if (!p.collected) {
        p.mesh.rotation.y = time * 2.5;
        p.mesh.position.y += Math.sin(time * 4.0) * 0.005;
      }
    }

    // 3. Despawn old obstacles behind player
    this.cullOldInstances(playerZ - 40);
  }

  private spawnSection(z: number) {
    const sectionType = Math.random();
    const lanes: LaneIndex[] = [-1, 0, 1];

    if (sectionType < 0.30) {
      // Pattern A: Low Hurdle in 1 or 2 lanes (Must jump over)
      const blockedLane = lanes[Math.floor(Math.random() * lanes.length)];
      this.createLowHurdle(blockedLane, z);
      this.spawnCoinArc(blockedLane, z - 8, z + 8, true);

      // Other lanes get ground coin runs
      const freeLanes = lanes.filter(l => l !== blockedLane);
      const coinLane = freeLanes[Math.floor(Math.random() * freeLanes.length)];
      this.spawnCoinRun(coinLane, z - 6, z + 6);
    } else if (sectionType < 0.60) {
      // Pattern B: High Barrier in 1 or 2 lanes (Must slide under)
      const barrierLane = lanes[Math.floor(Math.random() * lanes.length)];
      this.createHighBarrier(barrierLane, z);
      this.spawnCoinRun(barrierLane, z - 6, z + 6, 0.4); // Low coins under barrier!

      if (Math.random() < 0.35) {
        const powerLane = lanes.find(l => l !== barrierLane) ?? 0;
        this.spawnRandomPowerUp(powerLane, z);
      }
    } else if (sectionType < 0.85) {
      // Pattern C: Spirit Train / Caravan in 1 lane with front ramp
      const trainLane = lanes[Math.floor(Math.random() * lanes.length)];
      const hasRamp = Math.random() < 0.65;
      this.createSpiritTrain(trainLane, z, hasRamp);

      if (hasRamp) {
        // Coin run on the train roof!
        this.spawnCoinRun(trainLane, z - 4, z + 10, 3.4);
      }
    } else {
      // Pattern D: Open Lane Run with rare Power-Up & Coin Ribbon
      const powerLane = lanes[Math.floor(Math.random() * lanes.length)];
      this.spawnRandomPowerUp(powerLane, z);
      for (const l of lanes) {
        if (l !== powerLane) {
          this.spawnCoinRun(l, z - 10, z + 10);
        }
      }
    }
  }

  // --- Obstacle Builders ---

  private createLowHurdle(lane: LaneIndex, z: number) {
    const x = getLaneX(lane);
    const y = getTerrainHeight(x, z);

    const group = new THREE.Group();
    group.position.set(x, y, z);

    const hurdle = new THREE.Mesh(this.hurdleGeom, this.hurdleMat);
    hurdle.position.y = 0.55;
    group.add(hurdle);

    // Accent top rail
    const rail = new THREE.Mesh(new THREE.BoxGeometry(3.7, 0.2, 0.7), this.hurdleAccentMat);
    rail.position.y = 1.1;
    group.add(rail);

    this.scene.add(group);

    this.obstacles.push({
      id: `hurdle-${this.nextObstacleId++}`,
      type: 'low-hurdle',
      lane,
      x,
      y,
      z,
      width: 3.6,
      height: 1.2,
      depth: 0.8,
      mesh: group,
      cleared: false,
    });
  }

  private createHighBarrier(lane: LaneIndex, z: number) {
    const x = getLaneX(lane);
    const y = getTerrainHeight(x, z);

    const group = new THREE.Group();
    group.position.set(x, y, z);

    // Left Pillar
    const leftPillar = new THREE.Mesh(this.archPillarGeom, this.archMat);
    leftPillar.position.set(-1.9, 1.7, 0);
    group.add(leftPillar);

    // Right Pillar
    const rightPillar = new THREE.Mesh(this.archPillarGeom, this.archMat);
    rightPillar.position.set(1.9, 1.7, 0);
    group.add(rightPillar);

    // High Crossbeam (Clearance 1.8m underneath — must duck/slide!)
    const beam = new THREE.Mesh(this.archBeamGeom, this.archMat);
    beam.position.set(0, 2.35, 0);
    group.add(beam);

    // Glowing Ghibli talisman lantern in center
    const talisman = new THREE.Mesh(
      new THREE.SphereGeometry(0.24, 6, 6),
      new THREE.MeshBasicMaterial({ color: 0xffe082 })
    );
    talisman.position.set(0, 2.0, 0);
    group.add(talisman);

    this.scene.add(group);

    this.obstacles.push({
      id: `barrier-${this.nextObstacleId++}`,
      type: 'high-barrier',
      lane,
      x,
      y,
      z,
      width: 3.8,
      height: 2.8,
      depth: 0.8,
      mesh: group,
      cleared: false,
    });
  }

  private createSpiritTrain(lane: LaneIndex, z: number, hasRamp: boolean) {
    const x = getLaneX(lane);
    const y = getTerrainHeight(x, z);

    const group = new THREE.Group();
    group.position.set(x, y, z);

    const trainLen = 14.0;
    const trainHeight = 2.8;
    const trainWidth = 3.6;

    // Train Body (Ghibli deep indigo/forest teal enamel)
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0x1f425b });
    const roofMat = new THREE.MeshLambertMaterial({ color: 0xd97706 });
    const windowMat = new THREE.MeshBasicMaterial({ color: 0xffe082 });

    const bodyGeom = new THREE.BoxGeometry(trainWidth, trainHeight, trainLen);
    const body = new THREE.Mesh(bodyGeom, bodyMat);
    body.position.y = trainHeight / 2;
    group.add(body);

    // Roof Surfing Platform
    const roofGeom = new THREE.BoxGeometry(trainWidth * 0.96, 0.25, trainLen * 0.98);
    const roof = new THREE.Mesh(roofGeom, roofMat);
    roof.position.y = trainHeight + 0.12;
    group.add(roof);

    // Glowing Warm Windows along sides
    for (let w = -trainLen / 2 + 2; w <= trainLen / 2 - 2; w += 2.8) {
      const winL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.9, 1.4), windowMat);
      winL.position.set(-trainWidth / 2 - 0.04, 1.6, w);
      group.add(winL);

      const winR = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.9, 1.4), windowMat);
      winR.position.set(trainWidth / 2 + 0.04, 1.6, w);
      group.add(winR);
    }

    // Front Sloped Wooden Ramp to surf up!
    if (hasRamp) {
      const rampLen = 6.0;
      const rampGeom = new THREE.BoxGeometry(trainWidth * 0.92, 0.35, rampLen);
      const ramp = new THREE.Mesh(rampGeom, roofMat);
      // Incline ramp from ground to train top
      ramp.position.set(0, trainHeight / 2, -trainLen / 2 - rampLen / 2 + 0.4);
      ramp.rotation.x = Math.atan2(trainHeight, rampLen);
      group.add(ramp);
    }

    this.scene.add(group);

    this.obstacles.push({
      id: `train-${this.nextObstacleId++}`,
      type: hasRamp ? 'spirit-train-ramp' : 'spirit-train',
      lane,
      x,
      y,
      z,
      width: trainWidth,
      height: trainHeight,
      depth: trainLen,
      mesh: group,
      hasRamp,
      rampStartZ: z - trainLen / 2 - 5.5,
      cleared: false,
    });
  }

  // --- Coins & Power-Ups ---

  private spawnCoinRun(lane: LaneIndex, startZ: number, endZ: number, yOffset = 0.5) {
    const x = getLaneX(lane);
    for (let cz = startZ; cz <= endZ; cz += 2.4) {
      const cy = getTerrainHeight(x, cz) + yOffset;
      const coinMesh = new THREE.Mesh(this.coinGeom, this.coinMat);
      coinMesh.position.set(x, cy, cz);
      this.scene.add(coinMesh);

      this.coins.push({
        id: `coin-${cz.toFixed(1)}-${lane}`,
        x,
        y: cy,
        z: cz,
        lane,
        mesh: coinMesh,
        collected: false,
      });
    }
  }

  private spawnCoinArc(lane: LaneIndex, startZ: number, endZ: number, overHurdle = true) {
    const x = getLaneX(lane);
    const count = 6;
    const step = (endZ - startZ) / count;

    for (let i = 0; i <= count; i++) {
      const cz = startZ + i * step;
      const progress = i / count;
      const arcHeight = Math.sin(progress * Math.PI) * (overHurdle ? 2.6 : 1.8);
      const cy = getTerrainHeight(x, cz) + 0.6 + arcHeight;

      const coinMesh = new THREE.Mesh(this.coinGeom, this.coinMat);
      coinMesh.position.set(x, cy, cz);
      this.scene.add(coinMesh);

      this.coins.push({
        id: `coin-arc-${cz.toFixed(1)}-${lane}`,
        x,
        y: cy,
        z: cz,
        lane,
        mesh: coinMesh,
        collected: false,
      });
    }
  }

  private spawnRandomPowerUp(lane: LaneIndex, z: number) {
    const types: PowerUpType[] = ['magnet', 'jetpack', 'hoverboard-shield', 'multiplier2x'];
    const pType = types[Math.floor(Math.random() * types.length)];
    const x = getLaneX(lane);
    const y = getTerrainHeight(x, z) + 1.2;

    const group = new THREE.Group();
    group.position.set(x, y, z);

    let pickupMesh: THREE.Mesh;
    if (pType === 'magnet') {
      pickupMesh = new THREE.Mesh(
        new THREE.TorusGeometry(0.5, 0.16, 8, 16, Math.PI),
        new THREE.MeshLambertMaterial({ color: 0xef4444 })
      );
      pickupMesh.rotation.z = Math.PI;
    } else if (pType === 'jetpack') {
      pickupMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.32, 0.32, 1.1, 8),
        new THREE.MeshLambertMaterial({ color: 0x06b6d4 })
      );
    } else if (pType === 'multiplier2x') {
      pickupMesh = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.55),
        new THREE.MeshLambertMaterial({ color: 0xf59e0b })
      );
    } else {
      pickupMesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.48, 8, 8),
        new THREE.MeshLambertMaterial({ color: 0x10b981 })
      );
    }

    group.add(pickupMesh);

    // Glowing halo ring
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.7, 0.85, 16),
      new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true, opacity: 0.7 })
    );
    ring.rotation.x = Math.PI / 2;
    group.add(ring);

    this.scene.add(group);

    this.powerUps.push({
      id: `powerup-${z}-${lane}`,
      type: pType,
      lane,
      x,
      y,
      z,
      mesh: group,
      collected: false,
    });
  }

  // --- Collision & Pickup Queries ---

  checkCollisions(
    playerPos: THREE.Vector3,
    isSliding: boolean,
    isJumping: boolean
  ): {
    hasCrashed: boolean;
    crashedObstacle?: ObstacleInstance;
    collectedCoins: number;
    collectedPowerUp?: PowerUpType;
  } {
    let hasCrashed = false;
    let crashedObstacle: ObstacleInstance | undefined;
    let collectedCoins = 0;
    let collectedPowerUp: PowerUpType | undefined;

    // 1. Coin Pickups
    for (const coin of this.coins) {
      if (coin.collected) continue;
      const dx = playerPos.x - coin.x;
      const dy = playerPos.y - coin.y;
      const dz = playerPos.z - coin.z;
      const distSq = dx * dx + dy * dy + dz * dz;

      if (distSq < 2.5 * 2.5) {
        coin.collected = true;
        this.scene.remove(coin.mesh);
        coin.mesh.geometry.dispose();
        collectedCoins++;
      }
    }

    // 2. Power-Up Pickups
    for (const p of this.powerUps) {
      if (p.collected) continue;
      const dx = playerPos.x - p.x;
      const dy = playerPos.y - p.y;
      const dz = playerPos.z - p.z;
      const distSq = dx * dx + dy * dy + dz * dz;

      if (distSq < 2.8 * 2.8) {
        p.collected = true;
        this.scene.remove(p.mesh);
        collectedPowerUp = p.type;
      }
    }

    // 3. Obstacle Collision Detection
    for (const obs of this.obstacles) {
      if (obs.cleared) continue;

      // Z-range overlap
      const halfDepth = obs.depth / 2 + 0.8;
      const dz = playerPos.z - obs.z;
      if (Math.abs(dz) > halfDepth) continue;

      // X-range overlap
      const halfWidth = obs.width / 2 + 0.4;
      const dx = playerPos.x - obs.x;
      if (Math.abs(dx) > halfWidth) continue;

      // Type-specific Y height checks
      if (obs.type === 'low-hurdle') {
        const hurdleTop = obs.y + obs.height;
        if (playerPos.y > hurdleTop + 0.1) {
          // Cleared via jump!
          obs.cleared = true;
        } else {
          // Struck hurdle!
          hasCrashed = true;
          crashedObstacle = obs;
          break;
        }
      } else if (obs.type === 'high-barrier') {
        if (isSliding) {
          // Cleared via slide / ducking underneath!
          obs.cleared = true;
        } else {
          // Stood up or jumped into overhead barrier!
          hasCrashed = true;
          crashedObstacle = obs;
          break;
        }
      } else if (obs.type === 'spirit-train' || obs.type === 'spirit-train-ramp') {
        const trainTop = obs.y + obs.height;
        if (playerPos.y >= trainTop - 0.25) {
          // Surfing along the roof!
        } else if (obs.hasRamp && dz < 0 && dz > -obs.depth / 2 - 6.0) {
          // Riding up the front ramp onto roof!
        } else {
          // Struck side or front of train!
          hasCrashed = true;
          crashedObstacle = obs;
          break;
        }
      }
    }

    return { hasCrashed, crashedObstacle, collectedCoins, collectedPowerUp };
  }

  // Magnet effect: attract nearby coins to player
  attractCoinsToPlayer(playerPos: THREE.Vector3, radius = 16.0, dt = 0.016) {
    for (const coin of this.coins) {
      if (coin.collected) continue;
      const dx = playerPos.x - coin.x;
      const dy = playerPos.y - coin.y;
      const dz = playerPos.z - coin.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (dist < radius) {
        const pullSpeed = 24.0 * dt;
        coin.x += (dx / dist) * pullSpeed;
        coin.y += (dy / dist) * pullSpeed;
        coin.z += (dz / dist) * pullSpeed;
        coin.mesh.position.set(coin.x, coin.y, coin.z);
      }
    }
  }

  cullOldInstances(minZ: number) {
    this.obstacles = this.obstacles.filter(obs => {
      if (obs.z < minZ) {
        this.scene.remove(obs.mesh);
        return false;
      }
      return true;
    });

    this.coins = this.coins.filter(c => {
      if (c.z < minZ || c.collected) {
        this.scene.remove(c.mesh);
        return false;
      }
      return true;
    });

    this.powerUps = this.powerUps.filter(p => {
      if (p.z < minZ || p.collected) {
        this.scene.remove(p.mesh);
        return false;
      }
      return true;
    });
  }

  removeObstacle(obstacle: ObstacleInstance) {
    this.scene.remove(obstacle.mesh);
    this.obstacles = this.obstacles.filter(o => o.id !== obstacle.id);
  }

  clearAhead(playerZ: number, distance = 60) {
    this.obstacles = this.obstacles.filter(obs => {
      if (obs.z >= playerZ - 5 && obs.z <= playerZ + distance) {
        this.scene.remove(obs.mesh);
        return false;
      }
      return true;
    });
  }

  reset() {
    for (const obs of this.obstacles) this.scene.remove(obs.mesh);
    for (const c of this.coins) this.scene.remove(c.mesh);
    for (const p of this.powerUps) this.scene.remove(p.mesh);
    this.obstacles = [];
    this.coins = [];
    this.powerUps = [];
    this.lastSpawnZ = 30;
    this.nextObstacleId = 0;
  }
}
