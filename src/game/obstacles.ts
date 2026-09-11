import * as THREE from 'three';
import { getTerrainHeight } from './terrain';
import { BiomeType, LaneIndex, ObstacleType, PowerUpType } from '../types';
import { WORLD_THEMES } from './worldThemes';

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
  isPortal?: boolean;
  targetBiome?: BiomeType;
  targetThemeId?: string;
  baseX?: number;
  nearMissAwarded?: boolean;
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
  private pylonGeom = new THREE.CylinderGeometry(0.2, 0.28, 1.4, 8);
  private pylonMat = new THREE.MeshBasicMaterial({ color: 0xff0033 });
  private laserBeamGeom = new THREE.BoxGeometry(3.8, 0.45, 0.45); // Thick glowing neon laser beam
  private laserBeamMat = new THREE.MeshBasicMaterial({ color: 0xff0033 }); // Hot neon red laser

  private overheadArchPillarGeom = new THREE.CylinderGeometry(0.2, 0.25, 3.4, 6);
  private overheadArchBeamGeom = new THREE.BoxGeometry(4.2, 0.55, 0.55);
  private overheadBeamMat = new THREE.MeshBasicMaterial({ color: 0xff0033 }); // Hot neon red overhead laser conduit

  // Data Shard Diamond Geometry
  private dataShardGeom = new THREE.OctahedronGeometry(0.48);
  private dataShardMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });

  // Boost Gate Hexagonal Arch
  private boostGateGeom = new THREE.TorusGeometry(2.4, 0.2, 6, 6);
  private boostGateMat = new THREE.MeshBasicMaterial({ color: 0x00ffaa });

  // Grind Rail Geometry
  private grindRailGeom = new THREE.CylinderGeometry(0.16, 0.16, 22, 8);
  private grindRailMat = new THREE.MeshBasicMaterial({ color: 0xff007f });

  // Drone Hazard & Energy Fence Materials (High-Contrast Lethal Red)
  private droneBodyGeom = new THREE.OctahedronGeometry(0.6);
  private droneEyeGeom = new THREE.SphereGeometry(0.25, 8, 8);
  private droneHazardMat = new THREE.MeshBasicMaterial({ color: 0xff0033 });
  private droneChassisMat = new THREE.MeshBasicMaterial({ color: 0xff0033 });

  private fenceBarGeom = new THREE.BoxGeometry(3.8, 0.5, 0.2);
  private fenceMat = new THREE.MeshBasicMaterial({ color: 0xff0033 });

  // New Obstacle Geometries & High-Contrast Lethal Red Materials
  private movingBarrierGeom = new THREE.BoxGeometry(3.6, 0.7, 0.5);
  private movingBarrierMat = new THREE.MeshBasicMaterial({ color: 0xff0033 });

  private fallingBlockGeom = new THREE.BoxGeometry(2.4, 2.4, 2.4);
  private fallingBlockMat = new THREE.MeshBasicMaterial({ color: 0xff0033 });
  private fallingBlockGlowMat = new THREE.MeshBasicMaterial({ color: 0xff0033 });

  private pulsingLaserGeom = new THREE.CylinderGeometry(0.08, 0.08, 4.4, 8);
  private pulsingLaserMat = new THREE.MeshBasicMaterial({ color: 0xff0033, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending });

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.grindRailGeom.rotateX(Math.PI / 2);
  }

  update(playerZ: number, time: number) {
    const dt = 0.016;

    // Difficulty scaling: spawnInterval ramps from 28 down to 18 as playerZ increases
    const diffFactor = Math.min(1.0, Math.max(0.0, playerZ / 1500));
    this.spawnInterval = 28 - diffFactor * 10;
    const droneAggression = 1.0 + diffFactor * 0.75;

    // 1. Procedurally spawn cyberpunk obstacle sections ahead
    while (this.lastSpawnZ < playerZ + 220) {
      this.spawnSection(this.lastSpawnZ, diffFactor);
      this.lastSpawnZ += this.spawnInterval + Math.random() * 8;
    }

    // 2. Animate dynamic hazards & obstacles
    for (const obs of this.obstacles) {
      if (obs.cleared) continue;

      if (obs.type === 'moving-horizontal-barrier') {
        const base = obs.baseX ?? obs.x;
        obs.x = base + Math.sin(time * 3.2 * droneAggression + obs.z * 0.1) * 2.2;
        obs.mesh.position.x = obs.x;
      } else if (obs.type === 'falling-security-block') {
        const distZ = obs.z - playerZ;
        if (distZ < 65 && distZ > -10) {
          const targetY = getTerrainHeight(obs.x, obs.z) + 1.2;
          obs.y = THREE.MathUtils.lerp(obs.y, targetY, dt * 10.0 * droneAggression);
          obs.mesh.position.y = obs.y;
        }
      } else if (obs.type === 'pulsing-laser-beam') {
        const pulse = Math.sin(time * 8.0 * droneAggression) * 0.35 + 0.65;
        obs.mesh.traverse(child => {
          if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshBasicMaterial) {
            child.material.opacity = pulse;
          }
        });
      } else if (obs.type === 'drone-hazard') {
        const base = obs.baseX ?? obs.x;
        obs.x = base + Math.sin(time * 2.8 * droneAggression + obs.z) * 1.8;
        obs.mesh.position.x = obs.x;
        obs.mesh.position.y = obs.y + Math.sin(time * 4.0) * 0.25;
      }
    }

    // 3. Rotate Data Shards & Power-up pickups
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

    // 4. Despawn old obstacles behind player
    this.cullOldInstances(playerZ - 40);
  }

  lastPortalZ = 120;
  portalBiomes: BiomeType[] = WORLD_THEMES.map(t => t.id as BiomeType);
  portalIndex = 0;

  private spawnSection(z: number, diffFactor = 0) {
    // Periodically spawn a World Portal Gateway every ~280-380 meters
    if (z - this.lastPortalZ > 300 + Math.random() * 80) {
      this.lastPortalZ = z;
      const lane: LaneIndex = (Math.floor(Math.random() * 3) - 1) as LaneIndex;
      const targetBiome = this.portalBiomes[this.portalIndex % this.portalBiomes.length];
      this.portalIndex++;
      this.spawnWorldPortal(lane, z, targetBiome);
      return;
    }

    // Skill-based sequence patterns at higher difficulty
    const useSequence = Math.random() < (0.2 + diffFactor * 0.5);
    if (useSequence) {
      const patternChoice = Math.floor(Math.random() * 4);
      const mainLane: LaneIndex = (Math.floor(Math.random() * 3) - 1) as LaneIndex;
      const altLane: LaneIndex = (mainLane === 0 ? 1 : 0) as LaneIndex;

      if (patternChoice === 0) {
        // Pattern A: Slide under conduit -> Jump over laser barrier -> Data Shards arc
        this.spawnOverheadConduit(mainLane, z);
        this.spawnLaserBarrier(mainLane, z + 18);
        this.spawnDataShardArc(mainLane, z + 18, 5);
      } else if (patternChoice === 1) {
        // Pattern B: Maglev train ramp -> Roof data shards -> Rail grind transfer
        this.spawnMaglevTrain(mainLane, z, true);
        this.spawnGrindRail(altLane, z + 26);
      } else if (patternChoice === 2) {
        // Pattern C: Dual pulsing lasers -> Boost gate exit
        this.spawnPulsingLaserBeam(-1, z);
        this.spawnPulsingLaserBeam(1, z + 14);
        this.spawnBoostGate(0, z + 28);
      } else {
        // Pattern D: Falling security block -> Drifting drone -> Power-up reward
        this.spawnFallingSecurityBlock(mainLane, z);
        this.spawnDroneHazard(altLane, z + 16);
        this.spawnPowerUp(mainLane, z + 28);
      }
      return;
    }

    const roll = Math.random();

    if (roll < 0.14) {
      // Moving Horizontal Barrier
      const lane: LaneIndex = (Math.floor(Math.random() * 3) - 1) as LaneIndex;
      this.spawnMovingHorizontalBarrier(lane, z);
      this.spawnDataShardLine(lane === 0 ? 1 : 0, z - 4, 4);
    } else if (roll < 0.26) {
      // Falling Security Block
      const lane: LaneIndex = (Math.floor(Math.random() * 3) - 1) as LaneIndex;
      this.spawnFallingSecurityBlock(lane, z);
      this.spawnDataShardLine(lane === 0 ? -1 : 0, z - 4, 4);
    } else if (roll < 0.38) {
      // Pulsing Laser Beam
      const lane: LaneIndex = (Math.floor(Math.random() * 3) - 1) as LaneIndex;
      this.spawnPulsingLaserBeam(lane, z);
      this.spawnDataShardLine(lane, z + 4, 4);
    } else if (roll < 0.50) {
      // Grind Rail along lane divider or center lane
      const lane: LaneIndex = (Math.floor(Math.random() * 3) - 1) as LaneIndex;
      this.spawnGrindRail(lane, z);
      this.spawnDataShardArc(lane, z, 6);
    } else if (roll < 0.62) {
      // Boost Gate on one lane + Data Shards corridor
      const lane: LaneIndex = (Math.floor(Math.random() * 3) - 1) as LaneIndex;
      this.spawnBoostGate(lane, z);
      this.spawnDataShardLine(lane, z - 8, 5);
      this.spawnDataShardLine(lane, z + 6, 6);
    } else if (roll < 0.74) {
      // Drifting Drone Hazard patrolling a lane
      const droneLane: LaneIndex = (Math.floor(Math.random() * 3) - 1) as LaneIndex;
      this.spawnDroneHazard(droneLane, z);
      const safeLane: LaneIndex = (droneLane === 0 ? 1 : 0) as LaneIndex;
      this.spawnDataShardLine(safeLane, z - 4, 4);
    } else if (roll < 0.86) {
      // Low Energy-Fence requiring jump
      const fenceLane: LaneIndex = (Math.floor(Math.random() * 3) - 1) as LaneIndex;
      this.spawnEnergyFence(fenceLane, z);
      const safeLane: LaneIndex = (fenceLane === 0 ? -1 : 0) as LaneIndex;
      this.spawnDataShardLine(safeLane, z - 4, 4);
    } else {
      // Mag-Lev Hover Train with Sloped Aerodynamic Ramp
      const trainLane: LaneIndex = (Math.floor(Math.random() * 3) - 1) as LaneIndex;
      this.spawnMaglevTrain(trainLane, z, true);
    }
  }

  // --- Cyberpunk Spawn Primitives ---

  private spawnDroneHazard(lane: LaneIndex, z: number) {
    const x = getLaneX(lane);
    const y = getTerrainHeight(x, z) + 1.2;

    const group = new THREE.Group();
    const body = new THREE.Mesh(this.droneBodyGeom, this.droneChassisMat);
    group.add(body);

    const eye = new THREE.Mesh(this.droneEyeGeom, this.droneHazardMat);
    eye.position.set(0, 0, 0.25);
    group.add(eye);

    group.position.set(x, y, z);
    this.scene.add(group);

    this.obstacles.push({
      id: `drone_${this.nextObstacleId++}`,
      type: 'drone-hazard',
      lane,
      x,
      y,
      z,
      baseX: x,
      width: 2.0,
      height: 1.8,
      depth: 1.8,
      mesh: group,
      cleared: false,
    });
  }

  private spawnEnergyFence(lane: LaneIndex, z: number) {
    const x = getLaneX(lane);
    const y = getTerrainHeight(x, z);

    const group = new THREE.Group();

    const p1 = new THREE.Mesh(this.pylonGeom, this.pylonMat);
    p1.position.set(-1.8, 0.5, 0);
    group.add(p1);

    const p2 = new THREE.Mesh(this.pylonGeom, this.pylonMat);
    p2.position.set(1.8, 0.5, 0);
    group.add(p2);

    const fenceBar = new THREE.Mesh(this.fenceBarGeom, this.fenceMat);
    fenceBar.position.set(0, 0.55, 0);
    group.add(fenceBar);

    group.position.set(x, y, z);
    this.scene.add(group);

    this.obstacles.push({
      id: `fence_${this.nextObstacleId++}`,
      type: 'energy-fence',
      lane,
      x,
      y,
      z,
      width: 3.6,
      height: 0.95,
      depth: 0.8,
      mesh: group,
      cleared: false,
    });
  }

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

  private spawnMovingHorizontalBarrier(lane: LaneIndex, z: number) {
    const x = getLaneX(lane);
    const y = getTerrainHeight(x, z) + 0.6;

    const group = new THREE.Group();
    const bar = new THREE.Mesh(this.movingBarrierGeom, this.movingBarrierMat);
    group.add(bar);

    // Ground Laser Hazard Sweep Warning Line
    const sweepMat = new THREE.MeshBasicMaterial({ color: 0xff0033, transparent: true, opacity: 0.75, side: THREE.DoubleSide });
    const sweepWarning = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 0.4), sweepMat);
    sweepWarning.rotation.x = Math.PI / 2;
    sweepWarning.position.set(0, -0.55, 0);
    group.add(sweepWarning);

    group.position.set(x, y, z);
    this.scene.add(group);

    this.obstacles.push({
      id: `mov_bar_${this.nextObstacleId++}`,
      type: 'moving-horizontal-barrier',
      lane,
      x,
      y,
      z,
      baseX: x,
      width: 3.6,
      height: 0.8,
      depth: 0.6,
      mesh: group,
      cleared: false,
    });
  }

  private spawnFallingSecurityBlock(lane: LaneIndex, z: number) {
    const x = getLaneX(lane);
    const groundY = getTerrainHeight(x, z);
    const y = groundY + 12.0; // Starts up high, drops as player approaches

    const group = new THREE.Group();
    const block = new THREE.Mesh(this.fallingBlockGeom, this.fallingBlockMat);
    group.add(block);

    const glowTrim = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.2, 2.5), this.fallingBlockGlowMat);
    group.add(glowTrim);

    // Red Impact Zone Warning Decal Projection on Ground
    const warnMat = new THREE.MeshBasicMaterial({ color: 0xff0033, wireframe: true, transparent: true, opacity: 0.85 });
    const targetDecal = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), warnMat);
    targetDecal.rotation.x = Math.PI / 2;
    targetDecal.position.set(0, groundY - y + 0.05, 0);
    group.add(targetDecal);

    group.position.set(x, y, z);
    this.scene.add(group);

    this.obstacles.push({
      id: `fall_block_${this.nextObstacleId++}`,
      type: 'falling-security-block',
      lane,
      x,
      y,
      z,
      width: 2.6,
      height: 2.6,
      depth: 2.6,
      mesh: group,
      cleared: false,
    });
  }

  private spawnPulsingLaserBeam(lane: LaneIndex, z: number) {
    const x = getLaneX(lane);
    const y = getTerrainHeight(x, z) + 0.8;

    const group = new THREE.Group();
    const beam = new THREE.Mesh(this.pulsingLaserGeom, this.pulsingLaserMat);
    beam.rotateZ(Math.PI / 2);
    group.add(beam);

    group.position.set(x, y, z);
    this.scene.add(group);

    this.obstacles.push({
      id: `pulse_laser_${this.nextObstacleId++}`,
      type: 'pulsing-laser-beam',
      lane,
      x,
      y,
      z,
      width: 4.4,
      height: 0.9,
      depth: 0.6,
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

  private spawnWorldPortal(lane: LaneIndex, z: number, targetBiome: BiomeType) {
    const x = getLaneX(lane);
    const y = getTerrainHeight(x, z);

    const group = new THREE.Group();

    const portalColors: Record<string, number> = {
      'volcanic-forge': 0xff3300,
      'crystal-glacier': 0x00f7ff,
      'quantum-desert': 0xffaa00,
      'cyber-forest': 0x00ff88,
      'orbital-ring': 0xff00aa,
      'the-grid': 0x00ff66,
      'neon-undercity': 0x00f0ff,
    };
    const pColor = portalColors[targetBiome] || 0x00f0ff;

    const ringMat = new THREE.MeshBasicMaterial({ color: pColor });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3.0, 0.35, 12, 32), ringMat);
    ring.position.set(0, 2.6, 0);
    group.add(ring);

    const vortexMat = new THREE.MeshBasicMaterial({
      color: pColor,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const vortex = new THREE.Mesh(new THREE.CircleGeometry(2.8, 24), vortexMat);
    vortex.position.set(0, 2.6, 0);
    group.add(vortex);

    const outerRingMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      wireframe: true,
    });
    const outerRing = new THREE.Mesh(new THREE.TorusGeometry(3.6, 0.1, 8, 24), outerRingMat);
    outerRing.position.set(0, 2.6, 0);
    group.add(outerRing);

    group.position.set(x, y, z);
    this.scene.add(group);

    this.obstacles.push({
      id: `portal_${this.nextObstacleId++}`,
      type: 'world-portal',
      lane,
      x,
      y,
      z,
      width: 4.8,
      height: 5.2,
      depth: 1.5,
      mesh: group,
      isPortal: true,
      targetBiome,
      cleared: false,
    });
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
      const arcY = Math.sin(frac * Math.PI) * 2.5; // Capped arc height (2.5m) so all tokens are easily reachable
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

  /**
   * Computes height of obstacle surfaces (train roofs, train ramps, grind rails)
   * under player's current (x, z) coordinate.
   */
  getObstacleSurfaceHeight(x: number, z: number, playerY: number): number {
    let maxSurfaceH = 0;
    for (const obs of this.obstacles) {
      if (obs.cleared) continue;
      const halfW = obs.width / 2 + 0.6;
      if (Math.abs(x - obs.x) > halfW) continue;

      if (obs.type === 'maglev-hauler' || obs.type === 'maglev-ramp' || obs.type === 'spirit-train' || obs.type === 'spirit-train-ramp') {
        const trainHalfD = obs.depth / 2;
        const trainTop = obs.y + obs.height;

        if (obs.hasRamp && obs.rampStartZ !== undefined) {
          const rampStart = obs.rampStartZ;
          const rampEnd = obs.z - trainHalfD;
          if (z >= rampStart && z <= rampEnd) {
            // Player is surfing up the front ramp!
            const rampProgress = (z - rampStart) / (rampEnd - rampStart);
            const rampH = obs.y + rampProgress * obs.height;
            if (rampH > maxSurfaceH) maxSurfaceH = rampH;
            continue;
          }
        }

        // On top of train roof: only support if player is actually elevated up at roof height!
        if (z >= obs.z - trainHalfD && z <= obs.z + trainHalfD) {
          if (playerY >= trainTop - 0.75 && trainTop > maxSurfaceH) {
            maxSurfaceH = trainTop;
          }
        }
      } else if (obs.isGrindRail) {
        if (Math.abs(z - obs.z) <= obs.depth / 2 + 0.5) {
          const railTop = obs.y + 1.25;
          if (playerY >= obs.y + 0.4 && railTop > maxSurfaceH) {
            maxSurfaceH = railTop;
          }
        }
      }
    }
    return maxSurfaceH;
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
    hitPortal?: { targetBiome: BiomeType };
    collectedCoins: number;
    collectedPowerUp?: PowerUpType;
  } {
    let hasCrashed = false;
    let hasStumbled = false;
    let nearMiss = false;
    let crashedObstacle: ObstacleInstance | undefined;
    let isGrinding = false;
    let hitBoostGate = false;
    let hitPortal: { targetBiome: BiomeType } | undefined;
    let collectedCoins = 0;
    let collectedPowerUp: PowerUpType | undefined;

    // 1. Data Shards Collection (3.2m reach radius for smooth token harvesting)
    for (const shard of this.coins) {
      if (shard.collected) continue;
      const dx = playerPos.x - shard.x;
      const dy = playerPos.y - shard.y;
      const dz = playerPos.z - shard.z;
      const distSq = dx * dx + dy * dy + dz * dz;

      if (distSq < 3.2 * 3.2) {
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

      if (distSq < 3.4 * 3.4) {
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

      if (Math.abs(dz) > halfDepth + 1.5) continue;

      const halfWidth = obs.width / 2 + 0.5;
      const dx = playerPos.x - obs.x;

      // Handle World Portals
      if (obs.isPortal || obs.type === 'world-portal') {
        if (Math.abs(dz) < 2.2 && Math.abs(dx) < 3.2) {
          hitPortal = { targetBiome: obs.targetBiome || 'volcanic-forge' };
          obs.cleared = true;
        }
        continue;
      }

      // Near-Miss Style Bonus detection (passing close without hitting)
      if (!obs.nearMissAwarded && !obs.isGrindRail && !obs.isBoostGate) {
        if (Math.abs(dz) < halfDepth + 0.8) {
          const edgeDist = Math.abs(dx) - halfWidth;
          if (edgeDist > 0 && edgeDist < 2.2) {
            obs.nearMissAwarded = true;
            nearMiss = true;
          }
        }
      }

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

      // Handle Falling Security Block separately (Check 3D Bounding Box Center so player can pass underneath elevated blocks)
      if (obs.type === 'falling-security-block') {
        const blockCenterY = obs.y;
        const blockHalfH = obs.height / 2 + 0.3;
        if (Math.abs(playerPos.y - blockCenterY) < blockHalfH) {
          hasCrashed = true;
          crashedObstacle = obs;
          obs.cleared = true;
          break;
        } else if (playerPos.z > obs.z + halfDepth) {
          obs.cleared = true;
        }
        continue;
      }

      // Handle Laser Barrier, Low Energy Fence, Moving Horizontal Barrier, Pulsing Laser (Jump over / avoid)
      if (
        obs.type === 'laser-barrier' ||
        obs.type === 'energy-fence' ||
        obs.type === 'low-hurdle' ||
        obs.type === 'moving-horizontal-barrier' ||
        obs.type === 'pulsing-laser-beam'
      ) {
        const barrierTop = obs.y + obs.height;
        if (playerPos.y > barrierTop + 0.15) {
          obs.cleared = true;
        } else {
          hasCrashed = true;
          crashedObstacle = obs;
          obs.cleared = true;
          break;
        }
      } else if (obs.type === 'overhead-conduit' || obs.type === 'high-barrier') {
        if (isSliding) {
          obs.cleared = true; // Safely slid underneath!
        } else {
          hasCrashed = true;
          crashedObstacle = obs;
          obs.cleared = true;
          break;
        }
      } else if (obs.type === 'drone-hazard') {
        hasCrashed = true;
        crashedObstacle = obs;
        obs.cleared = true;
        break;
      } else if (obs.type === 'maglev-hauler' || obs.type === 'maglev-ramp' || obs.type === 'spirit-train' || obs.type === 'spirit-train-ramp') {
        const trainTop = obs.y + obs.height;
        const trainHalfD = obs.depth / 2;

        if (playerPos.y >= trainTop - 0.35) {
          // Skating along roof! Safe!
        } else if (obs.hasRamp && obs.rampStartZ !== undefined && playerPos.z >= obs.rampStartZ && playerPos.z <= obs.z - trainHalfD) {
          // Riding up front ramp! Safe!
        } else if (Math.abs(dz) < trainHalfD) {
          hasCrashed = true;
          crashedObstacle = obs;
          obs.cleared = true;
          break;
        }
      }
    }

    return { hasCrashed, hasStumbled, nearMiss, crashedObstacle, isGrinding, hitBoostGate, hitPortal, collectedCoins, collectedPowerUp };
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
