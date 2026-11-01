import "server-only";
import {createHash} from "node:crypto";
import type {Prisma} from "@/generated/prisma/client";
import {getDb} from "@/lib/db";
import {AppError} from "@/lib/http";
import {record} from "./composition";

// Analysis caches can refresh before a render change is committed. They must
// not invalidate an otherwise valid chain of saved texture versions.
const keys=["appearance","quality","qualityPlan","background","backgroundPlan","backgroundBackup","activeBackgroundId","layoutReview","layoutBackup"] as const;
const objectFields={id:true,modelAssetId:true,maskAssetId:true,initialTransform:true,positionX:true,positionY:true,positionZ:true,rotationX:true,rotationY:true,rotationZ:true,rotationW:true,scaleX:true,scaleY:true,scaleZ:true} as const;
type Tx=Prisma.TransactionClient;
const json=(v:unknown)=>JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
export async function captureAppearance(tx:Tx,sceneId:string){
 const scene=await tx.scene.findUniqueOrThrow({where:{id:sceneId},select:{stage:true,settings:true,normalizedAssetId:true}});
 const objects=await tx.sceneObject.findMany({where:{sceneId},select:objectFields,orderBy:{id:"asc"}});
 return {photoId:scene.normalizedAssetId,stage:scene.stage,settings:Object.fromEntries(keys.map(k=>[k,record(scene.settings)[k]??null])),objects};
}
type Snapshot=Awaited<ReturnType<typeof captureAppearance>>;
type Entry={name:string;before:Snapshot;after:Snapshot};
type History={undo:Entry[];redo:Entry[]};
const history=(v:unknown):History=>{const r=record(v),normalize=(entries:unknown)=>Array.isArray(entries)?(entries.slice(-8) as Entry[]).map(e=>({...e,before:{...e.before,settings:Object.fromEntries(keys.map(k=>[k,record(e.before.settings)[k]??null]))},after:{...e.after,settings:Object.fromEntries(keys.map(k=>[k,record(e.after.settings)[k]??null]))}})):[];return {undo:normalize(r.undo),redo:normalize(r.redo)};};
export const appearanceFingerprint=(v:unknown):string=>{const canonical=(x:unknown):unknown=>Array.isArray(x)?x.map(canonical):x&&typeof x==="object"?Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,canonical(v)])):x;return createHash("sha256").update(JSON.stringify(canonical(v))).digest("hex");};
// Registering the original background adds a selector ID without changing any
// rendered asset. Compare render state while still restoring the saved ID.
const hash=(v:Snapshot)=>appearanceFingerprint({...v,settings:{...v.settings,activeBackgroundId:null}});
export async function recordAppearance(tx:Tx,sceneId:string,before:Snapshot,name:string,coalesce=false){
 const after=await captureAppearance(tx,sceneId);if(hash(before)===hash(after))return;
 const s=await tx.scene.findUniqueOrThrow({where:{id:sceneId},select:{settings:true}}),settings=record(s.settings),h=history(settings.appearanceHistory);
 const undo=coalesce&&h.undo.length&&hash(h.undo.at(-1)!.after)===hash(before)?[...h.undo.slice(0,-1),{...h.undo.at(-1)!,after}]:[...h.undo,{name,before,after}].slice(-8);
 await tx.scene.update({where:{id:sceneId},data:{settings:json({...settings,appearanceHistory:{undo,redo:[]}})}});
}
export function appearanceHistorySummary(settings:unknown){const h=history(record(settings).appearanceHistory);return {undo:h.undo.at(-1)?.name??null,redo:h.redo.at(-1)?.name??null};}
export async function moveAppearanceHistory(sceneId:string,ownerId:string,revision:number,action:"UNDO"|"REDO"){
 const db=getDb();return db.$transaction(async tx=>{
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(839172640)`;
  const s=await tx.scene.findFirst({where:{id:sceneId,ownerId,revision,status:"READY",archivedAt:null}});
  if(!s)throw new AppError(409,"REVISION_CONFLICT","Reload the saved scene before changing texture history.");
  if(await tx.generationRun.count({where:{sceneId,status:{in:["QUEUED","RUNNING","WAITING"]}}}))throw new AppError(409,"RUN_ACTIVE","Wait for generation to finish.");
  const h=history(record(s.settings).appearanceHistory),from=action==="UNDO"?h.undo:h.redo,to=action==="UNDO"?h.redo:h.undo,entry=from.at(-1);
  if(!entry)throw new AppError(409,"HISTORY_EMPTY","No saved texture change to "+action.toLowerCase()+".");
  const current=await captureAppearance(tx,sceneId),expected=action==="UNDO"?entry.after:entry.before,target=action==="UNDO"?entry.before:entry.after;
  if(hash(current)!==hash(expected))throw new AppError(409,"HISTORY_CHANGED","The layout or models changed after this texture version. Undo those edits first; the saved texture versions are kept.");
  const ids=new Set<string>();for(const o of target.objects)for(const id of [o.modelAssetId,o.maskAssetId])if(id)ids.add(id);
  const walk=(v:unknown)=>{if(!v||typeof v!=="object")return;for(const [k,x]of Object.entries(v)){if(typeof x==="string"&&/^(assetId|floorId|wallId|originalId|bakedId|modelAssetId|sourceModelAssetId|previousModelAssetId|maskAssetId)$/.test(k))ids.add(x);else if(typeof x==="object")walk(x);}};walk(target.settings);
  const assets=await tx.asset.findMany({where:{id:{in:[...ids]},sceneId,status:"READY"},select:{id:true}});
  if(assets.length!==ids.size)throw new AppError(409,"HISTORY_ASSET_UNAVAILABLE","A saved texture asset is unavailable. Current appearance was kept.");
  const changed=await tx.scene.updateMany({where:{id:sceneId,ownerId,revision,status:"READY",archivedAt:null},data:{stage:json(target.stage),settings:json({...record(s.settings),...target.settings,appearanceHistory:{undo:action==="UNDO"?from.slice(0,-1):[...to,entry].slice(-8),redo:action==="UNDO"?[...to,entry].slice(-8):from.slice(0,-1)}}),revision:{increment:1}}});
  if(!changed.count)throw new AppError(409,"REVISION_CONFLICT","The scene changed. Reload before restoring textures.");
  for(const o of target.objects){const {id,...data}=o;await tx.sceneObject.update({where:{id,sceneId},data:{...data,initialTransform:json(data.initialTransform)}});}
 });
}
