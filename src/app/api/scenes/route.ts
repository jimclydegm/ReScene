import { api, checkOrigin, readJson, AppError } from "@/lib/http";
import { requireUser } from "@/lib/auth/user";
import { getDb } from "@/lib/db";
import { createSceneSchema } from "@/lib/validation/scenes";
import { sceneSummary } from "@/lib/services/scenes";

export const GET = () => api(async () => {
  const user = await requireUser();
  const scenes = await getDb().scene.findMany({ where: { ownerId: user.id, archivedAt: null }, orderBy: { updatedAt: "desc" }, take: 50 });
  return Response.json({ scenes: scenes.map(sceneSummary) });
});

export const POST = (request: Request) => api(async () => {
  checkOrigin(request);
  const user = await requireUser();
  const input = createSceneSchema.parse(await readJson(request));
  const count = await getDb().scene.count({ where: { ownerId: user.id, archivedAt: null } });
  if (count >= 50) throw new AppError(429, "SCENE_LIMIT", "You have reached the prototype's 50-scene limit.");
  const scene = await getDb().scene.create({ data: { ownerId: user.id, title: input.title } });
  return Response.json({ scene: sceneSummary(scene) }, { status: 201 });
});
