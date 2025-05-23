import * as THREE from '/esmegismozog/three.js-r175/build/three.module.min.js';
import { pass, texture, uniform, output, mrt, mix, velocity, uv, screenUV } from '/esmegismozog/three.js-r175/build/three.tsl.min.js';
import { motionBlur } from '/esmegismozog/three.js-r175/examples/jsm/tsl/display/MotionBlur.js';
import {
	AmbientLight,
	AnimationMixer,
	AxesHelper,
	Box3,
	Cache,
	Color,
	DirectionalLight,
	GridHelper,
	HemisphereLight,
	LoaderUtils,
	LoadingManager,
	PMREMGenerator,
	PerspectiveCamera,
	PointsMaterial,
	REVISION,
	Scene,
	SkeletonHelper,
	Vector3,
	WebGLRenderer,
	LinearToneMapping,
	ACESFilmicToneMapping,
} from '/esmegismozog/three.js-r175/build/three.module.min.js';
import { GLTFLoader } from '/esmegismozog/three.js-r175/examples/jsm/loaders/GLTFLoader.js';
import { KTX2Loader } from '/esmegismozog/three.js-r175/examples/jsm/loaders/KTX2Loader.js';
import { DRACOLoader } from '/esmegismozog/three.js-r175/examples/jsm/loaders/DRACOLoader.js';
import { MeshoptDecoder } from '/esmegismozog/three.js-r175/examples/jsm/libs/meshopt_decoder.module.js';
import { OrbitControls } from '/esmegismozog/three.js-r175/examples/jsm/controls/OrbitControls.js';
import { EXRLoader } from '/esmegismozog/three.js-r175/examples/jsm/loaders/EXRLoader.js';
import { CSS2DRenderer, CSS2DObject } from '/esmegismozog/three.js-r175/examples/jsm/renderers/CSS2DRenderer.js';

// import { GUI } from 'dat.gui';

import { environments } from './environments.js';

const DEFAULT_CAMERA = '[default]';

const MANAGER = new LoadingManager();
const THREE_PATH = `https://cdn.jsdelivr.net/npm/three@v0.175.0`;
const DRACO_LOADER = new DRACOLoader(MANAGER).setDecoderPath(
	`${THREE_PATH}/examples/jsm/libs/draco/gltf/`,
);
const KTX2_LOADER = new KTX2Loader(MANAGER).setTranscoderPath(
	`${THREE_PATH}/examples/jsm/libs/basis/`,
);

const IS_IOS = isIOS();

const Preset = { ASSET_GENERATOR: 'assetgenerator' };

Cache.enabled = true;

export class Viewer {
	constructor(el, options) {
		this.el = el;
		this.options = options;

		this.lights = [];
		this.content = null;
		this.mixer = null;
		this.clips = [];
		this.gui = null;

		this.state = {
			environment: 'Venice Sunset',
			background: true,
			playbackSpeed: 1.0,
			actionStates: {},
			camera: DEFAULT_CAMERA,
			wireframe: false,
			skeleton: false,
			grid: false,
			autoRotate: true,

			// Lights
			punctualLights: true,
			exposure: 0.0,
			toneMapping: ACESFilmicToneMapping,
			ambientIntensity: 0.3,
			ambientColor: '#FFFFFF',
			directIntensity: 0.8 * Math.PI, // TODO(#116)
			directColor: '#FFFFFF',
			bgColor: '#191919',

			pointSize: 1.0,
		};

		this.prevTime = 0;

		this.backgroundColor = new Color(this.state.bgColor);

		this.scene = new Scene();
		this.scene.background = this.backgroundColor;

		const canvas = document.querySelector('#c');
		this.renderer = window.renderer = new WebGLRenderer({ antialias: true, canvas });
		this.renderer.setClearColor(0xcccccc);
		this.renderer.setPixelRatio(window.devicePixelRatio);
		this.renderer.setSize(canvas.width, canvas.height);
		this.renderer.shadowMap.enabled = true;
		this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

		this.labelRenderer = new CSS2DRenderer();
		this.labelRenderer.setSize( canvas.width, canvas.height );
		this.labelRenderer.domElement.style.position = 'absolute';
		this.labelRenderer.domElement.style.top = '0px';
		canvas.parentElement.appendChild( this.labelRenderer.domElement );

		const fov = options.preset === Preset.ASSET_GENERATOR ? (0.8 * 180) / Math.PI : 60;
		const aspect = canvas.clientWidth / canvas.clientHeight;
		this.defaultCamera = new PerspectiveCamera(fov, aspect, 0.01, 1000);
		this.activeCamera = this.defaultCamera;
		this.scene.add(this.defaultCamera);

		this.pmremGenerator = new PMREMGenerator(this.renderer);
		this.pmremGenerator.compileEquirectangularShader();

		this.controls = new OrbitControls(this.defaultCamera, this.labelRenderer.domElement);
		this.controls.screenSpacePanning = true;
		this.controls.minDistance = 1;
		this.controls.maxPolarAngle = Math.PI / 2;
		this.controls.autoRotateSpeed = 2;
		this.controls.enablePan = false;

		// this.el.appendChild(this.renderer.domElement);

		this.cameraCtrl = null;
		this.cameraFolder = null;
		this.animFolder = null;
		this.animCtrls = [];
		this.morphFolder = null;
		this.morphCtrls = [];
		this.skeletonHelpers = [];
		this.gridHelper = null;
		this.axesHelper = null;

		// this.addAxesHelper();
		// this.addGUI();
		// if (options.kiosk) this.gui.close();

		this.animate = this.animate.bind(this);
		requestAnimationFrame(this.animate);
		// window.addEventListener('resize', this.resize.bind(this), false);
		const resizeObserver = new ResizeObserver((entries) => {
		  for (let entry of entries) {
		    this.resize();
		  }
		});
		resizeObserver.observe(canvas.parentElement); // observe a wrapper div

		// this.counter = 500;
	}

	animate(time) {
		requestAnimationFrame(this.animate);

		const dt = (time - this.prevTime) / 1000;

		this.controls.update();
		this.mixer && this.mixer.update(dt);
		this.render();

		this.prevTime = time;
	}

	render() {
		this.renderer.render(this.scene, this.activeCamera);
		this.labelRenderer.render(this.scene, this.activeCamera);
		// if (this.counter > 0 && this.lights[2]) {
		// 	console.log(this.lights[2]);
		// 	console.log(this.defaultCamera);
		// 	this.counter = this.counter - 1;
		// }
		
		// this.resizeRendererToDisplaySize()
		// if (this.state.grid) {
		// 	this.axesCamera.position.copy(this.defaultCamera.position);
		// 	this.axesCamera.lookAt(this.axesScene.position);
		// 	this.axesRenderer.render(this.axesScene, this.axesCamera);
		// }
	}

	resizeRendererToDisplaySize() {
		const canvas = this.renderer.domElement;
		const width = canvas.clientWidth;
		const height = canvas.clientHeight;
		console.log(width, height);
		const needResize = canvas.width !== width || canvas.height !== height;
		if ( needResize ) {
			this.renderer.setSize( width, height, false );
			this.defaultCamera.aspect = width / height;
			this.defaultCamera.updateProjectionMatrix();
		}
		return needResize;
	}

	resize() {
		const { clientHeight, clientWidth } = this.renderer.domElement.parentElement;
		console.log(clientHeight, clientWidth);

		this.defaultCamera.aspect = clientWidth / clientHeight;
		this.defaultCamera.updateProjectionMatrix();
		this.renderer.setSize(clientWidth, clientHeight);
		this.labelRenderer.setSize(clientWidth, clientHeight);

		// this.axesCamera.aspect = this.axesDiv.clientWidth / this.axesDiv.clientHeight;
		// this.axesCamera.updateProjectionMatrix();
		// this.axesRenderer.setSize(this.axesDiv.clientWidth, this.axesDiv.clientHeight);
	}

	load(url, rootPath, assetMap) {
		const baseURL = LoaderUtils.extractUrlBase(url);

		// Load.
		return new Promise((resolve, reject) => {
			// Intercept and override relative URLs.
			MANAGER.setURLModifier((url, path) => {
				// URIs in a glTF file may be escaped, or not. Assume that assetMap is
				// from an un-escaped source, and decode all URIs before lookups.
				// See: https://github.com/donmccurdy/three-gltf-viewer/issues/146
				const normalizedURL =
					rootPath +
					decodeURI(url)
						.replace(baseURL, '')
						.replace(/^(\.?\/)/, '');

				if (assetMap.has(normalizedURL)) {
					const blob = assetMap.get(normalizedURL);
					const blobURL = URL.createObjectURL(blob);
					blobURLs.push(blobURL);
					return blobURL;
				}

				return (path || '') + url;
			});

			const loader = new GLTFLoader(MANAGER)
				.setCrossOrigin('anonymous')
				.setDRACOLoader(DRACO_LOADER)
				.setKTX2Loader(KTX2_LOADER.detectSupport(this.renderer))
				.setMeshoptDecoder(MeshoptDecoder);

			const blobURLs = [];

			loader.load(
				url,
				(gltf) => {
					window.VIEWER.json = gltf;

					const scene = gltf.scene || gltf.scenes[0];
					const clips = gltf.animations || [];
					console.log(clips);

					if (!scene) {
						// Valid, but not supported by this viewer.
						throw new Error(
							'This model contains no scene, and cannot be viewed here. However,' +
								' it may contain individual 3D resources.',
						);
					}

					scene.traverse( function ( child ) {

						if ( child.isMesh ) {

							child.castShadow = true;
							// child.receiveShadow = true;

						}

					} );

					this.setContent(scene, clips);

					blobURLs.forEach(URL.revokeObjectURL);

					// See: https://github.com/google/draco/issues/349
					// DRACOLoader.releaseDecoderModule();

					resolve(gltf);
				},
				undefined,
				reject,
			);
		});
	}

	/**
	 * @param {THREE.Object3D} object
	 * @param {Array<THREE.AnimationClip} clips
	 */
	setContent(object, clips) {
		this.clear();

		object.updateMatrixWorld(); // donmccurdy/three-gltf-viewer#330

		let hip;
		const nodes = object.children;
		// console.log(nodes);
		// const armature = nodes[1]; // TODO: don't hardcode the index
		const armature = nodes[0]; // TODO: don't hardcode the index
		armature.children.forEach((bone) => {
			// console.log(bone.name);
			if (bone.name === 'hip' || bone.name === 'DEF-Hips' || bone.name === 'mixamorig7Hips') {
				hip = bone
			}
		});

		const box = new Box3().setFromObject(object);
		const size = box.getSize(new Vector3()).length();
		const center = box.getCenter(new Vector3());

		this.controls.reset();

		// object.position.x -= center.x;
		// object.position.y -= center.y;
		// object.position.z -= center.z;

		this.controls.maxDistance = size * 2;

		this.defaultCamera.near = size / 100;
		this.defaultCamera.far = size * 100;
		this.defaultCamera.updateProjectionMatrix();

		if (this.options.cameraPosition) {
			this.defaultCamera.position.fromArray(this.options.cameraPosition);
			this.defaultCamera.lookAt(new Vector3());
		} else {
			this.defaultCamera.position.copy(hip.position);
			this.defaultCamera.position.x += size / 2.0;
			this.defaultCamera.position.y += size / 5.0;
			this.defaultCamera.position.z += size / 2.0;
			this.controls.target.copy(hip.position);
			this.controls.update();
		}

		this.setCamera(DEFAULT_CAMERA);

		// this.axesCamera.position.copy(this.defaultCamera.position);
		// this.axesCamera.lookAt(this.axesScene.position);
		// this.axesCamera.near = size / 100;
		// this.axesCamera.far = size * 100;
		// this.axesCamera.updateProjectionMatrix();
		// this.axesCorner.scale.set(size, size, size);

		this.controls.saveState();

		this.scene.add(object);
		this.content = object;

		this.state.punctualLights = true;

		this.content.traverse((node) => {
			if (node.isLight) {
				this.state.punctualLights = false;
			}
		});

		this.setClips(clips);


		// textures

		const textureLoader = new THREE.TextureLoader();

		const floorColor = textureLoader.load( './textures/rubberized_track_diff_1k.jpg' );
		floorColor.wrapS = THREE.RepeatWrapping;
		floorColor.wrapT = THREE.RepeatWrapping;
		floorColor.colorSpace = THREE.SRGBColorSpace;

		const floorNormal = textureLoader.load( './textures/rubberized_track_nor_gl_1k.jpg' );
		floorNormal.wrapS = THREE.RepeatWrapping;
		floorNormal.wrapT = THREE.RepeatWrapping;

		// floor

		const floorUV = uv().mul( 5 );

		const floorMaterial = new THREE.MeshLambertMaterial();
		floorMaterial.map = floorColor;
		floorMaterial.normalMap = floorNormal;
		floorMaterial.normalScale = new THREE.Vector2(0.2, 0.2);

		const floor = new THREE.Mesh( new THREE.BoxGeometry( 15, .001, 15 ), floorMaterial );
		floor.receiveShadow = true;
		var uvs = floor.geometry.attributes.uv.array;

		for ( var i = 0, len=uvs.length; i<len; i++ ) {
			uvs[i] *= 2;
		}

		floor.position.set( 0, 0, 0 );
		this.scene.add( floor );

		const basePath = './models/'
		const fileNames = [
		  'alacsony_huzodzkodo_tolodzkodo.glb',
		  'egyenes_rud_1900.glb',
		  'lepegeto_500.glb',
		  'oszlop_1625.glb'
		];

		this.tools = {};

		const loader = new GLTFLoader(MANAGER)
			.setCrossOrigin('anonymous')
			.setDRACOLoader(DRACO_LOADER)
			.setKTX2Loader(KTX2_LOADER.detectSupport(this.renderer))
			.setMeshoptDecoder(MeshoptDecoder);

		fileNames.forEach(fileName => {
		  const key = fileName.replace(/\.glb$/, ''); // Remove .glb extension
		  const eszkoz_url = basePath + fileName;

		  loader.load(
		    eszkoz_url,
		    (gltf) => {
		      const scene = gltf.scene || gltf.scenes[0];

		      scene.traverse(child => {
		        if (child.isMesh) {
		          child.castShadow = true;
		          // child.receiveShadow = true;
		        }
		      });

		      this.tools[key] = scene; // Use filename without extension as key
		      this.scene.add(scene);
		    },
		    undefined,
		    (error) => {
		      console.error(`Error loading ${fileName}:`, error);
		    }
		  );
		});

		// const eszkoz_url = '/models/alacsony_huzodzkodo_tolodzkodo.glb';
		// const loader = new GLTFLoader(MANAGER)
		// 	.setCrossOrigin('anonymous')
		// 	.setDRACOLoader(DRACO_LOADER)
		// 	.setKTX2Loader(KTX2_LOADER.detectSupport(this.renderer))
		// 	.setMeshoptDecoder(MeshoptDecoder);

		// loader.load(
		// 	eszkoz_url,
		// 	(gltf) => {
		// 		const scene = gltf.scene || gltf.scenes[0];

		// 		scene.traverse( function ( child ) {
		// 			if ( child.isMesh ) {
		// 				child.castShadow = true;
		// 				// child.receiveShadow = true;
		// 			}
		// 		} );
		// 		this.scene.add(scene);
		// 	},
		// 	undefined,
		// 	undefined,
		// );



		this.updateLights();
		// this.updateGUI();
		this.updateEnvironment();
		this.updateDisplay();

		window.VIEWER.scene = this.content;

		// this.printGraph(this.content);
		// this.drawAnnotations()
	}

	drawAnnotations() {
		const armature = this.content.children[1];
		armature.children.forEach((child) => {
			if (child.name === 'hand_l') {
				const boneDiv = document.createElement( 'div' );
				boneDiv.className = 'label';
				boneDiv.textContent = child.name;
				boneDiv.style.backgroundColor = 'transparent';

				const boneLabel = new CSS2DObject( boneDiv );
				boneLabel.position.set( 0, 0, 0 );
				boneLabel.center.set( 0, 1 );
				child.add( boneLabel );
				boneLabel.layers.set( 0 );
			}
		});
	}

	printGraph(node) {
		console.group(' <' + node.type + '> ' + node.name);
		node.children.forEach((child) => this.printGraph(child));
		console.groupEnd();
	}

	/**
	 * @param {Array<THREE.AnimationClip} clips
	 */
	setClips(clips) {
		if (this.mixer) {
			this.mixer.stopAllAction();
			this.mixer.uncacheRoot(this.mixer.getRoot());
			this.mixer = null;
		}

		this.clips = clips;
		if (!clips.length) return;

		this.mixer = new AnimationMixer(this.content);

		this.clips.forEach((clip) => {
			if (clip.name === "fekvo_alacsony_huzodzkodon_magasabb") {
				this.mixer.clipAction(clip).reset().play();
				this.state.actionStates[clip.name] = true;
			}
		});
	}

	playAllClips() {
		this.clips.forEach((clip) => {
			this.mixer.clipAction(clip).reset().play();
			this.state.actionStates[clip.name] = true;
		});
	}

	/**
	 * @param {string} name
	 */
	setCamera(name) {
		if (name === DEFAULT_CAMERA) {
			this.controls.enabled = true;
			this.activeCamera = this.defaultCamera;
		} else {
			this.controls.enabled = false;
			this.content.traverse((node) => {
				if (node.isCamera && node.name === name) {
					this.activeCamera = node;
				}
			});
		}
	}

	updateLights() {
		const state = this.state;
		const lights = this.lights;

		if (state.punctualLights && !lights.length) {
			this.addLights();
		} else if (!state.punctualLights && lights.length) {
			this.removeLights();
		}

		this.renderer.toneMapping = Number(state.toneMapping);
		this.renderer.toneMappingExposure = Math.pow(2, state.exposure);

		// if (lights.length === 2) {
		// 	lights[0].intensity = state.ambientIntensity;
		// 	lights[0].color.set(state.ambientColor);
		// 	lights[1].intensity = state.directIntensity;
		// 	lights[1].color.set(state.directColor);
		// }
	}

	addLights() {
		const state = this.state;

		if (this.options.preset === Preset.ASSET_GENERATOR) {
			const hemiLight = new HemisphereLight();
			hemiLight.name = 'hemi_light';
			this.scene.add(hemiLight);
			this.lights.push(hemiLight);
			return;
		}

		const light1 = new AmbientLight(state.ambientColor, state.ambientIntensity);
		light1.name = 'ambient_light';
		this.defaultCamera.add(light1);

		const light2 = new DirectionalLight(state.directColor, state.directIntensity);
		light2.position.set(0.5, 0, 0.866); // ~60º
		light2.name = 'main_light';
		this.defaultCamera.add(light2);

		const light3 = new DirectionalLight(state.directColor, state.directIntensity/2);
		light3.position.set(1.6318232729608857, 1.6179809312022844, 0.8770237176204865); // ~60º
		light3.rotation.set(-0.6548971179576231, 0.9752294412893249, 0.5662861071413451);
		light3.castShadow = true;
		light3.shadow.mapSize.width = 2048;
		light3.shadow.mapSize.height = 2048;
		// light3.shadow.radius=2;
		// light3.shadow.blurSamples=100;
		// console.log(light3.shadow);
		this.scene.add(light3);

		this.lights.push(light1, light2, light3);
	}

	removeLights() {
		this.lights.forEach((light) => light.parent.remove(light));
		this.lights.length = 0;
	}

	updateEnvironment() {
		const environment = environments.filter(
			(entry) => entry.name === this.state.environment,
		)[0];

		this.getCubeMapTexture(environment).then(({ envMap }) => {
			this.scene.environment = envMap;
			this.scene.background = this.state.background ? envMap : this.backgroundColor;
			this.scene.backgroundBlurriness = 0.8;
			this.scene.backgroundIntensity = 0.2;
		});
	}

	getCubeMapTexture(environment) {
		const { id, path } = environment;

		// none
		if (id === '') {
			return Promise.resolve({ envMap: null });
		}

		return new Promise((resolve, reject) => {
			new EXRLoader().load(
				path,
				(texture) => {
					const envMap = this.pmremGenerator.fromEquirectangular(texture).texture;
					this.pmremGenerator.dispose();

					resolve({ envMap });
				},
				undefined,
				reject,
			);
		});
	}

	updateDisplay() {
		if (this.skeletonHelpers.length) {
			this.skeletonHelpers.forEach((helper) => this.scene.remove(helper));
		}

		traverseMaterials(this.content, (material) => {
			material.wireframe = this.state.wireframe;

			if (material instanceof PointsMaterial) {
				material.size = this.state.pointSize;
			}
		});

		this.content.traverse((node) => {
			if (node.geometry && node.skeleton && this.state.skeleton) {
				const helper = new SkeletonHelper(node.skeleton.bones[0].parent);
				helper.material.linewidth = 3;
				this.scene.add(helper);
				this.skeletonHelpers.push(helper);
			}
		});

		if (this.state.grid !== Boolean(this.gridHelper)) {
			if (this.state.grid) {
				this.gridHelper = new GridHelper();
				this.axesHelper = new AxesHelper();
				this.axesHelper.renderOrder = 999;
				this.axesHelper.onBeforeRender = (renderer) => renderer.clearDepth();
				this.scene.add(this.gridHelper);
				this.scene.add(this.axesHelper);
			} else {
				this.scene.remove(this.gridHelper);
				// this.scene.remove(this.axesHelper);
				// this.gridHelper = null;
				// this.axesHelper = null;
				// this.axesRenderer.clear();
			}
		}

		this.controls.autoRotate = this.state.autoRotate;
	}

	updateBackground() {
		this.backgroundColor.set(this.state.bgColor);
	}

	/**
	 * Adds AxesHelper.
	 *
	 * See: https://stackoverflow.com/q/16226693/1314762
	 */
	addAxesHelper() {
		this.axesDiv = document.createElement('div');
		this.el.appendChild(this.axesDiv);
		this.axesDiv.classList.add('axes');

		const { clientWidth, clientHeight } = this.axesDiv;

		this.axesScene = new Scene();
		this.axesCamera = new PerspectiveCamera(50, clientWidth / clientHeight, 0.1, 10);
		this.axesScene.add(this.axesCamera);

		this.axesRenderer = new WebGLRenderer({ alpha: true });
		this.axesRenderer.setPixelRatio(window.devicePixelRatio);
		this.axesRenderer.setSize(this.axesDiv.clientWidth, this.axesDiv.clientHeight);

		this.axesCamera.up = this.defaultCamera.up;

		this.axesCorner = new AxesHelper(5);
		this.axesScene.add(this.axesCorner);
		this.axesDiv.appendChild(this.axesRenderer.domElement);
	}

	addGUI() {
		const gui = (this.gui = new GUI({
			autoPlace: false,
			width: 260,
			hideable: true,
		}));

		// Display controls.
		const dispFolder = gui.addFolder('Display');
		const envBackgroundCtrl = dispFolder.add(this.state, 'background');
		envBackgroundCtrl.onChange(() => this.updateEnvironment());
		const autoRotateCtrl = dispFolder.add(this.state, 'autoRotate');
		autoRotateCtrl.onChange(() => this.updateDisplay());
		const wireframeCtrl = dispFolder.add(this.state, 'wireframe');
		wireframeCtrl.onChange(() => this.updateDisplay());
		const skeletonCtrl = dispFolder.add(this.state, 'skeleton');
		skeletonCtrl.onChange(() => this.updateDisplay());
		const gridCtrl = dispFolder.add(this.state, 'grid');
		gridCtrl.onChange(() => this.updateDisplay());
		dispFolder.add(this.controls, 'screenSpacePanning');
		const pointSizeCtrl = dispFolder.add(this.state, 'pointSize', 1, 16);
		pointSizeCtrl.onChange(() => this.updateDisplay());
		const bgColorCtrl = dispFolder.addColor(this.state, 'bgColor');
		bgColorCtrl.onChange(() => this.updateBackground());

		// Lighting controls.
		const lightFolder = gui.addFolder('Lighting');
		const envMapCtrl = lightFolder.add(
			this.state,
			'environment',
			environments.map((env) => env.name),
		);
		envMapCtrl.onChange(() => this.updateEnvironment());
		[
			lightFolder.add(this.state, 'toneMapping', {
				Linear: LinearToneMapping,
				'ACES Filmic': ACESFilmicToneMapping,
			}),
			lightFolder.add(this.state, 'exposure', -10, 10, 0.01),
			lightFolder.add(this.state, 'punctualLights').listen(),
			lightFolder.add(this.state, 'ambientIntensity', 0, 2),
			lightFolder.addColor(this.state, 'ambientColor'),
			lightFolder.add(this.state, 'directIntensity', 0, 4), // TODO(#116)
			lightFolder.addColor(this.state, 'directColor'),
		].forEach((ctrl) => ctrl.onChange(() => this.updateLights()));

		// Animation controls.
		this.animFolder = gui.addFolder('Animation');
		this.animFolder.domElement.style.display = 'none';
		const playbackSpeedCtrl = this.animFolder.add(this.state, 'playbackSpeed', 0, 1);
		playbackSpeedCtrl.onChange((speed) => {
			if (this.mixer) this.mixer.timeScale = speed;
		});
		this.animFolder.add({ playAll: () => this.playAllClips() }, 'playAll');

		// Morph target controls.
		this.morphFolder = gui.addFolder('Morph Targets');
		this.morphFolder.domElement.style.display = 'none';

		// Camera controls.
		this.cameraFolder = gui.addFolder('Cameras');
		this.cameraFolder.domElement.style.display = 'none';

		const guiWrap = document.createElement('div');
		this.el.appendChild(guiWrap);
		guiWrap.classList.add('gui-wrap');
		guiWrap.appendChild(gui.domElement);
		gui.open();
	}

	updateGUI() {
		this.cameraFolder.domElement.style.display = 'none';

		this.morphCtrls.forEach((ctrl) => ctrl.remove());
		this.morphCtrls.length = 0;
		this.morphFolder.domElement.style.display = 'none';

		this.animCtrls.forEach((ctrl) => ctrl.remove());
		this.animCtrls.length = 0;
		this.animFolder.domElement.style.display = 'none';

		const cameraNames = [];
		const morphMeshes = [];
		this.content.traverse((node) => {
			if (node.geometry && node.morphTargetInfluences) {
				morphMeshes.push(node);
			}
			if (node.isCamera) {
				node.name = node.name || `VIEWER__camera_${cameraNames.length + 1}`;
				cameraNames.push(node.name);
			}
		});

		if (cameraNames.length) {
			this.cameraFolder.domElement.style.display = '';
			if (this.cameraCtrl) this.cameraCtrl.remove();
			const cameraOptions = [DEFAULT_CAMERA].concat(cameraNames);
			this.cameraCtrl = this.cameraFolder.add(this.state, 'camera', cameraOptions);
			this.cameraCtrl.onChange((name) => this.setCamera(name));
		}

		if (morphMeshes.length) {
			this.morphFolder.domElement.style.display = '';
			morphMeshes.forEach((mesh) => {
				if (mesh.morphTargetInfluences.length) {
					const nameCtrl = this.morphFolder.add(
						{ name: mesh.name || 'Untitled' },
						'name',
					);
					this.morphCtrls.push(nameCtrl);
				}
				for (let i = 0; i < mesh.morphTargetInfluences.length; i++) {
					const ctrl = this.morphFolder
						.add(mesh.morphTargetInfluences, i, 0, 1, 0.01)
						.listen();
					Object.keys(mesh.morphTargetDictionary).forEach((key) => {
						if (key && mesh.morphTargetDictionary[key] === i) ctrl.name(key);
					});
					this.morphCtrls.push(ctrl);
				}
			});
		}

		if (this.clips.length) {
			this.animFolder.domElement.style.display = '';
			const actionStates = (this.state.actionStates = {});
			this.clips.forEach((clip, clipIndex) => {
				clip.name = `${clipIndex + 1}. ${clip.name}`;

				// Autoplay the first clip.
				let action;
				if (clipIndex === 0) {
					actionStates[clip.name] = true;
					action = this.mixer.clipAction(clip);
					action.play();
				} else {
					actionStates[clip.name] = false;
				}

				// Play other clips when enabled.
				const ctrl = this.animFolder.add(actionStates, clip.name).listen();
				ctrl.onChange((playAnimation) => {
					action = action || this.mixer.clipAction(clip);
					action.setEffectiveTimeScale(1);
					playAnimation ? action.play() : action.stop();
				});
				this.animCtrls.push(ctrl);
			});
		}
	}

	showTool(name) {
	  for (const key in this.tools) {
	    if (this.tools.hasOwnProperty(key)) {
	      this.tools[key].visible = (key === name);
	    }
	  }
	}

	playAnimation(clipName) {
		console.log(clipName);
		const toolExerciseMap = {
			'fekvotamasz_huzodzkodon_magas': 'alacsony_huzodzkodo_tolodzkodo',
			'fekvotamasz_huzodzkodon_alacsony': 'alacsony_huzodzkodo_tolodzkodo',
			'huzodzkodas_allva': 'oszlop_1625',
			'vizszintes_huzodzkodas_konnyebb': 'alacsony_huzodzkodo_tolodzkodo',
			'vizszintes_huzodzkodas_nehezebb': 'alacsony_huzodzkodo_tolodzkodo',
			'huzodzkodas_konnyitve': 'alacsony_huzodzkodo_tolodzkodo',
			'lapocka_huzodzkodas': 'egyenes_rud_1900',
			'feszitve_fuggeszkedes': 'egyenes_rud_1900',
			'guggolas_konnyitve': 'oszlop_1625',
			'terdemeles_padon': 'lepegeto_500',
			'terdemeles_fuggeszkedesben': 'egyenes_rud_1900'
		};
		this.clips.forEach((clip) => {
			let action = this.mixer.clipAction(clip);
			if (clip.name === clipName) {
				this.state.actionStates[clip.name] = true;
				action.reset().play();
				clip.toJSON().tracks.forEach((track) => {
					if (track.name === 'DEF-Hips.position') {
						// const hips_pos = new Vector3(track.values.at(-3), track.values.at(-2), track.values.at(-1)) - new Vector3(track.values[0], track.values[1], track.values[2]);
						const hips_pos = new Vector3();
						hips_pos.addVectors( new Vector3(track.values.at(-3), track.values.at(-2), track.values.at(-1)), new Vector3(track.values[0], track.values[1], track.values[2]) ).divideScalar( 2 );
						const box = new Box3().setFromObject(this.content);
						const size = box.getSize(new Vector3()).length();
						this.defaultCamera.position.copy(hips_pos);
						this.defaultCamera.position.x += size / 2.0;
						this.defaultCamera.position.y += size / 5.0;
						this.defaultCamera.position.z += size / 2.0;
						this.controls.target.copy(hips_pos);
						this.controls.update();
					}
				});
				if (toolExerciseMap.hasOwnProperty(clipName)) {
			      this.showTool(toolExerciseMap[clipName]);
			    } else {
			    	this.showTool('');
			    }
				
			} else {
				this.state.actionStates[clip.name] = false;
				action.stop();
			}
		});
	}

	clear() {
		if (!this.content) return;

		this.scene.remove(this.content);

		// dispose geometry
		this.content.traverse((node) => {
			if (!node.geometry) return;

			node.geometry.dispose();
		});

		// dispose textures
		traverseMaterials(this.content, (material) => {
			for (const key in material) {
				if (key !== 'envMap' && material[key] && material[key].isTexture) {
					material[key].dispose();
				}
			}
		});
	}
}

function traverseMaterials(object, callback) {
	object.traverse((node) => {
		if (!node.geometry) return;
		const materials = Array.isArray(node.material) ? node.material : [node.material];
		materials.forEach(callback);
	});
}

// https://stackoverflow.com/a/9039885/1314762
function isIOS() {
	return (
		['iPad Simulator', 'iPhone Simulator', 'iPod Simulator', 'iPad', 'iPhone', 'iPod'].includes(
			navigator.platform,
		) ||
		// iPad on iOS 13 detection
		(navigator.userAgent.includes('Mac') && 'ontouchend' in document)
	);
}
