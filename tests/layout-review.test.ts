import {describe,it,expect} from "vitest";
import {BoxGeometry,Matrix4,Quaternion,Vector3} from "three";
import {geometry,photoCamera,visibility} from "../src/lib/appearance/bake";
import {containedParts,reviewLayout} from "../src/lib/scene/layout-review";
import {settleSupportContacts,type SceneComposition,type ModelPlacement} from "../src/lib/scene/composition";
function mesh(){
 const box=new BoxGeometry(.4,1.8,.3),positions=new Float32Array(box.attributes.position.array),uv=new Float32Array(box.attributes.uv.array),indices=new Uint32Array(box.index!.array),p=Buffer.from(positions.buffer),t=Buffer.from(uv.buffer),i=Buffer.from(indices.buffer),binary=Buffer.concat([p,t,i]);box.dispose();
 const g={asset:{version:"2.0"},scene:0,scenes:[{nodes:[0]}],nodes:[{mesh:0}],meshes:[{primitives:[{attributes:{POSITION:0,TEXCOORD_0:1},indices:2,material:0}]}],buffers:[{byteLength:binary.length}],bufferViews:[{buffer:0,byteOffset:0,byteLength:p.length},{buffer:0,byteOffset:p.length,byteLength:t.length},{buffer:0,byteOffset:p.length+t.length,byteLength:i.length}],accessors:[{bufferView:0,componentType:5126,count:positions.length/3,type:"VEC3"},{bufferView:1,componentType:5126,count:uv.length/2,type:"VEC2"},{bufferView:2,componentType:5125,count:indices.length,type:"SCALAR"}],materials:[{pbrMetallicRoughness:{baseColorTexture:{index:0}}}],textures:[{source:0}]};
 const raw=Buffer.from(JSON.stringify(g)),pad=Buffer.alloc((4-raw.length%4)%4,32),header=Buffer.alloc(20),bh=Buffer.alloc(8);header.write("glTF");header.writeUInt32LE(2,4);header.writeUInt32LE(28+raw.length+pad.length+binary.length,8);header.writeUInt32LE(raw.length+pad.length,12);header.writeUInt32LE(0x4e4f534a,16);bh.writeUInt32LE(binary.length);bh.writeUInt32LE(0x004e4942,4);return Buffer.concat([header,raw,pad,bh,binary]);
}
const stage=():SceneComposition=>({version:"sam3d-room-v1",floorY:0,camera:{position:[0,2,8],target:[0,1,0],fov:45,aspect:1},room:{centerX:0,centerZ:0,width:8,depth:8,height:4},environment:{floorColor:"#dddddd",wallColor:"#eeeeee",floorMaterial:"plain",lightDirection:"diffuse",lightWarmth:"neutral",sideWall:"none"},environmentSource:"spark",warnings:[],projectionError:0});
const placement=():ModelPlacement=>({version:"sam3d-layout-v1",offset:[0,.9,0],scale:[1,1,1],rotation:[0,0,0,1],size:[.4,1.8,.3]});
const frame={width:128,height:128},bytes=mesh();
function mask(angle=0){const q=new Quaternion().setFromAxisAngle(new Vector3(0,0,1),angle),matrix=new Matrix4().makeTranslation(0,.9,0).multiply(new Matrix4().makeRotationFromQuaternion(q)),raster=visibility(geometry(bytes,matrix,0),photoCamera(stage().camera),128,128);return new Uint8Array(Array.from(raster.owners,v=>v>=0?255:0));}
describe("Reference-based layout review",()=>{
 it("corrects displaced geometry only when actual source-mask overlap improves",()=>{
  const object={id:"item",position:[1.3,0,0] as [number,number,number],placement:placement()},reference=mask(),saved=new Uint8Array(reference);
  const report=reviewLayout([object],[{id:"item",label:"Any subject",bytes,mask:reference,support:"floor"}],stage(),frame);
  expect(report.objects[0].after).toBeGreaterThan(report.objects[0].before+.25);expect(Math.abs(object.position[0])).toBeLessThan(.2);expect(object.position[1]).toBe(0);expect(reference).toEqual(saved);
 });
 it("tests a gravity-aligned candidate for a slender vertical reference without category rules",()=>{
  const object={id:"item",position:[0,0,0] as [number,number,number],placement:placement()};object.placement.rotation=new Quaternion().setFromAxisAngle(new Vector3(0,0,1),.2).toArray();
  const report=reviewLayout([object],[{id:"item",label:"Slender object",bytes,mask:mask(),support:"floor"}],stage(),frame);
  expect(report.objects[0].orientationAdjusted).toBe(true);expect(report.objects[0].after).toBeGreaterThan(report.objects[0].before);
 });
 it("does not forcibly straighten a visibly diagonal reference",()=>{
  const object={id:"item",position:[0,0,0] as [number,number,number],placement:placement()};object.placement.rotation=new Quaternion().setFromAxisAngle(new Vector3(0,0,1),.45).toArray();
  const report=reviewLayout([object],[{id:"item",label:"Diagonal subject",bytes,mask:mask(.45),support:"unknown"}],stage(),frame);
  expect(report.objects[0].orientationAdjusted).toBe(false);
 });
 it("rejects empty/mismatched masks before optimization",()=>{
  const object={id:"item",position:[0,0,0] as [number,number,number],placement:placement()},input={id:"item",label:"Subject",bytes,support:"floor"};
  expect(()=>reviewLayout([object],[{...input,mask:new Uint8Array(1)}],stage(),frame)).toThrow("REVIEW_FRAME");expect(()=>reviewLayout([object],[{...input,mask:new Uint8Array(128*128)}],stage(),frame)).toThrow("REVIEW_MASK_EMPTY");
 });
 it("leaves unknown support at its image-estimated height instead of stacking at a headboard/handle maximum",()=>{
  const objects=[{id:"base",position:[0,0,0] as [number,number,number],placement:placement()},{id:"part",position:[0,.4,0] as [number,number,number],placement:placement()}],base={metadata:{},bounds:{min:[0,0,0] as [number,number,number],max:[1,2,1] as [number,number,number]},imageBounds:{xMin:0,yMin:0,xMax:20,yMax:20}};
  settleSupportContacts(objects,[{...base,id:"base",support:"floor"},{...base,id:"part",support:"unknown",supportedById:"base"}],stage());expect(objects[1].position[1]).toBe(.4);
 });
});
describe("Avoid overlapping independent reconstructions",()=>{
 it("derives a contained supported region from the complete parent rather than duplicating geometry",()=>{
  const parent=new Uint8Array(100).fill(255),child=new Uint8Array(100);child.fill(255,20,80);
  expect(containedParts([{id:"root",mask:parent},{id:"part",mask:child,supportedById:"root"}]).get("part")).toBe("root");
  expect(containedParts([{id:"root",mask:parent},{id:"unrelated",mask:child}]).size).toBe(0);
 });
 it("keeps disjoint support objects independent and avoids nested assembly inference",()=>{
  const parent=new Uint8Array(100),child=new Uint8Array(100);parent.fill(255,0,50);child.fill(255,50);
  expect(containedParts([{id:"root",mask:parent},{id:"part",mask:child,supportedById:"root"}]).size).toBe(0);
  expect(containedParts([{id:"root",mask:new Uint8Array(100).fill(255),parentId:"other"},{id:"part",mask:child,supportedById:"root"}]).size).toBe(0);
 });
});
