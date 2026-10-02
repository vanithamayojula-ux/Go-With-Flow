import * as THREE from 'three';
import { CosmeticsConfig, HeroId, TrickType } from '../types';
import { buildHeroRig, loadHeroModel, HeroRig } from './heroRig';

export interface PlayerCharacter {
  group: THREE.Group;
  board: THREE.Group;
  boards?: Record<string, THREE.Object3D>;
  helmets?: Record<string, THREE.Object3D>;
  armors?: Record<string, THREE.Object3D>;
  visorMesh?: THREE.Mesh;
  underglowMesh?: THREE.Mesh;
  underglowLight?: THREE.PointLight;
  forwardSpotLight?: THREE.SpotLight;
  footLightLeft?: THREE.PointLight;
  footLightRight?: THREE.PointLight;
  wheels?: THREE.Mesh[];
  energyStreamMesh?: THREE.Mesh;
  capeMesh?: THREE.Mesh;
  headGroup?: THREE.Group;
  spineGroup?: THREE.Group;
  leftArmGroup?: THREE.Group;
  rightArmGroup?: THREE.Group;
  leftLegGroup?: THREE.Group;
  rightLegGroup?: THREE.Group;
  applyGltfCosmetics?: (config: CosmeticsConfig) => void;

  // Hero Rig Integration
  activeHeroId?: HeroId;
  heroRig?: HeroRig;
  syncBones?: () => void;
  setHero?: (heroId?: HeroId) => Promise<boolean>;
}

// ---------------------------------------------------------------------------
// 1. Surfboard Model Generators (5 Distinct Cyber-Surfboards)
// ---------------------------------------------------------------------------

function createCyberPhantomBoard(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'Board_CyberPhantom';

  const carbonDeckMat = new THREE.MeshStandardMaterial({
    color: 0x090f18,
    roughness: 0.30,
    metalness: 0.65,
  });
  const tractionMat = new THREE.MeshStandardMaterial({
    color: 0x05080e,
    roughness: 0.94,
    metalness: 0.05,
  });
  const finMat = new THREE.MeshStandardMaterial({
    color: 0x141e2e,
    roughness: 0.30,
    metalness: 0.85,
  });
  const stringerMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
  const neonCyanMat = new THREE.MeshBasicMaterial({ color: 0x00d2e0 });
  const thrusterGlowMat = new THREE.MeshBasicMaterial({ color: 0x00d2e0 });

  // Center Deck
  const centerDeck = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.024, 0.64), carbonDeckMat);
  group.add(centerDeck);

  // Nose Section
  const noseDeck = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.022, 0.44), carbonDeckMat);
  noseDeck.position.set(0, 0.014, 0.46);
  noseDeck.rotation.x = -0.06;
  group.add(noseDeck);

  const noseTip = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.16, 0.020, 12), carbonDeckMat);
  noseTip.position.set(0, 0.028, 0.69);
  noseTip.rotation.x = -0.06;
  group.add(noseTip);

  // Tail Section
  const tailDeck = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.022, 0.42), carbonDeckMat);
  tailDeck.position.set(0, 0.002, -0.44);
  group.add(tailDeck);

  // Center Stringer Spine
  const stringerMesh = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.028, 1.46), stringerMat);
  stringerMesh.position.set(0, 0.005, 0.04);
  group.add(stringerMesh);

  // Perimeter Neon Edge Rails
  const railGeom = new THREE.BoxGeometry(0.012, 0.020, 1.40);
  const leftRail = new THREE.Mesh(railGeom, neonCyanMat);
  leftRail.position.set(-0.185, 0.002, 0.04);
  const rightRail = new THREE.Mesh(railGeom, neonCyanMat);
  rightRail.position.set(0.185, 0.002, 0.04);
  group.add(leftRail, rightRail);

  // Stomp & Front Traction Pads
  const rearStomp = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.006, 0.36), tractionMat);
  rearStomp.position.set(0, 0.014, -0.32);
  const rearKickTail = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.012, 0.08), tractionMat);
  rearKickTail.position.set(0, 0.019, -0.51);
  const frontPad = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.006, 0.28), tractionMat);
  frontPad.position.set(-0.02, 0.014, 0.28);
  frontPad.rotation.y = 0.44;
  group.add(rearStomp, rearKickTail, frontPad);

  // Hydrodynamic Fins
  const centerFin = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.065, 0.13), finMat);
  centerFin.position.set(0, -0.040, -0.46);
  centerFin.rotation.x = 0.35;
  const leftFin = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.048, 0.10), finMat);
  leftFin.position.set(-0.11, -0.032, -0.34);
  leftFin.rotation.set(0.28, 0, -0.22);
  const rightFin = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.048, 0.10), finMat);
  rightFin.position.set(0.11, -0.032, -0.34);
  rightFin.rotation.set(0.28, 0, 0.22);
  group.add(centerFin, leftFin, rightFin);

  // Dual Plasma Ion Thrusters
  const thrusterNozzleGeom = new THREE.CylinderGeometry(0.025, 0.035, 0.07, 8);
  thrusterNozzleGeom.rotateX(Math.PI / 2);
  const leftNozzle = new THREE.Mesh(thrusterNozzleGeom, finMat);
  leftNozzle.position.set(-0.08, -0.018, -0.56);
  const leftPlume = new THREE.Mesh(new THREE.CircleGeometry(0.022, 8), thrusterGlowMat);
  leftPlume.position.set(0, 0, -0.036);
  leftNozzle.add(leftPlume);

  const rightNozzle = new THREE.Mesh(thrusterNozzleGeom, finMat);
  rightNozzle.position.set(0.08, -0.018, -0.56);
  const rightPlume = new THREE.Mesh(new THREE.CircleGeometry(0.022, 8), thrusterGlowMat);
  rightPlume.position.set(0, 0, -0.036);
  rightNozzle.add(rightPlume);
  group.add(leftNozzle, rightNozzle);

  return group;
}

function createLaserEdgeBoard(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'Board_LaserEdge';

  const stealthDeckMat = new THREE.MeshStandardMaterial({
    color: 0x141118,
    roughness: 0.22,
    metalness: 0.82,
  });
  const crimsonFinMat = new THREE.MeshStandardMaterial({
    color: 0x440810,
    roughness: 0.35,
    metalness: 0.85,
  });
  const laserRedMat = new THREE.MeshBasicMaterial({ color: 0xff1e27 });
  const laserOrangeMat = new THREE.MeshBasicMaterial({ color: 0xff6600 });
  const flamePlumeMat = new THREE.MeshBasicMaterial({ color: 0xff3a00 });

  // 1. Angular Diamond/Wedge Main Body
  const centerDeck = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.022, 0.62), stealthDeckMat);
  group.add(centerDeck);

  // 2. Sharp Spear-Point Arrow Nose
  const noseDeck = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.60, 4), stealthDeckMat);
  noseDeck.position.set(0, 0.016, 0.58);
  noseDeck.rotation.set(-Math.PI / 2 + 0.08, Math.PI / 4, 0);
  noseDeck.scale.set(1.0, 1.0, 0.12);
  group.add(noseDeck);

  // 3. Stepped Notched Tail
  const tailDeckL = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.020, 0.38), stealthDeckMat);
  tailDeckL.position.set(-0.11, 0.002, -0.46);
  tailDeckL.rotation.y = -0.08;
  const tailDeckR = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.020, 0.38), stealthDeckMat);
  tailDeckR.position.set(0.11, 0.002, -0.46);
  tailDeckR.rotation.y = 0.08;
  group.add(tailDeckL, tailDeckR);

  // 4. Laser-Red Perimeter Razor Rails
  const railGeom = new THREE.BoxGeometry(0.010, 0.024, 1.48);
  const leftRail = new THREE.Mesh(railGeom, laserRedMat);
  leftRail.position.set(-0.175, 0.004, 0.05);
  const rightRail = new THREE.Mesh(railGeom, laserRedMat);
  rightRail.position.set(0.175, 0.004, 0.05);
  group.add(leftRail, rightRail);

  // Twin Laser Orange Stringers
  const stringerL = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.026, 1.35), laserOrangeMat);
  stringerL.position.set(-0.04, 0.006, 0.02);
  const stringerR = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.026, 1.35), laserOrangeMat);
  stringerR.position.set(0.04, 0.006, 0.02);
  group.add(stringerL, stringerR);

  // 5. Knife-Edge Razor Fins
  const finL = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.075, 0.16), crimsonFinMat);
  finL.position.set(-0.12, -0.042, -0.42);
  finL.rotation.set(0.38, 0, -0.28);
  const finR = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.075, 0.16), crimsonFinMat);
  finR.position.set(0.12, -0.042, -0.42);
  finR.rotation.set(0.38, 0, 0.28);
  group.add(finL, finR);

  // 6. Dual Hyper-Afterburner Thrusters
  const thrusterGeom = new THREE.BoxGeometry(0.065, 0.045, 0.12);
  const tL = new THREE.Mesh(thrusterGeom, crimsonFinMat);
  tL.position.set(-0.10, -0.012, -0.58);
  const tR = new THREE.Mesh(thrusterGeom, crimsonFinMat);
  tR.position.set(0.10, -0.012, -0.58);

  const plumeL = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.09, 8), flamePlumeMat);
  plumeL.rotation.x = -Math.PI / 2;
  plumeL.position.set(0, 0, -0.07);
  tL.add(plumeL);

  const plumeR = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.09, 8), flamePlumeMat);
  plumeR.rotation.x = -Math.PI / 2;
  plumeR.position.set(0, 0, -0.07);
  tR.add(plumeR);

  group.add(tL, tR);
  return group;
}

function createGridRunnerBoard(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'Board_GridRunner';

  const matrixDeckMat = new THREE.MeshStandardMaterial({
    color: 0x06150d,
    roughness: 0.35,
    metalness: 0.55,
  });
  const matrixFinMat = new THREE.MeshStandardMaterial({
    color: 0x003816,
    roughness: 0.40,
    metalness: 0.80,
  });
  const matrixNeonGreen = new THREE.MeshBasicMaterial({ color: 0x00ff66 });
  const matrixLime = new THREE.MeshBasicMaterial({ color: 0x39ff14 });
  const plasmaGreen = new THREE.MeshBasicMaterial({ color: 0x00ff88 });

  // 1. Faceted Hexagonal Center Deck
  const centerDeck = new THREE.Mesh(new THREE.BoxGeometry(0.37, 0.024, 0.65), matrixDeckMat);
  group.add(centerDeck);

  // 2. Chiseled Beveled Nose Section
  const noseDeck = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.19, 0.48, 6), matrixDeckMat);
  noseDeck.position.set(0, 0.014, 0.50);
  noseDeck.rotation.set(-0.06, 0, Math.PI / 2);
  noseDeck.scale.set(0.10, 1.0, 1.0);
  group.add(noseDeck);

  // 3. Wide Stabilizer Tail
  const tailDeck = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.022, 0.38), matrixDeckMat);
  tailDeck.position.set(0, 0.002, -0.45);
  group.add(tailDeck);

  // 4. Matrix Green Glowing Perimeter Rails
  const railGeom = new THREE.BoxGeometry(0.012, 0.022, 1.42);
  const leftRail = new THREE.Mesh(railGeom, matrixNeonGreen);
  leftRail.position.set(-0.188, 0.002, 0.03);
  const rightRail = new THREE.Mesh(railGeom, matrixNeonGreen);
  rightRail.position.set(0.188, 0.002, 0.03);
  group.add(leftRail, rightRail);

  // Matrix Circuit Grid Lines
  for (let i = -2; i <= 2; i++) {
    const gridLine = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.026, 0.008), matrixLime);
    gridLine.position.set(0, 0.005, i * 0.22);
    group.add(gridLine);
  }
  const busLine = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.027, 1.42), matrixLime);
  busLine.position.set(0, 0.005, 0.03);
  group.add(busLine);

  // 5. Triple Emerald Fins
  const centerFin = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.065, 0.14), matrixFinMat);
  centerFin.position.set(0, -0.040, -0.48);
  centerFin.rotation.x = 0.30;
  const leftFin = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.052, 0.11), matrixFinMat);
  leftFin.position.set(-0.12, -0.034, -0.36);
  leftFin.rotation.set(0.24, 0, -0.20);
  const rightFin = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.052, 0.11), matrixFinMat);
  rightFin.position.set(0.12, -0.034, -0.36);
  rightFin.rotation.set(0.24, 0, 0.20);
  group.add(centerFin, leftFin, rightFin);

  // 6. Dual Ion Turbine Thrusters
  const turbineGeom = new THREE.CylinderGeometry(0.032, 0.032, 0.08, 12);
  turbineGeom.rotateX(Math.PI / 2);
  const tL = new THREE.Mesh(turbineGeom, matrixFinMat);
  tL.position.set(-0.09, -0.018, -0.58);
  const pL = new THREE.Mesh(new THREE.CircleGeometry(0.028, 12), plasmaGreen);
  pL.position.set(0, 0, -0.041);
  tL.add(pL);

  const tR = new THREE.Mesh(turbineGeom, matrixFinMat);
  tR.position.set(0.09, -0.018, -0.58);
  const pR = new THREE.Mesh(new THREE.CircleGeometry(0.028, 12), plasmaGreen);
  pR.position.set(0, 0, -0.041);
  tR.add(pR);

  group.add(tL, tR);
  return group;
}

function createTokyoNeonBoard(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'Board_TokyoNeon';

  const glossVioletDeckMat = new THREE.MeshStandardMaterial({
    color: 0x1d0a28,
    roughness: 0.15,
    metalness: 0.75,
  });
  const goldFinMat = new THREE.MeshStandardMaterial({
    color: 0xd4af37,
    roughness: 0.25,
    metalness: 0.90,
  });
  const hotMagentaMat = new THREE.MeshBasicMaterial({ color: 0xff007f });
  const brightCyanMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
  const pulseMagentaMat = new THREE.MeshBasicMaterial({ color: 0xff00aa });

  // 1. Sleek Violet Gloss Center Deck
  const centerDeck = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.024, 0.64), glossVioletDeckMat);
  group.add(centerDeck);

  // 2. Curving Cruiser Nose
  const noseDeck = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.022, 0.45), glossVioletDeckMat);
  noseDeck.position.set(0, 0.015, 0.46);
  noseDeck.rotation.x = -0.07;
  group.add(noseDeck);

  const noseTip = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.17, 0.020, 16), glossVioletDeckMat);
  noseTip.position.set(0, 0.030, 0.69);
  noseTip.rotation.x = -0.07;
  group.add(noseTip);

  // 3. Wide Swallow-Tail with Dual Winglets
  const tailWingL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.022, 0.44), glossVioletDeckMat);
  tailWingL.position.set(-0.11, 0.003, -0.48);
  tailWingL.rotation.y = -0.12;
  const tailWingR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.022, 0.44), glossVioletDeckMat);
  tailWingR.position.set(0.11, 0.003, -0.48);
  tailWingR.rotation.y = 0.12;
  group.add(tailWingL, tailWingR);

  // 4. Asymmetrical Neon Rails: Magenta Left, Cyan Right
  const railGeom = new THREE.BoxGeometry(0.012, 0.022, 1.44);
  const leftRail = new THREE.Mesh(railGeom, hotMagentaMat);
  leftRail.position.set(-0.192, 0.002, 0.04);
  const rightRail = new THREE.Mesh(railGeom, brightCyanMat);
  rightRail.position.set(0.192, 0.002, 0.04);
  group.add(leftRail, rightRail);

  // Center Dual-Tone Split Stringer
  const stringerL = new THREE.Mesh(new THREE.BoxGeometry(0.007, 0.028, 1.44), hotMagentaMat);
  stringerL.position.set(-0.008, 0.005, 0.04);
  const stringerR = new THREE.Mesh(new THREE.BoxGeometry(0.007, 0.028, 1.44), brightCyanMat);
  stringerR.position.set(0.008, 0.005, 0.04);
  group.add(stringerL, stringerR);

  // 5. Gold-Anodized Fins
  const finL = new THREE.Mesh(new THREE.BoxGeometry(0.007, 0.055, 0.12), goldFinMat);
  finL.position.set(-0.12, -0.034, -0.40);
  finL.rotation.set(0.28, 0, -0.22);
  const finR = new THREE.Mesh(new THREE.BoxGeometry(0.007, 0.055, 0.12), goldFinMat);
  finR.position.set(0.12, -0.034, -0.40);
  finR.rotation.set(0.28, 0, 0.22);
  group.add(finL, finR);

  // 6. Dual High-Power Tokyo Pulse Thrusters
  const nozzleGeom = new THREE.CylinderGeometry(0.030, 0.040, 0.08, 12);
  nozzleGeom.rotateX(Math.PI / 2);
  const tL = new THREE.Mesh(nozzleGeom, goldFinMat);
  tL.position.set(-0.10, -0.016, -0.60);
  const pL = new THREE.Mesh(new THREE.CircleGeometry(0.026, 12), pulseMagentaMat);
  pL.position.set(0, 0, -0.041);
  tL.add(pL);

  const tR = new THREE.Mesh(nozzleGeom, goldFinMat);
  tR.position.set(0.10, -0.016, -0.60);
  const pR = new THREE.Mesh(new THREE.CircleGeometry(0.026, 12), pulseMagentaMat);
  pR.position.set(0, 0, -0.041);
  tR.add(pR);

  group.add(tL, tR);
  return group;
}

function createVoidStalkerBoard(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'Board_VoidStalker';

  const voidObsidianMat = new THREE.MeshStandardMaterial({
    color: 0x07050d,
    roughness: 0.18,
    metalness: 0.90,
  });
  const voidDaggerMat = new THREE.MeshStandardMaterial({
    color: 0x1d052d,
    roughness: 0.28,
    metalness: 0.92,
  });
  const voidPurpleMat = new THREE.MeshBasicMaterial({ color: 0x9900ff });
  const voidRiftMat = new THREE.MeshBasicMaterial({ color: 0xcc00ff });
  const antimatterGlowMat = new THREE.MeshBasicMaterial({ color: 0xaa00ff });

  // 1. Matte Obsidian Center Body
  const centerDeck = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.024, 0.60), voidObsidianMat);
  group.add(centerDeck);

  // 2. Twin-Fork Split-Blade Nose
  const forkL = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.52, 4), voidObsidianMat);
  forkL.position.set(-0.11, 0.018, 0.54);
  forkL.rotation.set(-Math.PI / 2 + 0.08, Math.PI / 4, 0);
  forkL.scale.set(0.8, 1.0, 0.15);

  const forkR = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.52, 4), voidObsidianMat);
  forkR.position.set(0.11, 0.018, 0.54);
  forkR.rotation.set(-Math.PI / 2 + 0.08, Math.PI / 4, 0);
  forkR.scale.set(0.8, 1.0, 0.15);
  group.add(forkL, forkR);

  // 3. Swept Void Stealth Tail
  const tailDeck = new THREE.Mesh(new THREE.BoxGeometry(0.33, 0.022, 0.40), voidObsidianMat);
  tailDeck.position.set(0, 0.002, -0.45);
  group.add(tailDeck);

  // 4. Glowing Dark Violet Perimeter Rails
  const railGeom = new THREE.BoxGeometry(0.010, 0.024, 1.44);
  const leftRail = new THREE.Mesh(railGeom, voidPurpleMat);
  leftRail.position.set(-0.178, 0.003, 0.04);
  const rightRail = new THREE.Mesh(railGeom, voidPurpleMat);
  rightRail.position.set(0.178, 0.003, 0.04);
  group.add(leftRail, rightRail);

  // Void Rift Center Energy Spine
  const stringerMesh = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.028, 1.40), voidRiftMat);
  stringerMesh.position.set(0, 0.006, 0.03);
  group.add(stringerMesh);

  // 5. Swept-Wing Obsidian Dagger Fins
  const finL = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.075, 0.15), voidDaggerMat);
  finL.position.set(-0.12, -0.040, -0.40);
  finL.rotation.set(0.40, 0, -0.32);
  const finR = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.075, 0.15), voidDaggerMat);
  finR.position.set(0.12, -0.040, -0.40);
  finR.rotation.set(0.40, 0, 0.32);
  group.add(finL, finR);

  // 6. Triple Antimatter Micro-Thrusters
  const tPositions = [-0.09, 0, 0.09];
  for (const x of tPositions) {
    const noz = new THREE.Mesh(
      new THREE.CylinderGeometry(0.020, 0.028, 0.07, 8),
      voidDaggerMat
    );
    noz.rotation.x = Math.PI / 2;
    noz.position.set(x, -0.015, -0.58);
    const pl = new THREE.Mesh(new THREE.CircleGeometry(0.018, 8), antimatterGlowMat);
    pl.position.set(0, 0, -0.036);
    noz.add(pl);
    group.add(noz);
  }

  return group;
}

// ---------------------------------------------------------------------------
// 2. Character Factory & Rigging Integration
// ---------------------------------------------------------------------------

export function createPlayerCharacter(heroId?: HeroId): PlayerCharacter {
  const rootGroup = new THREE.Group();
  rootGroup.name = 'PlayerCharacterRoot';

  // Master Board Pivot Group
  const boardGroup = new THREE.Group();
  boardGroup.name = 'SurfboardGroup';
  boardGroup.position.set(0, 0.08, 0);

  // Shared Lighting & Ground Contact Shadow for Hoverboards
  const footLightLeft = new THREE.PointLight(0x00d2e0, 0.9, 2.0);
  footLightLeft.position.set(-0.05, 0.06, 0.28);
  boardGroup.add(footLightLeft);

  const footLightRight = new THREE.PointLight(0x00d2e0, 0.9, 2.0);
  footLightRight.position.set(0.05, 0.06, -0.28);
  boardGroup.add(footLightRight);

  const forwardSpotLight = new THREE.SpotLight(0x00d2e0, 2.0, 26, Math.PI / 6, 0.35, 1.1);
  forwardSpotLight.position.set(0, 0.05, 0.65);
  forwardSpotLight.target.position.set(0, -0.2, 10.0);
  boardGroup.add(forwardSpotLight);
  boardGroup.add(forwardSpotLight.target);

  const underglowGeom = new THREE.PlaneGeometry(0.48, 1.55);
  const underglowMat = new THREE.MeshBasicMaterial({
    color: 0x00d2e0,
    transparent: true,
    opacity: 0.35,
    side: THREE.DoubleSide,
  });
  const underglowMesh = new THREE.Mesh(underglowGeom, underglowMat);
  underglowMesh.rotation.x = Math.PI / 2;
  underglowMesh.position.set(0, -0.075, 0.04);
  boardGroup.add(underglowMesh);

  const shadowBlobMat = new THREE.MeshBasicMaterial({
    color: 0x020408,
    transparent: true,
    opacity: 0.55,
    side: THREE.DoubleSide,
  });
  const shadowBlob = new THREE.Mesh(new THREE.PlaneGeometry(0.50, 1.58), shadowBlobMat);
  shadowBlob.rotation.x = Math.PI / 2;
  shadowBlob.position.set(0, -0.078, 0.04);
  boardGroup.add(shadowBlob);

  const underglowLight = new THREE.PointLight(0x00d2e0, 1.2, 2.8);
  underglowLight.position.set(0, -0.06, 0);
  boardGroup.add(underglowLight);

  // Instantiate All 5 Distinct Surfboard Models
  const cyberPhantomBoard = createCyberPhantomBoard();
  const laserEdgeBoard = createLaserEdgeBoard();
  const gridRunnerBoard = createGridRunnerBoard();
  const tokyoNeonBoard = createTokyoNeonBoard();
  const voidStalkerBoard = createVoidStalkerBoard();

  laserEdgeBoard.visible = false;
  gridRunnerBoard.visible = false;
  tokyoNeonBoard.visible = false;
  voidStalkerBoard.visible = false;

  boardGroup.add(cyberPhantomBoard);
  boardGroup.add(laserEdgeBoard);
  boardGroup.add(gridRunnerBoard);
  boardGroup.add(tokyoNeonBoard);
  boardGroup.add(voidStalkerBoard);

  const boards: Record<string, THREE.Object3D> = {
    'cyber-phantom': cyberPhantomBoard,
    'laser-edge': laserEdgeBoard,
    'grid-runner': gridRunnerBoard,
    'tokyo-neon': tokyoNeonBoard,
    'void-stalker': voidStalkerBoard,
  };

  rootGroup.add(boardGroup);

  // -------------------------------------------------------------------------
  // Procedural Skater Body & Cosmetic Variants
  // -------------------------------------------------------------------------
  const spineGroup = new THREE.Group();
  spineGroup.name = 'ProceduralSpineGroup';
  spineGroup.position.set(0, 0.28, 0);
  rootGroup.add(spineGroup);

  const suitMat = new THREE.MeshStandardMaterial({
    color: 0x1a2233,
    roughness: 0.35,
    metalness: 0.6,
  });
  const armorWhiteMat = new THREE.MeshStandardMaterial({
    color: 0xd8e4f0,
    roughness: 0.25,
    metalness: 0.7,
  });
  const outlineMat = new THREE.MeshBasicMaterial({
    color: 0x00d2e0,
    side: THREE.BackSide,
    transparent: true,
    opacity: 0.35,
  });
  const neonCyanMat = new THREE.MeshBasicMaterial({ color: 0x00d2e0 });

  // Pelvis / Hips
  const hipsMesh = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.18, 0.22), suitMat);
  spineGroup.add(hipsMesh);

  // Torso / Chest Models
  const armorGroup = new THREE.Group();
  armorGroup.name = 'ArmorGroup';
  armorGroup.position.set(0, 0.30, 0);
  spineGroup.add(armorGroup);

  // 1. Carbon Fiber Chest
  const carbonArmor = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.42, 0.26), armorWhiteMat);
  const carbonOutline = new THREE.Mesh(new THREE.BoxGeometry(0.41, 0.45, 0.29), outlineMat);
  carbonArmor.add(carbonOutline);
  const chestLight = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.18, 0.28), neonCyanMat);
  chestLight.position.set(0, 0.03, 0.01);
  carbonArmor.add(chestLight);
  armorGroup.add(carbonArmor);

  // 2. Titanium White Chest
  const titWhiteMat = new THREE.MeshStandardMaterial({ color: 0xf0f4f8, roughness: 0.15, metalness: 0.85 });
  const titaniumArmor = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.44, 0.28), titWhiteMat);
  titaniumArmor.visible = false;
  armorGroup.add(titaniumArmor);

  // 3. Onyx Stealth Chest
  const onyxMat = new THREE.MeshStandardMaterial({ color: 0x111114, roughness: 0.20, metalness: 0.90 });
  const onyxArmor = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.42, 0.26), onyxMat);
  onyxArmor.visible = false;
  armorGroup.add(onyxArmor);

  // 4. Crimson Cyborg Chest
  const crimsonMat = new THREE.MeshStandardMaterial({ color: 0x880e1e, roughness: 0.30, metalness: 0.80 });
  const crimsonArmor = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.42, 0.28), crimsonMat);
  crimsonArmor.visible = false;
  armorGroup.add(crimsonArmor);

  const armors: Record<string, THREE.Object3D> = {
    'carbon-fiber': carbonArmor,
    'titanium-white': titaniumArmor,
    'onyx-stealth': onyxArmor,
    'crimson-cyborg': crimsonArmor,
  };

  // Head Group & Helmet Variants
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.64, 0);
  spineGroup.add(headGroup);

  const visorMat = new THREE.MeshPhysicalMaterial({
    color: 0x00d2e0,
    emissive: new THREE.Color(0x00d2e0),
    emissiveIntensity: 1.2,
    roughness: 0.1,
    transmission: 0.35,
    thickness: 0.5,
  });

  // 1. Cyber Runner Helmet
  const cyberRunnerHelm = new THREE.Group();
  const helmetMesh = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.28, 0.28), armorWhiteMat);
  const helmetOutline = new THREE.Mesh(new THREE.BoxGeometry(0.29, 0.31, 0.31), outlineMat);
  helmetMesh.add(helmetOutline);
  const visorMesh = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.11, 0.15), visorMat);
  visorMesh.position.set(0, 0.02, 0.11);
  helmetMesh.add(visorMesh);
  cyberRunnerHelm.add(helmetMesh);
  headGroup.add(cyberRunnerHelm);

  // 2. Net Stalker Helmet (Stealth cowl)
  const netStalkerHelm = new THREE.Group();
  const netMesh = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.27, 0.27), onyxMat);
  const netVisor = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.05, 0.16), visorMat);
  netVisor.position.set(0, 0.02, 0.11);
  netMesh.add(netVisor);
  netStalkerHelm.add(netMesh);
  netStalkerHelm.visible = false;
  headGroup.add(netStalkerHelm);

  // 3. Void Drifter Helmet
  const voidDrifterHelm = new THREE.Group();
  const voidHelmMesh = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.28, 0.28), suitMat);
  const hornL = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.18, 4), suitMat);
  hornL.position.set(-0.12, 0.18, -0.05);
  hornL.rotation.z = 0.3;
  const hornR = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.18, 4), suitMat);
  hornR.position.set(0.12, 0.18, -0.05);
  hornR.rotation.z = -0.3;
  voidHelmMesh.add(hornL, hornR);
  voidDrifterHelm.add(voidHelmMesh);
  voidDrifterHelm.visible = false;
  headGroup.add(voidDrifterHelm);

  // 4. Grid Phantom Helmet
  const gridPhantomHelm = new THREE.Group();
  const gridMesh = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.28, 0.28), titWhiteMat);
  gridPhantomHelm.add(gridMesh);
  gridPhantomHelm.visible = false;
  headGroup.add(gridPhantomHelm);

  const helmets: Record<string, THREE.Object3D> = {
    'cyber-runner': cyberRunnerHelm,
    'net-stalker': netStalkerHelm,
    'void-drifter': voidDrifterHelm,
    'grid-phantom': gridPhantomHelm,
  };

  // Cyber Cape
  const capeGeom = new THREE.PlaneGeometry(0.34, 0.8, 3, 6);
  const capeMat = new THREE.MeshStandardMaterial({
    color: 0x00f0ff,
    emissive: new THREE.Color(0x00f0ff),
    emissiveIntensity: 0.6,
    side: THREE.DoubleSide,
    roughness: 0.4,
  });
  const capeMesh = new THREE.Mesh(capeGeom, capeMat);
  capeMesh.position.set(0, 0.44, -0.15);
  capeMesh.rotation.x = 0.2;
  spineGroup.add(capeMesh);

  // Arms & Legs
  const leftArmGroup = new THREE.Group();
  leftArmGroup.position.set(-0.25, 0.42, 0);
  const leftArmMesh = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.38, 0.13), suitMat);
  leftArmMesh.position.set(0, -0.16, 0);
  leftArmGroup.add(leftArmMesh);
  spineGroup.add(leftArmGroup);

  const rightArmGroup = new THREE.Group();
  rightArmGroup.position.set(0.25, 0.42, 0);
  const rightArmMesh = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.38, 0.13), suitMat);
  rightArmMesh.position.set(0, -0.16, 0);
  rightArmGroup.add(rightArmMesh);
  spineGroup.add(rightArmGroup);

  const leftLegGroup = new THREE.Group();
  leftLegGroup.position.set(-0.12, -0.08, 0.16);
  const leftLegMesh = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.44, 0.15), suitMat);
  leftLegMesh.position.set(0, -0.20, 0);
  leftLegGroup.add(leftLegMesh);
  spineGroup.add(leftLegGroup);

  const rightLegGroup = new THREE.Group();
  rightLegGroup.position.set(0.12, -0.08, -0.16);
  const rightLegMesh = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.44, 0.15), suitMat);
  rightLegMesh.position.set(0, -0.20, 0);
  rightLegGroup.add(rightLegMesh);
  spineGroup.add(rightLegGroup);

  const playerChar: PlayerCharacter = {
    group: rootGroup,
    board: boardGroup,
    boards,
    helmets,
    armors,
    visorMesh,
    underglowMesh,
    underglowLight,
    forwardSpotLight,
    footLightLeft,
    footLightRight,
    wheels: [],
    capeMesh,
    headGroup,
    spineGroup,
    leftArmGroup,
    rightArmGroup,
    leftLegGroup,
    rightLegGroup,
  };

  // Hero GLTF Dynamic Rig Swapping
  playerChar.setHero = async (targetHeroId?: HeroId): Promise<boolean> => {
    if (targetHeroId) {
      const loaded = await loadHeroModel(targetHeroId);
      if (loaded) {
        const rig = buildHeroRig(targetHeroId);
        if (rig) {
          if (playerChar.heroRig?.root) {
            rootGroup.remove(playerChar.heroRig.root);
          }
          rootGroup.add(rig.root);
          spineGroup.visible = false;
          playerChar.syncBones = rig.syncBones;
          playerChar.heroRig = rig;
          playerChar.activeHeroId = targetHeroId;
          return true;
        }
      }
    }

    // Fallback to procedural character
    if (playerChar.heroRig?.root) {
      rootGroup.remove(playerChar.heroRig.root);
    }
    spineGroup.visible = true;
    playerChar.syncBones = undefined;
    playerChar.heroRig = undefined;
    playerChar.activeHeroId = undefined;
    return false;
  };

  if (heroId) {
    playerChar.setHero(heroId);
  }

  return playerChar;
}

export function createProceduralCharacter(): PlayerCharacter {
  return createPlayerCharacter();
}

/**
 * Skeletal Animation & Procedural Motion Engine
 */
export function animatePlayerCharacter(
  pc: PlayerCharacter,
  time: number,
  speedFactor: number,
  state: {
    isGrounded: boolean;
    isSliding: boolean;
    isGrinding: boolean;
    isBoosting: boolean;
    stumbleTimer: number;
    activeTrickName: string | null;
    activeTrick: TrickType | null;
    turnVelocity: number;
    nearestObstacleDist: number;
  }
): void {
  const { isSliding, isGrinding, isBoosting, stumbleTimer, activeTrick, turnVelocity } = state;

  // A. Hero Rig Animation (Skinned GLTF Mesh)
  if (pc.heroRig) {
    const b = pc.heroRig.drivers;
    const hipsBaseY = pc.heroRig.hipsRestY ?? 0.885;

    // Reset default driver rotations
    b.hips.rotation.set(0, 0, 0);
    b.spine.rotation.set(0, 0, 0);
    b.chest.rotation.set(0, 0, 0);
    b.neck.rotation.set(0, 0, 0);
    b.head.rotation.set(0, 0, 0);

    b.leftThigh.rotation.set(0, 0, 0);
    b.leftShin.rotation.set(0, 0, 0);
    b.leftFoot.rotation.set(0, 0, 0);
    b.rightThigh.rotation.set(0, 0, 0);
    b.rightShin.rotation.set(0, 0, 0);
    b.rightFoot.rotation.set(0, 0, 0);

    b.leftArm.rotation.set(0, 0, 0);
    b.leftForearm.rotation.set(0, 0, 0);
    b.rightArm.rotation.set(0, 0, 0);
    b.rightForearm.rotation.set(0, 0, 0);

    // 1. Continuous Rhythmic Carving & Surfing Weight-Shift Cycle
    const carveFreq = 2.0 + speedFactor * 0.8;
    const carvePhase = time * carveFreq;
    const isSpecialAction = isSliding || isGrinding || !state.isGrounded;
    const carveBlend = isSpecialAction ? 0.20 : 1.0;

    // Hips vertical riding bob and lateral weight shift
    const bob = Math.sin(time * 5 * speedFactor) * 0.012 * speedFactor;
    b.hips.position.y = hipsBaseY + bob;
    b.hips.rotation.z = Math.sin(carvePhase) * 0.05 * carveBlend + turnVelocity * 0.04;

    // Spine whip-lag and rhythmic surfing compression
    b.spine.rotation.set(
      0.04 + Math.sin(carvePhase * 2.0) * 0.02 * carveBlend,
      0,
      Math.sin(carvePhase + 0.35) * 0.07 * carveBlend - turnVelocity * 0.12
    );
    b.chest.rotation.set(0.02, 0, -turnVelocity * 0.04);

    // Head gaze: stably oriented forward down track
    b.head.rotation.set(
      -0.02,
      -0.55 - turnVelocity * 0.08,
      -Math.sin(carvePhase) * 0.02 * carveBlend
    );

    // Active Counter-Phase Arm Balance Swing
    const armRollL = -Math.sin(carvePhase) * 0.12 * carveBlend - 0.12 - turnVelocity * 0.05;
    const armPitchL = 0.14 + Math.cos(carvePhase) * 0.06 * carveBlend;
    b.leftArm.rotation.set(armPitchL, 0, armRollL);
    b.leftForearm.rotation.set(-0.15 + Math.sin(carvePhase) * 0.04 * carveBlend, 0, 0);

    const armRollR = Math.sin(carvePhase) * 0.12 * carveBlend + 0.18 + turnVelocity * 0.05;
    const armPitchR = -0.10 - Math.cos(carvePhase) * 0.06 * carveBlend;
    b.rightArm.rotation.set(armPitchR, 0, armRollR);
    b.rightForearm.rotation.set(-0.20 - Math.sin(carvePhase) * 0.04 * carveBlend, 0, 0);

    // Rhythmic Knee Flex & Weight Shift
    const legShift = Math.sin(carvePhase) * 0.04 * carveBlend;
    b.leftThigh.rotation.set(legShift, 0, 0.02);
    b.rightThigh.rotation.set(-legShift, 0, -0.02);
    b.leftShin.rotation.set(-legShift * 0.6, 0, 0);
    b.rightShin.rotation.set(legShift * 0.6, 0, 0);

    // 2. Movement States
    if (isSliding) {
      b.hips.position.y = hipsBaseY - 0.28;
      b.spine.rotation.set(0.35, 0, -turnVelocity * 0.08);
      b.head.rotation.set(-0.25, -0.55, 0);
      b.leftThigh.rotation.set(-0.25, 0, 0);
      b.rightThigh.rotation.set(-0.25, 0, 0);
      b.leftShin.rotation.set(0.28, 0, 0);
      b.rightShin.rotation.set(0.28, 0, 0);
      b.leftArm.rotation.set(0.18, 0, -0.15);
      b.rightArm.rotation.set(0.18, 0, 0.15);
    } else if (isGrinding) {
      b.leftArm.rotation.set(0.12, 0, -0.28);
      b.rightArm.rotation.set(-0.10, 0, 0.32);
      b.leftForearm.rotation.set(-0.25, 0, 0);
      b.rightForearm.rotation.set(-0.25, 0, 0);
      b.spine.rotation.z = Math.sin(time * 10) * 0.04 - turnVelocity * 0.08;
    } else if (!state.isGrounded) {
      b.hips.position.y = hipsBaseY + 0.16;
      b.spine.rotation.set(0.10, 0, -turnVelocity * 0.08);
      b.leftThigh.rotation.set(-0.18, 0, 0);
      b.rightThigh.rotation.set(-0.18, 0, 0);
      b.leftShin.rotation.set(0.22, 0, 0);
      b.rightShin.rotation.set(0.22, 0, 0);
      b.leftArm.rotation.set(-0.20, 0, -0.20);
      b.rightArm.rotation.set(-0.20, 0, 0.20);
    }

    // 3. Trick Animations
    if (activeTrick === 'spin' || state.activeTrickName?.includes('Corkscrew')) {
      b.spine.rotation.y = time * 20;
    } else if (activeTrick === 'flip' || state.activeTrickName?.includes('Backflip')) {
      b.hips.rotation.x = time * 18;
    } else if (activeTrick === 'grab' || state.activeTrickName?.includes('Grab')) {
      b.leftArm.rotation.set(0.35, 0, -0.20);
      b.spine.rotation.x = 0.20;
    } else if (activeTrick === 'pose' || state.activeTrickName?.includes('Glide')) {
      b.leftArm.rotation.set(0.18, 0, -0.38);
      b.rightArm.rotation.set(-0.12, 0, 0.42);
      b.leftForearm.rotation.set(-0.15, 0, 0);
      b.rightForearm.rotation.set(-0.15, 0, 0);
      b.chest.rotation.x = -0.10;
    }

    // 4. Stumble / Recoil
    if (stumbleTimer > 0) {
      const recoil = Math.sin(stumbleTimer * 25) * 0.2;
      b.spine.rotation.x = -recoil;
      b.leftArm.rotation.x = recoil * 1.2;
      b.rightArm.rotation.x = recoil * 1.2;
    }

    // 5. Head Look-Ahead
    if (state.nearestObstacleDist < 35) {
      const lookIntensity = (1.0 - state.nearestObstacleDist / 35) * 0.25;
      b.head.rotation.y += Math.sin(time * 8) * lookIntensity;
      b.neck.rotation.x = 0.1 * lookIntensity;
    }

    // Synchronize GLTF Hero Skeleton Bones
    pc.syncBones?.();
    return;
  }

  // B. Procedural Skater Model Animation
  if (pc.spineGroup && pc.spineGroup.visible) {
    const carveFreq = 2.0 + speedFactor * 0.8;
    const carvePhase = time * carveFreq;
    const idleBob = Math.sin(time * 5.0) * 0.03;

    pc.spineGroup.rotation.y = 0.66;

    if (isSliding) {
      pc.spineGroup.position.y = 0.05 + idleBob * 0.5;
      pc.spineGroup.rotation.x = 0.65;
      pc.spineGroup.rotation.z = turnVelocity * 0.05;
    } else if (stumbleTimer > 0) {
      pc.spineGroup.position.y = 0.25;
      pc.spineGroup.rotation.x = -0.35;
      pc.spineGroup.rotation.z = Math.sin(time * 24.0) * 0.15;
    } else if (isBoosting) {
      pc.spineGroup.position.y = 0.22 + idleBob;
      pc.spineGroup.rotation.x = 0.35;
      pc.spineGroup.rotation.z = Math.sin(carvePhase) * 0.06 - turnVelocity * 0.08;
    } else {
      pc.spineGroup.position.y = 0.3 + idleBob;
      pc.spineGroup.rotation.x = 0.10 + Math.sin(carvePhase * 2.0) * 0.02;
      pc.spineGroup.rotation.z = Math.sin(carvePhase) * 0.07 - turnVelocity * 0.08;
    }

    if (pc.headGroup) {
      pc.headGroup.rotation.y = -0.55 - turnVelocity * 0.06;
      pc.headGroup.rotation.x = isSliding ? -0.4 : -0.05;
      pc.headGroup.rotation.z = -Math.sin(carvePhase) * 0.02;
    }

    if (pc.leftArmGroup && pc.rightArmGroup) {
      if (isSliding) {
        pc.leftArmGroup.rotation.x = -0.9;
        pc.leftArmGroup.rotation.z = -0.2;
        pc.rightArmGroup.rotation.x = -0.9;
        pc.rightArmGroup.rotation.z = 0.2;
      } else if (isGrinding) {
        pc.leftArmGroup.rotation.z = 0.8 + Math.sin(time * 8.0) * 0.1;
        pc.rightArmGroup.rotation.z = -0.8 - Math.sin(time * 8.0) * 0.1;
        pc.leftArmGroup.rotation.x = 0;
        pc.rightArmGroup.rotation.x = 0;
      } else if (activeTrick === 'grab') {
        pc.leftArmGroup.rotation.x = 1.2;
        pc.leftArmGroup.rotation.z = -0.4;
        pc.rightArmGroup.rotation.x = -0.5;
        pc.rightArmGroup.rotation.z = 0.5;
      } else {
        const armSway = Math.sin(carvePhase) * 0.15;
        pc.leftArmGroup.rotation.x = 0.2 + Math.cos(carvePhase) * 0.08;
        pc.leftArmGroup.rotation.z = -0.15 - armSway - turnVelocity * 0.05;
        pc.rightArmGroup.rotation.x = -0.15 - Math.cos(carvePhase) * 0.08;
        pc.rightArmGroup.rotation.z = 0.25 + armSway - turnVelocity * 0.05;
      }
    }

    if (pc.capeMesh) {
      const flutterSpeed = 12.0 + speedFactor * 14.0;
      const flutter = Math.sin(time * flutterSpeed) * 0.25 + 0.35 + (isBoosting ? 0.3 : 0);
      pc.capeMesh.rotation.x = flutter;
      pc.capeMesh.rotation.z = Math.cos(time * flutterSpeed * 0.7) * 0.12 - turnVelocity * 0.05;
    }
  }
}
