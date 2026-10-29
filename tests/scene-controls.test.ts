import { describe,expect,it } from "vitest";
import sharp from "sharp";
import { analysisOptionsSchema,analysisUserPrompt,segmentationOptionsSchema,segmentationPrompt } from "../src/lib/ai/controls";
import { validateAnalysis } from "../src/lib/ai/contracts";
import { combineMasks } from "../src/lib/ai/masks";
import { runInputSchema,maskSelectionSchema } from "../src/lib/validation/generation";
const id="3ee61171-5730-4c80-8dc2-274eebd26576",other="be169d8b-69d8-44d2-8fe0-80206ad3a202";
const size={width:1024,height:1536};
const base={label:"T-shirt",concept:"T-shirt",mode:"spatial" as const,points:[]};
describe("Subject-independent analysis and recovery controls",()=>{
 it("accepts worn garments and footwear rather than forcing a furniture category",()=>{
  const result=validateAnalysis({sceneType:"outfit",summary:"A shirt, shorts and shoes.",environment:{floorColor:"#dddddd",wallColor:"#eeeeee",floorMaterial:"plain",lightDirection:"diffuse",lightWarmth:"neutral",sideWall:"none"},objects:["clothing","footwear","electronics","other"].map((category,i)=>({candidateId:`candidate-${i+1}`,label:category,category,segmentationConcept:category,bbox:{xMin:1,yMin:2,xMax:30,yMax:40},support:"unknown",notes:""}))},size);
  expect(result.objects).toHaveLength(4);
 });
 it("bounds the analysis scope and retains explicit garment focus",()=>{
  const options=analysisOptionsSchema.parse({focus:"clothing",maxObjects:3,instructions:"shirt, shorts and shoes"});
  expect(analysisUserPrompt(size,options)).toContain("visible apparel");
  expect(analysisOptionsSchema.safeParse({maxObjects:30}).success).toBe(false);
  expect(analysisOptionsSchema.safeParse({instructions:"x".repeat(601)}).success).toBe(false);
 });
 it("encodes a half-open photo-edge box as inclusive SAM coordinates",()=>{
  expect(segmentationPrompt({...base,concept:"",box:{xMin:0,yMin:0,xMax:1024,yMax:1536}},size)).toBe("<0f>1<|box;x1=0;y1=0;x2=1023;y2=1535;w=1024;h=1536|>");
 });
 it("keeps include/exclude labels and rejects points outside the exact source frame",()=>{
  const options={...base,points:[{x:100,y:300,label:"positive" as const},{x:200,y:400,label:"negative" as const}]};
  expect(segmentationPrompt(options,size)).toContain("-<|point;x=200;y=400;w=1024;h=1536|>");
  expect(()=>segmentationPrompt({...base,points:[{x:1024,y:2,label:"positive"}]},size)).toThrow();
  expect(()=>segmentationPrompt({...base,box:{xMin:0,yMin:1,xMax:1025,yMax:100}},size)).toThrow();
 });
 it("never mixes a noun phrase with spatial prompts or submits only exclusion points",()=>{
  expect(segmentationOptionsSchema.safeParse({...base,mode:"text",box:{xMin:1,yMin:1,xMax:10,yMax:10}}).success).toBe(false);
  expect(segmentationOptionsSchema.safeParse({...base,points:[{x:1,y:1,label:"negative"}]}).success).toBe(false);
  expect(segmentationOptionsSchema.safeParse({...base,mode:"text",concept:"<0f>1<|box|>"}).success).toBe(false);
 });
 it("supports independent outline attempts and validates the reconstruction seed",()=>{
  const request={kind:"SEGMENT_OBJECT",expectedRevision:2,idempotencyKey:id,segmentation:{...base,mode:"text"}};
  expect(runInputSchema.safeParse(request).success).toBe(true);
  expect(runInputSchema.safeParse({...request,segmentation:undefined}).success).toBe(false);
  expect(runInputSchema.safeParse({...request,analysis:{focus:"clothing"}}).success).toBe(false);
  expect(runInputSchema.safeParse({kind:"RECONSTRUCT",expectedRevision:2,idempotencyKey:id,objectIds:[id],reconstruction:{seed:-1}}).success).toBe(false);
 });
 it("requires one saved mask or distinct masks to combine",()=>{
  const input={expectedRevision:2,objectId:id};
  expect(maskSelectionSchema.safeParse({...input,maskAssetId:id}).success).toBe(true);
  expect(maskSelectionSchema.safeParse({...input,maskAssetIds:[id,other]}).success).toBe(true);
  expect(maskSelectionSchema.safeParse({...input,maskAssetIds:[id,id]}).success).toBe(false);
  expect(maskSelectionSchema.safeParse({...input,maskAssetId:id,maskAssetIds:[id,other]}).success).toBe(false);
 });
});
describe("Multi-part product masks",()=>{
 it("combines disjoint shoes without filling the gap or counting overlap twice",async()=>{
  const png=async(pixels:number[])=>sharp(Buffer.from(pixels),{raw:{width:4,height:2,channels:1}}).png().toBuffer();
  const result=await combineMasks([await png([255,0,0,255,255,0,0,0]),await png([255,0,0,0,0,0,0,255])],{width:4,height:2});
  const output=await sharp(result.png).greyscale().raw().toBuffer();
  expect([...output]).toEqual([255,0,0,255,255,0,0,255]);expect(result.area).toBe(4);expect(result.bounds).toEqual({xMin:0,yMin:0,xMax:4,yMax:2});
 });
 it("rejects masks from a different source size",async()=>{
  const png=await sharp(Buffer.from([255]),{raw:{width:1,height:1,channels:1}}).png().toBuffer();
  await expect(combineMasks([png,png],{width:2,height:2})).rejects.toThrow("MASK_FRAME_MISMATCH");
 });
});
