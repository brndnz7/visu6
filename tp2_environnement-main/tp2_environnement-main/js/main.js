// Chargement depuis les modules installés avec NPM
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
//import { FirstPersonControls } from 'three/examples/jsm/Addons.js';
import { MyFirstPersonControls } from '../modules/MyFirstPersonControls.mjs';
import WebGL from 'three/examples/jsm/capabilities/WebGL.js';
import { ColladaLoader } from 'three/examples/jsm/loaders/ColladaLoader.js';

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
const near = 0.1; // Distance du plan proche
const far = 50; // Distance du plan éloigné
const camera = new THREE.PerspectiveCamera(fov, aspect, near, far);

// Position de la caméra dans le repère du monde
camera.position.set(0, 2, 10);

// Vecteur unitaire donnant la verticale de la caméra
camera.up = new THREE.Vector3(0, 1, 0);
// Point observé dans la scène qui se projetera
// au centre de l'image
camera.lookAt(0, 0, 0);

const scene = new THREE.Scene();

// Grille 10x10 centrée sur l'origine du repère du monde
const gridHelper = new THREE.GridHelper(10, 10);
scene.add(gridHelper);
// Axes du repère du monde
const axesHelper = new THREE.AxesHelper(10);
scene.add(axesHelper);

// Création d'une source de lumière ponctuelle
const light = new THREE.HemisphereLight(0xffffbb, 0x080820, 1);
// Ajout de la source de lumière à la scène
scene.add(light);

// Tableau destiné à recevoir les références des maillages
// contenus dans le modèle chargé
let allObjects = [];

function parseScene(dae) {
	let queue = [];
	let node = null;
	queue.push(dae);
	while (queue.length != 0) {
		node = queue[queue.length - 1];
		queue.pop();
		if (node.children.length == 0) {
			if (node instanceof THREE.Mesh) allObjects.push(node);
		} else {
			for (let i = 0; i < node.children.length; i++) {
				queue.push(node.children[i]);
			}
		}
	}
}

const loader = new ColladaLoader();
loader.load(
	'models/Apartment_Interior_Design/model.dae',
	// onLoad callback
	function (collada) {
		const dae = collada.scene;
		// On déplace le modèle vers l'origine de la scène
		dae.position.set(-18, 0, 5);
		scene.add(dae);
		console.log('Loading complete!');
		parseScene(dae);
		console.log(allObjects);
		renderer.render(scene, camera);
	},
	// onProgress callback
	function (xhr) {
		console.log('Loading in progress...');
	},
	// onError callback
	function (err) {
		console.log('An error happened');
	},
);

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
//const controls = new OrbitControls(camera, renderer.domElement);
/*
const controls = new FirstPersonControls(camera, renderer.domElement);
controls.movementSpeed = 2.0;
controls.lookSpeed = 0.5;
controls.constrainVertical = true;
controls.lookVertical = false;
*/
const controls = new MyFirstPersonControls(camera, renderer.domElement);
controls.setMoveSpeed(4.0);
controls.setLookHeight(1.8);

function toggleFullScreen() {
	if (!document.fullscreenElement) {
		document.documentElement.requestFullscreen();
	} else {
		if (document.exitFullscreen) {
			document.exitFullscreen();
		}
	}
}

document.addEventListener('keydown', function (event) {
	switch (event.code) {
		case 'KeyF':
			toggleFullScreen();
	}
});

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let picked = null;
let originalMaterial = null;
const pickedMaterial = new THREE.MeshLambertMaterial({
	color: 0xffffff,
	emissive: 0xff0000,
});

document.addEventListener('contextmenu', function (event) {
	event.preventDefault();

	// Calcul de la position du pointeur de la souris en coordonnées
	// normalisées (normalized device coordinates) entre -1 et 1
	mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
	mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

	// Mise à jour du rayon par rapport aux paramètres de la caméra
	// et à la position du pointeur de la souris
	raycaster.setFromCamera(mouse, camera);

	// Calcul des points d'intersection entre le rayon
	// et les maillages contenus dans la scène
	const intersects = raycaster.intersectObjects(allObjects);

	// S'il y a une intersection au moins, l'objet cliqué est
	// le premier objet du tableau intersects
	if (intersects.length) {
		if (picked != null) {
			// Un objet était sélectionné précédemment
			if (picked != intersects[0].object) {
				// L'objet sélectionné précédemment est différent
				// du nouvel objet sélectionné
				picked.material = originalMaterial;
			} else {
				// L'objet sélectionné précédemment est le même
				// que le nouvel objet sélectionné
			}
		} else {
			// Aucun objet n'était sélectionné précédemment
		}
		picked = intersects[0].object;
		originalMaterial = picked.material;
		picked.material = pickedMaterial;
	} else {
		if (picked != null) {
			// Un objet était sélectionné précédemment
			picked.material = originalMaterial;
			picked = null;
		} else {
			// Aucun objet n'était sélectionné précédemment
		}
	}
});

// Création d'un "timer"

// Deprecated since r183
//const clock = new THREE.Clock();

const timer = new THREE.Timer();
timer.connect(document);

function render() {
	// Mise à jour des paramètres de contrôle de la caméra
	timer.update();
	controls.update(timer.getDelta());
	// Rendu de la scène
	renderer.render(scene, camera);
	// Rafraîchissement de l'affichage
	requestAnimationFrame(render);
}
// Appel de la boucle de rendu
render();
