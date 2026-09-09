import * as THREE from 'three';

/**
 * Procedural Handcrafted Painterly Texture Generators
 * Creates Ghibli-inspired albedo and normal textures with soft, painterly brush work.
 */

export function createPainterlyCloudTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, 512, 512);

  // Soft billowy clusters with layered brush-stroke feeling
  const puffs = [
    { x: 256, y: 270, r: 150 },
    { x: 190, y: 290, r: 110 },
    { x: 320, y: 280, r: 120 },
    { x: 240, y: 200, r: 100 },
    { x: 150, y: 310, r: 80 },
    { x: 370, y: 300, r: 90 },
    { x: 290, y: 210, r: 85 },
    { x: 210, y: 230, r: 75 },
  ];

  // Base soft shadow / ambient underbelly (Ghibli soft lilac-cyan shadow)
  puffs.forEach(p => {
    const grad = ctx.createRadialGradient(p.x, p.y + 25, p.r * 0.2, p.x, p.y + 25, p.r);
    grad.addColorStop(0, 'rgba(215, 228, 248, 0.95)');
    grad.addColorStop(0.65, 'rgba(185, 205, 235, 0.78)');
    grad.addColorStop(1, 'rgba(175, 195, 230, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(p.x, p.y + 25, p.r, 0, Math.PI * 2);
    ctx.fill();
  });

  // Midtone & upper highlight body (crisp warm painterly white)
  puffs.forEach(p => {
    const grad = ctx.createRadialGradient(p.x - p.r * 0.2, p.y - p.r * 0.25, p.r * 0.05, p.x, p.y, p.r);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.99)');
    grad.addColorStop(0.5, 'rgba(254, 248, 238, 0.94)');
    grad.addColorStop(0.8, 'rgba(240, 243, 250, 0.72)');
    grad.addColorStop(1, 'rgba(240, 243, 250, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  });

  // Warm sunlight rim edge (golden-hour touch)
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  const rimGrad = ctx.createLinearGradient(100, 100, 400, 400);
  rimGrad.addColorStop(0, 'rgba(255, 246, 220, 0.50)');
  rimGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.12)');
  rimGrad.addColorStop(1, 'rgba(160, 190, 230, 0.32)');
  ctx.fillStyle = rimGrad;
  ctx.fillRect(0, 0, 512, 512);
  ctx.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.generateMipmaps = true;
  return texture;
}

export function createFoliageTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, 256, 256);

  // Handcrafted brush grass tufts
  const blades = [
    { startX: 128, startY: 250, cp1X: 120, cp1Y: 140, endX: 100, endY: 30, w: 22, colorA: '#3D8A3D', colorB: '#89E493' },
    { startX: 128, startY: 250, cp1X: 135, cp1Y: 130, endX: 155, endY: 25, w: 20, colorA: '#449444', colorB: '#9DEB9C' },
    { startX: 115, startY: 250, cp1X: 90,  cp1Y: 160, endX: 65,  endY: 80, w: 18, colorA: '#357B35', colorB: '#72D478' },
    { startX: 140, startY: 250, cp1X: 165, cp1Y: 150, endX: 195, endY: 70, w: 18, colorA: '#3B843B', colorB: '#88DF8E' },
    { startX: 128, startY: 250, cp1X: 126, cp1Y: 110, endX: 128, endY: 15, w: 24, colorA: '#4D9F4D', colorB: '#B4F3A5' },
    { startX: 105, startY: 250, cp1X: 60,  cp1Y: 180, endX: 35,  endY: 130, w: 14, colorA: '#2F702F', colorB: '#68C86D' },
    { startX: 150, startY: 250, cp1X: 190, cp1Y: 180, endX: 220, endY: 120, w: 14, colorA: '#327432', colorB: '#6ECF74' }
  ];

  blades.forEach(b => {
    ctx.save();
    const grad = ctx.createLinearGradient(b.startX, b.startY, b.endX, b.endY);
    grad.addColorStop(0, b.colorA);
    grad.addColorStop(0.65, b.colorB);
    grad.addColorStop(1, '#D8FADC');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(b.startX - b.w * 0.5, b.startY);
    ctx.quadraticCurveTo(b.cp1X - b.w * 0.25, b.cp1Y, b.endX, b.endY);
    ctx.quadraticCurveTo(b.cp1X + b.w * 0.25, b.cp1Y, b.startX + b.w * 0.5, b.startY);
    ctx.closePath();
    ctx.fill();

    // Subtle center vein brush stroke
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(b.startX, b.startY - 20);
    ctx.quadraticCurveTo(b.cp1X, b.cp1Y, b.endX, b.endY + 15);
    ctx.stroke();
    ctx.restore();
  });

  // Hand-painted buttercup / dandelion / daisy blossoms (matching Ghibli meadow style)
  const flowers = [
    { x: 95, y: 70, r: 8, color: '#FCE789' },
    { x: 165, y: 60, r: 9, color: '#FFFFFF' },
    { x: 130, y: 40, r: 7, color: '#FCE789' },
    { x: 50, y: 110, r: 8, color: '#FFFFFF' },
    { x: 210, y: 100, r: 7, color: '#FFF5C0' },
    { x: 120, y: 85, r: 6, color: '#FFFFFF' },
  ];
  flowers.forEach(f => {
    ctx.fillStyle = f.color;
    ctx.beginPath();
    ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#E89F2A';
    ctx.beginPath();
    ctx.arc(f.x, f.y, f.r * 0.35, 0, Math.PI * 2);
    ctx.fill();
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

/**
 * Creates towering painted Ghibli cumulonimbus clouds (Laputa / Howl's Moving Castle style)
 * Vertical 512x1024 billowy clouds with layered volumetric shading
 */
export function createToweringCumulusTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, 512, 1024);

  // Towering cauliflower puffs reaching vertically
  const towerPuffs = [
    { x: 256, y: 880, r: 180 },
    { x: 160, y: 850, r: 140 },
    { x: 350, y: 860, r: 150 },
    { x: 230, y: 680, r: 170 },
    { x: 330, y: 690, r: 150 },
    { x: 140, y: 710, r: 120 },
    { x: 280, y: 530, r: 160 },
    { x: 200, y: 410, r: 140 },
    { x: 310, y: 390, r: 150 },
    { x: 260, y: 280, r: 135 },
    { x: 240, y: 170, r: 110 },
    { x: 290, y: 180, r: 95 },
    { x: 256, y: 100, r: 75 },
  ];

  // 1. Ambient underbelly and soft cloud shadows
  towerPuffs.forEach(p => {
    const shadowGrad = ctx.createRadialGradient(p.x, p.y + 35, p.r * 0.15, p.x, p.y + 35, p.r);
    shadowGrad.addColorStop(0, 'rgba(190, 212, 240, 0.95)');
    shadowGrad.addColorStop(0.65, 'rgba(165, 190, 225, 0.8)');
    shadowGrad.addColorStop(1, 'rgba(160, 185, 220, 0)');
    ctx.fillStyle = shadowGrad;
    ctx.beginPath();
    ctx.arc(p.x, p.y + 35, p.r, 0, Math.PI * 2);
    ctx.fill();
  });

  // 2. High-key painterly white body & warm sun crests
  towerPuffs.forEach(p => {
    const bodyGrad = ctx.createRadialGradient(p.x - p.r * 0.25, p.y - p.r * 0.3, p.r * 0.05, p.x, p.y, p.r);
    bodyGrad.addColorStop(0, 'rgba(255, 255, 255, 0.99)');
    bodyGrad.addColorStop(0.45, 'rgba(254, 250, 242, 0.94)');
    bodyGrad.addColorStop(0.75, 'rgba(235, 242, 252, 0.7)');
    bodyGrad.addColorStop(1, 'rgba(230, 238, 250, 0)');
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  });

  // 3. Crisp warm sunlight rim on right edge (Ghibli sunlit rim)
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  const sunRim = ctx.createLinearGradient(120, 80, 480, 900);
  sunRim.addColorStop(0, 'rgba(255, 248, 225, 0.55)');
  sunRim.addColorStop(0.4, 'rgba(255, 255, 255, 0.18)');
  sunRim.addColorStop(1, 'rgba(150, 180, 225, 0.35)');
  ctx.fillStyle = sunRim;
  ctx.fillRect(0, 0, 512, 1024);
  ctx.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.generateMipmaps = true;
  return texture;
}

export function createTreeFoliageTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, 256, 256);

  // Painterly Ghibli tree foliage puff
  const clusters = [
    { x: 128, y: 135, r: 90, colorA: '#42884A', colorB: '#296332' },
    { x: 95,  y: 110, r: 70, colorA: '#58A65C', colorB: '#357C3C' },
    { x: 160, y: 115, r: 75, colorA: '#68B66C', colorB: '#3A8242' },
    { x: 128, y: 80,  r: 65, colorA: '#82CA7D', colorB: '#4A984E' },
  ];

  clusters.forEach(c => {
    const grad = ctx.createRadialGradient(c.x - c.r * 0.3, c.y - c.r * 0.35, c.r * 0.1, c.x, c.y, c.r);
    grad.addColorStop(0, c.colorA);
    grad.addColorStop(0.7, c.colorB);
    grad.addColorStop(1, 'rgba(30, 70, 35, 0.9)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
    ctx.fill();
  });

  // Painterly dappled sunlight leaf dabs
  for (let i = 0; i < 40; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * 80;
    const x = 128 + Math.cos(angle) * dist;
    const y = 115 + Math.sin(angle) * dist * 0.8;
    const w = 6 + Math.random() * 10;
    const h = 4 + Math.random() * 8;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle + Math.PI / 4);
    ctx.fillStyle = i % 2 === 0 ? 'rgba(165, 235, 155, 0.68)' : 'rgba(247, 214, 165, 0.50)';
    ctx.beginPath();
    ctx.ellipse(0, 0, w, h, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}

export function createDustParticleTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, 64, 64);
  const grad = ctx.createRadialGradient(32, 32, 4, 32, 32, 28);
  grad.addColorStop(0, 'rgba(255, 252, 240, 0.96)');
  grad.addColorStop(0.4, 'rgba(245, 230, 200, 0.72)');
  grad.addColorStop(0.7, 'rgba(220, 210, 190, 0.38)');
  grad.addColorStop(1, 'rgba(200, 200, 190, 0)');

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(32, 32, 28, 0, Math.PI * 2);
  ctx.fill();

  return new THREE.CanvasTexture(canvas);
}

export function createWindPetalTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, 64, 64);
  const grad = ctx.createLinearGradient(16, 16, 48, 48);
  grad.addColorStop(0, 'rgba(255, 225, 235, 0.96)');
  grad.addColorStop(0.6, 'rgba(255, 185, 205, 0.88)');
  grad.addColorStop(1, 'rgba(255, 240, 210, 0.45)');

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(32, 10);
  ctx.bezierCurveTo(46, 18, 52, 36, 32, 54);
  ctx.bezierCurveTo(12, 36, 18, 18, 32, 10);
  ctx.fill();

  return new THREE.CanvasTexture(canvas);
}

export function createPainterlyGroundTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  // Painterly base #8DC99B
  ctx.fillStyle = '#8DC99B';
  ctx.fillRect(0, 0, 256, 256);

  // Brush strokes
  for (let i = 0; i < 90; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const len = 15 + Math.random() * 25;
    const rot = (Math.random() - 0.5) * 0.6;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    const alpha = 0.08 + Math.random() * 0.12;
    ctx.fillStyle = i % 2 === 0 ? `rgba(111, 176, 126, ${alpha})` : `rgba(157, 235, 156, ${alpha})`;
    ctx.fillRect(-len / 2, -4, len, 8);
    ctx.restore();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.generateMipmaps = true;
  return texture;
}
