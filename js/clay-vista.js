import * as THREE from 'three';

// A continuous lake valley and layered clay ridges frame the playable farm.
export function addLakeScenery(parent){
  const group=new THREE.Group();group.name='Blue lake and distant clay mountains';parent.add(group);
  const canvas=document.createElement('canvas');canvas.width=canvas.height=512;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#168ecc';ctx.fillRect(0,0,512,512);
  for(let i=0;i<280;i++){
    const y=i*13.73%512,x=i*73.19%512;
    ctx.strokeStyle=i%3?'#73d8ef40':'#056cad35';ctx.lineWidth=1+i%3;ctx.beginPath();
    ctx.ellipse(x,y,8+i%23,1.8,0,0,Math.PI);ctx.stroke();
  }
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(5,7);
  const lake=new THREE.Mesh(new THREE.PlaneGeometry(38,45),new THREE.MeshStandardMaterial({map:texture,color:'#8be6ff',roughness:.35,metalness:.04}));
  lake.rotation.x=-Math.PI/2;lake.position.set(-10,-.42,-33);lake.receiveShadow=true;group.add(lake);
  const colors=['#679bb1','#699d94','#7aa55d'];
  for(let row=0;row<3;row++){
    const geometry=new THREE.PlaneGeometry(120,24,100,30);geometry.rotateX(-Math.PI/2);
    const positions=geometry.attributes.position;
    for(let j=0;j<positions.count;j++){
      const x=positions.getX(j),z=positions.getZ(j);
      const ridge=Math.pow(Math.max(0,1-Math.abs(z)/12),1.3);
      const peaks=4+7*Math.pow(.5+.5*Math.sin(x*.17+row*1.7),2)+2*Math.sin(x*.41);
      positions.setY(j,ridge*peaks*.55-1);
    }
    geometry.computeVertexNormals();
    const mountains=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:colors[row],roughness:1}));
    mountains.position.set(0,0,-68+row*9);group.add(mountains);
  }
  const cloudMaterial=new THREE.MeshStandardMaterial({color:'#fff9e9',roughness:1});
  const puffGeometry=new THREE.SphereGeometry(1,12,8);
  for(const [x,y,z,s] of [[-23,10,-43,1.5],[-4,12,-49,1.8],[15,11,-44,1.3]]){
    for(const [dx,dy,r] of [[-1.7,0,1],[0,.5,1.5],[1.8,.1,1.1],[3,0,.7]]){
      const puff=new THREE.Mesh(puffGeometry,cloudMaterial);puff.position.set(x+dx*s,y+dy*s,z);puff.scale.set(r*s,r*s*.78,r*s*.75);group.add(puff);
    }
  }
}

export function addValleyVillage(parent,terrainHeight){
  const group=new THREE.Group();group.name='Hillside village';parent.add(group);
  const plaster=new THREE.MeshStandardMaterial({color:'#f1d8ab',roughness:1});
  const roofMat=new THREE.MeshStandardMaterial({color:'#a84c36',roughness:1});
  const wood=new THREE.MeshStandardMaterial({color:'#685339',roughness:1});
  for(const [i,[x,z,size]] of [[-17,-24,.8],[-2,-28,.9],[-22,-35,.7],[1,-39,.65]].entries()){
    const house=new THREE.Group();house.position.set(x,terrainHeight(x,z),z);house.scale.setScalar(size);house.rotation.y=.2+i*.5;
    const walls=new THREE.Mesh(new THREE.BoxGeometry(1.7,1.8,1.5),plaster);walls.position.y=.9;house.add(walls);
    const roof=new THREE.Mesh(new THREE.ConeGeometry(1.6,1.4,4),roofMat);roof.rotation.y=Math.PI/4;roof.position.y=2.25;house.add(roof);
    const door=new THREE.Mesh(new THREE.BoxGeometry(.48,.9,.06),wood);door.position.set(0,.45,.78);house.add(door);
    group.add(house);
    if(i===1){
      const tower=new THREE.Mesh(new THREE.CylinderGeometry(.5,.85,3,12),plaster);tower.position.set(-2,1.5,0);house.add(tower);
      const cap=new THREE.Mesh(new THREE.ConeGeometry(.9,1,12),roofMat);cap.position.set(-2,3.3,0);house.add(cap);
      const rotor=new THREE.Group();rotor.position.set(-2,2.6,.6);rotor.rotation.z=.7;
      for(let j=0;j<4;j++){
        const blade=new THREE.Mesh(new THREE.BoxGeometry(.25,1.5,.08),wood);const angle=j*Math.PI/2;
        blade.position.set(Math.sin(angle)*.85,Math.cos(angle)*.85,0);blade.rotation.z=-angle;rotor.add(blade);
      }
      house.add(rotor);
    }
  }
  group.traverse(object=>object.layers.set(2));
}
