import "server-only";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { AppError } from "@/lib/http";
import { record } from "./composition";
import type { Prisma, SceneStatus } from "@/generated/prisma/client";
export const projectActionSchema=z.object({action:z.enum(["ARCHIVE","DELETE","RESTORE"]),expectedRevision:z.number().int().nonnegative(),confirmed:z.literal(true)}).strict();
export async function manageProject(sceneId:string,ownerId:string,input:z.infer<typeof projectActionSchema>){
 if(!z.uuid().safeParse(sceneId).success)throw new AppError(404,"NOT_FOUND","Project not found.");
 const db=getDb();return db.$transaction(async tx=>{
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(839172640)`;
  const scene=await tx.scene.findFirst({where:{id:sceneId,ownerId}});if(!scene)throw new AppError(404,"NOT_FOUND","Project not found.");
  if(scene.revision!==input.expectedRevision)throw new AppError(409,"REVISION_CONFLICT","The project changed. Reload before continuing.");
  const settings=record(scene.settings),archive=record(settings.archive);
  if(input.action!=="RESTORE"){
   if(scene.archivedAt)throw new AppError(409,"ALREADY_ARCHIVED","This project is already archived.");
   if(["ANALYZING","RECONSTRUCTING"].includes(scene.status)||await tx.generationRun.count({where:{sceneId,status:{in:["QUEUED","RUNNING","WAITING","CANCEL_REQUESTED"]}}}))throw new AppError(409,"SCENE_BUSY","Wait for generation to finish before moving the project to Trash.");
   const changed=await tx.scene.updateMany({where:{id:sceneId,ownerId,revision:input.expectedRevision,archivedAt:null},data:{archivedAt:new Date(),status:"ARCHIVED",revision:{increment:1},settings:JSON.parse(JSON.stringify({...settings,archive:{previousStatus:scene.status}})) as Prisma.InputJsonValue}});
   if(!changed.count)throw new AppError(409,"REVISION_CONFLICT","The project changed. Reload before continuing.");
   await tx.scenePublication.updateMany({where:{sceneId,revokedAt:null},data:{revokedAt:new Date()}});
  }else{
   if(!scene.archivedAt)throw new AppError(409,"NOT_ARCHIVED","This project is already active.");
   const status=(["DRAFT","REVIEW","READY","FAILED"].includes(String(archive.previousStatus))?archive.previousStatus:["DRAFT","REVIEW","READY","FAILED"].includes(scene.status)?scene.status:scene.normalizedAssetId?"REVIEW":"DRAFT") as SceneStatus;
   const {archive:old,...rest}=settings;void old;
   const changed=await tx.scene.updateMany({where:{id:sceneId,ownerId,revision:input.expectedRevision,archivedAt:{not:null}},data:{archivedAt:null,status,revision:{increment:1},settings:JSON.parse(JSON.stringify(rest)) as Prisma.InputJsonValue}});
   if(!changed.count)throw new AppError(409,"REVISION_CONFLICT","The project changed. Reload before continuing.");
  }
  if(input.action==="RESTORE")await tx.scenePublication.updateMany({where:{sceneId,revokedAt:null},data:{revokedAt:new Date()}});
  return {saved:true,revision:scene.revision+1};
 },{timeout:20000});
}
