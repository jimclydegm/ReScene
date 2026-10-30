import "server-only";
import {randomUUID,createHash} from "node:crypto";
import sharp from "sharp";
import {getDb} from "@/lib/db";
import {AppError} from "@/lib/http";
import {ownedScene} from "./scenes";
import {record} from "./composition";
import {bucket,storagePrefix,signRead,signUpload,readLimited,putObject} from "@/lib/storage/r2";
import {getMetaClient} from "@/lib/ai/meta";
import {creativeInput,creativePrompt,aspects} from "@/lib/ai/creative-contract";
import {demoCatalog,demoSvg} from "@/lib/scene/catalog";
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
export async function creativeLibrary(ownerId:string,sceneId?:string,page=0){
 const db=getDb();if(sceneId)await workspace(sceneId,ownerId);
 const scope={scene:{ownerId,archivedAt:null},status:"READY" as const};
 const [images,references,runs]=await Promise.all([db.asset.findMany({where:{...scope,kind:"SOURCE_IMAGE",provenance:{path:["source"],equals:"muse-scene-composition"}},orderBy:{createdAt:"desc"},skip:page*12,take:13}),db.asset.findMany({where:{...scope,kind:"PRODUCT_IMAGE"},orderBy:{createdAt:"desc"},take:48}),sceneId?db.generationRun.findMany({where:{sceneId,kind:"COMPOSE_IMAGE"},orderBy:{createdAt:"desc"},take:8}):[]]);
 const view=async(a:typeof images[number])=>({id:a.id,sceneId:a.sceneId,url:await signRead(a),label:String(record(a.provenance).label??"Scene concept")});
 return {images:await Promise.all(images.slice(0,12).map(view)),hasMore:images.length>12,references:await Promise.all(references.map(view)),runs:runs.map(r=>({id:r.id,status:r.status,error:r.errorMessage,progress:r.progress,input:creativeInput.safeParse(r.input).data??null})),revision:sceneId?(await workspace(sceneId,ownerId)).revision:0};
}
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
 const result=await saveImage(sceneId,bytes,"PRODUCT_IMAGE",{source:"creative-reference",label});await db.asset.update({where:{id},data:{status:"READY"}});return result;
 }catch(e){await db.asset.update({where:{id},data:{status:"REJECTED"}});throw e;}
}
export async function creativeTemplates(ownerId:string,sceneId:string){
 await workspace(sceneId,ownerId);const db=getDb();
 if(await db.asset.count({where:{sceneId,provenance:{path:["source"],equals:"creative-template"}}}))return;
 for(const item of demoCatalog)await saveImage(sceneId,await sharp(Buffer.from(demoSvg(item.boxes))).png().toBuffer(),"PRODUCT_IMAGE",{source:"creative-template",label:`Illustrative template · ${item.name}`,license:"CC0-1.0"});
}
export async function reserveCreative(ownerId:string,raw:unknown){
 const input=creativeInput.parse(raw);if(process.env.GENERATION_ENABLED!=="true")throw new AppError(503,"GENERATION_DISABLED","Generation is disabled.");await workspace(input.sceneId,ownerId);
 return getDb().$transaction(async tx=>{
 await tx.$executeRaw`SELECT pg_advisory_xact_lock(839172640)`;
 const prior=await tx.generationRun.findUnique({where:{sceneId_idempotencyKey:{sceneId:input.sceneId,idempotencyKey:input.idempotencyKey}}});
 if(prior){if(prior.kind!=="COMPOSE_IMAGE"||JSON.stringify(creativeInput.parse(prior.input))!==JSON.stringify(input))throw new AppError(409,"IDEMPOTENCY_CONFLICT","This request key has different settings.");return prior;}
 const scene=await tx.scene.findFirst({where:{id:input.sceneId,ownerId,archivedAt:null,revision:input.expectedRevision,status:"DRAFT"}});if(!scene)throw new AppError(409,"REVISION_CONFLICT","Reload this workspace.");
 if(await tx.generationRun.count({where:{scene:{ownerId},status:{in:[...active]}}}))throw new AppError(409,"RUN_ACTIVE","Wait for your existing generation to finish.");
 const refs=await tx.asset.count({where:{id:{in:input.referenceIds},status:"READY",kind:"PRODUCT_IMAGE",scene:{ownerId,archivedAt:null}}});if(refs!==input.referenceIds.length)throw new AppError(404,"REFERENCE_UNAVAILABLE","Choose available product references from your library.");
 return tx.generationRun.create({data:{sceneId:scene.id,kind:"COMPOSE_IMAGE",idempotencyKey:input.idempotencyKey,inputRevision:scene.revision,input:json(input),expiresAt:new Date(Date.now()+15*60000),reservedCostUsd:.01,currentStage:"Waiting for Muse Image"}});
 });
}
export async function composeCreative(runId:string){
 const db=getDb();let submitted=false;
 try{
 const r=await db.generationRun.findUniqueOrThrow({where:{id:runId},include:{scene:true}}),input=creativeInput.parse(r.input);
 if(r.kind!=="COMPOSE_IMAGE"||r.status!=="RUNNING"||r.scene.archivedAt||r.expiresAt<new Date()||r.scene.revision!==r.inputRevision)throw new Error("CREATIVE_RUN_STALE");
 const refs=await db.asset.findMany({where:{id:{in:input.referenceIds},kind:"PRODUCT_IMAGE",status:"READY",scene:{ownerId:r.scene.ownerId,archivedAt:null}}});if(refs.length!==input.referenceIds.length)throw new Error("REFERENCE_UNAVAILABLE");
 const images=await Promise.all(input.referenceIds.map(async id=>({image_url:`data:image/webp;base64,${(await readLimited(refs.find(a=>a.id===id)!.storageKey,4*1024*1024)).toString("base64")}`})));
 await db.generationStep.create({data:{runId,key:"creative-image",attempt:1,provider:"META",modelId:"muse-image-1.0",status:"RUNNING",startedAt:new Date()}});
 await db.generationRun.update({where:{id:runId},data:{progress:30,currentStage:"Composing your products with Muse Image"}});submitted=true;
 const result=await getMetaClient().post<{data?:{b64_json?:string}[]}>("/images/edits",{maxRetries:0,timeout:180000,body:{model:process.env.META_IMAGE_MODEL??"muse-image-1.0",n:1,images,prompt:creativePrompt(input),size:aspects[input.aspect],response_format:"b64_json",output_format:"png",reasoning_strength:"low",tool_enablement:{enable_image_search:false,enable_web_search:false,enable_shell:false}}});
 const b64=result.data?.[0]?.b64_json;if(!b64||b64.length>32*1024*1024)throw new Error("CREATIVE_IMAGE_INVALID");
 const asset=await saveImage(r.sceneId,Buffer.from(b64,"base64"),"SOURCE_IMAGE",{source:"muse-scene-composition",label:input.prompt.slice(0,80)||input.template,runId,model:"muse-image-1.0"});
 await db.generationStep.update({where:{runId_key_attempt:{runId,key:"creative-image",attempt:1}},data:{status:"SUCCEEDED",responseAssetId:asset.id,imageCount:1,completedAt:new Date()}});
 await db.generationRun.updateMany({where:{id:runId,status:"RUNNING",scene:{revision:r.inputRevision,archivedAt:null}},data:{status:"SUCCEEDED",progress:100,currentStage:"Image ready · choose Use in 3D",completedAt:new Date()}});
 }catch(e){const http=typeof record(e).status==="number"?Number(record(e).status):0;const uncertain=submitted&&(!http||http>=500);
 await db.generationStep.updateMany({where:{runId,status:"RUNNING"},data:{status:uncertain?"SUBMISSION_UNCERTAIN":"FAILED",errorCode:http?`META_HTTP_${http}`:"CREATIVE_FAILED",completedAt:new Date()}});
 await db.generationRun.updateMany({where:{id:runId,status:"RUNNING"},data:{status:"FAILED",errorCode:uncertain?"SUBMISSION_UNCERTAIN":"CREATIVE_FAILED",errorMessage:uncertain?"The request was interrupted and may have been charged. It will not retry automatically. Saved images remain available.":"The image could not be created. Your references and saved images are kept. Start a new variation when ready.",completedAt:new Date()}});}
}
export async function adoptCreative(ownerId:string,id:string,title:string){
 const db=getDb(),a=await db.asset.findFirst({where:{id,kind:"SOURCE_IMAGE",status:"READY",scene:{ownerId,archivedAt:null},provenance:{path:["source"],equals:"muse-scene-composition"}}});if(!a)throw new AppError(404,"IMAGE_UNAVAILABLE","Image unavailable.");
 if(await db.scene.count({where:{ownerId,archivedAt:null}})>=50)throw new AppError(429,"SCENE_LIMIT","Archive an old project first.");
 const s=await db.scene.create({data:{ownerId,title,settings:{source:"creative-result",approximateProductLikeness:true}}});
 const bytes=await readLimited(a.storageKey,4*1024*1024),source=await saveImage(s.id,bytes,"SOURCE_IMAGE",{source:"accepted-creative-image"}),normalized=await saveImage(s.id,bytes,"NORMALIZED_IMAGE",{source:"image-normalization",exifRemoved:true});
 await db.scene.update({where:{id:s.id},data:{sourceAssetId:source.id,normalizedAssetId:normalized.id,revision:1}});return s.id;
}
