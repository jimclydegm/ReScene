import { start } from "workflow/api";
import { api, checkOrigin, readJson } from "@/lib/http";
import { requireUser } from "@/lib/auth/user";
import { reserveRun } from "@/lib/services/generation";
import { runInputSchema } from "@/lib/validation/generation";
import { generateScene } from "@/workflows/generate";
export const POST = (request: Request, context: { params: Promise<{ sceneId: string }> }) => api(async () => {
  checkOrigin(request);
  const user = await requireUser();
  const input = runInputSchema.parse(await readJson(request));
  const run = await reserveRun((await context.params).sceneId, user.id, input);
  if (run.status === "QUEUED") {
    try { await start(generateScene, [run.id, run.kind]); }
    catch { return Response.json({ runId: run.id, queued: true, message: "Saved. Use Resume to start this generation." }, { status: 202 }); }
  }
  return Response.json({ runId: run.id }, { status: 202 });
});
