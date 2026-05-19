import * as THREE from 'three';
import './style.css';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js';
import { GraphEngine } from './GraphEngine.js';
import { VRInterface } from './VRInterface.js';
import { InteractionHandler } from './InteractionHandler.js';

// Global variables
let scene, camera, renderer, controls;
let graphEngine, vrInterface, interactionHandler;

// Simulation parameters (sync'd with DOM sliders)
let gravity = 0.04;
let springStrength = 0.025;

const container = document.getElementById('canvas-container');

function init() {
  // 1. Create Scene & Dark Sci-Fi Background
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x08090f);
  scene.fog = new THREE.FogExp2(0x08090f, 0.12);

  // 2. Setup Camera
  // Placed at Y=1.7 (standard standing height), looking down-Z at the graph center
  camera = new THREE.PerspectiveCamera(70, container.clientWidth / container.clientHeight, 0.05, 100);
  camera.position.set(0, 2.0, 1.2);

  // 3. Setup WebGL Renderer with WebXR support enabled
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.xr.enabled = true; // CRITICAL: Enables WebXR immersive rendering
  container.appendChild(renderer.domElement);

  // 4. Setup OrbitControls (desktop only navigation)
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  // Rotate around center of the graph
  controls.target.set(0, 1.5, -1.5);
  controls.update();

  // 5. Add Lighting (Sci-fi themed colored lighting)
  const ambientLight = new THREE.AmbientLight(0x0c0f2b, 2.5);
  scene.add(ambientLight);

  const mainLight = new THREE.DirectionalLight(0x00f0ff, 1.5);
  mainLight.position.set(2, 5, 2);
  scene.add(mainLight);

  const fillLight = new THREE.DirectionalLight(0xd600ff, 0.8);
  fillLight.position.set(-3, 3, -1);
  scene.add(fillLight);

  // 6. Add Sci-Fi Grid Floor at Y = 0 (to ground the VR user)
  const gridHelper = new THREE.GridHelper(30, 30, 0x00f0ff, 0x1f293d);
  gridHelper.position.set(0, 0, 0);
  // Grid material transparent glow
  gridHelper.material.opacity = 0.15;
  gridHelper.material.transparent = true;
  scene.add(gridHelper);

  // 7. Initialize Application Modules
  graphEngine = new GraphEngine(scene);
  vrInterface = new VRInterface(scene, graphEngine);
  interactionHandler = new InteractionHandler(scene, renderer, camera, controls, graphEngine, vrInterface);

  // Generate Initial Graph
  graphEngine.generateRandomGraph(25, 40);
  interactionHandler.updateStatsDisplay();

  // 8. Attach WebXR VR Button
  const vrButton = VRButton.createButton(renderer);
  document.getElementById('vr-btn-container').appendChild(vrButton);

  // 9. Bind Desktop DOM Controls
  setupDOMControls();

  // 10. Handle window resize
  window.addEventListener('resize', onWindowResize);
  onWindowResize();
}

function setupDOMControls() {
  const gravitySlider = document.getElementById('gravity-slider');
  const gravityVal = document.getElementById('gravity-val');
  const springSlider = document.getElementById('spring-slider');
  const springVal = document.getElementById('spring-val');
  const physicsToggle = document.getElementById('layout-physics-toggle');

  gravitySlider.addEventListener('input', (e) => {
    gravity = parseFloat(e.target.value);
    gravityVal.textContent = gravity.toFixed(2);
  });

  springSlider.addEventListener('input', (e) => {
    springStrength = parseFloat(e.target.value);
    springVal.textContent = springStrength.toFixed(3);
  });

  physicsToggle.addEventListener('change', (e) => {
    vrInterface.physicsEnabled = e.target.checked;
    vrInterface.updatePhysicsButton();
  });

  document.getElementById('btn-reset-layout').addEventListener('click', () => {
    graphEngine.resetLayout();
  });

  document.getElementById('btn-random-graph').addEventListener('click', () => {
    graphEngine.generateRandomGraph(25, 40);
    vrInterface.hideDetailsCard();
    interactionHandler.clearDesktopInspector();
    interactionHandler.updateStatsDisplay();
  });

  // Sync DOM elements to match vrInterface updates inside VR
  // E.g., if VR console changes physics state, update desktop checkbox
  setInterval(() => {
    if (physicsToggle.checked !== vrInterface.physicsEnabled) {
      physicsToggle.checked = vrInterface.physicsEnabled;
    }
  }, 200);
}

function onWindowResize() {
  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight);
}

// Main Animation Rendering Loop (handles desktop & VR WebXR headset ticks)
function animate() {
  renderer.setAnimationLoop(tick);
}

function tick() {
  // 1. Solve force simulation physics if enabled
  if (vrInterface.physicsEnabled) {
    graphEngine.updatePhysics(gravity, springStrength);
  }

  // 2. Perform actions depending on WebXR VR active state
  if (renderer.xr.isPresenting) {
    // VR Mode active: update laser pointers and billboarding cards
    interactionHandler.updateVRInteractions();
    
    // In VR, retrieve headset camera position directly
    const vrCamera = renderer.xr.getCamera(camera);
    vrInterface.update(vrCamera.position, graphEngine.selectedObject);
  } else {
    // Desktop Mode: update normal OrbitControls damping
    controls.update();
    vrInterface.update(camera.position, graphEngine.selectedObject);
  }

  // 3. Render frame
  renderer.render(scene, camera);
}

// Start
init();
animate();
