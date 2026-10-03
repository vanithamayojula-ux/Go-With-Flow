import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// 1. Scene Setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x12151c);

// 2. Camera Setup
const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.01,
  1000
);
camera.position.set(0, 1.5, 3);

// 3. WebGL Renderer Setup
const container = document.getElementById('canvas-container');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;
container.appendChild(renderer.domElement);

// 4. OrbitControls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;

// 5. Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 1.8);
scene.add(ambientLight);

const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
keyLight.position.set(5, 10, 7.5);
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0xffffff, 1.0);
fillLight.position.set(-5, 5, -5);
scene.add(fillLight);

// Ground grid for reference
const gridHelper = new THREE.GridHelper(10, 20, 0x00d2e0, 0x223344);
scene.add(gridHelper);

// 6. GLTF/GLB Loader with Auto-Framing & Error Handling
const loader = new GLTFLoader();
const statusOverlay = document.getElementById('status-overlay');

loader.load(
  '/model.glb',
  (gltf) => {
    const model = gltf.scene;

    // Calculate bounding box to auto-center and adjust camera
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    // Center model at world origin and set base on grid
    model.position.x -= center.x;
    model.position.y -= box.min.y;
    model.position.z -= center.z;

    // Adjust camera distance based on model dimensions
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = camera.fov * (Math.PI / 180);
    let cameraZ = Math.abs((maxDim / 2) / Math.tan(fov / 2)) * 1.6;
    cameraZ = Math.max(cameraZ, 2.0);

    camera.position.set(0, maxDim * 0.7, cameraZ);
    camera.lookAt(0, maxDim * 0.35, 0);
    controls.target.set(0, maxDim * 0.35, 0);
    controls.update();

    scene.add(model);

    if (statusOverlay) {
      statusOverlay.textContent = 'Model loaded (Left-click: Rotate • Right-click: Pan • Scroll: Zoom)';
      setTimeout(() => {
        statusOverlay.style.opacity = '0';
      }, 4000);
    }
  },
  (progressEvent) => {
    if (statusOverlay && progressEvent.total > 0) {
      const percent = Math.round((progressEvent.loaded / progressEvent.total) * 100);
      statusOverlay.textContent = `Loading /model.glb: ${percent}%`;
    }
  },
  (error) => {
    console.error('Error loading /model.glb:', error);
    if (statusOverlay) {
      statusOverlay.classList.add('error');
      statusOverlay.innerHTML = `
        <strong>Error loading 3D model:</strong><br />
        Could not load <code>/model.glb</code>.<br />
        Please place your 3D model inside <code>public/model.glb</code>.
      `;
    }
  }
);

// 7. Responsive Window Resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

// 8. Animation Loop
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();
