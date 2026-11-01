import { start } from "workflow/api";
import { api, checkOrigin, readJson } from "@/lib/http";
import { voiceActor } from "@/lib/voice/actor";
import { stylistInputSchema } from "@/lib/shopping/contracts";
import { reserveShopping } from "@/lib/services/shopping-stylist";
import { styleShoppingScene } from "@/workflows/shopping-stylist";
export const runtime = "nodejs";
export const maxDuration = 60;
// Shares the existing signed /api/voice guest cookie; typed input needs no ASR receipt.
export const POST = (request: Request) =>
  api(async () => {
    checkOrigin(request);
    const input = stylistInputSchema.parse(await readJson(request)),
      row = await reserveShopping(await voiceActor(request, "showroom"), input);
    if (row.status === "PENDING" || row.status === "WAITING")
      try {
        await start(styleShoppingScene, [row.id]);
      } catch {
        /* Recover this same reservation without resubmitting a claimed paid call. */
      }
    return Response.json({ id: row.id }, { status: 202 });
  });
