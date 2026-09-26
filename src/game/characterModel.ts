import * as THREE from 'three';
import { CosmeticsConfig, TrickType } from '../types';

export interface PlayerCharacter {
  group: THREE.Group;
  board: THREE.Group;
  boards?: Record<string, THREE.Object3D>;
  companions?: Record<string, THREE.Object3D>;
  helmets?: Record<string, THREE.Object3D>;
  armors?: Record<string, THREE.Object3D>;
  visorMesh?: THREE.Mesh;
  underglowMesh?: THREE.Mesh;
  underglowLight?: THREE.PointLight;
  forwardSpotLight?: THREE.SpotLight;
  energyStreamMesh?: THREE.Mesh;
  capeMesh?: THREE.Mesh;
  applyGltfCosmetics?: (config: CosmeticsConfig) => void;
  headGroup?: THREE.Group;
  spineGroup?: THREE.Group;
  leftArmGroup?: THREE.Group;
  rightArmGroup?: THREE.Group;
  leftLegGroup?: THREE.Group;
  rightLegGroup?: THREE.Group;
}

export function createPlayerCharacter(): PlayerCharacter {
  const rootGroup = new THREE.Group();

  // Materials
  const suitMat = new THREE.MeshStandardMaterial({
    color: 0x121722,
    roughness: 0.35,
    metalness: 0.7,
  });

  const armorWhiteMat = new THREE.MeshStandardMaterial({
    color: 0xf5f7fb,
    roughness: 0.15,
    metalness: 0.85,
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

  // Step 2 & 5: Foreground Player Crisp Cyber Outline Material (Back-face scaled inverted hull)
  const outlineMat = new THREE.MeshBasicMaterial({
    color: 0x00f0ff,
    side: THREE.BackSide,
    transparent: true,
    opacity: 0.45,
  });

  // 1. Hoverboard Group
  const boardGroup = new THREE.Group();
  boardGroup.position.set(0, 0.15, 0);

  // Main board deck
  const deckGeom = new THREE.BoxGeometry(0.55, 0.08, 1.85);
  const deckMesh = new THREE.Mesh(deckGeom, suitMat);
  boardGroup.add(deckMesh);

  // Deck Outline Mesh for Crisp Foreground Pop
  const deckOutlineGeom = new THREE.BoxGeometry(0.58, 0.10, 1.88);
  const deckOutlineMesh = new THREE.Mesh(deckOutlineGeom, outlineMat);
  boardGroup.add(deckOutlineMesh);

  // Deck side neon rails
  const railGeom = new THREE.BoxGeometry(0.04, 0.06, 1.8);
  const leftRail = new THREE.Mesh(railGeom, neonCyanMat);
  leftRail.position.set(-0.28, 0.02, 0);
  const rightRail = new THREE.Mesh(railGeom, neonCyanMat);
  rightRail.position.set(0.28, 0.02, 0);
  boardGroup.add(leftRail, rightRail);

  // Twin Rear Thruster Turbines
  const thrusterGeom = new THREE.CylinderGeometry(0.09, 0.11, 0.3, 12);
  const leftThruster = new THREE.Mesh(thrusterGeom, armorWhiteMat);
  leftThruster.rotation.x = Math.PI / 2;
  leftThruster.position.set(-0.2, -0.04, -0.85);
  const rightThruster = new THREE.Mesh(thrusterGeom, armorWhiteMat);
  rightThruster.rotation.x = Math.PI / 2;
  rightThruster.position.set(0.2, -0.04, -0.85);
  boardGroup.add(leftThruster, rightThruster);

  // Step 5: Replace glow blob with Directional Forward Glow & Trailing Energy Stream
  // 1. Directional forward-facing headlight / thruster spot illuminating road ahead
  const forwardSpotLight = new THREE.SpotLight(0x00d2e0, 2.8, 26, Math.PI / 6, 0.4, 1.1);
  forwardSpotLight.position.set(0, 0.1, 0.6);
  forwardSpotLight.target.position.set(0, -0.3, 12.0);
  boardGroup.add(forwardSpotLight);
  boardGroup.add(forwardSpotLight.target);

  // 2. Trailing energy stream cone behind hoverboard
  const streamGeom = new THREE.ConeGeometry(0.32, 1.5, 8, 1, true);
  streamGeom.rotateX(-Math.PI / 2);
  const streamMat = new THREE.MeshBasicMaterial({
    color: 0x00d2e0,
    transparent: true,
    opacity: 0.70,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  const energyStreamMesh = new THREE.Mesh(streamGeom, streamMat);
  energyStreamMesh.position.set(0, -0.04, -1.6);
  boardGroup.add(energyStreamMesh);

  // Underglow light disc & point light (Soft glow around player)
  const underglowGeom = new THREE.PlaneGeometry(0.65, 1.95);
  const underglowMat = new THREE.MeshBasicMaterial({
    color: 0x00d2e0,
    transparent: true,
    opacity: 0.65,
    side: THREE.DoubleSide,
  });
  const underglowMesh = new THREE.Mesh(underglowGeom, underglowMat);
  underglowMesh.rotation.x = Math.PI / 2;
  underglowMesh.position.set(0, -0.05, 0);
  boardGroup.add(underglowMesh);

  const underglowLight = new THREE.PointLight(0x00d2e0, 1.8, 3.2);
  underglowLight.position.set(0, -0.2, 0);
  boardGroup.add(underglowLight);

  rootGroup.add(boardGroup);

  // 2. Character Body Hierarchy
  const spineGroup = new THREE.Group();
  spineGroup.position.set(0, 0.3, 0); // Positioned above the hoverboard
  rootGroup.add(spineGroup);

  // Pelvis / Hips
  const hipsGeom = new THREE.BoxGeometry(0.36, 0.2, 0.24);
  const hipsMesh = new THREE.Mesh(hipsGeom, suitMat);
  spineGroup.add(hipsMesh);

  // Torso / Chest
  const torsoGeom = new THREE.BoxGeometry(0.44, 0.45, 0.28);
  const torsoMesh = new THREE.Mesh(torsoGeom, armorWhiteMat);
  torsoMesh.position.set(0, 0.32, 0);
  spineGroup.add(torsoMesh);

  // Torso Crisp Outline
  const torsoOutlineGeom = new THREE.BoxGeometry(0.47, 0.48, 0.31);
  const torsoOutlineMesh = new THREE.Mesh(torsoOutlineGeom, outlineMat);
  torsoOutlineMesh.position.set(0, 0.32, 0);
  spineGroup.add(torsoOutlineMesh);

  // Cyber Vest Light Strips
  const chestLightGeom = new THREE.BoxGeometry(0.24, 0.2, 0.3);
  const chestLight = new THREE.Mesh(chestLightGeom, neonCyanMat);
  chestLight.position.set(0, 0.35, 0.01);
  spineGroup.add(chestLight);

  // Head Group
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.68, 0);
  spineGroup.add(headGroup);

  // Helmet Mesh
  const helmetGeom = new THREE.BoxGeometry(0.28, 0.3, 0.3);
  const helmetMesh = new THREE.Mesh(helmetGeom, armorWhiteMat);
  headGroup.add(helmetMesh);

  // Helmet Outline
  const helmetOutlineGeom = new THREE.BoxGeometry(0.31, 0.33, 0.33);
  const helmetOutlineMesh = new THREE.Mesh(helmetOutlineGeom, outlineMat);
  headGroup.add(helmetOutlineMesh);

  // Glowing Visor
  const visorGeom = new THREE.BoxGeometry(0.3, 0.12, 0.16);
  const visorMesh = new THREE.Mesh(visorGeom, visorMat);
  visorMesh.position.set(0, 0.02, 0.12);
  headGroup.add(visorMesh);

  // Cyber Scarf / Cape Mesh
  const capeGeom = new THREE.PlaneGeometry(0.38, 0.9, 3, 6);
  const capeMat = new THREE.MeshStandardMaterial({
    color: 0x00f0ff,
    emissive: new THREE.Color(0x00f0ff),
    emissiveIntensity: 0.6,
    side: THREE.DoubleSide,
    roughness: 0.4,
  });
  const capeMesh = new THREE.Mesh(capeGeom, capeMat);
  capeMesh.position.set(0, 0.48, -0.16);
  capeMesh.rotation.x = 0.2;
  spineGroup.add(capeMesh);

  // Left Arm Group
  const leftArmGroup = new THREE.Group();
  leftArmGroup.position.set(-0.28, 0.46, 0);
  const leftArmMesh = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.42, 0.14), suitMat);
  leftArmMesh.position.set(0, -0.18, 0);
  leftArmGroup.add(leftArmMesh);
  spineGroup.add(leftArmGroup);

  // Right Arm Group
  const rightArmGroup = new THREE.Group();
  rightArmGroup.position.set(0.28, 0.46, 0);
  const rightArmMesh = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.42, 0.14), suitMat);
  rightArmMesh.position.set(0, -0.18, 0);
  rightArmGroup.add(rightArmMesh);
  spineGroup.add(rightArmGroup);

  // Left Leg Group
  const leftLegGroup = new THREE.Group();
  leftLegGroup.position.set(-0.16, -0.1, 0);
  const leftLegMesh = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.48, 0.18), suitMat);
  leftLegMesh.position.set(0, -0.22, 0.05);
  leftLegGroup.add(leftLegMesh);
  spineGroup.add(leftLegGroup);

  // Right Leg Group
  const rightLegGroup = new THREE.Group();
  rightLegGroup.position.set(0.16, -0.1, 0);
  const rightLegMesh = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.48, 0.18), suitMat);
  rightLegMesh.position.set(0, -0.22, -0.1);
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

  const companions: Record<string, THREE.Object3D> = {};

  return {
    group: rootGroup,
    board: boardGroup,
    boards,
    helmets,
    armors,
    companions,
    visorMesh,
    underglowMesh,
    underglowLight,
    forwardSpotLight,
    energyStreamMesh,
    capeMesh,
    headGroup,
    spineGroup,
    leftArmGroup,
    rightArmGroup,
    leftLegGroup,
    rightLegGroup,
  };
}

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

  // 1. Natural Skater Stance & Carve Lean
  const idleBob = Math.sin(time * 5.0) * 0.03;
  if (pc.spineGroup) {
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
  }

  // 2. Head Look-Ahead
  if (pc.headGroup) {
    pc.headGroup.rotation.y = -turnVelocity * 0.06;
    pc.headGroup.rotation.x = isSliding ? -0.4 : -0.05;
  }

  // 3. Arms Balance
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

  // 4. Flowing Cyber Cape Flutter
  if (pc.capeMesh) {
    const flutterSpeed = (12.0 + speedFactor * 14.0);
    const flutter = Math.sin(time * flutterSpeed) * 0.25 + 0.35 + (isBoosting ? 0.3 : 0);
    pc.capeMesh.rotation.x = flutter;
    pc.capeMesh.rotation.z = Math.cos(time * flutterSpeed * 0.7) * 0.12 - turnVelocity * 0.05;
  }
}
