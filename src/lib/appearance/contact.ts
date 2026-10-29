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
