import { beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";

const mocks=vi.hoisted(()=>({
  db:{generationRun:{findUniqueOrThrow:vi.fn(),findFirst:vi.fn(),updateMany:vi.fn(),update:vi.fn()},generationStep:{count:vi.fn(),updateMany:vi.fn(),upsert:vi.fn(),findFirst:vi.fn(),create:vi.fn(),update:vi.fn()},sceneObject:{findMany:vi.fn()},scene:{updateMany:vi.fn()},asset:{create:vi.fn()},$transaction:vi.fn()},
  fill:vi.fn(),analyze:vi.fn(),read:vi.fn(),put:vi.fn(),plain:vi.fn(),composite:vi.fn()
}));
vi.mock("@/lib/services/appearance-history",()=>({captureAppearance:async()=>({}),recordAppearance:async()=>{}}));
vi.mock("server-only",()=>({}));
vi.mock("@/lib/services/background-understanding",()=>({understandSceneBackground:async()=>({topology:"distant"})}));
vi.mock("@/lib/db",()=>({getDb:()=>mocks.db}));
vi.mock("@/lib/ai/background",()=>({fillBackground:mocks.fill,analyzeBackground:mocks.analyze}));
vi.mock("@/lib/storage/r2",()=>({readLimited:mocks.read,putObject:mocks.put,bucket:()=>"private",storagePrefix:()=>"test"}));
vi.mock("@/lib/appearance/plain",()=>({plainBackground:mocks.plain}));
vi.mock("@/lib/appearance/background",()=>({backgroundFootprint:async()=>({guide:Buffer.from("guide"),mask:new Uint8Array(4096)}),compositeBackground:mocks.composite}));
import { finishSceneBackground } from "../src/lib/services/background";

const plan={kind:"seamless",groundVisible:true,boundary:null,description:"Continuous background"};
const stage={version:"sam3d-room-v1",camera:{position:[0,4,8],target:[0,1,0],fov:50,aspect:1},room:{centerX:0,centerZ:0,width:8,depth:8,height:4},environment:{floorColor:"#aaaaaa",wallColor:"#dddddd",floorMaterial:"plain",lightDirection:"diffuse",lightWarmth:"neutral",sideWall:"none"},environmentSource:"spark",projectionError:0,warnings:[]};
const run=(layout:unknown)=>({id:"run",kind:"RECONSTRUCT",status:"WAITING",inputRevision:1,input:{normalizedAssetId:"photo",background:{mode:"photo"}},expiresAt:new Date(Date.now()+60_000),scene:{id:"scene",revision:2,status:"READY",archivedAt:null,stage:layout,normalizedAssetId:"photo",normalizedAsset:{storageKey:"photo",width:64,height:64},settings:{backgroundPlan:plan,environment:stage.environment}}});

describe("Background failure preservation and diagnosis",()=>{
  beforeEach(async()=>{
    vi.resetAllMocks();mocks.db.generationRun.findUniqueOrThrow.mockResolvedValue(run(stage));
    mocks.db.generationStep.count.mockResolvedValue(0);mocks.db.generationStep.create.mockResolvedValue({id:"edit"});
    mocks.db.sceneObject.findMany.mockResolvedValue([{id:"object",positionY:0,provenance:{surfaceRole:"object",replacementBackup:{modelAssetId:"original"}},mask:{sceneId:"scene",kind:"MASK",status:"READY",storageKey:"mask"}}]);
    const photo=await sharp({create:{width:64,height:64,channels:3,background:"#aabbcc"}}).webp().toBuffer();
    const mask=await sharp({create:{width:64,height:64,channels:3,background:"white"}}).greyscale().png().toBuffer();
    mocks.read.mockImplementation(async(key:string)=>key==="photo"?photo:mask);mocks.plain.mockReturnValue(null);
  });
  it("recovers a missing background frame while preserving all object and replacement edits",async()=>{
    mocks.db.generationRun.findUniqueOrThrow.mockResolvedValue(run({}));
    mocks.db.generationRun.findFirst.mockResolvedValue({id:"run"});mocks.db.scene.updateMany.mockResolvedValue({count:1});
    mocks.db.$transaction.mockImplementation(async(action:(db:unknown)=>unknown)=>action(mocks.db));mocks.plain.mockReturnValue({color:"#aabbcc"});
    await finishSceneBackground("run");
    expect(mocks.analyze).not.toHaveBeenCalled();expect(mocks.fill).not.toHaveBeenCalled();
    const saved=mocks.db.scene.updateMany.mock.calls[0][0];
    expect(saved.data.stage.camera.position).toEqual([5,4,7]);expect(saved.data.stage.background.plainColor).toBe("#aabbcc");
    expect(saved.data.objects).toBeUndefined();expect(saved.data.stage.layoutSource).toBe("manual-stage");expect(saved.data.stage.warnings.join(" ")).toContain("manual-stage camera");
    expect(mocks.db.generationRun.updateMany).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({status:"SUCCEEDED"})}));
  });
  it("retains a local preflight failure without implying a provider submission",async()=>{
    mocks.db.sceneObject.findMany.mockResolvedValue([]);
    await finishSceneBackground("run");
    expect(mocks.fill).not.toHaveBeenCalled();expect(mocks.read).not.toHaveBeenCalled();
    expect(mocks.db.scene.updateMany).not.toHaveBeenCalled();
    expect(mocks.db.generationStep.upsert).toHaveBeenCalledWith(expect.objectContaining({create:expect.objectContaining({provider:"INTERNAL",errorMessage:"BACKGROUND_MASKS_REQUIRED"})}));
  });
  it("records a rejected provider request without retrying or changing the saved background",async()=>{
    mocks.db.generationStep.count.mockResolvedValue(1);
    mocks.fill.mockRejectedValue(Object.assign(new Error("Unsupported image request"),{status:400}));
    await finishSceneBackground("run");
    expect(mocks.fill).toHaveBeenCalledTimes(1);expect(mocks.put).not.toHaveBeenCalled();expect(mocks.db.scene.updateMany).not.toHaveBeenCalled();
    expect(mocks.db.generationStep.updateMany).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({OR:expect.arrayContaining([{key:{startsWith:"background-"}}])}),data:expect.objectContaining({status:"FAILED",errorCode:"META_HTTP_400"})}));
    expect(mocks.db.generationStep.upsert).not.toHaveBeenCalled();
  });
  it("keeps completed image inference completed when local processing fails, without resubmission",async()=>{
    mocks.fill.mockResolvedValue({bytes:Buffer.from("image"),model:"muse-image-1.0"});mocks.composite.mockRejectedValue(new Error("BACKGROUND_FRAME_CHANGED"));
    await finishSceneBackground("run");
    expect(mocks.fill).toHaveBeenCalledTimes(1);expect(mocks.db.scene.updateMany).not.toHaveBeenCalled();
    expect(mocks.db.generationStep.update).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({status:"SUCCEEDED",imageCount:1})}));
    expect(mocks.db.generationStep.upsert).toHaveBeenCalledWith(expect.objectContaining({create:expect.objectContaining({provider:"INTERNAL",errorMessage:"BACKGROUND_FRAME_CHANGED"})}));
    expect(mocks.db.generationRun.updateMany).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({errorCode:"BACKGROUND_UNAVAILABLE"})}));
  });
});
