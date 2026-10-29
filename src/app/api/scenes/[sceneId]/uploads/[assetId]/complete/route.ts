import { api, checkOrigin, readJson, AppError } from "@/lib/http";
import { requireUser } from "@/lib/auth/user";
import { completeUploadSchema, uuidSchema } from "@/lib/validation/scenes";
import { completeUpload } from "@/lib/services/uploads";

export const runtime = "nodejs";
export const maxDuration = 60;

export const POST = (request: Request, context: { params: Promise<{ sceneId: string; assetId: string }> }) => api(async () => {
  checkOrigin(request);
  const user = await requireUser();
  const { sceneId, assetId } = await context.params;
  if (!uuidSchema.safeParse(assetId).success) throw new AppError(404, "NOT_FOUND", "Upload not found.");
  const { expectedRevision } = completeUploadSchema.parse(await readJson(request));
  return Response.json(await completeUpload(sceneId, assetId, user.id, expectedRevision));
});
