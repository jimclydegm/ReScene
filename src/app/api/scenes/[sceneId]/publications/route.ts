import { api,checkOrigin,readJson } from "@/lib/http";
import { requireUser } from "@/lib/auth/user";
import { publications,publish,revoke,publicationInput } from "@/lib/services/publication";
type Context={params:Promise<{sceneId:string}>};
export const GET=(_request:Request,context:Context)=>api(async()=>{const user=await requireUser();return Response.json({publications:await publications((await context.params).sceneId,user.id)});});
export const POST=(request:Request,context:Context)=>api(async()=>{checkOrigin(request);const user=await requireUser(),{sceneId}=await context.params,input=publicationInput.parse(await readJson(request));if(input.action==="REVOKE"){await revoke(sceneId,user.id,input.publicationId);return Response.json({revoked:true});}return Response.json(await publish(sceneId,user.id,input.expectedRevision));});
