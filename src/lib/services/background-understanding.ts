import "server-only";
import {getDb} from "@/lib/db";
import {readLimited} from "@/lib/storage/r2";
import {understandSurfaces} from "@/lib/ai/background";
import {backgroundUnderstandingSchema,materialBackgroundPlan} from "@/lib/scene/background-understanding";
import {record} from "./composition";
import type {Prisma} from "@/generated/prisma/client";
const json=(v:unknown)=>JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
export async function understandSceneBackground(runId:string){
 const db=getDb(),run=await db.generationRun.findUniqueOrThrow({where:{id:runId},include:{scene:{include:{normalizedAsset:true}}}}),scene=run.scene;
 if(run.kind==="IMAGE_EDIT"&&scene.revision!==run.inputRevision)throw new Error("BACKGROUND_REVISION_CHANGED");
 if(!["RUNNING","WAITING"].includes(run.status)||scene.archivedAt||run.expiresAt<new Date()||!scene.normalizedAsset||record(run.input).normalizedAssetId!==scene.normalizedAssetId)throw new Error("BACKGROUND_RUN_STALE");
 const settings=record(scene.settings),saved=record(settings.backgroundUnderstanding),cached=backgroundUnderstandingSchema.safeParse(saved.analysis);
 if(cached.success&&saved.photoId===scene.normalizedAssetId)return cached.data;
 await db.generationRun.update({where:{id:runId},data:{currentStage:"Separating surface structure from light and shadow"}});
 const step=await db.generationStep.create({data:{runId,key:"background-understanding",attempt:1,provider:"META",modelId:process.env.META_ANALYSIS_MODEL??"muse-spark-1.3",status:"RUNNING",startedAt:new Date()}});
 const photo=await readLimited(scene.normalizedAsset.storageKey,4*1024*1024),result=await understandSurfaces(`data:image/webp;base64,${photo.toString("base64")}`),plan=materialBackgroundPlan(result.understanding);
 await db.$transaction(async tx=>{
  const current=await tx.generationRun.findFirst({where:{id:runId,status:{in:["RUNNING","WAITING"]}}});if(!current)throw new Error("BACKGROUND_RUN_STALE");
  const changed=await tx.scene.updateMany({where:{id:scene.id,revision:scene.revision,normalizedAssetId:scene.normalizedAssetId,archivedAt:null},data:{settings:json({...settings,backgroundUnderstanding:{version:"surface-understanding-v2",photoId:scene.normalizedAssetId,analysis:result.understanding},backgroundPlan:plan})}});
  if(!changed.count)throw new Error("BACKGROUND_REVISION_CHANGED");
  await tx.generationStep.update({where:{id:step.id},data:{status:"SUCCEEDED",providerRequestId:result.requestId,output:json(result.understanding),inputTokens:result.usage?.prompt_tokens,outputTokens:result.usage?.completion_tokens,completedAt:new Date()}});
 });
 return result.understanding;
}
