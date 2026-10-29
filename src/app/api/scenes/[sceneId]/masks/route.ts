import { api, checkOrigin, readJson } from "@/lib/http";
import { requireUser } from "@/lib/auth/user";
import { selectMask } from "@/lib/services/generation";
import { maskSelectionSchema } from "@/lib/validation/generation";
export const PATCH = (request:Request,context:{params:Promise<{sceneId:string}>})=>api(async()=>{
  checkOrigin(request);
  const user=await requireUser();
  await selectMask((await context.params).sceneId,user.id,maskSelectionSchema.parse(await readJson(request)));
  return Response.json({saved:true});
});
