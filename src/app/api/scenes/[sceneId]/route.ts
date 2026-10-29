import { api, checkOrigin, readJson, AppError } from "@/lib/http";
import { requireUser } from "@/lib/auth/user";
import { getDb } from "@/lib/db";
import { ownedScene, sceneSummary } from "@/lib/services/scenes";
import { updateSceneSchema } from "@/lib/validation/scenes";
import { signRead } from "@/lib/storage/r2";

type Context = { params: Promise<{ sceneId: string }> };

export const GET = (_request: Request, context: Context) => api(async () => {
  const user = await requireUser();
  const { sceneId } = await context.params;
  const scene = await ownedScene(sceneId, user.id);
  const previewUrl = scene.normalizedAsset ? await signRead(scene.normalizedAsset) : null;
  return Response.json({ scene: { ...sceneSummary(scene), objectCount: scene._count.objects, previewUrl } });
});

export const PATCH = (request: Request, context: Context) => api(async () => {
  checkOrigin(request);
  const user = await requireUser();
  const { sceneId } = await context.params;
  await ownedScene(sceneId,user.id);
  const {expectedRevision,...changes}=updateSceneSchema.parse(await readJson(request));
  await getDb().$transaction(async tx=>{
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(839172640)`;
    const scene=await tx.scene.findFirst({where:{id:sceneId,ownerId:user.id,archivedAt:null}});
    if(!scene)throw new AppError(404,"NOT_FOUND","Scene not found.");
    if(["ANALYZING","RECONSTRUCTING"].includes(scene.status))throw new AppError(409,"SCENE_BUSY","Wait for the current operation to finish.");
    const updated=await tx.scene.updateMany({where:{id:sceneId,ownerId:user.id,revision:expectedRevision,archivedAt:null,status:{notIn:["ANALYZING","RECONSTRUCTING"]}},data:{...changes,revision:{increment:1}}});
    if(!updated.count)throw new AppError(409,"REVISION_CONFLICT","This scene changed in another window. Reload it before saving.");
  },{timeout:20000});
  return Response.json({scene:sceneSummary(await ownedScene(sceneId,user.id))});
});
