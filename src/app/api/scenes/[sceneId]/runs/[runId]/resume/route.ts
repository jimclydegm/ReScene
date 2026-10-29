import { start } from "workflow/api";
import { api, AppError, checkOrigin } from "@/lib/http";
import { requireUser } from "@/lib/auth/user";
import { ownedScene } from "@/lib/services/scenes";
import { getDb } from "@/lib/db";
import { generateScene, resumeReconstruction } from "@/workflows/generate";
import { uuidSchema } from "@/lib/validation/scenes";
export const POST = (request: Request, context: { params: Promise<{ sceneId: string; runId: string }> }) => api(async () => {
  checkOrigin(request);
  const user = await requireUser();
  const { sceneId, runId } = await context.params;
  if (!uuidSchema.safeParse(runId).success) throw new AppError(404, "NOT_FOUND", "Generation not found.");
  const scene = await ownedScene(sceneId, user.id);
  const run = await getDb().generationRun.findFirst({ where: { id: runId, sceneId }, include: { steps: true } });
  if (!run) throw new AppError(404, "NOT_FOUND", "Generation not found.");
  if (scene.revision !== run.inputRevision) throw new AppError(409, "REVISION_CONFLICT", "This scene has changed.");
  if (run.status === "QUEUED") {
    await start(generateScene, [run.id, run.kind]);
  } else if (run.status === "FAILED" && run.errorCode === "KNOWN_JOB_INTERRUPTED") {
    const step = run.steps.find(s => s.key === "sam3d-submit" && s.providerRequestId);
    if (!step) throw new AppError(409, "NO_SAVED_JOB", "No saved provider job is available.");
    const claimed = await getDb().generationRun.updateMany({ where: { id: runId, status: "FAILED" }, data: {
      status: "WAITING", expiresAt: new Date(Date.now() + 15 * 60_000), errorCode: null, errorMessage: null, currentStage: "Retrieving existing 3D job" } });
    if (!claimed.count) throw new AppError(409, "RUN_ACTIVE", "Generation already resumed.");
    await getDb().scene.update({ where: { id: sceneId }, data: { status: "RECONSTRUCTING" } });
    try { await start(resumeReconstruction, [runId, step.providerRequestId!]); }
    catch {
      await getDb().generationRun.update({ where: { id: runId }, data: { status: "FAILED", errorCode: "KNOWN_JOB_INTERRUPTED", errorMessage: "Resume could not be dispatched. Try Resume again." } });
      throw new AppError(503, "DISPATCH_FAILED", "Resume could not start. Try again.");
    }
  } else throw new AppError(409, "CANNOT_RESUME", "This run cannot be resumed automatically.");
  return Response.json({ runId }, { status: 202 });
});
