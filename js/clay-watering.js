import * as THREE from 'three';

// A reusable clay watering can, falling droplets and small ground ripples.
export function createWateringEffect(parent){
 const root=new THREE.Group();root.name='Watering selected plot';root.visible=false;parent.add(root);
 const can=new THREE.Group();can.name='Clay watering can';root.add(can);
 const clay=color=>new THREE.MeshStandardMaterial({color,roughness:.88,metalness:0});
 const teal=clay('#55acb7'),rim=clay('#e5ca81'),inside=clay('#397986');
 function part(geometry,material,x,y,z=0){
  const mesh=new THREE.Mesh(geometry,material);mesh.position.set(x,y,z);can.add(mesh);return mesh;
 }
 part(new THREE.CylinderGeometry(.39,.43,.75,20),teal,0,0);
 const lip=part(new THREE.TorusGeometry(.36,.065,8,28),rim,0,.38);lip.rotation.x=Math.PI/2;
 part(new THREE.CylinderGeometry(.31,.31,.04,20),inside,0,.37);
 const bottom=part(new THREE.TorusGeometry(.40,.045,8,28),teal,0,-.35);bottom.rotation.x=Math.PI/2;
 const handle=part(new THREE.TorusGeometry(.35,.075,8,24),rim,.48,.02);handle.scale.x=.78;
 const spoutPath=new THREE.CatmullRomCurve3([
  new THREE.Vector3(-.3,-.14,0),new THREE.Vector3(-.73,.02,0),new THREE.Vector3(-1.15,.28,0),
 ]);
 part(new THREE.TubeGeometry(spoutPath,12,.105,8,false),teal,0,0);
 const head=part(new THREE.CylinderGeometry(.21,.13,.18,16),rim,-1.19,.31);
 head.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(-1,.5,0).normalize());
 const nozzle=new THREE.Object3D();nozzle.position.set(-1.29,.36,0);can.add(nozzle);

 const dropMaterial=new THREE.MeshStandardMaterial({color:'#a4e4fa',emissive:'#449fbe',emissiveIntensity:.24,
  roughness:.3,transparent:true,opacity:.92,depthWrite:false});
 const drops=new THREE.InstancedMesh(new THREE.SphereGeometry(1,8,6),dropMaterial,32);
 drops.name='Falling water droplets';drops.frustumCulled=false;root.add(drops);
 const rings=Array.from({length:7},(_,i)=>{
  const material=new THREE.MeshBasicMaterial({color:'#bceafa',transparent:true,opacity:0,depthWrite:false});
  const ring=new THREE.Mesh(new THREE.TorusGeometry(.16,.014,5,24),material);
  const angle=i*2.39996,radius=.25+(i%3)*.22;
  ring.rotation.x=-Math.PI/2;ring.position.set(Math.cos(angle)*radius,.055,Math.sin(angle)*radius);
  root.add(ring);return ring;
 });
 const emission=new THREE.Vector3(),target=new THREE.Vector3(),position=new THREE.Vector3();
 const matrix=new THREE.Matrix4(),quaternion=new THREE.Quaternion(),scale=new THREE.Vector3();
 const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
 let active=null;
 const smooth=(a,b,t)=>THREE.MathUtils.smoothstep(t,a,b);

 function finish(){
  if(!active)return;
  const {resolve,timer}=active;active=null;clearTimeout(timer);root.visible=false;resolve();
 }
 function update(now=performance.now()){
  if(!active)return;
  const age=Math.max(0,(now-active.started)/1000),progress=Math.min(1,age/active.duration);
  if(progress>=1){finish();return;}
  const still=reducedMotion.matches;
  can.visible=drops.visible=!still;
  if(still){
   rings.forEach((ring,i)=>{ring.visible=i===0;ring.scale.setScalar(3);ring.material.opacity=.45;});
   return;
  }
  const entrance=smooth(0,.16,progress),exit=smooth(.85,1,progress);
  can.scale.setScalar((.7+.3*entrance)*(1-.4*exit));
  can.position.set(1.05+.5*(1-entrance)+.4*exit,active.height+.4*(1-entrance)+.3*exit,-.3);
  can.rotation.z=.52*smooth(.12,.28,progress)*(1-smooth(.76,.91,progress))+.025*Math.sin(age*7);
  root.updateWorldMatrix(true,true);nozzle.getWorldPosition(emission);root.worldToLocal(emission);
  drops.visible=progress>.20&&progress<.83;
  for(let i=0;i<32;i++){
   const travel=(age*2.15+i*.618034)%1,angle=i*2.39996,radius=.18+(i%5)*.12;
   target.set(Math.cos(angle)*radius,.04,Math.sin(angle)*radius);
   position.lerpVectors(emission,target,travel);
   position.y=THREE.MathUtils.lerp(emission.y,target.y,travel*travel);
   position.x+=Math.sin(i*3.1)*.06*(1-travel);
   const width=.038+(i%3)*.012;scale.set(width,width*(1.65+travel),width);
   matrix.compose(position,quaternion,scale);drops.setMatrixAt(i,matrix);
  }
  drops.instanceMatrix.needsUpdate=true;
  const splash=smooth(.24,.37,progress)*(1-smooth(.81,1,progress));
  rings.forEach((ring,i)=>{
   const wave=(age*2.4+i*.37)%1;
   ring.visible=true;ring.scale.setScalar(.4+wave*2.4);ring.material.opacity=(1-wave)*.62*splash;
  });
 }
 return {
  play(bed,cropHeight){
   if(active)return active.promise;
   const parentScale=parent.getWorldScale(new THREE.Vector3());
   root.scale.set(1/parentScale.x,1/parentScale.y,1/parentScale.z);
   root.position.set(bed.position.x,.25,bed.position.z);root.visible=true;
   let resolve;const promise=new Promise(done=>{resolve=done;});
   const duration=reducedMotion.matches ? .3 : 2.4;
   active={promise,resolve,duration,started:performance.now(),height:Math.max(1.75,cropHeight+.9)};
   active.timer=setTimeout(finish,duration*1000);update();return promise;
  },
  update,
 };
}
