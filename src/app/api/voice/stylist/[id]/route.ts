import { z } from "zod";
import { api, checkOrigin, readJson } from "@/lib/http";
import { voiceActor } from "@/lib/voice/actor";
import { readShopping, applyShopping } from "@/lib/services/shopping-stylist";
import { arrangementSchema } from "@/lib/demo/state";
const selection = z
  .object({ optionId: z.string().max(80), draft: arrangementSchema })
  .strict();
export const GET = (
  request: Request,
  context: { params: Promise<{ id: string }> },
) =>
  api(async () => {
    const row = await readShopping(
      await voiceActor(request, "showroom"),
      z.uuid().parse((await context.params).id),
    );
    return Response.json({
      id: row.id,
      status: row.status,
      phase: row.phase,
      result: row.result,
      error: row.errorMessage,
    });
  });
export const POST = (
  request: Request,
  context: { params: Promise<{ id: string }> },
) =>
  api(async () => {
    checkOrigin(request);
    const input = selection.parse(await readJson(request));
    return Response.json(
      await applyShopping(
        await voiceActor(request, "showroom"),
        z.uuid().parse((await context.params).id),
        input.optionId,
        input.draft,
      ),
    );
  });
