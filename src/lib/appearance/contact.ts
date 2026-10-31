import {Matrix4,Quaternion,Vector3} from 'three';
import {geometry} from './bake';
import type {ModelPlacement} from '@/lib/scene/composition';

// Accessor boxes are conservative for rotated meshes. Refine the bottom contact
// from actual vertices so even the remaining small bounding-box gap is removed.
export function seatGeometry(bytes:Buffer,object:{position:[number,number,number];placement:ModelPlacement}){
 const p=object.placement,matrix=new Matrix4().compose(new Vector3(...object.position).add(new Vector3(...p.offset)),new Quaternion(...p.rotation),new Vector3(...p.scale));
 let bottom=Infinity;
 for(const triangle of geometry(bytes,matrix,0))for(const point of triangle.points)bottom=Math.min(bottom,point.y);
 if(Number.isFinite(bottom)&&bottom-object.position[1]>=-1e-5&&bottom-object.position[1]<p.size[1]*.2)p.offset[1]-=bottom-object.position[1];
}

// Vertical contact ray against the actual support mesh, not its tallest handle
// or conservative accessor box. Ignore steep side faces; preserve broad surfaces.
export function supportSampler(bytes:Buffer,object:{position:[number,number,number];placement:ModelPlacement}){
 const p=object.placement,matrix=new Matrix4().compose(new Vector3(...object.position).add(new Vector3(...p.offset)),new Quaternion(...p.rotation),new Vector3(...p.scale));
 const triangles=geometry(bytes,matrix,0).filter(({points:[a,b,c]})=>Math.abs(b.clone().sub(a).cross(c.clone().sub(a)).normalize().y)>=.65);
 return (x:number,z:number)=>{
 let height=-Infinity;
 for(const {points:[a,b,c]} of triangles){
  const area=(b.z-c.z)*(a.x-c.x)+(c.x-b.x)*(a.z-c.z);if(Math.abs(area)<1e-10)continue;
  const u=((b.z-c.z)*(x-c.x)+(c.x-b.x)*(z-c.z))/area,v=((c.z-a.z)*(x-c.x)+(a.x-c.x)*(z-c.z))/area,w=1-u-v;
  if(u>=-1e-6&&v>=-1e-6&&w>=-1e-6)height=Math.max(height,u*a.y+v*b.y+w*c.y);
 }
 return Number.isFinite(height)?height:null;
 };
}
export function supportHeight(bytes:Buffer,object:{position:[number,number,number];placement:ModelPlacement},x:number,z:number){return supportSampler(bytes,object)(x,z);}

// Several contact candidates around the actual base, not one center ray or a
// single stray lowest vertex.
export function footprint(points: Vector3[]) {
  let minY = Infinity, maxY = -Infinity; for (const p of points) { minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); }
  const band = points.filter(p => p.y <= minY + Math.max(.004, (maxY - minY) * .015));
  const center = band.reduce((s, p) => s.add(p), new Vector3()).multiplyScalar(1 / Math.max(1, band.length)), picks = new Map<number, Vector3>();
  for (const p of band) { const sector = Math.floor(((Math.atan2(p.z - center.z, p.x - center.x) + Math.PI) / (2 * Math.PI)) * 16) % 16, best = picks.get(sector); if (!best || Math.hypot(p.x - center.x, p.z - center.z) > Math.hypot(best.x - center.x, best.z - center.z)) picks.set(sector, p); }
  return { points: [...picks.values()], band, minY, height: maxY - minY };
}
export function seatHeight(points: Vector3[], height: (x: number, z: number) => number | null) {
  let lift = -Infinity, supported = 0;
  for (const p of points) { const s = height(p.x, p.z); if (s === null) continue; supported++; lift = Math.max(lift, s - p.y); }
  return supported ? lift : null;
}
