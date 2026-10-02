import * as THREE from 'three';
import { addRockInstances } from './clay-rocks.js';

export function addRiverBed(parent,terrainHeight,riverZ,rockPieces=null){
  const bed=new THREE.Group();bed.name='Underwater clay sand and pebbles';parent.add(bed);
  let seed=8731;
  const random=()=>((seed=(1664525*seed+1013904223)>>>0)/4294967296);
  const bedHeight=(x,z)=>Math.min(-.445,terrainHeight(x,z)+.024+.006*Math.sin(x*2.8+z*1.7));
  const sandCanvas=document.createElement('canvas');sandCanvas.width=sandCanvas.height=512;
  const paint=sandCanvas.getContext('2d');paint.fillStyle='#e4deca';paint.fillRect(0,0,512,512);
  for(let i=0;i<6500;i++){
    paint.fillStyle=i%3?'#7b8c7940':'#fff7de70';
    const x=random()*512,y=random()*512,r=.35+random()*1.4;
    paint.beginPath();paint.ellipse(x,y,r,r*.55,random()*Math.PI,0,Math.PI*2);paint.fill();
  }
  for(let band=0;band<22;band++){
    paint.beginPath();paint.strokeStyle='#a6b2a11c';paint.lineWidth=1.5;
    for(let x=0;x<=512;x+=4){const y=band*25+5*Math.sin(x*.034+band*.8);if(x===0)paint.moveTo(x,y);else paint.lineTo(x,y);}
    paint.stroke();
  }
  const texture=new THREE.CanvasTexture(sandCanvas);texture.colorSpace=THREE.SRGBColorSpace;
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
  const positions=[],colors=[],uvs=[],indices=[],along=320,across=24;
  const shallow=new THREE.Color('#b0b08c'),deep=new THREE.Color('#638f92');
  for(let i=0;i<=along;i++){
    const x=-48+i/along*96;
    for(let j=0;j<=across;j++){
      const offset=(j/across*2-1)*3.25,z=riverZ(x)+offset,y=bedHeight(x,z);
      positions.push(x,y,z);uvs.push(x*.34,offset*.5);
      const depth=THREE.MathUtils.smoothstep(-.42-y,.12,.53);
      const color=shallow.clone().lerp(deep,depth).multiplyScalar(.98+.035*Math.sin(x*2.3+offset*4.));
      colors.push(color.r,color.g,color.b);
      if(i<along&&j<across){const a=i*(across+1)+j,b=a+across+1;indices.push(a,a+1,b,b,a+1,b+1);}
    }
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  geometry.setIndex(indices);geometry.computeVertexNormals();
  const sand=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({map:texture,vertexColors:true,roughness:1}));
  sand.receiveShadow=true;bed.add(sand);

  const pebbleGeometry=new THREE.IcosahedronGeometry(1,2),pebbleMaterial=new THREE.MeshStandardMaterial({roughness:1});
  const pebbles=[];
  for(let i=0;i<270;i++){
    const x=-32+random()*64;
    const bankStone=i%5===0;
    const offset=bankStone?(i%2?1:-1)*(2.12+random()*.3):(random()-.5)*3.8;
    const z=riverZ(x)+offset,radius=bankStone?.14+random()*.12:.035+random()*.055;
    const height=bankStone?radius*.45:radius*.34;
    pebbles.push({x,y:bedHeight(x,z)+height*.45,z,radius,height,angle:random()*6.28});
  }
  if(rockPieces){
    addRockInstances(bed,rockPieces,pebbles.map(p=>({x:p.x,y:bedHeight(p.x,p.z),z:p.z,width:p.radius*1.65,angle:p.angle,count:1})),{submerged:true});
    pebbleGeometry.dispose();pebbleMaterial.dispose();return bed;
  }
  const stones=new THREE.InstancedMesh(pebbleGeometry,pebbleMaterial,pebbles.length);
  const matrix=new THREE.Matrix4(),turn=new THREE.Quaternion(),axis=new THREE.Vector3(0,1,0);
  pebbles.forEach((p,i)=>{
    turn.setFromAxisAngle(axis,p.angle);
    matrix.compose(new THREE.Vector3(p.x,p.y,p.z),turn,new THREE.Vector3(p.radius,p.height,p.radius*.78));
    stones.setMatrixAt(i,matrix);stones.setColorAt(i,new THREE.Color(['#7d9992','#a2afa0','#7d9b9f','#b6b697'][i%4]));
  });
  stones.instanceMatrix.needsUpdate=true;stones.receiveShadow=true;stones.castShadow=false;bed.add(stones);
  return bed;
}
