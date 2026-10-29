import { api, checkOrigin, readJson } from "@/lib/http";
import { requireUser } from "@/lib/auth/user";
import { compositionInputSchema, matchPhotoLayout } from "@/lib/services/composition";
export const maxDuration = 120;
export const POST = (request: Request, context: { params: Promise<{ sceneId: string }> }) => api(async () => {
  checkOrigin(request);
  const user = await requireUser();
  await matchPhotoLayout((await context.params).sceneId, user.id, compositionInputSchema.parse(await readJson(request)));
  return Response.json({ saved: true });
});
