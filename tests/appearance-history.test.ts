import {describe,it,expect,vi,beforeEach} from "vitest";
const m=vi.hoisted(()=>({db:{scene:{findUniqueOrThrow:vi.fn(),findFirst:vi.fn(),update:vi.fn(),updateMany:vi.fn()},sceneObject:{findMany:vi.fn(),update:vi.fn()},asset:{findMany:vi.fn()},generationRun:{count:vi.fn()},$executeRaw:vi.fn(),$transaction:vi.fn()}}));
vi.mock("server-only",()=>({}));vi.mock("@/lib/db",()=>({getDb:()=>m.db}));
import {captureAppearance,recordAppearance,moveAppearanceHistory,appearanceFingerprint,appearanceHistorySummary} from "../src/lib/services/appearance-history";
let scene:any,objects:any[]; // eslint-disable-line @typescript-eslint/no-explicit-any
beforeEach(()=>{vi.resetAllMocks();scene={id:"scene",ownerId:"owner",revision:1,status:"READY",normalizedAssetId:"photo",stage:{camera:{x:1}},settings:{lighting:{ambient:1}}};objects=[{id:"object",modelAssetId:"original",maskAssetId:null,initialTransform:{},positionX:0}];m.db.scene.findUniqueOrThrow.mockImplementation(async()=>structuredClone(scene));m.db.scene.findFirst.mockImplementation(async({where})=>where.ownerId===scene.ownerId&&where.revision===scene.revision?structuredClone(scene):null);m.db.sceneObject.findMany.mockImplementation(async()=>structuredClone(objects));m.db.scene.update.mockImplementation(async({data})=>{scene={...scene,...data};});m.db.scene.updateMany.mockImplementation(async({data})=>{const {revision,...rest}=data;scene={...scene,...rest,revision:scene.revision+(revision?.increment??0)};return {count:1};});m.db.sceneObject.update.mockImplementation(async({where,data})=>{objects=objects.map(o=>o.id===where.id?{...o,...data}:o);});m.db.asset.findMany.mockImplementation(async({where})=>where.id.in.map((id:string)=>({id})));m.db.generationRun.count.mockResolvedValue(0);m.db.$transaction.mockImplementation(async f=>f(m.db));});
describe("Saved texture history",()=>{
 it("ignores JSONB key order, restores both directions and preserves lighting",async()=>{
  const before=await captureAppearance(m.db as never,"scene");objects[0].modelAssetId="generated";scene.settings.quality={version:"new"};await recordAppearance(m.db as never,"scene",before,"Generate textures");expect(appearanceHistorySummary(scene.settings).undo).toBe("Generate textures");
  expect(appearanceFingerprint({b:1,a:[{y:2,x:1}]})).toBe(appearanceFingerprint({a:[{x:1,y:2}],b:1}));
  // Database JSONB reorders the stored snapshot's keys.
  scene.settings=JSON.parse(JSON.stringify(scene.settings));scene.settings.lighting={ambient:2};scene.settings.environmentObservation={newAnalysis:true};scene.settings.activeBackgroundId="registered-original";scene.settings.appearanceHistory.undo[0].after.settings.environmentObservation={oldAnalysis:true};
  await moveAppearanceHistory("scene","owner",1,"UNDO");expect(objects[0].modelAssetId).toBe("original");expect(scene.settings.lighting.ambient).toBe(2);expect(appearanceHistorySummary(scene.settings).redo).toBe("Generate textures");
  await moveAppearanceHistory("scene","owner",2,"REDO");expect(objects[0].modelAssetId).toBe("generated");
 });
 it("blocks stale revisions, active runs, changed layouts and missing assets without writes",async()=>{
  const before=await captureAppearance(m.db as never,"scene");objects[0].modelAssetId="generated";await recordAppearance(m.db as never,"scene",before,"Textures");m.db.scene.updateMany.mockClear();
  await expect(moveAppearanceHistory("scene","other",1,"UNDO")).rejects.toThrow("Reload");m.db.generationRun.count.mockResolvedValue(1);await expect(moveAppearanceHistory("scene","owner",1,"UNDO")).rejects.toThrow("generation");m.db.generationRun.count.mockResolvedValue(0);
  objects[0].positionX=1;await expect(moveAppearanceHistory("scene","owner",1,"UNDO")).rejects.toThrow("layout");objects[0].positionX=0;m.db.asset.findMany.mockResolvedValue([]);await expect(moveAppearanceHistory("scene","owner",1,"UNDO")).rejects.toThrow("unavailable");expect(m.db.scene.updateMany).not.toHaveBeenCalled();
 });
 it("coalesces the final AI review into the same undo and branches after a new edit",async()=>{
  let before=await captureAppearance(m.db as never,"scene");objects[0].modelAssetId="v1";await recordAppearance(m.db as never,"scene",before,"Materials");before=await captureAppearance(m.db as never,"scene");scene.settings.quality={review:"pass"};await recordAppearance(m.db as never,"scene",before,"Review",true);expect(scene.settings.appearanceHistory.undo).toHaveLength(1);
  await moveAppearanceHistory("scene","owner",1,"UNDO");before=await captureAppearance(m.db as never,"scene");objects[0].modelAssetId="v2";await recordAppearance(m.db as never,"scene",before,"New materials");expect(appearanceHistorySummary(scene.settings).redo).toBeNull();
 });
});
