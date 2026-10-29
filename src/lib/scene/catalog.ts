import { BoxGeometry, Matrix4, Vector3 } from "three";
import { z } from "zod";
import type { ModelPlacement } from "./composition";
export type DemoBox = { center: [number, number, number]; size: [number, number, number]; color: string };
const box = (center: DemoBox["center"], size: DemoBox["size"], color: string): DemoBox => ({ center, size, color });
const legs = (x: number, z: number, height: number) => [-1,1].flatMap(a => [-1,1].map(b => box([a*x,height/2,b*z],[.07,height,.07],"#62452f")));
export const demoCatalog = [
  { key: "armchair", name: "Sage lounge chair", boxes: [...legs(.34,.31,.35),box([0,.45,0],[.84,.24,.78],"#73896a"),box([0,.92,-.32],[.84,.72,.18],"#73896a"),...[-1,1].map(s => box([s*.44,.65,0],[.16,.32,.84],"#657f60"))] },
  { key: "cabinet", name: "Oak two-door cabinet", boxes: [...legs(.53,.2,.25),box([0,.68,0],[1.24,.86,.5],"#b58959"),...[-1,1].map(s => box([s*.307,.68,.258],[.6,.82,.025],s===1?"#bf9564":"#b38a57")),...[-1,1].map(s => box([s*.045,.72,.29],[.016,.13,.028],"#52442f"))] },
  { key: "table", name: "Walnut side table", boxes: [...legs(.28,.28,.61),box([0,.65,0],[.8,.09,.8],"#8f6242")] }
];
export const boundsSchema = z.object({ min: z.tuple([z.number().finite(),z.number().finite(),z.number().finite()]), max: z.tuple([z.number().finite(),z.number().finite(),z.number().finite()]) }).refine(b => b.max.every((v,i)=>v>b.min[i]));
export function fitCatalog(bounds: z.infer<typeof boundsSchema>, size: number[]): ModelPlacement {
  boundsSchema.parse(bounds);
  if(size.length!==3 || size.some(v=>!Number.isFinite(v)||v<=0||v>=1000)) throw new Error("Invalid target bounds");
  const dimensions=bounds.max.map((v,i)=>v-bounds.min[i]);
  const factor=Math.max(...size)/Math.max(...dimensions);
  return { version:"sam3d-layout-v1", rotation:[0,0,0,1], scale:[factor,factor,factor], offset:[-(bounds.min[0]+bounds.max[0])/2*factor,-bounds.min[1]*factor,-(bounds.min[2]+bounds.max[2])/2*factor], size:dimensions.map(v=>v*factor) as [number,number,number] };
}
// Original procedural geometry, authored for ReScene; no external models/textures.
export function demoGlb(boxes: DemoBox[]) {
  const positions:number[]=[], normals:number[]=[], indices:number[]=[];
  const materials=boxes.map(b=>({pbrMetallicRoughness:{baseColorFactor:[...b.color.slice(1).match(/../g)!.map(c=>parseInt(c,16)/255),1],metallicFactor:0,roughnessFactor:.85}}));
  const primitives=boxes.map((b,material)=>{
    const g=new BoxGeometry(...b.size);g.applyMatrix4(new Matrix4().makeTranslation(...b.center));
    const vertexOffset=positions.length/3, start=indices.length;
    positions.push(...g.getAttribute("position").array);normals.push(...g.getAttribute("normal").array);indices.push(...Array.from(g.index!.array,n=>n+vertexOffset));g.dispose();
    return {start,count:indices.length-start,material};
  });
  const min=[0,1,2].map(k=>Math.min(...positions.filter((_,i)=>i%3===k))), max=[0,1,2].map(k=>Math.max(...positions.filter((_,i)=>i%3===k)));
  const p=Buffer.from(new Float32Array(positions).buffer),n=Buffer.from(new Float32Array(normals).buffer),ix=Buffer.from(new Uint32Array(indices).buffer),bin=Buffer.concat([p,n,ix]);
  const json={asset:{version:"2.0",generator:"ReScene original demo catalog v1"},scene:0,scenes:[{nodes:[0]}],nodes:[{mesh:0}],buffers:[{byteLength:bin.length}],bufferViews:[{buffer:0,byteOffset:0,byteLength:p.length},{buffer:0,byteOffset:p.length,byteLength:n.length},{buffer:0,byteOffset:p.length+n.length,byteLength:ix.length}],accessors:[{bufferView:0,componentType:5126,count:positions.length/3,type:"VEC3",min,max},{bufferView:1,componentType:5126,count:normals.length/3,type:"VEC3"},...primitives.map(p=>({bufferView:2,byteOffset:p.start*4,componentType:5125,count:p.count,type:"SCALAR"}))],materials,meshes:[{primitives:primitives.map((p,i)=>({attributes:{POSITION:0,NORMAL:1},indices:2+i,material:p.material}))}]};
  const raw=Buffer.from(JSON.stringify(json));const j=Buffer.concat([raw,Buffer.alloc((4-raw.length%4)%4,32)]);const out=Buffer.alloc(28+j.length+bin.length);out.write("glTF");out.writeUInt32LE(2,4);out.writeUInt32LE(out.length,8);out.writeUInt32LE(j.length,12);out.writeUInt32LE(0x4e4f534a,16);j.copy(out,20);out.writeUInt32LE(bin.length,20+j.length);out.writeUInt32LE(0x004e4942,24+j.length);bin.copy(out,28+j.length);
  return {bytes:out,bounds:{min,max}};
}
export function demoSvg(boxes:DemoBox[]) {
  const project=(v:Vector3)=>[150+(v.x-v.z)*87,220-v.y*108+(v.x+v.z)*32];
  const faces=boxes.flatMap(b=>{
    const c=b.center,s=b.size;
    const vertices=Array.from({length:8},(_,i)=>new Vector3(c[0]+(i&1?1:-1)*s[0]/2,c[1]+(i&2?1:-1)*s[1]/2,c[2]+(i&4?1:-1)*s[2]/2));
    return [[2,3,7,6],[1,5,7,3],[4,6,7,5]].map(ids=>({depth:ids.reduce((v,i)=>v+vertices[i].x+vertices[i].z,0),svg:`<polygon points="${ids.map(i=>project(vertices[i]).join(',')).join(' ')}" fill="${b.color}" stroke="#ffffff" stroke-opacity=".18"/>`}));
  }).sort((a,b)=>a.depth-b.depth);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><rect width="300" height="300" fill="#eef1e6"/>${faces.map(f=>f.svg).join('')}</svg>`;
}
