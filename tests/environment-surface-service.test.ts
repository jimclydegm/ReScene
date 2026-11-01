import {beforeEach,describe,it,expect,vi} from "vitest";
import sharp from "sharp";
const m=vi.hoisted(()=>({db:{sceneObject:{findMany:vi.fn()},generationRun:{update:vi.fn()},generationStep:{findUnique:vi.fn(),create:vi.fn(),update:vi.fn()}},context:vi.fn(),plan:vi.fn(),read:vi.fn(),submit:vi.fn(),analyze:vi.fn(),clean:vi.fn()}));
vi.mock("server-only",()=>({}));vi.mock("@/lib/db",()=>({getDb:()=>m.db}));vi.mock("@/lib/storage/r2",()=>({readLimited:m.read}));vi.mock("@/lib/ai/environment",()=>({analyzeEnvironment:m.analyze,cleanEnvironment:m.clean}));vi.mock("@/lib/ai/sam3d",()=>({getSam3dClient:()=>({client:{queue:{submit:m.submit}}})}));
vi.mock("@/lib/services/background-environment",()=>({environmentContext:m.context,planSceneEnvironment:m.plan,depthStep:vi.fn(),saveEnvironmentAsset:vi.fn()}));
import {prepareCleanEnvironmentDepth} from "../src/lib/services/environment-surfaces";
const plan={version:"environment-observation-v1",topology:"room",surfaces:[{id:"wall",role:"wall",finish:"plain",appearance:"uniform",color:"#eeeeee",roughness:.8,material:"uniform plaster",confidence:1,polygon:[{x:0,y:0},{x:1,y:0},{x:1,y:1},{x:0,y:1}]}],openings:[],expectedWallCount:1,lightingEffects:[],explanation:"One wall"};
let prior:Record<string,unknown>|null;
beforeEach(async()=>{
 vi.resetAllMocks();prior=null;m.context.mockResolvedValue({run:{input:{background:{mode:"reference"}}},scene:{id:"scene",revision:5},photo:{id:"photo",storageKey:"photo",width:32,height:32}});m.plan.mockResolvedValue(plan);m.db.sceneObject.findMany.mockResolvedValue([{mask:{status:"READY",storageKey:"mask"}}]);m.read.mockResolvedValue(await sharp({create:{width:32,height:32,channels:3,background:"#dddddd"}}).png().toBuffer());
 m.db.generationStep.findUnique.mockImplementation(({where})=>{const key=where.runId_key_attempt.key;return key==="environment-albedo"?{status:"SUCCEEDED",response:{id:"plate",storageKey:"plate"}}:key==="environment-clean-analysis"?{status:"SUCCEEDED",output:plan}:prior;});m.db.generationStep.create.mockImplementation(({data})=>{prior={...data,id:"step"};return prior;});m.db.generationStep.update.mockImplementation(({data})=>{prior={...prior,...data};return prior;});m.submit.mockResolvedValue({request_id:"known-job"});
});
describe("Object-free background job receipts",()=>{
 it("reuses a known job and its paid plate/analysis without another model submission",async()=>{
  prior={providerRequestId:"known-job",status:"WAITING"};expect(await prepareCleanEnvironmentDepth("run")).toBe("known-job");expect(m.submit).not.toHaveBeenCalled();expect(m.clean).not.toHaveBeenCalled();expect(m.analyze).not.toHaveBeenCalled();
 });
 it("reserves clean-plate lineage and scene revision before one depth submission",async()=>{
  expect(await prepareCleanEnvironmentDepth("run")).toBe("known-job");expect(prior).toMatchObject({status:"WAITING",input:{plateAssetId:"plate",photoId:"photo",sceneRevision:5}});expect(await prepareCleanEnvironmentDepth("run")).toBe("known-job");expect(m.submit).toHaveBeenCalledTimes(1);
 });
 it("does not resubmit an uncertain request with no provider ID",async()=>{
  prior={status:"RUNNING"};await expect(prepareCleanEnvironmentDepth("run")).rejects.toThrow("ALREADY_ATTEMPTED");expect(m.submit).not.toHaveBeenCalled();
 });
 it("keeps photo/material-only modes on their existing routes without extra paid work",async()=>{
  m.context.mockResolvedValue({run:{input:{background:{mode:"photo"}}}});expect(await prepareCleanEnvironmentDepth("run")).toBeNull();expect(m.submit).not.toHaveBeenCalled();expect(m.read).not.toHaveBeenCalled();
 });
});
