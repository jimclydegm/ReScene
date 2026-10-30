import "server-only";
import sharp from "sharp";
import { readLimited } from "@/lib/storage/r2";
import { reviewLayout } from "@/lib/scene/layout-review";
import type { ModelPlacement, SceneComposition } from "@/lib/scene/composition";

type ObjectInput={id:string;label:string;mask:{storageKey:string}|null;provenance:unknown};
export async function reviewPreparedLayout(layout:{composition:SceneComposition;objects:{id:string;position:[number,number,number];placement:ModelPlacement}[]},objects:ObjectInput[],files:Buffer[],size:{width:number;height:number}){
 const inputs=await Promise.all(objects.map(async (o,i)=>{
  if(!o.mask)throw new Error("REVIEW_MASK_REQUIRED");
  const raw=await sharp(await readLimited(o.mask.storageKey,4*1024*1024)).greyscale().raw().toBuffer({resolveWithObject:true});
  if(raw.info.width!==size.width||raw.info.height!==size.height)throw new Error("REVIEW_MASK_SIZE");
  const p=o.provenance&&typeof o.provenance==="object"&&!Array.isArray(o.provenance)?o.provenance as Record<string,unknown>:{};
  return {id:o.id,label:o.label,bytes:files[i],mask:raw.data,support:String(p.support??"unknown"),supportedById:typeof p.supportedByObjectId==="string"?p.supportedByObjectId:null,parentId:typeof p.parentObjectId==="string"?p.parentObjectId:null};
 }));
 const review=reviewLayout(layout.objects,inputs,layout.composition,size);
 if(review.needsReview&&!layout.composition.warnings.some(w=>w.startsWith("Reference review found")))layout.composition.warnings.push("Reference review found remaining silhouette differences. Check flagged objects before publishing; hidden geometry remains estimated.");
 return review;
}
