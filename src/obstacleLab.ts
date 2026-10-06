import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

async function initObstacleLab() {
  const container = document.getElementById('canvas-container') || document.body;
  const statusEl = document.getElementById('status');
  const width = window.innerWidth || 1200;
  const height = window.innerHeight || 800;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0e131d);

  const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
  camera.position.set(0, 2.5, 7.5);
  camera.lookAt(0, 1.1, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.3;
  container.appendChild(renderer.domElement);

  // Lighting
  const ambient = new THREE.AmbientLight(0xddeeff, 0.7);
  scene.add(ambient);

  const dirLight = new THREE.DirectionalLight(0xffffff, 2.8);
  dirLight.position.set(0, 8, 8);
  scene.add(dirLight);

  const rimLight = new THREE.DirectionalLight(0xff0055, 2.2);
  rimLight.position.set(-6, 3, -4);
  scene.add(rimLight);

  const cyanFill = new THREE.DirectionalLight(0x00d2e0, 1.8);
  cyanFill.position.set(6, 2, 4);
  scene.add(cyanFill);

  // Ground grid
  const grid = new THREE.GridHelper(16, 16, 0x00d2e0, 0x1f293d);
  scene.add(grid);

  // Obstacle models to load with yaw offsets to face oncoming players (towards -Z / camera)
  const obstacleFiles = [
    { name: 'obstacle01', url: '/obstacle01.glb', x: -4.5, yaw: -Math.PI / 2 },
    { name: 'obstacle02', url: '/0bstacle02.glb', x: -1.5, yaw: -Math.PI / 2 },
    { name: 'obstacle03', url: '/obstacle03.glb', x: 1.5, yaw: -Math.PI / 2 },
    { name: 'obstacle04', url: '/obstacle04.glb', x: 4.5, yaw: -Math.PI / 2 },
  ];

  const loader = new GLTFLoader();

  const loadedModels: { root: THREE.Group; name: string }[] = [];

  for (const item of obstacleFiles) {
    try {
      const gltf = await loader.loadAsync(item.url);
      const root = new THREE.Group();
      root.position.set(item.x, 0, 0);

      const rawScene = gltf.scene;

      // Compute raw bounds
      const rawBox = new THREE.Box3().setFromObject(rawScene);
      const rawSize = rawBox.getSize(new THREE.Vector3());
      const rawCenter = rawBox.getCenter(new THREE.Vector3());

      // Target height ~ 2.2m for lane obstacle
      const targetHeight = 2.2;
      const scale = targetHeight / Math.max(rawSize.y, 0.001);
      rawScene.scale.set(scale, scale, scale);

      // Centering pivot
      const pivot = new THREE.Group();
      rawScene.position.set(
        -rawCenter.x * scale,
        -rawBox.min.y * scale,
        -rawCenter.z * scale
      );
      pivot.add(rawScene);
      pivot.rotation.y = item.yaw;

      // Test clone to verify clone(true) works flawlessly
      const clonedPivot = pivot.clone(true);
      root.add(clonedPivot);

      // Add a lane boundary wireframe box to visualize fit in 2.6m wide lane
      const wireGeom = new THREE.BoxGeometry(2.45, 2.2, 1.2);
      const wireMat = new THREE.MeshBasicMaterial({ color: 0x00d2e0, wireframe: true, transparent: true, opacity: 0.35 });
      const wireMesh = new THREE.Mesh(wireGeom, wireMat);
      wireMesh.position.set(0, 1.1, 0);
      root.add(wireMesh);

      scene.add(root);
      loadedModels.push({ root, name: item.name });

      console.log(`Loaded ${item.name}: rawSize=(${rawSize.x.toFixed(2)}, ${rawSize.y.toFixed(2)}, ${rawSize.z.toFixed(2)}), scaledW=${(rawSize.x * scale).toFixed(2)}m`);
    } catch (err) {
      console.error(`Error loading ${item.name}:`, err);
    }
  }

  if (statusEl) {
    statusEl.innerHTML = `Loaded ${loadedModels.length} obstacle models! (Static Front View at Rotation Y = 0)<br><span style="color:#aaa">Wireframe shows 2.45m &times; 2.2m standard lane clearance box</span>`;
  }

  function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
  }
  animate();

  (window as any).__obstacleLabReady = true;
}

initObstacleLab();
