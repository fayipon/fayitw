import * as THREE from 'three';
import { isFarmPath } from './clay-paths.js';
import { RIVER_BASE, riverCenter } from './clay-layout.js';

// The complete terrain gets the supplied tile's surface and relief. Baking once
// lets the same grass cover all 90 x 90 units without repeating its dense mesh.
export function applyGrassSurface(renderer,ground,source) {
  source.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(source),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
  const camera=new THREE.OrthographicCamera(-size.x*.43,size.x*.43,size.z*.43,-size.z*.43,.1,10);
  camera.position.set(center.x,bounds.max.y+3,center.z);camera.up.set(0,0,-1);camera.lookAt(center);
  const bakeScene=new THREE.Scene(),model=source.clone(true),temporary=[];
  bakeScene.add(model);
  const surfaces=[];
  model.traverse(m=>{if(m.isMesh){
    const unlit=original=>{
      const material=new THREE.MeshBasicMaterial({map:original.map,color:original.color,side:THREE.DoubleSide,toneMapped:false});
      temporary.push(material);return material;
    };
    m.material=Array.isArray(m.material)?m.material.map(unlit):unlit(m.material);
    m.castShadow=false;m.receiveShadow=false;surfaces.push(m);
  }});
  const albedo=new THREE.WebGLRenderTarget(1024,1024,{depthBuffer:true,samples:2});
  const relief=new THREE.WebGLRenderTarget(1024,1024,{depthBuffer:true,samples:2});
  for(const target of [albedo,relief]){
    target.texture.wrapS=target.texture.wrapT=THREE.MirroredRepeatWrapping;
    target.texture.repeat.set(90/3.8,90/3.8);
    target.texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
  }
  const heightMaterial=new THREE.ShaderMaterial({side:THREE.DoubleSide,
    uniforms:{grassFloor:{value:.035},grassRange:{value:bounds.max.y-.035}},
    vertexShader:`varying float grassHeight;
      void main(){vec4 world=modelMatrix*vec4(position,1.);grassHeight=world.y;
        gl_Position=projectionMatrix*viewMatrix*world;}`,
    fragmentShader:`uniform float grassFloor,grassRange;varying float grassHeight;
      void main(){float height=clamp((grassHeight-grassFloor)/grassRange,0.,1.);
        gl_FragColor=vec4(vec3(height),1.);}`,
  });
  const previous=renderer.getRenderTarget();
  try{
    bakeScene.background=new THREE.Color('#a3b75b');
    renderer.setRenderTarget(albedo);renderer.render(bakeScene,camera);
    surfaces.forEach(m=>{m.material=heightMaterial;});
    bakeScene.background=new THREE.Color('#000000');
    renderer.setRenderTarget(relief);renderer.render(bakeScene,camera);
  }finally{
    renderer.setRenderTarget(previous);temporary.forEach(material=>material.dispose());heightMaterial.dispose();
  }
  // Both maps follow the same gently warped coordinates, avoiding a visible grid.
  const position=ground.geometry.attributes.position,uv=ground.geometry.attributes.uv;
  for(let i=0;i<position.count;i++){
    const x=position.getX(i),z=position.getZ(i);
    uv.setXY(i,(x+45)/90+.004*Math.sin(z*.35)+.002*Math.sin(x*.43),
      (45-z)/90+.004*Math.cos(x*.31)+.002*Math.sin(z*.39));
  }
  uv.needsUpdate=true;
  const material=new THREE.MeshStandardMaterial({map:albedo.texture,bumpMap:relief.texture,
    bumpScale:.085,roughness:1,metalness:0});
  material.onBeforeCompile=shader=>{
    shader.uniforms.grassBank={value:new THREE.Color('#b4a378')};
    shader.uniforms.grassRiverBase={value:RIVER_BASE};
    shader.vertexShader='varying vec3 vGrassWorld; varying float vGrassSlope;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\nvGrassWorld=(modelMatrix*vec4(position,1.)).xyz; vGrassSlope=normal.y;');
    shader.fragmentShader='varying vec3 vGrassWorld; varying float vGrassSlope;\nuniform vec3 grassBank;\nuniform float grassRiverBase;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
      vec3 grassColor=texture2D(map,vMapUv).rgb;
      vec3 variation=texture2D(map,vMapUv*.73+vec2(.31,.47)).rgb;
      grassColor=mix(grassColor,variation,.24);
      float value=dot(grassColor,vec3(.2126,.7152,.0722));
      vec3 meadow=mix(grassColor,value*vec3(.85,1.03,.44),.40)*.98;
      meadow*=.98+.045*sin(vGrassWorld.x*.37+sin(vGrassWorld.z*.28));
      float riverDistance=abs(vGrassWorld.z-(grassRiverBase+1.9*sin(vGrassWorld.x*.18)));
      float bank=1.-smoothstep(2.45,3.5,riverDistance);
      vec3 groundColor=mix(meadow,grassBank,bank);
      float cliff=1.-smoothstep(.55,.88,vGrassSlope);
      vec3 rock=vec3(.53,.48,.37)*(1.+.09*sin(vGrassWorld.x*4.+vGrassWorld.z*3.));
      diffuseColor.rgb*=mix(groundColor,rock,cliff);
    `);
  };
  material.customProgramCacheKey=()=> 'whole-map-clay-grass-v1';
  material.userData.grassTargets=[albedo,relief];
  ground.material.dispose();ground.material=material;
  ground.name='Continuous grass terrain from supplied GLB';
}

// Reuse the artist's actual grass, cutting a small surface patch out of the
// square tile. Hidden soil and the tile walls are not repeated around the farm.
export function addNaturalGrass(parent,source,terrainHeight) {
  source.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(source),center=bounds.getCenter(new THREE.Vector3());
  const patchRadius=.41;
  const placements=[
    [-8.6,-.1,3.4,2.6],[-9.4,1.9,3.1,2.4],[-7.8,3.65,2.8,2.2],[-9.1,4.8,2.5,2],
    [-8.8,-3.3,2.8,2.1],[-5.7,-6.6,2.8,2.1],[-3.1,-7.3,2.6,2.2],[-.65,-7.5,2.1,1.8],
    [1.6,-10,3,2.2],[4.85,-8.6,2.7,2.2],[6.8,-6.1,3.1,2.6],[8.7,-4.4,2.7,2.1],
    [8.1,-.8,3.1,2.6],[7.4,1.5,2.1,1.8],[8.5,3.65,2.8,2.2],[6.8,5.3,2,1.5],
    [3.2,7.5,2,1.5],[-6,11.5,3.2,2.6],[-2.1,12.2,2.7,2.1],[2.5,14.2,3.3,2.7],
    [-12.7,11.2,3,2.4],[-12.3,1.5,3.2,2.7],[12.5,-3.7,3.1,2.5],
    [-10,-10,3.2,2.5],[-5.5,-10.8,3,2.4],[-.8,-11.5,3.5,2.7],[5.8,-13.2,3.1,2.5],[9.5,-9.5,3.2,2.6],
  ].filter(([x,z,width,depth])=>{
    const radius=Math.max(width,depth)*.5;
    return !isFarmPath(x,z,radius*.78+.12)
      && Math.abs(z-riverCenter(x))>2.4+radius*.8;
  });
  // The marked courtyard pocket becomes a planted bed between hay and apple tree.
  placements.push([-8.7,-5.4,1.55,1.15]);
  const patches=new THREE.Group();patches.name='Natural grass from supplied GLB';
  parent.add(patches);
  source.traverse(mesh=>{
    if(!mesh.isMesh)return;
    const original=mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
    const position=original.attributes.position,uv=original.attributes.uv,index=original.index;
    const keep=new Uint8Array(position.count),radial=new Float32Array(position.count);
    for(let i=0;i<position.count;i++){
      const x=position.getX(i)-center.x,z=position.getZ(i)-center.z,angle=Math.atan2(z,x);
      const edge=patchRadius*(1+.11*Math.sin(angle*3+.6)+.065*Math.cos(angle*5));
      radial[i]=Math.hypot(x,z)/edge;
      keep[i]=radial[i]<1&&position.getY(i)>.025?1:0;
    }
    const remap=new Int32Array(position.count).fill(-1),vertices=[],texcoords=[],triangles=[];
    function vertex(i){
      if(remap[i]>=0)return remap[i];
      const next=vertices.length/3;remap[i]=next;
      const fringe=THREE.MathUtils.smoothstep(radial[i],.58,1);
      vertices.push((position.getX(i)-center.x)/patchRadius,
        (position.getY(i)-.073)*1.4-.16*fringe*fringe,
        (position.getZ(i)-center.z)/patchRadius);
      texcoords.push(uv.getX(i),uv.getY(i));return next;
    }
    for(let i=0;i<(index?index.count:position.count);i+=3){
      const a=index?index.getX(i):i,b=index?index.getX(i+1):i+1,c=index?index.getX(i+2):i+2;
      if(keep[a]&&keep[b]&&keep[c])triangles.push(vertex(a),vertex(b),vertex(c));
    }
    original.dispose();
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
    geometry.setAttribute('uv',new THREE.Float32BufferAttribute(texcoords,2));geometry.setIndex(triangles);
    geometry.computeVertexNormals();geometry.computeBoundingSphere();
    const soften=sourceMaterial=>{
      const material=sourceMaterial.clone();material.metalness=0;material.roughness=1;
      if(material.normalScale)material.normalScale.set(.45,.45);
      // The tile's bright yellow-green works under soil, but needs a softer
      // meadow tone when its whole surface is exposed to the sunlight.
      material.onBeforeCompile=shader=>{
        shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
          #include <map_fragment>
          float grassValue=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
          vec3 meadowTone=grassValue*vec3(.82,.98,.47);
          diffuseColor.rgb=mix(diffuseColor.rgb,meadowTone,.62)*.86;
        `);
      };
      material.customProgramCacheKey=()=> 'natural-clay-grass-v1';
      return material;
    };
    const material=Array.isArray(mesh.material)?mesh.material.map(soften):soften(mesh.material);
    const batch=new THREE.InstancedMesh(geometry,material,placements.length);
    const matrix=new THREE.Matrix4(),up=new THREE.Vector3(0,1,0),tilt=new THREE.Quaternion(),turn=new THREE.Quaternion();
    placements.forEach(([x,z,width,depth],i)=>{
      const dx=(terrainHeight(x+.4,z)-terrainHeight(x-.4,z))/.8;
      const dz=(terrainHeight(x,z+.4)-terrainHeight(x,z-.4))/.8;
      tilt.setFromUnitVectors(up,new THREE.Vector3(-dx,1,-dz).normalize());
      turn.setFromAxisAngle(up,i*2.399+.4);tilt.multiply(turn);
      matrix.compose(new THREE.Vector3(x,terrainHeight(x,z)-.006,z),tilt,
        new THREE.Vector3(width*.5,1.55+(i%4)*.14,depth*.5));
      batch.setMatrixAt(i,matrix);
      batch.setColorAt(i,new THREE.Color().setRGB(.91+(i%3)*.025,.94+(i%2)*.025,.88+(i%4)*.02));
    });
    batch.instanceMatrix.needsUpdate=true;batch.receiveShadow=true;batch.castShadow=false;
    batch.computeBoundingSphere();patches.add(batch);
  });
}
