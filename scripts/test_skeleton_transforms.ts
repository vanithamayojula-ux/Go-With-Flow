import { loadHeroModel, buildHeroRig } from '../src/game/heroRig';
import { createPlayerCharacter, animatePlayerCharacter } from '../src/game/characterModel';
import * as THREE from 'three';

async function test() {
  const pc = createPlayerCharacter();
  const loaded = await pc.setHero?.('shadow');
  console.log('Loaded:', loaded);

  const animState = {
    isGrounded: true,
    isSliding: false,
    isGrinding: false,
    isBoosting: false,
    stumbleTimer: 0,
    activeTrickName: null,
    activeTrick: null,
    turnVelocity: 0,
    nearestObstacleDist: 999,
  };

  animatePlayerCharacter(pc, 0, 1.0, animState);

  // Print world position and euler of all bones
  const scene = pc.heroRig!.scene;
  scene.updateMatrixWorld(true);

  console.log('\n--- BONE WORLD TRANSFORMS (SHADOW RUN POSE) ---');
  scene.traverse((o: THREE.Object3D) => {
    if (o.type === 'Bone' || (o as any).isBone) {
      const wp = new THREE.Vector3();
      const wq = new THREE.Quaternion();
      o.getWorldPosition(wp);
      o.getWorldQuaternion(wq);
      const we = new THREE.Euler().setFromQuaternion(wq);
      console.log(`${o.name.padEnd(16)} Pos: [${wp.x.toFixed(3)}, ${wp.y.toFixed(3)}, ${wp.z.toFixed(3)}] | RotDeg: [${(we.x*180/Math.PI).toFixed(1)}, ${(we.y*180/Math.PI).toFixed(1)}, ${(we.z*180/Math.PI).toFixed(1)}]`);
    }
  });
}

test().catch(console.error);
