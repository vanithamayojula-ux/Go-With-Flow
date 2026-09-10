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

  // 2. Hand-painted soft organic light-and-shadow dabs (Soft noise-blended Kazuo Oga meadow)
  for (let i = 0; i < 40; i++) {
    const cx = Math.random() * 512;
    const cy = Math.random() * 512;
    const rx = 60 + Math.random() * 120;
    const ry = 40 + Math.random() * 80;
    const rot = (Math.random() - 0.5) * 1.2;
    const isHighlight = i % 2 === 0;

    const dabGrad = ctx.createRadialGradient(cx, cy, rx * 0.1, cx, cy, rx);
    if (isHighlight) {
      dabGrad.addColorStop(0, 'rgba(140, 220, 70, 0.38)');
      dabGrad.addColorStop(0.7, 'rgba(100, 195, 55, 0.18)');
      dabGrad.addColorStop(1, 'rgba(56, 168, 82, 0.0)');
    } else {
      dabGrad.addColorStop(0, 'rgba(30, 95, 48, 0.42)');
      dabGrad.addColorStop(0.7, 'rgba(42, 115, 56, 0.20)');
      dabGrad.addColorStop(1, 'rgba(56, 168, 82, 0.0)');
    }

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    ctx.fillStyle = dabGrad;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
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
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
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
  grad.addColorStop(0, 'rgba(0, 240, 255, 0.98)');
  grad.addColorStop(0.6, 'rgba(255, 0, 127, 0.90)');
  grad.addColorStop(1, 'rgba(255, 255, 255, 0.95)');

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(32, 8);
  ctx.bezierCurveTo(46, 18, 50, 36, 32, 56);
  ctx.bezierCurveTo(14, 36, 18, 18, 32, 8);
  ctx.fill();

  return new THREE.CanvasTexture(canvas);
}

export const createPetalParticleTexture = createWindPetalTexture;
export const createCyberSparkTexture = createWindPetalTexture;

/**
 * High-definition Procedural Cyberpunk Skyscraper Window Grid Texture
 * Produces crisp illuminated window matrices, horizontal floor slabs, and vertical metallic mullions
 */
export function createCyberBuildingTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;

  // Deep obsidian/navy reflective architectural facade
  ctx.fillStyle = '#060913';
  ctx.fillRect(0, 0, 512, 1024);

  // Vertical structural mullions
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 3;
  const cols = 16;
  const colWidth = 512 / cols;
  for (let c = 0; c <= cols; c++) {
    ctx.beginPath();
    ctx.moveTo(c * colWidth, 0);
    ctx.lineTo(c * colWidth, 1024);
    ctx.stroke();
  }

  // Horizontal floor slab dividers
  const rows = 48;
  const rowHeight = 1024 / rows;
  ctx.strokeStyle = '#0a101d';
  ctx.lineWidth = 4;
  for (let r = 0; r <= rows; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * rowHeight);
    ctx.lineTo(512, r * rowHeight);
    ctx.stroke();
  }

  // Windows grid
  const neonPalettes = [
    '#00f0ff', // Electric Cyan
    '#00f0ff',
    '#ffaa00', // Amber
    '#ff007f', // Hot Pink
    '#e0f7ff', // Crisp Cold White
    '#38bdf8', // Sky Cyan
    '#818cf8', // Indigo
  ];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const isLit = Math.random() < 0.45;
      const wx = c * colWidth + 5;
      const wy = r * rowHeight + 4;
      const ww = colWidth - 10;
      const wh = rowHeight - 8;

      if (isLit) {
        const color = neonPalettes[Math.floor(Math.random() * neonPalettes.length)];
        const intensity = 0.5 + Math.random() * 0.5;
        ctx.fillStyle = color;
        ctx.globalAlpha = intensity;
        ctx.fillRect(wx, wy, ww, wh);

        // Subtle inner glow
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = 0.4;
        ctx.fillRect(wx + 2, wy + 2, ww - 4, 3);
      } else {
        // Dark reflective glass window
        ctx.fillStyle = '#0b1322';
        ctx.globalAlpha = 0.8;
        ctx.fillRect(wx, wy, ww, wh);
      }
    }
  }

  ctx.globalAlpha = 1.0;

  // Occasional full-width holographic neon horizontal data strips
  const stripRows = [12, 25, 38];
  stripRows.forEach((sr, idx) => {
    const stripColor = idx % 2 === 0 ? '#00f0ff' : '#ff007f';
    ctx.fillStyle = stripColor;
    ctx.shadowColor = stripColor;
    ctx.shadowBlur = 8;
    ctx.fillRect(0, sr * rowHeight, 512, 5);
    ctx.shadowBlur = 0;
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 1);
  return texture;
}

/**
 * Holographic High-Tech Neon Billboard Texture
 */
export function createCyberBillboardTexture(
  title: string,
  subtitle: string,
  primaryColor: string,
  secondaryColor: string
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  // Dark cyber plate background
  ctx.fillStyle = '#05070f';
  ctx.fillRect(0, 0, 512, 256);

  // Outer Neon border
  ctx.strokeStyle = primaryColor;
  ctx.lineWidth = 6;
  ctx.shadowColor = primaryColor;
  ctx.shadowBlur = 12;
  ctx.strokeRect(8, 8, 496, 240);

  // Corner brackets
  ctx.strokeStyle = secondaryColor;
  ctx.lineWidth = 10;
  const bracketLen = 30;
  // Top-left
  ctx.beginPath();
  ctx.moveTo(8, 8 + bracketLen);
  ctx.lineTo(8, 8);
  ctx.lineTo(8 + bracketLen, 8);
  ctx.stroke();
  // Bottom-right
  ctx.beginPath();
  ctx.moveTo(504, 248 - bracketLen);
  ctx.lineTo(504, 248);
  ctx.lineTo(504 - bracketLen, 248);
  ctx.stroke();

  // Subtle digital scanlines
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
  for (let y = 0; y < 256; y += 4) {
    ctx.fillRect(8, y, 496, 2);
  }

  // Japanese / Cyber Accent Tag
  ctx.fillStyle = secondaryColor;
  ctx.font = 'bold 18px "Courier New", monospace';
  ctx.fillText('► ' + subtitle + ' ◄', 28, 48);

  // Main Billboard Neon Typography
  ctx.fillStyle = primaryColor;
  ctx.shadowColor = primaryColor;
  ctx.shadowBlur = 16;
  ctx.font = '900 52px "Arial Black", Impact, sans-serif';
  ctx.fillText(title, 28, 128);

  // High-tech status bar & pulse meter
  ctx.shadowBlur = 0;
  ctx.fillStyle = secondaryColor;
  ctx.fillRect(28, 160, 456, 8);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 14px monospace';
  ctx.fillText('SYSTEM OK // FREQ: 98.4GHz // NEURAL LINK STABLE', 28, 200);

  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}

/**
 * Metal-Grid Surface with Glowing Emissive Seam Lines (Cyberpunk Ground Material)
 */
export function createCyberGridTexture(primaryColor = '#00f0ff', secondaryColor = '#ff007f'): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Dark brushed metal/asphalt plate
  ctx.fillStyle = '#060810';
  ctx.fillRect(0, 0, 512, 512);

  // Micro-texture noise for metal roughness
  ctx.fillStyle = '#0a0f1d';
  for (let i = 0; i < 400; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    ctx.fillRect(x, y, 2, 2);
  }

  // Major glowing circuit seam grid
  const cellSize = 64;
  ctx.strokeStyle = primaryColor;
  ctx.lineWidth = 3;
  ctx.shadowColor = primaryColor;
  ctx.shadowBlur = 8;

  for (let x = 0; x <= 512; x += cellSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 512);
    ctx.stroke();
  }

  for (let y = 0; y <= 512; y += cellSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(512, y);
    ctx.stroke();
  }

  // High-intensity cross nodes
  ctx.shadowBlur = 12;
  ctx.fillStyle = '#ffffff';
  for (let x = 0; x <= 512; x += cellSize) {
    for (let y = 0; y <= 512; y += cellSize) {
      ctx.fillRect(x - 2, y - 2, 4, 4);
    }
  }

  // Secondary diagonal data traces
  ctx.shadowBlur = 0;
  ctx.strokeStyle = secondaryColor;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.45;
  for (let i = 0; i < 8; i++) {
    ctx.beginPath();
    const sx = (i * 64) % 512;
    ctx.moveTo(sx, 0);
    ctx.lineTo(sx + 128, 512);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 16);
  return texture;
}

/**
 * High-Intensity Emissive Strip Texture
 */
export function createEmissiveStripTexture(glowColor = '#00f0ff'): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#05070d';
  ctx.fillRect(0, 0, 128, 512);

  // Intense glowing center laser stripe with white core
  const grad = ctx.createLinearGradient(0, 0, 128, 0);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(0.35, glowColor);
  grad.addColorStop(0.5, '#ffffff');
  grad.addColorStop(0.65, glowColor);
  grad.addColorStop(1, 'rgba(0,0,0,0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 512);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

export function createCyberSkaterSpriteTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, 256, 256);
  const cx = 128;

  // 1. Neon Cyan Underglow (Soft radial glow under board)
  const glowGrad = ctx.createRadialGradient(cx, 215, 10, cx, 215, 80);
  glowGrad.addColorStop(0, 'rgba(0, 240, 255, 0.85)');
  glowGrad.addColorStop(0.5, 'rgba(0, 240, 255, 0.35)');
  glowGrad.addColorStop(1, 'rgba(0, 240, 255, 0.0)');
  ctx.fillStyle = glowGrad;
  ctx.beginPath();
  ctx.ellipse(cx, 215, 80, 25, 0, 0, Math.PI * 2);
  ctx.fill();

  // 2. Hover Skateboard Deck (Dark composite body + cyan neon edge)
  ctx.fillStyle = '#0e1622';
  ctx.strokeStyle = '#00f0ff';
  ctx.lineWidth = 4;
  ctx.shadowColor = '#00f0ff';
  ctx.shadowBlur = 12;

  ctx.beginPath();
  ctx.ellipse(cx, 195, 75, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // 4 Bottom Hover Thruster Rings (Glowing cyan rings matching reference image)
  ctx.shadowBlur = 15;
  ctx.fillStyle = '#00f0ff';
  [-50, -20, 20, 50].forEach(ox => {
    ctx.beginPath();
    ctx.arc(cx + ox, 202, 7, 0, Math.PI * 2);
    ctx.fill();
  });

  // Top Deck Central Glowing Cyan Triangle Emblem
  ctx.fillStyle = '#00f0ff';
  ctx.beginPath();
  ctx.moveTo(cx, 189);
  ctx.lineTo(cx - 10, 198);
  ctx.lineTo(cx + 10, 198);
  ctx.closePath();
  ctx.fill();

  // 3. Cyber Skater Rider Body & Legs
  ctx.shadowBlur = 0;

  // Sneakers (Black high-tops with glowing cyan soles)
  ctx.fillStyle = '#00f0ff';
  ctx.shadowColor = '#00f0ff';
  ctx.shadowBlur = 8;
  ctx.fillRect(cx - 52, 187, 24, 7);
  ctx.fillRect(cx + 28, 187, 24, 7);

  ctx.fillStyle = '#121824';
  ctx.shadowBlur = 0;
  ctx.fillRect(cx - 50, 175, 20, 13);
  ctx.fillRect(cx + 30, 175, 20, 13);

  // Cargo Pants (Dark navy/black pants)
  ctx.fillStyle = '#0a0d14';
  ctx.beginPath();
  ctx.moveTo(cx - 42, 175);
  ctx.lineTo(cx - 20, 120);
  ctx.lineTo(cx + 20, 120);
  ctx.lineTo(cx + 42, 175);
  ctx.lineTo(cx + 26, 175);
  ctx.lineTo(cx, 135);
  ctx.lineTo(cx - 26, 175);
  ctx.closePath();
  ctx.fill();

  // Black Hoodie Jacket & Torso
  ctx.fillStyle = '#0e1420';
  ctx.beginPath();
  ctx.roundRect(cx - 28, 65, 56, 60, 10);
  ctx.fill();

  // Glowing Neon Cyan Back/Chest Emblem
  ctx.shadowColor = '#00f0ff';
  ctx.shadowBlur = 10;
  ctx.fillStyle = '#00f0ff';
  ctx.beginPath();
  ctx.moveTo(cx, 75);
  ctx.lineTo(cx - 14, 95);
  ctx.lineTo(cx + 14, 95);
  ctx.closePath();
  ctx.fill();

  // Cyan Piping along Collar & Zipper
  ctx.strokeStyle = '#00f0ff';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx, 65);
  ctx.lineTo(cx, 125);
  ctx.stroke();

  // Arms & Glowing Wrist Cuffs
  ctx.fillStyle = '#0e1420';
  ctx.shadowBlur = 0;
  ctx.beginPath();
  ctx.arc(cx - 36, 85, 12, 0, Math.PI * 2);
  ctx.arc(cx + 36, 85, 12, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#00f0ff';
  ctx.shadowColor = '#00f0ff';
  ctx.shadowBlur = 8;
  ctx.fillRect(cx - 44, 94, 16, 5);
  ctx.fillRect(cx + 28, 94, 16, 5);

  // Head, Spiky Hair & Black Mask
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#d5aa82'; // Skin
  ctx.beginPath();
  ctx.arc(cx, 48, 18, 0, Math.PI * 2);
  ctx.fill();

  // Black Face Mask
  ctx.fillStyle = '#06080e';
  ctx.beginPath();
  ctx.arc(cx, 52, 17, 0, Math.PI);
  ctx.fill();

  // Glowing Cyan Visor Line
  ctx.fillStyle = '#00f0ff';
  ctx.shadowColor = '#00f0ff';
  ctx.shadowBlur = 10;
  ctx.fillRect(cx - 14, 40, 28, 4);

  // Dark Spiky Anime Hair
  ctx.fillStyle = '#121722';
  ctx.shadowBlur = 0;
  for (let i = -4; i <= 4; i++) {
    ctx.beginPath();
    ctx.moveTo(cx + i * 7, 36);
    ctx.lineTo(cx + i * 9 - 4, 18 + Math.abs(i) * 3);
    ctx.lineTo(cx + i * 7 + 6, 36);
    ctx.closePath();
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}



