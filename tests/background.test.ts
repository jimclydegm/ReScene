import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { randomUUID } from "node:crypto";
import { Vector3 } from "three";
import { backgroundPlanSchema, backgroundSurfaces, backgroundProjection } from "../src/lib/scene/background";
import { backgroundFootprint, compositeBackground } from "../src/lib/appearance/background";
import { compositionSchema } from "../src/lib/scene/composition";
import { snapshotSchema, snapshotAssets } from "../src/lib/scene/manifest";
import { defaultLighting } from "../src/lib/scene/lighting";
import { runInputSchema } from "../src/lib/validation/generation";
import { analysisSystemPrompt } from "../src/lib/ai/controls";

const composition=()=>compositionSchema.parse({version:"sam3d-room-v1",camera:{position:[0,4,8],target:[0,1,0],fov:50,aspect:1.5},room:{centerX:0,centerZ:0,width:8,depth:8,height:4},environment:{floorColor:"#aaaaaa",wallColor:"#dddddd",floorMaterial:"plain",lightDirection:"diffuse",lightWarmth:"neutral",sideWall:"left"},environmentSource:"spark",projectionError:0,warnings:[]});
describe("Photo background structure and projection",()=>{
  it("keeps legacy and seamless backgrounds open regardless of furniture or side-wall guesses",()=>{
    const c=composition();expect(backgroundSurfaces(c,0).wall).toBeNull();
    c.background={kind:"seamless",groundVisible:true,boundary:null,description:"Continuous support"};
    expect(backgroundSurfaces(c,0).wall).toBeNull();expect(backgroundSurfaces(c,0).ground).toBe(true);
  });
  it("places a wall only on an observed reachable seam and projects its foot back onto that seam",()=>{
    const c=composition();c.background={kind:"planes",groundVisible:true,boundary:{leftY:.25,rightY:.3},description:"Observed wall and support"};
    const wall=backgroundSurfaces(c,0).wall;expect(wall).not.toBeNull();
    const p=new Vector3(wall!.position[0],0,wall!.position[2]).applyMatrix4(backgroundProjection(c.camera));
    expect((1-p.y)/2).toBeCloseTo(.25*(1-(p.x+1)/2)+.3*(p.x+1)/2,4);
    expect(wall!.width).toBeGreaterThan(100);
  });
  it("keeps sky/landscape context distant and rejects invented/behind-camera seams",()=>{
    const c=composition();c.background={kind:"distant",groundVisible:false,boundary:null,description:"Sky and mountains"};
    expect(backgroundSurfaces(c,0).ground).toBe(false);expect(backgroundSurfaces(c,0).wall).toBeNull();
    c.background={kind:"planes",groundVisible:true,boundary:{leftY:0,rightY:0},description:"Unreachable seam"};expect(backgroundSurfaces(c,0).wall).toBeNull();
    expect(backgroundPlanSchema.safeParse({...c.background,boundary:{leftY:-.1,rightY:1.1}}).success).toBe(false);
  });
  it("includes background observations without restricting general subject categories",()=>{
    for(const phrase of ["animals","food","tools","people","seamless","distant","Never invent room corners"])expect(analysisSystemPrompt).toContain(phrase);
  });
});
describe("Background removal and fidelity",()=>{
  const image={width:64,height:64,data:new Uint8Array(64*64*3)};
  for(let i=0;i<image.data.length;i++)image.data[i]=i%251;
  it("unions all foreground masks, adds a bounded halo and preserves distant background",async()=>{
    const first=new Uint8Array(4096),second=new Uint8Array(4096);first[20*64+20]=255;second[40*64+40]=255;
    const footprint=await backgroundFootprint(image,[first,second]);
    expect(footprint.mask[20*64+20]).toBe(255);expect(footprint.mask[40*64+40]).toBe(255);expect(footprint.mask[0]).toBe(0);
    expect(footprint.mask.filter(v=>v>0).length).toBeGreaterThan(2);
  });
  it("copies original visible pixels exactly and uses generated pixels only inside removal footprints",async()=>{
    const fill=await sharp({create:{width:64,height:64,channels:3,background:{r:17,g:23,b:31}}}).png().toBuffer();
    const footprint=new Uint8Array(4096);footprint[30*64+30]=255;
    const result=await sharp(await compositeBackground(image,fill,footprint)).removeAlpha().raw().toBuffer();
    for(let i=0;i<4096;i++)if(!footprint[i])expect([...result.subarray(i*3,i*3+3)]).toEqual([...image.data.subarray(i*3,i*3+3)]);
  });
  it("matches generated fill to background boundaries without retaining the removed subject",async()=>{
    const photo={width:64,height:64,data:new Uint8Array(4096*3).fill(190)},mask=new Uint8Array(4096);
    for(let y=10;y<54;y++)for(let x=10;x<54;x++)mask[y*64+x]=255;
    for(let y=20;y<44;y++)for(let x=20;x<44;x++)for(let k=0;k<3;k++)photo.data[(y*64+x)*3+k]=0;
    const generated=await sharp({create:{width:64,height:64,channels:3,background:{r:150,g:150,b:150}}}).png().toBuffer();
    const result=await sharp(await compositeBackground(photo,generated,mask)).raw().toBuffer();
    expect([...result].every(v=>Math.abs(v-190)<=1)).toBe(true);
  });
  it("extends a smooth photographed lighting gradient behind a removed object",async()=>{
    const photo={width:128,height:96,data:new Uint8Array(128*96*3)},mask=new Uint8Array(128*96);
    const value=(x:number,y:number)=>Math.round(90+60*(x/128)**2+35*y/96);
    for(let y=0;y<96;y++)for(let x=0;x<128;x++){const i=y*128+x;for(let k=0;k<3;k++)photo.data[i*3+k]=value(x,y);if(x>30&&x<96&&y>20&&y<76)mask[i]=255;}
    for(let y=30;y<66;y++)for(let x=40;x<86;x++)for(let k=0;k<3;k++)photo.data[(y*128+x)*3+k]=0;
    const generated=await sharp({create:{width:128,height:96,channels:3,background:"#665544"}}).png().toBuffer();
    const result=await sharp(await compositeBackground(photo,generated,mask,{kind:"seamless",groundVisible:true,boundary:null,description:"A smooth surface"})).raw().toBuffer();
    expect(Math.abs(result[(48*128+64)*3]-value(64,48))).toBeLessThan(2);
  });
  it("rejects mismatched masks, empty foreground and a generated image with changed framing",async()=>{
    await expect(backgroundFootprint(image,[new Uint8Array(1)])).rejects.toThrow();
    await expect(backgroundFootprint(image,[new Uint8Array(4096)])).rejects.toThrow();
    const wrong=await sharp({create:{width:100,height:20,channels:3,background:"white"}}).png().toBuffer();
    await expect(compositeBackground(image,wrong,new Uint8Array(4096))).rejects.toThrow("FRAME_CHANGED");
  });
});
describe("Durable background and publication contracts",()=>{
  it("accepts a background-only run and rejects controls from other phases",()=>{
    const input={kind:"IMAGE_EDIT",expectedRevision:2,idempotencyKey:randomUUID()};
    expect(runInputSchema.safeParse(input).success).toBe(true);
    expect(runInputSchema.safeParse({...input,objectIds:[randomUUID()]}).success).toBe(false);
    expect(runInputSchema.safeParse({...input,analysis:{focus:"auto"}}).success).toBe(false);
  });
  it("freezes the derived background in the exact render allowlist without allowing a source photo field",()=>{
    const id=randomUUID(),model=randomUUID();
    const snapshot={schemaVersion:2,coordinates:{handedness:"right",upAxis:"Y",units:"approximate"},title:"Any scene",description:null,revision:2,approximateGeometry:true,composition:composition(),lighting:defaultLighting(null),surfaces:{floorAssetId:null,wallAssetId:null,backgroundAssetId:id},objects:[{id:randomUUID(),label:"Subject",modelAssetId:model,transform:{position:[0,0,0],rotation:[0,0,0,1],scale:[1,1,1]},productId:null}],products:[]};
    expect(snapshotAssets(snapshotSchema.parse(snapshot))).toEqual([id,model].sort());
    expect(snapshotSchema.safeParse({...snapshot,surfaces:{...snapshot.surfaces,sourceAssetId:randomUUID()}}).success).toBe(false);
    expect(snapshotSchema.safeParse({...snapshot,surfaces:{floorAssetId:null,wallAssetId:null}}).success).toBe(true);
  });
});
