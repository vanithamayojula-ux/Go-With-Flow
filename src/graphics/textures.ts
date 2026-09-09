import * as THREE from 'three';

/**
 * Exact Studio Ghibli Painterly Texture Generators
 * Recreates the iconic hand-painted backgrounds of Kazuo Oga & Studio Ghibli:
 * - Layered terraced hill contours & vibrant flower carpets (Image 1 & Image 2 Left)
 * - Thick impasto gouache cumulus storm clouds (Image 2 Right)
 * - Dappled forest light & dirt paths (Image 2 Center)
 */

export function createPainterlyGroundTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // 1. Base vibrant Ghibli emerald green (#38A852)
  ctx.fillStyle = '#38A852';
  ctx.fillRect(0, 0, 512, 512);

  // 2. Hand-painted sloped hill contour bands (kazuo oga style terraced hill stripes)
  for (let y = 0; y < 512; y += 16) {
    const bandColor = y % 32 === 0 ? 'rgba(118, 215, 60, 0.35)' : 'rgba(38, 115, 59, 0.30)';
    ctx.fillStyle = bandColor;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(128, y + Math.sin(y * 0.05) * 20, 384, y - Math.sin(y * 0.05) * 20, 512, y);
    ctx.lineTo(512, y + 16);
    ctx.lineTo(0, y + 16);
    ctx.closePath();
    ctx.fill();
  }

  // 3. Painterly grass dabs (600+ multi-toned brushstrokes)
  const strokeColors = [
    'rgba(38, 115, 59, 0.50)',   // Shadow forest green
    'rgba(56, 142, 60, 0.55)',   // Deep emerald
    'rgba(76, 175, 80, 0.60)',   // Vibrant meadow green
    'rgba(118, 215, 60, 0.45)',  // Lime sunlight highlight
    'rgba(165, 214, 167, 0.35)',  // Light leaf tip
    'rgba(244, 241, 134, 0.30)',  // Dappled golden sunlight
  ];

  for (let i = 0; i < 750; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const len = 16 + Math.random() * 28;
    const width = 3.5 + Math.random() * 6.5;
    const rot = -0.3 + (Math.random() - 0.5) * 0.8;
    const color = strokeColors[i % strokeColors.length];

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(0, 0, len / 2, width / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // 4. Center dirt/earth trail (Image 2 Middle panel dirt path)
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  const pathGrad = ctx.createLinearGradient(180, 0, 330, 512);
  pathGrad.addColorStop(0, 'rgba(139, 98, 67, 0.0)');
  pathGrad.addColorStop(0.3, 'rgba(139, 98, 67, 0.55)');
  pathGrad.addColorStop(0.5, 'rgba(120, 80, 50, 0.70)');
  pathGrad.addColorStop(0.7, 'rgba(139, 98, 67, 0.55)');
  pathGrad.addColorStop(1, 'rgba(139, 98, 67, 0.0)');
  ctx.fillStyle = pathGrad;
  ctx.fillRect(180, 0, 150, 512);
  ctx.restore();

  // 5. Hand-painted Ghibli wildflower fields (Pink blossom carpets, yellow buttercups, white daisies)
  for (let f = 0; f < 220; f++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    // Skip center dirt path
    if (x > 210 && x < 300) continue;

    const r = 2.5 + Math.random() * 4.5;
    const type = f % 4;

    ctx.save();
    if (type === 0) {
      // Golden Buttercup / Dandelion
      ctx.fillStyle = '#FFEB3B';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#F57F17';
      ctx.beginPath();
      ctx.arc(x, y, r * 0.4, 0, Math.PI * 2);
      ctx.fill();
    } else if (type === 1) {
      // Crisp White Daisy (Image 1 & 2 Left)
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(x, y, r * 1.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FBC02D';
      ctx.beginPath();
      ctx.arc(x, y, r * 0.42, 0, Math.PI * 2);
      ctx.fill();
    } else if (type === 2) {
      // Pink Flower Carpet (Image 1 top left & page 2 pink field)
      ctx.fillStyle = '#F48FB1';
      ctx.beginPath();
      ctx.arc(x, y, r * 1.0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#C2185B';
      ctx.beginPath();
      ctx.arc(x, y, r * 0.38, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Lavender Bluebell
      ctx.fillStyle = '#B39DDB';
      ctx.beginPath();
      ctx.arc(x, y, r * 0.85, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#512DA8';
      ctx.beginPath();
      ctx.arc(x, y, r * 0.35, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
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
    { startX: 128, startY: 250, cp1X: 120, cp1Y: 140, endX: 95,  endY: 25, w: 24, colorA: '#2E7D32', colorB: '#66BB6A' },
    { startX: 128, startY: 250, cp1X: 138, cp1Y: 130, endX: 160, endY: 20, w: 22, colorA: '#388E3C', colorB: '#81C784' },
    { startX: 110, startY: 250, cp1X: 85,  cp1Y: 155, endX: 55,  endY: 75, w: 20, colorA: '#1B5E20', colorB: '#4CAF50' },
    { startX: 145, startY: 250, cp1X: 172, cp1Y: 145, endX: 205, endY: 65, w: 20, colorA: '#2E7D32', colorB: '#66BB6A' },
    { startX: 128, startY: 250, cp1X: 126, cp1Y: 105, endX: 128, endY: 10, w: 26, colorA: '#43A047', colorB: '#A5D6A7' },
    { startX: 95,  startY: 250, cp1X: 55,  cp1Y: 175, endX: 30,  endY: 125, w: 16, colorA: '#1B5E20', colorB: '#43A047' },
    { startX: 160, startY: 250, cp1X: 200, cp1Y: 175, endX: 230, endY: 115, w: 16, colorA: '#2E7D32', colorB: '#4CAF50' },
  ];

  blades.forEach(b => {
    ctx.save();
    const grad = ctx.createLinearGradient(b.startX, b.startY, b.endX, b.endY);
    grad.addColorStop(0, b.colorA);
    grad.addColorStop(0.6, b.colorB);
    grad.addColorStop(1, '#DCEDC8');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(b.startX - b.w * 0.5, b.startY);
    ctx.quadraticCurveTo(b.cp1X - b.w * 0.25, b.cp1Y, b.endX, b.endY);
    ctx.quadraticCurveTo(b.cp1X + b.w * 0.25, b.cp1Y, b.startX + b.w * 0.5, b.startY);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.moveTo(b.startX, b.startY - 15);
    ctx.quadraticCurveTo(b.cp1X, b.cp1Y, b.endX, b.endY + 12);
    ctx.stroke();
    ctx.restore();
  });

  const flowers = [
    { x: 90,  y: 65, r: 9, color: '#FFEB3B' },
    { x: 165, y: 55, r: 10, color: '#FFFFFF' },
    { x: 128, y: 35, r: 8, color: '#FFEB3B' },
    { x: 45,  y: 105, r: 9, color: '#F48FB1' },
    { x: 215, y: 95, r: 8, color: '#FFF59D' },
    { x: 120, y: 80, r: 7, color: '#FFFFFF' },
  ];
  flowers.forEach(f => {
    ctx.fillStyle = f.color;
    ctx.beginPath();
    ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#F57F17';
    ctx.beginPath();
    ctx.arc(f.x, f.y, f.r * 0.38, 0, Math.PI * 2);
    ctx.fill();
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

export function createPainterlyCloudTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, 512, 512);

  // Soft billowy clusters with Kazuo Oga periwinkle shadow underbelly & brilliant crests
  const puffs = [
    { x: 256, y: 270, r: 155 },
    { x: 185, y: 290, r: 115 },
    { x: 325, y: 280, r: 125 },
    { x: 240, y: 195, r: 105 },
    { x: 145, y: 315, r: 85 },
    { x: 375, y: 305, r: 95 },
    { x: 295, y: 205, r: 90 },
    { x: 205, y: 225, r: 80 },
  ];

  // 1. Deep periwinkle / violet underbelly shadow (#5C78B5)
  puffs.forEach(p => {
    const shadowGrad = ctx.createRadialGradient(p.x, p.y + 32, p.r * 0.15, p.x, p.y + 32, p.r);
    shadowGrad.addColorStop(0, 'rgba(92, 120, 181, 0.96)');
    shadowGrad.addColorStop(0.60, 'rgba(80, 105, 165, 0.82)');
    shadowGrad.addColorStop(1, 'rgba(75, 95, 155, 0)');
    ctx.fillStyle = shadowGrad;
    ctx.beginPath();
    ctx.arc(p.x, p.y + 32, p.r, 0, Math.PI * 2);
    ctx.fill();
  });

  // 2. High-key brilliant white body & warm cream midtones (#FFF6E5)
  puffs.forEach(p => {
    const bodyGrad = ctx.createRadialGradient(p.x - p.r * 0.22, p.y - p.r * 0.28, p.r * 0.05, p.x, p.y, p.r);
    bodyGrad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
    bodyGrad.addColorStop(0.48, 'rgba(255, 246, 229, 0.96)');
    bodyGrad.addColorStop(0.78, 'rgba(235, 242, 252, 0.75)');
    bodyGrad.addColorStop(1, 'rgba(230, 238, 250, 0)');
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  });

  // 3. Warm golden sunlight rim on top edge (#FFE082)
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  const rimGrad = ctx.createLinearGradient(80, 80, 420, 420);
  rimGrad.addColorStop(0, 'rgba(255, 224, 130, 0.75)');
  rimGrad.addColorStop(0.45, 'rgba(255, 255, 255, 0.18)');
  rimGrad.addColorStop(1, 'rgba(92, 120, 181, 0.40)');
  ctx.fillStyle = rimGrad;
  ctx.fillRect(0, 0, 512, 512);
  ctx.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.generateMipmaps = true;
  return texture;
}

/**
 * Recreates the exact towering, gouache-painted cumulus clouds from Image 2 (Right Panel)
 * 512x1024 vertical impasto storm cloud with brilliant white crests, warm cream midtones,
 * and deep periwinkle shadows.
 */
export function createToweringCumulusTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, 512, 1024);

  // Towering cauliflower puffs reaching vertically (exact match for Image 2 Right Panel)
  const towerPuffs = [
    { x: 256, y: 880, r: 190 },
    { x: 150, y: 850, r: 150 },
    { x: 360, y: 860, r: 160 },
    { x: 220, y: 680, r: 180 },
    { x: 340, y: 690, r: 160 },
    { x: 130, y: 710, r: 130 },
    { x: 270, y: 530, r: 170 },
    { x: 190, y: 410, r: 150 },
    { x: 320, y: 390, r: 160 },
    { x: 250, y: 280, r: 145 },
    { x: 230, y: 170, r: 120 },
    { x: 290, y: 180, r: 105 },
    { x: 256, y: 100, r: 85 },
  ];

  // 1. Deep periwinkle underbelly shadow (#5C78B5)
  towerPuffs.forEach(p => {
    const shadowGrad = ctx.createRadialGradient(p.x, p.y + 35, p.r * 0.15, p.x, p.y + 35, p.r);
    shadowGrad.addColorStop(0, 'rgba(92, 120, 181, 0.98)');
    shadowGrad.addColorStop(0.65, 'rgba(75, 95, 155, 0.85)');
    shadowGrad.addColorStop(1, 'rgba(70, 90, 145, 0)');
    ctx.fillStyle = shadowGrad;
    ctx.beginPath();
    ctx.arc(p.x, p.y + 35, p.r, 0, Math.PI * 2);
    ctx.fill();
  });

  // 2. High-key painterly white body & warm cream crests (#FFF6E5)
  towerPuffs.forEach(p => {
    const bodyGrad = ctx.createRadialGradient(p.x - p.r * 0.25, p.y - p.r * 0.3, p.r * 0.05, p.x, p.y, p.r);
    bodyGrad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
    bodyGrad.addColorStop(0.45, 'rgba(255, 246, 229, 0.96)');
    bodyGrad.addColorStop(0.75, 'rgba(235, 242, 252, 0.75)');
    bodyGrad.addColorStop(1, 'rgba(230, 238, 250, 0)');
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  });

  // 3. Crisp warm sunlight rim on right edge (Ghibli sunlit impasto rim)
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  const sunRim = ctx.createLinearGradient(120, 80, 480, 900);
  sunRim.addColorStop(0, 'rgba(255, 236, 179, 0.70)');
  sunRim.addColorStop(0.4, 'rgba(255, 255, 255, 0.22)');
  sunRim.addColorStop(1, 'rgba(92, 120, 181, 0.45)');
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
    { x: 128, y: 135, r: 90, colorA: '#4CAF50', colorB: '#1B5E20' },
    { x: 95,  y: 110, r: 70, colorA: '#66BB6A', colorB: '#2E7D32' },
    { x: 160, y: 115, r: 75, colorA: '#81C784', colorB: '#388E3C' },
    { x: 128, y: 80,  r: 65, colorA: '#A5D6A7', colorB: '#43A047' },
  ];

  clusters.forEach(c => {
    const grad = ctx.createRadialGradient(c.x - c.r * 0.3, c.y - c.r * 0.35, c.r * 0.1, c.x, c.y, c.r);
    grad.addColorStop(0, c.colorA);
    grad.addColorStop(0.7, c.colorB);
    grad.addColorStop(1, 'rgba(20, 60, 25, 0.95)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
    ctx.fill();
  });

  // Dappled golden sunlight leaf dabs
  for (let i = 0; i < 50; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * 85;
    const x = 128 + Math.cos(angle) * dist;
    const y = 115 + Math.sin(angle) * dist * 0.8;
    const w = 7 + Math.random() * 11;
    const h = 5 + Math.random() * 9;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle + Math.PI / 4);
    ctx.fillStyle = i % 2 === 0 ? 'rgba(197, 225, 165, 0.75)' : 'rgba(255, 241, 118, 0.60)';
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
  grad.addColorStop(0, 'rgba(255, 253, 231, 0.98)');
  grad.addColorStop(0.4, 'rgba(255, 236, 179, 0.75)');
  grad.addColorStop(0.7, 'rgba(220, 210, 190, 0.40)');
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
  grad.addColorStop(0, 'rgba(255, 205, 220, 0.98)');
  grad.addColorStop(0.6, 'rgba(244, 143, 177, 0.90)');
  grad.addColorStop(1, 'rgba(255, 240, 210, 0.50)');

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(32, 10);
  ctx.bezierCurveTo(46, 18, 52, 36, 32, 54);
  ctx.bezierCurveTo(12, 36, 18, 18, 32, 10);
  ctx.fill();

  return new THREE.CanvasTexture(canvas);
}
