import * as THREE from 'three';
import { DOCK } from './clay-layout.js';

export function createRiverFish(parent,source,riverZ){
  source.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(source),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
  const time={value:0},parts=[];
  source.traverse(mesh=>{if(mesh.isMesh){
    const geometry=mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
    geometry.translate(-center.x,-center.y,-center.z);
    parts.push({geometry,material:mesh.material});
  }});
  const school=new THREE.Group();school.name='Swimming clay koi — fish model 01';parent.add(school);
  // Move four existing koi into the visible stretch downstream of the dock.
  // Stagger their loops along the deep channel, clear of banks and supports.
  const routes=[
    {center:DOCK.x+2.2,span:1,lane:-.32,length:.82,speed:.46,offset:.12,direction:1},
    {center:DOCK.x+3.6,span:1.2,lane:.34,length:.66,speed:.38,offset:.65,direction:-1},
    {center:DOCK.x+5.7,span:1.25,lane:-.3,length:.84,speed:.49,offset:.18,direction:1},
    {center:DOCK.x+7,span:1.05,lane:.3,length:.72,speed:.41,offset:.64,direction:-1},
    {center:2.5,span:1.9,lane:-.08,length:.78,speed:.44,offset:.31,direction:1},
  ];
  const swimmers=routes.map((route,i)=>{
    const points=[];
    for(let p=0;p<48;p++){
      const angle=p/48*Math.PI*2,x=route.center+route.span*Math.cos(angle);
      points.push(new THREE.Vector3(x,-.65+.018*Math.sin(angle*2+i),riverZ(x)+route.lane+.4*Math.sin(angle)));
    }
    const curve=new THREE.CatmullRomCurve3(points,true,'centripetal');
    const fish=new THREE.Group();fish.name=`Swimming koi ${i+1}`;
    fish.scale.setScalar(route.length/size.z);
    const finish=original=>{
      const material=original.clone();material.metalness=0;material.roughness=.84;
      if(material.normalScale)material.normalScale.set(.4,.4);
      material.onBeforeCompile=shader=>{
        shader.uniforms.fishTime=time;shader.uniforms.fishPhase={value:i*1.93};
        shader.uniforms.fishLength={value:size.z};shader.uniforms.fishFront={value:bounds.max.z-center.z};
        shader.vertexShader='uniform float fishTime,fishPhase,fishLength,fishFront;\n'+shader.vertexShader;
        shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`
          #include <begin_vertex>
          float rear=clamp((fishFront-position.z)/fishLength,0.,1.);
          float tail=pow(smoothstep(.22,1.,rear),2.);
          transformed.x+=.14*tail*sin(fishTime*7.+fishPhase+rear*4.);
          transformed.y+=.025*tail*sin(fishTime*7.+fishPhase);
        `);
      };
      material.customProgramCacheKey=()=> 'clay-swimming-fish-v1';return material;
    };
    for(const part of parts){
      const material=Array.isArray(part.material)?part.material.map(finish):finish(part.material);
      const mesh=new THREE.Mesh(part.geometry,material);mesh.receiveShadow=true;mesh.castShadow=false;fish.add(mesh);
    }
    school.add(fish);
    return {fish,curve,distance:curve.getLength(),route};
  });
  const tangent=new THREE.Vector3();
  function update(seconds){
    time.value=seconds;
    for(const {fish,curve,distance,route} of swimmers){
      const progress=((route.offset+seconds*route.speed*route.direction/distance)%1+1)%1;
      curve.getPointAt(progress,fish.position);
      curve.getTangentAt(progress,tangent).multiplyScalar(route.direction);
      fish.rotation.set(-Math.atan2(tangent.y,Math.hypot(tangent.x,tangent.z)),Math.atan2(tangent.x,tangent.z),0,'YXZ');
    }
  }
  update(0);return update;
}
