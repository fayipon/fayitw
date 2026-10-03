import * as THREE from 'three';
import { loadModel } from './clay-models.js';

// Real petals and foliage extracted from cottage.glb; never recolor the leaves.
export async function addCottageFlowers(parent,terrainHeight,landscapePlacements=[]){
 const {scene:source}=await loadModel('cottage-flowers');
 const bounds=new THREE.Box3().setFromObject(source),size=bounds.getSize(new THREE.Vector3());
 const colors=['#fff2d2','#ed70a0','#a779dc','#74b4ef','#ee936d','#f2cd60'];
 const placements=[...landscapePlacements,[-4.3,-4.5,1],[-3.5,-4.4,1],[1.5,-4.2,1],[2.5,-4.4,1],[-6.2,4.7,1],[6,4.2,1],[6.1,1.5,1]];
 const materials=colors.map(color=>{
  const material=source.children[0].material.clone();
  material.onBeforeCompile=shader=>{
   shader.uniforms.petalTint={value:new THREE.Color(color)};
   shader.fragmentShader='uniform vec3 petalTint;\n'+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
    float brightest=max(diffuseColor.r,max(diffuseColor.g,diffuseColor.b));
    float darkest=min(diffuseColor.r,min(diffuseColor.g,diffuseColor.b));
    float saturation=(brightest-darkest)/max(brightest,0.001);
    float petals=(1.0-smoothstep(0.25,0.48,saturation))*smoothstep(0.25,0.55,darkest);
    diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*petalTint,petals);
   `);
  };
  material.customProgramCacheKey=()=>`cottage-petals-${color}`;
  return material;
 });
 const flowers=new THREE.Group();flowers.name='Extracted cottage flower beds';
 const transform=new THREE.Object3D();
 materials.forEach((material,colorIndex)=>{
  const group=placements.filter((_,i)=>i%materials.length===colorIndex);
  source.traverse(mesh=>{if(mesh.isMesh){
   const batch=new THREE.InstancedMesh(mesh.geometry,material,group.length);
   batch.name=`Cottage flower beds ${colors[colorIndex]}`;
   group.forEach(([x,z,width],i)=>{
    transform.scale.setScalar(width*1.25/size.x);
    transform.rotation.y=(i%3-1)*.32;
    transform.position.set(x,terrainHeight(x,z)+.025,z);transform.updateMatrix();
    batch.setMatrixAt(i,transform.matrix);
   });
   batch.castShadow=true;batch.receiveShadow=true;flowers.add(batch);
  }});
 });
 parent.add(flowers);
}
