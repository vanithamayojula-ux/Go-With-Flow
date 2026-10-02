import * as THREE from 'three';
import { HeroId } from './types';
import { createPlayerCharacter, animatePlayerCharacter } from './game/characterModel';
import { loadHeroModel, buildHeroRig } from './game/heroRig';
import { heroById } from './game/heroes';

declare global {
  interface Window {
    __labInfo?: any;
    __labReady?: boolean;
  }
}

async function initLab() {
  const params = new URLSearchParams(window.location.search);
  const heroId = (params.get('hero') || 'flame') as HeroId;
  const view = params.get('view') || 'three'; // 'front' | 'side' | 'back' | 'three'
  const pose = params.get('pose') || 'bind';  // 'bind' | 'idle' | 'run' | 'slide' | 'jump'
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
    camera.position.set(0, 0.8, -3.0);
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
  renderer.toneMappingExposure = 1.1;
  container.appendChild(renderer.domElement);

  // Studio lighting
  const ambient = new THREE.AmbientLight(0xddeeff, 1.2);
  scene.add(ambient);

  const keyLight = new THREE.DirectionalLight(0xffffff, 3.2);
  keyLight.position.set(4, 6, 4);
  scene.add(keyLight);

  const rimMagenta = new THREE.DirectionalLight(0xff00aa, 1.5);
  rimMagenta.position.set(-3, 2, 4);
  scene.add(rimMagenta);

  const fillLight = new THREE.HemisphereLight(0x88ccff, 0x080810, 0.6);
  fillLight.position.set(0, 5, 0);
  scene.add(fillLight);

  const rimLight = new THREE.DirectionalLight(0x00d2e0, 1.5);
  rimLight.position.set(0, 4, -4);
  scene.add(rimLight);

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
        isBoosting: false,
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
        isBoosting: false,
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
