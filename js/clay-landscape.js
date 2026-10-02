import { addTreeModels } from './clay-trees.js';
import * as THREE from 'three';
import { isFarmPath } from './clay-paths.js';
import { applyGrassSurface } from './clay-grass.js';
import { createAquaticPlants } from './clay-water-plants.js';
import { createRiverFish } from './clay-fish.js';
import { addRiverBed } from './clay-riverbed.js';
import { splitLandscapeRocks, addRockInstances } from './clay-rocks.js';
import { RIVER_BASE, riverCenter, DOCK, fieldPoint } from './clay-layout.js';

// Deterministic, lightweight scenery. Artist-supplied farm models remain separate.
export function createLandscape(scene, renderer, camera) {
  const landscape = new THREE.Group();
  landscape.name = 'Foreground and distant landscape';
  scene.add(landscape);
  const riverTime={value:0};
  let updateFish=()=>{};
  let rockPieces=null;
  let seed = 716;
  const random = () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296);
  const riverZ = riverCenter;
  const smooth = THREE.MathUtils.smoothstep;
  const terrainHeight = (x, z) => {
    const distance = Math.abs(z - riverZ(x));
    const bank = smooth(distance, 2.05, 3.25);
    const outside = smooth(Math.max(Math.abs(x) - 8.8, -z - 8.7, z - 6), 0, 5);
    const rolling = .18 + .25 * Math.sin(x * .28) * Math.cos(z * .22);
    const hills = smooth(-z, 10, 25) * (1.2 + 1.3 * Math.sin(x * .14 + .6) ** 2);
    const lakeStart=smooth(-z,18,24);
    const lakeWidth=5.8+2*Math.sin(z*.16);
    const shore=smooth(Math.abs(x-(z*.42+3)),lakeWidth,lakeWidth+3);
    const valley=-1.25+(shore)*(1.5+hills*.85+rolling);
    const fieldHeight=-.055 - (1 - bank) * .9 + outside * bank * (rolling + hills);
    return THREE.MathUtils.lerp(fieldHeight,valley,lakeStart);
  };
  const terrain = new THREE.PlaneGeometry(90, 90, 160, 160);
  terrain.rotateX(-Math.PI / 2);
  const positions = terrain.attributes.position;
  const colors = new Float32Array(positions.count * 3);
  const meadow = new THREE.Color('#91a35b'), grass = new THREE.Color('#b1b77a');
  const bankColor = new THREE.Color('#b4a378');
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), z = positions.getZ(i);
    positions.setY(i, terrainHeight(x, z));
    const noise = .5 + .24 * Math.sin(x * 1.1 + Math.sin(z * .8)) + .18 * Math.cos(z * 1.8 + x * .5);
    const color = meadow.clone().lerp(grass, noise);
    const riverDistance = Math.abs(z - riverZ(x));
    color.lerp(bankColor, 1 - smooth(riverDistance, 2.45, 3.5));
    color.toArray(colors, i * 3);
  }
  terrain.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  terrain.computeVertexNormals();
  const grainCanvas=document.createElement('canvas');grainCanvas.width=grainCanvas.height=512;
  const paint=grainCanvas.getContext('2d');paint.fillStyle='#ebe8d4';paint.fillRect(0,0,512,512);
  for(let i=0;i<7500;i++){
    paint.fillStyle=i%3===0?'#b8bea03b':'#ffffff38';
    const x=random()*512,y=random()*512;
    paint.beginPath();paint.ellipse(x,y,.6+random()*2,1+random()*3,random()*Math.PI,0,Math.PI*2);paint.fill();
  }
  const grain=new THREE.CanvasTexture(grainCanvas);grain.wrapS=grain.wrapT=THREE.RepeatWrapping;
  grain.repeat.set(18,18);grain.colorSpace=THREE.SRGBColorSpace;grain.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
  const ground = new THREE.Mesh(terrain, new THREE.MeshStandardMaterial({ vertexColors: true, map:grain, roughness: 1 }));
  ground.userData.matteTerrain=true;
  ground.receiveShadow = true;
  landscape.add(ground);

  const waterGeometry = new THREE.PlaneGeometry(90, 90);
  waterGeometry.rotateX(-Math.PI / 2);
  const waterMaterial = new THREE.MeshStandardMaterial({ color: '#249fc8', roughness: .36, metalness: .05 });
  const water = new THREE.Mesh(waterGeometry, waterMaterial);
  water.position.y = -.43;
  landscape.add(water);

  // Clay pebble and leaf geometry shared by all the small scenery instances.
  const pebbleGeometry = new THREE.IcosahedronGeometry(1, 2);
  const leafGeometry = new THREE.SphereGeometry(1, 8, 6);
  const stoneMaterial = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1 });
  const leafMaterial = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1 });
  const stones = [], leaves = [], flowerPlacements = [];
  const matrix = new THREE.Matrix4(), rotation = new THREE.Quaternion(), scale = new THREE.Vector3();
  function instances(geometry, material, points, castShadow = true) {
    const batch = new THREE.InstancedMesh(geometry, material, points.length);
    points.forEach((p, i) => {
      rotation.setFromEuler(new THREE.Euler(p.rx || 0, p.ry || 0, p.rz || 0));
      matrix.compose(new THREE.Vector3(p.x, p.y, p.z), rotation, scale.set(p.sx, p.sy, p.sz));
      batch.setMatrixAt(i, matrix);
      if (p.color) batch.setColorAt(i, new THREE.Color(p.color));
    });
    batch.castShadow = castShadow;
    batch.receiveShadow = true;
    landscape.add(batch);
    return batch;
  }
  function shrub(x, z, size = 1, flowersEnabled = false) {
    if(isFarmPath(x,z,size*.45))return;
    const y = terrainHeight(x, z);
    for (let i = 0; i < 14; i++) {
      const angle = i * 2.399, radius = size * (.14 + random() * .28);
      const leaf = { x: x + Math.cos(angle) * radius, y: y + size * (.09 + random() * .19), z: z + Math.sin(angle) * radius,
        sx: size * (.07 + random() * .12), sy: size * (.15 + random() * .14), sz: size * .075,
        ry: angle, rz: .4 + random() * .5, color: ['#82944f', '#97a65c', '#6b8947'][i % 3] };
      if(!flowersEnabled)leaves.push(leaf);
    }
    if (flowersEnabled) {
      flowerPlacements.push([x,z,size]);
      // Preserve the seeded layout of all subsequent scenery.
      for(let i=0;i<9;i++)random();
    }
  }

  // Riverbank: irregular stones, low plants, reeds and lily pads in the foreground.
  for (let i = 0; i < 105; i++) {
    const x = -23 + random() * 46, side = i % 2 ? 1 : -1;
    const z = riverZ(x) + side * (2.7 + random() * .55);
    if (Math.abs(x - DOCK.x) < 1.5) continue; // Leave the footbridge unobstructed.
    const radius = .16 + random() * .35;
    if(isFarmPath(x,z,radius+.12))continue;
    stones.push({ x, y: terrainHeight(x, z) + radius * .18, z, sx: radius, sy: radius * .7, sz: radius * .85,
      ry: random() * Math.PI, color: ['#b4ad96', '#929d91', '#c8b898'][i % 3] });
    if (i % 2) shrub(x + .25, z, .7 + random() * .6, i % 5 === 0);
  }
  const reedPoints=[];
  for (const [x, offset] of [[-7.2,-.5],[-3.8,-.8],[2,2.4],[7,3.8],[-9.8,-3]]) {
    const z=RIVER_BASE+offset;
    const y = terrainHeight(x, z);
    for (let i = 0; i < 9; i++) reedPoints.push({ x: x + (random() - .5) * .5, y: y + .3, z: z + (random() - .5) * .5,
      sx: .06, sy: .4 + random() * .25, sz: .035, ry: random() * 6.28, rz: (random() - .5) * .8, color: '#708949' });
  }
  const reedsFallback=instances(leafGeometry,leafMaterial,reedPoints);
  const pads = [];
  for (let i = 0; i < 26; i++) {
    const x = -15 + random() * 30, z = riverZ(x) + (random() - .5) * 1.8;
    const s = .13 + random() * .17;
    pads.push({ x, y: -.407, z, sx: s, sy: .018, sz: s * .78, ry: random() * 6.28 });
  }
  const liliesFallback=instances(new THREE.CylinderGeometry(1, 1, 1, 14, 1, false, .15, Math.PI * 1.84),
    new THREE.MeshStandardMaterial({ color: '#8ba257', roughness: .9 }), pads, false);

  // Garden borders and foreground flowers; paths and the cultivated area stay clear.
  for (let i = 0; i < 180; i++) {
    const x = -20 + random() * 40, z = -21 + random() * 36;
    if (Math.abs(z - riverZ(x)) < 3.2) continue;
    if (Math.abs(x) < 7.5 && z > -8 && z < 10.8) continue;
    if (x > 5.2 && x < 7.8 && z > -3.5 && z < -.8) continue;
    shrub(x, z, .45 + random() * .9, i % 3 === 0);
  }
  for (const [x, z] of [[-4.7, 5], [-4.8, 2], [4.75, 4.5], [4.8, -.8], [6.2, 6.3]].map(([x,z])=>fieldPoint(x,z))) shrub(x,z,.75,true);
  for (const [x,z] of [[1,-4.4],[-3.8,-3.9],[3.9,-5.6]]) shrub(x,z,.75,true);
  // Low garden planting fills the pocket between the hay stack and apple tree.
  for(const [x,z,s] of [[-9.25,-5.4,.85],[-8.5,-5.7,.75],[-8,-5.2,.65],[-8.65,-4.8,.5]])shrub(x,z,s,false);
  // Small rock gardens occupy the former lanes, with breathing room between
  // pockets and a clear walking surface all the way down to the dock.
  const meadowPockets=[
    ...[[-5.6,.3,1],[-5.65,2.5,1.15],[-4.65,4.85,.95],[-2.7,5.45,1.1],
      [-.7,5.55,.9],[1.4,5.45,.85],[6.35,.1,.85],[6.45,2.35,1.05]]
      .map(([x,z,size])=>{const p=fieldPoint(x,z);return {x:p[0],z:p[1],size};}),
    {x:6.05,z:7.8,size:1.1},{x:7.8,z:8.8,size:1.15},{x:2.3,z:8.45,size:.9},
    {x:-7.1,z:1.7,size:.95},{x:8.8,z:6.85,size:.85},
  ];
  for(const [i,{x,z,size}] of meadowPockets.entries()){
    if(isFarmPath(x,z,size*.75)||Math.abs(z-riverZ(x))<3.35)continue;
    shrub(x,z,size,true);
    shrub(x+.48*size,z+.24*size,size*.72,true);
    if(i%2===0)shrub(x-.27*size,z+.44*size,size*.6,true);
    const sx=x-.42*size,sz=z-.2*size,radius=size*(i%3===0?.36:.28);
    if(!isFarmPath(sx,sz,radius+.16))stones.push({
      x:sx,y:terrainHeight(sx,sz)+radius*.18,z:sz,sx:radius,sy:radius*.7,sz:radius*.88,
      ry:i*2.399,color:['#b4ad96','#a4a592','#c4b699'][i%3],
    });
  }
  const riverPebbles=instances(pebbleGeometry, stoneMaterial, stones);
  instances(leafGeometry, leafMaterial, leaves);


  // Rounded, uneven crowns with a second layer of little leaf clusters.
  const crownGeometry = new THREE.SphereGeometry(1, 14, 10);
  const cp = crownGeometry.attributes.position;
  for (let i = 0; i < cp.count; i++) {
    const x = cp.getX(i), y = cp.getY(i), z = cp.getZ(i);
    const n = 1 + .06 * Math.sin(x * 8 + y * 3) * Math.sin(z * 7 - y * 4);
    cp.setXYZ(i, x * n, y * n, z * n);
  }
  crownGeometry.computeVertexNormals();
  const crowns = [], trunks = [], contacts=[], treePlacements=[];
  function woodlandTree(x, z, size = 1) {
    if(terrainHeight(x,z)<-.3)return;
    treePlacements.push({x,z,size,y:terrainHeight(x,z)});
    const y = terrainHeight(x, z);
    contacts.push({x,y:y+.018,z,sx:size*2.4,sy:size*2.4,sz:1,rx:-Math.PI/2});
    trunks.push({ x, y: y + size * .9, z, sx: size * .18, sy: size * 1.8, sz: size * .18, ry: random() * 6.28 });
    for (let i = 0; i < 10; i++) {
      const a = i * 2.399;
      const radius = size * (.38 + random() * .25);
      crowns.push({ x: x + Math.cos(a) * size * .48, y: y + size * (1.7 + random() * .62), z: z + Math.sin(a) * size * .48,
        sx: radius, sy: radius * (1.05 + random() * .25), sz: radius, ry: random() * 6.28,
        color: ['#779354', '#8c9e59', '#637f4c', '#9caa69'][i % 4] });
      for (let j = 0; j < 3; j++) crowns.push({ x: x + Math.cos(a) * size * (.5 + random() * .35),
        y: y + size * (1.6 + random() * .8), z: z + Math.sin(a) * size * (.5 + random() * .35),
        sx: size * .25, sy: size * .29, sz: size * .23, color: ['#839853', '#92a060'][j % 2] });
    }
  }
  for(const [x,z,size] of [[12,7,1.7],[0,19,1.6],[-13,11,1.4]])woodlandTree(x,z,size);
  const treeTrunks=instances(new THREE.CylinderGeometry(.75, 1, 1, 10), new THREE.MeshStandardMaterial({ color: '#8e724e', roughness: 1 }), trunks,false);
  const treeCrowns=instances(crownGeometry, new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1 }), crowns,false);
  // Soft ground contact for distant trees avoids clipped shadows at the sun's frustum boundary.
  const shadowCanvas=document.createElement('canvas');shadowCanvas.width=shadowCanvas.height=64;
  const shadowPaint=shadowCanvas.getContext('2d'),fade=shadowPaint.createRadialGradient(32,32,2,32,32,32);
  fade.addColorStop(0,'rgba(48,61,31,.26)');fade.addColorStop(1,'rgba(48,61,31,0)');
  shadowPaint.fillStyle=fade;shadowPaint.fillRect(0,0,64,64);
  instances(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(shadowCanvas),transparent:true,depthWrite:false}),contacts,false);

  // A few bands of reflected sky sit within the curved stream, not above the bank.
  const ripples = [];
  for (let i = 0; i < 85; i++) {
    const x = -24 + random() * 48, z = riverZ(x) + (random() - .5) * 2;
    ripples.push({ x, y: -.404, z, sx: .12 + random() * .35, sy: .004, sz: .012 + random() * .018, ry: -.12 });
  }
  instances(leafGeometry, new THREE.MeshBasicMaterial({ color: '#aac4b9', transparent: true, opacity: .28 }), ripples, false);
  function addRockClusters(source, pathStones=[]) {
    const pieces=splitLandscapeRocks(source);
    const placements=[
      {x:-8.6,z:riverZ(-8.6)-3.25,width:1.35,angle:.3},
      {x:-3.25,z:riverZ(-3.25)-3.25,width:1.35,angle:2.1},
      {x:.8,z:riverZ(.8)-3.35,width:1.6,angle:4.2},
      {x:5.8,z:riverZ(5.8)-3.35,width:1.45,angle:1.4},
      {x:-3.9,z:riverZ(-3.9)+3.5,width:1.6,angle:3.4},
      {x:2.4,z:riverZ(2.4)+3.45,width:1.75,angle:5.5},
    ].filter(p=>Math.abs(p.x-DOCK.x)>1.6);
    // The focal clusters now contain two stones instead of repeating all three.
    for(const p of placements){
      if(Math.abs(p.x-DOCK.x)<1.6)continue;
      p.count=2;
      for(let step=0;step<4&&isFarmPath(p.x,p.z,p.width*.45+.12);step++)p.z+=.28;
      p.y=terrainHeight(p.x,p.z);
    }
    // Small, uneven pockets of stones soften the waterline without forming a wall.
    for(const [cluster,anchor] of [-12,-9.7,-7.3,-5.1,-2.8,-.65,3.9,6.2,8.6,11.2,14].entries()){
      for(let i=0;i<3+(cluster%2);i++){
        const x=anchor+(i-1)*.36+.08*Math.sin(cluster+i*2.1);
        const z=riverZ(x)-2.94-.22*Math.sin(cluster*1.7+i*2.4);
        const width=.38+.23*(.5+.5*Math.sin(cluster*3.1+i*1.6));
        if(Math.abs(x-DOCK.x)<1.5||isFarmPath(x,z,width*.5+.14))continue;
        if(placements.some(p=>Math.hypot(x-p.x,z-p.z)<(p.width+width)*.42))continue;
        placements.push({x,z,y:terrainHeight(x,z),width,angle:cluster*1.3+i*2.1,count:1});
      }
    }
    stones.forEach((stone,i)=>{
      if(placements.some(p=>Math.hypot(stone.x-p.x,stone.z-p.z)<p.width*.65))return;
      const count=i%5===0?2:1,width=stone.sx*(count===2?2.2:1.8);
      if(isFarmPath(stone.x,stone.z,width*.5+.12))return;
      const angle=count===1?.7+Math.sin(i*2.399)*.8:stone.ry+i*.7;
      placements.push({x:stone.x,z:stone.z,y:terrainHeight(stone.x,stone.z),width,angle,count});
    });
    for(const [i,p] of pathStones.entries())placements.push({...p,y:terrainHeight(p.x,p.z),count:1,angle:.2+i*.5});
    for(const p of [{x:-8.75,z:-5.25,width:.75,count:2,angle:.65},{x:-8.2,z:-5,width:.42,count:1,angle:2.1}])placements.push({...p,y:terrainHeight(p.x,p.z)});
    addRockInstances(landscape,pieces,placements);
    rockPieces=pieces;
    riverPebbles.visible=false;
  }
  function addRiverTiles(source) {
    source.updateMatrixWorld(true);
    const bounds=new THREE.Box3().setFromObject(source),size=bounds.getSize(new THREE.Vector3());
    const center=bounds.getCenter(new THREE.Vector3());
    // Bake the model's top into one planar texture before scrolling it. The
    // source UV atlas contains separate islands and cannot slide as a whole.
    const surfaceTarget=new THREE.WebGLRenderTarget(1024,1024,{depthBuffer:true,samples:2});
    surfaceTarget.texture.wrapS=surfaceTarget.texture.wrapT=THREE.MirroredRepeatWrapping;
    surfaceTarget.texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
    const bakeScene=new THREE.Scene(),bakeModel=source.clone(true),bakeMaterials=[];
    bakeScene.background=new THREE.Color('#368ca6');
    bakeModel.traverse(m=>{if(m.isMesh){
      const unlit=original=>{
        const mat=new THREE.MeshBasicMaterial({map:original.map,color:original.color,side:THREE.DoubleSide,toneMapped:false});
        bakeMaterials.push(mat);return mat;
      };
      m.material=Array.isArray(m.material)?m.material.map(unlit):unlit(m.material);
      m.castShadow=false;m.receiveShadow=false;
    }});
    bakeScene.add(bakeModel);
    const bakeCamera=new THREE.OrthographicCamera(-size.x*.47,size.x*.47,size.z*.47,-size.z*.47,.1,10);
    bakeCamera.position.set(center.x,bounds.max.y+3,center.z);bakeCamera.up.set(0,0,-1);bakeCamera.lookAt(center);
    const previousTarget=renderer.getRenderTarget();
    try{renderer.setRenderTarget(surfaceTarget);renderer.render(bakeScene,bakeCamera);}
    finally{renderer.setRenderTarget(previousTarget);bakeMaterials.forEach(mat=>mat.dispose());}
    const river=new THREE.Group();river.name='Clay river tiles GLB';
    const meshes=[];
    source.traverse(m=>{if(m.isMesh){
      const geometry=m.geometry.clone().applyMatrix4(m.matrixWorld);
      const waterFinish=original=>{
        const mat=original.clone();mat.map=surfaceTarget.texture;
        mat.normalMap=null;mat.roughnessMap=null;mat.metalnessMap=null;
        mat.color.set('#85bdc8');mat.metalness=0;mat.roughness=.48;
        mat.transparent=true;mat.opacity=.62;mat.depthWrite=false;mat.side=THREE.FrontSide;
        mat.onBeforeCompile=shader=>{
          shader.uniforms.uRiverTime=riverTime;shader.uniforms.uRiverBase={value:RIVER_BASE};
          shader.vertexShader='uniform float uRiverTime,uRiverBase;\nattribute vec2 riverInterval;\nvarying vec2 vRiverInterval;\nvarying vec3 vRiverPosition;\n'+shader.vertexShader;
          shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`
            #include <begin_vertex>
            vRiverPosition=position;
            vRiverInterval=riverInterval;
            float riverAcross=position.z-(uRiverBase+1.9*sin(position.x*.18));
            float surfaceMask=smoothstep(-.52,-.435,position.y);
            transformed.y+=surfaceMask*(.006*sin(position.x*3.8+riverAcross*1.7-uRiverTime*1.25)
              +.003*sin(position.x*6.2-riverAcross*2.5-uRiverTime*1.8));
          `);
          shader.fragmentShader='uniform float uRiverTime,uRiverBase;\nvarying vec2 vRiverInterval;\nvarying vec3 vRiverPosition;\n'+shader.fragmentShader;
          shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
            // Trim overlapping tile ends so transparent sections blend only once.
            if(vRiverPosition.x<vRiverInterval.x||vRiverPosition.x>=vRiverInterval.y)discard;
            #ifdef USE_MAP
              // World-space coordinates carry flow smoothly around bends and across tiles.
              float across=vRiverPosition.z-(uRiverBase+1.9*sin(vRiverPosition.x*.18));
              vec2 flowUv=vec2(vRiverPosition.x/4.0,across/6.6+.5);
              flowUv.x-=uRiverTime*.055;
              flowUv.y+=.014*sin(vRiverPosition.x*1.3-uRiverTime*.7)
                +.008*sin(vRiverPosition.x*2.9+uRiverTime*.45);
              vec3 primary=texture2D(map,flowUv).rgb;
              vec2 secondaryUv=flowUv*1.31+vec2(-uRiverTime*.016,.24);
              vec3 secondary=texture2D(map,secondaryUv).rgb;
              float glint=1.0+.045*sin(vRiverPosition.x*4.0-across*3.0-uRiverTime*1.1);
              vec3 flowingWater=mix(primary,secondary,.22);
              float waterLight=dot(flowingWater,vec3(.2126,.7152,.0722));
              diffuseColor.rgb*=mix(vec3(waterLight),flowingWater,.78)*glint;
            #endif
          `);
        };
        mat.customProgramCacheKey=()=> 'clay-river-flow-v2';
        return mat;
      };
      const material=Array.isArray(m.material)?m.material.map(waterFinish):waterFinish(m.material);
      meshes.push({geometry,material});
    }});
    // Keep the supplied surface geometry, seating the tile sides under the bank.
    // A small overlap hides seams as each section follows the same river curve.
    for(let start=-48;start<48;start+=4){
      for(const part of meshes){
        const geometry=part.geometry.clone(),position=geometry.attributes.position;
        const interval=new Float32Array(position.count*2);
        for(let i=0;i<position.count;i++){
          const x=start+2+(position.getX(i)-center.x)*4.16/size.x;
          const y=-.42+(position.getY(i)-bounds.max.y)*.12/size.y;
          const z=riverZ(x)+(position.getZ(i)-center.z)*6.6/size.z;
          position.setXYZ(i,x,y,z);
          interval[i*2]=start;interval[i*2+1]=start+4;
        }
        geometry.setAttribute('riverInterval',new THREE.BufferAttribute(interval,2));
        position.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
        const tile=new THREE.Mesh(geometry,part.material);tile.receiveShadow=true;river.add(tile);
      }
    }
    meshes.forEach(part=>part.geometry.dispose());
    landscape.add(river);
    // The transparent surface reveals a real sand bed below the swimming fish.
    addRiverBed(landscape,terrainHeight,riverZ,rockPieces);water.visible=false;
  }
  const aquatic=createAquaticPlants(landscape,terrainHeight,riverZ);
  return { landscape, terrainHeight, flowerPlacements,
    addCourtyardMeadow(parent,start,end){
      const direction=end.clone().sub(start).normalize(),normal=new THREE.Vector2(-direction.y,direction.x);
      const positions=[],uvs=[],patchUvs=[],indices=[],along=40,across=12;
      for(let i=0;i<=along;i++)for(let j=0;j<=across;j++){
        const t=i/along,v=j/across,offset=-.65+v*5.1;
        const x=THREE.MathUtils.lerp(start.x,end.x,t)+normal.x*offset;
        const z=THREE.MathUtils.lerp(start.y,end.y,t)+normal.y*offset;
        positions.push(x,terrainHeight(x,z)+.12,z);
        uvs.push((x+45)/90+.004*Math.sin(z*.35)+.002*Math.sin(x*.43),
          (45-z)/90+.004*Math.cos(x*.31)+.002*Math.sin(z*.39));
        patchUvs.push(t,v);
        if(i<along&&j<across){const a=i*(across+1)+j,b=a+across+1;indices.push(a,a+1,b,b,a+1,b+1);}
      }
      const geometry=new THREE.BufferGeometry();
      geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
      geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
      geometry.setAttribute('courtyardUv',new THREE.Float32BufferAttribute(patchUvs,2));
      geometry.setIndex(indices);geometry.computeVertexNormals();
      const material=ground.material.clone(),compile=ground.material.onBeforeCompile;
      material.onBeforeCompile=(shader,renderer)=>{
        compile.call(material,shader,renderer);
        shader.vertexShader='attribute vec2 courtyardUv; varying vec2 vCourtyardUv;\n'+shader.vertexShader;
        shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',
          '#include <begin_vertex>\nvCourtyardUv=courtyardUv;');
        shader.fragmentShader='varying vec2 vCourtyardUv;\n'+shader.fragmentShader;
        shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`
          float edge=min(min(vCourtyardUv.x,1.-vCourtyardUv.x),min(vCourtyardUv.y,1.-vCourtyardUv.y));
          if(edge<.025+.01*sin(vCourtyardUv.x*170.)*sin(vCourtyardUv.y*90.))discard;
          #include <color_fragment>
        `).replace('gl_FragColor.a=0.;','gl_FragColor.a=1.;');
      };
      material.customProgramCacheKey=()=> 'courtyard-meadow-foreground-v1';
      const meadow=new THREE.Mesh(geometry,material);meadow.name='Meadow beneath rear trellis';meadow.receiveShadow=true;
      parent.add(meadow);
    },
    replaceTrees(sources){
      addTreeModels(landscape,sources,treePlacements.filter(tree=>tree.z>=2));
      treeTrunks.visible=false;treeCrowns.visible=false;
    }, groundTexture:grain, addRockClusters, addRiverTiles,
    addGrassCover(source){applyGrassSurface(renderer,ground,source);},
    addLilyPads(source){aquatic.addLilyPads(source);liliesFallback.visible=false;},
    addWaterFlowers: aquatic.addFlowers,
    addRiverReeds(source){aquatic.addReeds(source);reedsFallback.visible=false;},
    addFish(source){updateFish=createRiverFish(landscape,source,riverZ);},
    updateRiver(seconds){riverTime.value=seconds;aquatic.update(seconds);updateFish(seconds);} };
}

// Gentle subpixel diffusion on the farm, with stronger blur outside its focus plane.
export function createDepthRenderer(renderer, scene, camera) {
  const target = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: true, samples: 2 });
  target.depthTexture = new THREE.DepthTexture(1, 1);
  target.depthTexture.type = THREE.UnsignedIntType;
  const uniforms = {
    backdropColor:{value:null},backdropReady:{value:0},backdropHeight:{value:.42},backdropScale:{value:new THREE.Vector2(1,1)},
    backdropPixel:{value:new THREE.Vector2()},
    sceneColor: { value: target.texture }, sceneDepth: { value: target.depthTexture },
    worldFromClip: { value: new THREE.Matrix4() },
    pixel: { value: new THREE.Vector2() }, nearPlane: { value: camera.near }, farPlane: { value: camera.far },
    focus: { value: 40 },
  };
  const material = new THREE.ShaderMaterial({ uniforms, depthTest: false, depthWrite: false,
    vertexShader: `varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`,
    fragmentShader: `
      uniform sampler2D sceneColor,sceneDepth,backdropColor;
      uniform mat4 worldFromClip;
      uniform vec2 pixel;
      uniform float nearPlane,farPlane,focus,backdropReady,backdropHeight;
      uniform vec2 backdropScale,backdropPixel;
      varying vec2 vUv;
      vec3 softBackdrop(vec2 uv){
        // Blur only the painted valley, at the same visual strength on all pixel densities.
        vec2 stepUv=backdropPixel*backdropScale*vec2(1.,1./backdropHeight)*2.6;
        vec3 result=vec3(0.);
        for(int x=-2;x<=2;x++)for(int y=-2;y<=2;y++){
          float wx=x==0?6.:(abs(x)==1?4.:1.);
          float wy=y==0?6.:(abs(y)==1?4.:1.);
          result+=texture2D(backdropColor,uv+vec2(float(x),float(y))*stepUv).rgb*wx*wy;
        }
        return result/256.;
      }
      void main(){
        float sampleDepth=texture2D(sceneDepth,vUv).r;
        vec4 sceneSample=texture2D(sceneColor,vUv);
        float depth=nearPlane*farPlane/(farPlane-sampleDepth*(farPlane-nearPlane));
        float nearBlur=(1.-smoothstep(focus-17.,focus-8.,depth))*3.6;
        float farBlur=smoothstep(focus+9.,focus+27.,depth)*2.5;
        float blur=max(nearBlur,farBlur);
        // A small CSS-pixel radius softens fine edges consistently on high-DPI
        // phones. The center sample retains the soil grain and leaf silhouettes.
        vec2 diffusion=max(pixel*blur,backdropPixel*.65);
        vec3 color=sceneSample.rgb*.4;
        for(int i=0;i<8;i++){
          float angle=float(i)*.785398;
          vec2 offset=vec2(cos(angle),sin(angle))*diffusion;
          color+=texture2D(sceneColor,vUv+offset).rgb*.075;
        }
        // The cloudless matte replaces the distant 3D scenery; depth preserves the farm silhouettes.
        float backdropStart=1.-backdropHeight;
        vec2 vistaUv=vec2(vUv.x,clamp((vUv.y-backdropStart)/backdropHeight,0.,1.));
        vistaUv=(vistaUv-.5)*backdropScale+.5;
        // Keep the sky in view when the wide layout crops the painted backdrop.
        vistaUv.y+=.5*(1.-backdropScale.y);
        // Terrain intentionally writes zero matte alpha for the distant valley.
        // Recover its world position so zooming cannot expose the painted lake
        // through the courtyard, paths or riverbed in front of the rear fence.
        vec4 worldPosition=worldFromClip*vec4(vUv*2.-1.,sampleDepth*2.-1.,1.);
        vec2 groundXZ=worldPosition.xz/worldPosition.w;
        float groundCover=smoothstep(-10.25,-10.,groundXZ.y)
          *smoothstep(-11.65,-11.3,dot(groundXZ,vec2(.735,.678)));
        float foreground=sampleDepth>.9999?0.:max(sceneSample.a,groundCover);
        float vistaMask=smoothstep(backdropStart,backdropStart+.05,vUv.y)*(1.-foreground)*backdropReady;
        float vignette=1.-.045*smoothstep(.24,.78,length(vUv-.5));
        gl_FragColor=vec4(color*vignette,1.);
        #include <tonemapping_fragment>
        if(vistaMask>0.)gl_FragColor.rgb=mix(gl_FragColor.rgb,softBackdrop(vistaUv),vistaMask);
        #include <colorspace_fragment>
        // Grade the 3D farm and painted valley together in display space.
        // Keep the soil states distinct while calming the vivid green/cyan tones.
        vec3 gentle=gl_FragColor.rgb;
        float lightness=dot(gentle,vec3(.2126,.7152,.0722));
        float foliage=smoothstep(.04,.18,gentle.g-gentle.b)*smoothstep(-.03,.1,gentle.g-gentle.r);
        gentle=mix(vec3(lightness),gentle,.88-foliage*.09);
        gentle*=vec3(1.018,1.003,.975);
        gentle=gentle*.96+vec3(.017,.015,.012);
        gentle+=vec3(.029,.025,.019)*pow(1.-lightness,2.);
        gl_FragColor.rgb=clamp(gentle,0.,1.);
      }` });
  const quadScene = new THREE.Scene();
  quadScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material));
  const quadCamera = new THREE.Camera();
  let viewportAspect=1,imageAspect=2;
  function fitBackdrop(){
    const ratio=viewportAspect/uniforms.backdropHeight.value/imageAspect;
    uniforms.backdropScale.value.set(Math.min(1,ratio),Math.min(1,1/ratio));
  }
  const ready=new THREE.TextureLoader().loadAsync('assets/backgrounds/clay-valley-clear-sky.webp').then(texture=>{
    texture.colorSpace=THREE.SRGBColorSpace;
    imageAspect=texture.image.width/texture.image.height;
    uniforms.backdropColor.value=texture;uniforms.backdropReady.value=1;fitBackdrop();
  });
  // Handle early rejection until the main loading sequence awaits the same promise.
  ready.catch(()=>{});
  return {
    ready,
    resize(width, height) {
      const ratio = renderer.getPixelRatio();viewportAspect=width/height;uniforms.backdropHeight.value=width>height?.35:.42;fitBackdrop();
      target.setSize(Math.round(width * ratio), Math.round(height * ratio));
      uniforms.pixel.value.set(1 / target.width, 1 / target.height);
      uniforms.backdropPixel.value.set(1 / width, 1 / height);
    },
    render() {
      // Terrain leaves room for the matte; props in front of the courtyard's rear edge
      // keep coverage so their silhouettes remain visible over the foreground meadow.
      scene.getObjectByName('Foreground and distant landscape')?.traverse(object=>{
        if(!object.isMesh)return;
        for(const mat of Array.isArray(object.material)?object.material:[object.material]){
          if(mat.userData.matteCoverage)continue;
          if(mat.transparent){
            mat.blending=THREE.CustomBlending;mat.blendSrc=THREE.SrcAlphaFactor;mat.blendDst=THREE.OneMinusSrcAlphaFactor;
            mat.blendSrcAlpha=THREE.ZeroFactor;mat.blendDstAlpha=THREE.ZeroFactor;mat.userData.matteCoverage=true;
            continue;
          }
          const compile=mat.onBeforeCompile,key=mat.customProgramCacheKey(),terrain=object.userData.matteTerrain;
          mat.onBeforeCompile=(shader,renderer)=>{
            compile.call(mat,shader,renderer);
            if(!terrain){
              shader.vertexShader='varying vec2 vMatteWorldXZ;\n'+shader.vertexShader;
              shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>
                vec4 mattePosition=vec4(transformed,1.);
                #ifdef USE_INSTANCING
                  mattePosition=instanceMatrix*mattePosition;
                #endif
                vMatteWorldXZ=(modelMatrix*mattePosition).xz;
              `);
              shader.fragmentShader='varying vec2 vMatteWorldXZ;\n'+shader.fragmentShader;
            }
            shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',
              '#include <opaque_fragment>\ngl_FragColor.a='+(terrain?'0.':'step(-10.,vMatteWorldXZ.y)*step(-11.3,dot(vMatteWorldXZ,vec2(.735,.678)))')+';');
          };
          mat.customProgramCacheKey=()=>key+'-matte-coverage';
          mat.userData.matteCoverage=true;mat.needsUpdate=true;
        }
      });
      camera.updateMatrixWorld();
      uniforms.worldFromClip.value.multiplyMatrices(camera.matrixWorld,camera.projectionMatrixInverse);
      uniforms.focus.value = -new THREE.Vector3(0, .1, .5).applyMatrix4(camera.matrixWorldInverse).z;
      renderer.setRenderTarget(target);renderer.render(scene, camera);
      renderer.setRenderTarget(null);renderer.render(quadScene, quadCamera);
    },
  };
}
