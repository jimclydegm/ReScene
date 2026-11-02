import { objectAppearanceSchema } from "@/lib/scene/appearance";
import { isBackgroundSurface } from "@/lib/scene/surface-role";
import "server-only";
import { randomBytes,randomUUID,createHash } from "node:crypto";
import { z } from "zod";
import {Matrix4,Quaternion,Vector3} from "three";
import { getDb } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { ownedScene } from "./scenes";
import { record } from "./composition";
import { AppError } from "@/lib/http";
import { readLimited,putObject,bucket,storagePrefix,signRead } from "@/lib/storage/r2";
import { inspectGlb } from "@/lib/ai/glb";
import { glbBounds,compositionSchema } from "@/lib/scene/composition";
import { defaultLighting,lightingSchema } from "@/lib/scene/lighting";
import { snapshotSchema,snapshotAssets,flattenTransform,type Snapshot } from "@/lib/scene/manifest";
export const publicationInput=z.discriminatedUnion("action",[
 z.object({action:z.literal("PUBLISH"),expectedRevision:z.number().int().nonnegative(),confirmed:z.literal(true)}).strict(),
 z.object({action:z.literal("REVOKE"),publicationId:z.uuid()}).strict()
]);
const json=(v:unknown)=>JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
export async function publications(sceneId:string,ownerId:string){await ownedScene(sceneId,ownerId);return getDb().scenePublication.findMany({where:{sceneId,revokedAt:null},orderBy:{publishedAt:"desc"},select:{id:true,slug:true,revision:true,publishedAt:true,revokedAt:true}});}
export async function publish(sceneId:string,ownerId:string,revision:number){
 const db=getDb(),scene=await ownedScene(sceneId,ownerId);
 if(scene.status!=="READY"||scene.revision!==revision)throw new AppError(409,"REVISION_CONFLICT","Save or reload the ready scene before publishing.");
 const existing=await db.scenePublication.findFirst({where:{sceneId,revision,revokedAt:null}});if(existing)return {id:existing.id,slug:existing.slug};
 const objects=(await db.sceneObject.findMany({where:{sceneId,status:"READY",visible:true,modelAssetId:{not:null}},include:{model:true,product:{include:{imageAsset:true}}},orderBy:{sortOrder:"asc"}})).filter(o=>!isBackgroundSurface(o,{width:scene.normalizedAsset?.width??0,height:scene.normalizedAsset?.height??0}));
 if(!objects.length||objects.length>10)throw new AppError(422,"NO_OBJECTS","Publish one to ten visible 3D objects.");
 const {guardCollisions}=await import("./collision-guard");await guardCollisions(objects,undefined,compositionSchema.safeParse(scene.stage).data);
 // Part GLBs retain the shared appearance atlas. Publish assemblies only when
 // every reconstructed member is approved as visible, never a hidden body/part.
 const assemblyMembers=await db.sceneObject.findMany({where:{sceneId,status:"READY",modelAssetId:{not:null}},select:{id:true,provenance:true}});
 for(const o of objects){const root=record(o.provenance).assemblyRootId;if(typeof root!=="string")continue;const members=assemblyMembers.filter(m=>record(m.provenance).assemblyRootId===root);if(members.some(m=>!objects.some(v=>v.id===m.id)))throw new AppError(422,"ASSEMBLY_VISIBILITY","Show the complete subject and all of its product regions before publishing this shared-geometry assembly.");}

 const composition=compositionSchema.safeParse(scene.stage).data??null,background=record(record(scene.settings).background),applied=["material-background-v2","reference-environment-v1"].includes(String(background.version))?background:record(record(scene.settings).appearance);
 if(composition?.background)composition.background.description="Photo-derived background.";
 const m:Snapshot={schemaVersion:2,coordinates:{handedness:"right",upAxis:"Y",units:"approximate"},title:scene.title,description:scene.description,revision,approximateGeometry:true,composition,lighting:lightingSchema.safeParse(record(scene.settings).lighting).data??defaultLighting(composition),surfaces:{floorAssetId:typeof applied.floorId==="string"?applied.floorId:null,wallAssetId:typeof applied.wallId==="string"?applied.wallId:null,backgroundAssetId:typeof record(record(scene.settings).background).assetId==="string"?String(record(record(scene.settings).background).assetId):null},objects:[],products:[]};
 for(const o of objects){
  if(!o.model||o.model.sceneId!==sceneId||o.model.kind!=="MODEL_GLB"||o.model.status!=="READY")throw new AppError(422,"INVALID_ASSET","A visible model is unavailable.");
  const bytes=await readLimited(o.model.storageKey,40*1024*1024);inspectGlb(bytes);
  const product=o.product;
  if(product&&product.sceneId!==sceneId)throw new AppError(422,"INVALID_PRODUCT","A product belongs to another scene.");
  const bounds=glbBounds(bytes),transform=flattenTransform(o,bounds);
  m.objects.push({tint:objectAppearanceSchema.safeParse(o.appearance).data?.tint??null,id:o.id,label:o.label,modelAssetId:o.model.id,transform,productId:product?.id??null});
  if(m.composition){const matrix=new Matrix4().compose(new Vector3(...transform.position),new Quaternion(...transform.rotation),new Vector3(...transform.scale));const bottoms=[0,1].flatMap(x=>[0,1].flatMap(y=>[0,1].map(z=>new Vector3((x?bounds.max:bounds.min)[0],(y?bounds.max:bounds.min)[1],(z?bounds.max:bounds.min)[2]).applyMatrix4(matrix).y)));m.composition.floorY=Math.min(m.composition.floorY??0,...bottoms);}
  if(product&&!m.products.some(p=>p.id===product.id))m.products.push({id:product.id,name:product.name,description:product.description??"",brand:product.brand??"",price:product.price?.toFixed(2)??null,currency:(product.price===null?null:product.currency) as Snapshot["products"][number]["currency"],productUrl:product.productUrl??"",imageAssetId:product.imageAssetId});
 }
 const manifest=snapshotSchema.parse(m),ids=snapshotAssets(manifest);
 const assets=await db.asset.findMany({where:{id:{in:ids},sceneId,status:"READY"}});
 validateAssets(manifest,assets);
 const id=randomUUID(),slug=randomBytes(24).toString("base64url"),key=`${storagePrefix()}/scenes/${sceneId}/publications/${id}.json`,bytes=Buffer.from(JSON.stringify(manifest));
 if(bytes.length>256*1024)throw new AppError(422,"SNAPSHOT_TOO_LARGE","This environment is too detailed to publish.");
 await putObject(key,bytes,"application/json");
 return db.$transaction(async tx=>{
  // Locks the same row as every draft save; no model/storage operations inside this transaction.
  const changed=await tx.scene.updateMany({where:{id:sceneId,ownerId,revision,status:"READY",archivedAt:null},data:{updatedAt:new Date()}});
  if(!changed.count)throw new AppError(409,"REVISION_CONFLICT","The scene changed during publishing. Reload and try again.");
  const current=await tx.asset.findMany({where:{id:{in:ids},sceneId,status:"READY"}});validateAssets(manifest,current);
  // Serializing on Scene makes repeated/concurrent publish requests idempotent for this revision.
  const duplicate=await tx.scenePublication.findFirst({where:{sceneId,revision,revokedAt:null}});if(duplicate)return {id:duplicate.id,slug:duplicate.slug};
  if(await tx.scenePublication.count({where:{sceneId,revokedAt:null}})>=10)throw new AppError(409,"SHARE_LIMIT","Revoke an older link before creating more than ten active snapshots.");
  await tx.asset.create({data:{id,sceneId,kind:"SCENE_MANIFEST",status:"READY",bucket:bucket(),storageKey:key,mimeType:"application/json",byteSize:bytes.length,sha256:createHash("sha256").update(bytes).digest("hex"),readyAt:new Date(),provenance:{schemaVersion:2}}});
  const publication=await tx.scenePublication.create({data:{sceneId,slug,revision,manifestAssetId:id,assetIds:json(ids)}});return {id:publication.id,slug:publication.slug};
 });
}
function validateAssets(m:Snapshot,assets:{id:string;kind:string}[]){
 const expected=new Map<string,string>();
 m.objects.forEach(o=>expected.set(o.modelAssetId,"MODEL_GLB"));m.products.forEach(p=>{if(p.imageAssetId)expected.set(p.imageAssetId,"PRODUCT_IMAGE");});
 for(const id of [m.surfaces.floorAssetId,m.surfaces.wallAssetId,m.surfaces.backgroundAssetId])if(id){if(expected.has(id))throw new AppError(422,"INVALID_ASSET","Conflicting asset types.");expected.set(id,"SURFACE_TEXTURE");}
 if(assets.length!==expected.size||assets.some(a=>expected.get(a.id)!==a.kind))throw new AppError(422,"INVALID_ASSET","A viewer asset is unavailable or has the wrong type.");
}
export async function revoke(sceneId:string,ownerId:string,id:string){await ownedScene(sceneId,ownerId);const result=await getDb().scenePublication.updateMany({where:{id,sceneId},data:{revokedAt:new Date()}});if(!result.count)throw new AppError(404,"NOT_FOUND","Publication not found.");}
export async function sharedScene(slug:string){
 if(!/^[A-Za-z0-9_-]{32}$/.test(slug))throw new AppError(404,"NOT_FOUND","Shared scene not found.");
 const db=getDb(),publication=await db.scenePublication.findFirst({where:{slug,revokedAt:null,scene:{archivedAt:null}},include:{manifest:true}});
 if(!publication||publication.manifest.kind!=="SCENE_MANIFEST"||publication.manifest.status!=="READY"||publication.manifest.sceneId!==publication.sceneId)throw new AppError(404,"NOT_FOUND","This share link is unavailable.");
 const bytes=await readLimited(publication.manifest.storageKey,256*1024);
 if(createHash("sha256").update(bytes).digest("hex")!==publication.manifest.sha256)throw new AppError(404,"NOT_FOUND","Snapshot unavailable.");
 const m=snapshotSchema.parse(JSON.parse(bytes.toString()));const ids=snapshotAssets(m);
 const allowed=z.array(z.uuid()).parse(publication.assetIds).sort();
 if(JSON.stringify(ids)!==JSON.stringify(allowed))throw new AppError(404,"NOT_FOUND","Snapshot assets unavailable.");
 const assets=await db.asset.findMany({where:{id:{in:ids},sceneId:publication.sceneId,status:"READY"}});validateAssets(m,assets);
 const urls=new Map(await Promise.all(assets.map(async a=>[a.id,await signRead(a)] as const)));
 // Check revocation again after storage/signing; never rejoin live draft products/objects.
 if(!await db.scenePublication.findFirst({where:{id:publication.id,revokedAt:null,scene:{archivedAt:null}}}))throw new AppError(404,"NOT_FOUND","This share link is unavailable.");
 return {title:m.title,description:m.description,revision:m.revision,composition:m.composition,lighting:m.lighting,appearance:{applied:Boolean(m.surfaces.floorAssetId||m.surfaces.wallAssetId||m.surfaces.backgroundAssetId),floorUrl:m.surfaces.floorAssetId?urls.get(m.surfaces.floorAssetId)!:null,wallUrl:m.surfaces.wallAssetId?urls.get(m.surfaces.wallAssetId)!:null,backgroundUrl:m.surfaces.backgroundAssetId?urls.get(m.surfaces.backgroundAssetId)!:null},objects:m.objects.map(o=>({tint:o.tint??null,id:o.id,label:o.label,modelUrl:urls.get(o.modelAssetId)!,transform:o.transform,product:o.productId?(()=>{const p=m.products.find(p=>p.id===o.productId)!;return {name:p.name,brand:p.brand,description:p.description,price:p.price,currency:p.currency,productUrl:p.productUrl,imageUrl:p.imageAssetId?urls.get(p.imageAssetId)!:null};})():null}))};
}
