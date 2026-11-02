import {Vector3} from 'three';
import {ConvexHull} from 'three/addons/math/ConvexHull.js';
import {readMesh} from './mesh';
/** Exact supporting vertices of approved geometry, including glTF node transforms.
 * Quantization error is below the clearance tolerance; model bytes never change. */
export function makeClearanceHull(bytes:Buffer):[number,number,number][]{
 const vertices=readMesh(bytes).primitives.flatMap(p=>Array.from({length:p.positions.length/3},(_,i)=>new Vector3().fromArray(p.positions,i*3))),hull=new ConvexHull().setFromPoints(vertices),used=new Set<Vector3>();
 for(const face of hull.faces){let edge=face.edge;do{used.add(edge.head().point);edge=edge.next;}while(edge!==face.edge);}
 return [...used].map(v=>v.toArray().map(n=>Math.round(n*1e6)/1e6) as [number,number,number]);
}
