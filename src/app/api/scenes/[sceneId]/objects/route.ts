import { api, checkOrigin, readJson } from "@/lib/http";
import { requireUser } from "@/lib/auth/user";
import { saveObjects } from "@/lib/services/generation";
import { objectEditsSchema } from "@/lib/validation/generation";
export const PATCH = (request: Request, context: { params: Promise<{ sceneId: string }> }) => api(async () => {
  checkOrigin(request);
  const user = await requireUser();
  await saveObjects((await context.params).sceneId, user.id, objectEditsSchema.parse(await readJson(request)));
  return Response.json({ saved: true });
});
