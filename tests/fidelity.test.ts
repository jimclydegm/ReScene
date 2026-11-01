import {describe,it,expect} from "vitest";
import sharp from "sharp";
import {qualityMaskOverlay} from "../src/lib/quality/reference";
import {estimateBackgroundSpatial,foregroundDepthScale} from "../src/lib/scene/environment-spatial";
import {materialSurfaceGeometry} from "../src/lib/scene/material-background";
import {compositionSchema} from "../src/lib/scene/composition";
import {materialQualityOptions,runInputSchema} from "../src/lib/validation/generation";
import {decodeTextures} from "../src/lib/quality/pipeline";
import {readMesh} from "../src/lib/quality/mesh";
import {buildGlb} from "./helpers/glb";
import {BoxGeometry} from "three";
const stage=()=>compositionSchema.parse({version:"sam3d-room-v1",camera:{position:[0,1,6],target:[0,1,0],fov:40,aspect:16/9},room:{centerX:0,centerZ:0,width:8,depth:20,height:4},floorY:0,environment:{floorColor:"#ddddee",wallColor:"#ddddee",floorMaterial:"plain",lightDirection:"diffuse",lightWarmth:"neutral",sideWall:"none"},environmentSource:"spark",projectionError:0,warnings:[],background:{kind:"seamless",groundVisible:true,boundary:null,description:"A sweep",transition:"curve",surfaceMode:"materials"}});
describe("Calibrated environment and generated textures",()=>{
 it("composites full-frame masks before downsizing landscape and portrait source images",async()=>{
  for(const [width,height]of [[1600,900],[900,1600],[2000,2000]]){const photo=await sharp({create:{width,height,channels:3,background:"white"}}).webp().toBuffer(),mask=new Uint8Array(width*height);for(let y=height/4|0;y<height*3/4;y++)for(let x=width/4|0;x<width*3/4;x++)mask[y*width+x]=255;const result=await qualityMaskOverlay(photo,mask,{width,height}),m=await sharp(result).metadata();expect(Math.max(m.width!,m.height!)).toBeLessThanOrEqual(1600);expect(m.width!/m.height!).toBeCloseTo(width/height,2);}
 });
 it("anchors background depth to foregrounds and does not force a fixed room-size setback",()=>{
  const c=stage(),width=160,height=90,mask=new Uint8Array(width*height);for(let y=40;y<80;y++)for(let x=60;x<100;x++)mask[y*width+x]=255;
  const grid={width,height,sourceWidth:width,sourceHeight:height,content:{left:0,top:0,width,height},intrinsic:[1,0,0,0,1,0,0,0,1],data:Float32Array.from(mask,v=>v?2:3),confidence:new Float32Array(width*height).fill(2)},anchors=[{mask,position:[0,0,0] as [number,number,number],size:[1,2,1] as [number,number,number]}];
  expect(foregroundDepthScale(grid,c,anchors)?.scale).toBeCloseTo(2.925);
  const s=estimateBackgroundSpatial(c,grid,anchors);expect(s.source).toBe("foreground-calibrated-depth");expect(s.rearDistance).toBeCloseTo(2.775);expect(s.rearDistance).toBeLessThan(c.room.depth/2);
  c.background!.spatial=s;const layout=materialSurfaceGeometry(c,0);expect(layout.rear[2]).toBeCloseTo(-s.rearDistance);expect(layout.radius).toBeCloseTo(s.curveRadius);
  grid.data.fill(NaN);expect(estimateBackgroundSpatial(c,grid,anchors).source).toBe("subject-relative-fallback");expect(estimateBackgroundSpatial(c,null,anchors).rearDistance).toBeLessThan(3);
 });
 it("creates higher-density base-color atlases without changing geometry or UV coordinates",async()=>{
  const doc=readMesh(buildGlb(new BoxGeometry(),{png:await sharp({create:{width:32,height:32,channels:3,background:"red"}}).png().toBuffer()}));const before=Array.from(doc.primitives[0].uv!);const out=await decodeTextures(doc,256);expect([...out.textures.values()][0].width).toBe(256);expect(Array.from(doc.primitives[0].uv!)).toEqual(before);
 });
 it("keeps old requests compatible and rejects invalid high-resolution controls",()=>{
  expect(materialQualityOptions.parse({materials:true,masks:false,review:true}).textureSize).toBe(2048);
  expect(materialQualityOptions.safeParse({materials:true,masks:false,review:true,textureSize:16384}).success).toBe(false);
  expect(runInputSchema.safeParse({kind:"IMAGE_EDIT",expectedRevision:1,idempotencyKey:crypto.randomUUID(),confirmed:true,quality:{materials:true,masks:false,review:true,refresh:true,photoStrength:.35,textureSize:4096}}).success).toBe(true);
 });
});
