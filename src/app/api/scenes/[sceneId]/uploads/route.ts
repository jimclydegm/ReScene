import { api, checkOrigin, readJson } from "@/lib/http";
import { requireUser } from "@/lib/auth/user";
import { reserveUploadSchema } from "@/lib/validation/scenes";
import { reserveUpload } from "@/lib/services/uploads";

export const POST = (request: Request, context: { params: Promise<{ sceneId: string }> }) => api(async () => {
  checkOrigin(request);
  const user = await requireUser();
  const { sceneId } = await context.params;
  return Response.json(await reserveUpload(sceneId, user.id, reserveUploadSchema.parse(await readJson(request))), { status: 201 });
});
