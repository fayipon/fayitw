// Keep the complete field inside the space between the header and action dock.
// Points are world-space corners including the tallest crops and their badges.
export function fitFarmView(camera,points,width,height,safe,initialLift=0){
 const availableWidth=Math.max(1,safe.right-safe.left),availableHeight=Math.max(1,safe.bottom-safe.top);
 const bounds=()=>{
  const projected=points.map(point=>point.clone().project(camera));
  return {
   left:Math.min(...projected.map(point=>(point.x+1)*width/2)),
   right:Math.max(...projected.map(point=>(point.x+1)*width/2)),
   top:Math.min(...projected.map(point=>(1-point.y)*height/2)),
   bottom:Math.max(...projected.map(point=>(1-point.y)*height/2)),
  };
 };
 camera.setViewOffset(width,height,0,initialLift,width,height);
 camera.updateMatrixWorld();
 let field=bounds();
 const scale=Math.min(1,availableWidth/(field.right-field.left),availableHeight/(field.bottom-field.top));
 if(scale<1){camera.zoom*=scale;camera.updateProjectionMatrix();field=bounds();}
 const shiftX=field.left<safe.left?field.left-safe.left:Math.max(0,field.right-safe.right);
 const shiftY=field.top<safe.top?field.top-safe.top:Math.max(0,field.bottom-safe.bottom);
 camera.setViewOffset(width,height,shiftX,initialLift+shiftY,width,height);
}
