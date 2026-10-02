import * as THREE from 'three';
import { FIELD } from './clay-layout.js';

const HALF=.965;
const smooth=(a,b,x)=>THREE.MathUtils.smoothstep(x,a,b);
function randomSequence(seed){
 return ()=>((seed=(1664525*seed+1013904223)>>>0)/4294967296);
}
function hash(x,z){
 const value=Math.sin(x*127.1+z*311.7)*43758.5453;
 return value-Math.floor(value);
}
function noise(x,z,period=0){
 const ix=Math.floor(x),iz=Math.floor(z),fx=x-ix,fz=z-iz;
 const tx=fx*fx*(3-2*fx),tz=fz*fz*(3-2*fz);
 const sample=(a,b)=>hash(period?((a%period)+period)%period:a,period?((b%period)+period)%period:b);
 return THREE.MathUtils.lerp(THREE.MathUtils.lerp(sample(ix,iz),sample(ix+1,iz),tx),
  THREE.MathUtils.lerp(sample(ix,iz+1),sample(ix+1,iz+1),tx),tz);
}

// Color and relief share the same grain. Small dark pores are depressions in the
// bump map, instead of the large, bright circles on the original flat tile.
function dryCracks(u,v){
 const cells=5,x=u*cells,z=v*cells,ix=Math.floor(x),iz=Math.floor(z);
 let nearest=Infinity,next=Infinity;
 for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){
  const gx=ix+dx,gz=iz+dz,wx=(gx+cells)%cells,wz=(gz+cells)%cells;
  const px=gx+.2+hash(wx+19,wz+37)*.6,pz=gz+.2+hash(wx+71,wz+11)*.6;
  const distance=Math.hypot(x-px,z-pz);
  if(distance<nearest){next=nearest;nearest=distance;}else next=Math.min(next,distance);
 }
 return 1-smooth(.012,.055,next-nearest);
}

function soilTextures(dry=false){
 const resolution=512;
 const colorCanvas=document.createElement('canvas'),heightCanvas=document.createElement('canvas');
 colorCanvas.width=colorCanvas.height=heightCanvas.width=heightCanvas.height=resolution;
 const colorContext=colorCanvas.getContext('2d'),heightContext=heightCanvas.getContext('2d');
 const color=colorContext.createImageData(resolution,resolution),height=heightContext.createImageData(resolution,resolution);
 const dark=dry?[113,86,58]:[92,48,28],light=dry?[174,144,102]:[151,96,58];
 for(let y=0;y<resolution;y++)for(let x=0;x<resolution;x++){
  const u=x/resolution,v=y/resolution,i=(y*resolution+x)*4;
  const broad=noise(u*11,v*11,11),medium=noise(u*37,v*37,37),fine=noise(u*101,v*101,101);
  const grain=hash(x+41,y+83),tone=.18+broad*.25+medium*.38+fine*.15;
  const crack=dry?dryCracks(u,v):0;
  const relief=.18+medium*.45+fine*.25+grain*.12-crack*.20;
  for(let c=0;c<3;c++){
   color.data[i+c]=Math.round(THREE.MathUtils.lerp(dark[c],light[c],tone)*(.96+grain*.08)*(1-crack*.22));
   height.data[i+c]=Math.round(relief*255);
  }
  color.data[i+3]=height.data[i+3]=255;
 }
 colorContext.putImageData(color,0,0);heightContext.putImageData(height,0,0);
 const random=randomSequence(4471);
 for(let i=0;i<420;i++){
  const x=4+random()*504,y=4+random()*504,r=.45+random()*1.5;
  const pore=heightContext.createRadialGradient(x,y,0,x,y,r*1.7);
  pore.addColorStop(0,'rgba(12,12,12,.78)');pore.addColorStop(1,'rgba(12,12,12,0)');
  heightContext.fillStyle=pore;heightContext.fillRect(x-r*1.7,y-r*1.7,r*3.4,r*3.4);
  colorContext.fillStyle='rgba(49,29,18,.20)';colorContext.beginPath();colorContext.ellipse(x,y,r*.7,r*.5,random()*Math.PI,0,Math.PI*2);colorContext.fill();
 }
 const map=new THREE.CanvasTexture(colorCanvas),bumpMap=new THREE.CanvasTexture(heightCanvas);
 map.colorSpace=THREE.SRGBColorSpace;
 for(const texture of [map,bumpMap]){texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.anisotropy=4;}
 return {map,bumpMap};
}

function soilHeight(x,z,seed){
 const u=x/HALF,v=z/HALF,edge=Math.max(Math.abs(u),Math.abs(v));
 const shoulder=1-smooth(.70,1,edge);
 const broad=(noise(x*5.8+seed,z*5.8-seed)-.5)*.074;
 const crumbs=(noise(x*13-seed,z*13+seed)-.5)*.026;
 return .151+.070*Math.pow(shoulder,.65)+.009*Math.max(0,(1-u*u)*(1-v*v))
  +(broad+crumbs)*(.3+.7*shoulder);
}

function bedGeometry(seed){
 const segments=64,positions=[],uvs=[],colors=[],indices=[];
 const variation=.97+.055*hash(seed,14);
 for(let row=0;row<=segments;row++)for(let col=0;col<=segments;col++){
  let x=(col/segments*2-1)*HALF,z=(row/segments*2-1)*HALF;
  const u=x/HALF,v=z/HALF,corner=.14;
  const cx=Math.max(0,Math.abs(x)-(HALF-corner)),cz=Math.max(0,Math.abs(z)-(HALF-corner));
  if(cx>0&&cz>0){
   const ratio=Math.max(cx,cz)/Math.hypot(cx,cz);
   x=Math.sign(x)*(HALF-corner+cx*ratio);z=Math.sign(z)*(HALF-corner+cz*ratio);
  }
  x+=Math.sign(u)*Math.pow(Math.abs(u),5)*(.011*Math.sin(z*15+seed)+.006*Math.sin(z*33-seed));
  z+=Math.sign(v)*Math.pow(Math.abs(v),5)*(.011*Math.sin(x*13-seed)+.006*Math.sin(x*29+seed));
  const y=soilHeight(x,z,seed);
  positions.push(x,y,z);uvs.push(x*.82+seed*.173,z*.82-seed*.119);
  const rim=smooth(.77,1,Math.max(Math.abs(u),Math.abs(v)));
  const tint=variation*(1-rim*.19);
  colors.push(tint,tint,tint);
  if(row<segments&&col<segments){
   const a=row*(segments+1)+col,b=a+segments+1;indices.push(a,b,a+1,b,b+1,a+1);
  }
 }
 // Bury the skirt in the grass so each bed has a soft shoulder, not a slab wall.
 const edge=[];
 for(let i=0;i<=segments;i++)edge.push(i);
 for(let i=1;i<=segments;i++)edge.push(i*(segments+1)+segments);
 for(let i=segments-1;i>=0;i--)edge.push(segments*(segments+1)+i);
 for(let i=segments-1;i>0;i--)edge.push(i*(segments+1));
 const skirtStart=positions.length/3;
 for(const i of edge){positions.push(positions[i*3]*.992,.055,positions[i*3+2]*.992);uvs.push(uvs[i*2],uvs[i*2+1]);colors.push(.64,.64,.64);}
 for(let i=0;i<edge.length;i++){
  const next=(i+1)%edge.length;indices.push(edge[i],edge[next],skirtStart+i,edge[next],skirtStart+next,skirtStart+i);
 }
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
 geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setIndex(indices);
 geometry.computeVertexNormals();geometry.computeBoundingSphere();return geometry;
}

function addSoilGrain(parent,beds){
 const geometry=new THREE.IcosahedronGeometry(1,1),material=new THREE.MeshStandardMaterial({roughness:1});
 const points=[],random=randomSequence(9217),matrix=new THREE.Matrix4(),rotation=new THREE.Quaternion();
 for(const bed of beds)for(let i=0;i<52;i++){
  const x=(random()*2-1)*.85,z=(random()*2-1)*.85;
  const radius=.014+Math.pow(random(),2)*.041,height=radius*(.35+random()*.4);
  const c=Math.cos(bed.angle),s=Math.sin(bed.angle);
  points.push({x:bed.x+x*c+z*s,z:bed.z-x*s+z*c,y:soilHeight(x,z,bed.seed)+height*.42,
   radius,height,angle:random()*6.28,plotIndex:bed.index,
   dry:bed.dry,dryColor:['#9b825d','#ac9063','#b79c70','#a48b65','#bea67e'][i%5],
   wetColor:i%17===0?'#a17c50':['#6a422a','#775032','#865935','#715036','#8e643e'][i%5]});
 }
 const batch=new THREE.InstancedMesh(geometry,material,points.length);batch.name='Small clay soil crumbs';
 points.forEach((p,i)=>{
  rotation.setFromEuler(new THREE.Euler(.2*Math.sin(i),p.angle,.15*Math.cos(i)));
  matrix.compose(new THREE.Vector3(p.x,p.y,p.z),rotation,new THREE.Vector3(p.radius,p.height,p.radius*(.65+.3*hash(i,7))));
  batch.setMatrixAt(i,matrix);batch.setColorAt(i,new THREE.Color(p.dry?p.dryColor:p.wetColor));
 });
 batch.castShadow=true;batch.receiveShadow=true;batch.computeBoundingSphere();parent.add(batch);
 return (index,dry)=>{
  points.forEach((point,i)=>{if(point.plotIndex===index)batch.setColorAt(i,new THREE.Color(dry?point.dryColor:point.wetColor));});
  batch.instanceColor.needsUpdate=true;
 };
}

function addGrassSeams(parent){
 const random=randomSequence(1712),points=[];
 const halfX=(FIELD.columns-1)*FIELD.pitch/2+.93,halfZ=(FIELD.rows-1)*FIELD.pitch/2+.93;
 const tuft=(x,z)=>{
  if(random()<.27)return;
  for(let leaf=0;leaf<2+Math.floor(random()*2);leaf++)points.push({x:x+(random()-.5)*.075,z:z+(random()-.5)*.075,
   height:.035+random()*.08,angle:random()*6.28,lean:(random()-.5)*.8,color:['#869346','#a1a652','#b5b166'][Math.floor(random()*3)]});
 };
 for(let seam=1;seam<FIELD.columns;seam++)for(let z=.9-halfZ;z<.9+halfZ;z+=.17)tuft((seam-FIELD.columns/2)*FIELD.pitch,z+(random()-.5)*.12);
 for(let seam=1;seam<FIELD.rows;seam++)for(let x=-halfX;x<halfX;x+=.17)tuft(x+(random()-.5)*.12,(seam-FIELD.rows/2)*FIELD.pitch+.9);
 const geometry=new THREE.SphereGeometry(1,6,4),material=new THREE.MeshStandardMaterial({roughness:1});
 const grass=new THREE.InstancedMesh(geometry,material,points.length);grass.name='Irregular grass between soil beds';
 const matrix=new THREE.Matrix4(),rotation=new THREE.Quaternion();
 points.forEach((p,i)=>{
  rotation.setFromEuler(new THREE.Euler(p.lean,p.angle,p.lean*.6));
  matrix.compose(new THREE.Vector3(p.x,.128+p.height*.4,p.z),rotation,new THREE.Vector3(.018,p.height*.55,.011));
  grass.setMatrixAt(i,matrix);grass.setColorAt(i,new THREE.Color(p.color));
 });
 grass.receiveShadow=true;grass.computeBoundingSphere();parent.add(grass);
}

export function createSoilBeds(parent,centers){
 const materials=[false,true].map(dry=>new THREE.MeshStandardMaterial({
  ...soilTextures(dry),bumpScale:dry?.058:.047,roughness:1,metalness:0,vertexColors:true,
 }));
 // Keep the dry patches stable across reloads, scattered among the original soil.
 const dryBeds=new Set([2,3,6,7,10]);
 const meshes=new Map();
 const beds=centers.map((point,i)=>{
  const seed=17+i*13.7,angle=(hash(i,57)-.5)*.019,dry=dryBeds.has(i);
  const bed=new THREE.Mesh(bedGeometry(seed),materials[Number(dry)]);bed.name=`Sculpted soil bed ${i+1}`;
  bed.userData.soilState=dry?'dry':'original';
  bed.userData.plotIndex=i;
  meshes.set(i,bed);
  bed.position.set(point.x,0,point.z);bed.rotation.y=angle;bed.castShadow=true;bed.receiveShadow=true;parent.add(bed);
  return {index:i,x:point.x,z:point.z,seed,angle,dry};
 });
 const setGrainState=addSoilGrain(parent,beds);addGrassSeams(parent);
 function setState(index,state){
  const bed=meshes.get(index);
  if(!bed||!['wet','dry'].includes(state)||bed.userData.soilState===state)return false;
  const dry=state==='dry';
  bed.userData.soilState=state;bed.material=materials[Number(dry)];setGrainState(index,dry);
  return true;
 }
 return {
  setState,
  water(index){
   const bed=meshes.get(index);
   if(!bed||bed.userData.soilState!=='dry')return false;
   return setState(index,'wet');
  },
 };
}
