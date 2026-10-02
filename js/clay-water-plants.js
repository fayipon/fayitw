import * as THREE from 'three';
import { DOCK } from './clay-layout.js';
import { isFarmPath } from './clay-paths.js';

function clayMaterial(original){
  const material=original.clone();material.metalness=0;material.roughness=.94;
  if(material.normalScale)material.normalScale.set(.6,.6);
  return material;
}

// Weld position-only seam duplicates for connectivity, while retaining each
// original UV and normal in the extracted leaves. No leaf is sliced in half.
export function splitLilyLeaves(source){
  const leaves=[];source.updateMatrixWorld(true);
  source.traverse(mesh=>{
    if(!mesh.isMesh)return;
    const geometry=mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
    const positions=geometry.attributes.position,index=geometry.index;
    const parents=Int32Array.from({length:positions.count},(_,i)=>i);
    const representative=new Int32Array(positions.count),welded=new Map();
    function root(i){while(parents[i]!==i){parents[i]=parents[parents[i]];i=parents[i];}return i;}
    function join(a,b){a=root(a);b=root(b);if(a!==b)parents[b]=a;}
    for(let i=0;i<positions.count;i++){
      const key=[positions.getX(i),positions.getY(i),positions.getZ(i)].map(v=>v.toFixed(5)).join(',');
      if(!welded.has(key))welded.set(key,i);
      representative[i]=welded.get(key);
    }
    const total=index?index.count:positions.count;
    const at=i=>index?index.getX(i):i;
    for(let i=0;i<total;i+=3){join(representative[at(i)],representative[at(i+1)]);join(representative[at(i)],representative[at(i+2)]);}
    const components=new Map();
    for(let i=0;i<total;i+=3){
      const key=root(representative[at(i)]);
      if(!components.has(key))components.set(key,[]);
      components.get(key).push(at(i),at(i+1),at(i+2));
    }
    const material=Array.isArray(mesh.material)?mesh.material.map(clayMaterial):clayMaterial(mesh.material);
    for(const triangleIndices of components.values()){
      if(triangleIndices.length<300)continue;
      const remap=new Map(),vertices=[],indices=[];
      for(const i of triangleIndices){
        if(!remap.has(i)){remap.set(i,vertices.length);vertices.push(i);}
        indices.push(remap.get(i));
      }
      const leaf=new THREE.BufferGeometry();
      for(const [name,attribute] of Object.entries(geometry.attributes)){
        const data=new Float32Array(vertices.length*attribute.itemSize);
        vertices.forEach((i,v)=>{for(let axis=0;axis<attribute.itemSize;axis++)data[v*attribute.itemSize+axis]=attribute.array[i*attribute.itemSize+axis];});
        leaf.setAttribute(name,new THREE.BufferAttribute(data,attribute.itemSize));
      }
      leaf.setIndex(indices);leaf.computeBoundingBox();
      const bounds=leaf.boundingBox,size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
      leaf.translate(-center.x,-bounds.min.y,-center.z);leaf.computeBoundingSphere();
      leaves.push({geometry:leaf,material,diameter:Math.max(size.x,size.z)});
    }
    geometry.dispose();
  });
  if(leaves.length!==3)throw new Error(`Expected 3 separate lily leaves; found ${leaves.length}.`);
  return leaves.sort((a,b)=>b.diameter-a.diameter);
}

export function createAquaticPlants(parent,terrainHeight,riverZ){
  const floating=[];
  function addLilyPads(source){
    const leaves=splitLilyLeaves(source);
    const group=new THREE.Group();group.name='Lily pads — groups of 3, 2 and 1';
    const placements=[
      [-27,.4,2],[-21,-.5,1],[-16,.4,3],[-12.9,-.45,1],[-10.4,.55,2],[-8.3,-.3,3],
      [-3.7,-.42,2],[-1.2,.65,1],[1.25,-.15,3],[4.2,.45,1],[7.9,-.6,2],
      [11.7,.25,3],[16.1,-.5,1],[21,.4,2],[27,-.2,3],
    ];
    const layouts={1:[[0,0,1]],2:[[-.25,-.06,1],[.24,.14,.82]],
      3:[[-.27,.08,1],[.2,-.19,.84],[.24,.26,.72]]};
    placements.forEach(([x,across,count],i)=>{
      const cluster=new THREE.Group();cluster.name=`${count}-leaf lily group ${i+1}`;
      cluster.userData.leafCount=count;
      cluster.position.set(x,-.438,riverZ(x)+across);cluster.rotation.y=.4+i*2.399;
      const size=.92+(i%4)*.07;
      layouts[count].forEach(([lx,lz,relative],j)=>{
        const leaf=leaves[(j+i)%3],pad=new THREE.Mesh(leaf.geometry,leaf.material);
        pad.name='Individual lily leaf';pad.scale.setScalar(.62*relative*size/leaf.diameter);
        pad.position.set(lx*size,j*.002,lz*size);pad.rotation.y=j*1.55+i*.63;
        pad.castShadow=true;pad.receiveShadow=true;cluster.add(pad);
      });
      floating.push({object:cluster,baseY:cluster.position.y,phase:i*1.7});group.add(cluster);
    });
    parent.add(group);
  }
  function prepare(source){
    source.updateMatrixWorld(true);
    source.traverse(m=>{if(m.isMesh){
      m.material=Array.isArray(m.material)?m.material.map(clayMaterial):clayMaterial(m.material);
      m.castShadow=true;m.receiveShadow=true;
    }});
    const bounds=new THREE.Box3().setFromObject(source);
    return {bounds,size:bounds.getSize(new THREE.Vector3()),center:bounds.getCenter(new THREE.Vector3())};
  }
  function addFlowers(source){
    const {bounds,size,center}=prepare(source),flowers=new THREE.Group();flowers.name='Clay lotus and water plants';
    for(const [i,[x,across,height,angle]] of [[-11.9,.9,1.0,.5],[-2.75,1.0,1.12,2.6],[6.1,-.9,.96,4.5]].entries()){
      const group=new THREE.Group(),model=source.clone(true),scale=height/size.y;
      group.position.set(x,-.451,riverZ(x)+across);group.rotation.y=angle;
      model.scale.setScalar(scale);model.position.set(-center.x*scale,-bounds.min.y*scale,-center.z*scale);
      group.add(model);flowers.add(group);floating.push({object:group,baseY:group.position.y,phase:i*2.1+.8});
    }
    parent.add(flowers);
  }
  function addReeds(source){
    const {bounds,size,center}=prepare(source),reeds=new THREE.Group();reeds.name='Clay reeds along both riverbanks';
    const placements=[[-17,-1,1],[-14,-1,.86],[-11,-1,.95],[-8.6,-1,.9],[-6.2,-1,.78],[-3.7,-1,.95],[-.7,-1,.82],
      [4.3,-1,.92],[6.9,-1,.78],[9.3,-1,1.02],[12.4,-1,.85],[16,-1,1],
      [-10.1,1,1.1],[-6,1,.9],[-1.8,1,1.05],[4.7,1,1.15],[8.6,1,.9],[13,1,1.05],[17,1,1.05]];
    for(const [i,[x,side,height]] of placements.entries()){
      const z=riverZ(x)+side*(2.79+.14*Math.sin(i*2.3));
      if(Math.abs(x-DOCK.x)<1.45||isFarmPath(x,z,.42))continue;
      const group=new THREE.Group(),model=source.clone(true),scale=height*1.2/size.y;
      group.position.set(x,Math.max(-.49,terrainHeight(x,z)-.06),z);group.rotation.y=.35+i*2.1;
      model.scale.setScalar(scale);model.position.set(-center.x*scale,-bounds.min.y*scale,-center.z*scale);
      group.add(model);
      if(i%3===1){
        const tuft=source.clone(true),smallScale=scale*.65;
        tuft.scale.setScalar(smallScale);tuft.rotation.y=.8;
        tuft.position.set(.28-center.x*smallScale,-bounds.min.y*smallScale,.11-center.z*smallScale);
        group.add(tuft);
      }
      reeds.add(group);
    }
    parent.add(reeds);
  }
  return {addLilyPads,addFlowers,addReeds,update(seconds){
    for(const {object,baseY,phase} of floating){
      object.position.y=baseY+.004*Math.sin(seconds*.68+phase);
      object.rotation.x=.005*Math.sin(seconds*.53+phase);
      object.rotation.z=.004*Math.cos(seconds*.61+phase);
    }
  }};
}
