import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { CosmeticsConfig, TrickType } from '../types';

/**
 * Production PBR Cyberpunk Skater Character & Hoverboard with Skeletal Rig
 * Supports GLTF / GLB custom 3D model loading with seamless fallback to PBR procedural rider
 */

export interface PlayerCharacter {
  group: THREE.Group;
  rider: THREE.Group;
  torso: THREE.Group;
  head: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  board: THREE.Group;

  // Rig Bones
  bones: {
    hips: THREE.Bone;
    spine: THREE.Bone;
    chest: THREE.Bone;
    neck: THREE.Bone;
    head: THREE.Bone;
    leftShoulder: THREE.Bone;
    leftArm: THREE.Bone;
    leftForearm: THREE.Bone;
    rightShoulder: THREE.Bone;
    rightArm: THREE.Bone;
    rightForearm: THREE.Bone;
    leftThigh: THREE.Bone;
    leftShin: THREE.Bone;
    leftFoot: THREE.Bone;
    rightThigh: THREE.Bone;
    rightShin: THREE.Bone;
    rightFoot: THREE.Bone;
  };

  // Cosmetic Mesh References
  capeMesh: THREE.Mesh;
  visorMesh: THREE.Mesh;
  underglowMesh: THREE.Mesh;
  underglowLight: THREE.PointLight;
  boardFoilMesh: THREE.Mesh;

  // Variant Collections
  boards: Record<string, THREE.Group>;
  companions: Record<string, THREE.Group>;
  helmets: Record<string, THREE.Group>;
  armors: Record<string, THREE.Group>;

  // Active References
  activeBoardId: string;
  activeCompanionId: string;
  activeHelmetId: string;
  activeArmorId: string;

  // Secondary Motion State
  capeVertices: Float32Array;
  boardTiltLag: number;

  // GLTF Custom Model Support
  gltfModel?: THREE.Object3D;
  gltfMixer?: THREE.AnimationMixer;
  gltfAnimations?: THREE.AnimationClip[];
  gltfActions?: Record<string, THREE.AnimationAction>;
  isGltfLoaded?: boolean;
  applyGltfCosmetics?: (config: CosmeticsConfig) => void;
}

export function createPlayerCharacter(): PlayerCharacter {
  const group = new THREE.Group();
  group.name = 'PlayerCharacterRoot';

  // ---------- PBR MATERIALS BASE ----------
  const skinMat = new THREE.MeshStandardMaterial({
    color: 0xffe0bd,
    roughness: 0.6,
    metalness: 0.1,
  });

  const fabricMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.7,
    metalness: 0.2,
  });

  const armorMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.3,
    metalness: 0.8,
  });

  const visorMat = new THREE.MeshPhysicalMaterial({
    color: 0x00f0ff,
    emissive: 0x00f0ff,
    emissiveIntensity: 1.5,
    roughness: 0.1,
    metalness: 0.9,
    clearcoat: 1.0,
  });

  const neonGlowMat = new THREE.MeshStandardMaterial({
    color: 0x00f0ff,
    emissive: 0x00f0ff,
    emissiveIntensity: 2.2,
    roughness: 0.2,
    metalness: 0.5,
  });

  const capeMat = new THREE.MeshStandardMaterial({
    color: 0x00f0ff,
    emissive: 0x00f0ff,
    emissiveIntensity: 0.6,
    roughness: 0.5,
    metalness: 0.2,
    side: THREE.DoubleSide,
  });

  // ---------- SKELETAL RIG CREATION ----------
  const hips = new THREE.Bone();
  hips.name = 'hips';
  hips.position.y = 0.85;

  const spine = new THREE.Bone();
  spine.position.y = 0.22;
  hips.add(spine);

  const chest = new THREE.Bone();
  chest.position.y = 0.22;
  spine.add(chest);

  const neck = new THREE.Bone();
  neck.position.y = 0.28;
  chest.add(neck);

  const headBone = new THREE.Bone();
  headBone.position.y = 0.14;
  neck.add(headBone);

  // Arms
  const leftShoulder = new THREE.Bone();
  leftShoulder.position.set(-0.18, 0.22, 0);
  chest.add(leftShoulder);

  const leftArm = new THREE.Bone();
  leftArm.position.set(-0.08, 0, 0);
  leftShoulder.add(leftArm);

  const leftForearm = new THREE.Bone();
  leftForearm.position.set(-0.22, 0, 0);
  leftArm.add(leftForearm);

  const rightShoulder = new THREE.Bone();
  rightShoulder.position.set(0.18, 0.22, 0);
  chest.add(rightShoulder);

  const rightArm = new THREE.Bone();
  rightArm.position.set(0.08, 0, 0);
  rightShoulder.add(rightArm);

  const rightForearm = new THREE.Bone();
  rightForearm.position.set(0.22, 0, 0);
  rightArm.add(rightForearm);

  // Legs
  const leftThigh = new THREE.Bone();
  leftThigh.position.set(-0.12, -0.05, 0);
  hips.add(leftThigh);

  const leftShin = new THREE.Bone();
  leftShin.position.set(0, -0.32, 0);
  leftThigh.add(leftShin);

  const leftFoot = new THREE.Bone();
  leftFoot.position.set(0, -0.32, 0.06);
  leftShin.add(leftFoot);

  const rightThigh = new THREE.Bone();
  rightThigh.position.set(0.12, -0.05, 0);
  hips.add(rightThigh);

  const rightShin = new THREE.Bone();
  rightShin.position.set(0, -0.32, 0);
  rightThigh.add(rightShin);

  const rightFoot = new THREE.Bone();
  rightFoot.position.set(0, -0.32, 0.06);
  rightShin.add(rightFoot);

  const bones = {
    hips,
    spine,
    chest,
    neck,
    head: headBone,
    leftShoulder,
    leftArm,
    leftForearm,
    rightShoulder,
    rightArm,
    rightForearm,
    leftThigh,
    leftShin,
    leftFoot,
    rightThigh,
    rightShin,
    rightFoot,
  };

  const rider = new THREE.Group();
  rider.name = 'Rider';
  rider.add(hips);

  // Attach Visual Sub-groups to Bones
  const torso = new THREE.Group();
  chest.add(torso);

  const headGroup = new THREE.Group();
  headBone.add(headGroup);

  const leftArmGroup = new THREE.Group();
  leftArm.add(leftArmGroup);

  const rightArmGroup = new THREE.Group();
  rightArm.add(rightArmGroup);

  const leftLegGroup = new THREE.Group();
  leftThigh.add(leftLegGroup);

  const rightLegGroup = new THREE.Group();
  rightThigh.add(rightLegGroup);

  // ---------- MESH PARTS & STYLES ----------

  // Head & Visor base
  const skullGeo = new THREE.SphereGeometry(0.15, 16, 16);
  const skullMesh = new THREE.Mesh(skullGeo, skinMat);
  skullMesh.castShadow = true;
  headGroup.add(skullMesh);

  const visorGeo = new THREE.SphereGeometry(0.11, 14, 14, 0, Math.PI * 2, Math.PI * 0.4, Math.PI * 0.4);
  const visorMesh = new THREE.Mesh(visorGeo, visorMat);
  visorMesh.position.set(0, -0.02, 0.06);
  visorMesh.castShadow = true;
  headGroup.add(visorMesh);

  // Character Style Helmets / Hair
  const helmets: Record<string, THREE.Group> = {};

  // 1. cyber-runner (Sleek Visor Helmet with Cyber Ears)
  const runnerHelmet = new THREE.Group();
  const hairMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.155, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.55),
    armorMat
  );
  runnerHelmet.add(hairMesh);
  const earL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.08, 0.08), neonGlowMat);
  earL.position.set(0.16, 0, 0);
  runnerHelmet.add(earL);
  const earR = earL.clone();
  earR.position.x = -0.16;
  runnerHelmet.add(earR);
  headGroup.add(runnerHelmet);
  helmets['cyber-runner'] = runnerHelmet;

  // 2. net-stalker (Hooded Mask)
  const stalkerHelmet = new THREE.Group();
  const hood = new THREE.Mesh(new THREE.SphereGeometry(0.175, 16, 16), fabricMat);
  stalkerHelmet.add(hood);
  stalkerHelmet.visible = false;
  headGroup.add(stalkerHelmet);
  helmets['net-stalker'] = stalkerHelmet;

  // 3. void-drifter (Heavy Void Helmet with Horn Crest)
  const drifterHelmet = new THREE.Group();
  const vHelm = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 16), armorMat);
  drifterHelmet.add(vHelm);
  const crest = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.22, 4), neonGlowMat);
  crest.rotation.x = -Math.PI / 4;
  crest.position.set(0, 0.16, -0.05);
  drifterHelmet.add(crest);
  drifterHelmet.visible = false;
  headGroup.add(drifterHelmet);
  helmets['void-drifter'] = drifterHelmet;

  // 4. grid-phantom (Geometric Tron Helmet)
  const phantomHelmet = new THREE.Group();
  const gHelm = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), armorMat);
  phantomHelmet.add(gHelm);
  phantomHelmet.visible = false;
  headGroup.add(phantomHelmet);
  helmets['grid-phantom'] = phantomHelmet;

  // Torso Body Mesh
  const torsoGeo = new THREE.CapsuleGeometry(0.18, 0.38, 8, 16);
  const torsoMesh = new THREE.Mesh(torsoGeo, fabricMat);
  torsoMesh.castShadow = true;
  torsoMesh.receiveShadow = true;
  torso.add(torsoMesh);

  // Armor Variant Accessories
  const armors: Record<string, THREE.Group> = {};

  // 1. carbon-fiber
  const carbonGroup = new THREE.Group();
  const plateFront = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.28, 0.08), armorMat);
  plateFront.position.set(0, 0, 0.14);
  carbonGroup.add(plateFront);
  torso.add(carbonGroup);
  armors['carbon-fiber'] = carbonGroup;

  // 2. titanium-white
  const titaniumGroup = new THREE.Group();
  const tMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, metalness: 0.9, roughness: 0.15 });
  const tPlate = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.32, 0.1), tMat);
  tPlate.position.set(0, 0, 0.13);
  titaniumGroup.add(tPlate);
  titaniumGroup.visible = false;
  torso.add(titaniumGroup);
  armors['titanium-white'] = titaniumGroup;

  // 3. onyx-stealth
  const onyxGroup = new THREE.Group();
  const oMat = new THREE.MeshStandardMaterial({ color: 0x020617, metalness: 0.95, roughness: 0.1 });
  const oPlate = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.3, 0.1), oMat);
  onyxGroup.add(oPlate);
  onyxGroup.visible = false;
  torso.add(onyxGroup);
  armors['onyx-stealth'] = onyxGroup;

  // 4. crimson-cyborg
  const crimsonGroup = new THREE.Group();
  const cMat = new THREE.MeshStandardMaterial({ color: 0x991b1b, metalness: 0.85, roughness: 0.25 });
  const cPlate = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.34, 0.11), cMat);
  crimsonGroup.add(cPlate);
  crimsonGroup.visible = false;
  torso.add(crimsonGroup);
  armors['crimson-cyborg'] = crimsonGroup;

  // Dynamic Cape (Procedural Cloth mesh with vertex simulation)
  const capeGeo = new THREE.PlaneGeometry(0.44, 0.95, 6, 12);
  capeGeo.translate(0, -0.475, 0); // Origin at top attachment
  const capeMesh = new THREE.Mesh(capeGeo, capeMat);
  capeMesh.position.set(0, 0.18, -0.16);
  capeMesh.castShadow = true;
  chest.add(capeMesh);

  const capeVertices = new Float32Array(capeGeo.attributes.position.array.length);
  capeVertices.set(capeGeo.attributes.position.array);

  // Arm & Leg Meshes attached to bone hierarchy
  function createLimbMesh(radius: number, length: number, mat: THREE.Material): THREE.Mesh {
    const geo = new THREE.CapsuleGeometry(radius, length, 6, 12);
    geo.translate(0, -length / 2, 0);
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true;
    return m;
  }

  leftArm.add(createLimbMesh(0.065, 0.22, fabricMat));
  leftForearm.add(createLimbMesh(0.055, 0.2, armorMat));
  rightArm.add(createLimbMesh(0.065, 0.22, fabricMat));
  rightForearm.add(createLimbMesh(0.055, 0.2, armorMat));

  leftThigh.add(createLimbMesh(0.085, 0.28, fabricMat));
  leftShin.add(createLimbMesh(0.07, 0.26, armorMat));
  rightThigh.add(createLimbMesh(0.085, 0.28, fabricMat));
  rightShin.add(createLimbMesh(0.07, 0.26, armorMat));

  // Shoes with Glowing Soles
  const shoeGeo = new THREE.BoxGeometry(0.14, 0.09, 0.26);
  const leftShoe = new THREE.Mesh(shoeGeo, armorMat);
  leftShoe.position.set(0, -0.04, 0.06);
  leftFoot.add(leftShoe);

  const soleGeo = new THREE.BoxGeometry(0.15, 0.025, 0.27);
  const leftSole = new THREE.Mesh(soleGeo, neonGlowMat);
  leftSole.position.set(0, -0.08, 0.06);
  leftFoot.add(leftSole);

  const rightShoe = leftShoe.clone();
  const rightSole = leftSole.clone();
  rightFoot.add(rightShoe);
  rightFoot.add(rightSole);

  // Orient Rider on Board
  rider.rotation.y = -Math.PI / 2;
  group.add(rider);

  // ---------- HOVERBOARD VARIANTS ----------
  const board = new THREE.Group();
  board.name = 'BoardGroup';

  const boards: Record<string, THREE.Group> = {};

  const whiteBoardMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.2,
    metalness: 0.6,
  });

  const boardFoilMesh = new THREE.Mesh(
    new THREE.TorusGeometry(0.18, 0.035, 8, 20),
    neonGlowMat
  );

  const underglowMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.6, 1.6),
    new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    })
  );
  underglowMesh.rotation.x = Math.PI / 2;
  underglowMesh.position.y = -0.06;
  board.add(underglowMesh);

  const underglowLight = new THREE.PointLight(0x00f0ff, 3.5, 6.0);
  underglowLight.position.set(0, -0.2, 0);
  board.add(underglowLight);

  // 1. cyber-phantom
  const phantomBoard = new THREE.Group();
  const deck1 = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.07, 1.7), whiteBoardMat);
  deck1.castShadow = true;
  deck1.receiveShadow = true;
  phantomBoard.add(deck1);
  phantomBoard.add(boardFoilMesh.clone());
  board.add(phantomBoard);
  boards['cyber-phantom'] = phantomBoard;

  // 2. laser-edge
  const edgeBoard = new THREE.Group();
  const deck2 = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.06, 1.8), whiteBoardMat);
  const finL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.18, 0.4), neonGlowMat);
  finL.position.set(0.32, 0.06, -0.7);
  const finR = finL.clone();
  finR.position.x = -0.32;
  edgeBoard.add(deck2, finL, finR);
  edgeBoard.visible = false;
  board.add(edgeBoard);
  boards['laser-edge'] = edgeBoard;

  // 3. grid-runner
  const gridBoard = new THREE.Group();
  const deck3 = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.08, 1.65), whiteBoardMat);
  gridBoard.add(deck3);
  gridBoard.visible = false;
  board.add(gridBoard);
  boards['grid-runner'] = gridBoard;

  // 4. tokyo-neon
  const tokyoBoard = new THREE.Group();
  const deck4 = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.07, 1.75), whiteBoardMat);
  tokyoBoard.add(deck4);
  tokyoBoard.visible = false;
  board.add(tokyoBoard);
  boards['tokyo-neon'] = tokyoBoard;

  // 5. void-stalker
  const voidBoard = new THREE.Group();
  const deck5 = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.07, 1.85), whiteBoardMat);
  voidBoard.add(deck5);
  voidBoard.visible = false;
  board.add(voidBoard);
  boards['void-stalker'] = voidBoard;

  board.position.y = 0.15;
  group.add(board);

  // ---------- COMPANION DRONE VARIANTS ----------
  const companions: Record<string, THREE.Group> = {};

  const companionContainer = new THREE.Group();
  companionContainer.position.set(1.25, 1.75, -0.5);

  // 1. recon-orb
  const reconGroup = new THREE.Group();
  const orbBody = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 16), armorMat);
  const orbEye = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.06, 12), visorMat);
  orbEye.rotateX(Math.PI / 2);
  orbEye.position.z = 0.16;
  const orbRing = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.02, 8, 20), neonGlowMat);
  reconGroup.add(orbBody, orbEye, orbRing);
  companionContainer.add(reconGroup);
  companions['recon-orb'] = reconGroup;

  // 2. stealth-hex
  const hexGroup = new THREE.Group();
  const hexBody = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.45, 6), armorMat);
  hexBody.rotateX(Math.PI / 2);
  hexGroup.add(hexBody);
  hexGroup.visible = false;
  companionContainer.add(hexGroup);
  companions['stealth-hex'] = hexGroup;

  // 3. neon-wasp
  const waspGroup = new THREE.Group();
  const waspBody = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.3, 8, 12), armorMat);
  waspBody.rotateX(Math.PI / 2);
  const wingL = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.02, 6, 16), neonGlowMat);
  wingL.position.set(0.22, 0, 0);
  const wingR = wingL.clone();
  wingR.position.x = -0.22;
  waspGroup.add(waspBody, wingL, wingR);
  waspGroup.visible = false;
  companionContainer.add(waspGroup);
  companions['neon-wasp'] = waspGroup;

  group.add(companionContainer);

  const playerChar: PlayerCharacter = {
    group,
    rider,
    torso,
    head: headGroup,
    leftArm: leftArmGroup,
    rightArm: rightArmGroup,
    leftLeg: leftLegGroup,
    rightLeg: rightLegGroup,
    board,

    bones,

    capeMesh,
    visorMesh,
    underglowMesh,
    underglowLight,
    boardFoilMesh,

    boards,
    companions,
    helmets,
    armors,

    activeBoardId: 'cyber-phantom',
    activeCompanionId: 'recon-orb',
    activeHelmetId: 'cyber-runner',
    activeArmorId: 'carbon-fiber',

    capeVertices,
    boardTiltLag: 0,
    isGltfLoaded: false,
  };

  // Attempt async loading of custom GLB model (/assets/character/rider.glb)
  const gltfLoader = new GLTFLoader();
  gltfLoader.load(
    '/assets/character/rider.glb',
    (gltf) => {
      console.log('[GLTFLoader] Loaded rider.glb successfully:', gltf);
      console.log('[GLTFLoader] Model Nodes & Scene Hierarchy:', gltf.scene);
      console.log(
        '[GLTFLoader] Animation Clips found:',
        gltf.animations ? gltf.animations.map((a) => a.name) : []
      );

      const gltfModel = gltf.scene;
      gltfModel.name = 'GLTF_RiderModel';

      // Ensure shadow casting and receiving on GLTF meshes
      gltfModel.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      // Hook up AnimationMixer if clips exist
      let gltfMixer: THREE.AnimationMixer | undefined;
      const gltfActions: Record<string, THREE.AnimationAction> = {};
      if (gltf.animations && gltf.animations.length > 0) {
        gltfMixer = new THREE.AnimationMixer(gltfModel);
        gltf.animations.forEach((clip) => {
          const action = gltfMixer!.clipAction(clip);
          gltfActions[clip.name.toLowerCase()] = action;
          gltfActions[clip.name] = action;
        });
        const firstClip = gltf.animations[0];
        if (firstClip) {
          gltfActions[firstClip.name]?.play();
        }
      }

      // Hide procedural rider and replace with GLB model
      rider.visible = false;
      gltfModel.position.set(0, 0.15, 0);
      group.add(gltfModel);

      playerChar.gltfModel = gltfModel;
      playerChar.gltfMixer = gltfMixer;
      playerChar.gltfAnimations = gltf.animations;
      playerChar.gltfActions = gltfActions;
      playerChar.isGltfLoaded = true;

      // Define cosmetics tinting for GLTF materials
      playerChar.applyGltfCosmetics = (config: CosmeticsConfig) => {
        if (!playerChar.gltfModel) return;
        const glowColor = config.visorColor || '#00F0FF';
        playerChar.gltfModel.traverse((child) => {
          if (child instanceof THREE.Mesh && child.material) {
            const mat = child.material;
            const matName = (mat.name || child.name).toLowerCase();
            if (matName.includes('visor') || matName.includes('glow') || matName.includes('cyan')) {
              if ('color' in mat) (mat as THREE.MeshStandardMaterial).color.set(glowColor);
              if ('emissive' in mat) (mat as THREE.MeshStandardMaterial).emissive.set(glowColor);
            }
          }
        });
      };
    },
    undefined,
    (error) => {
      console.log(
        '[GLTFLoader] /assets/character/rider.glb absent or failed to load. Falling back seamlessly to procedural PBR character.',
        error
      );
    }
  );

  return playerChar;
}

/**
 * Procedural Skeletal Animation & Secondary Motion Engine
 */
export function animatePlayerCharacter(
  player: PlayerCharacter,
  time: number,
  speedFactor: number = 1,
  state: {
    isGrounded: boolean;
    isSliding: boolean;
    isGrinding: boolean;
    isBoosting: boolean;
    stumbleTimer?: number;
    activeTrickName?: string | null;
    activeTrick?: TrickType | null;
    turnVelocity?: number;
    nearestObstacleDist?: number;
  } = { isGrounded: true, isSliding: false, isGrinding: false, isBoosting: false }
) {
  const dt = 0.016;

  // Update GLTF AnimationMixer if custom model loaded
  if (player.isGltfLoaded && player.gltfMixer) {
    player.gltfMixer.update(dt * speedFactor);
  }

  const b = player.bones;

  // Reset default bone rotations
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

  // 1. BASE STANCE / IDLE BREATHING BOB (Dynamic Forward-Leaning Anime Surfer Pose)
  const bob = Math.sin(time * 6 * speedFactor) * 0.02 * speedFactor;
  b.hips.position.y = 0.72 + bob;
  b.spine.rotation.x = 0.32; // Aggressive forward aerodynamic surfing lean
  player.board.position.y = 0.15 + Math.sin(time * 4) * 0.015;

  // Surfer Knee Flexion & Low Center of Gravity
  b.leftThigh.rotation.x = -0.45;
  b.leftShin.rotation.x = 0.55;
  b.rightThigh.rotation.x = -0.3;
  b.rightShin.rotation.x = 0.4;

  // Dynamic Surfer Arm Balance (Left Arm trailing back, Right Arm forward counter-weight)
  const armSwing = Math.sin(time * 7 * speedFactor) * 0.1 * speedFactor;
  b.leftArm.rotation.set(-0.35 + armSwing, 0.3, 0.6);
  b.rightArm.rotation.set(0.3 - armSwing, -0.2, -0.7);

  // 2. MOVEMENT STATES
  if (state.isSliding) {
    // Low Crouch / Duck Pose
    b.hips.position.y = 0.45;
    b.spine.rotation.x = 0.75;
    b.leftThigh.rotation.x = -0.9;
    b.leftShin.rotation.x = 1.2;
    b.rightThigh.rotation.x = -0.9;
    b.rightShin.rotation.x = 1.2;
    b.leftArm.rotation.x = -0.6;
    b.rightArm.rotation.x = -0.6;
  } else if (state.isGrinding) {
    // Grind Balance Stance (Arms Outward)
    b.leftArm.rotation.z = 1.2;
    b.rightArm.rotation.z = -1.2;
    b.spine.rotation.z = Math.sin(time * 12) * 0.08;
  } else if (!state.isGrounded) {
    // Jump Rise / Fall
    b.hips.position.y = 0.95;
    b.leftThigh.rotation.x = -0.6;
    b.leftShin.rotation.x = 0.8;
    b.rightThigh.rotation.x = -0.6;
    b.rightShin.rotation.x = 0.8;
    b.leftArm.rotation.z = 0.8;
    b.rightArm.rotation.z = -0.8;
  }

  // 3. TRICK ANIMATIONS
  if (state.activeTrick === 'spin' || state.activeTrickName?.includes('Corkscrew')) {
    b.spine.rotation.y = time * 24;
  } else if (state.activeTrick === 'flip' || state.activeTrickName?.includes('Backflip')) {
    b.hips.rotation.x = time * 20;
  } else if (state.activeTrick === 'grab' || state.activeTrickName?.includes('Grab')) {
    b.leftArm.rotation.x = 1.4;
    b.spine.rotation.x = 0.45;
  } else if (state.activeTrick === 'pose' || state.activeTrickName?.includes('Glide')) {
    b.leftArm.rotation.z = 1.57;
    b.rightArm.rotation.z = -1.57;
    b.chest.rotation.x = -0.3;
  }

  // 4. STUMBLE / RECOIL
  if (state.stumbleTimer && state.stumbleTimer > 0) {
    const recoil = Math.sin(state.stumbleTimer * 25) * 0.3;
    b.spine.rotation.x = -recoil;
    b.leftArm.rotation.x = recoil * 2;
    b.rightArm.rotation.x = recoil * 2;
  }

  // 5. SECONDARY MOTION PASS

  // Head-Look toward upcoming obstacle when close (< 35m)
  if (state.nearestObstacleDist && state.nearestObstacleDist < 35) {
    const lookIntensity = (1.0 - state.nearestObstacleDist / 35) * 0.35;
    b.head.rotation.y = Math.sin(time * 8) * lookIntensity;
    b.neck.rotation.x = 0.15 * lookIntensity;
  }

  // Cape Cloth Sway Physics Simulation
  if (player.capeMesh && player.capeMesh.geometry) {
    const posAttr = player.capeMesh.geometry.attributes.position as THREE.BufferAttribute;
    const array = posAttr.array as Float32Array;
    const count = array.length / 3;

    const forwardWind = (speedFactor * 0.18 + (state.isBoosting ? 0.35 : 0));
    const turnSway = (state.turnVelocity || 0) * 0.25;

    for (let i = 0; i < count; i++) {
      const yFrac = i / count; // 0 at top neck attachment, 1 at bottom edge
      if (yFrac < 0.1) continue; // Keep top pinned securely to collar

      const wave = Math.sin(time * 12 + yFrac * 6) * 0.04 * yFrac;
      array[i * 3] = player.capeVertices[i * 3] + turnSway * yFrac; // X sway
      array[i * 3 + 2] = player.capeVertices[i * 3 + 2] - (forwardWind * yFrac + wave); // Z billow backward
    }
    posAttr.needsUpdate = true;
  }

  // Board Tilt Lag behind turn velocity
  if (state.turnVelocity !== undefined) {
    player.boardTiltLag = THREE.MathUtils.lerp(player.boardTiltLag, state.turnVelocity * 0.15, 12 * dt);
    player.board.rotation.z = player.boardTiltLag;
  }
}
