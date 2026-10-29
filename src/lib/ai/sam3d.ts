import "server-only";
import { fal } from "@fal-ai/client";
import { requiredEnv } from "@/lib/env";

export function getSam3dClient() {
  // A lost submission response may already have started paid work. Never auto-resubmit.
  fal.config({ credentials: requiredEnv("FAL_KEY"), retry: { maxRetries: 0 } });
  return {
    client: fal,
    model: process.env.SAM3D_MODEL ?? "fal-ai/sam-3/3d-objects"
  };
}
