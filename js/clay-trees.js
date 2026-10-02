import * as THREE from 'three';

// Share each model's geometry and textures across all trees of that size.
export function addTreeModels(parent,sources,placements){
  const group=new THREE.Group();group.name='Small medium large clay trees';
  const matrix=new THREE.Matrix4(),normalization=new THREE.Matrix4();
  const position=new THREE.Vector3(),rotation=new THREE.Quaternion(),scale=new THREE.Vector3();
  const axis=new THREE.Vector3(0,1,0);
  sources.forEach((source,variant)=>{
    source.updateMatrixWorld(true);
    const bounds=new THREE.Box3().setFromObject(source),center=bounds.getCenter(new THREE.Vector3());
    const height=bounds.max.y-bounds.min.y;
    normalization.makeTranslation(-center.x,-bounds.min.y,-center.z);
    const trees=placements.filter(p=>(p.size<1.15?0:p.size<1.45?1:2)===variant);
    if(!trees.length)return;
    source.traverse(mesh=>{
      if(!mesh.isMesh)return;
      const geometry=mesh.geometry.clone().applyMatrix4(mesh.matrixWorld).applyMatrix4(normalization);
      const finish=original=>{
        const material=original.clone();material.metalness=0;material.roughness=.94;
        material.onBeforeCompile=shader=>{
          shader.uniforms.treeHeight={value:height};
          shader.vertexShader='attribute vec3 crownTint; varying vec3 vCrownTint; varying float vCrownHeight; uniform float treeHeight;\n'+shader.vertexShader;
          shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvCrownTint=crownTint; vCrownHeight=position.y/treeHeight;');
          shader.fragmentShader='varying vec3 vCrownTint; varying float vCrownHeight;\n'+shader.fragmentShader;
          shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
            float foliage=smoothstep(.015,.09,diffuseColor.g-diffuseColor.r)*smoothstep(.02,.1,diffuseColor.g-diffuseColor.b);
            vec3 leaves=pow(max(diffuseColor.rgb,vec3(.001)),vec3(1.16))*vCrownTint;
            leaves*=mix(.68,1.12,smoothstep(.3,.95,vCrownHeight));
            diffuseColor.rgb=mix(diffuseColor.rgb,leaves,foliage);
          `);
        };
        material.customProgramCacheKey=()=> 'clay-tree-crown-depth-v1';
        return material;
      };
      const material=Array.isArray(mesh.material)?mesh.material.map(finish):finish(mesh.material);
      const batch=new THREE.InstancedMesh(geometry,material,trees.length);
      const tints=new Float32Array(trees.length*3);
      const palette=[[.68,.88,.77],[1.08,1.06,.86],[.83,.96,1.02],[.93,1.02,.78]];
      trees.forEach((tree,i)=>{
        tints.set(palette[(i+variant)%palette.length],i*3);
        position.set(tree.x,tree.y,tree.z);rotation.setFromAxisAngle(axis,tree.angle??i*2.399);
        scale.setScalar(tree.size*3.15/height);matrix.compose(position,rotation,scale);batch.setMatrixAt(i,matrix);
      });
      geometry.setAttribute('crownTint',new THREE.InstancedBufferAttribute(tints,3));
      batch.instanceMatrix.needsUpdate=true;batch.receiveShadow=true;batch.castShadow=false;
      batch.computeBoundingSphere();group.add(batch);
    });
  });
  parent.add(group);return group;
}
