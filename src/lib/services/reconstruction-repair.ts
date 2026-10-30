import "server-only";
import sharp from "sharp";
import {randomUUID,createHash} from "node:crypto";
import {Quaternion,Vector3} from "three";
import {getDb} from "@/lib/db";
import {record} from "./composition";
import {compositionSchema,modelPlacementSchema} from "@/lib/scene/composition";
import {reviewLayout,layoutReviewSchema} from "@/lib/scene/layout-review";
import {retryPlacement} from "@/lib/scene/retry-placement";
import {downloadFalArtifact,inspectGlb} from "@/lib/ai/glb";
import {bucket,storagePrefix,putObject,readLimited} from "@/lib/storage/r2";
import type {Prisma} from "@/generated/prisma/client";
const json=(v:unknown)=>JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
type Result={individual_glbs?:{url:string}[];model_glb?:{url:string};metadata?:{object_index:number}[]};
export async function ingestRepair(runId:string,result:Result){
 const db=getDb(),run=await db.generationRun.findUniqueOrThrow({where:{id:runId},include:{scene:{include:{normalizedAsset:true}}}}),scene=run.scene;
 if(!["RUNNING","WAITING"].includes(run.status)||scene.archivedAt||scene.revision!==run.inputRevision||run.expiresAt<new Date())throw new Error("RETRY_STALE");
 const ids=record(run.input).objectIds as string[],files=ids.length===1?[result.model_glb!]:result.individual_glbs;
 if(!files||files.length!==ids.length||files.some(f=>!f?.url))throw new Error("RETRY_MESHES_MISSING");
 const stage=compositionSchema.parse(scene.stage),size={width:scene.normalizedAsset!.width!,height:scene.normalizedAsset!.height!};
 const objects=await db.sceneObject.findMany({where:{sceneId:scene.id},include:{model:true,mask:true}});
 const ready=objects.filter(o=>o.model&&o.mask&&!record(o.provenance).parentObjectId&&!record(o.provenance).replacementBackup);
 const placements=ready.map(o=>{const p=modelPlacementSchema.parse(o.initialTransform),q=new Quaternion(o.rotationX,o.rotationY,o.rotationZ,o.rotationW);return {id:o.id,position:[o.positionX,o.positionY,o.positionZ] as [number,number,number],placement:{...p,rotation:q.clone().multiply(new Quaternion(...p.rotation)).toArray(),offset:new Vector3(...p.offset).multiplyScalar(o.scaleX).applyQuaternion(q).toArray(),scale:p.scale.map(v=>v*o.scaleX) as [number,number,number],size:p.size.map(v=>v*o.scaleX) as [number,number,number]}};});
 const savedPlacements=structuredClone(placements);
 const inputs=await Promise.all(ready.map(async o=>({id:o.id,label:o.label,bytes:await readLimited(o.model!.storageKey,40*1024*1024),mask:await sharp(await readLimited(o.mask!.storageKey,4*1024*1024)).greyscale().raw().toBuffer(),support:String(record(o.provenance).support??"unknown"),supportedById:typeof record(o.provenance).supportedByObjectId==="string"?String(record(o.provenance).supportedByObjectId):null})));
 const baseline=reviewLayout(structuredClone(placements),inputs,stage,size,{onlyIds:new Set(ids),evaluateOnly:true});
 const anchor=ready.filter(o=>record(o.provenance).metadata).sort((a,b)=>modelPlacementSchema.parse(b.initialTransform).size[0]-modelPlacementSchema.parse(a.initialTransform).size[0])[0];if(!anchor)throw new Error("RETRY_FRAME_UNAVAILABLE");
 const assets=new Map<string,string>();
 for(const [index,id]of ids.entries()){
  const object=objects.find(o=>o.id===id);if(!object?.mask)throw new Error("RETRY_MASK_REQUIRED");
  const bytes=await downloadFalArtifact(files[index].url);inspectGlb(bytes);
  const assetId=randomUUID(),key=`${storagePrefix()}/scenes/${scene.id}/runs/${runId}/${assetId}.glb`;
  await putObject(key,bytes,"model/gltf-binary");await db.asset.create({data:{id:assetId,sceneId:scene.id,kind:"MODEL_GLB",status:"READY",bucket:bucket(),storageKey:key,mimeType:"model/gltf-binary",byteSize:bytes.length,sha256:createHash("sha256").update(bytes).digest("hex"),readyAt:new Date(),provenance:{source:"selective-reconstruction",runId}}});assets.set(id,assetId);
  const frame=object.model&&record(object.provenance).metadata?object:anchor,p=savedPlacements.find(p=>p.id===frame.id)!;
  const placement={id,...retryPlacement(bytes,result.metadata?.find(m=>m.object_index===index),{...p,metadata:record(frame.provenance).metadata})};
  const at=placements.findIndex(o=>o.id===id);if(at>=0)placements[at]=placement;else placements.push(placement);
  const input={id,label:object.label,bytes,mask:await sharp(await readLimited(object.mask.storageKey,4*1024*1024)).greyscale().raw().toBuffer(),support:String(record(object.provenance).support??"unknown"),supportedById:typeof record(object.provenance).supportedByObjectId==="string"?String(record(object.provenance).supportedByObjectId):null};
  const i=inputs.findIndex(o=>o.id===id);if(i>=0)inputs[i]=input;else inputs.push(input);
 }
 const review=reviewLayout(placements,inputs,stage,size,{onlyIds:new Set(ids)}),accepted=new Set(review.objects.filter(o=>!o.collision&&o.after>=.2&&(!baseline.objects.some(b=>b.id===o.id)||o.after>(baseline.objects.find(b=>b.id===o.id)!.after+.025))).map(o=>o.id));
 const appearance=record(record(scene.settings).appearance);
 const appearanceModels=Array.isArray(appearance.models)?appearance.models.filter(m=>!accepted.has(String(record(m).objectId))):null;
 const prior=layoutReviewSchema.safeParse(record(scene.settings).layoutReview).data;
 const merged=[...(prior?.objects??[]).filter(o=>!accepted.has(o.id)),...review.objects.filter(o=>accepted.has(o.id))];
 await db.$transaction(async tx=>{
  const changed=await tx.scene.updateMany({where:{id:scene.id,ownerId:scene.ownerId,archivedAt:null,revision:run.inputRevision,status:"READY"},data:{revision:{increment:1},settings:json({...record(scene.settings),...(accepted.size?{layoutBackup:null,...(appearanceModels?{appearance:{...appearance,models:appearanceModels}}:{})}:{}),layoutReview:{version:"mask-layout-v1",objects:merged,needsReview:merged.some(o=>o.needsReview)},reconstructionOptions:record(run.input).reconstruction})}});if(changed.count!==1)throw new Error("RETRY_STALE");
  for(const [index,id]of ids.entries()){
   const old=objects.find(o=>o.id===id)!,p=placements.find(o=>o.id===id)!;
   await tx.sceneObject.update({where:{id,sceneId:scene.id},data:{...(accepted.has(id)?{modelAssetId:assets.get(id),status:"READY",representation:"MESH",lastErrorCode:null,positionX:p.position[0],positionY:p.position[1],positionZ:p.position[2],rotationX:0,rotationY:0,rotationZ:0,rotationW:1,scaleX:1,scaleY:1,scaleZ:1,initialTransform:json(p.placement)}:{}),provenance:json({...record(old.provenance),...(accepted.has(id)?{metadata:result.metadata?.find(m=>m.object_index===index)}:{}),lastRetry:{runId,assetId:assets.get(id),accepted:accepted.has(id),previousModelAssetId:old.modelAssetId,score:review.objects.find(o=>o.id===id)?.after,previousScore:baseline.objects.find(o=>o.id===id)?.after??null}})}});
  }
  await tx.generationStep.updateMany({where:{runId,key:"sam3d-submit"},data:{status:"SUCCEEDED",output:json({metadata:result.metadata,objectIds:ids,modelAssetIds:ids.map(id=>assets.get(id)),review,acceptedObjectIds:[...accepted]}),completedAt:new Date()}});
  await tx.generationRun.update({where:{id:runId},data:{status:accepted.size===ids.length&&!review.needsReview?"SUCCEEDED":"PARTIAL",progress:100,currentStage:"Selective retry complete",errorMessage:accepted.size<ids.length?"The retry did not improve every selected object's photo overlap. Previous models were kept where the result was worse. Other objects and the background are unchanged.":review.needsReview?"New models improved photo overlap; remaining shape differences are flagged. Other objects and the background are unchanged.":null,completedAt:new Date()}});
 });
}
