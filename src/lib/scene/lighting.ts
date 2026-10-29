import { z } from "zod";
import type { SceneComposition } from "./composition";
const light = z.object({ position: z.tuple([z.number().min(-20).max(20), z.number().min(0.1).max(20), z.number().min(-20).max(20)]), intensity: z.number().min(0).max(8) }).strict();
export const lightingSchema = z.object({ key: light, fill: light, ambient: z.number().min(0).max(4) }).strict();
export type Lighting = z.infer<typeof lightingSchema>;
export function defaultLighting(composition: SceneComposition | null): Lighting {
  const side = composition?.environment.lightDirection;
  return { key: { position: [side === "left" ? -5 : 5, 7, 4], intensity: side === "diffuse" ? 1 : 2 }, fill: { position: [side === "left" ? 5 : -5, 4, 6], intensity: 0.4 }, ambient: 1.2 };
}
