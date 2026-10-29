import { Matrix4, Quaternion, Vector3 } from "three";
import { readGlb, geometry, photoCamera, type PixelImage } from "@/lib/appearance/bake";
import { composeRoom, glbBounds, type Environment } from "./composition";

// Partition one reconstruction rather than independently inventing overlapping bodies
// and garments. Every source triangle has exactly one owner; UVs/materials are retained.
export function splitAssembly(bytes:Buffer,metadata:unknown,image:{width:number;height:number},bounds:unknown,
  environment:Environment,parts:{id:string;mask:PixelImage}[]){
  if(!parts.length||parts.length>9||parts.some(p=>p.mask.width!==image.width||p.mask.height!==image.height))throw new Error("ASSEMBLY_MASK_FRAME");
  const layout=composeRoom([{id:"subject",metadata,bounds:glbBounds(bytes),imageBounds:bounds,support:"floor"}],image,environment,"spark");
  const o=layout.objects[0],root=new Matrix4().makeTranslation(...o.position).multiply(new Matrix4().makeTranslation(...o.placement.offset)).multiply(new Matrix4().compose(new Vector3(),new Quaternion(...o.placement.rotation),new Vector3(...o.placement.scale)));
  const camera=photoCamera(layout.composition.camera),triangles=geometry(bytes,root,0);
  const areas=parts.map(p=>p.mask.data.reduce((sum,v)=>sum+Number(v>127),0));
  const document=readGlb(bytes).json;
  if(document.meshes.length!==1||document.nodes.filter((n:{mesh?:number})=>n.mesh!==undefined).length!==1)throw new Error("ASSEMBLY_HIERARCHY_UNSUPPORTED");
  const owners=triangles.map(t=>{
    const p=t.points[0].clone().add(t.points[1]).add(t.points[2]).multiplyScalar(1/3).project(camera);
    const x=Math.floor((p.x+1)*image.width/2),y=Math.floor((1-p.y)*image.height/2);
    if(x<0||y<0||x>=image.width||y>=image.height)return -1;
    // Narrower masks win overlaps. Disjoint ownership avoids doubled surfaces.
    let selected=-1,area=Infinity;
    for(let i=0;i<parts.length;i++)if(parts[i].mask.data[y*image.width+x]>127){
      const a=areas[i];if(a<area){selected=i;area=a;}
    }
    return selected;
  });
  function subset(index:number){
    const {json:g,binary}=readGlb(bytes),chunks:Buffer[]=[binary];let length=binary.length,ordinal=0,total=0;
    const counts:Record<number,number>={5121:1,5123:2,5125:4};
    for(const mesh of g.meshes){
      const kept=[];
      for(const primitive of mesh.primitives){
        const accessor=primitive.indices===undefined?null:g.accessors[primitive.indices];
        const count=accessor?.count ?? g.accessors[primitive.attributes.POSITION].count;
        const indices:number[]=[];
        const view=accessor?g.bufferViews[accessor.bufferView]:null;
        const size=accessor?counts[accessor.componentType]:0;
        if(accessor&&(!size||view.byteStride&&view.byteStride!==size))throw new Error("ASSEMBLY_INDEX_FORMAT");
        const offset=(view?.byteOffset??0)+(accessor?.byteOffset??0);
        for(let i=0;i<count;i+=3){
          const selected=owners[ordinal++];
          if(selected!==index)continue;
          for(let k=0;k<3;k++){const at=offset+(i+k)*size;indices.push(!accessor?i+k:size===4?binary.readUInt32LE(at):size===2?binary.readUInt16LE(at):binary[at]);}
        }
        if(!indices.length)continue;
        const pad=Buffer.alloc((4-length%4)%4);chunks.push(pad);length+=pad.length;
        const data=Buffer.alloc(indices.length*4);indices.forEach((v,i)=>data.writeUInt32LE(v,i*4));
        const bufferView=g.bufferViews.length;g.bufferViews.push({buffer:0,byteOffset:length,byteLength:data.length,target:34963});chunks.push(data);length+=data.length;
        primitive.indices=g.accessors.length;g.accessors.push({bufferView,componentType:5125,count:indices.length,type:"SCALAR"});kept.push(primitive);total+=indices.length/3;
      }
      mesh.primitives=kept;
    }
    if(total<12)throw new Error("ASSEMBLY_REGION_TOO_SMALL");
    // Empty meshes are unreferenced; omit their node mesh property.
    for(const node of g.nodes)if(node.mesh!==undefined&&!g.meshes[node.mesh].primitives.length)delete node.mesh;
    g.buffers[0].byteLength=length;
    const json=Buffer.from(JSON.stringify(g)),jp=Buffer.alloc((4-json.length%4)%4,32),bp=Buffer.alloc((4-length%4)%4);
    const header=Buffer.alloc(20);header.write("glTF");header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+jp.length+length+bp.length,8);header.writeUInt32LE(json.length+jp.length,12);header.writeUInt32LE(0x4e4f534a,16);
    const bh=Buffer.alloc(8);bh.writeUInt32LE(length+bp.length);bh.writeUInt32LE(0x004e4942,4);
    return {bytes:Buffer.concat([header,json,jp,bh,...chunks,bp]),triangles:total};
  }
  return {body:subset(-1),parts:parts.map((p,i)=>({id:p.id,...subset(i)})),sourceTriangles:triangles.length};
}
