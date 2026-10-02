import * as THREE from 'three';

let material;

// Share one texture across plots, while each crop controls its own visibility.
export function createThirstyFace(){
 if(!material){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
  const ctx=canvas.getContext('2d');
  // Keep the cream bubble, with only a centered water drop inside.
  ctx.fillStyle='#fff7dc';ctx.strokeStyle='#d0b987';ctx.lineWidth=3;
  ctx.beginPath();ctx.roundRect(8,6,112,100,30);ctx.fill();ctx.stroke();
  ctx.beginPath();ctx.moveTo(53,104);ctx.lineTo(64,120);ctx.lineTo(75,104);ctx.fill();
  const blue=ctx.createLinearGradient(45,28,82,94);
  blue.addColorStop(0,'#b8f4ff');blue.addColorStop(.45,'#58c9f2');blue.addColorStop(1,'#218ecc');
  ctx.fillStyle=blue;ctx.strokeStyle='#237eae';ctx.lineWidth=3;ctx.lineJoin='round';
  ctx.beginPath();ctx.moveTo(64,20);ctx.bezierCurveTo(56,35,37,54,37,70);
  ctx.bezierCurveTo(37,102,91,102,91,70);ctx.bezierCurveTo(91,54,72,35,64,20);
  ctx.closePath();ctx.fill();ctx.stroke();
  ctx.strokeStyle='#e2fcff';ctx.lineWidth=5;ctx.lineCap='round';
  ctx.beginPath();ctx.moveTo(51,57);ctx.quadraticCurveTo(42,73,51,83);ctx.stroke();
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;
  material=new THREE.SpriteMaterial({map,depthWrite:false,depthTest:false,toneMapped:false});
 }
 const sprite=new THREE.Sprite(material);sprite.name='Crop needs water drop';
 sprite.scale.set(1.35,1.35,1);sprite.renderOrder=11;sprite.raycast=()=>{};
 return sprite;
}
