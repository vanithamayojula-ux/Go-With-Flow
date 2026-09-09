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
  isGrindRail?: boolean;
  isBoostGate?: boolean;
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
  coins: LaneCoin[] = []; // Data Shards

  lastSpawnZ = 30;
  spawnInterval = 28;
  nextObstacleId = 0;

  // Shared Cyber Geometries & Materials
  private pylonGeom = new THREE.CylinderGeometry(0.18, 0.22, 1.2, 8);
  private pylonMat = new THREE.MeshLambertMaterial({ color: 0x0a101d });
  private laserBeamGeom = new THREE.BoxGeometry(3.6, 0.2, 0.2);
  private laserBeamMat = new THREE.MeshBasicMaterial({ color: 0xff0055 }); // Hot neon red/magenta laser

  private overheadArchPillarGeom = new THREE.CylinderGeometry(0.18, 0.22, 3.4, 6);
  private overheadArchBeamGeom = new THREE.BoxGeometry(4.2, 0.45, 0.45);
  private overheadBeamMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff }); // Electric Cyan laser conduit

  // Data Shard Diamond Geometry
  private dataShardGeom = new THREE.OctahedronGeometry(0.42);
  private dataShardMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });

  // Boost Gate Hexagonal Arch
  private boostGateGeom = new THREE.TorusGeometry(2.4, 0.2, 6, 6);
  private boostGateMat = new THREE.MeshBasicMaterial({ color: 0x00ffaa });

  // Grind Rail Geometry
  private grindRailGeom = new THREE.CylinderGeometry(0.14, 0.14, 22, 8);
  private grindRailMat = new THREE.MeshBasicMaterial({ color: 0xff007f });

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.grindRailGeom.rotateX(Math.PI / 2);
  }

  update(playerZ: number, time: number) {
    // 1. Procedurally spawn cyberpunk obstacle sections ahead
    while (this.lastSpawnZ < playerZ + 220) {
      this.spawnSection(this.lastSpawnZ);
      this.lastSpawnZ += this.spawnInterval + Math.random() * 10;
    }

    // 2. Rotate Data Shards & Power-up pickups
    for (const shard of this.coins) {
      if (!shard.collected) {
        shard.mesh.rotation.y = time * 4.0;
        shard.mesh.rotation.z = Math.sin(time * 3.0) * 0.25;
      }
    }

    for (const p of this.powerUps) {
      if (!p.collected) {
        p.mesh.rotation.y = time * 3.0;
        p.mesh.position.y += Math.sin(time * 4.5) * 0.006;
      }
    }

    // 3. Despawn old obstacles behind player
    this.cullOldInstances(playerZ - 40);
  }

  private spawnSection(z: number) {
    const roll = Math.random();

    if (roll < 0.22) {
      // Grind Rail along lane divider or center lane
      const lane: LaneIndex = (Math.floor(Math.random() * 3) - 1) as LaneIndex;
      this.spawnGrindRail(lane, z);
      this.spawnDataShardArc(lane, z, 6);
    } else if (roll < 0.42) {
      // Boost Gate on one lane + Data Shards corridor
      const lane: LaneIndex = (Math.floor(Math.random() * 3) - 1) as LaneIndex;
      this.spawnBoostGate(lane, z);
      this.spawnDataShardLine(lane, z - 8, 5);
      this.spawnDataShardLine(lane, z + 6, 6);
    } else if (roll < 0.62) {
      // Laser Barrier (Jump over) + Overhead Conduit (Slide under) on adjacent lanes
      const safeLane: LaneIndex = (Math.floor(Math.random() * 3) - 1) as LaneIndex;
      const otherLanes: LaneIndex[] = ([-1, 0, 1] as LaneIndex[]).filter(l => l !== safeLane);

      this.spawnLaserBarrier(otherLanes[0], z);
      if (otherLanes.length > 1) {
        this.spawnOverheadConduit(otherLanes[1], z);
      }
      this.spawnDataShardLine(safeLane, z - 4, 4);

      if (Math.random() < 0.28) {
        this.spawnPowerUp(safeLane, z + 6);
      }
    } else if (roll < 0.82) {
      // Mag-Lev Hover Train with Sloped Aerodynamic Ramp
      const trainLane: LaneIndex = (Math.floor(Math.random() * 3) - 1) as LaneIndex;
      this.spawnMaglevTrain(trainLane, z, true);
    } else {
      // Double Laser Barrier requiring high jump or lane switch
      const openLane: LaneIndex = (Math.floor(Math.random() * 3) - 1) as LaneIndex;
      ([-1, 0, 1] as LaneIndex[]).forEach(l => {
        if (l !== openLane) {
          this.spawnLaserBarrier(l, z);
        }
      });
      this.spawnDataShardLine(openLane, z - 6, 5);
    }
  }

  // --- Cyberpunk Spawn Primitives ---

  private spawnLaserBarrier(lane: LaneIndex, z: number) {
    const x = getLaneX(lane);
    const y = getTerrainHeight(x, z);

    const group = new THREE.Group();

    // Left and right dark titanium pylons
    const pylonLeft = new THREE.Mesh(this.pylonGeom, this.pylonMat);
    pylonLeft.position.set(-1.8, 0.6, 0);
    group.add(pylonLeft);

    const pylonRight = new THREE.Mesh(this.pylonGeom, this.pylonMat);
    pylonRight.position.set(1.8, 0.6, 0);
    group.add(pylonRight);

    // Glowing Neon Laser Beam
    const laser = new THREE.Mesh(this.laserBeamGeom, this.laserBeamMat);
    laser.position.set(0, 0.6, 0);
    group.add(laser);

    group.position.set(x, y, z);
    this.scene.add(group);

    this.obstacles.push({
      id: `laser_${this.nextObstacleId++}`,
      type: 'laser-barrier',
      lane,
      x,
      y,
      z,
      width: 3.6,
      height: 1.1,
      depth: 0.8,
      mesh: group,
      cleared: false,
    });
  }

  private spawnOverheadConduit(lane: LaneIndex, z: number) {
    const x = getLaneX(lane);
    const y = getTerrainHeight(x, z);

    const group = new THREE.Group();

    // Tall side pillars
    const p1 = new THREE.Mesh(this.overheadArchPillarGeom, this.pylonMat);
    p1.position.set(-2.0, 1.7, 0);
    group.add(p1);

    const p2 = new THREE.Mesh(this.overheadArchPillarGeom, this.pylonMat);
    p2.position.set(2.0, 1.7, 0);
    group.add(p2);

    // High Voltage Glowing Beam (Clearance ~1.3m -> must duck/slide!)
    const beam = new THREE.Mesh(this.overheadArchBeamGeom, this.overheadBeamMat);
    beam.position.set(0, 2.0, 0);
    group.add(beam);

    group.position.set(x, y, z);
    this.scene.add(group);

    this.obstacles.push({
      id: `conduit_${this.nextObstacleId++}`,
      type: 'overhead-conduit',
      lane,
      x,
      y,
      z,
      width: 4.0,
      height: 2.2,
      depth: 0.8,
      mesh: group,
      cleared: false,
    });
  }

  private spawnBoostGate(lane: LaneIndex, z: number) {
    const x = getLaneX(lane);
    const y = getTerrainHeight(x, z);

    const group = new THREE.Group();
    const hexArch = new THREE.Mesh(this.boostGateGeom, this.boostGateMat);
    hexArch.position.set(0, 2.2, 0);
    group.add(hexArch);

    group.position.set(x, y, z);
    this.scene.add(group);

    this.obstacles.push({
      id: `boost_gate_${this.nextObstacleId++}`,
      type: 'boost-gate',
      lane,
      x,
      y,
      z,
      width: 3.8,
      height: 3.5,
      depth: 1.2,
      mesh: group,
      isBoostGate: true,
      cleared: false,
    });
  }

  private spawnGrindRail(lane: LaneIndex, z: number) {
    const x = getLaneX(lane);
    const y = getTerrainHeight(x, z);

    const group = new THREE.Group();
    const rail = new THREE.Mesh(this.grindRailGeom, this.grindRailMat);
    rail.position.set(0, 1.1, 0);
    group.add(rail);

    // Stanchion supports
    [-8, 0, 8].forEach(pz => {
      const sup = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 1.1, 6), this.pylonMat);
      sup.position.set(0, 0.55, pz);
      group.add(sup);
    });

    group.position.set(x, y, z);
    this.scene.add(group);

    this.obstacles.push({
      id: `rail_${this.nextObstacleId++}`,
      type: 'grind-rail',
      lane,
      x,
      y,
      z,
      width: 1.2,
      height: 1.5,
      depth: 22.0,
      mesh: group,
      isGrindRail: true,
      cleared: false,
    });
  }

  private spawnMaglevTrain(lane: LaneIndex, z: number, withRamp: boolean) {
    const x = getLaneX(lane);
    const y = getTerrainHeight(x, z);

    const group = new THREE.Group();

    // Streamlined aerodynamic hover train car
    const trainLength = 24.0;
    const trainGeom = new THREE.BoxGeometry(3.6, 2.8, trainLength);
    const trainMat = new THREE.MeshLambertMaterial({ color: 0x0c1220 });
    const trainBody = new THREE.Mesh(trainGeom, trainMat);
    trainBody.position.set(0, 1.4, 0);
    group.add(trainBody);

    // Glowing Neon Side Windows (Cyan strips)
    const windowGeom = new THREE.BoxGeometry(3.65, 0.4, trainLength * 0.85);
    const windowMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    const windows = new THREE.Mesh(windowGeom, windowMat);
    windows.position.set(0, 2.0, 0);
    group.add(windows);

    // Front Aerodynamic Cowcatcher Wedge Ramp
    if (withRamp) {
      const rampLength = 7.0;
      const rampGeom = new THREE.BufferGeometry();
      const hw = 1.8;
      const vertices = new Float32Array([
        -hw, 0.1, -rampLength,
        hw, 0.1, -rampLength,
        hw, 2.8, 0,
        -hw, 0.1, -rampLength,
        hw, 2.8, 0,
        -hw, 2.8, 0,
      ]);
      rampGeom.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
      rampGeom.computeVertexNormals();

      const rampMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff, wireframe: false });
      const rampMesh = new THREE.Mesh(rampGeom, rampMat);
      rampMesh.position.set(0, 0, -trainLength / 2);
      group.add(rampMesh);
    }

    group.position.set(x, y, z);
    this.scene.add(group);

    this.obstacles.push({
      id: `maglev_${this.nextObstacleId++}`,
      type: withRamp ? 'maglev-ramp' : 'maglev-hauler',
      lane,
      x,
      y,
      z,
      width: 3.6,
      height: 2.8,
      depth: trainLength,
      mesh: group,
      hasRamp: withRamp,
      rampStartZ: z - trainLength / 2 - 7.0,
      cleared: false,
    });

    // Data Shards line along roof of the train
    this.spawnDataShardLine(lane, z - 8, 5, y + 3.4);
  }

  // --- Collectible Data Shards ---

  private spawnDataShardLine(lane: LaneIndex, startZ: number, count: number, customY?: number) {
    const x = getLaneX(lane);
    for (let i = 0; i < count; i++) {
      const z = startZ + i * 3.5;
      const y = customY !== undefined ? customY : getTerrainHeight(x, z) + 1.2;

      const shard = new THREE.Mesh(this.dataShardGeom, this.dataShardMat);
      shard.position.set(x, y, z);
      this.scene.add(shard);

      this.coins.push({
        id: `shard_${this.nextObstacleId++}`,
        x,
        y,
        z,
        lane,
        mesh: shard,
        collected: false,
      });
    }
  }

  private spawnDataShardArc(lane: LaneIndex, startZ: number, count: number) {
    const x = getLaneX(lane);
    for (let i = 0; i < count; i++) {
      const frac = i / (count - 1);
      const arcY = Math.sin(frac * Math.PI) * 3.8;
      const z = startZ + i * 3.2;
      const y = getTerrainHeight(x, z) + 1.2 + arcY;

      const shard = new THREE.Mesh(this.dataShardGeom, this.dataShardMat);
      shard.position.set(x, y, z);
      this.scene.add(shard);

      this.coins.push({
        id: `shard_arc_${this.nextObstacleId++}`,
        x,
        y,
        z,
        lane,
        mesh: shard,
        collected: false,
      });
    }
  }

  private spawnPowerUp(lane: LaneIndex, z: number) {
    const x = getLaneX(lane);
    const y = getTerrainHeight(x, z) + 1.4;

    const types: PowerUpType[] = ['quantum-magnet', 'sonic-jetpack', 'holo-shield', 'overdrive-2x'];
    const type = types[Math.floor(Math.random() * types.length)];

    const group = new THREE.Group();

    // Holographic Cyber Power-Up Container
    const coreMat = new THREE.MeshBasicMaterial({
      color: type === 'quantum-magnet' ? 0x00f0ff : type === 'sonic-jetpack' ? 0xff00ff : type === 'holo-shield' ? 0x00ff88 : 0xffaa00,
    });

    const box = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.9), coreMat);
    group.add(box);

    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.08, 8, 16), coreMat);
    group.add(ring);

    group.position.set(x, y, z);
    this.scene.add(group);

    this.powerUps.push({
      id: `p_${this.nextObstacleId++}`,
      type,
      lane,
      x,
      y,
      z,
      mesh: group,
      collected: false,
    });
  }

  // --- Collision Detection ---

  checkCollisions(
    playerPos: THREE.Vector3,
    isSliding: boolean
  ): {
    hasCrashed: boolean;
    crashedObstacle?: ObstacleInstance;
    isGrinding: boolean;
    hitBoostGate: boolean;
    collectedCoins: number;
    collectedPowerUp?: PowerUpType;
  } {
    let hasCrashed = false;
    let crashedObstacle: ObstacleInstance | undefined;
    let isGrinding = false;
    let hitBoostGate = false;
    let collectedCoins = 0;
    let collectedPowerUp: PowerUpType | undefined;

    // 1. Data Shards Collection
    for (const shard of this.coins) {
      if (shard.collected) continue;
      const dx = playerPos.x - shard.x;
      const dy = playerPos.y - shard.y;
      const dz = playerPos.z - shard.z;
      const distSq = dx * dx + dy * dy + dz * dz;

      if (distSq < 2.6 * 2.6) {
        shard.collected = true;
        this.scene.remove(shard.mesh);
        shard.mesh.geometry.dispose();
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

      if (distSq < 3.0 * 3.0) {
        p.collected = true;
        this.scene.remove(p.mesh);
        collectedPowerUp = p.type;
      }
    }

    // 3. Obstacle Collision & Interactivity Checks
    for (const obs of this.obstacles) {
      if (obs.cleared) continue;

      const halfDepth = obs.depth / 2 + 0.8;
      const dz = playerPos.z - obs.z;
      if (Math.abs(dz) > halfDepth) continue;

      const halfWidth = obs.width / 2 + 0.5;
      const dx = playerPos.x - obs.x;
      if (Math.abs(dx) > halfWidth) continue;

      // Handle Grind Rails
      if (obs.isGrindRail) {
        if (Math.abs(dx) < 1.4 && playerPos.y >= obs.y + 0.8 && playerPos.y <= obs.y + 2.2) {
          isGrinding = true;
          playerPos.y = obs.y + 1.25; // Magnetically lock onto rail
        }
        continue;
      }

      // Handle Boost Gates
      if (obs.isBoostGate) {
        if (Math.abs(dz) < 1.5) {
          hitBoostGate = true;
          obs.cleared = true;
        }
        continue;
      }

      // Handle Laser Barrier (Jump over)
      if (obs.type === 'laser-barrier' || obs.type === 'low-hurdle') {
        const barrierTop = obs.y + obs.height;
        if (playerPos.y > barrierTop + 0.15) {
          obs.cleared = true;
        } else {
          hasCrashed = true;
          crashedObstacle = obs;
          break;
        }
      } else if (obs.type === 'overhead-conduit' || obs.type === 'high-barrier') {
        if (isSliding) {
          obs.cleared = true; // Safely slid underneath!
        } else {
          hasCrashed = true;
          crashedObstacle = obs;
          break;
        }
      } else if (obs.type === 'maglev-hauler' || obs.type === 'maglev-ramp' || obs.type === 'spirit-train' || obs.type === 'spirit-train-ramp') {
        const trainTop = obs.y + obs.height;
        if (playerPos.y >= trainTop - 0.3) {
          // Skating along roof!
        } else if (obs.hasRamp && dz < 0 && dz > -obs.depth / 2 - 7.5) {
          // Riding up front cowcatcher ramp!
        } else {
          hasCrashed = true;
          crashedObstacle = obs;
          break;
        }
      }
    }

    return { hasCrashed, crashedObstacle, isGrinding, hitBoostGate, collectedCoins, collectedPowerUp };
  }

  // Magnet effect: attract nearby data shards
  attractCoinsToPlayer(playerPos: THREE.Vector3, radius = 28.0, dt = 0.016) {
    for (const shard of this.coins) {
      if (shard.collected) continue;
      const dx = playerPos.x - shard.x;
      const dy = playerPos.y - shard.y;
      const dz = playerPos.z - shard.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (dist < radius) {
        const pullSpeed = 32.0 * dt;
        shard.x += (dx / dist) * pullSpeed;
        shard.y += (dy / dist) * pullSpeed;
        shard.z += (dz / dist) * pullSpeed;
        shard.mesh.position.set(shard.x, shard.y, shard.z);
      }
    }
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
