import { FIELD, DOCK, fieldPoint } from './clay-layout.js';
import * as THREE from 'three';

const depthInset=(4-FIELD.rows)*FIELD.pitch/2;
const fitFieldDepth=z=>z-depthInset*Math.max(-1,Math.min(1,(z-.75)/4.25))+FIELD.frontFenceOffset*Math.max(0,Math.min(1,(z-.75)/4.25));
const fieldLane=(x,z)=>fieldPoint(x,fitFieldDepth(z));
const courtyardCorner=fieldLane(-5.35,-4.2);
const dockApproach=[DOCK.x,fieldPoint(0,5.9-depthInset+FIELD.frontFenceOffset)[1]];

// One walk from the windmill, behind and around the right of the field, to the
// dock. Shared centerlines also keep stones and planting out of this route.
const routes = [
  { name:'Windmill approach',width:.8,points:[
    [-7.62,-.12],[-6.2,-.35],fieldLane(-5.18,-.9),fieldLane(-5.45,-2.6),courtyardCorner,
  ] },
  { name:'Field-side path',width:1.05,points:[
    courtyardCorner,
    ...[[-4.5,-4.12],[-1.7,-4.4],[1.1,-4.3],[3.8,-4.12]].map(([x,z])=>fieldPoint(x,z+depthInset)),
    ...[[5.15,-3.45],[5.28,-1],[5.05,1.55],[5.18,3.8],[4.95,5.85]].map(([x,z])=>fieldLane(x,z)),
    fieldPoint(3.9,5.8+FIELD.frontFenceOffset-depthInset),dockApproach,
  ] },
  { name:'Dock approach',width:1.3,points:[dockApproach,[DOCK.x,DOCK.z-DOCK.length/2]] },
];

// Sweep one ribbon through every junction. Separate strips leave an uncovered
// wedge at the inside of a turn, even when their centerline endpoints coincide.
const points=[],widths=[];
routes.forEach((route,index)=>{
  if(index)widths[widths.length-1]=(routes[index-1].width+route.width)*.5;
  for(const [x,z] of route.points.slice(index?1:0)){
    points.push(new THREE.Vector3(x,0,z));widths.push(route.width);
  }
});
const curve=new THREE.CatmullRomCurve3(points);
const pathWidthAt=u=>{
  const point=curve.getUtoTmapping(u)*(widths.length-1),index=Math.min(Math.floor(point),widths.length-2);
  return THREE.MathUtils.lerp(widths[index],widths[index+1],THREE.MathUtils.smoothstep(point-index,0,1));
};
const samples=curve.getSpacedPoints(Math.ceil(curve.getLength()/.2));
samples.forEach((point,index)=>{point.pathWidth=pathWidthAt(index/(samples.length-1));});

export function isFarmPath(x,z,margin=0) {
  return samples.some(p=>Math.hypot(p.x-x,p.z-z)<p.pathWidth*.5+margin);
}

export function createFarmPaths(parent,renderer,terrainHeight) {
  const group = new THREE.Group();group.name='Winding clay footpaths';parent.add(group);
  const dirt = new THREE.Color('#c49c62');
  const material = new THREE.MeshStandardMaterial({color:dirt,roughness:1,metalness:0,
    transparent:true,depthWrite:false,alphaTest:.02,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2,
    // Preserve the path's normal color blend but classify it as terrain in the matte coverage channel.
    blending:THREE.CustomBlending,blendSrc:THREE.SrcAlphaFactor,blendDst:THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha:THREE.ZeroFactor,blendDstAlpha:THREE.ZeroFactor});
  material.onBeforeCompile = shader => {
    shader.uniforms.pathDirt={value:dirt};
    shader.vertexShader='varying vec2 vPathUv;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nvPathUv=uv;');
    shader.fragmentShader='varying vec2 vPathUv;\nuniform vec3 pathDirt;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
      #ifdef USE_MAP
        vec2 dirtUv=vec2(vPathUv.x*.58,.25+vPathUv.y*.5);
        vec3 clay=texture2D(map,dirtUv).rgb;
        // Most of the trail is bare dirt. Suppress the source tile's grey stones
        // and green border in this continuous walking surface.
        float earth=smoothstep(.12,.3,clay.r-clay.b)*smoothstep(.06,.2,clay.g-clay.b);
        float grain=sin(vPathUv.x*49.+sin(vPathUv.y*33.))*sin(vPathUv.y*71.+vPathUv.x*17.);
        vec3 bareDirt=pathDirt*(.96+.055*grain+.04*sin(vPathUv.x*7.));
        diffuseColor.rgb=mix(bareDirt,clay,earth*.38);
      #endif
      float edge=abs(vPathUv.y*2.-1.);
      float fringe=.035*sin(vPathUv.x*21.)+.024*sin(vPathUv.x*47.+vPathUv.y*13.);
      diffuseColor.a*=1.-smoothstep(.76+fringe,1.,edge);
    `);
  };
  material.customProgramCacheKey=()=> 'clay-dirt-path-v1';
  {
    const length=curve.getLength(),steps=Math.ceil(length/.13),acrossSteps=8;
    const positions=[],uvs=[],indices=[];
    for(let i=0;i<=steps;i++){
      const t=i/steps,p=curve.getPointAt(t),direction=curve.getTangentAt(t),distance=t*length;
      const half=pathWidthAt(t)*.5*(1+.065*Math.sin(distance*2.1)+.035*Math.sin(distance*5.3));
      for(let j=0;j<=acrossSteps;j++){
        const v=j/acrossSteps,side=(v*2-1)*half;
        const x=p.x-direction.z*side,z=p.z+direction.x*side;
        positions.push(x,terrainHeight(x,z)+.028+.018*(1-Math.pow(v*2-1,2)),z);
        uvs.push(distance,v);
        if(i<steps&&j<acrossSteps){
          const a=i*(acrossSteps+1)+j,b=a+acrossSteps+1;
          indices.push(a,a+1,b,b,a+1,b+1);
        }
      }
    }
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);geometry.computeVertexNormals();
    const path=new THREE.Mesh(geometry,material);path.name='Continuous windmill-to-dock path';path.receiveShadow=true;group.add(path);
  }

  function applyPathModel(source){
    // Bake the artist's clay surface once; curved paths then use a light mesh
    // instead of repeating the nearly million-triangle tile along every lane.
    source.updateMatrixWorld(true);
    const bounds=new THREE.Box3().setFromObject(source),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
    const target=new THREE.WebGLRenderTarget(1024,1024,{depthBuffer:true,samples:2});
    target.texture.wrapS=target.texture.wrapT=THREE.MirroredRepeatWrapping;
    target.texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
    const bakeScene=new THREE.Scene(),bakeModel=source.clone(true),bakeMaterials=[];
    bakeScene.background=dirt;
    bakeModel.traverse(m=>{if(m.isMesh){
      const unlit=original=>{const mat=new THREE.MeshBasicMaterial({map:original.map,color:original.color,side:THREE.DoubleSide,toneMapped:false});bakeMaterials.push(mat);return mat;};
      m.material=Array.isArray(m.material)?m.material.map(unlit):unlit(m.material);m.castShadow=false;m.receiveShadow=false;
    }});
    bakeScene.add(bakeModel);
    const camera=new THREE.OrthographicCamera(-size.x*.45,size.x*.45,size.z*.45,-size.z*.45,.1,10);
    camera.position.set(center.x,bounds.max.y+3,center.z);camera.up.set(0,0,-1);camera.lookAt(center);
    const previous=renderer.getRenderTarget();
    try{renderer.setRenderTarget(target);renderer.render(bakeScene,camera);}
    finally{renderer.setRenderTarget(previous);bakeMaterials.forEach(m=>m.dispose());}
    material.map=target.texture;material.color.set('#ffffff');material.needsUpdate=true;
    // Only the baked surface is retained after loading.
    const disposed=new Set();
    source.traverse(m=>{if(m.isMesh){
      m.geometry.dispose();
      for(const mat of Array.isArray(m.material)?m.material:[m.material]){
        for(const value of Object.values(mat))if(value?.isTexture&&!disposed.has(value)){value.dispose();disposed.add(value);}
        mat.dispose();
      }
    }});
  }
  return {applyPathModel};
}
