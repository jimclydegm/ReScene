import "server-only";
import sharp from "sharp";
import {createHash} from "node:crypto";
import {getDb} from "@/lib/db";
import {readLimited} from "@/lib/storage/r2";
import {analyzeEnvironment,cleanEnvironment} from "@/lib/ai/environment";
import {generateMaterial} from "@/lib/ai/background";
import {getSam3dClient} from "@/lib/ai/sam3d";
import {environmentObservationSchema} from "@/lib/scene/environment-plan";
import {compositionSchema,modelPlacementSchema,manualBackgroundComposition} from "@/lib/scene/composition";
import {buildEnvironmentGeometry} from "@/lib/scene/environment-geometry";
import {chooseEnvironmentDepth,usableEnvironment} from "@/lib/scene/environment-selection";
import {backgroundFootprint} from "@/lib/appearance/background";
import {decodeEnvironmentDepth} from "@/lib/appearance/environment-depth";
import {alignCleanDepth} from "@/lib/appearance/clean-depth";
import {materialTargets,rectifyMaterial,prepareSurfaceTile,packEnvironmentAtlas} from "@/lib/appearance/environment-atlas";
import {materialEvidence,materialPatchSchema,tileFromEvidence} from "@/lib/appearance/material-evidence";
import {analyzeSourceMaterials,inspectEnvironmentMaterial} from "@/lib/ai/environment-materials";
import {environmentContext,planSceneEnvironment,depthStep,saveEnvironmentAsset} from "./background-environment";
import {record,sceneEnvironment} from "./composition";
import type {Prisma} from "@/generated/prisma/client";
const json=(v:unknown)=>JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
export async function environmentPhotos(runId:string){
 const context=await environmentContext(runId),{scene,photo}=context,source=await readLimited(photo.storageKey,4*1024*1024),objects=await getDb().sceneObject.findMany({where:{sceneId:scene.id,maskAssetId:{not:null}},include:{mask:true}}),ready=objects.filter(o=>o.mask?.status==="READY");
 const masks=await Promise.all(ready.map(async o=>{const raw=await sharp(await readLimited(o.mask!.storageKey,4*1024*1024)).greyscale().raw().toBuffer({resolveWithObject:true});if(raw.info.width!==photo.width||raw.info.height!==photo.height)throw new Error("BACKGROUND_MASK_SIZE");return raw.data;}));
 return {...context,source,masks,objects:ready};
}
/** Each paid operation is reserved before submission and independently reusable. */
export async function prepareEnvironmentPlate(runId:string){
 const db=getDb(),c=await environmentPhotos(runId),initialPlan=await planSceneEnvironment(runId),raw=await sharp(c.source).removeAlpha().raw().toBuffer({resolveWithObject:true}),footprint=await backgroundFootprint({data:raw.data,width:raw.info.width,height:raw.info.height},c.masks);
 let step=await db.generationStep.findUnique({where:{runId_key_attempt:{runId,key:"environment-albedo",attempt:1}},include:{response:true}});
 if(!step){
  await db.generationRun.update({where:{id:runId},data:{currentStage:"Removing foreground before environment reconstruction",progress:94}});
  const started=await db.generationStep.create({data:{runId,key:"environment-albedo",attempt:1,provider:"META",modelId:process.env.META_IMAGE_MODEL??"muse-image-1.0",status:"RUNNING",startedAt:new Date()}});
  const output=await cleanEnvironment(c.source,footprint.guide,initialPlan,raw.info),id=await saveEnvironmentAsset(runId,"PROVIDER_RESPONSE",output,"image/png","empty-plate");
  step=await db.generationStep.update({where:{id:started.id},data:{status:"SUCCEEDED",responseAssetId:id,imageCount:1,completedAt:new Date()},include:{response:true}});
 }
 if(step.status!=="SUCCEEDED"||!step.response)throw new Error("ENVIRONMENT_IMAGE_ALREADY_ATTEMPTED");
 const plate=await readLimited(step.response.storageKey,24*1024*1024),meta=await sharp(plate,{limitInputPixels:10_000_000}).metadata();
 if(!meta.width||!meta.height||Math.abs(meta.width/meta.height/(c.photo.width!/c.photo.height!)-1)>.03)throw new Error("ENVIRONMENT_TEXTURE_FRAME");
 let analysis=await db.generationStep.findUnique({where:{runId_key_attempt:{runId,key:"environment-clean-analysis",attempt:1}}});
 if(!analysis){
  const started=await db.generationStep.create({data:{runId,key:"environment-clean-analysis",attempt:1,provider:"META",modelId:process.env.META_ANALYSIS_MODEL??"muse-spark-1.3",status:"RUNNING",startedAt:new Date()}});
  const result=await analyzeEnvironment(await sharp(plate).webp({quality:95}).toBuffer(),c.source);analysis=await db.generationStep.update({where:{id:started.id},data:{status:"SUCCEEDED",output:json(result.analysis),providerRequestId:result.requestId,inputTokens:result.usage?.prompt_tokens,outputTokens:result.usage?.completion_tokens,completedAt:new Date()}});
 }
 if(analysis.status!=="SUCCEEDED")throw new Error("ENVIRONMENT_CLEAN_ANALYSIS_ALREADY_ATTEMPTED");
 let plan=environmentObservationSchema.parse(analysis.output);
 let material=await db.generationStep.findUnique({where:{runId_key_attempt:{runId,key:"environment-source-materials",attempt:1}}});
 if(!material){
  const patches=await materialEvidence(c.source,plan,c.masks),started=await db.generationStep.create({data:{runId,key:"environment-source-materials",attempt:1,provider:patches.length?"META":"INTERNAL",modelId:patches.length?process.env.META_ANALYSIS_MODEL??"muse-spark-1.3":null,status:"RUNNING",startedAt:new Date(),input:{photoId:c.photo.id,plateAssetId:step.response.id,patches}}});
  const result=patches.length?await analyzeSourceMaterials(c.source,plan,patches):{analysis:plan,requestId:null,usage:null};
  material=await db.generationStep.update({where:{id:started.id},data:{status:"SUCCEEDED",output:json(result.analysis),providerRequestId:result.requestId,inputTokens:result.usage?.prompt_tokens,outputTokens:result.usage?.completion_tokens,completedAt:new Date()}});
 }
 if(material.status!=="SUCCEEDED")throw new Error("ENVIRONMENT_MATERIAL_ANALYSIS_ALREADY_ATTEMPTED");
 const materialInput=record(material.input);if(materialInput.photoId!==c.photo.id||materialInput.plateAssetId!==step.response.id)throw new Error("ENVIRONMENT_MATERIAL_SOURCE_CHANGED");
 const materialPatches=materialPatchSchema.array().max(16).parse(materialInput.patches);plan=environmentObservationSchema.parse(material.output);
 return {...c,plate,plateAssetId:step.response.id,plan,materialPatches,footprint};
}
export async function prepareCleanEnvironmentDepth(runId:string):Promise<string|null>{
 const {run}=await environmentContext(runId),mode=record(record(run.input).background).mode;if(mode==="materials"||mode==="photo")return null;
 const original=await planSceneEnvironment(runId);if(original.topology!=="room"&&!(original.topology==="open"&&original.surfaces.some(s=>s.finish==="textured")))return null;
 const c=await prepareEnvironmentPlate(runId),db=getDb(),prior=await db.generationStep.findUnique({where:{runId_key_attempt:{runId,key:"environment-clean-depth",attempt:1}}});
 if(prior){if(prior.status==="SUCCEEDED")return null;if(prior.providerRequestId&&["RUNNING","WAITING"].includes(prior.status))return prior.providerRequestId;throw new Error("ENVIRONMENT_CLEAN_DEPTH_ALREADY_ATTEMPTED");}
 const step=await db.generationStep.create({data:{runId,key:"environment-clean-depth",attempt:1,provider:"FAL",modelId:"fal-ai/vggt-1b",status:"RUNNING",startedAt:new Date(),input:{plateAssetId:c.plateAssetId,photoId:c.photo.id,sceneRevision:c.scene.revision}}});
 const bytes=await sharp(c.plate).webp({quality:95}).toBuffer(),job=await getSam3dClient().client.queue.submit("fal-ai/vggt-1b",{input:{image_urls:[`data:image/webp;base64,${bytes.toString("base64")}`],export_prediction_data:true,export_depth_maps:false,export_point_cloud:false,array_encoding:"base64"},abortSignal:AbortSignal.timeout(60000)});
 await db.generationStep.update({where:{id:step.id},data:{providerRequestId:job.request_id,status:"WAITING"}});return job.request_id;
}
export async function referenceGeometryContext(runId:string){
 const c=await prepareEnvironmentPlate(runId),source=await depthStep(runId);if(!source?.response)throw new Error("ENVIRONMENT_DEPTH_REQUIRED");
 const original=decodeEnvironmentDepth(JSON.parse((await readLimited(source.response.storageKey,8*1024*1024)).toString())),step=await getDb().generationStep.findUnique({where:{runId_key_attempt:{runId,key:"environment-clean-depth",attempt:1}},include:{response:true}});
 let grid=original,clean=false,depthWarning:string|null=null;
 if(step?.status==="SUCCEEDED"&&step.response){
  if(record(step.input).plateAssetId!==c.plateAssetId)throw new Error("ENVIRONMENT_CLEAN_DEPTH_SOURCE_CHANGED");
  try{const prediction=decodeEnvironmentDepth(JSON.parse((await readLimited(step.response.storageKey,8*1024*1024)).toString()));grid=alignCleanDepth(original,prediction,c.masks,c.plan).grid;clean=true;}catch{depthWarning="Empty-background depth did not align with the original gauge; original shared depth was retained.";}
 }
 const parsed=compositionSchema.safeParse(c.scene.stage),fallback=parsed.success?null:await sceneEnvironment(c.scene),composition=parsed.success?parsed.data:manualBackgroundComposition({width:c.photo.width!,height:c.photo.height!},fallback!.environment,fallback!.environmentSource,0),anchors=c.objects.flatMap((o,i)=>{const p=modelPlacementSchema.safeParse(o.initialTransform);return p.success?[{mask:c.masks[i],position:[o.positionX,o.positionY,o.positionZ] as [number,number,number],size:p.data.size}]:[];});
 let sourceBuilt:ReturnType<typeof buildEnvironmentGeometry>|null=null;
 try{sourceBuilt=buildEnvironmentGeometry(c.plan,composition,original,c.masks,anchors,original);}catch{/* A usable clean candidate may still recover this environment. */}
 let cleanBuilt:ReturnType<typeof buildEnvironmentGeometry>|null=null;
 if(clean)try{cleanBuilt=buildEnvironmentGeometry(c.plan,composition,grid,[],anchors,original);}catch{depthWarning="Empty-background geometry could not be fitted; original shared depth was retained.";}
 const selected=chooseEnvironmentDepth(sourceBuilt,cleanBuilt),built=selected.built;
 clean=selected.source==="clean";
 if(depthWarning&&!usableEnvironment(built.report))built.report.warnings.push(depthWarning);
 for(const surface of built.geometry.surfaces){const observation=surface.materialIndex===undefined?null:c.plan.surfaces[surface.materialIndex],patch=c.materialPatches.find(p=>p.id===observation?.id);if(!observation||surface.role==="window"||surface.role==="opening")continue;if(surface.textured&&patch)surface.tile=tileFromEvidence(surface,patch,composition);if(observation.appearance==="microtexture"&&surface.tile)surface.relief=Math.min(.02,Math.min(Math.hypot(...surface.tile.u),Math.hypot(...surface.tile.v))*.002);}
 if(built.report.walls<c.plan.expectedWallCount||built.report.coverage<.8||built.report.projectionError>.08)throw new Error("ENVIRONMENT_STRUCTURE_INCOMPLETE");
 return {...c,composition,built,cleanDepth:clean,depthSelection:{source:selected.source,reason:depthWarning??"Compared visible coverage, observed walls and corner disagreement."}};
}
export async function environmentMaterialTargets(runId:string){
 const {run}=await environmentContext(runId),mode=record(record(run.input).background).mode;if(mode==="materials"||mode==="photo")return [];
 const plan=await planSceneEnvironment(runId);if(plan.topology!=="room"&&!(plan.topology==="open"&&plan.surfaces.some(s=>s.finish==="textured")))return [];
 const c=await referenceGeometryContext(runId);return materialTargets(c.built.geometry,c.plan).map(t=>t.index);
}
export async function buildEnvironmentSurfaceMaterial(runId:string,index:number){
 const c=await referenceGeometryContext(runId),target=materialTargets(c.built.geometry,c.plan).find(t=>t.index===index);if(!target)throw new Error("ENVIRONMENT_MATERIAL_TARGET");
 const db=getDb(),key=`environment-surface-${index}`,prior=await db.generationStep.findUnique({where:{runId_key_attempt:{runId,key,attempt:1}}});if(prior){if(prior.status==="SUCCEEDED")return;throw new Error("ENVIRONMENT_MATERIAL_ALREADY_ATTEMPTED");}
 const patch=c.materialPatches.find(p=>p.id===target.observation.id),swatch=await rectifyMaterial(patch?c.source:c.plate,target.surface,c.composition),step=await db.generationStep.create({data:{runId,key,attempt:1,provider:"META",modelId:process.env.META_IMAGE_MODEL??"muse-image-1.0",status:"RUNNING",startedAt:new Date(),input:{plateAssetId:c.plateAssetId,photoId:c.photo.id,evidence:patch?"original-source":"empty-plate",materialIndex:index,swatchHash:createHash("sha256").update(swatch).digest("hex")}}});
 await db.generationRun.update({where:{id:runId},data:{currentStage:`Generating ${target.observation.role} material`,progress:97}});
 const result=await generateMaterial({...target.observation,material:target.observation.material+(target.observation.appearance==="microtexture"?". Preserve the fine resolved surface relief only, subtle monochrome detail on a single base color. No mottled paint, large ridges, cracks, decorative pattern or lighting gradients.":". Preserve the reference grain/plank direction and feature spacing. Fine texture, no architectural borders or extra pattern motifs.")},swatch),id=await saveEnvironmentAsset(runId,"PROVIDER_RESPONSE",result.bytes,"image/png",key);
 await db.generationStep.update({where:{id:step.id},data:{status:"SUCCEEDED",responseAssetId:id,imageCount:1,completedAt:new Date()}});
}
export async function buildSurfaceAtlas(runId:string,c:Awaited<ReturnType<typeof referenceGeometryContext>>){
 const tiles=new Map<number,Buffer>(),db=getDb();
 for(const target of materialTargets(c.built.geometry,c.plan)){
  const index=target.index,step=await db.generationStep.findUnique({where:{runId_key_attempt:{runId,key:`environment-surface-${index}`,attempt:1}},include:{response:true}});if(step?.status!=="SUCCEEDED"||!step.response)throw new Error("ENVIRONMENT_MATERIAL_REQUIRED");
  const tile=await prepareSurfaceTile(await readLimited(step.response.storageKey,24*1024*1024),target.observation.appearance==="microtexture"),key=`environment-surface-check-${index}`;let check=await db.generationStep.findUnique({where:{runId_key_attempt:{runId,key,attempt:1}}});
  const patch=c.materialPatches.find(p=>p.id===target.observation.id),evidence=await rectifyMaterial(patch?c.source:c.plate,target.surface,c.composition);
  if(!check){const started=await db.generationStep.create({data:{runId,key,attempt:1,provider:"META",modelId:process.env.META_ANALYSIS_MODEL??"muse-spark-1.3",status:"RUNNING",startedAt:new Date()}});const result=await inspectEnvironmentMaterial(tile,evidence,target.observation);check=await db.generationStep.update({where:{id:started.id},data:{status:"SUCCEEDED",output:result,completedAt:new Date()}});}
  if(check.status!=="SUCCEEDED")throw new Error("ENVIRONMENT_MATERIAL_CHECK_ALREADY_ATTEMPTED");
  if(record(check.output).clean===true&&record(check.output).faithful!==false)tiles.set(index,tile);
  else if(patch){tiles.set(index,await prepareSurfaceTile(evidence,target.observation.appearance==="microtexture"));c.built.report.warnings.push(`${target.observation.role}: generated material failed review; cleaned original-source detail retained. ${String(record(check.output).reason??"")}`.slice(0,350));}
  else c.built.report.warnings.push(`${target.observation.role}: generated material failed review and no unobscured source patch was available; solid fallback needs inspection.`);
 }
 // Preserve visible window frames/exterior from the source, never repeat them.
 const {environmentAlbedo}=await import("@/lib/appearance/environment-albedo");
 const windowPlate=await environmentAlbedo(c.source,c.plate,c.footprint.mask,{...c.plan,surfaces:c.plan.surfaces.map(s=>({...s,appearance:"pattern" as const}))},{preserveResolution:true,delight:false});
 return packEnvironmentAtlas(windowPlate,c.built.geometry,tiles);
}
