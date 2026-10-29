import { api,checkOrigin,readJson } from "@/lib/http";
import { requireUser } from "@/lib/auth/user";
import { manageProject,projectActionSchema } from "@/lib/services/project-management";
export const POST=(request:Request,context:{params:Promise<{sceneId:string}>})=>api(async()=>{checkOrigin(request);const user=await requireUser();return Response.json(await manageProject((await context.params).sceneId,user.id,projectActionSchema.parse(await readJson(request))));});
