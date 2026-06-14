import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const canvas = document.querySelector('#three-lab');
const sceneHint = document.querySelector('#scene-hint');
const modeButtons = [...document.querySelectorAll('.scene-mode')];

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x161c22);

const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 1000);
camera.position.set(0, 3.8, 8);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.target.set(0, 0.4, 0);

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2(10, 10);
const timer = new THREE.Timer();
timer.connect(document);
const textureLoader = new THREE.TextureLoader();
const root = new THREE.Group();
scene.add(root);

let currentMode = 'globe';
let hoverables = [];
let hovered = null;
let globe = null;
let clouds = null;
let terrainMaterial = null;

const sharedLights = new THREE.Group();
scene.add(sharedLights);

function setSharedLights(kind = 'space') {
  sharedLights.clear();
  if (kind === 'space') {
    sharedLights.add(new THREE.AmbientLight(0x53606d, 1.5));
    const sun = new THREE.DirectionalLight(0xffffff, 3.2);
    sun.position.set(6, 4, 5);
    sharedLights.add(sun);
    return;
  }

  const hemi = new THREE.HemisphereLight(0xdfeeff, 0x4f5d46, 1.3);
  const sun = new THREE.DirectionalLight(0xffffff, 3.8);
  sun.position.set(8, 10, 7);
  sharedLights.add(hemi, sun);
}

function clearRoot() {
  root.traverse((object) => {
    if (object.geometry) object.geometry.dispose();
    if (object.material) {
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => material.dispose());
    }
  });
  root.clear();
  hoverables = [];
  hovered = null;
  globe = null;
  clouds = null;
  terrainMaterial = null;
}

function colorTexture(path) {
  const texture = textureLoader.load(path);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function latLonToVector3(lat, lon, radius) {
  const phi = (lat * Math.PI) / 180;
  const theta = ((lon - 180) * Math.PI) / 180;
  return new THREE.Vector3(
    -radius * Math.cos(phi) * Math.cos(theta),
    radius * Math.sin(phi),
    radius * Math.cos(phi) * Math.sin(theta),
  );
}

function buildGlobe() {
  clearRoot();
  currentMode = 'globe';
  setSharedLights('space');
  sceneHint.textContent = 'Globe : capitales interactives au survol';

  camera.position.set(0, 3.8, 8);
  controls.target.set(0, 0.2, 0);
  controls.minDistance = 3.2;
  controls.maxDistance = 14;

  const background = colorTexture('/tp1_globe-main/tp1_globe-main/assets/starry_background.jpg');
  scene.background = background;

  const radius = 2.2;
  const geometry = new THREE.SphereGeometry(radius, 80, 80);
  const material = new THREE.MeshPhongMaterial({
    map: colorTexture('/tp1_globe-main/tp1_globe-main/assets/earthmap4k.jpg'),
    normalMap: textureLoader.load('/tp1_globe-main/tp1_globe-main/assets/earth_normalmap_flat4k.jpg'),
    specularMap: textureLoader.load('/tp1_globe-main/tp1_globe-main/assets/earthspec4k.jpg'),
    specular: 0x555555,
    shininess: 45,
  });
  material.normalScale.set(0.9, 0.9);

  globe = new THREE.Mesh(geometry, material);
  root.add(globe);

  const cloudMaterial = new THREE.MeshPhongMaterial({
    map: colorTexture('/tp1_globe-main/tp1_globe-main/assets/fair_clouds_4k.png'),
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
  });
  clouds = new THREE.Mesh(geometry.clone(), cloudMaterial);
  clouds.scale.setScalar(1.012);
  root.add(clouds);

  const capitals = [
    ['Paris', 48.8566, 2.3522],
    ['Tokyo', 35.6762, 139.6503],
    ['Brasilia', -15.7939, -47.8828],
    ['Canberra', -35.2809, 149.13],
    ['Ottawa', 45.4215, -75.6972],
    ['Dakar', 14.7167, -17.4677],
  ];

  capitals.forEach(([name, lat, lon]) => {
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.045, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0xff4d3f }),
    );
    marker.position.copy(latLonToVector3(lat, lon, radius * 1.015));
    marker.userData.name = name;
    globe.add(marker);
    hoverables.push(marker);
  });
}

function buildTerrain() {
  clearRoot();
  currentMode = 'terrain';
  setSharedLights('terrain');
  scene.background = new THREE.Color(0x31414a);
  sceneHint.textContent = 'Terrain : relief par displacement map';

  camera.position.set(0, 4.3, 5.6);
  controls.target.set(0, 0.1, 0);
  controls.minDistance = 2.8;
  controls.maxDistance = 10;

  const ratio = 1665 / 745;
  const geometry = new THREE.PlaneGeometry(ratio * 4.2, 4.2, 220, 96);
  terrainMaterial = new THREE.MeshPhongMaterial({
    color: 0xffffff,
    specular: 0x334444,
    shininess: 24,
  });

  const plane = new THREE.Mesh(geometry, terrainMaterial);
  plane.rotateX(-Math.PI / 2);
  root.add(plane);

  const grid = new THREE.GridHelper(8, 16, 0xffffff, 0x80919c);
  grid.position.y = -0.22;
  grid.material.opacity = 0.32;
  grid.material.transparent = true;
  root.add(grid);

  applyHeightMap('/tp3_terrain_part1-main/tp3_terrain_part1-main/terrains/heightmap_scotland.png', terrainMaterial, 0.55);
}

function buildRaycastLab() {
  clearRoot();
  currentMode = 'raycast';
  setSharedLights('terrain');
  scene.background = new THREE.Color(0x20272f);
  sceneHint.textContent = 'Raycast : passe la souris sur les objets';

  camera.position.set(0, 3.2, 7);
  controls.target.set(0, 0.6, 0);
  controls.minDistance = 4;
  controls.maxDistance = 12;

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(8, 5, 1, 1),
    new THREE.MeshPhongMaterial({ color: 0xd9ded7, side: THREE.DoubleSide }),
  );
  floor.rotateX(-Math.PI / 2);
  floor.position.y = -0.02;
  root.add(floor);

  const objects = [
    [new THREE.BoxGeometry(0.9, 0.9, 0.9), -1.8, 0.45, 0, 0x2457a6, 'box.geometry'],
    [new THREE.SphereGeometry(0.55, 32, 24), 0, 0.55, -0.2, 0x087a73, 'sphere.material'],
    [new THREE.ConeGeometry(0.55, 1.15, 32), 1.8, 0.58, 0.1, 0xbd7900, 'cone.mesh'],
  ];

  objects.forEach(([geometry, x, y, z, color, name]) => {
    const mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshPhongMaterial({ color, shininess: 45, specular: 0x222222 }),
    );
    mesh.position.set(x, y, z);
    mesh.userData.name = name;
    root.add(mesh);
    hoverables.push(mesh);
  });
}

function applyHeightMap(path, material, scale) {
  const image = new Image();
  image.crossOrigin = 'anonymous';
  image.src = path;
  image.onload = () => {
    const canvasHeight = document.createElement('canvas');
    canvasHeight.width = image.width;
    canvasHeight.height = image.height;
    let context = canvasHeight.getContext('2d');
    context.drawImage(image, 0, 0);

    const heightData = context.getImageData(0, 0, image.width, image.height);
    const displacementMap = new THREE.CanvasTexture(canvasHeight);
    material.displacementMap = displacementMap;
    material.displacementScale = scale;

    const normalCanvas = document.createElement('canvas');
    normalCanvas.width = image.width;
    normalCanvas.height = image.height;
    context = normalCanvas.getContext('2d');
    const normalData = context.createImageData(image.width, image.height);
    computeNormalMap(heightData, normalData);
    context.putImageData(normalData, 0, 0);
    material.normalMap = new THREE.CanvasTexture(normalCanvas);

    material.map = createColorMap(heightData);
    material.needsUpdate = true;
  };
}

function computeNormalMap(heightData, normalData) {
  const width = heightData.width;
  const height = heightData.height;
  const sample = (row, column) => {
    const y = Math.min(height - 1, Math.max(0, row));
    const x = Math.min(width - 1, Math.max(0, column));
    return heightData.data[(y * width + x) * 4];
  };

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const tl = sample(y - 1, x - 1);
      const t = sample(y - 1, x);
      const tr = sample(y - 1, x + 1);
      const l = sample(y, x - 1);
      const r = sample(y, x + 1);
      const bl = sample(y + 1, x - 1);
      const b = sample(y + 1, x);
      const br = sample(y + 1, x + 1);
      const dx = tr + 2 * r + br - (tl + 2 * l + bl);
      const dy = bl + 2 * b + br - (tl + 2 * t + tr);
      const normal = new THREE.Vector3(-dx, -dy, 24).normalize();
      const index = (y * width + x) * 4;
      normalData.data[index] = 0.5 * (normal.x + 1) * 255;
      normalData.data[index + 1] = 0.5 * (normal.y + 1) * 255;
      normalData.data[index + 2] = 0.5 * (normal.z + 1) * 255;
      normalData.data[index + 3] = 255;
    }
  }
}

function createColorMap(heightData) {
  const gradientCanvas = document.createElement('canvas');
  gradientCanvas.width = 1;
  gradientCanvas.height = 256;
  let context = gradientCanvas.getContext('2d');
  const gradient = context.createLinearGradient(0, 0, 0, 255);
  gradient.addColorStop(0, '#4b72c9');
  gradient.addColorStop(0.025, '#3f9b5b');
  gradient.addColorStop(0.35, '#d7cc70');
  gradient.addColorStop(0.58, '#c0ad8e');
  gradient.addColorStop(0.78, '#dce0e4');
  gradient.addColorStop(1, '#ffffff');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 1, 256);
  const gradientData = context.getImageData(0, 0, 1, 256).data;

  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = heightData.width;
  colorCanvas.height = heightData.height;
  context = colorCanvas.getContext('2d');
  const colorData = context.createImageData(heightData.width, heightData.height);

  for (let index = 0; index < heightData.width * heightData.height; index += 1) {
    const level = heightData.data[index * 4];
    colorData.data[index * 4] = gradientData[level * 4];
    colorData.data[index * 4 + 1] = gradientData[level * 4 + 1];
    colorData.data[index * 4 + 2] = gradientData[level * 4 + 2];
    colorData.data[index * 4 + 3] = 255;
  }

  context.putImageData(colorData, 0, 0);
  const texture = new THREE.CanvasTexture(colorCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function handlePointerMove(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
}

renderer.domElement.addEventListener('pointermove', handlePointerMove);
renderer.domElement.addEventListener('pointerleave', () => {
  pointer.set(10, 10);
});

function updateHover() {
  if (!hoverables.length) return;
  raycaster.setFromCamera(pointer, camera);
  const intersections = raycaster.intersectObjects(hoverables, true);
  const next = intersections.length ? intersections[0].object : null;

  if (hovered && hovered !== next) {
    hovered.scale.setScalar(1);
    if (hovered.material?.emissive) hovered.material.emissive.setHex(0x000000);
    if (hovered.material?.color && hovered.parent === globe) hovered.material.color.setHex(0xff4d3f);
  }

  hovered = next;

  if (hovered) {
    hovered.scale.setScalar(1.35);
    if (hovered.material?.emissive) hovered.material.emissive.setHex(0x552222);
    if (hovered.parent === globe) hovered.material.color.setHex(0x7cff6b);
    sceneHint.textContent =
      currentMode === 'globe'
        ? `Capitale survolée : ${hovered.userData.name}`
        : `Objet intersecté : ${hovered.userData.name}`;
  } else {
    sceneHint.textContent =
      currentMode === 'globe'
        ? 'Globe : capitales interactives au survol'
        : 'Raycast : passe la souris sur les objets';
  }
}

function resizeRenderer() {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const needsResize = canvas.width !== Math.floor(width * renderer.getPixelRatio())
    || canvas.height !== Math.floor(height * renderer.getPixelRatio());

  if (needsResize) {
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
}

function animate() {
  timer.update();
  const delta = timer.getDelta();
  resizeRenderer();
  controls.update();

  if (globe) globe.rotation.y += delta * 0.12;
  if (clouds) clouds.rotation.y += delta * 0.22;
  if (currentMode !== 'terrain') updateHover();

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

modeButtons.forEach((button) => {
  button.addEventListener('click', () => {
    modeButtons.forEach((item) => item.classList.toggle('is-active', item === button));
    const mode = button.dataset.mode;
    if (mode === 'globe') buildGlobe();
    if (mode === 'terrain') buildTerrain();
    if (mode === 'raycast') buildRaycastLab();
  });
});

function setupProgress() {
  const checkboxes = [...document.querySelectorAll('[data-progress]')];
  const progressBar = document.querySelector('#progress-bar');
  const progressLabel = document.querySelector('#progress-label');
  const storageKey = 'visu3d-support-progress';
  const saved = JSON.parse(localStorage.getItem(storageKey) || '[]');

  checkboxes.forEach((checkbox, index) => {
    checkbox.checked = saved[index] === true;
  });

  const update = () => {
    const states = checkboxes.map((checkbox) => checkbox.checked);
    const done = states.filter(Boolean).length;
    const percent = Math.round((done / checkboxes.length) * 100);
    progressBar.style.width = `${percent}%`;
    progressLabel.textContent = `${percent}%`;
    localStorage.setItem(storageKey, JSON.stringify(states));
  };

  checkboxes.forEach((checkbox) => checkbox.addEventListener('change', update));
  update();
}

setupProgress();
buildGlobe();
animate();
