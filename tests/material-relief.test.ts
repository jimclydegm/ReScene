import {describe,it,expect} from "vitest";
import sharp from "sharp";
import {BoxGeometry,BufferGeometry,BufferAttribute,Matrix4,PerspectiveCamera,SphereGeometry,Vector3} from "three";
import {buildGlb} from "./helpers/glb";
import {readMesh} from "../src/lib/quality/mesh";
import {completeGlbNormals} from "../src/lib/quality/normals";
import {completeSurfaceNormals} from "../src/lib/scene/smooth-normals";
import {fairSmoothSurfaces} from "../src/lib/quality/surface-fairing";
import {compareGeometry} from "../src/lib/quality/geometry";
import {render,renderMesh} from "../src/lib/quality/render";
import {bakeMaterials} from "../src/lib/quality/material-bake";
import {materialEvidence,tileFromEvidence} from "../src/lib/appearance/material-evidence";
import {prepareSurfaceTile,packEnvironmentAtlas} from "../src/lib/appearance/environment-atlas";
import {environmentUsesTexture} from "../src/lib/scene/environment-material";
import {environmentGeometrySchema,type EnvironmentObservation} from "../src/lib/scene/environment-plan";
import {manualBackgroundComposition} from "../src/lib/scene/composition";
import {automaticMaterialTargets,reviewedMaterialSample,reframeQualityPlan,qualityPlanObservationSchema} from "../src/lib/quality/contracts";

describe("Material detail is separate from illumination",()=>{
 it("keeps relief detail without turning uniform color into a paint pattern",()=>{expect(environmentUsesTexture({appearance:"microtexture",finish:"plain",material:"fine plaster relief"})).toBe(true);expect(environmentUsesTexture({appearance:"uniform",finish:"plain",material:"smooth plaster"})).toBe(false);});
 it("finds original-source patches outside foreground masks, corners and windows",async()=>{
  const w=192,h=128,source=await sharp({create:{width:w,height:h,channels:3,background:"#ddccbb"}}).png().toBuffer(),mask=new Uint8Array(w*h);for(let y=50;y<125;y++)for(let x=40;x<150;x++)mask[y*w+x]=255;
  const plan:EnvironmentObservation={version:"environment-observation-v1",topology:"room",surfaces:[{id:"wall",role:"wall",polygon:[{x:0,y:0},{x:1,y:0},{x:1,y:1},{x:0,y:1}],material:"plaster",finish:"plain",color:"#ddccbb",roughness:.9,confidence:.9}],openings:[{kind:"window",surfaceId:"wall",polygon:[{x:0,y:0},{x:.15,y:0},{x:.15,y:1},{x:0,y:1}]}],expectedWallCount:1,lightingEffects:[],explanation:"Wall"};
  const [patch]=await materialEvidence(source,plan,[mask]);expect(patch.id).toBe("wall");expect(patch.rect[0]).toBeGreaterThan(.15);
  for(let y=Math.ceil(patch.rect[1]*h);y<patch.rect[3]*h;y++)for(let x=Math.ceil(patch.rect[0]*w);x<patch.rect[2]*w;x++)expect(mask[y*w+x]).toBe(0);
  await expect(materialEvidence(source,plan,[new Uint8Array(4)])).rejects.toThrow("MASK_SIZE");
 });
 it("extracts monochrome microrelief without broad source lighting or color tint",async()=>{
  const w=128,h=128,data=Buffer.alloc(w*h*3);for(let y=0;y<h;y++)for(let x=0;x<w;x++)for(let c=0;c<3;c++)data[(y*w+x)*3+c]=80+x*.65+(x%4<2?5:-5)+c*10;
  const tile=await prepareSurfaceTile(await sharp(data,{raw:{width:w,height:h,channels:3}}).png().toBuffer(),true),out=await sharp(tile).greyscale().raw().toBuffer();
  const left=out.filter((_,i)=>i%w<32),right=out.filter((_,i)=>i%w>=96),mean=(b:Uint8Array)=>b.reduce((s,v)=>s+v,0)/b.length;
  expect(Math.abs(mean(left)-mean(right))).toBeLessThan(3);expect(Math.max(...out)-Math.min(...out)).toBeGreaterThan(8);expect(Math.abs(mean(out)-128)).toBeLessThan(4);
 });
 it("retains relief in an independent atlas and removes it if its texture is missing",async()=>{
  const g=environmentGeometrySchema.parse({version:"reference-environment-v1",surfaces:[{role:"wall",vertices:[[0,0,0],[1,0,0],[0,1,0]],triangles:[0,1,2],color:"#ddccbb",roughness:.9,textured:true,relief:.002,materialIndex:0,tile:{origin:[0,0,0],u:[1,0,0],v:[0,1,0]}}]}),tile=await sharp({create:{width:32,height:32,channels:3,background:"#888888"}}).png().toBuffer();
  expect((await packEnvironmentAtlas(tile,g,new Map([[0,tile]]))).geometry.surfaces[0].relief).toBe(.002);const fallback=(await packEnvironmentAtlas(tile,g,new Map())).geometry.surfaces[0];expect(fallback.textured).toBe(false);expect(fallback.relief).toBeUndefined();
  const composition=manualBackgroundComposition({width:100,height:100},{floorColor:"#eeeeee",wallColor:"#eeeeee",floorMaterial:"plain",lightDirection:"diffuse",lightWarmth:"neutral",sideWall:"none"},"photo-colors",0);const t=tileFromEvidence(g.surfaces[0],{id:"wall",rect:[.2,.2,.4,.4]},composition)!;expect(new Vector3(...t.u).dot(new Vector3(...t.v))).toBeCloseTo(0);
 });
});
describe("Connected smooth shading and bounded shape correction",()=>{
 it("keeps similar-colored neighboring materials on their own model parts",async()=>{
  const color=[220,215,205],pixel=(r:number,g:number,b:number)=>({data:Uint8Array.from([r,g,b,255]),width:1,height:1}),png=await sharp({create:{width:8,height:8,channels:3,background:{r:220,g:215,b:205}}}).png().toBuffer(),doc=readMesh(buildGlb(new BoxGeometry(1,1,1),{png})),camera=new PerspectiveCamera(40,1,.01,100);camera.position.set(0,0,4);camera.lookAt(0,0,0);camera.updateMatrixWorld();const size=96,visible=render([renderMesh(doc,new Matrix4(),0)],camera,size,size,"depth"),mask=Uint8Array.from(visible.owners,v=>v===0?255:0),photo={data:Uint8Array.from({length:size*size*3},(_,i)=>color[i%3]),width:size,height:size,channels:3 as const},coords=[];for(let y=0;y<size;y++)for(let x=0;x<size;x++)if(mask[y*size+x])coords.push([x/size,y/size]);const left=Math.min(...coords.map(p=>p[0])),right=Math.max(...coords.map(p=>p[0])),top=Math.min(...coords.map(p=>p[1])),bottom=Math.max(...coords.map(p=>p[1])),middle=(top+bottom)/2;
  const result=bakeMaterials({doc,textures:new Map([[0,pixel(...color as [number,number,number])]]),object:0,photo,mask,camera,visible,regions:[{id:"upper",color:color as [number,number,number],sample:pixel(240,40,40),tileScale:1,grain:"none",repeating:false,evidence:[left+.02,top+.02,right+.02,middle+.02],preserveProviderDetail:false},{id:"lower",color:color as [number,number,number],sample:pixel(40,40,240),tileScale:1,grain:"none",repeating:false,evidence:[left+.02,middle+.02,right+.02,bottom+.02],preserveProviderDetail:false}],protectedBoxes:[]});
  const p=doc.primitives[0];for(let t=0;t<p.indices.length/3;t++){const y=[0,1,2].reduce((s,k)=>s+p.positions[p.indices[t*3+k]*3+1],0)/3,z=[0,1,2].reduce((s,k)=>s+p.positions[p.indices[t*3+k]*3+2],0)/3;if(z>.49&&Math.abs(y)>.1)expect(result.labels[0][t]).toBe(y>0?0:1);}
 });
 it("does not bake a fresh generated sample before its matching review passes",()=>{
  const sample={objectId:"o",regionId:"ceramic",reviewRequired:true},check={key:"quality-material-check-o-ceramic",status:"SUCCEEDED",output:{accepted:true}};
  expect(reviewedMaterialSample(sample,[])).toBe(false);expect(reviewedMaterialSample(sample,[{...check,status:"RUNNING"}])).toBe(false);expect(reviewedMaterialSample(sample,[{...check,key:"quality-material-check-other-ceramic"}])).toBe(false);expect(reviewedMaterialSample(sample,[{...check,output:{accepted:false}}])).toBe(false);expect(reviewedMaterialSample(sample,[check])).toBe(true);expect(reviewedMaterialSample({...sample,reviewRequired:undefined},[])).toBe(true);
 });
 it("keeps marked, patterned and directional materials out of automatic replacement",()=>{
  const evidence={x0:0,y0:0,x1:1,y1:1},base={id:"plain",name:"Ceramic",material:"ceramic",color:"#eeeeee",grain:"none",finish:"matte",evidence,confidence:.9,repeating:false,patternScale:1},plan=qualityPlanObservationSchema.parse({version:"object-quality-plan-v1",construction:"rigid",components:[],constraints:[],materials:[base,{...base,id:"wood",grain:"along-part"},{...base,id:"cloth",repeating:true},{...base,id:"glass",finish:"translucent"}],protectedDetails:[],maskCorrections:[],lightingEffects:[],uncertainty:""});
  expect(automaticMaterialTargets(plan)).toEqual(["plain"]);expect(automaticMaterialTargets({...plan,protectedDetails:[{id:"label",kind:"logo",evidence,confidence:.9}]})).toEqual([]);
  const mapped=reframeQualityPlan({...plan,maskCorrections:[{kind:"include",x:.5,y:.5,reason:"Missing part"}]},[.4,.2,.2,.5]);expect(mapped.materials[0].evidence).toEqual({x0:.4,y0:.2,x1:.6000000000000001,y1:.7});expect(mapped.maskCorrections[0]).toMatchObject({x:.5,y:.45});
 });
 it("never mixes normals between very close disconnected thin surfaces",()=>{
  const g=new BufferGeometry();g.setAttribute("position",new BufferAttribute(new Float32Array([0,0,0,1,0,0,0,1,0, 0,0,.001,0,1,.001,1,0,.001]),3));const n=completeSurfaceNormals(g).getAttribute("normal");expect(n.getZ(0)).toBe(1);expect(n.getZ(3)).toBe(-1);
 });
 it("interpolates a UV-split curved surface while preserving box hard edges at different scales",()=>{
  for(const scale of [.001,1,1000]){const g=new SphereGeometry(scale,24,16);g.deleteAttribute("normal");const result=completeSurfaceNormals(g),p=result.getAttribute("position"),n=result.getAttribute("normal");for(let i=0;i<p.count;i++)expect(new Vector3().fromBufferAttribute(p,i).normalize().dot(new Vector3().fromBufferAttribute(n,i))).toBeGreaterThan(.98);}
  const box=new BoxGeometry();box.deleteAttribute("normal");const n=completeSurfaceNormals(box).getAttribute("normal");for(let i=0;i<n.count;i++)expect(Math.max(Math.abs(n.getX(i)),Math.abs(n.getY(i)),Math.abs(n.getZ(i)))).toBeCloseTo(1);
 });
 it("fairing requires photographic smooth-region evidence and retains topology, UVs, bounds and silhouette",()=>{
  const g=new SphereGeometry(1,32,24),p=g.getAttribute("position");for(let i=0;i<p.count;i++){const v=new Vector3().fromBufferAttribute(p,i);if(Math.abs(v.y)<.85&&Math.abs(v.x)<.9&&Math.abs(v.z)<.9)v.multiplyScalar(1+Math.sin(v.x*121+v.y*93+v.z*171)*.008);p.setXYZ(i,v.x,v.y,v.z);}
  const bytes=completeGlbNormals(buildGlb(g)).bytes,camera=new PerspectiveCamera(40,1,.01,100);camera.position.set(0,0,5);camera.lookAt(0,0,0);camera.updateMatrixWorld();const matrix=new Matrix4(),frame=render([renderMesh(readMesh(bytes),matrix,0)],camera,96,96,"depth"),evidence={camera,matrix,mask:Uint8Array.from(frame.owners,v=>v>=0?255:0),width:96,height:96},constraint={id:"smooth",kind:"smooth" as const,box:[0,0,1,1] as [number,number,number,number],confidence:.95};
  expect(fairSmoothSurfaces(bytes,undefined,[constraint]).bytes).toBe(bytes);expect(fairSmoothSurfaces(bytes,evidence,[{...constraint,confidence:.2}]).bytes).toBe(bytes);
  const result=fairSmoothSurfaces(bytes,evidence,[constraint]),a=readMesh(bytes).primitives[0],b=readMesh(result.bytes).primitives[0];expect(result.improved).toBe(true);expect(result.vertices).toBeGreaterThan(20);expect(b.indices).toEqual(a.indices);expect(b.uv).toEqual(a.uv);expect(compareGeometry(bytes,result.bytes,evidence,result.improved).accepted).toBe(true);
  let delta=0;for(let i=0;i<a.positions.length;i+=3)delta=Math.max(delta,new Vector3().fromArray(a.positions,i).distanceTo(new Vector3().fromArray(b.positions,i)));expect(delta).toBeLessThan(.015);
 });
});
