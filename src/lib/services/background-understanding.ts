import "server-only";
import {getDb} from "@/lib/db";
import {readLimited} from "@/lib/storage/r2";
import {understandSurfaces} from "@/lib/ai/background";
import {backgroundUnderstandingSchema} from "@/lib/scene/background-understanding";
import {environmentObservationSchema} from "@/lib/scene/environment-plan";
import {record} from "./composition";
import type {Prisma} from "@/generated/prisma/client";
const json=(v:unknown)=>JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
export async function understandSceneBackground(runId:string){
 const db=getDb(),run=await db.generationRun.findUniqueOrThrow({where:{id:runId},include:{scene:{include:{normalizedAsset:true}}}}),scene=run.scene;
 if(run.kind==="IMAGE_EDIT"&&scene.revision!==run.inputRevision)throw new Error("BACKGROUND_REVISION_CHANGED");
 if(!["RUNNING","WAITING"].includes(run.status)||scene.archivedAt||run.expiresAt<new Date()||!scene.normalizedAsset||record(run.input).normalizedAssetId!==scene.normalizedAssetId)throw new Error("BACKGROUND_RUN_STALE");
 const settings=record(scene.settings),saved=record(settings.backgroundUnderstanding),cached=backgroundUnderstandingSchema.safeParse(saved.analysis);
 if(record(record(run.input).background).reanalyze!==true&&cached.success&&saved.photoId===scene.normalizedAssetId)return cached.data;
 const rich=record(settings.environmentObservation),observed=environmentObservationSchema.safeParse(rich.analysis);
 if(rich.photoId===scene.normalizedAssetId&&observed.success){
  const p=observed.data,ground=p.surfaces.find(s=>s.role==="floor"||s.role==="surface"),wall=p.surfaces.find(s=>s.role==="wall"),base=ground??wall??p.surfaces[0];
  const material=(s:typeof base|undefined)=>({visible:!!s,finish:s?.finish??base.finish,color:s?.color??base.color,material:s?.material??base.material,roughness:s?.roughness??base.roughness,patternScale:"medium" as const,swatch:null});
  return backgroundUnderstandingSchema.parse({version:"surface-understanding-v2",topology:p.topology==="room"?"planes":p.topology,groundVisible:!!ground,ground:material(ground),wall:material(wall),junction:null,lightingEffects:p.lightingEffects,explanation:p.explanation});
 }

 await db.generationRun.update({where:{id:runId},data:{currentStage:"Separating surface structure from light and shadow"}});
 const step=await db.generationStep.create({data:{runId,key:"background-understanding",attempt:1,provider:"META",modelId:process.env.META_ANALYSIS_MODEL??"muse-spark-1.3",status:"RUNNING",startedAt:new Date()}});
 const photo=await readLimited(scene.normalizedAsset.storageKey,4*1024*1024),result=await understandSurfaces(`data:image/webp;base64,${photo.toString("base64")}`);
 await db.$transaction(async tx=>{
  const current=await tx.generationRun.findFirst({where:{id:runId,status:{in:["RUNNING","WAITING"]}}});if(!current)throw new Error("BACKGROUND_RUN_STALE");
  const changed=await tx.scene.updateMany({where:{id:scene.id,revision:scene.revision,normalizedAssetId:scene.normalizedAssetId,archivedAt:null},data:{settings:json({...settings,backgroundUnderstanding:{version:"surface-understanding-v2",photoId:scene.normalizedAssetId,analysis:result.understanding}})}});
  if(!changed.count)throw new Error("BACKGROUND_REVISION_CHANGED");
  await tx.generationStep.update({where:{id:step.id},data:{status:"SUCCEEDED",providerRequestId:result.requestId,output:json(result.understanding),inputTokens:result.usage?.prompt_tokens,outputTokens:result.usage?.completion_tokens,completedAt:new Date()}});
 });
 return result.understanding;
}
