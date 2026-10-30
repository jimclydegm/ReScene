import {BufferGeometry,Float32BufferAttribute,Plane,Ray,Vector3} from "three";
import {backgroundCamera,type BackgroundPlan} from "./background";
import type {SceneComposition} from "./composition";
export type BackgroundWall={position:[number,number,number];yaw:number;width:number;height:number};
export function materialSurfaceGeometry(composition:SceneComposition,floorY:number){
 const camera=backgroundCamera(composition.camera),target=new Vector3(...composition.camera.target),forward=target.clone().sub(camera.position);forward.y=0;forward.normalize();if(forward.length()<.5)forward.set(0,0,-1);
 const distance=camera.position.distanceTo(target),extent=Math.max(160,distance*20),height=extent,walls:BackgroundWall[]=[];
 const points=composition.background?.junctions;
 if(points){
  const plane=new Plane(new Vector3(0,1,0),-floorY),world=points.map(p=>new Ray(camera.position,new Vector3(p.x*2-1,1-p.y*2,.5).unproject(camera).sub(camera.position).normalize()).intersectPlane(plane,new Vector3()));
  const targetDepth=target.clone().sub(camera.position).dot(forward);
  if(world.every((p):p is Vector3=>!!p&&p.distanceTo(camera.position)<extent*.4&&p.clone().sub(camera.position).dot(forward)>targetDepth*.8)){
   for(let i=0;i<world.length-1;i++){
    const a=world[i]!.clone(),b=world[i+1]!.clone(),tangent=b.clone().sub(a).normalize();
    if(i===0)a.addScaledVector(tangent,-extent);if(i===world.length-2)b.addScaledVector(tangent,extent);
    const center=a.clone().add(b).multiplyScalar(.5),delta=b.clone().sub(a);
    walls.push({position:[center.x,floorY+height/2,center.z],yaw:Math.atan2(-delta.z,delta.x),width:delta.length(),height});
   }
  }
 }
 // A studio sweep has no wall seam to recover. Place its smooth bend behind the
 // observed subjects, retaining an unbounded foreground and no lateral corners.
 const rear=target.clone().addScaledVector(forward,Math.max(3,composition.room.depth*.5));rear.y=floorY;
 return {extent,walls,curve:composition.background?.transition==="curve"||!!points&&!walls.length,rear:rear.toArray() as [number,number,number],yaw:Math.atan2(-forward.x,-forward.z),radius:Math.max(1.5,Math.min(4,composition.room.height*.5))};
}
export function sweepGeometry(width:number,radius:number,height:number){
 const vertices:number[]=[],uv:number[]=[],indices:number[]=[],rows=33;
 for(let i=0;i<=rows;i++){
  const theta=Math.min(i,32)/32*Math.PI/2,y=i===rows?radius+height:radius*(1-Math.cos(theta)),z=-radius*Math.sin(theta);
  for(const side of [-1,1]){vertices.push(side*width/2,y,z);uv.push((side+1)/2,i===rows?radius*Math.PI/2+height:theta*radius);}
 }
 for(let i=0;i<rows;i++){const a=i*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}
 const g=new BufferGeometry();g.setAttribute("position",new Float32BufferAttribute(vertices,3));g.setAttribute("uv",new Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g;
}
export function materialSettings(plan:BackgroundPlan,part:"ground"|"wall",fallback:string){return plan.materials?.[part]??{color:fallback,roughness:.9,tileSize:1};}
