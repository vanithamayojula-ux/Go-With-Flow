import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// 1. Scene Setup with Black Background
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

// 2. Camera Setup
const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.01,
  1000
);
camera.position.set(0, 1.5, 3);

// 3. WebGLRenderer Setup
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

// 5. Lighting (Ambient and Directional to ensure model is clearly visible)
const ambientLight = new THREE.AmbientLight(0xffffff, 2.0);
scene.add(ambientLight);

const mainDirectionalLight = new THREE.DirectionalLight(0xffffff, 2.5);
mainDirectionalLight.position.set(5, 10, 7.5);
scene.add(mainDirectionalLight);

const fillDirectionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
fillDirectionalLight.position.set(-5, 5, -5);
scene.add(fillDirectionalLight);

// 6. Model Loading using GLTFLoader from "/model.glb"
const loader = new GLTFLoader();
const statusOverlay = document.getElementById('status-overlay');

loader.load(
  '/model.glb',
  (gltf) => {
    const model = gltf.scene;

    // Calculate bounding box for centering and optimal scale/camera framing
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    // Center model at world origin (0, 0, 0)
    model.position.x -= center.x;
    model.position.y -= center.y;
    model.position.z -= center.z;

    // Adjust camera distance to fit any model scale automatically
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = camera.fov * (Math.PI / 180);
    let cameraZ = Math.abs((maxDim / 2) / Math.tan(fov / 2)) * 1.5;
    cameraZ = Math.max(cameraZ, 2.0);

    camera.position.set(0, maxDim * 0.4, cameraZ);
    camera.lookAt(0, 0, 0);
    controls.target.set(0, 0, 0);
    controls.update();

    // Add model to scene
    scene.add(model);

    if (statusOverlay) {
      statusOverlay.textContent = 'Model loaded successfully (Drag: Rotate • Right-click: Pan • Scroll: Zoom)';
      setTimeout(() => {
        statusOverlay.style.opacity = '0';
      }, 3500);
    }
  },
  (progress) => {
    if (statusOverlay && progress.total > 0) {
      const percent = Math.round((progress.loaded / progress.total) * 100);
      statusOverlay.textContent = `Loading /model.glb: ${percent}%`;
    }
  },
  (error) => {
    // 7. Clear Error Handling
    console.error('Error loading /model.glb:', error);
    if (statusOverlay) {
      statusOverlay.classList.add('error');
      statusOverlay.innerHTML = `
        <strong>Error loading model:</strong><br />
        Failed to load <code>/model.glb</code>.<br />
        Ensure your file is placed at <code>public/model.glb</code> and dev server is running.
      `;
    }
  }
);

// Window Resize Handling
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

// 8. Animation Render Loop
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();
