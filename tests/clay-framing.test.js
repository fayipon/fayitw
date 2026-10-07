import test from 'node:test';
import assert from 'node:assert/strict';
import {PerspectiveCamera,Vector3} from '../js/vendor/three/three.module.js';
import {FIELD,FARM_VIEW} from '../js/clay-layout.js';
import {fitFarmView} from '../js/clay-framing.js';

const halfWidth=FIELD.columns*FIELD.pitch/2+.5,halfDepth=FIELD.rows*FIELD.pitch/2+.4;
const corners=[];
for(const x of [-halfWidth,halfWidth])for(const z of [.75-halfDepth,.75+halfDepth+FIELD.frontFenceOffset])for(const y of [0,3.3]){
 corners.push(new Vector3(x*FIELD.x+FIELD.offsetX,y,z*FIELD.z+FIELD.offset));
}

for(const [width,height] of [[390,720],[430,932],[320,568],[430,360],[430,1244]]){
 test(`all field corners and crop heights remain unobstructed at ${width}x${height}`,()=>{
  const dockHeight=height<=620?height*.34:Math.min(height*.38,290);
  const camera=new PerspectiveCamera(FARM_VIEW.fov,width/height,.1,180);
  camera.position.fromArray(FARM_VIEW.position);camera.lookAt(...FARM_VIEW.target);camera.zoom=1.65;
  const safe={left:14,right:width-14,top:84,bottom:height-dockHeight-26};
  fitFarmView(camera,corners,width,height,safe,30);
  for(const corner of corners){
   const point=corner.clone().project(camera),x=(point.x+1)*width/2,y=(1-point.y)*height/2;
   assert.ok(x>=safe.left-.001&&x<=safe.right+.001,`field x=${x} is inside the usable width`);
   assert.ok(y>=safe.top-.001&&y<=safe.bottom+.001,`field y=${y} is between header and dock`);
  }
  assert.deepEqual(camera.position.toArray(),FARM_VIEW.position,'viewing angle and world geometry stay unchanged');
 });
}

test('a fully visible field keeps the requested zoom and framing',()=>{
 const camera=new PerspectiveCamera(45,430/932,.1,180);
 camera.position.fromArray(FARM_VIEW.position);camera.lookAt(...FARM_VIEW.target);camera.zoom=.6;
 fitFarmView(camera,corners,430,932,{left:0,right:430,top:0,bottom:932},0);
 assert.equal(camera.zoom,.6);assert.equal(camera.view.offsetX,0);assert.equal(camera.view.offsetY,0);
});
