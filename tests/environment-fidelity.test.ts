import {describe,it,expect} from "vitest";
import sharp from "sharp";
import {BoxGeometry,SphereGeometry,Vector3} from "three";
import {buildGlb} from "./helpers/glb";
import {readMesh,writeGlb} from "../src/lib/quality/mesh";
import {completeGlbNormals} from "../src/lib/quality/normals";
import {completeSurfaceNormals} from "../src/lib/scene/smooth-normals";
import {inspectGlb} from "../src/lib/ai/glb";
import {environmentUsesTexture} from "../src/lib/scene/environment-material";
import {environmentGeometrySchema,environmentModelObservationSchema,type EnvironmentObservation} from "../src/lib/scene/environment-plan";
import {assertStrictSchema} from "../src/lib/ai/structured-output";
import {packEnvironmentAtlas,orthogonalTile,prepareSurfaceTile} from "../src/lib/appearance/environment-atlas";
import {environmentAlbedo} from "../src/lib/appearance/environment-albedo";
import {alignCleanDepth} from "../src/lib/appearance/clean-depth";
import {z} from "zod";
const solid=(color:string,width=32,height=32)=>sharp({create:{width,height,channels:3,background:color}}).png().toBuffer();
describe("Faithful smooth-shaded Meta meshes",()=>{
 it("adds smooth normals while preserving every triangle corner, UV, image and transform",async()=>{
  const png=await solid("#887766"),bytes=buildGlb(new SphereGeometry(1,16,12),{png,node:{translation:[0,2,1],scale:[2,2,2]}}),before=readMesh(bytes),result=completeGlbNormals(bytes),after=readMesh(result.bytes);
  expect(result.primitives).toBe(1);expect(()=>inspectGlb(result.bytes)).not.toThrow();expect(after.json.nodes).toEqual(before.json.nodes);
  for(const [i,p]of before.primitives.entries()){
   const q=after.primitives[i];expect(q.indices.length).toBe(p.indices.length);expect(q.normals?.every(Number.isFinite)).toBe(true);
   for(let j=0;j<p.indices.length;j++){expect(Array.from(q.positions.slice(q.indices[j]*3,q.indices[j]*3+3))).toEqual(Array.from(p.positions.slice(p.indices[j]*3,p.indices[j]*3+3)));expect(Array.from(q.uv!.slice(q.indices[j]*2,q.indices[j]*2+2))).toEqual(Array.from(p.uv!.slice(p.indices[j]*2,p.indices[j]*2+2)));}
  }
  expect(after.views[after.json.images[0].bufferView]).toEqual(png);expect(completeGlbNormals(result.bytes).primitives).toBe(0);
 });
 it("keeps smooth shading after a later quality repair rewrites primitive indices",()=>{
  const normalized=completeGlbNormals(buildGlb(new SphereGeometry(1,16,12))).bytes,doc=readMesh(normalized),p=doc.primitives[0],rewritten=readMesh(writeGlb(doc,{primitives:new Map([[p.key,{indices:p.indices}]])}));
  const next=rewritten.primitives[0].normals!;for(let i=0;i<next.length;i+=3)expect(new Vector3(...Array.from(next.slice(i,i+3))).dot(new Vector3(...Array.from(p.normals!.slice(i,i+3))))).toBeGreaterThan(.99);
 });
 it("preserves sharp box edges and never mutates the shared loader geometry",()=>{
  const box=new BoxGeometry();box.deleteAttribute("normal");const smooth=completeSurfaceNormals(box);expect(box.hasAttribute("normal")).toBe(false);expect(smooth).not.toBe(box);
  const n=smooth.getAttribute("normal");for(let i=0;i<n.count;i++)expect(Math.max(Math.abs(n.getX(i)),Math.abs(n.getY(i)),Math.abs(n.getZ(i)))).toBeCloseTo(1);
  const nonIndexed=box.toNonIndexed(),copy=completeSurfaceNormals(nonIndexed);expect(nonIndexed.hasAttribute("normal")).toBe(false);expect(copy).not.toBe(nonIndexed);
 });
});
describe("Independent background surface maps",()=>{
 it("honors an explicit uniform finish even when a legacy material label mentions plaster",()=>{
  const surface={finish:"textured" as const,material:"limewash plaster",appearance:"uniform" as const};expect(environmentUsesTexture(surface)).toBe(false);expect(environmentUsesTexture({...surface,appearance:"pattern"})).toBe(true);expect(()=>assertStrictSchema(z.toJSONSchema(environmentModelObservationSchema))).not.toThrow();
 });
 it("packs floor and window into independent atlas rectangles, keeping uniform walls untextured",async()=>{
  const geometry=environmentGeometrySchema.parse({version:"reference-environment-v1",surfaces:[{role:"floor",materialIndex:0,vertices:[[0,0,0],[1,0,0],[0,0,1]],triangles:[0,1,2],tile:{origin:[0,0,0],u:[1,0,0],v:[.2,0,1]},color:"#888888",roughness:.8,textured:true},{role:"window",vertices:[[0,0,0],[1,0,0],[0,1,0]],triangles:[0,1,2],color:"#ffffff",roughness:1,textured:true},{role:"wall",vertices:[[0,0,0],[1,0,0],[0,1,0]],triangles:[0,1,2],color:"#eeeeee",roughness:.8,textured:false}]});
  const result=await packEnvironmentAtlas(await solid("#2255dd"),geometry,new Map([[0,await solid("#bb4422")]]));expect(environmentGeometrySchema.safeParse(result.geometry).success).toBe(true);expect(result.geometry.surfaces.map(s=>s.atlas?.mode)).toEqual(["tile","photo",undefined]);expect(result.geometry.surfaces[0].atlas?.rect).not.toEqual(result.geometry.surfaces[1].atlas?.rect);
  const {data,info}=await sharp(result.bytes).raw().toBuffer({resolveWithObject:true});
  for(const [i,color]of [[0,[187,68,34]],[1,[34,85,221]]] as const){const r=result.geometry.surfaces[i].atlas!.rect,x=Math.floor((r[0]+r[2])/2*info.width),y=Math.floor((1-(r[1]+r[3])/2)*info.height);for(let c=0;c<3;c++)expect(Math.abs(data[(y*info.width+x)*3+c]-color[c])).toBeLessThan(8);}
  const tile=result.geometry.surfaces[0].tile!;expect(new Vector3(...tile.u).dot(new Vector3(...tile.v))).toBeCloseTo(0);expect(geometry.surfaces[0].atlas).toBeUndefined();
 });
 it("preserves native empty-plate resolution and source window pixels without painting trim bands",async()=>{
  const plan:EnvironmentObservation={version:"environment-observation-v1",topology:"room",surfaces:[{id:"wall",role:"wall",polygon:[{x:0,y:0},{x:1,y:0},{x:1,y:1},{x:0,y:1}],finish:"plain",appearance:"uniform",color:"#ffffff",roughness:.8,material:"uniform paint",confidence:1}],openings:[{surfaceId:"wall",kind:"window",polygon:[{x:0,y:0},{x:.3,y:0},{x:.3,y:1},{x:0,y:1}]}],expectedWallCount:1,lightingEffects:[],explanation:"Window at the edge"};
  const out=await environmentAlbedo(await solid("#2255dd",32,16),await solid("#bb4422",128,64),new Uint8Array(32*16),plan,{preserveResolution:true,delight:false}),decoded=await sharp(out).raw().toBuffer({resolveWithObject:true});expect(decoded.info.width).toBe(128);expect(decoded.info.height).toBe(64);expect(decoded.data[2]).toBeGreaterThan(200);expect(decoded.data[(32*128+100)*3]).toBeGreaterThan(150);
 });
 it("orthogonalizes sampling axes and reconciles borders without reducing native tile size",async()=>{
  const t=orthogonalTile({origin:[0,0,0],u:[2,0,0],v:[1,0,3]});expect(new Vector3(...t.u).dot(new Vector3(...t.v))).toBeCloseTo(0);expect(new Vector3(...t.v).length()).toBeCloseTo(Math.sqrt(10));const out=await prepareSurfaceTile(await solid("#aa8866",128,128));expect((await sharp(out).metadata()).width).toBe(128);
 });
});
describe("Clean depth in the original scene frame",()=>{
 const grid=(depth:number)=>({width:8,height:8,data:new Float32Array(64).fill(depth),confidence:new Float32Array(64).fill(3),sourceWidth:8,sourceHeight:8,content:{left:0,top:0,width:8,height:8},intrinsic:[1,0,4,0,1,4,0,0,1]});
 const plan={openings:[]} as unknown as EnvironmentObservation;
 it("aligns to unchanged background while excluding removed foreground objects",()=>{
  const original=grid(2),clean=grid(1),mask=new Uint8Array(64);for(let i=0;i<16;i++){original.data[i]=20;mask[i]=255;}
  const result=alignCleanDepth(original,clean,[mask],plan);expect(result.scale).toBe(2);expect(result.grid.data[32]).toBe(2);expect(clean.data[32]).toBe(1);
 });
 it("rejects an inconsistent gauge instead of moving the saved environment",()=>{
  const original=grid(2),clean=grid(1);for(let i=0;i<32;i++)clean.data[i]=10;expect(()=>alignCleanDepth(original,clean,[],plan)).toThrow("ALIGNMENT");
 });
});
