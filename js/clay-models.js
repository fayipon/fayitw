import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

// Farm models are Draco-compressed by scripts/optimize-farm-assets.mjs.
const draco=new DRACOLoader().setDecoderPath(new URL('./vendor/three/addons/libs/draco/gltf/',import.meta.url).href);
const loader=new GLTFLoader().setDRACOLoader(draco);
const modelUrl=name=>new URL(`../assets/models/clay-farm/${name}.glb`,import.meta.url).href;
const pending=new Map();

// Start every download at once so the network never waits on scene assembly.
export function preloadModels(names){
 for(const name of names)if(!pending.has(name)){
  const request=loader.loadAsync(modelUrl(name));
  request.catch(()=>{});// Reported when the scene stage awaits it.
  pending.set(name,request);
 }
}

// Each preloaded result is handed out once; callers may mutate the scene.
export function loadModel(name){
 const request=pending.get(name);pending.delete(name);
 return request??loader.loadAsync(modelUrl(name));
}
