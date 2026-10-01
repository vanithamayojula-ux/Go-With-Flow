import * as fs from 'fs';
import * as path from 'path';

const heroes = ['shadow', 'flame', 'thunder', 'frost', 'void'];

function parseGLBJSON(buffer: Buffer) {
  // GLB header: magic (4 bytes), version (4 bytes), length (4 bytes)
  const magic = buffer.readUInt32LE(0);
  if (magic !== 0x46546C67) { // 'glTF'
    throw new Error('Not a valid GLB file');
  }
  const chunkLength = buffer.readUInt32LE(12);
  const chunkType = buffer.readUInt32LE(16);
  if (chunkType !== 0x4E4F534A) { // 'JSON'
    throw new Error('First chunk is not JSON');
  }
  const jsonStr = buffer.toString('utf8', 20, 20 + chunkLength);
  return JSON.parse(jsonStr);
}

for (const heroId of heroes) {
  const filePath = path.resolve(process.cwd(), 'public/models', `${heroId}.glb`);
  const buffer = fs.readFileSync(filePath);
  const gltf = parseGLBJSON(buffer);

  console.log(`\n=================== HERO: ${heroId} ===================`);
  console.log(`Nodes count: ${gltf.nodes?.length}, Skins count: ${gltf.skins?.length}, Meshes: ${gltf.meshes?.length}`);
  
  if (gltf.skins && gltf.skins.length > 0) {
    for (const skin of gltf.skins) {
      console.log(`Skin name: ${skin.name || 'unnamed'}, Skeleton root: ${skin.skeleton !== undefined ? gltf.nodes[skin.skeleton]?.name : 'none'}`);
      console.log(`Joints:`);
      for (const jointIdx of skin.joints) {
        const node = gltf.nodes[jointIdx];
        const t = node.translation ? `pos: [${node.translation.map((n: number) => n.toFixed(3)).join(', ')}]` : 'pos: [0, 0, 0]';
        const r = node.rotation ? `quat: [${node.rotation.map((n: number) => n.toFixed(3)).join(', ')}]` : 'quat: [0, 0, 0, 1]';
        const s = node.scale ? `scale: [${node.scale.map((n: number) => n.toFixed(3)).join(', ')}]` : '';
        console.log(`  [${jointIdx}] ${node.name?.padEnd(20)} ${t} | ${r} ${s}`);
      }
    }
  } else {
    console.log(`No skins found, listing all nodes:`);
    gltf.nodes?.forEach((n: any, idx: number) => {
      console.log(`  [${idx}] ${n.name}`);
    });
  }
}
