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

export function createPlayerCharacter(heroId?: HeroId): PlayerCharacter {
  const rootGroup = new THREE.Group();
  rootGroup.name = 'PlayerCharacterRoot';

  // Materials
  const carbonDeckMat = new THREE.MeshStandardMaterial({
    color: 0x0a0f18, // Matte carbon composite (non-glaring, non-overexposed)
    roughness: 0.55,
    metalness: 0.35,
  });

  const truckMat = new THREE.MeshStandardMaterial({
    color: 0x1c2333, // Dark titanium alloy skateboard trucks
    roughness: 0.35,
    metalness: 0.8,
  });

  const axleMat = new THREE.MeshStandardMaterial({
    color: 0x8899aa, // Polished steel axle
    roughness: 0.25,
    metalness: 0.9,
  });

  const wheelMat = new THREE.MeshStandardMaterial({
    color: 0x161e2c, // High-rebound dark urethane wheels
    roughness: 0.65,
    metalness: 0.2,
  });

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

  // Strict 25% brightness balanced Cyan and Magenta
  const neonCyanMat = new THREE.MeshBasicMaterial({ color: 0x00d2e0 });
  const neonMagentaMat = new THREE.MeshBasicMaterial({ color: 0xe00070 });

  const visorMat = new THREE.MeshPhysicalMaterial({
    color: 0x00d2e0,
    emissive: new THREE.Color(0x00d2e0),
    emissiveIntensity: 1.2,
    roughness: 0.1,
    transmission: 0.35,
    thickness: 0.5,
  });

  // 1. Realistic Skateboard Group (0.92m length x 0.26m width)
  const boardGroup = new THREE.Group();
  boardGroup.name = 'SkateboardGroup';
  boardGroup.position.set(0, 0.08, 0);

  // Main board center deck (0.58m x 0.26m x 0.022m)
  const deckGeom = new THREE.BoxGeometry(0.26, 0.022, 0.58);
  const deckMesh = new THREE.Mesh(deckGeom, carbonDeckMat);
  boardGroup.add(deckMesh);

  // High-friction Grip Tape Top Surface
  const gripGeom = new THREE.BoxGeometry(0.24, 0.006, 0.56);
  const gripMat = new THREE.MeshStandardMaterial({ color: 0x070a10, roughness: 0.96, metalness: 0.05 });
  const gripMesh = new THREE.Mesh(gripGeom, gripMat);
  gripMesh.position.set(0, 0.012, 0);
  boardGroup.add(gripMesh);

  // Tapered Upturned Nose Kicktail (0.24m x 0.022m x 0.17m, angled ~18 deg)
  const noseKickGeom = new THREE.BoxGeometry(0.24, 0.022, 0.17);
  const noseKick = new THREE.Mesh(noseKickGeom, carbonDeckMat);
  noseKick.position.set(0, 0.026, 0.36);
  noseKick.rotation.x = -0.30; // Upward nose kick angle
  boardGroup.add(noseKick);

  const noseGrip = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.006, 0.16), gripMat);
  noseGrip.position.set(0, 0.012, 0);
  noseKick.add(noseGrip);

  // Tapered Upturned Tail Kicktail (0.24m x 0.022m x 0.17m, angled ~18 deg)
  const tailKickGeom = new THREE.BoxGeometry(0.24, 0.022, 0.17);
  const tailKick = new THREE.Mesh(tailKickGeom, carbonDeckMat);
  tailKick.position.set(0, 0.026, -0.36);
  tailKick.rotation.x = 0.30; // Upward tail kick angle
  boardGroup.add(tailKick);

  const tailGrip = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.006, 0.16), gripMat);
  tailGrip.position.set(0, 0.012, 0);
  tailKick.add(tailGrip);

  // Deck Side Rails with Cyber Accent Trim
  const railGeom = new THREE.BoxGeometry(0.016, 0.020, 0.58);
  const leftRail = new THREE.Mesh(railGeom, neonCyanMat);
  leftRail.position.set(-0.13, 0.002, 0);
  const rightRail = new THREE.Mesh(railGeom, neonCyanMat);
  rightRail.position.set(0.13, 0.002, 0);
  boardGroup.add(leftRail, rightRail);

  // Skateboard Trucks (Baseplate + Hanger / Axle)
  // Front Truck
  const frontBaseplate = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.018, 0.07), truckMat);
  frontBaseplate.position.set(0, -0.015, 0.24);
  boardGroup.add(frontBaseplate);

  const frontAxleGeom = new THREE.CylinderGeometry(0.009, 0.009, 0.22, 10);
  frontAxleGeom.rotateZ(Math.PI / 2);
  const frontAxle = new THREE.Mesh(frontAxleGeom, axleMat);
  frontAxle.position.set(0, -0.035, 0.24);
  boardGroup.add(frontAxle);

  // Rear Truck
  const rearBaseplate = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.018, 0.07), truckMat);
  rearBaseplate.position.set(0, -0.015, -0.24);
  boardGroup.add(rearBaseplate);

  const rearAxleGeom = new THREE.CylinderGeometry(0.009, 0.009, 0.22, 10);
  rearAxleGeom.rotateZ(Math.PI / 2);
  const rearAxle = new THREE.Mesh(rearAxleGeom, axleMat);
  rearAxle.position.set(0, -0.035, -0.24);
  boardGroup.add(rearAxle);

  // 4 Skateboard Wheels with Glowing Hub Rings (Rotated around Z so rotating X rolls forward along Z)
  const wheelGeom = new THREE.CylinderGeometry(0.045, 0.045, 0.036, 16);
  wheelGeom.rotateZ(Math.PI / 2);

  const hubGeom = new THREE.RingGeometry(0.012, 0.032, 12);
  hubGeom.rotateY(Math.PI / 2);

  const wheels: THREE.Mesh[] = [];

  const createWheel = (x: number, y: number, z: number, isLeft: boolean) => {
    const w = new THREE.Mesh(wheelGeom, wheelMat);
    w.position.set(x, y, z);

    const hub = new THREE.Mesh(hubGeom, neonCyanMat);
    hub.position.set(isLeft ? -0.019 : 0.019, 0, 0);
    if (!isLeft) hub.rotation.y = Math.PI;
    w.add(hub);

    boardGroup.add(w);
    wheels.push(w);
    return w;
  };

  createWheel(-0.125, -0.035, 0.24, true);   // Front-Left
  createWheel(0.125, -0.035, 0.24, false);   // Front-Right
  createWheel(-0.125, -0.035, -0.24, true);  // Rear-Left
  createWheel(0.125, -0.035, -0.24, false);  // Rear-Right

  // Foot Lights (Placed at front and rear foot sole anchors)
  const footLightLeft = new THREE.PointLight(0x00d2e0, 0.9, 2.0);
  footLightLeft.position.set(-0.06, 0.06, 0.18);
  boardGroup.add(footLightLeft);

  const footLightRight = new THREE.PointLight(0x00d2e0, 0.9, 2.0);
  footLightRight.position.set(0.06, 0.06, -0.18);
  boardGroup.add(footLightRight);

  // Forward-facing LED Headlight illuminating track ahead
  const forwardSpotLight = new THREE.SpotLight(0x00d2e0, 2.0, 24, Math.PI / 6, 0.35, 1.1);
  forwardSpotLight.position.set(0, 0.05, 0.40);
  forwardSpotLight.target.position.set(0, -0.2, 10.0);
  boardGroup.add(forwardSpotLight);
  boardGroup.add(forwardSpotLight.target);

  // Underglow Ground Contact Aura & Soft Shadow beneath skateboard
  const underglowGeom = new THREE.PlaneGeometry(0.38, 1.05);
  const underglowMat = new THREE.MeshBasicMaterial({
    color: 0x00d2e0,
    transparent: true,
    opacity: 0.35,
    side: THREE.DoubleSide,
  });
  const underglowMesh = new THREE.Mesh(underglowGeom, underglowMat);
  underglowMesh.rotation.x = Math.PI / 2;
  underglowMesh.position.set(0, -0.075, 0);
  boardGroup.add(underglowMesh);

  // Soft Ground Contact Shadow Blob
  const shadowBlobMat = new THREE.MeshBasicMaterial({
    color: 0x020408,
    transparent: true,
    opacity: 0.55,
    side: THREE.DoubleSide,
  });
  const shadowBlob = new THREE.Mesh(new THREE.PlaneGeometry(0.40, 1.08), shadowBlobMat);
  shadowBlob.rotation.x = Math.PI / 2;
  shadowBlob.position.set(0, -0.078, 0);
  boardGroup.add(shadowBlob);

  const underglowLight = new THREE.PointLight(0x00d2e0, 1.2, 2.5);
  underglowLight.position.set(0, -0.06, 0);
  boardGroup.add(underglowLight);

  rootGroup.add(boardGroup);

  // 2. Procedural Character Body Hierarchy
  const spineGroup = new THREE.Group();
  spineGroup.name = 'ProceduralSpineGroup';
  spineGroup.position.set(0, 0.28, 0); // Positioned above the skateboard deck
  rootGroup.add(spineGroup);

  // Pelvis / Hips
  const hipsGeom = new THREE.BoxGeometry(0.32, 0.18, 0.22);
  const hipsMesh = new THREE.Mesh(hipsGeom, suitMat);
  spineGroup.add(hipsMesh);

  // Torso / Chest
  const torsoGeom = new THREE.BoxGeometry(0.38, 0.42, 0.26);
  const torsoMesh = new THREE.Mesh(torsoGeom, armorWhiteMat);
  torsoMesh.position.set(0, 0.30, 0);
  spineGroup.add(torsoMesh);

  // Torso Crisp Outline
  const torsoOutlineGeom = new THREE.BoxGeometry(0.41, 0.45, 0.29);
  const torsoOutlineMesh = new THREE.Mesh(torsoOutlineGeom, outlineMat);
  torsoOutlineMesh.position.set(0, 0.30, 0);
  spineGroup.add(torsoOutlineMesh);

  // Cyber Vest Light Strips
  const chestLightGeom = new THREE.BoxGeometry(0.20, 0.18, 0.28);
  const chestLight = new THREE.Mesh(chestLightGeom, neonCyanMat);
  chestLight.position.set(0, 0.33, 0.01);
  spineGroup.add(chestLight);

  // Head Group
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.64, 0);
  spineGroup.add(headGroup);

  // Helmet Mesh
  const helmetGeom = new THREE.BoxGeometry(0.26, 0.28, 0.28);
  const helmetMesh = new THREE.Mesh(helmetGeom, armorWhiteMat);
  headGroup.add(helmetMesh);

  // Helmet Outline
  const helmetOutlineGeom = new THREE.BoxGeometry(0.29, 0.31, 0.31);
  const helmetOutlineMesh = new THREE.Mesh(helmetOutlineGeom, outlineMat);
  headGroup.add(helmetOutlineMesh);

  // Glowing Visor
  const visorGeom = new THREE.BoxGeometry(0.28, 0.11, 0.15);
  const visorMesh = new THREE.Mesh(visorGeom, visorMat);
  visorMesh.position.set(0, 0.02, 0.11);
  headGroup.add(visorMesh);

  // Cyber Scarf / Cape Mesh
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

  // Left Arm Group
  const leftArmGroup = new THREE.Group();
  leftArmGroup.position.set(-0.25, 0.42, 0);
  const leftArmMesh = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.38, 0.13), suitMat);
  leftArmMesh.position.set(0, -0.16, 0);
  leftArmGroup.add(leftArmMesh);
  spineGroup.add(leftArmGroup);

  // Right Arm Group
  const rightArmGroup = new THREE.Group();
  rightArmGroup.position.set(0.25, 0.42, 0);
  const rightArmMesh = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.38, 0.13), suitMat);
  rightArmMesh.position.set(0, -0.16, 0);
  rightArmGroup.add(rightArmMesh);
  spineGroup.add(rightArmGroup);

  // Left Leg Group (Front Foot Stance on Deck)
  const leftLegGroup = new THREE.Group();
  leftLegGroup.position.set(-0.12, -0.08, 0.16);
  const leftLegMesh = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.44, 0.15), suitMat);
  leftLegMesh.position.set(0, -0.20, 0);
  leftLegGroup.add(leftLegMesh);
  spineGroup.add(leftLegGroup);

  // Right Leg Group (Rear Foot Stance on Tail)
  const rightLegGroup = new THREE.Group();
  rightLegGroup.position.set(0.12, -0.08, -0.16);
  const rightLegMesh = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.44, 0.15), suitMat);
  rightLegMesh.position.set(0, -0.20, 0);
  rightLegGroup.add(rightLegMesh);
  spineGroup.add(rightLegGroup);

  // Cosmetic Variant Groups for CosmeticsConfig
  const boards: Record<string, THREE.Object3D> = {
    'cyber-phantom': boardGroup,
  };

  const helmets: Record<string, THREE.Object3D> = {
    'cyber-runner': helmetMesh,
  };

  const armors: Record<string, THREE.Object3D> = {
    'carbon-fiber': torsoMesh,
  };

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
    wheels,
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

    // 1. Natural Athletic Forward Stance
    const bob = Math.sin(time * 5 * speedFactor) * 0.012 * speedFactor;
    b.hips.position.y = hipsBaseY + bob;

    // Organic breathing & riding sway
    b.spine.rotation.set(0.04 + Math.sin(time * 3) * 0.015, 0, -turnVelocity * 0.12);
    b.chest.rotation.set(0.02, 0, -turnVelocity * 0.04);
    b.head.rotation.set(-0.02, -turnVelocity * 0.08, 0);

    // Subtle dynamic limb sway
    const armSway = Math.sin(time * 5 * speedFactor) * 0.04;
    b.leftArm.rotation.set(armSway, 0, -0.04);
    b.rightArm.rotation.set(-armSway, 0, 0.04);

    const legFlex = Math.sin(time * 5 * speedFactor) * 0.025;
    b.leftThigh.rotation.set(legFlex, 0, 0);
    b.rightThigh.rotation.set(-legFlex, 0, 0);

    // 2. Movement States
    if (isSliding) {
      // Clean aerodynamic crouch
      b.hips.position.y = hipsBaseY - 0.28;
      b.spine.rotation.set(0.35, 0, -turnVelocity * 0.08);
      b.head.rotation.set(-0.25, 0, 0);
      b.leftThigh.rotation.set(-0.25, 0, 0);
      b.rightThigh.rotation.set(-0.25, 0, 0);
      b.leftShin.rotation.set(0.28, 0, 0);
      b.rightShin.rotation.set(0.28, 0, 0);
      b.leftArm.rotation.set(0.18, 0, -0.15);
      b.rightArm.rotation.set(0.18, 0, 0.15);
    } else if (isGrinding) {
      // Balanced arms along rail
      b.leftArm.rotation.set(0, 0, 0.65);
      b.rightArm.rotation.set(0, 0, -0.65);
      b.spine.rotation.z = Math.sin(time * 10) * 0.06 - turnVelocity * 0.08;
    } else if (!state.isGrounded) {
      // Air tuck during jump
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
      b.leftArm.rotation.set(0.5, 0, -0.25);
      b.spine.rotation.x = 0.30;
    } else if (activeTrick === 'pose' || state.activeTrickName?.includes('Glide')) {
      b.leftArm.rotation.z = 1.2;
      b.rightArm.rotation.z = -1.2;
      b.chest.rotation.x = -0.2;
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
    const idleBob = Math.sin(time * 5.0) * 0.03;
    if (isSliding) {
      // Deep aerodynamic duck
      pc.spineGroup.position.y = 0.05 + idleBob * 0.5;
      pc.spineGroup.rotation.x = 0.65;
      pc.spineGroup.rotation.z = turnVelocity * 0.05;
    } else if (stumbleTimer > 0) {
      // Recoil backward stumble
      pc.spineGroup.position.y = 0.25;
      pc.spineGroup.rotation.x = -0.35;
      pc.spineGroup.rotation.z = Math.sin(time * 24.0) * 0.15;
    } else if (isBoosting) {
      // Low forward tuck
      pc.spineGroup.position.y = 0.22 + idleBob;
      pc.spineGroup.rotation.x = 0.4;
      pc.spineGroup.rotation.z = -turnVelocity * 0.08;
    } else {
      // Standard dynamic athletic carve
      pc.spineGroup.position.y = 0.3 + idleBob;
      pc.spineGroup.rotation.x = 0.12;
      pc.spineGroup.rotation.z = -turnVelocity * 0.08;
    }

    // Head Look-Ahead
    if (pc.headGroup) {
      pc.headGroup.rotation.y = -turnVelocity * 0.06;
      pc.headGroup.rotation.x = isSliding ? -0.4 : -0.05;
    }

    // Arms Balance
    if (pc.leftArmGroup && pc.rightArmGroup) {
      if (isSliding) {
        pc.leftArmGroup.rotation.x = -0.9;
        pc.leftArmGroup.rotation.z = -0.2;
        pc.rightArmGroup.rotation.x = -0.9;
        pc.rightArmGroup.rotation.z = 0.2;
      } else if (isGrinding) {
        // Wide rail balance
        pc.leftArmGroup.rotation.z = 0.8 + Math.sin(time * 8.0) * 0.1;
        pc.rightArmGroup.rotation.z = -0.8 - Math.sin(time * 8.0) * 0.1;
        pc.leftArmGroup.rotation.x = 0;
        pc.rightArmGroup.rotation.x = 0;
      } else if (activeTrick === 'grab') {
        // Grabbing board rail
        pc.leftArmGroup.rotation.x = 1.2;
        pc.leftArmGroup.rotation.z = -0.4;
        pc.rightArmGroup.rotation.x = -0.5;
        pc.rightArmGroup.rotation.z = 0.5;
      } else {
        // Natural carving arms counter-swing
        const armSway = Math.sin(time * 6.0) * 0.15;
        pc.leftArmGroup.rotation.x = armSway + 0.2;
        pc.leftArmGroup.rotation.z = 0.25 - turnVelocity * 0.05;
        pc.rightArmGroup.rotation.x = -armSway - 0.2;
        pc.rightArmGroup.rotation.z = -0.25 - turnVelocity * 0.05;
      }
    }

    // Flowing Cyber Cape Flutter
    if (pc.capeMesh) {
      const flutterSpeed = 12.0 + speedFactor * 14.0;
      const flutter = Math.sin(time * flutterSpeed) * 0.25 + 0.35 + (isBoosting ? 0.3 : 0);
      pc.capeMesh.rotation.x = flutter;
      pc.capeMesh.rotation.z = Math.cos(time * flutterSpeed * 0.7) * 0.12 - turnVelocity * 0.05;
    }
  }
}
