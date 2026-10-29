import { api, checkOrigin, readJson } from "@/lib/http";
import { requireUser } from "@/lib/auth/user";
import { replaceObject, replacementInput } from "@/lib/services/catalog";
export const POST=(request:Request,context:{params:Promise<{sceneId:string}>})=>api(async()=>{checkOrigin(request);const user=await requireUser();await replaceObject((await context.params).sceneId,user.id,replacementInput.parse(await readJson(request)));return Response.json({saved:true});});
