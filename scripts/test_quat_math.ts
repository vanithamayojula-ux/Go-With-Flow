import * as THREE from 'three';

const restEuler = new THREE.Euler(Math.PI, 0, 0, 'XYZ');
const restQuat = new THREE.Quaternion().setFromEuler(restEuler);

// Yaw (+Y by 30 deg): should turn left in parent space (+X moves toward -Z)
const yawEuler = new THREE.Euler(0, 30 * Math.PI / 180, 0, 'XYZ');
const yawQuat = new THREE.Quaternion().setFromEuler(yawEuler);

const armDir = new THREE.Vector3(-1, 0, 0); // left arm pointing -X

// Old way: restQuat * yawQuat
const qOld = restQuat.clone().multiply(yawQuat);
const vOld = armDir.clone().applyQuaternion(qOld);
console.log('Arm Old way (restQuat * q):', vOld.x.toFixed(3), vOld.y.toFixed(3), vOld.z.toFixed(3));

// New way: yawQuat * restQuat
const qNew = yawQuat.clone().multiply(restQuat);
const vNew = armDir.clone().applyQuaternion(qNew);
console.log('Arm New way (q * restQuat):', vNew.x.toFixed(3), vNew.y.toFixed(3), vNew.z.toFixed(3));
