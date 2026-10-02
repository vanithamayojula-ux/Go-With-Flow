import * as THREE from 'three';

// Arm rest quaternion in shadow.glb is approx Euler(Math.PI, 0, 0)
const restQuatL = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI, 0, 0));
const restQuatR = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI, 0, 0));

// Arm vector in local space: extends along +Y (which points down in rest pose)
const armVector = new THREE.Vector3(0, 0.30, 0);

console.log('--- RIGHT ARM (Shoulder -0.70/0.35, Elbow 2.25) ---');
const rightEuler = new THREE.Euler(-0.70, 0, 0.35, 'ZYX');
const rightQuat = new THREE.Quaternion().setFromEuler(rightEuler);
const vR1 = armVector.clone().applyQuaternion(restQuatR.clone().multiply(rightQuat));
const vR2 = armVector.clone().applyQuaternion(rightQuat.clone().multiply(restQuatR));
console.log('  restQuat * q ->', vR1.x.toFixed(3), vR1.y.toFixed(3), vR1.z.toFixed(3));
console.log('  q * restQuat ->', vR2.x.toFixed(3), vR2.y.toFixed(3), vR2.z.toFixed(3));

console.log('--- LEFT ARM (Shoulder +0.80/-0.50, Elbow 2.60) ---');
const leftEuler = new THREE.Euler(0.80, 0, -0.50, 'ZYX');
const leftQuat = new THREE.Quaternion().setFromEuler(leftEuler);
const vL1 = armVector.clone().applyQuaternion(restQuatL.clone().multiply(leftQuat));
const vL2 = armVector.clone().applyQuaternion(leftQuat.clone().multiply(restQuatL));
console.log('  restQuat * q ->', vL1.x.toFixed(3), vL1.y.toFixed(3), vL1.z.toFixed(3));
console.log('  q * restQuat ->', vL2.x.toFixed(3), vL2.y.toFixed(3), vL2.z.toFixed(3));
