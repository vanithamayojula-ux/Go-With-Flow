import * as THREE from 'three';

/**
 * Procedurally-built cyberpunk street-skater character on a hoverboard.
 *
 * This replaces any flat sprite/plane approach (e.g. rendering a reference
 * PNG as a textured quad). Everything here is real 3D geometry, grouped so
 * you can animate individual parts (lean, bob, board tilt) later.
 *
 * Usage:
 *   import { createPlayerCharacter } from './characterModel';
 *   const player = createPlayerCharacter();
 *   scene.add(player.group);
 *
 * Then each frame, drive simple animation via the exposed part refs, e.g.:
 *   player.torso.rotation.z = laneShiftAmount * 0.3;
 *   player.board.rotation.z = laneShiftAmount * 0.15;
 */

const NEON_CYAN = 0x00e5ff;
const DARK_FABRIC = 0x17171c;
const DARK_FABRIC_2 = 0x1f1f26;
const SKIN = 0xd9a066;
const SOLE_GLOW = 0x00e5ff;

function neonMaterial(color: number = NEON_CYAN, intensity = 2) {
  return new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: intensity,
    roughness: 0.3,
    metalness: 0.2,
  });
}

function fabricMaterial(color: number = DARK_FABRIC) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.85,
    metalness: 0.05,
  });
}

export interface PlayerCharacter {
  group: THREE.Group;
  torso: THREE.Group;
  head: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  board: THREE.Group;
}

export function createPlayerCharacter(): PlayerCharacter {
  const group = new THREE.Group();
  group.name = 'PlayerCharacter';

  const fabric = fabricMaterial(DARK_FABRIC);
  const fabricAlt = fabricMaterial(DARK_FABRIC_2);
  const neon = neonMaterial(NEON_CYAN, 2);
  const skin = new THREE.MeshStandardMaterial({ color: SKIN, roughness: 0.7 });
  const darkMetal = new THREE.MeshStandardMaterial({
    color: 0x0a0a0d,
    roughness: 0.4,
    metalness: 0.6,
  });

  // ---------- HOVERBOARD ----------
  const board = new THREE.Group();
  board.name = 'Board';

  const deckGeo = new THREE.BoxGeometry(0.5, 0.06, 1.5);
  const deck = new THREE.Mesh(deckGeo, darkMetal);
  deck.position.y = 0;
  board.add(deck);

  const logoGeo = new THREE.ConeGeometry(0.09, 0.02, 3);
  const logo = new THREE.Mesh(logoGeo, neon);
  logo.rotation.x = Math.PI / 2;
  logo.position.set(0, 0.04, 0);
  board.add(logo);

  const ringGeo = new THREE.TorusGeometry(0.14, 0.025, 8, 20);
  const frontRing = new THREE.Mesh(ringGeo, neon);
  frontRing.position.set(0, -0.03, 0.55);
  board.add(frontRing);
  const backRing = frontRing.clone();
  backRing.position.z = -0.55;
  board.add(backRing);

  const edgeGeo = new THREE.BoxGeometry(0.02, 0.02, 1.4);
  const edgeL = new THREE.Mesh(edgeGeo, neon);
  edgeL.position.set(0.25, 0.02, 0);
  board.add(edgeL);
  const edgeR = edgeL.clone();
  edgeR.position.x = -0.25;
  board.add(edgeR);

  board.position.y = 0.15;
  group.add(board);

  // ---------- LEGS ----------
  function buildLeg(side: 1 | -1): THREE.Group {
    const leg = new THREE.Group();
    leg.name = side === 1 ? 'RightLeg' : 'LeftLeg';

    const upperGeo = new THREE.CapsuleGeometry(0.08, 0.32, 4, 8);
    const upper = new THREE.Mesh(upperGeo, fabric);
    upper.position.y = -0.18;
    leg.add(upper);

    const lowerGeo = new THREE.CapsuleGeometry(0.065, 0.28, 4, 8);
    const lower = new THREE.Mesh(lowerGeo, fabricAlt);
    lower.position.y = -0.5;
    leg.add(lower);

    const shoeGeo = new THREE.BoxGeometry(0.14, 0.09, 0.26);
    const shoe = new THREE.Mesh(shoeGeo, darkMetal);
    shoe.position.set(0, -0.68, 0.04);
    leg.add(shoe);

    const soleGeo = new THREE.BoxGeometry(0.15, 0.02, 0.27);
    const sole = new THREE.Mesh(soleGeo, neonMaterial(SOLE_GLOW, 2.2));
    sole.position.set(0, -0.72, 0.04);
    leg.add(sole);

    leg.position.set(side * 0.13, 0.55, side === 1 ? 0.15 : -0.15);
    return leg;
  }
  const rightLeg = buildLeg(1);
  const leftLeg = buildLeg(-1);
  group.add(rightLeg, leftLeg);

  // ---------- TORSO ----------
  const torso = new THREE.Group();
  torso.name = 'Torso';

  const torsoGeo = new THREE.CapsuleGeometry(0.18, 0.4, 6, 12);
  const torsoMesh = new THREE.Mesh(torsoGeo, fabric);
  torso.add(torsoMesh);

  const pipingGeo = new THREE.BoxGeometry(0.02, 0.42, 0.02);
  const piping = new THREE.Mesh(pipingGeo, neon);
  piping.position.set(0, 0, 0.18);
  torso.add(piping);

  const backLogoGeo = new THREE.ConeGeometry(0.07, 0.14, 3);
  const backLogo = new THREE.Mesh(backLogoGeo, neon);
  backLogo.rotation.z = Math.PI;
  backLogo.position.set(0, 0.05, -0.19);
  torso.add(backLogo);

  const collarGeo = new THREE.TorusGeometry(0.13, 0.03, 8, 16);
  const collar = new THREE.Mesh(collarGeo, fabricAlt);
  collar.rotation.x = Math.PI / 2;
  collar.position.y = 0.32;
  torso.add(collar);

  torso.position.y = 1.05;
  group.add(torso);

  // ---------- HEAD ----------
  const head = new THREE.Group();
  head.name = 'Head';

  const skullGeo = new THREE.SphereGeometry(0.15, 12, 12);
  const skull = new THREE.Mesh(skullGeo, skin);
  head.add(skull);

  const hairGeo = new THREE.SphereGeometry(0.155, 12, 12, 0, Math.PI * 2, 0, Math.PI * 0.6);
  const hair = new THREE.Mesh(hairGeo, new THREE.MeshStandardMaterial({ color: 0x0d0d10, roughness: 0.6 }));
  hair.position.y = 0.02;
  head.add(hair);

  const maskGeo = new THREE.SphereGeometry(0.1, 10, 10, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.4);
  const mask = new THREE.Mesh(maskGeo, new THREE.MeshStandardMaterial({ color: 0x0a0a0d, roughness: 0.5 }));
  mask.position.set(0, -0.03, 0.05);
  head.add(mask);

  const maskGlowGeo = new THREE.TorusGeometry(0.1, 0.008, 6, 16, Math.PI);
  const maskGlow = new THREE.Mesh(maskGlowGeo, neon);
  maskGlow.position.set(0, 0.02, 0.09);
  maskGlow.rotation.x = Math.PI / 2;
  head.add(maskGlow);

  head.position.y = 1.42;
  group.add(head);

  // ---------- ARMS ----------
  function buildArm(side: 1 | -1): THREE.Group {
    const arm = new THREE.Group();
    arm.name = side === 1 ? 'RightArm' : 'LeftArm';

    const upperGeo = new THREE.CapsuleGeometry(0.06, 0.26, 4, 8);
    const upper = new THREE.Mesh(upperGeo, fabric);
    upper.position.y = -0.15;
    arm.add(upper);

    const lowerGeo = new THREE.CapsuleGeometry(0.05, 0.24, 4, 8);
    const lower = new THREE.Mesh(lowerGeo, fabricAlt);
    lower.position.y = -0.4;
    arm.add(lower);

    const gloveGeo = new THREE.SphereGeometry(0.06, 8, 8);
    const glove = new THREE.Mesh(gloveGeo, new THREE.MeshStandardMaterial({ color: 0x0a0a0d, roughness: 0.6 }));
    glove.position.y = -0.54;
    arm.add(glove);

    const stripeGeo = new THREE.BoxGeometry(0.015, 0.45, 0.015);
    const stripe = new THREE.Mesh(stripeGeo, neon);
    stripe.position.set(side * 0.055, -0.25, 0);
    arm.add(stripe);

    arm.position.set(side * 0.24, 1.22, 0);
    arm.rotation.z = side * 0.12;
    return arm;
  }
  const rightArm = buildArm(1);
  const leftArm = buildArm(-1);
  group.add(rightArm, leftArm);

  return {
    group,
    torso,
    head,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    board,
  };
}

/**
 * Simple idle/running animation you can call every frame from your game loop.
 * @param player  result of createPlayerCharacter()
 * @param time    elapsed time in seconds (e.g. clock.getElapsedTime())
 * @param speedFactor  0..1+, scales bob/lean intensity with current game speed
 */
export function animatePlayerCharacter(
  player: PlayerCharacter,
  time: number,
  speedFactor: number = 1,
) {
  const bob = Math.sin(time * 8 * speedFactor) * 0.03 * speedFactor;
  player.torso.position.y = 1.05 + bob;
  player.head.position.y = 1.42 + bob;

  const armSwing = Math.sin(time * 8 * speedFactor) * 0.15 * speedFactor;
  player.rightArm.rotation.x = armSwing;
  player.leftArm.rotation.x = -armSwing;

  player.board.position.y = 0.15 + Math.sin(time * 4) * 0.015;
}
