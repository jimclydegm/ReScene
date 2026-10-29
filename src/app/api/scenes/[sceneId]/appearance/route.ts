import { api, checkOrigin, readJson } from "@/lib/http";
import { requireUser } from "@/lib/auth/user";
import { appearanceInput, updateAppearance } from "@/lib/services/appearance";
export const maxDuration = 120;
export const POST = (request: Request, context: { params: Promise<{ sceneId: string }> }) => api(async () => {
  checkOrigin(request);
  const user = await requireUser();
  await updateAppearance((await context.params).sceneId, user.id, appearanceInput.parse(await readJson(request)));
  return Response.json({ saved: true });
});
