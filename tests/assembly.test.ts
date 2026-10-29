import {describe,it,expect} from 'vitest';
import {BoxGeometry} from 'three';
import {splitAssembly} from '../src/lib/scene/assembly';
import {inspectGlb} from '../src/lib/ai/glb';
import {validateAnalysis} from '../src/lib/ai/contracts';
import {analysisUserPrompt,defaultAnalysisOptions} from '../src/lib/ai/controls';
const environment={floorColor:'#dddddd',wallColor:'#eeeeee',floorMaterial:'plain' as const,lightDirection:'diffuse' as const,lightWarmth:'neutral' as const,sideWall:'none' as const};
function fixture(){
 const positions:number[]=[],uv:number[]=[],indices:number[]=[];
 for(const y of [-1,0,1]){const g=new BoxGeometry(.6,.9,.4);const base=positions.length/3;
  const p=g.attributes.position,t=g.attributes.uv;for(let i=0;i<p.count;i++){positions.push(p.getX(i),p.getY(i)+y,p.getZ(i));uv.push(t.getX(i),t.getY(i));}for(const i of g.index!.array)indices.push(i+base);g.dispose();}
 const pos=Buffer.from(new Float32Array(positions).buffer),tex=Buffer.from(new Float32Array(uv).buffer),idx=Buffer.from(new Uint32Array(indices).buffer),binary=Buffer.concat([pos,tex,idx]);
 const g={asset:{version:'2.0'},scene:0,scenes:[{nodes:[0]}],nodes:[{mesh:0}],meshes:[{primitives:[{attributes:{POSITION:0,TEXCOORD_0:1},indices:2,material:0}]}],buffers:[{byteLength:binary.length}],bufferViews:[{buffer:0,byteOffset:0,byteLength:pos.length},{buffer:0,byteOffset:pos.length,byteLength:tex.length},{buffer:0,byteOffset:pos.length+tex.length,byteLength:idx.length}],accessors:[{bufferView:0,componentType:5126,count:positions.length/3,type:'VEC3',min:[-.3,-1.45,-.2],max:[.3,1.45,.2]},{bufferView:1,componentType:5126,count:uv.length/2,type:'VEC2'},{bufferView:2,componentType:5125,count:indices.length,type:'SCALAR'}],materials:[{pbrMetallicRoughness:{baseColorTexture:{index:0}}}],textures:[{source:0}],images:[]};
 const j=Buffer.from(JSON.stringify(g)),pad=Buffer.alloc((4-j.length%4)%4,32),h=Buffer.alloc(20),bh=Buffer.alloc(8);h.write('glTF');h.writeUInt32LE(2,4);h.writeUInt32LE(28+j.length+pad.length+binary.length,8);h.writeUInt32LE(j.length+pad.length,12);h.writeUInt32LE(0x4e4f534a,16);bh.writeUInt32LE(binary.length);bh.writeUInt32LE(0x004e4942,4);return Buffer.concat([h,j,pad,bh,binary]);
}
describe('Complete subjects and product regions',()=>{
 it('conserves geometry and UVs without duplicating garment/body triangles',()=>{
  const bytes=fixture(),mask=new Uint8Array(10000);mask.fill(255,5000);
  const split=splitAssembly(bytes,{translation:[[0,0,5]],rotation:[[0,0,Math.SQRT1_2,Math.SQRT1_2]],scale:[[1,1,1]]},{width:100,height:100},{xMin:30,yMin:5,xMax:70,yMax:95},environment,[{id:'garment',mask:{data:mask,width:100,height:100}}]);
  expect(split.body.triangles+split.parts[0].triangles).toBe(split.sourceTriangles);expect(split.body.triangles).toBeGreaterThan(0);expect(split.parts[0].triangles).toBeGreaterThan(0);
  inspectGlb(split.body.bytes);inspectGlb(split.parts[0].bytes);
 });
 it('does not honor a user item-count quota in the automatic discovery prompt',()=>{
  const prompt=analysisUserPrompt({width:100,height:100},{...defaultAnalysisOptions,maxObjects:1});expect(prompt).toContain('complete subjects');expect(prompt).not.toContain('up to 1');
 });
 it('rejects cycles, missing parents and unrelated product regions',()=>{
  const person={candidateId:'candidate-1',label:'Person',category:'person',segmentationConcept:'person',bbox:{xMin:1,yMin:1,xMax:60,yMax:90},support:'floor',notes:'',parentCandidateId:null};
  const shirt={...person,candidateId:'candidate-2',category:'clothing',label:'Shirt',parentCandidateId:'candidate-1'};
  const a={sceneType:'outfit',summary:'Person with shirt',environment,objects:[person,shirt]};
  expect(validateAnalysis(a,{width:100,height:100}).objects).toHaveLength(2);
  expect(()=>validateAnalysis({...a,objects:[person,{...shirt,parentCandidateId:'candidate-9'}]},{width:100,height:100})).toThrow();
  expect(()=>validateAnalysis({...a,objects:[{...person,parentCandidateId:'candidate-2'},shirt]},{width:100,height:100})).toThrow();
  expect(()=>validateAnalysis({...a,objects:[person,{...shirt,bbox:{xMin:80,yMin:1,xMax:99,yMax:40}}]},{width:100,height:100})).toThrow();
 });
});
