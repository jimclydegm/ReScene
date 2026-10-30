import {describe,it,expect,vi} from "vitest";
vi.mock("server-only",()=>({}));
import {matchMask} from "../src/lib/ai/mask-match";
import {creativePrompt,creativeInput} from "../src/lib/ai/creative-contract";
import {creativeReviewSchema,reviewIssues} from "../src/lib/ai/creative-review";
import {runInputSchema} from "../src/lib/validation/generation";
import {randomUUID} from "node:crypto";
describe("Spatial mask matching",()=>{
 it("accepts a single shifted mask near a coarse box instead of dropping the object",()=>{const mask={bounds:{xMin:619,xMax:846,yMin:281,yMax:399}};expect(matchMask([mask],{xMin:629,xMax:861,yMin:360,yMax:481})).toBe(mask);});
 it("selects the loose part nearest its source box instead of the repeated attached part",()=>{const loose={bounds:{xMin:373,xMax:484,yMin:374,yMax:396}},attached={bounds:{xMin:457,xMax:583,yMin:228,yMax:249}};expect(matchMask([attached,loose],{xMin:383,xMax:498,yMin:450,yMax:488})).toBe(loose);});
 it("keeps spatially ambiguous and unrelated masks unaccepted",()=>{const a={bounds:{xMin:10,xMax:30,yMin:10,yMax:30}};expect(matchMask([a,a],a.bounds)).toBeUndefined();expect(matchMask([a],{xMin:500,xMax:550,yMin:500,yMax:550})).toBeUndefined();});
});
describe("Composition quality constraints and paid recovery",()=>{
 it("identifies setting/products/correction separately and preserves scale/framing constraints",()=>{const p=creativePrompt({template:"kitchen",prompt:"known table height 75cm"},["Table","Jar"],"Remove duplicate jar.");for(const t of ["image 1 is the EMPTY SETTING","2: ","ONE complete instance","10%","Never put full-size furniture on a countertop","FINAL input image","Remove duplicate jar.","known table height 75cm"])expect(p).toContain(t);});
 it("derives explicit warnings from structured observations even if free text is empty",()=>{const r=creativeReviewSchema.parse({version:"composition-review-v1",products:[{reference:1,count:2,cropped:true,scaleConcern:true,supportConcern:true}],backgroundChanged:true,issues:[]});expect(reviewIssues(r)).toHaveLength(5);});
 it("requires explicit confirmation and selected objects for a paid repair",()=>{const v={kind:"RECONSTRUCT",expectedRevision:1,idempotencyKey:randomUUID(),objectIds:[randomUUID()],repair:true,confirmed:true};expect(runInputSchema.safeParse(v).success).toBe(true);expect(runInputSchema.safeParse({...v,confirmed:undefined}).success).toBe(false);expect(runInputSchema.safeParse({...v,objectIds:undefined}).success).toBe(false);expect(runInputSchema.safeParse({...v,kind:"ANALYZE"}).success).toBe(false);});
 it("accepts only UUID correction sources",()=>{const v={sceneId:randomUUID(),expectedRevision:0,idempotencyKey:randomUUID(),referenceIds:[randomUUID()],template:"studio",aspect:"4:3",prompt:""};expect(creativeInput.safeParse({...v,refinementSourceId:randomUUID()}).success).toBe(true);expect(creativeInput.safeParse({...v,refinementSourceId:"https://other/image"}).success).toBe(false);});
});
