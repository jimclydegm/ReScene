import "server-only";
import { fal } from "@fal-ai/client";
import { requiredEnv } from "@/lib/env";

export function getSam3dClient() {
  fal.config({ credentials: requiredEnv("FAL_KEY") });
  return {
    client: fal,
    model: process.env.SAM3D_MODEL ?? "fal-ai/sam-3/3d-objects"
  };
}
