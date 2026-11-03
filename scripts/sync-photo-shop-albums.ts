/** Register only the reviewed alternate photographs, scoped to approved listings.
 * Source scenes, object transforms, prices and existing assets are not changed. */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { randomUUID, createHash } from "node:crypto";
import { getDb } from "../src/lib/db";
import { Prisma } from "../src/generated/prisma/client";
import { putObject, bucket, storagePrefix, headObject } from "../src/lib/storage/r2";
import { record } from "../src/lib/services/composition";
import { demoScenes } from "../src/lib/demo/scenes";
import photos from "../src/lib/demo/photography.json";
const db=getDb(),json=(v:unknown)=>JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
let saved=0;await mkdir("test-results/shop-2d",{recursive:true});
try{
  let owner:string|undefined;
  for(const id of demoScenes.flatMap(s=>s.objects.map(o=>o.id))){
    const gallery=(photos.products as Record<string,{path:string;sha256:string;width:number;height:number;title:string;model:string}[]>)[id]?.filter(p=>p.path.startsWith("/demo/photo-shopping/albums/"))??[];
    if(!gallery.length)continue;
    const p=await db.product.findUniqueOrThrow({where:{catalogKey:id},select:{id:true,sceneId:true,catalogStatus:true,updatedAt:true,inferredDetails:true,scene:{select:{ownerId:true,archivedAt:true}}}});
    owner??=p.scene.ownerId;
    if(p.sceneId==="f2848b95-8447-41eb-9544-0d72dd605565"||p.scene.ownerId!==owner||p.scene.archivedAt||p.catalogStatus!=="READY")throw new Error("Unapproved listing");
    const ids:string[]=[];
    for(const photo of gallery){
      const bytes=await readFile(`public${photo.path}`),hash=createHash("sha256").update(bytes).digest("hex");
      if(hash!==photo.sha256||photo.model!=="muse-image-1.0")throw new Error("Unapproved photograph");
      const key=`${storagePrefix()}/scenes/${p.sceneId}/catalog-images/${hash}.webp`;
      let asset=await db.asset.findUnique({where:{bucket_storageKey:{bucket:bucket(),storageKey:key}}});
      if(asset){if(asset.sceneId!==p.sceneId||asset.status!=="READY"||asset.sha256!==hash)throw new Error("Gallery asset mismatch");if((await headObject(key)).ContentLength!==bytes.length)throw new Error("Gallery storage mismatch");}
      else {await putObject(key,bytes,"image/webp");asset=await db.asset.create({data:{id:randomUUID(),sceneId:p.sceneId,kind:"PRODUCT_IMAGE",status:"READY",bucket:bucket(),storageKey:key,mimeType:"image/webp",byteSize:bytes.length,width:photo.width,height:photo.height,sha256:hash,readyAt:new Date(),provenance:{source:photo.model,publicApproved:true,publicPath:photo.path,purpose:"photo-shopping-gallery"}}});}
      ids.push(asset.id);saved++;
    }
    const details=record(p.inferredDetails),prior=Array.isArray(details.galleryAssetIds)?details.galleryAssetIds.filter((v):v is string=>typeof v==="string"):[];
    const galleryAssetIds=[...new Set([...prior,...ids])];
    if(JSON.stringify(prior)!==JSON.stringify(galleryAssetIds)){
      const changed=await db.product.updateMany({where:{id:p.id,updatedAt:p.updatedAt},data:{inferredDetails:json({...details,galleryAssetIds})}});
      if(!changed.count)throw new Error("Listing changed; rerun to merge gallery safely");
    }
  }
  await writeFile("test-results/shop-2d/gallery-db.json",JSON.stringify({verifiedAt:new Date().toISOString(),savedPhotos:saved}),{mode:0o600});
  console.log(`${saved} Muse gallery assets saved in R2 and linked to approved Neon listings. No scene or price edits.`);
}finally{await db.$disconnect();}
