// Chargement depuis les modules installés avec NPM
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GUI } from 'three/examples/jsm/libs/lil-gui.module.min.js';
import Stats from 'three/examples/jsm/libs/stats.module.js';
import WebGL from 'three/examples/jsm/capabilities/WebGL.js';
import { CSVToArray, latLonToVector3 } from '../modules/utils.mjs';

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

renderer.setClearColor(0, 1.0);
renderer.clear();

const fov = 45; // Angle de vue vertical
const aspect = window.innerWidth / window.innerHeight; // Rapport largeur/hauteur
const near = 1; // Distance du plan proche
const far = 1000; // Distance du plan éloigné
const camera = new THREE.PerspectiveCamera(fov, aspect, near, far);

// Position de la caméra dans le repère du monde
camera.position.set(0, 2, 50);

// Vecteur unitaire donnant la verticale de la caméra
camera.up = new THREE.Vector3(0, 1, 0);
// Point observé dans la scène qui se projetera
// au centre de l'image
camera.lookAt(0, 0, 0);

const scene = new THREE.Scene();

// Chargement des textures

const texBackground = new THREE.TextureLoader().load(
	'./assets/starry_background.jpg',
	function () {
		renderer.render(scene, camera);
	},
);

scene.background = texBackground;

const texEarthMap = new THREE.TextureLoader().load(
	'./assets/earthmap4k.jpg',
	function () {
		renderer.render(scene, camera);
	},
);

const texEarthNormalMap = new THREE.TextureLoader().load(
	'./assets/earth_normalmap_flat4k.jpg',
	function () {
		renderer.render(scene, camera);
	},
);

const texEarthSpecularMap = new THREE.TextureLoader().load(
	'./assets/earthspec4k.jpg',
	function () {
		renderer.render(scene, camera);
	},
);

const texCloudsMap = new THREE.TextureLoader().load(
	'./assets/fair_clouds_4k.png',
	function () {
		renderer.render(scene, camera);
	},
);

const earthRadius = 15;

// Géométrie de la sphère du globe
const geometry = new THREE.SphereGeometry(earthRadius, 60, 60);

// Matériau utilisé pour la surface terrestre
const matEarth = new THREE.MeshPhongMaterial({
	specular: 0x555555,
	shininess: 50,
	map: texEarthMap,
	specularMap: texEarthSpecularMap,
	normalMap: texEarthNormalMap,
});

// Mise à l'échelle de la normal map pour accentuer le relief
// (valeurs > 1.0) ou atténuer le relief (valeurs < 1.0)
matEarth.normalScale = new THREE.Vector2(1.0, 1.0);

// Création du mesh de la Terre
const earth = new THREE.Mesh(geometry, matEarth);

// Positionnement de l'objet 3D
earth.position.set(0, 0, 0);

scene.add(earth);

const matClouds = new THREE.MeshPhongMaterial({
	specular: 0x555555,
	shininess: 50,
	map: texCloudsMap,
	transparent: true,
});

// Création du mest de la couche d'atmosphère
const clouds = new THREE.Mesh(geometry, matClouds);
clouds.scale.set(1.01, 1.01, 1.01);

scene.add(clouds);

// Création d'une source de lumière ambiante
// pour éclairer complètement le globe de façon
// minimale
const ambientLight = new THREE.AmbientLight(0x3f3f3f);
scene.add(ambientLight);

// Création d'une source de lumière directionnelle
const directionalLight = new THREE.DirectionalLight(0xffffff, 2);
// Direction de la source de lumière
directionalLight.position.set(200, 10, -50);
// Ajout de la source de lumière à la scène
scene.add(directionalLight);

// Paramètres contrôlés va l'interface lil-gui
const controlParams = {
	rotationSpeed: 0.001,
	ambientLightColor: ambientLight.color.getHex(),
	directionalLightX: 200,
	directionalLightY: 10,
	directionalLightZ: -50,
	animation: true,
};

// Création d'un objet lil-GUI
const gui = new GUI();
// Ajout des composants d'interface :
// - contrôle de la vitesse de rotation
gui
	.add(controlParams, 'rotationSpeed')
	.name('Rotation speed')
	.min(0.0)
	.max(0.01);
// - contrôle de la couleur de la source de lumière ambiante
gui
	.addColor(controlParams, 'ambientLightColor')
	.name('Ambient color')
	.onChange(function (value) {
		ambientLight.color = new THREE.Color(value);
	});
// - contrôle de la composante x de la direction de la
// source de lumière directionnelle
gui
	.add(controlParams, 'directionalLightX', -200, 200)
	.name('Light X')
	.onChange(function (value) {
		directionalLight.position.x = value;
	});
// - contrôle de la composante y de la direction de la
// source de lumière directionnelle
gui
	.add(controlParams, 'directionalLightY', -200, 200)
	.name('Light Y')
	.onChange(function (value) {
		directionalLight.position.y = value;
	});
// - contrôle de la composante z de la direction de la
// source de lumière directionnelle
gui
	.add(controlParams, 'directionalLightZ', -200, 200)
	.name('Light Z')
	.onChange(function (value) {
		directionalLight.position.z = value;
	});
// - mise en route ou arrêt de l'animation
const animController = gui.add(controlParams, 'animation').name('Animation');

/*
// Met à jour l'affichage de la case à cocher du paramètre animation
animController.updateDisplay();
*/

// Création d'un objet Stats
const stats = new Stats();
// Ajout de l'interface au DOM
document.body.appendChild(stats.dom);

// Grille 10x10 centrée sur l'origine du repère du monde
const gridHelper = new THREE.GridHelper(10, 10);
scene.add(gridHelper);
// Axes du repère du monde
const axesHelper = new THREE.AxesHelper(10);
scene.add(axesHelper);

const geomCap = new THREE.SphereGeometry(0.1, 8, 8);

async function loadCSV() {
	try {
		const response = await fetch('./assets/UN_Capital_Cities_2014.csv');
		if (!response.ok) {
			throw new Error(`Error HTTP : ${response.status}`);
		}
		const csvText = await response.text();
		let data = CSVToArray(csvText, ';');
		data = data.splice(1, data.length - 1);
		data.forEach((capital) => {
			const position = latLonToVector3(capital[2], capital[3], earthRadius);
			const matCap = new THREE.MeshBasicMaterial({ color: '#ff0000' });
			const capSphere = new THREE.Mesh(geomCap, matCap);
			capSphere.position.copy(position);
			earth.add(capSphere);
			capSphere.infoData = {
				country: capital[0],
				capcity: capital[1],
				population: capital[4],
			};
		});
	} catch (error) {
		console.error(error);
	}
}

loadCSV();

const mouseNDC = new THREE.Vector2();
const mouse = new THREE.Vector2();

function onMouseMove(event) {
	mouse.x = event.clientX;
	mouse.y = event.clientY;
	// Position du pointeur de la souris en coordonnées NDC
	// (Normalized device coordinates, entre -1 et 1)
	mouseNDC.x = (event.clientX / window.innerWidth) * 2 - 1;
	mouseNDC.y = -(event.clientY / window.innerHeight) * 2 + 1;
}

document.addEventListener('mousemove', onMouseMove, false);

const raycaster = new THREE.Raycaster();

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

let capVisible = true;
let capSetVisible = false;
let intersectedObject = null;

function createInfo(intersectedObject) {
	const div = document.createElement('div');
	div.id = 'info';
	div.className = 'label';
	const country = 'Pays : ' + intersectedObject.infoData.country;
	const city = 'Capitale : ' + intersectedObject.infoData.capcity;
	const population =
		'Population (en milliers) : ' + intersectedObject.infoData.population;
	div.innerHTML = country + '<br>' + city + '<br>' + population;
	div.style.top = mouse.y + 'px';
	div.style.left = mouse.x + 'px';
	document.body.appendChild(div);
}

function removeInfo() {
	console.log('removeInfo');
	const div = document.getElementById('info');
	div.remove();
}

function capHover() {
	// Calcul des points d'intersection entre le rayon et les sphères
	// localisant les capitales, comme enfants de l'objet earth
	const intersects = raycaster.intersectObjects(earth.children);

	// TODO : corriger le problème avec la capitales survolée qui se
	// trouvent de l'autre côté du globe
	//const intersects = raycaster.intersectObject(earth, true);

	if (intersects.length > 0) {
		// Cas où des intersections sont détectées
		//console.log(intersects[0].object.infoData);

		if (intersects[0].object != intersectedObject) {
			// Le nouvel objet survolé est différent de celui
			// qui était survolé au rendu précédent, qui peut
			// éventuellement être null
			if (intersectedObject != null) {
				// Si l'objet qui était survolé au rendu précédent
				// n'est pas null, on réinitialise l'objet référencé
				// par intersectedObject
				intersectedObject.material.color.set('#ff0000');
				// Suppression de la bulle d'info
				removeInfo();
			}
			// On "sauvegarde" le nouvel objet survolé
			intersectedObject = intersects[0].object;
			// On change l'apparence du nouvel objet survolé
			intersectedObject.material.color.set('#00ff00');
			// On crée la bulle d'info
			createInfo(intersectedObject);
			// Arrêt de l'animation
			controlParams.animation = false;
			animController.updateDisplay();
		} else {
			// Le nouvel objet survolé est le même que celui
			// qui était survolé au rendu précédent
		}
	} else {
		// Cas où il n'y a pas d'intersection

		if (intersectedObject != null) {
			// Un objet était survolé au rendu précédent
			intersectedObject.material.color.set('#ff0000');
			// On réinitialise intersectedObject à null
			intersectedObject = null;
			// Suppression de la bulle d'info
			removeInfo();
			// Reprise de l'animation
			controlParams.animation = true;
			animController.updateDisplay();
		} else {
			// Aucun objet n'était survolé au rendu précédent
		}
	}
}

function render() {
	// Mise à jour des statistiques
	stats.update();

	if (controlParams.animation) {
		// Effet de rotation du globe
		earth.rotation.y += controlParams.rotationSpeed;
		clouds.rotation.y += 2 * controlParams.rotationSpeed;
	}

	if (camera.position.length() > 50.0) {
		capVisible = false;
		capSetVisible = false;
	} else {
		capVisible = true;
		capSetVisible = false;
	}

	if (capVisible) {
		if (!capSetVisible) {
			earth.children.forEach((capSphere) => {
				capSphere.visible = true;
			});
			capSetVisible = true;
			/*earth.children.forEach((capSphere) => {
				capSphere.scale.set(camera.position.length())
			});*/
		}
	} else {
		if (!capSetVisible) {
			earth.children.forEach((capSphere) => {
				capSphere.visible = false;
			});
			capSetVisible = true;
		}
	}

	// Mise à jour du rayon avec les coordonnées du pointeur de
	// la souris et les paramètres de la caméra
	raycaster.setFromCamera(mouseNDC, camera);

	// Gestion du survol des capitales
	capHover();

	// Mise à jour des paramètres de contrôle de la caméra
	controls.update();
	// Rendu de la scène
	renderer.render(scene, camera);
	// Rafraîchissement de l'affichage
	requestAnimationFrame(render);
}
// Appel de la boucle de rendu
render();

/*
async function chargerCSV() {
  try {
    const response = await fetch('./assets/UN_Capital_Cities_2014.csv');
    if (!response.ok) {
      throw new Error(`Error HTTP : ${response.status}`);
    }
    const csvText = await response.text();
    console.log(csvText);
	return csvText;
    //const lignes = csvText.split('\n');
    //const data = lignes.map(ligne => ligne.split(','));
    //return data;

  } catch (error) {
    console.error(error);
  }
}

chargerCSV();
*/
