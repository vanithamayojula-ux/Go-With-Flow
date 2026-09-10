import * as THREE from 'three';

export interface PlayerCharacterModel {
  group: THREE.Group;
  characterMesh: THREE.Group;
  torsoMesh: THREE.Mesh;
  headMesh: THREE.Mesh;
  visorMesh: THREE.Mesh;
  capeMesh: THREE.Mesh;
  leftArmMesh: THREE.Group;
  rightArmMesh: THREE.Group;
  leftLegMesh: THREE.Mesh;
  rightLegMesh: THREE.Mesh;
  boardMesh: THREE.Group;
  boardDeckMesh: THREE.Mesh;
  boardFoilMesh: THREE.Mesh;
  underglowMesh: THREE.Mesh;
  underglowLight: THREE.PointLight;
}

/**
 * Creates a procedurally built low-poly 3D cyberpunk street-skater character
 * standing on a glowing hoverboard using Three.js primitives.
 */
export function createPlayerCharacter(): PlayerCharacterModel {
  const rootGroup = new THREE.Group();

  // Color Palette & Materials
  const baseDarkColor = 0x1a1a1f; // Charcoal / dark black base
  const pantsColor = 0x14161c;    // Cargo pants
  const gloveColor = 0x0a0c10;    // Dark gloves
  const skinColor = 0xd5aa82;     // Skin tone for visible face area
  const hairColor = 0x0d0e15;     // Dark hair
  const sneakerColor = 0x151821;  // High-top sneakers
  const boardColor = 0x12151f;    // Dark composite deck

  // Main Materials
  const jacketMat = new THREE.MeshStandardMaterial({
    color: baseDarkColor,
    roughness: 0.45,
    metalness: 0.35,
  });

  const pantsMat = new THREE.MeshStandardMaterial({
    color: pantsColor,
    roughness: 0.65,
    metalness: 0.2,
  });

  const skinMat = new THREE.MeshStandardMaterial({
    color: skinColor,
    roughness: 0.6,
  });

  const gloveMat = new THREE.MeshStandardMaterial({
    color: gloveColor,
    roughness: 0.5,
    metalness: 0.3,
  });

  const hairMat = new THREE.MeshStandardMaterial({
    color: hairColor,
    roughness: 0.7,
  });

  const sneakerMat = new THREE.MeshStandardMaterial({
    color: sneakerColor,
    roughness: 0.4,
    metalness: 0.2,
  });

  const boardMat = new THREE.MeshStandardMaterial({
    color: boardColor,
    roughness: 0.3,
    metalness: 0.8,
  });

  // Emissive Cyan Neon Materials (for Bloom Post-processing)
  const neonCyanMat = new THREE.MeshStandardMaterial({
    color: 0x00e5ff,
    emissive: 0x00e5ff,
    emissiveIntensity: 1.8,
    roughness: 0.2,
    metalness: 0.5,
  });

  // ----------------------------------------------------
  // 1. HOVERBOARD
  // ----------------------------------------------------
  const boardMesh = new THREE.Group();

  // Flat dark deck (contoured kicktail & nose)
  const deckGeom = new THREE.BoxGeometry(0.76, 0.08, 2.7);
  const boardDeckMesh = new THREE.Mesh(deckGeom, boardMat);
  boardDeckMesh.castShadow = true;
  boardMesh.add(boardDeckMesh);

  // Curved Nose & Kicktail
  const tipGeom = new THREE.BoxGeometry(0.74, 0.08, 0.4);
  const nose = new THREE.Mesh(tipGeom, boardMat);
  nose.position.set(0, 0.06, 1.45);
  nose.rotation.x = -0.15;
  boardMesh.add(nose);

  const tail = new THREE.Mesh(tipGeom, boardMat);
  tail.position.set(0, 0.06, -1.45);
  tail.rotation.x = 0.15;
  boardMesh.add(tail);

  // Glowing Cyan Edge Foil / Trim
  const edgeGeom = new THREE.BoxGeometry(0.80, 0.09, 2.76);
  const boardFoilMesh = new THREE.Mesh(edgeGeom, neonCyanMat);
  boardFoilMesh.position.set(0, -0.005, 0);
  boardMesh.add(boardFoilMesh);

  // Subtle Emissive Triangle Logo on Top Deck
  const logoGeom = new THREE.ConeGeometry(0.22, 0.02, 3);
  logoGeom.rotateX(Math.PI / 2);
  const topLogo = new THREE.Mesh(logoGeom, neonCyanMat);
  topLogo.position.set(0, 0.045, 0.1);
  boardMesh.add(topLogo);

  // Glowing Cyan Rings (Wheel replacements at front & back thrusters)
  const thrusterRingGeom = new THREE.TorusGeometry(0.15, 0.035, 8, 16);
  thrusterRingGeom.rotateX(Math.PI / 2);

  const wheelPositions: [number, number, number][] = [
    [-0.26, -0.09, 0.85],  // Front Left Wheel Ring
    [0.26, -0.09, 0.85],   // Front Right Wheel Ring
    [-0.26, -0.09, -0.85], // Rear Left Wheel Ring
    [0.26, -0.09, -0.85],  // Rear Right Wheel Ring
  ];

  wheelPositions.forEach(([wx, wy, wz]) => {
    const wheelRing = new THREE.Mesh(thrusterRingGeom, neonCyanMat);
    wheelRing.position.set(wx, wy, wz);
    boardMesh.add(wheelRing);

    const wheelLight = new THREE.PointLight(0x00e5ff, 0.5, 2.0);
    wheelLight.position.set(wx, wy - 0.05, wz);
    boardMesh.add(wheelLight);
  });

  // Central Bottom Core Ring
  const bottomCore = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.04, 8, 16), neonCyanMat);
  bottomCore.rotateX(Math.PI / 2);
  bottomCore.position.set(0, -0.06, 0);
  boardMesh.add(bottomCore);

  // Hover Underglow Plane & Point Light
  const underglowGeom = new THREE.PlaneGeometry(1.3, 3.0);
  underglowGeom.rotateX(-Math.PI / 2);
  const underglowMat = new THREE.MeshBasicMaterial({
    color: 0x00e5ff,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
  });
  const underglowMesh = new THREE.Mesh(underglowGeom, underglowMat);
  underglowMesh.position.set(0, -0.12, 0);
  boardMesh.add(underglowMesh);

  const underglowLight = new THREE.PointLight(0x00e5ff, 2.2, 8.0, 1.8);
  underglowLight.position.set(0, -0.2, 0);
  boardMesh.add(underglowLight);

  rootGroup.add(boardMesh);

  // ----------------------------------------------------
  // 2. CHARACTER MODEL (Cyberpunk Street Skater)
  // ----------------------------------------------------
  const characterMesh = new THREE.Group();

  // Torso / Jacket + Hoodie Combo (Slim Build)
  const torsoGeom = new THREE.CylinderGeometry(0.24, 0.32, 0.62, 10);
  const torsoMesh = new THREE.Mesh(torsoGeom, jacketMat);
  torsoMesh.position.set(0, 0.68, 0);
  torsoMesh.castShadow = true;
  characterMesh.add(torsoMesh);

  // Inner Hoodie Layer
  const innerHoodieGeom = new THREE.CylinderGeometry(0.25, 0.30, 0.60, 10);
  const innerHoodie = new THREE.Mesh(innerHoodieGeom, jacketMat);
  innerHoodie.position.set(0, 0.68, 0.01);
  characterMesh.add(innerHoodie);

  // Cyan Neon Piping Down Back
  const backLineGeom = new THREE.BoxGeometry(0.04, 0.52, 0.02);
  const backLine = new THREE.Mesh(backLineGeom, neonCyanMat);
  backLine.position.set(0, 0.68, -0.17);
  characterMesh.add(backLine);

  // Cyan Neon Emblem on Back of Jacket
  const backEmblemGeom = new THREE.ConeGeometry(0.18, 0.02, 3);
  backEmblemGeom.rotateX(-Math.PI / 2);
  const backEmblem = new THREE.Mesh(backEmblemGeom, neonCyanMat);
  backEmblem.position.set(0, 0.76, -0.17);
  characterMesh.add(backEmblem);

  // Hood Edge & Collar Neon Cyan Piping
  const hoodCollarGeom = new THREE.TorusGeometry(0.26, 0.025, 8, 16);
  hoodCollarGeom.rotateX(Math.PI / 2);
  const hoodCollarPiping = new THREE.Mesh(hoodCollarGeom, neonCyanMat);
  hoodCollarPiping.position.set(0, 0.96, 0);
  characterMesh.add(hoodCollarPiping);

  // Hood Structure on Back of Neck
  const hoodBulgeGeom = new THREE.SphereGeometry(0.26, 8, 8, 0, Math.PI * 2, 0, Math.PI / 1.8);
  const hoodBulge = new THREE.Mesh(hoodBulgeGeom, jacketMat);
  hoodBulge.position.set(0, 0.92, -0.12);
  characterMesh.add(hoodBulge);

  // ----------------------------------------------------
  // ARMS (Left & Right) with Sleeve Neon Piping & Gloves
  // ----------------------------------------------------
  const leftArmMesh = new THREE.Group();
  leftArmMesh.position.set(-0.28, 0.78, 0);

  const upperArmGeom = new THREE.CylinderGeometry(0.065, 0.055, 0.44, 8);
  const leftArmUpper = new THREE.Mesh(upperArmGeom, jacketMat);
  leftArmUpper.position.set(-0.16, -0.08, -0.08);
  leftArmUpper.rotation.z = 0.8;
  leftArmUpper.rotation.x = -0.3;
  leftArmMesh.add(leftArmUpper);

  // Sleeve Cyan Neon Piping
  const leftSleeveLine = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.44, 0.025), neonCyanMat);
  leftSleeveLine.position.set(-0.16, -0.08, -0.11);
  leftSleeveLine.rotation.z = 0.8;
  leftSleeveLine.rotation.x = -0.3;
  leftArmMesh.add(leftSleeveLine);

  // Cuff Glow Ring
  const leftCuff = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.05, 8), neonCyanMat);
  leftCuff.position.set(-0.30, -0.14, -0.16);
  leftArmMesh.add(leftCuff);

  // Dark Tactical Glove
  const leftGlove = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), gloveMat);
  leftGlove.position.set(-0.35, -0.16, -0.20);
  leftArmMesh.add(leftGlove);
  characterMesh.add(leftArmMesh);

  // Right Arm
  const rightArmMesh = new THREE.Group();
  rightArmMesh.position.set(0.28, 0.78, 0);

  const rightArmUpper = new THREE.Mesh(upperArmGeom, jacketMat);
  rightArmUpper.position.set(0.14, -0.10, 0.12);
  rightArmUpper.rotation.z = -0.7;
  rightArmUpper.rotation.x = 0.4;
  rightArmMesh.add(rightArmUpper);

  // Sleeve Cyan Neon Piping
  const rightSleeveLine = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.44, 0.025), neonCyanMat);
  rightSleeveLine.position.set(0.14, -0.10, 0.15);
  rightSleeveLine.rotation.z = -0.7;
  rightSleeveLine.rotation.x = 0.4;
  rightArmMesh.add(rightSleeveLine);

  // Cuff Glow Ring
  const rightCuff = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.05, 8), neonCyanMat);
  rightCuff.position.set(0.28, -0.18, 0.22);
  rightArmMesh.add(rightCuff);

  // Dark Tactical Glove
  const rightGlove = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), gloveMat);
  rightGlove.position.set(0.33, -0.22, 0.26);
  rightArmMesh.add(rightGlove);
  characterMesh.add(rightArmMesh);

  // ----------------------------------------------------
  // LEGS & CARGO PANTS
  // ----------------------------------------------------
  const legGeom = new THREE.CylinderGeometry(0.085, 0.065, 0.54, 8);

  const leftLegMesh = new THREE.Mesh(legGeom, pantsMat);
  leftLegMesh.position.set(-0.16, 0.26, -0.32);
  leftLegMesh.rotation.x = -0.24;
  characterMesh.add(leftLegMesh);

  // Side Cargo Pocket Left
  const pocketGeom = new THREE.BoxGeometry(0.05, 0.14, 0.10);
  const leftPocket = new THREE.Mesh(pocketGeom, pantsMat);
  leftPocket.position.set(-0.24, 0.26, -0.32);
  characterMesh.add(leftPocket);

  const rightLegMesh = new THREE.Mesh(legGeom, pantsMat);
  rightLegMesh.position.set(0.16, 0.26, 0.32);
  rightLegMesh.rotation.x = 0.24;
  characterMesh.add(rightLegMesh);

  // Side Cargo Pocket Right
  const rightPocket = new THREE.Mesh(pocketGeom, pantsMat);
  rightPocket.position.set(0.24, 0.26, 0.32);
  characterMesh.add(rightPocket);

  // ----------------------------------------------------
  // HIGH-TOP SNEAKERS with Glowing Cyan Sole / Trim Ring
  // ----------------------------------------------------
  const shoeGeom = new THREE.BoxGeometry(0.13, 0.12, 0.32);
  const shoeSoleGeom = new THREE.BoxGeometry(0.14, 0.035, 0.33);

  // Left Sneaker
  const leftShoe = new THREE.Mesh(shoeGeom, sneakerMat);
  leftShoe.position.set(-0.18, 0.06, -0.42);
  leftShoe.rotation.y = 0.1;
  characterMesh.add(leftShoe);

  const leftSoleRing = new THREE.Mesh(shoeSoleGeom, neonCyanMat);
  leftSoleRing.position.set(-0.18, 0.015, -0.42);
  leftSoleRing.rotation.y = 0.1;
  characterMesh.add(leftSoleRing);

  // Right Sneaker
  const rightShoe = new THREE.Mesh(shoeGeom, sneakerMat);
  rightShoe.position.set(0.18, 0.06, 0.42);
  rightShoe.rotation.y = -0.1;
  characterMesh.add(rightShoe);

  const rightSoleRing = new THREE.Mesh(shoeSoleGeom, neonCyanMat);
  rightSoleRing.position.set(0.18, 0.015, 0.42);
  rightSoleRing.rotation.y = -0.1;
  characterMesh.add(rightSoleRing);

  // ----------------------------------------------------
  // HEAD, FACE MASK / HALF-HELMET & CYAN VISOR
  // ----------------------------------------------------
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.12, 0);

  // Face Base / Skin
  const headSphere = new THREE.SphereGeometry(0.30, 16, 16);
  const headMesh = new THREE.Mesh(headSphere, skinMat);
  headGroup.add(headMesh);

  // Dark Spiky Hair Cluster
  const hairGroup = new THREE.Group();
  for (let i = 0; i < 14; i++) {
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.26, 5), hairMat);
    const angle = (i / 14) * Math.PI * 2;
    spike.position.set(Math.sin(angle) * 0.22, 0.18 + Math.random() * 0.1, Math.cos(angle) * 0.22);
    spike.rotation.set(Math.random() * 0.4, angle, Math.random() * 0.4);
    hairGroup.add(spike);
  }
  headGroup.add(hairGroup);

  // Dark Face Mask / Half-Helmet
  const maskGeom = new THREE.CylinderGeometry(0.27, 0.24, 0.22, 12, 1, false, 0, Math.PI);
  maskGeom.rotateY(Math.PI / 2);
  const maskMat = new THREE.MeshStandardMaterial({
    color: 0x0c0e14,
    roughness: 0.3,
    metalness: 0.5,
  });
  const maskMesh = new THREE.Mesh(maskGeom, maskMat);
  maskMesh.position.set(0, -0.06, 0.08);
  headGroup.add(maskMesh);

  // Glowing Cyan Visor Line
  const visorGeom = new THREE.BoxGeometry(0.24, 0.035, 0.12);
  const visorMesh = new THREE.Mesh(visorGeom, neonCyanMat);
  visorMesh.position.set(0, 0.04, 0.20);
  headGroup.add(visorMesh);

  characterMesh.add(headGroup);

  // Flowing Scarf / Cape
  const capeGeom = new THREE.PlaneGeometry(0.32, 0.85, 2, 4);
  capeGeom.translate(0, -0.42, 0);
  const capeMat = new THREE.MeshStandardMaterial({
    color: 0x0a0e16,
    side: THREE.DoubleSide,
    roughness: 0.5,
  });
  const capeMesh = new THREE.Mesh(capeGeom, capeMat);
  capeMesh.position.set(0, 0.92, -0.20);
  characterMesh.add(capeMesh);

  rootGroup.add(characterMesh);

  return {
    group: rootGroup,
    characterMesh,
    torsoMesh,
    headMesh,
    visorMesh,
    capeMesh,
    leftArmMesh,
    rightArmMesh,
    leftLegMesh,
    rightLegMesh,
    boardMesh,
    boardDeckMesh,
    boardFoilMesh,
    underglowMesh,
    underglowLight,
  };
}
