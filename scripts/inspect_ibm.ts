import * as fs from 'fs';
import * as path from 'path';
import * as THREE from 'three';

const heroes = ['shadow', 'flame', 'thunder', 'frost', 'void'];

function parseGLB(buffer: Buffer) {
  const magic = buffer.readUInt32LE(0);
  const length = buffer.readUInt32LE(8);
  let offset = 12;

  let json: any = null;
  let binaryBuffer: Buffer | null = null;

  while (offset < length) {
    const chunkLength = buffer.readUInt32LE(offset);
    const chunkType = buffer.readUInt32LE(offset + 4);
    if (chunkType === 0x4E4F534A) { // JSON
      const jsonStr = buffer.toString('utf8', offset + 8, offset + 8 + chunkLength);
      json = JSON.parse(jsonStr);
    } else if (chunkType === 0x004E4942) { // BIN
      binaryBuffer = buffer.subarray(offset + 8, offset + 8 + chunkLength);
    }
    offset += 8 + chunkLength;
  }
  return { json, binaryBuffer };
}

for (const heroId of heroes) {
  const filePath = path.resolve(process.cwd(), 'public/models', `${heroId}.glb`);
  const { json, binaryBuffer } = parseGLB(fs.readFileSync(filePath));
  console.log(`\n=================== HERO: ${heroId} ===================`);
  const skin = json.skins[0];
  const ibmAccessor = json.accessors[skin.inverseBindMatrices];
  const ibmBufferView = json.bufferViews[ibmAccessor.bufferView];
  const ibmByteOffset = (ibmBufferView.byteOffset || 0) + (ibmAccessor.byteOffset || 0);

  console.log(`Joints and their Inverse Bind Matrix decompositions:`);
  for (let i = 0; i < skin.joints.length; i++) {
    const jointIdx = skin.joints[i];
    const jointNode = json.nodes[jointIdx];
    // Read 16 floats (64 bytes)
    const matOffset = ibmByteOffset + i * 64;
    const matArray = new Float32Array(16);
    for (let f = 0; f < 16; f++) {
      matArray[f] = binaryBuffer!.readFloatLE(matOffset + f * 4);
    }
    const mat = new THREE.Matrix4().fromArray(matArray);
    // Bind matrix is inverse of inverseBindMatrix
    const bindMat = mat.clone().invert();
    const bindPos = new THREE.Vector3();
    const bindQuat = new THREE.Quaternion();
    const bindScale = new THREE.Vector3();
    bindMat.decompose(bindPos, bindQuat, bindScale);

    const localEuler = new THREE.Euler().setFromQuaternion(new THREE.Quaternion(...(jointNode.rotation || [0, 0, 0, 1])));
    const bindEuler = new THREE.Euler().setFromQuaternion(bindQuat);

    console.log(`  ${jointNode.name.padEnd(15)}: ` +
      `Local Euler: [${(localEuler.x*180/Math.PI).toFixed(1)}, ${(localEuler.y*180/Math.PI).toFixed(1)}, ${(localEuler.z*180/Math.PI).toFixed(1)}] | ` +
      `Bind World Pos: [${bindPos.x.toFixed(2)}, ${bindPos.y.toFixed(2)}, ${bindPos.z.toFixed(2)}] | ` +
      `Bind World Rot: [${(bindEuler.x*180/Math.PI).toFixed(1)}, ${(bindEuler.y*180/Math.PI).toFixed(1)}, ${(bindEuler.z*180/Math.PI).toFixed(1)}]`
    );
  }
}
