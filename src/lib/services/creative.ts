import {reviewCreative,creativeReviewSchema,reviewIssues} from "@/lib/ai/creative-review";
import "server-only";
import {randomUUID,createHash} from "node:crypto";
import sharp from "sharp";
import {getDb} from "@/lib/db";
import {AppError} from "@/lib/http";
import {ownedScene} from "./scenes";
import {record} from "./composition";
import {bucket,storagePrefix,signRead,signUpload,readLimited,putObject} from "@/lib/storage/r2";
import {getMetaClient} from "@/lib/ai/meta";
import {creativeInput,creativeDraftInput,creativePrompt,aspects} from "@/lib/ai/creative-contract";
import {readFile} from "node:fs/promises";
import {join} from "node:path";
import {sampleImagePath,settingImagePath} from "@/lib/ai/sample-products";
import type {Prisma} from "@/generated/prisma/client";
const json=(v:unknown)=>JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
const active=["QUEUED","RUNNING","WAITING"] as const;
async function workspace(id:string,ownerId:string){const s=await ownedScene(id,ownerId);if(s.status!=="DRAFT"||record(s.settings).creative!==true)throw new AppError(409,"CREATIVE_WORKSPACE","Choose a creative workspace.");return s;}
async function saveImage(sceneId:string,bytes:Buffer,kind:"PRODUCT_IMAGE"|"SOURCE_IMAGE"|"NORMALIZED_IMAGE",provenance:Prisma.InputJsonValue){
 const out=await sharp(bytes,{limitInputPixels:24_000_000,animated:false}).rotate().resize({width:1600,height:1600,fit:"inside",withoutEnlargement:true}).webp({quality:92}).toBuffer({resolveWithObject:true});
 if(out.data.length>4*1024*1024)throw new AppError(413,"IMAGE_TOO_LARGE","Use a smaller image.");
 const id=randomUUID(),key=`${storagePrefix()}/scenes/${sceneId}/creative/${id}.webp`;await putObject(key,out.data,"image/webp");
 return getDb().asset.create({data:{id,sceneId,kind,status:"READY",bucket:bucket(),storageKey:key,mimeType:"image/webp",byteSize:out.data.length,width:out.info.width,height:out.info.height,sha256:createHash("sha256").update(out.data).digest("hex"),readyAt:new Date(),provenance}});
}
const visibility=(ownerId:string)=>({archivedAt:null,OR:[{ownerId,asset:{status:"READY" as const,scene:{ownerId,archivedAt:null}}},{ownerId:null,kind:"SAMPLE"}]});
export async function creativeLibrary(ownerId:string,sceneId?:string,page=0,trash=false){
 const db=getDb();if(sceneId)await workspace(sceneId,ownerId);
 const [images,references,runs,draft]=await Promise.all([
 db.contentItem.findMany({where:{...visibility(ownerId),kind:"GENERATED",...(trash?{archivedAt:{not:null}}:{})},include:{asset:true,outputs:{include:{run:{select:{input:true}}},take:1}},orderBy:{createdAt:"desc"},skip:page*12,take:13}),
 db.contentItem.findMany({where:{...visibility(ownerId),kind:{in:trash?["REFERENCE"]:["REFERENCE","SAMPLE"]},...(trash?{archivedAt:{not:null}}:{})},include:{asset:true},orderBy:[{kind:"desc"},{createdAt:"desc"}],take:60}),
 sceneId?db.generationRun.findMany({where:{sceneId,kind:"COMPOSE_IMAGE"},orderBy:{createdAt:"desc"},take:8}):[],
 sceneId?db.compositionDraft.findUnique({where:{sceneId},include:{references:{include:{item:true},orderBy:{position:"asc"}}}}):null]);
 const view=async(a:typeof references[number] & {outputs?:{run:{input:unknown}}[]})=>({id:a.id,sceneId:a.asset?.sceneId??"",url:a.asset?await signRead(a.asset):a.publicPath!,label:a.title,category:a.category,sample:a.kind==="SAMPLE",width:a.asset?.width??null,height:a.asset?.height??null,createdAt:a.createdAt.toISOString(),recipe:creativeInput.safeParse(a.outputs?.[0]?.run.input).data??null,review:creativeReviewSchema.safeParse(record(a.provenance).qualityReview).success?{issues:reviewIssues(creativeReviewSchema.parse(record(a.provenance).qualityReview)),checked:true}:record(a.provenance).reviewUnavailable?{issues:["Automatic image review was unavailable. Check inventory, scale and framing before use."],checked:false}:null});
 return {images:await Promise.all(images.slice(0,12).map(view)),hasMore:images.length>12,references:await Promise.all(references.filter(r=>record(r.provenance).source!=="creative-template"&&record(r.provenance).generator!=="original-procedural-v1").map(view)),draft:draft?{revision:draft.revision,referenceIds:draft.references.filter(r=>!r.item.archivedAt).map(r=>r.contentItemId),prompt:draft.prompt,template:draft.templateKey,aspect:draft.aspectRatio,projectTitle:draft.projectTitle}:null,runs:runs.map(r=>({id:r.id,status:r.status,error:r.errorMessage,progress:r.progress,input:creativeInput.safeParse(r.input).data??null})),revision:sceneId?(await workspace(sceneId,ownerId)).revision:0};
}
async function persistDraft(tx:Prisma.TransactionClient,ownerId:string,input:ReturnType<typeof creativeDraftInput.parse>){
 const refs=await tx.contentItem.count({where:{...visibility(ownerId),id:{in:input.referenceIds}}});
 if(refs!==input.referenceIds.length)throw new AppError(404,"REFERENCE_UNAVAILABLE","Choose available library references.");
 const old=await tx.compositionDraft.findUnique({where:{sceneId:input.sceneId}});
 if(input.draftRevision!==undefined&&(old?.revision??0)!==input.draftRevision)throw new AppError(409,"DRAFT_CONFLICT","This draft changed in another tab. Reload to continue.");
 const d=await tx.compositionDraft.upsert({where:{sceneId:input.sceneId},create:{sceneId:input.sceneId,prompt:input.prompt,templateKey:input.template,aspectRatio:input.aspect,projectTitle:input.projectTitle??"My product scene",templateVersion:4,revision:1},update:{prompt:input.prompt,templateKey:input.template,aspectRatio:input.aspect,projectTitle:input.projectTitle??old?.projectTitle,templateVersion:4,revision:{increment:1}}});
 await tx.compositionReference.deleteMany({where:{draftId:d.id}});
 if(input.referenceIds.length)await tx.compositionReference.createMany({data:input.referenceIds.map((contentItemId,position)=>({draftId:d.id,contentItemId,position}))});
 return d;
}
export async function saveCreativeDraft(ownerId:string,raw:unknown){const input=creativeDraftInput.parse(raw);await workspace(input.sceneId,ownerId);return getDb().$transaction(async tx=>{await tx.$executeRaw`SELECT pg_advisory_xact_lock(839172640)`;if(await tx.generationRun.count({where:{sceneId:input.sceneId,status:{in:[...active]}}}))throw new AppError(409,"RUN_ACTIVE","Wait for generation to finish.");return persistDraft(tx,ownerId,input);});}
export async function createCreative(ownerId:string){
 if(await getDb().scene.count({where:{ownerId,archivedAt:null}})>=50)throw new AppError(429,"SCENE_LIMIT","Archive an old project before creating another.");
 return getDb().scene.create({data:{ownerId,title:"Product scene creator",settings:{creative:true}}});
}
export async function creativeUpload(ownerId:string,sceneId:string,type:string,bytes:number){
 await workspace(sceneId,ownerId);const db=getDb();if(await db.asset.count({where:{sceneId}})>=48)throw new AppError(429,"REFERENCE_LIMIT","Create another workspace for more uploads.");
 const id=randomUUID(),key=`${storagePrefix()}/staging/${sceneId}/${id}`;
 await db.asset.create({data:{id,sceneId,kind:"UPLOAD_STAGING",status:"PENDING",bucket:bucket(),storageKey:key,mimeType:type,byteSize:bytes,uploadExpiresAt:new Date(Date.now()+300000),provenance:{source:"creative-upload"}}});
 return {assetId:id,uploadUrl:await signUpload(key,type),headers:{"Content-Type":type}};
}
export async function completeCreativeUpload(ownerId:string,sceneId:string,id:string,label:string){
 await workspace(sceneId,ownerId);const db=getDb(),a=await db.asset.findFirst({where:{id,sceneId,kind:"UPLOAD_STAGING",status:"PENDING",uploadExpiresAt:{gt:new Date()},provenance:{path:["source"],equals:"creative-upload"}}});
 if(!a)throw new AppError(404,"UPLOAD_UNAVAILABLE","Upload expired or already accepted.");
 if(!(await db.asset.updateMany({where:{id,status:"PENDING"},data:{status:"VALIDATING"}})).count)throw new AppError(409,"UPLOAD_BUSY","Upload is being processed.");
 try{const bytes=await readLimited(a.storageKey,12*1024*1024),meta=await sharp(bytes,{limitInputPixels:24_000_000}).metadata();if(!["png","jpeg","webp"].includes(meta.format??"")||(meta.pages??1)>1)throw new AppError(400,"INVALID_IMAGE","Choose a still JPEG, PNG or WebP.");
 const result=await saveImage(sceneId,bytes,"PRODUCT_IMAGE",{source:"creative-reference",label});await db.contentItem.create({data:{id:result.id,ownerId,assetId:result.id,title:label,category:"Uncategorized",kind:"REFERENCE",provenance:{source:"merchant-upload"}}});await db.asset.update({where:{id},data:{status:"READY",byteSize:bytes.length,sha256:createHash("sha256").update(bytes).digest("hex"),readyAt:new Date(),uploadExpiresAt:null}});return result;
 }catch(e){await db.asset.update({where:{id},data:{status:"REJECTED"}});throw e;}
}
export async function creativeTemplates(ownerId:string,sceneId:string){await workspace(sceneId,ownerId);}
export async function reserveCreative(ownerId:string,raw:unknown){
 const input=creativeInput.parse(raw);if(process.env.GENERATION_ENABLED!=="true")throw new AppError(503,"GENERATION_DISABLED","Generation is disabled.");await workspace(input.sceneId,ownerId);
 return getDb().$transaction(async tx=>{
 await tx.$executeRaw`SELECT pg_advisory_xact_lock(839172640)`;
 const prior=await tx.generationRun.findUnique({where:{sceneId_idempotencyKey:{sceneId:input.sceneId,idempotencyKey:input.idempotencyKey}}});
 if(prior){if(prior.kind!=="COMPOSE_IMAGE"||JSON.stringify(creativeInput.parse(prior.input))!==JSON.stringify(input))throw new AppError(409,"IDEMPOTENCY_CONFLICT","This request key has different settings.");return prior;}
 const scene=await tx.scene.findFirst({where:{id:input.sceneId,ownerId,archivedAt:null,revision:input.expectedRevision,status:"DRAFT"}});if(!scene)throw new AppError(409,"REVISION_CONFLICT","Reload this workspace.");
 if(await tx.generationRun.count({where:{scene:{ownerId},status:{in:[...active]}}}))throw new AppError(409,"RUN_ACTIVE","Wait for your existing generation to finish.");
 if(input.refinementSourceId&&!await tx.contentItem.findFirst({where:{id:input.refinementSourceId,ownerId,kind:"GENERATED",archivedAt:null,asset:{status:"READY",scene:{ownerId,archivedAt:null}}}}))throw new AppError(404,"IMAGE_UNAVAILABLE","The correction source is unavailable.");
 const draft=await persistDraft(tx,ownerId,input);
 const run=await tx.generationRun.create({data:{sceneId:scene.id,kind:"COMPOSE_IMAGE",idempotencyKey:input.idempotencyKey,inputRevision:scene.revision,input:json(input),expiresAt:new Date(Date.now()+15*60000),reservedCostUsd:.01,currentStage:"Waiting for Muse Image"}});
 await tx.contentGeneration.create({data:{draftId:draft.id,runId:run.id,refinementSourceId:input.refinementSourceId,prompt:input.prompt,templateKey:input.template,aspectRatio:input.aspect,templateVersion:4,modelId:process.env.META_IMAGE_MODEL??"muse-image-1.0",references:{create:input.referenceIds.map((contentItemId,position)=>({contentItemId,position}))}}});return run;
 });
}
export async function composeCreative(runId:string){
 const db=getDb();let submitted=false;
 try{
 const r=await db.generationRun.findUniqueOrThrow({where:{id:runId},include:{scene:true}}),input=creativeInput.parse(r.input);
 if(r.kind!=="COMPOSE_IMAGE"||r.status!=="RUNNING"||r.scene.archivedAt||r.expiresAt<new Date()||r.scene.revision!==r.inputRevision)throw new Error("CREATIVE_RUN_STALE");
 const refs=await db.contentItem.findMany({where:{...visibility(r.scene.ownerId),id:{in:input.referenceIds}},include:{asset:true}});if(refs.length!==input.referenceIds.length)throw new Error("REFERENCE_UNAVAILABLE");
 const products=await Promise.all(input.referenceIds.map(async id=>{const item=refs.find(a=>a.id===id)!;let bytes:Buffer;if(item.asset)bytes=await readLimited(item.asset.storageKey,4*1024*1024);else{const key=item.sampleKey?.split(":")[0],path=sampleImagePath(key??"");if(!path)throw new Error("SAMPLE_INVALID");bytes=await readFile(join(process.cwd(),"public",path.slice(1)));}return {image_url:`data:image/webp;base64,${bytes.toString("base64")}`};}));
 const labels=input.referenceIds.map(id=>refs.find(a=>a.id===id)!.title);
 const setting=await readFile(join(process.cwd(),"public",settingImagePath(input.template).slice(1)));
 const images=[{image_url:`data:image/webp;base64,${setting.toString("base64")}`},...products];
 let correction:string|undefined;
 if(input.refinementSourceId){const previous=await db.contentItem.findFirst({where:{id:input.refinementSourceId,ownerId:r.scene.ownerId,kind:"GENERATED",archivedAt:null},include:{asset:true}});if(!previous?.asset)throw new Error("CORRECTION_UNAVAILABLE");const review=creativeReviewSchema.safeParse(record(previous.provenance).qualityReview);correction=review.success?(reviewIssues(review.data).join(" ")||"Check inventory, framing, relative scale, support and setting consistency; refine only visible problems."):"Check and correct inventory, framing, scale, support and setting consistency.";images.push({image_url:`data:image/webp;base64,${(await readLimited(previous.asset.storageKey,4*1024*1024)).toString("base64")}`});}
 const prompt=creativePrompt(input,labels,correction);
 await db.contentGeneration.update({where:{runId},data:{requestSnapshot:json({version:"composition-v4",prompt,reasoningStrength:"high",settingPath:settingImagePath(input.template),referenceIds:input.referenceIds,labels,refinementSourceId:input.refinementSourceId??null})}});
 await db.generationStep.create({data:{runId,key:"creative-image",attempt:1,provider:"META",modelId:"muse-image-1.0",status:"RUNNING",startedAt:new Date()}});
 await db.generationRun.update({where:{id:runId},data:{progress:30,currentStage:"Composing your products with Muse Image"}});submitted=true;
 const result=await getMetaClient().post<{data?:{b64_json?:string}[]}>("/images/edits",{maxRetries:0,timeout:180000,body:{model:process.env.META_IMAGE_MODEL??"muse-image-1.0",n:1,images,prompt,size:aspects[input.aspect],response_format:"b64_json",output_format:"png",reasoning_strength:"high",tool_enablement:{enable_image_search:false,enable_web_search:false,enable_shell:false}}});
 const b64=result.data?.[0]?.b64_json;if(!b64||b64.length>32*1024*1024)throw new Error("CREATIVE_IMAGE_INVALID");
 const asset=await saveImage(r.sceneId,Buffer.from(b64,"base64"),"SOURCE_IMAGE",{source:"muse-scene-composition",label:input.prompt.slice(0,80)||input.template,runId,model:"muse-image-1.0"});
 const item=await db.contentItem.create({data:{id:asset.id,ownerId:r.scene.ownerId,assetId:asset.id,title:input.projectTitle??(input.prompt.slice(0,80)||"Scene concept"),category:input.template,kind:"GENERATED",provenance:{model:"muse-image-1.0"}}});
 await db.contentGeneration.update({where:{runId},data:{outputItemId:item.id}});
 await db.generationStep.update({where:{runId_key_attempt:{runId,key:"creative-image",attempt:1}},data:{status:"SUCCEEDED",responseAssetId:asset.id,imageCount:1,completedAt:new Date()}});
 // Keep the completed image before optional review. Review failure cannot lose it or resubmit inference.
 await db.generationRun.update({where:{id:runId},data:{progress:85,currentStage:"Checking product count, scale and framing"}});
 let issues:string[]=[],reviewUnavailable=false;
 try{
  await db.generationStep.create({data:{runId,key:"creative-review",attempt:1,provider:"META",modelId:process.env.META_ANALYSIS_MODEL??"muse-spark-1.3",status:"RUNNING",startedAt:new Date()}});
  const checked=await reviewCreative(images.slice(0,products.length+1),`data:image/webp;base64,${(await readLimited(asset.storageKey,4*1024*1024)).toString("base64")}`,labels);issues=reviewIssues(checked.review);
  await db.contentGeneration.update({where:{runId},data:{qualityReview:json(checked.review)}});
  await db.contentItem.update({where:{id:item.id},data:{provenance:json({model:"muse-image-1.0",qualityReview:checked.review})}});
  await db.generationStep.updateMany({where:{runId,key:"creative-review"},data:{status:"SUCCEEDED",output:json(checked.review),inputTokens:checked.usage?.prompt_tokens,outputTokens:checked.usage?.completion_tokens,completedAt:new Date()}});
 }catch(error){reviewUnavailable=true;await db.contentItem.update({where:{id:item.id},data:{provenance:{model:"muse-image-1.0",reviewUnavailable:true}}});await db.generationStep.updateMany({where:{runId,key:"creative-review"},data:{status:"FAILED",errorCode:"REVIEW_UNAVAILABLE",errorMessage:(error instanceof Error?error.message.replace(/data:[^\s"']+|https?:\/\/[^\s"']+/g,"[redacted]").slice(0,900):"Review failed"),completedAt:new Date()}});}
 await db.generationRun.updateMany({where:{id:runId,status:"RUNNING",scene:{revision:r.inputRevision,archivedAt:null}},data:{status:issues.length||reviewUnavailable?"PARTIAL":"SUCCEEDED",progress:100,currentStage:issues.length?"Image ready · review flagged details":"Image ready · choose Use in 3D",errorMessage:issues.length?"Image review flagged details. Use Fix image issues to create a paid correction; this image is kept.":reviewUnavailable?"Image saved. Automatic review was unavailable; inspect it before reconstruction.":null,completedAt:new Date()}});
 }catch(e){const http=typeof record(e).status==="number"?Number(record(e).status):0;const uncertain=submitted&&(!http||http>=500);
 await db.generationStep.updateMany({where:{runId,status:"RUNNING"},data:{status:uncertain?"SUBMISSION_UNCERTAIN":"FAILED",errorCode:http?`META_HTTP_${http}`:"CREATIVE_FAILED",completedAt:new Date()}});
 await db.generationRun.updateMany({where:{id:runId,status:"RUNNING"},data:{status:"FAILED",errorCode:uncertain?"SUBMISSION_UNCERTAIN":"CREATIVE_FAILED",errorMessage:uncertain?"The request was interrupted and may have been charged. It will not retry automatically. Saved images remain available.":"The image could not be created. Your references and saved images are kept. Start a new variation when ready.",completedAt:new Date()}});}
}
export async function adoptCreative(ownerId:string,id:string,title:string){
 const db=getDb();if(!await db.contentItem.findFirst({where:{id,ownerId,kind:"GENERATED",archivedAt:null}}))throw new AppError(404,"IMAGE_UNAVAILABLE","Restore this image before using it.");const a=await db.asset.findFirst({where:{id,kind:"SOURCE_IMAGE",status:"READY",scene:{ownerId,archivedAt:null},provenance:{path:["source"],equals:"muse-scene-composition"}}});if(!a)throw new AppError(404,"IMAGE_UNAVAILABLE","Image unavailable.");
 if(await db.scene.count({where:{ownerId,archivedAt:null}})>=50)throw new AppError(429,"SCENE_LIMIT","Archive an old project first.");
 const s=await db.scene.create({data:{ownerId,title,settings:{source:"creative-result",approximateProductLikeness:true}}});
 const bytes=await readLimited(a.storageKey,4*1024*1024),source=await saveImage(s.id,bytes,"SOURCE_IMAGE",{source:"accepted-creative-image"}),normalized=await saveImage(s.id,bytes,"NORMALIZED_IMAGE",{source:"image-normalization",exifRemoved:true});
 await db.$transaction([db.scene.update({where:{id:s.id},data:{sourceAssetId:source.id,normalizedAssetId:normalized.id,revision:1}}),db.contentAdoption.create({data:{sceneId:s.id,contentItemId:a.id}})]);return s.id;
}
