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
    color: 0x090f18, // High-gloss/matte dark carbon composite
    roughness: 0.30,
    metalness: 0.65,
  });

  const tractionMat = new THREE.MeshStandardMaterial({
    color: 0x05080e, // Textured high-traction stomp pad
    roughness: 0.94,
    metalness: 0.05,
  });

  const finMat = new THREE.MeshStandardMaterial({
    color: 0x141e2e, // Deep titanium hydrodynamic fins
    roughness: 0.30,
    metalness: 0.85,
  });

  const stringerMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
  const thrusterGlowMat = new THREE.MeshBasicMaterial({ color: 0x00d2e0 });

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

  // 1. Sleek Cyber-Surfboard Group (1.48m length x 0.38m width, rocker, fins, glowing rails & stringer)
  const boardGroup = new THREE.Group();
  boardGroup.name = 'SurfboardGroup';
  boardGroup.position.set(0, 0.08, 0);

  // Center Deck (0.38m width x 0.024m thick x 0.64m length)
  const centerDeck = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.024, 0.64), carbonDeckMat);
  boardGroup.add(centerDeck);

  // Nose Section (tapers 0.38m -> 0.14m, with +0.035m upward nose rocker)
  const noseDeck = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.022, 0.44), carbonDeckMat);
  noseDeck.position.set(0, 0.014, 0.46);
  noseDeck.rotation.x = -0.06;
  boardGroup.add(noseDeck);

  const noseTip = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.16, 0.020, 12), carbonDeckMat);
  noseTip.position.set(0, 0.028, 0.69);
  noseTip.rotation.x = -0.06;
  boardGroup.add(noseTip);

  // Tail Section (tapers 0.38m -> 0.22m)
  const tailDeck = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.022, 0.42), carbonDeckMat);
  tailDeck.position.set(0, 0.002, -0.44);
  boardGroup.add(tailDeck);

  // Glowing Center Stringer Spine (Full length 1.48m)
  const stringerGeom = new THREE.BoxGeometry(0.014, 0.028, 1.46);
  const stringerMesh = new THREE.Mesh(stringerGeom, stringerMat);
  stringerMesh.position.set(0, 0.005, 0.04);
  boardGroup.add(stringerMesh);

  // Perimeter Neon Edge Rails
  const railGeom = new THREE.BoxGeometry(0.012, 0.020, 1.40);
  const leftRail = new THREE.Mesh(railGeom, neonCyanMat);
  leftRail.position.set(-0.185, 0.002, 0.04);
  const rightRail = new THREE.Mesh(railGeom, neonCyanMat);
  rightRail.position.set(0.185, 0.002, 0.04);
  boardGroup.add(leftRail, rightRail);

  // Rear Traction Stomp Pad (Rear foot anchor)
  const rearStomp = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.006, 0.36), tractionMat);
  rearStomp.position.set(0, 0.014, -0.32);
  boardGroup.add(rearStomp);

  const rearKickTail = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.012, 0.08), tractionMat);
  rearKickTail.position.set(0, 0.019, -0.51);
  boardGroup.add(rearKickTail);

  // Front Stance Pad (Front foot anchor, angled 25 deg for regular surf stance)
  const frontPad = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.006, 0.28), tractionMat);
  frontPad.position.set(-0.02, 0.014, 0.28);
  frontPad.rotation.y = 0.44;
  boardGroup.add(frontPad);

  // Underbody Hover Thruster Fins (Fins under the tail)
  // Center fin
  const centerFin = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.065, 0.13), finMat);
  centerFin.position.set(0, -0.040, -0.46);
  centerFin.rotation.x = 0.35;
  boardGroup.add(centerFin);

  // Left & Right Stabilizer Thruster Fins (canted outward 12 deg)
  const leftFin = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.048, 0.10), finMat);
  leftFin.position.set(-0.11, -0.032, -0.34);
  leftFin.rotation.set(0.28, 0, -0.22);
  boardGroup.add(leftFin);

  const rightFin = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.048, 0.10), finMat);
  rightFin.position.set(0.11, -0.032, -0.34);
  rightFin.rotation.set(0.28, 0, 0.22);
  boardGroup.add(rightFin);

  // Dual Recessed Plasma Ion Thrusters
  const thrusterNozzleGeom = new THREE.CylinderGeometry(0.025, 0.035, 0.07, 8);
  thrusterNozzleGeom.rotateX(Math.PI / 2);

  const leftNozzle = new THREE.Mesh(thrusterNozzleGeom, finMat);
  leftNozzle.position.set(-0.08, -0.018, -0.56);
  const leftPlume = new THREE.Mesh(new THREE.CircleGeometry(0.022, 8), thrusterGlowMat);
  leftPlume.position.set(0, 0, -0.036);
  leftNozzle.add(leftPlume);
  boardGroup.add(leftNozzle);

  const rightNozzle = new THREE.Mesh(thrusterNozzleGeom, finMat);
  rightNozzle.position.set(0.08, -0.018, -0.56);
  const rightPlume = new THREE.Mesh(new THREE.CircleGeometry(0.022, 8), thrusterGlowMat);
  rightPlume.position.set(0, 0, -0.036);
  rightNozzle.add(rightPlume);
  boardGroup.add(rightNozzle);

  // Foot Lights (Placed at front and rear foot sole anchors)
  const footLightLeft = new THREE.PointLight(0x00d2e0, 0.9, 2.0);
  footLightLeft.position.set(-0.05, 0.06, 0.28);
  boardGroup.add(footLightLeft);

  const footLightRight = new THREE.PointLight(0x00d2e0, 0.9, 2.0);
  footLightRight.position.set(0.05, 0.06, -0.28);
  boardGroup.add(footLightRight);

  // Forward-facing LED Headlight illuminating track ahead
  const forwardSpotLight = new THREE.SpotLight(0x00d2e0, 2.0, 26, Math.PI / 6, 0.35, 1.1);
  forwardSpotLight.position.set(0, 0.05, 0.65);
  forwardSpotLight.target.position.set(0, -0.2, 10.0);
  boardGroup.add(forwardSpotLight);
  boardGroup.add(forwardSpotLight.target);

  // Underglow Ground Contact Aura & Soft Shadow beneath surfboard
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

  // Soft Ground Contact Shadow Blob
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
    // Scales with velocity for an authentic, dynamic surfing pump
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

    // Head gaze: stably oriented forward down track, counter-acting body yaw stance & dampening roll
    b.head.rotation.set(
      -0.02,
      -0.55 - turnVelocity * 0.08,
      -Math.sin(carvePhase) * 0.02 * carveBlend
    );

    // Active Counter-Phase Arm Balance Swing (Natural Surfer balance)
    // Left (leading) arm balances slightly forward-outward
    const armRollL = -Math.sin(carvePhase) * 0.12 * carveBlend - 0.12 - turnVelocity * 0.05;
    const armPitchL = 0.14 + Math.cos(carvePhase) * 0.06 * carveBlend;
    b.leftArm.rotation.set(armPitchL, 0, armRollL);
    b.leftForearm.rotation.set(-0.15 + Math.sin(carvePhase) * 0.04 * carveBlend, 0, 0);

    // Right (trailing) arm balances outward and upward
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
      // Clean aerodynamic crouch
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
      // Balanced arms along rail (canted naturally outward for stability)
      b.leftArm.rotation.set(0.12, 0, -0.28);
      b.rightArm.rotation.set(-0.10, 0, 0.32);
      b.leftForearm.rotation.set(-0.25, 0, 0);
      b.rightForearm.rotation.set(-0.25, 0, 0);
      b.spine.rotation.z = Math.sin(time * 10) * 0.04 - turnVelocity * 0.08;
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
      b.leftArm.rotation.set(0.35, 0, -0.20);
      b.spine.rotation.x = 0.20;
    } else if (activeTrick === 'pose' || state.activeTrickName?.includes('Glide')) {
      // Graceful aerodynamic glide stance
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

    // Body in 38 deg regular surf stance
    pc.spineGroup.rotation.y = 0.66;

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
      pc.spineGroup.rotation.x = 0.35;
      pc.spineGroup.rotation.z = Math.sin(carvePhase) * 0.06 - turnVelocity * 0.08;
    } else {
      // Continuous dynamic athletic carving
      pc.spineGroup.position.y = 0.3 + idleBob;
      pc.spineGroup.rotation.x = 0.10 + Math.sin(carvePhase * 2.0) * 0.02;
      pc.spineGroup.rotation.z = Math.sin(carvePhase) * 0.07 - turnVelocity * 0.08;
    }

    // Head Look-Ahead (Stable forward gaze)
    if (pc.headGroup) {
      pc.headGroup.rotation.y = -0.55 - turnVelocity * 0.06;
      pc.headGroup.rotation.x = isSliding ? -0.4 : -0.05;
      pc.headGroup.rotation.z = -Math.sin(carvePhase) * 0.02;
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
        const armSway = Math.sin(carvePhase) * 0.15;
        pc.leftArmGroup.rotation.x = 0.2 + Math.cos(carvePhase) * 0.08;
        pc.leftArmGroup.rotation.z = -0.15 - armSway - turnVelocity * 0.05;
        pc.rightArmGroup.rotation.x = -0.15 - Math.cos(carvePhase) * 0.08;
        pc.rightArmGroup.rotation.z = 0.25 + armSway - turnVelocity * 0.05;
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
