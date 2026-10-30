import "server-only";
import {createHash,randomUUID} from "node:crypto";
import type {Prisma} from "@/generated/prisma/client";
import {getDb} from "@/lib/db";
import {readLimited,putObject,bucket,storagePrefix} from "@/lib/storage/r2";
import {generateMaterial,inspectMaterialTile,materialPrompt} from "@/lib/ai/background";
import {materialSwatch,prepareMaterialTile} from "@/lib/appearance/material-swatch";
import {materialBackgroundPlan,type BackgroundUnderstanding} from "@/lib/scene/background-understanding";
import {compositionSchema,manualBackgroundComposition} from "@/lib/scene/composition";
import {record,sceneEnvironment} from "./composition";
const json=(v:unknown)=>JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
export async function buildMaterialBackground(runId:string,understanding:BackgroundUnderstanding){
 const db=getDb(),run=await db.generationRun.findUniqueOrThrow({where:{id:runId},include:{scene:{include:{normalizedAsset:true}}}}),scene=run.scene;
 if(!["RUNNING","WAITING"].includes(run.status)||scene.status!=="READY"||scene.archivedAt||!scene.normalizedAsset||scene.normalizedAssetId!==record(run.input).normalizedAssetId||run.expiresAt<new Date()||run.kind==="IMAGE_EDIT"&&scene.revision!==run.inputRevision)throw new Error("BACKGROUND_RUN_STALE");
 const saved=compositionSchema.safeParse(scene.stage),environment=saved.success?null:await sceneEnvironment(scene),composition=saved.success?saved.data:manualBackgroundComposition({width:scene.normalizedAsset.width!,height:scene.normalizedAsset.height!},environment!.environment,environment!.environmentSource,0);
 const size={width:scene.normalizedAsset.width!,height:scene.normalizedAsset.height!},photo=await readLimited(scene.normalizedAsset.storageKey,4*1024*1024),objects=await db.sceneObject.findMany({where:{sceneId:scene.id,maskAssetId:{not:null}},include:{mask:true}});
 const sharp=(await import("sharp")).default;
 const masks=await Promise.all(objects.filter(o=>o.mask?.status==="READY").map(async o=>{const raw=await sharp(await readLimited(o.mask!.storageKey,4*1024*1024)).greyscale().raw().toBuffer({resolveWithObject:true});if(raw.info.width!==size.width||raw.info.height!==size.height)throw new Error("BACKGROUND_MASK_SIZE");return raw.data;}));
 const plan=materialBackgroundPlan(understanding),ids:{ground:string|null;wall:string|null}={ground:null,wall:null},warnings:string[]=[];
 async function asset(bytes:Buffer,kind:"SURFACE_TEXTURE"|"PROVIDER_RESPONSE",part:string,derivedFromId?:string){const id=randomUUID(),key=`${storagePrefix()}/scenes/${scene.id}/background-materials/${id}`;await putObject(key,bytes,kind==="SURFACE_TEXTURE"?"image/webp":"image/png");await db.asset.create({data:{id,sceneId:scene.id,kind,status:"READY",bucket:bucket(),storageKey:key,mimeType:kind==="SURFACE_TEXTURE"?"image/webp":"image/png",byteSize:bytes.length,sha256:createHash("sha256").update(bytes).digest("hex"),readyAt:new Date(),derivedFromId,provenance:{source:"material-background-v2",runId,part,photoId:scene.normalizedAssetId,...(kind==="SURFACE_TEXTURE"?{width:1024,height:1024,illuminationRemoved:true}:{})}}});return id;}
 for(const part of ["ground","wall"] as const){
  if(part==="wall"&&understanding.topology==="cyclorama")continue;
  const surface=understanding.topology==="cyclorama"?(understanding.wall.visible?understanding.wall:understanding.ground):understanding[part];if(!surface.visible||surface.finish==="plain")continue;
  if(part==="wall"&&understanding.topology==="cyclorama"&&ids.ground){ids.wall=ids.ground;continue;}
  await db.generationRun.update({where:{id:runId},data:{currentStage:`Creating clean ${part} material`,progress:95}});
  const swatch=await materialSwatch(photo,surface,masks,size),step=await db.generationStep.create({data:{runId,key:`background-material-${part}`,attempt:1,provider:"META",modelId:process.env.META_IMAGE_MODEL??"muse-image-1.0",status:"RUNNING",startedAt:new Date(),input:json({prompt:materialPrompt(surface),part,swatch:swatch?surface.swatch:null,fullPhotoSent:false})}});
  const generated=await generateMaterial(surface,swatch),rawId=await asset(generated.bytes,"PROVIDER_RESPONSE",part);
  await db.generationStep.update({where:{id:step.id},data:{status:"SUCCEEDED",imageCount:1,costUsd:.01,responseAssetId:rawId,completedAt:new Date()}});
  const tile=await prepareMaterialTile(generated.bytes),check=await db.generationStep.create({data:{runId,key:`background-material-check-${part}`,attempt:1,provider:"META",modelId:process.env.META_ANALYSIS_MODEL??"muse-spark-1.3",status:"RUNNING",startedAt:new Date()}});
  try{const result=await inspectMaterialTile(tile);await db.generationStep.update({where:{id:check.id},data:{status:"SUCCEEDED",output:result,completedAt:new Date()}});if(result.clean)ids[part]=await asset(tile,"SURFACE_TEXTURE",part,rawId);else warnings.push(`${part}: clean solid material used because the generated texture retained lighting or scene content.`);}
  catch{await db.generationStep.update({where:{id:check.id},data:{status:"FAILED",errorCode:"MATERIAL_CHECK_UNAVAILABLE",completedAt:new Date()}});warnings.push(`${part}: solid material used because texture review was unavailable.`);}
 }
 if(understanding.topology==="cyclorama"){plan.materials!.wall=plan.materials!.ground;ids.wall=ids.ground;}
 const settings=record(scene.settings);
 await db.$transaction(async tx=>{
  if(!await tx.generationRun.findFirst({where:{id:runId,status:{in:["RUNNING","WAITING"]}}}))throw new Error("BACKGROUND_RUN_STALE");
  const changed=await tx.scene.updateMany({where:{id:scene.id,revision:scene.revision,archivedAt:null,status:"READY"},data:{stage:json({...composition,background:plan}),...(!saved.success?{camera:json(composition.camera)}:{}),settings:json({...settings,backgroundBackup:{background:settings.background??null,backgroundPlan:composition.background??null},backgroundPlan:plan,background:{version:"material-background-v2",photoId:scene.normalizedAssetId,floorId:ids.ground,wallId:ids.wall,warnings}}),revision:{increment:1}}});if(!changed.count)throw new Error("BACKGROUND_REVISION_CHANGED");
  if(warnings.length)await tx.generationRun.update({where:{id:runId},data:{errorMessage:"Background rebuilt with clean solid fallbacks where generated texture could not be validated. Your objects are unchanged."}});
 });
}
