import { addCottageFlowers } from './clay-flowers.js';
import { FIELD, DOCK, FARM_VIEW, fieldPoint } from './clay-layout.js';
import { addTreeModels } from './clay-trees.js';
import * as THREE from 'three';
import { loadModel, preloadModels } from './clay-models.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { createLandscape, createDepthRenderer } from './clay-landscape.js';
import { createFarmPaths, isFarmPath } from './clay-paths.js';
import { addNaturalGrass } from './clay-grass.js';
import { createDriftingClouds } from './clay-clouds.js';
import { createSoilBeds } from './clay-soil.js';
import { createFarmLoading } from './clay-loading.js';
import { createFarmDebug } from './clay-debug.js';
import { loadFarmConfig } from './clay-config.js';

// Download every scene model in parallel; the stages below still assemble them in order.
preloadModels(['grass-tile','fence','trellis-fence-panel','apple-tree','cottage','tool-shed','hay-bale',
 'windmill-tower','windmill-sails','landscape-rocks','dock','river-tile','dirt-path',
 'lily-pads','water-plants','river-reeds','fish-01','tree-small','tree-medium','tree-large','fluffy-cloud']);
const host = document.querySelector('#viewport');
const loading = createFarmLoading();
loading.start('config');
let farmConfig;
try { farmConfig=await loadFarmConfig(); }
catch(error){loading.fail('作物設定載入失敗，請確認配置檔後重新載入。');throw error;}
const notice = document.querySelector('#notice');
const smokePuffs=[];
let smokeElapsed=0;
let smokeReady=false;
let windmillBlades=null;
let riverReady=false;
let fishReady=false;
let skyClouds=null;
let farmCrops=null;
const scene = new THREE.Scene();
scene.background = new THREE.Color('#36b6f4');
scene.fog = new THREE.Fog('#b0d8e8',85,170);
const camera = new THREE.PerspectiveCamera(50,1,.1,180);
camera.position.fromArray(FARM_VIEW.position); camera.lookAt(...FARM_VIEW.target);
let renderer;
try { renderer = new THREE.WebGLRenderer({antialias:true}); }
catch { loading.fail('無法啟動 3D 場景，請使用支援 WebGL 的瀏覽器。'); throw new Error('WebGL unavailable'); }
renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.04;
host.appendChild(renderer.domElement);
// Cream-colored skylight and a quiet fill keep the clay's shaded sides readable.
scene.add(new THREE.HemisphereLight('#f5eddc','#998467',2.05));
const sun = new THREE.DirectionalLight('#ffe7c5',2.15);sun.position.set(-8,17,8);sun.castShadow=true;
sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-14,right:14,top:14,bottom:-14,near:1,far:50});
sun.shadow.radius=3.6;sun.shadow.intensity=.78;sun.shadow.normalBias=.035;sun.shadow.bias=-.00015;scene.add(sun);
const skyFill=new THREE.DirectionalLight('#e4edf1',.48);skyFill.position.set(12,9,-7);scene.add(skyFill);
const world = new THREE.Group();world.name='Farm foreground';scene.add(world);
const mats = new Map();
function material(color){if(!mats.has(color))mats.set(color,new THREE.MeshStandardMaterial({color,roughness:.94}));return mats.get(color);}
function softenTerracotta(model){
 const finish=source=>{
  const mat=source.clone();
  mat.onBeforeCompile=shader=>{
   shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
    vec3 originalBrick=diffuseColor.rgb;
    float brickMask=smoothstep(.055,.18,originalBrick.r-max(originalBrick.g,originalBrick.b))
      *smoothstep(1.9,2.8,originalBrick.r/max(originalBrick.g,.015));
    float brickLight=dot(originalBrick,vec3(.2126,.7152,.0722));
    vec3 orangeClay=pow(max(brickLight,.001),.8)*vec3(3.1,.76,.36);
    vec3 warmBrick=mix(originalBrick,orangeClay,.82);
    diffuseColor.rgb=mix(originalBrick,warmBrick,brickMask);
   `);
  };
  mat.customProgramCacheKey=()=> 'warm-orange-terracotta-v2';
  return mat;
 };
 model.traverse(mesh=>{if(mesh.isMesh)mesh.material=Array.isArray(mesh.material)?mesh.material.map(finish):finish(mesh.material);});
}
function softenClayRelief(root=scene){
 const seen=new Set();
 root.traverse(object=>{if(object.isMesh)for(const mat of Array.isArray(object.material)?object.material:[object.material]){
  if(seen.has(mat)||!mat.isMeshStandardMaterial||mat.transparent)continue;
  seen.add(mat);mat.roughness=Math.max(.96,mat.roughness);
  if(mat.normalMap)mat.normalScale.multiplyScalar(.42);
  if(mat.bumpMap)mat.bumpScale*=.8;
  if(mat.aoMap)mat.aoMapIntensity*=.75;
 }});
}
function mesh(geo,color,x,y,z,parent=world){const m=new THREE.Mesh(geo,material(color));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
function box(w,h,d,c,x,y,z,r=.1,parent=world){return mesh(new RoundedBoxGeometry(w,h,d,2,r),c,x,y,z,parent);}
function ball(x,y,z,s,c,parent=world){return mesh(new THREE.SphereGeometry(s,16,12),c,x,y,z,parent);}
function cylinder(x,y,z,r1,r2,h,c,parent=world){return mesh(new THREE.CylinderGeometry(r1,r2,h,10),c,x,y,z,parent);}
let seed=19;function rand(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;}
// Each environment prop is grouped so incoming artist models can replace it independently.
const grassFallback = new THREE.Group();world.add(grassFallback);
box(18,.55,16,'#9aaf67',0,-.5,-.7,.25,grassFallback);
box(18,.32,16,'#b8c780',0,-.2,-.7,.2,grassFallback);
const {landscape,terrainHeight,flowerPlacements,addRockClusters,addRiverTiles,updateRiver,addGrassCover,addCourtyardMeadow,
 replaceTrees,addLilyPads,addWaterFlowers,addRiverReeds,addFish}=createLandscape(scene,renderer,camera);
const depthRenderer=createDepthRenderer(renderer,scene,camera);
const {applyPathModel}=createFarmPaths(world,renderer,terrainHeight);
const {x:fieldX,z:fieldZ,offset:fieldOffset}=FIELD;
function enlargeField(group){group.scale.set(fieldX,1,fieldZ);group.position.set(FIELD.offsetX,0,fieldOffset);}
const plots = new THREE.Group();plots.name='Soil tiles';world.add(plots);enlargeField(plots);
const placeholders=[];
for(let row=0;row<FIELD.rows;row++)for(let col=0;col<FIELD.columns;col++){
 const x=(col-(FIELD.columns-1)/2)*FIELD.pitch,z=(row-(FIELD.rows-1)/2)*FIELD.pitch+.9;
 const tile=box(1.9,.22,1.9,'#916840',x,.09,z,.15,plots);
 tile.userData.plotIndex=placeholders.length;placeholders.push(tile);
}
const fenceFallback=new THREE.Group();world.add(fenceFallback);
enlargeField(fenceFallback);
const fenceRuns=[];
const fallbackPosts=new Set();
function fencePost(x,z){const key=`${x.toFixed(4)},${z.toFixed(4)}`;if(fallbackPosts.has(key))return;fallbackPosts.add(key);cylinder(x,.45,z,.085,.12,.95,'#a27a4c',fenceFallback);ball(x,.95,z,.105,'#c49a65',fenceFallback);}
function fenceLine(x1,z1,x2,z2,n){fenceRuns.push({x1,z1,x2,z2});for(let i=0;i<=n;i++)fencePost(x1+(x2-x1)*i/n,z1+(z2-z1)*i/n);for(const h of [.34,.69]){const rail=box(Math.hypot(x2-x1,z2-z1),.1,.12,'#ba945f',(x1+x2)/2,h,(z1+z2)/2,.04,fenceFallback);rail.rotation.y=-Math.atan2(z2-z1,x2-x1);}}
const fieldHalfWidth=FIELD.columns*FIELD.pitch/2+.25;
const fieldHalfDepth=FIELD.rows*FIELD.pitch/2+.15;
const fieldBack=.75-fieldHalfDepth,fieldFront=.75+fieldHalfDepth+FIELD.frontFenceOffset;
fenceLine(-fieldHalfWidth,fieldBack,-fieldHalfWidth,fieldFront,FIELD.rows+3);
fenceLine(-fieldHalfWidth,fieldFront,fieldHalfWidth-.45,fieldFront,FIELD.columns+2);
fenceLine(fieldHalfWidth,fieldBack,fieldHalfWidth,fieldFront-FIELD.frontFenceOffset-1.9,FIELD.rows+2);
fenceLine(-fieldHalfWidth+.75,fieldBack-.05,1,fieldBack-.05,FIELD.columns);
const simpleTrees=[];
function tree(x,z,size=1,apples=false){const g=new THREE.Group();g.position.set(x,0,z);g.scale.setScalar(size);world.add(g);if(!apples)simpleTrees.push({object:g,x,z,size,y:terrainHeight(x,z)});cylinder(0,.85,0,.17,.28,1.7,'#8b6b43',g);for(let i=0;i<13;i++){const a=i*2.4;ball(Math.cos(a)*.65,1.7+rand()*.8,Math.sin(a)*.6,.62,['#7f984d','#93a758','#a8b967'][i%3],g);}if(apples)for(let i=0;i<8;i++){let a=i*2.4;ball(Math.cos(a)*1,1.8+rand()*.5,Math.sin(a)*.85,.14,'#c9754a',g);}return g;}
const appleTreeFallback=tree(-7,-5.05,1.8,true);
tree(8,-12,.95);tree(-13,-6.8,1.1);tree(10,3.5,1.1);tree(-12,5,.85);tree(10.5,6,.8);
function house(x,z,scale=1){const g=new THREE.Group();g.position.set(x,0,z);g.scale.setScalar(scale);world.add(g);
box(2.65,1.9,2.2,'#eddaba',0,1,0,.16,g);box(2.8,.23,2.4,'#b29a72',0,.15,0,.1,g);
// Two pitched roof slopes, tiled with rounded terracotta shingles.
for(const side of [-1,1]){const roof=box(1.85,.18,2.7,'#bd7554',side*.7,2.25,0,.06,g);roof.rotation.z=-side*.6;for(let r=0;r<4;r++)for(let c=0;c<7;c++){const tile=box(.49,.14,.42,['#c97c58','#d58a62','#d18a66'][(r+c)%3],side*(.21+r*.4),2.68-r*.275,-1.15+c*.38,.07,g);tile.rotation.z=-side*.6;}}
box(.64,1.15,.15,'#896845',-.25,.71,1.14,.15,g);for(let i=0;i<4;i++)box(.025,.8,.025,'#705536',-.46+i*.14,.7,1.235,.008,g);ball(-.05,.72,1.26,.045,'#d9b260',g);
for(const x of [-.93,.83]){box(.47,.56,.13,'#9f794f',x,1.25,1.14,.15,g);box(.30,.37,.15,'#495750',x,1.26,1.16,.09,g);box(.04,.4,.04,'#cbae79',x,1.26,1.26,.01,g);}
box(.43,1,.46,'#ddcaae',.7,2.5,-.5,.05,g);box(.54,.16,.56,'#c6b395',.7,3,-.5,.04,g);
for(let i=0;i<3;i++)box(1,.14, .4,'#c3b79a',-.25,.12+i*.12,1.85-i*.28,.05,g);
return g;}
const cottageFallback=house(-.8,-6.7,2);
const mill=new THREE.Group();mill.position.set(-10.17,0,-.12);mill.rotation.y=Math.PI/2;world.add(mill);
cylinder(0,1.25,0,.7,1,2.5,'#e8d6b4',mill);const roof=mesh(new THREE.ConeGeometry(1.2,1.1,12),'#c67d59',0,3,0,mill);
box(.5,.9,.13,'#876749',0,.48,.92,.15,mill);
const rotor=new THREE.Group();rotor.position.set(0,2.65,.9);mill.add(rotor);
for(let i=0;i<4;i++){const arm=new THREE.Group();arm.rotation.z=i*Math.PI/2+.35;rotor.add(arm);box(.10,1.7,.13,'#93764d',0,.9,0,.035,arm);box(.43,1.08,.08,'#eee0ba',.14,1.12,0,.04,arm);for(let j=0;j<4;j++)box(.46,.035,.1,'#b89a66',.14,.7+j*.27,.05,.008,arm);}ball(0,0,.15,.2,'#96794e',rotor);
// Keep the original courtyard position beside the cottage for both shed versions.
const shedFallback=new THREE.Group();shedFallback.name='Courtyard tool shed fallback';shedFallback.position.set(3.7,0,-6.6);shedFallback.scale.setScalar(.87);world.add(shedFallback);
box(3.6,.24,2.8,'#367f9b',0,3.15,0,.12,shedFallback);
for(const x of [-1.5,1.5])for(const z of [-1.1,1.1])box(.22,3.1,.22,'#a6753f',x,1.55,z,.07,shedFallback);
for(let i=0;i<8;i++)box(.36,2.7,.16,i%2?'#a67440':'#b9844c',-1.35+i*.38,1.35,-1.1,.04,shedFallback);
for(let i=0;i<6;i++)box(.82,.55,.72,'#d8af48',-.7+(i%2)*.86,.3+Math.floor(i/2)*.55,-.55,.09,shedFallback);
// Reuse the cottage's sculpted flower bed instead of primitive flowers.
addCottageFlowers(landscape,terrainHeight,flowerPlacements).catch(error=>console.error('Cottage flowers failed to load',error));
for(const [x,z] of [[3.9,-4.9],[-3.8,-5.2]]){cylinder(x,.37,z,.32,.3,.72,'#a57d50');for(const y of [.15,.57]){const ring=mesh(new THREE.TorusGeometry(.315,.028,6,12),'#655f49',x,y,z);ring.rotation.x=Math.PI/2;}}
// Keep the simple dock until the supplied asset has loaded successfully.
const {x:bridgeX,z:bridgeZ,length:bridgeLength}=DOCK;
const dockFallback=new THREE.Group();world.add(dockFallback);
for(let i=0;i<22;i++)box(1.65,.13,bridgeLength/22,'#b58b5d',bridgeX,.12,bridgeZ-bridgeLength/2+(i+.5)*bridgeLength/22,.045,dockFallback);
for(const x of [bridgeX-.8,bridgeX+.8])for(const z of [bridgeZ-bridgeLength*.42,bridgeZ+bridgeLength*.42]){cylinder(x,.05,z,.1,.13,1,'#97734b',dockFallback);ball(x,.57,z,.12,'#c6a270',dockFallback);}
// Small clusters give the scene a handmade garden silhouette.
for(let i=0;i<140;i++){
 const x=-8.4+rand()*16.8,z=-8+rand()*14.8;
 if((Math.abs(x)<7.3 && z>-4 && z<10.3)||(z<-4&&Math.abs(x)<7))continue;
 if(isFarmPath(x,z,.35))continue;
 const s=.09+rand()*.2;ball(x,.1,z,s,['#8a9e57','#9eaf65','#b3bd79'][i%3]);
 if(i%4===0){cylinder(x,.2,z,.022,.025,.4,'#7b9351');for(let p=0;p<5;p++)ball(x+Math.cos(p*1.256)*.065,.41,z+Math.sin(p*1.256)*.065,.05,'#f4ecd4');ball(x,.43,z,.04,'#d9b867');}
}
// A few small stones sit beside the lane, leaving its center as open dirt.
const pathStoneFallback=new THREE.Group();world.add(pathStoneFallback);
const pathStonePlacements=[{x:5.95,z:.4,width:.32},{x:3.2,z:6.4,width:.26},{x:-6.1,z:4.1,width:.28}].map(p=>{const [x,z]=fieldPoint(p.x,p.z);return {...p,x,z};});
for(const {x,z,width} of pathStonePlacements){
 const stone=ball(x,terrainHeight(x,z)+.04,z,width*.5,'#b9b6a0',pathStoneFallback);stone.scale.set(1,.42,.8);
}
function render(){skyClouds?.update(smokeElapsed);depthRenderer.render();}
let zoom=1;
function resize(){
 const w=host.clientWidth,h=host.clientHeight;
 camera.aspect=w/h;
 camera.fov=w<h?THREE.MathUtils.radToDeg(2*Math.atan(Math.tan(THREE.MathUtils.degToRad(FARM_VIEW.fov/2))*.46/Math.min(camera.aspect,.46))):40;
 camera.zoom=zoom;
 // Tall phone frames need less empty sky; lift the composition without
 // changing the farm's scale, viewing angle or raycast coordinates.
 const lift=Math.min(Math.max(0,h-w*1.65)*.22,h*.10);
 camera.setViewOffset(w,h,0,lift,w,h);
 renderer.setSize(w,h);depthRenderer.resize(w,h);render();
}
window.addEventListener('resize',resize);
function changeZoom(delta){zoom=THREE.MathUtils.clamp(zoom+delta,.75,1.65);resize();}
renderer.domElement.addEventListener('wheel',e=>{e.preventDefault();changeZoom(e.deltaY<0?.06:-.06);},{passive:false});
resize();
loading.start('soil');
let soilBeds=null;
try {
 soilBeds=createSoilBeds(plots,placeholders.map(p=>p.position));
 for(const p of placeholders){plots.remove(p);p.geometry.dispose();}
 render();
} catch(error){console.error(error);notice.textContent='土面材質建立失敗，目前顯示簡化土塊。重新整理可再試一次。';notice.hidden=false;render();}
loading.start('grass');
try {
 const {scene:grass}=await loadModel('grass-tile');
 const bounds=new THREE.Box3().setFromObject(grass),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
 // Four shared tiles cover the soil footprint and its narrow grassy border.
 const grassWidth=FIELD.columns*FIELD.pitch+.95,grassDepth=FIELD.rows*FIELD.pitch+.95+FIELD.frontFenceOffset;
 const scale=new THREE.Vector3((grassWidth+.05)/2/size.x,.16/size.y,(grassDepth+.05)/2/size.z);
 grass.traverse(m=>{if(m.isMesh){m.receiveShadow=true;m.castShadow=false;}});
 const ground=new THREE.Group();ground.name='Farmland grass GLB';world.add(ground);enlargeField(ground);
 for(const x of [-grassWidth/4,grassWidth/4])for(const z of [.75+FIELD.frontFenceOffset/2-grassDepth/4,.75+FIELD.frontFenceOffset/2+grassDepth/4]){
  const tile=grass.clone(true);tile.scale.copy(scale);
  tile.position.set(x-center.x*scale.x,.13-bounds.max.y*scale.y,z-center.z*scale.z);ground.add(tile);
 }
 addGrassCover(grass);
 addNaturalGrass(world,grass,terrainHeight);
 world.remove(grassFallback);grassFallback.traverse(m=>{if(m.isMesh)m.geometry.dispose();});
} catch(error){console.error(error);notice.textContent+=(notice.textContent?' ':'')+'草地模型載入失敗，目前保留簡化草地。重新整理可再試一次。';notice.hidden=false;}
loading.start('fence');
try {
 const {scene:fence}=await loadModel('fence');
 const bounds=new THREE.Box3().setFromObject(fence),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
 const group=new THREE.Group();group.name='Farm fence GLB';
 const uniformScale=.70/size.y;
 const postX=center.x-size.x*.41,postSpan=size.x*.82;
 const parts=[];
 // Reuse the original textured triangles: one complete left post and the two
 // middle rails. The cuts overlap inside the posts so no open ends are visible.
 fence.traverse(m=>{if(m.isMesh){
  const source=m.geometry,position=source.attributes.position,index=source.index;
  const postIndices=[],railIndices=[];
  for(let i=0;i<index.count;i+=3){
   const a=index.getX(i),b=index.getX(i+1),c=index.getX(i+2);
   const x=(position.getX(a)+position.getX(b)+position.getX(c))/3;
   if(x<center.x-size.x*.31)postIndices.push(a,b,c);
   if(Math.abs(x-center.x)<size.x*.35)railIndices.push(a,b,c);
  }
  const makePart=indices=>{
   const geometry=new THREE.BufferGeometry();
   for(const [name,attribute] of Object.entries(source.attributes))geometry.setAttribute(name,attribute);
   geometry.setIndex(indices);geometry.computeBoundingSphere();
   const part=new THREE.Mesh(geometry,m.material);part.castShadow=true;part.receiveShadow=true;return part;
  };
  parts.push({post:makePart(postIndices),rails:makePart(railIndices)});
 }});
 const posts=new Set();
 for(const {x1,z1,x2,z2} of fenceRuns){
  const length=Math.hypot(x2-x1,z2-z1);
  const count=Math.max(1,Math.round(length/(postSpan*uniformScale))),spacing=length/count;
  const rotation=-Math.atan2(z2-z1,x2-x1);
  for(let i=0;i<=count;i++){
   const x=x1+(x2-x1)*i/count,z=z1+(z2-z1)*i/count;
   const key=`${x.toFixed(4)},${z.toFixed(4)}`;
   if(!posts.has(key)){
    posts.add(key);const pillar=new THREE.Group();pillar.name='Shared fence post';pillar.position.set(x,0,z);pillar.rotation.y=rotation;
    for(const {post} of parts){const model=post.clone();model.scale.setScalar(uniformScale);model.position.set(-postX*uniformScale,-bounds.min.y*uniformScale+.035,-center.z*uniformScale);pillar.add(model);}
    group.add(pillar);
   }
   if(i===count)continue;
   const segment=new THREE.Group();segment.name='Fence rails';segment.rotation.y=rotation;
   segment.position.set(x+(x2-x1)/count/2,0,z+(z2-z1)/count/2);
   for(const {rails} of parts){const model=rails.clone();const scaleX=spacing/postSpan;model.scale.set(scaleX,uniformScale,uniformScale);model.position.set(-center.x*scaleX,-bounds.min.y*uniformScale+.035,-center.z*uniformScale);segment.add(model);}
   group.add(segment);
  }
 }
 enlargeField(group);world.add(group);world.remove(fenceFallback);
 fenceFallback.traverse(m=>{if(m.isMesh)m.geometry.dispose();});
} catch(error){console.error(error);notice.textContent+=(notice.textContent?' ':'')+'欄杆模型載入失敗，目前保留簡化圍欄。重新整理可再試一次。';notice.hidden=false;}
loading.start('trellis');
try{
 const {scene:panel}=await loadModel('trellis-fence-panel');
 const bounds=new THREE.Box3().setFromObject(panel),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
 const start=new THREE.Vector2(-13.4,-1.5),end=new THREE.Vector2(-5.9,-9.6);
 const direction=end.clone().sub(start),length=direction.length();direction.normalize();
 const count=3,postOverlap=.18,panelWidth=(length+(count-1)*postOverlap)/count;
 const scale=panelWidth/size.x;
 panel.traverse(mesh=>{if(mesh.isMesh){mesh.castShadow=true;mesh.receiveShadow=true;}});
 const rearFence=new THREE.Group();rearFence.name='Rear courtyard trellis GLB';
 for(let i=0;i<count;i++){
  const distance=panelWidth/2+i*(panelWidth-postOverlap);
  const x=start.x+direction.x*distance,z=start.y+direction.y*distance;
  const section=new THREE.Group();section.position.set(x,terrainHeight(x,z)+.025,z);
  section.rotation.y=-Math.atan2(direction.y,direction.x);
  const model=panel.clone(true);model.scale.setScalar(scale);
  model.position.set(-center.x*scale,-bounds.min.y*scale,-center.z*scale);
  section.add(model);rearFence.add(section);
 }
 world.add(rearFence);
 addCourtyardMeadow(world,start,end);
}catch(error){console.error(error);notice.textContent+=(notice.textContent?' ':'')+'風車後方的木格柵載入失敗，重新整理可再試一次。';notice.hidden=false;}
loading.start('apple');
try {
 const {scene:appleTree}=await loadModel('apple-tree');
 const bounds=new THREE.Box3().setFromObject(appleTree),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
 const scale=5.8/size.y;
 appleTree.name='Apple tree GLB';appleTree.scale.setScalar(scale);
 appleTree.position.set(-6.1-center.x*scale,-.04-bounds.min.y*scale,-6-center.z*scale);
 appleTree.traverse(m=>{if(m.isMesh){m.castShadow=true;m.receiveShadow=true;}});
 world.add(appleTree);world.remove(appleTreeFallback);
 appleTreeFallback.traverse(m=>{if(m.isMesh)m.geometry.dispose();});
} catch(error){console.error(error);notice.textContent+=(notice.textContent?' ':'')+'蘋果樹模型載入失敗，目前保留簡化樹木。重新整理可再試一次。';notice.hidden=false;}
loading.start('cottage');
try {
 const {scene:cottage}=await loadModel('cottage');
 softenTerracotta(cottage);
 const bounds=new THREE.Box3().setFromObject(cottage),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
 // Deepen the house toward the rear while anchoring its front steps to the path.
 const scale=6.6/size.y;
 const cottageDepth=1;
 cottage.name='Country cottage GLB';cottage.scale.set(scale,scale,scale*cottageDepth);
 cottage.position.set(-1.3-center.x*scale,-.04-bounds.min.y*scale,-7.4-center.z*scale-bounds.max.z*scale*(cottageDepth-1));
 cottage.traverse(m=>{if(m.isMesh){
  m.castShadow=true;m.receiveShadow=true;
  // Remove only the baked smoke above the chimney mouth, preserving the
  // original file, UVs, cottage and chimney. New puffs have their own lifecycle.
  const geometry=m.geometry.clone(),position=geometry.attributes.position;
  const index=geometry.index,kept=[];
  const isSmoke=i=>position.getY(i)>.50&&position.getX(i)>.12&&position.getZ(i)<-.20;
  for(let i=0;i<index.count;i+=3){
   const a=index.getX(i),b=index.getX(i+1),c=index.getX(i+2);
   if(!isSmoke(a)&&!isSmoke(b)&&!isSmoke(c))kept.push(a,b,c);
  }
  geometry.setIndex(kept);geometry.computeBoundingBox();geometry.computeBoundingSphere();
  m.geometry=geometry;
 }});
 const smoke=new THREE.Group();smoke.name='Rising clay smoke';cottage.add(smoke);
 // Keep puffs round while their origin follows the stretched chimney.
 smoke.scale.z=1/cottageDepth;
 smoke.position.z=-.34*(1-1/cottageDepth);
 const puffGeometry=new THREE.SphereGeometry(1,12,10);
 for(let i=0;i<10;i++){
  const puff=new THREE.Group();
  const mat=new THREE.MeshLambertMaterial({color:'#ece6d9',transparent:true,opacity:0,depthWrite:false});
  // Overlapping lobes create soft, irregular clay clouds instead of beads.
  for(const [x,y,z,r] of [[0,0,0,1],[-.46,-.12,.1,.68],[.36,.24,-.12,.77],[.1,-.25,.37,.55]]){
   const lobe=new THREE.Mesh(puffGeometry,mat);lobe.position.set(x,y,z);lobe.scale.setScalar(r);puff.add(lobe);
  }
  smoke.add(puff);smokePuffs.push({group:puff,material:mat,offset:i/10,seed:i*2.39996});
 }
 updateSmoke(0);
 world.add(cottage);world.remove(cottageFallback);
 cottageFallback.traverse(m=>{if(m.isMesh)m.geometry.dispose();});
 smokeReady=true;
} catch(error){console.error(error);notice.textContent+=(notice.textContent?' ':'')+'農舍模型載入失敗，目前保留簡化房屋。重新整理可再試一次。';notice.hidden=false;}
loading.start('shed');
try {
 const {scene:shed}=await loadModel('tool-shed');
 const bounds=new THREE.Box3().setFromObject(shed),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
 const scale=2.85/size.y;
 // Preserve the artist's proportions; the open front faces the field and camera.
 const placedShed=new THREE.Group();placedShed.name='Blue roof tool shed GLB';placedShed.position.copy(shedFallback.position);
 shed.scale.setScalar(scale);shed.position.set(-center.x*scale,-bounds.min.y*scale-.035,-center.z*scale);
 shed.traverse(m=>{if(m.isMesh){
  m.castShadow=true;m.receiveShadow=true;
  for(const mat of Array.isArray(m.material)?m.material:[m.material]){
   mat.metalness=0;mat.roughness=.94;if(mat.normalScale)mat.normalScale.set(.5,.5);
  }
 }});
 placedShed.add(shed);world.add(placedShed);world.remove(shedFallback);
 shedFallback.traverse(m=>{if(m.isMesh)m.geometry.dispose();});
} catch(error){console.error(error);notice.textContent+=(notice.textContent?' ':'')+'棚屋模型載入失敗，目前保留簡化棚屋。重新整理可再試一次。';notice.hidden=false;}
loading.start('hay');
try {
 const {scene:hay}=await loadModel('hay-bale');
 const bounds=new THREE.Box3().setFromObject(hay),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
 hay.traverse(m=>{if(m.isMesh){
  m.castShadow=true;m.receiveShadow=true;
  for(const mat of Array.isArray(m.material)?m.material:[m.material]){
   mat.metalness=0;mat.roughness=1;if(mat.normalScale)mat.normalScale.set(.55,.55);
  }
 }});
 const hayDecor=new THREE.Group();hayDecor.name='Courtyard hay bale decorations';
 function placeHay(x,z,width,angle,baseY=terrainHeight(x,z)+.01){
  const scale=width/size.x,placement=new THREE.Group(),model=hay.clone(true);
  placement.name='Clay hay bale';placement.position.set(x,baseY,z);placement.rotation.y=angle;
  model.scale.setScalar(scale);model.position.set(-center.x*scale,-bounds.min.y*scale,-center.z*scale);
  placement.add(model);hayDecor.add(placement);
  return size.y*scale;
 }
 // A broad four-bale base supports two middle bales and a smaller top bale.
 const stackBase=terrainHeight(-7.535,-2)+.01;
 const baleHeight=placeHay(-8.25,-2,1.35,.08,stackBase);
 placeHay(-6.82,-2.02,1.35,-.07,stackBase);
 placeHay(-8.9,-2.85,1.18,-.06,stackBase);
 placeHay(-7.63,-2.88,1.18,.05,stackBase);
 const middleBase=stackBase+baleHeight-.08;
 const middleHeight=placeHay(-8.22,-2.45,1.3,.04,middleBase);
 placeHay(-6.85,-2.48,1.3,-.1,middleBase);
 placeHay(-7.535,-2.46,1.22,.12,middleBase+middleHeight-.08);
 // Small accents stay outside the field, shed footprint and walking routes.
 placeHay(-7.8,1.45,1.08,.48);
 placeHay(5,-4.7,1.1,-.16);
 world.add(hayDecor);
} catch(error){console.error(error);notice.textContent+=(notice.textContent?' ':'')+'稻草模型載入失敗，重新整理可再試一次。';notice.hidden=false;}
loading.start('windmill');
try {
 const loaded=await Promise.allSettled([loadModel('windmill-tower'),loadModel('windmill-sails')]);
 const failure=loaded.find(result=>result.status==='rejected');
 if(failure)throw failure.reason;
 const tower=loaded[0].value.scene,sails=loaded[1].value.scene;
 softenTerracotta(tower);
 const bounds=new THREE.Box3().setFromObject(tower),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
 const towerScale=6.3/size.y;
 const windmill=new THREE.Group();windmill.name='Clay windmill';windmill.position.set(-10.17,-.04,-.12);
 windmill.rotation.y=Math.PI/2;
 tower.scale.setScalar(towerScale);tower.position.set(-center.x*towerScale,-bounds.min.y*towerScale,-center.z*towerScale);
 windmill.add(tower);
 // Shorten only the rear shaft; keep the four sails and front hub proportions.
 sails.traverse(m=>{if(m.isMesh){
  const geometry=m.geometry.clone(),position=geometry.attributes.position;
  for(let i=0;i<position.count;i++){
   const z=position.getZ(i),radius=Math.hypot(position.getX(i),position.getY(i));
   const shaft=1-THREE.MathUtils.smoothstep(radius,.14,.24);
   if(z<.015)position.setZ(i,z-(z-.015)*.65*shaft);
  }
  position.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();m.geometry=geometry;
 }});
 const bladeBounds=new THREE.Box3().setFromObject(sails),bladeSize=bladeBounds.getSize(new THREE.Vector3());
 const bladeScale=5.4/Math.max(bladeSize.x,bladeSize.y);
 // The hub is near local (0,0); rotate around it, not the blade bounding box.
 sails.scale.setScalar(bladeScale);sails.position.z=-bladeBounds.min.z*bladeScale;
 windmillBlades=new THREE.Group();windmillBlades.name='Windmill rotating hub';
 windmillBlades.position.set(-center.x*towerScale,(.40-bounds.min.y)*towerScale,(.53-center.z)*towerScale);
 windmillBlades.add(sails);windmill.add(windmillBlades);
 windmill.traverse(m=>{if(m.isMesh){m.castShadow=true;m.receiveShadow=true;}});
 sails.traverse(m=>{if(m.isMesh)m.castShadow=true;});
 world.add(windmill);world.remove(mill);mill.traverse(m=>{if(m.isMesh)m.geometry.dispose();});
} catch(error){console.error(error);notice.textContent+=(notice.textContent?' ':'')+'風車模型載入失敗，目前保留簡化風車。';notice.hidden=false;}
loading.start('rocks');
try {
 const {scene:rocks}=await loadModel('landscape-rocks');
 addRockClusters(rocks,pathStonePlacements);pathStoneFallback.visible=false;
} catch(error){console.error(error);notice.textContent+=(notice.textContent?' ':'')+'石塊模型載入失敗，目前保留簡化石頭。';notice.hidden=false;}
loading.start('dock');
try {
 const {scene:dock}=await loadModel('dock');
 const bounds=new THREE.Box3().setFromObject(dock),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
 const scale=bridgeLength/size.x;
 // The long axis is X; turn it toward the stream and seat the deck at the path.
 // Its wooden surface is near local y=.17, with the supporting posts below it.
 const placedDock=new THREE.Group();placedDock.name='Clay wooden dock GLB';
 placedDock.position.set(bridgeX,.12,bridgeZ);placedDock.rotation.y=Math.PI/2;
 const crossScale=2.7/size.x;
 dock.scale.set(scale,crossScale,crossScale);dock.position.set(-center.x*scale,-.17*crossScale,-center.z*crossScale);
 dock.traverse(m=>{if(m.isMesh){m.castShadow=true;m.receiveShadow=true;}});
 placedDock.add(dock);world.add(placedDock);world.remove(dockFallback);
 dockFallback.traverse(m=>{if(m.isMesh)m.geometry.dispose();});
} catch(error){console.error(error);notice.textContent+=(notice.textContent?' ':'')+'碼頭模型載入失敗，目前保留簡化木平台。';notice.hidden=false;}
loading.start('river');
try {
 const {scene:river}=await loadModel('river-tile');
 addRiverTiles(river);
 riverReady=true;
} catch(error){console.error(error);notice.textContent+=(notice.textContent?' ':'')+'河流模型載入失敗，目前保留原本水面。';notice.hidden=false;}
loading.start('paths');
try {
 const {scene:path}=await loadModel('dirt-path');
 applyPathModel(path);
} catch(error){console.error(error);notice.textContent+=(notice.textContent?' ':'')+'路徑材質載入失敗，目前保留泥土小路。';notice.hidden=false;}
loading.start('waterPlants');
const aquaticAssets=[
 {file:'lily-pads',label:'荷葉',place:addLilyPads},
 {file:'water-plants',label:'荷花',place:addWaterFlowers},
 {file:'river-reeds',label:'水草',place:addRiverReeds},
];
const aquaticResults=await Promise.allSettled(aquaticAssets.map(asset=>loadModel(asset.file)));
aquaticResults.forEach((result,i)=>{
 try{
  if(result.status==='rejected')throw result.reason;
  aquaticAssets[i].place(result.value.scene);
 }catch(error){console.error(error);notice.textContent+=(notice.textContent?' ':'')+`${aquaticAssets[i].label}模型載入失敗，重新整理可再試一次。`;notice.hidden=false;}
});
loading.start('fish');
try{
 const {scene:fish}=await loadModel('fish-01');
 addFish(fish);fishReady=true;
}catch(error){console.error(error);notice.textContent+=(notice.textContent?' ':'')+'小魚模型載入失敗，重新整理可再試一次。';notice.hidden=false;}
loading.start('trees');
try{
 const sources=await Promise.all(['small','medium','large'].map(async size=>(await loadModel(`tree-${size}`)).scene));
 replaceTrees(sources);addTreeModels(world,sources,simpleTrees.filter(tree=>tree.z>=2));simpleTrees.forEach(tree=>world.remove(tree.object));
}catch(error){console.error(error);notice.textContent+=' 樹木模型載入失敗，目前保留簡易樹木。';notice.hidden=false;}
loading.start('backdrop');
try{await depthRenderer.ready;}
catch(error){console.error(error);notice.textContent+=' 遠景圖片載入失敗，重新整理可再試一次。';notice.hidden=false;}
loading.start('clouds');
try{
 const {scene:cloud}=await loadModel('fluffy-cloud');
 skyClouds=createDriftingClouds(scene,camera,cloud);
}catch(error){console.error(error);notice.textContent+=' 雲朵模型載入失敗，重新整理可再試一次。';notice.hidden=false;}
softenClayRelief();
farmCrops=createFarmDebug({config:farmConfig,plots,camera,renderer,soilBeds,finishModel:softenClayRelief,
 onChange:()=>{
  renderer.shadowMap.needsUpdate=true;render();
  if(farmCrops&&!smokeFrame)syncSmokeAnimation();
 }});
render();loading.finish();
// Refresh moving blade and crop shadows at 15 Hz; render animation at 30 Hz.
renderer.shadowMap.autoUpdate=false;
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
let smokeFrame=0,lastSmokeFrame=0,lastShadowFrame=0;
function updateSmoke(seconds){
 updateRiver(seconds);
 farmCrops?.update(seconds,!reducedMotion.matches);
 if(windmillBlades)windmillBlades.rotation.z=-seconds*.10;
 for(const puff of smokePuffs){
  const age=(seconds/6.5+puff.offset)%1;
  const drift=age*age;
  const wobble=Math.sin(age*5+puff.seed);
  puff.group.position.set(.20+.25*drift+.025*age*wobble,
   .50+.67*age,-.34-.18*drift+.025*age*Math.cos(age*4+puff.seed));
  const radius=.028+.095*Math.pow(age,.8);
  puff.group.scale.set(radius*(1+.12*wobble),radius*.87,radius);
  puff.group.rotation.y=puff.seed+age*.7;
  const fadeIn=THREE.MathUtils.smoothstep(age,0,.12);
  const fadeOut=1-THREE.MathUtils.smoothstep(age,.5,1);
  puff.material.opacity=.74*fadeIn*fadeOut;
 }
}
function animateSmokeFrame(now){
 // Restore the resting pose even if the media-change event arrives later.
 if(reducedMotion.matches){syncSmokeAnimation();return;}
 if(document.hidden||(!smokeReady&&!windmillBlades&&!riverReady&&!fishReady&&!skyClouds&&!farmCrops?.hasCrops)){smokeFrame=0;return;}
 if(now-lastSmokeFrame>=1000/30){
  smokeElapsed+=Math.min((now-lastSmokeFrame)/1000,.1);
  updateSmoke(smokeElapsed);
  if((windmillBlades||farmCrops?.hasCrops)&&now-lastShadowFrame>=1000/15){renderer.shadowMap.needsUpdate=true;lastShadowFrame=now;}
  render();lastSmokeFrame=now;
 }
 smokeFrame=requestAnimationFrame(animateSmokeFrame);
}
function syncSmokeAnimation(){
 if(smokeFrame)cancelAnimationFrame(smokeFrame);
 smokeFrame=0;
 if(reducedMotion.matches){updateSmoke(0);renderer.shadowMap.needsUpdate=true;render();}
 lastSmokeFrame=performance.now();
 if(!document.hidden&&!reducedMotion.matches&&(smokeReady||windmillBlades||riverReady||fishReady||skyClouds||farmCrops?.hasCrops))smokeFrame=requestAnimationFrame(animateSmokeFrame);
}
document.addEventListener('visibilitychange',syncSmokeAnimation);
reducedMotion.addEventListener('change',syncSmokeAnimation);
syncSmokeAnimation();
