import { api } from "@/lib/http";
import { requireUser } from "@/lib/auth/user";
import { workspace } from "@/lib/services/generation";
export const GET = (_request: Request, context: { params: Promise<{ sceneId: string }> }) => api(async () => {
  const user = await requireUser();
  return Response.json(await workspace((await context.params).sceneId, user.id));
});
