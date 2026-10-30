import "server-only";
import sharp from "sharp";
import { randomUUID,createHash } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import { readLimited,putObject,bucket,storagePrefix } from "@/lib/storage/r2";
import { containedParts } from "@/lib/scene/layout-review";
import { splitAssembly } from "@/lib/scene/assembly";
import type { Environment } from "@/lib/scene/composition";
const record=(v:unknown)=>v&&typeof v==="object"&&!Array.isArray(v)?v as Record<string,unknown>:{};
type ObjectInput={id:string;label:string;imageBounds:unknown;modelAssetId:string|null;provenance:Prisma.JsonValue;mask:{storageKey:string}|null;model:{storageKey:string}|null};
export async function prepareContainedAssemblies(sceneId:string,objects:ObjectInput[],size:{width:number;height:number},environment:Environment,appearance:unknown){
 const db=getDb(),input=await Promise.all(objects.filter(o=>o.mask).map(async o=>({id:o.id,parentId:typeof record(o.provenance).parentObjectId==="string"?String(record(o.provenance).parentObjectId):null,supportedById:typeof record(o.provenance).supportedByObjectId==="string"?String(record(o.provenance).supportedByObjectId):null,mask:await sharp(await readLimited(o.mask!.storageKey,4*1024*1024)).greyscale().raw().toBuffer()})));
 const contained=containedParts(input),changes=new Map<string,{modelAssetId:string;provenance:Prisma.JsonValue}>();
 const a=record(appearance),models=Array.isArray(a.models)?structuredClone(a.models) as {objectId:string;originalId:string;bakedId:string;copied:number}[]:[];
 async function asset(bytes:Buffer,derivedFromId:string){const id=randomUUID(),storageKey=`${storagePrefix()}/scenes/${sceneId}/review/${id}.glb`;await putObject(storageKey,bytes,"model/gltf-binary");return db.asset.create({data:{id,sceneId,kind:"MODEL_GLB",status:"READY",bucket:bucket(),storageKey,mimeType:"model/gltf-binary",byteSize:bytes.length,sha256:createHash("sha256").update(bytes).digest("hex"),derivedFromId,readyAt:new Date(),provenance:{source:"review-disjoint-assembly-v1"}}});}
 for(const rootId of new Set(contained.values())){
  const root=objects.find(o=>o.id===rootId)!,children=objects.filter(o=>contained.get(o.id)===rootId);
  if(!root.model||!root.modelAssetId||children.some(o=>record(o.provenance).replacementBackup))continue;
  const originalId=models.find(m=>m.objectId===rootId)?.originalId??root.modelAssetId;
  const original=await db.asset.findFirstOrThrow({where:{id:originalId,sceneId,kind:"MODEL_GLB",status:"READY"}});
  const originalBytes=await readLimited(original.storageKey,40*1024*1024),currentBytes=await readLimited(root.model.storageKey,40*1024*1024);
  const parts=children.map(o=>({id:o.id,mask:{data:input.find(m=>m.id===o.id)!.mask,width:size.width,height:size.height}}));
  const split=(bytes:Buffer)=>splitAssembly(bytes,record(root.provenance).metadata,size,root.imageBounds,environment,parts);
  const source=split(originalBytes),current=split(currentBytes);
  const entries=[{id:rootId,source:source.body.bytes,current:current.body.bytes},...children.map(o=>({id:o.id,source:source.parts.find(p=>p.id===o.id)!.bytes,current:current.parts.find(p=>p.id===o.id)!.bytes}))];
  for(const entry of entries){const old=objects.find(o=>o.id===entry.id)!,raw=await asset(entry.source,originalId),baked=await asset(entry.current,root.modelAssetId);
   const provenance=JSON.parse(JSON.stringify({...record(old.provenance),...(entry.id===rootId?{}:{parentObjectId:rootId}),assemblyRootId:rootId,assemblyBaseAssetId:originalId,partitionVersion:"projected-parts-v1",layoutImageBounds:root.imageBounds,metadata:record(root.provenance).metadata,layoutReviewBackup:{modelAssetId:old.modelAssetId,provenance:old.provenance}})) as Prisma.JsonValue;
   changes.set(entry.id,{modelAssetId:baked.id,provenance});old.provenance=provenance;old.modelAssetId=baked.id;old.model=baked;
   const index=models.findIndex(m=>m.objectId===entry.id),backup={objectId:entry.id,originalId:raw.id,bakedId:baked.id,copied:models[index]?.copied??0};if(index>=0)models[index]=backup;else models.push(backup);
  }
 }
 return {changes,appearance:changes.size?{...a,version:"photo-bake-v1",models}:appearance};
}
