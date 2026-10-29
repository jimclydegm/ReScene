// Original procedural QA data only. Tests archival + restart invalidation, no inference.
import {config} from "dotenv";config({path:".env.local",quiet:true});
import assert from "node:assert/strict";
import {createHash,randomUUID} from "node:crypto";
import sharp from "sharp";
import {getDb} from "../src/lib/db";
import {seedCatalog} from "../src/lib/services/catalog";
import {publish,sharedScene} from "../src/lib/services/publication";
import {restartScene} from "../src/lib/services/restart";
import {putObject,bucket,storagePrefix} from "../src/lib/storage/r2";
const db=getDb();if(!process.env.SMOKE_OWNER_SCENE_ID)throw new Error("Set SMOKE_OWNER_SCENE_ID to an authorized QA scene.");
const owner=await db.scene.findUniqueOrThrow({where:{id:process.env.SMOKE_OWNER_SCENE_ID},select:{ownerId:true}});
const scene=await db.scene.create({data:{ownerId:owner.ownerId,title:"Publication lifecycle QA — original demo",status:"READY"}});
try{
 const bytes=await sharp({create:{width:32,height:32,channels:3,background:"#c4cbb3"}}).webp().toBuffer(),id=randomUUID(),key=`${storagePrefix()}/scenes/${scene.id}/qa/${id}.webp`;
 await putObject(key,bytes,"image/webp");await db.asset.create({data:{id,sceneId:scene.id,kind:"NORMALIZED_IMAGE",status:"READY",bucket:bucket(),storageKey:key,mimeType:"image/webp",byteSize:bytes.length,width:32,height:32,sha256:createHash("sha256").update(bytes).digest("hex"),readyAt:new Date()}});await db.scene.update({where:{id:scene.id},data:{normalizedAssetId:id}});
 await seedCatalog(scene.id,owner.ownerId,0);
 const item=await db.product.findFirstOrThrow({where:{sceneId:scene.id,modelAssetId:{not:null}}});
 await db.sceneObject.create({data:{sceneId:scene.id,sourceOrdinal:0,label:"Original QA demo",category:"furniture",status:"READY",representation:"MESH",modelAssetId:item.modelAssetId,productId:item.id}});
 const current=await db.scene.findUniqueOrThrow({where:{id:scene.id}}),publication=await publish(scene.id,owner.ownerId,current.revision);
 assert((await sharedScene(publication.slug)).objects.length===1);
 await db.scene.update({where:{id:scene.id},data:{archivedAt:new Date()}});await assert.rejects(sharedScene(publication.slug),e=>typeof e==="object"&&e!==null&&"status" in e&&e.status===404);
 await db.scene.update({where:{id:scene.id},data:{archivedAt:null}});assert((await sharedScene(publication.slug)).objects.length===1);
 await restartScene(scene.id,owner.ownerId,{target:"PHOTO",expectedRevision:current.revision,confirmed:true});
 await assert.rejects(sharedScene(publication.slug),e=>typeof e==="object"&&e!==null&&"status" in e&&e.status===404);
 assert.equal((await db.scenePublication.findUniqueOrThrow({where:{id:publication.id}})).revokedAt!==null,true);
 console.log("Publication lifecycle passes: archival blocks new access; restart revokes snapshots and invalidates later assets.");
}finally{await db.scene.update({where:{id:scene.id},data:{archivedAt:new Date()}});await db.scenePublication.updateMany({where:{sceneId:scene.id},data:{revokedAt:new Date()}});await db.$disconnect();}
process.exit(0);
