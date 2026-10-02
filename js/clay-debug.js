import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FIELD } from './clay-layout.js';

const STAGES=[
 {id:'sprout',label:'幼苗期'},
 {id:'growing',label:'成長期'},
 {id:'mature',label:'成熟期'},
];
const CROP_TYPES={
 wheat:{label:'小麥',heights:[.68,1.3,1.82],width:1.95,idleSway:.05},
 corn:{label:'玉米',heights:[.72,1.4,1.9],width:1.85,idleSway:.04},
 tomato:{label:'番茄',heights:[.68,1.3,1.72],width:1.85,idleSway:.032},
 carrot:{label:'紅蘿蔔',heights:[.68,1.25,1.65],width:1.85,idleSway:.038},
 cabbage:{label:'高麗菜',heights:[.6,1,1.35],width:1.85,idleSway:.018},
 pumpkin:{label:'南瓜',heights:[.5,.85,1.1],width:1.85,idleSway:.016},
 eggplant:{label:'茄子',heights:[.65,1.2,1.65],width:1.85,idleSway:.034},
 pepper:{label:'彩椒',heights:[.65,1.2,1.65],width:1.85,idleSway:.034},
};

function cropMaterial(source,type){
 // Imported roughness maps can leave a glossy rim on otherwise matte leaves.
 const material=new THREE.MeshPhysicalMaterial({
  color:source.color.clone(),map:source.map,normalMap:source.normalMap,
  normalScale:source.normalScale.clone(),aoMap:source.aoMap,aoMapIntensity:source.aoMapIntensity,
  bumpMap:source.bumpMap,bumpScale:source.bumpScale,side:source.side,
  vertexColors:source.vertexColors,alphaMap:source.alphaMap,alphaTest:source.alphaTest,
  transparent:source.transparent,opacity:source.opacity,
  roughness:1,metalness:0,specularIntensity:.12,
 });
 if(type==='eggplant'){
  // Lift only dark purple albedo before lighting; keep green leaves and pale
  // flowers unchanged, with the original texture and shading still visible.
  material.onBeforeCompile=shader=>{
   shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
    float purpleChroma = min(diffuseColor.r, diffuseColor.b) - diffuseColor.g;
    float purpleMask = smoothstep(0.005, 0.025, purpleChroma);
    purpleMask *= 1.0 - smoothstep(0.12, 0.30, max(diffuseColor.r, diffuseColor.b));
    vec3 softPurple = diffuseColor.rgb * 1.55 + vec3(0.035, 0.020, 0.055);
    diffuseColor.rgb = mix(diffuseColor.rgb, softPurple, purpleMask);
   `);
  };
  material.customProgramCacheKey=()=> 'clay-eggplant-purple-v1';
 }
 return material;
}

// Screen-facing labels: A–C go down-left, 1–4 go down-right.
const plotLabel=index=>`${String.fromCharCode(65+Math.floor(index/FIELD.columns))}${index%FIELD.columns+1}`;

export function createFarmDebug({plots,camera,renderer,finishModel,onChange}){
 const toggle=document.querySelector('#debug-toggle'),panel=document.querySelector('#debug-panel');
 const close=document.querySelector('#debug-close'),select=document.querySelector('#debug-plot');
 const cropSelect=document.querySelector('#debug-crop');
 const plant=document.querySelector('#debug-plant'),grow=document.querySelector('#debug-grow');
 const clear=document.querySelector('#debug-clear'),retry=document.querySelector('#debug-retry');
 const message=document.querySelector('#debug-message'),state=document.querySelector('#debug-state');
 const stageLabels=[...document.querySelectorAll('[data-crop-stage]')];
 const beds=plots.children.filter(object=>Number.isInteger(object.userData.plotIndex));
 const bedByIndex=new Map(beds.map(bed=>[bed.userData.plotIndex,bed]));
 const crops=new THREE.Group();crops.name='Debug crops';plots.add(crops);
 // Roll in the camera's image plane so the model's front never turns away.
 const facing=crops.getWorldQuaternion(new THREE.Quaternion()).invert()
  .multiply(camera.getWorldQuaternion(new THREE.Quaternion()));
 const swayAxis=new THREE.Vector3(0,0,1).applyQuaternion(facing);
 const planted=new Map(),templates=new Map(),readyTypes=new Set(),loader=new GLTFLoader();
 let selected=0,selectedType='wheat',opened=false,busy=false,loadError=false;
 let motionSeconds=0;

 // One reusable guide sits on the soil shoulder without hiding its surface.
 const ringShape=(half,radius)=>{
  const shape=new THREE.Shape();
  shape.moveTo(-half+radius,-half);shape.lineTo(half-radius,-half);
  shape.quadraticCurveTo(half,-half,half,-half+radius);shape.lineTo(half,half-radius);
  shape.quadraticCurveTo(half,half,half-radius,half);shape.lineTo(-half+radius,half);
  shape.quadraticCurveTo(-half,half,-half,half-radius);shape.lineTo(-half,-half+radius);
  shape.quadraticCurveTo(-half,-half,-half+radius,-half);return shape;
 };
 const outline=ringShape(1.01,.17);outline.holes.push(ringShape(.94,.13));
 const guide=new THREE.Mesh(new THREE.ShapeGeometry(outline),new THREE.MeshBasicMaterial({
  color:'#ffefb0',transparent:true,opacity:.92,depthWrite:false,side:THREE.DoubleSide,
 }));
 guide.name='Selected farm plot';guide.rotation.x=-Math.PI/2;guide.visible=false;plots.add(guide);

 // Keep the dropdown in the same 3 × 4 order the user sees from the camera.
 for(let number=0;number<FIELD.columns;number++)for(let letter=0;letter<FIELD.rows;letter++){
  const index=letter*FIELD.columns+number;
  if(bedByIndex.has(index))select.add(new Option(`田格 ${plotLabel(index)}`,String(index)));
 }
 for(const [id,crop] of Object.entries(CROP_TYPES))cropSelect.add(new Option(crop.label,id));

 function refresh(){
  const current=planted.get(selected),stage=current?.stage??-1;
  state.textContent=stage<0?'尚未種植':`${CROP_TYPES[current.type].label} · ${STAGES[stage].label}`;
  stageLabels.forEach((label,i)=>{
   label.classList.toggle('is-current',i===stage);label.classList.toggle('is-complete',i<stage);
   if(i===stage)label.setAttribute('aria-current','step');else label.removeAttribute('aria-current');
  });
  plant.disabled=!readyTypes.has(selectedType)||busy;
  plant.textContent=current?(current.type===selectedType?'重新播種':`改種${CROP_TYPES[selectedType].label}`):`種下${CROP_TYPES[selectedType].label}`;
  grow.disabled=busy||stage<0||stage===STAGES.length-1;
  grow.textContent=stage===STAGES.length-1?'已成熟':'催熟一階';
  clear.disabled=!current||busy;retry.hidden=!loadError;
  cropSelect.disabled=busy;select.disabled=busy;
  panel.setAttribute('aria-busy',String(busy));
 }

 function selectionMessage(){
  const current=planted.get(selected),label=CROP_TYPES[selectedType].label;
  message.textContent=current&&current.type!==selectedType
   ?`這格目前種${CROP_TYPES[current.type].label}；改種${label}會從幼苗開始。`
   :current?`${plotLabel(selected)} · ${label} · ${STAGES[current.stage].label}。`:`選好田格後，種下${label}。`;
 }

 function choose(index){
  const bed=bedByIndex.get(index);if(!bed||busy)return;
  selected=index;select.value=String(index);
  const current=planted.get(index);if(current)selectedType=current.type;
  cropSelect.value=selectedType;loadError=false;selectionMessage();
  guide.position.set(bed.position.x,.26,bed.position.z);guide.rotation.z=bed.rotation.y;
  guide.visible=opened;refresh();onChange();
  if(opened)prepare();
 }

 async function loadStage(type,stageIndex){
  const crop=CROP_TYPES[type],stage=STAGES[stageIndex],key=`${type}:${stage.id}`;
  if(!templates.has(key))templates.set(key,(async()=>{
   const {scene:model}=await loader.loadAsync(`assets/models/clay-farm/${type}-${stage.id}.glb`);
   const bounds=new THREE.Box3().setFromObject(model),size=bounds.getSize(new THREE.Vector3());
   if(!Number.isFinite(size.y)||size.y<=0)throw new Error(`Invalid crop bounds: ${key}`);
   const center=bounds.getCenter(new THREE.Vector3());
   const scale=Math.min(crop.heights[stageIndex]/size.y,crop.width/Math.max(size.x,size.z));
   const template=new THREE.Group();template.name=`${type} ${stage.id}`;
   model.scale.multiplyScalar(scale);
   model.position.set(-center.x*scale,-bounds.min.y*scale,-center.z*scale);
   const materials=new Map();
   const finish=source=>{if(!materials.has(source))materials.set(source,cropMaterial(source,type));return materials.get(source);};
   model.traverse(mesh=>{if(mesh.isMesh){
    mesh.castShadow=true;mesh.receiveShadow=true;
    mesh.material=Array.isArray(mesh.material)?mesh.material.map(finish):finish(mesh.material);
   }});
   for(const source of materials.keys())source.dispose();
   finishModel(model);
   // Present the asset's +Z front to the camera, including its elevated angle.
   // Zoom only changes the projection, so this heading stays stable on screen.
   const pose=new THREE.Group();pose.name='Camera-facing crop';
   pose.quaternion.copy(crops.getWorldQuaternion(new THREE.Quaternion())).invert()
    .multiply(camera.getWorldQuaternion(new THREE.Quaternion()));
   pose.add(model);
   const posedBounds=new THREE.Box3().setFromObject(pose),posedCenter=posedBounds.getCenter(new THREE.Vector3());
   // Keep the front-facing model centered and seated on the soil.
   pose.position.set(-posedCenter.x,-posedBounds.min.y,-posedCenter.z);
   // A separate pivot keeps animation away from the camera-facing pose and
   // the field-scale correction. Its origin remains planted at soil level.
   const idle=new THREE.Group();idle.name='Crop idle pivot';idle.add(pose);
   template.add(idle);return template;
  })().catch(error=>{templates.delete(key);throw error;}));
  return templates.get(key);
 }

 async function prepare(){
  if(readyTypes.has(selectedType)||busy)return;
  const type=selectedType,label=CROP_TYPES[type].label;
  busy=true;loadError=false;message.textContent=`正在準備${label}的三個生長階段…`;refresh();
  try{
   await Promise.all(STAGES.map((_,i)=>loadStage(type,i)));readyTypes.add(type);
   selectionMessage();
  }catch(error){
   console.error(`${type} models failed to load`,error);loadError=true;
   message.textContent=`${label}載入失敗，請按「重新載入模型」。`;
  }finally{busy=false;refresh();}
 }

 async function place(type,stage){
  if(!readyTypes.has(type)||busy)return;
  // Capture the plot before awaiting the cached model, even if selection changes.
  const index=selected,bed=bedByIndex.get(index);busy=true;refresh();
  try{
   const template=await loadStage(type,stage),node=template.clone(true);
   // Cancel the field's X/Z enlargement so the original asset proportions stay
   // uniform after rotating toward the camera. No thickness or height stretch.
   const parentScale=crops.getWorldScale(new THREE.Vector3());
   node.scale.set(1/parentScale.x,1/parentScale.y,1/parentScale.z);
   node.position.set(bed.position.x,.225,bed.position.z);
   node.userData.plotIndex=index;node.userData.cropType=type;node.userData.growthStage=STAGES[stage].id;
   const previous=planted.get(index);
   if(previous)crops.remove(previous.node); // Geometry and textures belong to cached templates.
   crops.add(node);planted.set(index,{
    type,stage,node,idle:node.getObjectByName('Crop idle pivot'),born:motionSeconds,
    phase:index*2.39996323+Object.keys(CROP_TYPES).indexOf(type)*.83,
    speed:.9+((index*3)%7)*.035,amplitude:CROP_TYPES[type].idleSway*[1,.9,.8][stage],
   });selectedType=type;cropSelect.value=type;
   message.textContent=`${plotLabel(index)} · ${CROP_TYPES[type].label} · ${STAGES[stage].label}${stage===2?'，已達最終階段。':'。'}`;
   onChange();
  }catch(error){
   console.error('Unable to place crop',error);message.textContent='放置失敗，請再試一次。';
  }finally{busy=false;refresh();}
 }

 function setOpen(value){
  opened=value;panel.hidden=!opened;toggle.setAttribute('aria-expanded',String(opened));
  guide.visible=opened;renderer.domElement.classList.toggle('is-picking-plot',opened);onChange();
  if(opened){choose(selected);select.focus({preventScroll:true});}
  else toggle.focus({preventScroll:true});
 }
 toggle.onclick=()=>setOpen(!opened);close.onclick=()=>setOpen(false);
 select.onchange=()=>choose(Number(select.value));
 cropSelect.onchange=()=>{
  selectedType=cropSelect.value;loadError=false;selectionMessage();refresh();prepare();
 };
 plant.onclick=()=>place(selectedType,0);
 grow.onclick=()=>{const crop=planted.get(selected);if(crop&&crop.stage<2)place(crop.type,crop.stage+1);};
 clear.onclick=()=>{
  const crop=planted.get(selected);if(!crop||busy)return;
  crops.remove(crop.node);planted.delete(selected);message.textContent=`${plotLabel(selected)} 已清空。`;refresh();onChange();
 };
 retry.onclick=prepare;
 document.addEventListener('keydown',event=>{if(opened&&event.key==='Escape'){event.preventDefault();setOpen(false);}});

 const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();let pointerStart=null;
 renderer.domElement.addEventListener('pointerdown',event=>{
  if(opened&&event.isPrimary&&event.button===0)pointerStart={id:event.pointerId,x:event.clientX,y:event.clientY};
 });
 renderer.domElement.addEventListener('pointercancel',()=>{pointerStart=null;});
 renderer.domElement.addEventListener('pointerup',event=>{
  const start=pointerStart;pointerStart=null;
  if(!opened||!start||event.pointerId!==start.id||Math.hypot(event.clientX-start.x,event.clientY-start.y)>8)return;
  const rect=renderer.domElement.getBoundingClientRect();
  pointer.set((event.clientX-rect.left)/rect.width*2-1,1-(event.clientY-rect.top)/rect.height*2);
  camera.updateMatrixWorld();plots.updateMatrixWorld(true);raycaster.setFromCamera(pointer,camera);
  const hit=raycaster.intersectObjects(beds,false)[0];if(hit)choose(hit.object.userData.plotIndex);
 });
 choose(selected);
 return {
  get hasCrops(){return planted.size>0;},
  update(seconds,animate=true){
   if(animate)motionSeconds=seconds;
   for(const crop of planted.values()){
    let angle=0;
    if(animate){
     const time=seconds*crop.speed,fade=THREE.MathUtils.smoothstep(seconds-crop.born,0,.8);
     // Two slow waves and per-plot phases avoid a synchronized rocking field.
     angle=crop.amplitude*fade*(.8*Math.sin(time+crop.phase)+.2*Math.sin(time*1.73+crop.phase*.61));
    }
    crop.idle.quaternion.setFromAxisAngle(swayAxis,angle);
   }
  },
 };
}
