import { api, checkOrigin, readJson } from "@/lib/http";
import { requireUser } from "@/lib/auth/user";
import { catalog, seedCatalog, catalogInput } from "@/lib/services/catalog";
type Context={params:Promise<{sceneId:string}>};
export const GET=(_request:Request,context:Context)=>api(async()=>{const user=await requireUser();return Response.json({products:await catalog((await context.params).sceneId,user.id)});});
export const POST=(request:Request,context:Context)=>api(async()=>{checkOrigin(request);const user=await requireUser();const input=catalogInput.parse(await readJson(request));await seedCatalog((await context.params).sceneId,user.id,input.expectedRevision);return Response.json({saved:true});});
