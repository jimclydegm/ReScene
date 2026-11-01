import {BufferAttribute, type BufferGeometry, Vector3} from "three";

export const normalMethod = "connected-angle-weighted-v2";

/** Interpolate within connected smooth fans, across UV seams. Position hashing
 * uses relative precision; nearby thin parts must never share shading normals.
 * Positions, triangles, UVs and authored hard edges stay unchanged. */
export function completeSurfaceNormals(source:BufferGeometry, recompute=false){
 if((source.hasAttribute("normal")&&!recompute)||!source.hasAttribute("position"))return source;
 const result=source.index?source.toNonIndexed():source.clone(),position=result.getAttribute("position"),count=position.count;
 if(count%3){result.dispose();return source;}
 const min=new Vector3(Infinity,Infinity,Infinity),max=new Vector3(-Infinity,-Infinity,-Infinity),point=new Vector3();
 for(let i=0;i<count;i++){point.fromBufferAttribute(position,i);min.min(point);max.max(point);}
 const precision=Math.max(max.distanceTo(min)*1e-7,1e-12),ids=new Uint32Array(count),unique=new Map<string,number>();
 for(let i=0;i<count;i++){
  const key=[position.getX(i),position.getY(i),position.getZ(i)].map(x=>Math.round(x/precision)).join(",");
  let id=unique.get(key);if(id===undefined){id=unique.size;unique.set(key,id);}ids[i]=id;
 }
 const faceNormals=new Float64Array(count),angles=new Float64Array(count),parent=Uint32Array.from({length:count},(_,i)=>i),edges=new Map<string,number[]>(),a=new Vector3(),b=new Vector3(),c=new Vector3(),ab=new Vector3(),ac=new Vector3(),normal=new Vector3();
 const root=(i:number):number=>{let r=i;while(parent[r]!==r)r=parent[r];while(parent[i]!==i){const next=parent[i];parent[i]=r;i=next;}return r;};
 const join=(i:number,j:number)=>{parent[root(j)]=root(i);};
 for(let i=0;i<count;i+=3){
  a.fromBufferAttribute(position,i);b.fromBufferAttribute(position,i+1);c.fromBufferAttribute(position,i+2);normal.copy(b).sub(a).cross(ac.copy(c).sub(a)).normalize();normal.toArray(faceNormals,i);
  for(let k=0;k<3;k++){
   const index=i+k;point.fromBufferAttribute(position,index);ab.fromBufferAttribute(position,i+(k+1)%3).sub(point);ac.fromBufferAttribute(position,i+(k+2)%3).sub(point);
   angles[index]=Math.atan2(new Vector3().crossVectors(ab,ac).length(),ab.dot(ac));
   const x=ids[index],y=ids[i+(k+1)%3],key=x<y?`${x},${y}`:`${y},${x}`,list=edges.get(key)??[];list.push(index);edges.set(key,list);
  }
 }
 for(const edge of edges.values()){
  // Boundaries/non-manifold junctions keep separate normal fans.
  if(edge.length!==2)continue;const [i,j]=edge,fi=i-i%3,fj=j-j%3;
  const dot=faceNormals[fi]*faceNormals[fj]+faceNormals[fi+1]*faceNormals[fj+1]+faceNormals[fi+2]*faceNormals[fj+2];if(dot<=.5)continue;
  for(const p of [i,fi+(i%3+1)%3])for(const q of [j,fj+(j%3+1)%3])if(ids[p]===ids[q])join(p,q);
 }
 const sums=new Float64Array(count*3),out=new Float32Array(count*3);
 for(let i=0;i<count;i++){const r=root(i)*3,f=i-i%3,w=angles[i];for(let k=0;k<3;k++)sums[r+k]+=faceNormals[f+k]*w;}
 for(let i=0;i<count;i++){const r=root(i)*3;normal.fromArray(sums,r).normalize();if(!normal.lengthSq())normal.fromArray(faceNormals,i-i%3);normal.toArray(out,i*3);}
 result.setAttribute("normal",new BufferAttribute(out,3));result.deleteAttribute("tangent");return result;
}
