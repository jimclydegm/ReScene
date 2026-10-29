import { api, checkOrigin, readJson } from "@/lib/http";
import { requireUser } from "@/lib/auth/user";
import { restartScene } from "@/lib/services/restart";
import { restartInputSchema } from "@/lib/validation/generation";
export const POST = (request: Request, context: { params: Promise<{ sceneId: string }> }) => api(async () => {
  checkOrigin(request);
  const user = await requireUser();
  return Response.json(await restartScene((await context.params).sceneId, user.id, restartInputSchema.parse(await readJson(request))));
});
