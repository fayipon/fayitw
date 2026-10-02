import * as THREE from 'three';

// Real clay meshes sit above the distant ground; their sky layout stays stable
// on phones and when zooming. Their shared geometry is loaded only once.
export function createDriftingClouds(scene,camera,source){
 const bounds=new THREE.Box3().setFromObject(source),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
 source.traverse(mesh=>{if(mesh.isMesh){
  mesh.castShadow=false;mesh.receiveShadow=false;
  for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material]){
   material.metalness=0;material.roughness=1;material.fog=false;
   if(material.normalScale)material.normalScale.set(.3,.3);
  }
 }});
 const group=new THREE.Group();group.name='Slow drifting clay clouds';scene.add(group);
 const clouds=[
  {start:.81,top:.055,width:.22,speed:.0066,turn:-.12},
  {start:.18,top:.074,width:.17,speed:.0048,turn:.16},
  {start:.49,top:.016,width:.12,speed:.0039,turn:-.3},
 ].map((layout,i)=>{
  const cloud=new THREE.Group(),model=source.clone(true);
  cloud.name=`Sky cloud ${i+1}`;model.position.copy(center).multiplyScalar(-1);
  cloud.add(model);group.add(cloud);return {...layout,cloud};
 });
 function update(seconds){
  camera.updateMatrixWorld();
  const depth=32,viewHeight=2*depth*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))/camera.zoom;
  const viewWidth=viewHeight*camera.aspect,scaleSpan=Math.min(viewWidth,viewHeight*.65);
  for(const item of clouds){
   // Wrap only after the whole model leaves the screen, so there is no jump.
   const x=(item.start+.25+seconds*item.speed)%1.5-.25;
   const y=item.top+.0015*Math.sin(seconds*.07+item.start*10);
   item.cloud.position.set((x-.5)*viewWidth,(.5-y)*viewHeight,-depth).applyMatrix4(camera.matrixWorld);
   item.cloud.quaternion.copy(camera.quaternion);item.cloud.rotateY(item.turn);
   item.cloud.scale.setScalar(scaleSpan*item.width/size.x);
  }
 }
 update(0);
 return {update};
}
