import { Viewer } from './viewer.js';

window.VIEWER = {};

const viewerEl = document.getElementById("viewer");
const options = {
			kiosk: true,
			model: './models/snow_anim.glb',
			preset: '',
			cameraPosition: null,
		};
export const viewer = new Viewer(viewerEl, options);
viewer
	.load(options.model, '', new Map());

// const canvas = document.querySelector('#c');
// const observer = new ResizeObserver(entries => {
//   for (let entry of entries) {
//     const viewer = new Viewer(viewerEl, options);
// 	viewer
// 		.load(options.model, '', new Map());
//   }
// });

// observer.observe(canvas.parentElement);


// import * as THREE from 'three';

// import {
// 	AmbientLight,
// 	AnimationMixer,
// 	AxesHelper,
// 	Box3,
// 	Cache,
// 	Color,
// 	DirectionalLight,
// 	GridHelper,
// 	HemisphereLight,
// 	LoaderUtils,
// 	LoadingManager,
// 	PMREMGenerator,
// 	PerspectiveCamera,
// 	PointsMaterial,
// 	REVISION,
// 	Scene,
// 	SkeletonHelper,
// 	Vector3,
// 	WebGLRenderer,
// 	LinearToneMapping,
// 	ACESFilmicToneMapping,
// } from 'three';
// import Stats from 'three/addons/libs/stats.module.js';
// import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
// import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
// import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
// import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
// import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
// import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';
// import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// const MANAGER = new LoadingManager();
// const THREE_PATH = `https://cdn.jsdelivr.net/npm/three@v0.175.0`;
// const DRACO_LOADER = new DRACOLoader(MANAGER).setDecoderPath(
// 	`${THREE_PATH}/examples/jsm/libs/draco/gltf/`,
// );
// const KTX2_LOADER = new KTX2Loader(MANAGER).setTranscoderPath(
// 	`${THREE_PATH}/examples/jsm/libs/basis/`,
// );

// const scene = new Scene();
// const camera = new PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );
// camera.position.z = 5;

// const hemiLight = new HemisphereLight();
// hemiLight.name = 'hemi_light';
// scene.add(hemiLight);

// const renderer = new WebGLRenderer();
// renderer.setSize( window.innerWidth, window.innerHeight );
// document.body.appendChild( renderer.domElement );

// const controls = new OrbitControls( camera, renderer.domElement );
// const loader = new GLTFLoader(MANAGER)
// 				.setCrossOrigin('anonymous')
// 				.setDRACOLoader(DRACO_LOADER)
// 				.setKTX2Loader(KTX2_LOADER.detectSupport(renderer))
// 				.setMeshoptDecoder(MeshoptDecoder);
// loader.load( '/models/nathan_rigify_v021.glb', function ( gltf ) {

//   scene.add( gltf.scene );

// }, undefined, function ( error ) {

//   console.error( error );

// } );

// function animate() {
//   renderer.render( scene, camera );
// }
// renderer.setAnimationLoop( animate );