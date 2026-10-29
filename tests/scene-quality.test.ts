import {describe,it,expect} from 'vitest';
import {Vector3} from 'three';
import {analysisSystemPrompt,analysisUserPrompt,defaultAnalysisOptions} from '../src/lib/ai/controls';
import {validateAnalysis} from '../src/lib/ai/contracts';
import {settleSupportContacts,type SceneComposition,type CompositionInput,type ModelPlacement} from '../src/lib/scene/composition';
import {photoCamera,registerPhoto,transferPixels,visibility,type Triangle} from '../src/lib/appearance/bake';
const environment={floorColor:'#eeeeee',wallColor:'#dddddd',floorMaterial:'plain' as const,lightDirection:'diffuse' as const,lightWarmth:'neutral' as const,sideWall:'none' as const};
const placement=(size:[number,number,number]):ModelPlacement=>({version:'sam3d-layout-v1',offset:[0,0,0],rotation:[0,0,0,1],scale:[1,1,1],size});
const stage=():SceneComposition=>({version:'sam3d-room-v1',floorY:0,camera:{position:[0,5,8],target:[0,0,0],fov:45,aspect:1.5},room:{centerX:0,centerZ:0,width:8,depth:8,height:4},environment,environmentSource:'spark',warnings:[],projectionError:0});
const input=(id:string,support:string,category:string,supportedById?:string):CompositionInput=>({id,support,category,supportedById,metadata:{},bounds:{min:[0,0,0],max:[1,1,1]},imageBounds:{xMin:1,yMin:1,xMax:10,yMax:10}});
describe('General scene relationships',()=>{
 it('asks for broad scene content and distinguishes support from assembly',()=>{
  for(const word of ['animals','food','tools','electronics','people'])expect(analysisSystemPrompt).toContain(word);
  expect(analysisSystemPrompt).toContain('remain independent');expect(analysisUserPrompt({width:100,height:100},defaultAnalysisOptions)).not.toContain('head');
 });
 it('accepts food, animal and tool categories and rejects cyclic or missing supports',()=>{
  const object={candidateId:'candidate-1',label:'Item',category:'food',segmentationConcept:'food',bbox:{xMin:1,yMin:1,xMax:10,yMax:10},support:'tabletop',notes:'',parentCandidateId:null,supportedByCandidateId:null};
  for(const category of ['food','animal','tool','surface'])expect(validateAnalysis({sceneType:'general',summary:'Items',environment,objects:[{...object,category}]},{width:100,height:100}).objects).toHaveLength(1);
  expect(()=>validateAnalysis({sceneType:'general',summary:'Items',environment,objects:[{...object,supportedByCandidateId:'candidate-9'}]},{width:100,height:100})).toThrow();
  expect(()=>validateAnalysis({sceneType:'general',summary:'Items',environment,objects:[{...object,supportedByCandidateId:'candidate-2'},{...object,candidateId:'candidate-2',supportedByCandidateId:'candidate-1'}]},{width:100,height:100})).toThrow();
 });
});
describe('Physical support constraints',()=>{
 it('settles independent tabletop items onto a shared plane when the table mesh is missing',()=>{
  const objects=[{id:'laptop',position:[-1,0,0] as [number,number,number],placement:placement([2,1,2])},{id:'mug',position:[1,.4,1] as [number,number,number],placement:placement([1,1,1])}];
  settleSupportContacts(objects,[input('laptop','tabletop','electronics'),input('mug','tabletop','other')],stage());expect(objects.map(o=>o.position[1])).toEqual([0,0]);
 });
 it('uses explicit table height and preserves the projected contact ray',()=>{
  const objects=[{id:'table',position:[0,0,0] as [number,number,number],placement:placement([4,2,4])},{id:'mug',position:[1,3,1] as [number,number,number],placement:placement([1,1,1])}],s=stage();
  const before=(objects[1].position[0]-s.camera.position[0])/(objects[1].position[1]-s.camera.position[1]);
  settleSupportContacts(objects,[input('table','floor','table'),input('mug','tabletop','other','table')],s);expect(objects[1].position[1]).toBe(2);expect((objects[1].position[0]-s.camera.position[0])/(objects[1].position[1]-s.camera.position[1])).toBeCloseTo(before);
 });
});
describe('Source detail transfer',()=>{
 const camera=photoCamera({position:[0,0,0],target:[0,0,-1],fov:90,aspect:1});
 const triangle:Triangle={object:0,image:0,points:[new Vector3(-1,-1,-2),new Vector3(1,-1,-2),new Vector3(-1,1,-2)],uv:[[0,1],[1,1],[0,0]]};
 it('bounds photo registration instead of warping an unrelated mask onto the object',()=>{
  const mask=new Uint8Array(64*64);for(let y=16;y<48;y++)for(let x=18;x<50;x++)mask[y*64+x]=255;
  const reg=registerPhoto([triangle],camera,mask,{width:64,height:64});expect(reg.scaleX).toBeCloseTo(1);expect(reg.offsetX).toBeCloseTo(2);
  expect(registerPhoto([triangle],camera,new Uint8Array(4096),{width:64,height:64})).toEqual({scaleX:1,scaleY:1,offsetX:0,offsetY:0});
 });
 it('copies source light/dark detail only through foreground masks',()=>{
  const photo={width:64,height:64,data:new Uint8Array(64*64*3)};for(let y=0;y<64;y++)for(let x=0;x<64;x++)for(let k=0;k<3;k++)photo.data[(y*64+x)*3+k]=(Math.floor(x/4)%2)*240;
  const texture={width:64,height:64,data:new Uint8Array(64*64*3).fill(100)},depth=visibility([triangle],camera,64,64);
  const r=transferPixels([triangle],0,texture,photo,new Uint8Array(4096).fill(255),camera,depth);expect(r.copied).toBeGreaterThan(100);expect(r.data.some(v=>v<10)).toBe(true);expect(r.data.some(v=>v>230)).toBe(true);
  expect(transferPixels([triangle],0,texture,photo,new Uint8Array(4096),camera,depth).copied).toBe(0);
 });
});
