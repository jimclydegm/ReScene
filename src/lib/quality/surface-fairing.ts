import {Vector3} from "three";
import {readMesh,weld,writeGlb} from "./mesh";
import type {Evidence,StructuralConstraint} from "./geometry";

/** Small shrinkage-resistant fairing only where the photo explicitly supports a
 * smooth manufactured surface. Fixed topology/UVs; hard/open/nonmanifold edges,
 * thin parts and extrema stay pinned. This is not general shrink-wrap smoothing. */
export function fairSmoothSurfaces(bytes:Buffer,evidence:Evidence|undefined,constraints:StructuralConstraint[]){
 const regions=constraints.filter(c=>c.kind==="smooth"&&c.confidence>=.75);
 if(!evidence||!regions.length)return {bytes,vertices:0,improved:false};
 const doc=readMesh(bytes),topology=weld(doc),points=new Map<number,Vector3>(),neighbors=new Map<number,Set<number>>(),edges=new Map<string,{a:number;b:number;faces:Vector3[]}>();
 doc.primitives.forEach((p,k)=>{const w=topology.welded[k];for(let i=0;i<p.indices.length;i++){const id=w[i];if(!points.has(id))points.set(id,new Vector3().fromArray(p.positions,p.indices[i]*3));}for(let i=0;i<w.length;i+=3){const normal=new Vector3(...Array.from(topology.normals[k].slice(i,i+3)));for(let j=0;j<3;j++){const a=w[i+j],b=w[i+(j+1)%3];if(a===b)continue;const key=a<b?`${a},${b}`:`${b},${a}`,edge=edges.get(key)??{a,b,faces:[]};edge.faces.push(normal);edges.set(key,edge);if(!neighbors.has(a))neighbors.set(a,new Set());if(!neighbors.has(b))neighbors.set(b,new Set());neighbors.get(a)!.add(b);neighbors.get(b)!.add(a);}}});
 const locked=new Set<number>();for(const e of edges.values())if(e.faces.length!==2||e.faces[0].dot(e.faces[1])<Math.cos(Math.PI/5)){locked.add(e.a);locked.add(e.b);}
 const min=new Vector3(Infinity,Infinity,Infinity),max=new Vector3(-Infinity,-Infinity,-Infinity);for(const p of points.values()){min.min(p);max.max(p);}
 const within=(p:Vector3,c:StructuralConstraint)=>{const q=p.clone().applyMatrix4(evidence.matrix).project(evidence.camera),x=(q.x+1)/2,y=(1-q.y)/2;return x>c.box[0]+.003&&x<c.box[2]-.003&&y>c.box[1]+.003&&y<c.box[3]-.003;};
 const protectedRegions=constraints.filter(c=>["thin-part","opening"].includes(c.kind)&&c.confidence>=.5);
 const active=new Set<number>();for(const[id,p]of points){if(locked.has(id)||(neighbors.get(id)?.size??0)<3||protectedRegions.some(c=>within(p,c)))continue;if(["x","y","z"].some(k=>Math.abs(p[k as "x"]-min[k as "x"])<topology.diagonal*1e-5||Math.abs(p[k as "x"]-max[k as "x"])<topology.diagonal*1e-5))continue;if(regions.some(c=>within(p,c)))active.add(id);}
 // Pin the border of each cited region; unknown adjoining parts stay fixed.
 for(const id of [...active])if([...neighbors.get(id)!].some(n=>!active.has(n)))locked.add(id);
 for(const id of locked)active.delete(id);
 if(active.size<12)return {bytes,vertices:0,improved:false};
 const energy=(values:Map<number,Vector3>)=>{let sum=0;for(const id of active){const mean=new Vector3(),adj=neighbors.get(id)!;for(const n of adj)mean.add(values.get(n)!);mean.multiplyScalar(1/adj.size);sum+=mean.distanceToSquared(values.get(id)!);}return sum/active.size;};
 const before=energy(points),original=new Map([...points].map(([id,p])=>[id,p.clone()]));
 for(let pass=0;pass<8;pass++){
  const next=new Map<number,Vector3>(),weight=pass%2===0?.38:-.4;
  for(const id of active){const p=points.get(id)!,adj=neighbors.get(id)!,mean=new Vector3();for(const n of adj)mean.add(points.get(n)!);mean.multiplyScalar(1/adj.size).sub(p).multiplyScalar(weight);const candidate=p.clone().add(mean),delta=candidate.clone().sub(original.get(id)!);if(delta.length()>topology.diagonal*.004)candidate.copy(original.get(id)!).add(delta.setLength(topology.diagonal*.004));next.set(id,candidate);}
  for(const[id,p]of next)points.set(id,p);
 }
 const after=energy(points);if(!(after<before*.97))return {bytes,vertices:0,improved:false};
 const primitives=new Map<string,{local:Float32Array}>();doc.primitives.forEach((p,k)=>{const local=new Float32Array(p.local),inverse=p.matrix.clone().invert(),w=topology.welded[k];for(let i=0;i<p.indices.length;i++)if(active.has(w[i]))points.get(w[i])!.clone().applyMatrix4(inverse).toArray(local,p.indices[i]*3);primitives.set(p.key,{local});});
 return {bytes:writeGlb(doc,{primitives}),vertices:active.size,improved:true,before,after};
}
