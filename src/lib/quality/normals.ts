import {BufferAttribute,BufferGeometry} from "three";
import {decodeGlb,packGlb,readAccessor} from "./mesh";
import {completeSurfaceNormals} from "@/lib/scene/smooth-normals";
const types:Record<number,Float32ArrayConstructor|Uint32ArrayConstructor|Uint16ArrayConstructor|Uint8ArrayConstructor|Int16ArrayConstructor|Int8ArrayConstructor>={5126:Float32Array,5125:Uint32Array,5123:Uint16Array,5121:Uint8Array,5122:Int16Array,5120:Int8Array};
/** Add crease-aware normals without changing a triangle, UV, material or node.
 * Expansion duplicates attributes at hard edges; it never subdivides geometry. */
export function completeGlbNormals(bytes:Buffer){
 const doc=decodeGlb(bytes),g=structuredClone(doc.json),views=[...doc.views];let changed=0;
 for(const mesh of g.meshes)for(const prim of mesh.primitives){
  if(prim.attributes.NORMAL!==undefined||prim.mode!==undefined&&prim.mode!==4||prim.targets||prim.extensions?.KHR_draco_mesh_compression||prim.extensions?.EXT_meshopt_compression)continue;
  const geometry=new BufferGeometry();
  for(const [name,index]of Object.entries(prim.attributes)){
   const a=doc.json.accessors[index as number],shape=readAccessor(doc,index as number),Type=types[a.componentType];if(!Type)throw new Error("NORMAL_ATTRIBUTE_FORMAT");
   const array=new Type(shape.values.length),view=doc.json.bufferViews[a.bufferView],src=doc.views[a.bufferView],width=shape.width*Type.BYTES_PER_ELEMENT,stride=view.byteStride??width,dst=new Uint8Array(array.buffer);
   for(let i=0;i<a.count;i++)dst.set(src.subarray((a.byteOffset??0)+i*stride,(a.byteOffset??0)+i*stride+width),i*width);
   geometry.setAttribute(name==="POSITION"?"position":name,new BufferAttribute(array,shape.width,a.normalized??false));
  }
  if(prim.indices!==undefined)geometry.setIndex(new BufferAttribute(Uint32Array.from(readAccessor(doc,prim.indices).values),1));
  const normals=completeSurfaceNormals(geometry);if(normals===geometry){geometry.dispose();continue;}
  const attributes:Record<string,number>={};
  for(const [name,attribute]of Object.entries(normals.attributes)){
   const array=attribute.array,componentType=Object.entries(types).find(([,Type])=>array instanceof Type)?.[0];if(!componentType)throw new Error("NORMAL_ATTRIBUTE_TYPE");
   const buffer=Buffer.from(array.buffer,array.byteOffset,array.byteLength);g.bufferViews.push({buffer:0,byteOffset:0,byteLength:buffer.length,target:34962});views.push(buffer);
   if(name==="TANGENT")continue;
   const original=name==="normal"?{}:structuredClone(doc.json.accessors[prim.attributes[name==="position"?"POSITION":name]]??{});delete original.bufferView;delete original.byteOffset;delete original.sparse;
   g.accessors.push({...original,bufferView:views.length-1,componentType:Number(componentType),count:attribute.count,type:["","SCALAR","VEC2","VEC3","VEC4"][attribute.itemSize],...(attribute.normalized?{normalized:true}:{})});attributes[name]=g.accessors.length-1;
  }
  // BufferGeometry uses lower-case standard names only in browser loaders;
  // this codec preserves glTF names and supplies the generated normal.
  if(attributes.normal!==undefined){attributes.NORMAL=attributes.normal;delete attributes.normal;}
  attributes.POSITION=attributes.position;delete attributes.position;
  prim.attributes=attributes;delete prim.indices;geometry.dispose();normals.dispose();changed++;
 }
 return {bytes:changed?packGlb(g,views):bytes,primitives:changed};
}
