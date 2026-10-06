import * as THREE from 'three';
import { HeroId } from './types';
import { createPlayerCharacter, animatePlayerCharacter } from './game/characterModel';
import { loadHeroModel, buildHeroRig } from './game/heroRig';
import { heroById } from './game/heroes';

declare global {
  interface Window {
    __labInfo?: any;
    __labReady?: boolean;
    __pc?: any;
    __runFrameDeltaTrace?: (heroId: HeroId) => Promise<any>;
    __setHeroAndPose?: (heroId: HeroId, pose: string) => Promise<boolean>;
  }
}

async function initLab() {
  const params = new URLSearchParams(window.location.search);
  const heroId = (params.get('hero') || 'flame') as HeroId;
  const view = params.get('view') || 'three'; // 'front' | 'side' | 'back' | 'three'
  let pose = params.get('pose') || 'bind';  // 'bind' | 'idle' | 'run' | 'slide' | 'jump'
  const time = parseFloat(params.get('time') || '0');

  const titleEl = document.getElementById('hero-title');
  const poseEl = document.getElementById('pose-title');
  if (titleEl) titleEl.innerText = `Hero: ${heroId.toUpperCase()} (${heroById(heroId).name})`;
  if (poseEl) poseEl.innerText = `Pose: ${pose.toUpperCase()} | View: ${view.toUpperCase()}`;

  const container = document.getElementById('canvas-container') || document.body;
  const width = window.innerWidth || 800;
  const height = window.innerHeight || 600;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x181e2b);

  // Camera setup
  const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
  
  if (view === 'side') {
    camera.position.set(3.0, 0.75, 0);
    camera.lookAt(0, 0.60, 0);
  } else if (view === 'front') {
    camera.position.set(0, 0.8, 3.0);
    camera.lookAt(0, 0.60, 0);
  } else if (view === 'back') {
    camera.position.set(0, 1.4, -3.2);
    camera.lookAt(0, 0.60, 0);
  } else {
    // 3/4 isometric perspective
    camera.position.set(2.2, 1.4, 2.2);
    camera.lookAt(0, 0.60, 0);
  }

  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  container.appendChild(renderer.domElement);

  // Studio lighting: key 3.2 (0,3.5,-4.5), rim magenta 1.5 (-3,2,4), hemi 0.6/0.4, spot 3.0
  const ambient = new THREE.AmbientLight(0xddeeff, 0.35);
  scene.add(ambient);

  const keyLight = new THREE.DirectionalLight(0xffffff, 3.2);
  keyLight.position.set(0, 3.5, -4.5);
  scene.add(keyLight);

  const rimMagenta = new THREE.DirectionalLight(0xff00aa, 1.5);
  rimMagenta.position.set(-3, 2, 4);
  scene.add(rimMagenta);

  const fillLight = new THREE.HemisphereLight(0x88ccff, 0x080810, 0.6);
  fillLight.position.set(0, 5, 0);
  scene.add(fillLight);

  const spotLight = new THREE.SpotLight(0x00d2e0, 3.0, 26, Math.PI / 6, 0.35, 1.1);
  spotLight.position.set(0, 3.0, 3.0);
  spotLight.target.position.set(0, 0.6, 0);
  scene.add(spotLight);
  scene.add(spotLight.target);

  // Ground grid
  const grid = new THREE.GridHelper(6, 12, 0x00d2e0, 0x223344);
  grid.position.set(0, 0, 0);
  scene.add(grid);

  // Ground plane
  const groundGeom = new THREE.PlaneGeometry(6, 6);
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x0e131d, roughness: 0.8, metalness: 0.2 });
  const ground = new THREE.Mesh(groundGeom, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.005;
  scene.add(ground);

  // Load Hero
  const pc = createPlayerCharacter();
  scene.add(pc.group);

  const loaded = await pc.setHero?.(heroId);
  if (!loaded) {
    console.error(`Failed to load hero ${heroId}`);
  }

  // Pose selection
  if (pc.heroRig) {
    if (pose === 'bind') {
      // Raw bind pose - reset all bone quaternions to raw restQuat
      pc.syncBones?.();
    } else {
      let activeTrick: any = null;
      let turnVelocity = 0;
      if (pose === 'spin' || pose === 'trick_spin') activeTrick = 'spin';
      else if (pose === 'flip' || pose === 'trick_flip') activeTrick = 'flip';
      else if (pose === 'grab' || pose === 'trick_grab') activeTrick = 'grab';
      else if (pose === 'pose' || pose === 'trick_pose') activeTrick = 'pose';
      else if (pose === 'lane_left') turnVelocity = -1.0;
      else if (pose === 'lane_right') turnVelocity = 1.0;

      const animState = {
        isGrounded: pose !== 'jump' && !activeTrick,
        isSliding: pose === 'slide',
        isGrinding: pose === 'grind',
        isBoosting: pose === 'boost',
        stumbleTimer: 0,
        activeTrickName: activeTrick,
        activeTrick: activeTrick,
        turnVelocity: turnVelocity,
        nearestObstacleDist: 999,
      };
      const speedFactor = pose === 'idle' ? 0 : 1.0;
      animatePlayerCharacter(pc, time, speedFactor, animState);
    }
  }

  // Collect bone transforms for window.__labInfo
  const boneInfo: Record<string, any> = {};
  if (pc.heroRig?.scene) {
    pc.heroRig.scene.traverse((o: THREE.Object3D) => {
      if (o.name && (o.type === 'Bone' || (o as any).isBone)) {
        const worldPos = new THREE.Vector3();
        const worldQuat = new THREE.Quaternion();
        o.getWorldPosition(worldPos);
        o.getWorldQuaternion(worldQuat);
        const localEuler = new THREE.Euler().setFromQuaternion(o.quaternion);
        const worldEuler = new THREE.Euler().setFromQuaternion(worldQuat);
        boneInfo[o.name] = {
          localPos: [o.position.x, o.position.y, o.position.z],
          localRotDeg: [(localEuler.x * 180 / Math.PI), (localEuler.y * 180 / Math.PI), (localEuler.z * 180 / Math.PI)],
          localQuat: [o.quaternion.x, o.quaternion.y, o.quaternion.z, o.quaternion.w],
          worldPos: [worldPos.x, worldPos.y, worldPos.z],
          worldRotDeg: [(worldEuler.x * 180 / Math.PI), (worldEuler.y * 180 / Math.PI), (worldEuler.z * 180 / Math.PI)],
        };
      }
    });
  }

  window.__labInfo = {
    heroId,
    pose,
    view,
    bones: boneInfo,
  };
  window.__pc = pc;

  window.__runFrameDeltaTrace = async (targetHeroId: HeroId) => {
    await pc.setHero?.(targetHeroId);
    const dt = 1 / 60;
    let simTime = 0;
    const history: any[] = [];
    let maxDelta = 0;
    let maxDeltaFrame = 0;
    let maxDeltaBone = '';

    for (let f = 0; f < 15; f++) {
      simTime += dt;
      animatePlayerCharacter(pc, simTime, 1.0, {
        isGrounded: true,
        isSliding: false,
        isGrinding: false,
        isBoosting: false,
        stumbleTimer: 0,
        activeTrickName: null,
        activeTrick: null,
        turnVelocity: 0,
        nearestObstacleDist: 999,
        dt,
      });
    }

    function readAngles(): Record<string, number> {
      const angles: Record<string, number> = {};
      if (pc.heroRig) {
        const d = pc.heroRig.drivers;
        angles['leftArmX'] = d.leftArm.rotation.x;
        angles['leftArmZ'] = d.leftArm.rotation.z;
        angles['rightArmX'] = d.rightArm.rotation.x;
        angles['rightArmZ'] = d.rightArm.rotation.z;
        angles['spineX'] = d.spine.rotation.x;
        angles['spineZ'] = d.spine.rotation.z;
        angles['hipsY'] = d.hips.position.y;
        angles['hipsRotY'] = d.hips.rotation.y;
        angles['hipsRotZ'] = d.hips.rotation.z;
      } else if (pc.spineGroup) {
        angles['spineY'] = pc.spineGroup.position.y;
        angles['spineX'] = pc.spineGroup.rotation.x;
        angles['spineZ'] = pc.spineGroup.rotation.z;
        if (pc.leftArmGroup && pc.rightArmGroup) {
          angles['leftArmX'] = pc.leftArmGroup.rotation.x;
          angles['leftArmZ'] = pc.leftArmGroup.rotation.z;
          angles['rightArmX'] = pc.rightArmGroup.rotation.x;
          angles['rightArmZ'] = pc.rightArmGroup.rotation.z;
        }
      }
      return angles;
    }

    let prevAngles = readAngles();

    for (let f = 0; f < 200; f++) {
      simTime += dt;
      let turnVel = 0;
      let boosting = false;

      if (f >= 30 && f < 60) {
        const progress = (f - 30) / 30;
        turnVel = -5.0 * Math.sin(progress * Math.PI * 0.5);
      } else if (f >= 60 && f < 100) {
        const progress = (f - 60) / 40;
        turnVel = -5.0 + 10.0 * progress;
      } else if (f >= 100 && f < 120) {
        const progress = (f - 100) / 20;
        turnVel = 5.0 * (1 - progress);
      } else if (f >= 120 && f < 170) {
        boosting = true;
      }

      animatePlayerCharacter(pc, simTime, 1.0, {
        isGrounded: true,
        isSliding: false,
        isGrinding: false,
        isBoosting: boosting,
        stumbleTimer: 0,
        activeTrickName: null,
        activeTrick: null,
        turnVelocity: turnVel,
        nearestObstacleDist: 999,
        dt,
      });

      const currAngles = readAngles();
      const deltas: Record<string, number> = {};
      for (const [k, v] of Object.entries(currAngles)) {
        const d = Math.abs(v - (prevAngles[k] ?? v));
        deltas[k] = parseFloat(d.toFixed(6));
        if (d > maxDelta) {
          maxDelta = d;
          maxDeltaFrame = f;
          maxDeltaBone = k;
        }
      }

      history.push({
        frame: f,
        time: parseFloat(simTime.toFixed(4)),
        turnVelocity: parseFloat(turnVel.toFixed(3)),
        leanRatio: parseFloat((turnVel * 0.12).toFixed(3)),
        isBoosting: boosting,
        angles: currAngles,
        deltas,
      });

      prevAngles = currAngles;
    }

    return {
      heroId: targetHeroId,
      totalFrames: 200,
      dt,
      maxDelta: parseFloat(maxDelta.toFixed(5)),
      maxDeltaFrame,
      maxDeltaBone,
      passedThreshold: maxDelta <= 0.15,
      laneCrossSamples: history.slice(75, 85),
      boostEnterSamples: history.slice(118, 126),
      boostExitSamples: history.slice(168, 176),
    };
  };

  window.__setHeroAndPose = async (targetHeroId: HeroId, targetPose: string): Promise<boolean> => {
    if (pc.activeHeroId !== targetHeroId) {
      await pc.setHero?.(targetHeroId);
    }
    pose = targetPose;
    let turnVelocity = 0;
    if (targetPose === 'lane_left') turnVelocity = -5.0;
    else if (targetPose === 'lane_right') turnVelocity = 5.0;

    const animState = {
      isGrounded: targetPose !== 'jump',
      isSliding: targetPose === 'slide',
      isGrinding: targetPose === 'grind',
      isBoosting: targetPose === 'boost',
      stumbleTimer: 0,
      activeTrickName: null,
      activeTrick: null,
      turnVelocity,
      nearestObstacleDist: 999,
      dt: 0.016,
    };
    const speedFactor = targetPose === 'idle' ? 0 : 1.0;

    for (let i = 0; i < 25; i++) {
      animatePlayerCharacter(pc, 1.0 + i * 0.016, speedFactor, animState);
    }
    const titleEl = document.getElementById('hero-title');
    const poseEl = document.getElementById('pose-title');
    if (titleEl) titleEl.innerText = `Hero: ${targetHeroId.toUpperCase()} (${heroById(targetHeroId).name})`;
    if (poseEl) poseEl.innerText = `Pose: ${targetPose.toUpperCase()} | View: ${view.toUpperCase()}`;
    renderer.render(scene, camera);
    return true;
  };

  renderer.render(scene, camera);
  window.__labReady = true;

  // Animate if interactive
  let curTime = time;
  function loop() {
    requestAnimationFrame(loop);
    if (pose !== 'bind') {
      curTime += 0.016;
      let activeTrick: any = null;
      let turnVelocity = 0;
      if (pose === 'spin' || pose === 'trick_spin') activeTrick = 'spin';
      else if (pose === 'flip' || pose === 'trick_flip') activeTrick = 'flip';
      else if (pose === 'grab' || pose === 'trick_grab') activeTrick = 'grab';
      else if (pose === 'pose' || pose === 'trick_pose') activeTrick = 'pose';
      else if (pose === 'lane_left') turnVelocity = -1.0;
      else if (pose === 'lane_right') turnVelocity = 1.0;

      const animState = {
        isGrounded: pose !== 'jump' && !activeTrick,
        isSliding: pose === 'slide',
        isGrinding: pose === 'grind',
        isBoosting: pose === 'boost',
        stumbleTimer: 0,
        activeTrickName: activeTrick,
        activeTrick: activeTrick,
        turnVelocity: turnVelocity,
        nearestObstacleDist: 999,
      };
      const speedFactor = pose === 'idle' ? 0 : 1.0;
      animatePlayerCharacter(pc, curTime, speedFactor, animState);
    }
    renderer.render(scene, camera);
  }
  loop();
}

window.addEventListener('DOMContentLoaded', initLab);
