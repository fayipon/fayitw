import * as THREE from 'three';

// Each crop owns a small progress texture for its current growth stage.
export function createCropProgress(){
 const canvas=document.createElement('canvas');canvas.width=256;canvas.height=64;
 const ctx=canvas.getContext('2d');
 const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;
 const material=new THREE.SpriteMaterial({map,depthWrite:false,depthTest:false,toneMapped:false,fog:false});
 const sprite=new THREE.Sprite(material);sprite.name='Crop stage progress';
 sprite.scale.set(2.1,.525,1);sprite.renderOrder=11;sprite.raycast=()=>{};
 let previous=-1;
 return {
  sprite,
  set(remainingMs,durationMs){
   const progress=durationMs>0?THREE.MathUtils.clamp(1-remainingMs/durationMs,0,1):1;
   const width=Math.round(progress*222);
   if(previous===width)return false;
   previous=width;ctx.clearRect(0,0,256,64);
   ctx.fillStyle='#fff8de';ctx.strokeStyle='#27382d';ctx.lineWidth=4;
   ctx.shadowColor='#162a2499';ctx.shadowBlur=4;ctx.shadowOffsetY=3;
   ctx.beginPath();ctx.roundRect(10,13,236,38,19);ctx.fill();ctx.stroke();
   ctx.shadowColor='transparent';ctx.shadowBlur=0;ctx.shadowOffsetY=0;
   const track=ctx.createLinearGradient(0,20,0,44);
   track.addColorStop(0,'#243a30');track.addColorStop(1,'#39533f');
   ctx.fillStyle=track;ctx.beginPath();ctx.roundRect(17,20,222,24,12);ctx.fill();
   if(width>0){
    ctx.save();ctx.clip();
    const fill=ctx.createLinearGradient(0,20,0,44);
    fill.addColorStop(0,'#b9f86e');fill.addColorStop(.4,'#61d534');fill.addColorStop(1,'#36991f');
    ctx.fillStyle=fill;ctx.fillRect(17,20,width,24);
    // A light leading edge keeps the filled portion distinct at small sizes.
    if(width>5&&width<222){ctx.fillStyle='#e7ffc8';ctx.fillRect(17+width-2,22,2,20);}
    ctx.restore();
   }
   map.needsUpdate=true;
   return true;
  },
  dispose(){map.dispose();material.dispose();},
 };
}
