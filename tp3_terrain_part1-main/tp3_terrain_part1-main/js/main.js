// Chargement depuis les modules installés avec NPM
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import WebGL from 'three/examples/jsm/capabilities/WebGL.js';

if (!WebGL.isWebGL2Available()) {
	const warning = WebGL.getWebGL2ErrorMessage();
	document.getElementById('container').appendChild(warning);
}

const renderer = new THREE.WebGLRenderer({ antialias: true });
const container = document.getElementById('container');
renderer.setSize(
	container.clientWidth, // largeur du rendu
	container.clientHeight, // hauteur du rendu
);

container.appendChild(renderer.domElement);

renderer.setClearColor(0xffffff, 1.0);
renderer.clear();

const fov = 45; // Angle de vue vertical
const aspect = window.innerWidth / window.innerHeight; // Rapport largeur/hauteur
const near = 1; // Distance du plan proche
const far = 1000; // Distance du plan éloigné
const camera = new THREE.PerspectiveCamera(fov, aspect, near, far);

// Position de la caméra dans le repère du monde
camera.position.set(100, 100, 100);

// Vecteur unitaire donnant la verticale de la caméra
camera.up = new THREE.Vector3(0, 1, 0);
// Point observé dans la scène qui se projetera
// au centre de l'image
camera.lookAt(0, 0, 0);

const scotland_ratio = 1665 / 745;

//const planeGeo = new THREE.PlaneGeometry(100, 100, 64, 64);
//const planeGeo = new THREE.PlaneGeometry(100, 100, 1024, 1024);

const planeGeo = new THREE.PlaneGeometry(
	scotland_ratio * 100,
	100,
	scotland_ratio * 512,
	512,
);

// Exemple de matériau interagissant avec la lumière : Phong
const material = new THREE.MeshPhongMaterial({
	color: 0xffffff,
	specular: 0x555555,
	shininess: 50,
	/*side: THREE.DoubleSide,*/
	/*wireframe: true,*/
});

const plane = new THREE.Mesh(planeGeo, material);
plane.rotateX(-Math.PI / 2);
// Ou bien :
//plane.rotateX((3 * Math.PI) / 2);

const scene = new THREE.Scene();

scene.add(plane);

// Fonction ajoutant une carte de hauteur
// au matériau passé en entrée
function setHeightMap(heightMapPath, material, displacementScale) {
	// Création d'un objet image pour la carte de hauteur
	const imgHeight = new Image();
	imgHeight.src = heightMapPath;
	imgHeight.style.display = 'none';
	imgHeight.onload = function () {
		// Canvas pour l'image de la carte de hauteur
		const canvasHeight = document.createElement('canvas');
		canvasHeight.width = imgHeight.width;
		canvasHeight.height = imgHeight.height;
		let ctx = canvasHeight.getContext('2d');
		ctx.drawImage(imgHeight, 0, 0);

		// Création d'une texture pour la carte de hauteur
		// et affectation à la propriété displacementMap du matériau
		const displacementMap = new THREE.CanvasTexture(canvasHeight);

		// Utilisation de la carte d'élévation comme displacement map
		// pour le matériau material appliqué à l'objet plane
		material.displacementMap = displacementMap;
		material.displacementScale = displacementScale;

		// Récupération des données des pixels de la carte de hauteur
		const heightData = ctx.getImageData(
			0,
			0,
			canvasHeight.width,
			canvasHeight.height,
		);

		// Canvas pour la carte de normales
		const canvasNormal = document.createElement('canvas');
		canvasNormal.width = imgHeight.width;
		canvasNormal.height = imgHeight.height;
		ctx = canvasNormal.getContext('2d');

		// Récupération des données des pixels de la carte de normales
		const normalData = ctx.createImageData(
			canvasNormal.width,
			canvasNormal.height,
		);

		// Calcul de la carte de normales à partir de
		// la carte de hauteur
		computeNormalMap(heightData, normalData);
		ctx.putImageData(normalData, 0, 0);

		// Création d'une texture pour la carte de normales et
		// affectation à la propriété normalMap du matériau
		const normalMap = new THREE.CanvasTexture(canvasNormal);

		// Utilisation de la carte de normales calculée
		// comme normalMap
		material.normalMap = normalMap;

		// Rafraîchissement du matériau (force la mise à jour
		// des données stockées en mémoire GPU)
		material.needsUpdate = true;
	};
}

// Fonction calculant une carte de normales à partir
// d'une carte de hauteur
function computeNormalMap(heightData, normalData) {
	const w = heightData.width;
	const h = heightData.height;

	// Parcours de tous les pixels
	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) {
			// Récupération des voisins avec clamp sur les bords
			const get = (i, j) => {
				const ii = Math.min(h - 1, Math.max(0, i));
				const jj = Math.min(w - 1, Math.max(0, j));
				return heightData.data[(ii * w + jj) * 4];
			};
			const tl = get(y - 1, x - 1);
			const t = get(y - 1, x);
			const tr = get(y - 1, x + 1);
			const l = get(y, x - 1);
			const r = get(y, x + 1);
			const bl = get(y + 1, x - 1);
			const b = get(y + 1, x);
			const br = get(y + 1, x + 1);
			// Filtre de Sobel
			const dx = tr + 2 * r + br - (tl + 2 * l + bl);
			const dy = bl + 2 * b + br - (tl + 2 * t + tr);
			const normal = new THREE.Vector3(-dx, -dy, 20.0).normalize();
			const idx = (y * w + x) * 4;
			normalData.data[idx] = 0.5 * (normal.x + 1) * 255;
			normalData.data[idx + 1] = 0.5 * (normal.y + 1) * 255;
			normalData.data[idx + 2] = 0.5 * (normal.z + 1) * 255;
			normalData.data[idx + 3] = 255;
		}
	}
}

// Pour textures/heightmap.png
/*let colorTable = [ { stop: 0.0 , color: '#6e6edc'  },
				   { stop: 0.2 , color: '#6edc6e'  },
				   { stop: 0.35, color: '#f0faa0'  },
				   { stop: 0.5 , color: '#e6dcaa'  },
				   { stop: 0.7 , color: 'gainsboro'},
				   { stop: 1.0 , color: '#fafafa'  } ];*/

// Pour textures/heightmap_scotland.png
let colorTable = [
	{ stop: 0.0, color: '#6e6edc' },
	{ stop: 0.02, color: '#6edc6e' },
	{ stop: 0.35, color: '#f0faa0' },
	{ stop: 0.5, color: '#e6dcaa' },
	{ stop: 0.7, color: 'gainsboro' },
	{ stop: 1.0, color: '#fafafa' },
];

// Fonction ajoutant une couleur calculée en fonction de l'altitude
// et d'une colormap au matériau passé en entrée
function setColorGradient(heightMapPath, material, colorTable) {
	// Création d'un objet image pour la carte de hauteur
	const imgHeight = new Image();
	imgHeight.src = heightMapPath;
	imgHeight.style.display = 'none';
	imgHeight.onload = function () {
		// Canvas pour l'image de la carte de hauteur
		const canvasHeight = document.createElement('canvas');
		canvasHeight.width = imgHeight.width;
		canvasHeight.height = imgHeight.height;
		let ctx = canvasHeight.getContext('2d');
		ctx.drawImage(imgHeight, 0, 0);
		const imageHeightData = ctx.getImageData(
			0,
			0,
			canvasHeight.width,
			canvasHeight.height,
		);
		const dataHeight = imageHeightData.data;

		// Canvas pour le gradient
		const canvasMap = document.createElement('canvas');
		canvasMap.width = 1;
		canvasMap.height = 256;
		ctx = canvasMap.getContext('2d');
		// Création du gradient
		const grd = ctx.createLinearGradient(0, 0, 0, 255);
		for (let i = 0; i < colorTable.length; i++) {
			grd.addColorStop(colorTable[i].stop, colorTable[i].color);
		}
		// Remplissage du canvas
		ctx.fillStyle = grd;
		ctx.fillRect(0, 0, 1, 256);
		const imageMapData = ctx.getImageData(
			0,
			0,
			canvasMap.width,
			canvasMap.height,
		);
		const dataMap = imageMapData.data;

		// Canvas pour la carte de couleur calculée à partir du gradient
		const canvasColor = document.createElement('canvas');
		canvasColor.width = imgHeight.width;
		canvasColor.height = imgHeight.height;
		ctx = canvasColor.getContext('2d');
		const imageColorData = ctx.createImageData(
			canvasColor.width,
			canvasColor.height,
		);
		const dataColor = imageColorData.data;

		const imageColorDataSize = imgHeight.width * imgHeight.height;
		for (let i = 0; i < imageColorDataSize; i++) {
			dataColor[4 * i] = dataMap[4 * dataHeight[4 * i]];
			dataColor[4 * i + 1] = dataMap[4 * dataHeight[4 * i] + 1];
			dataColor[4 * i + 2] = dataMap[4 * dataHeight[4 * i] + 2];
			dataColor[4 * i + 3] = dataMap[4 * dataHeight[4 * i] + 3];
		}

		ctx.putImageData(imageColorData, 0, 0);

		// Création d'une texture pour la carte de couleur
		// et affectation à la propriété map du matériau
		const colorMap = new THREE.CanvasTexture(canvasColor);

		// Utilisation de la color map calculée comme texture
		// de couleur affectée à material
		material.map = colorMap;
		material.needsUpdate = true;
	};
}

// Heightmap de résolution 512*512
//setHeightMap('../terrains/heightmap.png', material, 30.0);
setHeightMap('../terrains/heightmap_scotland.png', material, 2.0);

// Heightmap de résolution 1024*1024
//setHeightMap('../terrains/heightmap_1024.png', material, 10.0);

//setColorGradient('../terrains/heightmap.png', material, colorTable);
setColorGradient('../terrains/heightmap_scotland.png', material, colorTable);

// Grille 10x10 centrée sur l'origine du repère du monde
const gridHelper = new THREE.GridHelper(10, 10);
scene.add(gridHelper);
// Axes du repère du monde
const axesHelper = new THREE.AxesHelper(10);
scene.add(axesHelper);

const ambientLight = new THREE.HemisphereLight(0xffffbb, 0x080820, 0.2);
scene.add(ambientLight);

// Création d'une source de lumière ponctuelle
const light = new THREE.DirectionalLight(0xffffff, 4);
// Direction de la source de lumière
light.position.set(100, 100, 100);
// Ajout de la source de lumière à la scène
scene.add(light);

renderer.render(scene, camera);

window.addEventListener('resize', onWindowResize, false);

function onWindowResize() {
	console.log('resize');
	// Calcul du nouveau rapport largeur / hauteur
	camera.aspect = window.innerWidth / window.innerHeight;
	// Mise à jour de la matrice de projection
	camera.updateProjectionMatrix();
	// Mise à jour du contexte de rendu
	renderer.setSize(window.innerWidth, window.innerHeight);
	// Nouveau rendu
	renderer.render(scene, camera);
}

// Création de contrôles de type "orbital"
const controls = new OrbitControls(camera, renderer.domElement);

function render() {
	// Mise à jour des paramètres de contrôle de la caméra
	controls.update();
	// Rendu de la scène
	renderer.render(scene, camera);
	// Rafraîchissement de l'affichage
	requestAnimationFrame(render);
}
// Appel de la boucle de rendu
render();
