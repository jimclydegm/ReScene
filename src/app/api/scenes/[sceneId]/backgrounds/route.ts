import { start } from "workflow/api";
import { api, checkOrigin, readJson } from "@/lib/http";
import { requireUser } from "@/lib/auth/user";
import { reserveRun } from "@/lib/services/generation";
import { runInputSchema } from "@/lib/validation/generation";
import { backgroundVariantActionSchema } from "@/lib/validation/background-variants";
import { selectBackgroundVariant, deleteBackgroundVariant } from "@/lib/services/background-variants";
import { generateScene } from "@/workflows/generate";

export const maxDuration = 120;

export const POST = (request: Request, context: { params: Promise<{ sceneId: string }> }) =>
  api(async () => {
    checkOrigin(request);
    const user = await requireUser();
    const sceneId = (await context.params).sceneId;
    const body = backgroundVariantActionSchema.parse(await readJson(request));
    if (body.action === "SELECT") {
      await selectBackgroundVariant(sceneId, user.id, body.variantId, body.expectedRevision);
      return Response.json({ saved: true });
    }
    if (body.action === "DELETE") {
      await deleteBackgroundVariant(sceneId, user.id, body.variantId, body.expectedRevision);
      return Response.json({ saved: true });
    }
    const input = runInputSchema.parse({
      kind: "IMAGE_EDIT",
      expectedRevision: body.expectedRevision,
      idempotencyKey: body.idempotencyKey,
      confirmed: true,
      backgroundVariant: { ...(body.name ? { name: body.name } : {}), ...(body.stylePrompt ? { stylePrompt: body.stylePrompt } : {}) }
    });
    const run = await reserveRun(sceneId, user.id, input);
    if (run.status === "QUEUED") {
      try {
        await start(generateScene, [run.id, run.kind]);
      } catch {
        return Response.json({ runId: run.id, queued: true, message: "Saved. Use Resume to start this generation." }, { status: 202 });
      }
    }
    return Response.json({ runId: run.id }, { status: 202 });
  });
