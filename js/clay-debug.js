import * as THREE from 'three';
import { loadModel } from './clay-models.js';
import { FIELD } from './clay-layout.js';
import { createGrowthState, advanceGrowth, growthRemainingMs, formatGrowthTime } from './clay-growth.js';
import { createCropProgress } from './clay-crop-progress.js';
import { createThirstyFace } from './clay-crop-thirst.js';
import { createWateringEffect } from './clay-watering.js';
import { createHarvestBadge, createHarvestEffect } from './clay-harvest.js';
import { createPlotActions } from './clay-plot-actions.js';

// Model dimensions belong to rendering; seed inventory and timing come from JSON.
const CROP_MODELS={
 wheat:{heights:[.68,1.3,1.82],width:1.95,idleSway:.05},
 corn:{heights:[.72,1.4,1.9],width:1.85,idleSway:.04},
 tomato:{heights:[.68,1.3,1.72],width:1.85,idleSway:.032},
 carrot:{heights:[.68,1.25,1.65],width:1.85,idleSway:.038},
 cabbage:{heights:[.6,1,1.35],width:1.85,idleSway:.018},
 pumpkin:{heights:[.5,.85,1.1],width:1.85,idleSway:.016},
 eggplant:{heights:[.65,1.2,1.65],width:1.85,idleSway:.034},
 pepper:{heights:[.65,1.2,1.65],width:1.85,idleSway:.034},
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

export function createFarmDebug({config,plots,camera,renderer,soilBeds,finishModel,onChange}){
 const STAGES=config.stages;
 const CROP_TYPES=Object.fromEntries(config.crops.map(crop=>[crop.id,{...CROP_MODELS[crop.id],...crop}]));
 const toggle=document.querySelector('#debug-toggle'),panel=document.querySelector('#debug-panel');
 const close=document.querySelector('#debug-close'),select=document.querySelector('#debug-plot');
 const cropSelect=document.querySelector('#debug-crop');
 const plant=document.querySelector('#debug-plant'),grow=document.querySelector('#debug-grow');
 const clear=document.querySelector('#debug-clear'),retry=document.querySelector('#debug-retry');
 const message=document.querySelector('#debug-message'),state=document.querySelector('#debug-state');
 const soilState=document.querySelector('#debug-soil-state'),debugWater=document.querySelector('#debug-water');
 const debugHarvest=document.querySelector('#debug-harvest'),harvestCount=document.querySelector('#debug-harvest-count');
 const soilButtons=[...document.querySelectorAll('[data-debug-soil]')];
 const actions=document.querySelector('#plot-actions'),actionTitle=document.querySelector('#plot-action-title');
 const actionSoil=document.querySelector('#plot-soil-state'),actionStatus=document.querySelector('#plot-action-status');
 const planting=document.querySelector('#plot-planting');
 const cropStatus=document.querySelector('#crop-status');
 const statusUI=Object.fromEntries(['icon','plot','name','badge','progress','step','water','moisture','ready-icon','ready','care','stage','stage-label']
  .map(key=>[key,document.querySelector(`#crop-status-${key}`)]));
 const seeds=Object.fromEntries(config.crops.map(crop=>[crop.id,crop.seeds])),cropCards=new Map();
 const harvestCounts=Object.fromEntries(config.crops.map(crop=>[crop.id,0]));
 const plotRetry=document.querySelector('#plot-retry');
 const stageList=document.querySelector('.debug-stages');stageList.replaceChildren();
 const stageLabels=STAGES.map((stage,i)=>{
  const label=document.createElement('li');label.dataset.cropStage=i;label.textContent=stage.shortLabel;stageList.append(label);return label;
 });
 const beds=plots.children.filter(object=>Number.isInteger(object.userData.plotIndex));
 const bedByIndex=new Map(beds.map(bed=>[bed.userData.plotIndex,bed]));
 const crops=new THREE.Group();crops.name='Debug crops';plots.add(crops);
 const plotActions=createPlotActions({water:()=>createWateringEffect(plots),harvest:()=>createHarvestEffect(plots)});
 // Roll in the camera's image plane so the model's front never turns away.
 const facing=crops.getWorldQuaternion(new THREE.Quaternion()).invert()
  .multiply(camera.getWorldQuaternion(new THREE.Quaternion()));
 const swayAxis=new THREE.Vector3(0,0,1).applyQuaternion(facing);
 const planted=new Map(),templates=new Map(),readyTypes=new Set(),readyModels=new Map();
 let selected=0,selectedType=config.crops[0].id,opened=false,busy=false,loadError=false;
 const desktopTools=matchMedia('(min-width: 1100px)');
 const sceneHost=panel.parentElement;
 let docked=false;
 let motionSeconds=0;
 let actionError='';

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
 for(const [id,crop] of Object.entries(CROP_TYPES)){
  const i=crop.iconIndex;
  cropSelect.add(new Option(crop.label,id));
  const card=document.createElement('button');card.type='button';card.className='crop-choice';
  card.dataset.crop=id;card.title=crop.label;
  const icon=document.createElement('span');icon.className='crop-choice-icon';icon.setAttribute('aria-hidden','true');
  icon.style.backgroundPosition=`${(i%4)*100/3}% ${i<4?0:100}%`;
  const count=document.createElement('span');count.className='crop-choice-count';count.setAttribute('aria-hidden','true');
  card.append(icon,count);card.onclick=()=>plantFromPicker(id);planting.append(card);cropCards.set(id,{card,count});
 }

 const isDry=()=>bedByIndex.get(selected)?.userData.soilState==='dry';
 function actionDescription(){
  const crop=planted.get(selected);
  if(!crop)return isDry()?'這格是乾枯空地，種植後土壤會變濕潤。':'這格尚未種植，選一種喜歡的作物吧。';
  const label=CROP_TYPES[crop.type].label;
  if(crop.stage===STAGES.length-1)return `${label}成熟了，點擊田格即可收穫！`;
  return isDry()?`${label} · ${STAGES[crop.stage].label}，請澆水${config.growth.pauseWhenDry?'繼續成長':''}。`:`${label} · ${STAGES[crop.stage].label}，土壤濕潤。`;
 }

 function refresh(){
  const current=planted.get(selected),stage=current?.stage??-1;
  const locked=busy||plotActions.has(selected);
  const dry=isDry();
  soilState.textContent=dry?(stage===STAGES.length-1?'乾枯':'乾枯 · 待澆水'):'濕潤';
  for(const button of soilButtons){
   button.setAttribute('aria-pressed',String(button.dataset.debugSoil===(dry?'dry':'wet')));
   button.disabled=locked;
  }
  state.textContent=stage<0?'尚未種植':`${CROP_TYPES[current.type].label} · ${STAGES[stage].label}`;
  harvestCount.textContent=`${CROP_TYPES[selectedType].label} ×${harvestCounts[selectedType]}`;
  stageLabels.forEach((label,i)=>{
   label.classList.toggle('is-current',i===stage);label.classList.toggle('is-complete',i<stage);
   if(i===stage)label.setAttribute('aria-current','step');else label.removeAttribute('aria-current');
  });
  plant.disabled=!readyTypes.has(selectedType)||locked||seeds[selectedType]===0;
  plant.textContent=current?(current.type===selectedType?'重新播種':`改種${CROP_TYPES[selectedType].label}`):`種下${CROP_TYPES[selectedType].label}`;
  const growthPaused=dry&&config.growth.pauseWhenDry;
  grow.disabled=locked||stage<0||stage===STAGES.length-1||growthPaused;
  grow.textContent=stage===STAGES.length-1?'已成熟':current&&growthPaused?'請先澆水':'催熟一階';
  clear.disabled=!current||locked;retry.hidden=!loadError;
  cropSelect.disabled=locked;select.disabled=busy;
  panel.setAttribute('aria-busy',String(locked));
  actions.classList.toggle('is-choosing-crop',!current);
  actions.classList.toggle('is-crop-status',!!current);
  const watering=plotActions.get(selected)==='water',harvesting=plotActions.get(selected)==='harvest';
  actions.classList.toggle('is-watering',watering);
  actions.classList.toggle('is-harvesting',harvesting);
  actionTitle.textContent=harvesting?'正在收穫…':watering?'正在澆水…':current?'作物狀態':'選擇要種植的作物';
  actionSoil.textContent=dry?'乾枯':'濕潤';actionSoil.classList.toggle('is-dry',dry);
  actionStatus.textContent=actionError||(harvesting?'把成熟的作物收進籃子…':watering?'水滴正在滋潤土壤…':busy?`正在準備${CROP_TYPES[selectedType].label}…`:current?actionDescription():`田格 ${plotLabel(selected)} · ${dry?'種植後土壤會變濕潤':'點選作物即可種植'}`);
  planting.hidden=!!current;
  cropStatus.hidden=!current;
  if(current){
   const mature=stage===STAGES.length-1;
   const iconIndex=CROP_TYPES[current.type].iconIndex;
   statusUI.icon.style.backgroundPosition=`${(iconIndex%4)*100/3}% ${iconIndex<4?0:100}%`;
   statusUI.plot.textContent=`田格 ${plotLabel(selected)}`;
   statusUI.name.textContent=CROP_TYPES[current.type].label;
   statusUI.badge.textContent=mature?'🧺 可收穫':dry?'💧 待澆水':'🌱 成長中';
   cropStatus.classList.toggle('is-dry',dry);cropStatus.classList.toggle('is-mature',mature);
   statusUI.step.textContent=`${stage+1} / ${STAGES.length}`;
   statusUI.water.textContent=dry?(mature?'乾枯':'待澆水'):'已澆水';
   statusUI.moisture.textContent=dry?'土壤乾枯':'水分充足';
   statusUI['ready-icon'].textContent=mature?'🧺':dry?'💧':'🕒';
   statusUI.stage.textContent=`階段 ${stage+1}/${STAGES.length}`;
   statusUI['stage-label'].textContent=STAGES[stage].label;
   refreshGrowthClock();
  }
  for(const [id,{card,count}] of cropCards){
   count.textContent=`×${seeds[id]}`;card.disabled=!!current||locked||seeds[id]===0;
   card.setAttribute('aria-label',`種植${CROP_TYPES[id].label}，剩餘 ${seeds[id]} 顆種子`);
   card.classList.toggle('is-preparing',busy&&id===selectedType);
  }
  debugWater.hidden=!current||!dry||stage===STAGES.length-1;debugWater.disabled=locked;
  debugWater.textContent=watering?'澆水中…':'澆水';
  debugHarvest.hidden=stage!==STAGES.length-1;debugHarvest.disabled=locked;
  debugHarvest.textContent=harvesting?'收穫中…':`收穫${current?CROP_TYPES[current.type].label:''}`;
  plotRetry.hidden=!loadError;plotRetry.disabled=locked;
  actions.setAttribute('aria-busy',String(locked));
 }

 function refreshGrowthClock(now=Date.now()){
  const crop=planted.get(selected);if(!crop)return;
  const mature=crop.stage===STAGES.length-1;
  const remaining=growthRemainingMs(crop.growth,config.growth,now);
  const dry=crop.growth.dry,paused=dry&&config.growth.pauseWhenDry;
  const clock=mature?'可以收穫':dry?'需要澆水':formatGrowthTime(remaining);
  const caption=mature?'點擊田格收穫':dry?(paused?'澆水後繼續成長':'土壤乾枯'):crop.stage===STAGES.length-2?'距離成熟':'距離下一階';
  if(statusUI.ready.textContent!==clock)statusUI.ready.textContent=clock;
  if(statusUI.care.textContent!==caption)statusUI.care.textContent=caption;
  statusUI.progress.max=STAGES.length;
  statusUI.progress.value=mature?STAGES.length:crop.stage+1+(1-remaining/crop.growth.durationMs);
  statusUI.progress.setAttribute('aria-valuetext',`${STAGES[crop.stage].label}，${caption}${mature&&!dry?'':` ${clock}`}`);
 }

 function selectionMessage(){
  const current=planted.get(selected),label=CROP_TYPES[selectedType].label;
  if(plotActions.get(selected)==='water'){message.textContent='正在為作物澆水…';return;}
  if(plotActions.get(selected)==='harvest'){message.textContent=`正在收穫${CROP_TYPES[current.type].label}…`;return;}
  message.textContent=current&&current.type!==selectedType
   ?`這格目前種${CROP_TYPES[current.type].label}；改種${label}會從幼苗開始。`
   :actionDescription();
 }

 function choose(index,showActions=false){
  const bed=bedByIndex.get(index);if(!bed||busy)return;
  selected=index;select.value=String(index);
  const current=planted.get(index);if(current)selectedType=current.type;
  cropSelect.value=selectedType;loadError=false;actionError='';selectionMessage();
  if(showActions)actions.hidden=false;
  guide.position.set(bed.position.x,.26,bed.position.z);guide.rotation.z=bed.rotation.y;
  guide.visible=opened||!actions.hidden;refresh();onChange();
  if(opened||!actions.hidden)prepare();
 }

 async function loadStage(type,stageIndex){
  const crop=CROP_TYPES[type],stage=STAGES[stageIndex],key=`${type}:${stage.id}`;
  if(!templates.has(key))templates.set(key,(async()=>{
   const {scene:model}=await loadModel(`${type}-${stage.id}`);
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
   template.add(idle);
   // A grounded, feathered shadow stays still while the foliage sways.
   const shadowCanvas=document.createElement('canvas');shadowCanvas.width=shadowCanvas.height=64;
   const context=shadowCanvas.getContext('2d');
   const gradient=context.createRadialGradient(32,32,2,32,32,32);
   gradient.addColorStop(0,'rgba(48,31,17,.48)');
   gradient.addColorStop(.4,'rgba(48,31,17,.28)');
   gradient.addColorStop(1,'rgba(48,31,17,0)');
   context.fillStyle=gradient;context.fillRect(0,0,64,64);
   const shadowTexture=new THREE.CanvasTexture(shadowCanvas);shadowTexture.colorSpace=THREE.SRGBColorSpace;
   const shadow=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({
    map:shadowTexture,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1,
   }));
   shadow.name='Crop contact shadow';shadow.rotation.x=-Math.PI/2;shadow.position.y=.012;
   const footprint=posedBounds.getSize(new THREE.Vector3());
   template.userData.cropHeight=footprint.y;
   shadow.scale.set(Math.max(.38,footprint.x*1.15),Math.max(.32,footprint.z*1.05),1);
   shadow.raycast=()=>{};
   template.add(shadow);
   if(stageIndex===STAGES.length-1){
    const badge=createHarvestBadge();badge.position.set(0,footprint.y+.72,0);template.add(badge);
   }
   return template;
  })().catch(error=>{templates.delete(key);throw error;}));
  return templates.get(key);
 }

 async function prepare(){
  if(readyTypes.has(selectedType)||busy)return;
  const type=selectedType,label=CROP_TYPES[type].label;
  busy=true;loadError=false;actionError='';message.textContent=`正在準備${label}的三個生長階段…`;refresh();
  try{
   readyModels.set(type,await Promise.all(STAGES.map((_,i)=>loadStage(type,i))));readyTypes.add(type);
   selectionMessage();
  }catch(error){
   console.error(`${type} models failed to load`,error);loadError=true;
   message.textContent=`${label}載入失敗，請按「重新載入模型」。`;
   actionError=`${label}暫時載入失敗，請重新載入作物。`;
  }finally{busy=false;refresh();}
 }

 function replaceCrop(index,type,growth){
   const stage=growth.stage,bed=bedByIndex.get(index);
   // All stages are loaded before planting, so timers never await a model or
   // mutate whichever plot happens to be selected when a request completes.
   const node=readyModels.get(type)[stage].clone(true);
   // Cancel the field's X/Z enlargement so the original asset proportions stay
   // uniform after rotating toward the camera. No thickness or height stretch.
   const parentScale=crops.getWorldScale(new THREE.Vector3());
   node.scale.set(1/parentScale.x,1/parentScale.y,1/parentScale.z);
   node.position.set(bed.position.x,.225,bed.position.z);
   node.userData.plotIndex=index;node.userData.cropType=type;node.userData.growthStage=STAGES[stage].id;
   const progress=stage<STAGES.length-1?createCropProgress():null;
   if(progress){
    progress.sprite.position.set(0,node.userData.cropHeight+.55,0);
    node.add(progress.sprite);
   }
   const thirstyFace=createThirstyFace();
   thirstyFace.position.set(0,node.userData.cropHeight+.72,0);node.add(thirstyFace);
   const previous=planted.get(index);
   if(previous){crops.remove(previous.node);previous.progress?.dispose();} // Model assets belong to cached templates.
   crops.add(node);planted.set(index,{
    type,stage,growth,node,progress,thirstyFace,idle:node.getObjectByName('Crop idle pivot'),born:motionSeconds,
    phase:index*2.39996323+CROP_TYPES[type].iconIndex*.83,
    speed:.9+((index*3)%7)*.035,amplitude:CROP_TYPES[type].idleSway*[1,.9,.8][stage],
   });
   refreshCropIndicator(planted.get(index));
 }

 function place(type){
  if(!readyTypes.has(type)||busy||plotActions.has(selected)||seeds[type]===0)return;
  busy=true;actionError='';
  try{
   replaceCrop(selected,type,createGrowthState(CROP_TYPES[type],STAGES,false,Date.now()));
   soilBeds.setState(selected,'wet');
   selectedType=type;cropSelect.value=type;seeds[type]--;
   selectionMessage();
   onChange();
  }catch(error){
   console.error('Unable to place crop',error);message.textContent=actionError='放置失敗，請再試一次。';
  }finally{busy=false;refresh();}
 }

 function tickGrowth(now=Date.now(),forceIndex=null){
  let changed=false,selectedChanged=false;
  for(const [index,crop] of planted){
   const next={...crop.growth};
   if(advanceGrowth(next,CROP_TYPES[crop.type],config,now,index===forceIndex)){
    replaceCrop(index,crop.type,next);
    soilBeds.setState(index,next.dry?'dry':'wet');
    changed=true;if(index===selected)selectedChanged=true;
   }else crop.growth=next;
  }
  if(selectedChanged){selectionMessage();refresh();}
  if(!actions.hidden)refreshGrowthClock(now);
  const indicatorChanged=refreshCropIndicators(now);
  if(changed||indicatorChanged)onChange();
 }

 function refreshCropIndicator(crop,now=Date.now()){
  const dry=crop.growth.dry,mature=crop.stage===STAGES.length-1;
  const acting=plotActions.has(crop.node.userData.plotIndex);
  let changed=false;
  const indicators=[
   [crop.thirstyFace,dry&&!mature&&!acting],
   [crop.progress?.sprite,!dry&&!acting],
   [crop.node.getObjectByName('Mature crop harvest basket'),!acting],
  ];
  for(const [sprite,visible] of indicators){
   if(sprite&&sprite.visible!==visible){sprite.visible=visible;changed=true;}
  }
  if(crop.progress?.sprite.visible&&crop.progress.set(growthRemainingMs(crop.growth,config.growth,now),crop.growth.durationMs))changed=true;
  return changed;
 }

 function refreshCropIndicators(now=Date.now()){
  let changed=false;
  for(const crop of planted.values())if(refreshCropIndicator(crop,now))changed=true;
  return changed;
 }

 function setPlotSoil(state,index=selected){
  const now=Date.now();
  // Settle elapsed wet time before pausing/resuming a plot's own clock.
  tickGrowth(now);
  soilBeds.setState(index,state);
  const crop=planted.get(index);
  if(crop){crop.growth.dry=state==='dry';crop.growth.updatedAt=now;}
  refreshCropIndicators(now);
  if(index===selected)actionError='';
  selectionMessage();refresh();onChange();
 }

 async function plantFromPicker(type){
  if(busy||plotActions.has(selected)||planted.has(selected)||seeds[type]===0)return;
  const index=selected;
  selectedType=type;cropSelect.value=type;actionError='';loadError=false;refresh();
  await prepare();
  // Closing the picker during loading cancels planting; a failed load uses no seeds.
  if(actions.hidden||selected!==index||planted.has(index)||!readyTypes.has(type))return;
  place(type);
  if(planted.has(index)&&!actions.hidden){
   document.querySelector('#plot-action-close').focus({preventScroll:true});
  }
 }

 function setOpen(value,focus=true){
  opened=docked||value;panel.hidden=!opened;toggle.setAttribute('aria-expanded',String(opened));
  guide.visible=opened||!actions.hidden;onChange();
  if(opened){choose(selected);if(focus)select.focus({preventScroll:true});}
  else if(focus)toggle.focus({preventScroll:true});
 }
 function syncToolPlacement(){
  const hadFocus=panel.contains(document.activeElement);
  docked=desktopTools.matches;
  (docked?document.body:sceneHost).append(panel);
  panel.classList.toggle('is-docked',docked);toggle.hidden=docked;
  setOpen(docked,false);
  if(hadFocus)(docked?select:toggle).focus({preventScroll:true});
 }
 toggle.onclick=()=>setOpen(!opened);close.onclick=()=>setOpen(false);
 select.onchange=()=>choose(Number(select.value));
 cropSelect.onchange=()=>{
  selectedType=cropSelect.value;loadError=false;actionError='';selectionMessage();refresh();prepare();
 };
 document.querySelector('#plot-action-close').onclick=()=>{
  actions.hidden=true;guide.visible=opened;onChange();renderer.domElement.focus({preventScroll:true});
 };
 async function water(){
  // Watering is for existing crops; planting already moistens an empty plot.
  if(busy||!planted.has(selected)||!isDry())return;
  const index=selected,crop=planted.get(index);
  if(crop.stage===STAGES.length-1)return;
  const action=plotActions.start(index,'water');if(!action)return;
  actionError='';refreshCropIndicators();refresh();selectionMessage();
  try{
   const animation=action.effect.play(bedByIndex.get(index),crop.node.userData.cropHeight);
   onChange();await animation;
   // Apply water to the captured plot only after the visual action completes.
   setPlotSoil('wet',index);
  }catch(error){
   console.error('Unable to water crop',error);
   if(index===selected)actionError='澆水暫時失敗，請再點擊田格。';
  }finally{
   plotActions.finish(action);refreshCropIndicators();selectionMessage();refresh();onChange();
  }
 }
 debugWater.onclick=water;
 async function harvest(){
  const index=selected,crop=planted.get(index);
  if(busy||!crop||crop.stage!==STAGES.length-1)return;
  const action=plotActions.start(index,'harvest');if(!action)return;
  actionError='';refreshCropIndicators();refresh();selectionMessage();
  let completed=false;
  try{
   const animation=action.effect.play(bedByIndex.get(index),crop.idle,crop.node.userData.cropHeight,CROP_TYPES[crop.type].label);
   onChange();await animation;
   // Commit this captured crop once, after the collection animation finishes.
   if(planted.get(index)===crop){
    crops.remove(crop.node);crop.progress?.dispose();planted.delete(index);
    harvestCounts[crop.type]++;completed=true;
   }
  }catch(error){
   console.error('Unable to harvest crop',error);
   if(index===selected)actionError='收穫暫時失敗，請再點擊田格。';
  }finally{
   plotActions.finish(action);refreshCropIndicators();selectionMessage();refresh();
   if(completed&&index===selected){
    message.textContent=actionStatus.textContent=`已收穫${CROP_TYPES[crop.type].label} ×1，可以重新種植了！`;
   }
   onChange();
  }
 }
 debugHarvest.onclick=harvest;
 // Debug overrides can set either soil condition even on an empty plot.
 for(const button of soilButtons)button.onclick=()=>{
  if(busy||plotActions.has(selected))return;
  setPlotSoil(button.dataset.debugSoil);
 };
 plant.onclick=()=>place(selectedType);
 grow.onclick=()=>{if(!busy&&!plotActions.has(selected))tickGrowth(Date.now(),selected);};
 clear.onclick=()=>{
  const crop=planted.get(selected);if(!crop||busy||plotActions.has(selected))return;
  crops.remove(crop.node);crop.progress?.dispose();planted.delete(selected);actionError='';message.textContent=`${plotLabel(selected)} 已清空。`;refresh();onChange();
 };
 retry.onclick=prepare;
 plotRetry.onclick=prepare;
 document.addEventListener('keydown',event=>{
  if(event.key!=='Escape')return;
  if(!actions.hidden){event.preventDefault();document.querySelector('#plot-action-close').click();}
  else if(opened&&!docked){event.preventDefault();setOpen(false);}
 });

 const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();let pointerStart=null;
 renderer.domElement.addEventListener('pointerdown',event=>{
  if(!busy&&event.isPrimary&&event.button===0)pointerStart={id:event.pointerId,x:event.clientX,y:event.clientY};
 });
 renderer.domElement.addEventListener('pointercancel',()=>{pointerStart=null;});
 renderer.domElement.addEventListener('pointerup',event=>{
  const start=pointerStart;pointerStart=null;
  if(busy||!start||event.pointerId!==start.id||Math.hypot(event.clientX-start.x,event.clientY-start.y)>8)return;
  const rect=renderer.domElement.getBoundingClientRect();
  pointer.set((event.clientX-rect.left)/rect.width*2-1,1-(event.clientY-rect.top)/rect.height*2);
  camera.updateMatrixWorld();plots.updateMatrixWorld(true);raycaster.setFromCamera(pointer,camera);
  const hit=raycaster.intersectObjects(beds,false)[0];if(!hit)return;
  choose(hit.object.userData.plotIndex,true);
  // Mature crops can be collected even if a debug override dried the soil.
  // Merely changing the debug selection never triggers a farm action.
  const crop=planted.get(selected);
  if(crop?.stage===STAGES.length-1)void harvest();
  else if(crop&&isDry())void water();
 });
 renderer.domElement.classList.add('is-picking-plot');renderer.domElement.tabIndex=0;
 choose(selected);
 desktopTools.addEventListener('change',syncToolPlacement);
 syncToolPlacement();
 // Gameplay keeps time even with reduced motion or a throttled background tab.
 setInterval(()=>tickGrowth(),1000);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)tickGrowth();});
 return {
  get hasCrops(){return planted.size>0;},
  update(seconds,animate=true){
   plotActions.update();
   if(animate)motionSeconds=seconds;
   for(const crop of planted.values()){
    if(plotActions.get(crop.node.userData.plotIndex)==='harvest')continue;
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
