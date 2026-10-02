import * as THREE from 'three';

// Thigh bone: restQuat is approx Euler(Math.PI, 0, 0)
const restQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI, 0, 0));
const legVector = new THREE.Vector3(0, 0.40, 0); // bone extends along local +Y

// Method 1: restQuat * q
for (const angle of [-1.65, -1.0, 0, 1.0, 1.65]) {
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(angle, 0, 0, 'YXZ'));
  
  const q1 = restQuat.clone().multiply(q);
  const v1 = legVector.clone().applyQuaternion(q1);

  const q2 = q.clone().multiply(restQuat);
  const v2 = legVector.clone().applyQuaternion(q2);

  console.log(`Angle ${angle.toFixed(2)}:`);
  console.log(`  restQuat * q -> Y: ${v1.y.toFixed(3)}, Z: ${v1.z.toFixed(3)}`);
  console.log(`  q * restQuat -> Y: ${v2.y.toFixed(3)}, Z: ${v2.z.toFixed(3)}`);
}
