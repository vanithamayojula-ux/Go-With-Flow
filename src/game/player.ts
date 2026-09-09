import * as THREE from 'three';
import { getTerrainHeight, getTerrainNormal, getBiomeAt, getBiomeFriction, TerrainManager } from './terrain';
import { BoardTrailShader } from '../graphics/shaders';
import { createDustParticleTexture, createWindPetalTexture } from '../graphics/textures';
import { BiomeType, CosmeticsConfig, PlayerStats, TrickType } from '../types';
import { AudioManager } from './audio';

export class PlayerManager {
  scene: THREE.Scene;
  group: THREE.Group;
  boardMesh: THREE.Group;
  boardDeckMesh!: THREE.Mesh;
  boardFoilMesh!: THREE.Mesh;
  characterMesh: THREE.Group;
  torsoMesh!: THREE.Mesh;
  capeMesh: THREE.Mesh;

  // Trail Ribbon
  trailMesh: THREE.Mesh;
  trailGeometry: THREE.BufferGeometry;
  trailMaterial: THREE.ShaderMaterial;
  trailPositions: Float32Array;
  trailUvs: Float32Array;
  trailProgress: Float32Array;
  trailHistory: { left: THREE.Vector3; right: THREE.Vector3 }[] = [];
  maxTrailPoints = 36;

  // Dust & Petal Particle Pool
  dustParticles: { mesh: THREE.Sprite; active: boolean; life: number; maxLife: number; vel: THREE.Vector3 }[] = [];
  dustTexture: THREE.CanvasTexture;
  petalParticles: { mesh: THREE.Sprite; active: boolean; life: number; vel: THREE.Vector3 }[] = [];
  petalTexture: THREE.CanvasTexture;

  // Physics State
  position = new THREE.Vector3(0, 5, 0);
  velocity = new THREE.Vector3(0, 0, 18);
  normal = new THREE.Vector3(0, 1, 0);
  targetNormal = new THREE.Vector3(0, 1, 0);
  carveAngle = 0;
  pitchAngle = 0;
  isGrounded = true;
  hoverHeight = 1.15;
  jumpVelocity = 0;
  spinAngle = 0;
  flipAngle = 0;
  grabPoseWeight = 0;
  zenPoseWeight = 0;

  // Upright Vertical Camera Mode
  isUpright = true;

  // Character Mesh References
  hatMesh!: THREE.Mesh;
  hoodMesh!: THREE.Mesh;
  acornCapMesh!: THREE.Group;
  leftArmMesh!: THREE.Group;
  rightArmMesh!: THREE.Group;

  // Whisperwood Soot Sprite Companion
  sootSpriteMesh!: THREE.Group;
  sootSpriteTime = Math.random() * Math.PI * 2;

  // Mid-Air Trick & Slow-Motion Window
  activeTrick: TrickType | null = null;
  trickTimer = 0;
  slowMoTimer = 0;

  // Camera State
  cameraPos = new THREE.Vector3();
  cameraLookAt = new THREE.Vector3();
  cameraTilt = 0;

  // Cosmetics
  currentCosmetics: CosmeticsConfig = {
    boardId: 'ivory-drift',
    trailId: 'verdant-breeze',
    capeColor: '#3bb396',
    poseId: 'standard',
  };

  // Stats
  stats: PlayerStats = {
    speed: 18,
    maxSpeed: 42,
    distance: 0,
    score: 0,
    styleMeter: 15,
    styleTier: 'Chill',
    airTime: 0,
    isGrounded: true,
    combo: 0,
    windOrbsCollected: 0,
    currentBiome: 'meadow',
    currentFriction: 0.08,
    activeTrickName: null,
    slowMoActive: false,
    isOnFloatingIsland: false,
  };

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.scene.add(this.group);

    const h = getTerrainHeight(0, 0);
    this.position.set(0, h + this.hoverHeight, 0);
    this.group.position.copy(this.position);

    // 1. Build Stylized Hover Surfboard
    this.boardMesh = new THREE.Group();
    const boardGeom = new THREE.CylinderGeometry(0.38, 0.46, 2.8, 12);
    boardGeom.rotateZ(Math.PI / 2);
    boardGeom.scale(1.0, 0.12, 1.0);
    const boardMat = new THREE.MeshStandardMaterial({
      color: 0xfaeed7, // Warm ivory
      roughness: 0.25,
      metalness: 0.1,
    });
    const boardDeck = new THREE.Mesh(boardGeom, boardMat);
    this.boardDeckMesh = boardDeck;
    this.boardMesh.add(boardDeck);

    const foilGeom = new THREE.BoxGeometry(0.1, 0.25, 2.2);
    foilGeom.translate(0, -0.12, 0);
    const foilMat = new THREE.MeshBasicMaterial({ color: 0x6de4a2 });
    const foil = new THREE.Mesh(foilGeom, foilMat);
    this.boardFoilMesh = foil;
    this.boardMesh.add(foil);

    const noseGeom = new THREE.ConeGeometry(0.35, 0.7, 8);
    noseGeom.rotateX(Math.PI / 2);
    noseGeom.scale(1.0, 0.14, 1.0);
    const nose = new THREE.Mesh(noseGeom, boardMat);
    nose.position.set(0, 0, 1.6);
    this.boardMesh.add(nose);

    this.group.add(this.boardMesh);

    // 2. Build Stylized Ghibli Surfer Voyager Character
    this.characterMesh = new THREE.Group();

    // Body / tunic (Warm terracotta / deep rust #C85A32)
    const torsoGeom = new THREE.CapsuleGeometry(0.32, 0.55, 4, 8);
    const torsoMat = new THREE.MeshLambertMaterial({ color: 0xc85a32 });
    this.torsoMesh = new THREE.Mesh(torsoGeom, torsoMat);
    this.torsoMesh.position.set(0, 0.85, 0);
    this.torsoMesh.castShadow = true;
    this.characterMesh.add(this.torsoMesh);

    // Dynamic Articulated Surfer Arms
    const armMat = new THREE.MeshLambertMaterial({ color: 0xc85a32 });
    const skinMat = new THREE.MeshLambertMaterial({ color: 0xfde3ce });
    const bracerMat = new THREE.MeshBasicMaterial({ color: 0x8ef0ff });

    // Left Arm
    this.leftArmMesh = new THREE.Group();
    this.leftArmMesh.position.set(-0.32, 1.05, -0.05);

    const leftUpper = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.45, 6), armMat);
    leftUpper.position.set(-0.15, -0.15, -0.15);
    leftUpper.rotation.set(-0.6, 0, 0.4);
    this.leftArmMesh.add(leftUpper);

    const leftForearm = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.4, 6), skinMat);
    leftForearm.position.set(-0.28, -0.28, -0.32);
    leftForearm.rotation.set(-0.7, 0, 0.25);
    this.leftArmMesh.add(leftForearm);

    const leftBracer = new THREE.Mesh(new THREE.CylinderGeometry(0.082, 0.082, 0.09, 6), bracerMat);
    leftBracer.position.set(-0.31, -0.33, -0.38);
    this.leftArmMesh.add(leftBracer);

    this.characterMesh.add(this.leftArmMesh);

    // Right Arm
    this.rightArmMesh = new THREE.Group();
    this.rightArmMesh.position.set(0.32, 1.05, 0.05);

    const rightUpper = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.45, 6), armMat);
    rightUpper.position.set(0.15, -0.15, 0.15);
    rightUpper.rotation.set(0.6, 0, -0.4);
    this.rightArmMesh.add(rightUpper);

    const rightForearm = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.4, 6), skinMat);
    rightForearm.position.set(0.28, -0.28, 0.32);
    rightForearm.rotation.set(0.5, 0, -0.25);
    this.rightArmMesh.add(rightForearm);

    const rightBracer = new THREE.Mesh(new THREE.CylinderGeometry(0.082, 0.082, 0.09, 6), bracerMat);
    rightBracer.position.set(0.31, -0.33, 0.38);
    this.rightArmMesh.add(rightBracer);

    this.characterMesh.add(this.rightArmMesh);

    // Legs
    const legMat = new THREE.MeshLambertMaterial({ color: 0x3f4e5a });
    const leftLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.09, 0.65, 6), legMat);
    leftLeg.position.set(-0.2, 0.35, -0.2);
    leftLeg.rotation.set(-0.2, 0, 0.15);
    this.characterMesh.add(leftLeg);

    const rightLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.09, 0.65, 6), legMat);
    rightLeg.position.set(0.18, 0.35, 0.25);
    rightLeg.rotation.set(0.25, 0, -0.15);
    this.characterMesh.add(rightLeg);

    // Head
    const headGeom = new THREE.SphereGeometry(0.24, 8, 8);
    const headMat = new THREE.MeshLambertMaterial({ color: 0xfde3ce });
    const head = new THREE.Mesh(headGeom, headMat);
    head.position.set(0, 1.35, 0.05);
    this.characterMesh.add(head);

    // Wide brim straw hat
    const hatGeom = new THREE.ConeGeometry(0.65, 0.22, 12);
    const hatMat = new THREE.MeshLambertMaterial({ color: 0xdfb76c });
    this.hatMesh = new THREE.Mesh(hatGeom, hatMat);
    this.hatMesh.position.set(0, 1.5, 0.05);
    this.characterMesh.add(this.hatMesh);

    // Desert Nomad Cowl / Hood
    const hoodGeom = new THREE.SphereGeometry(0.32, 8, 8);
    const hoodMat = new THREE.MeshLambertMaterial({ color: 0xd8c2a4 });
    this.hoodMesh = new THREE.Mesh(hoodGeom, hoodMat);
    this.hoodMesh.position.set(0, 1.38, 0.02);
    this.hoodMesh.visible = false;
    this.characterMesh.add(this.hoodMesh);

    // Acorn-leaf cap
    this.acornCapMesh = new THREE.Group();
    const acornDomeMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2f });
    const acornLeafMat = new THREE.MeshLambertMaterial({ color: 0x4d8a4f });
    const acornDome = new THREE.Mesh(new THREE.SphereGeometry(0.34, 8, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), acornDomeMat);
    acornDome.rotation.x = Math.PI;
    this.acornCapMesh.add(acornDome);
    const acornStem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.16, 5), acornDomeMat);
    acornStem.position.y = 0.18;
    this.acornCapMesh.add(acornStem);
    const acornLeaf = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.28, 4), acornLeafMat);
    acornLeaf.position.set(0.1, 0.2, 0);
    acornLeaf.rotation.z = 0.9;
    this.acornCapMesh.add(acornLeaf);
    this.acornCapMesh.position.set(0, 1.5, 0.05);
    this.acornCapMesh.visible = false;
    this.characterMesh.add(this.acornCapMesh);

    // Wind-swept flowing cape / scarf
    const capeGeom = new THREE.PlaneGeometry(0.6, 1.3, 3, 5);
    capeGeom.translate(0, -0.65, 0);
    const capeMat = new THREE.MeshLambertMaterial({
      color: 0x3bb396,
      side: THREE.DoubleSide,
    });
    this.capeMesh = new THREE.Mesh(capeGeom, capeMat);
    this.capeMesh.position.set(0, 1.15, -0.25);
    this.characterMesh.add(this.capeMesh);

    this.group.add(this.characterMesh);

    // Whisperwood Soot Sprite Companion — a tiny round black spirit that tags along
    this.sootSpriteMesh = new THREE.Group();
    const sootBodyMat = new THREE.MeshLambertMaterial({ color: 0x1c1c1c });
    const sootEyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const sootBody = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 1), sootBodyMat);
    this.sootSpriteMesh.add(sootBody);
    const eyeGeom = new THREE.SphereGeometry(0.045, 6, 6);
    const leftEye = new THREE.Mesh(eyeGeom, sootEyeMat);
    leftEye.position.set(-0.08, 0.03, 0.19);
    this.sootSpriteMesh.add(leftEye);
    const rightEye = new THREE.Mesh(eyeGeom, sootEyeMat);
    rightEye.position.set(0.08, 0.03, 0.19);
    this.sootSpriteMesh.add(rightEye);
    this.sootSpriteMesh.visible = true; // Enabled by default as companion
    this.group.add(this.sootSpriteMesh);

    // 3. GPU Board Ribbon Trail
    const totalVerts = this.maxTrailPoints * 2;
    this.trailPositions = new Float32Array(totalVerts * 3);
    this.trailUvs = new Float32Array(totalVerts * 2);
    this.trailProgress = new Float32Array(totalVerts);

    this.trailGeometry = new THREE.BufferGeometry();
    this.trailGeometry.setAttribute('position', new THREE.BufferAttribute(this.trailPositions, 3));
    this.trailGeometry.setAttribute('uv', new THREE.BufferAttribute(this.trailUvs, 2));
    this.trailGeometry.setAttribute('aProgress', new THREE.BufferAttribute(this.trailProgress, 1));

    const indices: number[] = [];
    for (let i = 0; i < this.maxTrailPoints - 1; i++) {
      const a = i * 2;
      const b = i * 2 + 1;
      const c = (i + 1) * 2;
      const d = (i + 1) * 2 + 1;
      indices.push(a, b, c, c, b, d);
    }
    this.trailGeometry.setIndex(indices);

    this.trailMaterial = new THREE.ShaderMaterial({
      vertexShader: BoardTrailShader.vertexShader,
      fragmentShader: BoardTrailShader.fragmentShader,
      uniforms: {
        uColorA: { value: new THREE.Color('#4DE2C0') },
        uColorB: { value: new THREE.Color('#F7D6A5') },
        uOpacity: { value: 0.85 },
      },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    this.trailMesh = new THREE.Mesh(this.trailGeometry, this.trailMaterial);
    this.trailMesh.frustumCulled = false;
    this.scene.add(this.trailMesh);

    // 4. Pooled Dust & Petal Particles
    this.dustTexture = createDustParticleTexture();
    const dustMat = new THREE.SpriteMaterial({
      map: this.dustTexture,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
    });
    for (let i = 0; i < 20; i++) {
      const sp = new THREE.Sprite(dustMat);
      sp.visible = false;
      this.scene.add(sp);
      this.dustParticles.push({
        mesh: sp,
        active: false,
        life: 0,
        maxLife: 0.5,
        vel: new THREE.Vector3(),
      });
    }

    this.petalTexture = createWindPetalTexture();
    const petalMat = new THREE.SpriteMaterial({
      map: this.petalTexture,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });
    for (let i = 0; i < 15; i++) {
      const sp = new THREE.Sprite(petalMat);
      sp.scale.set(0.6, 0.6, 1);
      sp.visible = false;
      this.scene.add(sp);
      this.petalParticles.push({
        mesh: sp,
        active: false,
        life: 0,
        vel: new THREE.Vector3(),
      });
    }
  }

  emitJumpDust(pos: THREE.Vector3, count = 4) {
    let spawned = 0;
    for (let i = 0; i < this.dustParticles.length && spawned < count; i++) {
      const p = this.dustParticles[i];
      if (!p.active) {
        p.active = true;
        p.life = 0;
        p.maxLife = 0.4 + Math.random() * 0.25;
        p.mesh.position.copy(pos);
        p.mesh.scale.set(1.2, 1.2, 1);
        p.mesh.visible = true;
        p.vel.set(
          (Math.random() - 0.5) * 4,
          1.5 + Math.random() * 2.5,
          (Math.random() - 0.5) * 4
        );
        spawned++;
      }
    }
  }

  emitWindPetals(pos: THREE.Vector3, count = 3) {
    let spawned = 0;
    for (let i = 0; i < this.petalParticles.length && spawned < count; i++) {
      const p = this.petalParticles[i];
      if (!p.active) {
        p.active = true;
        p.life = 0;
        p.mesh.position.set(
          pos.x + (Math.random() - 0.5) * 6,
          pos.y + Math.random() * 3,
          pos.z + 5 + Math.random() * 10
        );
        p.mesh.visible = true;
        p.vel.set(
          (Math.random() - 0.5) * 2,
          (Math.random() - 0.5) * 1.5,
          -10 - Math.random() * 5
        );
        spawned++;
      }
    }
  }

  applyCosmetics(config: CosmeticsConfig) {
    this.currentCosmetics = { ...config };

    if (this.boardDeckMesh && this.boardFoilMesh) {
      if (config.boardId === 'sakura-foil') {
        (this.boardDeckMesh.material as THREE.MeshStandardMaterial).color.set('#FCE7F3');
        (this.boardFoilMesh.material as THREE.MeshBasicMaterial).color.set('#F472B6');
      } else if (config.boardId === 'dune-glider') {
        (this.boardDeckMesh.material as THREE.MeshStandardMaterial).color.set('#FEF3C7');
        (this.boardFoilMesh.material as THREE.MeshBasicMaterial).color.set('#F59E0B');
      } else if (config.boardId === 'celestia-blade') {
        (this.boardDeckMesh.material as THREE.MeshStandardMaterial).color.set('#E0F2FE');
        (this.boardFoilMesh.material as THREE.MeshBasicMaterial).color.set('#38BDF8');
      } else if (config.boardId === 'forest-spirit') {
        (this.boardDeckMesh.material as THREE.MeshStandardMaterial).color.set('#D7E8C8');
        (this.boardFoilMesh.material as THREE.MeshBasicMaterial).color.set('#8BC34A');
      } else {
        (this.boardDeckMesh.material as THREE.MeshStandardMaterial).color.set('#faeed7');
        (this.boardFoilMesh.material as THREE.MeshBasicMaterial).color.set('#6de4a2');
      }
    }

    if (this.capeMesh) {
      (this.capeMesh.material as THREE.MeshLambertMaterial).color.set(config.capeColor);
    }

    const isForestWanderer = config.characterStyle === 'forest-wanderer';
    const isNomad = !isForestWanderer && (config.characterStyle === 'desert-nomad' || this.stats.currentBiome === 'dunes');
    if (this.hatMesh && this.hoodMesh && this.acornCapMesh) {
      this.hatMesh.visible = !isNomad && !isForestWanderer;
      this.hoodMesh.visible = isNomad;
      this.acornCapMesh.visible = isForestWanderer;
    }
    if (this.torsoMesh) {
      const torsoColor = isForestWanderer ? '#5c7a4a' : isNomad ? '#ad4b29' : '#c85a32';
      (this.torsoMesh.material as THREE.MeshLambertMaterial).color.set(torsoColor);
    }
    if (this.sootSpriteMesh) {
      this.sootSpriteMesh.visible = true; // Soot sprite active as companion
    }

    this.updateTrailColors();
  }

  setUpright(upright: boolean) {
    this.isUpright = upright;
  }

  triggerTrick(trick: TrickType, audioManager?: AudioManager | null): boolean {
    if (this.isGrounded && this.jumpVelocity === 0) {
      this.jumpVelocity = 12.0;
      this.isGrounded = false;
      this.stats.airTime = 0.01;
    }

    this.activeTrick = trick;
    this.trickTimer = 0.5;
    this.slowMoTimer = 0.4;
    this.stats.slowMoActive = true;

    const trickNames: Record<TrickType, string> = {
      spin: 'Ghibli Corkscrew 360°',
      flip: 'Skyward Backflip',
      grab: 'Zephyr Rail Grab',
      pose: 'Zen Cloud Glide',
    };

    this.stats.activeTrickName = trickNames[trick];
    this.stats.combo = Math.min(6, this.stats.combo + 1);
    this.stats.score += 250 * this.stats.combo;
    this.stats.styleMeter = Math.min(100, this.stats.styleMeter + 16);

    if (audioManager) {
      audioManager.playTrickSound(this.stats.activeTrickName, this.stats.combo);
    }

    this.emitWindPetals(this.position, 4);
    return true;
  }

  update(
    dt: number,
    input: {
      left: boolean;
      right: boolean;
      forward: boolean;
      jump: boolean;
      drift: boolean;
      trickSpin?: boolean;
      trickFlip?: boolean;
      trickGrab?: boolean;
      trickPose?: boolean;
    },
    time: number,
    terrainManager?: TerrainManager,
    audioManager?: AudioManager | null
  ) {
    const currentBiome = getBiomeAt(this.position.z);
    const friction = getBiomeFriction(currentBiome);
    this.stats.currentBiome = currentBiome;
    this.stats.currentFriction = friction;

    if (this.slowMoTimer > 0) {
      this.slowMoTimer -= dt;
      this.stats.slowMoActive = true;
    } else {
      this.stats.slowMoActive = false;
    }

    if (input.trickSpin) this.triggerTrick('spin', audioManager);
    else if (input.trickFlip) this.triggerTrick('flip', audioManager);
    else if (input.trickGrab) this.triggerTrick('grab', audioManager);
    else if (input.trickPose) this.triggerTrick('pose', audioManager);

    if (this.trickTimer > 0) {
      this.trickTimer -= dt;
      if (this.trickTimer <= 0) {
        this.activeTrick = null;
      }
    } else if (this.isGrounded) {
      this.stats.activeTrickName = null;
    }

    const effectiveDt = Math.min(dt, 0.05) * (this.stats.slowMoActive ? 0.7 : 1.0);

    // Steering & Carving
    const steerSpeed = (input.drift ? 40.0 : 26.0) * (0.85 + (0.08 - friction) * 2.0);
    let targetCarve = 0;

    if (input.left) {
      targetCarve = input.drift ? -0.48 : -0.32;
      this.velocity.x -= steerSpeed * effectiveDt;
    } else if (input.right) {
      targetCarve = input.drift ? 0.48 : 0.32;
      this.velocity.x += steerSpeed * effectiveDt;
    }

    const dampingFactor = currentBiome === 'dunes' ? 0.94 : 0.88;
    this.velocity.x *= Math.pow(dampingFactor, effectiveDt * 60);
    this.carveAngle = THREE.MathUtils.lerp(this.carveAngle, targetCarve, 12 * effectiveDt);

    // Forward Surfing Speed
    let targetSpeed = 22.0;
    if (input.forward) targetSpeed = 34.0;
    if (input.drift) targetSpeed *= 0.85;

    const styleBonus = (this.stats.styleMeter / 100) * 9.0;
    targetSpeed += styleBonus;

    if (currentBiome === 'dunes') targetSpeed += 2.5;

    this.velocity.z = THREE.MathUtils.lerp(this.velocity.z, targetSpeed, 3.5 * effectiveDt);

    // Updraft Thermal Geysers Collision
    if (terrainManager && terrainManager.updraftsList) {
      for (const up of terrainManager.updraftsList) {
        const dist = Math.hypot(this.position.x - up.x, this.position.z - up.z);
        if (dist < up.radius && this.position.y < up.y + 12.0) {
          if (this.jumpVelocity < 20.0) {
            this.jumpVelocity = 22.5;
            this.isGrounded = false;
            this.stats.airTime = 0.01;
            this.emitJumpDust(this.position, 8);
            this.emitWindPetals(this.position, 6);
            if (audioManager) audioManager.playUpdraftSound();
          }
        }
      }
    }

    // Jump & Air Time
    if (input.jump && this.isGrounded) {
      this.jumpVelocity = 15.0;
      this.isGrounded = false;
      this.stats.airTime = 0.01;
      this.emitJumpDust(this.position, 6);
    }

    const gravityRate = this.stats.slowMoActive ? 19.5 : 28.0;
    if (!this.isGrounded) {
      this.jumpVelocity -= gravityRate * effectiveDt;
      this.position.y += this.jumpVelocity * effectiveDt;
      this.stats.airTime += effectiveDt;

      if (this.activeTrick === 'spin') {
        this.spinAngle += effectiveDt * 14.0;
      } else if (this.activeTrick === 'flip') {
        this.flipAngle += effectiveDt * 12.0;
      } else if (this.activeTrick === 'grab') {
        this.grabPoseWeight = THREE.MathUtils.lerp(this.grabPoseWeight, 1.0, 15 * effectiveDt);
      } else if (this.activeTrick === 'pose') {
        this.zenPoseWeight = THREE.MathUtils.lerp(this.zenPoseWeight, 1.0, 15 * effectiveDt);
      } else {
        this.spinAngle += effectiveDt * 4.0;
        this.flipAngle = Math.sin(this.stats.airTime * 3.5) * 0.25;
      }
    } else {
      this.spinAngle = THREE.MathUtils.lerp(this.spinAngle, 0, 12 * effectiveDt);
      this.flipAngle = THREE.MathUtils.lerp(this.flipAngle, 0, 12 * effectiveDt);
      this.grabPoseWeight = THREE.MathUtils.lerp(this.grabPoseWeight, 0, 14 * effectiveDt);
      this.zenPoseWeight = THREE.MathUtils.lerp(this.zenPoseWeight, 0, 14 * effectiveDt);
    }

    this.position.x += this.velocity.x * effectiveDt;
    this.position.z += this.velocity.z * effectiveDt;

    let groundHeight = getTerrainHeight(this.position.x, this.position.z);
    let isOnIsland = false;

    if (terrainManager) {
      const surf = terrainManager.getSurfaceHeight(this.position.x, this.position.z, this.position.y);
      groundHeight = surf.height;
      isOnIsland = surf.isOnIsland;
    }

    this.stats.isOnFloatingIsland = isOnIsland;
    const targetY = groundHeight + this.hoverHeight;

    if (this.position.y <= targetY) {
      if (!this.isGrounded && this.jumpVelocity < -2) {
        this.emitJumpDust(this.position, 8);
        const trickBonus = Math.floor(this.stats.airTime * 280) + (this.activeTrick ? 350 : 0);
        if (trickBonus > 50) {
          this.stats.score += trickBonus;
          this.stats.styleMeter = Math.min(100, this.stats.styleMeter + 15);
        }
      }
      this.position.y = targetY;
      this.jumpVelocity = 0;
      this.isGrounded = true;
      this.activeTrick = null;
    }

    const currentGroundNormal = getTerrainNormal(this.position.x, this.position.z);
    this.targetNormal.copy(currentGroundNormal);
    this.normal.lerp(this.targetNormal, 14 * effectiveDt);

    this.pitchAngle = (this.normal.z / this.normal.y) * 0.8;

    this.group.position.copy(this.position);

    this.boardMesh.rotation.z = -this.carveAngle * 1.4;
    this.boardMesh.rotation.x = this.pitchAngle + (this.activeTrick === 'flip' ? this.flipAngle : 0);
    this.boardMesh.rotation.y = this.spinAngle;

    this.characterMesh.rotation.z = -this.carveAngle * 0.9;
    this.characterMesh.rotation.x = this.flipAngle - this.grabPoseWeight * 0.5;
    this.characterMesh.rotation.y = -this.carveAngle * 0.4 + (this.isGrounded ? 0.35 : this.spinAngle);
    this.characterMesh.position.y = -this.grabPoseWeight * 0.25;

    const capeWind = Math.sin(time * 14.0 + this.position.z * 0.2) * (0.35 + (this.velocity.z / 30) * 0.4);
    this.capeMesh.rotation.x = 0.5 + capeWind;
    this.capeMesh.rotation.z = this.carveAngle * 0.6;

    if (this.leftArmMesh && this.rightArmMesh) {
      this.leftArmMesh.rotation.z = THREE.MathUtils.lerp(this.leftArmMesh.rotation.z, -this.carveAngle * 0.8, 8 * effectiveDt);
      this.rightArmMesh.rotation.z = THREE.MathUtils.lerp(this.rightArmMesh.rotation.z, -this.carveAngle * 0.8, 8 * effectiveDt);

      if (this.grabPoseWeight > 0.05) {
        this.rightArmMesh.position.y = 1.05 - this.grabPoseWeight * 0.45;
        this.rightArmMesh.rotation.x = 0.6 + this.grabPoseWeight * 0.6;
      } else {
        this.rightArmMesh.position.y = 1.05;
        this.rightArmMesh.rotation.x = 0.6;
      }
    }

    // Whisperwood Soot Sprite Companion — bobs and orbits playfully alongside the player
    if (this.sootSpriteMesh.visible) {
      this.sootSpriteTime += effectiveDt;
      const orbitRadius = 1.1;
      const t = this.sootSpriteTime;
      this.sootSpriteMesh.position.set(
        Math.sin(t * 1.4) * orbitRadius,
        1.4 + Math.sin(t * 2.2) * 0.25,
        -0.6 + Math.cos(t * 1.4) * orbitRadius * 0.6
      );
      this.sootSpriteMesh.rotation.y = t * 1.5;
    }

    this.updateTrailRibbon(effectiveDt);

    // Camera Tracking
    if (this.isUpright) {
      const targetCameraTilt = -this.carveAngle * 0.18;
      this.cameraTilt = THREE.MathUtils.lerp(this.cameraTilt, targetCameraTilt, 8 * effectiveDt);

      const airZoom = this.isGrounded ? 0 : Math.min(this.stats.airTime * 1.5, 3.2);
      const slowMoZoom = this.stats.slowMoActive ? -1.2 : 0.0;

      const targetCamX = this.position.x - this.carveAngle * 2.2;
      const targetCamY = this.position.y + 4.2 + (this.isGrounded ? 0 : 1.4);
      const targetCamZ = this.position.z - 8.2 - (this.velocity.z / 25) * 2.2 - airZoom + slowMoZoom;

      this.cameraPos.x = THREE.MathUtils.lerp(this.cameraPos.x, targetCamX, 6.0 * effectiveDt);
      this.cameraPos.y = THREE.MathUtils.lerp(this.cameraPos.y, targetCamY, 7.0 * effectiveDt);
      this.cameraPos.z = THREE.MathUtils.lerp(this.cameraPos.z, targetCamZ, 8.0 * effectiveDt);

      this.cameraLookAt.x = THREE.MathUtils.lerp(this.cameraLookAt.x, this.position.x + this.carveAngle * 1.6, 8 * effectiveDt);
      this.cameraLookAt.y = THREE.MathUtils.lerp(this.cameraLookAt.y, this.position.y + 2.0, 8 * effectiveDt);
      this.cameraLookAt.z = THREE.MathUtils.lerp(this.cameraLookAt.z, this.position.z + 12.0, 8 * effectiveDt);
    } else {
      const targetCameraTilt = -this.carveAngle * 0.35;
      this.cameraTilt = THREE.MathUtils.lerp(this.cameraTilt, targetCameraTilt, 8 * effectiveDt);

      const airZoom = this.isGrounded ? 0 : Math.min(this.stats.airTime * 1.5, 3.0);
      const slowMoZoom = this.stats.slowMoActive ? -1.0 : 0.0;

      const targetCamX = this.position.x - this.carveAngle * 3.5;
      const targetCamY = this.position.y + 3.8 + (this.isGrounded ? 0 : 1.2);
      const targetCamZ = this.position.z - 7.5 - (this.velocity.z / 25) * 2.0 - airZoom + slowMoZoom;

      this.cameraPos.x = THREE.MathUtils.lerp(this.cameraPos.x, targetCamX, 6.0 * effectiveDt);
      this.cameraPos.y = THREE.MathUtils.lerp(this.cameraPos.y, targetCamY, 7.0 * effectiveDt);
      this.cameraPos.z = THREE.MathUtils.lerp(this.cameraPos.z, targetCamZ, 8.0 * effectiveDt);

      this.cameraLookAt.x = THREE.MathUtils.lerp(this.cameraLookAt.x, this.position.x + this.carveAngle * 2.0, 8 * effectiveDt);
      this.cameraLookAt.y = THREE.MathUtils.lerp(this.cameraLookAt.y, this.position.y + 1.2, 8 * effectiveDt);
      this.cameraLookAt.z = THREE.MathUtils.lerp(this.cameraLookAt.z, this.position.z + 10.0, 8 * effectiveDt);
    }

    // Particle Lifecycle
    for (const p of this.dustParticles) {
      if (p.active) {
        p.life += effectiveDt;
        p.mesh.position.addScaledVector(p.vel, effectiveDt);
        const progress = p.life / p.maxLife;
        p.mesh.scale.setScalar(1.2 + progress * 1.5);
        if (progress >= 1.0) {
          p.active = false;
          p.mesh.visible = false;
        }
      }
    }

    for (const p of this.petalParticles) {
      if (p.active) {
        p.life += effectiveDt;
        p.mesh.position.addScaledVector(p.vel, effectiveDt);
        if (p.mesh.position.z < this.position.z - 15 || p.life > 2.5) {
          p.active = false;
          p.mesh.visible = false;
        }
      }
    }

    if (Math.random() < 0.2) {
      this.emitWindPetals(this.position, 1);
    }

    this.stats.speed = this.velocity.z;
    this.stats.distance = Math.floor(this.position.z);
    this.stats.isGrounded = this.isGrounded;

    if (Math.abs(this.carveAngle) > 0.15 || !this.isGrounded || this.activeTrick) {
      this.stats.styleMeter = Math.min(100, this.stats.styleMeter + effectiveDt * 9);
    } else {
      this.stats.styleMeter = Math.max(5, this.stats.styleMeter - effectiveDt * 2);
    }

    if (this.stats.styleMeter >= 80) this.stats.styleTier = 'Transcendent';
    else if (this.stats.styleMeter >= 55) this.stats.styleTier = 'Flow';
    else if (this.stats.styleMeter >= 30) this.stats.styleTier = 'Breeze';
    else this.stats.styleTier = 'Chill';

    this.updateTrailColors();
  }

  private updateTrailRibbon(dt: number) {
    const boardWorld = new THREE.Vector3();
    this.boardMesh.getWorldPosition(boardWorld);

    const ribbonWidth = 0.55;
    const rightDir = new THREE.Vector3(1, 0, 0)
      .applyAxisAngle(new THREE.Vector3(0, 0, 1), -this.carveAngle)
      .multiplyScalar(ribbonWidth * 0.5);

    const ptLeft = boardWorld.clone().sub(rightDir).add(new THREE.Vector3(0, -0.05, -0.8));
    const ptRight = boardWorld.clone().add(rightDir).add(new THREE.Vector3(0, -0.05, -0.8));

    this.trailHistory.unshift({ left: ptLeft, right: ptRight });
    if (this.trailHistory.length > this.maxTrailPoints) {
      this.trailHistory.pop();
    }

    const posAttr = this.trailGeometry.attributes.position as THREE.BufferAttribute;
    const uvAttr = this.trailGeometry.attributes.uv as THREE.BufferAttribute;
    const progAttr = this.trailGeometry.attributes.aProgress as THREE.BufferAttribute;

    const count = this.trailHistory.length;
    for (let i = 0; i < this.maxTrailPoints; i++) {
      const idx = Math.min(i, count - 1);
      const pair = this.trailHistory[idx] || { left: boardWorld, right: boardWorld };
      const progress = 1.0 - i / this.maxTrailPoints;

      posAttr.setXYZ(i * 2, pair.left.x, pair.left.y, pair.left.z);
      uvAttr.setXY(i * 2, 0.0, progress);
      progAttr.setX(i * 2, progress);

      posAttr.setXYZ(i * 2 + 1, pair.right.x, pair.right.y, pair.right.z);
      uvAttr.setXY(i * 2 + 1, 1.0, progress);
      progAttr.setX(i * 2 + 1, progress);
    }

    posAttr.needsUpdate = true;
    uvAttr.needsUpdate = true;
    progAttr.needsUpdate = true;
  }

  private updateTrailColors() {
    const tier = this.stats.styleTier;
    const custom = this.currentCosmetics.trailId;

    if (custom === 'rainbow' || tier === 'Transcendent') {
      this.trailMaterial.uniforms.uColorA.value.set('#F472B6');
      this.trailMaterial.uniforms.uColorB.value.set('#38BDF8');
    } else if (custom === 'solar-flare' || tier === 'Flow') {
      this.trailMaterial.uniforms.uColorA.value.set('#F59E0B');
      this.trailMaterial.uniforms.uColorB.value.set('#FDE68A');
    } else if (custom === 'aurora') {
      this.trailMaterial.uniforms.uColorA.value.set('#818CF8');
      this.trailMaterial.uniforms.uColorB.value.set('#34D399');
    } else if (tier === 'Breeze') {
      this.trailMaterial.uniforms.uColorA.value.set('#48DE80');
      this.trailMaterial.uniforms.uColorB.value.set('#A3F5B8');
    } else {
      this.trailMaterial.uniforms.uColorA.value.set('#39C5BB');
      this.trailMaterial.uniforms.uColorB.value.set('#8EEAC8');
    }
  }

  checkOrbCollection(orbs: { id: string; x: number; y: number; z: number; collected: boolean; mesh?: THREE.Mesh }[]): number {
    let collectedCount = 0;
    for (const orb of orbs) {
      if (!orb.collected) {
        const dist = Math.hypot(this.position.x - orb.x, this.position.y - orb.y, this.position.z - orb.z);
        if (dist < 2.4) {
          orb.collected = true;
          if (orb.mesh) orb.mesh.visible = false;
          this.stats.windOrbsCollected += 1;
          this.stats.score += 200;
          this.stats.styleMeter = Math.min(100, this.stats.styleMeter + 20);
          this.emitJumpDust(new THREE.Vector3(orb.x, orb.y, orb.z), 5);
          collectedCount++;
        }
      }
    }
    return collectedCount;
  }

  dispose() {
    this.scene.remove(this.group);
    this.scene.remove(this.trailMesh);
    this.dustParticles.forEach(p => this.scene.remove(p.mesh));
    this.petalParticles.forEach(p => this.scene.remove(p.mesh));
    this.trailGeometry.dispose();
    this.trailMaterial.dispose();
    this.dustTexture.dispose();
    this.petalTexture.dispose();
  }
}
