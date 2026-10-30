import "server-only";
import {z} from "zod";
import {getDb} from "@/lib/db";
import {AppError} from "@/lib/http";
export const contentTrashInput=z.object({action:z.enum(["DELETE_IMAGE","RESTORE_IMAGE"]),itemId:z.uuid(),confirmed:z.literal(true)}).strict();
export async function manageContent(ownerId:string,input:z.infer<typeof contentTrashInput>){
 return getDb().$transaction(async tx=>{
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(839172640)`;
  const item=await tx.contentItem.findFirst({where:{id:input.itemId,ownerId,kind:{in:["REFERENCE","GENERATED"]},asset:{scene:{ownerId,archivedAt:null}}}});
  if(!item)throw new AppError(404,"NOT_FOUND","Image not found.");
  const deleting=input.action==="DELETE_IMAGE";
  if(deleting===Boolean(item.archivedAt))throw new AppError(409,"IMAGE_STATE",deleting?"Image is already in Trash.":"Image is already active.");
  if(await tx.generationReference.count({where:{contentItemId:item.id,generation:{run:{status:{in:["QUEUED","RUNNING","WAITING","CANCEL_REQUESTED"]}}}}}))throw new AppError(409,"IMAGE_BUSY","Wait for generation using this image to finish.");
  const changed=await tx.contentItem.updateMany({where:{id:item.id,ownerId,archivedAt:item.archivedAt},data:{archivedAt:deleting?new Date():null}});
  if(changed.count!==1)throw new AppError(409,"IMAGE_STATE","Image changed. Refresh the library.");
  await tx.compositionDraft.updateMany({where:{references:{some:{contentItemId:item.id}}},data:{revision:{increment:1}}});
  return {saved:true};
 });
}
