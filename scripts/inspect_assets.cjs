const fs = require('fs');
const path = require('path');

const files = [
  'public/model.glb',
  'public/model02.glb',
  'public/model03.glb',
  'public/model04.glb',
  'public/model05.glb',
  'public/model06.glb',
  'public/obstacle01.glb',
  'public/0bstacle02.glb',
  'public/obstacle03.glb',
  'public/obstacle04.glb',
];

for (const relPath of files) {
  const fullPath = path.resolve(__dirname, '..', relPath);
  if (!fs.existsSync(fullPath)) {
    console.log(`[NOT FOUND] ${relPath}`);
    continue;
  }
  const fd = fs.openSync(fullPath, 'r');
  const headerBuf = Buffer.alloc(12);
  fs.readSync(fd, headerBuf, 0, 12, 0);
  const magic = headerBuf.readUInt32LE(0);
  const version = headerBuf.readUInt32LE(4);
  const totalLength = headerBuf.readUInt32LE(8);

  const chunkHeaderBuf = Buffer.alloc(8);
  fs.readSync(fd, chunkHeaderBuf, 0, 8, 12);
  const chunkLength = chunkHeaderBuf.readUInt32LE(0);
  const chunkType = chunkHeaderBuf.readUInt32LE(4);

  const jsonBuf = Buffer.alloc(chunkLength);
  fs.readSync(fd, jsonBuf, 0, chunkLength, 20);
  fs.closeSync(fd);

  const jsonStr = jsonBuf.toString('utf8');
  const gltf = JSON.parse(jsonStr);

  const meshes = gltf.meshes ? gltf.meshes.length : 0;
  const nodes = gltf.nodes ? gltf.nodes.length : 0;
  const skins = gltf.skins ? gltf.skins.length : 0;
  const animations = gltf.animations ? gltf.animations.length : 0;
  const materials = gltf.materials ? gltf.materials.map(m => m.name || 'unnamed') : [];
  const nodeNames = gltf.nodes ? gltf.nodes.map(n => n.name).filter(Boolean).slice(0, 10) : [];

  // Check accessors for position min/max to get bounding box!
  let posMin = [Infinity, Infinity, Infinity];
  let posMax = [-Infinity, -Infinity, -Infinity];
  if (gltf.accessors && gltf.meshes) {
    for (const mesh of gltf.meshes) {
      for (const prim of mesh.primitives || []) {
        if (prim.attributes && prim.attributes.POSITION !== undefined) {
          const acc = gltf.accessors[prim.attributes.POSITION];
          if (acc && acc.min && acc.max) {
            posMin = [Math.min(posMin[0], acc.min[0]), Math.min(posMin[1], acc.min[1]), Math.min(posMin[2], acc.min[2])];
            posMax = [Math.max(posMax[0], acc.max[0]), Math.max(posMax[1], acc.max[1]), Math.max(posMax[2], acc.max[2])];
          }
        }
      }
    }
  }

  const size = [posMax[0] - posMin[0], posMax[1] - posMin[1], posMax[2] - posMin[2]];

  console.log(`\n=== ${relPath} (${(totalLength / (1024 * 1024)).toFixed(2)} MB) ===`);
  console.log(`  Nodes: ${nodes}, Meshes: ${meshes}, Skins: ${skins}, Animations: ${animations}`);
  console.log(`  Materials: [${materials.slice(0, 5).join(', ')}${materials.length > 5 ? '...' : ''}]`);
  console.log(`  Bounds: min=[${posMin.map(v => v.toFixed(2)).join(', ')}], max=[${posMax.map(v => v.toFixed(2)).join(', ')}]`);
  console.log(`  Size: W=${size[0].toFixed(2)}m, H=${size[1].toFixed(2)}m, D=${size[2].toFixed(2)}m`);
  console.log(`  Node names: [${nodeNames.join(', ')}]`);
}
