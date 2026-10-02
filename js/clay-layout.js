// Portrait composition: field corners, building footprints and waterside landing.
// With this camera, Z runs down-left (3 tiles), X runs down-right (4 tiles).
// Enlarge toward the foreground while keeping the rear corner by the courtyard.
export const FIELD={x:1.15,z:1.15,offsetX:.65,offset:.37,columns:4,rows:3,pitch:2.05,frontFenceOffset:.4};
export const fieldPoint=(x,z)=>[x*FIELD.x+FIELD.offsetX,z*FIELD.z+FIELD.offset];
export const RIVER_BASE=11.1;
export const riverCenter=x=>RIVER_BASE+1.9*Math.sin(x*.18);
export const DOCK={x:4,z:riverCenter(4)-1.05,length:3};
// Shared framing for the initial view and the home/reset control.
export const FARM_VIEW={position:[16.37,26.35,18.68],target:[-1.92,0,-1.16],fov:45};
