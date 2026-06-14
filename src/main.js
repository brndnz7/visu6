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

function setupTraining() {
  const cards = [...document.querySelectorAll('[data-exercise-card]')];
  const scoreLabel = document.querySelector('#exercise-score-label');
  const resetButton = document.querySelector('#reset-exercises');
  const storageKey = 'visu3d-exercise-state';
  const saved = JSON.parse(localStorage.getItem(storageKey) || '{}');

  const normalize = (value) => value.trim().replace(/\s+/g, '');
  const cardIndex = (card) => String(cards.indexOf(card));

  function saveState() {
    const state = {};
    cards.forEach((card) => {
      state[cardIndex(card)] = card.classList.contains('is-complete');
    });
    localStorage.setItem(storageKey, JSON.stringify(state));
  }

  function updateScore() {
    const done = cards.filter((card) => card.classList.contains('is-complete')).length;
    scoreLabel.textContent = `${done} / ${cards.length} validé${done === 1 ? '' : 's'}`;
  }

  function setFeedback(card, ok, message) {
    const feedback = card.querySelector('.exercise-feedback');
    feedback.textContent = message;
    feedback.classList.toggle('is-good', ok);
    feedback.classList.toggle('is-bad', !ok);
    card.classList.toggle('is-complete', ok);
    saveState();
    updateScore();
  }

  function validateFill(card) {
    const inputs = [...card.querySelectorAll('[data-answer]')];
    const ok = inputs.every((input) => normalize(input.value) === input.dataset.answer);
    setFeedback(
      card,
      ok,
      ok
        ? 'Validé : tu peux recoder le squelette de départ.'
        : 'Pas encore : vérifie la casse et les noms exacts des propriétés Three.js.',
    );
  }

  function validateChoice(card) {
    const group = card.querySelector('[data-choice]');
    const selected = group.querySelector('input:checked');
    const ok = selected?.value === group.dataset.choice;
    setFeedback(
      card,
      ok,
      ok
        ? 'Correct : pense toujours au rectangle du canvas.'
        : 'Presque : la formule robuste part de clientX/clientY moins rect.left/top.',
    );
  }

  function validateMatch(card) {
    const selects = [...card.querySelectorAll('[data-match]')];
    const ok = selects.every((select) => select.value === select.dataset.match);
    setFeedback(
      card,
      ok,
      ok
        ? 'Correct : tu distingues bien couleur, normales, brillance et relief réel.'
        : 'À revoir : displacement déplace les sommets, normalMap change surtout la lumière.',
    );
  }

  function validateMulti(card) {
    const group = card.querySelector('[data-multi-choice]');
    const expected = group.dataset.multiChoice.split(',').sort().join(',');
    const selected = [...group.querySelectorAll('input:checked')]
      .map((input) => input.value)
      .sort()
      .join(',');
    const ok = selected === expected;
    setFeedback(
      card,
      ok,
      ok
        ? 'Diagnostic validé : clipping, lumière et ordre de render sont les bons réflexes.'
        : 'Diagnostic incomplet : cherche les erreurs qui empêchent vraiment le rendu.',
    );
  }

  function validateSelf(card) {
    const note = card.querySelector('[data-self-note]').value.trim();
    const ok = note.length >= 80;
    setFeedback(
      card,
      ok,
      ok
        ? 'Validé : compare ton plan à la grille puis recode-le dans un fichier de test.'
        : 'Écris plus de détails : vise au moins les étapes géométrie, canvas, texture et needsUpdate.',
    );
  }

  function resetSequence(card) {
    card.sequence = [];
    card.querySelectorAll('[data-token]').forEach((button) => {
      button.disabled = false;
    });
    card.querySelector('[data-sequence-answer]').textContent = 'Ordre choisi : aucun';
    const feedback = card.querySelector('.exercise-feedback');
    feedback.textContent = '';
    feedback.classList.remove('is-good', 'is-bad');
    card.classList.remove('is-complete');
    saveState();
    updateScore();
  }

  function selectSequenceToken(card, button) {
    card.sequence = card.sequence || [];
    card.sequence.push(button.dataset.token);
    button.disabled = true;
    card.querySelector('[data-sequence-answer]').textContent = `Ordre choisi : ${card.sequence.join(' > ')}`;

    const expected = card.querySelector('[data-sequence]').dataset.sequence.split(',');
    if (card.sequence.length === expected.length) {
      const ok = card.sequence.join(',') === expected.join(',');
      setFeedback(
        card,
        ok,
        ok
          ? 'Parfait : aspect, projection, puis taille du renderer.'
          : 'Ordre faux : mets à jour aspect, recalcule la projection, puis redimensionne.',
      );
    }
  }

  cards.forEach((card, index) => {
    if (saved[String(index)]) {
      card.classList.add('is-complete');
      const feedback = card.querySelector('.exercise-feedback');
      feedback.textContent = 'Déjà validé.';
      feedback.classList.add('is-good');
    }

    card.querySelectorAll('[data-token]').forEach((button) => {
      button.addEventListener('click', () => selectSequenceToken(card, button));
    });

    const resetSequenceButton = card.querySelector('[data-reset-sequence]');
    resetSequenceButton?.addEventListener('click', () => resetSequence(card));

    card.querySelectorAll('[data-check]').forEach((button) => {
      button.addEventListener('click', () => {
        const type = button.dataset.check;
        if (type === 'fill') validateFill(card);
        if (type === 'choice') validateChoice(card);
        if (type === 'match') validateMatch(card);
        if (type === 'multi') validateMulti(card);
        if (type === 'self') validateSelf(card);
      });
    });
  });

  resetButton?.addEventListener('click', () => {
    localStorage.removeItem(storageKey);
    cards.forEach((card) => {
      card.classList.remove('is-complete');
      card.querySelectorAll('input[type="text"], input:not([type]), textarea').forEach((input) => {
        input.value = '';
      });
      card.querySelectorAll('input[type="radio"], input[type="checkbox"]').forEach((input) => {
        input.checked = false;
      });
      card.querySelectorAll('select').forEach((select) => {
        select.value = '';
      });
      if (card.querySelector('[data-sequence]')) resetSequence(card);
      const feedback = card.querySelector('.exercise-feedback');
      feedback.textContent = '';
      feedback.classList.remove('is-good', 'is-bad');
    });
    updateScore();
  });

  updateScore();
}

function setupCodeStudio() {
  const drills = [...document.querySelectorAll('[data-code-drill]')];
  const scoreLabel = document.querySelector('#code-score-label');
  const resetButton = document.querySelector('#reset-code-drills');
  if (!drills.length || !scoreLabel) return;

  const storageKey = 'visu3d-code-studio-state';
  const saved = JSON.parse(localStorage.getItem(storageKey) || '{}');

  const specs = {
    init: {
      hints: [
        'Commence par WebGLRenderer, puis setSize avec les dimensions du container.',
        'La caméra doit être une PerspectiveCamera avec fov, aspect, near et far.',
        'Dans animate, appelle renderer.render(scene, camera), puis requestAnimationFrame(animate).',
      ],
      checks: [
        { label: 'créer WebGLRenderer', test: /new\s+THREE\s*\.\s*WebGLRenderer\s*\(/ },
        { label: 'dimensionner le renderer', test: /renderer\s*\.\s*setSize\s*\(/ },
        {
          label: 'ajouter renderer.domElement',
          test: (clean) => /(appendChild|append)\s*\(\s*renderer\s*\.\s*domElement\s*\)/.test(clean),
        },
        { label: 'créer Scene', test: /new\s+THREE\s*\.\s*Scene\s*\(/ },
        { label: 'créer PerspectiveCamera', test: /new\s+THREE\s*\.\s*PerspectiveCamera\s*\(/ },
        { label: 'rendre scene puis camera', test: /renderer\s*\.\s*render\s*\(\s*scene\s*,\s*camera\s*\)/ },
        { label: 'relancer la boucle', test: /requestAnimationFrame\s*\(\s*animate\s*\)/ },
      ],
    },
    resize: {
      hints: [
        'Récupère width et height depuis container.clientWidth et container.clientHeight.',
        'La caméra change d abord aspect, puis updateProjectionMatrix.',
        'Le renderer doit recevoir les mêmes dimensions avec renderer.setSize(width, height).',
      ],
      checks: [
        { label: 'lire width', test: /(clientWidth|getBoundingClientRect\s*\(\)\s*\.\s*width)/ },
        { label: 'lire height', test: /(clientHeight|getBoundingClientRect\s*\(\)\s*\.\s*height)/ },
        { label: 'mettre camera.aspect', test: /camera\s*\.\s*aspect\s*=/ },
        { label: 'mettre updateProjectionMatrix', test: /camera\s*\.\s*updateProjectionMatrix\s*\(/ },
        { label: 'mettre renderer.setSize', test: /renderer\s*\.\s*setSize\s*\(/ },
      ],
    },
    raycaster: {
      hints: [
        'Travaille avec renderer.domElement.getBoundingClientRect(), pas seulement window.innerWidth.',
        'pointer.x vaut une valeur dans [-1, 1]. Le calcul contient rect.left, rect.width, * 2 et - 1.',
        'pointer.y inverse l axe vertical. Le calcul contient rect.top, rect.height, * 2 et + 1.',
      ],
      checks: [
        { label: 'lire le rectangle du canvas', test: /getBoundingClientRect\s*\(/ },
        { label: 'calculer x avec rect.left', test: (clean, compact) => compact.includes('rect.left') && compact.includes('*2-1') },
        { label: 'calculer y avec rect.top', test: (clean, compact) => compact.includes('rect.top') && compact.includes('*2+1') },
        { label: 'setFromCamera', test: /raycaster\s*\.\s*setFromCamera\s*\(/ },
        { label: 'intersectObjects récursif', test: (clean) => /intersectObjects\s*\([^)]*,\s*true\s*\)/.test(clean) },
      ],
    },
    globe: {
      hints: [
        'Utilise un seul TextureLoader, puis loader.load pour chaque image.',
        'Le matériau attendu est MeshPhongMaterial, car normalMap et specularMap dépendent de la lumière.',
        'Ajoute une lumière ambiante pour déboucher, puis une directionnelle pour simuler le soleil.',
      ],
      checks: [
        { label: 'créer TextureLoader', test: /new\s+THREE\s*\.\s*TextureLoader\s*\(/ },
        { label: 'charger les images', test: /\.load\s*\(/ },
        { label: 'créer MeshPhongMaterial', test: /new\s+THREE\s*\.\s*MeshPhongMaterial\s*\(/ },
        { label: 'brancher map', test: /\bmap\s*:/ },
        { label: 'brancher normalMap', test: /\bnormalMap\s*:/ },
        { label: 'brancher specularMap', test: /\bspecularMap\s*:/ },
        { label: 'ajouter AmbientLight', test: /new\s+THREE\s*\.\s*AmbientLight\s*\(/ },
        { label: 'ajouter DirectionalLight', test: /new\s+THREE\s*\.\s*DirectionalLight\s*\(/ },
      ],
    },
    terrain: {
      hints: [
        'L image déclenche la suite dans image.onload. Le code avant onload ne peut pas lire les pixels.',
        'Dessine image dans un canvas avec context.drawImage(image, 0, 0).',
        'Le matériau reçoit new THREE.CanvasTexture(canvas), puis material.needsUpdate = true.',
      ],
      checks: [
        { label: 'créer Image', test: /new\s+Image\s*\(/ },
        { label: 'attendre onload', test: /image\s*\.\s*onload\s*=/ },
        { label: 'créer canvas', test: /document\s*\.\s*createElement\s*\(\s*['"]canvas['"]\s*\)/ },
        { label: 'obtenir context 2d', test: /getContext\s*\(\s*['"]2d['"]\s*\)/ },
        { label: 'dessiner image', test: /drawImage\s*\(/ },
        { label: 'lire getImageData', test: /getImageData\s*\(/ },
        { label: 'créer CanvasTexture', test: /new\s+THREE\s*\.\s*CanvasTexture\s*\(/ },
        { label: 'brancher displacementMap', test: /material\s*\.\s*displacementMap\s*=/ },
        { label: 'forcer needsUpdate', test: /material\s*\.\s*needsUpdate\s*=\s*true/ },
      ],
    },
    debug: {
      hints: [
        'Le couple near 10 et far 20 coupe un objet placé autour de z = 50.',
        'MeshPhongMaterial a besoin de lumière. Sans elle, l objet peut paraître noir.',
        'L ordre de rendu Three.js est renderer.render(scene, camera).',
      ],
      checks: [
        {
          label: 'corriger near et far',
          test: (clean) => /PerspectiveCamera\s*\([^)]*(0\.1|1)[^)]*(100|1000|2000)/.test(clean),
        },
        { label: 'garder une position caméra', test: /camera\s*\.\s*position\s*\.\s*set\s*\(/ },
        { label: 'ajouter une lumière', test: /new\s+THREE\s*\.\s*(AmbientLight|DirectionalLight|HemisphereLight)\s*\(/ },
        { label: 'ajouter earth à la scène', test: /scene\s*\.\s*add\s*\(\s*earth\s*\)/ },
        { label: 'rendre scene puis camera', test: /renderer\s*\.\s*render\s*\(\s*scene\s*,\s*camera\s*\)/ },
      ],
    },
  };

  function stripComments(code) {
    return code
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/\/\/.*$/gm, ' ');
  }

  function compactCode(code) {
    return stripComments(code).replace(/\s+/g, '');
  }

  function drillId(drill) {
    return drill.dataset.codeDrill;
  }

  function updateScore() {
    const done = drills.filter((drill) => drill.classList.contains('is-complete')).length;
    const plural = done === 1 ? '' : 's';
    scoreLabel.textContent = `${done} / ${drills.length} bloc${plural} validé${plural}`;
  }

  function saveState() {
    const state = {};
    drills.forEach((drill) => {
      const id = drillId(drill);
      state[id] = {
        code: drill.querySelector('[data-code-answer]').value,
        done: drill.classList.contains('is-complete'),
        hintIndex: Number(drill.dataset.hintIndex || 0),
      };
    });
    localStorage.setItem(storageKey, JSON.stringify(state));
  }

  function setFeedback(drill, ok, message) {
    const feedback = drill.querySelector('[data-code-feedback]');
    feedback.textContent = message;
    feedback.classList.toggle('is-good', ok);
    feedback.classList.toggle('is-bad', !ok);
    drill.classList.toggle('is-complete', ok);
    saveState();
    updateScore();
  }

  function renderHints(drill) {
    const spec = specs[drillId(drill)];
    const hintBox = drill.querySelector('[data-hint-box]');
    const hintIndex = Number(drill.dataset.hintIndex || 0);
    const hints = spec.hints.slice(0, hintIndex);

    hintBox.classList.toggle('is-empty', hints.length === 0);
    hintBox.innerHTML = hints.length
      ? `<ol>${hints.map((hint) => `<li>${hint}</li>`).join('')}</ol>`
      : 'Aucun indice utilisé.';
  }

  function revealHint(drill) {
    const spec = specs[drillId(drill)];
    const current = Number(drill.dataset.hintIndex || 0);
    drill.dataset.hintIndex = String(Math.min(spec.hints.length, current + 1));
    renderHints(drill);
    saveState();
  }

  function validateDrill(drill) {
    const spec = specs[drillId(drill)];
    const textarea = drill.querySelector('[data-code-answer]');
    const clean = stripComments(textarea.value);
    const compact = compactCode(textarea.value);
    const missing = spec.checks
      .filter((check) => {
        if (typeof check.test === 'function') return !check.test(clean, compact);
        return !check.test.test(clean);
      })
      .map((check) => check.label);

    if (!missing.length) {
      setFeedback(drill, true, 'Validé. Tu as les gestes essentiels, retape ce bloc plus tard sans indice.');
      return;
    }

    const plural = missing.length > 1 ? 's' : '';
    setFeedback(
      drill,
      false,
      `Il manque ${missing.length} réflexe${plural} : ${missing.join(', ')}.`,
    );
  }

  drills.forEach((drill) => {
    const id = drillId(drill);
    const textarea = drill.querySelector('[data-code-answer]');
    const feedback = drill.querySelector('[data-code-feedback]');
    textarea.dataset.initialCode = textarea.value;

    if (saved[id] && Object.hasOwn(saved[id], 'code')) textarea.value = saved[id].code;
    drill.dataset.hintIndex = String(saved[id]?.hintIndex || 0);
    if (saved[id]?.done) {
      drill.classList.add('is-complete');
      feedback.textContent = 'Déjà validé. Reviens dessus à froid pour consolider.';
      feedback.classList.add('is-good');
    }

    renderHints(drill);

    textarea.addEventListener('input', () => {
      if (drill.classList.contains('is-complete')) {
        drill.classList.remove('is-complete');
        feedback.textContent = 'Code modifié. Teste à nouveau pour valider.';
        feedback.classList.remove('is-good');
        feedback.classList.add('is-bad');
      }
      saveState();
      updateScore();
    });

    drill.querySelector('[data-run-code-drill]')?.addEventListener('click', () => validateDrill(drill));
    drill.querySelector('[data-next-hint]')?.addEventListener('click', () => revealHint(drill));
  });

  resetButton?.addEventListener('click', () => {
    localStorage.removeItem(storageKey);
    drills.forEach((drill) => {
      const textarea = drill.querySelector('[data-code-answer]');
      const feedback = drill.querySelector('[data-code-feedback]');
      textarea.value = textarea.dataset.initialCode;
      drill.dataset.hintIndex = '0';
      drill.classList.remove('is-complete');
      feedback.textContent = '';
      feedback.classList.remove('is-good', 'is-bad');
      drill.querySelectorAll('details').forEach((details) => {
        details.open = false;
      });
      renderHints(drill);
    });
    updateScore();
  });

  updateScore();
}

function setupExamTimer() {
  const startButton = document.querySelector('#start-exam');
  const resetButton = document.querySelector('#reset-exam');
  const label = document.querySelector('#exam-timer');
  if (!startButton || !resetButton || !label) return;

  const totalSeconds = 45 * 60;
  let remaining = totalSeconds;
  let intervalId = null;

  function renderTime() {
    const minutes = Math.floor(remaining / 60).toString().padStart(2, '0');
    const seconds = (remaining % 60).toString().padStart(2, '0');
    label.textContent = `${minutes}:${seconds}`;
  }

  startButton.addEventListener('click', () => {
    if (intervalId) return;
    intervalId = window.setInterval(() => {
      remaining = Math.max(0, remaining - 1);
      renderTime();
      if (remaining === 0) {
        window.clearInterval(intervalId);
        intervalId = null;
        startButton.textContent = 'Temps écoulé';
      }
    }, 1000);
    startButton.textContent = 'Chrono lancé';
  });

  resetButton.addEventListener('click', () => {
    window.clearInterval(intervalId);
    intervalId = null;
    remaining = totalSeconds;
    startButton.textContent = 'Démarrer le chrono';
    renderTime();
  });

  renderTime();
}

setupProgress();
setupTraining();
setupCodeStudio();
setupExamTimer();
buildGlobe();
animate();
