import * as THREE from 'three';

let badgeMaterial;
export function createHarvestBadge(){
 if(!badgeMaterial){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
  const ctx=canvas.getContext('2d');
  ctx.fillStyle='#fff7dc';ctx.strokeStyle='#d0b987';ctx.lineWidth=3;
  ctx.beginPath();ctx.roundRect(8,6,112,100,30);ctx.fill();ctx.stroke();
  ctx.beginPath();ctx.moveTo(53,104);ctx.lineTo(64,120);ctx.lineTo(75,104);ctx.fill();
  ctx.strokeStyle='#925d2d';ctx.lineWidth=7;ctx.lineCap='round';
  ctx.beginPath();ctx.moveTo(35,49);ctx.bezierCurveTo(38,12,90,12,93,49);ctx.stroke();
  ctx.fillStyle='#80ad42';ctx.beginPath();ctx.ellipse(54,43,14,7,-.4,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#e9b566';ctx.lineWidth=4;
  ctx.beginPath();ctx.moveTo(25,47);ctx.lineTo(103,47);ctx.lineTo(94,90);
  ctx.quadraticCurveTo(64,100,34,90);ctx.closePath();ctx.fill();ctx.stroke();
  ctx.fillStyle='#c68b45';ctx.fillRect(30,48,68,8);
  // Keep the happy mature expression on the front of the harvest basket.
  ctx.strokeStyle='#684323';ctx.lineWidth=4;
  for(const x of [47,81]){ctx.beginPath();ctx.arc(x,70,6,Math.PI,Math.PI*2);ctx.stroke();}
  ctx.beginPath();ctx.arc(64,77,10,.15,Math.PI-.15);ctx.stroke();
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;
  badgeMaterial=new THREE.SpriteMaterial({map,depthWrite:false,depthTest:false,toneMapped:false,fog:false});
 }
 const sprite=new THREE.Sprite(badgeMaterial);sprite.name='Mature crop harvest basket';
 sprite.scale.set(1.35,1.35,1);sprite.renderOrder=11;sprite.raycast=()=>{};
 return sprite;
}

export function createHarvestEffect(parent){
 const root=new THREE.Group();root.name='Harvest selected plot';root.visible=false;parent.add(root);
 const basket=new THREE.Group();basket.position.set(.95,.48,.3);root.add(basket);
 const wicker=new THREE.MeshStandardMaterial({color:'#c8944e',roughness:.95});
 const trim=new THREE.MeshStandardMaterial({color:'#e8ba72',roughness:.9});
 const inside=new THREE.MeshStandardMaterial({color:'#73502b',roughness:1});
 function part(geometry,material,y){
  const mesh=new THREE.Mesh(geometry,material);mesh.position.y=y;basket.add(mesh);return mesh;
 }
 part(new THREE.CylinderGeometry(.5,.38,.58,20),wicker,0);
 part(new THREE.CylinderGeometry(.445,.445,.03,20),inside,.296);
 for(const [radius,y] of [[.49,.3],[.455,.08],[.416,-.14],[.38,-.28]]){
  const band=part(new THREE.TorusGeometry(radius,.035,6,28),trim,y);band.rotation.x=Math.PI/2;
 }
 part(new THREE.TorusGeometry(.46,.045,8,28,Math.PI),trim,.3);

 const sparkleCanvas=document.createElement('canvas');sparkleCanvas.width=sparkleCanvas.height=64;
 const sparkleContext=sparkleCanvas.getContext('2d');
 sparkleContext.fillStyle='#ffed91';sparkleContext.strokeStyle='#e9ad32';sparkleContext.lineWidth=2;
 sparkleContext.beginPath();
 for(let i=0;i<8;i++){
  const angle=i*Math.PI/4-Math.PI/2,radius=i%2===0?27:7;
  const x=32+Math.cos(angle)*radius,y=32+Math.sin(angle)*radius;
  if(i===0)sparkleContext.moveTo(x,y);else sparkleContext.lineTo(x,y);
 }
 sparkleContext.closePath();sparkleContext.fill();sparkleContext.stroke();
 const sparkleMap=new THREE.CanvasTexture(sparkleCanvas);sparkleMap.colorSpace=THREE.SRGBColorSpace;
 const sparkles=Array.from({length:12},()=>{
  const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:sparkleMap,depthWrite:false,depthTest:false,toneMapped:false,fog:false}));
  sprite.renderOrder=12;root.add(sprite);return sprite;
 });
 const textCanvas=document.createElement('canvas');textCanvas.width=320;textCanvas.height=96;
 const textContext=textCanvas.getContext('2d');
 const textMap=new THREE.CanvasTexture(textCanvas);textMap.colorSpace=THREE.SRGBColorSpace;
 const reward=new THREE.Sprite(new THREE.SpriteMaterial({map:textMap,depthWrite:false,depthTest:false,toneMapped:false,fog:false}));
 reward.scale.set(2.8,.84,1);reward.renderOrder=13;root.add(reward);
 const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
 const smooth=(a,b,t)=>THREE.MathUtils.smoothstep(t,a,b);
 let active=null;

 function finish(){
  if(!active)return;
  const {pivot,position,scale,quaternion,visible,resolve,timer}=active;
  active=null;clearTimeout(timer);root.visible=false;
  pivot.position.copy(position);pivot.scale.copy(scale);pivot.quaternion.copy(quaternion);pivot.visible=visible;
  resolve();
 }
 function update(now=performance.now()){
  if(!active)return;
  const progress=Math.min(1,Math.max(0,(now-active.started)/1000/active.duration));
  if(progress>=1){finish();return;}
  const {pivot,position,scale,height}=active,still=reducedMotion.matches;
  if(still){
   basket.visible=true;basket.scale.setScalar(1);reward.visible=true;reward.material.opacity=1;
   reward.position.set(0,height+1.05,0);sparkles.forEach(sprite=>{sprite.visible=false;});return;
  }
  const lift=smooth(.18,.74,progress),squash=Math.sin(Math.PI*smooth(0,.18,progress));
  pivot.position.set(position.x+.95*lift,position.y+Math.sin(Math.PI*lift)*1.8+.65*lift,position.z+.3*lift);
  pivot.scale.copy(scale).multiplyScalar(1-.84*lift);
  pivot.scale.y*=1-.14*squash;pivot.scale.x*=1+.08*squash;
  pivot.visible=progress<.76;
  const reveal=smooth(0,.2,progress),exit=smooth(.84,1,progress);
  basket.visible=true;basket.scale.setScalar((.75+.25*reveal)*(1-.3*exit));
  basket.position.y=.48+.08*Math.sin(Math.PI*smooth(.7,.87,progress));
  sparkles.forEach((sprite,i)=>{
   const age=THREE.MathUtils.clamp((progress-.2-(i%3)*.035)/.68,0,1),angle=i*2.39996;
   const radius=.35+age*(.7+(i%3)*.15);
   sprite.visible=age>0&&age<1;sprite.material.opacity=Math.sin(Math.PI*age);
   sprite.position.set(Math.cos(angle)*radius,.3+height*.45+age*(1+(i%4)*.2),Math.sin(angle)*radius);
   sprite.scale.setScalar((.45+(i%3)*.08)*Math.sin(Math.PI*age));
  });
  reward.visible=progress>.55;reward.material.opacity=smooth(.55,.7,progress)*(1-exit);
  reward.position.set(.4,height+.8+smooth(.55,1,progress)*.65,0);
 }
 return {
  play(bed,pivot,height,label){
   if(active)return active.promise;
   const parentScale=parent.getWorldScale(new THREE.Vector3());
   root.scale.set(1/parentScale.x,1/parentScale.y,1/parentScale.z);
   root.position.set(bed.position.x,.25,bed.position.z);root.visible=true;
   textContext.clearRect(0,0,320,96);textContext.font='900 48px "Arial Rounded MT Bold", "Microsoft JhengHei", sans-serif';
   textContext.textAlign='center';textContext.textBaseline='middle';textContext.lineJoin='round';
   textContext.strokeStyle='#74421f';textContext.lineWidth=8;textContext.strokeText(`${label} +1`,160,48,298);
   textContext.fillStyle='#fff3b8';textContext.fillText(`${label} +1`,160,48,298);textMap.needsUpdate=true;
   let resolve;const promise=new Promise(done=>{resolve=done;});
   const duration=reducedMotion.matches ? .3 : 2.2;
   active={promise,resolve,pivot,height,duration,started:performance.now(),position:pivot.position.clone(),
    scale:pivot.scale.clone(),quaternion:pivot.quaternion.clone(),visible:pivot.visible};
   active.timer=setTimeout(finish,duration*1000);update();return promise;
  },
  update,
 };
}
